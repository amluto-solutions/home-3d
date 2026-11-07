// What the editor's '?' help shows (#95): the keyboard shortcuts and a legend of the plan's marks. Both are tables, so
// a new shortcut (copy and paste, #74) is one more row here and shows up in the overlay by itself.

import { CLIPBOARD_SHORTCUTS } from "./clipboard.ts";
import type { I18nKey } from "./i18n.ts";

/** Where a problem is reported (the help overlay and the Extensions page); here, not in the lazy extensions.ts (#245). */
export const ISSUES_URL = "https://github.com/amluto-solutions/home-3d/issues";

export interface Shortcut {
  /** The keys as printed, one group per alternative ("Ctrl+Y" or "Ctrl+Shift+Z"). */
  keys: string[];
  text: I18nKey;
}

/** The editor's shortcuts, in the order the overlay lists them. */
export const SHORTCUTS: Shortcut[] = [
  { keys: ["Ctrl+Z"], text: "help_key_undo" },
  { keys: ["Ctrl+Y", "Ctrl+Shift+Z"], text: "help_key_redo" },
  { keys: ["Ctrl+D"], text: "help_key_duplicate" },
  // copy, paste and select-all (#74)
  ...CLIPBOARD_SHORTCUTS,
  { keys: ["Del", "Backspace"], text: "help_key_delete" },
  { keys: ["←↑→↓"], text: "help_key_nudge" },
  { keys: ["R", "Shift+R"], text: "help_key_rotate" },
  { keys: ["L"], text: "help_key_lock" },
  { keys: ["Shift+click"], text: "help_key_multi" },
  // Alt is also "move freely" while dragging (help_key_snap): only a click without moving goes through (#75, #125)
  { keys: ["Alt+click"], text: "help_key_pick_through" },
  { keys: ["Enter"], text: "help_key_close_shape" },
  { keys: ["Esc"], text: "help_key_escape" },
  { keys: ["Shift", "Alt"], text: "help_key_snap" },
  { keys: ["?"], text: "help_key_help" },
];

/** The plan's marks that need explaining; `mark` picks the little drawing beside the text. */
export const LEGEND: { mark: "swing" | "track" | "guide" | "snap" | "ghost" | "selected"; text: I18nKey }[] = [
  { mark: "swing", text: "help_legend_swing" },
  { mark: "track", text: "help_legend_track" },
  { mark: "guide", text: "help_legend_guide" },
  { mark: "snap", text: "help_legend_snap" },
  { mark: "ghost", text: "help_legend_ghost" },
  { mark: "selected", text: "help_legend_selected" },
];

/** The key that opens the help: '?' (Shift+/ on most layouts), never with Ctrl, Cmd or Alt. */
export function isHelpKey(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">): boolean {
  return e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey;
}
