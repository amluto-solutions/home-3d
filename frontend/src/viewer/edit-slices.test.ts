// An edit beside the editor's plan (#390): the floor it changed is modelled in slices before it is built (no long task
// after a nudge), every other floor stays as it is, and the slices' result is built on the next pass.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { floorsToSlice } from "./edit-slices.ts";

const shown = [
  { id: "ground", key: "g1" },
  { id: "upper", key: "u1" },
];
const on = { on: true, incremental: true, loading: false };
const none = () => undefined;

test("an item moved on one floor: only that floor is modelled in slices, the others are kept", () => {
  assert.deepEqual([...floorsToSlice(shown, new Map([["ground", "g2"], ["upper", "u1"]]), none, on)], ["ground"]);
});

test("nothing changed: nothing is sliced (and nothing rebuilt)", () => {
  assert.deepEqual([...floorsToSlice(shown, new Map([["ground", "g1"], ["upper", "u1"]]), none, on)], []);
});

test("the slices are done: the floor is built from them now, not modelled again", () => {
  const prepared = (id: string) => (id === "ground" ? "g2" : undefined);
  assert.deepEqual([...floorsToSlice(shown, new Map([["ground", "g2"], ["upper", "u1"]]), prepared, on)], []);
  // slices of an older edit do not count: the newest key is modelled
  const older = (id: string) => (id === "ground" ? "g2" : undefined);
  assert.deepEqual([...floorsToSlice(shown, new Map([["ground", "g3"], ["upper", "u1"]]), older, on)], ["ground"]);
});

test("a full rebuild, a home still loading, the House view and a floor gone leave none standing", () => {
  const keys = new Map([["ground", "g2"], ["upper", "u2"]]);
  assert.equal(floorsToSlice(shown, keys, none, { ...on, incremental: false }).size, 0);
  assert.equal(floorsToSlice(shown, keys, none, { ...on, loading: true }).size, 0);
  assert.equal(floorsToSlice(shown, keys, none, { ...on, on: false }).size, 0);
  assert.deepEqual([...floorsToSlice(shown, new Map([["upper", "u2"]]), none, on)], ["upper"]);
});

test("the viewer keeps a sliced floor's own plan until it is built, and the editor's 3D pane turns slicing on", () => {
  const viewer = readFileSync(new URL("./viewer3d.ts", import.meta.url), "utf8");
  assert.match(viewer, /if \(!stale\.has\(floor\.id\)\) kept\.floor = floor;/);
  assert.match(viewer, /else if \(stale\.size\) \{/);
  // a structural edit (walls, rooms) changes the floor's key like an item does: the floor is built anew from scratch
  // geometry; the light surface is kept only while rooms, walls and openings stay the same (lightSurfaceKey)
  assert.match(viewer, /had\?\.key === key && had\.surface === raw && had\.zonesSig === zonesSig/);
  const view = readFileSync(new URL("../components/view3d.ts", import.meta.url), "utf8");
  assert.match(view, /\.slicedEdits = this\.syncPace > 0;/);
});
