// Demo mode (#100): a sample or demo home (`settings.demo`) looks alive on a Home Assistant that lacks its devices.
// Every entity the plan links that this Home Assistant does not have (or reports unavailable) gets a FIXED state
// chosen by what the item is and which link it is (a light, a thermostat, the inverter's power, the battery's
// charge ...): some lights on, heating on, solar producing, the battery charging, power flowing. Nothing is
// simulated and nothing changes over time; a real entity always wins, so linking real devices replaces the demo
// one by one. The entity ids themselves do not matter (the shipped sample uses generic placeholders).

import { modulesOf } from "./energy.ts";
import type { Building, Furniture } from "./model.ts";
import { energyRole, isThermostatItem } from "./packs.ts";
import type { HassEntity, HomeAssistant } from "./types.ts";

/** The fixed demo balance (W): what the panels make, what the battery takes, what the house uses. */
export const DEMO_POWER = { solar: 3600, batteryCharge: 1200, house: 2000 } as const;
/** Other fixed demo values: battery charge (%), room and target temperature (°C), tariff (per kWh), car battery (%). */
export const DEMO_VALUES = { soc: 72, room: 20.5, target: 21, tariff: 0.245, car: 78 } as const;

const linked = (v: string | null | undefined): v is string => !!v && v !== "none" && v.includes(".");
const domainOf = (id: string) => id.slice(0, id.indexOf("."));

/** Watts a powered item draws in the demo, by what its type id names (built-in and pack ids alike). */
const LOADS: [RegExp, number][] = [
  [/hob|oven|cooker|kettle/, 1500],
  [/wallbox|charger|zappi/, 1400],
  [/washing|washer|dishwasher/, 450],
  [/fridge|freezer|kitchen_tall/, 110],
  [/tv|monitor|screen/, 95],
  [/pc|computer|desk/, 120],
  [/boiler|heat_pump/, 90],
  [/router|network/, 15],
];
const loadOf = (type: string) => LOADS.find(([re]) => re.test(type))?.[1] ?? 60;

const POWER = { device_class: "power", unit_of_measurement: "W", state_class: "measurement" };
const PERCENT_BATTERY = { device_class: "battery", unit_of_measurement: "%" };
const TEMPERATURE = { device_class: "temperature", unit_of_measurement: "°C" };

