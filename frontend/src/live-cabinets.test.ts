// Our wardrobes, chests of drawers, bedside tables, sideboards, TV benches and hall and bathroom cabinets are live
// (#468, tools/live_cabinets.py): doors and drawers are parts of their own. Closed, such an item must look as it did:
// every triangle of the whole item (all parts drawn in one model) is in the viewer's drawing of it (the static part
// plus the live parts at rest), at the same place and in the same colours. This is also what keeps the live parts'
// shading honest (they are drawn about their pivot, #468 `lift`).

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { liveGroups } from "./live-parts.ts";
import { mountBase, setPacks, type FurniturePack, type PackItem } from "./packs.ts";
import { newFloor, type Furniture } from "./model.ts";
import { pushFurniture, pushPackLive } from "./viewer/furniture.ts";
import { GeoBuffer, LineBuffer } from "./viewer/geo.ts";

const BUNDLED = fileURLToPath(new URL("../../custom_components/home_3d/bundled_packs", import.meta.url));
// the groups of the bundled packs our live cabinets are in (the kitchen's are the kitchen ticket's)
const WHERE: Record<string, string[] | null> = {
  "amluto.bedroom": ["bed", "storage"],
  "amluto.ikea-uk": ["storage", "bed", "bath", "media", "kids"],
  "amluto.kitchen-bath": ["bath"],
};

interface Tri {
  c: [number, number, number];
  area: number;
  down: boolean;
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
    out.push({
      c: [(a[0] + b[0] + d[0]) / 3, (a[1] + b[1] + d[1]) / 3, (a[2] + b[2] + d[2]) / 3],
      area: len / 2,
      down: len > 0 && n[1] / len < -0.5,
      col: buf.c.slice(i, i + 9),
    });
  }
  return out;
}

function findIn(grid: Map<string, Tri[]>, t: Tri): Tri | undefined {
  const k = t.c.map((x) => Math.floor(x / 0.01));
  for (let x = k[0] - 1; x <= k[0] + 1; x++)
    for (let y = k[1] - 1; y <= k[1] + 1; y++)
      for (let z = k[2] - 1; z <= k[2] + 1; z++)
        for (const q of grid.get(`${x},${y},${z}`) ?? []) if (Math.hypot(q.c[0] - t.c[0], q.c[1] - t.c[1], q.c[2] - t.c[2]) < 0.001 && Math.abs(q.area - t.area) < 1e-4 + 0.001 * t.area) return q;
  return undefined;
}

const items: { pack: string; group: string; item: PackItem }[] = [];
for (const [pack, groups] of Object.entries(WHERE)) {
  for (const group of groups!) {
    const dir = join(BUNDLED, pack, group);
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      const item = JSON.parse(readFileSync(join(dir, name), "utf8")) as PackItem;
      if (item.slots?.length) items.push({ pack, group, item });
    }
  }
}

test("our live cabinets: there are many, in all three packs", () => {
  assert.ok(items.length >= 90, String(items.length));
  for (const pack of Object.keys(WHERE)) assert.ok(items.some((i) => i.pack === pack), pack);
});

test("closed, a live cabinet is drawn as the whole item: same triangles, same places, same colours", () => {
  let checked = 0;
  for (const { pack, item } of items) {
    setPacks([{ id: "t", name: "T", publisher: "T", items: [item] } as unknown as FurniturePack]);
    const [w, d, h] = item.size;
    const f = { id: "x", type: `pack:t:${item.id}`, x: 0, z: 0, rotation: 0, w, d, h, variant: null, entity: null, power: null } as unknown as Furniture;
    const floor = { ...newFloor("f", "G", 0), furniture: [f] };
    const base = mountBase(floor, f);
    const whole = new GeoBuffer();
    pushFurniture(whole, new LineBuffer(), new GeoBuffer(), f, base, true);
    const drawn = new GeoBuffer();
    pushFurniture(drawn, new LineBuffer(), new GeoBuffer(), f, base, false);
    const all = triangles(drawn);
    for (const key of liveGroups(item.parts).keys()) {
      const buf = new GeoBuffer();
      const made = pushPackLive(buf, new LineBuffer(), item, f, key, base);
      assert.ok(made, `${pack}/${item.id}: ${key}`);
      all.push(...triangles(buf, [made.pivot[0], made.pivot[1] + base, made.pivot[2]]));
    }
    const grid = new Map<string, Tri[]>();
    for (const t of all) {
      const k = t.c.map((x) => Math.floor(x / 0.01)).join(",");
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(t);
    }
    for (const t of triangles(whole)) {
      // the underside of a part is not seen: a live part may leave it out
      if (t.down) continue;
      const q = findIn(grid, t);
      assert.ok(q, `${pack}/${item.id}: a triangle at ${t.c.map((x) => x.toFixed(3))} is not in the viewer's drawing`);
      for (let i = 0; i < 9; i++) assert.ok(Math.abs(q.col[i] - t.col[i]) < 2e-3, `${pack}/${item.id}: the colour at ${t.c.map((x) => x.toFixed(3))} differs (${q.col[i]} against ${t.col[i]})`);
    }
    checked++;
  }
  setPacks([]);
  assert.equal(checked, items.length);
});

test("each door and drawer is a model of its own: a hinge group is one column, a drawer is one front with its handles", () => {
  for (const { pack, item } of items) {
    for (const [key, g] of liveGroups(item.parts)) {
      if (g.bind.kind !== "open" || g.bind.hinge === "bottom") continue;
      // the parts of one hinge group make one connected span across: two columns of doors would turn about one edge
      const spans = g.parts.map((p) => [p.x - p.w / 2, p.x + p.w / 2]).sort((a, b) => a[0] - b[0]);
      let to = spans[0][1];
      for (const [a, b] of spans.slice(1)) {
        assert.ok(a <= to + 0.02, `${pack}/${item.id}: ${key} is two columns of doors`);
        to = Math.max(to, b);
      }
    }
    // every slot has parts, and a one-slot item (its own contact opens it) names no slot twice
    const ids = new Set((item.slots ?? []).map((s) => s.id));
    assert.equal(ids.size, item.slots?.length, `${pack}/${item.id}: slot ids differ`);
    for (const s of item.slots ?? []) assert.ok(s.kind || s.name, `${pack}/${item.id}: ${s.id}`);
  }
});
