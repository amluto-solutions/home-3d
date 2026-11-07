// The pack index (#336): the curated list of packs the Library's Browse tab offers. Home Assistant fetches it from
// GitHub (custom_components/home_3d/pack_index.py), never the browser; this file holds its shape and the rules the
// Browse tab follows (search, filters, what a pack's button does). Loaded with the Browse tab only.

import type { FurniturePack, PackItem } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";

/** One listed pack. `url` is its GitHub URL: Install and Update go through the install-by-URL path (#25). */
export interface IndexPack {
  id: string;
  name: string;
  description: string;
  publisher: string;
  licence: string;
  release: number;
  release_note?: string;
  url: string;
  /** Ours, or added by pull request. */
  source: "official" | "community";
  kind: "furniture" | "language";
  language?: string;
  items: number;
  texts?: number;
  /** Item group -> how many items of it. */
  categories: Record<string, number>;
  /** The preview whose picture stands for the pack. */
  thumbnail?: string;
  /** A few whole items, drawn before the pack is installed. */
  previews: PackItem[];
}

export interface PackIndex {
  url: string;
  fetched_at: number;
  packs: IndexPack[];
  /** A refresh failed: this is the copy Home Assistant kept. */
  stale?: boolean;
  error?: string;
}

/** The category of a language pack (its items are texts). */
export const LANGUAGE_CATEGORY = "language";

let kept: PackIndex | null = null;

/**
 * The index, kept for this page once fetched (Home Assistant keeps it for a few hours as well); `refresh` asks
 * GitHub again. Throws when there is none (offline: code "offline").
 */
export async function loadPackIndex(hass: HomeAssistant, refresh = false): Promise<PackIndex> {
  if (kept && !refresh) return kept;
  const index = await hass.callWS<PackIndex>({ type: "home_3d/packs/index", ...(refresh ? { refresh } : {}) });
  kept = index;
  return index;
}

/** Forgets the page's copy (tests). */
export function forgetPackIndex(): void {
  kept = null;
}

/** What a listed pack is here: not installed, installed, or installed with a newer release listed. */
export type PackState = "available" | "installed" | "update";

export interface PackStatus {
  state: PackState;
  /** The release installed, null when it is not. */
  installed: number | null;
  /** An imported copy that can be removed (a pack that ships with Home 3D stays). */
  removable: boolean;
}

export function packStatus(entry: Pick<IndexPack, "id" | "release">, installed: readonly FurniturePack[]): PackStatus {
  const pack = installed.find((p) => p.id === entry.id);
  if (!pack) return { state: "available", installed: null, removable: false };
  const release = pack.release ?? 1;
  return { state: release < entry.release ? "update" : "installed", installed: release, removable: !pack.bundled };
}

/** The categories of a pack: its item groups, the most items first, or "language". */
export function categoriesOf(entry: Pick<IndexPack, "kind" | "categories">): string[] {
  if (entry.kind === "language") return [LANGUAGE_CATEGORY];
  return Object.entries(entry.categories)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([c]) => c);
}

/** Every category in the index, the most items first. */
export function allCategories(packs: readonly IndexPack[]): string[] {
  const count = new Map<string, number>();
  for (const p of packs) {
    if (p.kind === "language") count.set(LANGUAGE_CATEGORY, (count.get(LANGUAGE_CATEGORY) ?? 0) + 1);
    else for (const [c, n] of Object.entries(p.categories)) count.set(c, (count.get(c) ?? 0) + n);
  }
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
}

/** Every publisher in the index, A to Z. */
export function allPublishers(packs: readonly IndexPack[]): string[] {
  return [...new Set(packs.map((p) => p.publisher))].sort((a, b) => a.localeCompare(b));
}

export interface BrowseFilter {
  query: string;
  category: string | null;
  publisher: string | null;
}

/**
 * The packs a search and the filters leave: every word of the query in the name, description, publisher, id or a
 * category label. Packs with an update come first, then the others as listed.
 */
export function browsePacks(packs: readonly IndexPack[], filter: BrowseFilter, installed: readonly FurniturePack[], label: (category: string) => string = (c) => c): IndexPack[] {
  const words = filter.query.toLowerCase().split(/\s+/).filter(Boolean);
  const found = packs.filter((p) => {
    if (filter.publisher && p.publisher !== filter.publisher) return false;
    const categories = categoriesOf(p);
    if (filter.category && !categories.includes(filter.category)) return false;
    if (!words.length) return true;
    const text = [p.name, p.description, p.publisher, p.id, ...categories.map(label)].join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
  const rank = (p: IndexPack) => (packStatus(p, installed).state === "update" ? 0 : 1);
  return found.map((p, i) => [p, i] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([p]) => p);
}

/** How many listed packs have a newer release than the one installed (the tab's badge). */
export function updateCount(packs: readonly IndexPack[], installed: readonly FurniturePack[]): number {
  return packs.filter((p) => packStatus(p, installed).state === "update").length;
}
