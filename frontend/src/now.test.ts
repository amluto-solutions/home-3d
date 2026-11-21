import assert from "node:assert/strict";
import { test } from "node:test";
import { nowItems, nowStops, nowSummary, type NowInput, type NowWords } from "./now.ts";

// #493: the phone view's list builder ("What's going on?") and the house check

const words: NowWords = {
  open: (n) => `${n} open`,
  tilted: "tilted",
  unlocked: (n) => `${n} unlocked`,
  home: "Home",
  away: "Out",
  nobodyHome: "Nobody in",
  lights: (n) => `${n} lights`,
  energyUse: "Using",
  energySolar: "Sun",
  energyGrid: "From grid",
  energyFeed: "To grid",
  battery: "Battery",
  charging: "charging",
  carAway: "out",
  calm: "All well",
  calmDetail: "nothing to do",
  watts: (w) => `${Math.round(w)} W`,
};

const empty: NowInput = { alerts: [], openings: [], unlocked: [], people: [], household: [], lights: [], energy: null, cars: [], away: false };

function win(id: string, room: string, open: boolean, tilted = false, entity = `binary_sensor.sample_${id}`): NowInput["openings"][number] {
  return { id, kind: "window", room, open, tilted, entity, floorId: "ground", roomId: room.toLowerCase() };
}

test("a quiet house gets one 'all well' line", () => {
  const items = nowItems(empty, words);
  assert.deepEqual(
    items.map((i) => [i.kind, i.title, i.detail]),
    [["calm", "All well", "nothing to do"]],
  );
  assert.deepEqual(nowStops(empty, words), []);
});

test("warnings first, then what is open or unlocked, then people and lights; no 'all well' line", () => {
  const items = nowItems(
    {
      ...empty,
      lights: [{ room: "Lounge", count: 3, floorId: "ground", roomId: "lounge", on: ["light.sample_a", "light.sample_b", "light.sample_c"] }, { room: "Hall", count: 0 }],
      people: [{ name: "Person A", home: true, room: "Study", floorId: "upper", roomId: "study" }, { name: "Person B", home: false, room: null }],
      unlocked: [{ name: "Back door", entity: "lock.sample_back" }],
      openings: [win("w1", "Lounge", true), win("w2", "Kitchen", false, true), win("w3", "Study", false)],
      alerts: [{ text: "Kitchen · water", entity: "binary_sensor.sample_leak", floorId: "ground", roomId: "kitchen" }],
    },
    words,
  );
  assert.deepEqual(items.map((i) => i.kind), ["alert", "open", "unlocked", "people", "lights"]);
  assert.deepEqual(items.map((i) => i.level), [2, 1, 1, 0, 0]);
  assert.equal(items[1].title, "2 open");
  assert.equal(items[1].detail, "Lounge, Kitchen (tilted)");
  assert.equal(items[3].title, "Home: Person A (Study)");
  assert.equal(items[3].detail, "Out: Person B");
  assert.equal(items[4].title, "3 lights");
  // a line with several places names each one for the pick list
  assert.deepEqual(items[1].targets.map((t) => t.label), ["Lounge", "Kitchen (tilted)"]);
  assert.equal(items[1].targets[0].opening, "w1");
});

test("one window with two contacts and a blind counts once", () => {
  const items = nowItems({ ...empty, openings: [win("w1", "Bath", true, false, "binary_sensor.sample_a"), win("w1", "Bath", true, false, "binary_sensor.sample_b"), win("w1", "Bath", true, false, "cover.sample_c")] }, words);
  assert.equal(items[0].title, "1 open");
  assert.equal(items[0].targets.length, 1);
});

test("away from home, the people line comes right after the warnings", () => {
  const input: NowInput = { ...empty, away: true, openings: [win("w1", "Bath", true)], people: [{ name: "Person B", home: true, room: null }] };
  assert.deepEqual(nowItems(input, words).map((i) => i.kind), ["people", "open"]);
  assert.deepEqual(nowItems({ ...input, away: false }, words).map((i) => i.kind), ["open", "people"]);
});

