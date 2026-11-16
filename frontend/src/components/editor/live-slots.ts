// The item panel's Live parts section (#466): one entity picker per slot of a pack item whose parts move or light with
// Home Assistant (a door's contact, a drawer, a drum, a level, a status light). An item with one slot offers its own
// entity as the automatic choice, and only when that entity is of a kind the slot takes (live-parts.ts slotEntity).
// Ported from NeonPlan 3D 3.4.0 (MIT, Mastershort).

import { html, nothing } from "lit";
import type { I18nKey } from "../../i18n.ts";
import type { Furniture } from "../../model.ts";
import { packItem } from "../../packs.ts";
import { itemSlots, slotDomains, slotEntity, type PackSlot } from "../../live-parts.ts";
import type { Fp3dEditor } from "../editor.ts";

/** A slot's name for its picker: the pack's own in the language, else its kind's, else its id. */
export function slotLabel(slot: PackSlot, language: string, t: (key: I18nKey) => string): string {
  const own = slot.name?.[language.split("-")[0]] ?? slot.name?.en ?? (slot.name ? Object.values(slot.name)[0] : undefined);
  if (own) return own;
  return slot.kind ? t(`live_slot_${slot.kind}` as I18nKey) : slot.id.replace(/_/g, " ");
}

/** The section, under the item's main links; nothing for an item without slots. */
export function renderLiveSlots(ed: Fp3dEditor, f: Furniture) {
  if (!ed.hass || !f.type.startsWith("pack:")) return nothing;
  const slots = itemSlots(packItem(f.type));
  if (!slots.length) return nothing;
  const language = ed.hass.language ?? "en";
  const own = f.entity === "none" ? null : (f.entity ?? ed.autoFurnitureLink(f, "entity"));
  const t = (key: I18nKey) => ed.t(key);
  return html`<section class="fp3d-link-block fp3d-live-slots" aria-labelledby="fp3d-live-h">
    <div class="fp3d-h3row"><h3 id="fp3d-live-h"><span aria-hidden="true">✨</span> ${ed.t("live_title")}</h3></div>
    <div class="fp3d-form fp3d-links">
      ${slots.map((slot) => {
        const domains = slotDomains(slot);
        const options = ed.entityOptions(domains.length ? (id: string) => domains.includes(id.slice(0, id.indexOf("."))) : () => true, domains.join(","));
        // one slot: the item's own entity is the automatic choice when it fits; several slots: each its own
        const auto = slots.length === 1 ? slotEntity(null, slot.id, 1, own, domains) : undefined;
        return ed.entitySelect(slotLabel(slot, language, t), f.binds?.[slot.id] ?? null, auto, options, (v) => {
          const next = { ...(f.binds ?? {}) };
          // automatic (null) or, with several slots, none: no link of its own; one slot keeps "none" (not even its own)
          if (v && (v !== "none" || slots.length === 1)) next[slot.id] = v;
          else delete next[slot.id];
          ed.updateFurniture({ binds: Object.keys(next).length ? next : null });
        }, domains);
      })}
      <p class="fp3d-sub fp3d-wide">${ed.t("live_hint")}${slots.length === 1 ? ` ${ed.t("live_own")}` : ""}</p>
    </div>
  </section>`;
}
