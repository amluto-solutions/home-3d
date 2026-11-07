// Curved shells (#252): a body lofted through side and plan stations, closed, facing outwards, inside its box, and
// coarser on the tablet level.

import assert from "node:assert/strict";
import { test } from "node:test";
import { monotoneCurve, shellCurves, shellHalfWidth, shellStations, shellTriangles, type ShellPart, type V3 } from "./shell.ts";
import { GeoBuffer, LineBuffer } from "./geo.ts";
import { currentShellDetail, pushFurniture, setShellDetail } from "./furniture.ts";
import { setPacks } from "../packs.ts";
import type { Furniture } from "../model.ts";

const CAR: ShellPart = {
  side: [
    [0, 0.3, 0.6],
    [0.1, 0.05, 0.75],
    [0.5, 0, 0.7],
    [0.85, 0.05, 0.55],
    [1, 0.3, 0.4],
  ],
  plan: [
    [0, 0.8],
    [0.2, 1],
    [0.8, 1],
    [1, 0.75],
  ],
  round: 0.3,
  taper: 0.9,
};
const BOX = { cx: 0, cz: 0, w: 1.8, d: 4.5, y0: 0.2, h: 1 };

/** Six times the volume the triangles enclose: positive when they all face outwards. */
function volume(tris: [V3, V3, V3][]): number {
  let v = 0;
  for (const [a, b, c] of tris) v += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  return v;
}

test("the side and plan curves pass through their stations and never overshoot", () => {
  const f = monotoneCurve([
    [0, 0],
    [0.3, 1],
    [0.6, 1],
    [1, 0.2],
  ]);
  assert.equal(f(0), 0);
  assert.equal(f(0.3), 1);
  assert.equal(f(1), 0.2);
  for (let x = 0; x <= 1; x += 0.01) assert.ok(f(x) >= -1e-9 && f(x) <= 1 + 1e-9, `f(${x}) = ${f(x)}`);
  // flat between two equal stations
  assert.ok(Math.abs(f(0.45) - 1) < 1e-9);
  // level beyond the ends
  assert.equal(f(-1), 0);
  assert.equal(f(2), 0.2);
});

test("a shell is closed, faces outwards and stays inside its part's box", () => {
  for (const detail of ["full", "low"] as const) {
    const tris = shellTriangles(CAR, BOX, detail);
    assert.ok(volume(tris) > 0, `${detail}: faces outwards`);
    // closed: every edge is shared by exactly two triangles, once each way
    const edges = new Map<string, number>();
    const key = (p: V3) => p.map((v) => v.toFixed(6)).join(",");
    for (const [a, b, c] of tris) for (const [p, q] of [[a, b], [b, c], [c, a]] as const) edges.set(`${key(p)}>${key(q)}`, (edges.get(`${key(p)}>${key(q)}`) ?? 0) + 1);
    for (const [e, n] of edges) {
      const [p, q] = e.split(">");
      assert.equal(n, 1, `${detail}: edge ${e} once`);
      assert.ok(edges.has(`${q}>${p}`), `${detail}: edge ${e} has its twin`);
    }
    for (const t of tris) {
      for (const [x, y, z] of t) {
        assert.ok(Math.abs(x) <= BOX.w / 2 + 1e-9 && Math.abs(z) <= BOX.d / 2 + 1e-9, `${detail}: inside across and along`);
        assert.ok(y >= BOX.y0 - 1e-9 && y <= BOX.y0 + BOX.h + 1e-9, `${detail}: inside in height`);
      }
    }
  }
});

