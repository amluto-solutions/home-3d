import assert from "node:assert/strict";
import { test } from "node:test";
import { InstancedMesh, Group, Mesh, MeshBasicMaterial, BoxGeometry, PerspectiveCamera, Scene, LineSegments, LineBasicMaterial } from "three";
import { compileInSlices, firstUsers, type Compiler } from "./warm.ts";
import type { SliceClock } from "./slices.ts";

const clock = (): SliceClock & { pauses: number } => {
  const c = { pauses: 0, now: () => 0, pause: () => (c.pauses++, Promise.resolve()) };
  return c;
};

function scene() {
  const s = new Scene();
  const shared = new MeshBasicMaterial();
  const g = new Group();
  const geo = new BoxGeometry();
  const a = new Mesh(geo, shared);
  const b = new Mesh(geo, shared);
  const c = new Mesh(geo, new MeshBasicMaterial());
  const lines = new LineSegments(geo, new LineBasicMaterial());
  const inst = new InstancedMesh(geo, shared, 2);
  g.add(a, b, c, lines, inst);
  s.add(g);
  return { s, a, b, c, lines, inst };
}

test("each material is compiled once, through the first object using it; an instanced mesh on its own (run 6 speed)", () => {
  const { s, a, c, lines, inst } = scene();
  assert.deepEqual(firstUsers(s), [a, c, lines, inst]);
});

test("the shaders compile one material a slice, then each program's first use is read ahead of the first frame", async () => {
  const { s } = scene();
  const compiled: unknown[] = [];
  const used: string[] = [];
  const programs = [0, 1, 2].map((i) => ({ getUniforms: () => used.push(`u${i}`), getAttributes: () => used.push(`a${i}`) }));
  const renderer: Compiler = {
    compileAsync: (o) => {
      compiled.push(o);
      return Promise.resolve();
    },
    info: { programs },
  };
  const c = clock();
  const warm = compileInSlices(renderer, s, new PerspectiveCamera(), { clock: c });
  assert.equal(compiled.length, 0, "nothing in the caller's task");
  await warm.done;
  assert.equal(compiled.length, 4);
  assert.deepEqual(used, ["u0", "a0", "u1", "a1", "u2", "a2"]);
  // the clock never moves, so each slice runs until the budget: two jobs, a pause before each slice
  assert.ok(c.pauses >= 2);
});

test("a compile that never finishes is waited for at most maxWait; a cancelled warm stops before reading the programs", async () => {
  const { s } = scene();
  let read = 0;
  const renderer: Compiler = {
    compileAsync: () => new Promise(() => undefined),
    info: { programs: [{ getUniforms: () => read++, getAttributes: () => read++ }] },
  };
  const slow = compileInSlices(renderer, s, new PerspectiveCamera(), { clock: clock(), maxWait: 5 });
  await slow.done;
  assert.equal(read, 2);
  read = 0;
  const stopped = compileInSlices(renderer, s, new PerspectiveCamera(), { clock: clock(), maxWait: 5 });
  stopped.cancel();
  await stopped.done;
  assert.equal(read, 0);
});
