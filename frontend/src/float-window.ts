// The camera wall as a free window (#314): moved by its header, resized by its edges and corners, kept inside the view
// and remembered on this device; a double click on the header puts it back where the stylesheet docks it. Loaded when
// the wall first opens (its own chunk). Reuses the storage-safe approach of float-panel.ts; the geometry differs because
// the wall is placed by left/top/width/height rather than anchored at a corner.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Which edges a gesture moves: "move" drags the window, the rest resize (n, s, e, w and the corners). */
export type Grip = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export const GRIPS: readonly Grip[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export const WALL_RECT_KEY = "home3d.camera_wall_rect";
/** The retired four-edge dock choice (#266): ignored, and removed when found. */
export const OLD_WALL_DOCK_KEY = "home3d.camera_wall_dock";
export const WALL_MIN = { w: 260, h: 200 } as const;
const MARGIN = 8;

/** A stored rectangle, or null when it is missing, malformed or has no size. */
export function parseRect(s: string | null): Rect | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s) as Record<string, unknown>;
    const r = [v.x, v.y, v.w, v.h];
    if (!r.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    const [x, y, w, h] = r as number[];
    return w > 0 && h > 0 ? { x, y, w, h } : null;
  } catch {
    return null;
  }
}

/** The rectangle kept inside a stage: at least the minimum size (which wins on a tiny stage), at most the stage less the margins. */
export function clampRect(r: Rect, stage: { w: number; h: number }, min: { w: number; h: number } = WALL_MIN, margin = MARGIN): Rect {
  const w = Math.round(Math.max(min.w, Math.min(r.w, stage.w - 2 * margin)));
  const h = Math.round(Math.max(min.h, Math.min(r.h, stage.h - 2 * margin)));
  const at = (v: number, size: number, room: number) => Math.round(Math.max(margin, Math.min(v, room - margin - size)));
  return { x: at(r.x, w, stage.w), y: at(r.y, h, stage.h), w, h };
}

/** The rectangle after a pointer moved (dx, dy) from where the gesture began; resizing from the left or top keeps the far edge still. */
export function dragRect(start: Rect, grip: Grip, dx: number, dy: number, min: { w: number; h: number } = WALL_MIN): Rect {
  if (grip === "move") return { ...start, x: start.x + dx, y: start.y + dy };
  let { x, y, w, h } = start;
  if (grip.includes("e")) w = Math.max(min.w, start.w + dx);
  if (grip.includes("s")) h = Math.max(min.h, start.h + dy);
  if (grip.includes("w")) {
    w = Math.max(min.w, start.w - dx);
    x = start.x + start.w - w;
  }
  if (grip.includes("n")) {
    h = Math.max(min.h, start.h - dy);
    y = start.y + start.h - h;
  }
  return { x, y, w, h };
}

/** The slice of an element the window needs, so tests can stand in for it. */
export interface WindowHost {
  style: Pick<CSSStyleDeclaration, "left" | "top" | "right" | "bottom" | "width" | "height">;
  offsetLeft: number;
  offsetTop: number;
  offsetWidth: number;
  offsetHeight: number;
  offsetParent: { clientWidth: number; clientHeight: number } | null;
  toggleAttribute(name: string, force?: boolean): boolean;
}

const store = {
  get: (): string | null => {
    try {
      return localStorage.getItem(WALL_RECT_KEY);
    } catch {
      return null;
    }
  },
  set: (v: string | null): void => {
    try {
      if (v === null) localStorage.removeItem(WALL_RECT_KEY);
      else localStorage.setItem(WALL_RECT_KEY, v);
    } catch {
      // not remembered
    }
  },
};

export class WallWindow {
  rect: Rect | null = null;
  private el: WindowHost | null = null;
  private gesture: { grip: Grip; px: number; py: number; from: Rect } | null = null;
  private readonly sheet: () => boolean;
  private readonly onResize = () => this.settle();

  /** `sheet` says whether the wall is a bottom sheet (phones): then it keeps the stylesheet's place and size. */
  constructor(sheet: () => boolean = () => false) {
    this.sheet = sheet;
  }

  /** Called after each render with the wall element (or null once it is gone); a new element gets this device's saved place. */
  attach(el: WindowHost | null): void {
    if (el === this.el) return;
    this.gesture = null;
    this.el = el;
    if (typeof window !== "undefined") {
      window.removeEventListener?.("resize", this.onResize);
      if (el) window.addEventListener?.("resize", this.onResize);
    }
    if (!el) return;
    try {
      localStorage.removeItem(OLD_WALL_DOCK_KEY);
    } catch {
      // nothing to forget
    }
    this.rect = parseRect(store.get());
    this.apply();
  }

  private stage(): { w: number; h: number } {
    const p = this.el?.offsetParent;
    return { w: p ? p.clientWidth : 0, h: p ? p.clientHeight : 0 };
  }

  /** Puts the stored rectangle on the element (kept inside the view); on a sheet, or with none stored, the stylesheet's dock decides. */
  apply(): void {
    const el = this.el;
    if (!el) return;
    const s = el.style;
    if (!this.rect || this.sheet() || this.stage().w === 0) {
      s.left = s.top = s.right = s.bottom = s.width = s.height = "";
      el.toggleAttribute("data-free", false);
      return;
    }
    this.rect = clampRect(this.rect, this.stage());
    s.left = `${this.rect.x}px`;
    s.top = `${this.rect.y}px`;
    s.width = `${this.rect.w}px`;
    s.height = `${this.rect.h}px`;
    s.right = s.bottom = "auto";
    el.toggleAttribute("data-free", true);
  }

  /** Back inside the view after the window of the browser changed size. */
  settle(): void {
    if (this.rect) this.apply();
  }

  /** A pointerdown on the header (move) or on an edge (resize); buttons in the header keep their clicks. */
  begin(e: PointerEvent, grip: Grip): void {
    const el = this.el;
    if (!el || e.button !== 0 || this.sheet()) return;
    if (grip === "move" && (e.target as HTMLElement).closest?.("button, input, select, a")) return;
    this.gesture = { grip, px: e.clientX, py: e.clientY, from: { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  move(e: PointerEvent): void {
    const g = this.gesture;
    if (!g) return;
    this.rect = clampRect(dragRect(g.from, g.grip, e.clientX - g.px, e.clientY - g.py), this.stage());
    this.apply();
  }

  end(): void {
    if (!this.gesture) return;
    this.gesture = null;
    store.set(this.rect ? JSON.stringify(this.rect) : null);
  }

  /** The default place again, and nothing remembered. */
  reset(): void {
    this.gesture = null;
    this.rect = null;
    store.set(null);
    this.apply();
  }

  dispose(): void {
    this.attach(null);
  }
}
