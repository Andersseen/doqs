"""CONTRACT-050..055: interactive playgrounds, checked on the packed tarball and the static output."""

from __future__ import annotations

import re

from test_search import _fragments

CHROME = ("Preview width", "No events yet", "Not set", "Copy Template code", "Include drafts", "Simulate failure")


def _html(site, path: str) -> str:
    status, _, body = site.get(path)
    assert status == 200, path
    return body.decode()


def test_contract_050_tarball_declares_and_ships_the_playground_api_without_consumer_code(package_files, manifest):
    """CONTRACT-050: the additive API is typed and shipped; no ecosystem library or showcase code enters the package."""
    declarations = package_files["types/doqs-analog.d.ts"].decode()
    for name in (
        "DoqPlaygroundComponent", "DoqPlaygroundDefinition", "DoqPlaygroundRegistry", "DoqPlaygroundControl", "DoqSelectControl",
        "DoqNumberControl", "formatDoqUsage", "formatDoqEventPayload", "validateDoqPlaygrounds", "parseDoqDocument", "DOQ_INLINE_PLAYGROUND_PATTERN",
    ):
        assert re.search(rf"\b{name}\b", declarations), name
    runtime = package_files["fesm2022/doqs-analog.mjs"].decode()
    assert "data-doq-playground" in runtime and "inputBinding" in runtime and "outputBinding" in runtime
    assert "ɵ" not in re.sub(r"ɵɵ\w+|ɵ\w+", "", runtime)  # only Angular's own generated factories, no private API calls by name
    assert set(manifest.get("dependencies", {})) == {"tslib"}
    assert not {"@voltui/components", "angular-movement", "lumen-icons", "tailwindcss"} & set(manifest.get("peerDependencies", {}))
    for path, data in package_files.items():
        if path.endswith(".md"):
            continue
        text = data.decode("utf-8", errors="ignore")
        for private in ("VantaButtonPlayground", "ForgeRequestPlayground", "MovementPlayground", "movement-enter", "forge-request", "vanta-button"):
            assert private not in text, f"{path} leaks {private}"
    css = package_files["styles.css"].decode()
    for token in ("--host-docs-playground-surface", "--host-docs-playground-preview"):
        assert token in css, token
    assert "forced-colors" in css and "prefers-reduced-motion" in css


def test_contract_051_static_html_has_a_meaningful_preview_and_untouched_surroundings(site_a):
    """CONTRACT-051: the playground is prerendered with the real component at its initial state; headings, TOC and prose are intact."""
    html = _html(site_a, "/docs/components/button")
    assert "<p>::playground[" not in html  # the directive paragraph is replaced; inline code in prose may still name it
    assert html.count('data-doq-playground="vanta-button"') == 1
    assert re.search(r"<button voltbutton[^>]*data-variant=\"solid\"[^>]*>Save changes</button>", html)
    assert re.search(r"<option[^>]*selected[^>]*>Medium</option>", html)
    assert re.search(r"<input[^>]*type=\"text\"[^>]*value=\"Save changes\"", html)
    ids = re.findall(r'<h2[^>]*id="([^"]+)"', html)
    assert ids == ["doq-search-title", "choose-a-style", "example", "behavior"]
    toc = re.findall(r'href="[^"]*#([^"]+)"', html[html.index('aria-label="On this page"'):])
    assert {"choose-a-style", "example", "behavior"} <= set(toc)
    assert html.count("<h1") == 1
    canonicals = re.findall(r'<link[^>]+rel="canonical"[^>]+href="([^"]+)"', html)
    assert canonicals == ["https://docs.example.test/docs/components/button"]  # Showcase A configures its test origin.


def test_contract_052_two_independent_instances_with_stable_ids(site_b):
    """CONTRACT-052: several playgrounds on one page keep unique, deterministic ids."""
    html = _html(site_b, "/concepts/models")
    assert html.count('data-doq-playground="') == 2
    ids = re.findall(r'\bid="(doq-playground-[^"]+)"', html)
    assert len(ids) == len(set(ids)) and ids
    again = _html(site_b, "/concepts/models")
    assert re.findall(r'\bid="(doq-playground-[^"]+)"', again) == ids
    assert "GET /v1/entries?collection=product-guides&amp;limit=20&amp;locale=en" in html


def test_contract_053_pagefind_indexes_the_prose_and_none_of_the_playground_chrome(site_a, site_b):
    """CONTRACT-053: controls, toolbar, events and code panel are data-pagefind-ignore; surrounding Markdown is indexed."""
    for site, path in ((site_a, "/docs/components/button"), (site_b, "/concepts/models")):
        html = _html(site, path)
        start = html.index('class="doq-playground"')
        assert 'data-pagefind-ignore' in html[html.rfind("<div", 0, start): start + 40]
    pages = _fragments(site_a) + _fragments(site_b)
    models = next(page for page in _fragments(site_b) if page["url"] == "/concepts/models/")
    assert "Entries are read through the delivery API" in models["content"]
    for page in pages:
        for text in CHROME:
            assert text not in page["content"], (page["url"], text)
    button = next(page for page in _fragments(site_a) if page["url"] == "/docs/components/button/")
    assert "Change the inputs of a real Volt UI button" in button["content"]


def test_contract_054_official_documentation_prerenders_its_live_playground(site_official):
    """CONTRACT-054: the guide and its Angular Movement playground are static HTML."""
    html = _html(site_official, "/docs/guides/interactive-playgrounds")
    assert html.count("<h1") == 1
    assert 'data-doq-playground="movement-enter"' in html and 'data-testid="movement-target"' in html
    assert "Interactive playgrounds" in _html(site_official, "/docs")


def test_contract_055_archived_and_plain_documents_have_no_playground_runtime(site_a):
    """CONTRACT-055: pages without the directive render exactly as before (no playground markup)."""
    for path in ("/docs/overview", "/docs/v/1/overview"):
        status, _, body = site_a.get(path)
        assert status == 200, path
        assert "doq-playground" not in body.decode(), path
