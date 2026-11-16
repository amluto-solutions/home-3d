// More of our own items are live (run 16, tools/live_misc.py): lids, drums, sliding doors, baskets, tool chests, desk
// drawer units. Closed, such an item must look as it did: every triangle of the whole item is in the viewer's drawing of
// it (the static part plus the live parts at rest), at the same place and in the same colours. The engine's two new
// pieces are tested here as well: a lid hinged at its back edge ("back") and a door that slides to a side ("to").

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Group, MeshBasicMaterial } from "three";
import { liveGroups, liveKey } from "./live-parts.ts";
import { mountBase, setPacks, type FurniturePack, type PackItem } from "./packs.ts";
import { newFloor, type Floor, type Furniture } from "./model.ts";
import { pushFurniture, pushPackLive } from "./viewer/furniture.ts";
import { GeoBuffer, LineBuffer } from "./viewer/geo.ts";
import { LiveParts, type LiveFloor } from "./viewer/live-view.ts";

const BUNDLED = fileURLToPath(new URL("../../custom_components/home_3d/bundled_packs", import.meta.url));
const CLOSED = JSON.parse(readFileSync(fileURLToPath(new URL("../../tests/fixtures/misc-closed-look.json", import.meta.url)), "utf8")) as Record<string, { parts: number }>;
const load = (key: string): PackItem => JSON.parse(readFileSync(join(BUNDLED, `${key}.json`), "utf8")) as PackItem;

interface Tri {
  c: [number, number, number];
  area: number;
  down: boolean;
  n: [number, number, number];
  col: number[];
}

