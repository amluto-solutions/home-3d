// The item panel's "Show and hide" section (#539, shorter in #544): an item's icon rule and card rule (#535), built
// without YAML. A chunk of its own (lazy.ts): only an editor who opens an item's "Taps and visibility" fold, a device or
// the solar card settings draws it. Every number and time is typed here; nothing is fixed in code. A rule is copied and
// pasted as an independent copy (#540, rule-clip.ts): "This item" stays relative, so it works on the item it lands on.
//
// Closed, each rule is one sentence (rule-words.ts) with a small "hidden now"; a tap opens it in place (one at a time)
// with ready choices that set a whole rule in one tap, and "Custom" for anything else.

import { html, nothing } from "lit";
import { RULE_WHENS, THIS_ITEM, type Furniture, type RuleCondition, type RuleWhen, type ShowInterval, type ShowRule, type ShowRules, type ShowWhen, type StateCondition, type TimeCondition } from "../../model.ts";
import { ruleShows } from "../../show-rules.ts";
import { itemShown, setIntervalPart } from "../../show-when.ts";
import { entityName } from "../../devices.ts";
import { copyRule, copiedRule, ruleNeedsSelf } from "../../rule-clip.ts";
import { uses12Hours } from "../../time-format.ts";
import type { Fp3dEditor } from "../editor.ts";
import { once } from "../../lazy-part.ts";
import { intlLocales, MARK, presetOf, presetRule, ruleWords, SUN, whenPresetOf, whenPresetRule, whenWords, type Preset, type WhenPreset, type Words } from "./rule-words.ts";

/** "Paste onto other items" (#540): its own chunk, loaded when the button is first pressed. */
let picker: typeof import("./rule-paste.ts") | null = null;
const loadPicker = once(() => import("./rule-paste.ts").then((m) => void (picker = m)));
/** The open picker per block (one at a time) and the note of each block's last paste onto other items. */
let picking: { block: string; state: import("./rule-paste.ts").PickState } | null = null;
const pasteNotes = new Map<string, string>();
/** The one rule open for editing (its block id), and the blocks the user switched to "Custom". */
let openRule: string | null = null;
const customOpen = new Set<string>();

/** What a block edits: one rule, the entity "this item" means there (null: none), and how it is written back. */
export interface RuleBlock {
  /** Where the rule lives, unique in the plan ("f:<id>:icon", "main" …): half-typed times wait under it. */
  id: string;
  /** What the rule is for: a heading above its row (the solar card, the household card). */
  title: string;
  /** A short name in front of its sentence ("Icon", "Card") in place of the heading. */
  tag?: string;
  rule: ShowRule | null | undefined;
  /** The entity "This item" means here; null: the item has none (a condition on it is left out). */
  self: string | null;
  /** "This item" can be picked here (an item, the solar card); "Today in the household" has no sensor of its own. */
  selfPick: boolean;
  set: (rule: ShowRule | null) => void;
  /** A line in the open rule that says what it does here (the icon rule: it replaces Automatic, Hide still wins). */
  note?: string;
  /** What happens with no rule, in words (default: it shows as usual). */
  none?: string;
}

/** A time typed at one end only, or start equal to end (#539): kept here, not in the plan, until both ends are right. */
const drafts = new Map<string, { start: string; end: string }>();

/** Weekday names in the user's language, Monday first (0 = Monday, as the rules count them). */
function weekdays(lang: string | undefined, weekday: "short" | "long"): string[] {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat(intlLocales(lang), { weekday });
  } catch {
    fmt = new Intl.DateTimeFormat(undefined, { weekday });
  }
  return [0, 1, 2, 3, 4, 5, 6].map((d) => fmt.format(new Date(2024, 0, 1 + d)));
}

