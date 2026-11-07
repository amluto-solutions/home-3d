// Floating panels that can be moved and resized (#265, #267): the position or size is kept per device, always inside
// the stage, and put back by a double click. Pure helpers (clamping, parsing) plus one small controller each, so the
// View panel and the room panel share them. Storage failures (private mode) just mean the choice is not remembered.

export interface Offset {
  x: number;
  y: number;
}
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const KEY = (name: string) => `home3d.float.${name}`;

function read(name: string): string | null {
  try {
    return localStorage.getItem(KEY(name));
  } catch {
    return null;
  }
}
function write(name: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(KEY(name));
    else localStorage.setItem(KEY(name), value);
  } catch {
    // not remembered
  }
}

/** Two finite numbers from a stored `{"a":..,"b":..}` pair, or null. */
function pair(s: string | null, a: string, b: string): [number, number] | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s) as Record<string, unknown>;
    const x = v[a];
    const y = v[b];
    return typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
  } catch {
    return null;
  }
}

export const parseOffset = (s: string | null): Offset | null => {
  const p = pair(s, "x", "y");
  return p ? { x: p[0], y: p[1] } : null;
};
export const parseSize = (s: string | null): { w: number; h: number } | null => {
  const p = pair(s, "w", "h");
  return p && p[0] > 0 && p[1] > 0 ? { w: p[0], h: p[1] } : null;
};

/**
 * The offset that keeps a panel inside `bounds`. `box` is where the panel is now with offset `cur`; a panel larger
 * than the bounds is pinned to their top left edge.
 */
export function clampOffset(want: Offset, cur: Offset, box: Box, bounds: Box, margin = 8): Offset {
  const clamp = (v: number, lo: number, hi: number) => (hi < lo ? lo : Math.min(hi, Math.max(lo, v)));
  const w = box.right - box.left;
  const h = box.bottom - box.top;
  // where the panel would stand with no offset at all
  const x0 = box.left - cur.x;
  const y0 = box.top - cur.y;
  return {
    x: Math.round(clamp(want.x, bounds.left + margin - x0, bounds.right - margin - w - x0)),
    y: Math.round(clamp(want.y, bounds.top + margin - y0, bounds.bottom - margin - h - y0)),
  };
}

/** A size kept between a minimum and what the stage allows (the minimum wins when the stage is smaller). */
export function clampSize(want: { w: number; h: number }, min: { w: number; h: number }, max: { w: number; h: number }): { w: number; h: number } {
  const c = (v: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(v, hi)));
  return { w: c(want.w, min.w, max.w), h: c(want.h, min.h, max.h) };
}

