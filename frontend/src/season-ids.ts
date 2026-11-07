// The ids of the seasonal themes (#239), apart from the calendar (seasons.ts) so the pages that only list them stay small.

/** The holidays, in the order they are tried when one day is two of them (31 December: New Year's Eve, then Twixmas; Chinese New Year comes before the rest so a day of its own wins, e.g. over Pancake Day in 2026). */
export const SEASON_IDS = [
  "nye",
  "new_year",
  "chinese_new_year",
  "christmas_eve",
  "christmas",
  "boxing_day",
  "twixmas",
  "advent",
  "bonfire",
  "remembrance",
  "valentines",
  "pancake_day",
  "mothers_day",
  "easter",
  "fathers_day",
  "halloween",
] as const;
export type SeasonId = (typeof SEASON_IDS)[number];

/** How long the holiday effect plays when the view opens (#385): not at all, briefly (the default), a minute, or all the time. */
export type SeasonEffectMode = "none" | "brief" | "long" | "always";
export const SEASON_EFFECT_MODES: readonly SeasonEffectMode[] = ["none", "brief", "long", "always"];
