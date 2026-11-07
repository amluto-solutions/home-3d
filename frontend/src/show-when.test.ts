import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Furniture } from "./model.ts";
import { hasTimedRules, hiddenItems, itemShown, planHiddenItems, setIntervalPart, shownBuilding, stateHiddenItems, wholeInterval } from "./show-when.ts";
import type { HassEntity } from "./types.ts";

const item = (extra: Partial<Furniture> = {}): Furniture => ({ id: "tree", type: "plant", x: 0, z: 0, rotation: 0, w: 1, d: 1, h: 2, variant: null, ...extra });
const states: Record<string, HassEntity> = {};
// a local date and time (the rules are about the house's own calendar and clock)
const at = (iso: string) => new Date(iso);

test("an item with no rule always shows", () => {
  assert.equal(itemShown(item(), states, at("2026-07-14T03:00")), true);
  assert.equal(itemShown(item({ show_when: null }), states, at("2026-12-24T18:00")), true);
  assert.equal(itemShown(item({ show_when: { entity: null, intervals: [] } }), states, at("2026-01-01T00:00")), true);
});

test("an item that follows an entity hides while the entity is unavailable (or gone) and shows in any other state", () => {
  const st = (state: string): HassEntity => ({ entity_id: "light.garden", state, attributes: {} }) as HassEntity;
  const f = item({ show_when: { entity: "light.garden" } });
  const now = at("2026-07-14T20:00");
  assert.equal(itemShown(f, { "light.garden": st("off") }, now), true);
  assert.equal(itemShown(f, { "light.garden": st("on") }, now), true);
  assert.equal(itemShown(f, { "light.garden": st("unavailable") }, now), false);
  assert.equal(itemShown(f, {}, now), false);
  // "none" is no entity at all
  assert.equal(itemShown(item({ show_when: { entity: "none" } }), {}, now), true);
});

test("an item with date intervals shows only inside them, both days included", () => {
  const f = item({ show_when: { intervals: [{ from: "12-01", to: "12-31" }, { from: "04-10", to: "04-12" }] } });
  assert.equal(itemShown(f, states, at("2026-11-30T23:59")), false);
  assert.equal(itemShown(f, states, at("2026-12-01T00:00")), true);
  assert.equal(itemShown(f, states, at("2026-12-31T23:59")), true);
  assert.equal(itemShown(f, states, at("2027-01-01T00:00")), false);
  assert.equal(itemShown(f, states, at("2027-04-11T12:00")), true);
  assert.equal(itemShown(f, states, at("2027-04-13T00:00")), false);
});

test("a date interval runs over the new year when its first day comes after its last", () => {
  const f = item({ show_when: { intervals: [{ from: "12-15", to: "01-06" }] } });
  assert.equal(itemShown(f, states, at("2026-12-14T12:00")), false);
  assert.equal(itemShown(f, states, at("2026-12-20T12:00")), true);
  assert.equal(itemShown(f, states, at("2027-01-01T00:30")), true);
  assert.equal(itemShown(f, states, at("2027-01-06T23:00")), true);
  assert.equal(itemShown(f, states, at("2027-01-07T00:00")), false);
  assert.equal(itemShown(f, states, at("2027-07-01T12:00")), false);
});

test("a time-of-day interval on its own shows every day from its start up to its end, over midnight too", () => {
  const evening = item({ show_when: { intervals: [{ start: "18:00", end: "23:00" }] } });
  assert.equal(itemShown(evening, states, at("2026-03-02T17:59")), false);
  assert.equal(itemShown(evening, states, at("2026-03-02T18:00")), true);
  assert.equal(itemShown(evening, states, at("2026-09-20T22:59")), true);
  assert.equal(itemShown(evening, states, at("2026-09-20T23:00")), false);
  const night = item({ show_when: { intervals: [{ start: "22:00", end: "06:00" }] } });
  assert.equal(itemShown(night, states, at("2026-03-02T23:30")), true);
  assert.equal(itemShown(night, states, at("2026-03-03T05:59")), true);
  assert.equal(itemShown(night, states, at("2026-03-03T06:00")), false);
  assert.equal(itemShown(night, states, at("2026-03-03T12:00")), false);
});

test("dates and times together: garden lights only on summer evenings", () => {
  const f = item({ show_when: { intervals: [{ from: "06-01", to: "08-31", start: "19:30", end: "23:30" }] } });
  assert.equal(itemShown(f, states, at("2026-07-14T20:00")), true);
  assert.equal(itemShown(f, states, at("2026-07-14T12:00")), false);
  assert.equal(itemShown(f, states, at("2026-12-14T20:00")), false);
});

test("a time window over midnight belongs to the evening it started (#46)", () => {
  const f = item({ show_when: { intervals: [{ from: "12-01", to: "12-31", start: "22:00", end: "02:00" }] } });
  // the first evening and the night after it
  assert.equal(itemShown(f, states, at("2026-12-01T01:00")), false);
  assert.equal(itemShown(f, states, at("2026-12-01T22:30")), true);
  assert.equal(itemShown(f, states, at("2026-12-02T01:00")), true);
  // the last evening of the range, and the morning after it, which still belongs to it
  assert.equal(itemShown(f, states, at("2026-12-31T23:00")), true);
  assert.equal(itemShown(f, states, at("2027-01-01T01:30")), true);
  assert.equal(itemShown(f, states, at("2027-01-01T02:00")), false);
  assert.equal(itemShown(f, states, at("2027-01-01T22:30")), false);
});

