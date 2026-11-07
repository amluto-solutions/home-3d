import assert from "node:assert/strict";
import { test } from "node:test";
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshPhongMaterial, Scene, ShaderLib, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from "three";
import { makeFoldable } from "./fold.ts";
import { Realism } from "./realism.ts";
import { themed } from "./theme.ts";

function house() {
  const uniform = { value: 0 };
  const masks = { standing: { value: 0xffff }, glass: { value: 0 } };
  const wallMat = themed(makeFoldable(new MeshBasicMaterial({ vertexColors: true }), masks, "solid"), uniform);
  const wall = new Mesh(new BufferGeometry(), wallMat);
  const lineMat = themed(new LineBasicMaterial({ vertexColors: true }), uniform, true);
  const lines = new LineSegments(new BufferGeometry(), lineMat);
  const glowMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending });
  const glow = new Mesh(new BufferGeometry(), glowMat);
  const root = new Group();
  root.add(wall, lines, glow);
  const scene = new Scene();
  scene.add(root);
  return { scene, root, wall, wallMat, lines, lineMat, glow, glowMat };
}

test("the realistic look lights the surfaces and gives neon its own materials back", () => {
  const h = house();
  const r = new Realism();
  r.enable(h.scene, true);
  r.realize(h.root, true);
  assert.ok(h.wall.material instanceof MeshPhongMaterial);
  assert.ok(h.wall.castShadow && h.wall.receiveShadow);
  // lines and additive glow are not surfaces
  assert.equal(h.lines.material, h.lineMat);
  assert.equal(h.glow.material, h.glowMat);
  // the twin follows its neon material (a floor fading out): it no longer casts a shadow
  h.wallMat.transparent = true;
  h.wallMat.opacity = 0.3;
  r.realize(h.root, true);
  assert.equal((h.wall.material as MeshPhongMaterial).opacity, 0.3);
  assert.equal(h.wall.castShadow, false);
  // a cut wall leaves out its cut parts in the shadow too
  assert.ok(h.wall.customDepthMaterial);
  r.enable(h.scene, false);
  assert.equal(h.wall.material, h.wallMat);
  assert.equal(h.wall.castShadow, false);
  assert.equal(h.wall.customDepthMaterial, undefined);
  assert.ok(!h.scene.children.includes(r.group));
});

test("without shadows (phones) the surfaces are lit but cast none", () => {
  const h = house();
  const r = new Realism();
  r.enable(h.scene, true);
  r.realize(h.root, false);
  assert.ok(h.wall.material instanceof MeshPhongMaterial);
  assert.equal(h.wall.castShadow, false);
  assert.equal(h.wall.receiveShadow, false);
});

test("the lit surfaces read each vertex's material (#40); a geometry drawn without materials reads matt", () => {
  const h = house();
  h.wall.geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 2, 0, 0, 0, 2, 0], 3));
  const sofa = new Mesh(new BufferGeometry(), h.wallMat);
  sofa.geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  sofa.geometry.setAttribute("fp3dMat", new Float32BufferAttribute([2, 2, 2], 1));
  h.root.add(sofa);
  const r = new Realism();
  r.enable(h.scene, true);
  r.realize(h.root, true);
  assert.deepEqual([...(h.wall.geometry.getAttribute("fp3dMat").array as Float32Array)], [0, 0, 0, 0, 0, 0]);
  assert.deepEqual([...(sofa.geometry.getAttribute("fp3dMat").array as Float32Array)], [2, 2, 2], "an item's own are kept");
  // the twin's shader takes the attribute in
  const twin = h.wall.material as unknown as MeshPhongMaterial;
  const shader = { vertexShader: ShaderLib.phong.vertexShader, fragmentShader: ShaderLib.phong.fragmentShader, uniforms: {} } as unknown as WebGLProgramParametersWithUniforms;
  twin.onBeforeCompile(shader, {} as WebGLRenderer);
  assert.match(shader.vertexShader, /attribute float fp3dMat;/);
  // a geometry that grew (a floor drawn anew into the same geometry) gets a new one of its size
  h.wall.geometry.setAttribute("position", new Float32BufferAttribute(new Array(27).fill(0), 3));
  r.realize(h.root, true);
  assert.equal(h.wall.geometry.getAttribute("fp3dMat").count, 9);
});

test("disposing the look frees the depth materials it made for the shadows (#200)", () => {
  const h = house();
  const r = new Realism();
  r.enable(h.scene, true);
  r.realize(h.root, true);
  const depth = h.wall.customDepthMaterial;
  assert.ok(depth, "a folding wall casts a shadow through its own depth material");
  let freed = 0;
  depth.addEventListener("dispose", () => freed++);
  r.dispose();
  assert.equal(freed, 1);
});
