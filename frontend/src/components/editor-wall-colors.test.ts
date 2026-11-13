// Wall colours in the editor (#438): the room's colour for all its walls and a colour for each wall are saved in
// wall_color / wall_colors; the 3D pane beside the plan shows a Homely style once a colour is set (where it shows).

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Room } from "../model.ts";
import { makeEditor, square } from "./editor-harness.ts";
import { setSideFold } from "./editor/item-sections.ts";

/** A lit template as flat text (strings with their values). */
const flat = (v: unknown): string => {
  if (v == null || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  const t = v as { strings?: readonly string[]; values?: unknown[] };
  if (typeof v === "object") return t.strings ? t.strings.map((s, i) => s + (i < t.values!.length ? flat(t.values![i]) : "")).join("") : "";
  return String(v);
};

const roomOf = (ed: object): Room => (ed as { _doc: { floors: { rooms: Room[] }[] } })._doc.floors[0].rooms[0];

test("a wall colour and a room colour save to wall_colors and wall_color; clearing them removes the keys (#438)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 3)]);
  ed._roomId = "r";
  ed.setWallColour(roomOf(ed), null, "#c0392b");
  assert.equal(roomOf(ed).wall_color, "#c0392b");
  ed.setWallColour(roomOf(ed), 1, "#3b6ea5");
  assert.deepEqual(roomOf(ed).wall_colors, [null, "#3b6ea5", null, null]);
  assert.equal(roomOf(ed).wall_color, "#c0392b", "a wall's own colour leaves the room's alone");
  // the colour for all walls paints them all: the walls' own go
  ed.setWallColour(roomOf(ed), null, "#d9c7a3");
  assert.equal(roomOf(ed).wall_color, "#d9c7a3");
  assert.equal(roomOf(ed).wall_colors, undefined);
  ed.setWallColour(roomOf(ed), 2, "#112233");
  ed.setWallColour(roomOf(ed), 2, null);
  assert.equal(roomOf(ed).wall_colors, undefined, "no wall colour left: no list");
  ed.setWallColour(roomOf(ed), null, null);
  assert.equal("wall_color" in roomOf(ed), false);
  // every change is one undo step
  ed.undo();
  assert.equal(roomOf(ed).wall_color, "#d9c7a3");
});

test("the Walls fold has the room's colour on top and a colour in each wall's settings (#438)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 3)]);
  ed._roomId = "r";
  ed.setWallsOpen(true);
  const closed = flat(ed.renderEdgeHeights(ed.room));
  assert.ok(closed.includes(ed.t("wall_colour_all")));
  assert.ok(!closed.includes(ed.t("wall_colour_side")), "a closed wall shows no fields");
  setSideFold(ed, "wall:r:0", true);
  const open = flat(ed.renderEdgeHeights(ed.room));
  assert.ok(open.includes(ed.t("wall_colour_side")));
  assert.match(open, /<fp3d-colour-field/);
  ed.setWallColour(roomOf(ed), 0, "#3b6ea5");
  assert.match(flat(ed.renderEdgeHeights(ed.room)), /1 set/, "the wall counts as having a setting of its own");
});

test("the first wall colour says where wall colours show (#438)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 3)]);
  ed._roomId = "r";
  ed._notice = null;
  ed.setWallColour(roomOf(ed), 0, "#3b6ea5");
  assert.equal(ed._notice, ed.t("wall_colors_shown"));
  ed._notice = null;
  ed.setWallColour(roomOf(ed), 1, "#3b6ea5");
  assert.equal(ed._notice, null, "said once");
});

test("the 3D pane beside the plan: Neon until a wall colour is set, then Cozy (#438)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 3)]);
  ed._roomId = "r";
  const theme = (): unknown => {
    const t = ed.render3d() as { values: unknown[]; strings: readonly string[] };
    // the value that follows ".theme=" in the template
    const at = t.strings.findIndex((s) => s.trimEnd().endsWith(".theme="));
    return at < 0 ? undefined : t.values[at];
  };
  ed._doc3d = ed._doc;
  assert.equal(theme(), "neon");
  ed.setWallColour(roomOf(ed), 0, "#3b6ea5");
  ed._doc3d = ed._doc;
  assert.equal(theme(), "cozy");
});