test("an interval with only one end of its days or times is no interval: it never matches (#46)", () => {
  for (const iv of [{ from: "12-01" }, { to: "12-31" }, { start: "18:00" }, { end: "06:00" }, { from: "12-01", to: "12-31", start: "18:00" }]) {
    assert.equal(wholeInterval(iv), false, JSON.stringify(iv));
    assert.equal(itemShown(item({ show_when: { intervals: [iv] } }), states, at("2026-12-10T19:00")), false, JSON.stringify(iv));
  }
  for (const iv of [{}, { from: "12-01", to: "12-31" }, { start: "18:00", end: "06:00", from: null, to: null }]) assert.equal(wholeInterval(iv), true, JSON.stringify(iv));
});

test("the editor sets both ends of a half: picking one fills the other, clearing one clears both (#46)", () => {
  assert.deepEqual(setIntervalPart({}, { from: "12-01" }), { from: "12-01", to: "12-01" });
  assert.deepEqual(setIntervalPart({ from: "12-01", to: "12-01" }, { to: "12-31" }), { from: "12-01", to: "12-31" });
  assert.deepEqual(setIntervalPart({}, { end: "06:00" }), { start: "00:00", end: "06:00" });
  assert.deepEqual(setIntervalPart({}, { start: "18:00" }), { start: "18:00", end: "00:00" });
  assert.deepEqual(setIntervalPart({ from: "12-01", to: "12-31", start: "18:00", end: "23:00" }, { start: null }), { from: "12-01", to: "12-31", start: null, end: null });
  assert.deepEqual(setIntervalPart({ from: "12-01", to: "12-31" }, { to: null }), { from: null, to: null });
});

test("an entity and intervals together: both must allow it", () => {
  const st = (state: string): HassEntity => ({ entity_id: "switch.tree", state, attributes: {} }) as HassEntity;
  const f = item({ show_when: { entity: "switch.tree", intervals: [{ from: "12-01", to: "01-06" }] } });
  assert.equal(itemShown(f, { "switch.tree": st("on") }, at("2026-12-24T18:00")), true);
  assert.equal(itemShown(f, { "switch.tree": st("unavailable") }, at("2026-12-24T18:00")), false);
  assert.equal(itemShown(f, { "switch.tree": st("on") }, at("2026-07-24T18:00")), false);
});

function house() {
  const b = emptyBuilding();
  b.floors.push(newFloor("ground", "Ground floor", 0));
  const floor = newFloor("gf", "Ground", 0);
  floor.furniture = [item({ id: "sofa" }), item({ id: "tree", show_when: { intervals: [{ from: "12-01", to: "12-31" }] } })];
  b.floors = [floor];
  return b;
}

test("the 3D view gets the plan without the items hidden now; the plan itself keeps them", () => {
  const b = house();
  const december = shownBuilding(b, states, at("2026-12-10T10:00"));
  assert.equal(december, b, "nothing hidden: the very same plan, so the 3D view does not rebuild");
  const july = shownBuilding(b, states, at("2026-07-10T10:00"));
  assert.deepEqual(july.floors[0].furniture.map((f) => f.id), ["sofa"]);
  assert.deepEqual(b.floors[0].furniture.map((f) => f.id), ["sofa", "tree"]);
  assert.deepEqual(hiddenItems(b, states, at("2026-07-10T10:00")), ["tree"]);
  assert.deepEqual(hiddenItems(b, states, at("2026-12-10T10:00")), []);
});

test("only plans with intervals need the clock", () => {
  const b = house();
  assert.equal(hasTimedRules(b), true);
  b.floors[0].furniture[1].show_when = { entity: "switch.tree" };
  assert.equal(hasTimedRules(b), false);
});

const st = (id: string, state: string): HassEntity => ({ entity_id: id, state, attributes: {} }) as HassEntity;
const car = "binary_sensor.sample_car_home";
const noon = at("2026-07-14T12:00");

test("show when on / off follows on, true, home, open and off, false, not_home, away, closed (#338)", () => {
  const on = item({ show_when: { entity: car, when: "on" } });
  const off = item({ show_when: { entity: car, when: "off" } });
  for (const s of ["on", "true", "home", "open", "ON"]) {
    assert.equal(itemShown(on, { [car]: st(car, s) }, noon), true, s);
    assert.equal(itemShown(off, { [car]: st(car, s) }, noon), false, s);
  }
  for (const s of ["off", "false", "not_home", "away", "closed"]) {
    assert.equal(itemShown(on, { [car]: st(car, s) }, noon), false, s);
    assert.equal(itemShown(off, { [car]: st(car, s) }, noon), true, s);
  }
  // another state is neither on nor off
  assert.equal(itemShown(on, { [car]: st(car, "playing") }, noon), false);
  assert.equal(itemShown(off, { [car]: st(car, "playing") }, noon), false);
});

