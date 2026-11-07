import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { emptyBuilding, newFloor, PET_EYES, PET_FURS, PET_FURS_OF, PET_POSES, type Building, type Furniture, type Pet, type Room } from "../model.ts";
import type { PetLive } from "../pet-place.ts";
import { translate, type I18nKey } from "../i18n.ts";
import { FloorMap } from "../viewer/walk.ts";
import { buildModel, startPets, type FunLib, type PetsController } from "./pets.ts";

// the pets draw their "z Z" on a canvas and step on animation frames: both stood in for here, frames run by hand
const g = globalThis as unknown as Record<string, unknown>;
const ctx2d = new Proxy({}, { get: () => () => undefined, set: () => true });
g.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), hidden: false };
let frames: ((t: number) => void)[] = [];
g.requestAnimationFrame = (cb: (t: number) => void) => frames.push(cb);
g.cancelAnimationFrame = () => undefined;

const lib = { Group: THREE.Group, Mesh: THREE.Mesh, MeshBasicMaterial: THREE.MeshBasicMaterial, CanvasTexture: THREE.CanvasTexture, Color: THREE.Color, PlaneGeometry: THREE.PlaneGeometry, BufferGeometry: THREE.BufferGeometry, Float32BufferAttribute: THREE.Float32BufferAttribute, DoubleSide: THREE.DoubleSide } as unknown as FunLib;

const rect = (id: string, x0: number, z0: number, x1: number, z1: number): Room => ({ id, name: id, area_id: null, points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], floor_material: "wood" });
const sofa = { id: "s", type: "sofa_3", x: 2, z: 1, w: 2, d: 0.9, h: 0.85, rotation: 0 } as Furniture;

function house(pets: Pet[]): { b: Building; group: THREE.Group; run: PetsController } {
  const floor = { ...newFloor("f", "Ground", 0), rooms: [rect("r", 0, 0, 6, 5)], furniture: [sofa] };
  const b = { ...emptyBuilding(), floors: [floor] };
  const group = new THREE.Group();
  const viewer = { floorMap: new Map([["f", { group, floor }]]), invalidate() {}, animate() {}, low: false, resting: false };
  const run = startPets({ lib, FloorMap, viewer, building: b, pets, night: () => false, base: () => 0 });
  return { b, group, run };
}

/** Runs the animation frames for some seconds of time, 0.1 s apart. */
function play(seconds: number): void {
  const t0 = performance.now();
  for (let t = 0; t <= seconds * 1000; t += 100) {
    const due = frames;
    frames = [];
    for (const f of due) f(t0 + t);
  }
}

/** How the model is posed: every part's place, turn and scale (the model's own parts, not where it stands). */
function poseOf(root: THREE.Object3D): string {
  const out: number[] = [];
  root.children[0].traverse((o) => out.push(...o.position.toArray(), o.rotation.x, o.rotation.y, o.rotation.z, ...o.scale.toArray(), o.visible ? 1 : 0));
  return out.map((v) => Math.round(v * 1000)).join(",");
}

let running: PetsController | null = null;
afterEach(() => {
  running?.dispose();
  running = null;
  frames = [];
});

const cat: Pet = { id: "p", kind: "cat", name: "", fur: "tabby" };

test("a static pet stays at its spot, up on the sofa it was put on, facing as set", () => {
  const { group, run } = house([{ ...cat, static: true, pose: "curl", x: 2.3, z: 1.1, rotation: 90 }]);
  running = run;
  const root = group.children[0];
  const at = () => [root.position.x, root.position.y, root.position.z].map((v) => Math.round(v * 1000) / 1000);
  assert.deepEqual(at(), [2.3, Math.round(0.85 * 0.58 * 1000) / 1000, 1.1]);
  assert.ok(Math.abs(root.rotation.y + Math.PI / 2) < 1e-9);
  const before = poseOf(root);
  play(20);
  assert.deepEqual(at(), [2.3, Math.round(0.85 * 0.58 * 1000) / 1000, 1.1]);
  // nothing of it moves: legs, head and tail hold the pose
  assert.equal(poseOf(root), before);
});

test("the poses look different: sitting upright, lying, curled up asleep", () => {
  const looks = (["sit", "lie", "curl"] as const).map((pose) => {
    const { group, run } = house([{ ...cat, static: true, pose, x: 4, z: 4 }]);
    const s = poseOf(group.children[0]);
    run.dispose();
    return s;
  });
  assert.equal(new Set(looks).size, 3);
});

