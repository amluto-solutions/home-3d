import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor } from "../components/editor-harness.ts";
import { arrange } from "./arrange.ts";

const item = (id: string, x: number, z: number, w = 1, d = 1, rotation = 0) => ({ id, type: "box", x, z, w, d, h: 1, rotation, variant: null }) as never;
const dx = (m: Map<string, [number, number]> | null, id: string) => m?.get(id)?.[0] ?? 0;
const dz = (m: Map<string, [number, number]> | null, id: string) => m?.get(id)?.[1] ?? 0;

test("align left/right/centre move everything to the extreme or middle of the selection (#235)", () => {
  const set = [item("a", 1, 1, 2, 1), item("b", 6, 3, 4, 1), item("c", 4, 5, 1, 1)];
  // left edges: a 0, b 4, c 3.5 -> all at 0
  const left = arrange(set as never, "left");
  assert.equal(dx(left, "a"), 0);
  assert.equal(dx(left, "b"), -4);
  assert.equal(dx(left, "c"), -3.5);
  // right edges: a 2, b 8, c 4.5 -> all at 8
  const right = arrange(set as never, "right");
  assert.equal(dx(right, "b"), 0);
  assert.equal(dx(right, "a"), 6);
  // centres onto the middle of the extent (0..8 -> 4)
  const centre = arrange(set as never, "centre");
  assert.equal(dx(centre, "a"), 3);
  assert.equal(dx(centre, "b"), -2);
  assert.equal(dx(centre, "c"), 0);
  assert.equal(dz(centre, "a"), 0);
});

test("align top/bottom/middle use the z axis and the rotated footprint (#235)", () => {
  // a 4 x 1 item turned 90 degrees is 1 wide and 4 deep: its box runs z 0..4 around z=2
  const set = [item("a", 5, 2, 4, 1, 90), item("b", 1, 10, 1, 1)];
  const top = arrange(set as never, "top");
  assert.ok(Math.abs(dz(top, "b") - -9.5) < 1e-9);
  assert.equal(dz(top, "a"), 0);
  const bottom = arrange(set as never, "bottom");
  assert.ok(Math.abs(dz(bottom, "a") - 6.5) < 1e-9);
  const middle = arrange(set as never, "middle");
  assert.ok(Math.abs(dz(middle, "a") - (5.25 - 2)) < 1e-9);
});

test("distribute leaves the outer items and evens the gaps; needs three (#235)", () => {
  const set = [item("a", 0.5, 1), item("c", 9.5, 1), item("b", 2, 1, 2, 1), item("d", 6, 1)];
  const m = arrange(set as never, "across")!;
  // boxes: a 0..1, b 1..3, d 5.5..6.5, c 9..10 -> free space 10 - (1+2+1+1) = 5, three gaps of 5/3
  assert.equal(dx(m, "a"), 0);
  assert.equal(dx(m, "c"), 0);
  const gap = 5 / 3;
  assert.ok(Math.abs(dx(m, "b") - (1 + gap - 1)) < 1e-9);
  assert.ok(Math.abs(dx(m, "d") - (1 + gap + 2 + gap - 5.5)) < 1e-9);
  assert.equal(arrange(set.slice(0, 2) as never, "across"), null, "two items: nothing to distribute");
  assert.ok(arrange(set.slice(0, 2) as never, "left"), "two items can be aligned");
  assert.equal(arrange(set.slice(0, 1) as never, "left"), null);
});

test("distribute down works along z (#235)", () => {
  const set = [item("a", 1, 0.5), item("b", 1, 1.2), item("c", 1, 9.5)];
  const m = arrange(set as never, "down")!;
  assert.equal(dz(m, "a"), 0);
  assert.equal(dz(m, "c"), 0);
  // free space 10 - 3 = 7, gaps 3.5: b moves to 0.5+1+3.5 -> box 4.5..5.5, centre 5
  assert.ok(Math.abs(dz(m, "b") - (5 - 1.2)) < 1e-9);
});

test("the align buttons make one undo step per action (#235)", async () => {
  (globalThis as Record<string, unknown>).HTMLElement ??= class {};
  const { AlignTools } = await import("./tools.ts");
  const room = { id: "r", name: "R", area_id: null, points: [[0, 0], [10, 0], [10, 10], [0, 10]], floor_material: "wood" } as never;
  const el = await makeEditor([room], [item("a", 1, 1), item("b", 4, 5), item("c", 8, 3)]);
  el._furnitureId = "a";
  el._multi = ["a", "b", "c"];
  const tools = Object.create(AlignTools.prototype) as { host: unknown; run(op: string): void };
  tools.host = el;
  el.dispatchEvent = () => true;
  const xs = () => el._doc.floors[0].furniture.map((m: { x: number }) => m.x);
  const zs = () => el._doc.floors[0].furniture.map((m: { z: number }) => m.z);
  tools.run("middle");
  assert.deepEqual(zs(), [3, 3, 3], "one row");
  tools.run("across");
  assert.deepEqual(xs(), [1, 4.5, 8], "the gaps are even");
  el.undo();
  assert.deepEqual(xs(), [1, 4, 8], "one undo takes back the spread only");
  assert.deepEqual(zs(), [3, 3, 3]);
  el.undo();
  assert.deepEqual(zs(), [1, 5, 3], "and one more the align");
});

test("the multi-selection panel offers the tools for a plain selection, not a joined block (#235)", async () => {
  const { editorSource } = await import("../components/editor-source.ts");
  const src = editorSource();
  assert.match(src, /\$\{block \? nothing : this\.renderAlignTools\(items\.length, fixed \|\| some\)\}/);
  assert.match(src, /<fp3d-align \.host=\$\{this\} \.count=\$\{count\} \.fixed=\$\{fixed\}>/);
});

test("values set before the bundle defined the element are kept on upgrade, so the first multi-select has its buttons (#261)", async () => {
  const { AlignTools } = await import("./tools.ts");
  // the editor sets .host and .count on the bare <fp3d-align> before this lazy bundle has run: those land on the element
  // itself and must be taken over by the accessors, not lost to a class field or left shadowing them
  const el = Object.create(AlignTools.prototype) as { host: unknown; count: number; connectedCallback(): void };
  const host = { t: (k: string) => k };
  Object.defineProperty(el, "host", { value: host, writable: true, configurable: true, enumerable: true });
  Object.defineProperty(el, "count", { value: 3, writable: true, configurable: true, enumerable: true });
  el.connectedCallback();
  assert.equal(Object.prototype.hasOwnProperty.call(el, "host"), false, "the accessor is not shadowed");
  assert.equal(el.host, host);
  assert.equal(el.count, 3);
});