/** The words the sentences need, in the user's language. */
function words(host: Fp3dEditor): Words {
  const lang = host.hass?.language || undefined;
  const h12 = uses12Hours(host.hass?.locale, host.hass?.language);
  const list = (items: string[], or: boolean) => {
    try {
      return new Intl.ListFormat(intlLocales(lang), { type: or ? "disjunction" : "conjunction" }).format(items);
    } catch {
      return items.join(", ");
    }
  };
  const date = (mmdd: string) => {
    const [m, d] = mmdd.split("-").map(Number);
    // a leap year, so 29 February is a day too (as the old date picker had it)
    const at = new Date(2028, m - 1, d);
    try {
      return new Intl.DateTimeFormat(intlLocales(lang), { day: "numeric", month: "short" }).format(at);
    } catch {
      return mmdd;
    }
  };
  return {
    t: (k, v) => host.t(k, v),
    name: (id) => (host.hass ? entityName(host.hass, id) : id),
    days: weekdays(lang, "short"),
    time: (s) => {
      const [h, m] = s.split(":").map(Number);
      return h12 ? `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}` : s;
    },
    list,
    date,
  };
}

/** A sentence with its marked parts in bold. */
const rich = (text: string) => text.split(MARK).map((p, i) => (i % 2 ? html`<b>${p}</b>` : p));

/** A new condition: on this item where there is one, else a time window. */
function newCondition(selfPick: boolean): RuleCondition {
  return selfPick ? { type: "state", entity: THIS_ITEM, when: "on" } : { type: "time" };
}

/** The rule with condition `i` replaced (null: removed); no condition left: no rule. */
function withCondition(rule: ShowRule, i: number, c: RuleCondition | null): ShowRule | null {
  const conditions = rule.conditions.flatMap((x, j) => (j !== i ? [x] : c ? [c] : []));
  return conditions.length ? { ...rule, conditions } : null;
}

/** One rule: its sentence (a button that opens it), and when open its choices, its fields and its buttons. */
export function renderRuleBlock(host: Fp3dEditor, b: RuleBlock) {
  const off = !host.isEditor;
  const rule = b.rule?.conditions?.length ? b.rule : null;
  const hidden = !!rule && !!host.hass && !ruleShows(rule, b.self, host.hass.states, new Date());
  const sentence = ruleWords(rule, words(host), b.none ?? host.t("rules_s_none"));
  return ruleRow(host, b.id, b.tag, b.title, sentence, !!rule, hidden, () => renderOpen(host, b, rule, off));
}

/** A rule's row: its sentence as a button with "hidden now", and when it is the open one, its body under it. */
function ruleRow(host: Fp3dEditor, id: string, tag: string | undefined, title: string, sentence: string, set: boolean, hidden: boolean, body: () => unknown) {
  const off = !host.isEditor;
  const open = openRule === id;
  const toggle = () => {
    openRule = open ? null : id;
    picking = null;
    host.requestUpdate();
  };
  return html`<div class="fp3d-rule ${open ? "fp3d-rule-open" : ""}" data-rule=${id}>
    ${tag ? nothing : html`<div class="fp3d-rule-title">${title}</div>`}
    <button class="fp3d-rule-say" aria-expanded=${open ? "true" : "false"} @click=${toggle}>
      ${tag ? html`<span class="fp3d-rule-tag">${tag}</span>` : nothing}
      <span class="fp3d-rule-text ${set ? "" : "fp3d-rule-plain"}">${rich(sentence)}${hidden ? html` <span class="fp3d-rule-hidden">${host.t("rules_hidden_now")}</span>` : nothing}</span>
      ${set || open || off ? html`<span class="fp3d-rule-chev" aria-hidden="true"></span>` : html`<span class="fp3d-rule-add">+ ${host.t("rules_add_rule")}</span>`}
    </button>
    ${open ? body() : nothing}
  </div>`;
}

