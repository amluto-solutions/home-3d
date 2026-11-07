// Rack drawings without 3D (#115): a cabinet's door swing for the plan symbol, and the front elevation of a placed
// rack with its gear, drawn from the gear items' own parts. The elevation is one SVG string, built on demand (a tap,
// the item panel) and never per frame; the item panel and the 2D view's sheet show the same drawing. Pure: no DOM,
// no three.js.

import type { PackItem, PackPart } from "./packs.ts";
import type { Furniture } from "./model.ts";
import { RACK_CABINET_FORMS, RACK_UNIT, rackLayout, readRackFrame, type RackFrame } from "./rack-frame.ts";
import { RACK_STATUS_COLOURS, type RackStatus } from "./rack-links.ts";
import { rackContents, readRackGear, type RackPiece, type RackSlot } from "./rack.ts";

type Pt = [number, number];

/** Four decimals: a tenth of a millimetre. */
const r4 = (v: number): number => Math.round(v * 1e4) / 1e4 + 0;

/** A cabinet door's swing in the item's plan coordinates (x across, z with the front at +z): the open leaf and its arc. */
export interface RackDoorSwing {
  leaf: [Pt, Pt];
  /** SVG path from the open leaf's tip round to the closed door's tip. */
  arc: string;
}

/**
 * Where a cabinet's front door swings: hinged at the front left corner (its handle is on the right, rack-frame.ts),
 * a quarter circle as wide as the cabinet, so the plan shows the room the door needs. Null when there is no door.
 */
export function rackDoorSwing(frame: RackFrame, w: number, d: number): RackDoorSwing | null {
  if (frame.door === "none" || !(RACK_CABINET_FORMS as readonly string[]).includes(frame.form)) return null;
  const hx = r4(-w / 2);
  const z = r4(d / 2);
  const open = r4(d / 2 + w);
  const r = r4(w);
  return { leaf: [[hx, z], [hx, open]], arc: `M${hx} ${open}A${r} ${r} 0 0 0 ${r4(w / 2)} ${z}` };
}

// ---------------------------------------------------------------------------- the front elevation

/** Which side of the rack the drawing shows; a slot without a face sits on the front (#114 adds the rear). */
export type RackFace = "front" | "rear";

export interface ElevationInput {
  frame: RackFrame;
  /** The placed rack's size (metres: width, depth, height). */
  size: readonly [number, number, number];
  slots: readonly RackSlot[];
  /** The gear's pack item (packItem in the app; the recipe copies in the plan). */
  itemOf: (type: string) => PackItem | undefined;
  /** The name a piece shows: its own, else its item's in the viewer's language. */
  nameOf: (slot: RackSlot, item: PackItem) => string;
  /** Default front. */
  face?: RackFace;
  /** The drawing's accessible name (the rack's name). */
  title?: string;
  /** A linked slot's status (#119, rack-links.ts slotStatus): its LED; null or none = no LED. */
  statusOf?: (slot: RackSlot) => RackStatus | null;
}

export interface RackElevation {
  svg: string;
  /** Natural size in CSS pixels (shown at this size, text stays readable). */
  width: number;
  height: number;
  /** Pixels per metre, and the margin above and below the rack. */
  scale: number;
  pad: number;
  /** What the drawing shows, for its alt text. */
  label: string;
  /** Each piece of gear's box in drawing pixels, its slot and its full name (a tooltip over a picture of it, #130). */
  gear: { slot: string; title: string; x: number; y: number; w: number; h: number }[];
  /** Gear drawn, the U it takes, and the rack's U. */
  pieces: number;
  used: number;
  u: number;
}

/** Draws a tapped rack's front view with the names and title the view chooses (the 2D bundle owns the drawing code). */
export type RackDraw = (nameOf: ElevationInput["nameOf"], title: string, statusOf?: ElevationInput["statusOf"]) => RackElevation;

/** How to draw a placed rack's front view (#115; #119 adds the LEDs): null when the item is no rack. */
export function rackDrawOf(f: Pick<Furniture, "type" | "w" | "d" | "h" | "rack">, itemOf: (type: string) => PackItem | undefined): RackDraw | null {
  const frame = readRackFrame(itemOf(f.type));
  if (!frame) return null;
  return (nameOf, title, statusOf) => rackElevation({ frame, size: [f.w, f.d, f.h], slots: f.rack?.slots ?? [], itemOf, nameOf, title, statusOf });
}

