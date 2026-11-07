// Where on the Extensions tab a setting of the hidden "fun" page lives (#302): the card or row the tab scrolls to.
// Tiny and apart from the search index so the Settings page can use it without the index chunk.

/** The Extensions tab's anchor for a setting id (a `data-ext` value there); the Fun packs card when it has no row of its own. */
export function extensionAnchor(settingId: string | null | undefined): string | null {
  if (!settingId) return null;
  if (settingId.startsWith("seasons.")) return `season:${settingId.slice(8)}`;
  if (settingId === "halloween.ghost") return "season:halloween";
  if (settingId.startsWith("pets.")) return "pets";
  if (settingId === "easter_eggs") return "fun";
  return null;
}