/** The open rule: the ready choices, then what the choice needs (times, or every condition), then copy and paste. */
function renderOpen(host: Fp3dEditor, b: RuleBlock, rule: ShowRule | null, off: boolean) {
  const found = presetOf(rule);
  const p: Preset = customOpen.has(b.id) && rule ? "custom" : found;
  const choose = (next: Preset) => {
    if (next === "custom") {
      customOpen.add(b.id);
      if (!rule) b.set({ match: "all", conditions: [newCondition(b.selfPick)] });
      else host.requestUpdate();
      return;
    }
    customOpen.delete(b.id);
    b.set(presetRule(next, rule));
  };
  const sun = !!host.hass?.states?.[SUN];
  const choices: [Preset, string][] = [
    ["none", host.t("rules_p_none")],
    ...(b.self ? ([["on", host.t("rules_p_on")], ["off", host.t("rules_p_off")]] as [Preset, string][]) : []),
    ["times", host.t("rules_p_times")],
    ...(sun || p === "dark" ? ([["dark", host.t("rules_p_dark")]] as [Preset, string][]) : []),
    ["custom", host.t("rules_p_custom")],
  ];
  const clip = copiedRule();
  return html`<div class="fp3d-rule-body">
    ${b.note ? html`<p class="fp3d-sub">${b.note}</p>` : nothing}
    <div class="fp3d-rule-choices" role="group" aria-label=${b.tag ?? b.title}>
      ${choices.map(([k, label]) => html`<button class="fp3d-rule-chip" aria-pressed=${p === k ? "true" : "false"} ?disabled=${off} @click=${() => choose(k)}>${label}</button>`)}
    </div>
    ${rule && p === "times" && rule.conditions[0].type === "time" ? renderTime(host, b, rule.conditions[0], 0, (c) => b.set(withCondition(rule, 0, c))) : nothing}
    ${rule && p === "custom" ? renderCustom(host, b, rule, off) : nothing}
    ${rule && !b.self && ruleNeedsSelf(rule) ? html`<p class="fp3d-sub fp3d-warn">${host.t("rules_no_self")}</p>` : nothing}
    ${off
      ? nothing
      : html`<div class="fp3d-rule-tools">
          ${rule
            ? html`<button class="fp3d-rule-link" @click=${() => {
                copyRule(rule);
                host.requestUpdate();
              }}>${host.t("rules_copy")}</button>`
            : nothing}
          ${clip
            ? html`<button class="fp3d-rule-link" @click=${() => (customOpen.delete(b.id), b.set(copiedRule()))}>${host.t("rules_paste")}</button>
                <button
                  class="fp3d-rule-link"
                  aria-expanded=${picking?.block === b.id ? "true" : "false"}
                  @click=${() => {
                    picking = picking?.block === b.id ? null : { block: b.id, state: { q: "", chosen: new Set() } };
                    pasteNotes.delete(b.id);
                    loadPicker().then(() => host.requestUpdate(), (err: unknown) => console.error("Home 3D: a part of the page failed to load", err));
                    host.requestUpdate();
                  }}
                >
                  ${host.t("rules_paste_many")}
                </button>`
            : nothing}
        </div>`}
    ${clip && picking?.block === b.id && picker && !off
      ? picker.renderPastePicker(host, picking.state, clip, b.id.endsWith(":icon") ? "icon" : "card", b.id.replace(/:(icon|card)$/, ""), (note) => {
          picking = null;
          if (note) pasteNotes.set(b.id, note);
          host.requestUpdate();
        })
      : nothing}
    ${pasteNotes.get(b.id) ? html`<p class="fp3d-sub" role="status">${pasteNotes.get(b.id)}</p>` : nothing}
  </div>`;
}

/** "Custom": all or any (with two or more conditions), every condition, and "Add condition". */
function renderCustom(host: Fp3dEditor, b: RuleBlock, rule: ShowRule, off: boolean) {
  const add = () => b.set({ ...rule, conditions: [...rule.conditions, newCondition(b.selfPick)] });
  return html`${rule.conditions.length > 1
      ? html`<div class="fp3d-rule-match" role="group" aria-label=${host.t("rules_match")}>
          ${(["all", "any"] as const).map(
            (m) => html`<button class="fp3d-rule-chip" aria-pressed=${(rule.match === "any") === (m === "any") ? "true" : "false"} ?disabled=${off} @click=${() => b.set({ ...rule, match: m })}>
              ${host.t(m === "all" ? "rules_match_all" : "rules_match_any")}
            </button>`,
          )}
        </div>`
      : nothing}
    ${rule.conditions.map((c, i) => renderCondition(host, b, rule, c, i))}
    ${off || rule.conditions.length >= 12 ? nothing : html`<button class="fp3d-rule-link fp3d-rule-addc" @click=${add}>+ ${host.t("rules_add")}</button>`}`;
}

