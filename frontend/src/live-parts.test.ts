import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Group, MeshBasicMaterial } from "three";
import { BIND_KINDS, FAN_SLOT, hasLiveParts, isLiveItem, itemSlots, liveGroups, liveKey, packSpinAxis, SLOT_DOMAINS, SLOT_KINDS, slotDomains, slotEntity } from "./live-parts.ts";
import { bindValue, liveValues, spinValue } from "./live-values.ts";
import { buildIndex, filterEntries } from "./library-index.ts";
import { newFloor, type Floor, type Furniture } from "./model.ts";
import { setPacks, type FurniturePack, type PackItem } from "./packs.ts";
import { pushFurniture, pushPackLamp, pushPackLive } from "./viewer/furniture.ts";
import { GeoBuffer, LineBuffer } from "./viewer/geo.ts";
import { LiveParts, type LiveFloor } from "./viewer/live-view.ts";
import type { HassEntity } from "./types.ts";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes }) as unknown as HassEntity;

// the worked example of docs/packs.md ("Live parts"): a base unit with a door, a drawer and a status light
const DOCS = readFileSync(new URL("../../docs/packs.md", import.meta.url), "utf8");
const EXAMPLE = JSON.parse(/<!-- live-example -->\s*```json\n([\s\S]*?)```/.exec(DOCS)![1]) as PackItem;

const FAN: PackItem = {
  id: "fan",
  name: { en: "Fan" },
  size: [1.2, 1.2, 0.4],
  mount: "ceiling",
  electric: true,
  parts: [
    { shape: "cyl", x: 0, z: 0, w: 0.15, d: 0.15, y: 0.3, h: 0.7, color: "metal" },
    { shape: "box", x: 0.25, z: 0, w: 0.4, d: 0.1, y: 0.4, h: 0.04, color: "wood", spin: "y" },
    { shape: "box", x: -0.25, z: 0, w: 0.4, d: 0.1, y: 0.4, h: 0.04, color: "wood", spin: "y" },
  ],
};

function usePacks(): void {
  setPacks([{ id: "test.live", name: "Live", publisher: "Test", items: [EXAMPLE, FAN] } as unknown as FurniturePack]);
}

const placed = (type: string, extra: Partial<Furniture> = {}): Furniture => ({ id: type.split(":")[2], type, x: 1, z: 2, rotation: 0, w: 0.6, d: 0.6, h: 0.9, variant: null, entity: null, power: null, ...extra }) as Furniture;

test("the lists are the ones the backend checks (#466)", () => {
  const py = readFileSync(new URL("../../custom_components/home_3d/packs.py", import.meta.url), "utf8");
  const list = (name: string) => JSON.parse(py.match(new RegExp(`^${name} = (.*)$`, "m"))![1]);
  assert.deepEqual(BIND_KINDS, list("BIND_KINDS"));
  assert.deepEqual(SLOT_KINDS, list("SLOT_KINDS"));
  assert.deepEqual(Object.keys(SLOT_DOMAINS), [...SLOT_KINDS]);
});

test("the worked example groups its parts by slot: one model each", () => {
  const groups = liveGroups(EXAMPLE.parts);
  assert.deepEqual([...groups.values()].map((g) => g.bind.slot), ["drawer", "door", "status"]);
  // the drawer front and its handle move as one
  assert.equal(groups.get(liveKey({ slot: "drawer", kind: "slide" }))?.parts.length, 2);
  assert.equal(hasLiveParts(EXAMPLE), true);
  assert.equal(isLiveItem({ slots: EXAMPLE.slots }), true, "the library's index (no parts) knows it by its slots");
  assert.equal(isLiveItem({ parts: [{}] } as never), false);
  // fan blades are a group of their own, tied to the item's fan
  const fan = [...liveGroups(FAN.parts).values()];
  assert.equal(fan.length, 1);
  assert.deepEqual(fan[0].bind, { slot: FAN_SLOT, kind: "spin", axis: "y" });
  assert.equal(packSpinAxis(FAN), "y");
  assert.equal(packSpinAxis(EXAMPLE), null);
});

