// The dates of the holidays on the Extensions page (#287, #339): each holiday shows when it is next on, and opens to its
// rules (a fixed day, days from Easter, the n-th weekday of a month, a one-off window) with the next three windows worked
// out from them. The rules are evaluated in seasons.ts; a house stores only what it changed (settings.season_rules, the
// old "MM-DD" season_dates still load as a fixed day rule). Pure functions and templates: the page keeps the open rows.

import { html, nothing, type TemplateResult } from "lit";
import type { Building } from "../model.ts";
import { SEASON_EFFECT_MODES, SEASON_IDS } from "../season-ids.ts";
import { formatTime } from "../time-text.ts";
import { parseMonthDay, ruleWindow, seasonRules, type SeasonDates, type SeasonDatesMap, type SeasonId, type SeasonRule, type SeasonRulesMap } from "../seasons.ts";

type T = (key: string, vars?: Record<string, string | number>) => string;
const DAY = 864e5;
/** The year the date picker of a fixed day shows: a leap one, so 29 February can be picked (the year itself is not kept). */
const PICK = 2024;

/** A window as minutes since 1970 (on the local clock): from its first minute to its end, not included. */
export interface Window {
  from: number;
  to: number;
}

/** The windows of the rules that are not over at `now` (minutes since 1970, local clock), the soonest first, as many as asked for. */
export function nextWindows(rules: readonly SeasonRule[], now: number, count: number, year: number): Window[] {
  const seen = new Map<string, Window>();
  for (const r of rules) {
    for (let y = year - 1; y <= year + 4; y++) {
      const w = ruleWindow(r, y);
      if (w && w[1] > now) seen.set(`${w[0]}:${w[1]}`, { from: w[0], to: w[1] });
    }
  }
  return [...seen.values()].sort((a, b) => a.from - b.from || a.to - b.to).slice(0, count);
}

/** Minutes since 1970 on the local clock for a moment. */
export const clockMinutes = (d: Date): number => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()) / 6e4);

export interface WindowStyle {
  lang: string | undefined;
  h12: boolean;
}

