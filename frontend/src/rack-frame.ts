// Rack frames (#112): a pack item with a `rack_frame` spec is an empty 19" or 10" rack (docs/packs.md, "Racks"). The
// item's parts draw the frame like any item; the spec says how many U it has and where they are, so the views can
// mark them and gear can be fitted into them later (#113). The backend checks the same rules
// (custom_components/home_3d/packs.py; a test compares the lists). Pure data, no DOM, no three.js.

import type { PackItem, PackPart, PackSymbol } from "./packs.ts";

/** 2-post, 4-post open frame, 4-post cabinet, wall-mounted frame, wall-mounted cabinet (NetBox's form factors). */
export const RACK_FORMS = ["frame2", "frame4", "cabinet", "wall_frame", "wall_cabinet"] as const;
export const RACK_WALL_FORMS = ["wall_frame", "wall_cabinet"] as const;
export const RACK_CABINET_FORMS = ["cabinet", "wall_cabinet"] as const;
export const RACK_DOORS = ["none", "glass", "mesh", "solid"] as const;
export const RACK_WIDTHS = [19, 10] as const;
/** 1U in metres (1.75 inches). */
export const RACK_UNIT = 0.04445;
/** Width across a panel's mounting ears by rack width: 19" = 482.6 mm, 10" = 254 mm. */
export const RACK_PANEL_WIDTH: Record<RackWidth, number> = { 19: 0.4826, 10: 0.254 };
export const RACK_MAX_U = 60;
const START_U: [number, number] = [1, 100];
const MOUNT_DEPTH: [number, number] = [0.05, 1.5];
const BOTTOM: [number, number] = [0, 2];
/** Measures may round to the millimetre. */
const SLACK = 0.001;

export type RackForm = (typeof RACK_FORMS)[number];
export type RackDoor = (typeof RACK_DOORS)[number];
export type RackWidth = (typeof RACK_WIDTHS)[number];

/** The spec as a pack writes it (`rack_frame` of an item). */
export interface RackFrameSpec {
  /** Height in rack units (1 to 60). */
  u: number;
  form: RackForm;
  /** 19 (default) or 10 inch. */
  width?: RackWidth;
  /** A cabinet's front door (default none). */
  door?: RackDoor;
  /** Number of the lowest U (default 1). */
  start_u?: number;
  /** Numbers run from the top down (default false). */
  desc?: boolean;
  /** Metres from the front rails to the rear ones: the deepest gear that fits (default: from the item's depth). */
  mount_depth?: number;
  /** Metres from the item's bottom to the bottom of its lowest U (default: the U space centred in the height). */
  bottom?: number;
}

/** A checked spec with its defaults; `mountDepth` and `bottom` stay null when the pack leaves them to the item's size. */
export interface RackFrame {
  u: number;
  form: RackForm;
  width: RackWidth;
  door: RackDoor;
  startU: number;
  desc: boolean;
  mountDepth: number | null;
  bottom: number | null;
}

/** What is wrong with an item's rack frame: the field and a short reason (English, for pack authors). */
export interface RackProblem {
  field: string;
  why: string;
}

const FIELDS = new Set(["u", "form", "width", "door", "start_u", "desc", "mount_depth", "bottom"]);

const whole = (v: unknown, [lo, hi]: [number, number]): boolean => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
const within = (v: unknown, [lo, hi]: [number, number]): boolean => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const isWallForm = (form: RackForm): boolean => (RACK_WALL_FORMS as readonly string[]).includes(form);

