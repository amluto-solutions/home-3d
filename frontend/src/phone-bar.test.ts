import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Building, type Room } from "./model.ts";
import { fitSlots, floorCovers, navCover, navFloors, navSlots, type NavSlot } from "./phone-bar.ts";
import { looksLikePhone } from "./phone.ts";
import { roomTiles, type RoomTile } from "./room-tiles.ts";
import type { HomeAssistant } from "./types.ts";

// #493: the phone view's bar (places, the fit to five) and the room tiles it shows

const tile = (floorId: string, roomId: string, lightsOn = 0, covers: string[] = [], climates: string[] = [], lights: string[] = []): RoomTile => ({
  floorId,
  roomId,
  name: roomId,
  temp: null,
  lights,
  lightsOn: Array.from({ length: lightsOn }, (_, i) => `light.sample_${roomId}_${i}`),
  open: 0,
  playing: false,
  covers,
  climates,
  active: lightsOn > 0,
});

const floors = [
  { id: "upper", name: "Upstairs", elevation: 2.8 },
  { id: "ground", name: "Downstairs", elevation: 0 },
  { id: "cellar", name: "Cellar", elevation: -2.6 },
];

test("the floors with rooms, lowest first, with their lights on", () => {
  const nav = navFloors(floors, [tile("upper", "bed", 1), tile("ground", "lounge", 2), tile("ground", "hall", 1)]);
  assert.deepEqual(nav.map((f) => [f.id, f.lightsOn, f.rooms.length]), [["ground", 3, 2], ["upper", 1, 1]]);
});

test("two floors get a place each; one floor or three share one Rooms place; no blinds, no blinds place", () => {
  const two = navFloors(floors, [tile("upper", "bed", 1), tile("ground", "lounge", 2)]);
  assert.deepEqual(navSlots(two, 2, 1, true).map((s) => [s.id, s.badge]), [["now", 2], ["floor:ground", 2], ["floor:upper", 1], ["covers", 1], ["more", 0]]);
  assert.equal(navSlots(two, 0, 0, true)[1].label, "Downstairs");
  const three = navFloors(floors, [tile("upper", "bed", 1), tile("ground", "lounge", 2), tile("cellar", "store")]);
  assert.deepEqual(navSlots(three, 0, 0, false).map((s) => [s.id, s.badge]), [["now", 0], ["rooms", 3], ["more", 0]]);
  const one = navFloors(floors, [tile("ground", "lounge")]);
  assert.deepEqual(navSlots(one, 0, 0, false).map((s) => s.id), ["now", "rooms", "more"]);
  assert.deepEqual(navSlots([], 0, 0, false).map((s) => s.id), ["now", "more"]);
});

test("at most five places: two floors join first, then the places before More move under it", () => {
  const two = navFloors(floors, [tile("upper", "bed", 1), tile("ground", "lounge", 2)]);
  const extra: NavSlot[] = [{ id: "own:0", label: "Lights", badge: 0 }];
  // now, 2 floors, covers, own, more = 6: the floors become one Rooms place
  const a = fitSlots(navSlots(two, 0, 0, true, extra));
  assert.deepEqual(a.bar.map((s) => s.id), ["now", "rooms", "covers", "own:0", "more"]);
  assert.equal(a.bar[1].badge, 3);
  assert.deepEqual(a.over, []);
  // two own places on a house with three floors: the last own place moves under More
  const three = navFloors(floors, [tile("upper", "bed"), tile("ground", "lounge"), tile("cellar", "store")]);
  const b = fitSlots(navSlots(three, 0, 0, true, [...extra, { id: "own:1", label: "Heat", badge: 0 }]));
  assert.deepEqual(b.bar.map((s) => s.id), ["now", "rooms", "covers", "own:0", "more"]);
  assert.deepEqual(b.over.map((s) => s.id), ["own:1"]);
  // a smaller bar: the blinds go too, Now, the rooms and More stay
  const c = fitSlots(navSlots(three, 0, 0, true, extra), 3);
  assert.deepEqual(c.bar.map((s) => s.id), ["now", "rooms", "more"]);
  assert.deepEqual(c.over.map((s) => s.id), ["covers", "own:0"]);
  // a bar that fits is left as it is
  assert.deepEqual(fitSlots(navSlots(two, 0, 0, true)).bar.map((s) => s.id), ["now", "floor:ground", "floor:upper", "covers", "more"]);
});

