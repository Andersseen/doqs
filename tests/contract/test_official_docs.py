"""CONTRACT-080..086: the official documentation (apps/site, /docs) as a static artifact, requested over real HTTP."""

from __future__ import annotations

import gzip
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from conftest import REPO

CONTENT = REPO / "apps/site/src/content/docs"
SITE_DIST = REPO / "apps/site/dist/analog/public"


def _routes() -> dict[str, Path]:
    routes = {}
    for file in sorted(CONTENT.rglob("*.md")):
        relative = file.relative_to(CONTENT).with_suffix("")
        slug = "/".join(relative.parts)
        slug = re.sub(r"/index$", "", slug)
        match = re.search(r"^slug:\s*(\S+)\s*$", file.read_text().split("---")[1], re.M)
        routes["/docs/" + (match.group(1).strip("/") if match else slug)] = file
    return routes


def _title(file: Path) -> str:
    return re.search(r"^title:\s*(.+)$", file.read_text().split("---")[1], re.M).group(1).strip()


def _html(site, path: str) -> str:
    status, headers, body = site.get(path)
    assert status == 200 and headers["content-type"].startswith("text/html"), (path, status)
    return body.decode()


def _fragments(site) -> list[dict]:
    pages = []
    for file in sorted((site.root / "pagefind/fragment").glob("*.pf_fragment")):
        pages.append(json.loads(gzip.decompress(file.read_bytes()).removeprefix(b"pagefind_dcd")))
    return pages


def test_contract_080_every_markdown_file_is_a_prerendered_page_with_real_content(site_official):
    """CONTRACT-080: each document has static HTML: one h1, its title, the article text and the search marker."""
    routes = _routes()
    assert len(routes) >= 15
    for route, file in routes.items():
        html = _html(site_official, route)
        assert len(re.findall(r"<h1\b", html)) == 1, route
        assert f"<title>{_title(file)} · Doqs</title>" in html, route
        article = re.search(r'<article[^>]*data-pagefind-body[^>]*>(.*?)</article>', html, re.S)
        assert article, f"{route} has no indexed article"
        text = re.sub(r"<[^>]+>", " ", article.group(1))
        # 0.12 moved the "On this page" rail out of the indexed article, so the measured text is the
        # document body alone; the floor is recalibrated from 60 to 40 words of real content.
        assert len(text.split()) > 40, f"{route} renders almost no text"
        assert "ng-server-context" in html, f"{route} was not server-rendered"
    assert "Documentation page not found" not in "".join(_html(site_official, route) for route in routes)


def test_contract_081_documentation_metadata_is_per_page_and_never_invents_a_domain(site_official):
    """CONTRACT-081: description per page; with an origin each page declares its own canonical, never the landing's."""
    for route, file in _routes().items():
        html = _html(site_official, route)
        description = re.search(r'<meta name="description" content="([^"]*)"', html)
        assert description and len(description.group(1)) > 20, route
        canonicals = re.findall(r'<link rel="canonical" href="([^"]+)"', html)
        if canonicals:
            assert len(canonicals) == 1 and canonicals[0].endswith(route), (route, canonicals)
            assert re.search(rf'<meta property="og:url" content="{re.escape(canonicals[0])}"', html), route
    landing = _html(site_official, "/")
    assert "Documentation that belongs in your app." in landing
    landing_canonical = re.findall(r'<link rel="canonical" href="([^"]+)"', landing)
    assert len(landing_canonical) <= 1 and all(href.endswith("/") for href in landing_canonical)


def test_contract_082_pagefind_indexes_exactly_the_documentation_pages(site_official):
    """CONTRACT-082: the index holds the documents at their public URLs; the landing and the docs index are not in it."""
    routes = _routes()
    pages = _fragments(site_official)
    assert sorted(page["url"] for page in pages) == sorted(route + "/" for route in routes)
    assert {page["url"].rstrip("/"): page["meta"]["title"] for page in pages} == {r: _title(f) for r, f in routes.items()}
    urls = {page["url"] for page in pages}
    assert "/" not in urls and "/docs/" not in urls
    landing_text = re.sub(r"<[^>]+>", " ", _html(site_official, "/"))
    for phrase in ("Documentation that belongs in your app", "What Doqs does"):
        assert phrase in landing_text
        assert not [page["url"] for page in pages if phrase in page["content"]], phrase
    for page in pages:
        # "On this page" is also ordinary prose in the navigation guide, so only chrome-only strings are asserted.
        for chrome in ("Page navigation", "Close navigation", "Copy code"):
            assert chrome not in page["content"], (page["url"], chrome)
    for name in ("pagefind.js", "pagefind-entry.json", "pagefind-worker.js"):
        assert site_official.get(f"/pagefind/{name}")[0] == 200, name


def test_contract_083_unknown_documentation_urls_stay_404(site_official):
    """CONTRACT-083: unknown documents, the bare folder prefixes and a fragment-less variant answer 404, not a soft page."""
    for path in ("/docs/does-not-exist", "/docs/guides", "/docs/guides/missing", "/docs/v/1", "/documentation"):
        assert site_official.get(path)[0] == 404, path


def test_contract_084_sitemap_lists_the_landing_and_every_document_when_generated(site_official):
    """CONTRACT-084: with a configured origin the sitemap holds the landing, the docs index and every document."""
    status, _, body = site_official.get("/sitemap.xml")
    if status == 404:
        return
    ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    locs = [el.text for el in ET.fromstring(body).iter(f"{ns}loc")]
    paths = sorted(re.sub(r"^https?://[^/]+", "", loc) for loc in locs)
    assert paths == sorted(["/", "/docs", *_routes()])


def test_contract_085_documentation_shows_no_private_paths_or_secrets(site_official):
    """CONTRACT-085: no machine paths, workspace links or credential names in any prerendered documentation page."""
    for route in _routes():
        html = _html(site_official, route)
        for needle in ("/Volumes/", "/Users/", "workspace:", "NPM_TOKEN", "CLOUDFLARE_API_TOKEN", "@getdoq"):
            assert needle not in html, f"{route} contains {needle!r}"


def test_contract_086_the_landing_does_not_download_the_documentation_region(site_official):
    """CONTRACT-086: scripts a landing visit loads exclude Doqs's components, so the docs are a lazy region."""
    html = _html(site_official, "/")
    urls = set(re.findall(r'(?:src|href)="(/assets/[^"]+\.js)"', html))
    assert urls, "landing references no scripts"
    for url in urls:
        source = (SITE_DIST / url.lstrip("/")).read_text(errors="ignore")
        assert "doq-root" not in source and "doq-shell" not in source, f"{url} contains the Doqs documentation UI"
        assert "analog-markdown" not in source, f"{url} contains Analog's Markdown renderer"
    docs_chunks = [p for p in (SITE_DIST / "assets").glob("*.js") if "doq-root" in p.read_text(errors="ignore")]
    assert docs_chunks, "the Doqs UI is in no chunk at all"
