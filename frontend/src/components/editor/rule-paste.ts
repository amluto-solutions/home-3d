// "Paste onto other items" (#540): from a rule block, the copied rule goes onto several chosen items at once, furniture
// and placed devices alike, on every floor (a multi-selection takes furniture of one floor only). A list with checkboxes,
// a search and "All lights"; one change, so one undo takes it back. Each item gets its own copy; "This item" stays
// relative and a fixed entity stays fixed. An item without an entity of its own cannot use a rule that asks "This item":
// it is marked in the list, left out and named. A chunk of its own, loaded when the button is first pressed.

import { html, nothing } from "lit";
import { isLamp, type Building, type ShowRule } from "../../model.ts";
import { entityName } from "../../devices.ts";
import { furnitureName } from "../../furniture-names.ts";
import { ruleNeedsSelf } from "../../rule-clip.ts";
import type { Fp3dEditor } from "../editor.ts";

/** One item the rule can go onto: furniture or a placed device on a floor. */
export interface PasteItem {
  /** "<floor id>|f|<furniture id>" or "<floor id>|p|<entity id>". */
  key: string;
  /** The block's own key ("f:<id>", "p:<entity>"): the item the rule was copied on is not offered. */
  own: string;
  name: string;
  floor: string;
  /** The entity "This item" means there (null: none). */
  self: string | null;
  light: boolean;
}

/** Every item of the plan, furniture first then the placed devices, floor by floor. */
export function pasteItems(doc: Building, name: { furniture: (type: string, own?: string | null) => string; entity: (id: string) => string }, selfOf: (f: Building["floors"][number]["furniture"][number]) => string | null): PasteItem[] {
  const out: PasteItem[] = [];
  for (const fl of doc.floors) {
    for (const f of fl.furniture) {
      const self = selfOf(f);
      out.push({ key: `${fl.id}|f|${f.id}`, own: `f:${f.id}`, name: f.name || name.furniture(f.type), floor: fl.name, self, light: isLamp(f.type) || !!self?.startsWith("light.") });
    }
    for (const p of fl.placements) out.push({ key: `${fl.id}|p|${p.entity_id}`, own: `p:${p.entity_id}`, name: p.name || name.entity(p.entity_id), floor: fl.name, self: p.entity_id, light: p.entity_id.startsWith("light.") });
  }
  return out;
}

/** The items a search shows: every word in the name, the floor or the entity. */
export function searchItems(items: PasteItem[], q: string): PasteItem[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return words.length ? items.filter((it) => words.every((w) => `${it.name} ${it.floor} ${it.self ?? ""}`.toLowerCase().includes(w))) : items;
}

/**
 * Puts a copy of `rule` onto the chosen items as their icon or card rule, in one change of `doc` (mutated). Returns the
 * items it went onto and the ones left out (no entity of their own for a rule that asks "This item").
 */
export function pasteOnto(doc: Building, items: PasteItem[], chosen: ReadonlySet<string>, rule: ShowRule, which: "icon" | "card"): { done: PasteItem[]; skipped: PasteItem[] } {
  const picked = items.filter((it) => chosen.has(it.key));
  const skipped = ruleNeedsSelf(rule) ? picked.filter((it) => !it.self) : [];
  const done = picked.filter((it) => !skipped.includes(it));
  const keys = new Set(done.map((it) => it.key));
  for (const fl of doc.floors) {
    for (const f of fl.furniture) if (keys.has(`${fl.id}|f|${f.id}`)) f.show_rules = { ...(f.show_rules ?? {}), [which]: structuredClone(rule) };
    for (const p of fl.placements) if (keys.has(`${fl.id}|p|${p.entity_id}`)) p.show_rules = { ...(p.show_rules ?? {}), [which]: structuredClone(rule) };
  }
  return { done, skipped };
}

/** What a picker keeps while it is open: the search and the ticked items. */
export interface PickState {
  q: string;
  chosen: Set<string>;
}

