// Copy and paste of outdoor areas (#400): alone, with items in a multi selection, at the pointer, on another floor
// and in another home (another editor on the page), each paste one undo step.

import assert from "node:assert/strict";
import { test } from "node:test";
import { copyItems, pasteClip, clipSize } from "../clipboard.ts";
import { emptyBuilding, newFloor, type Floor, type OutdoorArea } from "../model.ts";
import { makeEditor, planEl, square } from "./editor-harness.ts";

const lawn = (): OutdoorArea => ({ id: "lawn", type: "lawn", points: [[6, 0], [10, 0], [10, 3], [6, 3]], area_id: "garden", name: "Back garden" });
const path = (): OutdoorArea => ({ id: "path", type: "path", points: [[6, 4], [10, 4], [10, 4.6], [6, 4.6]] });
const pool = (): OutdoorArea => ({
  id: "pool",
  type: "pool",
  points: [[12, 0], [16, 0], [16, 3], [12, 3]],
  pool: { temperature: "sensor.sample_pool_temp", ports: [{ id: "sk", kind: "skimmer", x: 12, z: 1 }], pipes: [{ id: "p1", from: "port:sk", to: "", floor_id: "f", points: [] }], joints: [] },
});
const sofa = { id: "sofa", type: "sofa", x: 2, z: 2, rotation: 0, w: 2, d: 1, h: 0.8, variant: null } as never;

async function editor(areas: OutdoorArea[] = [lawn(), path()]) {
  const el = await makeEditor([square("lounge", 0, 0, 5, 4)], [sofa]);
  el._doc.floors[0].outdoor = areas;
  el.renderRoot.activeElement = null;
  return el;
}
const outdoor = (el: Awaited<ReturnType<typeof editor>>, floor = 0) => el._doc.floors[floor].outdoor as OutdoorArea[];

test("Ctrl+C on an outdoor area and Ctrl+V paste a copy a step off, chosen, with a new id and no HA area; one undo takes it away (#400)", async () => {
  const el = await editor();
  el.selectItem("outdoor", "lawn");
  assert.equal(el.copySelection(), true);
  assert.equal(el.pasteClipboard(), true);
  const list = outdoor(el);
  assert.equal(list.length, 3);
  const copy = list[2];
  assert.notEqual(copy.id, "lawn");
  assert.equal(copy.area_id, null, "no Home Assistant area, as a duplicated room (#186)");
  assert.equal(copy.type, "lawn");
  assert.deepEqual(copy.points[0], [6.3, 0.3]);
  assert.equal(el._outdoorId, copy.id, "the copy is chosen");
  el.undo();
  assert.deepEqual(outdoor(el).map((a) => a.id), ["lawn", "path"]);
});

test("the clipboard keys work for an outdoor area: Ctrl+V with the pointer on the plan centres the copy there, on the grid (#400)", async () => {
  const el = await editor();
  el.selectItem("outdoor", "path");
  el.onKey({ key: "c", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, composedPath: () => [], preventDefault() {} });
  el.planPointer = [20.01, 10.02];
  let prevented = false;
  el.onKey({ key: "v", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, composedPath: () => [], preventDefault: () => (prevented = true) });
  assert.equal(prevented, true);
  const copy = outdoor(el).at(-1)!;
  const xs = copy.points.map((p) => p[0]);
  const zs = copy.points.map((p) => p[1]);
  assert.deepEqual([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2], [20, 10]);
});

test("an item and an outdoor area chosen together (Shift + click) copy, paste and undo together (#400)", async () => {
  const el = await editor();
  el.selectItem("furniture", "sofa");
  el.press(800, 150, { shiftKey: true, target: planEl({ "data-outdoor": "lawn" }) });
  assert.equal(el._furnitureId, "sofa");
  assert.deepEqual(el._multiOut, ["lawn"]);
  assert.deepEqual(el.areaSelection(), ["lawn"]);
  el.copySelection();
  el.pasteClipboard();
  const floor = el._doc.floors[0] as Floor;
  assert.equal(floor.furniture.length, 2);
  assert.equal(floor.outdoor.length, 3);
  const [item, area] = [floor.furniture[1], floor.outdoor[2]];
  assert.equal(el._furnitureId, item.id, "the pasted item is chosen");
  assert.deepEqual(el._multiOut, [area.id], "with the pasted area");
  assert.deepEqual([item.x, item.z], [2.3, 2.3]);
  el.undo();
  assert.equal(el._doc.floors[0].furniture.length, 1);
  assert.equal(el._doc.floors[0].outdoor.length, 2);
});

