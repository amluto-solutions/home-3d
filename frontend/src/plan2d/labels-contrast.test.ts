// Room labels on the plan hold 7:1 in every look (#216), and the High contrast plan's lines do too.
import assert from "node:assert/strict";
import { test } from "node:test";
import { contrast } from "../scheme.ts";
import { THEMES } from "../themes.ts";
import { PLAN2D_CSS } from "./viewer2d.ts";

/** The custom properties a look sets, base block first then the look's own. */
function vars(theme: string): Record<string, string> {
  const out: Record<string, string> = {};
  const block = (head: string) => {
    const at = PLAN2D_CSS.indexOf(`${head} {`);
    return at < 0 ? "" : PLAN2D_CSS.slice(at, PLAN2D_CSS.indexOf("}", at));
  };
  const blocks = [block(".fp3d-p2d"), block(`.fp3d-p2d[data-theme="${theme}"]`)];
  for (const b of blocks) for (const m of b.matchAll(/(--p2d-[a-z0-9-]+): *([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const rgb = (s: string): [number, number, number, number] => {
  if (s.startsWith("#")) {
    const n = parseInt(s.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = /rgba?\(([^)]*)\)/.exec(s)!;
  const p = m[1].split(",").map((v) => Number(v.trim()));
  return [p[0], p[1], p[2], p[3] ?? 1];
};
const hex = (c: number[]) => `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const over = (top: string, under: string) => {
  const [r, g, b, a] = rgb(top);
  const u = rgb(under);
  return hex([r * a + u[0] * (1 - a), g * a + u[1] * (1 - a), b * a + u[2] * (1 - a)]);
};

for (const theme of THEMES) {
  test(`${theme}: the plan's room labels are 7:1 on the room fill (#216)`, () => {
    const v = vars(theme);
    const bg = over(v["--p2d-room"], v["--p2d-gap"]);
    assert.ok(contrast(hex(rgb(v["--p2d-label"])), bg) >= 7, `label ${v["--p2d-label"]} on ${bg}: ${contrast(hex(rgb(v["--p2d-label"])), bg).toFixed(2)}`);
  });
}

test("the label is not faded: a faded label dropped under 7:1 (#216)", () => {
  const label = /\.fp3d-p2d-label \{([^}]*)\}/.exec(PLAN2D_CSS)![1];
  assert.doesNotMatch(label, /opacity/);
  assert.doesNotMatch(/\.fp3d-p2d-label small \{([^}]*)\}/.exec(PLAN2D_CSS)![1], /opacity/);
});

test("High contrast plan: walls, room outlines and items are 7:1 on the plan's ground (#216)", () => {
  const v = vars("blueprint");
  const ground = over(v["--p2d-room"], v["--p2d-gap"]);
  for (const k of ["--p2d-wall", "--p2d-wall-ext", "--p2d-room-line", "--p2d-item"]) {
    const edge = over(v[k], ground);
    assert.ok(contrast(edge, ground) >= 7, `${k} ${edge} on ${ground}: ${contrast(edge, ground).toFixed(2)}`);
  }
});
