// Websocket calls to the backend (custom_components/home_3d/websocket.py).

import type { EditorUser } from "./editors.ts";
import type { Building } from "./model.ts";
import type { PackPreview, PackUpdateSettings, PackUpdateStatus } from "./pack-updates.ts";
import type { FurniturePack, PackItem, PackOrigin, PlanRecipe } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";
import { checkFits } from "./ws-size.ts";

/** A home (#53) a call is about: left out, the active one (a backend from before #53 has only that). */
const at = (home?: string | null): { home_id?: string } => (home ? { home_id: home } : {});

/**
 * The websocket protocol this frontend speaks (#166): the backend's const.PROTOCOL of the same release. building/get and
 * version report the backend's (none: an older backend, before #166); gate a newer command on it in one place
 * (BuildingController.speaks) instead of trying it and falling back. contract.test.ts checks every command and field
 * used here against tests/fixtures/contract/websocket.json.
 */
export const PROTOCOL = 5;

/** `can_edit`: the user is on the editors list (missing from backends before #7). `home_id`: the home loaded (#53;
 * missing from older backends), the one to save back to. */
/** What is wrong with a home's stored plan (#165): "plan_repaired" (invalid parts left out, named in `dropped`), or one
 * the backend cannot read, shown read-only: "plan_invalid", "plan_too_new" (of a newer Home 3D). */
export interface PlanProblem {
  code: "plan_repaired" | "plan_invalid" | "plan_too_new";
  message: string;
  dropped?: string[];
}

export async function fetchBuilding(
  hass: HomeAssistant,
  home?: string | null,
): Promise<{ building: Building; revision: number; version?: string; protocol?: number; build?: string; can_edit?: boolean; home_id?: string; home_name?: string; problem?: PlanProblem }> {
  return hass.callWS({ type: "home_3d/building/get", ...at(home) });
}

/** The integration version the backend runs and the frontend build it serves now (#60). */
export async function fetchVersion(hass: HomeAssistant): Promise<{ version?: string; protocol?: number; build?: string }> {
  return hass.callWS({ type: "home_3d/version" });
}

/** Save the plan; the backend answers with its revision and the plan's recipe copies as stored (#2). */
/** `recipeBases`: the hashes of the plan's recipe copies as this editor got them (#45), so the backend keeps a copy
 * changed on the server since instead of the older one sent back unchanged. `baseRevision` (#149): the revision the
 * plan started from; when someone else changed the plan since, the save is refused with the error code "conflict". */
export async function saveBuilding(
  hass: HomeAssistant,
  building: Building,
  recipeBases?: Record<string, string>,
  home?: string | null,
  baseRevision?: number,
): Promise<{ revision: number; recipes?: Record<string, PlanRecipe> }> {
  return hass.callWS<{ revision: number; recipes?: Record<string, PlanRecipe> }>({
    type: "home_3d/building/save",
    ...at(home),
    building,
    ...(recipeBases ? { recipe_bases: recipeBases } : {}),
    ...(baseRevision !== undefined ? { base_revision: baseRevision } : {}),
  });
}

/** Follow a home's revision (#53: without a home, the active one; `home_id` says which home an event is about). */
export function subscribeBuilding(
  hass: HomeAssistant,
  callback: (revision: number, home?: string) => void,
  home?: string | null,
): Promise<() => Promise<void>> {
  return hass.connection.subscribeMessage<{ revision: number; home_id?: string }>((msg) => callback(msg.revision, msg.home_id), {
    type: "home_3d/building/subscribe",
    ...at(home),
  });
}

/** A sentence Assist or the service `home_3d.ask` hands to the open views. */
export interface Ask {
  ask_id: string;
  text: string;
  /** Only the view with this screen name reacts (null: every open view). */
  screen: string | null;
  /** The view speaks its answer (a satellite that asked speaks itself). */
  speak: boolean;
  /** Plan rooms to fly into instead of a sentence ("Where is Alex?": their room; "Who is home?": a tour). */
  show_rooms?: string[];
  /** The rooms are people's while people are shown to admins only: the server sends them to admins' views only (#367). */
  admins_only?: boolean;
}

