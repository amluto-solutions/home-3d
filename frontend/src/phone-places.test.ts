import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { isHaPath, phonePlaces } from "./card-config.ts";
import { climateOnMode, fitSlots, floorGroup, navFloors, navSlots, ownSlots, type OwnPlaceInput } from "./phone-bar.ts";
import { linkedRoom, phoneLink } from "./phone.ts";
import type { RoomTile } from "./room-tiles.ts";

// #494: the phone bar's own places (phone_places), the card's bar options and the notification links

const tile = (floorId: string, roomId: string, lights: string[] = [], climates: string[] = []): RoomTile => ({
  floorId,
  roomId,
  name: roomId,
  temp: null,
  lights,
  lightsOn: [],
  open: 0,
  playing: false,
  covers: [],
  climates,
  active: false,
});

test("own places: known kinds only, an action with an entity id, a link inside Home Assistant, at most two", () => {
  assert.deepEqual(phonePlaces(undefined), []);
  assert.deepEqual(phonePlaces("lights"), []);
  const raw = [
    { kind: "shop" },
    null,
    { kind: "action", entity: "not an id" },
    { kind: "link", path: "https://example.org" },
    { kind: "link", path: "//example.org/x" },
    { kind: "lights", name: "  All the lamps of the house and more  ", icon: "💡💡💡💡💡", entity: "light.sample_x" },
    { kind: "action", entity: "scene.sample_evening", path: "/x" },
    { kind: "climate" },
  ];
  const out = phonePlaces(raw);
  assert.equal(out.length, 2);
  // the word is cut to 24 characters, the symbol to four (emoji count as one each), and what a kind does not use goes
  assert.deepEqual(out[0], { kind: "lights", name: "All the lamps of the hou", icon: "💡💡💡💡", entity: undefined, path: undefined });
  assert.deepEqual(out[1], { kind: "action", name: undefined, icon: undefined, entity: "scene.sample_evening", path: undefined });
  assert.deepEqual(phonePlaces([{ kind: "link", path: "/lovelace/energy" }])[0].path, "/lovelace/energy");
});

test("a link place's path stays inside Home Assistant", () => {
  assert.equal(isHaPath("/lovelace/0"), true);
  assert.equal(isHaPath("/home_3d?view=now"), true);
  for (const bad of ["", "/", "//evil.example", "/\\evil.example", "lovelace/0", "javascript:alert(1)", 3, null]) assert.equal(isHaPath(bad), false, String(bad));
});

test("a group place lists the floors' lamps or thermostats, each once, floors without any left out", () => {
  const floors = navFloors(
    [
      { id: "ground", name: "Downstairs", elevation: 0 },
      { id: "upper", name: "Upstairs", elevation: 2.8 },
    ],
    [tile("ground", "lounge", ["light.sample_a", "light.sample_b"], ["climate.sample_lounge"]), tile("ground", "hall", ["light.sample_b"]), tile("upper", "bed", ["light.sample_c"])],
  );
  assert.deepEqual(floorGroup(floors, "lights"), [
    { id: "ground", name: "Downstairs", entities: ["light.sample_a", "light.sample_b"] },
    { id: "upper", name: "Upstairs", entities: ["light.sample_c"] },
  ]);
  assert.deepEqual(floorGroup(floors, "climate"), [{ id: "ground", name: "Downstairs", entities: ["climate.sample_lounge"] }]);
});

test("own places in the bar: a place with nothing to show stays away; lamps on are the number on it", () => {
  const p = (kind: OwnPlaceInput["kind"], over: Partial<OwnPlaceInput> = {}): OwnPlaceInput => ({ kind, devices: 0, exists: false, on: 0, fallback: kind, ...over });
  assert.deepEqual(ownSlots([p("lights", { devices: 4, on: 2 }), p("climate")]), [{ id: "own:0", label: "lights", icon: "💡", badge: 2 }]);
  // the index stays the place's own, so a tap finds it even when the one before stays away
  assert.deepEqual(ownSlots([p("action"), p("link", { name: "Energy", icon: "⚡" })]), [{ id: "own:1", label: "Energy", icon: "⚡", badge: 0 }]);
  assert.deepEqual(ownSlots([p("action", { exists: true, fallback: "Evening" }), p("climate", { devices: 1, on: 1 })]).map((s) => [s.id, s.label, s.icon, s.badge]), [
    ["own:0", "Evening", "▶", 0],
    ["own:1", "climate", "🌡", 0],
  ]);
});

