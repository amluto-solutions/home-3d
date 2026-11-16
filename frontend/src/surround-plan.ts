// The neighbourhood from OpenStreetMap in the 2D plans (#463): the editor's plan and the read-only plan draw it faintly
// under the floor, on every floor at the ground floor's level – parks, woods and water as areas, streets and paths as
// lines of their width, the neighbours' houses as outlines; the house's own one on the map (and any other the plan
// hides) dashed. Drawn in plan metres once per map, north and plan (lit's guard): panning and zooming only move it.
// Ported from NeonPlan 3D 3.4.1 (MIT, Mastershort).

import { nothing, svg, type TemplateResult } from "lit";
import { guard } from "lit/directives/guard.js";
import type { Building, Floor, Vec2 } from "./model.ts";
import { atGroundLevel, hiddenBuildings, mapToPlan, surroundKey } from "./surroundings.ts";

const pts = (ring: readonly Vec2[]) => ring.map((p) => `${Math.round(p[0] * 100) / 100},${Math.round(p[1] * 100) / 100}`).join(" ");

/** What the plan draws of the map, by plan: the key of the drawing and the shapes in plan metres. */
interface PlanMap {
  key: string;
  areas: { p: string; k: string }[];
  ways: { p: string; w: number; k: string }[];
  buildings: { p: string; hidden: boolean }[];
}

const memo = new WeakMap<Building, PlanMap | null>();
let last: PlanMap | null = null;

/** The map in plan coordinates for a plan (null while it is off or missing), worked out once per plan. */
export function planMap(b: Building): PlanMap | null {
  if (memo.has(b)) return memo.get(b)!;
  const s = b.settings.surroundings;
  let out: PlanMap | null = null;
  if (s?.on) {
    const north = b.settings.north ?? 0;
    const at = (ring: readonly Vec2[]) => pts(ring.map((p) => mapToPlan(s, north, p)));
    const hidden = hiddenBuildings(s, b);
    const key = `${surroundKey(b)}|${north}|${[...hidden].join(".")}`;
    // an edit of the house makes a new plan: the map's shapes stay while the map, the north and the hidden houses stay
    if (last?.key === key) {
      memo.set(b, last);
      return last;
    }
    out = last = {
      key,
      areas: s.areas.map((a) => ({ p: at(a.p), k: a.k })),
      ways: s.ways.map((w) => ({ p: at(w.p), w: Math.max(0.6, w.w), k: w.k })),
      buildings: s.buildings.map((bd, i) => ({ p: at(bd.p), hidden: hidden.has(i) })),
    };
  }
  memo.set(b, out);
  return out;
}

/**
 * The map under a floor of the plan, in plan metres (the caller places it: the editor with its view's transform, the
 * read-only plan as it is), or nothing on a floor away from the ground floor's level or without a map.
 */
export function surroundPlanSvg(b: Building, floor: Floor): TemplateResult | typeof nothing {
  const map = atGroundLevel(b, floor) ? planMap(b) : null;
  if (!map) return nothing;
  return svg`${guard(
    [map.key],
    () => svg`
      ${map.areas.map((a) => svg`<polygon class=${`fp3d-osm-a fp3d-osm-${a.k}`} points=${a.p} />`)}
      ${map.ways.map((w) => svg`<polyline class=${`fp3d-osm-w fp3d-osm-${w.k}`} points=${w.p} stroke-width=${w.w} />`)}
      ${map.buildings.map((bd) => svg`<polygon class=${bd.hidden ? "fp3d-osm-own" : "fp3d-osm-b"} points=${bd.p} />`)}
    `,
  )}`;
}

/** The plans' look of the map: faint, no taps (the plan's own things lie above it). */
export const SURROUND_PLAN_CSS = `
.fp3d-osm { pointer-events: none; }
.fp3d-osm-a { stroke: none; }
.fp3d-osm-green { fill: rgba(90, 175, 105, 0.12); }
.fp3d-osm-wood { fill: rgba(60, 140, 80, 0.16); }
.fp3d-osm-a.fp3d-osm-water { fill: rgba(70, 150, 220, 0.16); }
.fp3d-osm-w { fill: none; stroke-linecap: round; stroke-linejoin: round; stroke: rgba(140, 150, 170, 0.16); }
.fp3d-osm-w.fp3d-osm-path { stroke: rgba(170, 160, 140, 0.16); }
.fp3d-osm-w.fp3d-osm-rail { stroke: rgba(150, 120, 140, 0.2); }
.fp3d-osm-w.fp3d-osm-water { stroke: rgba(70, 150, 220, 0.2); }
.fp3d-osm-b { fill: rgba(140, 155, 190, 0.1); stroke: rgba(140, 155, 190, 0.4); stroke-width: 1; vector-effect: non-scaling-stroke; }
.fp3d-osm-own { fill: none; stroke: rgba(255, 196, 64, 0.75); stroke-width: 1.5; stroke-dasharray: 5 4; vector-effect: non-scaling-stroke; }
`;