test("roaming pets still walk through the house", () => {
  const random = Math.random;
  let seed = 7;
  Math.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  try {
    const { group, run } = house([cat, { ...cat, id: "q", static: false, x: 1, z: 1 }]);
    running = run;
    const start = group.children.map((c) => c.position.clone());
    play(6);
    group.children.forEach((c, i) => assert.ok(c.position.distanceTo(start[i]) > 0.1, `pet ${i} walked`));
  } finally {
    Math.random = random;
  }
});

// Coats and eye colours (#42)

/** A model's whole look: every part's kind, place, turn, scale and colour, hashed. */
function lookOf(root: THREE.Object3D): string {
  const parts: string[] = [];
  root.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    parts.push([o.type, ...o.position.toArray(), o.rotation.x, o.rotation.y, o.rotation.z, ...o.scale.toArray()].map((v) => (typeof v === "number" ? Math.round(v * 1e4) : v)).join(","), mat?.color ? mat.color.getHexString() : "");
  });
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
}

/** The colours drawn in a part of a model (plain colours, not the "z Z" card). */
function coloursOf(o: THREE.Object3D): Set<string> {
  const out = new Set<string>();
  o.traverse((m) => {
    const mat = (m as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    if (mat?.color && !mat.map) out.add(mat.color.getHexString());
  });
  return out;
}

const hsl = (hex: string) => new THREE.Color(`#${hex}`).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
const hue = (hex: string) => hsl(hex).h * 360;

test("existing dogs and rabbits look exactly as before: their coats with dark eyes", () => {
  // taken from the models before #42 (the cats were redrawn in #205)
  const before: Record<string, string> = {"dog/golden":"6c13ae4f5e741e64","dog/cream":"4b2acb8f4b47f42f","dog/brown":"0573094005d72750","dog/black":"cfd0a841ca608dae","dog/white":"7716d8f4cdcb0095","dog/grey":"b30a589e13c44437","rabbit/white":"54f8cd29812c26de","rabbit/grey":"5ef19b293bef0bf5","rabbit/brown":"7f93677706959033","rabbit/black":"384d4362d97e0d1c","rabbit/cream":"27d77c039d88b7bf"};
  for (const [key, look] of Object.entries(before)) {
    const [kind, fur] = key.split("/") as [Pet["kind"], string];
    assert.equal(lookOf(buildModel(lib, { id: "p", kind, name: "", fur }).root), look, key);
    assert.equal(lookOf(buildModel(lib, { id: "p", kind, name: "", fur, eyes: "dark" }).root), look, `${key} dark eyes`);
  }
});

test("a cat with dark eyes looks as one with no eye colour set, in every coat", () => {
  for (const fur of PET_FURS_OF.cat) assert.equal(lookOf(buildModel(lib, { ...cat, fur, eyes: "dark" }).root), lookOf(buildModel(lib, { ...cat, fur }).root), fur);
});

test("a pet's eyes can be copper, green, yellow or blue round a dark pupil", () => {
  const want: Record<string, [number, number]> = { copper: [12, 35], yellow: [42, 62], green: [80, 160], blue: [190, 235] };
  for (const [eyes, [lo, hi]] of Object.entries(want)) {
    const model = buildModel(lib, { ...cat, eyes: eyes as Pet["eyes"] });
    for (const e of model.eyes) {
      const cs = [...coloursOf(e)];
      assert.ok(cs.some((c) => hsl(c).s > 0.35 && hue(c) >= lo && hue(c) <= hi), `${eyes}: ${cs}`);
      assert.ok(cs.some((c) => hsl(c).l < 0.15), `${eyes} pupil: ${cs}`);
    }
  }
});

/** The colours of a model's fur: everything but its eyes, nose and inner ears (pink), whiskers and the "z Z" card. */
function furOf(model: ReturnType<typeof buildModel>): Set<string> {
  const eyes = new Set<THREE.Object3D>();
  for (const e of model.eyes) e.traverse((o) => eyes.add(o));
  const out = new Set<string>();
  model.body.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    if (mat?.color && !eyes.has(o) && mat.name !== "whiskers") out.add(mat.color.getHexString());
  });
  out.delete("f08aa0");
  return out;
}