test("own places sit before More; a full bar moves them under More first, then the blinds", () => {
  const floors = navFloors(
    [
      { id: "ground", name: "Downstairs", elevation: 0 },
      { id: "upper", name: "Upstairs", elevation: 2.8 },
    ],
    [tile("ground", "lounge"), tile("upper", "bed")],
  );
  const own = [
    { id: "own:0", label: "Lights", badge: 1, icon: "💡" },
    { id: "own:1", label: "Energy", badge: 0, icon: "↗" },
  ];
  const all = navSlots(floors, 0, 0, true, own);
  assert.deepEqual(all.map((s) => s.id), ["now", "floor:ground", "floor:upper", "covers", "own:0", "own:1", "more"]);
  const { bar, over } = fitSlots(all);
  assert.deepEqual(bar.map((s) => s.id), ["now", "rooms", "covers", "own:0", "more"]);
  assert.deepEqual(over.map((s) => s.id), ["own:1"]);
  // a card that leaves the rooms and the blinds out keeps both own places in the bar
  assert.deepEqual(fitSlots(navSlots([], 0, 0, false, own)).bar.map((s) => s.id), ["now", "own:0", "own:1", "more"]);
});

test("a thermostat switched on goes back to heating, else its first mode that is not off", () => {
  assert.equal(climateOnMode(["off", "cool", "heat"]), "heat");
  assert.equal(climateOnMode(["off", "auto"]), "auto");
  assert.equal(climateOnMode(["off", "cool"]), "cool");
  assert.equal(climateOnMode(["off"]), undefined);
  assert.equal(climateOnMode([]), undefined);
});

test("notification links: ?view=now, ?room= and ?show= (an entity id only)", () => {
  assert.equal(phoneLink(""), null);
  assert.equal(phoneLink("?view=2d"), null);
  assert.deepEqual(phoneLink("?view=now"), { now: true, room: null, show: null });
  assert.deepEqual(phoneLink("?room=Living%20room"), { now: false, room: "Living room", show: null });
  assert.deepEqual(phoneLink("?show=binary_sensor.sample_window&view=now"), { now: true, room: null, show: "binary_sensor.sample_window" });
  assert.equal(phoneLink("?show=<script>"), null);
  assert.equal(phoneLink("?room=%20%20"), null);
});

test("a link's room: by id first, else by name in any case", () => {
  const floors = [
    { id: "ground", rooms: [{ id: "lounge", name: "Living room" }, { id: "kitchen", name: "Kitchen" }] },
    { id: "upper", rooms: [{ id: "living room", name: "Study" }] },
  ];
  assert.deepEqual(linkedRoom(floors, "kitchen"), { floorId: "ground", roomId: "kitchen" });
  assert.deepEqual(linkedRoom(floors, " living ROOM "), { floorId: "ground", roomId: "lounge" });
  assert.deepEqual(linkedRoom(floors, "living room"), { floorId: "upper", roomId: "living room" });
  assert.equal(linkedRoom(floors, "Cellar"), null);
});

test("the card passes its bar options to the phone view, and the panel follows a notification's link", () => {
  const card = readFileSync(new URL("./card.ts", import.meta.url), "utf8");
  for (const s of [".hide=${c?.phone_hide", ".start=${c?.phone_start}", ".places=${c?.phone_places}", "@phone-link="]) assert.ok(card.includes(s), s);
  const panel = readFileSync(new URL("./panel.ts", import.meta.url), "utf8");
  assert.match(panel, /phoneLink\(/);
  assert.match(panel, /this\.followLink\(\)/);
  // ?view=now opens the list through the shell's `start`: the shell is a lazy chunk, so its methods may not be there yet
  assert.ok(panel.includes('.start=${this.nowLinkOpen ? "now" : undefined}'));
});
