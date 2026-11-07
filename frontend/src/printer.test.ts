// A 3D printer from a pack (#11): a progress ring while it prints, its chamber light, its camera on a tap.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { isPrinter, printerFaces, printerState } from "./printer.ts";
import type { HomeAssistant } from "./types.ts";
import type { PackItem } from "./packs.ts";

const BUNDLED = fileURLToPath(new URL("../../custom_components/home_3d/bundled_packs", import.meta.url));
const MAKERS = `${BUNDLED}/amluto.makers`;

test("amluto.makers has a 3D printer that links to a device and has a chamber light", () => {
  const item = JSON.parse(readFileSync(`${MAKERS}/tech/3d_printer.json`, "utf8")) as PackItem;
  assert.equal(item.name.en, "3D printer");
  assert.ok(item.electric, "links to the printer's entities");
  assert.ok(item.parts.some((p) => p.glow), "a chamber light part");
  assert.ok(isPrinter("pack:amluto.makers:3d_printer"));
});

test("printers in the makers pack get the live state too, not only the first one (#109)", () => {
  const files = readdirSync(MAKERS, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".json") && f !== "pack.json");
  const printers = files.map((f) => JSON.parse(readFileSync(`${MAKERS}/${f}`, "utf8")) as PackItem).filter((i) => i.id.includes("3d_printer"));
  assert.ok(printers.length >= 1, "the makers pack has a printer");
  for (const item of printers) {
    const type = `pack:amluto.makers:${item.id}`;
    assert.ok(isPrinter(type), type);
    assert.ok(item.electric, `${item.id} links to the printer's entities`);
    // the open-frame mini has no chamber to light
    if (!item.id.endsWith("_mini")) assert.ok(item.parts.some((p) => p.glow), `${item.id} has a chamber light part`);
    // linked to a Bambu-style device, the item's type shows the ring and the chamber light
    const faces = printerFaces(printerState(bambu("running", "42", "on"), "sensor.workshop_printer_print_status"));
    assert.deepEqual(faces.map((f) => f.part).sort(), ["chamber", "progress"]);
  }
});

test("a printer is told by its item id, in any pack", () => {
  assert.ok(isPrinter("pack:someone.tools:3d_printer_enclosed"));
  assert.ok(isPrinter("pack:someone.tools:resin_3d_printer"));
  assert.equal(isPrinter("pack:someone.tools:printer"), false);
  assert.equal(isPrinter("3d_printer"), false, "no built-in type");
});

/** A Home Assistant with one device's entities: [entity id, state, attributes, friendly name?]. */
function hassOf(entities: [string, string, Record<string, unknown>?][], device = "dev1"): HomeAssistant {
  const states: Record<string, unknown> = {};
  const registry: Record<string, unknown> = {};
  for (const [id, state, attributes] of entities) {
    states[id] = { entity_id: id, state, attributes: attributes ?? {}, last_changed: "", last_updated: "", context: { id: "", user_id: null, parent_id: null } };
    registry[id] = { entity_id: id, device_id: device };
  }
  return { language: "en", states, entities: registry, devices: { [device]: { id: device } }, areas: {} } as unknown as HomeAssistant;
}

// a printer as the Bambu Lab integration reports it
const bambu = (status: string, progress: string, light = "on") =>
  hassOf([
    ["sensor.workshop_printer_print_status", status, { device_class: "enum" }],
    ["sensor.workshop_printer_print_progress", progress, { unit_of_measurement: "%" }],
    ["sensor.workshop_printer_nozzle_temperature", "220", { unit_of_measurement: "°C", device_class: "temperature" }],
    ["sensor.workshop_printer_aux_fan", "60", { unit_of_measurement: "%" }],
    ["light.workshop_printer_chamber_light", light, { brightness: 255, color_mode: "onoff" }],
    ["camera.workshop_printer_camera", "idle", {}],
  ]);

test("while it prints, the progress fills a ring", () => {
  const s = printerState(bambu("running", "42"), "sensor.workshop_printer_print_status");
  assert.equal(s.printing, true);
  assert.equal(s.progress, 0.42);
});

test("an idle or finished printer shows no ring, whatever its last progress", () => {
  assert.equal(printerState(bambu("idle", "100"), "sensor.workshop_printer_print_status").printing, false);
  assert.equal(printerState(bambu("finish", "100"), "sensor.workshop_printer_print_status").printing, false);
  // the progress before the status sensor reports (unavailable): no ring either
  assert.equal(printerState(bambu("running", "unavailable"), "sensor.workshop_printer_print_status").progress, null);
});

test("the chamber light follows the printer's light entity", () => {
  const on = printerState(bambu("idle", "0", "on"), "sensor.workshop_printer_print_status");
  assert.deepEqual(on.light, { color: [1, 0.71, 0.28], level: 1 });
  assert.equal(printerState(bambu("idle", "0", "off"), "sensor.workshop_printer_print_status").light, null);
});

test("the printer's camera is found on its device; none without one", () => {
  assert.equal(printerState(bambu("running", "5"), "sensor.workshop_printer_print_status").camera, "camera.workshop_printer_camera");
  const prusa = hassOf([
    ["sensor.mk4", "printing", { device_class: "enum" }],
    ["sensor.mk4_progress", "7", { unit_of_measurement: "%" }],
  ]);
  const s = printerState(prusa, "sensor.mk4");
  assert.equal(s.camera, null);
  assert.equal(s.light, null);
  assert.equal(s.progress, 0.07);
});

test("a printer that reports printing as a binary sensor (OctoPrint), linked through any of its entities", () => {
  const octo = hassOf([
    ["binary_sensor.octoprint_printing", "on", {}],
    ["sensor.octoprint_job_percentage", "63.5", { unit_of_measurement: "%" }],
    ["sensor.octoprint_current_state", "Printing", {}],
    ["camera.octoprint_camera", "idle", {}],
  ]);
  for (const linked of ["binary_sensor.octoprint_printing", "sensor.octoprint_job_percentage", "camera.octoprint_camera"]) {
    const s = printerState(octo, linked);
    assert.equal(s.printing, true, linked);
    assert.equal(s.progress, 0.635, linked);
  }
});

test("a paused print keeps its ring; nothing linked shows nothing", () => {
  assert.equal(printerState(bambu("pause", "30"), "sensor.workshop_printer_print_status").progress, 0.3);
  assert.deepEqual(printerState(bambu("running", "30"), null), { printing: false, progress: null, light: null, camera: null });
});

test("in 3D: a ring filled to the progress while it prints, the chamber glowing while its light is on", () => {
  const faces = printerFaces(printerState(bambu("running", "42", "on"), "sensor.workshop_printer_print_status"));
  assert.deepEqual(faces.map((f) => f.part).sort(), ["chamber", "progress"]);
  assert.equal(faces.find((f) => f.part === "progress")!.fill, 0.42);
  assert.deepEqual(printerFaces(printerState(bambu("idle", "100", "off"), "sensor.workshop_printer_print_status")), []);
  // printing without a progress sensor: an empty ring still says it prints
  const noProgress = printerFaces({ printing: true, progress: null, light: null, camera: null });
  assert.equal(noProgress[0].fill, 0);
});