test("slot matching: an item's own entity fills its only slot only when the kind fits", () => {
  assert.equal(slotEntity(null, "door", 1, "binary_sensor.own"), "binary_sensor.own");
  assert.equal(slotEntity(null, "door", 2, "binary_sensor.own"), null, "several slots: each its own");
  assert.equal(slotEntity({ door: "binary_sensor.x" }, "door", 2, null), "binary_sensor.x");
  // an oven's power switch does not open its door: a contact slot takes contacts
  const contact = slotDomains({ id: "door", kind: "contact" });
  assert.equal(slotEntity(null, "door", 1, "switch.sample_oven", contact), null);
  assert.equal(slotEntity(null, "door", 1, "binary_sensor.sample_oven_door", contact), "binary_sensor.sample_oven_door");
  // "none" on purpose: not even the item's own
  assert.equal(slotEntity({ door: "none" }, "door", 1, "binary_sensor.own"), null);
  // a slot's own domains beat its kind's
  assert.deepEqual(slotDomains({ id: "s", kind: "status", domains: ["sensor"] }), ["sensor"]);
  assert.deepEqual(slotDomains({ id: "s" }), []);
  // an older recipe without slots still offers one picker per slot its parts name
  assert.deepEqual(itemSlots({ parts: [{ bind: { slot: "a", kind: "open" } }, { bind: { slot: "a", kind: "open" } }] }), [{ id: "a" }]);
});

test("values: a door with its contact, a cover with its position, a level with its percent, a status light", () => {
  assert.equal(bindValue("open", st("binary_sensor.door", "on")), 1);
  assert.equal(bindValue("open", st("binary_sensor.door", "off")), 0);
  assert.equal(bindValue("open", st("cover.flap", "open", { current_position: 40 })), 0.4);
  assert.equal(bindValue("level", st("sensor.fill", "37", { unit_of_measurement: "%" })), 0.37);
  assert.equal(bindValue("level", st("sensor.fill", "0.8")), 0.8);
  assert.equal(bindValue("spin", st("sensor.washer_power", "420", { unit_of_measurement: "W" })), 1);
  assert.equal(bindValue("spin", st("sensor.washer_power", "1.2", { unit_of_measurement: "W" })), 0);
  assert.equal(bindValue("open", undefined), 0);
  assert.equal(bindValue("blink", st("binary_sensor.server", "on")), 1);
  assert.equal(bindValue("blink", st("binary_sensor.server", "off")), 0);
  assert.equal(bindValue("blink", st("sensor.printer", "error")), -1);
  assert.equal(bindValue("blink", st("binary_sensor.nas", "unavailable")), -1);
  assert.equal(bindValue("blink", st("binary_sensor.problem", "on", { device_class: "problem" })), -1);
  // a leak under the sink is a fault too, a dry sensor is fine
  assert.equal(bindValue("blink", st("binary_sensor.leak", "on", { device_class: "moisture" })), -1);
  assert.equal(bindValue("blink", st("binary_sensor.leak", "off", { device_class: "moisture" })), 1);
});

test("spin: blades turn at the fan's speed, a switch at a middle pace, a light alone drives none (#1084)", () => {
  const states = { "fan.sample_bedroom": st("fan.sample_bedroom", "on", { percentage: 33 }), "switch.sample_fan": st("switch.sample_fan", "on"), "light.sample_fan_light": st("light.sample_fan_light", "on") };
  assert.equal(spinValue("fan.sample_bedroom", "light.sample_fan_light", states), 0.33);
  assert.equal(spinValue(null, "switch.sample_fan", states), 0.6);
  assert.equal(spinValue(null, "light.sample_fan_light", states), 0);
  assert.ok(Number.isNaN(spinValue(null, null, states)), "nothing linked: the blades stand as drawn");
  assert.equal(spinValue("fan.sample_off", null, {}), 0);
});

