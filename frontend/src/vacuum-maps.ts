// Robot vacuum maps in the 3D view (#350): each map camera's picture laid on its floor, aligned to the plan, with the
// robot and its dock as live markers. A lazy chunk of the main bundle: the 3D view loads it only for a plan with maps
// while the View's "Vacuum maps" switch is on (switched off, it is disposed: nothing is fetched or drawn). three.js
// comes from the 3D bundle (passed in), the maths from vacuum-map.ts.
//
// The picture is fetched through Home Assistant's camera proxy, signed in (hass.fetchWithAuth; the proxy's ?token= is
// only the fallback), again when the camera's state or attributes change, but at most every REFRESH_MS (while the
// robot cleans; a robot at rest changes nothing, so nothing is fetched). The robot and dock markers move with every new state at once (their positions are attributes).

import type * as THREE from "three";
import type { Building, Floor, VacuumMap } from "./model.ts";
import type { HomeAssistant } from "./types.ts";
import { apply, compose, fetchMapImage, floorCentre, imageToPlan, readMapCamera, spotOnPlan, type Affine, type MapCamera, type Pt } from "./vacuum-map.ts";

/** The three.js classes the overlay needs, lent by the 3D bundle (its `funLib`). */
export type VacuumLib = Pick<typeof THREE, "Group" | "Mesh" | "MeshBasicMaterial" | "CanvasTexture" | "BufferGeometry" | "Float32BufferAttribute"> & { DoubleSide: typeof THREE.DoubleSide };

/** The parts of Home 3D's viewer the maps live in (reached at run time). */
export interface VacuumViewer {
  floorMap: Map<string, { group: THREE.Group; floor: Floor }>;
  invalidate(): void;
}

export interface VacuumContext {
  lib: VacuumLib;
  viewer: VacuumViewer;
  building: Building;
  hass: HomeAssistant | undefined;
}

export interface VacuumController {
  /** A new plan (the floors were built anew, or the maps changed). */
  update(building: Building): void;
  /** New states: the markers move, a changed map is fetched again. */
  setHass(hass: HomeAssistant | undefined): void;
  dispose(): void;
}

/** The fewest milliseconds between two fetches of one map's picture. */
export const REFRESH_MS = 10_000;
/** Heights above the floor (m): the picture, then the markers on it. */
const MAP_Y = 0.012;
const MARK_Y = 0.06;
/** Opacity of a map that has none set. */
export const DEFAULT_OPACITY = 0.6;

/** The maps the 3D view shows: switched on, on a floor that exists. */
export function shownMaps(b: Building | null | undefined): VacuumMap[] {
  return (b?.settings.vacuum_maps ?? []).filter((m) => m.show !== false && !!m.camera && b!.floors.some((f) => f.id === m.floor_id));
}

interface Shown {
  map: VacuumMap;
  root: THREE.Group;
  picture: THREE.Mesh | null;
  texture: THREE.CanvasTexture | null;
  size: Pt | null;
  robot: THREE.Group;
  dock: THREE.Group;
  /** The camera state last seen (its object: any change of it). */
  seen: unknown;
  fetchedAt: number;
  fetching: boolean;
  /** The state seen when the last fetch began (a newer one fetches again). */
  fetchedFor: unknown;
  timer: ReturnType<typeof setTimeout> | null;
}

/** A flat disc (radius r, n sides) at height 0, facing up. */
function disc(lib: VacuumLib, r: number, n = 24, from = 0, to = Math.PI * 2): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = from + ((to - from) * i) / n;
    const a1 = from + ((to - from) * (i + 1)) / n;
    pos.push(0, 0, 0, Math.cos(a1) * r, 0, Math.sin(a1) * r, Math.cos(a0) * r, 0, Math.sin(a0) * r);
  }
  const g = new lib.BufferGeometry();
  g.setAttribute("position", new lib.Float32BufferAttribute(pos, 3));
  return g;
}

/** A flat triangle list from [x, z] corners (a fan from the first). */
function flat(lib: VacuumLib, pts: Pt[]): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) for (const p of [pts[0], pts[i + 1], pts[i]]) pos.push(p[0], 0, p[1]);
  const g = new lib.BufferGeometry();
  g.setAttribute("position", new lib.Float32BufferAttribute(pos, 3));
  return g;
}

const mat = (lib: VacuumLib, color: number, opacity = 1) =>
  new lib.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: lib.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

