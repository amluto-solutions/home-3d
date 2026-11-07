// The empty home's checklist (#193): three steps, two shortcuts, the plan at full width, gone with the first room.

import assert from "node:assert/strict";
import { test } from "node:test";
import { startChecklist, startsFullWidth } from "../start-checklist.ts";
import { emptyBuilding, newFloor } from "../model.ts";
import { makeEditor, square } from "./editor-harness.ts";

function text(v: unknown): string {
  if (v == null || typeof v === "boolean" || typeof v === "symbol") return "";
  if (typeof v === "function") return "<fn>";
  if (Array.isArray(v)) return v.map(text).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? text(t.values[i]) : "")).join("");
  }
  return typeof v === "object" ? "" : String(v);
}

const handlersOf = (v: unknown): (() => void)[] =>
  Array.isArray(v) ? v.flatMap(handlersOf) : typeof v === "function" ? [v as () => void] : v && typeof v === "object" && "values" in (v as object) ? (v as { values: unknown[] }).values.flatMap(handlersOf) : [];

test("the checklist knows its steps and shows only while no floor has a room (#193)", () => {
  const none = emptyBuilding();
  assert.deepEqual(startChecklist(none).steps.map((s) => s.done), [false, false, false]);
  assert.equal(startChecklist(none).show, true);
  none.floors = [newFloor("f", "F", 0)];
  assert.deepEqual(startChecklist(none).steps.map((s) => [s.step, s.done]), [["floor", true], ["room", false], ["furniture", false]]);
  assert.equal(startChecklist(none).show, true);
  none.floors[0].rooms = [square("r", 0, 0, 4, 3)];
  assert.equal(startChecklist(none).show, false);
});

test("an empty home starts with the plan at full width, a home with rooms keeps the stored choice (#193)", () => {
  const empty = emptyBuilding();
  assert.equal(startsFullWidth(empty, true), true);
  assert.equal(startsFullWidth(empty, false), false);
  const house = emptyBuilding();
  house.floors = [{ ...newFloor("f", "F", 0), rooms: [square("r", 0, 0, 4, 3)] }];
  assert.equal(startsFullWidth(house, true), false);
});

test("the editor closes 3D beside for an empty home once, and leaves the stored choice alone (#193)", async () => {
  const ed = await makeEditor([]);
  ed.refreshLibUpdates = () => undefined;
  ed._split = true;
  ed.building = ed._doc;
  ed._doc = null;
  ed.willUpdate(new Map([["building", null]]));
  assert.equal(ed._split, false);
  // the person opens it again: later plan changes do not close it
  ed._split = true;
  ed.building = structuredClone(ed.building);
  ed.willUpdate(new Map([["building", null]]));
  assert.equal(ed._split, true);
  // a home with rooms: untouched
  const house = await makeEditor([square("r", 0, 0, 4, 3)]);
  house.refreshLibUpdates = () => undefined;
  house._split = true;
  house.building = house._doc;
  house._doc = null;
  house.willUpdate(new Map([["building", null]]));
  assert.equal(house._split, true);
});

test("an empty floor shows the checklist instead of the hint pill, with the floor step done (#193)", async () => {
  const ed = await makeEditor([]);
  const out = text(ed.renderHint());
  assert.ok(out.includes("fp3d-start"), out);
  assert.ok(!out.includes("fp3d-hint "), "no hint pill beside it");
  for (const s of ["Start your home", "Add a floor", "Draw your first room", "Add furniture from the library", "Draw a room", "Load the sample home"]) assert.ok(out.includes(s), s);
  assert.ok(out.includes("Done"), "the floor step is ticked");
  assert.ok(!out.includes("Add rooms from Home Assistant areas"), "no areas to add");
});

test("a home with no floor offers the floor first; Draw a room adds one and picks the rectangle (#193)", async () => {
  const ed = await makeEditor([]);
  ed._doc = { ...ed._doc, floors: [] };
  ed._floorId = null;
  const out = text(ed.renderHint());
  assert.ok(out.includes("Add floor"));
  assert.ok(!out.includes("Done"));
  // the room button: no floor yet -> one is added, then the rectangle tool is armed
  const handlers = handlersOf(ed.renderStart());
  handlers[1]();
  assert.equal(ed._doc.floors.length, 1);
  assert.equal(ed._tool, "rect");
});

test("the first room ends the checklist: the hint pill is back (#193)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 3)]);
  const out = text(ed.renderHint());
  assert.ok(!out.includes("fp3d-start"));
  assert.ok(out.includes("fp3d-hint"));
});

test("the checklist waits while a tool is in use, and never shows to someone who cannot edit (#193)", async () => {
  const ed = await makeEditor([]);
  ed.setTool("rect");
  assert.equal(ed.renderStart(), null);
  ed.setTool("select");
  assert.notEqual(ed.renderStart(), null);
  ed.canEdit = false;
  assert.equal(ed.renderStart(), null);
});

test("Add rooms from Home Assistant areas fills the empty floor with the first HA floor's areas (#193)", async () => {
  const ed = await makeEditor([]);
  ed.hass = {
    ...ed.hass,
    floors: { ground: { floor_id: "ground", name: "Ground", level: 0 } },
    areas: { a1: { area_id: "a1", name: "Lounge", floor_id: "ground" }, a2: { area_id: "a2", name: "Kitchen", floor_id: "ground" } },
  };
  assert.ok(text(ed.renderStart()).includes("Add rooms from Home Assistant areas"));
  ed.startAreas();
  const floors = ed._doc.floors;
  assert.equal(floors.length, 1, "the empty floor became the HA floor");
  assert.equal(floors[0].ha_floor, "ground");
  assert.deepEqual(floors[0].rooms.map((r: { area_id: string }) => r.area_id).sort(), ["a1", "a2"]);
  assert.equal(ed.renderStart(), null, "rooms exist: the checklist is gone");
});

test("Load the sample home asks the panel through an event (#193)", async () => {
  const ed = await makeEditor([]);
  let asked = 0;
  ed.addEventListener("load-sample", () => asked++);
  const handlers = handlersOf(ed.renderStart());
  assert.ok(handlers.length >= 2);
  for (const h of handlers) h();
  assert.equal(asked, 1);
});