test("the tablet level cuts a shell into far fewer triangles", () => {
  const full = shellTriangles(CAR, BOX, "full").length;
  const low = shellTriangles(CAR, BOX, "low").length;
  assert.ok(full <= 640, `full ${full}`);
  assert.ok(low <= full / 3, `low ${low} of ${full}`);
  // the stations themselves are always among the cuts
  const c = shellCurves(CAR);
  for (const z of [0, 0.1, 0.2, 0.5, 0.8, 0.85, 1]) assert.ok(shellStations(c, "low").includes(z) && shellStations(c, "full").includes(z));
  // a small shell is cut coarsely whatever the level
  assert.equal(shellTriangles(CAR, { ...BOX, w: 0.1, d: 0.2, h: 0.1 }, "full").length, shellTriangles(CAR, { ...BOX, w: 0.1, d: 0.2, h: 0.1 }, "low").length);
});

test("the half width follows the plan, the taper and the rounding", () => {
  const at = (z: number, y: number) => shellHalfWidth(CAR, z, y, BOX.w, BOX.h);
  // middle of the shell, half way up: the whole width, a little in by the taper
  const mid = at(0.5, 0.35)!;
  assert.ok(mid > 0.9 * 0.9 && mid <= 0.9, `mid ${mid}`);
  // the top leans in by the taper and the rounded corner
  assert.ok(at(0.5, 0.69)! < mid);
  // the nose is narrower (plan 0.75)
  assert.ok(at(1, 0.35)! <= 0.75 * 0.9 + 1e-9);
  // nothing above the top or beyond the ends
  assert.equal(at(0.5, 0.9), null);
  assert.equal(shellHalfWidth({ ...CAR, side: CAR.side!.map(([z, b, t]) => [z * 0.5 + 0.25, b, t]) }, 0.1, 0.3, BOX.w, BOX.h), null);
  // the same as the outline drawn: the widest point of the middle ring
  const ring = shellTriangles(CAR, BOX, "full").flat().filter((q) => Math.abs(q[2]) < 1e-9);
  assert.ok(Math.abs(Math.max(...ring.map((q) => Math.abs(q[0]))) - Math.max(...[0.05, 0.2, 0.35, 0.5].map((y) => at(0.5, y)!))) < 0.02);
});

test("a pack item with shells draws finite outward geometry, mirrored too, and fewer triangles on the tablet level", () => {
  setPacks([
    {
      id: "t.shells",
      name: "Shells",
      publisher: "t",
      items: [
        {
          id: "car",
          name: { en: "Car" },
          size: [1.8, 4.5, 1.5],
          vehicle: true,
          parts: [
            { shape: "shell", x: 0, z: 0, w: 1, d: 1, y: 0.1, h: 0.55, color: "paint", side: CAR.side, plan: CAR.plan, round: 0.3, taper: 0.9 },
            { shape: "shell", x: 0, z: -0.1, w: 0.9, d: 0.6, y: 0.6, h: 0.4, color: "glass", side: [[0, 0, 0.1], [0.3, 0, 1], [0.7, 0, 1], [1, 0, 0.05]], taper: 0.75 },
          ],
        },
      ],
    },
  ]);
  const draw = (mirror: boolean) => {
    const buf = new GeoBuffer();
    const f: Furniture = { id: "f", type: "pack:t.shells:car", x: 1, z: 2, rotation: 30, w: 1.8, d: 4.5, h: 1.5, variant: null, entity: null, power: null, mirror };
    pushFurniture(buf, new LineBuffer(), new GeoBuffer(), f);
    return buf;
  };
  const was = currentShellDetail();
  try {
    for (const mirror of [false, true]) {
      const buf = draw(mirror);
      assert.ok(buf.p.length > 0 && buf.p.every(Number.isFinite));
      const tris: [V3, V3, V3][] = [];
      for (let i = 0; i < buf.p.length; i += 9) tris.push([buf.p.slice(i, i + 3) as V3, buf.p.slice(i + 3, i + 6) as V3, buf.p.slice(i + 6, i + 9) as V3]);
      assert.ok(volume(tris) > 0, `faces outwards (mirror ${mirror})`);
    }
    const full = draw(false).count;
    setShellDetail("low");
    const low = draw(false).count;
    assert.ok(low < full / 2, `low ${low}, full ${full}`);
  } finally {
    setShellDetail(was);
  }
});