test("without an entity every live part stands as drawn; linked slots get their values", () => {
  usePacks();
  try {
    const floor: Floor = { ...newFloor("f", "Ground", 0), furniture: [placed("pack:test.live:base_unit_live"), placed("pack:test.live:fan", { fan: "fan.sample_bedroom" })] };
    const none = liveValues([floor], {}, () => null);
    assert.equal(none.size, 4);
    for (const [k, v] of none) if (!k.startsWith("fan|")) assert.ok(Number.isNaN(v), k);
    floor.furniture[0].binds = { door: "binary_sensor.sample_door", status: "sensor.sample_dishwasher" };
    const states = { "binary_sensor.sample_door": st("binary_sensor.sample_door", "on"), "sensor.sample_dishwasher": st("sensor.sample_dishwasher", "error"), "fan.sample_bedroom": st("fan.sample_bedroom", "on", { percentage: 50 }) };
    const v = liveValues([floor], states, () => null);
    assert.equal(v.get(`base_unit_live|${liveKey({ slot: "door", kind: "open", hinge: "left", amount: 100 })}`), 1);
    assert.equal(v.get(`base_unit_live|${liveKey({ slot: "status", kind: "blink" })}`), -1);
    assert.ok(Number.isNaN(v.get(`base_unit_live|${liveKey({ slot: "drawer", kind: "slide" })}`)!));
    assert.equal(v.get(`fan|${liveKey({ slot: FAN_SLOT, kind: "spin", axis: "y" })}`), 0.5);
    // a plan without live items costs one pass and nothing more
    assert.equal(liveValues([{ ...newFloor("g", "Up", 3), furniture: [placed("pack:test.none:chair")] }], states, () => null).size, 0);
  } finally {
    setPacks([]);
  }
});

test("the house model leaves live parts to the viewer; a picture keeps them", () => {
  usePacks();
  try {
    const count = (f: Furniture, still: boolean) => {
      const buf = new GeoBuffer();
      pushFurniture(buf, new LineBuffer(), new GeoBuffer(), f, 0, still);
      return buf.p.length;
    };
    const cab = placed("pack:test.live:base_unit_live");
    assert.ok(count(cab, true) > count(cab, false));
    // a pack lamp's fan blades too
    const lamp = (still: boolean) => {
      const buf = new GeoBuffer();
      pushPackLamp(buf, FAN, { x: 0, z: 0, rotation: 0, w: 1.2, d: 1.2, h: 0.4 }, 0, 0xffffff, still);
      return buf.p.length;
    };
    assert.ok(lamp(true) > lamp(false));
  } finally {
    setPacks([]);
  }
});

test("a live door turns about its hinge edge, takes the item's colours and keeps its edges; mirrored it hinges on the other side", () => {
  usePacks();
  try {
    const key = liveKey({ slot: "door", kind: "open", hinge: "left", amount: 100 });
    const door = (f: Furniture) => {
      const buf = new GeoBuffer();
      const lines = new LineBuffer();
      const made = pushPackLive(buf, lines, EXAMPLE, f, key)!;
      return { made, buf, lines };
    };
    const plain = door(placed("pack:test.live:base_unit_live"));
    // the left edge of the door, at the front
    assert.ok(plain.made.pivot[0] < -0.25 && plain.made.pivot[2] > 0.25, String(plain.made.pivot));
    assert.ok(plain.lines.p.length > 0, "a neon door keeps its outline when it opens");
    assert.equal(plain.made.lit, false);
    const green = door(placed("pack:test.live:base_unit_live", { colors: { white: "#2f6b4f" } }));
    assert.notDeepEqual(green.buf.c, plain.buf.c, "the fronts' own colour (#410) on the door too");
    const mirrored = door(placed("pack:test.live:base_unit_live", { mirror: true }));
    assert.ok(Math.abs(mirrored.made.pivot[0] + plain.made.pivot[0]) < 1e-9 && mirrored.made.mirrored);
    // a status light is drawn white for the viewer to tint, without edges; it knows its own colour
    const led = pushPackLive(new GeoBuffer(), new LineBuffer(), EXAMPLE, placed("pack:test.live:base_unit_live"), liveKey({ slot: "status", kind: "blink" }))!;
    assert.equal(led.lit, true);
    assert.equal(typeof led.rest, "number");
  } finally {
    setPacks([]);
  }
});

test("a live part is shaded by its height above the floor like the item drawn in place (#467: no darker fronts)", () => {
  usePacks();
  try {
    const cab = placed("pack:test.live:base_unit_live");
    for (const base of [0, 1.45]) {
      const main = new GeoBuffer();
      pushFurniture(main, new LineBuffer(), new GeoBuffer(), cab, base, true);
      const seen = new Set<string>();
      for (let i = 0; i + 2 < main.c.length; i += 3) seen.add(main.c.slice(i, i + 3).map((v) => v.toFixed(2)).join());
      for (const [key, group] of liveGroups(EXAMPLE.parts)) {
        if (group.bind.kind === "blink") continue;
        const buf = new GeoBuffer();
        pushPackLive(buf, new LineBuffer(), EXAMPLE, cab, key, base);
        for (let i = 0; i + 2 < buf.c.length; i += 3) {
          const rgb = buf.c.slice(i, i + 3).map((v) => v.toFixed(2)).join();
          assert.ok(seen.has(rgb), `${group.bind.slot} at ${base} m: ${rgb} is no colour of the item in place`);
        }
      }
    }
  } finally {
    setPacks([]);
  }
});

