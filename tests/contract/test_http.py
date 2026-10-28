"""CONTRACT-006..010: the generated static documentation, requested over real HTTP."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from conftest import REPO


def _frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text()
    match = re.match(r"---\n(.*?)\n---\n", text, re.S)
    assert match, f"{path} has no frontmatter"
    return dict(line.split(": ", 1) for line in match.group(1).splitlines() if ": " in line)


# Showcase A mounts Doqs on one route of a product site; Showcase B is docs-first (the whole app is documentation).
BASE_PATH = {"showcase-a": "/docs", "showcase-b": ""}


def _expected_routes(app: str) -> dict[str, str]:
    """Public route -> title, derived from the Markdown sources (custom slug wins over path)."""
    content = REPO / f"apps/{app}/src/content/docs"
    routes = {}
    directories = [(content, BASE_PATH[app])]
    if app == "showcase-a":
        directories.extend([
            (REPO / "apps/showcase-a/src/content/docs-es", "/es/docs"),
            (REPO / "apps/showcase-a/src/content/docs-ar", "/ar/docs"),
        ])
    for directory, base_path in directories:
        for file in sorted(directory.rglob("*.md")):
            meta = _frontmatter(file)
            slug = meta.get("slug") or str(file.relative_to(directory).with_suffix("")).removesuffix("/index")
            routes[base_path + "/" + slug.strip("/")] = meta["title"]
    return routes


# (app, site fixture, archive prefix, archive content directory, archive version id, archive label)
ARCHIVES = {
    "showcase-a": {"site": "site_a", "prefix": "/docs/v/1", "directory": "docs-v1", "id": "1", "label": "v1.x", "current_prefix": "/docs"},
    "showcase-b": {"site": "site_b", "prefix": "/v/1", "directory": "docs-v1", "id": "1", "label": "1.x", "current_prefix": ""},
}


def expected_archive_routes(app: str) -> dict[str, str]:
    """Archive public route -> title, derived from the archived Markdown sources (custom slug wins)."""
    info = ARCHIVES[app]
    content = REPO / f"apps/{app}/src/content/{info['directory']}"
    routes = {}
    directories = [(content, info["prefix"])]
    if app == "showcase-a":
        directories.append((REPO / "apps/showcase-a/src/content/docs-es-v1", "/es/docs/v/1"))
    for directory, prefix in directories:
        for file in sorted(directory.rglob("*.md")):
            meta = _frontmatter(file)
            slug = meta.get("slug") or str(file.relative_to(directory).with_suffix("")).removesuffix("/index")
            routes[prefix + "/" + slug.strip("/")] = meta["title"]
    return routes




@pytest.mark.parametrize("app,site_name", [("showcase-a", "site_a"), ("showcase-b", "site_b")])
def test_contract_006_every_markdown_document_is_prerendered_at_its_public_route(app, site_name, request):
    """CONTRACT-006: each source document is served at exactly its canonical or custom-slug URL, with its content."""
    site = request.getfixturevalue(site_name)
    routes = _expected_routes(app)
    assert len(routes) >= 5
    for route, title in routes.items():
        status, headers, body = site.get(route)
        assert status == 200, route
        assert headers["content-type"].startswith("text/html"), route
        html = body.decode()
        assert re.search(rf"<h1[^>]*>{re.escape(title)}</h1>", html), f"{route}: rendered title missing"
        assert "<title>" in html and title in re.search(r"<title>(.*?)</title>", html, re.S).group(1)
    status, _, body = site.get(BASE_PATH[app] or "/")
    assert status == 200 and b"doq-index" in body


def test_contract_007_custom_slug_serves_the_document_and_its_source_path_does_not(site_b):
    """CONTRACT-007: Showcase B (mounted at the root) declares `slug: onboarding/first-application` for getting-started.md."""
    status, _, body = site_b.get("/onboarding/first-application")
    assert status == 200
    assert b"Create a workspace" in body and b"Request an entry" in body
    for source_path in ("/getting-started", "/getting-started.md", "/getting-started/index.html"):
        assert site_b.get(source_path)[0] == 404, source_path


@pytest.mark.parametrize("path", ["/missing", "/docs/does-not-exist", "/docs/guides/does-not-exist", "/docs/overview.md", "/docs/%00"])
def test_contract_008_unknown_routes_are_404_without_leaking_content(site_a, path):
    """CONTRACT-008: unknown URLs are 404 plain text, never an HTML page or a stack trace."""
    status, headers, body = site_a.get(path)
    assert status == 404
    assert body == b"Not found"
    assert headers["content-type"].startswith("text/plain")


@pytest.mark.parametrize(
    "path",
    ["/../package.json", "/%2e%2e/package.json", "/docs/../../package.json", "/docs/%2e%2e/%2e%2e/%2e%2e/etc/passwd", "/..%2f..%2fpackage.json"],
)
def test_contract_009_path_traversal_cannot_escape_the_build_directory(site_a, path):
    """CONTRACT-009: traversal attempts never return files outside dist/analog/public."""
    status, _, body = site_a.get(path)
    assert status in (400, 404)
    assert b'"name"' not in body and b"root:" not in body


def test_contract_010_html_references_only_assets_that_exist_and_have_the_right_type(site_a, site_b):
    """CONTRACT-010: every script/stylesheet referenced by a document resolves with a sensible content type."""
    for site, index in ((site_a, "/docs"), (site_b, "/")):
        _, _, body = site.get(index)
        references = re.findall(r'(?:src|href)="(/[^"]+\.(?:js|css))"', body.decode())
        assert references, "no assets referenced"
        for reference in dict.fromkeys(references):
            status, headers, data = site.get(reference)
            assert status == 200 and data, reference
            expected = "text/javascript" if reference.endswith(".js") else "text/css"
            assert headers["content-type"].startswith(expected), reference
