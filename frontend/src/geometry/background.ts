// The floor's background picture (the plan drawing to trace): stored by its upper left corner, turned about its middle.
// Turn about the middle on Turn floor ported from NeonPlan 3D 3.5.0 (MIT, (c) 2026 Mastershort), #1124.
import type { Background, Vec2 } from "../model.ts";

const round = (v: number) => Math.round(v * 1000) / 1000;

/** The middle of the picture in the plan; `aspect` = its height / width. */
export function backgroundMiddle(bg: Background, aspect: number): Vec2 {
  return [bg.x + bg.width / 2, bg.z + (bg.width * aspect) / 2];
}

/**
 * The picture after the floor (or the whole house) turned by 90° with `mv`: its middle goes where `mv` takes it and
 * it turns about that middle, so it stays under the rooms drawn on it. Turning its corner instead let it slide off
 * them (#1124). `aspect` = height / width.
 */
export function turnedBackground(bg: Background, aspect: number, mv: (p: Vec2) => Vec2): Background {
  const h = bg.width * aspect;
  const [mx, mz] = mv(backgroundMiddle(bg, aspect));
  return { ...bg, x: round(mx - bg.width / 2), z: round(mz - h / 2), rotation: ((bg.rotation ?? 0) + 90) % 360 };
}
