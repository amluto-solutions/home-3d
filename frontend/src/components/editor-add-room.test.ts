import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor } from "../model.ts";

// the editor's bundle hashes are build-time constants: plain strings will do here
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dEditor } = (await import("./editor.ts")) as unknown as { Fp3dEditor: new () => Record<string, any> };

/** An editor in Build > Room > measure on an empty floor of a home with a "Lounge" area. */
function editor() {
  const b = emptyBuilding();
  b.floors.push(newFloor("f", "Ground", 0));
  const el = new Fp3dEditor();
  el._doc = b;
  el._floorId = "f";
  el.canEdit = true;
  el.hass = { language: "en", areas: { lounge: { area_id: "lounge", name: "Lounge", floor_id: null } }, states: {}, entities: {}, devices: {} };
  el._tool = "measure";
  return el;
}

const rooms = (el: Record<string, any>) => el._doc.floors[0].rooms;

test("Rectangle by size takes a name and a typed start point; an area's name links the area (#65)", () => {
  const el = editor();
  el._rectName = "Lounge";
  el.setRectStart(0, 2);
  el.setRectStart(1, 1);
  el._rectSize = [4, 3];
  el.rectBySize();
  assert.equal(rooms(el).length, 1);
  assert.equal(rooms(el)[0].name, "Lounge");
  assert.equal(rooms(el)[0].area_id, "lounge");
  assert.deepEqual(rooms(el)[0].points, [[2, 1], [6, 1], [6, 4], [2, 4]]);
  assert.equal(el._roomId, rooms(el)[0].id);
  // ready for the next room: the name is cleared, the plain "Room 2" comes back without one
  assert.equal(el._rectName, "");
  el.rectBySize();
  assert.equal(rooms(el)[1].name, "Room 2");
  assert.deepEqual(rooms(el)[1].points[0], [0, 0]);
});

test("a typed start moves a tapped start (and walls typed from it) (#65)", () => {
  const el = editor();
  el._draft = [[1, 1], [3, 1]];
  el.setRectStart(0, 2);
  assert.deepEqual(el._draft, [[2, 1], [4, 1]]);
  el.setRectStart(1, -1);
  assert.deepEqual(el._draft[0], [2, -1]);
});