test("a cat can be dilute calico: white with grey and cream patches on its body and head", () => {
  const model = buildModel(lib, { ...cat, fur: "dilute_calico" });
  const fur = [...furOf(model)].map(hsl);
  assert.ok(fur.some((c) => c.l > 0.88 && c.s < 0.35), "white");
  assert.ok(fur.some((c) => c.l > 0.35 && c.l < 0.75 && c.s < 0.15), "grey");
  assert.ok(fur.some((c) => c.l > 0.7 && c.l < 0.9 && c.s > 0.3 && c.h * 360 > 25 && c.h * 360 < 50), "cream");
  // patches on the head too, not just the body
  const head = new Set<string>();
  model.head.children.forEach((o) => { if (!model.eyes.includes(o as THREE.Group)) head.add(((o as THREE.Mesh).material as THREE.MeshBasicMaterial)?.color?.getHexString() ?? ""); });
  assert.ok([...head].filter((c) => c && c !== "f08aa0").length >= 3, `head ${[...head]}`);
  assert.ok(PET_FURS_OF.cat.includes("dilute_calico"));
});

test("a cat can be solid blue-grey, without the lighter chest the grey coat has", () => {
  const solid = [...furOf(buildModel(lib, { ...cat, fur: "blue_grey" }))];
  assert.equal(solid.length, 1, `${solid}`);
  const c = hsl(solid[0]);
  assert.ok(c.h * 360 > 195 && c.h * 360 < 240 && c.s > 0.05 && c.s < 0.3 && c.l > 0.4 && c.l < 0.7, solid[0]);
  assert.ok(furOf(buildModel(lib, { ...cat, fur: "grey" })).size > 1);
  assert.ok(PET_FURS_OF.cat.includes("blue_grey"));
});

test("roaming and static pets show their coat and eye colour in the house", () => {
  const still: Pet = { ...cat, id: "a", fur: "dilute_calico", eyes: "copper", static: true, pose: "lie", x: 4, z: 4 };
  const roaming: Pet = { ...cat, id: "b", fur: "blue_grey", eyes: "blue" };
  const { group, run } = house([still, roaming]);
  running = run;
  play(3);
  const [a, b] = group.children.map(coloursOf);
  for (const [pet, cs] of [[still, a], [roaming, b]] as const) {
    const model = buildModel(lib, pet);
    for (const c of coloursOf(model.root)) assert.ok(cs.has(c), `${pet.id} ${c}`);
    assert.ok([...coloursOf(model.eyes[0])].every((c) => cs.has(c)));
  }
  assert.ok([...a].some((c) => hsl(c).s > 0.35 && hue(c) >= 12 && hue(c) <= 35), "copper eyes");
  assert.ok([...b].some((c) => hsl(c).s > 0.35 && hue(c) >= 190 && hue(c) <= 235), "blue eyes");
});

test("every coat and eye colour has a name in English and German for the pet list", () => {
  for (const language of ["en", "de"]) {
    const hass = { language } as Parameters<typeof translate>[0];
    for (const key of [...PET_FURS.map((f) => `pet_fur_${f}`), "pet_eyes", ...PET_EYES.map((e) => `pet_eyes_${e}`)]) assert.notEqual(translate(hass, key as I18nKey), key, `${language} ${key}`);
  }
});

test("a pet set to other eyes or another coat in settings is redrawn with them", () => {
  const { b, group, run } = house([cat]);
  running = run;
  run.update(b, [{ ...cat, fur: "blue_grey", eyes: "green" }]);
  const cs = coloursOf(group.children[0]);
  assert.ok([...cs].some((c) => hue(c) > 195 && hue(c) < 240 && hsl(c).s < 0.3 && hsl(c).l > 0.4 && hsl(c).l < 0.7), "blue-grey coat");
  assert.ok([...cs].some((c) => hsl(c).s > 0.35 && hue(c) >= 80 && hue(c) <= 160), "green eyes");
});

// Pet homes from the core library (#23): roaming pets rest in the cat beds and trees and visit the bowls

const core = (item: string, x: number, z: number, w: number, d: number, h: number, rotation = 0): Furniture => ({ id: item, type: `pack:amluto.household:${item}`, x, z, w, d, h, rotation }) as Furniture;