/** One condition: its kind and a remove button, then the entity and what it should be, or the times and the weekdays. */
function renderCondition(host: Fp3dEditor, b: RuleBlock, rule: ShowRule, c: RuleCondition, i: number) {
  const off = !host.isEditor;
  const put = (next: RuleCondition | null) => b.set(withCondition(rule, i, next));
  return html`<div class="fp3d-rule-cond fp3d-field">
    <div class="fp3d-rule-row">
      <select aria-label=${host.t("rules_kind")} ?disabled=${off} @change=${(e: Event) => put((e.target as HTMLSelectElement).value === "time" ? { type: "time" } : newCondition(true))}>
        <option value="state" ?selected=${c.type === "state"}>${host.t("rules_kind_state")}</option>
        <option value="time" ?selected=${c.type === "time"}>${host.t("rules_kind_time")}</option>
      </select>
      <button class="fp3d-pin" aria-label=${host.t("delete")} title=${host.t("delete")} ?disabled=${off} @click=${() => put(null)}>✕</button>
    </div>
    ${c.type === "time" ? renderTime(host, b, c, i, put) : c.type === "state" ? renderState(host, b, c, put) : nothing}
  </div>`;
}

function renderState(host: Fp3dEditor, b: RuleBlock, c: StateCondition, put: (c: RuleCondition) => void) {
  const off = !host.isEditor;
  const self = c.entity === THIS_ITEM;
  const selfLabel = b.self ? host.t("rules_this_item", { name: entityName(host.hass, b.self) }) : host.t("rules_this_item_none");
  const number = c.when === "above" || c.when === "below";
  const label = (w: RuleWhen) => host.t(w === "on" ? "rules_is_on" : w === "off" ? "rules_is_off" : w === "state" ? "rules_is_state" : w === "above" ? "rules_is_above" : "rules_is_below");
  return html`<fp3d-entity-picker
      .options=${host.entityOptions(() => true)}
      .fixed=${b.selfPick || self ? [{ id: THIS_ITEM, label: selfLabel }] : []}
      .value=${c.entity}
      .placeholder=${host.t("entity_search")}
      .label=${host.t("rules_entity")}
      .live=${host.liveValue(self ? b.self : c.entity)}
      ?disabled=${off}
      @change=${(e: CustomEvent<{ value: string }>) => {
        e.stopPropagation();
        const v = e.detail.value;
        if (v && v !== "none" && v !== "__auto") put({ ...c, entity: v });
      }}
    ></fp3d-entity-picker>
    <div class="fp3d-rule-row">
      <select
        aria-label=${host.t("rules_when")}
        ?disabled=${off}
        @change=${(e: Event) => {
          const when = (e.target as HTMLSelectElement).value as RuleWhen;
          const next: StateCondition = { ...c, when };
          // a number condition always has its number: the field shows it, the editor changes it (#538)
          if ((when === "above" || when === "below") && typeof next.value !== "number") next.value = 0;
          if (when !== "above" && when !== "below") delete next.value;
          if (when !== "state") delete next.state;
          put(next);
        }}
      >
        ${RULE_WHENS.map((w) => html`<option value=${w} ?selected=${c.when === w}>${label(w)}</option>`)}
      </select>
      ${c.when === "state"
        ? html`<input
            type="text"
            maxlength="255"
            aria-label=${host.t("show_when_typed_state")}
            placeholder=${host.t("show_when_typed_state")}
            ?disabled=${off}
            .value=${c.state ?? ""}
            @change=${(e: Event) => put({ ...c, state: (e.target as HTMLInputElement).value.trim() || null })}
          />`
        : nothing}
      ${number
        ? html`<input
            type="number"
            step="any"
            inputmode="decimal"
            aria-label=${host.t("rules_value")}
            ?disabled=${off}
            .value=${String(c.value ?? 0)}
            @change=${(e: Event) => {
              const v = Number((e.target as HTMLInputElement).value);
              if (Number.isFinite(v) && Math.abs(v) <= 1e12) put({ ...c, value: v });
              else (e.target as HTMLInputElement).value = String(c.value ?? 0);
            }}
          />`
        : nothing}
    </div>
    <select aria-label=${host.t("show_when_unavailable")} ?disabled=${off} @change=${(e: Event) => put({ ...c, unavailable: (e.target as HTMLSelectElement).value === "hide" ? "hide" : null })}>
      <option value="" ?selected=${c.unavailable !== "hide"}>${host.t("rules_unav_show")}</option>
      <option value="hide" ?selected=${c.unavailable === "hide"}>${host.t("rules_unav_hide")}</option>
    </select>`;
}

