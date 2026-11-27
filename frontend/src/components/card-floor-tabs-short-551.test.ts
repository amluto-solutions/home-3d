// #551: on a phone-sized card every floor tab shows: short names when the full ones do not fit ("House", "Top",
// "First", "Ground"), narrower tabs when only that makes them fit, the full names kept for screen readers; and the two
// switches by the energy values (flows, floating cards) wrap as one pair.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any>; styles: unknown } };
const { Fp3dFloorTabs, shortNames } = (await import("./floor-tabs.ts")) as unknown as {
  Fp3dFloorTabs: { new (): Record<string, any>; styles: { cssText?: string }[]; properties: Record<string, { hasChanged?: (a: unknown, b: unknown) => boolean }> };
  shortNames: (names: string[], taken?: string[]) => string[];
};

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return String(v);
}
const cssOf = (s: unknown) => (Array.isArray(s) ? s : [s]).map((x) => (x as { cssText?: string }).cssText ?? "").join("\n");

test("the word every floor name shares at its end or start goes, in any language (#551)", () => {
  assert.deepEqual(shortNames(["Top floor", "First floor", "Ground floor"], ["House"]), ["Top", "First", "Ground"]);
  assert.deepEqual(shortNames(["Top Floor", "ground floor"]), ["Top", "ground"], "capitals do not matter");
  assert.deepEqual(shortNames(["Étage 2", "Étage 1"]), ["2", "1"], "at the start");
  assert.deepEqual(shortNames(["Piętro górne", "Piętro dolne"]), ["górne", "dolne"]);
  assert.deepEqual(shortNames(["  Upper   ground floor ", "Lower ground floor"]), ["Upper ground", "Lower ground"], "one word only");
  assert.deepEqual(shortNames(["Obergeschoss", "Erdgeschoss"]), ["Obergeschoss", "Erdgeschoss"], "no word of their own to drop");
  assert.deepEqual(shortNames(["Loft", "Upstairs", "Downstairs"]), ["Loft", "Upstairs", "Downstairs"], "nothing shared");
  assert.deepEqual(shortNames(["Top floor", "First floor", "Cellar"]), ["Top floor", "First floor", "Cellar"], "not shared by all");
  assert.deepEqual(shortNames(["Top floor"]), ["Top floor"], "one floor");
});

test("a name that would be left empty or read like another tab stays whole (#551)", () => {
  assert.deepEqual(shortNames(["Top floor", "Floor"]), ["Top", "Floor"], "empty");
  assert.deepEqual(shortNames(["- floor", "Top floor"]), ["- floor", "Top"], "no letter or figure left");
  assert.deepEqual(shortNames(["House floor", "Top floor"], ["House"]), ["House floor", "Top"], "like the whole house tab");
  assert.deepEqual(shortNames(["Floor floor", "Floor"]), ["Floor floor", "Floor"], "like another floor");
  assert.deepEqual(shortNames(["Top floor", "top floor", "Ground floor"]), ["Top floor", "top floor", "Ground"], "two alike");
});

/** The tabs of a house, as the 3D view hands them over. */
function tabs(names = ["Top floor", "First floor", "Ground floor"]): Record<string, any> {
  const el = new Fp3dFloorTabs();
  el.floors = names.map((name, i) => ({ id: `f${i}`, name }));
  el.house = "Whole house";
  el.shortHouse = "House";
  el.floorId = "f0";
  return el;
}

test("each tab holds its full and its short name, and is named in full for screen readers (#551)", () => {
  const out = flat(tabs().render());
  for (const [full, brief] of [["Whole house", "House"], ["Top floor", "Top"], ["First floor", "First"], ["Ground floor", "Ground"]]) {
    assert.ok(out.includes(`title=${full} aria-label=${full}`), full);
    assert.ok(out.includes(`<span class="full">${full}</span><span class="short">${brief}</span>`), brief);
  }
  // a floor called like the short whole house text: the whole house tab keeps its long text
  const house = flat(tabs(["House", "Annex"]).render());
  assert.doesNotMatch(house, /<span class="short">House<\/span>/);
  assert.match(house, />Whole house<\/button>/);
});