/** One room (6 × 5 m) holding just these items, by day or by night; `lift` raises an item (a shelf on the wall). */
function homeWith(items: Furniture[], night: boolean, lift: Record<string, number> = {}): { group: THREE.Group; run: PetsController } {
  const floor = { ...newFloor("f", "Ground", 0), rooms: [rect("r", 0, 0, 6, 5)], furniture: items };
  const b = { ...emptyBuilding(), floors: [floor] };
  const group = new THREE.Group();
  const viewer = { floorMap: new Map([["f", { group, floor }]]), invalidate() {}, animate() {}, low: false, resting: false };
  const run = startPets({ lib, FloorMap, viewer, building: b, pets: [cat], night: () => night, base: (_, f) => lift[f.id] ?? 0 });
  return { group, run };
}

/**
 * Runs some seconds of the pets' life on a clock of its own, 0.1 s a frame: a fixed random sequence, and the timers
 * they wait on while all of them rest run on that clock too. Calls `each` after every frame.
 */
function playSeeded(seconds: number, each?: (t: number) => void): void {
  const random = Math.random;
  const setT = globalThis.setTimeout;
  const now = Object.getOwnPropertyDescriptor(performance, "now");
  let seed = 11;
  let clock = 1000;
  const timers: { due: number; cb: () => void }[] = [];
  Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.setTimeout = (cb: () => void, ms = 0) => timers.push({ due: clock + ms, cb });
  Object.defineProperty(performance, "now", { value: () => clock, configurable: true, writable: true });
  try {
    for (let t = 0; t <= seconds * 1000; t += 100) {
      clock = 1000 + t;
      for (const x of timers.filter((x) => x.due <= clock)) {
        timers.splice(timers.indexOf(x), 1);
        x.cb();
      }
      const due = frames;
      frames = [];
      for (const f of due) f(clock);
      each?.(t / 1000);
    }
  } finally {
    Math.random = random;
    g.setTimeout = setT;
    if (now) Object.defineProperty(performance, "now", now);
    else delete (performance as unknown as Record<string, unknown>).now;
  }
}

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

for (const [item, w, d, h] of [
  ["cat_bed_donut", 0.5, 0.5, 0.18],
  ["cat_bed_donut_large", 0.7, 0.7, 0.2],
] as const) {
  test(`at night a roaming cat sleeps in the ${item.replace(/_/g, " ")}`, () => {
    const { group, run } = homeWith([core(item, 4, 3, w, d, h)], true);
    running = run;
    playSeeded(60);
    const p = group.children[0].position;
    assert.ok(near(p.x, 4, 0.02) && near(p.z, 3, 0.02), `in the bed: ${p.x}, ${p.z}`);
    assert.ok(p.y > 0 && p.y < h, `down in it: ${p.y}`);
  });
}

for (const [item, h] of [
  ["cat_tree_small", 0.9],
  ["cat_tree", 1.4],
  ["cat_tree_tall", 1.8],
] as const) {
  test(`at night a roaming cat jumps up and sleeps on top of the ${item.replace(/_/g, " ")}`, () => {
    const { group, run } = homeWith([core(item, 3, 1, 0.6, 0.5, h)], true);
    running = run;
    playSeeded(60);
    const p = group.children[0].position;
    assert.ok(near(p.x, 3, 0.02) && near(p.z, 1, 0.02), `on the tree: ${p.x}, ${p.z}`);
    assert.ok(near(p.y, h - 0.05, 0.03), `on its top: ${p.y}`);
  });
}

test("at night a roaming cat sleeps in the cat bed on a shelf on the wall", () => {
  const { group, run } = homeWith([core("cat_shelf_bed", 3, 0.2, 0.45, 0.4, 0.18)], true, { cat_shelf_bed: 1.2 });
  running = run;
  playSeeded(60);
  const p = group.children[0].position;
  assert.ok(near(p.x, 3, 0.02) && near(p.z, 0.2, 0.02), `on the shelf: ${p.x}, ${p.z}`);
  assert.ok(p.y > 1.2 && p.y < 1.2 + 0.18, `in its bed: ${p.y}`);
});

