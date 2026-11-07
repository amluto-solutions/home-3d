// Robot vacuum maps in the editor (#350): where the editor draws the lazy elements of components/vacuum-panel.ts (the
// floor's Vacuum maps section and, while a map is aligned, its picture over the plan). Kept tiny: the editor's first
// paint carries only this; the section shows once Home Assistant has a map camera (one with calibration points) or the
// plan has a map.

import { html, nothing } from "lit";
import type { Floor } from "../../model.ts";
import type { Fp3dEditor } from "../editor.ts";
import { loadVacuumPanel, need } from "./lazy.ts";

/** The floor's Vacuum maps section (admins), or (`plan`) the map being aligned over the plan of its floor. */
export function vacuumTag(ed: Fp3dEditor, floor: Floor | undefined, plan?: boolean) {
  const maps = ed._doc.settings.vacuum_maps;
  const id = ed._vacAlign;
  if (!floor || (plan ? !maps?.some((m) => m.id === id && m.floor_id === floor.id) : !maps?.length && !Object.values(ed.hass?.states ?? {}).some((s) => Array.isArray(s.attributes?.calibration_points)))) return nothing;
  need(loadVacuumPanel);
  return plan
    ? html`<fp3d-vacuum-plan .host=${ed} .view=${ed._view} .doc=${ed._doc} .hass=${ed.hass} .mapId=${id}></fp3d-vacuum-plan>`
    : html`<fp3d-vacuum-panel .host=${ed} .doc=${ed._doc} .floor=${floor} .hass=${ed.hass} .align=${id}></fp3d-vacuum-panel>`;
}