function renderTime(host: Fp3dEditor, b: RuleBlock, c: TimeCondition, i: number, put: (c: RuleCondition) => void) {
  const off = !host.isEditor;
  const key = `${b.id}:${i}`;
  const draft = drafts.get(key) ?? { start: c.start ?? "", end: c.end ?? "" };
  // both ends or neither, never the same time (#539): a half or equal pair waits here with its note
  const setTime = (part: "start" | "end", v: string) => {
    const next = { ...draft, [part]: v };
    if (!!next.start !== !!next.end || (next.start && next.start === next.end)) {
      drafts.set(key, next);
      host.requestUpdate();
      return;
    }
    drafts.delete(key);
    const out: TimeCondition = { ...c, start: next.start || null, end: next.end || null };
    if (!out.start) {
      delete out.start;
      delete out.end;
    }
    put(out);
  };
  const half = !!draft.start !== !!draft.end;
  const same = !!draft.start && draft.start === draft.end;
  const days = c.days ?? [];
  const lang = host.hass?.language;
  const short = weekdays(lang, "short");
  const long = weekdays(lang, "long");
  const toggle = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((x, y) => x - y);
    const out: TimeCondition = { ...c, days: next };
    if (!next.length) delete out.days;
    put(out);
  };
  const time = (part: "start" | "end", label: string) =>
    html`<div class="fp3d-rule-time"><span>${label}</span>${host.timeField(label, draft[part], off, (v) => setTime(part, v))}</div>`;
  return html`<div class="fp3d-rule-times">${time("start", host.t("rules_from"))}${time("end", host.t("rules_to"))}</div>
    ${half || same ? html`<p class="fp3d-sub fp3d-warn" role="alert">${host.t(same ? "rules_time_same" : "rules_time_both")}</p>` : nothing}
    <div class="fp3d-rule-days" role="group" aria-label=${host.t("pet_days")}>
      ${short.map(
        (n, d) => html`<button aria-pressed=${days.includes(d) ? "true" : "false"} aria-label=${long[d]} title=${long[d]} ?disabled=${off} @click=${() => toggle(d)}>${n.replace(/\.$/, "")}</button>`,
      )}
    </div>
    ${days.length ? nothing : html`<p class="fp3d-rule-hint">${host.t("rules_days")}</p>`}`;
}

/** What the Object row edits (#547): a furniture item's "When it shows" rule (`show_when`) and how it is written back. */
export interface ObjectBlock {
  item: Furniture;
  set: (rule: ShowWhen | null) => void;
}

/**
 * The Object row (#547): the item's `show_when` (#15, #338), which hides the whole item, as one sentence like the icon
 * and card rows. The same data and every field the old "When it shows" section had: an entity (available, on, off, a
 * typed state, what an unavailable one does) and up to 12 intervals of days of the year and times of day. No copy and
 * paste (the old section had none) and no weekdays or "this item" (`show_when` cannot store them).
 */
function renderObjectBlock(host: Fp3dEditor, id: string, o: ObjectBlock) {
  const f = o.item;
  const rule = whenPresetOf(f.show_when) === "none" ? null : (f.show_when as ShowWhen);
  const hidden = !!rule && !!host.hass && !itemShown(f, host.hass.states, new Date());
  const sentence = whenWords(rule, words(host), host.t("rules_s_always"));
  const tag = host.t("rules_object");
  return ruleRow(host, id, tag, tag, sentence, !!rule, hidden, () => renderObjectOpen(host, id, o, rule));
}

