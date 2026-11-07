import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Opening } from "../model.ts";

// the editor's bundle hashes are build-time constants: plain strings will do here
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dEditor } = (await import("./editor.ts")) as unknown as { Fp3dEditor: new () => Record<string, any> };

const SCALE = 50; // px per metre: the plan's (0, 0) sits at screen (100, 100)

function door(id: string, offset: number, extra: Partial<Opening> = {}): Opening {
  return { id, room_id: "r", edge: 0, offset, width: 0.9, type: "door", sill: 0, height: 2.05, hinge: "left", leaves: 1, swing: "in", cover: null, contact: null, contact2: null, tilt: null, ...extra } as Opening;
}

/** An editor on one 6 x 4 m room whose south wall (edge 0, from (0,0) to (6,0)) has a door centred 1.5 m along it. */
function editor() {
  const b = emptyBuilding();
  const floor = newFloor("f", "Ground", 0);
  floor.rooms.push({ id: "r", name: "Hall", area_id: null, points: [[0, 0], [6, 0], [6, 4], [0, 4]], floor_material: "wood" } as never);
  floor.openings.push(door("d1", 1.5));
  b.floors.push(floor);
  const el = new Fp3dEditor();
  el._doc = b;
  el._floorId = "f";
  el.canEdit = true;
  el._view = { scale: SCALE, ox: 100, oy: 100 };
  el.renderRoot = { activeElement: null, querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) };
  el._tool = "opening";
  return el;
}

/** A press on the plan at a world point; `on` names the opening whose drawn shape is under the pointer. */
function press(el: Record<string, any>, at: [number, number], on: string | null = null) {
  const target = { closest: (sel: string) => (on && sel === "[data-opening]" ? { getAttribute: () => on } : null) };
  const e = { pointerId: 1, button: 0, clientX: at[0] * SCALE + 100, clientY: at[1] * SCALE + 100, target, currentTarget: { setPointerCapture() {} }, shiftKey: false, altKey: false };
  el.pointerDown(e);
  el.pointers.clear();
}

/** The mouse resting over the plan at a world point (no button down). */
function hover(el: Record<string, any>, at: [number, number], on: string | null = null) {
  const target = { closest: (sel: string) => (on && sel === "[data-opening]" ? { getAttribute: () => on } : null) };
  el.onPointerMove({ pointerId: 1, pointerType: "mouse", clientX: at[0] * SCALE + 100, clientY: at[1] * SCALE + 100, target, altKey: false });
}

const openings = (el: Record<string, any>) => el._doc.floors[0].openings as Opening[];

test("in Doors & windows mode a tap on an existing door selects it and adds nothing (#62)", () => {
  const el = editor();
  press(el, [1.5, 0], "d1");
  assert.equal(openings(el).length, 1);
  assert.equal(el._openingId, "d1");
  // and the press can drag it along the wall
  assert.equal(el.drag?.kind, "opening");
});

test("a tap on the wall inside an existing door's width (beside its thin drawing) selects that door too (#62)", () => {
  const el = editor();
  press(el, [1.8, 0.1]);
  assert.equal(openings(el).length, 1);
  assert.equal(el._openingId, "d1");
});

test("a tap on a free stretch of wall adds a new opening of the active kind (#62)", () => {
  const el = editor();
  // 4.2 m along: no snap guide near (#143), so it lands on the grid at the tap
  press(el, [4.2, 0]);
  assert.equal(openings(el).length, 2);
  const added = openings(el)[1];
  assert.equal(added.offset, 4.2);
  assert.equal(el._openingId, added.id);
});

test("a tap whose new door would overlap an existing one adds nothing and says why (#62)", () => {
  const el = editor();
  // 2.3 m along: a 0.9 m door there would run from 1.85 to 2.75, into the door at 1.05-1.95
  press(el, [2.3, 0]);
  assert.equal(openings(el).length, 1);
  assert.equal(el._openingId, null);
  assert.match(String(el._openingNote), /overlap/i);
  // the next press clears the message
  press(el, [4.5, 0]);
  assert.equal(el._openingNote, null);
});

