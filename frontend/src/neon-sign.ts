/**
 * Neon sign: an own text in glowing tubes on a dark acrylic plate on the wall. It lights while its light or switch is
 * on (always, when nothing is linked), in the light's colour when the light shows colours, else in the sign's own
 * colour. The text is drawn once into a picture that lies on the plate like a screen's picture: no work per frame.
 *
 * Ported from NeonPlan 3D 3.2.0 (MIT, Mastershort), fitted to Home 3D: the choice of four fonts (system fonts only,
 * nothing is loaded), cache and colour steps kept small so a light that fades through colours does not draw a
 * picture for every step.
 */
import type { Furniture } from "./model.ts";
import type { HassEntity } from "./types.ts";
import { lightGlow } from "./devices.ts";

/** The sign's own colour when none is chosen: hot pink. */
export const SIGN_DEFAULT = "#ff3fb4";

/** The fonts a sign's text can use, first is the default. All are system fonts with a generic fallback. */
export const SIGN_FONTS = ["script", "sans", "block", "serif"] as const;
export type SignFont = (typeof SIGN_FONTS)[number];

const FONT_STACK: Record<SignFont, { family: string; weight: number }> = {
  script: { family: "'Segoe Script', 'Brush Script MT', 'Apple Chancery', 'Comic Sans MS', cursive", weight: 600 },
  sans: { family: "'Trebuchet MS', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif", weight: 700 },
  block: { family: "Impact, 'Arial Black', 'Helvetica Neue', Arial, sans-serif", weight: 400 },
  serif: { family: "Georgia, 'Times New Roman', Times, serif", weight: 700 },
};

/** The font of a sign: its own when it is one of the list, else the script font (an unknown name never breaks it). */
export function signFont(f: Pick<Furniture, "sign_font"> | string | null | undefined): SignFont {
  const v = typeof f === "string" ? f : f?.sign_font;
  return (SIGN_FONTS as readonly string[]).includes(v ?? "") ? (v as SignFont) : "script";
}

/** The lines of a sign's text: split with | or a line break, at most two lines of 40 characters. */
export function signLines(text: string | null | undefined): string[] {
  const lines = String(text ?? "")
    .split(/\s*(?:\||\n)\s*/)
    .map((l) => l.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 2);
  return lines.length ? lines : ["Neon"];
}

function hexColor(hex: string | null | undefined): [number, number, number] | null {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/**
 * Whether the sign is lit, its colour (0 … 1 channels) and brightness. A coloured light gives its colour; a white
 * light, a switch or nothing linked keep the sign's own colour.
 */
export function signLight(f: Pick<Furniture, "sign_color">, st: HassEntity | undefined, linked: boolean): { on: boolean; color: [number, number, number]; level: number } {
  const own = hexColor(f.sign_color) ?? (hexColor(SIGN_DEFAULT) as [number, number, number]);
  if (!linked) return { on: true, color: own, level: 1 };
  if (!st) return { on: false, color: own, level: 0 };
  const domain = st.entity_id.split(".")[0];
  if (domain === "light") {
    const glow = lightGlow(st);
    if (!glow) return { on: false, color: own, level: 0 };
    const mode = st.attributes.color_mode;
    const coloured = Array.isArray(st.attributes.rgb_color) && mode !== "color_temp" && mode !== "brightness" && mode !== "onoff" && mode !== "white";
    return { on: true, color: coloured ? glow.color : own, level: glow.level };
  }
  const on = ["on", "open", "home", "playing", "heat", "cool", "auto"].includes(st.state);
  return { on, color: own, level: on ? 1 : 0 };
}

const cache = new Map<string, string>();
/** The dark acrylic the picture is drawn on. */
const PLATE = "#05050b";

/**
 * The sign's picture as a data URL: the text in tubes on the dark plate, at the plate's aspect ratio. Lit: a
 * soft glow in the colour around a pale core; off: dull tubes in a dark shade of the colour. Cached by its look
 * (colour in 16 steps, brightness in tenths).
 */
export function neonSignPicture(lines: readonly string[], color: readonly [number, number, number], on: boolean, level: number, aspect: number, font: SignFont = "script"): string | null {
  const a = Math.min(8, Math.max(0.25, Number.isFinite(aspect) && aspect > 0 ? aspect : 3));
  const lv = on ? Math.round(Math.min(1, Math.max(0.2, level)) * 10) / 10 : 0;
  const step = color.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 16) / 16);
  const key = `${font}|${lines.join("\n")}|${step.join(",")}|${lv}|${a.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") return null;
  const W = a >= 1 ? 1024 : Math.round(1024 * a);
  const H = a >= 1 ? Math.round(1024 / a) : 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // the plate's own dark acrylic fills the picture: no transparent edges, whose colours the 3D view blended too brightly
  ctx.fillStyle = PLATE;
  ctx.fillRect(0, 0, W, H);
  const { family, weight } = FONT_STACK[font];
  // the largest size at which the longest line fits 86 % of the width and all lines 78 % of the height
  ctx.font = `${weight} 100px ${family}`;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
  const size = Math.max(12, Math.min((W * 0.86 * 100) / widest, (H * 0.78) / (lines.length * 1.15)));
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const css = (c: readonly number[], k: number, alpha = 1) => `rgba(${c.map((v) => Math.round(Math.min(1, Math.max(0, v * k)) * 255)).join(",")},${alpha})`;
  const core = step.map((v) => v + (1 - v) * 0.65);
  const y0 = H / 2 - ((lines.length - 1) * size * 1.15) / 2;
  lines.forEach((line, i) => {
    const y = y0 + i * size * 1.15;
    if (on) {
      // glow: a wide soft halo (only the text's shadow: the text itself is drawn off the picture), then the tube with
      // a small glow of its own and a pale core
      ctx.shadowOffsetX = W * 2;
      ctx.shadowColor = css(step, 1, 0.8 * lv);
      ctx.shadowBlur = size * 0.5 * lv;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = size * 0.04;
      ctx.strokeText(line, W / 2 - W * 2, y);
      ctx.shadowOffsetX = 0;
      ctx.shadowColor = css(step, 1);
      ctx.shadowBlur = size * 0.12 * lv;
      ctx.fillStyle = css(core, 0.6 + 0.4 * lv);
      ctx.fillText(line, W / 2, y);
      ctx.shadowBlur = 0;
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = css(step.map((v) => 0.12 + v * 0.22), 1);
      ctx.fillText(line, W / 2, y);
    }
  });
  const url = canvas.toDataURL("image/png");
  if (cache.size >= 24) cache.delete(cache.keys().next().value as string);
  cache.set(key, url);
  return url;
}
