// #409 (CONS-1/2/3/6/8, WORD-8): one panel header and "⋯" menu for every side panel. Each panel shows the name as the
// heading, "kind · place", the same lock icon button and "⋯" with Delete in it; no Delete button row at the bottom, no
// "🔓 Fix", and the roof and solar forms go back by the small crumb row.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture, Opening, OutdoorArea, Pet, RoofSection, SolarField } from "../model.ts";
import { panelUi } from "./editor/item-sections.ts";
import { sentenceCase, stateChip } from "./editor/panel-head.ts";
import { makeEditor, square, type TestEditor } from "./editor-harness.ts";

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return typeof v === "object" ? "" : String(v);
}

const sofa = { id: "s", type: "sofa", x: 1, z: 1, rotation: 0, w: 2, d: 0.9, h: 0.8, variant: null } as Furniture;
const door = { id: "d", room_id: "r", edge: 0, offset: 2, width: 0.9, type: "door", sill: 0, height: 2.05, hinge: "left", leaves: 1, swing: "in", cover: null, contact: null, contact2: null, tilt: null } as Opening;
const lawn = { id: "l", type: "lawn", points: [[6, 0], [9, 0], [9, 3], [6, 3]] } as unknown as OutdoorArea;
const section = { id: "rs", x0: 0, x1: 4, z0: 0, z1: 4, axis: "x", shape: "gable", eave_a: 2.6, eave_b: 2.6, pitch_a: 35, pitch_b: 35, base: 2.6 } as unknown as RoofSection;
const field = { id: "sf", face: "main:b", u: 0.5, v: 0.5, rows: 2, cols: 2, portrait: true } as SolarField;
const cat = { id: "cat", kind: "cat", name: "Tom", spots: [], triggers: [] } as unknown as Pet;

async function editor(): Promise<TestEditor> {
  const ed = await makeEditor([{ ...square("r", 0, 0, 5, 4), name: "Lounge" }], [sofa]);
  const floor = ed._doc.floors[0];
  floor.openings = [door];
  floor.walls = [{ id: "w", a: [0, 6], b: [3, 6] }];
  floor.outdoor = [lawn];
  floor.placements = [{ entity_id: "sensor.temp", x: 2, z: 2, y: null }];
  ed._doc.settings.roof = { ...ed._doc.settings.roof, type: "custom", sections: [section], solar: [field], windows: [{ id: "rw", face: "main:b", u: 1, v: 1 }] } as never;
  ed._doc.settings.pets = { on: true, list: [cat] } as never;
  ed.hass = { ...ed.hass, states: { "sensor.temp": { entity_id: "sensor.temp", state: "21.5", attributes: { unit_of_measurement: "°C", friendly_name: "Hall temperature" } } } };
  return ed;
}

/** Each panel: how to open it, the id its header's menu goes by, and the panel's text. */
const PANELS: [string, string, (ed: TestEditor) => void][] = [
  ["item", "s", (ed) => ed.selectItem("furniture", "s")],
  ["room", "room:r", (ed) => ed.selectItem("room", "r")],
  ["door", "opening:d", (ed) => ed.selectItem("opening", "d")],
  ["free wall", "wall:w", (ed) => ed.selectItem("wall", "w")],
  ["lawn", "outdoor:l", (ed) => ed.selectItem("outdoor", "l")],
  ["device pin", "device:sensor.temp", (ed) => ed.selectItem("device", "sensor.temp")],
  ["pet", "pet:cat", (ed) => ed.selectPet("cat")],
  ["floor", "floor:f", (ed) => ed.selectItem("room", null)],
  [
    "roof section",
    "roof:rs",
    (ed) => {
      ed.setTool("roof");
      ed._roofId = "rs";
    },
  ],
  [
    "roof window",
    "roof-window:rw",
    (ed) => {
      ed.setTool("roof");
      ed._roofWinId = "rw";
    },
  ],
  [
    "solar field",
    "solar:sf",
    (ed) => {
      ed.setTool("energy");
      ed._solarId = "sf";
    },
  ],
];

