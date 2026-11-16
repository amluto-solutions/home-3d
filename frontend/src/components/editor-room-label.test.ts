// A room's name in the plan (#458): the selected room's name has a handle; dragging it moves the name (an offset from
// the room's middle, one undo step), a double tap puts it back, and the 3D pane's Names switch hides the names there.

import assert from "node:assert/strict";
import { test } from "node:test";
import { labelPoint, type Room } from "../model.ts";
import { makeEditor, square, type TestEditor } from "./editor-harness.ts";

/** A lit template as flat text (strings with their values). */
const flat = (v: unknown): string => {
  if (v == null || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  const t = v as { strings?: readonly string[]; values?: unknown[] };
  if (typeof v === "object") return t.strings ? t.strings.map((s, i) => s + (i < t.values!.length ? flat(t.values![i]) : "")).join("") : "";
  return String(v);
};

const roomOf = (ed: TestEditor): Room => ed._doc.floors[0].rooms[0];

test("the selected room's name has a handle; dragging it moves the name as an offset, one undo step (#458)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 3)]);
  ed.history.adopt(ed._doc, ed.home);
  assert.doesNotMatch(flat(ed.renderRooms(ed.floor)), /data-room-label/, "no handle while the room is not selected");
  ed._roomId = "r";
  assert.match(flat(ed.renderRooms(ed.floor)), /data-room-label/, "a handle beside the selected room's name");
  const [gx, gy] = ed.labelGrip(roomOf(ed));
  assert.equal(ed.labelGripAt([gx, gy])?.id, "r");
  assert.equal(ed.labelGripAt([gx + 40, gy]), null, "only the handle grabs");
  // 100 px per metre: 1 m right, half a metre down
  ed.press(gx, gy);
  ed.move(gx + 50, gy + 20);
  ed.move(gx + 100, gy + 50);
  ed.release(gx + 100, gy + 50);
  assert.deepEqual(roomOf(ed).label_offset, [1, 0.5]);
  assert.deepEqual(labelPoint(roomOf(ed)), [3, 2]);
  assert.deepEqual(roomOf(ed).points, square("r", 0, 0, 4, 3).points, "the room itself stays");
  ed.undo();
  assert.equal(roomOf(ed).label_offset, undefined, "one undo step takes it back");
});

test("a double tap on the handle, and the button in the room's form, put the name back in the middle (#458)", async () => {
  const ed = await makeEditor([{ ...square("r", 0, 0, 4, 3), label_offset: [1, 0.5] }]);
  ed._roomId = "r";
  const [gx, gy] = ed.labelGrip(roomOf(ed));
  // the handle sits at the moved name
  assert.ok(gx > 200 + 80, "left of the moved name");
  ed.press(gx, gy);
  ed.release(gx, gy);
  ed.press(gx, gy);
  ed.release(gx, gy);
  assert.equal("label_offset" in roomOf(ed), false, "the offset is gone");
  // the form offers a reset only while the name is moved
  assert.doesNotMatch(flat(ed.renderRoomForm(ed.room, [])), new RegExp(ed.t("room_label_reset")));
  ed.change((_: unknown, floor: { rooms: Room[] }) => (floor.rooms[0].label_offset = [-1, 0.25]));
  assert.match(flat(ed.renderRoomForm(ed.room, [])), new RegExp(ed.t("room_label_reset")));
  ed.resetLabel("r");
  assert.equal(roomOf(ed).label_offset, undefined);
});

test("a viewer without edit rights gets no handle; other tools get none either (#458)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 3)]);
  ed._roomId = "r";
  const [gx, gy] = ed.labelGrip(roomOf(ed));
  ed._tool = "rect";
  assert.equal(ed.labelGripAt([gx, gy]), null);
  ed._tool = "select";
  assert.ok(ed.labelGripAt([gx, gy]));
  ed.canEdit = false;
  assert.equal(ed.labelGripAt([gx, gy]), null);
  assert.doesNotMatch(flat(ed.renderRooms(ed.floor)), /data-room-label/);
});

test("the Names switch beside the walls choice hides the room names in the 3D pane (#458)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 3)]);
  const labels = (): unknown => {
    const t = ed.render3d() as { values: unknown[]; strings: readonly string[] };
    const at = t.strings.findIndex((s) => s.trimEnd().endsWith(".roomLabels="));
    return at < 0 ? undefined : t.values[at];
  };
  assert.equal(labels(), true, "names show by default");
  assert.ok(flat(ed.render3d()).includes(ed.t("names3d")), "the switch is in the bar");
  ed.setNames3d(false);
  assert.equal(ed._names3d, false);
  assert.equal(labels(), false);
  ed.setNames3d(true);
  assert.equal(labels(), true);
});
