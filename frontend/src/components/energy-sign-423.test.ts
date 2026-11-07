// The battery and grid sensors' sign is a plain choice next to the sensor (#423): "Discharging shows as positive"
// (the default) or "Charging shows as positive", stored in the plan's optional `battery_invert` (grid: `grid_invert`).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Building, type Furniture } from "../model.ts";
import { deviceSensors, energySummary } from "../energy.ts";
import { lateEnglish } from "../i18n-late.ts";
import type { HassEntity, HomeAssistant } from "../types.ts";
import { SIGN_CHOICES } from "./editor/energy.ts";
import { resetFolds } from "./editor/item-sections.ts";
import { makeEditor, square } from "./editor-harness.ts";

interface Tpl {
  strings: readonly string[];
  values: unknown[];
}
const isTpl = (v: unknown): v is Tpl => !!v && typeof v === "object" && "strings" in (v as object);

/** Every string and value of a lit template, flattened into one text. */
function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (isTpl(v)) return v.strings.map((s, i) => s + (i < v.values.length ? flat(v.values[i]) : "")).join("");
  return typeof v === "object" ? "" : String(v);
}

/** The templates in `v` (depth first) whose own strings contain `marker`. */
function templates(v: unknown, marker: string, out: Tpl[] = []): Tpl[] {
  if (Array.isArray(v)) for (const x of v) templates(x, marker, out);
  else if (isTpl(v)) {
    if (v.strings.join("").includes(marker)) out.push(v);
    for (const x of v.values) templates(x, marker, out);
  }
  return out;
}

/** A sign choice's state: which kind, which option is selected, and its change handler. */
function signChoices(v: unknown) {
  return templates(v, "data-sign=").map((t) => {
    const at = (s: string) => t.values[t.strings.findIndex((x) => x.includes(s))];
    const sel = t.values.filter((x) => typeof x === "boolean") as boolean[];
    const change = t.values.find((x) => typeof x === "function") as (ev: Event) => void;
    return {
      kind: at("data-sign=") as string,
      text: flat(t),
      flipped: sel[sel.length - 1],
      pick: (value: "normal" | "flipped") => change({ target: { value } } as unknown as Event),
    };
  });
}

const item = (id: string, type: string, extra: Partial<Furniture> = {}): Furniture => ({ id, type, x: 1, z: 1, rotation: 0, w: 0.5, d: 0.3, h: 0.6, variant: null, ...extra }) as Furniture;
const st = (id: string, state: string, unit = "W"): HassEntity => ({ entity_id: id, state, attributes: { unit_of_measurement: unit } }) as HassEntity;
const hassOf = (...states: HassEntity[]) =>
  ({ states: Object.fromEntries(states.map((s) => [s.entity_id, s])), entities: {}, devices: {}, areas: {}, user: { is_admin: true }, language: "en", locale: { language: "en" } }) as unknown as HomeAssistant;

test("the labels are plain sentences: the sensor names its unit, the choice says which way it counts (#423)", () => {
  assert.equal(lateEnglish.energy_battery_sensor, "Battery power sensor (W)");
  assert.equal(lateEnglish.energy_grid, "Grid power (W)");
  assert.deepEqual(SIGN_CHOICES.battery.map((k) => lateEnglish[k]), ["Discharging shows as positive", "Charging shows as positive"]);
  assert.deepEqual(SIGN_CHOICES.grid.map((k) => lateEnglish[k]), ["Import shows as positive", "Export shows as positive"]);
  const de = JSON.parse(readFileSync(new URL("../../../custom_components/home_3d/bundled_languages/amluto.lang-de/strings.json", import.meta.url), "utf8")) as Record<string, string>;
  for (const k of ["energy_battery_sign", "energy_grid_sign", ...SIGN_CHOICES.battery, ...SIGN_CHOICES.grid]) assert.ok(de[k], k);
  assert.equal(de.energy_battery_sign_charge, "Laden ist positiv");
});

