import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { emptyBuilding } from "../model.ts";
import { startGhost } from "./ghost.ts";
import type { FunLib } from "./pets.ts";

test("the ghost frees its geometries and materials when it is disposed (#200)", () => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.cancelAnimationFrame ??= () => undefined;
  // every mesh the ghost makes is noted, to see its geometry and material freed
  const made: THREE.Mesh[] = [];
  class Mesh extends THREE.Mesh {
    constructor(geo?: THREE.BufferGeometry, mat?: THREE.Material | THREE.Material[]) {
      super(geo, mat);
      made.push(this);
    }
  }
  const lib = { Group: THREE.Group, Mesh, MeshBasicMaterial: THREE.MeshBasicMaterial, Color: THREE.Color, BufferGeometry: THREE.BufferGeometry, Float32BufferAttribute: THREE.Float32BufferAttribute, DoubleSide: THREE.DoubleSide } as unknown as FunLib;
  const viewer = { floorMap: new Map(), invalidate() {}, animate() {}, low: false, resting: false };
  const ghost = startGhost({ lib, viewer, building: emptyBuilding(), night: () => false } as never);
  assert.ok(made.length > 0);
  const freed = new Set<unknown>();
  for (const m of made) {
    m.geometry.addEventListener("dispose", () => freed.add(m.geometry));
    (m.material as THREE.Material).addEventListener("dispose", () => freed.add(m.material));
  }
  ghost.dispose();
  for (const m of made) {
    assert.ok(freed.has(m.geometry), "geometry freed");
    assert.ok(freed.has(m.material), "material freed");
  }
});