/** `screen`: the view's screen name ("" none): a sentence for one screen reaches only the views of that name (#366). */
export function subscribeAsk(hass: HomeAssistant, screen: string, callback: (ask: Ask) => void): Promise<() => Promise<void>> {
  return hass.connection.subscribeMessage<Ask>(callback, { type: "home_3d/voice/subscribe", screen });
}

/** The view's answer; `taken` is false when another view understood first (or the asker waits no longer). */
export async function answerAsk(hass: HomeAssistant, askId: string, text: string, answered: boolean): Promise<boolean> {
  const res = await hass.callWS<{ taken: boolean }>({ type: "home_3d/voice/answer", ask_id: askId, text, answered });
  return res.taken;
}

export async function fetchImage(hass: HomeAssistant, imageId: string, home?: string | null): Promise<string> {
  const res = await hass.callWS<{ data: string }>({ type: "home_3d/image/get", ...at(home), image_id: imageId });
  return res.data;
}

export async function storeImage(hass: HomeAssistant, imageId: string, data: string, home?: string | null): Promise<void> {
  await hass.callWS({ type: "home_3d/image/set", ...at(home), image_id: imageId, data });
}

export interface Snapshot {
  id: string;
  revision: number;
  /** Unix time in seconds. */
  saved_at: number;
  floors: number;
  rooms: number;
  furniture: number;
  /** Bytes of the saved plan (#240); absent from a server before it was sent. */
  size?: number;
  /** How many stored pictures it names are no longer kept (#154): it restores without them. */
  missing_pictures?: number;
}

export async function listHistory(hass: HomeAssistant, home?: string | null): Promise<Snapshot[]> {
  const res = await hass.callWS<{ snapshots: Snapshot[] }>({ type: "home_3d/history/list", ...at(home) });
  return res.snapshots;
}

export async function takeSnapshot(hass: HomeAssistant, home?: string | null): Promise<void> {
  await hass.callWS({ type: "home_3d/history/snapshot", ...at(home) });
}

/** Go back to a restore point; `missing_pictures` (#154): how many of its pictures were no longer kept. */
export async function restoreSnapshot(hass: HomeAssistant, snapshotId: string, home?: string | null): Promise<{ revision: number; missing_pictures?: number }> {
  return hass.callWS<{ revision: number; missing_pictures?: number }>({ type: "home_3d/history/restore", ...at(home), snapshot_id: snapshotId });
}

/** A home of the install (#53), as the switcher lists it. */
export interface HomeInfo {
  id: string;
  name: string;
  revision: number;
  floors: number;
  rooms: number;
  furniture: number;
}

/** Every home and which one is active (editors only, like the calls below). */
export interface HomesList {
  homes: HomeInfo[];
  active: string;
}

export function listHomes(hass: HomeAssistant): Promise<HomesList> {
  return hass.callWS({ type: "home_3d/homes/list" });
}

/** How a home is created: `areaImport: false` for a sample or template home (#61), which never offers to add rooms
 * from this install's Home Assistant areas. */
export interface CreateHomeOptions {
  areaImport?: boolean;
}

/** Add an empty home; it does not become active. */
export function createHome(hass: HomeAssistant, name: string, options: CreateHomeOptions = {}): Promise<HomesList & { home: HomeInfo }> {
  return hass.callWS({ type: "home_3d/homes/create", name, ...(options.areaImport === false ? { area_import: false } : {}) });
}

/** Add the sample home (#54) as a new home of its own: a demo home (#100) with placeholder devices; no home is
 * overwritten and the active home stays as it is. */
export function loadSampleHome(hass: HomeAssistant): Promise<HomesList & { home: HomeInfo }> {
  return hass.callWS({ type: "home_3d/homes/load_sample" });
}

export function renameHome(hass: HomeAssistant, home: string, name: string): Promise<HomesList> {
  return hass.callWS({ type: "home_3d/homes/rename", home_id: home, name });
}

/** Add a home with a copy of another's plan and pictures. */
export function duplicateHome(hass: HomeAssistant, home: string, name: string): Promise<HomesList & { home: HomeInfo }> {
  return hass.callWS({ type: "home_3d/homes/duplicate", home_id: home, name });
}

