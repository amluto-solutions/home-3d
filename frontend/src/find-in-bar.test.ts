// The "find an object" search lives in the floor bar (#305): a magnifier at the bar's right end that expands into a field,
// the floating one in the view's corner is gone (a card without the bar keeps it).
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { emptyBuilding, newFloor } from "./model.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener: () => undefined, removeEventListener: () => undefined });
g.location = { search: "", hash: "", pathname: "/home_3d" };
g.history = { state: null, replaceState: () => undefined };

const { Floorplan3dPanel } = await import("./panel.ts");
const { Fp3dView3d } = await import("./components/view3d.ts");
const src = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol" || typeof v === "boolean" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(v);
}
function handlers(v: unknown, re: RegExp, out: ((e?: unknown) => void)[] = []): ((e?: unknown) => void)[] {
  if (Array.isArray(v)) v.forEach((x) => handlers(x, re, out));
  else if (v && typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    r.values.forEach((x, i) => {
      if (typeof x === "function" && re.test(r.strings[i])) out.push(x as () => void);
      handlers(x, re, out);
    });
  }
  return out;
}

/** The aria-expanded value of the magnifier button. */
function expanded(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(expanded).find((x) => x !== undefined);
  if (v && typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    if (r.strings.join("").includes("fp3d-find-toggle")) return r.values[r.strings.findIndex((x) => x.trim().endsWith("aria-expanded="))];
    return r.values.map(expanded).find((x) => x !== undefined);
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function panel(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (Floorplan3dPanel as any)();
  p.hass = { language: "en", user: { id: "u", is_admin: true, name: "x" }, states: {}, themes: { darkMode: true } };
  const b = emptyBuilding();
  b.floors = [newFloor("f1", "Ground", 0), newFloor("f2", "Upper", 3)];
  p.data = { building: b, canEdit: true };
  return p;
}

test("the floor bar ends in a magnifier button; closed it has aria-expanded=false and no field", () => {
  const p = panel();
  const tpl = p.renderFloorBar(p.data.building, undefined);
  const out = flat(tpl);
  assert.match(out, /class="fp3d-chip fp3d-find-toggle[^"]*"/);
  assert.equal(expanded(tpl), false);
  assert.doesNotMatch(out, /<fp3d-find/);
  assert.ok(out.indexOf("fp3d-find-toggle") > out.indexOf("fp3d-rooms-btn"), "after the Rooms selector, at the right end");
});

test("the magnifier opens the field (aria-expanded=true); Esc / close puts the focus back on the button", async () => {
  const p = panel();
  p.shownHass = p.hass;
  const [toggle] = handlers(p.renderFloorBar(p.data.building, undefined), /@click=$/).filter((h) => h.toString().includes("_findOpen"));
  toggle!();
  assert.equal(p._findOpen, true);
  const out = p.renderFloorBar(p.data.building, undefined);
  assert.equal(expanded(out), true);
  assert.match(flat(out), /<fp3d-find\s+variant="bar"/);
  let focused = false;
  Object.defineProperty(p, "updateComplete", { value: Promise.resolve(true) });
  Object.defineProperty(p, "renderRoot", { value: { querySelector: (s: string) => (s === ".fp3d-find-toggle" ? { focus: () => (focused = true) } : null) } });
  const [close] = handlers(out, /@find-close=$/);
  close!();
  assert.equal(p._findOpen, false);
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(focused, "the button has the focus again");
});

test("a result flies the 3D view there and closes the search", () => {
  const p = panel();
  p.shownHass = p.hass;
  p._findOpen = true;
  const picked: unknown[] = [];
  Object.defineProperty(p, "renderRoot", { value: { querySelector: (s: string) => (s === "fp3d-view3d" ? { goTo: (i: unknown) => picked.push(i) } : null) } });
  const [pick] = handlers(p.renderFloorBar(p.data.building, undefined), /@find-pick=$/);
  pick!({ detail: { name: "Lamp" } });
  assert.deepEqual(picked, [{ name: "Lamp" }]);
  assert.equal(p._findOpen, false);
});

test("the view draws no floating magnifier when the bar has the search; the card (no bar) keeps it", () => {
  const v = new Fp3dView3d() as unknown as Record<string, any>;
  v.hass = { language: "en", states: {} };
  v.building = emptyBuilding();
  v.findInBar = true;
  assert.equal(flat(v.renderFind()), "");
  v.findInBar = false;
  assert.match(flat(v.renderFind()), /fp3d-find-btn/);
  // the panel hands the flag over, off where the bar is hidden (clean view, one-floor wall tablet)
  assert.match(src("./panel.ts"), /\.findInBar=\$\{!\(this\._clean \|\| \(this\._tablet && b\.floors\.length < 2\)\)\}/);
  assert.doesNotMatch(src("./card.ts"), /findInBar/);
});

test("phone layout: the field covers the row; the results sit under the field", () => {
  const css = src("./components/find.ts");
  assert.match(css, /@media \(max-width: 600px\) \{[^@]*:host\(\[variant="bar"\]\) \{\s*left: 8px;\s*width: auto/);
  assert.match(css, /:host\(\[variant="bar"\]\) \.list \{\s*position: absolute;\s*top: calc\(100% \+ 6px\)/);
  assert.match(src("./load-parts.ts"), /loadFind = once\(\(\) => import\("\.\/components\/find\.ts"\)\)/);
});

// ---- #308: the star's panel holds only the favourites

test("the star's panel has no house-wide rows: favourites and own buttons only; an empty one links to the Favourites settings (#308)", () => {
  const v = new Fp3dView3d() as unknown as Record<string, any>;
  v.hass = { language: "en", states: { "scene.party": { entity_id: "scene.party", state: "unknown", attributes: {} }, "light.sample_lounge": { entity_id: "light.sample_lounge", state: "on", attributes: {} } } };
  v.building = emptyBuilding();
  v.building.floors = [newFloor("f1", "Ground", 0)];
  v.central = true;
  v.canEdit = true;
  v._central = true;
  v.building.settings.favorites = [];
  const empty = flat(v.renderCentral());
  assert.doesNotMatch(empty, /fp3d-central-row|central_house|Whole house|Blinds|Lights/);
  assert.match(empty, /No favourites yet/);
  assert.match(empty, /fp3d-central-link/, "a way to the Favourites page");
  v.building.settings.favorites = ["scene.party"];
  const full = flat(v.renderCentral());
  assert.match(full, /fp3d-central-favs/);
  assert.doesNotMatch(full, /fp3d-central-row|fp3d-central-top|Settings ›/);
  v.canEdit = false;
  v.building.settings.favorites = [];
  assert.doesNotMatch(flat(v.renderCentral()), /fp3d-central-link/, "a viewer cannot set favourites");
});
