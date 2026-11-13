// Fun pack "pets": cats, dogs (five breeds, small to large) and rabbits that live in the 3D house. Each walks through
// the doors from room to room (the walk's floor map finds the way) and rests at its own kind of places only: a cat in
// its bed or cave, up on its cat tree or in its bed on a wall shelf, or – walking up from the front and jumping – on a
// real sofa, armchair or bed; a dog in its bed or basket, or on the floor in front of the sofa; both visit the bowls.
// Nothing else (an aquarium, a cage) is theirs. At night they sleep curled up. They are drawn only while they move;
// resting costs nothing. three.js comes from the 3D bundle (passed in).

import type * as THREE from "three";
import type { Building, Floor, Furniture, Pet, Vec2 } from "../model.ts";
import type { FloorMap, Obstacle } from "../viewer/walk.ts";
import { stairLinks, type Link } from "../geometry/stair-links.ts";
import { BED, isStaticPet, itemOf, petFloor, petSpots, placeAt, placeFloor, SOFA, subscribePets, type PetLive, type StaticPlace } from "../pet-place.ts";
import type { PetPlace } from "../model.ts";
import { disposeTree } from "./dispose.ts";

/** The three.js classes the pets need, lent by the 3D bundle (it has no ready-made spheres or boxes: shapes are made here). */
export type FunLib = Pick<typeof THREE, "Group" | "Mesh" | "MeshBasicMaterial" | "CanvasTexture" | "Color" | "PlaneGeometry" | "BufferGeometry" | "Float32BufferAttribute"> & { DoubleSide: typeof THREE.DoubleSide };

/** The parts of Home 3D's viewer the pets live in (reached at run time). */
export interface PetViewer {
  floorMap: Map<string, { group: THREE.Group; floor: Floor }>;
  invalidate(): void;
  /** A decoration moved: a frame soon (on the tablet level at its slower pace, none while it rests). */
  animate(): void;
  /** The tablet level, and whether its decorative animations rest (nobody touched the view for a while). */
  readonly low: boolean;
  readonly resting: boolean;
}

export interface PetsContext {
  lib: FunLib;
  FloorMap: typeof FloorMap;
  viewer: PetViewer;
  building: Building;
  pets: readonly Pet[];
  /** Whether it is night (the sun below the horizon). */
  night: () => boolean;
  /** Height of an item's bottom on its floor (an aquarium on a sideboard). */
  base: (floor: Floor, f: Furniture) => number;
  /** Doors their contact reports shut: the pets go round them (doors without a sensor count as open). */
  closedDoors?: () => ReadonlySet<string>;
  /** Height of the plan's surfaces (desk, table) at a point: a static pet put there sits on top. */
  surface?: (floor: Floor, x: number, z: number) => number;
  /** Roaming pets (#337): Home Assistant's connection and the home shown, to follow where the server puts the pets. */
  hass?: () => { connection: Parameters<typeof subscribePets>[0] } | undefined;
  home?: () => string | null | undefined;
}

export interface PetsController {
  update(building: Building, pets: readonly Pet[]): void;
  dispose(): void;
}

/**
 * Simple round solids as triangle lists, shaded lighter on top and darker below (the materials are unlit, so the
 * shading is in the vertex colours: it gives the animals their soft, round look).
 */