test("the household: due jobs stand alone, the rest share a line; cars and energy come last", () => {
  const items = nowItems(
    {
      ...empty,
      household: [{ text: "Dryer: done", entity: "sensor.sample_dryer", hot: true }, { text: "Bins: Friday", entity: null, hot: false }, { text: "Post: none", entity: null, hot: false }],
      energy: { consumption: 950, solar: 2100, grid: -1150, soc: 81.4 },
      cars: [
        { name: "Car", present: true, charging: true, soc: 40.6, floorId: "ground" },
        { name: "Van", present: true, charging: false, soc: null },
      ],
    },
    words,
  );
  // a car with nothing to say gets no line
  assert.deepEqual(items.map((i) => i.kind), ["household", "household", "car", "energy"]);
  assert.equal(items[0].level, 1);
  assert.equal(items[1].title, "Bins: Friday");
  assert.equal(items[1].detail, "Post: none");
  assert.equal(items[2].detail, "charging · 41 %");
  assert.equal(items[3].title, "Using 950 W");
  assert.equal(items[3].detail, "Sun 2100 W · To grid 1150 W · Battery 81 %");
});

test("energy without a consumption sensor leads with the sun", () => {
  const items = nowItems({ ...empty, energy: { consumption: null, solar: 400, grid: 3, soc: null } }, words);
  assert.equal(items.find((i) => i.kind === "energy")!.title, "Sun 400 W");
  assert.equal(items.find((i) => i.kind === "energy")!.detail, "");
});

test("the buttons beside a line: lock for the locks, lights off for the lights, none for a window", () => {
  const items = nowItems(
    {
      ...empty,
      openings: [win("w1", "Bath", true)],
      unlocked: [{ name: "Front door", entity: "lock.sample_front" }, { name: "Gate", entity: null }],
      lights: [
        { room: "Bath", count: 2, on: ["light.sample_a", "light.sample_b"] },
        { room: "Hall", count: 1, on: ["switch.sample_c"] },
      ],
    },
    words,
  );
  assert.equal(items.find((i) => i.kind === "open")!.action, undefined);
  assert.deepEqual(items.find((i) => i.kind === "unlocked")!.action, { kind: "lock", entities: ["lock.sample_front"] });
  assert.deepEqual(items.find((i) => i.kind === "lights")!.action, { kind: "lights_off", entities: ["light.sample_a", "light.sample_b", "switch.sample_c"] });
  assert.deepEqual(items.find((i) => i.kind === "lights")!.targets.map((t) => t.label), ["Bath (2)", "Hall"]);
});

test("the status line: a warning first, else what needs a look, else all well with the lights", () => {
  assert.deepEqual(nowSummary(nowItems(empty, words)), { text: "All well", level: 0 });
  const lit: NowInput = { ...empty, lights: [{ room: "Bath", count: 2, on: ["light.sample_a"] }] };
  assert.deepEqual(nowSummary(nowItems(lit, words)), { text: "All well · 2 lights", level: 0 });
  assert.deepEqual(nowSummary(nowItems({ ...lit, openings: [win("w1", "Bath", true)] }, words)), { text: "1 open · 2 lights", level: 1 });
  const two = { ...lit, openings: [win("w1", "Bath", true)], unlocked: [{ name: "Front door", entity: "lock.sample_front" }] };
  assert.deepEqual(nowSummary(nowItems(two, words)), { text: "1 open · 1 unlocked", level: 1 });
  const alarm = { ...lit, alerts: [{ text: "Smoke", entity: "binary_sensor.sample_smoke" }, { text: "Water", entity: "binary_sensor.sample_leak" }] };
  assert.deepEqual(nowSummary(nowItems(alarm, words)), { text: "Smoke (+1)", level: 2 });
});

test("the house check stops at every open window, then every unlocked lock, then every lit room", () => {
  const stops = nowStops(
    {
      ...empty,
      lights: [
        { room: "Bath", count: 2, floorId: "ground", roomId: "bath", on: ["light.sample_a", "light.sample_b"] },
        { room: "Hall", count: 0 },
        { room: "Loft", count: 1, floorId: "upper", roomId: "loft" },
      ],
      unlocked: [{ name: "Front door", entity: "lock.sample_front" }],
      openings: [win("w1", "Bath", false, true), win("w1", "Bath", false, true, "cover.sample_w1"), win("w2", "Study", false)],
    },
    words,
  );
  assert.deepEqual(stops.map((s) => s.kind), ["open", "unlocked", "lights", "lights"]);
  assert.equal(stops[0].title, "Bath · (tilted)");
  assert.equal(stops[0].target.opening, "w1");
  // a window is shut by hand: no button
  assert.equal(stops[0].action, undefined);
  assert.deepEqual(stops[1].action, { kind: "lock", entities: ["lock.sample_front"] });
  assert.equal(stops[2].title, "Bath · 2 lights");
  assert.deepEqual(stops[2].action, { kind: "lights_off", entities: ["light.sample_a", "light.sample_b"] });
  // a lit room whose lamps the plan does not name: a stop to look at, no button
  assert.equal(stops[3].action, undefined);
});
