// Screen-reader announcements (#196): changes that otherwise only change pixels (another home, floor or look, an
// undo, Follow Home Assistant turned off) are written to one visually hidden polite live region on the page. Smoke
// and offline warnings stay role="alert" where they show. Every bundle's copy of this module shares the one region
// through globalThis.

/** The part of a document the announcer needs (a fake one in tests). */
export interface AnnounceDoc {
  createElement(tag: string): HTMLElement;
  body: { appendChild(el: HTMLElement): unknown } | null;
  fullscreenElement?: Element | null;
}

const ID = "fp3d-announce";
// hides the region from sight but not from screen readers
const HIDDEN = "position:fixed;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;";

const shared = ((globalThis as { __fp3dAnnounce?: { region: HTMLElement | null; timer: ReturnType<typeof setTimeout> | null } }).__fp3dAnnounce ??= { region: null, timer: null });

/** Where the region goes: into the element shown full screen (a card on a wall tablet), else the page. */
function mountPoint(doc: AnnounceDoc): { appendChild(el: HTMLElement): unknown } | null {
  let fs = doc.fullscreenElement ?? null;
  while (fs?.shadowRoot?.fullscreenElement) fs = fs.shadowRoot.fullscreenElement;
  return (fs as unknown as { appendChild(el: HTMLElement): unknown } | null) ?? doc.body;
}

/**
 * Tell a screen reader `text` (politely: after what it is reading). The same text twice in a row is read twice: the
 * region is emptied first and filled a moment later.
 */
export function announce(text: string, doc: AnnounceDoc | undefined = typeof document === "undefined" ? undefined : document): void {
  if (!doc || !text) return;
  const at = mountPoint(doc);
  if (!at) return;
  let region = shared.region;
  if (!region) {
    region = doc.createElement("div");
    region.id = ID;
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    region.setAttribute("style", HIDDEN);
    shared.region = region;
  }
  if (region.parentNode !== at) at.appendChild(region);
  region.textContent = "";
  if (shared.timer) clearTimeout(shared.timer);
  shared.timer = setTimeout(() => {
    shared.timer = null;
    region.textContent = text;
  }, 60);
}

/** The region's text now (tests). */
export function announced(): string {
  return shared.region?.textContent ?? "";
}

/** The home and floor a view shows, as far as announcements care. */
export interface ViewSpot {
  home: string | null | undefined;
  floor: string | null;
}

/** What to announce when the view moved from `seen` to `now`: another home, another floor or nothing (the first
 * load of a page says nothing: the screen reader reads the page then). */
export function viewChange(seen: ViewSpot | null, now: ViewSpot): "home" | "floor" | null {
  if (!seen) return null;
  if (seen.home !== now.home) return "home";
  return seen.floor !== now.floor ? "floor" : null;
}

type Texts = (key: "announce_look" | "announce_follow_ha_off" | "announce_follow_sun_off" | `theme_${string}`, vars?: Record<string, string>) => string;

/** The announcement for a look picked in the view menu; picking one turns a follow switch off without a word on
 * screen, so that is said too (F81). */
export function lookAnnouncement(before: string, after: string, t: Texts): string {
  const said = [t("announce_look", { look: t(`theme_${after}`) })];
  if (before !== after && before === "theme") said.push(t("announce_follow_ha_off"));
  if (before !== after && before === "auto") said.push(t("announce_follow_sun_off"));
  return said.join(". ");
}