/** Remove a home with its plan, restore points and pictures (the last one is refused: "last_home"). */
export function deleteHome(hass: HomeAssistant, home: string): Promise<HomesList> {
  return hass.callWS({ type: "home_3d/homes/delete", home_id: home });
}

/** Make a home the active one: the panel and the cards without a home of their own follow. */
export function setActiveHome(hass: HomeAssistant, home: string): Promise<HomesList> {
  return hass.callWS({ type: "home_3d/homes/set_active", home_id: home });
}

/** The library: every offered pack with an index of its items, without their recipes (#44). */
export async function listPacks(hass: HomeAssistant): Promise<FurniturePack[]> {
  const res = await hass.callWS<{ packs: FurniturePack[] }>({ type: "home_3d/packs/list" });
  return res.packs;
}

export interface PackRecipes {
  pack_id: string;
  release: number;
  /** The pack's hash, as the list gave it while these recipes are current. */
  hash: string;
  items: PackItem[];
}

/** The recipes of some items of a pack (#44); ids it does not have are left out. */
export async function fetchPackRecipes(hass: HomeAssistant, packId: string, itemIds: string[]): Promise<PackRecipes> {
  return hass.callWS<PackRecipes>({ type: "home_3d/packs/items", pack_id: packId, items: itemIds });
}

export interface ImportedPack {
  id: string;
  name: string;
  publisher: string;
  /** The licence the pack declares; null for an old single-file pack. */
  licence: string | null;
  items: number;
  /** A language pack (#196): its language and how many texts it has. */
  kind?: "language";
  language?: string;
  texts?: number;
}


/**
 * Import an old single-file pack; the backend checks its content (errors carry a code, e.g. "invalid_content"). An
 * older release than the installed one, or another release of a pinned pack, is refused ("older_release", "pinned")
 * unless `confirm` (#26; see askingFirst in pack-updates.ts).
 */
export async function importPack(hass: HomeAssistant, text: string, confirm = false): Promise<ImportedPack> {
  const msg = { type: "home_3d/packs/import", pack: text, ...(confirm ? { confirm } : {}) };
  // a message Home Assistant can't take would drop the connection: refused here as too large (#375)
  checkFits(msg);
  return hass.callWS<ImportedPack>(msg);
}

/** Import a v2 pack folder (path inside the folder -> file text); the backend checks every file. */
export async function importPackFolder(hass: HomeAssistant, files: Record<string, string>, confirm = false): Promise<ImportedPack> {
  const msg = { type: "home_3d/packs/import", files, ...(confirm ? { confirm } : {}) };
  checkFits(msg);
  return hass.callWS<ImportedPack>(msg);
}

/**
 * Install a pack from a GitHub URL (a repo, or a pack folder in one); Home Assistant fetches and checks it (#25).
 * With `commit` (from a preview, #189) it is refused unless the ref still points at that commit; with `packId` (an
 * index entry's, #372) unless the URL holds that pack ("id_mismatch").
 */
export async function installPackFromUrl(
  hass: HomeAssistant,
  url: string,
  confirm = false,
  commit?: string,
  packId?: string,
): Promise<ImportedPack & { origin: PackOrigin }> {
  return hass.callWS<ImportedPack & { origin: PackOrigin }>({
    type: "home_3d/packs/install_url",
    url,
    ...(confirm ? { confirm } : {}),
    ...(commit ? { commit } : {}),
    ...(packId ? { pack_id: packId } : {}),
  });
}

/** What installing the pack at a GitHub URL (or updating to it) would change; nothing is installed (#189). */
export function previewPackFromUrl(hass: HomeAssistant, url: string, packId?: string): Promise<PackPreview> {
  return hass.callWS<PackPreview>({ type: "home_3d/packs/preview_url", url, ...(packId ? { pack_id: packId } : {}) });
}

/** Pack updates (#26): the settings, the installed packs and the placed items with an update. */
export function fetchPackUpdates(hass: HomeAssistant): Promise<PackUpdateStatus> {
  return hass.callWS<PackUpdateStatus>({ type: "home_3d/packs/updates" });
}