function friendly(id: string): string {
  const name = id.slice(id.indexOf(".") + 1).replace(/_/g, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Collects the demo states of one plan; the first role an entity gets wins. */
class DemoStates {
  readonly out = new Map<string, HassEntity>();
  private lights = 0;
  private media = 0;

  put(id: string, state: string | number, attributes: Record<string, unknown> = {}): void {
    if (this.out.has(id)) return;
    this.out.set(id, { entity_id: id, state: String(state), attributes: { friendly_name: friendly(id), ...attributes } });
  }

  watts(id: string, w: number): void {
    this.put(id, Math.round(w), POWER);
  }

  /** A main link (`entity`, a state link, a placed device) by its domain, the item telling what kind of thing it is. */
  main(id: string, type: string | null): void {
    const kind = type ?? "";
    switch (domainOf(id)) {
      case "light": {
        // every third light rests: some lights on, not all
        const on = this.lights++ % 3 !== 2;
        this.put(id, on ? "on" : "off", { supported_color_modes: ["color_temp"], ...(on ? { brightness: 200, color_mode: "color_temp", color_temp_kelvin: 2700 } : {}) });
        return;
      }
      case "climate":
      case "water_heater":
        this.put(id, "heat", { hvac_modes: ["off", "heat"], hvac_action: "heating", current_temperature: DEMO_VALUES.room, temperature: DEMO_VALUES.target, min_temp: 5, max_temp: 30 });
        return;
      case "media_player": {
        // a TV shows something, the first other player plays, the rest wait
        const tv = /tv/.test(kind);
        const playing = tv || this.media++ === 0;
        this.put(id, playing ? "playing" : "idle", { device_class: tv ? "tv" : "speaker", ...(playing ? { media_title: "Demo", volume_level: 0.3 } : {}) });
        return;
      }
      case "switch":
      case "input_boolean":
      case "fan":
        this.put(id, "on");
        return;
      case "binary_sensor":
        // alarms and leak sensors stay calm
        this.put(id, "off", /smoke/.test(kind) ? { device_class: "smoke" } : /water|leak/.test(kind) ? { device_class: "moisture" } : {});
        return;
      case "cover":
        this.put(id, "open", { current_position: 100 });
        return;
      case "lock":
        this.put(id, "locked");
        return;
      case "camera":
        this.put(id, "idle");
        return;
      case "vacuum":
        this.put(id, "docked");
        return;
      case "sensor":
        this.sensor(id, kind);
        return;
      // people, trackers and the rest: no made-up state
    }
  }

  /** A sensor whose role the link does not tell: by what the item is or what its id says. */
  private sensor(id: string, type: string): void {
    if (/power|_w$/.test(id)) this.watts(id, loadOf(type || id));
    else if (/temp/.test(id) || (type && isThermostatItem(type))) this.put(id, DEMO_VALUES.room, TEMPERATURE);
    else if (/humid/.test(id)) this.put(id, 50, { device_class: "humidity", unit_of_measurement: "%" });
    else if (/battery|soc|level/.test(id) || /car|leaf|vehicle/.test(type)) this.put(id, DEMO_VALUES.car, PERCENT_BATTERY);
    else this.put(id, "ok");
  }

  /** The power sensors of a meter, an inverter or a battery (signs as the plan reads them). */
  energy(f: Furniture, w: { grid: number; battery: number; solar: number }, b: Building): void {
    const role = energyRole(f.type);
    if (role === "meter") {
      // a meter with its own export sensor: the power sensor is the import only
      if (linked(f.export)) {
        this.watts(f.export, Math.max(0, -w.grid));
        if (linked(f.power)) this.watts(f.power, Math.max(0, w.grid));
      } else if (linked(f.power)) this.watts(f.power, b.energy.grid_invert ? -w.grid : w.grid);
    } else if (role === "inverter" || role === "solar") {
      if (linked(f.power)) this.watts(f.power, w.solar);
    } else if (role === "home_battery") {
      // a battery with a separate charging sensor: nothing out, the charge in
      if (linked(f.charge)) {
        this.watts(f.charge, -w.battery);
        if (linked(f.power)) this.watts(f.power, 0);
      } else if (linked(f.power)) this.watts(f.power, b.energy.battery_invert ? -w.battery : w.battery);
    }
  }
}

const cache = new WeakMap<Building, Map<string, HassEntity>>();

/** The fixed demo states of a plan's linked entities by entity id, whether Home Assistant has them or not (memoised per plan). */
export function demoStates(b: Building): Map<string, HassEntity> {
  const hit = cache.get(b);
  if (hit) return hit;
  const d = new DemoStates();
  const e = b.energy;
  const furniture = b.floors.flatMap((f) => f.furniture);
  const hasBattery = linked(e.battery) || furniture.some((f) => energyRole(f.type) === "home_battery" && (linked(f.power) || linked(f.charge)));
  const battery = hasBattery ? -DEMO_POWER.batteryCharge : 0;
  // grid + solar + battery = house: what is left over goes out to the grid
  const grid = DEMO_POWER.house - DEMO_POWER.solar - battery;

  // the balance sensors of the plan's energy settings first
  if (linked(e.grid)) d.watts(e.grid, e.grid_invert ? -grid : grid);
  if (linked(e.solar)) d.watts(e.solar, DEMO_POWER.solar);
  if (linked(e.battery)) d.watts(e.battery, e.battery_invert ? -battery : battery);
  if (linked(e.battery_soc)) d.put(e.battery_soc, DEMO_VALUES.soc, PERCENT_BATTERY);
  if (linked(e.consumption)) d.watts(e.consumption, DEMO_POWER.house);
  if (linked(e.tariff)) d.put(e.tariff, DEMO_VALUES.tariff, { unit_of_measurement: "GBP/kWh" });

  // the energy devices: several inverters share the solar power
  const inverters = furniture.filter((f) => (energyRole(f.type) === "inverter" || energyRole(f.type) === "solar") && linked(f.power)).length;
  for (const f of furniture) d.energy(f, { grid, battery, solar: DEMO_POWER.solar / Math.max(1, inverters) }, b);

  // the roof's solar fields: the panels' power by their number of modules
  const fields = (b.settings.roof?.solar ?? []).filter((s) => linked(s.entity));
  const modules = fields.reduce((n, s) => n + modulesOf(s), 0) || 1;
  for (const s of fields) d.watts(s.entity!, (DEMO_POWER.solar * modulesOf(s)) / modules);

  // everything else the items link
  for (const f of furniture) {
    if (linked(f.entity)) d.main(f.entity, f.type);
    if (linked(f.power)) d.watts(f.power, loadOf(f.type));
    for (const id of [f.state_entity, f.state_entity2, f.extra]) if (linked(id)) d.main(id, f.type);
    if (linked(f.heat_sensor)) d.put(f.heat_sensor, "on", { device_class: "heat" });
    if (linked(f.soc)) d.put(f.soc, DEMO_VALUES.soc, PERCENT_BATTERY);
    if (linked(f.room_sensor)) d.put(f.room_sensor, DEMO_VALUES.room, TEMPERATURE);
  }
  // devices placed straight from Home Assistant
  for (const floor of b.floors) for (const p of floor.placements) if (linked(p.entity_id)) d.main(p.entity_id, null);
  cache.set(b, d.out);
  return d.out;
}

const made = new WeakMap<HomeAssistant, { building: Building; out: HomeAssistant }>();
const shown = new WeakMap<HomeAssistant, Map<string, HassEntity>>();

/** Whether the viewer shows the demo's own state for an entity (not a real one). */
export function isDemoState(hass: HomeAssistant, id: string): boolean {
  const demo = shown.get(hass);
  return !!demo && hass.states[id] === demo.get(id);
}

/** Whether a hass shows any demo state (the viewer can say so). */
export function showsDemo(hass: HomeAssistant | null | undefined): boolean {
  return !!hass && shown.has(hass);
}

/**
 * Home Assistant as the viewer of `building` should see it: the live object for an ordinary home; for a demo home
 * the live states plus a fixed demo state for every linked entity that is missing or unavailable. Service calls
 * that only aim at demo entities do nothing (there is nothing to switch); the rest reach Home Assistant.
 */
export function withDemo(hass: HomeAssistant, building: Building | null | undefined): HomeAssistant {
  if (!building?.settings?.demo) return hass;
  // one demo hass per live update and plan: the panel asks on every render, the viewer compares the object
  const last = made.get(hass);
  if (last?.building === building) return last.out;
  const demo = demoStates(building);
  let states = hass.states;
  for (const [id, st] of demo) {
    const live = hass.states[id];
    if (live && live.state !== "unavailable" && live.state !== "unknown") continue;
    if (states === hass.states) states = { ...hass.states };
    states[id] = st;
  }
  let out = hass;
  if (states !== hass.states) {
    out = { ...hass, states };
    out.callService = (domain, service, data) => (onlyDemo(out, data) ? Promise.resolve(undefined) : hass.callService(domain, service, data));
    shown.set(out, demo);
  }
  made.set(hass, { building, out });
  return out;
}

function onlyDemo(hass: HomeAssistant, data: Record<string, unknown> | undefined): boolean {
  const target = data?.entity_id;
  const ids = typeof target === "string" ? [target] : Array.isArray(target) ? target.filter((v): v is string => typeof v === "string") : [];
  return ids.length > 0 && ids.every((id) => isDemoState(hass, id));
}
