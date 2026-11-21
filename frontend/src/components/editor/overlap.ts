// The "rooms overlap" warning in the toolbar, with the rooms it means (#1195); a tap selects the first.

import { html } from "lit";
import { overlapInfo } from "../../overlap-rooms.ts";
import type { Floor } from "../../model.ts";
import type { Fp3dEditor } from "../editor.ts";

export function renderOverlap(ed: Fp3dEditor, floor: Floor | undefined, warnings: string[]) {
  const info = overlapInfo(floor?.rooms ?? [], warnings);
  const names = info.shown.length ? ` ${info.shown.join(", ")}${info.more > 0 ? ` +${info.more}` : ""}` : "";
  return html`<button class="fp3d-warn fp3d-warn-btn" title=${info.all} @click=${() => info.first && ed.selectItem("room", info.first)}>${ed.t("overlap_warning")}${names}</button>`;
}
