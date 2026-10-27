"""CONTRACT-070..079: versioned documentation (0.6) in the packed tarball and the generated static output."""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path

import pytest

from conftest import LIBRARY_VERSION, REPO, _serve
from test_http import ARCHIVES, BASE_PATH, expected_archive_routes
from test_search import _fragments

APPS = list(ARCHIVES)


def _html(site, route: str) -> str:
    status, headers, body = site.get(route)
    assert status == 200 and headers["content-type"].startswith("text/html"), route
    return body.decode()


@pytest.mark.parametrize("app", APPS)
def test_contract_070_every_archived_document_and_index_is_prerendered_at_its_versioned_url(app, request):
    """CONTRACT-070: archive index and each archived document answer 200 at <prefix>/<slug> with their own title and filter."""
    info = ARCHIVES[app]
    site = request.getfixturevalue(info["site"])
    routes = expected_archive_routes(app)
    assert len(routes) >= 5
    for route, title in routes.items():
        html = _html(site, route)
        assert re.search(rf"<h1[^>]*>{re.escape(title)}</h1>", html), route
        assert (
            f'data-pagefind-filter="doqsVersion:{info["id"]}"' in html
            or f'data-pagefind-filter="doqsVersion">{info["id"]}</span>' in html
        ), route
        assert re.search(r"<title>[^<]*· " + re.escape(info["label"]) + "</title>", html), f"{route}: version missing from the title"
    index = _html(site, info["prefix"])
    assert "doq-index" in index and f'data-doq-version="{info["id"]}"' in index
    cards = re.findall(r'class="doq-index-card"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*class="doq-index-card"', index)
    hrefs = {a or b for a, b in cards}
    assert hrefs and all(href.startswith(info["prefix"] + "/") for href in hrefs), hrefs


@pytest.mark.parametrize("app", APPS)
def test_contract_071_current_urls_are_unchanged_and_carry_the_current_filter(app, request):
    """CONTRACT-071: the current version keeps its pre-0.6 URLs (no /latest, no /v/current) and is filtered as "latest"."""
    info = ARCHIVES[app]
    site = request.getfixturevalue(info["site"])
    base = BASE_PATH[app]
    html = _html(site, base or "/")
    assert "doq-index" in html and 'data-doq-version="latest"' in html
    current_html = _html(site, f"{base}/installation" if app == "showcase-a" else "/onboarding/first-application")
    assert (
        'data-pagefind-filter="doqsVersion:latest"' in current_html
        or 'data-pagefind-filter="doqsVersion">latest</span>' in current_html
    )
    for duplicate in ("/latest", "/v/latest", "/current", "/v/current", "/docs/latest", "/docs/v/latest", "/docs/current"):
        assert site.get(duplicate)[0] == 404, duplicate


@pytest.mark.parametrize("app", APPS)
def test_contract_072_unknown_versions_and_missing_archive_documents_are_404(app, request):
    """CONTRACT-072: nothing is prerendered for an unconfigured version or a page the archive does not have."""
    info = ARCHIVES[app]
    site = request.getfixturevalue(info["site"])
    prefix = info["prefix"].removesuffix("/1")
    current_only = "/docs/guides/theming" if app == "showcase-a" else "/guides/environments"
    assert site.get(current_only)[0] == 200
    for route in (f"{prefix}/9", f"{prefix}/9/anything", prefix, info["prefix"] + current_only.removeprefix(info["current_prefix"]), info["prefix"] + "/missing.html"):
        assert site.get(route)[0] == 404, route


@pytest.mark.parametrize("app", APPS)
def test_contract_073_canonical_policy_no_cross_version_canonical_and_no_hardcoded_origin(app, request):
    """CONTRACT-073: configured canonical origins stay within the same archive; no example domain is hardcoded."""
    info = ARCHIVES[app]
    site = request.getfixturevalue(info["site"])
    for route in [*expected_archive_routes(app), info["prefix"]]:
        html = _html(site, route)
        for canonical in re.findall(r'<link[^>]+rel="canonical"[^>]*>', html):
            assert info["prefix"] in canonical, f"{route} canonicalizes outside its own version: {canonical}"
        assert "doqs.dev" not in html and "pages.dev" not in html


@pytest.mark.parametrize("app", APPS)
def test_contract_074_pagefind_indexes_every_version_with_filter_metadata(app, request):
    """CONTRACT-074: each indexed page carries its own version filter; default and localized archive URLs keep their prefixes."""
    info = ARCHIVES[app]
    site = request.getfixturevalue(info["site"])
    pages = _fragments(site)
    by_version: dict[str, list[str]] = {}
    for page in pages:
        values = page["filters"]["doqsVersion"]
        assert len(values) == 1, page["url"]
        by_version.setdefault(values[0], []).append(page["url"])
    assert set(by_version) == {"latest", info["id"]}
    archive_prefixes = [info["prefix"] + "/"]
    if app == "showcase-a":
        archive_prefixes.append("/es/docs/v/1/")
    assert all(url.startswith(tuple(archive_prefixes)) for url in by_version[info["id"]])
    assert not any(url.startswith(info["prefix"] + "/") for url in by_version["latest"])
    assert sorted(by_version[info["id"]]) == sorted(route + "/" for route in expected_archive_routes(app))
    status, _, filters = site.get("/pagefind/pagefind-entry.json")
    assert status == 200 and b"filters" not in b""  # entry reachable; filter shards are loaded on demand
    assert any((site.root / "pagefind/filter").glob("*.pf_filter"))