/** One U is at least this tall, and a panel at least this wide, on screen: a 14 px name fits on a 1U row. */
const U_PX = 24;
const PANEL_PX = 220;
const PAD = 8;
/** Room for the U numbers left and right of the rack. */
const GUTTER = 30;
const NAME_PX = 14;
/** A status LED (#119): its edge, and its gap from the gear's right edge. */
const LED_PX = 9;
const LED_GAP = 7;
const NUMBER_PX = 13;
/** A rough width of one character of the name at NAME_PX (system sans), to shorten long names. */
const CHAR_PX = 7.6;
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

/** The look of colour roles in the drawing (a rack is dark, its gear lighter so it stands out). */
const ROLE: Record<string, string> = {
  body: "#3a4457",
  fabric: "#4a5468",
  cushion: "#56617a",
  wood: "#7a5a3c",
  white: "#e6e9ee",
  metal: "#9aa3b2",
  dark: "#2a303c",
  glass: "#5b7fa0",
  plant: "#3f7a4f",
  pot: "#6b5a4a",
  accent: "#2bb3e0",
  paint: "#4a6ea8",
};
const BG = "#0d1017";
const RACK = "#161a22";
const OPENING = "#07090d";
const RAIL = "#7d8696";
const LINE = "#3a4150";
const TEXT = "#f2f5fa";
const NUMBER = "#a7b2c5";

const esc = (v: string): string => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
/** One decimal is plenty for pixels. */
const px = (v: number): number => Math.round(v * 10) / 10 + 0;
const colour = (c: string | undefined): string => (c && /^#[0-9a-f]{3,8}$/i.test(c) ? c : (ROLE[c ?? "body"] ?? ROLE.body));
const short = (name: string, room: number): string => {
  const n = Math.max(3, Math.floor(room / CHAR_PX));
  return name.length <= n ? name : `${name.slice(0, n - 1).trimEnd()}…`;
};

/** Is a piece of gear on this face? Full-depth gear (#114) shows on either; the rest where rackContents turned it. */
const onFace = (piece: RackPiece, face: RackFace): boolean => (!piece.slot.on && readRackGear(piece.item)?.depth === "full") || piece.back === (face === "rear");

/**
 * The front (or rear) elevation of a placed rack: the frame's outline and rails, every U numbered on both sides in
 * the rack's own numbering, and each piece of gear drawn at its U from its item's parts seen from that face (front
 * parts over back ones) with its name across it. Sized for a wall tablet: 1U is at least 24 px and a panel at least
 * 220 px wide; the caller shows it at its natural size (scrolls when tall) or scales it down to fit.
 */
export function rackElevation(input: ElevationInput): RackElevation {
  const { frame, slots, itemOf, nameOf } = input;
  const face = input.face ?? "front";
  const w = Math.max(0.05, input.size[0]);
  const h = Math.max(0.005, input.size[2]);
  const at = rackLayout(frame, w, Math.max(0.05, input.size[1]), h);
  const scale = Math.max(U_PX / RACK_UNIT, PANEL_PX / at.panel);
  const width = Math.round(w * scale + 2 * GUTTER);
  const height = Math.round(h * scale + 2 * PAD);
  // rack metres (x from the centre, y up from the bottom) to drawing pixels
  const X = (x: number): number => px(GUTTER + (x + w / 2) * scale);
  const Y = (y: number): number => px(PAD + (h - y) * scale);
  const box = (cls: string, x0: number, y0: number, x1: number, y1: number, fill: string, extra = ""): string =>
    `<rect class="${cls}" x="${X(x0)}" y="${Y(y1)}" width="${px((x1 - x0) * scale)}" height="${px((y1 - y0) * scale)}" fill="${fill}"${extra}/>`;

  const out: string[] = [`<rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="${BG}"/>`];
  out.push(box("fp3d-el-rack", -w / 2, 0, w / 2, h, RACK, ` stroke="${LINE}"`));
  const inner = at.opening / 2;
  const outer = at.panel / 2;
  out.push(box("fp3d-el-opening", -inner, at.bottom, inner, at.top, OPENING));
  out.push(box("fp3d-el-rail", -outer, at.bottom, -inner, at.top, RAIL), box("fp3d-el-rail", inner, at.bottom, outer, at.top, RAIL));
  // the U rows: a line at each boundary, the number left and right of the rack at the row's middle
  for (const u of at.units) {
    if (u.index > 0) out.push(`<line x1="${X(-inner)}" y1="${Y(u.y0)}" x2="${X(inner)}" y2="${Y(u.y0)}" stroke="${LINE}"/>`);
    const y = px(Y((u.y0 + u.y1) / 2) + NUMBER_PX * 0.35);
    out.push(`<text class="fp3d-el-u fp3d-el-u-l" x="${GUTTER - 6}" y="${y}" font-size="${NUMBER_PX}" text-anchor="end" fill="${NUMBER}">${u.label}</text>`);
    out.push(`<text class="fp3d-el-u fp3d-el-u-r" x="${width - GUTTER + 6}" y="${y}" font-size="${NUMBER_PX}" fill="${NUMBER}">${u.label}</text>`);
  }
  // the gear where rack.ts puts it (columns and faces follow once #114 places them there)
  const shown = rackContents(at, slots, itemOf).filter((p) => onFace(p, face));
  let used = 0;
  const gear: RackElevation["gear"] = [];
  for (const p of shown) {
    used += readRackGear(p.item)?.u ?? 0;
    const x0 = p.x - p.w / 2;
    const fw = p.w * scale;
    const fh = p.h * scale;
    // seen from this face: the parts further away first, so the near ones cover them
    const order = [...p.item.parts].sort((a, b) => (face === "front" ? reach(a) - reach(b) : reach(b) - reach(a)));
    const parts = order.map((q) => part(q, p, X, Y, scale, face)).join("");
    const full = nameOf(p.slot, p.item);
    // its status LED (#119): at the right end of its panel, halfway up (the name sits on the left and keeps clear of it)
    const status = input.statusOf?.(p.slot) ?? null;
    const size = Math.min(LED_PX, fh - 4, fw / 4);
    const lit = !!status && size >= 3;
    const name = short(full, fw - 20 - (lit ? LED_GAP + size + 4 : 0));
    const ty = px(Y(p.y + p.h / 2) + NAME_PX * 0.36);
    const tag =
      fh >= NAME_PX + 4
        ? `<rect class="fp3d-el-tag" x="${px(X(x0) + 6)}" y="${px(ty - NAME_PX)}" width="${px(Math.min(fw - 12, name.length * CHAR_PX + 8))}" height="${NAME_PX + 5}" rx="3" fill="${BG}" fill-opacity="0.75"/><text x="${px(X(x0) + 10)}" y="${ty}" font-size="${NAME_PX}" fill="${TEXT}">${esc(name)}</text>`
        : "";
    const led =
      status && lit
        ? `<rect class="fp3d-el-led fp3d-el-led-${status}" data-slot="${esc(p.slot.id)}" x="${px(X(x0) + fw - LED_GAP - size)}" y="${px(Y(p.y + p.h / 2) - size / 2)}" width="${px(size)}" height="${px(size)}" rx="2" fill="${RACK_STATUS_COLOURS[status]}" stroke="${BG}"/>`
        : "";
    gear.push({ slot: p.slot.id, title: full, x: X(x0), y: Y(p.y + p.h), w: px(fw), h: px(fh) });
    out.push(
      `<g class="fp3d-el-gear" data-slot="${esc(p.slot.id)}"><rect class="fp3d-el-face" x="${X(x0)}" y="${Y(p.y + p.h)}" width="${px(fw)}" height="${px(fh)}" fill="${ROLE.dark}" stroke="${LINE}"/>${parts}${tag}${led}<title>${esc(full)}</title></g>`,
    );
  }
  const label = input.title ?? "Rack";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}" class="fp3d-elevation" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="${FONT}">${out.join("")}</svg>`;
  return { svg, width, height, scale, pad: PAD, label, gear, pieces: shown.length, used, u: frame.u };
}

