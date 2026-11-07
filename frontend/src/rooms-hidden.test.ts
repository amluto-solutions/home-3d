// Rooms hidden from the room selector (#298).

import assert from "node:assert/strict";
import { test } from "node:test";
import { filterRooms, type RoomGroup } from "./components/rooms-picker.ts";

const groups: RoomGroup[] = [
  { id: "f1", name: "Ground", rooms: [{ id: "k", name: "Kitchen" }, { id: "c", name: "Chimney", hidden: true }] },
  { id: "f2", name: "Attic", rooms: [{ id: "e", name: "Eaves", hidden: true }] },
];

test("hidden rooms leave the list unless Show hidden is on; a floor left empty goes", () => {
  assert.deepEqual(filterRooms(groups, "", false).map((g) => g.rooms.map((r) => r.id)), [["k"]]);
  assert.deepEqual(filterRooms(groups, "", true).map((g) => g.rooms.map((r) => r.id)), [["k", "c"], ["e"]]);
  assert.equal(filterRooms(groups, "").length, 2, "without the argument everything is listed (the picker passes its toggle)");
});

test("the search works on the shown rooms only", () => {
  assert.deepEqual(filterRooms(groups, "chim", false), []);
  assert.deepEqual(filterRooms(groups, "chim", true).map((g) => g.rooms.map((r) => r.id)), [["c"]]);
});
