// A wood finish colours a pack worktop's top too (checked for #483; NeonPlan 3D 3.5.0 55fcf16 fixed it there, our own
// packs name their worktops by the wood role, so the top follows the colour without a special case).
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { setPacks, type FurniturePack } from "../packs.ts";
import { pushFurniture } from "./furniture.ts";
import { GeoBuffer, LineBuffer } from "./geo.ts";

test("a wood finish colours a pack worktop's top, a front finish leaves it (#483)", () => {
  setPacks([
    {
      id: "t.kit",
      name: "Kit",
      publisher: "t",
      items: [{ id: "dw", name: { en: "Dishwasher" }, size: [0.6, 0.6, 0.9], parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 0.95, color: "white" }, { shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0.95, h: 0.05, color: "wood" }] }],
    } as FurniturePack,
  ]);
  try {
    // the colours of the worktop's top face (y = 0.9): whole triangles at that height
    const top = (colors: Furniture["colors"]) => {
      const buf = new GeoBuffer();
      pushFurniture(buf, new LineBuffer(), new GeoBuffer(), { id: "d", type: "pack:t.kit:dw", x: 0, z: 0, rotation: 0, w: 0.6, d: 0.6, h: 0.9, variant: null, colors } as Furniture);
      const out: number[][] = [];
      for (let i = 0; i < buf.p.length; i += 9) if ([1, 4, 7].every((k) => Math.abs(buf.p[i + k] - 0.9) < 1e-6)) out.push(buf.c.slice(i, i + 3));
      return out;
    };
    const usual = top(null);
    assert.ok(usual.length > 0, "the top is drawn");
    const walnut = top({ wood: "#6b4a32" });
    assert.notDeepEqual(walnut, usual, "walnut colours the top");
    assert.ok(walnut.every(([r, , b]) => r > b), "and makes it warm");
    assert.deepEqual(top({ front: "#5d7590" }), usual, "a front finish leaves the worktop");
  } finally {
    setPacks([]);
  }
});