@pytest.mark.parametrize("app", APPS)
def test_contract_075_generated_api_references_are_independent_per_version(app):
    """CONTRACT-075: separate manifests, hashes and link targets; neither version references the other's pages."""
    info = ARCHIVES[app]
    current_dir = REPO / f"apps/{app}/src/content/docs/reference/generated"
    archive_dir = REPO / f"apps/{app}/src/content/{info['directory']}/reference/generated"
    current_manifest = json.loads((current_dir / ".doq-api.json").read_text())
    archive_manifest = json.loads((archive_dir / ".doq-api.json").read_text())
    assert current_manifest != archive_manifest
    for directory, manifest in ((current_dir, current_manifest), (archive_dir, archive_manifest)):
        assert sorted(path.name for path in directory.glob("*.md")) == sorted(manifest["files"])
        for name, digest in manifest["files"].items():
            assert hashlib.sha256((directory / name).read_text().encode()).hexdigest() == digest, name
    archive_text = "\n".join(path.read_text() for path in archive_dir.glob("*.md"))
    current_text = "\n".join(path.read_text() for path in current_dir.glob("*.md"))
    assert f"{info['prefix']}/reference/generated/" in archive_text
    assert f"({info['current_prefix']}/reference/generated/" in current_text
    assert not re.search(rf"\]\({re.escape(info['current_prefix'])}/reference/", archive_text), "archive links to the current reference"
    assert f"{info['prefix']}/reference" not in current_text, "current links to the archive reference"


@pytest.mark.parametrize("app", APPS)
def test_contract_076_archived_reference_pages_are_served_and_differ_from_current(app, request):
    """CONTRACT-076: the same symbol exists in both versions with different content, each at its own URL."""
    info = ARCHIVES[app]
    site = request.getfixturevalue(info["site"])
    symbol = "vanta-alert-component" if app == "showcase-a" else "forge-client"
    current = _html(site, f"{info['current_prefix']}/reference/generated/{symbol}")
    archived = _html(site, f"{info['prefix']}/reference/generated/{symbol}")
    assert current != archived
    marker_current, marker_archived = ("alertTitle", "closed") if app == "showcase-a" else ("ForgePage", "getEntry")
    assert marker_current in current and marker_current not in archived
    assert marker_archived in archived and marker_archived not in current


def test_contract_077_package_exports_the_versioning_api(package_files, manifest):
    """CONTRACT-077: the package ships the versioning types, the selector and the filter name; no new runtime dependency."""
    assert manifest["version"] == LIBRARY_VERSION
    declarations = package_files["types/doqs-analog.d.ts"].decode() + package_files["types/doqs-analog-config.d.ts"].decode()
    for name in ("DoqVersioning", "DoqArchiveConfig", "DoqVersionSwitcherComponent", "doqVersionLinks", "DOQ_VERSION_FILTER", "versioning?"):
        assert name in declarations, name
    assert set(manifest["dependencies"]) == {"tslib"}
    assert "canonicalOrigin" in declarations and "pathSegment" in declarations
    assert ".doq-version" in package_files["styles.css"].decode()


@pytest.mark.parametrize("app", APPS)
def test_contract_078_archive_fixtures_do_not_leak_into_the_tarball(app, package_files):
    """CONTRACT-078: no archived Markdown or fixture source is shipped."""
    for path in package_files:
        assert "docs-v1" not in path and "vanta-ui-v1" not in path and "forge-sdk-v1" not in path, path
    for data in package_files.values():
        text = data.decode(errors="ignore")
        assert "sandpiper-offset" not in text and "quill-ember" not in text


@pytest.mark.parametrize("app,directory,prefix,base", [
    ("showcase-a", "DOQ_CONSUMER_LEGACY_A_DIR", "doq-e2e-consumer-legacy-a", "/docs"),
    ("showcase-b", "DOQ_CONSUMER_LEGACY_B_DIR", "doq-e2e-consumer-legacy-b", ""),
])
def test_contract_079_unversioned_consumer_output_is_identical_in_shape_to_0_5(app, directory, prefix, base):
    """CONTRACT-079: a consumer configured as in 0.5 (no versioning), built from the tarball, has no version markup or archive routes."""
    import tempfile

    root = Path(os.environ.get(directory, Path(tempfile.gettempdir()) / prefix)) / "dist/analog/public"
    if not (root / "index.html").exists():
        if os.environ.get("DOQ_REQUIRE_LEGACY"):
            pytest.fail(f"{root} missing: run `pnpm consumer:build` first", pytrace=False)
        pytest.skip(f"{root} not built (run `pnpm consumer:build`; the quality gate requires it)")
    gen = _serve(root)
    site = next(gen)
    try:
        index = _html(site, base or "/")
        assert "doq-index" in index
        assert "data-doq-version" not in index and "doq-version" not in index and "data-pagefind-filter" not in index
        for html_file in root.rglob("*.html"):
            text = html_file.read_text(errors="ignore")
            assert "data-pagefind-filter" not in text and 'class="doq-version' not in text, html_file
        assert not (root / "v").exists() and not (root / "docs/v").exists()
        pages = _fragments(site)
        assert pages and all("filters" not in page or not page["filters"] for page in pages)
        status = site.get((base or "") + "/v/1")[0]
        assert status == 404
    finally:
        try:
            next(gen)
        except StopIteration:
            pass
