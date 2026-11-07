/**
 * Long press on a device (#82): Home Assistant's more-info for the entity behind the pin, like other HA cards.
 * Pins that stand for no single entity (an item's own actions, a door, a wall switch's frame, a module card, the
 * grid's street end) return null and are handled by their own code.
 */
export function holdTarget(pinId: string): string | null {
  // a mailbox's or a plant's sensor, a bin's pickup source (household feature): "hh:<entity>#<furniture id>"
  if (pinId.startsWith("hh:")) return pinId.slice(3).split("#")[0] || null;
  // a detection pin stands for its sensor
  if (pinId.startsWith("detect:")) return pinId.slice(7) || null;
  return /^[a-z0-9_]+\.[a-z0-9_]+$/i.test(pinId) ? pinId : null;
}