const boundsOf = (host: HTMLElement): Box => {
  const p = host.offsetParent;
  const r = p ? p.getBoundingClientRect() : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

/** Moves a panel by its header: `translate` on the host on top of where its stylesheet puts it. */
export class FloatDrag {
  offset: Offset | null = null;
  private start: { px: number; py: number; from: Offset } | null = null;

  private readonly host: HTMLElement;
  private readonly name: string;
  private readonly changed: () => void;

  constructor(host: HTMLElement, name: string, changed: () => void) {
    this.host = host;
    this.name = name;
    this.changed = changed;
  }

  /** Reads this device's saved offset and puts the panel there (kept inside the stage). */
  load(): void {
    this.offset = parseOffset(read(this.name));
    this.apply();
    this.settle();
  }

  private apply(): void {
    this.host.style.translate = this.offset ? `${this.offset.x}px ${this.offset.y}px` : "";
  }

  /** Back inside the stage after a load or a resize of the window. */
  settle(): void {
    if (!this.offset) return;
    const next = clampOffset(this.offset, this.offset, this.host.getBoundingClientRect(), boundsOf(this.host));
    if (next.x !== this.offset.x || next.y !== this.offset.y) {
      this.offset = next;
      this.apply();
    }
  }

  /** The header's pointerdown: buttons and fields in it keep their own clicks. */
  begin(e: PointerEvent): void {
    if (e.button !== 0 || (e.target as HTMLElement).closest?.("button, input, select, a")) return;
    this.start = { px: e.clientX, py: e.clientY, from: this.offset ?? { x: 0, y: 0 } };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  move(e: PointerEvent): void {
    const s = this.start;
    if (!s) return;
    const cur = this.offset ?? { x: 0, y: 0 };
    this.offset = clampOffset({ x: s.from.x + e.clientX - s.px, y: s.from.y + e.clientY - s.py }, cur, this.host.getBoundingClientRect(), boundsOf(this.host));
    this.apply();
    this.changed();
  }

  end(): void {
    if (!this.start) return;
    this.start = null;
    write(this.name, this.offset ? JSON.stringify(this.offset) : null);
  }

  /** Snaps the panel back to where it docks. */
  reset(): void {
    this.start = null;
    this.offset = null;
    write(this.name, null);
    this.apply();
    this.changed();
  }
}

/**
 * The panel is a bottom sheet (phones, portrait tablets): its stylesheet sets `--fp3d-sheet: 1` on the host in the
 * sheet layout. (`top` cannot tell: a computed `top` of an absolutely placed element is its used value in pixels.)
 */
export const isSheet = (host: HTMLElement): boolean => getComputedStyle(host).getPropertyValue("--fp3d-sheet").trim() === "1";

/** The room panel's own size (#267): remembered per device; null means the stylesheet's size. */
export const savedSize = (name: string) => parseSize(read(name));
export const saveSize = (name: string, size: { w: number; h: number } | null) => write(name, size ? JSON.stringify(size) : null);

export type Edge = "w" | "s" | "sw";

/**
 * Resizes a panel that is anchored at its top right corner by dragging its left edge, its bottom edge or the corner
 * between them (#267). The size is set inline on the host, kept inside the stage and per device, and given up (the
 * stylesheet's own size) when the panel is a bottom sheet (isSheet).
 */
export class FloatResize {
  size: { w: number; h: number } | null = null;
  private drag: { edge: Edge; px: number; py: number; w: number; h: number } | null = null;
  static readonly MIN = { w: 280, h: 240 };

  private readonly host: HTMLElement;
  private readonly name: string;

  constructor(host: HTMLElement, name: string) {
    this.host = host;
    this.name = name;
  }

  /** A sheet (phones, portrait tablets): the stylesheet decides, the saved size waits. */
  get sheet(): boolean {
    return isSheet(this.host);
  }

  load(): void {
    this.size = savedSize(this.name);
    this.apply();
  }

  /** The most the stage allows: its width less the gutters, its height below the panel's top. */
  private max(): { w: number; h: number } {
    const p = this.host.offsetParent;
    const w = p ? p.clientWidth : window.innerWidth;
    const h = p ? p.clientHeight : window.innerHeight;
    return { w: w - 28, h: h - this.host.offsetTop - 14 };
  }

  apply(): void {
    const s = this.host.style;
    if (!this.size || this.sheet) {
      s.width = s.height = s.bottom = "";
      this.host.removeAttribute("sized");
      return;
    }
    this.size = clampSize(this.size, FloatResize.MIN, this.max());
    s.width = `${this.size.w}px`;
    s.height = `${this.size.h}px`;
    s.bottom = "auto";
    this.host.setAttribute("sized", "");
  }

  begin(e: PointerEvent, edge: Edge): void {
    if (e.button !== 0 || this.sheet) return;
    const r = this.host.getBoundingClientRect();
    this.drag = { edge, px: e.clientX, py: e.clientY, w: r.width, h: r.height };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  move(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    this.size = { w: d.edge === "s" ? d.w : d.w + (d.px - e.clientX), h: d.edge === "w" ? d.h : d.h + (e.clientY - d.py) };
    this.apply();
  }

  end(): void {
    if (!this.drag) return;
    this.drag = null;
    saveSize(this.name, this.size);
  }

  /** The arrow keys on a focused edge: 16 px a press (left grows the panel, down grows it). */
  key(e: KeyboardEvent, edge: Edge): void {
    const step = { ArrowLeft: [16, 0], ArrowRight: [-16, 0], ArrowDown: [0, 16], ArrowUp: [0, -16] }[e.key];
    if (!step || this.sheet) return;
    e.preventDefault();
    const r = this.host.getBoundingClientRect();
    const cur = this.size ?? { w: r.width, h: r.height };
    this.size = { w: edge === "s" ? cur.w : cur.w + step[0], h: edge === "w" ? cur.h : cur.h + step[1] };
    this.apply();
    saveSize(this.name, this.size);
  }

  reset(): void {
    this.drag = null;
    this.size = null;
    saveSize(this.name, null);
    this.apply();
  }
}

/** A sheet height (a share of the stage) between 20 % and 90 %, or null when it is not a usable number. */
export function clampSheet(frac: number): number {
  return Math.round(Math.min(SheetResize.MAX, Math.max(SheetResize.MIN, frac)) * 1000) / 1000;
}
export const parseSheet = (s: string | null): number | null => {
  const n = s === null ? NaN : Number(s);
  return Number.isFinite(n) && n > 0 ? clampSheet(n) : null;
};

/**
 * The bottom sheet's height on phones and portrait tablets (#353): dragged by its grab bar (or the empty part of its
 * header), as a share of the stage, kept per device. It is set as `--fp3d-sheet-h` on the element holding both the
 * sheet and the view, so the view's own buttons step up with it; a double tap puts the stylesheet's height back.
 */
export class SheetResize {
  static readonly MIN = 0.2;
  static readonly MAX = 0.9;
  frac: number | null = null;
  private drag: { py: number; h: number; stage: number } | null = null;

  private readonly host: HTMLElement;
  private readonly name: string;

  constructor(host: HTMLElement, name: string) {
    this.host = host;
    this.name = name;
  }

  /** Only a sheet is dragged by its grab bar; elsewhere the panel keeps its own size. */
  get sheet(): boolean {
    return isSheet(this.host);
  }

  load(): void {
    this.frac = parseSheet(read(this.name));
    this.apply();
  }

  apply(): void {
    const at = this.host.parentElement;
    if (!at) return;
    if (this.frac === null) at.style.removeProperty("--fp3d-sheet-h");
    else at.style.setProperty("--fp3d-sheet-h", `${Math.round(this.frac * 1000) / 10}%`);
  }

  /** Pointer down on the grab bar or the header: buttons and fields keep their own clicks. */
  begin(e: PointerEvent): void {
    if (e.button !== 0 || !this.sheet || (e.target as HTMLElement).closest?.("button, input, select, a")) return;
    const stage = this.host.parentElement?.clientHeight ?? window.innerHeight;
    if (!stage) return;
    this.drag = { py: e.clientY, h: this.host.getBoundingClientRect().height, stage };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  move(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    this.frac = clampSheet((d.h + d.py - e.clientY) / d.stage);
    this.apply();
  }

  end(): void {
    if (!this.drag) return;
    this.drag = null;
    write(this.name, this.frac === null ? null : String(this.frac));
  }

  /** Arrow up makes the sheet taller, arrow down shorter: 5 % of the stage a press. */
  key(e: KeyboardEvent): void {
    const step = { ArrowUp: 0.05, ArrowDown: -0.05 }[e.key];
    if (!step || !this.sheet) return;
    e.preventDefault();
    const stage = this.host.parentElement?.clientHeight || window.innerHeight;
    const cur = this.frac ?? this.host.getBoundingClientRect().height / stage;
    this.frac = clampSheet(cur + step);
    this.apply();
    write(this.name, String(this.frac));
  }

  reset(): void {
    this.drag = null;
    this.frac = null;
    write(this.name, null);
    this.apply();
  }
}
