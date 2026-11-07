import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// #300: the furniture library keeps the search and a Filters button in view, the filters sit in a drawer that is
// closed by default, and the results follow the header. The element needs a browser, so these read its source.
const src = readFileSync(new URL("./components/library.ts", import.meta.url), "utf8");
const render = src.slice(src.indexOf("  render() {"), src.indexOf("  /** The packs to narrow"));
const furniture = readFileSync(new URL("./components/editor/furniture.ts", import.meta.url), "utf8");

test("the header (search, Filters button, drawer) comes before the results in the DOM", () => {
  const at = (s: string) => render.indexOf(s);
  assert.ok(at('class="fp3d-lib-top"') >= 0);
  assert.ok(at("fp3d-search") < at("fp3d-lib-filterbtn"), "search first, then the button");
  assert.ok(at("fp3d-lib-filterbtn") < at('id="fp3d-lib-filters"'));
  assert.ok(at('id="fp3d-lib-filters"') < at("this.section("), "the cards come after every filter control");
});

test("the Filters button is a native button that says what it controls and how many filters are on", () => {
  assert.match(render, /<button class="fp3d-lib-filterbtn [^>]*aria-expanded=\$\{open\} aria-controls="fp3d-lib-filters"/);
  assert.match(render, /fp3d-lib-badge">\$\{n\}/);
  assert.match(render, /const n = active\.length;/, "the badge counts the active filters, the auto-set room included");
});

test("the drawer is closed by default, remembered per device, and typing never opens it", () => {
  assert.match(src, /this\._filtersOpen = load<boolean>\(STORE_FILTERS, false\) === true;/);
  assert.match(src, /function save\(key: string, value: unknown\)[\s\S]*?catch/, "storage is wrapped in try/catch");
  const setQuery = src.slice(src.indexOf("private setQuery"), src.indexOf("private setFiltersOpen"));
  assert.ok(!/_filtersOpen|setFiltersOpen/.test(setQuery));
  assert.match(render, /<div id="fp3d-lib-filters" class="fp3d-lib-drawer" \?hidden=\$\{!open\}>/);
});

test("room and pack are labelled selects; linkable, lights up and outdoors are toggle buttons", () => {
  assert.equal((render.match(/<label class="fp3d-lib-sel"/g) ?? []).length, 2);
  assert.match(render, /lib_room_label[\s\S]*<select/);
  assert.match(render, /lib_pack_label[\s\S]*<select/);
  assert.equal((render.match(/aria-pressed=/g) ?? []).length, 3);
  assert.equal((render.match(/<span aria-hidden="true">/g) ?? []).length, 3, "the emoji are hidden from screen readers");
  assert.match(render, /role="group" aria-label=\$\{t\("lib_toggles_label"\)\}/);
  assert.ok(!render.includes("fp3d-lib-rooms"), "the 40 room chips are gone");
});

test("one polite status node announces the result count, debounced", () => {
  assert.equal((src.match(/role="status"/g) ?? []).length, 1);
  assert.match(render, /<div class="fp3d-lib-sr" role="status" aria-live="polite">\$\{this\._status\}<\/div>/);
  assert.match(src, /setTimeout\(\(\) => \(this\._status = this\.resultText\), 500\)/);
});

test("no results: says what found nothing, how many filters hide, and offers Clear filters", () => {
  const empty = render.slice(render.indexOf('class="fp3d-lib-empty"'));
  assert.match(empty, /lib_no_match/);
  assert.match(empty, /lib_hidden_by_filters/);
  assert.match(empty, /lib_clear_filters/);
});

test("touch: the controls reach 40-44 px in the library's own shadow root", () => {
  const styles = src.slice(src.indexOf("static styles"));
  assert.match(styles, /@media \(pointer: coarse\)[\s\S]*\.fp3d-lib-filterbtn[\s\S]*\.fp3d-lib-sel select[\s\S]*min-height: var\(--fp3d-touch, 44px\)/);
});

test("while an item is being placed, the banner stays above the library and the 'new items go into' line is dropped", () => {
  assert.match(furniture, /\$\{this\._placing \? nothing : html`<p class="fp3d-sub">\$\{room \? this\.t\("furniture_into"/);
  assert.ok(furniture.indexOf("fp3d-placing") < furniture.indexOf("<fp3d-library"));
});
