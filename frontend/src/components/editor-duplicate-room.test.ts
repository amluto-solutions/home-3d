// Duplicating a room (#186): the copy keeps the shape and the look but not the link to a Home Assistant area, so two
// rooms never claim one area.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { OutdoorArea, Room } from "../model.ts";
import { makeEditor, square } from "./editor-harness.ts";

function kitchen(): Room {
  return {
    ...square("r", 0, 0, 4, 3),
    name: "Kitchen",
    area_id: "kitchen",
    aliases: ["Galley"],
    climate: { temperature: "sensor.sample_kitchen_temperature" },
    live: null,
    start_view: { x: 1, y: 1.6, z: 1, tx: 2, ty: 1, tz: 2 },
    panel: ["light.sample_kitchen"],
    hidden: ["switch.sample_kettle"],
    no_state: ["cover.sample_blind"],
    mods: { announce: { speaker: "media_player.sample_kitchen" } },
    wall_heights: [null, 0, null, null],
    ceiling_height: 2.4,
    floor_material: "tiles",
  } as unknown as Room;
}

test("a duplicated room has no area, voice names or entity links of its own; the original keeps them (#186)", async () => {
  const ed = await makeEditor([kitchen()]);
  ed._roomId = "r";
  ed.duplicateRoom();
  const [orig, copy] = ed._doc.floors[0].rooms as Room[];
  assert.notEqual(copy.id, orig.id);
  assert.equal(ed._roomId, copy.id, "the copy is selected");
  assert.equal(copy.area_id, null);
  assert.equal(copy.name, "Kitchen (copy)");
  for (const key of ["aliases", "climate", "live", "start_view", "panel", "hidden", "no_state", "mods"] as const) assert.equal(copy[key], undefined, key);
  // shape and look come along, half a metre over
  assert.deepEqual(copy.points[0], [0.5, 0.5]);
  assert.deepEqual(copy.wall_heights, [null, 0, null, null]);
  assert.equal(copy.ceiling_height, 2.4);
  assert.equal(copy.floor_material, "tiles");
  // the original is untouched, and the area is claimed once
  assert.deepEqual(orig, kitchen());
  assert.equal(ed._doc.floors[0].rooms.filter((r: Room) => r.area_id === "kitchen").length, 1);
  // one undo takes the copy away again
  ed.undo();
  assert.equal(ed._doc.floors[0].rooms.length, 1);
});

test("a duplicated outdoor area does not take the area link either (#186)", async () => {
  const ed = await makeEditor([]);
  const garden: OutdoorArea = { id: "o", type: "lawn", name: "Garden", area_id: "garden", points: [[0, 0], [5, 0], [5, 5], [0, 5]] } as OutdoorArea;
  ed._doc.floors[0].outdoor = [garden];
  ed.selectItem("outdoor", "o");
  ed.duplicateOutdoor();
  const [orig, copy] = ed._doc.floors[0].outdoor as OutdoorArea[];
  assert.equal(orig.area_id, "garden");
  assert.equal(copy.area_id, null);
});