/** A window as text: "Fri 3 Apr – Mon 6 Apr 2026", with the times where it starts or ends part way through a day. */
export function windowText(w: Window, st: WindowStyle): string {
  const date = (day: number, year: boolean) =>
    new Date(day * DAY).toLocaleDateString(st.lang, { weekday: "short", day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
  const time = (min: number) => formatTime(new Date(min * 6e4), { h12: st.h12, language: st.lang }, { timeZone: "UTC" });
  const d0 = Math.floor(w.from / 1440);
  const d1 = Math.floor((w.to - 1) / 1440);
  const t0 = w.from - d0 * 1440;
  const t1 = w.to - d1 * 1440;
  const y0 = new Date(d0 * DAY).getUTCFullYear();
  const y1 = new Date(d1 * DAY).getUTCFullYear();
  const start = `${date(d0, y0 !== y1)}${t0 ? ` ${time(w.from)}` : ""}`;
  const end = `${date(d1, true)}${t1 < 1440 ? ` ${time(w.to)}` : ""}`;
  return d0 === d1 && !t0 && t1 === 1440 ? end : `${start} – ${end}`;
}

/** "Next showing: …", or "Showing now until …" while one of the windows is on. */
export function nextShowingText(rules: readonly SeasonRule[], now: Date, st: WindowStyle, t: T): string {
  const at = clockMinutes(now);
  const w = nextWindows(rules, at, 1, now.getFullYear())[0];
  if (!w) return t("season_never");
  if (w.from <= at) return t("season_now_until", { when: windowText({ from: w.to - 1, to: w.to }, st).replace(/^.* – /, "") });
  return t("season_next", { when: windowText(w, st) });
}

/** A rule of another kind, keeping the length and the times. */
export function asKind(r: SeasonRule, kind: SeasonRule["kind"], today: Date): SeasonRule {
  const keep = { ...(r.days ? { days: r.days } : {}), ...(r.start ? { start: r.start } : {}), ...(r.end ? { end: r.end } : {}) };
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (kind === "fixed") return { kind, month: today.getMonth() + 1, day: today.getDate(), days: 1, ...keep };
  if (kind === "easter") return { kind, offset: 0, days: 1, ...keep };
  if (kind === "nth") return { kind, nth: 1, weekday: 1, month: today.getMonth() + 1, days: 1, ...keep };
  if (kind === "cny") return { kind, days: 1, ...keep };
  return { kind, from: iso, ...(keep.start ? { start: keep.start } : {}), ...(keep.end ? { end: keep.end } : {}) };
}

/** A new rule for "Add dates": the same window a year later when the last rule is a one-off, else one day, today. */
export function addedRule(last: SeasonRule | undefined, today: Date): SeasonRule {
  if (last?.kind === "once" && last.from) {
    const later = (d: string) => `${Number(d.slice(0, 4)) + 1}${d.slice(4)}`;
    return { ...last, from: later(last.from), ...(last.to ? { to: later(last.to) } : {}) };
  }
  return asKind({ kind: "once" }, "once", today);
}

/** A rule with the fields that carry nothing left out (the plan's schema takes no empty times). */
export function cleanRule(r: SeasonRule): SeasonRule {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (v !== undefined && v !== "" && !(typeof v === "number" && Number.isNaN(v))) out[k] = v;
  if (out.kind === "once") delete out.days;
  return out as unknown as SeasonRule;
}

/**
 * The settings' two maps after one holiday's rules were stored (null: back to the usual days). The holiday's old "MM-DD"
 * entry is dropped on the way: its days are in the rules now (or reset). Other holidays are left as they are; undefined
 * when none are left.
 */
export function withSeasonRules(
  rules: SeasonRulesMap,
  dates: SeasonDatesMap,
  id: SeasonId,
  next: readonly SeasonRule[] | null,
): { season_rules: Record<string, SeasonRule[]> | undefined; season_dates: Record<string, SeasonDates> | undefined } {
  const r: Record<string, SeasonRule[]> = {};
  for (const [k, v] of Object.entries(rules ?? {})) if (v && k !== id) r[k] = [...v];
  if (next) r[id] = next.map(cleanRule);
  const d: Record<string, SeasonDates> = {};
  for (const [k, v] of Object.entries(dates ?? {})) if (v && k !== id && parseMonthDay(v.from)) d[k] = v;
  return { season_rules: Object.keys(r).length ? r : undefined, season_dates: Object.keys(d).length ? d : undefined };
}

export interface SeasonDatesView {
  id: SeasonId;
  now: Date;
  lang: string | undefined;
  h12: boolean;
  /** The holiday's rules (its own, its old dates as a rule, or the usual one). */
  rules: readonly SeasonRule[];
  /** The house changed them. */
  custom: boolean;
  /** The editor is open for this holiday. */
  open: boolean;
  /** Editors only; the dates stay readable for everyone. */
  editable: boolean;
  /** The holiday is switched on, so "Show now" has something to show. */
  on: boolean;
  t: T;
  toggle: () => void;
  /** Store these rules; null: back to the usual days. */
  set: (rules: SeasonRule[] | null) => void;
  /** Remove one rule (the page offers Undo). */
  remove: (index: number) => void;
}

const iso = (m: number, d: number) => `${PICK}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** One rule's controls: the kind, what the kind needs, the length and the times, and Remove. */
function ruleRow(v: SeasonDatesView, r: SeasonRule, i: number): TemplateResult {
  const upd = (patch: Partial<SeasonRule>) => v.set(v.rules.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const months = Array.from({ length: 12 }, (_, m) => new Date(PICK, m, 1).toLocaleDateString(v.lang, { month: "long" }));
  const weekdays = Array.from({ length: 7 }, (_, w) => new Date(PICK, 0, 7 + w).toLocaleDateString(v.lang, { weekday: "long" }));
  const kinds: SeasonRule["kind"][] = r.kind === "cny" ? ["cny", "fixed", "easter", "nth", "once"] : ["fixed", "easter", "nth", "once"];
  const field = (name: string, control: TemplateResult) => html`<label class="fp3d-field"><span>${name}</span>${control}</label>`;
  const pickDate = (key: "from" | "to", value: string | undefined, name: string) =>
    field(name, html`<input type="date" .value=${value ?? ""} @change=${(e: Event) => upd({ [key]: (e.target as HTMLInputElement).value || undefined })} />`);
  const time = (key: "start" | "end", name: string) => html`<div class="fp3d-field">
    <span>${name}</span>
    <fp3d-time-field
      .value=${r[key] ?? ""}
      .hour12=${v.h12}
      .clearable=${true}
      .label=${name}
      .hourLabel=${v.t("time_hour")}
      .minuteLabel=${v.t("time_minute")}
      @change=${(e: CustomEvent<{ value: string }>) => upd({ [key]: e.detail.value || undefined })}
    ></fp3d-time-field>
  </div>`;
  const select = (name: string, onChange: (e: Event) => void, options: TemplateResult[]) =>
    field(name, html`<select aria-label=${name} @change=${onChange}>${options}</select>`);
  return html`<div class="fp3d-ext-rule">
    ${select(
      v.t("season_rule_kind"),
      (e) => v.set(v.rules.map((x, j) => (j === i ? asKind(x, (e.target as HTMLSelectElement).value as SeasonRule["kind"], new Date()) : x))),
      kinds.map((k) => html`<option value=${k} ?selected=${r.kind === k}>${v.t(`season_kind_${k}`)}</option>`),
    )}
    ${r.kind === "fixed"
      ? field(
          v.t("season_date"),
          html`<input
            type="date"
            min=${iso(1, 1)}
            max=${iso(12, 31)}
            .value=${iso(r.month ?? 1, r.day ?? 1)}
            @change=${(e: Event) => {
              const m = /^\d{4}-(\d\d)-(\d\d)$/.exec((e.target as HTMLInputElement).value);
              if (m) upd({ month: Number(m[1]), day: Number(m[2]) });
            }}
          />`,
        )
      : nothing}
    ${r.kind === "easter"
      ? field(v.t("season_easter_offset"), html`<input type="number" min="-366" max="366" .value=${String(r.offset ?? 0)} @change=${(e: Event) => upd({ offset: Math.round(Number((e.target as HTMLInputElement).value) || 0) })} />`)
      : nothing}
    ${r.kind === "nth"
      ? html`${select(
          v.t("season_nth"),
          (e) => upd({ nth: Number((e.target as HTMLSelectElement).value) }),
          [1, 2, 3, 4, 5, -1].map((n) => html`<option value=${n} ?selected=${(r.nth ?? 1) === n}>${v.t(n < 0 ? "season_nth_last" : `season_nth_${n}`)}</option>`),
        )}
        ${select(
          v.t("season_weekday"),
          (e) => upd({ weekday: Number((e.target as HTMLSelectElement).value) }),
          weekdays.map((name, w) => html`<option value=${w} ?selected=${(r.weekday ?? 0) === w}>${name}</option>`),
        )}
        ${select(
          v.t("season_dates_month"),
          (e) => upd({ month: Number((e.target as HTMLSelectElement).value) }),
          months.map((name, m) => html`<option value=${m + 1} ?selected=${(r.month ?? 1) === m + 1}>${name}</option>`),
        )}`
      : nothing}
    ${r.kind === "once" ? html`${pickDate("from", r.from, v.t("season_dates_from"))} ${pickDate("to", r.to, v.t("season_dates_to"))}` : nothing}
    ${r.kind !== "once"
      ? field(v.t("season_length"), html`<input type="number" min="1" max="366" .value=${String(r.days ?? 1)} @change=${(e: Event) => upd({ days: Math.min(366, Math.max(1, Math.round(Number((e.target as HTMLInputElement).value) || 1))) })} />`)
      : nothing}
    ${time("start", v.t("season_start_time"))} ${time("end", v.t("season_end_time"))}
    <button type="button" class="fp3d-btn fp3d-danger fp3d-ext-rule-remove" @click=${() => v.remove(i)}>${v.t("season_remove")}</button>
  </div>`;
}

/** One holiday's dates: when it is next on, a Dates button, Show now, and when open its rules and the next three windows. */
export function seasonDates(v: SeasonDatesView): TemplateResult {
  const st: WindowStyle = { lang: v.lang, h12: v.h12 };
  const next = nextWindows(v.rules, clockMinutes(v.now), 3, v.now.getFullYear());
  return html`<div class="fp3d-ext-dates" data-ext=${`season:${v.id}`}>
    <span class="fp3d-sub">${nextShowingText(v.rules, v.now, st, v.t)}${v.custom ? ` · ${v.t("season_dates_changed")}` : ""}</span>
    ${v.editable
      ? html`<button type="button" class="fp3d-btn" aria-expanded=${v.open} @click=${v.toggle}>${v.t("season_dates")} ${v.open ? "▴" : "▾"}</button>
          ${v.on
            ? html`<button type="button" class="fp3d-btn" @click=${() => window.open(`${location.pathname}?fp3d_season=${v.id}`, "_blank", "noopener")}>${v.t("season_show_now")}</button>`
            : nothing}`
      : nothing}
    ${v.open && v.editable
      ? html`<div class="fp3d-ext-dates-edit">
          ${v.rules.map((r, i) => ruleRow(v, r, i))}
          <button type="button" class="fp3d-btn" @click=${() => v.set([...v.rules, addedRule(v.rules[v.rules.length - 1], new Date())])}>+ ${v.t("season_add")}</button>
          ${v.custom ? html`<button type="button" class="fp3d-btn" @click=${() => v.set(null)}>${v.t("season_dates_reset")}</button>` : nothing}
          <div class="fp3d-ext-upcoming">
            <b>${v.t("season_upcoming")}</b>
            ${next.length ? html`<ul>${next.map((w) => html`<li>${windowText(w, st)}</li>`)}</ul>` : html`<span class="fp3d-sub">${v.t("season_never")}</span>`}
            <span class="fp3d-sub">${v.t("season_overlap_hint")}</span>
          </div>
        </div>`
      : nothing}
  </div>`;
}

/** The little picture of each holiday in the Fun list. */
const SEASON_ICONS: Record<SeasonId, string> = {
  nye: "🎆",
  new_year: "🎉",
  christmas_eve: "🎅",
  christmas: "🎄",
  boxing_day: "🎁",
  twixmas: "❄️",
  advent: "🕯️",
  bonfire: "🔥",
  remembrance: "🌺",
  valentines: "❤️",
  pancake_day: "🥞",
  mothers_day: "🌸",
  easter: "🐣",
  fathers_day: "⭐",
  halloween: "🎃",
  chinese_new_year: "🧧",
};

/** A removed rule the page offers to bring back. */
export interface SeasonUndo {
  id: SeasonId;
  /** The holiday's rules before the removal. */
  before: SeasonRule[];
  /** They were the house's own (else the usual ones: Undo goes back to those). */
  wasCustom: boolean;
}

/** What the holidays card needs from the Extensions page. */
export interface SeasonsCardHost {
  building: Building | null | undefined;
  editor: boolean;
  lang: string | undefined;
  h12: boolean;
  /** The open rows of the page (a row is "dates:<holiday>"). */
  open: ReadonlySet<string>;
  /** The last removal, for a few seconds. */
  undo: SeasonUndo | null;
  setUndo: (u: SeasonUndo | null) => void;
  t: T;
  toggle: (key: string) => void;
  funSwitch: (on: boolean, label: string, set: (on: boolean) => void, disabled?: boolean) => TemplateResult;
  edit: (fn: (b: Building) => void) => void;
}

/** Store a holiday's rules in a plan's settings (null: the usual days). */
export function storeRules(b: Building, id: SeasonId, next: readonly SeasonRule[] | null): void {
  const out = withSeasonRules(b.settings.season_rules, b.settings.season_dates, id, next);
  if (out.season_rules) b.settings.season_rules = out.season_rules;
  else delete b.settings.season_rules;
  if (out.season_dates) b.settings.season_dates = out.season_dates;
  else delete b.settings.season_dates;
}

/**
 * Fun pack "Holidays" (#239): each holiday has its own switch and its dates (editors); it shows on its days. Halloween is
 * one of them since #287, with the floating ghost and the decorations inside it.
 */
export function seasonsCard(h: SeasonsCardHost): TemplateResult {
  const settings = h.building?.settings;
  const off = settings?.seasons ?? {};
  const eggs = settings?.easter_eggs !== false;
  const now = new Date();
  const ghost = settings?.halloween?.ghost !== false;
  const undo = h.undo;
  return html`<div class="fp3d-ext-feature fp3d-ext-on" data-ext="holidays">
    <b>🎄 ${h.t("fun_name_seasons")}</b>
    <span class="fp3d-sub">${h.t("fun_feature_seasons")}</span>
    ${undo && h.editor
      ? html`<div class="fp3d-ext-undo" role="status">
          ${h.t("season_removed", { name: h.t(`season_name_${undo.id}`) })}
          <button
            type="button"
            class="fp3d-link"
            @click=${() => {
              h.edit((b) => storeRules(b, undo.id, undo.wasCustom ? undo.before : null));
              h.setUndo(null);
            }}
          >
            ${h.t("season_undo")}
          </button>
        </div>`
      : nothing}
    ${h.editor
      ? html`<div class="fp3d-ext-season" data-setting="season_effect">
            <span>${h.t("st_season_effect")}</span>
            <select
              aria-label=${h.t("st_season_effect")}
              ?disabled=${!eggs}
              @change=${(e: Event) => {
                const v = (e.target as HTMLSelectElement).value;
                h.edit((b) => (b.settings.season_effect = v === "brief" ? null : (v as typeof b.settings.season_effect)));
              }}
            >
              ${SEASON_EFFECT_MODES.map((m) => html`<option value=${m} ?selected=${(settings?.season_effect ?? "brief") === m}>${h.t(`season_fx_${m}`)}</option>`)}
            </select>
          </div>
          <span class="fp3d-sub">${h.t("st_season_effect_hint")}</span>`
      : nothing}
    ${h.editor
      ? SEASON_IDS.map((id) => {
          const rules = seasonRules(id, settings?.season_dates, settings?.season_rules);
          const custom = !!settings?.season_rules?.[id] || !!parseMonthDay(settings?.season_dates?.[id]?.from);
          const on = off[id] !== false && eggs;
          return html`${h.funSwitch(
              off[id] !== false && eggs,
              `${SEASON_ICONS[id]} ${h.t(`season_name_${id}`)}`,
              (v) =>
                h.edit((b) => {
                  const seasons = { ...(b.settings.seasons ?? {}) };
                  if (v) delete seasons[id];
                  else seasons[id] = false;
                  b.settings.seasons = seasons;
                }),
              !eggs,
            )}
            ${seasonDates({
              id,
              now,
              lang: h.lang,
              h12: h.h12,
              rules,
              custom,
              open: h.open.has(`dates:${id}`),
              editable: true,
              on,
              t: h.t,
              toggle: () => h.toggle(`dates:${id}`),
              set: (next) => h.edit((b) => storeRules(b, id, next)),
              remove: (i) => {
                h.setUndo({ id, before: rules.map((r) => ({ ...r })), wasCustom: custom });
                h.edit((b) => storeRules(b, id, rules.filter((_, j) => j !== i)));
              },
            })}
            ${id === "halloween"
              ? html`<div class="fp3d-ext-sub">
                  <span class="fp3d-sub">${h.t("fun_feature_halloween")}</span>
                  ${h.funSwitch(ghost, h.t("halloween_ghost"), (v) => h.edit((b) => (b.settings.halloween = { ...(b.settings.halloween ?? {}), ghost: v })))}
                  <span class="fp3d-sub">${h.t("halloween_deco_hint")}</span>
                </div>`
              : nothing}`;
        })
      : nothing}
  </div>`;
}
