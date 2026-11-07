/** Camera framing for the house view (#93): how far back the camera stands so the house fits the free part of the screen. */

const DEG = Math.PI / 180;

/** Share of the view kept free on EACH side for the controls over it (0.1 = a tenth at the left and a tenth at the right). */
export interface FitMargin {
  x: number;
  y: number;
}

/**
 * Distance at which a ball of `radius` fits the screen under a vertical field of view `fovDeg` and
 * width/height `aspect`, leaving `margin` free at the edges: the narrower of the two free angles decides.
 */
export function fitDistance(radius: number, fovDeg: number, aspect: number, margin: FitMargin = { x: 0, y: 0 }): number {
  const tv = Math.tan((fovDeg * DEG) / 2);
  const free = (m: number) => Math.max(0.1, 1 - 2 * m);
  const t = Math.min(tv * free(margin.y), tv * aspect * free(margin.x));
  // sin(atan t) = t / √(1 + t²)
  return (radius * Math.sqrt(1 + t * t)) / t;
}

/** A camera pose: how far, which way round, how steep, looking at which point. */
export interface FitView {
  radius: number;
  theta: number;
  phi: number;
  target: { x: number; y: number; z: number };
}

/** Whether the camera still stands (or is headed) where the last fit put it: nobody turned, zoomed or moved it. */
export function stillFitted(fitted: FitView | null, current: FitView): boolean {
  if (!fitted) return false;
  const same = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
  const r = Math.max(1, fitted.radius) * 0.01;
  return (
    same(current.radius, fitted.radius, r) &&
    same(current.theta, fitted.theta, 0.005) &&
    same(current.phi, fitted.phi, 0.005) &&
    same(current.target.x, fitted.target.x, r) &&
    same(current.target.y, fitted.target.y, r) &&
    same(current.target.z, fitted.target.z, r)
  );
}

/** Whether a resize frames the house again: the view is still the fitted one and the screen's shape changed noticeably. */
export function refitOnResize(fitted: FitView | null, current: FitView, oldAspect: number, newAspect: number): boolean {
  return Math.abs(Math.log(newAspect / oldAspect)) >= 0.02 && stillFitted(fitted, current);
}

/**
 * The distance of a saved start view on this screen. Start views are saved on wide screens; on a portrait
 * one the camera stands back by as much as a fitted house would, so what was framed still fits across.
 */
export function startViewRadius(radius: number, fovDeg: number, aspect: number): number {
  return radius * Math.max(1, fitDistance(1, fovDeg, aspect) / fitDistance(1, fovDeg, 16 / 9));
}

/** One floor as the framing sees it: its base height, its height and the outlines of its rooms and outdoor areas. */
export interface FitFloor {
  y0: number;
  height: number;
  rooms: readonly (readonly (readonly [number, number])[])[];
  outdoor: readonly (readonly (readonly [number, number])[])[];
}

export interface FitBox {
  min: [number, number, number];
  max: [number, number, number];
}

/**
 * The box the house view frames (#194): the rooms and, with them, the lawn and terrace around the house, so the
 * roof and the garden are not cropped. A very large plot (a field, a long drive) must not shrink the house to a dot,
 * so outdoor points are held within `reach` (a share of the house's longest side, at least 4 m) of the rooms.
 * Null: nothing to frame.
 */
export function plotBox(floors: readonly FitFloor[], reach = 0.75): FitBox | null {
  const lo: [number, number, number] = [Infinity, Infinity, Infinity];
  const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const grow = (x: number, y: number, z: number) => {
    lo[0] = Math.min(lo[0], x); lo[1] = Math.min(lo[1], y); lo[2] = Math.min(lo[2], z);
    hi[0] = Math.max(hi[0], x); hi[1] = Math.max(hi[1], y); hi[2] = Math.max(hi[2], z);
  };
  for (const f of floors) {
    for (const room of f.rooms) for (const [x, z] of room) { grow(x, f.y0, z); grow(x, f.y0 + f.height, z); }
  }
  const house = lo[0] <= hi[0];
  const slack = house ? Math.max(4, reach * Math.max(hi[0] - lo[0], hi[2] - lo[2])) : 0;
  const x0 = lo[0] - slack, x1 = hi[0] + slack, z0 = lo[2] - slack, z1 = hi[2] + slack;
  const gy = house ? lo[1] : 0;
  for (const f of floors) {
    for (const area of f.outdoor) {
      for (const [x, z] of area) grow(house ? Math.min(x1, Math.max(x0, x)) : x, house ? gy : f.y0, house ? Math.min(z1, Math.max(z0, z)) : z);
    }
  }
  return lo[0] <= hi[0] ? { min: lo, max: hi } : null;
}