test("the energy balance offers the battery and grid sign as a choice and stores battery_invert / grid_invert (#423)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)]);
  ed.hass = hassOf();
  // an old plan without the keys reads as today's default
  delete (ed._doc.energy as Partial<Building["energy"]>).battery_invert;
  const choices = signChoices(ed.renderEnergyBalance());
  const battery = choices.find((c) => c.kind === "battery")!;
  const grid = choices.find((c) => c.kind === "grid")!;
  assert.ok(battery && grid, "both choices shown");
  assert.match(battery.text, /Battery sensor sign[\s\S]*Discharging shows as positive[\s\S]*Charging shows as positive/);
  assert.match(grid.text, /Grid sensor sign[\s\S]*Import shows as positive[\s\S]*Export shows as positive/);
  assert.equal(battery.flipped, false, "absent: discharging shows as positive");
  assert.doesNotMatch(flat(ed.renderEnergyBalance()), /Invert sign|type="checkbox" \.checked=/);
  battery.pick("flipped");
  assert.equal(ed._doc.energy.battery_invert, true);
  assert.equal(signChoices(ed.renderEnergyBalance()).find((c) => c.kind === "battery")!.flipped, true);
  grid.pick("flipped");
  assert.equal(ed._doc.energy.grid_invert, true);
  signChoices(ed.renderEnergyBalance()).find((c) => c.kind === "battery")!.pick("normal");
  assert.equal(ed._doc.energy.battery_invert, false);
});

test("each further setup has its own battery and grid sign choice (#423)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)]);
  ed.hass = hassOf();
  ed._doc.energy.systems = [{ id: "s2", name: "", inverter: null, grid: null, grid_invert: false, solar: null, battery: null, battery_invert: false, battery_soc: null }];
  const choices = signChoices(ed.renderEnergySystems([], []));
  assert.deepEqual(choices.map((c) => c.kind), ["grid", "battery"]);
  choices[1].pick("flipped");
  assert.equal(ed._doc.energy.systems![0].battery_invert, true);
  assert.equal(ed._doc.energy.battery_invert, false, "the main battery keeps its sign");
});

test("the home battery's item form shows the same choice, unless it has a separate charging sensor (#423)", async () => {
  resetFolds();
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [item("bat", "home_battery")]);
  ed.hass = hassOf();
  ed.selectItem("furniture", "bat");
  const [choice] = signChoices(ed.renderFurnitureForm(ed.furnitureItem));
  assert.equal(choice?.kind, "battery");
  choice.pick("flipped");
  assert.equal(ed._doc.energy.battery_invert, true);
  ed._doc.floors[0].furniture[0].charge = "sensor.battery_charge";
  assert.deepEqual(signChoices(ed.renderFurnitureForm(ed.furnitureItem)), [], "two one-way sensors: no sign to choose");
});

test("'Charging shows as positive' turns the reading round for the balance sensor and a placed battery alike (#423)", () => {
  const b = emptyBuilding();
  b.floors.push(newFloor("f", "Ground floor", 0));
  b.energy.battery = "sensor.battery_power";
  const h = hassOf(st("sensor.battery_power", "3.4", "kW"));
  // absent key (an old plan): positive = discharging, as before
  delete (b.energy as Partial<Building["energy"]>).battery_invert;
  assert.equal(energySummary(h, b, []).battery, 3400);
  b.energy.battery_invert = true;
  assert.equal(energySummary(h, b, []).battery, -3400, "charging at 3.4 kW");
  // no balance sensor: the placed battery's own power sensor follows the same choice
  b.energy.battery = null;
  b.floors[0].furniture.push(item("bat", "home_battery", { power: "sensor.battery_power" }));
  assert.equal(energySummary(h, b, [], deviceSensors(b)).battery, -3400);
  b.energy.battery_invert = false;
  assert.equal(energySummary(h, b, [], deviceSensors(b)).battery, 3400);
});
