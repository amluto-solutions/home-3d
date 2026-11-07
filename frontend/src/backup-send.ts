// Restoring a backup (#153, #375): the backup page loads this when a backup file is picked, so no page carries the
// parts and sizes of a large backup before.

import type { BackupHome } from "./api.ts";
import type { Building } from "./model.ts";
import type { FurniturePack, PackItem } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";
import { checkFits, messageBytes, MESSAGE_ROOM, sizeError } from "./ws-size.ts";

const at = (home?: string | null): { home_id?: string } => (home ? { home_id: home } : {});

/** Replace plan and packs (and the custom items, when the backup has them) from a backup (pictures follow one by
 * one); packs and items that fail their check are skipped. With `homes` (#53) every home in the backup is restored
 * (onto the home with its id, or added) and `building` may be null; without, `building` replaces the plan of `home`
 * (default: the active one). */
/** Restore (a part of) a backup. Packs and custom items left out stay as they are; the ones given are restored onto
 * the installed ones with the same id (#153). A failure undoes the part and is the error "restore_failed". */
export function restoreBackup(
  hass: HomeAssistant,
  building: Building | null,
  packs?: FurniturePack[],
  items?: PackItem[],
  homes?: { homes: Omit<BackupHome, "images">[]; active?: string },
  home?: string | null,
): Promise<{ revision: number; building: Building; home_id?: string; packs: number; items?: number; skipped: { id: string; reason: string }[]; renamed?: { id: string; as: string }[] }> {
  return backupCall(hass, { type: "home_3d/backup/import", ...at(home), ...(building ? { building } : {}), ...(items ? { items } : {}), ...(homes ?? {}) }, packs);
}

/** Check (a part of) a backup without restoring anything (#153); throws "invalid_format" for one that would fail. */
export function checkBackup(
  hass: HomeAssistant,
  building: Building | null,
  packs?: FurniturePack[],
  items?: PackItem[],
  homes?: { homes: Omit<BackupHome, "images">[] },
  home?: string | null,
): Promise<{ checked: boolean; skipped: { id: string; reason: string }[] }> {
  return backupCall(hass, { type: "home_3d/backup/import", check_only: true, ...at(home), ...(building ? { building } : {}), ...(items ? { items } : {}), ...(homes ?? {}) }, packs);
}

/**
 * A backup import with its packs (#375). The backend checks a pack again from its source alone, so only the id and the
 * source are sent. When they don't fit in one message with the rest, they go ahead in parts (`backup/stage`) and the
 * import names them; a single pack or a plan too large for a message is refused ("backup_too_large").
 */
async function backupCall<T>(hass: HomeAssistant, msg: Record<string, unknown>, packs?: FurniturePack[]): Promise<T> {
  const sent = packs?.map((p) => ({ id: p.id, source: (p as { source?: unknown }).source }));
  let message: Record<string, unknown> = sent ? { ...msg, packs: sent } : msg;
  if (sent?.length && messageBytes(message) > MESSAGE_ROOM) {
    const split = inParts(sent, MESSAGE_ROOM - messageBytes({ type: "home_3d/backup/stage", packs: [], token: "0".repeat(64) }));
    if ("tooLarge" in split) throw sizeError("backup_too_large", `${split.tooLarge.id}: ${split.bytes} bytes, at most ${MESSAGE_ROOM}`);
    let token: string | undefined;
    for (const part of split.parts) token = (await hass.callWS<{ token: string }>({ type: "home_3d/backup/stage", packs: part, ...(token ? { token } : {}) })).token;
    message = { ...msg, staged: token };
  }
  checkFits(message, "backup_too_large");
  return hass.callWS<T>(message);
}

/** Items split into parts whose JSON fits in `room` bytes each, in order; the first item too large on its own when one
 * is. */
export function inParts<T>(items: readonly T[], room: number): { parts: T[][] } | { tooLarge: T; bytes: number } {
  const parts: T[][] = [[]];
  let used = 2;
  for (const item of items) {
    const bytes = messageBytes(item) + 1;
    if (bytes + 2 > room) return { tooLarge: item, bytes };
    if (used + bytes > room) {
      parts.push([]);
      used = 2;
    }
    parts[parts.length - 1].push(item);
    used += bytes;
  }
  return { parts: parts.filter((p) => p.length) };
}