test("a cover is shut when it says closed or stands at 0 %", () => {
  assert.deepEqual(navCover("cover.sample_a", "A", "open", 42.4), { entity: "cover.sample_a", name: "A", position: 42, shut: false });
  assert.equal(navCover("cover.sample_a", "A", "closed", undefined).shut, true);
  assert.equal(navCover("cover.sample_a", "A", "open", 0).shut, true);
  assert.equal(navCover("cover.sample_a", "A", "opening", "50").position, null);
});

test("the blinds of each floor, each once, floors without blinds left out", () => {
  const nav = navFloors(floors, [tile("ground", "lounge", 0, ["cover.sample_a", "cover.sample_b"]), tile("ground", "hall", 0, ["cover.sample_b"]), tile("upper", "bed")]);
  assert.deepEqual(floorCovers(nav), [{ id: "ground", name: "Downstairs", entities: ["cover.sample_a", "cover.sample_b"] }]);
});

test("a phone is a touch screen with a short side of a phone", () => {
  assert.equal(looksLikePhone(390, 844, 5), true);
  assert.equal(looksLikePhone(844, 390, 5), true);
  assert.equal(looksLikePhone(390, 844, 0, 600), false);
  assert.equal(looksLikePhone(820, 1180, 5, 600), false);
  assert.equal(looksLikePhone(0, 0, 5, 600), false);
});

test("room tiles: the room panel's lights, open contacts, a player, blinds and the temperature", () => {
  const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });
  const hass = {
    language: "en",
    config: { unit_system: { temperature: "°C" } },
    entities: {},
    states: {
      "light.sample_lounge": st("light.sample_lounge", "on"),
      "light.sample_lamp": st("light.sample_lamp", "off"),
      "binary_sensor.sample_window": st("binary_sensor.sample_window", "on", { device_class: "window" }),
      "binary_sensor.sample_motion": st("binary_sensor.sample_motion", "on", { device_class: "motion" }),
      "media_player.sample_speaker": st("media_player.sample_speaker", "playing"),
      "cover.sample_blind": st("cover.sample_blind", "closed"),
      "climate.sample_heat": st("climate.sample_heat", "heat", { current_temperature: 20.5 }),
    },
  } as unknown as HomeAssistant;
  const square = (x: number): [number, number][] => [[x, 0], [x + 4, 0], [x + 4, 4], [x, 4]];
  const lounge: Room = { id: "lounge", name: "Lounge", area_id: null, points: square(0), floor_material: "wood" };
  const study: Room = { id: "study", name: "Study", area_id: null, points: square(10), floor_material: "wood" };
  const nameless: Room = { id: "x", name: " ", area_id: null, points: square(20), floor_material: "wood" };
  const ground = {
    ...newFloor("ground", "Ground", 0),
    rooms: [lounge, study, nameless],
    placements: ["light.sample_lounge", "light.sample_lamp", "binary_sensor.sample_window", "binary_sensor.sample_motion", "media_player.sample_speaker", "cover.sample_blind", "climate.sample_heat"].map((entity_id) => ({ entity_id, x: 1, z: 1, y: null, mount: null })),
  };
  const upper = { ...newFloor("upper", "Upper", 3), rooms: [{ ...study, id: "bed", name: "Bed" }] };
  const b: Building = { ...emptyBuilding(), floors: [upper, ground] };
  const tiles = roomTiles(hass, b, null);
  // lowest floor first; the room without a name has no tile
  assert.deepEqual(tiles.map((t) => t.roomId), ["lounge", "study", "bed"]);
  const t = tiles[0];
  assert.deepEqual(t.lights, ["light.sample_lounge", "light.sample_lamp"]);
  assert.deepEqual(t.lightsOn, ["light.sample_lounge"]);
  // a motion sensor is no open window
  assert.equal(t.open, 1);
  assert.equal(t.playing, true);
  assert.deepEqual(t.covers, ["cover.sample_blind"]);
  assert.deepEqual(t.climates, ["climate.sample_heat"]);
  assert.equal(t.temp, 20.5);
  assert.equal(t.active, true);
  assert.deepEqual(roomTiles(hass, b, "upper").map((x) => [x.roomId, x.active, x.temp]), [["bed", false, null]]);
});
