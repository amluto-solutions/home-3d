import assert from "node:assert/strict";
import { test } from "node:test";
import { nameNewRoom, roomNameSuggestions } from "./room-naming.ts";
import type { HassArea } from "./types.ts";

const areas: HassArea[] = [
  { area_id: "lounge", name: "Lounge", floor_id: "ground" },
  { area_id: "kitchen", name: "Kitchen", floor_id: "ground" },
  { area_id: "study", name: "Study", floor_id: "first" },
];

test("a typed name that is a Home Assistant area's name links the new room to that area (#65)", () => {
  assert.deepEqual(nameNewRoom(" lounge ", areas, new Set(), "Room 3"), { name: "Lounge", area_id: "lounge" });
});

test("a free name stays as typed, an empty one falls back, and an area already placed is not linked twice (#65)", () => {
  assert.deepEqual(nameNewRoom("Utility", areas, new Set(), "Room 3"), { name: "Utility", area_id: null });
  assert.deepEqual(nameNewRoom("  ", areas, new Set(), "Room 3"), { name: "Room 3", area_id: null });
  assert.deepEqual(nameNewRoom("Kitchen", areas, new Set(["kitchen"]), "Room 3"), { name: "Kitchen", area_id: null });
});

test("suggestions are the areas not placed yet, this floor's first, then by name (#65)", () => {
  assert.deepEqual(roomNameSuggestions(areas, new Set(["lounge"]), "first"), ["Study", "Kitchen"]);
  assert.deepEqual(roomNameSuggestions(areas, new Set(), null), ["Kitchen", "Lounge", "Study"]);
});