test("the hint bar says what a tap will do where the mouse rests: add, select or nothing (#62)", () => {
  const el = editor();
  hover(el, [4.5, 0]);
  assert.match(el.hintText(), /add here: door/i);
  hover(el, [1.5, 0], "d1");
  assert.match(el.hintText(), /select: door/i);
  hover(el, [1.7, 0.05]);
  assert.match(el.hintText(), /select: door/i);
  hover(el, [2.3, 0]);
  assert.match(el.hintText(), /overlap/i);
  // away from any wall: the general hint
  hover(el, [3, 2]);
  assert.equal(el.hintText(), el.t("hint_opening", { kind: "Door" }));
});

test("the overlap message shows in the hint bar until the next press (#62)", () => {
  const el = editor();
  press(el, [2.3, 0]);
  assert.match(el.hintText(), /overlap/i);
});

test("the hint bar names the kind the next tap adds, so it is never inherited silently (#63)", () => {
  const el = editor();
  assert.match(el.hintText(), /Door/);
  el.pickOpeningKind("front");
  assert.match(el.hintText(), /Front door/);
});

test("a new opening is exactly the active kind, front door style included (#63)", () => {
  const el = editor();
  el._openingPreset = "front";
  press(el, [4.5, 0]);
  const added = openings(el)[1];
  assert.equal(added.style, "front");
  assert.equal(added.width, 1);
});

test("a plain new door keeps the automatic style, so in an outer wall it still looks like a front door (#63)", () => {
  const el = editor();
  press(el, [4.5, 0]);
  assert.equal(openings(el)[1].style, undefined);
});

test("the position field says which corner it measures from (#63)", () => {
  const el = editor();
  assert.equal(el.openingPositionLabel(openings(el)[0]), "Centre from west corner (m)");
  el._doc.settings.north = 180;
  assert.equal(el.openingPositionLabel(openings(el)[0]), "Centre from east corner (m)");
});

/** A lit template as plain markup text, near enough to look for classes in it. */
function markup(v: unknown): string {
  if (Array.isArray(v)) return v.map(markup).join("");
  if (v && typeof v === "object" && "strings" in v) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? markup(t.values[i]) : "")).join("");
  }
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}

test("the selected opening is drawn with a highlight ring, the others are not (#63)", () => {
  const el = editor();
  el._doc.floors[0].openings.push(door("d2", 4.5));
  el.selectItem("opening", "d2");
  const floor = el._doc.floors[0];
  const svg = markup(el.renderOpenings(floor, []));
  const groups = svg.split("<g data-opening=").slice(1);
  assert.equal(groups.length, 2);
  assert.doesNotMatch(groups[0], /fp3d-open-ring/);
  assert.match(groups[1], /fp3d-open-ring/);
});

test("dragging a door slides it along its wall, in Doors & windows mode as well (#63)", () => {
  const el = editor();
  press(el, [1.5, 0], "d1");
  el.pointers.set(1, [0, 0]);
  el.onPointerMove({ pointerId: 1, pointerType: "mouse", clientX: 3 * SCALE + 100, clientY: 0.4 * SCALE + 100, target: { closest: () => null }, altKey: false });
  el.onPointerUp({ pointerId: 1, pointerType: "mouse", clientX: 3 * SCALE + 100, clientY: 0.4 * SCALE + 100, target: { closest: () => null }, currentTarget: { releasePointerCapture() {} } });
  const d = openings(el)[0];
  assert.equal(d.offset, 3);
  assert.equal(d.edge, 0);
  assert.equal(openings(el).length, 1);
});

test("in Doors & windows mode with nothing selected the sidebar offers the kind for the next tap (#63)", () => {
  const el = editor();
  el.selectItem("room", null);
  const side = markup(el.renderSide(el._doc.floors[0]));
  assert.match(side, /fp3d-presets/);
  el.pickOpeningKind("window");
  assert.equal(el._openingPreset, "window");
  assert.equal(openings(el)[0].type, "door");
  assert.match(el.hintText(), /add: Window/);
  el._tool = "select";
  assert.doesNotMatch(markup(el.renderSide(el._doc.floors[0])), /fp3d-presets/);
});

