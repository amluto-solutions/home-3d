// The background behind the 3D house: the look's own sky (default), one colour, a gradient or a picture (idea from
// damonxxu's fork). Plain CSS on the stage – the 3D view draws on a transparent canvas, so it costs nothing.

import type { BuildingSettings } from "./model.ts";

export type Backdrop = NonNullable<BuildingSettings["backdrop"]>;

const HEX = /^#[0-9a-f]{3,8}$/i;

/** A picture address that is safe to put in CSS: http(s), a path on Home Assistant (/local/…) or an inline image. */
export function backdropImage(src: string | null | undefined): string | null {
  const s = (src ?? "").trim();
  if (!s || /["'()\\\s]/.test(s)) return null;
  return /^(https?:\/\/|\/)/i.test(s) || /^data:image\//i.test(s) ? s : null;
}

/** The stage's CSS background for a backdrop, or null for the look's own sky. */
export function backdropCss(b: Backdrop | null | undefined): string | null {
  if (!b || !b.kind) return null;
  const c1 = b.color && HEX.test(b.color) ? b.color : "#0b1426";
  const c2 = b.color2 && HEX.test(b.color2) ? b.color2 : "#03060c";
  if (b.kind === "color") return c1;
  if (b.kind === "gradient") return `linear-gradient(180deg, ${c1}, ${c2})`;
  const img = backdropImage(b.image);
  if (!img) return null;
  // the picture lies behind a dark veil so the neon lines stay readable (0 = none, 0.9 = almost black)
  const dim = Math.min(0.9, Math.max(0, b.dim ?? 0.45));
  return `linear-gradient(rgba(4, 8, 16, ${dim}), rgba(4, 8, 16, ${dim})), url("${img}") center / cover no-repeat`;
}
