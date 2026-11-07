import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Room } from "../model.ts";
import { wallSummary } from "../geometry/room-walls.ts";

// the editor's bundle hashes are build-time constants: plain strings will do here
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dEditor } = (await import("./editor.ts")) as unknown as { Fp3dEditor: new () => Record<string, any> };

const room = (extra: Partial<Room> = {}): Room => ({ id: "r", name: "Bedroom", area_id: null, points: [[0, 0], [5, 0], [5, 4], [0, 4]], floor_material: "wood", ...extra });

function editor() {
  const b = emptyBuilding();
  const floor = newFloor("f", "Ground", 0);
  floor.rooms.push(room());
  b.floors.push(floor);
  const el = new Fp3dEditor();
  el._doc = b;
  el._floorId = "f";
  el.canEdit = true;
  el._roomId = "r";
  el.hass = { language: "en", areas: {}, states: {}, entities: {}, devices: {}, user: { is_admin: true } };
  return el;
}

/** A lit template as flat text (strings with their values), enough to see what comes in which order. */
const flat = (v: unknown): string => {
  if (v == null || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  const t = v as { strings?: readonly string[]; values?: unknown[] };
  if (typeof v === "object") return t.strings ? t.strings.map((s, i) => s + (i < t.values!.length ? flat(t.values![i]) : "")).join("") : "";
  return String(v);
};

test("the Walls fold follows name, area, floor finish and Size, before the devices and the room's other folds (#67, #416)", () => {
  const el = editor();
  const panel = flat(el.renderRoomForm(el.room, []));
  const walls = panel.indexOf("data-fold=walls");
  assert.ok(walls > 0, "the Walls section is a fold");
  assert.ok(panel.indexOf("data-fold=room-size") < walls, "Size comes first");
  assert.ok(panel.indexOf(el.t("material")) < walls);
  for (const later of ["data-fold=room-devices", "data-fold=room-climate", "data-fold=corners", "data-fold=room-more"]) assert.ok(walls < panel.indexOf(later), later);
});

test("the Walls fold starts folded and remembers being opened (#67)", () => {
  const el = editor();
  assert.equal(el._wallsOpen, false);
  el.setWallsOpen(true);
  assert.equal(el._wallsOpen, true);
  assert.match(flat(el.renderEdgeHeights(el.room)), /data-fold=walls \?data-open=true/);
});

test("open, the Walls fold has one row per wall with its length and height; a row opens that wall's settings (#416)", async () => {
  const el = editor();
  el._doc.floors[0].rooms[0].wall_heights = [null, 0, null, null];
  el._doc.floors[0].rooms[0].wall_slopes = [null, null, [2.4, 1.8], null];
  el.setWallsOpen(true);
  const out = flat(el.renderEdgeHeights(el.room));
  for (let i = 0; i < 4; i++) assert.match(out, new RegExp(`data-fold=wall-${i} `), `wall ${i + 1}`);
  assert.match(out, /Wall 1–2/);
  assert.match(out, /5 m · 2\.5 m high/);
  assert.match(out, /4 m · No wall/);
  assert.match(out, /sloping 2\.4 m–1\.8 m/);
  assert.match(out, /2 set/, "the fold counts the walls with settings of their own");
  assert.doesNotMatch(out, /Thickness/, "a closed wall shows no fields");
  const { setSideFold } = await import("./editor/item-sections.ts");
  setSideFold(el, "wall:r:0", true);
  const open = flat(el.renderEdgeHeights(el.room));
  // every setting of the wall, each button with its words (no ✂, ▦ or ↥ with help only in a tooltip)
  for (const text of ["Height (m)", "Sloping", "No wall", "Split this wall", "Thickness (m)", "Wall view"]) assert.ok(open.includes(text), text);
  assert.doesNotMatch(open, /[✂▦↥]/);
});

test("the room panel opens with its fields first and every wall setting behind a fold row (#416)", () => {
  const el = editor();
  const panel = flat(el.renderRoomForm(el.room, []));
  // controls a user meets when the Lounge-like panel opens: inputs, selects and buttons
  const controls = (panel.match(/<(input|select|button)\b/g) ?? []).length;
  assert.ok(controls < 25, `${controls} controls`);
  assert.ok(panel.includes(el.t("room_ceiling_short")), "the ceiling help is one line");
  assert.ok(!panel.includes(el.t("room_ceiling_hint")), "the long help is behind its i");
});

test("the folded Walls heading counts the walls and names the special ones (#67)", () => {
  assert.deepEqual(wallSummary(room()), { walls: 4, open: 0, sloping: 0 });
  assert.deepEqual(wallSummary(room({ wall_heights: [0, null, 1.2, null], wall_slopes: [null, [2.4, 1.8], null, null] })), { walls: 4, open: 1, sloping: 1 });
  // an edge split into parts by another room: a part with no wall counts once
  assert.deepEqual(wallSummary(room({ wall_heights: [[0, null], null, null, null] })), { walls: 4, open: 1, sloping: 0 });
});
