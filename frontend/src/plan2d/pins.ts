// Which device markers the 2D plan (#41) shows. Small and pure: the main bundle decides it with the 3D view's rules
// (it knows the marker mode), the plan bundle only draws the pins it is given.

import type { DeviceMarker } from "../viewer/viewer3d.ts";

type MarkerMode = "none" | "important" | "all" | "room";

/**
 * Whether a marker carries a pin in 2D: every pin the 3D view shows (`in3d`), and lights and cameras, whose pins the
 * 3D view leaves out because their lamp or camera model stands for them. The plan has no models, and a lamp seen
 * from above is too small to find with a finger on a wall tablet.
 */
export function pinIn2d(m: Pick<DeviceMarker, "id" | "show" | "lamp" | "model" | "furnitureId">, mode: MarkerMode, in3d: boolean): boolean {
  if (in3d) return true;
  if (m.show === "never" || mode === "none" || mode === "room") return false;
  return !!m.lamp || !!m.model;
}
