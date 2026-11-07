import assert from "node:assert/strict";
import { test } from "node:test";
import { furnitureFields, furniturePanel, retypePatch, typeOptionLabels } from "./item-panel.ts";

test("the Name box sits below the position fields, not where the library's search box was (#70)", () => {
  const order = furnitureFields({ mirror: true, strip: false, lift: true });
  const name = order.indexOf("name");
  for (const pos of ["x", "z", "rotation"] as const) assert.ok(order.indexOf(pos) < name, `${pos} before name`);
  assert.equal(order[0], "x");
});

const KINDS = [
  { mirror: true, strip: false, lift: false },
  { mirror: false, strip: false, lift: true },
  { mirror: true, strip: true, lift: true },
  { mirror: false, strip: false, lift: false },
];

test("the pinned header holds X, Y and the rotation for every kind of item (#71)", () => {
  for (const needs of KINDS) assert.deepEqual(furniturePanel(needs).head, ["x", "z", "rotation"]);
});

test("every kind of item lists its fields in the same order, with the size first below the header (#71)", () => {
  const full = furniturePanel({ mirror: true, strip: true, lift: true }).body;
  for (const needs of KINDS) {
    const body = furniturePanel(needs).body;
    assert.deepEqual(body.slice(0, 3), ["w", "d", "h"]);
    assert.deepEqual(body, full.filter((f) => body.includes(f)));
  }
});

test("the show-name row is always there, so naming an item doesn't push the rows below it (#71)", () => {
  for (const needs of KINDS) assert.ok(furniturePanel(needs).body.includes("show_name"));
});

test("the floor dropdown shows when the home has more than one floor, last, the same for every item (#73)", () => {
  for (const needs of KINDS) {
    assert.ok(!furnitureFields(needs).includes("floor"), "one floor: no dropdown");
    const body = furniturePanel({ ...needs, floors: true }).body;
    assert.equal(body.at(-1), "floor");
  }
});

test("the Type list tells same-named items apart by their variant, else their size (#132)", () => {
  const item = (id: string, name: string, size: [number, number, number], variant?: string) => ({ id, name: { en: name }, size, ...(variant ? { variant: { en: variant } } : {}) });
  const labels = typeOptionLabels(
    [
      item("battery_9", "Home battery", [0.6, 0.22, 0.76], "9.5 kWh"),
      item("battery_5", "Home battery", [0.6, 0.22, 0.5], "5.2 kWh"),
      item("inverter", "Inverter", [0.42, 0.17, 0.38], "AC-coupled 3 kW"),
      item("box_a", "Box", [0.3, 0.3, 0.3]),
      item("box_b", "Box", [0.5, 0.3, 0.3]),
    ],
    "en",
  );
  assert.deepEqual(labels, ["Home battery · 9.5 kWh", "Home battery · 5.2 kWh", "Inverter", "Box · 30 × 30 × 30 cm", "Box · 50 × 30 × 30 cm"]);
});

test("a new type brings its own size unless the item was resized (#132)", () => {
  const sofa = { type: "sofa", w: 2.2, d: 0.9, h: 0.82 };
  assert.deepEqual(retypePatch(sofa, "bed"), { type: "bed", w: 1.6, d: 2.05, h: 0.9 });
  // made 2.5 m long by hand: the size stays, only the type changes
  assert.deepEqual(retypePatch({ ...sofa, w: 2.5 }, "bed"), { type: "bed" });
});
