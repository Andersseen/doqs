"""CONTRACT-030..034: the official website's generated static output, requested over real HTTP."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

from conftest import REPO

SITE_DIST = REPO / "apps/site/dist/analog/public"
SECRET_PATTERNS = [
    r"CLOUDFLARE_API_TOKEN",
    r"CLOUDFLARE_ACCOUNT_ID",
    r"NODE_AUTH_TOKEN",
    r"NPM_TOKEN",
    r"npm_[A-Za-z0-9]{36}",
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
]


class _Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta: dict[str, str] = {}
        self.links: list[dict[str, str]] = []
        self.title = ""
        self._in_title = False
        self.h1 = 0
        self.landmarks: set[str] = set()

    def handle_starttag(self, tag, attrs):
        a = {k: v or "" for k, v in attrs}
        if tag == "meta":
            self.meta[a.get("name") or a.get("property") or a.get("charset", "charset")] = a.get("content", "")
        elif tag == "link":
            self.links.append(a)
        elif tag == "title":
            self._in_title = True
        elif tag == "h1":
            self.h1 += 1
        elif tag in {"main", "header", "footer", "nav"}:
            self.landmarks.add(tag)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def _page(site) -> tuple[str, _Head]:
    status, headers, body = site.get("/")
    assert status == 200 and headers["content-type"].startswith("text/html")
    html = body.decode()
    parser = _Head()
    parser.feed(html)
    return html, parser


def test_contract_030_homepage_is_prerendered_with_content_and_landmarks(site_official):
    """CONTRACT-030: the HTML a crawler receives already contains the content, one h1 and the landmarks."""
    html, page = _page(site_official)
    assert page.h1 == 1
    assert page.landmarks >= {"main", "header", "footer", "nav"}
    assert "Your documentation, inside your Angular app." in html
    assert "pnpm add @doqs/analog" in html
    assert "<app-root" in html and "ng-server-context" in html, "page was not server-rendered"
    assert (SITE_DIST / "favicon.svg").exists()


def test_contract_031_metadata_is_complete_and_never_invents_a_domain(site_official):
    """CONTRACT-031: title, description, Open Graph and Twitter tags; canonical only when an origin is configured."""
    html, page = _page(site_official)
    assert page.title.startswith("Doqs")
    assert 50 < len(page.meta["description"]) < 200
    for key in ("og:title", "og:description", "og:type", "twitter:card", "twitter:title"):
        assert page.meta.get(key), key
    canonical = [link for link in page.links if link.get("rel") == "canonical"]
    robots = site_official.get("/robots.txt")
    assert robots[0] == 200 and robots[1]["content-type"].startswith("text/plain")
    robots_text = robots[2].decode()
    assert "User-agent: *" in robots_text
    sitemap_status = site_official.get("/sitemap.xml")[0]
    if canonical:
        assert len(canonical) == 1 and canonical[0]["href"].startswith("https://")
        assert page.meta["og:url"] == canonical[0]["href"]
        assert f"Sitemap: {canonical[0]['href']}sitemap.xml" in robots_text
        assert sitemap_status == 200
    else:
        assert "og:url" not in page.meta
        assert "Sitemap:" not in robots_text
        assert sitemap_status == 404, "a sitemap must not exist without a configured origin"


def test_contract_032_sitemap_is_valid_when_generated(site_official):
    """CONTRACT-032: when an origin is configured the sitemap is well-formed and lists only the prerendered route."""
    status, headers, body = site_official.get("/sitemap.xml")
    if status == 404:
        return
    root = ET.fromstring(body)
    assert root.tag == "{http://www.sitemaps.org/schemas/sitemap/0.9}urlset"
    locs = [el.text for el in root.iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
    assert locs and all(loc.startswith("https://") for loc in locs)


def test_contract_033_output_paths_and_no_server_runtime(site_official):
    """CONTRACT-033: a purely static artifact: no worker, functions or server bundle in the deployable directory."""
    assert (SITE_DIST / "index.html").exists()
    for forbidden in ("_worker.js", "_routes.json", "functions", "server"):
        assert not (SITE_DIST / forbidden).exists(), forbidden
    scripts = list(SITE_DIST.rglob("*.js"))
    assert scripts, "client bundle missing"


def test_contract_034_no_secrets_in_generated_artifacts():
    """CONTRACT-034: the deployable output contains no credential names or token-shaped strings."""
    for path in SITE_DIST.rglob("*"):
        if path.is_file() and path.suffix in {".html", ".js", ".css", ".txt", ".xml", ".json", ".svg", ".map"}:
            text = path.read_text(errors="ignore")
            for pattern in SECRET_PATTERNS:
                assert not re.search(pattern, text), f"{path.relative_to(SITE_DIST)} matches {pattern}"
