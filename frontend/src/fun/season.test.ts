import assert from "node:assert/strict";
import { test } from "node:test";
import type { Season } from "../seasons.ts";

// a tiny DOM: just what the overlay touches
class El {
  style: Record<string, string> = { cssText: "" };
  children: El[] = [];
  textContent = "";
  removed = false;
  clientWidth = 400;
  clientHeight = 300;
  width = 0;
  height = 0;
  attrs: Record<string, string> = {};
  append(...c: El[]) {
    this.children.push(...c);
  }
  setAttribute(k: string, v: string) {
    this.attrs[k] = v;
  }
  remove() {
    this.removed = true;
  }
  getContext() {
    return new Proxy({}, { get: (_t, k) => (k === "measureText" ? () => ({ width: 1 }) : () => undefined), set: () => true });
  }
}

const christmas: Season = { id: "christmas", effect: "snow", tint: "rgba(200, 16, 46, 0.33)", key: "season_christmas", vars: {} };

test("the holiday overlay shows the greeting, then goes when the day ends and when disposed (#239)", async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.document = { createElement: () => new El(), hidden: false };
  g.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: true }) };
  g.requestAnimationFrame = () => 1;
  g.cancelAnimationFrame = () => undefined;
  const { startSeason } = await import("./season.ts");
  const host = new El();
  let today: Season | null = christmas;
  const c = startSeason({ host: host as never, now: () => today, text: (k, v) => `${k}:${JSON.stringify(v)}`, low: () => false });
  const root = host.children[0];
  const [glow, , pill] = root.children;
  assert.equal(pill.textContent, 'season_christmas:{}');
  assert.equal(pill.style.opacity, "1");
  assert.equal(glow.style.opacity, "0.6");
  assert.equal(root.attrs["aria-hidden"], "true");
  assert.match(root.style.cssText, /pointer-events:none/);
  today = null;
  c.refresh();
  assert.equal(glow.style.opacity, "0");
  assert.equal(pill.style.opacity, "0");
  c.dispose();
  assert.equal(root.removed, true);
});

test("every effect draws frames without failing, and stops its loop when disposed (#239)", async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  let frame: ((t: number) => void) | null = null;
  g.document = { createElement: () => new El(), hidden: false };
  g.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: false }) };
  g.requestAnimationFrame = (f: (t: number) => void) => {
    frame = f;
    return 1;
  };
  g.cancelAnimationFrame = () => {
    frame = null;
  };
  const { startSeason } = await import("./season.ts");
  for (const effect of ["fireworks", "sparkles", "confetti", "snow", "snow_light", "snow_sleigh", "poppies", "hearts", "pancakes", "flowers", "easter", "stars"] as const) {
    const c = startSeason({ host: new El() as never, now: () => ({ ...christmas, effect }), text: () => "x", low: () => false });
    assert.ok(frame, `${effect} starts its loop`);
    for (let t = 0; t < 60000; t += 100) (frame as unknown as (t: number) => void)?.(t) ?? undefined;
    c.dispose();
    assert.equal(frame, null, `${effect} stops`);
  }
});

test("the effect plays briefly by default, then fades out and the loop stops; the setting changes how long (#385)", async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  let frame: ((t: number) => void) | null = null;
  let clock = 1000;
  const realNow = performance.now.bind(performance);
  performance.now = () => clock;
  try {
    g.document = { createElement: () => new El(), hidden: false };
    g.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: false }) };
    g.requestAnimationFrame = (f: (t: number) => void) => {
      frame = f;
      return 1;
    };
    g.cancelAnimationFrame = () => {
      frame = null;
    };
    const { startSeason } = await import("./season.ts");
    let mode: "none" | "brief" | "long" | "always" | undefined;
    const host = new El();
    const c = startSeason({ host: host as never, now: () => christmas, text: () => "x", low: () => false, effect: () => mode });
    const [glow, canvas, pill] = host.children[0].children;
    assert.equal(glow.style.opacity, "0.6");
    assert.equal(canvas.style.opacity, "1");
    const step = () => {
      const f = frame;
      frame = null;
      f?.(clock);
    };
    clock += 14000;
    step();
    assert.ok(frame, "still playing at 14 s");
    clock += 2000;
    step();
    assert.equal(frame, null, "stopped after 15 s");
    assert.equal(glow.style.opacity, "0");
    assert.equal(canvas.style.opacity, "0");
    assert.equal(pill.textContent, "x", "the greeting stays");
    // the poll every half minute does not start it again
    c.refresh();
    assert.equal(frame, null);
    // the house picks "always": it plays again and keeps going
    mode = "always";
    c.refresh();
    assert.ok(frame);
    clock += 3_600_000;
    step();
    assert.ok(frame, "always keeps going");
    // "none": nothing moves and there is no glow
    mode = "none";
    c.refresh();
    step();
    assert.equal(frame, null);
    assert.equal(glow.style.opacity, "0");
    c.dispose();
  } finally {
    performance.now = realNow;
  }
});