/** The robot: a white disc with a dark rim and a cyan wedge to the front (+x of the group), a little over life size. */
function robotMarker(lib: VacuumLib): THREE.Group {
  const g = new lib.Group();
  const rim = new lib.Mesh(disc(lib, 0.24), mat(lib, 0x1d2733));
  const body = new lib.Mesh(disc(lib, 0.2), mat(lib, 0xf4f7fa));
  body.position.y = 0.002;
  const nose = new lib.Mesh(flat(lib, [[0.19, 0], [0.02, -0.1], [0.02, 0.1]]), mat(lib, 0x16b4d8));
  nose.position.y = 0.004;
  g.add(rim, body, nose);
  g.renderOrder = 4;
  return g;
}

/** The dock: a dark rounded block with a green light. */
function dockMarker(lib: VacuumLib): THREE.Group {
  const g = new lib.Group();
  const base = new lib.Mesh(flat(lib, [[-0.14, -0.2], [0.14, -0.2], [0.14, 0.2], [-0.14, 0.2]]), mat(lib, 0x2b3542));
  const led = new lib.Mesh(disc(lib, 0.06, 12), mat(lib, 0x3ddc84));
  led.position.y = 0.002;
  g.add(base, led);
  g.renderOrder = 4;
  return g;
}

/** The picture as one quad: its four corners where image -> plan puts them. */
function pictureGeometry(lib: VacuumLib, ip: Affine, size: Pt): THREE.BufferGeometry {
  const [w, h] = size;
  const c = ([[0, 0], [w, 0], [w, h], [0, h]] as Pt[]).map((p) => apply(ip, p));
  const pos: number[] = [];
  const uv: number[] = [];
  // the texture's v runs up the picture (flipY)
  const uvs: Pt[] = [[0, 1], [1, 1], [1, 0], [0, 0]];
  for (const i of [0, 1, 2, 0, 2, 3]) {
    pos.push(c[i][0], 0, c[i][1]);
    uv.push(uvs[i][0], uvs[i][1]);
  }
  const g = new lib.BufferGeometry();
  g.setAttribute("position", new lib.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new lib.Float32BufferAttribute(uv, 2));
  return g;
}