test("a mouse move in Doors & windows mode writes the new hint into the hint bar; only a changed snap guide renders the plan again (#130)", () => {
  const el = editor();
  const text = { textContent: "" };
  el.renderRoot = { activeElement: null, querySelector: (sel: string) => (sel === ".fp3d-hint-text" ? text : { getBoundingClientRect: () => ({ left: 0, top: 0 }) }) };
  // with Alt held nothing snaps, so no snap guide changes either; nothing is waiting to render now
  const move = (at: [number, number], on: string | null = null) => {
    const target = { closest: (sel: string) => (on && sel === "[data-opening]" ? { getAttribute: () => on } : null) };
    el.onPointerMove({ pointerId: 1, pointerType: "mouse", clientX: at[0] * SCALE + 100, clientY: at[1] * SCALE + 100, target, altKey: true });
  };
  move([3, 2]);
  el.isUpdatePending = false;
  move([4.5, 0]);
  assert.match(text.textContent, /add here: door/i);
  move([1.5, 0], "d1");
  assert.match(text.textContent, /select: door/i);
  move([3, 2]);
  assert.equal(text.textContent, el.t("hint_opening", { kind: "Door" }));
  assert.equal(el.isUpdatePending, false);
});

test("a chip on the selected opening converts only that opening; the kind the next tap adds stays (#159)", () => {
  const el = editor();
  press(el, [1.5, 0], "d1");
  assert.equal(el._openingPreset, "door");
  el.setOpeningPreset(openings(el)[0], "garage");
  assert.equal(openings(el)[0].type, "garage");
  assert.equal(el._openingPreset, "door");
  // so the next tap still adds a plain door, and the garage door is not touched
  press(el, [4.5, 0]);
  assert.equal(openings(el)[1].type, "door");
  assert.equal(openings(el)[0].type, "garage");
});

test("choosing the next kind while an opening is selected changes nothing in the plan (#159)", () => {
  const el = editor();
  press(el, [1.5, 0], "d1");
  const before = JSON.stringify(openings(el));
  el.pickOpeningKind("window");
  assert.equal(JSON.stringify(openings(el)), before);
  assert.equal(el._openingPreset, "window");
});

test("with an opening selected in Doors & windows mode the sidebar offers the next-kind chips as well (#159)", () => {
  const el = editor();
  press(el, [1.5, 0], "d1");
  el.hass = { language: "en", areas: {}, states: {}, entities: {}, devices: {}, user: { is_admin: true } };
  const text = markup(el.renderSide(el.floor));
  assert.match(text, /Next door or window/);
  assert.match(text, /fp3d-type-row/, "the opening's own Type row (#417)");
});

test("converting to a wider kind keeps the opening inside a short wall (#159)", () => {
  const el = editor();
  el._doc.floors[0].rooms[0].points = [[0, 0], [1.2, 0], [1.2, 4], [0, 4]];
  el._doc.floors[0].openings[0].offset = 0.6;
  el.selectItem("opening", "d1");
  el.setOpeningPreset(openings(el)[0], "garage");
  const o = openings(el)[0];
  assert.ok(o.width <= 1.1 + 1e-9, `width ${o.width}`);
  assert.ok(o.offset - o.width / 2 >= -1e-9 && o.offset + o.width / 2 <= 1.2 + 1e-9, `offset ${o.offset}`);
});

test("add-by-measure with a too small size says so instead of doing nothing (#159)", () => {
  const el = editor();
  el._tool = "measure";
  el._rectSize = [0.05, 3];
  el.rectBySize();
  assert.equal(el._doc.floors[0].rooms.length, 1);
  assert.match(String(el._notice), /at least/);
  el._rectSize = [4, 3];
  el.rectBySize();
  assert.equal(el._doc.floors[0].rooms.length, 2);
  assert.equal(el._notice, null);
});

test("changing tool drops a leftover message and a half-typed room name (#159)", () => {
  const el = editor();
  el._notice = "old";
  el._rectName = "Study";
  el._draft = [[0, 0]];
  el.setTool("select");
  assert.equal(el._notice, null);
  assert.equal(el._rectName, "");
  assert.deepEqual(el._draft, []);
});
