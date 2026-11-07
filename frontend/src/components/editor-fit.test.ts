import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor } from "../model.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dEditor } = (await import("./editor.ts")) as unknown as { Fp3dEditor: new () => Record<string, any> };

/** Every string and value of a lit template, flattened into one text. */
function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return String(v);
}

/** An 8 x 6 m house on a 30 x 24 m plot (a lawn) with a shed item at its far corner, in an 800 x 600 px plan. */
function editor(): Record<string, any> {
  const b = emptyBuilding();
  const floor = newFloor("f", "Ground", 0);
  floor.rooms.push({ id: "r", name: "Hall", area_id: null, points: [[0, 0], [8, 0], [8, 6], [0, 6]], floor_material: "wood" } as never);
  floor.outdoor.push({ id: "plot", type: "lawn", points: [[-10, -8], [20, -8], [20, 16], [-10, 16]] } as never);
  floor.furniture.push({ id: "shed", type: "table", x: 22, z: 17, rotation: 0, w: 2, d: 2, h: 2, variant: null, entity: null } as never);
  b.floors.push(floor);
  const el = new Fp3dEditor();
  el._doc = b;
  el._floorId = "f";
  el.canEdit = true;
  el._size = { w: 800, h: 600 };
  return el;
}

const onScreen = (el: Record<string, any>, p: [number, number]) => {
  const [x, y] = el.toScreen(p);
  return x >= 0 && y >= 0 && x <= el._size.w && y <= el._size.h;
};

test("'Fit' (was Whole plan) frames the house; the garden reaches past it (#91)", () => {
  const el = editor();
  el.fit();
  assert.ok(onScreen(el, [8, 6]));
  assert.ok(!onScreen(el, [-10, -8]));
});

test("'Fit with garden' (was Fit everything) frames the whole plot and the items standing in the garden (#91)", () => {
  const el = editor();
  el.fit(true);
  for (const p of [[-10, -8], [20, 16], [23, 18], [0, 0], [8, 6]] as [number, number][]) assert.ok(onScreen(el, p), `${p} is off the plan`);
});

test("no Fit in the top bar (the plan's zoom buttons have it, #321); 'Fit with garden' is in More, only when something stands outside; Wall view sits apart (#91, #249)", () => {
  const el = editor();
  const bar = flat(el.renderToolBar());
  const groups = bar.split(/<div class="fp3d-seg/);
  const views = groups.find((g) => g.includes("3D beside"))!;
  assert.doesNotMatch(views, /fp3d-fit-btn| Fit<\/button>/);
  assert.match(flat(el.renderNav()), /fp3d-nav-btn[^>]*>⤢/, "the plan's own Fit is beside + and −");
  assert.match(views, /3D beside/);
  assert.doesNotMatch(views, /Wall view/);
  assert.match(bar, /Wall view/);
  assert.doesNotMatch(bar, /Fit with garden|Whole plan|Fit everything/, "no second look-alike button in the row");
  el._toolMenu = "more";
  assert.match(flat(el.renderToolBar()), /Fit with garden/, "the plot has a lawn and a shed outside");
  // nothing outside the rooms: nothing more to fit
  el._doc.floors[0].outdoor = [];
  el._doc.floors[0].furniture = [];
  assert.doesNotMatch(flat(el.renderToolBar()), /Fit with garden/);
});

test("the 3D pane beside the plan has its own button to fold it away (#91)", () => {
  const el = editor();
  el._split = true;
  assert.match(flat(el.render3d()), /fp3d-3d-fold/);
});
