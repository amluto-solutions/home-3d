// Room names that would sit on each other (#263, V15): on a whole-floor view the smaller room's name gives way to the
// larger one's, and comes back as soon as there is room for it (zooming in spreads the names out until all show).
// One pass for every name on a plan (#341): room names, outdoor area names and item names, in the 2D editor, the 2D
// view and the 3D view. Rooms rank above outdoor areas, those above items; a selected one always shows.
// Pure: boxes in, a show/hide answer out. It runs when the view changes, never per frame, and reads no layout: text
// widths come from a canvas (measured once per text) and a pin's size is measured once per text.

import { polygonArea, type Room } from "../model.ts";

/** A room name on the screen: its centre (px), size (px) and rank (the larger rank wins a clash). */
export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
  rank: number;
  /** Always shows (the selected room or item); it still keeps others off its place. */
  keep?: boolean;
}

/** The space kept between two names so they never touch (px; 2 looked touching on a phone, #341). */
const GAP = 6;

/** Which names show: from the highest rank down, a name shows when it overlaps none already shown. */
export function clearLabels(boxes: readonly LabelBox[]): boolean[] {
  const order = boxes.map((_, i) => i).sort((a, b) => +!!boxes[b]!.keep - +!!boxes[a]!.keep || boxes[b]!.rank - boxes[a]!.rank || a - b);
  const shown: LabelBox[] = [];
  const out = boxes.map(() => false);
  for (const i of order) {
    const b = boxes[i]!;
    const hit = shown.some((s) => Math.abs(s.x - b.x) * 2 < s.w + b.w + GAP * 2 && Math.abs(s.y - b.y) * 2 < s.h + b.h + GAP * 2);
    if (hit && !b.keep) continue;
    shown.push(b);
    out[i] = true;
  }
  return out;
}

/**
 * A room name's box, estimated from its text (the pin's 12.5 px semibold title font, 10 px padding each side, the
 * values line in 11 px below it when there is one).
 */
export function pinSize(text: string, info?: string | null): { w: number; h: number } {
  const w = Math.max(text.length * 7.2, (info?.length ?? 0) * 6.3) + 22;
  return { w, h: info ? 41 : 27 };
}

const ranks = new WeakMap<Room, number>();

/** A room's rank: its floor area; an outdoor area (a lawn, a drive) ranks below every room, an item below both (#341). */
export function roomRank(room: Pick<Room, "points" | "outdoor">): number {
  let r = ranks.get(room as Room);
  if (r === undefined) {
    r = Math.abs(polygonArea(room.points)) + (room.outdoor ? 1e6 : 2e6);
    ranks.set(room as Room, r);
  }
  return r;
}

/** An item's rank: its footprint (m²), below every room and outdoor area (#341). */
export const itemRank = (w: number, d: number): number => w * d;

// The fonts of the plan's texts (styles.ts --fp3d-title-font, --fp3d-font): the canvas measures with them
export const TITLE_FONT = `"Bricolage Grotesque",Figtree,sans-serif`;
export const BODY_FONT = "Figtree,sans-serif";

let widths = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null | undefined;

/**
 * A text's width (px) in a CSS font ("600 13px …"), measured on a canvas once per text and font: no layout is read.
 * Without a canvas (tests) it is estimated from the font size. The fonts arriving later clear what was measured.
 */
export function textWidth(text: string, font: string): number {
  const key = font + "|" + text;
  let w = widths.get(key);
  if (w === undefined) {
    if (ctx === undefined) {
      ctx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
      if (ctx) document.fonts?.addEventListener?.("loadingdone", () => (widths = new Map()));
    }
    if (ctx) {
      ctx.font = font;
      w = ctx.measureText(text).width;
    } else w = text.length * Number(/([\d.]+)px/.exec(font)?.[1] ?? 12) * 0.6;
    widths.set(key, w);
  }
  return w;
}