function shapes(lib: FunLib) {
  const geo = (pos: number[]) => {
    const g = new lib.BufferGeometry();
    g.setAttribute("position", new lib.Float32BufferAttribute(pos, 3));
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 1; i < pos.length; i += 3) {
      lo = Math.min(lo, pos[i]);
      hi = Math.max(hi, pos[i]);
    }
    const col: number[] = [];
    for (let i = 0; i < pos.length; i += 3) {
      const k = hi > lo ? (pos[i + 1] - lo) / (hi - lo) : 1;
      const c = 0.66 + 0.34 * k;
      col.push(c, c, c);
    }
    g.setAttribute("color", new lib.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere();
    return g;
  };
  /** A ring-based solid round the y axis: radius per height (bottom to top), n sides. */
  const lathe = (rings: [number, number][], n: number) => {
    const pos: number[] = [];
    for (let i = 0; i < rings.length - 1; i++) {
      const [r0, y0] = rings[i];
      const [r1, y1] = rings[i + 1];
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2;
        const a1 = ((k + 1) / n) * Math.PI * 2;
        const p = (r: number, y: number, a: number) => [Math.cos(a) * r, y, Math.sin(a) * r];
        pos.push(...p(r0, y0, a0), ...p(r1, y1, a0), ...p(r1, y1, a1), ...p(r0, y0, a0), ...p(r1, y1, a1), ...p(r0, y0, a1));
      }
    }
    return geo(pos);
  };
  const sphere = (n: number) => lathe(Array.from({ length: n / 2 + 1 }, (_, i): [number, number] => [Math.sin((i / (n / 2)) * Math.PI) * 0.5, -Math.cos((i / (n / 2)) * Math.PI) * 0.5]), n);
  /**
   * A soft tube along a smooth curve through the points (a cat's tail), its radius going from r0 to r1, the end
   * rounded off; the start is open (it sits inside the body).
   */
  const tube = (ctrl: [number, number, number][], r0: number, r1: number, n = 7, sub = 3) => {
    // Catmull-Rom through the points
    const pts: [number, number, number][] = [];
    const at = (i: number) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
    for (let i = 0; i < ctrl.length - 1; i++) {
      for (let s = 0; s < sub; s++) {
        const t = s / sub;
        const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
        pts.push([0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t)) as [number, number, number]);
      }
    }
    pts.push(ctrl[ctrl.length - 1]);
    const norm = (v: number[]) => {
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / l, v[1] / l, v[2] / l];
    };
    const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const tan = pts.map((_, i) => norm([0, 1, 2].map((k) => pts[Math.min(pts.length - 1, i + 1)][k] - pts[Math.max(0, i - 1)][k])));
    // rings round the curve, turned along with it (parallel transport), then the rounded tip
    let nrm = norm(cross(tan[0], Math.abs(tan[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const rings: { c: number[]; r: number; n: number[]; b: number[] }[] = [];
    pts.forEach((c, i) => {
      if (i) nrm = norm(cross(cross(tan[i], nrm), tan[i]));
      rings.push({ c, r: r0 + ((r1 - r0) * i) / (pts.length - 1), n: nrm, b: cross(tan[i], nrm) });
    });
    const last = rings[rings.length - 1];
    const t1 = tan[tan.length - 1];
    for (const [k, f] of [[0.55, 0.8], [0.9, 0.4], [1, 0]]) rings.push({ c: [0, 1, 2].map((j) => last.c[j] + t1[j] * r1 * k), r: r1 * f, n: last.n, b: last.b });
    const pos: number[] = [];
    const p = (g: (typeof rings)[number], a: number) => [0, 1, 2].map((j) => g.c[j] + g.r * (Math.cos(a) * g.n[j] + Math.sin(a) * g.b[j]));
    for (let i = 0; i < rings.length - 1; i++) {
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2;
        const a1 = ((k + 1) / n) * Math.PI * 2;
        pos.push(...p(rings[i], a0), ...p(rings[i], a1), ...p(rings[i + 1], a1), ...p(rings[i], a0), ...p(rings[i + 1], a1), ...p(rings[i + 1], a0));
      }
    }
    return geo(pos);
  };
  return {
    /** A unit sphere (diameter 1): scale it to an ellipsoid. */
    ball: sphere(14),
    /** The same, coarser, for small parts (eyes, nose, paws). */
    pea: sphere(8),
    /** In between, for middle-sized parts. */
    bun: sphere(10),
    /** A whisker: a thin cross of two strips along x from 0 to 1 (seen from any side), 1 wide; drawn both sides. */
    ribbon: geo([0, -0.5, 0, 1, -0.5, 0, 1, 0.5, 0, 0, -0.5, 0, 1, 0.5, 0, 0, 0.5, 0, 0, 0, -0.5, 1, 0, -0.5, 1, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 0, 0, 0.5]),
    lathe,
    tube,
    cylinder: (rTop: number, rBottom: number, h: number, n = 8) => lathe([[0, -h / 2], [rBottom, -h / 2], [rTop, h / 2], [0, h / 2]], n),
    cone: (r: number, h: number, n = 8) => lathe([[0, -h / 2], [r, -h / 2], [0, h / 2]], n),
  };
}

/** A coat: its main colour, the chest and belly, and patches (if any) over its back and head. */
const FURS: Record<string, [string, string, ...string[]]> = {
  orange: ["#e0954a", "#fbe6cf"],
  tabby: ["#a8865d", "#e8d6bb"],
  black: ["#2c2c33", "#5a5a66"],
  white: ["#f1f1f4", "#e6e1e4"],
  grey: ["#9097a3", "#d9dce2"],
  brown: ["#7d5536", "#d4a97c"],
  // #205: white with orange and black patches (it was white with an orange chest and face, no patches)
  calico: ["#f4f0e8", "#f8f5ef", "#e09045", "#3a3536"],
  golden: ["#e3b46b", "#f7e3bd"],
  cream: ["#efe0c4", "#fff6e6"],
  // #42: white with grey and cream patches
  dilute_calico: ["#f3efe8", "#f7f4ee", "#8e939c", "#e3c79a"],
  // #42: solid blue-grey all over (British shorthair), no lighter chest
  blue_grey: ["#7f8999", "#7f8999"],
};

/** Eye colours round a dark pupil (#42); "dark" eyes have no iris, as before. */
const IRISES: Record<string, string> = {
  copper: "#c8682a",
  green: "#6fae3e",
  yellow: "#e2c22e",
  blue: "#4f8fd8",
};

/** The look of a kind (or a dog's breed): body length/width/height, legs, head, snout, ears, tail, speed (m/s). */
interface Look {
  len: number;
  wid: number;
  hi: number;
  leg: number;
  head: number;
  snout: number;
  ears: "cat" | "bunny" | "floppy" | "pointy";
  tail: "cat" | "dog" | "curl" | "bushy" | "pom";
  speed: number;
}

const LOOKS: Record<string, Look> = {
  cat: { len: 0.32, wid: 0.17, hi: 0.16, leg: 0.09, head: 0.115, snout: 0, ears: "cat", tail: "cat", speed: 0.55 },
  rabbit: { len: 0.27, wid: 0.19, hi: 0.17, leg: 0.04, head: 0.09, snout: 0, ears: "bunny", tail: "pom", speed: 0.6 },
  dachshund: { len: 0.48, wid: 0.14, hi: 0.14, leg: 0.07, head: 0.105, snout: 0.08, ears: "floppy", tail: "dog", speed: 0.7 },
  pug: { len: 0.3, wid: 0.21, hi: 0.18, leg: 0.1, head: 0.13, snout: 0.02, ears: "floppy", tail: "curl", speed: 0.55 },
  terrier: { len: 0.32, wid: 0.16, hi: 0.16, leg: 0.13, head: 0.11, snout: 0.06, ears: "pointy", tail: "dog", speed: 0.8 },
  labrador: { len: 0.56, wid: 0.23, hi: 0.23, leg: 0.24, head: 0.14, snout: 0.09, ears: "floppy", tail: "dog", speed: 0.85 },
  shepherd: { len: 0.62, wid: 0.23, hi: 0.25, leg: 0.3, head: 0.14, snout: 0.11, ears: "pointy", tail: "bushy", speed: 0.9 },
};

const lookOf = (pet: Pet): Look => (pet.kind === "dog" ? (LOOKS[pet.breed ?? "labrador"] ?? LOOKS.labrador) : LOOKS[pet.kind]);

interface Model {
  root: THREE.Group;
  body: THREE.Group;
  legs: THREE.Group[];
  tail: THREE.Group;
  head: THREE.Group;
  eyes: THREE.Group[];
  zzz: THREE.Mesh;
  /**
   * A cat (#205) poses itself: walking (legs, head, tail and blinking follow the step phase), standing (head down at
   * the bowls), sitting, lying like a loaf, or curled up asleep with the tail round it. Other animals have none: the
   * pets' own animation moves their parts.
   */
  set?: (pose: CatPose, phase: number, headDown?: boolean) => void;
}

type CatPose = "walk" | "stand" | "sit" | "lie" | "curl" | "groom";

/** A round, friendly animal in the colours of its fur: big head, dark eyes with a shine, a little nose. */
export function buildModel(lib: FunLib, pet: Pet): Model {
  if (pet.kind === "cat") return buildCat(lib, pet);
  const S = shapes(lib);
  const L = lookOf(pet);
  const [main, second, ...patchColours] = FURS[pet.fur] ?? FURS.orange;
  const m1 = new lib.MeshBasicMaterial({ color: main, vertexColors: true });
  const m2 = new lib.MeshBasicMaterial({ color: second, vertexColors: true });
  const earMat = new lib.MeshBasicMaterial({ color: new lib.Color(main).multiplyScalar(0.78), vertexColors: true });
  const paw = new lib.MeshBasicMaterial({ color: new lib.Color(main).lerp(new lib.Color(second), 0.6), vertexColors: true });
  const dark = new lib.MeshBasicMaterial({ color: "#16161c" });
  const shine = new lib.MeshBasicMaterial({ color: "#ffffff" });
  const irisColour = pet.eyes ? IRISES[pet.eyes] : undefined;
  const iris = irisColour ? new lib.MeshBasicMaterial({ color: irisColour }) : null;
  const nose = new lib.MeshBasicMaterial({ color: pet.kind === "dog" ? "#1d1d22" : "#f08aa0" });
  const patches = patchColours.map((c) => new lib.MeshBasicMaterial({ color: c, vertexColors: true }));
  const ball = (mat: THREE.Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) => {
    const m = new lib.Mesh(S.ball, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    return m;
  };
  const root = new lib.Group();
  const body = new lib.Group();
  root.add(body);
  const cy = L.leg + L.hi / 2;
  // the body: a soft ellipsoid, the chest and belly lighter
  body.add(ball(m1, L.wid, L.hi, L.len, 0, cy, 0), ball(m2, L.wid * 0.78, L.hi * 0.72, L.len * 0.55, 0, cy - L.hi * 0.12, L.len * 0.16));
  // patches (a calico's): rounded shapes just breaking through the back, one towards the tail, one at the shoulder
  if (patches[0]) body.add(ball(patches[0], L.wid * 0.72, L.hi * 0.7, L.len * 0.5, L.wid * 0.22, cy + L.hi * 0.18, -L.len * 0.17));
  if (patches[1]) body.add(ball(patches[1], L.wid * 0.66, L.hi * 0.7, L.len * 0.42, -L.wid * 0.24, cy + L.hi * 0.16, L.len * 0.14));
  // stubby legs with light paws, pivot at the hip
  const legs: THREE.Group[] = [];
  const lr = Math.min(0.04, L.wid * 0.17);
  for (const [x, z] of [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    const g = new lib.Group();
    const hip = L.leg + L.hi * 0.25;
    g.position.set(x * L.wid * 0.27, hip, z * L.len * 0.3);
    const leg = new lib.Mesh(S.cylinder(lr * 0.9, lr, hip, 8), m1);
    leg.position.y = -hip / 2;
    g.add(leg, ball(paw, lr * 2.3, lr * 1.4, lr * 2.6, 0, -hip + lr * 0.6, lr * 0.3));
    body.add(g);
    legs.push(g);
  }
  // the head: big and round, raised at the front
  const head = new lib.Group();
  const h = L.head;
  head.position.set(0, L.leg + L.hi * 0.9 + h * 0.45, L.len / 2 + h * 0.45);
  head.add(ball(m1, h * 2.15, h * 1.95, h * 1.95));
  // patches over one ear and the other side of the crown, clear of the eyes
  if (patches[0]) head.add(ball(patches[0], h * 1.3, h * 1.1, h * 1.6, h * 0.45, h * 0.45, -h * 0.05));
  if (patches[1]) head.add(ball(patches[1], h * 1.1, h * 1.0, h * 1.3, -h * 0.5, h * 0.35, -h * 0.25));
  // muzzle: a dog's snout forward, a cat's and rabbit's small cheeks, and the nose
  const sn = Math.max(0.025, L.snout);
  head.add(ball(m2, h * 1.05, h * 0.8, sn * 1.6 + h * 0.5, 0, -h * 0.32, h * 0.72 + sn * 0.45));
  head.add(ball(nose, h * 0.28, h * 0.2, h * 0.2, 0, -h * 0.12, h * 0.95 + sn * 1.1));
  const eyes: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    // the eyes: dark, round, with a shine (closed when sleeping); coloured ones have an iris round the dark pupil
    const e = new lib.Group();
    e.position.set(side * h * 0.42, h * 0.12, h * 0.82);
    if (iris) {
      const slit = L.ears === "cat";
      e.add(ball(iris, h * 0.34, h * 0.38, h * 0.2), ball(dark, h * (slit ? 0.1 : 0.17), h * (slit ? 0.3 : 0.2), h * 0.12, 0, 0, h * 0.05));
    } else e.add(ball(dark, h * 0.34, h * 0.38, h * 0.2));
    e.add(ball(shine, h * 0.11, h * 0.11, h * 0.08, side * -h * 0.05, h * 0.08, h * 0.08));
    head.add(e);
    eyes.push(e);
    if (L.ears === "cat") {
      const ear = new lib.Mesh(S.cone(h * 0.4, h * 0.75, 4), m1);
      ear.position.set(side * h * 0.55, h * 0.88, -h * 0.05);
      ear.rotation.set(0, Math.PI / 4, side * -0.35);
      const inner = new lib.Mesh(S.cone(h * 0.22, h * 0.45, 4), nose);
      inner.position.set(side * h * 0.53, h * 0.84, h * 0.06);
      inner.rotation.set(0, Math.PI / 4, side * -0.35);
      head.add(ear, inner);
    } else if (L.ears === "bunny") {
      const ear = ball(m1, h * 0.5, h * 2.2, h * 0.3, side * h * 0.35, h * 1.6, -h * 0.15);
      ear.rotation.z = side * -0.18;
      const inner = ball(nose, h * 0.26, h * 1.6, h * 0.1, side * h * 0.35, h * 1.6, -h * 0.02);
      inner.rotation.z = side * -0.18;
      head.add(ear, inner);
    } else if (L.ears === "floppy") {
      const ear = ball(earMat, h * 0.35, h * 1.1, h * 0.75, side * h * 0.98, -h * 0.15, -h * 0.05);
      ear.rotation.z = side * 0.25;
      head.add(ear);
    } else {
      const ear = new lib.Mesh(S.cone(h * 0.32, h * 0.95, 6), m1);
      ear.position.set(side * h * 0.5, h * 1.0, -h * 0.1);
      ear.rotation.z = side * -0.2;
      head.add(ear);
    }
  }
  body.add(head);
  // the tail, pivot at its root
  const tail = new lib.Group();
  tail.position.set(0, L.leg + L.hi * 0.7, -L.len / 2 + 0.01);
  if (L.tail === "pom") tail.add(ball(m2, 0.08, 0.08, 0.08));
  else if (L.tail === "curl") tail.add(ball(m1, 0.07, 0.07, 0.06, 0, 0.03, -0.01));
  else {
    const tl = L.tail === "cat" ? 0.28 : L.tail === "bushy" ? 0.26 : 0.18;
    const thick = L.tail === "bushy" ? 0.045 : L.tail === "cat" ? 0.024 : 0.022;
    if (L.tail === "bushy") tail.add(ball(m1, thick * 2, tl, thick * 2, 0, tl / 2, 0));
    else {
      const t = new lib.Mesh(S.cylinder(thick * 0.75, thick, tl, 8), m1);
      t.position.y = tl / 2;
      tail.add(t);
    }
    if (L.tail === "cat") tail.add(ball(m1, thick * 1.8, thick * 1.8, thick * 1.8, 0, tl, 0));
  }
  body.add(tail);
  const zzz = zzzCard(lib, L.hi + h * 2 + 0.12);
  root.add(zzz);
  return { root, body, legs, tail, head, eyes, zzz };
}

/** "z Z" over a sleeping pet, on a card tilted towards the usual view from above (hidden until it sleeps). */
function zzzCard(lib: FunLib, y: number): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#cfe9ff";
  g.font = "bold 40px system-ui, sans-serif";
  g.fillText("z", 20, 52);
  g.font = "bold 54px system-ui, sans-serif";
  g.fillText("Z", 58, 46);
  const zzz = new lib.Mesh(new lib.PlaneGeometry(0.3, 0.15), new lib.MeshBasicMaterial({ map: new lib.CanvasTexture(c), transparent: true, depthWrite: false, side: lib.DoubleSide }));
  zzz.rotation.x = -0.7;
  zzz.position.set(0, y, 0);
  zzz.visible = false;
  return zzz;
}

/**
 * The parts that never move on their own, one mesh per material (fewer draw calls): each part's place, turn and size
 * baked into its triangles, its shading kept.
 */
function mergeParts(lib: FunLib, parts: THREE.Object3D[]): THREE.Object3D[] {
  const byMat = new Map<THREE.Material, THREE.Mesh[]>();
  const out: THREE.Object3D[] = [];
  for (const o of parts) {
    const m = o as THREE.Mesh;
    if (!m.isMesh) out.push(o);
    else byMat.set(m.material as THREE.Material, [...(byMat.get(m.material as THREE.Material) ?? []), m]);
  }
  for (const [material, meshes] of byMat) {
    if (meshes.length === 1) {
      out.push(meshes[0]);
      continue;
    }
    const pos: number[] = [];
    const col: number[] = [];
    for (const m of meshes) {
      m.updateMatrix();
      const e = m.matrix.elements;
      const a = m.geometry.getAttribute("position");
      const c = m.geometry.getAttribute("color");
      for (let i = 0; i < a.count; i++) {
        const [x, y, z] = [a.getX(i), a.getY(i), a.getZ(i)];
        pos.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
        col.push(c.getX(i), c.getY(i), c.getZ(i));
      }
    }
    const g = new lib.BufferGeometry();
    g.setAttribute("position", new lib.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new lib.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere();
    out.push(new lib.Mesh(g, material));
  }
  return out;
}

type V3 = [number, number, number];

/**
 * The cat (#205): a cute kitten. What makes it read as a cat rather than a dog: a flat face (cheeks and whisker pads
 * no further forward than the face) that is wider than tall, a small triangle of a nose, whiskers, big round eyes,
 * big upright triangular ears on the corners of the head, the head close on the shoulders, a back that arches at the
 * rump, slim legs tucked under it with the paws close together, and a tail held up with a hook at its tip. Each pose
 * has its own body and tail, shown one at a time: standing and walking, sitting upright (a pear with the tail round
 * the front paws), lying like a loaf, and curled up asleep (a round cushion with the tail round it). The head, eyes,
 * legs and walking tail are shared and moved by `set`. Simple round shapes only; the parts that never move on their
 * own are merged into one mesh per material.
 */
function buildCat(lib: FunLib, pet: Pet): Model {
  const S = shapes(lib);
  const [main, second, ...patchColours] = FURS[pet.fur] ?? FURS.orange;
  const mat = (color: string | THREE.Color, shaded = true) => new lib.MeshBasicMaterial({ color, vertexColors: shaded });
  const m1 = mat(main);
  const m2 = mat(second);
  const paw = mat(new lib.Color(main).lerp(new lib.Color(second), 0.6));
  const pink = mat("#f08aa0", false);
  const dark = mat("#16161c", false);
  const shine = mat("#ffffff", false);
  const irisColour = pet.eyes ? IRISES[pet.eyes] : undefined;
  const iris = irisColour ? mat(irisColour, false) : null;
  const patches = patchColours.map((c) => mat(c));
  const light = new lib.Color(main).getHSL({ h: 0, s: 0, l: 0 }).l;
  // whiskers grey on a light coat, white on a darker one; shut eyes light on a dark coat, so they show
  const whiskerMat = new lib.MeshBasicMaterial({ color: light > 0.6 ? "#8d939e" : "#f2f2f4", side: lib.DoubleSide });
  whiskerMat.name = "whiskers";
  const lidMat = light < 0.25 ? mat("#9a9aa6", false) : dark;
  // a tabby's darker stripes
  const stripe = pet.fur === "tabby" ? mat(new lib.Color(main).multiplyScalar(0.7)) : null;
  const ball = (m: THREE.Material, [sx, sy, sz]: V3, [x, y, z]: V3 = [0, 0, 0], g: THREE.BufferGeometry = S.ball, rot?: V3) => {
    const o = new lib.Mesh(g, m);
    o.scale.set(sx, sy, sz);
    o.position.set(x, y, z);
    if (rot) o.rotation.set(...rot);
    return o;
  };
  const group = (...parts: THREE.Object3D[]) => {
    const g = new lib.Group();
    if (parts.length) g.add(...mergeParts(lib, parts));
    return g;
  };
  /** A patch (a calico's) breaking through the top of a round part (its size and centre), shifted sideways and along. */
  const patch = (i: number, [sx, sy, sz]: V3, [x, y, z]: V3, dx: number, dz: number, k = 0.66) => (patches[i] ? [ball(patches[i], [sx * k, sy * k, sz * k], [x + dx * sx, y + sy * 0.23, z + dz * sz], S.bun)] : []);
  /** A tabby's stripes across a round part: thin slices of it, raised a little, so they show over the back only. */
  const stripes = ([sx, sy, sz]: V3, [x, y, z]: V3, at: number[]) => (stripe ? at.map((k) => ball(stripe, [sx * Math.sqrt(1 - k * k), sy * Math.sqrt(1 - k * k), 0.016], [x, y + sy * 0.06, z + (k * sz) / 2], S.bun)) : []);
  const tailOf = (ctrl: V3[]) => new lib.Mesh(S.tube(ctrl, TR0, TR1), m1);

  // the kitten's proportions (metres): body and head half sizes, legs, the arch of its back, its tail
  const [bx, by, bz] = [0.07, 0.07, 0.13];
  const [hx, hy, hz] = [0.085, 0.075, 0.075];
  const LEG = 0.06;
  const LEG_R = 0.016;
  const ARCH = 0.5;
  const [TL, TR0, TR1, HOOK] = [0.18, 0.016, 0.011, 0.8];
  const cy = LEG + by;
  const root = new lib.Group();
  const body = new lib.Group();
  root.add(body);

  // standing and walking: a chest and a rump that arches up, the chest and belly lighter
  const chest: [V3, V3] = [[bx * 1.84, by * 1.8, bz * 1.24], [0, cy - by * 0.05, bz * 0.36]];
  const rump: [V3, V3] = [[bx * 2, by * 2 * (1 + 0.08 * ARCH), bz * 1.36], [0, cy + by * 0.14 * ARCH, -bz * 0.3]];
  const stand = group(ball(m1, ...chest), ball(m1, ...rump), ball(m2, [bx * 1.4, by * 1.3, bz * 1.0], [0, cy - by * 0.32, bz * 0.42], S.bun), ...stripes(...rump, [-0.55, -0.1, 0.35]), ...patch(0, ...rump, 0.18, -0.05), ...patch(1, ...chest, -0.2, 0.05, 0.6));
  /** How far the body sinks when it lies like a loaf. */
  const LIE = LEG + by * 0.02;

  // sitting: a pear on its haunches, the front legs straight down in front, the tail round the front paws
  const hs = LEG * 1.2 + by * 2.7;
  const sz0 = -bz * 0.15;
  const pear: [V3, V3] = [[bx * 2, hs, bx * 1.9], [0, hs / 2, sz0]];
  const sitTail = [-100, -55, -10, 30, 65, 95].map((d, i): V3 => {
    const a = (d * Math.PI) / 180;
    return [Math.cos(a) * bx * 1.2, i ? TR0 * 0.95 : by * 0.6, sz0 + Math.sin(a) * bx * 1.2];
  });
  const sit = group(
    ball(m1, [1, 1, 0.95], [0, 0, sz0], S.lathe([[0, 0], [bx * 0.85, hs * 0.03], [bx, hs * 0.2], [bx * 0.95, hs * 0.4], [bx * 0.8, hs * 0.6], [bx * 0.66, hs * 0.8], [bx * 0.5, hs * 0.93], [0, hs]], 14)),
    ball(m1, [bx * 1.0, hs * 0.5, bz * 0.95], [bx * 0.55, hs * 0.25, sz0 - bz * 0.05], S.bun),
    ball(m1, [bx * 1.0, hs * 0.5, bz * 0.95], [-bx * 0.55, hs * 0.25, sz0 - bz * 0.05], S.bun),
    ball(m2, [bx * 1.0, hs * 0.5, bx * 0.5], [0, hs * 0.5, sz0 + bx * 0.72], S.bun),
    ball(paw, [LEG_R * 2.3, LEG_R * 1.3, LEG_R * 2.8], [bx * 0.72, LEG_R * 0.65, sz0 + bx * 0.62], S.pea),
    ball(paw, [LEG_R * 2.3, LEG_R * 1.3, LEG_R * 2.8], [-bx * 0.72, LEG_R * 0.65, sz0 + bx * 0.62], S.pea),
    tailOf(sitTail),
    ...patch(0, ...pear, 0.2, -0.3),
    ...patch(1, [bx * 1.6, hs * 0.6, bx * 1.5], [0, hs * 0.55, sz0], -0.22, -0.25),
  );

  // lying like a loaf: the standing body sunk down, the tail along its side on the floor
  const lie = group(tailOf([[0, cy + by * 0.3, -bz * 0.9], [bx * 0.5, LIE + TR0 * 1.2, -bz * 1.12], [bx * 1.05, LIE + TR0, -bz * 0.62], [bx * 1.15, LIE + TR0, 0], [bx * 1.05, LIE + TR0, bz * 0.5]]));

  // curled up asleep: a round cushion, the paws under the chin, the tail round the front
  const R = (bx + bz) / 2;
  const cushion: [V3, V3] = [[R * 2.1, by * 1.7, R * 2], [0, by * 0.85, 0]];
  const ring = (deg: number, y: number): V3 => [Math.cos((deg * Math.PI) / 180) * R * 1.03, y, Math.sin((deg * Math.PI) / 180) * R * 1.03];
  const curl = group(
    ball(m1, ...cushion),
    ball(m1, [R * 1.25, by * 1.9, R * 1.25], [R * 0.35, by * 0.95, -R * 0.4], S.bun),
    ball(m1, [R, by * 1.6, R], [-R * 0.4, by * 0.8, R * 0.2], S.bun),
    ball(m2, [R * 0.7, by * 0.9, R * 0.6], [-R * 0.25, by * 0.45, R * 0.72], S.bun),
    ball(paw, [LEG_R * 2.2, LEG_R * 1.2, LEG_R * 2.6], [-R * 0.62, LEG_R * 0.6, R * 0.88], S.pea),
    ball(paw, [LEG_R * 2.2, LEG_R * 1.2, LEG_R * 2.6], [-R * 0.18, LEG_R * 0.6, R * 1.02], S.pea),
    tailOf([ring(-95, by * 0.7), ring(-50, TR0 * 1.1), ring(0, TR0 * 1.1), ring(45, TR0 * 1.1), ring(85, TR0 * 1.1), ring(118, TR0)]),
    ...stripes([R * 1.25, by * 1.9, R * 1.25], [R * 0.35, by * 0.95, -R * 0.4], [-0.4, 0.2]),
    ...patch(0, ...cushion, 0.15, -0.18, 0.6),
    ...patch(1, ...cushion, -0.2, 0.08, 0.5),
  );
  body.add(stand, sit, lie, curl);

  // slim legs tucked under the body, the paws close together; the hind legs with round thighs. A front leg's shank is
  // a part of its own (lying, only the paw peeks out); a hind leg is one piece with its thigh.
  const hipY = LEG + by * 0.5;
  const HIPS: V3[] = [[-bx * 0.42, hipY, bz * 0.52], [bx * 0.42, hipY, bz * 0.52], [-bx * 0.45, hipY, -bz * 0.55], [bx * 0.45, hipY, -bz * 0.55]];
  const legParts = HIPS.map(([x, y, z], i) => {
    const g = new lib.Group();
    g.position.set(x, y, z);
    const shank = new lib.Mesh(S.cylinder(LEG_R, LEG_R * 0.85, hipY, 8), m1);
    shank.position.y = -hipY / 2;
    const foot = ball(paw, [LEG_R * 2.3, LEG_R * 1.3, LEG_R * 2.7], [0, -hipY + LEG_R * 0.65, LEG_R * 0.3], S.pea);
    if (i >= 2) g.add(...mergeParts(lib, [shank, ball(m1, [LEG_R * 3, by * 1.1, bz * 0.5], [Math.sign(x) * LEG_R * 0.3, -by * 0.15, 0], S.bun)]), foot);
    else g.add(shank, foot);
    body.add(g);
    return { g, shank };
  });

  // the tail: up from the rump, the tip hooked over
  const tailGroup = group(tailOf([[0, 0, 0], [0, TL * 0.28, -TL * 0.16], [0, TL * 0.62, -TL * 0.2], [0, TL * 0.88, -TL * 0.1], [0, TL * (0.98 - 0.04 * HOOK), TL * 0.08 * HOOK], [0, TL * 0.9, TL * 0.13 * HOOK]]));
  tailGroup.position.set(0, cy + by * (0.45 + 0.2 * ARCH), -bz * 0.92);
  body.add(tailGroup);

  // the head: wider than tall, a flat face: soft cheeks, whisker pads and a chin flush with it, a small triangle of a
  // nose (point down), whiskers
  const zs = (x: number, y: number) => hz * Math.sqrt(Math.max(0.05, 1 - x * x - y * y));
  const face: THREE.Object3D[] = [ball(m1, [hx * 2, hy * 2, hz * 2])];
  for (const s of [-1, 1]) {
    face.push(ball(m1, [hx * 0.975, hy, hz * 1.2], [s * hx * 0.42, -hy * 0.36, hz * 0.2]), ball(m2, [hx * 0.44, hy * 0.38, hz * 0.26], [s * hx * 0.19, -hy * 0.42, zs(0.19, 0.42) - hz * 0.1], S.pea));
    for (const tilt of [0.24, -0.22]) face.push(ball(whiskerMat, [0.06, 0.0018, 0.0018], [s * hx * 0.3, -hy * (tilt > 0 ? 0.42 : 0.48), zs(0.3, 0.45) - hz * 0.04], S.ribbon, [0, s > 0 ? 0.25 : Math.PI - 0.25, tilt]));
  }
  face.push(ball(m2, [hx * 0.36, hy * 0.26, hz * 0.3], [0, -hy * 0.68, zs(0, 0.68) - hz * 0.12], S.pea));
  face.push(ball(pink, [hx * 0.17, hy * 0.13, hz * 0.08], [0, -hy * 0.2, zs(0, 0.2) - hz * 0.01], S.cone(0.5, 1, 3), [0, -Math.PI / 2, Math.PI]));
  // a tabby's "M" on the forehead
  if (stripe) for (const x of [-0.018, 0, 0.018]) face.push(ball(stripe, [0.008, 0.03, 0.009], [x, hy * 0.6, zs(x / hx, 0.6) - 0.002], S.pea, [-0.75, x * 8, 0]));
  const skull: [V3, V3] = [[hx * 2, hy * 2, hz * 2], [0, 0, 0]];
  const head = group(...face, ...patch(0, ...skull, 0.24, -0.03, 0.66), ...patch(1, ...skull, -0.25, -0.15, 0.55));
  // big upright triangular ears on the corners of the head, pink inside; the one over a patch takes its colour
  const [ew, eh] = [0.045, 0.09];
  const earShape = S.cone(0.5, 1, 4);
  for (const s of [-1, 1]) {
    const outer = s > 0 && patches[0] ? patches[0] : s < 0 && patches[1] ? patches[1] : m1;
    const ear = new lib.Group();
    ear.add(ball(outer, [ew * 2, eh, ew * 0.75], [0, eh / 2, 0], earShape, [0, Math.PI / 4, 0]), ball(pink, [ew * 1.2, eh * 0.72, ew * 0.3], [0, eh * 0.4, ew * 0.24], earShape, [0, Math.PI / 4, 0]));
    ear.position.set(s * hx * 0.56, hy * 0.6, -hz * 0.12);
    ear.rotation.set(-0.1, 0, -s * 0.18);
    head.add(ear);
  }
  // big round eyes: the iris (dark without an eye colour) round a big pupil, two shines; shut, a thin arc
  const eyes: THREE.Group[] = [];
  const open: THREE.Object3D[] = [];
  const shut: THREE.Object3D[] = [];
  const lidShape = S.tube([[-0.5, 0.1, 0.2], [-0.25, -0.15, 0.32], [0, -0.22, 0.36], [0.25, -0.15, 0.32], [0.5, 0.1, 0.2]], 0.1, 0.1, 4, 2);
  const [w, h, d] = [0.036, 0.04, hz * 0.2];
  for (const s of [-1, 1]) {
    const e = new lib.Group();
    e.position.set(s * hx * 0.4, hy * 0.02, zs(0.4, 0.02) - hz * 0.06);
    e.rotation.y = s * 0.38;
    const parts = mergeParts(lib, [ball(iris ?? dark, [w, h, d]), ball(dark, [w * 0.62, h * 0.66, d * 0.8], [0, -h * 0.04, d * 0.22], S.pea), ball(shine, [w * 0.16, w * 0.16, d * 0.4], [s * w * 0.18, -h * 0.22, d * 0.42], S.pea), ball(shine, [w * 0.34, w * 0.34, d * 0.4], [-s * w * 0.2, h * 0.22, d * 0.42], S.pea)]);
    const lid = ball(lidMat, [w * 1.1, w * 1.1, d * 2.2], [0, 0, 0], lidShape);
    lid.visible = false;
    e.add(...parts, lid);
    open.push(...parts);
    shut.push(lid);
    head.add(e);
    eyes.push(e);
  }
  body.add(head);
  const zzz = zzzCard(lib, by * 2 + hy * 2 + 0.12);
  root.add(zzz);

  const set = (as: CatPose, phase: number, headDown = false) => {
    // grooming (#337): sitting, the head bent to a raised front paw
    const groom = as === "groom";
    const pose = groom ? "sit" : as;
    const walking = pose === "walk";
    const upright = walking || pose === "stand";
    stand.visible = upright || pose === "lie";
    sit.visible = pose === "sit";
    lie.visible = pose === "lie";
    curl.visible = pose === "curl";
    tailGroup.visible = upright;
    body.position.y = pose === "lie" ? -LIE : 0;
    const swing = walking ? Math.sin(phase) : 0;
    legParts.forEach(({ g, shank }, i) => {
      g.visible = upright || (i < 2 && (pose === "sit" || pose === "lie"));
      g.position.set(...HIPS[i]);
      g.rotation.x = upright ? (i === 0 || i === 3 ? swing : -swing) * 0.45 : 0;
      shank.visible = pose !== "lie";
      if (pose === "sit") g.position.set(HIPS[i][0] * 0.7, hipY, sz0 + bx * 0.72);
      // lying: the front paws peek out in front, under the chest
      if (pose === "lie") g.position.set(HIPS[i][0] * 0.8, LIE + hipY, bz * 0.82);
      if (groom && !i) {
        g.position.y += 0.05;
        g.rotation.x = -1.2;
      }
    });
    // the head close on the shoulders: over the chest standing, on top of the pear sitting, resting curled up
    if (pose === "sit") head.position.set(0, hs + hy * 0.5, sz0 + bx * 0.35);
    else if (pose === "curl") head.position.set(-R * 0.36, hy * 0.92, R * 0.6);
    else head.position.set(0, cy + by * 0.85 + hy * 0.5, bz * 0.72);
    if (pose === "curl") head.rotation.set(0.25, 0.35, 0.15);
    else if (groom) head.rotation.set(0.45, -0.5, 0);
    else head.rotation.set(headDown ? 0.5 : walking ? Math.sin(phase * 2) * 0.04 : pose === "lie" ? 0.06 : 0, 0, 0);
    tailGroup.rotation.set(0, 0, walking ? Math.sin(phase * 0.7) * 0.3 : 0.08);
    // eyes shut asleep, and a blink now and then while it walks
    const closed = pose === "curl" || groom || (walking && (phase * 0.035) % 1 < 0.06);
    for (const o of open) o.visible = !closed;
    for (const o of shut) o.visible = closed;
  };
  set("stand", 0);
  return { root, body, legs: legParts.map((l) => l.g), tail: tailGroup, head, eyes, zzz, set };
}

/** A place a pet likes: where it lies (and how high), where it walks to first (to jump up from the front), which way it faces. */
interface Spot {
  p: Vec2;
  y: number;
  /** In front of the sofa or bed: walked to, then jumped from. */
  approach: Vec2 | null;
  face: number | null;
  sleep: boolean;
  /** A short visit standing (the bowls), no lying down. */
  visit?: boolean;
}

// a pack's own sizes and versions count too: cat_bed_donut_large, cat_tree_tall, pet_bowls_raised (#23)
const CAT_BED = /^cat_(bed|cave)(_|$)/;
const CAT_TREE = /^cat_tree(_|$)/;
/** A cat bed on a shelf on the wall: up there, jumped onto from the floor in front. */
const CAT_SHELF = /^cat_shelf_bed(_|$)/;
const DOG_HOME = /^(dog_bed|dog_basket|dog_house)$/;
const BOWLS = /^(bowls|pet_bowls?|pet_feeder|water_fountain)(_|$)/;

/** A rug on the floor: its rectangle (centre, half sizes, turn) and its top. */
interface Rug {
  x: number;
  z: number;
  hw: number;
  hd: number;
  a: number;
  top: number;
}

/** Rugs and mats of a floor (a built-in rug or a pack's, "rug"/"carpet"/"mat" in its name, at most 6 cm high). */
/**
 * The furniture the pets walk around: whatever stands on the floor and is higher than a rug or a dog bed – sofas,
 * tables, cabinets, beds. Lamps, rugs and what hangs on a wall stay out (a place on the sofa is still reached, with a
 * hop at the end).
 */
function obstaclesOf(floor: Floor, base: (floor: Floor, f: Furniture) => number): Obstacle[] {
  return floor.furniture
    .filter((f) => f.h >= 0.25 && base(floor, f) < 0.3 && !/lamp|light|rug|carpet|(^|_)mat($|_)|parking/.test(itemOf(f.type)))
    .map((f) => {
      const a = (f.rotation * Math.PI) / 180;
      return { c: [f.x, f.z] as Vec2, u: [Math.cos(a), Math.sin(a)] as Vec2, hw: f.w / 2, hd: f.d / 2 };
    });
}

/**
 * Where the pets can walk on a floor: through the doors between two rooms that are not reported shut. They live
 * indoors: the front door, a garage door and a floor-length window are no ways for them (the shortest way from room
 * to room could lead round the outside of the house). Ported from NeonPlan 3D 3.1.1 (MIT, Mastershort).
 */
export function petMap(Maps: typeof FloorMap, plan: Building, floor: Floor, shut: ReadonlySet<string>, obstacles: readonly Obstacle[]): FloorMap {
  const doors = floor.openings.filter((o) => o.type === "door" && !shut.has(o.id));
  const map = new Maps(plan, { ...floor, openings: doors }, obstacles);
  const outer = new Set(map.doors.filter((d) => !(map.roomAt(d.p[0]) && map.roomAt(d.p[1]))).map((d) => d.id));
  return outer.size ? new Maps(plan, { ...floor, openings: doors.filter((o) => !outer.has(o.id)) }, obstacles) : map;
}

function rugsOf(floor: Floor): Rug[] {
  return floor.furniture
    .filter((f) => /rug|carpet|(^|_)mat($|_)/.test(itemOf(f.type)) && f.h <= 0.06)
    .map((f) => ({ x: f.x, z: f.z, hw: f.w / 2, hd: f.d / 2, a: (f.rotation * Math.PI) / 180, top: f.h + 0.006 }));
}

/** How high the floor is at a point: on a rug its top, else 0. */
function rugTop(rugs: readonly Rug[], p: Vec2): number {
  let top = 0;
  for (const r of rugs) {
    const dx = p[0] - r.x;
    const dz = p[1] - r.z;
    const u = dx * Math.cos(r.a) + dz * Math.sin(r.a);
    const v = -dx * Math.sin(r.a) + dz * Math.cos(r.a);
    if (Math.abs(u) <= r.hw && Math.abs(v) <= r.hd) top = Math.max(top, r.top);
  }
  return top;
}

/** Whether a point lies in a polygon (even-odd). */
function pointIn(p: Vec2, poly: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Favourite places on a floor, only the ones of its kind (an aquarium or a cage never is one). */
function spotsFor(floor: Floor, kind: Pet["kind"], map: FloorMap, base: (floor: Floor, f: Furniture) => number): Spot[] {
  const out: Spot[] = [];
  const along = (f: Furniture, k: number): Vec2 => {
    const a = (f.rotation * Math.PI) / 180;
    return [f.x - Math.sin(a) * k, f.z + Math.cos(a) * k];
  };
  // facing the furniture's front (into the room)
  const facing = (f: Furniture) => {
    const [fx, fz] = along(f, 1);
    return Math.atan2(fx - f.x, fz - f.z);
  };
  for (const f of floor.furniture) {
    const t = itemOf(f.type);
    if (kind === "cat" && (CAT_TREE.test(t) || CAT_SHELF.test(t))) {
      // up on the top of the cat tree, or in the bed on its shelf: jumped onto from the floor in front
      const y = base(floor, f) + (CAT_TREE.test(t) ? Math.max(0.06, f.h - 0.05) : f.h * 0.4);
      out.push({ p: [f.x, f.z], y, approach: along(f, f.d / 2 + 0.3), face: facing(f), sleep: true });
    } else if (kind === "cat" ? CAT_BED.test(t) : kind === "dog" ? DOG_HOME.test(t) : false) {
      // in its bed or cave; in front of the dog house
      const p = t === "dog_house" ? along(f, f.d / 2 + 0.3) : ([f.x, f.z] as Vec2);
      out.push({ p, y: t === "dog_house" ? 0 : 0.06, approach: null, face: facing(f), sleep: true });
    } else if (BOWLS.test(t) && kind !== "rabbit") out.push({ p: along(f, f.d / 2 + 0.25), y: 0, approach: null, face: facing(f) + Math.PI, sleep: false, visit: true });
    else if ((SOFA.test(t) || BED.test(t)) && !t.includes("bunk") && !t.startsWith("dog") && !t.startsWith("cat")) {
      const bed = BED.test(t) || t === "sofa_bed";
      // which side is the front: some models are built the other way round – the front is the side that lies
      // free in the room (the back usually stands at a wall), else the side towards the room's middle
      const free = (s: number) => {
        const q = along(f, s * (f.d / 2 + 0.35));
        return !map.blocked(q) && !!map.roomAt(q);
      };
      let side = 1;
      if (!free(1) && free(-1)) side = -1;
      else if (free(1) === free(-1)) {
        const room = floor.rooms.find((r) => r.points.length >= 3 && r.points.length && pointIn([f.x, f.z], r.points));
        if (room) {
          const cx = room.points.reduce((s, p) => s + p[0], 0) / room.points.length;
          const cz = room.points.reduce((s, p) => s + p[1], 0) / room.points.length;
          const d = (s: number) => {
            const q = along(f, s);
            return Math.hypot(q[0] - cx, q[1] - cz);
          };
          if (d(-1) < d(1)) side = -1;
        }
      }
      const front = along(f, side * (f.d / 2 + 0.35));
      const face = facing(f) + (side < 0 ? Math.PI : 0);
      if (kind === "cat") {
        // on the seat (a little to the front of the middle, not the back rest), a little above it rather than in it
        const seat = bed ? Math.min(0.58, f.h * 0.64) : Math.min(0.5, f.h * 0.58);
        out.push({ p: along(f, bed ? 0 : side * f.d * 0.12), y: seat, approach: front, face, sleep: bed });
      } else out.push({ p: along(f, side * (f.d / 2 + (kind === "dog" ? 0.5 : 0.35))), y: 0, approach: null, face: face + (kind === "dog" ? Math.PI / 2 : 0), sleep: bed });
    } else if (t === "rug") out.push({ p: [f.x, f.z], y: 0, approach: null, face: null, sleep: false });
  }
  return out;
}

type Mode = "walk" | "rest" | "sleep" | "stand" | "climb" | "hold";

/** The water of the pets pack's aquariums: its share of the item's width, depth and height (bottom, top). */
const TANKS: Record<string, { w: number; d: number; y0: number; y1: number; fish: number }> = {
  aquarium: { w: 0.78 / 0.8, d: 0.33 / 0.35, y0: 0.08 / 0.5, y1: 0.4 / 0.5, fish: 4 },
  aquarium_large: { w: 1.18 / 1.2, d: 0.43 / 0.45, y0: 0.84 / 1.4, y1: 1.24 / 1.4, fish: 7 },
};
const FISH_COLORS = ["#ff8c3a", "#ffd23f", "#3fe0ff", "#ff5d8f", "#9b7bff", "#7dff9b", "#ff6a3d"];

interface Fish {
  g: THREE.Group;
  y: number;
  amp: number;
  speed: number;
  phase: number;
}

interface Animal {
  pet: Pet;
  look: Look;
  model: Model;
  floorId: string;
  map: FloorMap;
  spots: Spot[];
  rooms: Floor["rooms"];
  pos: Vec2;
  y: number;
  heading: number;
  path: Vec2[];
  /** Where the way ends: the spot (a cat then jumps up onto it). */
  goal: (Spot & { hold?: boolean }) | null;
  /** The spot it lies on now (to jump down from it towards the front). */
  on: Spot | null;
  /** The favourite place it went to last (not the same one again right away). */
  last?: Spot | null;
  mode: Mode;
  until: number;
  phase: number;
  /** A jump up or down: from one point and height to another, then lying, resting or walking on. */
  jump: { from: [number, number, number]; to: [number, number, number]; t: number; then: Mode } | null;
  /** Bound for the stairs: walking to their foot (or top), then up (or down) the steps. */
  stairs: { link: Link; up: boolean } | null;
  /** Where it steps onto the stairs. */
  stairsEntry?: Vec2 | null;
  /** On the steps: the way left (lower floor's coordinates) and the floor it ends on. */
  climb: { pts: [number, number, number][]; to: string } | null;
  /** A static pet (#17): where it stays and in which pose (it never walks). */
  still: StaticPlace | null;
  /** Roaming pets (#337): where it is bound (its routine spot or trigger's place), and that place as a key. */
  dest: { floorId: string; place: StaticPlace } | null;
  want: string | null;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const angleTo = (from: number, to: number) => {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};

export function startPets(ctx: PetsContext): PetsController {
  const { lib, viewer } = ctx;
  let animals: Animal[] = [];
  let raf = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = 0;
  let links: Link[] = [];
  let tanks: THREE.Group[] = [];
  let fishes: Fish[] = [];
  let fishTimer: ReturnType<typeof setInterval> | undefined;
  /** Per floor: its walk map, the rooms and the favourite places of each kind (made once per plan). */
  let floors = new Map<string, { floor: Floor; map: FloorMap; rooms: Floor["rooms"]; spots: Map<Pet["kind"], Spot[]>; rugs: Rug[] }>();
  let plan: Building = ctx.building;

  const floorInfo = (id: string) => {
    let info = floors.get(id);
    if (!info) {
      const floor = plan.floors.find((f) => f.id === id)!;
      // shut doors are walls for the pets, and only doors between two rooms are ways (#444)
      info = { floor, map: petMap(ctx.FloorMap, plan, floor, ctx.closedDoors?.() ?? new Set<string>(), obstaclesOf(floor, ctx.base)), rooms: floor.rooms.filter((r) => r.points.length >= 3), spots: new Map(), rugs: rugsOf(floor) };
      floors.set(id, info);
    }
    return info;
  };

  /** Move an animal onto a floor: its map, rooms and places, and its model into that floor's group. */
  const toFloor = (a: Animal, id: string) => {
    const info = floorInfo(id);
    a.floorId = id;
    a.map = info.map;
    a.rooms = info.rooms;
    let spots = info.spots.get(a.pet.kind);
    if (!spots) info.spots.set(a.pet.kind, (spots = spotsFor(info.floor, a.pet.kind, info.map, ctx.base)));
    a.spots = spots;
    viewer.floorMap.get(id)?.group.add(a.model.root);
  };

  const floorFor = petFloor;

  /** A random free place in a room. */
  const somewhere = (a: Animal): Vec2 => {
    const r = a.rooms[Math.floor(Math.random() * a.rooms.length)];
    const xs = r.points.map((p) => p[0]);
    const zs = r.points.map((p) => p[1]);
    for (let i = 0; i < 12; i++) {
      const p: Vec2 = [rnd(Math.min(...xs) + 0.4, Math.max(...xs) - 0.4), rnd(Math.min(...zs) + 0.4, Math.max(...zs) - 0.4)];
      if (a.map.roomAt(p) && !a.map.blocked(p)) return p;
    }
    return a.map.freeNear([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2]);
  };

  let doorSig = "";
  /** A door opened or shut since: the floors' maps are made again (lazily), each pet takes its floor's new map. */
  const checkDoors = () => {
    const sig = [...(ctx.closedDoors?.() ?? [])].sort().join(",");
    if (sig === doorSig) return;
    doorSig = sig;
    floors = new Map();
    for (const x of animals) if (!x.climb) toFloor(x, x.floorId);
  };

  // Roaming pets (#337): where the server puts each pet (known once its first message is here), and whether the
  // screen asks for less motion (the pets are then put there, not walked)
  let live: Record<string, PetLive> = {};
  let liveKnown = false;
  const reduced = !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  /** Where a pet should be: its first spot with roaming off, else the server's place (before it answers: the first spot). */
  const wanted = (pet: Pet): PetPlace | null => {
    const first = petSpots(pet)[0] ?? null;
    if (plan.settings.pets?.roam === false || isStaticPet(pet)) return first;
    return liveKnown ? (live[pet.id] ?? null) : first;
  };
  const keyOf = (p: PetPlace | null) => (p ? [p.floor_id, p.x, p.z, p.pose, p.rotation].join() : null);

  /** Hold the pose where it is bound: put there at once (no frames after). */
  const settle = (a: Animal) => {
    const d = a.dest!;
    if (d.floorId !== a.floorId) toFloor(a, d.floorId);
    Object.assign(a, { still: d.place, pos: d.place.pos, y: d.place.y, heading: d.place.heading, path: [], goal: null, on: null, jump: null, stairs: null, climb: null, mode: "hold", until: Infinity });
    posture(a, d.place);
    viewer.invalidate();
  };

  /** Up or down a stair: the way to its foot (or top); false when there is none. */
  const toStairs = (a: Animal, link: Link, up: boolean, start: Vec2): boolean => {
    for (const c of up ? link.foot : link.top) {
      if (a.map.blocked(c) || !a.map.roomAt(c)) continue;
      const path = a.map.path(start, c);
      if (!path) continue;
      Object.assign(a, { stairsEntry: c, path, goal: null, stairs: { link, up }, mode: "walk" });
      return true;
    }
    return false;
  };

  /** Off down from a sofa or bed first, towards its front. */
  const jumpDown = (a: Animal) => {
    if (a.on?.approach && a.y > 0.05) a.jump = { from: [a.pos[0], a.y, a.pos[1]], to: [a.on.approach[0], 0, a.on.approach[1]], t: 0, then: "walk" };
    a.on = null;
  };

  /** On its way to where it is bound: to the stairs when that is on another floor, else there (jumping up at the end). */
  const headTo = (a: Animal) => {
    const d = a.dest!;
    const start: Vec2 = a.on?.approach ?? a.pos;
    if (d.floorId !== a.floorId) {
      const elev = (id: string) => plan.floors.find((f) => f.id === id)?.elevation ?? 0;
      const up = elev(d.floorId) > elev(a.floorId);
      const fits = (l: Link) => (up ? l.lower === a.floorId : l.upper === a.floorId);
      const link = links.find((l) => fits(l) && (up ? l.upper : l.lower) === d.floorId) ?? links.find(fits);
      if (link && toStairs(a, link, up, start)) jumpDown(a);
      else settle(a);
      return;
    }
    const goal = d.place.pos;
    const approach = d.place.y > 0.05 || a.map.blocked(goal) ? a.map.freeNear(goal) : null;
    const end = approach ?? goal;
    const path = Math.hypot(end[0] - start[0], end[1] - start[1]) < 0.05 ? [] : a.map.path(start, end);
    if (!path) return settle(a);
    Object.assign(a, { path, goal: { p: goal, y: d.place.y, approach, face: d.place.heading, sleep: false, hold: true }, stairs: null, mode: "walk" });
    jumpDown(a);
  };

  /** Send a pet where it should be now: walked there, or put there (at once, or with less motion, or no way there). */
  const go = (a: Animal, place: PetPlace | null, instant: boolean) => {
    const key = keyOf(place);
    if (key === a.want) return;
    a.want = key;
    const floor = place && placeFloor(plan, a.pet, place);
    const spot = floor && viewer.floorMap.get(floor.id) && floorInfo(floor.id).rooms.length ? placeAt(floor, place, ctx.surface) : null;
    if (!spot) {
      // nowhere to be: it wanders as before (in place, with roaming off or less motion)
      if (!a.dest) return;
      a.dest = null;
      if (plan.settings.pets?.roam === false || reduced) return;
      Object.assign(a, { still: null, mode: "rest", until: 0 });
      return wake();
    }
    a.dest = { floorId: floor!.id, place: spot };
    if (instant || reduced) return settle(a);
    if (a.still) {
      // up on something: down to the floor in front first
      Object.assign(a, { pos: a.still.pos, y: a.still.y, on: a.still.y > 0.05 ? { p: a.still.pos, y: a.still.y, approach: a.map.freeNear(a.still.pos), face: null, sleep: false } : null, still: null });
    }
    if (!a.climb && !a.jump) Object.assign(a, { mode: "rest", until: 0 });
    wake();
  };

  /** Frames again (a pet has somewhere to go). */
  const wake = () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    last = 0;
    raf = requestAnimationFrame(tick);
  };

  /** What next: at night to a sleeping place, by day to a favourite place or anywhere; then rest there a while. */
  const decide = (a: Animal, now: number) => {
    checkDoors();
    if (a.dest) return headTo(a);
    const night = ctx.night();
    const sleepers = a.spots.filter((s) => s.sleep);
    const choices: Spot[] = night && sleepers.length ? sleepers : a.spots;
    // up on the sofa: first down to its front
    const start: Vec2 = a.on?.approach ?? a.pos;
    // now and then up or down the stairs (at night it stays where it is)
    const here = links.filter((l) => l.lower === a.floorId || l.upper === a.floorId);
    if (here.length && !night && Math.random() < 0.22) {
      const link = here[Math.floor(Math.random() * here.length)];
      const up = link.lower === a.floorId;
      // the first way on that works: in front of the stair, else from either side
      if (toStairs(a, link, up, start)) return jumpDown(a);
    }
    for (let tries = 0; tries < 6; tries++) {
      const fav = choices.length && (night || Math.random() < 0.45) ? choices[Math.floor(Math.random() * choices.length)] : null;
      if (fav && (fav === a.on || (fav === a.last && choices.length > 1 && !night))) continue;
      const goal = fav ? (fav.approach ?? fav.p) : somewhere(a);
      const target = a.map.blocked(goal) ? a.map.freeNear(goal) : goal;
      const path = Math.hypot(target[0] - start[0], target[1] - start[1]) < 0.05 ? [] : a.map.path(start, target);
      if (!path) continue;
      a.path = path;
      a.goal = fav;
      if (fav) a.last = fav;
      a.stairs = null;
      a.mode = "walk";
      return jumpDown(a);
    }
    a.mode = night ? "sleep" : "rest";
    a.until = now + rnd(20, 60) * 1000;
  };

  const pose = (a: Animal) => {
    const L = a.look;
    const lying = (a.mode === "rest" || a.mode === "sleep") && !a.jump;
    // on the floor (not up on a sofa or on the stairs) a rug lifts it to its top
    const lift = !a.climb && !a.jump && a.y < 0.05 ? rugTop(floors.get(a.floorId)?.rugs ?? [], a.pos) : 0;
    a.model.root.position.set(a.pos[0], a.y + lift, a.pos[1]);
    a.model.root.rotation.y = a.heading;
    const moving = (a.mode === "walk" || a.mode === "climb") && !a.jump;
    a.model.zzz.visible = a.mode === "sleep";
    if (a.model.set) {
      // a cat: lying by day like a loaf, asleep curled up; standing still at the bowls (head down) and in a jump
      a.model.set(lying ? (a.mode === "sleep" ? "curl" : "lie") : moving ? "walk" : "stand", a.phase, a.mode === "stand");
      return;
    }
    // walking: legs swing, the head nods, the tail wags; lying like a loaf: legs tucked away, the tail round the side
    const swing = moving ? Math.sin(a.phase) : 0;
    a.model.legs.forEach((l, i) => {
      l.rotation.x = lying ? 0 : (i === 0 || i === 3 ? swing : -swing) * 0.6;
      l.scale.y = lying ? 0.08 : 1;
    });
    const hop = a.pet.kind === "rabbit" && moving ? Math.abs(Math.sin(a.phase)) * 0.07 : 0;
    // (a held pose may have tilted the body and turned the head)
    a.model.body.rotation.x = 0;
    a.model.head.rotation.y = 0;
    a.model.body.position.y = (lying ? -(L.leg + L.hi * 0.12) : 0) + hop;
    a.model.head.rotation.x = a.mode === "sleep" ? 0.45 : a.mode === "stand" ? 0.5 : lying ? 0.12 : Math.sin(a.phase * 2) * 0.04;
    if (lying) a.model.tail.rotation.set(-1.45, 0, 0.9);
    else a.model.tail.rotation.set(L.tail === "cat" ? -0.5 : -0.9, 0, Math.sin(a.phase * 0.7) * (moving ? 0.6 : 0.2));
    for (const e of a.model.eyes) e.scale.y = a.mode === "sleep" ? 0.12 : 1;
  };

  /**
   * A held pose (a static pet, a pet at its routine spot or trigger's place): sitting upright on its haunches,
   * grooming (sitting, the head bent to a raised paw), standing, lying like a loaf, or curled up asleep (head tucked,
   * eyes shut, the tail round it).
   */
  const posture = (a: Animal, s: StaticPlace) => {
    const L = a.look;
    const m = a.model;
    m.root.position.set(s.pos[0], s.y + (s.y < 0.05 ? rugTop(floors.get(a.floorId)?.rugs ?? [], s.pos) : 0), s.pos[1]);
    m.root.rotation.y = s.heading;
    m.zzz.visible = false;
    if (m.set) {
      m.set(s.pose === "lie" ? "lie" : (s.pose ?? "sit"), 0);
      return;
    }
    const groom = s.pose === "groom";
    // standing: as it stands still between its walks
    if (s.pose === "stand") return pose(Object.assign(a, { pos: s.pos, y: s.y, heading: s.heading }));
    if (s.pose === "sit" || groom) {
      // the body tilts up at the front round its feet, the rear down on the floor; front legs straight, rear tucked
      const tilt = -0.5;
      const ry = L.leg + L.hi * 0.2;
      const rz = -L.len * 0.4;
      m.body.rotation.x = tilt;
      m.body.position.y = -(ry * Math.cos(tilt) - rz * Math.sin(tilt));
      m.legs.forEach((l, i) => {
        l.rotation.x = i < 2 ? -tilt - (groom && !i ? 1 : 0) : 0;
        l.scale.y = i < 2 ? 1 : 0.08;
      });
      m.head.rotation.set(-tilt * 0.8 + (groom ? 0.5 : 0), groom ? -0.6 : 0, 0);
      m.tail.rotation.set(-1.5, 0, 0.7);
      for (const e of m.eyes) e.scale.y = groom ? 0.12 : 1;
      return;
    }
    const curl = s.pose === "curl";
    m.body.rotation.x = 0;
    m.body.position.y = -(L.leg + L.hi * 0.12);
    m.legs.forEach((l) => {
      l.rotation.x = 0;
      l.scale.y = 0.08;
    });
    m.head.rotation.set(curl ? 0.45 : 0.12, curl ? 0.6 : 0, 0);
    m.tail.rotation.set(-1.45, 0, curl ? 1.4 : 0.9);
    for (const e of m.eyes) e.scale.y = curl ? 0.12 : 1;
  };

  /** At the end of the way: up onto the spot (a cat, from the front) facing the room, or a short stop at the bowls. */
  const arrive = (a: Animal, now: number) => {
    if (a.stairs) {
      // the steps: always in the lower floor's coordinates (its group), up or down
      const { link, up } = a.stairs;
      a.stairs = null;
      // step off where the other floor is free: in front, else beside the stair
      const other = floorInfo(up ? link.upper : link.lower).map;
      const offs = up ? link.top : link.foot;
      const off = offs.find((c) => !other.blocked(c) && other.roomAt(c)) ?? other.freeNear(offs[0]);
      const rise = link.pts[link.pts.length - 1][1];
      const steps = up ? link.pts : [...link.pts].reverse();
      const pts: [number, number, number][] = [...steps, [off[0], up ? rise : 0, off[1]]];
      const from = a.stairsEntry ?? a.pos;
      if (!up) toFloor(a, link.lower);
      a.pos = [from[0], from[1]];
      a.y = up ? 0 : rise;
      a.climb = { pts, to: up ? link.upper : link.lower };
      a.mode = "climb";
      return;
    }
    const s = a.goal;
    a.goal = null;
    if (s?.hold) {
      // at its routine spot or trigger's place: up onto it from the front, then holding its pose
      if (s.approach) a.jump = { from: [a.pos[0], a.y, a.pos[1]], to: [s.p[0], s.y, s.p[1]], t: 0, then: "hold" };
      else settle(a);
      return;
    }
    if (s?.visit) {
      a.mode = "stand";
      a.until = now + rnd(4, 9) * 1000;
      if (s.face != null) a.heading = s.face;
      return;
    }
    const mode: Mode = ctx.night() ? "sleep" : "rest";
    a.until = now + (mode === "sleep" ? rnd(120, 400) : a.pet.kind === "cat" ? rnd(30, 120) : rnd(15, 60)) * 1000;
    a.on = s;
    if (s && s.y > 0.05 && s.approach) a.jump = { from: [a.pos[0], a.y, a.pos[1]], to: [s.p[0], s.y, s.p[1]], t: 0, then: mode };
    else {
      // a place on the floor that a table or a wall takes up (in front of a sofa with a coffee table): it lies down
      // where it got to, beside it, instead of inside the table (#444)
      if (s && !(s.y <= 0.05 && a.map.blocked(s.p))) {
        a.pos = s.p;
        a.y = s.y;
      }
      if (s?.face != null) a.heading = s.face;
      a.mode = mode;
    }
  };

  const step = (a: Animal, dt: number, now: number): boolean => {
    if (a.still) return false;
    if (a.jump) {
      const j = a.jump;
      j.t = Math.min(1, j.t + dt / 0.45);
      const k = j.t;
      a.pos = [j.from[0] + (j.to[0] - j.from[0]) * k, j.from[2] + (j.to[2] - j.from[2]) * k];
      a.y = j.from[1] + (j.to[1] - j.from[1]) * k + Math.sin(k * Math.PI) * 0.22;
      const dx = j.to[0] - j.from[0];
      const dz = j.to[2] - j.from[2];
      if (Math.hypot(dx, dz) > 0.02) a.heading = Math.atan2(dx, dz);
      if (k >= 1) {
        a.y = j.to[1];
        a.jump = null;
        if (j.then === "hold") {
          settle(a);
          return true;
        }
        a.mode = j.then;
        // up there: turn round to face the room
        if (j.then !== "walk" && a.on?.face != null) a.heading = a.on.face;
      }
      pose(a);
      return true;
    }
    if (a.mode === "climb" && a.climb) {
      const c = a.climb;
      const next = c.pts[0];
      if (!next) {
        // off the stairs: on the upper floor at its level, or back on the lower
        a.climb = null;
        a.y = 0;
        if (c.to !== a.floorId) toFloor(a, c.to);
        a.mode = "rest";
        a.until = now + rnd(1, 3) * 1000;
        pose(a);
        return true;
      }
      const dx = next[0] - a.pos[0];
      const dz = next[2] - a.pos[1];
      const dy = next[1] - a.y;
      const dist = Math.hypot(dx, dy, dz);
      if (Math.hypot(dx, dz) > 0.02) a.heading += angleTo(a.heading, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
      const move = Math.min(dist, a.look.speed * 0.95 * dt);
      if (dist < 0.02) c.pts.shift();
      else {
        a.pos = [a.pos[0] + (dx / dist) * move, a.pos[1] + (dz / dist) * move];
        a.y += (dy / dist) * move;
        a.phase += dt * a.look.speed * 22;
      }
      pose(a);
      return true;
    }
    if (a.mode !== "walk") {
      if (now < a.until) return false;
      decide(a, now);
      pose(a);
      return (a.mode as Mode) === "walk";
    }
    const next = a.path[0];
    if (!next) {
      arrive(a, now);
      pose(a);
      return true;
    }
    const dx = next[0] - a.pos[0];
    const dz = next[1] - a.pos[1];
    const dist = Math.hypot(dx, dz);
    const turn = angleTo(a.heading, Math.atan2(dx, dz));
    a.heading += Math.sign(turn) * Math.min(Math.abs(turn), dt * 6);
    const move = Math.min(dist, a.look.speed * dt);
    if (dist < 0.02) a.path.shift();
    else {
      a.pos = [a.pos[0] + (dx / dist) * move, a.pos[1] + (dz / dist) * move];
      a.phase += dt * a.look.speed * 20;
    }
    pose(a);
    return true;
  };

  const tick = (now: number) => {
    raf = 0;
    // tablet level, nobody touched the view for a while: they hold still (nothing is drawn) until the next touch
    if (viewer.resting) {
      last = 0;
      timer = setTimeout(() => (raf = requestAnimationFrame(tick)), 1000);
      return;
    }
    // the tablet level draws them about 5 times a second: they step as often, so a step may be longer
    const dt = last ? Math.min(viewer.low ? 0.3 : 0.1, (now - last) / 1000) : 0;
    last = now;
    let active = false;
    for (const a of animals) if (step(a, dt, now)) active = true;
    if (active) viewer.animate();
    if (active && viewer.low) timer = setTimeout(() => (raf = requestAnimationFrame(tick)), 180);
    else if (active) raf = requestAnimationFrame(tick);
    else {
      // all of them rest: wake up when the first one wants to go on (none, when every one holds its pose: #337)
      const resting = animals.filter((a) => !a.still);
      last = 0;
      if (resting.length) timer = setTimeout(() => (raf = requestAnimationFrame(tick)), Math.max(500, Math.min(...resting.map((a) => a.until - performance.now()), 60000)));
    }
  };

  /**
   * Fish in the pets pack's aquariums: small, bright fish swimming to and fro behind the front glass (and the back),
   * as one sees them through it – the water itself is drawn solid. They move a few times a second only.
   */
  const buildFish = (b: Building) => {
    const S = shapes(lib);
    for (const floor of b.floors) {
      const fv = viewer.floorMap.get(floor.id);
      if (!fv) continue;
      for (const f of floor.furniture) {
        const spec = TANKS[itemOf(f.type)];
        if (!spec) continue;
        const tank = new lib.Group();
        tank.position.set(f.x, ctx.base(floor, f), f.z);
        tank.rotation.y = (-f.rotation * Math.PI) / 180;
        const halfW = (f.w * spec.w) / 2;
        const y0 = f.h * spec.y0;
        const y1 = f.h * spec.y1;
        for (let i = 0; i < spec.fish; i++) {
          const color = FISH_COLORS[(i * 3 + Math.round(f.x * 7)) % FISH_COLORS.length];
          const mat = new lib.MeshBasicMaterial({ color, vertexColors: true });
          const size = 0.035 + ((i * 37) % 10) / 400;
          for (const side of [1, -1]) {
            const g = new lib.Group();
            const body = new lib.Mesh(S.ball, mat);
            body.scale.set(size * 1.8, size, 0.004);
            const tail = new lib.Mesh(S.ball, mat);
            tail.scale.set(size * 0.7, size * 0.9, 0.004);
            tail.position.x = -size * 1.15;
            g.add(body, tail);
            g.position.z = side * ((f.d * spec.d) / 2 + 0.004);
            tank.add(g);
            fishes.push({ g, y: y0 + ((i + 0.5) / spec.fish) * (y1 - y0), amp: halfW - size * 2, speed: 0.25 + ((i * 53) % 10) / 30, phase: i * 1.7 + (side > 0 ? 0 : 0.6) });
          }
        }
        fv.group.add(tank);
        tanks.push(tank);
      }
    }
    const swim = () => {
      if (document.hidden || viewer.resting) return;
      const t = performance.now() / 1000;
      for (const fi of fishes) {
        const s = Math.sin(t * fi.speed + fi.phase);
        fi.g.position.x = fi.amp * s;
        fi.g.position.y = fi.y + Math.sin(t * fi.speed * 2.3 + fi.phase) * 0.012;
        // facing the way it swims
        fi.g.scale.x = Math.cos(t * fi.speed + fi.phase) >= 0 ? 1 : -1;
      }
      viewer.animate();
    };
    if (fishes.length) {
      swim();
      fishTimer = setInterval(swim, 160);
    }
  };

  const clear = () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    clearInterval(fishTimer);
    for (const a of animals) {
      a.model.root.removeFromParent();
      disposeTree(a.model.root);
    }
    for (const t of tanks) {
      t.removeFromParent();
      disposeTree(t);
    }
    animals = [];
    tanks = [];
    fishes = [];
  };

  const update = (b: Building, pets: readonly Pet[]) => {
    const before = new Map(animals.map((a) => [a.pet.id, a]));
    clear();
    plan = b;
    floors = new Map();
    links = stairLinks(b);
    for (const pet of pets) {
      // a pet that went up or down the stairs stays on that floor
      const prev = before.get(pet.id);
      const place = wanted(pet);
      // with roaming off or less motion a pet without spots stays at one of its places
      const still = isStaticPet(pet) || b.settings.pets?.roam === false || reduced;
      const floor = (!still && prev && !prev.still && prev.pet.floor_id === pet.floor_id ? b.floors.find((f) => f.id === prev.floorId) : undefined) ?? floorFor(b, pet);
      if (!floor || !viewer.floorMap.get(floor.id) || !floorInfo(floor.id).rooms.length) continue;
      const old = prev;
      const a: Animal = {
        pet,
        look: lookOf(pet),
        model: buildModel(lib, pet),
        floorId: floor.id,
        map: floorInfo(floor.id).map,
        spots: [],
        rooms: [],
        pos: [0, 0],
        y: 0,
        heading: old?.heading ?? rnd(0, Math.PI * 2),
        path: [],
        goal: null,
        on: null,
        mode: "rest",
        until: 0,
        phase: 0,
        jump: null,
        stairs: null,
        stairsEntry: null,
        climb: null,
        still: null,
        dest: null,
        want: null,
      };
      toFloor(a, floor.id);
      if (place) {
        // its routine spot or trigger's place (#337): there at once
        go(a, place, true);
        if (a.dest) {
          animals.push(a);
          continue;
        }
      }
      if (still) {
        // a static pet: at its spot, else (none set yet) at one of its own places or anywhere in a room
        const own = a.spots.find((s) => s.sleep && !s.approach) ?? a.spots.find((s) => s.sleep);
        // (one with a spot is placed above, #337)
        a.still = own ? { pos: own.p, y: own.y, heading: own.face ?? 0, pose: pet.pose ?? "sit" } : { pos: somewhere(a), y: 0, heading: 0, pose: pet.pose ?? "sit" };
        a.pos = a.still.pos;
        a.y = a.still.y;
        a.until = Infinity;
        posture(a, a.still);
        animals.push(a);
        continue;
      }
      // a pet already living here keeps its place (up on a sofa it starts in front of it)
      a.pos = old && !old.still && old.floorId === floor.id && !old.climb ? (old.on?.approach ?? old.pos) : somewhere(a);
      pose(a);
      animals.push(a);
    }
    buildFish(b);
    last = 0;
    viewer.invalidate();
    // static pets hold still: the frames run only for the ones that roam
    if (animals.some((a) => !a.still)) raf = requestAnimationFrame(tick);
  };

  // where the server puts the pets (#337): followed for the home shown; an older Home 3D refuses it, and the pets
  // then stay on their first spots
  let sub: Promise<() => Promise<void>> | null = null;
  let subHome: string | null | undefined;
  const unfollow = () => void sub?.then((u) => u()).catch(() => undefined);
  const follow = () => {
    const conn = ctx.hass?.()?.connection;
    const home = ctx.home?.();
    if (!conn || (sub && home === subHome)) return;
    unfollow();
    subHome = home;
    liveKnown = false;
    sub = subscribePets(conn, home, (pets) => {
      const first = !liveKnown;
      live = pets;
      liveKnown = true;
      for (const a of animals) go(a, wanted(a.pet), first);
    });
    sub.catch(() => undefined);
  };

  update(ctx.building, ctx.pets);
  follow();
  return {
    update(b, pets) {
      update(b, pets);
      follow();
    },
    dispose() {
      clear();
      unfollow();
      sub = null;
    },
  };
}
