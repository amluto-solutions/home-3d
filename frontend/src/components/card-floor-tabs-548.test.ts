// #548: on a phone-sized card the floors are tabs at the top left, in place of the floor pictures at the side and the
// floors' name boxes over the house; a card option keeps the pictures, and a wide card keeps them by default.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any>; styles: unknown } };
const { navEdges } = await import("../nav-edges.ts");

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return String(v);
}
const css = (() => {
  const s = Fp3dView3d.styles as { cssText?: string } | { cssText?: string }[];
  return (Array.isArray(s) ? s : [s]).map((x) => x.cssText ?? "").join("\n");
})();

const room = (id: string) => ({ id, name: id, points: [[0, 0], [1, 0], [1, 1]] });
/** A 3D view of a house with three floors (and an empty one), as a card hands it over. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function view(over: Record<string, unknown> = {}): Record<string, any> {
  const el = new Fp3dView3d();
  el.hass = { language: "en", locale: { language: "en", number_format: "language" }, states: {}, config: { unit_system: {} } };
  el.building = {
    floors: [
      { id: "g", name: "Ground floor", elevation: 0, rooms: [room("a")] },
      { id: "f", name: "First floor", elevation: 2.75, rooms: [room("b")] },
      { id: "t", name: "Top floor", elevation: 5.5, rooms: [room("c")] },
      { id: "e", name: "Empty", elevation: 8, rooms: [] },
    ],
  };
  el.floorThumbs = true;
  el.floorTabs = null;
  el._phoneStage = true;
  el.floorId = null;
  Object.assign(el, over);
  return el;
}

test("a phone-sized card shows tabs, not pictures; a wider card keeps the pictures unless the option says tabs (#548)", () => {
  assert.equal(view().tabsMode(), true, "phone-sized: tabs");
  assert.equal(view({ _phoneStage: false }).tabsMode(), false, "wider: pictures, as before");
  assert.equal(view({ _phoneStage: false, floorTabs: true }).tabsMode(), true, "floor_tabs: true - tabs on every size");
  assert.equal(view({ floorTabs: false }).tabsMode(), false, "floor_tabs: false - the pictures on a phone too");
  // what has no floor switcher today has no tabs either
  assert.equal(view({ floorThumbs: false }).tabsMode(), false, "a fixed floor or `rooms`: no switcher");
  assert.equal(view({ phoneView: true }).tabsMode(), false, "the phone view keeps its own floors");
  const one = view();
  one.building.floors = one.building.floors.slice(0, 1);
  assert.equal(one.tabsMode(), false, "one floor: nothing to switch");
  // hidden things and walking hide the tabs, but the pictures do not come back meanwhile
  assert.equal(view({ clean: true }).tabsShown(), false);
  assert.equal(view({ _walk: { room: null } }).tabsShown(), false);
  assert.equal(view({ clean: true }).tabsMode(), true);
  // the panel (its own floor bar) never shows tabs: the view's default is false
  assert.equal(new Fp3dView3d().floorTabs, false);
});

test("the tabs: whole house first, then the floors with rooms from the top down; the energy values stand in their column (#548)", () => {
  const el = view({ floorId: "f" });
  const out = flat(el.renderTabs(["ENERGY"]));
  assert.match(out, /<fp3d-floor-tabs/);
  assert.match(out, /ENERGY<\/fp3d-floor-tabs>/);
  const tpl = el.renderTabs([]) as { values: unknown[] };
  const floors = tpl.values[0] as { id: string; name: string }[];
  assert.deepEqual(
    floors.map((f) => f.id),
    ["t", "f", "g"],
    "top floor first, the empty floor left out",
  );
  assert.equal(tpl.values[1], "f", "the floor shown is pressed");
  assert.equal(tpl.values[2], "Whole house");
});

test("with tabs the floors' name boxes over the house make way, and no floor pictures are drawn (#548)", () => {
  assert.match(css, /\.fp3d-tabs-on \.fp3d-pin-floor \{\s*visibility: hidden;/);
  const src = readFileSync(new URL("./view3d.ts", import.meta.url), "utf8");
  assert.match(src, /if \(!this\.floorThumbs \|\| floors < 2 \|\| this\.phoneLabels\(\) \|\| this\.tabsMode\(\)\) \{/);
  // the tabs stop before the Walk button
  assert.match(css, /\.fp3d-stage:has\(> \.fp3d-walk-btn\) > fp3d-floor-tabs \{\s*--fp3d-ftabs-end: calc\(var\(--fp3d-walk-right, 12px\) \+ var\(--fp3d-walk-w, 96px\) \+ 8px\);/);
});

test("the tab row scrolls sideways with a fade at the end that has more, like the panel's (#548, #259)", () => {
  const src = readFileSync(new URL("./floor-tabs.ts", import.meta.url), "utf8");
  assert.match(src, /overflow-x: auto/);
  assert.match(src, /\.tabs\[data-more-end\] \{\s*mask-image/);
  // the chosen tab scrolls into view with the row's own scroll, never the page's
  assert.doesNotMatch(src, /scrollIntoView\(/);
  assert.deepEqual(navEdges(0, 500, 300), { start: false, end: true });
  assert.deepEqual(navEdges(200, 500, 300), { start: true, end: false });
});

test("a sideways drag on the tab row scrolls it and leaves the house (#548, viewer/controls.ts)", () => {
  const src = readFileSync(new URL("../viewer/controls.ts", import.meta.url), "utf8");
  assert.match(src, /n\.scrollWidth > n\.clientWidth \+ 1 && \/auto\|scroll\/\.test\(getComputedStyle\(n\)\.overflowX\)/);
});

test("the card hands its floor_tabs option to the view, and the card form offers it (#548)", async () => {
  const card = readFileSync(new URL("../card.ts", import.meta.url), "utf8");
  assert.match(card, /\.floorTabs=\$\{c\?\.floor_tabs \?\? null\}/);
  const editor = readFileSync(new URL("../card-editor.ts", import.meta.url), "utf8");
  assert.match(editor, /this\.set\("floor_tabs", \{ auto: undefined, on: true, off: false \}/);
  const { englishTable } = await import("../i18n.ts");
  const t = englishTable() as Record<string, string>;
  for (const k of ["card_floor_tabs", "card_floor_tabs_auto", "card_floor_tabs_on", "card_floor_tabs_off"]) assert.ok(t[k], k);
});
