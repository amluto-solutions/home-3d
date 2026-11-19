// "Fly in from space" (#477, an option, off by default): when the view opens, a neon globe turns to the home's place,
// a beam marks it, the view dives in and the 3D camera comes down from high above onto the house. A tap skips it.
// Ported from NeonPlan 3D 3.5.0/3.5.1 (MIT, Mastershort). Drawn in code on a 2D canvas over the stage: no picture,
// font or data download, no outside host. Nothing of it stays once it is done.

export { flyInAllowed } from "./fly-in-gate.ts";

const DEG = Math.PI / 180;

/** Orthographic globe: a point (lat, lon) as seen with the globe turned to (lat0, lon0); null on the far side. */
export function globePoint(lat: number, lon: number, lat0: number, lon0: number): [number, number] | null {
  const p = lat * DEG;
  const l = (lon - lon0) * DEG;
  const p0 = lat0 * DEG;
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  if (cosc < 0) return null;
  return [Math.cos(p) * Math.sin(l), Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)];
}

export const ease = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Timeline (ms): the globe turns, then dives in; the 3D flight starts while it dives, the canvas fades out. */
export const FLYIN = { turn: 1500, dive: 1300, fade: 600 };

/** What shows at a moment of the timeline. */
export interface FlyInFrame {
  /** How far the globe has turned (0..1). */
  k: number;
  /** How far the dive has gone (0..1). */
  d: number;
  /** Fade of the whole canvas at the end (0 = opaque, 1 = gone). */
  out: number;
  /** The 3D camera starts to come down. */
  dive: boolean;
  /** The sequence is over. */
  done: boolean;
}

export function flyInFrame(ms: number): FlyInFrame {
  const { turn, dive, fade } = FLYIN;
  return {
    k: ease(ms / turn),
    d: ms < turn ? 0 : ease((ms - turn) / dive),
    out: ms < turn + dive ? 0 : Math.min(1, (ms - turn - dive) / fade),
    dive: ms > turn + dive * 0.55,
    done: ms > turn + dive + fade,
  };
}

export interface FlyInEvents {
  /** The camera should come down now (`fast` after a tap that skipped the globe). */
  dive(fast: boolean): void;
  /** The canvas is gone. */
  done(skipped: boolean): void;
}

export class FlyInLayer {
  readonly canvas: HTMLCanvasElement;
  private raf = 0;
  private t0 = 0;
  private dove = false;
  private ended = false;

  private readonly lat: number;
  private readonly lon: number;
  private readonly events: FlyInEvents;

  constructor(host: HTMLElement, lat: number, lon: number, events: FlyInEvents) {
    this.lat = lat;
    this.lon = lon;
    this.events = events;
    const c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    c.className = "fp3d-flyin";
    // over the whole stage (above the controls), a tap anywhere skips it
    c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;z-index:30;cursor:pointer;touch-action:none";
    c.addEventListener("pointerdown", this.skip);
    host.append(c);
    this.canvas = c;
    this.t0 = performance.now();
    const loop = () => {
      if (this.ended) return;
      this.draw(performance.now() - this.t0);
      if (!this.ended) this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  get active(): boolean {
    return !this.ended;
  }

  /** Stop at once without events (the viewer goes away). */
  dispose(): void {
    this.ended = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.skip);
    this.canvas.remove();
  }

  private skip = (e?: Event): void => {
    e?.stopPropagation();
    this.finish(true);
  };

  private finish(skipped: boolean): void {
    if (this.ended) return;
    this.ended = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.skip);
    this.canvas.remove();
    // a skip before the dive: the 3D flight still happens, quickly
    if (!this.dove) this.events.dive(true);
    this.events.done(skipped);
  }

  private draw(ms: number): void {
    const canvas = this.canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // one pixel per CSS pixel: the globe is soft anyway, and a full high-resolution canvas each frame made it stutter
    const w = Math.round(canvas.clientWidth);
    const h = Math.round(canvas.clientHeight);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const f = flyInFrame(ms);
    if (f.dive && !this.dove) {
      this.dove = true;
      this.events.dive(false);
    }
    if (f.done) return this.finish(false);
    const { k, d, out } = f;
    ctx.clearRect(0, 0, w, h);
    // deep space behind, fading out at the end so the house shows through
    ctx.globalAlpha = 1 - out;
    ctx.fillStyle = "#02040a";
    ctx.fillRect(0, 0, w, h);
    // the globe turns from a quarter round to the home's place
    const lon0 = this.lon - 100 * (1 - k);
    const lat0 = this.lat * k;
    // then it grows towards the place
    const base = Math.min(w, h) * 0.32;
    const r = base * Math.pow(14, d);
    const home = globePoint(this.lat, this.lon, lat0, lon0);
    // keep the home under the middle while diving in
    const cx = w / 2 - (home ? home[0] * r * d : 0);
    const cy = h / 2 + (home ? home[1] * r * d : 0);
    // the planet: a dark disc with a cyan rim (the glow only where it is, not over the whole picture)
    if (r < Math.max(w, h)) {
      const glow = ctx.createRadialGradient(cx, cy, r * 0.95, cx, cy, r * 1.25);
      glow.addColorStop(0, "rgba(62,232,255,0.35)");
      glow.addColorStop(1, "rgba(62,232,255,0)");
      ctx.fillStyle = glow;
      const g = r * 1.25;
      const x0 = Math.max(0, cx - g);
      const y0 = Math.max(0, cy - g);
      ctx.fillRect(x0, y0, Math.min(w, cx + g) - x0, Math.min(h, cy + g) - y0);
    }
    ctx.fillStyle = "#06101f";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // the grid of latitudes and longitudes: it fades while diving in and, once faint, is left out
    ctx.strokeStyle = `rgba(62,232,255,${0.5 * (1 - d * 0.7)})`;
    ctx.lineWidth = 1;
    const line = (pts: [number, number][]) => {
      let on = false;
      ctx.beginPath();
      for (const [la, lo] of pts) {
        const p = globePoint(la, lo, lat0, lon0);
        if (!p) {
          on = false;
          continue;
        }
        const x = cx + p[0] * r;
        const y = cy - p[1] * r;
        if (on) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        on = true;
      }
      ctx.stroke();
    };
    if (d < 0.8) {
      for (let la = -75; la <= 75; la += 15) line(Array.from({ length: 73 }, (_, i) => [la, i * 5 - 180] as [number, number]));
      for (let lo = -180; lo < 180; lo += 15) line(Array.from({ length: 37 }, (_, i) => [i * 5 - 90, lo] as [number, number]));
    }
    // the home: a pulsing point and a beam up into space
    if (home) {
      const x = cx + home[0] * r;
      const y = cy - home[1] * r;
      const pulse = 0.5 + 0.5 * Math.sin(ms / 140);
      const beam = ctx.createLinearGradient(x, y, x, y - h * 0.35);
      beam.addColorStop(0, `rgba(255,95,210,${0.8 * k})`);
      beam.addColorStop(1, "rgba(255,95,210,0)");
      ctx.fillStyle = beam;
      ctx.fillRect(x - 2, y - h * 0.35, 4, h * 0.35);
      ctx.fillStyle = `rgba(255,95,210,${0.9 * k})`;
      ctx.beginPath();
      ctx.arc(x, y, 4 + 3 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,95,210,${0.6 * k * (1 - pulse)})`;
      ctx.beginPath();
      ctx.arc(x, y, 8 + 16 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
