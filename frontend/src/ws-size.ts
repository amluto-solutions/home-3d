// The size of a websocket message (#375). Home Assistant takes one of at most 4 MiB (custom_components/home_3d/
// packs.py MAX_MESSAGE_BYTES); a larger one drops the connection instead of answering. Imports and backups measure
// what they send first: a pack too large says so ("too_large"), and a backup's packs go ahead in parts
// (home_3d/backup/stage) when they don't fit with the rest.

/** The room in one message, in bytes: 4 MiB less what the message id and the connection add. */
export const MESSAGE_ROOM = 4 * 1024 * 1024 - 4096;

/** The bytes a message takes on the wire: its JSON in UTF-8. */
export const messageBytes = (msg: unknown): number => new TextEncoder().encode(JSON.stringify(msg)).length;

/** An error with a code, as a refused websocket call has. */
export const sizeError = (code: string, message: string): Error & { code: string } => Object.assign(new Error(message), { code });

/** Refuses a message that would not fit (`code`, before anything is sent). */
export function checkFits(msg: unknown, code = "too_large"): void {
  const bytes = messageBytes(msg);
  if (bytes > MESSAGE_ROOM) throw sizeError(code, `${bytes} bytes as sent, at most ${MESSAGE_ROOM}`);
}