test("by day a roaming cat visits the food and water bowls: it stands at them a while, facing them", () => {
  const { group, run } = homeWith([core("pet_bowls", 3, 0.3, 0.4, 0.2, 0.06)], false);
  running = run;
  const front = [3, 0.3 + 0.1 + 0.25];
  let still = 0;
  let longest = 0;
  let last = "";
  playSeeded(600, () => {
    const p = group.children[0].position;
    const here = `${p.x.toFixed(3)},${p.z.toFixed(3)}`;
    // facing the bowls (towards -z)
    const at = Math.hypot(p.x - front[0], p.z - front[1]) < 0.05 && Math.cos(group.children[0].rotation.y) < -0.95;
    still = at && here === last ? still + 0.1 : 0;
    longest = Math.max(longest, still);
    last = here;
  });
  assert.ok(longest >= 3, `stood at the bowls for ${longest.toFixed(1)} s`);
});

// The cute cats (#205): a pose of their own each, animated parts, and no dearer to draw than before

/** Whether an object is drawn (it and all its parents visible). */
const shown = (o: THREE.Object3D): boolean => o.visible && (!o.parent || shown(o.parent));

/** What a model draws now: its meshes (not the "z Z" card), their triangles, and the box round them. */
function drawn(root: THREE.Object3D): { meshes: number; triangles: number; box: THREE.Box3 } {
  root.updateMatrixWorld(true);
  let meshes = 0;
  let triangles = 0;
  const box = new THREE.Box3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !shown(m) || (m.material as THREE.MeshBasicMaterial).map) return;
    meshes++;
    triangles += m.geometry.attributes.position.count / 3;
    box.expandByObject(m, true);
  });
  return { meshes, triangles, box };
}

test("a cat sits upright, lies like a loaf, and sleeps curled up low and round with its tail wrapped round", () => {
  const m = buildModel(lib, { ...cat, fur: "dilute_calico", eyes: "copper" });
  const size = (pose: Parameters<NonNullable<typeof m.set>>[0]) => {
    m.set!(pose, 0);
    return drawn(m.root).box.getSize(new THREE.Vector3());
  };
  const [stand, sit, lie, curl] = (["stand", "sit", "lie", "curl"] as const).map(size);
  assert.ok(sit.y > lie.y * 1.3 && sit.z < stand.z * 0.7, `sitting upright: ${sit.toArray()} (standing ${stand.toArray()})`);
  assert.ok(lie.y < stand.y * 0.85, `lying lower: ${lie.toArray()}`);
  assert.ok(curl.y < 0.25 && curl.y < lie.y * 0.85, `curled up low: ${curl.toArray()} (lying ${lie.toArray()})`);
  // round: about as wide as it is long, the tail round the side
  assert.ok(curl.x > 0.22 && Math.abs(curl.x - curl.z) < 0.06, `curled up round: ${curl.toArray()}`);
});

test("a walking cat swings its legs and tail and blinks now and then; asleep its eyes are shut", () => {
  const m = buildModel(lib, cat);
  const legsAt = (phase: number) => {
    m.set!("walk", phase);
    return [...m.legs.map((l) => l.rotation.x), m.tail.rotation.z];
  };
  const a = legsAt(1);
  const b = legsAt(4);
  a.forEach((v, i) => assert.notEqual(Math.round(v * 100), Math.round(b[i] * 100), `part ${i} moves`));
  /** Whether the eyes show their shine (open). */
  const open = () => m.eyes.every((e) => e.children.some((o) => shown(o) && ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHexString() === "ffffff"));
  let blinks = 0;
  for (let phase = 0; phase < 200; phase += 0.5) {
    m.set!("walk", phase);
    if (!open()) blinks++;
  }
  assert.ok(blinks > 0 && blinks < 40, `blinks ${blinks}`);
  m.set!("sit", 0);
  assert.ok(open());
  m.set!("curl", 0);
  assert.ok(!open());
});

test("a roaming cat lies down like a loaf by day and curls up asleep at night", () => {
  const [day, night] = [false, true].map((night) => {
    const { group, run } = homeWith([core("cat_bed_donut", 4, 3, 0.5, 0.5, 0.18)], night);
    playSeeded(120);
    const size = drawn(group.children[0]).box.getSize(new THREE.Vector3());
    run.dispose();
    return size;
  });
  const m = buildModel(lib, cat);
  m.set!("lie", 0);
  assert.ok(Math.abs(day.y - drawn(m.root).box.getSize(new THREE.Vector3()).y) < 0.005, `day: ${day.toArray()}`);
  m.set!("curl", 0);
  assert.ok(Math.abs(night.y - drawn(m.root).box.getSize(new THREE.Vector3()).y) < 0.005, `night: ${night.toArray()}`);
});

