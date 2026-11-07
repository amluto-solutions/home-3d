// Touch and mouse gestures of the 2D plan (#41): tap, double tap, hold, drag to move the plan, two fingers to zoom,
// and a vertical drag on a device that takes it (dim a lamp, move a blind). The limits match the 3D view's controls,
// so a gesture does the same in both.

/** What the gestures report; `target` is the pick id under the finger when it went down (null: the plan). */
export interface GestureEvents {
  tap(x: number, y: number, target: string | null): void;
  doubleTap(x: number, y: number, target: string | null): void;
  hold(x: number, y: number, target: string | null): void;
  pan(dx: number, dy: number): void;
  /** Zoom by `k` (above 1: closer) around the point (x, y). */
  zoom(k: number, x: number, y: number): void;
  /** A vertical drag starts on a device: true when it takes it as a swipe. */
  swipeStart?(target: string, x: number, y: number, dy: number): boolean;
  /** The swipe's vertical distance from where it started (pixels, down positive). */
  swipeMove?(target: string, dy: number): void;
  swipeEnd?(target: string): void;
}

/** Press without moving this long: a hold (as in 3D). */
export const HOLD_MS = 500;
/** A press longer than this is no tap. */
const TAP_MS = 400;
/** A second tap within this time is a double tap. */
const DOUBLE_MS = 320;
/** Moving further than this (pixels) makes a press a drag. */
const SLOP = 6;

interface Press {
  x: number;
  y: number;
  t: number;
  target: string | null;
  moved: boolean;
  held: boolean;
  /** The last point a drag moved the plan from. */
  lx: number;
  ly: number;
  swipe: boolean;
}

export class Gestures {
  private readonly events: GestureEvents;
  private readonly clock: () => number;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private press: Press | null = null;
  private pinch: { dist: number; mx: number; my: number } | null = null;
  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  private lastTap = -Infinity;

  constructor(events: GestureEvents, clock: () => number = () => performance.now()) {
    this.events = events;
    this.clock = clock;
  }

  down(id: number, x: number, y: number, target: string | null): void {
    this.pointers.set(id, { x, y });
    clearTimeout(this.holdTimer);
    if (this.pointers.size === 1) {
      const press: Press = { x, y, t: this.clock(), target, moved: false, held: false, lx: x, ly: y, swipe: false };
      this.press = press;
      this.holdTimer = setTimeout(() => {
        if (this.press !== press || press.moved) return;
        press.held = true;
        this.events.hold(x, y, target);
      }, HOLD_MS);
      return;
    }
    // a second finger: no tap, no hold, a pinch
    if (this.press?.swipe && this.press.target) this.events.swipeEnd?.(this.press.target);
    this.press = null;
    this.pinch = this.pinchState();
  }

  move(id: number, x: number, y: number): void {
    const p = this.pointers.get(id);
    if (!p) return;
    p.x = x;
    p.y = y;
    if (this.pointers.size > 1) {
      const now = this.pinchState();
      if (this.pinch && now) {
        if (this.pinch.dist > 0) this.events.zoom(now.dist / this.pinch.dist, now.mx, now.my);
        this.events.pan(now.mx - this.pinch.mx, now.my - this.pinch.my);
      }
      this.pinch = now;
      return;
    }
    const press = this.press;
    if (!press || press.held) return;
    if (press.swipe) {
      this.events.swipeMove?.(press.target!, y - press.y);
      return;
    }
    if (!press.moved) {
      const dx = x - press.x;
      const dy = y - press.y;
      if (Math.hypot(dx, dy) <= SLOP) return;
      press.moved = true;
      clearTimeout(this.holdTimer);
      if (press.target && Math.abs(dy) > Math.abs(dx) && this.events.swipeStart?.(press.target, press.x, press.y, dy)) {
        press.swipe = true;
        this.events.swipeMove?.(press.target, dy);
        return;
      }
    }
    this.events.pan(x - press.lx, y - press.ly);
    press.lx = x;
    press.ly = y;
  }

  /** A finger or the mouse button let go (`cancelled`: the browser took the pointer, no tap). */
  up(id: number, _x: number, _y: number, cancelled = false): void {
    if (!this.pointers.delete(id)) return;
    clearTimeout(this.holdTimer);
    if (this.pointers.size > 0) {
      // one of two fingers lifted: the other one goes on moving the plan
      this.pinch = null;
      const [rest] = this.pointers.values();
      if (this.pointers.size === 1 && rest) this.press = { x: rest.x, y: rest.y, t: 0, target: null, moved: true, held: false, lx: rest.x, ly: rest.y, swipe: false };
      return;
    }
    this.pinch = null;
    const press = this.press;
    this.press = null;
    if (!press) return;
    if (press.swipe) {
      this.events.swipeEnd?.(press.target!);
      return;
    }
    if (cancelled || press.held || press.moved) return;
    const now = this.clock();
    if (now - press.t >= TAP_MS) return;
    if (now - this.lastTap < DOUBLE_MS) {
      this.lastTap = -Infinity;
      this.events.doubleTap(press.x, press.y, press.target);
      return;
    }
    this.lastTap = now;
    this.events.tap(press.x, press.y, press.target);
  }

  /** The mouse wheel zooms around the pointer. */
  wheel(deltaY: number, x: number, y: number): void {
    this.events.zoom(Math.exp(-deltaY * 0.0015), x, y);
  }

  dispose(): void {
    clearTimeout(this.holdTimer);
    this.pointers.clear();
    this.press = null;
  }

  private pinchState(): { dist: number; mx: number; my: number } | null {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return null;
    return { dist: Math.hypot(b.x - a.x, b.y - a.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }
}
