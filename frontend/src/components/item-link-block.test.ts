// "Link a device" (#172): one link block directly under X / Z / rotation, pickers split by the domain they need, and
// the device name shown once.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import type { HomeAssistant } from "../types.ts";
import { entityOptionList } from "../entity-options.ts";
import { EntityPicker } from "./entity-picker.ts";
import { makeEditor, square } from "./editor-harness.ts";

/** Every string and value of a lit template, flattened into one text. */
function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return String(v);
}

const lamp: Furniture = { id: "lamp", type: "lamp_floor", x: 2, z: 2, rotation: 0, w: 0.4, d: 0.4, h: 1.5, variant: null, entity: null, color: "#ffffff", hologram: true } as unknown as Furniture;
const st = (id: string, name: string) => ({ entity_id: id, state: "on", attributes: { friendly_name: name } });

test("the link block sits right under the position fields, before the folds with the size, colours and the rest (#172, #397)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [lamp]);
  ed.hass = { states: { "light.lamp": st("light.lamp", "Lamp") }, entities: {}, devices: {}, areas: {}, user: { is_admin: true }, language: "en", locale: { language: "en" } };
  ed.selectItem("furniture", "lamp");
  const form = flat(ed.renderFurnitureForm(ed.furnitureItem));
  const head = form.indexOf("fp3d-item-pos");
  const block = form.indexOf("fp3d-link-block");
  assert.ok(head >= 0 && block > head, "the block follows Position");
  assert.match(form, /<h3 id="fp3d-main-h">Light<\/h3>/);
  // nothing of the long panel (the folds: size, colours, taps and visibility, more options) comes before it
  for (const later of ["fp3d-block-note", "fp3d-fold", "fp3d-actions"]) {
    const at = form.indexOf(later);
    if (at >= 0) assert.ok(at > block, `${later} comes after the link block`);
  }
  // exactly one block
  assert.equal(form.split("fp3d-link-block").length - 1, 1);
});

test("an item with nothing to link has no link block (#172)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [{ ...lamp, id: "t", type: "rug" } as Furniture]);
  ed.hass = { states: {}, entities: {}, devices: {}, areas: {}, user: { is_admin: true }, language: "en", locale: { language: "en" } };
  ed.selectItem("furniture", "t");
  const form = flat(ed.renderFurnitureForm(ed.furnitureItem));
  assert.doesNotMatch(form, /fp3d-link-block/);
});

test("a name that starts with the area's name is shown once: 'Lamp · Lounge', not 'Lounge Lamp · Lounge' (#172)", () => {
  const hass = {
    states: { "light.a": st("light.a", "Lounge Lamp"), "light.b": st("light.b", "Hall light") },
    entities: { "light.a": { entity_id: "light.a", area_id: "lounge" }, "light.b": { entity_id: "light.b", area_id: "lounge" } },
    devices: {},
    areas: { lounge: { area_id: "lounge", name: "Lounge" } },
  } as unknown as HomeAssistant;
  assert.deepEqual(entityOptionList(hass, () => true).map((o) => o.label), ["Hall light · Lounge", "Lamp · Lounge"]);
});

const OPTIONS = [
  { id: "climate.lounge", label: "Heating · Lounge", area: "lounge" },
  { id: "light.attic", label: "Attic light" },
  { id: "switch.lounge_plug", label: "Lounge plug", area: "lounge" },
  { id: "light.lounge", label: "Lounge lamp", area: "lounge" },
];

function picker(domains: string[], groups = true): Record<string, any> {
  const p = new EntityPicker() as unknown as Record<string, any>;
  p.options = OPTIONS;
  p.fixed = [{ id: "none", label: "None" }];
  p.value = "none";
  p.prefer = { area: "lounge", domains };
  p.groups = groups ? { likely: "Fits this link", other: "Other entities" } : null;
  return p;
}

test("a picker lists the entities of the link's domains first, under their own heading, the others after (#172)", () => {
  const p = picker(["switch", "light"]);
  p._open = true;
  // the plug leads (first domain) ... then the lights; the climate entity is under 'Other entities' even though it is in the room
  assert.deepEqual(
    p.hits.map((o: { id: string }) => o.id),
    ["none", "switch.lounge_plug", "light.lounge", "light.attic", "climate.lounge"],
  );
  const text = flat(p.render());
  assert.ok(text.indexOf("Fits this link") < text.indexOf("Lounge plug"));
  assert.ok(text.indexOf("Lounge lamp") < text.indexOf("Other entities"));
  assert.ok(text.indexOf("Other entities") < text.indexOf("Heating"));
  assert.equal(text.split("Fits this link").length - 1, 1);
});

test("no headings when every entity fits or the picker has no domain to go by (#172)", () => {
  const p = picker(["switch", "light", "climate"]);
  p._open = true;
  assert.doesNotMatch(flat(p.render()), /Fits this link|Other entities/);
  const q = picker([], true);
  q._open = true;
  assert.doesNotMatch(flat(q.render()), /Fits this link/);
  const r = picker(["light"], false);
  r._open = true;
  assert.doesNotMatch(flat(r.render()), /Fits this link/);
});
