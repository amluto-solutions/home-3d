// Orbit camera with inertia, pinch zoom, two-finger pan, taps and smooth flights.
// The owner calls update() each frame; it returns true while something still moves.

import { PerspectiveCamera, Vector3 } from "three";

export interface OrbitView {
  target: Vector3;
  radius: number;
  /** azimuth around +y, radians */
  theta: number;
  /** polar angle from +y, radians */
  phi: number;
}

export interface ControlEvents {
  change(): void;
  tap(x: number, y: number): void;
  doubleTap(x: number, y: number): void;
  /** Press without moving for HOLD_MS; the following release is no tap. */
  hold(x: number, y: number): void;
  /** Pointer down: return true to take the pointer (drag an object instead of turning the view). */
  grab?(x: number, y: number): boolean;
  /** `free`: Alt is held (move without snapping, #143). */
  drag?(x: number, y: number, free?: boolean): void;
  drop?(): void;
  /**
   * A one-finger drag starts at (x, y) moving by (dx, dy): return true to take it as a swipe on an
   * object (dimming a lamp, moving a blind) instead of turning the view. Moves then report the
   * vertical distance from the start (pixels, down positive).
   */
  swipeStart?(x: number, y: number, dx: number, dy: number): boolean;
  swipeMove?(dy: number): void;
  swipeEnd?(): void;
  /** May the arrow and plus/minus keys steer the view now? (not while furnishing: there the arrows nudge the selection, #195) */
  keys?(): boolean;
  /** A mouse moving over the view with no button pressed, and the mouse leaving it. */
  hover?(x: number, y: number): void;
  leave?(): void;
}

const HOLD_MS = 500;
/** A drag move waits for a frame at most this long; then it goes at once (frames stalled, see Viewer3D.invalidate). */
const DRAG_WAIT_MS = 100;
/**
 * A move or wheel event this old when it is handled waited out a freeze (building the house just after
 * opening, a slow tablet): it is dropped, not replayed – replayed, the view caught up seconds later and landed
 * somewhere else in the house (#712). A second, so a slow wall tablet (a frame of half a second) still turns.
 */
const STALE_MS = 1000;

/** The event waited longer than STALE_MS to be handled (timestamps on the performance clock, as all browsers now). */
export function stale(e: { timeStamp: number }, now: number): boolean {
  const age = now - e.timeStamp;
  return age > STALE_MS && age < 60_000;
}

const MIN_PHI = 0.12;
const MAX_PHI = 1.35;

/** One keyboard step of the view (#195): radians for turning, a factor for zooming, a share of the distance for moving. */
const KEY_TURN = Math.PI / 16;
const KEY_ZOOM = 0.85;
const KEY_MOVE = 0.1;
/** The 3D view's vertical field of view (degrees). */
export const BASE_FOV = 38;

/**
 * The vertical field of view (degrees) for looking through a camera whose horizontal field is `fov` degrees
 * (null: a wall camera 90, a dome 100; a 360 lens counts as unset). Clamped to 50..110 across, 38..85 up and down.
 */
export function lookFov(fov: number | null | undefined, ceiling: boolean, aspect: number): number {
  const across = Math.min(110, Math.max(50, fov && fov < 360 ? fov : ceiling ? 100 : 90)) * (Math.PI / 180);
  return Math.min(85, Math.max(BASE_FOV, (2 * Math.atan(Math.tan(across / 2) / aspect)) / (Math.PI / 180)));
}

/** One press of the on-screen turn buttons (#307): 15 degrees. */
export const NAV_TURN = Math.PI / 12;

/**
 * Where a key takes the view from `from`: arrows turn it (Shift: move it across the ground), plus and minus zoom;
 * null for any other key. Pure, for tests; `radius` stays inside min/max.
 */