test("a cat costs no more to draw than the old one: triangles and draw calls in every pose", () => {
  // the old cat (dilute calico, copper eyes): 4224 triangles in 29 meshes
  const m = buildModel(lib, { ...cat, fur: "dilute_calico", eyes: "copper" });
  for (const pose of ["walk", "stand", "sit", "lie", "curl"] as const) {
    m.set!(pose, 0);
    const d = drawn(m.root);
    assert.ok(d.triangles <= 4224 && d.meshes <= 30, `${pose}: ${d.triangles} triangles, ${d.meshes} meshes`);
  }
});

test("a cat works in every coat and eye colour, in every pose, at most 1.5x the old cat's triangles", () => {
  for (const fur of PET_FURS_OF.cat) {
    for (const eyes of PET_EYES) {
      const m = buildModel(lib, { ...cat, fur, eyes });
      for (const e of m.eyes) {
        const cs = [...coloursOf(e)];
        assert.ok(cs.some((c) => hsl(c).l < 0.15), `${fur} ${eyes} pupil ${cs}`);
        if (eyes !== "dark") assert.ok(cs.some((c) => hsl(c).s > 0.35), `${fur} ${eyes} iris ${cs}`);
      }
      const sizes = (["walk", "stand", "sit", "lie", "curl"] as const).map((pose) => {
        m.set!(pose, 1);
        const d = drawn(m.root);
        assert.ok(d.triangles <= 4224 * 1.5, `${fur} ${eyes} ${pose}: ${d.triangles} triangles`);
        return d.box.getSize(new THREE.Vector3());
      });
      // sitting tall, curled up low
      assert.ok(sizes[4].y < sizes[2].y * 0.7, `${fur} ${eyes}: curled ${sizes[4].y}, sitting ${sizes[2].y}`);
    }
  }
});

test("a rebuild and a dispose free the GPU objects of the pets they replace (#200)", () => {
  const { b, group, run } = house([{ ...cat, static: true, pose: "sit", x: 2.3, z: 1.1 }]);
  running = run;
  let geometries = 0;
  let materials = 0;
  let textures = 0;
  const watch = () => {
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.addEventListener("dispose", () => geometries++);
      for (const mat of [m.material].flat() as THREE.MeshBasicMaterial[]) {
        mat.addEventListener("dispose", () => materials++);
        mat.map?.addEventListener("dispose", () => textures++);
      }
    });
  };
  watch();
  assert.ok(group.children.length > 0);
  run.update(b, [{ ...cat, static: true, pose: "sit", x: 2.3, z: 1.1 }]);
  assert.ok(geometries > 0 && materials > 0 && textures > 0, "the old model was freed by the rebuild");
  geometries = materials = textures = 0;
  watch();
  run.dispose();
  assert.ok(geometries > 0 && materials > 0 && textures > 0, "dispose frees the model");
  assert.equal(group.children.length, 0);
});

// Roaming pets (#337): the daily routine and triggers, placed by the server, walked there, held at no cost

/** A house whose pets follow a stand-in server: `send` hands the pets' places over as home_3d/pets/subscribe does. */
function served(pets: Pet[], roam = true) {
  const floor = { ...newFloor("f", "Ground", 0), rooms: [rect("r", 0, 0, 6, 5)], furniture: [sofa] };
  const b = { ...emptyBuilding(), floors: [floor] };
  b.settings = { ...b.settings, pets: { on: true, roam, list: pets } };
  const group = new THREE.Group();
  const viewer = { floorMap: new Map([["f", { group, floor }]]), invalidate() {}, animate() {}, low: false, resting: false };
  const asked: Record<string, unknown>[] = [];
  let push: ((m: { pets: Record<string, PetLive> }) => void) | null = null;
  const connection = {
    subscribeMessage: <T,>(cb: (m: T) => void, msg: Record<string, unknown>) => {
      asked.push(msg);
      push = cb as never;
      return Promise.resolve(async () => undefined);
    },
  };
  const run = startPets({ lib, FloorMap, viewer, building: b, pets, night: () => false, base: () => 0, hass: () => ({ connection }), home: () => "second" });
  const send = (p: Record<string, Partial<PetLive>>) => push!({ pets: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { floor_id: null, pose: "sit", rotation: null, spot: null, trigger: null, until: null, ...v } as PetLive])) });
  return { group, run, send, asked };
}

