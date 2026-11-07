import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor, square, type TestEditor } from "./editor-harness.ts";
import type { RoofSection, SolarField } from "../model.ts";

const section = (id: string, x0: number): RoofSection => ({ id, x0, x1: x0 + 3, z0: 0, z1: 3, type: "gable" }) as unknown as RoofSection;
const field = (id: string): SolarField => ({ id, face: "main:b", u: 0.5, v: 0.5, rows: 2, cols: 2, portrait: true });

/** One room, a roof with two sections and a solar field; the room is the one the owner drew last. */
async function editor(): Promise<TestEditor> {
  const el = await makeEditor([square("r", 0, 0, 4, 3)]);
  el._doc.settings.roof = { ...el._doc.settings.roof, type: "custom", sections: [section("s1", 0), section("s2", 5)], solar: [field("f1")] } as never;
  el._roomId = "r";
  return el;
}

const rooms = (el: TestEditor) => el._doc.floors[0].rooms.length;
const sections = (el: TestEditor) => (el._doc.settings.roof.sections ?? []).map((s: RoofSection) => s.id);
const settle = () => new Promise((r) => setTimeout(r, 0));

test("Delete in the roof tool removes the selected roof section and leaves the room alone (#158)", async () => {
  const el = await editor();
  el.setTool("roof");
  el._roofId = "s1";
  el.key("Delete");
  await settle();
  assert.deepEqual(sections(el), ["s2"]);
  assert.equal(rooms(el), 1);
});

test("Delete in the roof tool with nothing chosen deletes nothing, not the last room (#158)", async () => {
  const el = await editor();
  el.setTool("roof");
  el.key("Delete");
  el.key("Backspace");
  await settle();
  assert.equal(rooms(el), 1);
  assert.deepEqual(sections(el), ["s1", "s2"]);
});

test("Delete in the energy tool removes the selected solar field only (#158)", async () => {
  const el = await editor();
  el.setTool("energy");
  el._solarId = "f1";
  el.key("Delete");
  await settle();
  assert.equal((el._doc.settings.roof.solar ?? []).length, 0);
  assert.equal(rooms(el), 1);
});

test("Delete in the roof tool removes the selected roof window (#158)", async () => {
  const el = await editor();
  el._doc.settings.roof.windows = [{ id: "w1", face: "main:b", u: 1, v: 1 }] as never;
  el.setTool("roof");
  el._roofWinId = "w1";
  el.key("Delete");
  await settle();
  assert.equal((el._doc.settings.roof.windows ?? []).length, 0);
  assert.equal(rooms(el), 1);
});

test("a stale roof section chosen in the roof tool is let go of when the tool changes, so Delete cannot reach it (#158)", async () => {
  const el = await editor();
  el.setTool("roof");
  el._roofId = "s1";
  el.setTool("select");
  assert.equal(el._roofId, null);
  el.key("Delete");
  await settle();
  assert.deepEqual(sections(el), ["s1", "s2"]);
});

test("changing tool clears the item selection of the last tool (#158)", async () => {
  const el = await editor();
  el._openingId = "o";
  el._furnitureId = "x";
  el._multi = ["x", "y"];
  el._vertex = 1;
  el.setTool("rect");
  assert.equal(el._openingId, null);
  assert.equal(el._furnitureId, null);
  assert.deepEqual(el._multi, []);
  assert.equal(el._vertex, null);
  // the room stays, so the furniture and door tools still know where to put things
  assert.equal(el._roomId, "r");
});

test("the roof and energy tools do not carry a selected room, so Delete there cannot take it (#158)", async () => {
  const el = await editor();
  el.setTool("energy");
  assert.equal(el._roomId, null);
});

test("Delete in the select tool still deletes the selected room (#158)", async () => {
  const el = await editor();
  el.setTool("select");
  el._roomId = "r";
  el.key("Delete");
  await settle();
  assert.equal(rooms(el), 0);
});

test("Delete in a drawing tool with nothing chosen there does not delete the room (#158)", async () => {
  const el = await editor();
  el.setTool("rect");
  el.key("Delete");
  await settle();
  assert.equal(rooms(el), 1);
});
