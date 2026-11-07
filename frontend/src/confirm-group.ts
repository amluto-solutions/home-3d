// "Ask first" for a button that acts on several devices at once (#162): "All on", "All open" and the star menu's
// house-wide rows ask once when any of the devices is marked "ask before switching", naming those devices.

/**
 * Whether the group may be switched: true at once when none of `ids` asks first, otherwise the answer of one question
 * that names the devices that do.
 */
export async function confirmGroup(
  ids: readonly string[],
  guarded: ReadonlySet<string> | null | undefined,
  nameOf: (id: string) => string,
  ask: (names: string) => Promise<boolean>,
): Promise<boolean> {
  const asking = guarded ? ids.filter((id) => guarded.has(id)) : [];
  if (!asking.length) return true;
  return ask(asking.map(nameOf).join(", "));
}