test("full names where they fit, else short names, narrower tabs only if that makes them fit (#551)", () => {
  /** A row `room` wide whose tabs are as wide as `widths` says: full, short, short and narrow. */
  const fit = (room: number, widths: [number, number, number]) => {
    const set = new Set<string>();
    const row = {
      scrollLeft: 7,
      clientWidth: room,
      get scrollWidth() {
        return Math.max(room, widths[set.has("data-tight") ? 2 : set.has("data-short") ? 1 : 0]);
      },
      setAttribute: (k: string) => void set.add(k),
      removeAttribute: (k: string) => void set.delete(k),
    };
    tabs().fit(row);
    assert.equal(row.scrollLeft, 7, "the row stays where it was scrolled to");
    return [...set].sort().join(" ");
  };
  assert.equal(fit(400, [360, 250, 215]), "", "full names fit");
  assert.equal(fit(260, [360, 250, 215]), "data-short");
  assert.equal(fit(232, [360, 250, 215]), "data-short data-tight");
  assert.equal(fit(200, [360, 250, 215]), "data-short", "too long even so: the row scrolls, with its usual space");
});

test("the short names and the narrow tabs, as high as before (#551)", () => {
  const css = cssOf(Fp3dFloorTabs.styles);
  assert.match(css, /\.tabs \.short,\s*\.tabs\[data-short\] \.full \{\s*display: none;/);
  assert.match(css, /\.tabs\[data-tight\] button \{\s*min-width: 40px;\s*padding-inline: 7px;/);
  assert.doesNotMatch(css, /\.tabs\[data-tight\][^}]*height/);
  assert.match(css, /\.room \{\s*display: flex;\s*width: calc\(100% \+ 12px - var\(--fp3d-ftabs-end, 12px\)\);/);
  // the same floors handed over again are no change: the row is not measured and scrolled with each new state
  const changed = Fp3dFloorTabs.properties.floors.hasChanged!;
  assert.equal(changed(tabs().floors, tabs().floors), false);
  assert.equal(changed(tabs(["Loft", "Cellar"]).floors, tabs().floors), true);
});

test("the view hands the tabs the short whole house text (#551)", () => {
  const el = new Fp3dView3d();
  el.hass = { language: "en", locale: { language: "en", number_format: "language" }, states: {}, config: { unit_system: {} } };
  el.building = { floors: [{ id: "g", name: "Ground floor", elevation: 0, rooms: [{ id: "a" }] }] };
  assert.match(flat(el.renderTabs([])), /\.house=Whole house \.shortHouse=House /);
});

/** A 3D view with four energy values, and a fifth with the cheap rate; both switches offered. */
function energy(over: Record<string, unknown> = {}): string {
  const el = new Fp3dView3d();
  el.hass = { language: "en", locale: { language: "en", number_format: "language" }, states: {}, config: { unit_system: {} } };
  el._energy = { consumption: 800, grid: -1200, solar: 2000, battery: 100, soc: 50, tariff: null };
  el.flows = null;
  el.holograms = null;
  el._holos = [{}];
  Object.assign(el, over);
  return flat(el.renderEnergy());
}

test("the flows and floating cards switches wrap as one pair, with four values or five (#551)", () => {
  for (const cheap of [false, true]) {
    const out = energy({ _cheap: cheap });
    assert.equal(out.includes("fp3d-energy-cheap"), cheap);
    assert.match(out, /<div class="fp3d-flow-pair"><button class="fp3d-energy-item fp3d-flow-toggle"[\s\S]*?<\/button><button class="fp3d-energy-item fp3d-flow-toggle"[\s\S]*?<\/button><\/div>/);
  }
  assert.equal(energy({ holograms: false }).match(/fp3d-flow-toggle/g)?.length, 1, "one switch alone");
  assert.equal(energy({ flows: true }).match(/fp3d-flow-toggle/g)?.length, 1);
  assert.doesNotMatch(energy({ flows: true, _holos: [] }), /fp3d-flow-pair/, "no switch, no pair to take room");
  // the pair is one row that never wraps inside
  const css = cssOf(Fp3dView3d.styles);
  assert.match(css, /\.fp3d-flow-pair \{\s*display: flex;\s*gap: inherit;\s*\}/);
  assert.doesNotMatch(css, /\.fp3d-flow-pair[^}]*flex-wrap/);
});

test("a new size fits the names again, a frame later: no \"ResizeObserver loop\" error (#551)", () => {
  const src = readFileSync(new URL("./floor-tabs.ts", import.meta.url), "utf8");
  assert.match(src, /new ResizeObserver\(\(\) => requestAnimationFrame\(this\.sync\)\)/);
});
