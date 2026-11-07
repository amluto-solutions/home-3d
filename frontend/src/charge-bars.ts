// Battery models show their charge as four bars of 25 % each (#282).

export type BarColour = "red" | "orange" | "green" | null;

/** RGB of each bar colour (the glow layer adds light, so these stay below white). */
export const BAR_RGB: Record<Exclude<BarColour, null>, [number, number, number]> = {
  red: [1, 0.25, 0.2],
  orange: [1, 0.65, 0.15],
  green: [0.3, 1, 0.5],
};

export const CHARGE_BAR_COUNT = 4;

/** An unlit bar: a faint grey. */
export const DARK_BAR_RGB: [number, number, number] = [0.35, 0.4, 0.45];

/**
 * Charge bands, lowest first: up to and including `max` per cent the bars (bottom up) are coloured as listed, the
 * rest stay dark. Between the integer steps of the table (25.5 %) the next band applies.
 */
export const CHARGE_BANDS: readonly { max: number; bars: readonly BarColour[] }[] = [
  { max: 10, bars: ["red", null, null, null] },
  { max: 20, bars: ["orange", null, null, null] },
  { max: 25, bars: ["green", null, null, null] },
  { max: 40, bars: ["green", "orange", null, null] },
  { max: 50, bars: ["green", "green", null, null] },
  { max: 65, bars: ["green", "green", "orange", null] },
  { max: 75, bars: ["green", "green", "green", null] },
  { max: 90, bars: ["green", "green", "green", "orange"] },
  { max: Infinity, bars: ["green", "green", "green", "green"] },
];

/** The four bars (bottom up) for a charge in per cent; a value outside 0-100 is clamped. */
export function chargeBars(soc: number): readonly BarColour[] {
  const v = Math.min(100, Math.max(0, soc));
  return (CHARGE_BANDS.find((b) => v <= b.max) ?? CHARGE_BANDS[CHARGE_BANDS.length - 1]).bars;
}
