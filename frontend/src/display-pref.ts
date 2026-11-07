// The View's "Display what" preference (#268, #269): which kinds of objects this device hides. Kept apart from
// object-types.ts (which knows the item types) so the panel reads it without that module: no imports.

export const OBJECT_TYPES = ["room_names", "lights", "media", "cameras", "sensors", "climate", "covers", "plugs", "furniture", "decor", "outdoor", "energy"] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

/** The preference "home3d.display_hidden": the hidden kinds, comma separated. */
export const DISPLAY_HIDDEN_KEY = "display_hidden";
/** The old Furniture switch (#269) preference: "0" hid the furniture and decor that no device is linked to. Read once, never written (#306). */
export const SHOW_FURNITURE_KEY = "show_furniture";

/**
 * The hidden kinds from the stored preference. Until the list is written, room names are hidden (#347) unless the old "Room names" switch was on; the old
 * Furniture switch (off, #306: now the furniture and decor kinds) still count.
 */
export function parseHidden(raw: string | null, legacyRoomNames: string | null = null, legacyFurniture: string | null = null): Set<ObjectType> {
  if (raw === null) {
    // #347: a device that never chose hides the room names; the old switch set to on ("1") was a choice and is kept
    const old = new Set<ObjectType>();
    if (legacyRoomNames !== "1") old.add("room_names");
    if (legacyFurniture === "0") old.add("furniture").add("decor");
    return old;
  }
  return new Set(raw.split(",").filter((s): s is ObjectType => (OBJECT_TYPES as readonly string[]).includes(s)));
}

/** The preference text of the hidden kinds (empty: nothing hidden; it is still written, so the old Room names switch no longer counts). */
export function hiddenText(hidden: ReadonlySet<ObjectType>): string {
  return OBJECT_TYPES.filter((t) => hidden.has(t)).join(",");
}
