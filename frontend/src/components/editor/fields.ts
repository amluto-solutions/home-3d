// Form fields shared by every panel: lengths and numbers (typed commits), icons, markers, entity pickers and
// their option lists, and the fields of extension modules.

import { html, nothing } from "lit";
import { linesField } from "../lines-field.ts";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { entityName } from "../../devices.ts";
import { stateText } from "../../markers.ts";
import { areaText, formatImperial, lengthText, parseLength, unitLabel } from "../../units.ts";
import { formatNumber, type I18nKey } from "../../i18n.ts";
import { typedValue } from "../typed-value.ts";
import { moduleAreaFields, moduleFurnitureFields, moduleRoomFields, type ModuleField, type ModuleHost } from "../../modules.ts";
import { pipePlanner } from "../../pipe-planner.ts";
import { uid, type Furniture, type MarkerShow, MARKER_SHOWS, type OutdoorArea, type Room } from "../../model.ts";
import type { EntityOption } from "../../entity-options.ts";
import { stateCount } from "../../hass-watch.ts";
import { round } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";
import { callServiceSafe } from "../../failure.ts";
import { uses12Hours } from "../../time-of-day.ts";
import { need, loadTimeField, loadIconPicker } from "./lazy.ts";

/** The units a field label may end in, "(m)" or "(°)": they go into the input as a suffix (#412). */
const UNIT = /^(.*\S)\s*\((m|cm|mm|°|%|W|kW|kWh|Wp|kWp|V|A|s|min|h|lx|°C|°F|ft|in)\)$/;

/** "Width (m)" → ["Width", "m"]; a label without a unit at its end → [label, ""] (#412, CUT-2). */
export function splitUnit(label: string): [string, string] {
  const m = UNIT.exec(label.trim());
  return m ? [m[1], m[2]] : [label, ""];
}

/** FieldsPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class FieldsPart {
  /** The host a module gets from the editor: the plan as edited here, and the means to change it. */
  editorHost(this: Fp3dEditor): ModuleHost {
    const hass = this.hass!;
    return {
      api: 1,
      hass: () => hass,
      building: () => this._doc,
      language: () => hass.language || "en",
      devices: () => [],
      findDevice: () => null,
      openings: () => [],
      energy: () => null,
      consumers: () => [],
      canEdit: () => this.isEditor,
      updateBuilding: (mutate) => this.change((doc) => mutate(doc)),
      callService: (domain, service, data) => (callServiceSafe(hass, domain, service, data ?? {}, (error) => this.t("service_failed", { error })), Promise.resolve()),
      newId: (prefix) => uid(prefix),
      refresh: () => {
        // a module changed its own state (a demo started): its fields are made anew
        this._moduleFieldMemo = null;
        this.requestUpdate();
      },
      plan: pipePlanner,
    };
  }

  memoFields(this: Fp3dEditor, item: object, make: () => ModuleField[]): ModuleField[] {
    const m = this._moduleFieldMemo;
    const hass = this.hass!;
    if (m && m.item === item && m.doc === this._doc && m.entities === hass.entities && m.lang === hass.language) return m.fields;
    const fields = make();
    this._moduleFieldMemo = { item, doc: this._doc, entities: hass.entities, lang: hass.language, fields };
    return fields;
  }

  /** Fields a module adds to an outdoor area's form (the pool module: the pool's entities, the assistant), rendered here. */
  renderModuleFields(this: Fp3dEditor, a: OutdoorArea) {
    if (!this.hass) return nothing;
    return this.renderFields(this.memoFields(a, () => moduleAreaFields(this.editorHost(), a)));
  }

  /** Fields a module adds to a room's form (the room's own speaker for the announcements). */
  renderModuleRoomFields(this: Fp3dEditor, room: Room) {
    const floor = this.floor;
    if (!this.hass || !floor) return nothing;
    return this.renderFields(this.memoFields(room, () => moduleRoomFields(this.editorHost(), room, floor)), false);
  }

  /** Fields a module adds to a piece of furniture's form (a device's entities, a setup assistant). */
  renderModuleFurnitureFields(this: Fp3dEditor, f: Furniture) {
    if (!this.hass) return nothing;
    return this.renderFields(this.memoFields(f, () => moduleFurnitureFields(this.editorHost(), f)));
  }

  /** A module's fields, drawn like the editor's own. */
  renderFields(this: Fp3dEditor, fields: ModuleField[], wrap = true) {
    if (!fields.length) return nothing;
    const admin = this.isEditor;
    const field = (f: ModuleField) => {
      switch (f.kind) {
        case "heading":
          return html`<h3>${f.text}</h3>`;
        case "text":
          return html`<p class="fp3d-sub fp3d-wide">${f.text}</p>`;
        case "entity":
          return this.entitySelect(f.label, f.value, f.auto, this.entityOptionsFor(f.filter), (v) => f.set(v));
        case "select":
          return html`<label class="fp3d-field fp3d-wide"
            >${f.label}
            <select ?disabled=${!admin} @change=${(e: Event) => f.set((e.target as HTMLSelectElement).value)}>
              ${f.options.map((o) => html`<option value=${o.id} ?selected=${o.id === f.value}>${o.label}</option>`)}
            </select></label
          >`;
        case "check":
          return html`<label class="fp3d-check fp3d-wide"><input type="checkbox" .checked=${f.value} ?disabled=${!admin} @change=${(e: Event) => f.set((e.target as HTMLInputElement).checked)} /> ${f.label}</label>`;
        case "button":
          return html`<button class="fp3d-btn ${f.primary ? "fp3d-primary" : ""} fp3d-wide" ?disabled=${!admin} title=${f.title ?? ""} @click=${() => f.onTap()}>${f.label}</button>`;
        case "lines":
          return linesField(f.value, !admin, { label: f.label, placeholder: f.placeholder ?? this.t("lines_new"), add: this.t("lines_add"), remove: this.t("delete") }, (v) => f.set(v), true);
      }
    };
    if (!wrap) return fields.map(field);
    return html`<section>
      <div class="fp3d-form fp3d-links">${fields.map(field)}</div>
    </section>`;
  }

  /** A length with its unit for labels: "2,45 m" or 8' 0.5". */
  m(this: Fp3dEditor, v: number, digits = 2): string {
    return lengthText(v, this.unit, (x) => formatNumber(this.hass, x, digits));
  }

  area(this: Fp3dEditor, v: number): string {
    return areaText(Math.abs(v), this.unit, (x) => formatNumber(this.hass, x, 1));
  }

  /** The value of a length input: metres, or feet and inches as text. */
  lenValue(this: Fp3dEditor, v: number): string {
    return this.unit === "imperial" ? formatImperial(v) : String(round(v));
  }

  /** A length typed into an input, in metres (null: not a length). */
  readLen(this: Fp3dEditor, text: string): number | null {
    if (this.unit === "imperial") return parseLength(text, "imperial");
    const v = parseFloat(text.replace(",", "."));
    return Number.isFinite(v) ? v : null;
  }

  /** A length field: a number field in metres, a text field in feet and inches (8' 2", 98in, 2.5m all work). */
  len(this: Fp3dEditor, label: string, value: number, onChange: (v: number) => void, step = 0.01, min?: number) {
    if (this.unit !== "imperial") return this.num(label, value, onChange, step, min);
    const on = this.typedEvents((text) => {
      const v = parseLength(text, "imperial");
      // the value it already has saves nothing (no empty undo step when Enter is followed by a change event)
      if (v !== null && Math.abs(v - value) > 1e-9) onChange(min !== undefined ? Math.max(min, v) : v);
    });
    // rubbish typed shows the old value again once the box is left (typedValue)
    const short = unitLabel(label, "imperial");
    return html`<label class="fp3d-field"
      ><span class="fp3d-field-label" title=${short}>${short}</span>
      <input
        type="text"
        inputmode="text"
        spellcheck="false"
        placeholder="8' 2&quot;"
        title=${this.t("units_formats")}
        .value=${typedValue(this.typed, formatImperial(value))}
        ?disabled=${!this.isEditor}
        @focus=${on.focus}
        @input=${on.input}
        @change=${on.change}
        @keydown=${on.keydown}
        @blur=${on.blur}
    /></label>`;
  }

  /**
   * The listeners of a typed number box; `save` gets the text (and ignores what isn't a number). The saves of one
   * typing run (the box got the cursor, until Enter or leaving it) on the same selection are one undo step (#127).
   */
  typedEvents(this: Fp3dEditor, save: (text: string) => void) {
    const box = (e: Event) => e.target as HTMLInputElement;
    const commit = (text: string, run: number) => {
      const on = [this._furnitureId ? this.selection().join(",") : "", this._deviceId, this._openingId, this._wallId, this._outdoorId, this._roomId, this._vertex];
      this.mergeKey = ["typed", run, ...on].join("|");
      this.mergeWithin = Infinity;
      try {
        save(text);
      } finally {
        this.mergeKey = null;
        this.mergeWithin = undefined;
      }
    };
    return {
      focus: (e: Event) => this.typed.focus(box(e)),
      input: (e: Event) => this.typed.input(box(e), box(e).value, commit),
      change: (e: Event) => this.typed.change(box(e), box(e).value, commit),
      keydown: (e: KeyboardEvent) => {
        if (e.key !== "Enter") return;
        this.typed.enter(box(e), box(e).value, commit);
        this.requestUpdate();
      },
      blur: (e: Event) => {
        this.typed.blur(box(e));
        // the plan's value shows again (-90° typed reads 270°)
        this.requestUpdate();
      },
    };
  }

  /**
   * A number field. Its unit ("(m)", "(°)" at the end of the label) is a suffix inside the input ("1.79 m"), so the
   * label stays short and on one line (#412, CUT-2); the input keeps the whole label as its name.
   */
  num(this: Fp3dEditor, label: string, value: number, onChange: (v: number) => void, step = 0.01, min?: number) {
    const on = this.typedEvents((text) => {
      const v = parseFloat(text.replace(",", "."));
      // the value it already shows saves nothing (no empty undo step when Enter is followed by a change event)
      if (Number.isFinite(v) && v !== round(value)) onChange(v);
    });
    const [short, unit] = splitUnit(label);
    const input = html`<input
      type="number"
      inputmode="decimal"
      step=${step}
      min=${min ?? nothing}
      aria-label=${unit ? label : nothing}
      .value=${typedValue(this.typed, String(round(value)))}
      ?disabled=${!this.isEditor}
      @focus=${on.focus}
      @input=${on.input}
      @change=${on.change}
      @keydown=${on.keydown}
      @blur=${on.blur}
    />`;
    return html`<label class="fp3d-field"
      ><span class="fp3d-field-label" title=${label}>${short}</span>
      ${unit ? html`<span class="fp3d-unit-box">${input}<span class="fp3d-unit" aria-hidden="true">${unit}</span></span>` : input}</label
    >`;
  }

  /**
   * An own symbol for the marker (a Material Design icon name), with a preview. `placeholder`: the icon the thing's
   * kind suggests ("mdi:car"), else none (#408, WORD-5: not a thermometer on every item).
   */
  iconInput(this: Fp3dEditor, value: string | null | undefined, onChange: (v: string | null) => void, placeholder = "") {
    const name = value ? (value.startsWith("mdi:") ? value : `mdi:${value}`) : "";
    // the picker (#327) is a lazy chunk; until it is there the plain text box does the job
    need(loadIconPicker);
    if (customElements.get("fp3d-icon-picker"))
      return html`<div class="fp3d-field fp3d-wide" title=${this.t("marker_icon_hint")}>
        ${this.t("marker_icon")}
        <fp3d-icon-picker .value=${value ?? null} .hass=${this.hass} .label=${this.t("marker_icon")} .placeholder=${placeholder} .searchText=${this.t("icon_search")} .noneText=${this.t("icon_none")} .disabled=${!this.isEditor} @icon-change=${(e: CustomEvent<{ value: string | null }>) => onChange(e.detail.value)}></fp3d-icon-picker>
      </div>`;
    void customElements.whenDefined("fp3d-icon-picker").then(() => this.requestUpdate());
    return html`<label class="fp3d-field fp3d-wide" title=${this.t("marker_icon_hint")}
      >${this.t("marker_icon")}
      <span class="fp3d-icon-row">
        <input type="text" placeholder=${placeholder} .value=${value ?? ""} ?disabled=${!this.isEditor} @change=${(e: Event) => onChange((e.target as HTMLInputElement).value.trim().replace(/^mdi:/, "") || null)} />
        ${name ? unsafeHTML(`<ha-icon icon="${name.replace(/[^a-z0-9:-]/gi, "")}"></ha-icon>`) : nothing}
      </span></label
    >`;
  }

  /** How the marker of a device or furniture item shows in 3D. */
  markerSelect(this: Fp3dEditor, value: MarkerShow | null, onChange: (v: MarkerShow | null) => void) {
    return html`<label class="fp3d-field fp3d-wide" title=${this.t("marker_show_hint")}
      >${this.t("marker_show")}
      <select ?disabled=${!this.isEditor} @change=${(e: Event) => onChange(((e.target as HTMLSelectElement).value || null) as MarkerShow | null)}>
        <option value="" ?selected=${!value}>${this.t("marker_show_auto")}</option>
        ${MARKER_SHOWS.map((m) => html`<option value=${m} ?selected=${m === value}>${this.t(`marker_show_${m}` as I18nKey)}</option>`)}
      </select></label
    >`;
  }

  /**
   * The entities a picker offers (#130): kept until an entity comes or goes or a registry changes. An inline filter is
   * named by its source, so pass whatever else it captures (besides `this`, `hass` and module functions) as `deps`.
   */
  entityOptions(this: Fp3dEditor, filter: (id: string) => boolean, ...deps: unknown[]): EntityOption[] {
    const key = deps.length ? `${filter}|${deps.map(String).join("|")}` : String(filter);
    return this.hassWatch.pause(() => this.optionCache.get(this.rawHass, key, filter));
  }

  /**
   * A value worked out from the plan and Home Assistant's entities (what "automatic" would link): kept while the plan
   * and the registries stay and no entity came or went, so a selection or a state change does not work it out again
   * (it clones the plan's floors and searches every entity, #130).
   */
  keptForPlan<T>(this: Fp3dEditor, key: string, make: () => T): T {
    const hass = this.rawHass;
    // counted once per states object (#392)
    const count = stateCount(hass?.states);
    let m = this.planMemo;
    if (!m || m.doc !== this._doc || m.entities !== hass?.entities || m.devices !== hass?.devices || m.areas !== hass?.areas || m.count !== count)
      m = this.planMemo = { doc: this._doc, entities: hass?.entities, devices: hass?.devices, areas: hass?.areas, count, kept: new Map() };
    if (m.kept.has(key)) return m.kept.get(key) as T;
    const value = this.hassWatch.pause(make);
    m.kept.set(key, value);
    return value;
  }

  /** The entities a picker offers, for a filter that stays the same object (a module's field, a kept filter). */
  entityOptionsFor(this: Fp3dEditor, filter: (id: string) => boolean): EntityOption[] {
    return this.hassWatch.pause(() => this.optionCache.get(this.rawHass, filter, filter));
  }

  /** The HA area of what the side panel edits (#132): the room an item stands in, else the chosen room's. */
  pickerArea(this: Fp3dEditor): string | null {
    const f = this.furnitureItem;
    const roomId = f ? (this.roomAt([f.x, f.z]) ?? this._roomId) : this._roomId;
    return (roomId && this.floor?.rooms.find((r) => r.id === roomId)?.area_id) || null;
  }

  /** A time of day picker (#225) in the profile's 12 or 24 hours; "" is no time. */
  timeField(this: Fp3dEditor, label: string, value: string, disabled: boolean, onChange: (v: string) => void) {
    need(loadTimeField);
    return html`<fp3d-time-field
      .value=${value}
      .hour12=${uses12Hours(this.hass?.locale, this.hass?.language)}
      .clearable=${true}
      .label=${label}
      .hourLabel=${this.t("time_hour")}
      .minuteLabel=${this.t("time_minute")}
      ?disabled=${disabled}
      @change=${(e: CustomEvent<{ value: string }>) => onChange(e.detail.value)}
    ></fp3d-time-field>`;
  }

  /** What an entity reports now, short (#396: "78 %", "On"), for its picker; "" for none or an unknown one. */
  liveValue(this: Fp3dEditor, id: string | null): string {
    const st = id && id !== "none" ? this.hass?.states?.[id] : undefined;
    return st ? stateText(this.hass, st) : "";
  }

  /** `domains`: the link's likely entity domains, best first (#132); with the room's area they lead the list. */
  entitySelect(this: Fp3dEditor,
    label: string,
    value: string | null,
    auto: string | null | undefined,
    options: { id: string; label: string }[],
    onChange: (v: string | null) => void,
    domains: readonly string[] = [],
  ) {
    const autoLabel =
      auto === undefined ? null : auto ? this.t("entity_auto", { name: entityName(this.hass, auto) }) : this.t("entity_auto_none");
    // searchable picker: the fixed choices (automatic, none) first, then the entities filtered as you type
    const fixed = [...(autoLabel !== null ? [{ id: "__auto", label: autoLabel }] : []), { id: "none", label: this.t("entity_none") }];
    const current = value === null ? (autoLabel !== null ? "__auto" : "none") : value;
    return html`<label class="fp3d-field fp3d-wide"
      >${label}
      <fp3d-entity-picker
        .options=${options}
        .fixed=${fixed}
        .value=${current}
        .prefer=${{ area: this.pickerArea(), domains }}
        .groups=${domains.length ? { likely: this.t("picker_likely"), other: this.t("picker_other") } : null}
        .placeholder=${this.t("entity_search")}
        .label=${label}
        .live=${this.liveValue(value)}
        ?disabled=${!this.isEditor}
        @change=${(e: CustomEvent<{ value: string }>) => {
          e.stopPropagation();
          onChange(e.detail.value === "__auto" ? null : e.detail.value);
        }}
      ></fp3d-entity-picker></label
    >`;
  }
}
