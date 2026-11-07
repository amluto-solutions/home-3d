// Pack updates (#26): what the backend says about updates (custom_components/home_3d/pack_updates.py), and the
// small rules the extensions page follows. Installed packs are checked on a schedule; a newer release goes into the
// library, and a placed item takes it only when it is updated (one by one, or by the auto-update setting).

export type CheckFrequency = "off" | "daily" | "weekly" | "monthly";

export interface PackUpdateSettings {
  /** Apply new releases to placed items without asking (off: each placed item waits for an editor). */
  auto_update: boolean;
  frequency: CheckFrequency;
  /** Local time of the check, "HH:MM". */
  time: string;
  /** The day of a weekly check, 0 = Monday (a monthly check runs on the 1st). */
  weekday: number;
  /** Where the Library's Browse tab gets its pack list (#336); "" is Home 3D's own. Missing from an older backend. */
  index_url?: string;
}

export interface PackUpdateState {
  id: string;
  release: number;
  /** The installed release's one line on what it changed (#288), when the pack gave one. */
  note?: string;
  bundled: boolean;
  /** Pinned to its release: no check updates it, auto-update leaves its items alone. */
  pinned: boolean;
  /** Installed from GitHub, so checks look for new releases. */
  checked: boolean;
  /** The release a roll back would put back, null when there is none. */
  previous_release: number | null;
  /** The last check: when, the release found, or why it failed. */
  checked_at?: number;
  latest_release?: number;
  /** A newer release a check found but did not install (#189): auto-update is off, an editor reviews and installs it. */
  available?: { release: number; commit: string; note?: string };
  /** Why auto-update left the available release to an editor (#373): it changes the pack's kind or publisher, or
   * removes placed items. */
  held?: { reason: "kind" | "publisher" | "removes_placed"; from?: string; to?: string; items?: string[] };
  error?: string;
}

/** A placed item whose pack has a newer release than the plan's copy. */
export interface PlacedUpdate {
  /** The furniture type, "pack:<pack id>:<item id>". */
  type: string;
  pack: string;
  item: string;
  name: Record<string, string>;
  /** The release of the plan's copy and of the installed item. */
  release: number;
  new_release: number;
  /** The new release's one line on what it changed (#288), when the pack gave one. */
  note?: string;
  /** How often it is placed. */
  placed: number;
  pinned: boolean;
}

export interface PackUpdateStatus {
  settings: PackUpdateSettings;
  last_check: number | null;
  /** GitHub limited the requests: no check asks it before this time (#377); null or missing: no wait. */
  backoff_until?: number | null;
  packs: PackUpdateState[];
  items: PlacedUpdate[];
}

/** The refusals that are questions: an older release than the installed one, another release of a pinned pack, a
 * pack that takes the place of one that comes with Home 3D or of one of its own packs from elsewhere (#372), the
 * installed release with other content or from another place (#373). */
export const CONFIRM_CODES = ["older_release", "pinned", "replaces_bundled", "replaces_official", "same_release"] as const;
export type ConfirmCode = (typeof CONFIRM_CODES)[number];

/**
 * Sends an import or install; when the backend asks first (an older release, a pinned pack), asks the user and sends
 * it again confirmed. Null when the user said no; any other refusal is thrown.
 */
export async function askingFirst<T>(
  send: (confirm: boolean) => Promise<T>,
  ask: (code: ConfirmCode, message: string) => boolean | Promise<boolean>,
): Promise<T | null> {
  try {
    return await send(false);
  } catch (err) {
    const { code, message } = (err ?? {}) as { code?: string; message?: string };
    if (!CONFIRM_CODES.includes(code as ConfirmCode)) throw err;
    if (!(await ask(code as ConfirmCode, message ?? ""))) return null;
    return send(true);
  }
}

/** The furniture types of placed items with an update, for the library's cards (#48); a pinned pack's are left out. */
export function libraryUpdates(status: PackUpdateStatus | null): Set<string> {
  return new Set((status?.items ?? []).filter((i) => !i.pinned).map((i) => i.type));
}

/** Two sets with the same members (#391: the same updates again are no new state, no render). */
export function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/** The updates a library card offers: of its items (all variants of a family), to editors only. */
export function updatesOnCard(types: readonly string[], updates: ReadonlySet<string>, editor: boolean): string[] {
  return editor ? types.filter((t) => updates.has(t)) : [];
}

/** The placed items with an update (not counting pinned packs), the pinned ones, and how many placements wait. */
export function updateSummary(status: PackUpdateStatus): { updates: number; pinned: number; placed: number } {
  const open = status.items.filter((i) => !i.pinned);
  return { updates: open.length, pinned: status.items.length - open.length, placed: open.reduce((s, i) => s + i.placed, 0) };
}

/** When the next scheduled check runs (local time), null when checks are off. */
export function nextCheck(settings: PackUpdateSettings, now: Date = new Date()): Date | null {
  if (settings.frequency === "off") return null;
  const [hour, minute] = settings.time.split(":").map(Number);
  for (let day = 0; day <= 62; day++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, minute);
    if (at <= now) continue;
    // JavaScript counts Sunday as 0; the setting counts Monday as 0 (like Python)
    if (settings.frequency === "weekly" && (at.getDay() + 6) % 7 !== settings.weekday) continue;
    if (settings.frequency === "monthly" && at.getDate() !== 1) continue;
    return at;
  }
  return null;
}

/** One item in a preview: its id and name map. */
export interface PreviewItem {
  id: string;
  name: Record<string, string>;
}

/** What installing a pack release from GitHub would change (#189; backend pack_preview.py). Nothing is installed yet. */
export interface PackPreview {
  /** `kind`, `language`, `texts`: a language pack (#196), whose `changes` are its text keys. */
  pack: { id: string; name: string; publisher: string; licence: string; release: number; note?: string; items: number; kind?: "language"; language?: string; texts?: number };
  /** Where it comes from; `commit` is the pin: the install insists on exactly this commit. */
  origin: { url: string; owner: string; repo: string; ref: string; folder: string; commit: string; default_branch: boolean };
  /** The pack the library offers now under this id, null when it is new. */
  installed: { release: number; publisher: string | null; bundled: boolean; pinned: boolean; commit: string | null } | null;
  changes: { added: PreviewItem[]; changed: PreviewItem[]; removed: PreviewItem[]; unchanged: number };
  /** Codes the page words: "older_release", "pinned", "replaces_bundled", "replaces_official", "bundled_publisher". */
  warnings: string[];
}

/** A commit as shown to people: the first seven characters. */
export function shortCommit(commit: string | null | undefined): string {
  return commit ? commit.slice(0, 7) : "";
}

/** The name of an item or pack-item name map in a language, falling back to English, any name, then the id. */
export function previewName(item: PreviewItem, language: string): string {
  return item.name[language.split("-")[0]] ?? item.name.en ?? Object.values(item.name)[0] ?? item.id;
}

/** Whether a preview changes anything in an installed pack's items (a new release may only change the pack's text). */
export function changesNothing(preview: PackPreview): boolean {
  const c = preview.changes;
  return !c.added.length && !c.changed.length && !c.removed.length;
}
