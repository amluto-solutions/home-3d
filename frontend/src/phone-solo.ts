// "Room on its own" in the phone bar's More (#500, ported from NeonPlan 3D 4.0.0, MIT, Mastershort): a room one jumps
// into stands alone in the picture, without the rest of the house. Each device chooses for itself (stored here); until
// it has, the card's `phone_solo` counts. Shared by the card and the panel.

const KEY = "home3d.phone_solo";

/** What this device chose: true / false, or null when it has not chosen yet. */
export function savedSolo(): boolean | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
}

/** Remember this device's choice. */
export function saveSolo(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // storage unavailable (private mode): the choice just is not remembered
  }
}

/** Whether a room stands alone: the device's own choice, else the card's default (`phone_solo`). */
export function soloOn(saved: boolean | null, cardDefault: unknown): boolean {
  return saved ?? cardDefault === true;
}

/**
 * The rooms the 3D view draws: the room jumped into while the phone view shows it on its own, else the card's own
 * `rooms` (already checked against the plan), else null (the whole house).
 */
export function viewRooms(o: { phone: boolean; solo: boolean; roomId: string | null; rooms?: readonly string[] }): string[] | null {
  if (o.phone && o.solo && o.roomId) return [o.roomId];
  return o.rooms?.length ? [...o.rooms] : null;
}
