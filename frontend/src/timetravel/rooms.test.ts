import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor } from "../model.ts";
import type { HomeAssistant } from "../types.ts";
import { lampSwitches, roomEntities } from "./rooms.ts";

// A relay behind the ceiling light and a plug under a sofa: the switch of a lamp counts as the room's light (#484).
function house() {
  const b = emptyBuilding();
  const f = newFloor("f", "Ground", 0);
  f.rooms.push({ id: "r", name: "Lounge", area_id: null, points: [[0, 0], [5, 0], [5, 4], [0, 4]], floor_material: "wood" } as never);
  f.furniture.push({ id: "ceil", type: "lamp_ceiling", x: 2, z: 2, rotation: 0, w: 0.4, d: 0.4, h: 0.1, variant: null } as never);
  f.furniture.push({ id: "sofa", type: "sofa", x: 3, z: 3, rotation: 0, w: 2, d: 1, h: 0.8, variant: null } as never);
  b.floors.push(f);
  const st = (entity_id: string) => ({ entity_id, state: "on", attributes: {} });
  const hass = {
    entities: {},
    states: { "switch.sample_relay": st("switch.sample_relay"), "switch.sample_plug": st("switch.sample_plug") },
  } as unknown as HomeAssistant;
  const link = (entity: string) => ({ entity, power: null, energy: null }) as never;
  const spec = { openings: [], furniture: [["ceil", link("switch.sample_relay")], ["sofa", link("switch.sample_plug")]] } as never;
  return { b, hass, spec };
}

test("switches that drive a lamp of the plan are lights; other switches are not (#484)", () => {
  const { b, hass, spec } = house();
  assert.deepEqual([...lampSwitches(b, spec)], ["switch.sample_relay"]);
  const [room] = roomEntities(hass, b, spec);
  assert.deepEqual(room!.lights, ["switch.sample_relay"]);
  assert.deepEqual(room!.all.sort(), ["switch.sample_plug", "switch.sample_relay"]);
});