/** The rules of a rack frame against its item (the backend's RACK_FRAME_SCHEMA and _rack_fits); none for an item without one. */
export function rackFrameProblems(item: Pick<PackItem, "size" | "mount" | "rack_frame">): RackProblem[] {
  const raw = item.rack_frame as unknown;
  if (raw === undefined) return [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [{ field: "rack_frame", why: "a rack frame is an object" }];
  const f = raw as Record<string, unknown>;
  const out: RackProblem[] = [];
  const bad = (field: string, why: string): void => void out.push({ field, why });
  for (const key of Object.keys(f)) if (!FIELDS.has(key)) bad(key, "not a rack frame field");
  if (!whole(f.u, [1, RACK_MAX_U])) bad("u", `a whole number of U, 1 to ${RACK_MAX_U}`);
  if (!(RACK_FORMS as readonly unknown[]).includes(f.form)) bad("form", `one of ${RACK_FORMS.join(", ")}`);
  if (f.width !== undefined && !(RACK_WIDTHS as readonly unknown[]).includes(f.width)) bad("width", "19 or 10 (inches)");
  if (f.door !== undefined && !(RACK_DOORS as readonly unknown[]).includes(f.door)) bad("door", `one of ${RACK_DOORS.join(", ")}`);
  if (f.start_u !== undefined && !whole(f.start_u, START_U)) bad("start_u", "a whole number, 1 to 100");
  if (f.desc !== undefined && typeof f.desc !== "boolean") bad("desc", "true or false");
  if (f.mount_depth !== undefined && !within(f.mount_depth, MOUNT_DEPTH)) bad("mount_depth", "0.05 to 1.5 metres");
  if (f.bottom !== undefined && !within(f.bottom, BOTTOM)) bad("bottom", "0 to 2 metres");
  if (out.length) return out;
  // the spec against its item
  const [w, d, h] = item.size;
  const form = f.form as RackForm;
  const width = (f.width as RackWidth | undefined) ?? 19;
  if (RACK_PANEL_WIDTH[width] > w + SLACK) bad("width", "the rack's panels are wider than the item");
  if (((f.mount_depth as number | undefined) ?? 0) > d + SLACK) bad("mount_depth", "deeper than the item");
  const space = (f.u as number) * RACK_UNIT;
  const bottom = (f.bottom as number | undefined) ?? Math.max(0, (h - space) / 2);
  if (bottom + space > h + SLACK) bad("u", `${f.u}U do not fit in the item's height`);
  const mount = item.mount ?? "floor";
  if (isWallForm(form) !== (mount === "wall") || mount === "ceiling") bad("mount", 'a wall rack has "mount": "wall", any other stands on the floor or a desk');
  if ((f.door ?? "none") !== "none" && !(RACK_CABINET_FORMS as readonly string[]).includes(form)) bad("door", "only a cabinet has a door");
  return out;
}

/** An item's rack frame with its defaults, or null when it has none or it breaks the rules (then it is a plain item). */
export function readRackFrame(item: Pick<PackItem, "size" | "mount" | "rack_frame"> | undefined): RackFrame | null {
  const f = item?.rack_frame;
  if (!f || rackFrameProblems(item).length) return null;
  return { u: f.u, form: f.form, width: f.width ?? 19, door: f.door ?? "none", startU: f.start_u ?? 1, desc: f.desc ?? false, mountDepth: f.mount_depth ?? null, bottom: f.bottom ?? null };
}

/** The clear opening between the rails by rack width: 19" = 450.85 mm, 10" = 222.25 mm. */
export const RACK_OPENING: Record<RackWidth, number> = { 19: 0.45085, 10: 0.22225 };

/** How far the front rails sit behind the item's front, and the rear rails in front of its back (metres). */
export const FRONT_INSET: Record<RackForm, number> = { frame2: 0, frame4: 0, cabinet: 0.08, wall_frame: 0.02, wall_cabinet: 0.06 };
export const REAR_INSET: Record<RackForm, number> = { frame2: 0, frame4: 0.02, cabinet: 0.05, wall_frame: 0.01, wall_cabinet: 0.04 };
/** A 2-post rack's posts are this deep; gear hangs on the front of them. */
export const RACK_POST_DEPTH = 0.075;

/** One U position: its number and its bottom and top above the item's bottom (metres). `index` 0 is the lowest. */
export interface RackUnit {
  index: number;
  label: number;
  y0: number;
  y1: number;
}

/**
 * Where a rack's U positions are inside an item of `w` x `d` x `h` metres (the placed size), in the item's own
 * coordinates: x across from its centre, z from its centre with the front at +z, y up from its bottom. This is what
 * the views mark and what gear is fitted to (#113): gear's front panel sits on the `front` rail plane between the rails
 * (`panel` wide across its ears), at most `mountDepth` deep.
 */
export interface RackLayout {
  /** Height of one U (RACK_UNIT, less when the item is squeezed below its U space). */
  unit: number;
  units: RackUnit[];
  /** Bottom of the lowest U and top of the highest. */
  bottom: number;
  top: number;
  /** Width across the panels' ears and the clear opening between the rails. */
  panel: number;
  opening: number;
  /** The z of the front rails' face and of the rear rails (null: a 2-post rack has none). */
  front: number;
  rear: number | null;
  /** The deepest gear that fits behind the front rails. */
  mountDepth: number;
  /** Width of the side lane left and right of the panels, where 0U gear (a vertical PDU) stands (#114). */
  lane: number;
}

export function rackLayout(frame: RackFrame, w: number, d: number, h: number): RackLayout {
  const want = frame.u * RACK_UNIT;
  const bottom = Math.min(Math.max(0, frame.bottom ?? (h - want) / 2), Math.max(0, h - want));
  const unit = Math.min(RACK_UNIT, (h - bottom) / frame.u);
  const units = Array.from({ length: frame.u }, (_, index) => ({
    index,
    label: frame.desc ? frame.startU + frame.u - 1 - index : frame.startU + index,
    y0: bottom + index * unit,
    y1: bottom + (index + 1) * unit,
  }));
  const twoPost = frame.form === "frame2";
  const front = twoPost ? RACK_POST_DEPTH / 2 : d / 2 - FRONT_INSET[frame.form];
  const room = twoPost ? d : Math.max(0.01, d - FRONT_INSET[frame.form] - REAR_INSET[frame.form]);
  const mountDepth = Math.min(frame.mountDepth ?? room, twoPost ? d : d - FRONT_INSET[frame.form]);
  return {
    unit,
    units,
    bottom,
    top: bottom + frame.u * unit,
    panel: Math.min(w, RACK_PANEL_WIDTH[frame.width]),
    opening: Math.min(w, RACK_OPENING[frame.width]),
    front,
    rear: twoPost ? null : front - mountDepth,
    mountDepth,
    lane: Math.max(0, (w - Math.min(w, RACK_PANEL_WIDTH[frame.width])) / 2),
  };
}

// ---------------------------------------------------------------------------- the frame's parts (a pack's recipe)

/** A rack's parts and plan symbol, as a pack item carries them (fractions of its size). */
export interface RackFrameRecipe {
  parts: PackPart[];
  symbol: PackSymbol[];
}

const RAIL_DEPTH = 0.015;
const SIDE = 0.015;
const BACK = 0.012;
const DOOR = 0.02;
/** How deep a cabinet's door is (its front face at the cabinet's front, #131: taps on it). */
export const RACK_DOOR_DEPTH = DOOR;
const DOOR_RIM = 0.035;
const POST = 0.03;

/** Four decimals are a tenth of a millimetre on a metre-wide item. */
const r4 = (v: number): number => Math.round(v * 1e4) / 1e4;
/** A centre between two such edges. */
const r5 = (v: number): number => Math.round(v * 1e5) / 1e5;

/**
 * The parts of an empty rack of `size` (metres) that follow its spec: panels, plinth and door for a cabinet; corner
 * posts and frames for an open frame; brackets for a wall frame; two posts on feet for a 2-post rack; and its rails
 * where rackLayout() puts them. A glass or mesh door is drawn as its rim (and bars), so the gear inside stays in view.
 * tools/rack-frames.ts writes the bundled racks with it; a pack may draw its racks any other way.
 */
export function rackFrameParts(frame: RackFrame, size: [number, number, number]): RackFrameRecipe {
  const [w, d, h] = size;
  const at = rackLayout(frame, w, d, h);
  const parts: PackPart[] = [];
  /** A box in metres (item coordinates: x across from the centre, z with the front at +z, y up from the bottom). */
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string, extra: Partial<PackPart> = {}): void => {
    const fx0 = r4(Math.max(-0.5, x0 / w));
    const fx1 = r4(Math.min(0.5, x1 / w));
    const fz0 = r4(Math.max(-0.5, z0 / d));
    const fz1 = r4(Math.min(0.5, z1 / d));
    const fy0 = r4(Math.max(0, y0 / h));
    const fy1 = r4(Math.min(1, y1 / h));
    if (fx1 <= fx0 || fz1 <= fz0 || fy1 <= fy0) return;
    parts.push({ shape: "box", x: r5((fx0 + fx1) / 2), z: r5((fz0 + fz1) / 2), w: r4(fx1 - fx0), d: r4(fz1 - fz0), y: fy0, h: r4(fy1 - fy0), color, ...extra });
  };
  /** The same box on both sides (x0, x1 on the right; mirrored to the left). */
  const pair = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string, extra: Partial<PackPart> = {}): void => {
    box(-x1, -x0, y0, y1, z0, z1, color, extra);
    box(x0, x1, y0, y1, z0, z1, color, extra);
  };
  const inner = at.opening / 2;
  const rail = Math.max(0.01, (at.panel - at.opening) / 2);
  const rails = (z1: number): void => pair(inner, inner + rail, at.bottom, at.top, z1 - RAIL_DEPTH, z1, "metal", { fix: "w" });
  const W = w / 2;
  const D = d / 2;
  const faint = (fix: string): Partial<PackPart> => ({ edges: "faint", fix });

  if (frame.form === "cabinet" || frame.form === "wall_cabinet") {
    const door = frame.door !== "none";
    const roof = Math.min(0.05, Math.max(0.01, h - at.top));
    const floor = frame.form === "cabinet" ? Math.max(0.01, Math.min(0.02, at.bottom)) : Math.min(0.05, Math.max(0.01, at.bottom));
    const floorY = frame.form === "cabinet" ? Math.max(0, at.bottom - floor) : 0;
    // a floor cabinet's plinth (or castors) under its floor plate
    if (floorY > 0.01) box(-W + 0.03, W - 0.03, 0, floorY, -D + 0.03, D - 0.03, "dark", { fix: "h" });
    const front = door ? D - DOOR : D;
    pair(W - SIDE, W, floorY, h, -D, front, "dark", { fix: "w" });
    box(-W + SIDE, W - SIDE, floorY, floorY + floor, -D, front, "dark", { fix: "h" });
    box(-W + SIDE, W - SIDE, h - roof, h, -D, front, "dark", { fix: "h" });
    box(-W + SIDE, W - SIDE, floorY + floor, h - roof, -D, -D + BACK, "dark", { fix: "d" });
    rails(at.front);
    if (at.rear !== null) rails(at.rear + RAIL_DEPTH);
    if (door) {
      const y0 = floorY;
      if (frame.door === "solid") box(-W, W, y0, h, D - DOOR, D, "dark", faint("d"));
      else {
        // the rim, and for a mesh door its bars; the pane itself stays clear
        pair(W - DOOR_RIM, W, y0, h, D - DOOR, D, "dark", faint("w"));
        box(-W + DOOR_RIM, W - DOOR_RIM, y0, y0 + DOOR_RIM, D - DOOR, D, "dark", faint("h"));
        box(-W + DOOR_RIM, W - DOOR_RIM, h - DOOR_RIM, h, D - DOOR, D, "dark", faint("h"));
        if (frame.door === "mesh") {
          const bars = 5;
          const span = 2 * (W - DOOR_RIM);
          for (let i = 1; i <= bars; i++) {
            const x = -W + DOOR_RIM + (span * i) / (bars + 1);
            box(x - 0.003, x + 0.003, y0 + DOOR_RIM, h - DOOR_RIM, D - DOOR / 2 - 0.002, D - DOOR / 2 + 0.002, "metal");
          }
        }
      }
      // the handle, on the right of the door
      const hy = Math.min(h / 2, 1.1);
      box(W - DOOR_RIM / 2 - 0.006, W - DOOR_RIM / 2 + 0.006, Math.max(y0, hy - 0.06), Math.min(h, hy + 0.06), D - DOOR - 0.001, D, "metal");
    }
  } else if (frame.form === "frame4") {
    // corner posts, a frame at the top and the bottom, the rails between
    // the front posts stand just behind the rails (on a 10-inch mini rack the rails are its front uprights)
    pair(W - POST, W, 0, h, -D, -D + POST, "dark", faint("w"));
    pair(Math.max(inner, W - POST), W, 0, h, D - RAIL_DEPTH - POST, D - RAIL_DEPTH, "dark", faint("w"));
    for (const [y0, y1] of [[0, POST], [h - POST, h]]) {
      for (const z of [-D, D - POST]) box(-W + POST, W - POST, y0, y1, z, z + POST, "dark", faint("h"));
      pair(W - POST, W, y0, y1, -D + POST, D - POST, "dark", faint("h"));
    }
    rails(at.front);
    if (at.rear !== null) rails(at.rear + RAIL_DEPTH);
  } else if (frame.form === "wall_frame") {
    // a bracket on the wall (the back), arms at the top and the bottom out to the front rails
    pair(W - POST, W, 0, h, -D, -D + POST, "dark", faint("w"));
    for (const [y0, y1] of [[0, POST], [h - POST, h]]) {
      pair(inner, W, y0, y1, -D + POST, at.front, "dark", faint("h"));
      box(-W + POST, W - POST, y0, y1, -D, -D + POST, "dark", faint("h"));
    }
    rails(at.front);
  } else {
    // 2-post: two posts on feet, tied at the top and the bottom; gear hangs on the posts' front
    const zBack = at.front - RACK_POST_DEPTH;
    const post = Math.min(Math.max(rail, 0.04), W - inner);
    pair(inner, inner + post, 0, h, zBack, at.front - RAIL_DEPTH, "dark", faint("w"));
    rails(at.front);
    pair(inner - 0.02, Math.min(W, inner + post + 0.02), 0, 0.05, -D, D, "dark", faint("h"));
    box(-inner, inner, h - 0.04, h, zBack, at.front - RAIL_DEPTH, "dark", faint("h"));
    box(-inner, inner, 0, 0.05, zBack, at.front - RAIL_DEPTH, "dark", faint("h"));
  }
  const zf = r4(at.front / d);
  const symbol: PackSymbol[] = [
    { shape: "rect", x: 0, z: 0, w: 1, d: 1 },
    { shape: "line", x1: -0.5, z1: zf, x2: 0.5, z2: zf },
  ];
  return { parts, symbol };
}

/** A U mark on a front rail (metres, item coordinates); `major` every fifth U boundary. */
export interface RackMark {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  major: boolean;
}

/** Ticks on the face of both front rails at every U boundary, longer every fifth: how the 3D view marks a rack's U (#112). */
export function rackMarks(at: RackLayout): RackMark[] {
  const inner = at.opening / 2;
  const rail = Math.max(0.01, (at.panel - at.opening) / 2);
  const out: RackMark[] = [];
  for (let k = 0; k <= at.units.length; k++) {
    const y = at.bottom + k * at.unit;
    const major = k % 5 === 0;
    const y0 = Math.max(at.bottom, y - 0.0007);
    const y1 = Math.min(at.top, y + 0.0007);
    const x0 = inner + rail * 0.15;
    const x1 = inner + rail * (major ? 0.95 : 0.6);
    const z0 = at.front;
    const z1 = at.front + 0.0015;
    out.push({ x0: -x1, x1: -x0, y0, y1, z0, z1, major }, { x0, x1, y0, y1, z0, z1, major });
  }
  return out;
}
