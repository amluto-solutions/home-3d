// A small demo home for the demo mode tests (#100): a ground floor with generic placeholder entity ids
// (`light.sample_lounge` style) on the kinds of devices the shipped sample home links. No real house data.

import { emptyBuilding, newFloor, type Building, type Furniture, type Room } from "./model.ts";

const rect = (id: string, x0: number, z0: number, x1: number, z1: number): Room => ({ id, name: id, area_id: null, points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], floor_material: "wood" });

let n = 0;
const item = (type: string, x: number, z: number, links: Partial<Furniture> = {}): Furniture => ({ id: `f${++n}`, type, x, z, rotation: 0, w: 0.5, d: 0.5, h: 0.5, variant: null, ...links });

/** The demo home; `demo` false gives the same plan as an ordinary home. */
export function demoHome(demo = true): Building {
  n = 0;
  const b = emptyBuilding();
  const floor = { ...newFloor("g", "Ground", 0), rooms: [rect("lounge", 0, 0, 5, 4), rect("kitchen", 5, 0, 9, 4), rect("hall", 0, 4, 9, 6)] };
  floor.furniture = [
    item("lamp_ceiling", 2.5, 2, { entity: "light.sample_lounge" }),
    item("lamp_ceiling", 7, 2, { entity: "light.sample_kitchen" }),
    item("lamp_ceiling", 4, 5, { entity: "light.sample_hall" }),
    item("lamp_floor", 1, 1, { entity: "light.sample_lounge_floor" }),
    item("radiator", 0.3, 2, { entity: "climate.sample_lounge_trv", state_entity: "sensor.sample_lounge_temperature" }),
    item("tv_wall", 2.5, 0.2, { entity: "media_player.sample_tv" }),
    item("meter", 8.7, 5.5, { power: "sensor.sample_grid_power" }),
    item("inverter", 8.7, 4.5, { power: "sensor.sample_pv_power" }),
    item("home_battery", 8.2, 4.5, { power: "sensor.sample_battery_power", soc: "sensor.sample_battery_soc", entity: "switch.sample_battery" }),
    item("wallbox", 9, 5, { entity: "input_boolean.sample_car_charging" }),
    item("fridge", 6, 0.5, { power: "sensor.sample_fridge_power" }),
  ];
  b.floors = [floor];
  b.settings.roof = { ...(b.settings.roof ?? {}), solar: [{ id: "pv1", face: "main:a", u: 0.5, v: 0.5, rows: 2, cols: 5, entity: "sensor.sample_roof_south_power" } as never] } as never;
  if (demo) b.settings.demo = true;
  return b;
}