/** Turns a fetched picture into a canvas (an ImageBitmap would ignore the texture's flip on some browsers). */
async function decode(blob: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function startVacuumMaps(ctx: VacuumContext): VacuumController {
  const { lib, viewer } = ctx;
  let building = ctx.building;
  let hass = ctx.hass;
  let disposed = false;
  const shown = new Map<string, Shown>();

  const floorOf = (m: VacuumMap) => building.floors.find((f) => f.id === m.floor_id);
  const cameraOf = (m: VacuumMap): MapCamera & { attrs: Record<string, unknown> | undefined } => {
    const attrs = hass?.states[m.camera]?.attributes as Record<string, unknown> | undefined;
    return { ...readMapCamera(attrs), attrs };
  };

  /** Into its floor's group (the floors come one per frame after a new plan, and a rebuilt floor has a new group). */
  const attach = (s: Shown): boolean => {
    const group = viewer.floorMap.get(s.map.floor_id)?.group;
    if (group && s.root.parent !== group) group.add(s.root);
    return !!group;
  };
  let retry: ReturnType<typeof setTimeout> | null = null;
  let tries = 0;
  /** Floors not built yet: looked for again shortly (for half a minute at most). */
  const attachAll = () => {
    retry = null;
    if (disposed) return;
    let missing = false;
    for (const s of shown.values()) missing = !attach(s) || missing;
    viewer.invalidate();
    if (missing && tries++ < 60) retry = setTimeout(attachAll, 500);
  };

  /** Where the picture and the markers go now (the plan, the camera's calibration and the picture's size). */
  const place = (s: Shown) => {
    attach(s);
    const cam = cameraOf(s.map);
    const floor = floorOf(s.map);
    const centre = floorCentre(floor?.rooms ?? []);
    const ip = s.size ? imageToPlan(cam.calibration, s.size, s.map.points ?? [], centre) : null;
    if (s.picture && s.size) {
      s.picture.geometry.dispose();
      if (ip) s.picture.geometry = pictureGeometry(lib, ip, s.size);
      s.picture.visible = !!ip;
      (s.picture.material as THREE.MeshBasicMaterial).opacity = s.map.opacity ?? DEFAULT_OPACITY;
    }
    // vacuum -> plan for the markers: image -> plan after vacuum -> image
    const vp = ip && cam.calibration ? compose(ip, cam.calibration) : null;
    for (const [marker, spot] of [
      [s.robot, cam.robot],
      [s.dock, cam.dock],
    ] as const) {
      marker.visible = !!(vp && spot);
      if (!vp || !spot) continue;
      const at = spotOnPlan(vp, spot);
      marker.position.set(at.at[0], MARK_Y + (marker === s.robot ? 0.006 : 0), at.at[1]);
      // the marker's front is its +x: turned to the heading (three.js turns +x towards -z for a positive angle)
      marker.rotation.y = at.heading == null ? 0 : -at.heading;
    }
    viewer.invalidate();
  };

  /** Fetch the map's picture (once at a time; again later when the camera changed meanwhile). */
  const fetchPicture = async (s: Shown) => {
    // no camera (yet): nothing to fetch; its first state brings the picture
    if (s.fetching || disposed || !hass?.states[s.map.camera]) return;
    const wait = s.fetchedAt + REFRESH_MS - Date.now();
    if (s.fetchedAt && wait > 0) {
      if (!s.timer) s.timer = setTimeout(() => ((s.timer = null), void fetchPicture(s)), wait);
      return;
    }
    s.fetching = true;
    s.fetchedFor = s.seen;
    s.fetchedAt = Date.now();
    try {
      const cam = cameraOf(s.map);
      const canvas = await decode(await fetchMapImage(hass as never, s.map.camera, cam.attrs?.access_token));
      if (disposed || shown.get(s.map.id) !== s) return;
      s.size = [canvas.width, canvas.height];
      s.texture?.dispose();
      s.texture = new lib.CanvasTexture(canvas);
      // the picture's colours as drawn (an sRGB picture, like the 3D bundle's own textures)
      s.texture.colorSpace = "srgb";
      if (!s.picture) {
        const m = new lib.MeshBasicMaterial({ map: s.texture, transparent: true, opacity: s.map.opacity ?? DEFAULT_OPACITY, side: lib.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
        s.picture = new lib.Mesh(new lib.BufferGeometry(), m);
        s.picture.position.y = MAP_Y;
        s.picture.renderOrder = 3;
        s.root.add(s.picture);
      } else (s.picture.material as THREE.MeshBasicMaterial).map = s.texture;
      (s.picture.material as THREE.MeshBasicMaterial).needsUpdate = true;
      place(s);
    } catch (err) {
      // no picture yet (the robot has no map, the camera is off): tried again with its next change, after 2 s
      s.fetchedAt = Date.now() - REFRESH_MS + 2000;
      console.warn("Home 3D: a vacuum map could not be loaded", err);
    } finally {
      s.fetching = false;
    }
    if (!disposed && s.seen !== s.fetchedFor) void fetchPicture(s);
  };

  const drop = (s: Shown) => {
    if (s.timer) clearTimeout(s.timer);
    s.root.removeFromParent();
    s.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    s.texture?.dispose();
  };

  /** Each shown map in its floor's group (a rebuilt floor has a new group). */
  const sync = () => {
    const maps = shownMaps(building);
    for (const [id, s] of shown) {
      if (maps.some((m) => m.id === id && m.camera === s.map.camera)) continue;
      drop(s);
      shown.delete(id);
    }
    for (const map of maps) {
      let s = shown.get(map.id);
      if (!s) {
        const root = new lib.Group();
        const robot = robotMarker(lib);
        const dock = dockMarker(lib);
        robot.visible = dock.visible = false;
        root.add(dock, robot);
        s = { map, root, picture: null, texture: null, size: null, robot, dock, seen: undefined, fetchedAt: 0, fetching: false, fetchedFor: undefined, timer: null };
        shown.set(map.id, s);
      }
      s.map = map;
      s.seen = hass?.states[map.camera];
      if (!s.size && !s.fetching) void fetchPicture(s);
      else place(s);
    }
    tries = 0;
    if (!retry) attachAll();
  };

  sync();

  return {
    update(b) {
      building = b;
      sync();
    },
    setHass(next) {
      const old = hass;
      hass = next;
      if (!next || old?.states === next.states) return;
      for (const s of shown.values()) {
        const st = next.states[s.map.camera];
        if (st === s.seen) continue;
        s.seen = st;
        place(s);
        // the picture may have changed with it (dreame_vacuum: the state is the map's update time; the map extractor
        // keeps its state): fetched again, at most every REFRESH_MS
        void fetchPicture(s);
      }
    },
    dispose() {
      disposed = true;
      if (retry) clearTimeout(retry);
      for (const s of shown.values()) drop(s);
      shown.clear();
      viewer.invalidate();
    },
  };
}