export function keyView(key: string, shift: boolean, from: OrbitView, minRadius = 2, maxRadius = 80): Partial<OrbitView> | null {
  const arrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(key);
  if (arrow >= 0) {
    const dx = arrow === 1 ? 1 : arrow === 0 ? -1 : 0;
    const dy = arrow === 3 ? 1 : arrow === 2 ? -1 : 0;
    if (shift) {
      // across the ground: right/left along the view's right, up/down along its forward
      const step = from.radius * KEY_MOVE;
      const target = from.target.clone();
      target.x += (Math.cos(from.theta) * dx + Math.sin(from.theta) * dy) * step;
      target.z += (-Math.sin(from.theta) * dx + Math.cos(from.theta) * dy) * step;
      return { target };
    }
    return { theta: from.theta - dx * KEY_TURN, phi: clamp(from.phi + dy * KEY_TURN * 0.6, MIN_PHI, MAX_PHI) };
  }
  if (key === "+" || key === "=") return { radius: clamp(from.radius * KEY_ZOOM, minRadius, maxRadius) };
  if (key === "-" || key === "_") return { radius: clamp(from.radius / KEY_ZOOM, minRadius, maxRadius) };
  return null;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class OrbitControls {
  view: OrbitView = { target: new Vector3(), radius: 16, theta: -0.6, phi: 0.85 };
  minRadius = 2;
  maxRadius = 80;
  /**
   * A drag with the left mouse button turns the view (default). Off (the editor's wall view): the left button is
   * kept for furniture, the middle and right buttons turn the view instead of panning it; fingers are unchanged.
   */
  leftDragTurns = true;
  /** 3D lock (idea from dlavrantonis' fork): the angle stays put – a drag moves the view, zooming still works. */
  angleLock = false;

  private pointers = new Map<number, { x: number; y: number; button: number; type: string }>();
  private velocity = { theta: 0, phi: 0 };
  private flight: { from: OrbitView; to: OrbitView; start: number; duration: number } | null = null;
  private down: { x: number; y: number; time: number; moved: boolean } | null = null;
  private lastTap = 0;
  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  private held = false;
  /** An object is being dragged: moves go to events.drag instead of the camera. */
  private grabbing = false;
  /** The pointer that started the furniture drag; every other pointer is ignored until it lifts (#174). */
  private grabId: number | null = null;
  /**
   * The newest drag move not yet passed on: pointer moves come faster than frames (a 1000 Hz mouse), so one
   * per frame goes to events.drag. A move waiting longer than DRAG_WAIT_MS goes at once (a page whose frames stall).
   */
  private pendingDrag: [number, number, boolean] | null = null;
  private dragFrame = 0;
  private dragAskedAt = 0;
  /** A swipe on an object: vertical moves go to events.swipeMove. */
  private swiping: { startY: number } | null = null;
  private pinch: { dist: number; mid: [number, number] } | null = null;
  private readonly el: HTMLElement;
  private readonly camera: PerspectiveCamera;
  private readonly events: ControlEvents;
  private readonly listeners: [string, EventListener][] = [];

  constructor(el: HTMLElement, camera: PerspectiveCamera, events: ControlEvents) {
    this.el = el;
    this.camera = camera;
    this.events = events;
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.listeners.push([type, fn as EventListener]);
    };
    on("pointerdown", (e) => this.onDown(e));
    on("pointermove", (e) => {
      if (e.pointerType === "mouse" && !e.buttons && !this.pointers.size && this.events.hover) this.events.hover(...this.local(e));
      this.onMove(e);
    });
    on("pointerleave", (e) => {
      if (e.pointerType === "mouse") this.events.leave?.();
    });
    on("pointerup", (e) => this.onUp(e));
    on("pointercancel", (e) => this.onUp(e));
    // capture taken away (an alert, a window switch) without a pointerup: a furniture drag ends there, never stuck
    on("lostpointercapture", (e) => {
      if (this.grabbing && e.pointerId === this.grabId) this.onUp(e);
    });
    on("wheel", (e) => this.onWheel(e), { passive: false });
    on("contextmenu", (e) => e.preventDefault());
    on("keydown", (e) => this.onKey(e));
  }

  /** A zoom or pan button (#297): the same moves as the keys, plain arrows moving the view across the ground. */
  nudge(act: "in" | "out" | "left" | "right" | "up" | "down" | "turnLeft" | "turnRight"): void {
    if (act === "turnLeft" || act === "turnRight") {
      // round the point the view looks at, from where the last flight is headed so presses add up (#307)
      this.flyTo({ theta: this.goal.theta + (act === "turnLeft" ? NAV_TURN : -NAV_TURN) }, 220);
      return;
    }
    const key = act === "in" ? "+" : act === "out" ? "-" : act === "left" ? "ArrowLeft" : act === "right" ? "ArrowRight" : act === "up" ? "ArrowUp" : "ArrowDown";
    const to = keyView(key, act !== "in" && act !== "out", this.goal, this.minRadius, this.maxRadius);
    if (to) this.flyTo(to, 160);
  }

  /** Arrow keys turn the view, Shift+arrows move it, plus and minus zoom (#195): the canvas takes the focus for it. */
  private onKey(e: KeyboardEvent): void {
    if (e.target !== this.el || e.ctrlKey || e.metaKey || e.altKey || this.grabbing) return;
    if (this.events.keys && !this.events.keys()) return;
    const to = keyView(e.key, e.shiftKey, this.goal, this.minRadius, this.maxRadius);
    if (!to) return;
    e.preventDefault();
    // a flight from where the last one is headed, so a held key keeps on turning
    this.flyTo(to, 160);
  }

  dispose(): void {
    clearTimeout(this.holdTimer);
    this.cancelDragFrame();
    this.pendingDrag = null;
    for (const [type, fn] of this.listeners) this.el.removeEventListener(type, fn);
  }

  /** A finger or the mouse holds the view, or a flight runs (an automatic orbit waits meanwhile). */
  get active(): boolean {
    return this.pointers.size > 0 || this.flight !== null;
  }

  /** Apply the view to the camera. Returns true while inertia or a flight is running. */
  update(now: number): boolean {
    let active = false;
    if (this.flight) {
      const { from, to, start, duration } = this.flight;
      const t = Math.min(1, (now - start) / duration);
      const k = ease(t);
      this.view.target.lerpVectors(from.target, to.target, k);
      this.view.radius = from.radius + (to.radius - from.radius) * k;
      this.view.theta = from.theta + (to.theta - from.theta) * k;
      this.view.phi = from.phi + (to.phi - from.phi) * k;
      if (t >= 1) this.flight = null;
      active = true;
    } else if (this.pointers.size === 0 && (Math.abs(this.velocity.theta) > 1e-4 || Math.abs(this.velocity.phi) > 1e-4)) {
      this.view.theta += this.velocity.theta;
      this.view.phi = clamp(this.view.phi + this.velocity.phi, MIN_PHI, MAX_PHI);
      this.velocity.theta *= 0.9;
      this.velocity.phi *= 0.9;
      active = true;
    }
    const { target, radius, theta, phi } = this.view;
    this.camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta),
    );
    this.camera.lookAt(target);
    return active;
  }

  /** `saved`: a start view saved for the house, a floor or a room – its angle applies even under the 3D lock (#645). */
  flyTo(to: Partial<OrbitView>, duration = 700, saved = false): void {
    const from = { ...this.view, target: this.view.target.clone() };
    // take the short way round
    let theta = to.theta ?? from.theta;
    while (theta - from.theta > Math.PI) theta -= 2 * Math.PI;
    while (theta - from.theta < -Math.PI) theta += 2 * Math.PI;
    // locked: the flight moves and zooms, the angle stays
    const target = this.angleLock && !saved
      ? { target: (to.target ?? from.target).clone(), radius: to.radius ?? from.radius, theta: from.theta, phi: from.phi }
      : { target: (to.target ?? from.target).clone(), radius: to.radius ?? from.radius, theta, phi: to.phi ?? from.phi };
    this.velocity = { theta: 0, phi: 0 };
    if (duration <= 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.view = target;
      this.flight = null;
    } else {
      this.flight = { from, to: target, start: performance.now(), duration };
    }
    this.events.change();
  }

  /** Where the view is headed: the end of a running flight, else where it stands. */
  get goal(): OrbitView {
    const v = this.flight?.to ?? this.view;
    return { ...v, target: v.target.clone() };
  }

  get busy(): boolean {
    return this.flight !== null || this.pointers.size > 0;
  }

  private local(e: PointerEvent): [number, number] {
    const rect = this.el.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  private onDown(e: PointerEvent): void {
    // a second finger must not take over (or end) a furniture drag
    if (this.grabbing) return;
    this.el.setPointerCapture(e.pointerId);
    if (this.pointers.size === 0 && e.button === 0 && this.events.grab && this.events.grab(...this.local(e))) {
      this.grabbing = true;
      this.grabId = e.pointerId;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, type: e.pointerType });
      this.flight = null;
      this.velocity = { theta: 0, phi: 0 };
      return;
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, type: e.pointerType });
    this.flight = null;
    this.velocity = { theta: 0, phi: 0 };
    clearTimeout(this.holdTimer);
    this.held = false;
    if (this.pointers.size === 1) {
      this.down = { x: e.clientX, y: e.clientY, time: performance.now(), moved: false };
      const rect = this.el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.holdTimer = setTimeout(() => {
        if (!this.down || this.down.moved || this.pointers.size !== 1) return;
        this.held = true;
        this.events.hold(x, y);
      }, HOLD_MS);
    } else {
      this.down = null;
      this.pinch = this.pinchState();
    }
  }

  private onMove(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    if (this.grabbing) {
      if (e.pointerId !== this.grabId) return;
      if (this.events.drag) this.queueDrag(...this.local(e), e.altKey);
      return;
    }
    if (stale(e, performance.now()) && !this.swiping) {
      // only the position is taken: the next fresh move continues from here
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pointers.size > 1) this.pinch = this.pinchState();
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (this.swiping) {
      this.events.swipeMove?.(e.clientY - this.swiping.startY);
      return;
    }
    if (this.down && !this.down.moved && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) {
      this.down.moved = true;
      clearTimeout(this.holdTimer);
      const rect = this.el.getBoundingClientRect();
      if (
        this.pointers.size === 1 &&
        p.button === 0 &&
        !e.shiftKey &&
        this.events.swipeStart?.(this.down.x - rect.left, this.down.y - rect.top, e.clientX - this.down.x, e.clientY - this.down.y)
      ) {
        this.swiping = { startY: this.down.y };
        this.velocity = { theta: 0, phi: 0 };
        this.events.swipeMove?.(e.clientY - this.down.y);
        return;
      }
    }
    if (this.pointers.size === 1) {
      if (this.down && !this.down.moved) {
        p.x = e.clientX;
        p.y = e.clientY;
        return;
      }
      const mouse = p.type === "mouse";
      if (mouse && !this.leftDragTurns && p.button === 0) {
        p.x = e.clientX;
        p.y = e.clientY;
        return;
      }
      const pan = this.angleLock || ((p.button === 1 || p.button === 2 || e.shiftKey) && (this.leftDragTurns || !mouse));
      if (pan) this.pan(dx, dy);
      else {
        const h = this.el.clientHeight || 1;
        const dTheta = (-dx / h) * 3.2;
        const dPhi = (-dy / h) * 2.4;
        this.view.theta += dTheta;
        this.view.phi = clamp(this.view.phi + dPhi, MIN_PHI, MAX_PHI);
        this.velocity = { theta: dTheta, phi: dPhi };
      }
      p.x = e.clientX;
      p.y = e.clientY;
    } else {
      p.x = e.clientX;
      p.y = e.clientY;
      const now = this.pinchState();
      if (this.pinch && now) {
        this.zoom(this.pinch.dist / Math.max(1, now.dist));
        this.pan(now.mid[0] - this.pinch.mid[0], now.mid[1] - this.pinch.mid[1]);
      }
      this.pinch = now;
    }
    this.events.change();
  }

  /** A drag move, passed on with the next frame (only the newest of the moves before it). */
  private queueDrag(x: number, y: number, free: boolean): void {
    this.pendingDrag = [x, y, free];
    const raf = globalThis.requestAnimationFrame;
    // no frames to wait for (tests, a worker), or frames stalled: at once
    if (!raf || (this.dragFrame && performance.now() - this.dragAskedAt > DRAG_WAIT_MS)) return this.flushDrag();
    if (this.dragFrame) return;
    this.dragAskedAt = performance.now();
    this.dragFrame = raf(() => {
      this.dragFrame = 0;
      this.flushDrag();
    });
  }

  private flushDrag(): void {
    this.cancelDragFrame();
    const p = this.pendingDrag;
    this.pendingDrag = null;
    if (p && this.grabbing && this.events.drag) this.events.drag(...p);
  }

  private cancelDragFrame(): void {
    if (this.dragFrame) globalThis.cancelAnimationFrame?.(this.dragFrame);
    this.dragFrame = 0;
  }

  private onUp(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    if (this.grabbing) {
      if (e.pointerId !== this.grabId) return;
      // the last move counts: it goes before the drop
      this.flushDrag();
      this.grabbing = false;
      this.grabId = null;
      this.pointers.delete(e.pointerId);
      this.events.drop?.();
      return;
    }
    const released = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.swiping) {
      this.swiping = null;
      this.down = null;
      this.events.swipeEnd?.();
      return;
    }
    if (this.pointers.size < 2) this.pinch = null;
    clearTimeout(this.holdTimer);
    if (this.held) {
      this.held = false;
      this.down = null;
    } else if (this.down && !this.down.moved && e.type === "pointerup" && performance.now() - this.down.time < 400) {
      const rect = this.el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const now = performance.now();
      if (released?.button === 2 && released.type === "mouse") {
        // a right click that did not drag acts like a long press (#272): a light's card, a device's details
        this.lastTap = 0;
        this.events.hold(x, y);
      } else if (now - this.lastTap < 320) {
        this.lastTap = 0;
        this.events.doubleTap(x, y);
      } else {
        this.lastTap = now;
        this.events.tap(x, y);
      }
    }
    if (this.pointers.size === 0) this.down = null;
    this.events.change();
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (stale(e, performance.now())) return;
    this.flight = null;
    this.zoom(Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
    this.events.change();
  }

  private zoom(factor: number): void {
    this.view.radius = clamp(this.view.radius * factor, this.minRadius, this.maxRadius);
  }

  private pan(dx: number, dy: number): void {
    const h = this.el.clientHeight || 1;
    const perPixel = (2 * this.view.radius * Math.tan((this.camera.fov * Math.PI) / 360)) / h;
    const right = new Vector3(Math.cos(this.view.theta), 0, -Math.sin(this.view.theta));
    const forward = new Vector3(-Math.sin(this.view.theta), 0, -Math.cos(this.view.theta));
    this.view.target.addScaledVector(right, -dx * perPixel);
    this.view.target.addScaledVector(forward, (dy * perPixel) / Math.max(0.35, Math.cos(this.view.phi)));
  }

  private pinchState(): { dist: number; mid: [number, number] } | null {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: [(a.x + b.x) / 2, (a.y + b.y) / 2] };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