test("the viewer's live parts: as drawn without a value, swing open, then rest; fan blades turn", () => {
  usePacks();
  try {
    const floor: Floor = { ...newFloor("f", "Ground", 0), furniture: [placed("pack:test.live:base_unit_live"), placed("pack:test.live:fan")] };
    const fv: LiveFloor = { floor, group: new Group(), materials: { wall: new MeshBasicMaterial(), lines: new MeshBasicMaterial() } };
    const live = new LiveParts();
    live.sync([fv], "dark");
    assert.equal(live.size, 4);
    const floors = new Map([["f", fv]]);
    // nothing linked: nothing moves, nothing is drawn per frame
    assert.deepEqual(live.step(1000, floors, false, new Set()), { moving: false, turning: false });
    assert.equal(fv.group.children.length, 4);
    const doorKey = `base_unit_live|${liveKey({ slot: "door", kind: "open", hinge: "left", amount: 100 })}`;
    const fanKey = `fan|${liveKey({ slot: FAN_SLOT, kind: "spin", axis: "y" })}`;
    live.setValues(new Map([[doorKey, 1], [fanKey, 0.5]]));
    let t = 2000;
    let r = live.step(t, floors, false, new Set());
    assert.equal(r.moving, true, "linked: the door leaves its rest");
    assert.equal(r.turning, true);
    for (let i = 0; i < 20; i++) r = live.step((t += 100), floors, false, new Set());
    assert.equal(r.moving, false, "about a second later the door is open and stands");
    assert.equal(r.turning, true, "the blades keep turning while the fan runs");
    // the door's mesh is turned about its hinge (100 degrees, outwards)
    const turned = fv.group.children.map((g) => (g.children[0].children[0] as { rotation: { y: number } }).rotation.y);
    assert.ok(turned.some((y) => Math.abs(y + (100 * Math.PI) / 180) < 1e-6), String(turned));
    live.setValues(new Map());
    for (let i = 0; i < 3; i++) r = live.step((t += 100), floors, false, new Set());
    assert.deepEqual(r, { moving: false, turning: false }, "unlinked again: back as drawn, then still");
    // hidden with its item; a moved item is built again at its new place
    live.step((t += 100), floors, false, new Set(["base_unit_live"]));
    assert.equal(fv.group.children.filter((g) => !g.visible).length, 3);
    floor.furniture[0] = { ...floor.furniture[0], x: 3 };
    live.sync([fv], "dark");
    live.step((t += 100), floors, false, new Set());
    assert.ok(fv.group.children.some((g) => g.position.x === 3));
    floor.furniture = [];
    live.sync([fv], "dark");
    assert.equal(live.size, 0);
    assert.equal(fv.group.children.length, 0);
    live.dispose();
  } finally {
    setPacks([]);
  }
});

test("library: items with live parts carry ✨ and the Live chip shows only them", () => {
  const pack = { id: "test.live", name: "Live", publisher: "Test", items: [{ ...EXAMPLE, parts: undefined }, { id: "plain", name: { en: "Plain cabinet" }, size: [0.6, 0.6, 0.9] }] } as unknown as FurniturePack;
  const entries = buildIndex({ packs: [pack], basics: [], language: "en", basicName: (t) => t, basicNameEn: (t) => t, kindName: (k) => k, size: () => [1, 1, 1] });
  assert.deepEqual(entries.filter((e) => e.live).map((e) => e.type), ["pack:test.live:base_unit_live"]);
  const f = { query: "", room: null, electric: false, light: false, outdoor: false };
  assert.equal(filterEntries(entries, f).length, 2);
  assert.deepEqual(filterEntries(entries, { ...f, live: true }).map((e) => e.type), ["pack:test.live:base_unit_live"]);
});