test("a person or tracker anywhere but home counts as off (#338)", () => {
  const p = "person.sample_one";
  const off = item({ show_when: { entity: p, when: "off" } });
  assert.equal(itemShown(off, { [p]: st(p, "Sample Work") }, noon), true);
  assert.equal(itemShown(off, { [p]: st(p, "home") }, noon), false);
});

test("show when a typed state matches any of the comma separated states, any letter case (#338)", () => {
  const e = "sensor.sample_mode";
  const f = item({ show_when: { entity: e, when: "state", state: "Party, guests" } });
  assert.equal(itemShown(f, { [e]: st(e, "party") }, noon), true);
  assert.equal(itemShown(f, { [e]: st(e, "guests") }, noon), true);
  assert.equal(itemShown(f, { [e]: st(e, "quiet") }, noon), false);
});

test("an unavailable, unknown or missing entity keeps the item showing unless the rule says hide (#338)", () => {
  const keep = item({ show_when: { entity: car, when: "on" } });
  const hide = item({ show_when: { entity: car, when: "on", unavailable: "hide" } });
  for (const states of [{} as Record<string, HassEntity>, { [car]: st(car, "unavailable") }, { [car]: st(car, "unknown") }]) {
    assert.equal(itemShown(keep, states, noon), true);
    assert.equal(itemShown(hide, states, noon), false);
  }
});

test("the state condition and the intervals must both pass, and state hiding is separate from the plan's (#338)", () => {
  const f = item({ show_when: { entity: car, when: "on", intervals: [{ start: "08:00", end: "18:00" }] } });
  const b = { ...emptyBuilding(), floors: [{ ...newFloor("f1", "Ground", 0), furniture: [f] }] };
  const onNoon = { [car]: st(car, "on") };
  assert.equal(itemShown(f, onNoon, noon), true);
  assert.equal(itemShown(f, onNoon, at("2026-07-14T20:00")), false);
  assert.equal(itemShown(f, { [car]: st(car, "off") }, noon), false);
  assert.deepEqual(stateHiddenItems(b, { [car]: st(car, "off") }), ["tree"]);
  assert.deepEqual(planHiddenItems(b, { [car]: st(car, "off") }, noon), []);
  assert.deepEqual(planHiddenItems(b, onNoon, at("2026-07-14T20:00")), ["tree"]);
  assert.equal(shownBuilding(b, { [car]: st(car, "off") }, noon), b);
});

test("a rule without 'when' keeps the old behaviour: hidden only while unavailable (#338)", () => {
  const f = item({ show_when: { entity: car } });
  assert.equal(itemShown(f, { [car]: st(car, "off") }, noon), true);
  assert.equal(itemShown(f, { [car]: st(car, "unavailable") }, noon), false);
});

test("time travel: a car follows its tracker through the replay, the clock rules the replayed moment (#394)", async () => {
  const { Replay } = await import("./timetravel/replay-hass.ts");
  const { buildTimeline } = await import("./timetravel/timeline.ts");
  const DAY = 1_800_000_000;
  const tl = buildTimeline([
    { day_start: DAY, end: DAY + 86400, oldest: null, keep_days: 10, entities: { "device_tracker.car": { t: [0, 3600, 7200], v: [0, 1, 0], tab: ["home", "not_home"] } }, stats: {}, missing: [] },
  ]);
  const car = item({ id: "car", type: "car", show_when: { entity: "device_tracker.car", when: "on" } });
  const b = emptyBuilding();
  b.floors.push(newFloor("ground", "Ground floor", 0));
  b.floors[0].furniture.push(car);
  const liveHass = { states: { "device_tracker.car": { entity_id: "device_tracker.car", state: "home", attributes: { latitude: 1, longitude: 2, friendly_name: "Car" } } } } as never;
  const r = new Replay(tl, { requested: ["device_tracker.car"], allowed: ["device_tracker.car"] });
  const hiddenAt = (s: number) => stateHiddenItems(b, r.hassAt(liveHass, (DAY + s) * 1000).states);
  assert.deepEqual(hiddenAt(100), []);
  assert.deepEqual(hiddenAt(4000), ["car"]);
  assert.deepEqual(hiddenAt(8000), []);
  assert.deepEqual(r.hassAt(liveHass, (DAY + 4000) * 1000).states["device_tracker.car"].attributes, {});
  // an interval item: out of its window at the replayed moment, whatever the clock says now
  const lamp = item({ id: "lamp", show_when: { intervals: [{ start: "18:00", end: "23:00" }] } });
  const c = emptyBuilding();
  c.floors.push(newFloor("ground", "Ground floor", 0));
  c.floors[0].furniture.push(lamp);
  assert.deepEqual(planHiddenItems(c, {}, at("2026-11-01T10:00")), ["lamp"]);
  assert.deepEqual(planHiddenItems(c, {}, at("2026-11-01T19:00")), []);
});