/** Change the update settings (editors); switching auto-update on applies the waiting updates. */
export function setPackUpdateSettings(hass: HomeAssistant, changes: Partial<PackUpdateSettings>): Promise<PackUpdateStatus> {
  return hass.callWS<PackUpdateStatus>({ type: "home_3d/packs/updates/settings", ...changes });
}

/** Update placed items to the installed release of their pack (all with an update when no types are named). */
export function updatePlacedItems(hass: HomeAssistant, types?: string[]): Promise<{ updated: string[]; revision: number }> {
  return hass.callWS({ type: "home_3d/packs/update_items", ...(types ? { types } : {}) });
}

/** Check the packs installed from GitHub now; names the packs that got a new release. */
export function checkPacks(hass: HomeAssistant): Promise<PackUpdateStatus & { installed: string[]; updated: string[] }> {
  return hass.callWS({ type: "home_3d/packs/check" });
}

/** Pin a pack to its installed release, or unpin it. */
export function pinPack(hass: HomeAssistant, packId: string, pinned: boolean): Promise<PackUpdateStatus> {
  return hass.callWS<PackUpdateStatus>({ type: "home_3d/packs/pin", pack_id: packId, pinned });
}

/** Put back the release a pack had before its last update (the pack is pinned to it). */
export function rollbackPack(hass: HomeAssistant, packId: string): Promise<PackUpdateStatus & { release: number }> {
  return hass.callWS({ type: "home_3d/packs/rollback", pack_id: packId });
}

export async function removePack(hass: HomeAssistant, packId: string): Promise<void> {
  await hass.callWS({ type: "home_3d/packs/remove", pack_id: packId });
}

/** A home in a backup file (#53), with its own pictures. */
export interface BackupHome {
  id: string;
  name: string;
  building: Building;
  images?: Record<string, string>;
}

/** A full backup file: the plans, the packs and every stored picture. */
export interface BackupFile {
  format: "home3d-backup";
  version: 1;
  exported_at?: string;
  /** The active home's plan (the only one in backups from before #53). */
  building: Building;
  /** Every home (#53); `images` at the top are the active home's then. */
  homes?: BackupHome[];
  active?: string;
  packs?: FurniturePack[];
  /** The household's own items (#13); missing in backups from before them. */
  items?: PackItem[];
  images?: Record<string, string>;
}

export function fetchBackup(hass: HomeAssistant): Promise<Pick<BackupFile, "format" | "version" | "building" | "homes" | "active" | "packs" | "items">> {
  return hass.callWS({ type: "home_3d/backup/export" });
}


export type SentenceMode = "distinct" | "all" | "off";

/** Which sentences Assist hands to Home 3D (the sentence files Home Assistant reads). */
export async function getVoiceSettings(hass: HomeAssistant): Promise<{ sentences: SentenceMode }> {
  return hass.callWS({ type: "home_3d/voice/settings" });
}

export async function setVoiceSentences(hass: HomeAssistant, sentences: SentenceMode): Promise<{ sentences: SentenceMode; kept?: string[] }> {
  return hass.callWS({ type: "home_3d/voice/settings/set", sentences });
}

/** Everyone who signs in and whether they are on the editors list (#7; admins only). `custom` is false while
 * the list is the default: every admin. */
export function getEditors(hass: HomeAssistant): Promise<{ users: EditorUser[]; custom: boolean }> {
  return hass.callWS({ type: "home_3d/editors/get" });
}

/** Pick the editors (null: every admin again). A list without an admin is refused ("no_admin"). */
export function setEditors(hass: HomeAssistant, editors: string[] | null): Promise<{ users: EditorUser[]; custom: boolean }> {
  return hass.callWS({ type: "home_3d/editors/set", editors });
}

/** Keep an item made in the item editor (#13); the backend checks it like a pack's item and returns it checked.
 * An item with the same id is replaced. Editors only. */
export async function saveCustomItem(hass: HomeAssistant, item: PackItem): Promise<PackItem> {
  const res = await hass.callWS<{ item: PackItem }>({ type: "home_3d/items/save", item });
  return res.item;
}

/** Remove a custom item (placed copies stay in the plan and keep their recipe copy). */
export async function removeCustomItem(hass: HomeAssistant, itemId: string): Promise<void> {
  await hass.callWS({ type: "home_3d/items/remove", item_id: itemId });
}