/** How far forward a part reaches (fraction of the item's depth; the front is +0.5). */
const reach = (q: PackPart): number => q.z + q.d / 2;

/** A part of a piece seen from the face: anything boxy as a rectangle, a ball or a cylinder along z as an ellipse. */
function part(q: PackPart, p: { x: number; y: number; w: number; h: number }, X: (x: number) => number, Y: (y: number) => number, scale: number, face: RackFace): string {
  // from the rear, left and right swap
  const cx = p.x + (face === "front" ? q.x : -q.x) * p.w;
  const cy = p.y + (q.y + q.h / 2) * p.h;
  const hw = (q.w * p.w) / 2;
  const hh = (q.h * p.h) / 2;
  const fill = colour(q.color);
  const edge = q.edges === "faint" ? ` stroke="${LINE}"` : "";
  if (q.shape === "sphere" || (q.shape === "cyl" && q.axis === "z")) {
    return `<ellipse class="fp3d-el-part" cx="${X(cx)}" cy="${Y(cy)}" rx="${px(hw * scale)}" ry="${px(hh * scale)}" fill="${fill}"${edge}/>`;
  }
  return `<rect class="fp3d-el-part" x="${X(cx - hw)}" y="${Y(cy + hh)}" width="${px(2 * hw * scale)}" height="${px(2 * hh * scale)}" fill="${fill}"${edge}/>`;
}
