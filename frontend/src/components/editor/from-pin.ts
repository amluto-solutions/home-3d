// Items made from a device pin in this browser (#408, WORD-11): only they offer "Back to a device pin" in their "⋯".
// Kept in the browser (home3d.fromPin), not in the plan, so no stored plan key changes. A module of its own without
// imports, so the item panel's frame can ask it without loading the editor's furniture code.

const FROM_PIN_KEY = "home3d.fromPin";
let fromPin: string[] | null = null;

function fromPinList(): string[] {
  if (fromPin) return fromPin;
  try {
    const raw = JSON.parse(localStorage.getItem(FROM_PIN_KEY) ?? "[]");
    fromPin = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    fromPin = [];
  }
  return fromPin;
}

/**
 * Items made from a device pin in this browser (#408, WORD-11): only they offer "Back to a device pin". Kept in the
 * browser, not in the plan (no stored plan key changes); the last 500.
 */
export function madeFromPin(id: string): boolean {
  return fromPinList().includes(id);
}

export function rememberFromPin(id: string | null): void {
  const list = fromPinList().filter((x) => x !== id);
  fromPin = id ? [...list, id].slice(-500) : list;
  try {
    localStorage.setItem(FROM_PIN_KEY, JSON.stringify(fromPin));
  } catch {
    // no storage: it lasts for this visit
  }
}

/** Forgets the items made from a pin (tests). */
export function resetFromPin(): void {
  fromPin = [];
}