for (const [name, id, open] of PANELS) {
  test(`the ${name} panel has the shared header with its lock and "⋯", and Delete only in "⋯" (#409)`, async () => {
    const ed = await editor();
    open(ed);
    const side = flat(ed.renderSide(ed.floor));
    assert.equal((side.match(/fp3d-panel-head/g) ?? []).length, 1, "one shared header");
    assert.match(side, /class="fp3d-item-head fp3d-panel-head[^"]*"[^>]*>\s*<div class="fp3d-item-title">\s*<h2>/, "the name is the heading");
    assert.match(side, /aria-label=More actions/, "the ⋯ menu");
    if (name !== "pet") assert.match(side, /class="fp3d-btn fp3d-fix fp3d-icon-btn" aria-pressed=(true|false) aria-label=(Lock position|Lock floor plan)/, "the lock icon button");
    for (const old of ["🔓", "🔒", ">Fix<", "Release", "fp3d-h3row\"><h3>", "fp3d-btn fp3d-danger"]) assert.ok(!side.includes(old), `${name}: no ${old}`);
    assert.doesNotMatch(side, />\s*(Delete|Remove)\s*<\/button>/, "no Delete button in the form");
    // the menu opened: Delete (or Delete floor) is there, named
    panelUi(ed, id).menu = true;
    const menu = flat(ed.renderSide(ed.floor));
    assert.match(menu, /role="menuitem" class=fp3d-ctx-danger[^>]*><span>Delete( floor)?<\/span>/, `${name}: Delete in ⋯`);
  });
}

test("the actions that were button rows are in ⋯ by name: room, roof section, solar field, floor, device pin (#409, CONS-2/8)", async () => {
  const ed = await editor();
  const menuOf = (id: string) => {
    panelUi(ed, id).menu = true;
    const side = flat(ed.renderSide(ed.floor));
    return [...side.matchAll(/role="menuitem"[^>]*><span>([^<]+)<\/span>/g)].map((m) => m[1]);
  };
  ed.selectItem("room", "r");
  assert.deepEqual(menuOf("room:r").filter((x) => ["Furnish …", "Place spots", "Duplicate", "Delete"].includes(x)), ["Furnish …", "Place spots", "Duplicate", "Delete"]);
  ed.setTool("roof");
  ed._roofId = "rs";
  const roof = menuOf("roof:rs");
  for (const label of ["Swap sides", "Duplicate", "Delete"]) assert.ok(roof.includes(label), label);
  assert.ok(roof.some((x) => x.startsWith("+ Dormer")), "a dormer");
  ed.setTool("select");
  ed.selectItem("room", null);
  const floor = menuOf("floor:f");
  for (const label of ["Move up", "Move down", "Delete floor"]) assert.ok(floor.includes(label), label);
  ed.selectItem("device", "sensor.temp");
  const pin = menuOf("device:sensor.temp");
  assert.ok(pin.includes("To room centre") && pin.includes("Delete") && !pin.includes("Remove"));
});

test("the roof and solar forms go back by the crumb row, not a full-width button (#409, CONS-6)", async () => {
  const ed = await editor();
  ed.setTool("roof");
  ed._roofId = "rs";
  const back = ed.sideBack();
  assert.equal(back?.name, "Roof sections");
  assert.doesNotMatch(flat(ed.renderSide(ed.floor)), /fp3d-btn fp3d-back/);
  assert.match(flat(ed.renderPinRow()), /fp3d-crumb[^>]*aria-label=Back to Roof sections[^>]*>‹ Roof sections/);
  back!.go();
  assert.equal(ed._roofId, null);
  ed.setTool("energy");
  ed._solarId = "sf";
  assert.equal(ed.sideBack()?.name, "Solar fields");
  ed.narrow = true;
  assert.match(flat(ed.renderSide(ed.floor)), /fp3d-crumb[^>]*>‹ Solar fields/, "on a phone the crumb comes with the panel");
});

test("state chips use Home Assistant's translated state in sentence case (#409, WORD-8)", () => {
  assert.equal(sentenceCase("online"), "Online");
  assert.equal(sentenceCase("78 %"), "78 %");
  assert.equal(sentenceCase("ätzend", "de"), "Ätzend");
  const st = { entity_id: "sensor.printer_state", state: "printing", attributes: {} };
  assert.equal(stateChip({ formatEntityState: () => "printing" } as never, st as never), "Printing", "HA's own text, sentence case");
  assert.equal(stateChip({ states: {}, language: "en" } as never, st as never), "Printing", "without HA's formatter: the state, sentence case");
});

test("the pet panel's name is the shared header, not a caps heading in the pet element (#409)", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("./pet-panel.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /<h3>🐾/);
});