function renderObjectOpen(host: Fp3dEditor, id: string, o: ObjectBlock, rule: ShowWhen | null) {
  const off = !host.isEditor;
  const found = whenPresetOf(rule);
  const p: WhenPreset = customOpen.has(id) ? "custom" : found;
  // as the old section wrote it: the state options go with the entity (#338), and with neither entity nor interval
  // there is no rule
  const set = (patch: ShowWhen) => {
    const next = { ...(rule ?? {}), ...patch };
    if (!next.entity || next.entity === "none") {
      delete next.when;
      delete next.state;
      delete next.unavailable;
    }
    o.set((next.entity && next.entity !== "none") || next.intervals?.length ? next : null);
  };
  const choose = (next: WhenPreset) => {
    if (next === "custom") {
      customOpen.add(id);
      host.requestUpdate();
      return;
    }
    customOpen.delete(id);
    o.set(whenPresetRule(next, rule));
  };
  const sun = !!host.hass?.states?.[SUN];
  const choices: [WhenPreset, string][] = [
    ["none", host.t("rules_p_none")],
    ["times", host.t("rules_p_dates")],
    ...(sun || p === "dark" ? ([["dark", host.t("rules_p_dark")]] as [WhenPreset, string][]) : []),
    ["custom", host.t("rules_p_custom")],
  ];
  const list = rule?.intervals ?? [];
  return html`<div class="fp3d-rule-body">
    <div class="fp3d-with-info"><p class="fp3d-sub">${host.t("rules_object_note")}</p>${host.infoButton("show_when_hint", host.t("rules_object"))}</div>
    <div class="fp3d-rule-choices" role="group" aria-label=${host.t("rules_object")}>
      ${choices.map(([k, label]) => html`<button class="fp3d-rule-chip" aria-pressed=${p === k ? "true" : "false"} ?disabled=${off} @click=${() => choose(k)}>${label}</button>`)}
    </div>
    ${p === "times" && list.length ? renderInterval(host, list, 0, set, false) : nothing}
    ${p === "custom" ? renderObjectCustom(host, rule ?? {}, set) : nothing}
  </div>`;
}

/** "Custom" on the Object row: the old section's fields, the entity and what it must be, then every interval. */
function renderObjectCustom(host: Fp3dEditor, rule: ShowWhen, set: (patch: ShowWhen) => void) {
  const off = !host.isEditor;
  const list = rule.intervals ?? [];
  const entity = rule.entity && rule.entity !== "none" ? rule.entity : null;
  return html`<div class="fp3d-rule-cond fp3d-field">
      ${host.entitySelect(host.t("show_when_entity"), entity, undefined, host.entityOptions(() => true), (v) => set({ entity: v === "none" ? null : v }))}
      ${entity
        ? html`<label class="fp3d-field"
              >${host.t("show_when_state")}
              <select ?disabled=${off} @change=${(e: Event) => set({ when: ((e.target as HTMLSelectElement).value || null) as ShowWhen["when"] })}>
                <option value="" ?selected=${!rule.when}>${host.t("show_when_available")}</option>
                <option value="on" ?selected=${rule.when === "on"}>${host.t("show_when_on")}</option>
                <option value="off" ?selected=${rule.when === "off"}>${host.t("show_when_off")}</option>
                <option value="state" ?selected=${rule.when === "state"}>${host.t("show_when_typed")}</option>
              </select></label
            >
            ${rule.when === "state"
              ? html`<label class="fp3d-field"
                  >${host.t("show_when_typed_state")}
                  <input type="text" maxlength="255" ?disabled=${off} .value=${rule.state ?? ""} @change=${(e: Event) => set({ state: (e.target as HTMLInputElement).value.trim() || null })}
                /></label>`
              : nothing}
            ${rule.when
              ? html`<label class="fp3d-field"
                  >${host.t("show_when_unavailable")}
                  <select ?disabled=${off} @change=${(e: Event) => set({ unavailable: (e.target as HTMLSelectElement).value === "hide" ? "hide" : null })}>
                    <option value="" ?selected=${rule.unavailable !== "hide"}>${host.t("show_when_keep")}</option>
                    <option value="hide" ?selected=${rule.unavailable === "hide"}>${host.t("show_when_hide")}</option>
                  </select></label
                >`
              : nothing}`
        : nothing}
    </div>
    ${list.map((_, i) => renderInterval(host, list, i, set, true))}
    ${off || list.length >= 12 ? nothing : html`<button class="fp3d-rule-link fp3d-rule-addc" @click=${() => set({ intervals: [...list, {}] })}>+ ${host.t("show_add_interval")}</button>`}`;
}

