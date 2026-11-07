/** What the Escape key undoes in the editor, one step per press (#70). */

export interface EscapeState {
  /** The cursor is in one of the editor's boxes. */
  typing: boolean;
  /** The context menu is open. */
  menu: boolean;
  /** A library card is armed for placing with the next click (#76). */
  placing?: boolean;
  /** A pipe is being laid (pool). */
  pipeDraft: boolean;
  /** The pipe tool is on (pool). */
  pipeMode: boolean;
  /** A room or wall outline is being drawn. */
  drawing: boolean;
  /** An item, opening, device, outdoor area or free wall is chosen. */
  item: boolean;
  tool: string;
  /** A room is chosen. */
  room: boolean;
}

export type EscapeStep = "release" | "close_menu" | "cancel_place" | "cancel_pipe" | "end_pipe_mode" | "clear_draft" | "deselect_item" | "select_tool" | "deselect";

/**
 * The innermost thing first: the box with the cursor, a menu, an armed library card, a pipe or outline in progress, the chosen item (back
 * to the library or the room, the tool stays), the tool, and last the room.
 */
export function escapeStep(s: EscapeState): EscapeStep {
  if (s.typing) return "release";
  if (s.menu) return "close_menu";
  if (s.placing) return "cancel_place";
  if (s.pipeDraft) return "cancel_pipe";
  if (s.pipeMode) return "end_pipe_mode";
  if (s.drawing) return "clear_draft";
  if (s.item) return "deselect_item";
  if (s.tool !== "select") return "select_tool";
  return "deselect";
}
