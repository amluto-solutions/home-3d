// The item editor's bundle (#13): loaded only when an editor opens the item editor.

import { ItemEditor, type ItemEditorOptions } from "./item-editor.ts";
import { focusScheme, hostScheme } from "../components/ask-dialog.ts";

export type { ItemEditorOptions };

/** Open the item editor over the page; `t` is the panel's translate (the item editor's ie_ texts are in the main table and the language packs). */
export function openItemEditor(options: ItemEditorOptions): void {
  document.querySelector("fp3d-item-editor")?.remove();
  const el = document.createElement("fp3d-item-editor") as ItemEditor;
  el.options = options;
  // it sits on the page, outside the panel, so it copies the look of the screen that opened it (#420, CONS-7)
  const scheme = hostScheme(options.from) ?? focusScheme();
  el.toggleAttribute("light", scheme === "light");
  el.toggleAttribute("contrast", scheme === "contrast");
  document.body.append(el);
}
