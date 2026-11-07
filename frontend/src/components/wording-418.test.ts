// Outdoor, roof, solar and energy wording and layout (#418, WORD-9, MANY-7, A11Y-3): plain words instead of signs and
// axes, "Falls towards" as four arrows, and the energy panel as three folds (Solar, Devices, Cables) of 44 px rows.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { newFloor, type Furniture } from "../model.ts";
import { lateEnglish } from "../i18n-late.ts";
import { setSideFold } from "./editor/item-sections.ts";
import { makeEditor, square } from "./editor-harness.ts";

/** Every string and value of a lit template, flattened into one text. */
function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return typeof v === "object" ? "" : String(v);
}

const item = (id: string, type: string, extra: Partial<Furniture> = {}): Furniture => ({ id, type, x: 1, z: 1, rotation: 0, w: 0.5, d: 0.3, h: 0.6, variant: null, ...extra }) as Furniture;
const SIGNS = /\(\s*[+−-][XZ]\s*\)|[+−]\s?=/;

test("no English label or German text uses sign or axis jargon: no '+X', '− =' or '+ =' (#418, WORD-9)", () => {
  const core = readFileSync(new URL("../i18n.ts", import.meta.url), "utf8");
  for (const [k, v] of Object.entries(lateEnglish)) assert.doesNotMatch(v, SIGNS, k);
  for (const line of core.split("\n").filter((l) => /^ {2}\w+: "/.test(l))) assert.doesNotMatch(line.replace(/Ctrl\+\w/g, ""), SIGNS, line);
  const de = JSON.parse(readFileSync(new URL("../../../custom_components/home_3d/bundled_languages/amluto.lang-de/strings.json", import.meta.url), "utf8")) as Record<string, string>;
  for (const k of ["outdoor_offset", "slope_x", "slope_nx", "slope_z", "slope_nz", "energy_grid", "energy_battery_sensor", "holo_right"]) assert.doesNotMatch(de[k], SIGNS, k);
  assert.equal(lateEnglish.outdoor_offset, "Raise or lower (m)");
  // the sign is a choice of its own next to the sensor since #423
  assert.equal(lateEnglish.energy_battery_sign_discharge, "Discharging shows as positive");
});

test("'Falls towards' is four named arrow buttons, the chosen one pressed (#418)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)]);
  let picked = "";
  const out = flat(ed.renderSlopeDir("x", true, (d: string) => (picked = d)));
  assert.match(out, /role="group" aria-label=Falls towards/);
  assert.equal(out.match(/<button/g)?.length, 4);
  for (const [cls, name] of [["right", "the right"], ["left", "the left"], ["up", "the top of the plan"], ["down", "the bottom of the plan"]]) {
    assert.match(out, new RegExp(`fp3d-arrow-${cls}" aria-pressed=${cls === "right" ? "true" : "false"}`), cls);
    assert.ok(out.includes(`Falls towards ${name}`), name);
  }
  assert.doesNotMatch(out, /<select/);
  assert.equal(picked, "");
});

test("the energy panel is three folds with counts; Floor shown sits in the Devices fold (#418, MANY-7)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [item("inv", "inverter"), item("bat", "home_battery")]);
  ed._doc.floors.push({ ...newFloor("up", "Upstairs", 3) });
  ed.hass = { ...ed.hass, entities: {}, devices: {} };
  ed._tool = "energy";
  const out = flat(ed.renderEnergyPanel());
  assert.match(out, /data-fold=energy-solar/);
  assert.match(out, /Solar fields \(0\)/);
  assert.match(out, /data-fold=energy-devices/);
  assert.match(out, /Devices \(2\)/);
  // Devices starts closed; Floor shown no longer stands above the solar fields
  assert.doesNotMatch(out, /Floor shown/);
  setSideFold(ed, "energy-devices", true);
  const open = flat(ed.renderEnergyPanel());
  assert.ok(open.indexOf("Floor shown") > open.indexOf("data-fold=energy-devices"), "Floor shown inside the Devices fold");
  // one line of help each, the long one behind "i"
  assert.ok(open.includes(lateEnglish.energy_devices_hint_short));
  assert.ok(!open.includes(lateEnglish.energy_devices_hint));
  assert.ok(open.includes(lateEnglish.solar_hint_short) || open.includes(lateEnglish.solar_no_roof));
});

test("energy device rows are 44 px buttons with a chevron and a selected style (#418, A11Y-3)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [item("inv", "inverter")]);
  ed.hass = { ...ed.hass, entities: {}, devices: {} };
  setSideFold(ed, "energy-devices", true);
  const out = flat(ed.renderEnergyDevices());
  assert.match(out, /class="fp3d-pick-row" aria-current=/);
  assert.match(out, /fp3d-fold-chev/);
  assert.match(flat(ed.pickRow("A", "B", true, () => undefined)), /aria-current=true/);
  const css = readFileSync(new URL("./editor/styles/forms.ts", import.meta.url), "utf8");
  assert.match(css, /\.fp3d-pick-row \{[^}]*min-height: 44px/);
  assert.match(css, /\.fp3d-pick-row\[aria-current="true"\]/);
});