/** The picker's own look (the editor's first open does not carry it). */
const STYLE = html`<style>
.fp3d-rp { margin-top: 8px; display: grid; gap: 8px; }
.fp3d-rp-tools { display: flex; flex-wrap: wrap; gap: 6px; }
.fp3d-rp-list { max-height: min(50vh, 340px); overflow: auto; border: 1px solid var(--fp3d-line); border-radius: 8px; padding: 4px 0; }
.fp3d-rp-list label { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 2px 10px; cursor: pointer; }
.fp3d-rp-list input { flex: none; width: 18px; height: 18px; margin: 0; }
.fp3d-rp-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.fp3d-rp-name small { display: block; color: var(--fp3d-muted); }
</style>`;

/**
 * The picker under a rule block. `rule`: the copied rule; `own`: the block's item ("f:<id>", "p:<entity>"; another
 * block: none); `done(note)`: it closed (a paste's note, or null when cancelled).
 */
export function renderPastePicker(host: Fp3dEditor, s: PickState, rule: ShowRule, which: "icon" | "card", own: string, done: (note: string | null) => void) {
  const doc = host._doc;
  const items = pasteItems(doc, { furniture: (type) => furnitureName(host.hass, type), entity: (id) => entityName(host.hass, id) }, (f) => host.furnitureSelf(f)).filter((it) => it.own !== own);
  const shown = searchItems(items, s.q);
  const needs = ruleNeedsSelf(rule);
  const floors = doc.floors.length > 1;
  const pick = (list: PasteItem[], on: boolean) => {
    for (const it of list) if (on) s.chosen.add(it.key);
    else s.chosen.delete(it.key);
    host.requestUpdate();
  };
  const apply = () => {
    let out: ReturnType<typeof pasteOnto> = { done: [], skipped: [] };
    host.change((next) => void (out = pasteOnto(next, items, s.chosen, rule, which)));
    const names = out.skipped.map((it) => it.name).join(", ");
    done([host.t("rules_pasted", { n: out.done.length }), out.skipped.length ? host.t("rules_pasted_skip", { list: names }) : ""].filter(Boolean).join(" "));
  };
  const n = s.chosen.size;
  return html`${STYLE}
    <div class="fp3d-rp" role="group" aria-label=${host.t("rules_pick_title")}>
      <b>${host.t("rules_pick_title")}</b>
      <label class="fp3d-field"
        >${host.t("rules_pick_search")}
        <input
          type="search"
          .value=${s.q}
          @input=${(e: Event) => {
            s.q = (e.target as HTMLInputElement).value;
            host.requestUpdate();
          }}
      /></label>
      <div class="fp3d-rp-tools">
        <button class="fp3d-btn" @click=${() => pick(items.filter((it) => it.light), true)}>${host.t("rules_pick_lights")}</button>
        <button class="fp3d-btn" @click=${() => pick(shown, true)}>${host.t("rules_pick_shown")}</button>
        <button class="fp3d-btn" ?disabled=${!n} @click=${() => pick(items, false)}>${host.t("rules_pick_clear")}</button>
      </div>
      <div class="fp3d-rp-list">
        ${shown.length
          ? shown.map(
              (it) => html`<label
                ><input type="checkbox" .checked=${s.chosen.has(it.key)} @change=${(e: Event) => pick([it], (e.target as HTMLInputElement).checked)} /><span class="fp3d-rp-name"
                  >${it.name}${floors || (needs && !it.self)
                    ? html`<small>${[floors ? it.floor : "", needs && !it.self ? host.t("rules_pick_no_self") : ""].filter(Boolean).join(" · ")}</small>`
                    : nothing}</span
                ></label
              >`,
            )
          : html`<p class="fp3d-sub">${host.t("rules_pick_empty")}</p>`}
      </div>
      <div class="fp3d-actions">
        <button class="fp3d-btn fp3d-primary" ?disabled=${!n} @click=${apply}>${host.t(which === "icon" ? "rules_paste_icon_n" : "rules_paste_card_n", { n })}</button>
        <button class="fp3d-btn" @click=${() => done(null)}>${host.t("cancel")}</button>
      </div>
    </div>`;
}