test("several areas: a second Shift + click adds one, again takes it out; a plain click chooses one alone (#400)", async () => {
  const el = await editor();
  el.selectItem("outdoor", "lawn");
  el.press(800, 430, { shiftKey: true, target: planEl({ "data-outdoor": "path" }) });
  assert.deepEqual(el._multiOut, ["lawn", "path"]);
  el.press(800, 430, { shiftKey: true, target: planEl({ "data-outdoor": "path" }) });
  assert.deepEqual(el.areaSelection(), ["lawn"]);
  assert.deepEqual(el._multiOut, []);
  el.selectItem("outdoor", "path");
  assert.deepEqual(el.areaSelection(), ["path"]);
});

test("a drag of one of the chosen areas moves the whole selection, items too, in one undo step (#400)", async () => {
  const el = await editor();
  el.selectItem("furniture", "sofa");
  el.toggleAreaMulti("lawn");
  el.press(800, 150, { target: planEl({ "data-outdoor": "lawn" }) });
  el.move(900, 250);
  el.release(900, 250);
  const floor = el._doc.floors[0] as Floor;
  assert.deepEqual([floor.furniture[0].x, floor.furniture[0].z], [3, 3]);
  assert.deepEqual(floor.outdoor[0].points[0], [7, 1]);
  assert.deepEqual(floor.outdoor[1].points[0], [6, 4], "an area not chosen stays");
  el.undo();
  assert.deepEqual(el._doc.floors[0].outdoor[0].points[0], [6, 0]);
  assert.equal(el._doc.floors[0].furniture[0].x, 2);
});

test("a frame drawn around an area and an item chooses both; an area only half inside stays out (#400)", async () => {
  const el = await editor();
  el._multiMode = true;
  el.press(150, -50);
  el.move(1050, 380);
  el.release(1050, 380);
  assert.equal(el._furnitureId, "sofa");
  assert.deepEqual(el._multiOut, ["lawn"]);
});

test("Delete on a mixed selection removes the items and the areas after one question, in one undo step (#400)", async () => {
  const el = await editor();
  el.selectItem("furniture", "sofa");
  el.toggleAreaMulti("lawn");
  el.ask = async () => true;
  await el.deleteMixed();
  assert.equal(el._doc.floors[0].furniture.length, 0);
  assert.deepEqual(outdoor(el).map((a) => a.id), ["path"]);
  el.undo();
  assert.equal(el._doc.floors[0].furniture.length, 1);
  assert.equal(outdoor(el).length, 2);
});

test("an area copied downstairs pastes upstairs right above, and into another home's editor (#400)", async () => {
  const el = await editor();
  el._doc.floors.push({ ...newFloor("u", "First", 2.7) });
  el.selectItem("outdoor", "lawn");
  el.copySelection();
  el.selectFloor("u");
  el.pasteClipboard();
  assert.deepEqual(outdoor(el, 1)[0].points[0], [6, 0], "above the original");
  // another home: another editor element on the page shares the clipboard
  const other = await makeEditor([], []);
  other._doc = emptyBuilding();
  other._doc.floors = [newFloor("x", "Ground", 0)];
  other._floorId = "x";
  assert.equal(other.pasteClipboard(), true);
  assert.equal(other._doc.floors[0].outdoor.length, 1);
  assert.equal(other._doc.floors[0].outdoor[0].area_id, null);
});

test("a pasted pool keeps its entities and ports (moved with it, new ids), not its pipes and T-pieces (#400)", () => {
  const floor = { ...newFloor("f", "F", 0), outdoor: [pool()] };
  const clip = copyItems(floor, [], ["pool"])!;
  assert.equal(clipSize(clip), 1);
  let n = 0;
  const { items, areas } = pasteClip(clip, "f", (p) => `${p}_${++n}`);
  assert.equal(items.length, 0);
  const [copy] = areas;
  assert.equal(copy.pool?.temperature, "sensor.sample_pool_temp");
  assert.equal(copy.pool?.pipes, undefined);
  assert.equal(copy.pool?.joints, undefined);
  assert.equal(copy.pool?.ports?.[0].x, 12.3);
  assert.notEqual(copy.pool?.ports?.[0].id, "sk");
  assert.equal(floor.outdoor[0].pool?.pipes?.length, 1, "the original keeps its pipes");
});

test("the floating toolbar and the right-click menu of an outdoor area offer Duplicate and Copy (#400)", async () => {
  const el = await editor();
  const keys = el.itemActions("outdoor", "lawn").map((a: { key: string }) => a.key);
  assert.ok(keys.includes("duplicate") && keys.includes("copy"), keys.join());
});

test("a paste out of view is brought into view (#400)", async () => {
  const el = await editor();
  el.selectItem("outdoor", "lawn");
  el.copySelection();
  el._view = { scale: 100, ox: -3000, oy: 0 };
  el.pasteClipboard();
  const copy = outdoor(el).at(-1)!;
  const [x0, y0] = el.toScreen(copy.points[0]);
  const [x1, y1] = el.toScreen(copy.points[2]);
  assert.ok(x0 >= 0 && y0 >= 0 && x1 <= el._size.w && y1 <= el._size.h, `${x0},${y0} ${x1},${y1}`);
});