/** One interval of `show_when`: first and last day, start and end time, never half-open (#46); in Custom, a remove button. */
function renderInterval(host: Fp3dEditor, list: ShowInterval[], i: number, set: (patch: ShowWhen) => void, removable: boolean) {
  const off = !host.isEditor;
  const iv = list[i];
  // picking one end fills the other, clearing one clears both (#46)
  const put = (patch: ShowInterval) => set({ intervals: list.map((x, j) => (j === i ? setIntervalPart(x, patch) : x)) });
  // days are kept without a year ("MM-DD"); the picker shows a leap year so 29 February can be picked
  const day = (label: string, v: string | null | undefined, on: (v: string | null) => void) =>
    html`<label class="fp3d-rule-time"
      >${label}
      <input type="date" ?disabled=${off} .value=${v ? `2028-${v}` : ""} @change=${(e: Event) => {
        const raw = (e.target as HTMLInputElement).value;
        on(raw ? raw.slice(5) : null);
      }}
    /></label>`;
  const time = (label: string, v: string | null | undefined, on: (v: string | null) => void) =>
    html`<div class="fp3d-rule-time"><span>${label}</span>${host.timeField(label, v ?? "", off, (x) => on(x || null))}</div>`;
  return html`<div class="fp3d-rule-cond fp3d-field">
    ${removable
      ? html`<div class="fp3d-rule-row">
          <span class="fp3d-rule-ivl">${host.t("show_add_interval")} ${i + 1}</span>
          <button class="fp3d-pin" aria-label=${host.t("delete")} title=${host.t("delete")} ?disabled=${off} @click=${() => set({ intervals: list.filter((_, j) => j !== i) })}>✕</button>
        </div>`
      : nothing}
    <div class="fp3d-rule-times">
      ${day(host.t("show_from"), iv.from, (v) => put({ from: v }))}${day(host.t("show_to"), iv.to, (v) => put({ to: v }))}
      ${time(host.t("show_start"), iv.start, (v) => put({ start: v }))}${time(host.t("show_end"), iv.end, (v) => put({ end: v }))}
    </div>
  </div>`;
}

/**
 * An item's section (#539): its icon rule and its card rule. `self`: its own entity ("This item"; null: none).
 * `object`: a furniture item's "When it shows" rule, the Object row on top (#547); other things have none.
 */
export function renderShowRules(host: Fp3dEditor, id: string, rules: ShowRules | null | undefined, self: string | null, set: (rules: ShowRules | null) => void, object?: ObjectBlock) {
  const put = (which: keyof ShowRules) => (rule: ShowRule | null) => {
    const next: ShowRules = { ...(rules ?? {}), [which]: rule };
    if (!next.icon) delete next.icon;
    if (!next.card) delete next.card;
    set(next.icon || next.card ? next : null);
  };
  return html`<div class="fp3d-when-section fp3d-rules">
    <div class="fp3d-with-info"><h4>${host.t("rules_title")}</h4>${host.infoButton("rules_hint", host.t("rules_title"))}</div>
    ${object ? renderObjectBlock(host, `${id}:object`, object) : nothing}
    ${renderRuleBlock(host, { id: `${id}:icon`, title: host.t("rules_icon"), tag: host.t("rules_icon"), note: host.t("rules_icon_note"), rule: rules?.icon, self, selfPick: true, set: put("icon") })}
    ${renderRuleBlock(host, { id: `${id}:card`, title: host.t("rules_card"), tag: host.t("rules_card"), rule: rules?.card, self, selfPick: true, set: put("card") })}
  </div>`;
}
