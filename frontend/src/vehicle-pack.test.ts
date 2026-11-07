// The vehicles pack (#242): no slim upright part of a car (a pillar, a post) stands out beside its glass or roof. An
// upright pillar beside a glasshouse that leans in stood clear of the roof at its top.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import type { PackItem, PackPart } from "./packs.ts";
import { shellHalfWidth } from "./viewer/shell.ts";

const DIR = new URL("../../custom_components/home_3d/bundled_packs/amluto.outdoor/vehicle/", import.meta.url);
const vehicles: PackItem[] = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(new URL(f, DIR), "utf8")) as PackItem);

/**
 * The part's cross-section at height y (metres) as [x0, x1, z0, z1] in metres, or null when it does not reach y. A
 * curved shell (#252) is asked at depth `at` (metres): its width there, as deep as it is.
 */
function section(p: PackPart, item: PackItem, y: number, at = 0): [number, number, number, number] | null {
  const [W, L, H] = item.size;
  const y0 = p.y * H;
  const y1 = (p.y + p.h) * H;
  if (y < y0 || y > y1) return null;
  if (p.shape === "shell") {
    const zf = (at / L - (p.z - p.d / 2)) / p.d;
    const hw = shellHalfWidth(p, zf, (y - y0) / (y1 - y0), p.w * W, p.h * H);
    if (hw === null) return null;
    return [p.x * W - hw, p.x * W + hw, (p.z - p.d / 2) * L, (p.z + p.d / 2) * L];
  }
  if (!["box", "loft", "rbox"].includes(p.shape)) return null;
  const t = p.shape === "loft" ? (y - y0) / (y1 - y0) : 0;
  const lerp = (a: number, b: number | undefined) => a + ((b ?? a) - a) * t;
  const x = lerp(p.x, p.tx) * W;
  const w = lerp(p.w, p.tw) * W;
  const z = lerp(p.z, p.tz) * L;
  const d = lerp(p.d, p.td) * L;
  return [x - w / 2, x + w / 2, z - d / 2, z + d / 2];
}

const slim = (p: PackPart, item: PackItem) => (p.shape === "box" || p.shape === "loft") && p.w * item.size[0] <= 0.08 && p.d * item.size[1] <= 1 && p.h * item.size[2] >= 0.15;

test("no pillar of a car stands out beside its glass or roof (#242)", () => {
  const cars = vehicles.filter((v) => v.parts.some((p) => p.color === "glass" || p.color === "dark") && v.size[2] > 1.2 && v.size[1] > 3);
  assert.ok(cars.length > 150, "the cars of the pack");
  const bad: string[] = [];
  for (const car of cars) {
    for (const p of car.parts) {
      if (!slim(p, car) || p.y < 0.5) continue;
      const y = (p.y + p.h) * car.size[2] - 0.01;
      const own = section(p, car, y)!;
      const zc = (own[2] + own[3]) / 2;
      let lo = Infinity;
      let hi = -Infinity;
      for (const q of car.parts) {
        if (q === p || slim(q, car)) continue;
        const s = section(q, car, y, zc);
        if (!s || zc < s[2] || zc > s[3]) continue;
        lo = Math.min(lo, s[0]);
        hi = Math.max(hi, s[1]);
      }
      if (own[0] < lo - 0.015 || own[1] > hi + 0.015) bad.push(`${car.id}: part ${car.parts.indexOf(p)} at x ${own[0].toFixed(3)}..${own[1].toFixed(3)}, body ${lo.toFixed(3)}..${hi.toFixed(3)}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("the cars have curved bodies with glass of their own, and their curved pillars hug the glass (#252)", () => {
  const cars = vehicles.filter((v) => v.parts.some((p) => p.shape === "shell"));
  // every car but the vans (boxy anyway) and the hand-made two-wheelers
  assert.ok(cars.length >= 190, `${cars.length} cars with shells`);
  const bad: string[] = [];
  for (const car of cars) {
    const [W, L, H] = car.size;
    const shells = car.parts.filter((p) => p.shape === "shell");
    const glass = shells.find((p) => p.color === "glass");
    if (!glass) {
      bad.push(`${car.id}: no glass shell`);
      continue;
    }
    if (!shells.some((p) => p.y < 0.3 && p.d > 0.9 && p.color !== "glass")) bad.push(`${car.id}: no curved lower body`);
    const width = (p: PackPart, z: number, y: number): number | null => {
      return shellHalfWidth(p, (z / L - (p.z - p.d / 2)) / p.d, (y - p.y * H) / (p.h * H), p.w * W, p.h * H);
    };
    for (const p of shells) {
      if (p === glass || p.d * L > 0.7 || p.y < 0.5) continue;
      const z = p.z * L;
      const y = (p.y + p.h / 2) * H;
      const own = width(p, z, y);
      const g = width(glass, z, y);
      if (own === null || g === null || own < g || own > g + 0.03) bad.push(`${car.id}: pillar at z ${z.toFixed(2)} reaches ${own?.toFixed(3)}, glass ${g?.toFixed(3)}`);
    }
  }
  assert.deepEqual(bad, []);
});
