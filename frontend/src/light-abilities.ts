// What a light can do, from its supported colour modes (shared by the quick menu, the swipe on a lamp and the light popup).

import type { HassEntity } from "./types.ts";

const COLOR_MODES = ["hs", "rgb", "rgbw", "rgbww", "xy"];

export function lightAbilities(st: HassEntity): { dim: boolean; color: boolean; temp: boolean } {
  const modes = (st.attributes.supported_color_modes as string[] | undefined) ?? [];
  const color = modes.some((m) => COLOR_MODES.includes(m));
  return { dim: modes.some((m) => m !== "onoff"), color, temp: modes.includes("color_temp") };
}

const COVER_SET_POSITION = 4;

/** Whether a cover can be moved to a position. */
export function coverPositionable(st: HassEntity): boolean {
  return (((st.attributes.supported_features as number) ?? 0) & COVER_SET_POSITION) !== 0 && typeof st.attributes.current_position === "number";
}
