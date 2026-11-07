import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { furnitureSize } from "../packs.ts";
import { makeEditor, planEl, square } from "./editor-harness.ts";

const settle = () => new Promise((r) => setTimeout(r, 0));
const rooms = () => [square("r1", 0, 0, 3, 3), square("r2", 3, 0, 6, 3)];

test("choosing a library card arms it; a click on the plan places it there (#76)", async () => {
  const ed = await makeEditor(rooms());
  ed._tool = "furniture";
  ed.addFurniture("armchair");
  await settle();
  assert.equal(ed._doc.floors[0].furniture.length, 0, "nothing placed yet");
  assert.equal(ed._placing?.type, "armchair");
  // press inside room r2 at (4.5 m, 1.5 m)
  ed.press(450, 150, { target: planEl({ "data-room": "r2" }) });
  ed.release(450, 150);
  await settle();
  const [f] = ed._doc.floors[0].furniture as Furniture[];
  assert.equal(f?.type, "armchair");
  assert.deepEqual([f.x, f.z], [4.5, 1.5]);
  assert.equal(ed._furnitureId, f.id, "the new item is selected");
  assert.equal(ed._roomId, "r2", "in the room it was placed in");
  assert.equal(ed._placing, null, "one placement per pick");
  assert.equal(ed.drag?.kind ?? null, null, "the room did not start a drag");
});

test("the click snaps to the grid, Alt places freely (#76)", async () => {
  const ed = await makeEditor(rooms());
  ed._doc.settings.grid = 0.1;
  ed.addFurniture("armchair");
  ed.press(123, 187);
  await settle();
  ed.addFurniture("armchair");
  ed.press(123, 187, { altKey: true });
  await settle();
  const [a, b] = ed._doc.floors[0].furniture as Furniture[];
  assert.deepEqual([a.x, a.z], [1.2, 1.9]);
  assert.deepEqual([b.x, b.z], [1.23, 1.87]);
});

test("Ctrl keeps the card armed for the next click (#76, Shift now turns snapping off #173)", async () => {
  const ed = await makeEditor(rooms());
  ed.addFurniture("chair");
  ed.press(100, 100, { ctrlKey: true });
  ed.release(100, 100, { ctrlKey: true });
  ed.press(200, 100, { ctrlKey: true });
  await settle();
  assert.equal(ed._doc.floors[0].furniture.length, 2);
  assert.equal(ed._placing?.type, "chair");
});

test("Escape or another tool cancels an armed card (#76)", async () => {
  const ed = await makeEditor(rooms());
  ed.addFurniture("chair");
  ed.key("Escape");
  assert.equal(ed._placing, null);
  ed.addFurniture("chair");
  ed.setTool("rect");
  assert.equal(ed._placing, null);
});

test("'Place in the middle' places an armed card the old way, in the selected room (#76)", async () => {
  const ed = await makeEditor(rooms());
  ed.selectItem("room", "r1");
  ed.addFurniture("chair");
  ed.placeArmedInMiddle();
  await settle();
  const [f] = ed._doc.floors[0].furniture as Furniture[];
  assert.deepEqual([f.x, f.z], [1.5, 1.5]);
  assert.equal(ed._placing, null);
});

test("switching floor or home disarms the card and the hint goes back (#126)", async () => {
  const ed = await makeEditor(rooms());
  ed._doc.floors.push({ ...ed._doc.floors[0], id: "g", name: "G", rooms: [], furniture: [] });
  ed.home = "h1";
  ed.willUpdate(new Map([["home", undefined]]));
  ed.addFurniture("chair");
  assert.match(ed.hintText(), /Click the plan to place/);
  // the floor menu (Lit runs willUpdate with the old floor id)
  ed.selectFloor("g");
  ed.willUpdate(new Map([["_floorId", "f"]]));
  assert.equal(ed._placing, null);
  assert.equal(ed._placeAt, null);
  assert.doesNotMatch(ed.hintText(), /Click the plan to place/);
  // the next click on the new floor places nothing
  ed.press(100, 100);
  await settle();
  assert.equal(ed._doc.floors.find((f: { id: string }) => f.id === "g").furniture.length, 0);
  // another home
  ed.addFurniture("chair");
  ed.home = "h2";
  ed.willUpdate(new Map([["home", "h1"]]));
  assert.equal(ed._placing, null);
  // an edit from elsewhere on the same floor and home keeps it armed
  ed.addFurniture("chair");
  ed.willUpdate(new Map([["_doc", ed._doc]]));
  assert.equal((ed._placing as { type: string } | null)?.type, "chair");
});

// Placement preview and wall snap (#173). 100 px per metre. Wall tests use one room r1 (0..3 by 0..3) so no neighbour
// shares a wall line; the room-from-the-pointer test uses r1 and r2 side by side.
const alone = () => [square("r1", 0, 0, 3, 3)];
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };

test("a placed item snaps its back to the nearest wall, turned to it (#173)", async () => {
  store.clear();
  const ed = await makeEditor(alone());
  const [, d] = furnitureSize("armchair");
  ed.addFurniture("armchair");
  // 0.3 m from the top wall of r1: back to the wall, flush
  ed.press(150, 30);
  await settle();
  const [top] = ed._doc.floors[0].furniture as Furniture[];
  assert.equal(top.rotation, 0);
  assert.equal(top.z, Math.round((d / 2) * 1000) / 1000);
  // 0.2 m from the left wall: turned a quarter, its back to that wall
  ed.addFurniture("armchair");
  ed.press(20, 150);
  await settle();
  const left = (ed._doc.floors[0].furniture as Furniture[])[1];
  assert.equal(left.rotation % 180, 90);
  assert.equal(left.x, Math.round((d / 2) * 1000) / 1000);
});

test("the ghost names the room and the wall, and turns with the item (#173)", async () => {
  store.clear();
  const ed = await makeEditor(alone());
  ed.addFurniture("armchair");
  ed.move(150, 30);
  assert.equal(ed._placeAt.roomId, "r1");
  assert.deepEqual(ed._placeAt.wall, { roomId: "r1", edge: 0 });
  assert.equal(ed._placeAt.rotation, 0);
  const text = JSON.stringify(ed.renderPlaceGhost());
  assert.match(text, /r1/);
  assert.match(text, /Wall 1–2/);
  // in the middle of the room: no wall, just the room
  ed.move(150, 150);
  assert.equal(ed._placeAt.wall, null);
  assert.equal(ed._placeAt.roomId, "r1");
  // outside every room
  ed.move(150, 450);
  assert.equal(ed._placeAt.roomId, null);
  assert.match(JSON.stringify(ed.renderPlaceGhost()), /Outside every room/);
});

test("the room comes from the pointer, not from the snapped point (#173)", async () => {
  store.clear();
  const ed = await makeEditor(rooms());
  ed._doc.settings.grid = 1;
  // 2.9 m and 3.4 m both round to the 3 m grid line, the wall between the rooms
  ed.addFurniture("chair");
  ed.press(290, 150);
  await settle();
  assert.equal(ed._roomId, "r1");
  ed.addFurniture("chair");
  ed.move(340, 150);
  assert.equal(ed._placeAt.roomId, "r2", "the ghost names the room under the pointer");
  ed.press(340, 150);
  await settle();
  assert.equal(ed._roomId, "r2");
});

test("Shift turns snapping off while placing: the item lands where it was clicked (#173)", async () => {
  store.clear();
  const ed = await makeEditor(alone());
  ed._doc.settings.grid = 0.1;
  ed.addFurniture("armchair");
  ed.move(150, 30, { shiftKey: true });
  assert.equal(ed._placeAt.wall, null);
  ed.press(150, 30, { shiftKey: true });
  await settle();
  const [f] = ed._doc.floors[0].furniture as Furniture[];
  assert.deepEqual([f.x, f.z, f.rotation], [1.5, 0.3, 0]);
  assert.equal(ed._placing, null, "Shift no longer keeps the card armed");
});

test("the snap switch turns snapping off for touch, and the choice is remembered on the device (#173)", async () => {
  store.clear();
  const ed = await makeEditor(alone());
  assert.equal(ed._snapOn, true);
  ed.setSnapOn(false);
  ed.addFurniture("armchair");
  ed._doc.settings.grid = 0.1;
  ed.press(150, 30, { pointerType: "touch" });
  await settle();
  const [f] = ed._doc.floors[0].furniture as Furniture[];
  assert.deepEqual([f.x, f.z], [1.5, 0.3]);
  // a new editor on the same device starts with it off
  const again = await makeEditor(alone());
  assert.equal(again._snapOn, false);
  again.setSnapOn(true);
  assert.equal((await makeEditor(alone()))._snapOn, true);
});

test("dragging an item: Shift and the switch also stop the wall snap (#173)", async () => {
  store.clear();
  const item = { id: "c", type: "armchair", x: 1.5, z: 1.5, rotation: 0, w: 0.8, d: 0.8, h: 0.8, variant: null } as Furniture;
  const drag = async (opts: { shiftKey?: boolean }, off = false) => {
    const ed = await makeEditor(alone(), [{ ...item }]);
    if (off) ed.setSnapOn(false);
    ed.press(150, 150, { target: planEl({ "data-furniture": "c" }) });
    ed.move(170, 120);
    ed.move(150, 55, opts);
    return (ed._doc.floors[0].furniture as Furniture[])[0];
  };
  assert.equal((await drag({})).z, 0.4, "snapped flush with the wall");
  assert.equal((await drag({ shiftKey: true })).z, 0.55, "Shift: free");
  assert.equal((await drag({}, true)).z, 0.55, "switch off: free");
});
