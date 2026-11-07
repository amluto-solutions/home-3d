// The slim phone header (#216); the View panel stays open while you change things (#247).
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding } from "./model.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener: () => undefined, removeEventListener: () => undefined });
g.location = { search: "", hash: "", pathname: "/home_3d" };
g.history = { state: null, replaceState: () => undefined };

const { Floorplan3dPanel } = await import("./panel.ts");

function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol") return "";
  if (typeof v === "function") return "<fn>";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(v);
}

function panel(floorId: string | null) {
  const p = new (Floorplan3dPanel as any)();
  p.hass = { language: "en", user: { id: "u", is_admin: true, name: "x" }, states: {}, themes: { darkMode: true } };
  const b = emptyBuilding();
  const floor = (id: string, name: string, elevation: number) => ({ id, name, rooms: [{ id: `${id}r`, name: "Room", points: [[0, 0], [4, 0], [4, 3], [0, 3]], area_id: null }], furniture: [], placements: [], openings: [], walls: [], height: 2.5, elevation });
  b.floors = [floor("f1", "Ground", 0), floor("f2", "Upper", 2.5)] as unknown as typeof b.floors;
  b.settings.roof = { ...b.settings.roof, type: "gable" };
  p.data.building = b;
  p.data.canEdit = true;
  p.willUpdate(new Map());
  p._floorId = floorId;
  return p;
}

test("the View panel stays open while several things change, on a phone as on a wide screen (#247 ends #216's fold)", () => {
  for (const width of [390, 1280]) {
    (g.window as Record<string, unknown>).innerWidth = width;
    const p = panel(null);
    p._viewOpen = true;
    for (const id of ["theme", "markers", "pinSize", "clock"]) p.onViewChange({ detail: { id } });
    assert.equal(p._viewOpen, true, `${width} px`);
  }
});

test("the phone header is one row: no title, '3D' and 'Edit' as words, Extensions and Settings as named icons (#216, #249)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./panel.ts", import.meta.url), "utf8");
  const at = src.indexOf("@media ${unsafeCSS(PHONE_MEDIA)} {\n        .fp3d-header {");
  assert.ok(at > 0, "a phone block for the header");
  const block = src.slice(at, src.indexOf("\n      }\n", src.indexOf(".fp3d-notices {", at)));
  for (const sel of [".fp3d-tab-editor .fp3d-tab-word", ".fp3d-tab-ext:not([aria-current]) .fp3d-tab-word", ".fp3d-tab-settings:not([aria-current]) .fp3d-tab-word"]) assert.ok(block.includes(sel), sel);
  assert.match(block, /height: 52px/);
  assert.match(block, /\.fp3d-tab-editor \.fp3d-tab-short \{\s*display: inline/);
  // the title goes below the wide size class; the version left the header for Settings › Advanced › About
  assert.match(src, /@media \(max-width: \$\{unsafeCSS\(String\(COMPACT_MAX_PX\)\)\}px\) \{\s*\.fp3d-header \{[^}]*\}\s*\.fp3d-header h1 \{\s*display: none/);
  const tab = flat(panel(null).render());
  assert.doesNotMatch(tab, /fp3d-version/);
  // the icon-only tabs keep their names for screen readers and long-press
  assert.match(tab, /class="fp3d-tab fp3d-tab-ext"[^>]*aria-label=Extensions title=Extensions/);
  assert.match(tab, /class="fp3d-tab fp3d-tab-settings"[^>]*aria-label=Settings title=Settings/);
  assert.match(tab, /class="fp3d-tab fp3d-tab-editor"[^>]*aria-label=Editor/);
});
