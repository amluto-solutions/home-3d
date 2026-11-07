// Fun pack "Seasonal themes" (#239): on a UK holiday the view gets a soft colour glow, a short greeting and a light
// effect drawn on one transparent canvas over the picture (snow, hearts, fireworks …). It needs no three.js, so it
// works over the 3D house and the flat plan alike, and it stops by itself when the view is hidden. Kept gentle (#385):
// it plays for a short time when the view opens (the house's "season_effect" setting), then the glow and the pieces
// fade out and nothing moves. With "reduce motion" nothing moves; the glow shows for the same time.

import { seasonEffectMs, type Season, type SeasonEffect, type SeasonEffectMode } from "../seasons.ts";

export interface SeasonContext {
  /** The element the layers are put into (the view's stage). */
  host: HTMLElement;
  /** The holiday it is now, or null (looked at every half minute, so midnight and the countdown move on). */
  now: () => Season | null;
  /** The greeting's text for a key and its variables. */
  text: (key: string, vars: Record<string, number>) => string;
  /** The tablet level: the effect is drawn about 5 times a second. */
  low: () => boolean;
  /** How long the effect plays (#385); missing = "brief". */
  effect?: () => SeasonEffectMode | null | undefined;
}

export interface SeasonController {
  /** Looks at the date again now (the settings changed). */
  refresh(): void;
  dispose(): void;
}

type Sprite = HTMLCanvasElement;
interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  phase: number;
  sprite: Sprite;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  hue: number;
}

