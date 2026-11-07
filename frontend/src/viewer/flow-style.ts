// How an energy cable shows its power: the light dots run faster and the cable grows thicker with the watts (#28).
// Square roots, so 2 kW is not 20 times 100 W; both stop growing where a car charges.

/** Stripe speed (m/s): still at 0 W, faster with more power. */
export function flowSpeed(power: number): number {
  return power > 0.5 ? Math.min(2.4, 0.3 + Math.sqrt(power) / 28) : 0;
}

/** Cable width against the normal one: thin while it carries nothing, thicker with more power. */
export function flowWidth(power: number): number {
  return power > 0.5 ? Math.min(2.4, 0.6 + Math.sqrt(power) / 50) : 0.6;
}
