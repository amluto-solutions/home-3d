// Aligning and spreading a selection of items (#235). Pure maths on the items' boxes (their rotated footprints), no
// editor and no DOM, so it is easy to test. The align tools follow the owner's table builder: everything moves to the
// extreme of the selection ("align left" is the left of the whole group, not of the item picked first), centres
// line up on the middle of the selection's extent. Distribute is the usual one: the outermost items stay, the gaps
// between the others become equal.

import { itemBox } from "../geometry/snap-guides.ts";
import type { Furniture } from "../model.ts";

export type AlignOp = "left" | "centre" | "right" | "top" | "middle" | "bottom" | "across" | "down";

/** Align operations need two items; the distribute ones three. */
export const needs = (op: AlignOp): number => (op === "across" || op === "down" ? 3 : 2);

type Item = Pick<Furniture, "id" | "x" | "z" | "w" | "d" | "rotation">;

/**
 * How far each item moves (metres, along x and z) for `op`, by id; null when the selection is too small. Items that
 * would not move are left out.
 */
export function arrange(items: readonly Item[], op: AlignOp): Map<string, [number, number]> | null {
  if (items.length < needs(op)) return null;
  const boxes = items.map((m) => ({ id: m.id, ...itemBox(m) }));
  const x0 = Math.min(...boxes.map((b) => b.x0));
  const x1 = Math.max(...boxes.map((b) => b.x1));
  const z0 = Math.min(...boxes.map((b) => b.z0));
  const z1 = Math.max(...boxes.map((b) => b.z1));
  const out = new Map<string, [number, number]>();
  const move = (id: string, dx: number, dz: number) => {
    if (Math.abs(dx) > 1e-9 || Math.abs(dz) > 1e-9) out.set(id, [dx, dz]);
  };
  if (op === "across" || op === "down") {
    const x = op === "across";
    const lo = (b: (typeof boxes)[number]) => (x ? b.x0 : b.z0);
    const hi = (b: (typeof boxes)[number]) => (x ? b.x1 : b.z1);
    const sorted = [...boxes].sort((a, b) => lo(a) + hi(a) - (lo(b) + hi(b)));
    const span = (x ? x1 - x0 : z1 - z0) - sorted.reduce((s, b) => s + hi(b) - lo(b), 0);
    const gap = span / (sorted.length - 1);
    let at = lo(sorted[0]);
    for (const b of sorted) {
      const d = at - lo(b);
      move(b.id, x ? d : 0, x ? 0 : d);
      at += hi(b) - lo(b) + gap;
    }
    return out;
  }
  for (const b of boxes) {
    switch (op) {
      case "left":
        move(b.id, x0 - b.x0, 0);
        break;
      case "right":
        move(b.id, x1 - b.x1, 0);
        break;
      case "centre":
        move(b.id, (x0 + x1) / 2 - (b.x0 + b.x1) / 2, 0);
        break;
      case "top":
        move(b.id, 0, z0 - b.z0);
        break;
      case "bottom":
        move(b.id, 0, z1 - b.z1);
        break;
      case "middle":
        move(b.id, 0, (z0 + z1) / 2 - (b.z0 + b.z1) / 2);
        break;
    }
  }
  return out;
}