/** How each effect looks: what it is made of, how many, the way it moves. */
interface Look {
  glyphs: string[];
  n: number;
  /** fall / rise / twinkle (stays and fades in and out) */
  move: "fall" | "rise" | "twinkle";
  size: [number, number];
  speed: [number, number];
}
const LOOKS: Partial<Record<SeasonEffect, Look>> = {
  snow: { glyphs: ["❄"], n: 18, move: "fall", size: [10, 22], speed: [22, 46] },
  snow_light: { glyphs: ["❄"], n: 8, move: "fall", size: [10, 18], speed: [18, 34] },
  snow_sleigh: { glyphs: ["❄"], n: 18, move: "fall", size: [10, 22], speed: [22, 46] },
  confetti: { glyphs: ["#ffc94d", "#ff4f8b", "#4fc3f7", "#8bd450", "#b388ff"], n: 30, move: "fall", size: [6, 10], speed: [50, 110] },
  sparkles: { glyphs: ["✨"], n: 11, move: "twinkle", size: [14, 26], speed: [0, 0] },
  poppies: { glyphs: ["poppy"], n: 10, move: "fall", size: [14, 22], speed: [14, 30] },
  hearts: { glyphs: ["❤️", "💖", "💗"], n: 11, move: "rise", size: [14, 26], speed: [22, 50] },
  pancakes: { glyphs: ["🥞"], n: 7, move: "fall", size: [20, 30], speed: [24, 48] },
  flowers: { glyphs: ["🌸", "🌷", "🌼"], n: 11, move: "fall", size: [16, 26], speed: [20, 40] },
  easter: { glyphs: ["🥚", "🐣", "🐰", "🌷"], n: 9, move: "fall", size: [18, 28], speed: [22, 44] },
  stars: { glyphs: ["⭐", "✨"], n: 11, move: "twinkle", size: [14, 26], speed: [0, 0] },
  halloween: { glyphs: ["🎃", "🦇", "🕸️"], n: 9, move: "fall", size: [18, 30], speed: [20, 40] },
  lanterns: { glyphs: ["🏮", "🧧", "🎆"], n: 9, move: "rise", size: [18, 28], speed: [18, 40] },
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** One small picture of a glyph (an emoji or text), a colour square (a "#…" colour) or a poppy, drawn once. */
function sprite(glyph: string): Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = 48;
  const g = c.getContext("2d");
  if (!g) return c;
  if (glyph.startsWith("#")) {
    g.fillStyle = glyph;
    g.fillRect(8, 14, 32, 20);
  } else if (glyph === "poppy") {
    g.fillStyle = "#d1202f";
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(24 + Math.cos((i / 5) * Math.PI * 2) * 9, 24 + Math.sin((i / 5) * Math.PI * 2) * 9, 10, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#1b1b1b";
    g.beginPath();
    g.arc(24, 24, 5, 0, Math.PI * 2);
    g.fill();
  } else {
    g.font = "36px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#ffffff";
    g.fillText(glyph, 24, 26);
  }
  return c;
}

export function startSeason(ctx: SeasonContext): SeasonController {
  const { host } = ctx;
  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:3;overflow:hidden";
  const glow = document.createElement("div");
  glow.style.cssText = "position:absolute;inset:0;transition:opacity 2s;opacity:0";
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;transition:opacity 2s";
  const pill = document.createElement("div");
  pill.style.cssText =
    "position:absolute;top:12px;left:50%;transform:translateX(-50%);max-width:90%;padding:6px 16px;border-radius:999px;background:rgba(0,0,0,.5);color:#fff;font:600 15px/1.3 system-ui,sans-serif;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;transition:opacity 1s";
  root.append(glow, canvas, pill);
  host.append(root);

  const reduce = (() => {
    try {
      return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  })();
  const g = canvas.getContext("2d");
  let season: Season | null = null;
  let bits: Bit[] = [];
  let sparks: Spark[] = [];
  let sleigh: { x: number; at: number } | null = null;
  let nextSleigh = 0;
  let nextBang = 0;
  let w = 0;
  let h = 0;
  let last = 0;
  let raf = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pillTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let shownText = "";
  /** When the effect stops (performance.now()); the mode it was worked out for. */
  let until = 0;
  let mode: SeasonEffectMode | null = null;
  const live = () => !!season && performance.now() < until;
  const sprites = new Map<string, Sprite>();
  const spriteOf = (k: string) => {
    let s = sprites.get(k);
    if (!s) sprites.set(k, (s = sprite(k)));
    return s;
  };

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = host.clientWidth;
    h = host.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    g?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  const resizeObs = typeof ResizeObserver === "function" ? new ResizeObserver(size) : null;
  resizeObs?.observe(host);

  const spawn = (look: Look, anywhere: boolean): Bit => {
    const glyph = look.glyphs[Math.floor(Math.random() * look.glyphs.length)];
    const speed = rand(look.speed[0], look.speed[1]);
    return {
      x: rand(0, w),
      y: anywhere ? rand(0, h) : look.move === "rise" ? h + 30 : -30,
      vx: rand(-8, 8),
      vy: look.move === "rise" ? -speed : look.move === "fall" ? speed : 0,
      size: rand(look.size[0], look.size[1]),
      rot: rand(0, Math.PI * 2),
      vr: glyph.startsWith("#") ? rand(-4, 4) : rand(-0.8, 0.8),
      phase: rand(0, Math.PI * 2),
      sprite: spriteOf(glyph),
    };
  };

  const showPill = (ms: number) => {
    pill.style.opacity = "1";
    clearTimeout(pillTimer);
    pillTimer = setTimeout(() => (pill.style.opacity = "0"), ms);
  };

  /** A new holiday (or none): the glow, the greeting and the pieces of the effect. */
  const apply = (next: Season | null) => {
    const nextMode = ctx.effect?.() ?? "brief";
    const changed = next?.id !== season?.id || next?.effect !== season?.effect || nextMode !== mode;
    season = next;
    mode = nextMode;
    if (!next) {
      glow.style.opacity = "0";
      pill.style.opacity = "0";
      bits = [];
      sparks = [];
      sleigh = null;
      shownText = "";
      g?.clearRect(0, 0, w, h);
      return;
    }
    // a light glow at the very edges only, and only while the effect plays
    glow.style.background = `radial-gradient(ellipse at 50% 50%, transparent 62%, ${next.tint} 100%)`;
    const text = ctx.text(next.key, next.vars);
    if (text !== shownText) {
      shownText = text;
      pill.textContent = text;
      showPill(next.id === "nye" ? 10000 : 12000);
    }
    if (changed) {
      until = performance.now() + seasonEffectMs(nextMode);
      const look = LOOKS[next.effect];
      bits = look && !reduce ? Array.from({ length: look.n }, () => spawn(look, true)) : [];
      sparks = [];
      sleigh = null;
      nextSleigh = performance.now() + 3000;
      nextBang = performance.now() + 600;
    }
    const on = live();
    glow.style.opacity = on ? "0.6" : "0";
    canvas.style.opacity = on ? "1" : "0";
    if (!on) setTimeout(() => !live() && g?.clearRect(0, 0, w, h), 2100);
  };

  const draw = (now: number) => {
    if (!g || !season) return;
    const dt = Math.min(0.25, last ? (now - last) / 1000 : 0.016);
    last = now;
    g.clearRect(0, 0, w, h);
    const look = LOOKS[season.effect];
    if (look) {
      for (let i = 0; i < bits.length; i++) {
        const b = bits[i];
        b.phase += dt;
        b.rot += b.vr * dt;
        if (look.move === "twinkle") {
          g.globalAlpha = 0.3 + 0.3 * Math.sin(b.phase * 1.8);
        } else {
          b.x += (b.vx + Math.sin(b.phase * 1.3) * 14) * dt;
          b.y += b.vy * dt;
          g.globalAlpha = 0.55;
          if (b.y > h + 30 || b.y < -40 || b.x < -30 || b.x > w + 30) bits[i] = spawn(look, false);
        }
        g.save();
        g.translate(b.x, b.y);
        // confetti and poppies tumble, the rest sways a little
        g.rotate(look.glyphs[0].startsWith("#") || look.glyphs[0] === "poppy" ? b.rot : Math.sin(b.phase) * 0.3);
        g.drawImage(b.sprite, -b.size / 2, -b.size / 2, b.size, b.size);
        g.restore();
        if (look.move === "twinkle" && Math.sin(b.phase * 1.8) < -0.98) {
          // gone dark: it comes back somewhere else
          b.x = rand(0, w);
          b.y = rand(0, h);
        }
      }
    }
    g.globalAlpha = 1;
    if (season.effect === "fireworks") {
      if (now >= nextBang) {
        nextBang = now + rand(1400, 2600);
        const x = rand(w * 0.15, w * 0.85);
        const y = rand(h * 0.12, h * 0.5);
        const hue = Math.floor(rand(0, 360));
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          const v = rand(50, 120);
          sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, hue });
        }
      }
      sparks = sparks.filter((s) => s.age < 1.5);
      for (const s of sparks) {
        s.age += dt;
        s.vy += 70 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        g.globalAlpha = 0.7 * Math.max(0, 1 - s.age / 1.5);
        g.fillStyle = `hsl(${s.hue}, 100%, 65%)`;
        g.beginPath();
        g.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    if (season.effect === "snow_sleigh") {
      if (!sleigh && now >= nextSleigh) sleigh = { x: -40, at: now };
      if (sleigh) {
        sleigh.x += 90 * dt;
        const y = h * 0.12 + Math.sin((now - sleigh.at) / 700) * 8;
        g.font = "32px sans-serif";
        g.textBaseline = "middle";
        g.fillText("🦌🛷🎅", sleigh.x, y);
        if (sleigh.x > w + 140) {
          sleigh = null;
          nextSleigh = now + rand(18000, 36000);
        }
      }
    }
  };

  const frame = (now: number) => {
    raf = 0;
    if (disposed) return;
    if (!live()) {
      // the time is up: everything fades out and the drawing stops
      apply(season);
      return;
    }
    if (!document.hidden && season && !reduce) draw(now);
    if (!season || reduce) return;
    if (ctx.low()) timer = setTimeout(() => (raf = requestAnimationFrame(frame)), 180);
    else raf = requestAnimationFrame(frame);
  };
  const run = () => {
    if (!raf && !disposed && live() && !reduce) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  };

  const check = () => {
    apply(ctx.now());
    run();
    // with reduce motion nothing is drawn, so a timer takes the glow away
    if (reduce && live()) {
      clearTimeout(timer);
      timer = setTimeout(() => apply(season), until - performance.now() + 50);
    }
  };
  check();
  const poll = setInterval(check, 30000);

  return {
    refresh: check,
    dispose() {
      disposed = true;
      clearInterval(poll);
      clearTimeout(timer);
      clearTimeout(pillTimer);
      cancelAnimationFrame(raf);
      resizeObs?.disconnect();
      root.remove();
    },
  };
}