/** Triangles of a buffer moved by `at`: centroid, area, whether it faces down, and its nine colour values. */
function triangles(buf: GeoBuffer, at: [number, number, number] = [0, 0, 0]): Tri[] {
  const out: Tri[] = [];
  for (let i = 0; i + 8 < buf.p.length; i += 9) {
    const p = buf.p;
    const a = [p[i] + at[0], p[i + 1] + at[1], p[i + 2] + at[2]];
    const b = [p[i + 3] + at[0], p[i + 4] + at[1], p[i + 5] + at[2]];
    const d = [p[i + 6] + at[0], p[i + 7] + at[1], p[i + 8] + at[2]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(n[0], n[1], n[2]);
    out.push({ c: [(a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3, (a[2] + b[2] + d[2]) / 3], area: len / 2, down: len > 0 && n[1] / len < -0.5, n: len > 0 ? [n[0] / len, n[1] / len, n[2] / len] : [0, 0, 0], col: buf.c.slice(i, i + 9) });
  }
  return out;
}

function findIn(grid: Map<string, Tri[]>, t: Tri): Tri | undefined {
  const k = t.c.map((x) => Math.floor(x / 0.01));
  for (let x = k[0] - 1; x <= k[0] + 1; x++)
    for (let y = k[1] - 1; y <= k[1] + 1; y++)
      for (let z = k[2] - 1; z <= k[2] + 1; z++)
        for (const q of grid.get(`${x},${y},${z}`) ?? []) if (Math.hypot(q.c[0] - t.c[0], q.c[1] - t.c[1], q.c[2] - t.c[2]) < 0.001 && Math.abs(q.area - t.area) < 1e-4 + 0.001 * t.area && q.n[0] * t.n[0] + q.n[1] * t.n[1] + q.n[2] * t.n[2] > 0.99) return q;
  return undefined;
}

const placed = (item: PackItem, extra: Partial<Furniture> = {}): Furniture => {
  const [w, d, h] = item.size;
  return { id: "x", type: `pack:t:${item.id}`, x: 0, z: 0, rotation: 0, w, d, h, variant: null, entity: null, power: null, ...extra } as unknown as Furniture;
};

test("the converted items are many and every one is live", () => {
  const keys = Object.keys(CLOSED);
  assert.ok(keys.length >= 28, String(keys.length));
  for (const key of keys) assert.ok(load(key).slots?.length, key);
});

test("closed, a converted item is drawn as the whole item: same triangles, same places, same colours", () => {
  for (const key of Object.keys(CLOSED)) {
    for (const mirror of [false, true]) {
      const item = load(key);
      setPacks([{ id: "t", name: "T", publisher: "T", items: [item] } as unknown as FurniturePack]);
      const f = placed(item, { mirror });
      const floor = { ...newFloor("f", "G", 0), furniture: [f] };
      const base = mountBase(floor, f);
      const whole = new GeoBuffer();
      pushFurniture(whole, new LineBuffer(), new GeoBuffer(), f, base, true);
      const all = triangles(
        (() => {
          const b = new GeoBuffer();
          pushFurniture(b, new LineBuffer(), new GeoBuffer(), f, base, false);
          return b;
        })(),
      );
      for (const k of liveGroups(item.parts).keys()) {
        const buf = new GeoBuffer();
        const made = pushPackLive(buf, new LineBuffer(), item, f, k, base);
        assert.ok(made, `${key}: ${k}`);
        all.push(...triangles(buf, [made.pivot[0], made.pivot[1] + base, made.pivot[2]]));
      }
      const grid = new Map<string, Tri[]>();
      for (const t of all) {
        const cell = t.c.map((x) => Math.floor(x / 0.01)).join(",");
        (grid.get(cell) ?? grid.set(cell, []).get(cell)!).push(t);
      }
      for (const t of triangles(whole)) {
        if (t.down) continue; // the underside of a part is not seen
        const q = findIn(grid, t);
        assert.ok(q, `${key}${mirror ? " mirrored" : ""}: a triangle at ${t.c.map((x) => x.toFixed(3))} is not in the viewer's drawing`);
        for (let i = 0; i < 9; i++) assert.ok(Math.abs(q.col[i] - t.col[i]) < 2e-3, `${key}: the colour at ${t.c.map((x) => x.toFixed(3))} differs: ${q.col.map((v) => v.toFixed(3))} against ${t.col.map((v) => v.toFixed(3))}`);
      }
    }
  }
  setPacks([]);
});

test("a lid hinged at the back turns about its back edge, at its underside, and lifts at the front", () => {
  const item = load("amluto.kitchen-bath/appliance/chest_freezer_200");
  setPacks([{ id: "t", name: "T", publisher: "T", items: [item] } as unknown as FurniturePack]);
  try {
    const [key, group] = [...liveGroups(item.parts)][0];
    assert.equal(group.bind.hinge, "back");
    const made = pushPackLive(new GeoBuffer(), new LineBuffer(), item, placed(item), key)!;
    const [w, d, h] = item.size;
    assert.ok(Math.abs(made.pivot[0]) < 1e-6, "in the middle across");
    assert.ok(made.pivot[2] < -0.3 * d && made.pivot[2] >= -0.5 * d - 1e-3, `at the back: ${made.pivot[2]}`);
    assert.ok(made.pivot[1] > 0.9 * h && made.pivot[1] < 0.92 * h, `at the lid's underside: ${made.pivot[1]}`);
    assert.equal(made.width, w);
    // in the viewer: open, the lid is turned up about the x axis, away from the front (negative, like a lift-up door)
    const floor: Floor = { ...newFloor("f", "Ground", 0), furniture: [placed(item)] };
    const fv: LiveFloor = { floor, group: new Group(), materials: { wall: new MeshBasicMaterial(), lines: new MeshBasicMaterial() } };
    const live = new LiveParts();
    live.sync([fv], "dark");
    live.setValues(new Map([[`${floor.furniture[0].id}|${key}`, 1]]));
    let t = 1000;
    for (let i = 0; i < 30; i++) live.step((t += 100), new Map([["f", fv]]), false, new Set());
    const mesh = fv.group.children[0].children[0].children[0] as unknown as { rotation: { x: number; y: number } };
    assert.ok(Math.abs(mesh.rotation.x + (75 * Math.PI) / 180) < 1e-6, String(mesh.rotation.x));
    assert.equal(mesh.rotation.y, 0);
    live.dispose();
  } finally {
    setPacks([]);
  }
});

test("sliding doors: each goes its own way, toward the middle, a share of the item's width; mirrored they swap", () => {
  const item = load("amluto.ikea-uk/storage/kleppstad_wardrobe_sliding");
  setPacks([{ id: "t", name: "T", publisher: "T", items: [item] } as unknown as FurniturePack]);
  try {
    const groups = [...liveGroups(item.parts)];
    assert.equal(groups.length, 2, "the two doors are models of their own");
    assert.deepEqual(groups.map(([, g]) => g.bind.to).sort(), ["left", "right"]);
    assert.notEqual(liveKey({ slot: "d", kind: "slide", to: "left", amount: 0.2 }), liveKey({ slot: "d", kind: "slide", to: "right", amount: 0.2 }));
    for (const mirror of [false, true]) {
      const f = placed(item, { mirror });
      const floor: Floor = { ...newFloor("f", "Ground", 0), furniture: [f] };
      const fv: LiveFloor = { floor, group: new Group(), materials: { wall: new MeshBasicMaterial(), lines: new MeshBasicMaterial() } };
      const live = new LiveParts();
      live.sync([fv], "dark");
      live.setValues(new Map(groups.map(([k]) => [`x|${k}`, 1])));
      let t = 1000;
      for (let i = 0; i < 30; i++) live.step((t += 100), new Map([["f", fv]]), false, new Set());
      const moved = new Map<string, number>();
      for (const g of fv.group.children) {
        const inner = g.children[0];
        const mesh = inner.children[0];
        // the door at the item's left edge (x < 0 in the recipe) is the one that goes right, in the recipe's own frame
        moved.set(inner.position.x * (mirror ? -1 : 1) < 0 ? "left" : "right", mesh.position.x);
      }
      const run = 0.21 * item.size[0];
      assert.ok(Math.abs(moved.get("left")! - run * (mirror ? -1 : 1)) < 1e-6, `${mirror}: ${moved.get("left")}`);
      assert.ok(Math.abs(moved.get("right")! + run * (mirror ? -1 : 1)) < 1e-6, `${mirror}: ${moved.get("right")}`);
      // unlinked again: back where it was drawn
      live.setValues(new Map());
      for (let i = 0; i < 3; i++) live.step((t += 100), new Map([["f", fv]]), false, new Set());
      for (const g of fv.group.children) assert.equal(g.children[0].children[0].position.x, 0);
      live.dispose();
    }
  } finally {
    setPacks([]);
  }
});