const routine: Pet = { ...cat, spots: [{ id: "s1", x: 1, z: 4, pose: "lie" }, { id: "s2", x: 5, z: 4, pose: "curl" }] };
const at = (o: THREE.Object3D) => [o.position.x, o.position.z].map((v) => Math.round(v * 100) / 100);

test("a pet with a routine starts on its first spot and follows the server's place for the home shown (#337)", () => {
  const { group, run, send, asked } = served([routine]);
  running = run;
  assert.deepEqual(asked, [{ type: "home_3d/pets/subscribe", home_id: "second" }]);
  assert.deepEqual(at(group.children[0]), [1, 4]);
  // the first answer puts it there at once: no walk on opening the view
  send({ p: { x: 5, z: 4, pose: "curl", spot: "s2" } });
  assert.deepEqual(at(group.children[0]), [5, 4]);
  assert.equal(frames.length, 0, "holding its pose, it asks for no frames");
});

test("sent somewhere new, a pet walks there along the way, then holds its pose and no frames run (#337)", () => {
  const { group, run, send } = served([routine]);
  running = run;
  send({ p: { x: 1, z: 4, pose: "lie", spot: "s1" } });
  const held = poseOf(group.children[0]);
  // a trigger: standing at the bowls
  send({ p: { x: 5, z: 1.5, pose: "stand", trigger: "t1" } });
  assert.ok(frames.length > 0, "it walks");
  const path: number[][] = [];
  play(1);
  path.push(at(group.children[0]));
  play(20);
  assert.ok(path[0][0] > 1 && path[0][0] < 5, `on its way: ${path[0]}`);
  assert.deepEqual(at(group.children[0]), [5, 1.5]);
  assert.notEqual(poseOf(group.children[0]), held, "standing now");
  assert.equal(frames.length, 0, "there: no more frames");
  // the same place again changes nothing
  send({ p: { x: 5, z: 1.5, pose: "stand", trigger: "t1" } });
  assert.equal(frames.length, 0);
});

test("a pet sent up onto the sofa jumps up from its front and lies on the seat (#337)", () => {
  const { group, run, send } = served([routine]);
  running = run;
  send({ p: { x: 1, z: 4, spot: "s1" } });
  send({ p: { x: 2, z: 1, pose: "curl", spot: "s2" } });
  play(30);
  const p = group.children[0].position;
  assert.deepEqual(at(group.children[0]), [2, 1]);
  assert.ok(Math.abs(p.y - 0.85 * 0.58) < 1e-6, `on the seat: ${p.y}`);
});

test("with less motion asked for, a pet is put at its new place, not walked (#337)", () => {
  g.matchMedia = (q: string) => ({ matches: q.includes("reduce") });
  try {
    const { group, run, send } = served([routine]);
    running = run;
    send({ p: { x: 1, z: 4, spot: "s1" } });
    send({ p: { x: 5, z: 1.5, pose: "stand", trigger: "t1" } });
    assert.deepEqual(at(group.children[0]), [5, 1.5]);
    assert.equal(frames.length, 0);
  } finally {
    delete g.matchMedia;
  }
});

test("with roaming off a pet stays on its first spot, whatever the server says (#337)", () => {
  const { group, run, send } = served([routine], false);
  running = run;
  send({ p: { x: 5, z: 1.5, pose: "stand", trigger: "t1" } });
  play(5);
  assert.deepEqual(at(group.children[0]), [1, 4]);
  assert.equal(frames.length, 0);
});

test("a pet the server has no place for wanders the house as before (#337)", () => {
  const { group, run, send } = served([{ ...cat, triggers: [{ id: "t1", x: 5, z: 1 }] }]);
  running = run;
  send({});
  const start = at(group.children[0]);
  assert.ok(frames.length > 0, "it roams");
  play(30);
  assert.notDeepEqual(at(group.children[0]), start);
});

test("cats and dogs hold five different poses: sitting, loafing, sleeping, standing, grooming (#337)", () => {
  for (const pet of [cat, { ...cat, kind: "dog" as const, fur: "golden" }]) {
    const looks = PET_POSES.map((pose) => {
      const { group, run } = house([{ ...pet, static: true, spots: [{ id: "s", x: 4, z: 4, pose }] }]);
      const s = poseOf(group.children[0]);
      run.dispose();
      return s;
    });
    assert.equal(new Set(looks).size, 5, pet.kind);
  }
});
