// Racks (#113): the rack front view in the item panel, frames, rack cards and the rack sheet.

import { html, nothing } from "lit";
import { entityName } from "../../devices.ts";
import { stateText } from "../../markers.ts";
import type { I18nKey } from "../../i18n.ts";
import { type Furniture } from "../../model.ts";
import { rackLayout, readRackFrame } from "../../rack-frame.ts";
import { fitsDepth, packGearOf, packLooseOf, rackMisfits, rackSpace, readRackGear, type RackSlot } from "../../rack.ts";
import { rackElevation, type RackElevation } from "../../rack-elevation.ts";
import type { RackGearChoice, RackLinker } from "../rack-sheet.ts";
import { slotStatus } from "../../rack-links.ts";
import { fromDevice, rackDeviceOptions, suggestRackLinks } from "../../rack-suggest.ts";
import { defaultRackMetrics, RACK_CARD_MAX, RACK_HOTTEST, RACK_ONLINE, rackMetricOptions, toggleRackMetric } from "../../rack-card.ts";
import { furnitureName } from "../../furniture-names.ts";
import { packItem, packItemName, packType } from "../../packs.ts";
import { rackItemOf } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";
import { need, loadRackSheet } from "./lazy.ts";

/** RacksPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class RacksPart {
  // ------------------------------------------------------------------------------------------ racks (#113)

  /** A placed rack's frame and U layout at its placed size; null for any other item. */
  rackOf(this: Fp3dEditor, f: Furniture) {
    const frame = readRackFrame(rackItemOf(f.type));
    return frame ? { frame, at: rackLayout(frame, Math.max(0.05, f.w), Math.max(0.05, f.d), Math.max(0.005, f.h)) } : null;
  }

  /** A placed rack's front view with its gear (#115); null for any other item. */
  rackElevationOf(this: Fp3dEditor, f: Furniture): RackElevation | null {
    const frame = readRackFrame(rackItemOf(f.type));
    if (!frame) return null;
    const lang = this.hass?.language ?? "en";
    const slots = f.rack?.slots ?? [];
    // linked gear's LEDs (#119): redrawn only when a colour changes
    const hass = this.hass;
    const status = slots.map((s) => (hass ? slotStatus(hass, s) : null));
    const key = JSON.stringify([f.type, f.w, f.d, f.h, f.name ?? "", lang, slots, slots.map((s) => !!packItem(s.type)), status]);
    if (this.elevationMemo?.key === key) return this.elevationMemo.el;
    const el = rackElevation({
      frame,
      size: [f.w, f.d, f.h],
      slots,
      itemOf: packItem,
      nameOf: (s, item) => s.name || packItemName(item, lang),
      title: f.name || furnitureName(this.hass, f.type),
      statusOf: (s) => status[slots.indexOf(s)] ?? null,
    });
    this.elevationMemo = { key, el };
    return el;
  }

  /** The front view in the item panel, when the rack has gear (#115). */
  renderRackElevation(this: Fp3dEditor, f: Furniture) {
    const el = this.rackElevationOf(f);
    if (!el || !el.pieces) return nothing;
    const frame = readRackFrame(rackItemOf(f.type));
    return this.sideFold("rack-front", "", true, this.t("rack_front_view"), this.t("rack_used", { used: el.used, u: frame?.u ?? 0 }), 0, () => html`<div class="fp3d-rack-elev-box">${this.rackElevationPicture(el)}</div>`);
  }

  /**
   * The drawing as one picture, kept while it stays the same (#130): drawn inline it is hundreds of elements, and
   * styling and laying them out made selecting a rack twice as slow as any other item. A box per piece of gear keeps
   * its name as a tooltip.
   */
  rackElevationPicture(this: Fp3dEditor, el: RackElevation) {
    const pct = (v: number, of: number) => `${Math.round((v / of) * 10000) / 100}%`;
    return html`<div class="fp3d-rack-elev-pic">
      <img class="fp3d-rack-elev-img" src=${`data:image/svg+xml;charset=utf-8,${encodeURIComponent(el.svg)}`} width=${el.width} height=${el.height} alt=${el.label} />
      ${el.gear.map(
        (g) => html`<span class="fp3d-rack-elev-tip" title=${g.title} style="left:${pct(g.x, el.width)};top:${pct(g.y, el.height)};width:${pct(g.w, el.width)};height:${pct(g.h, el.height)}"></span>`,
      )}
    </div>`;
  }

  /** Open the chosen rack's sheet. */
  openRackSheet(this: Fp3dEditor): void {
    const f = this.furnitureItem;
    if (f && this.rackOf(f)) this._rackSheet = f.id;
  }

  /** The rules' view of a placed rack: its room, and the gear and loose-gear lookups (plan copies first). */
  rackRules(this: Fp3dEditor, f: Furniture) {
    const rack = this.rackOf(f);
    if (!rack) return null;
    return { rack, space: rackSpace(rack.frame, rack.at), gearOf: packGearOf(rackItemOf), looseOf: packLooseOf(rackItemOf) };
  }

  /** What the open rack sheet shows (null: none open, or its rack is gone). */
  rackSheetProps(this: Fp3dEditor) {
    const f = this._rackSheet ? this.floor?.furniture.find((o) => o.id === this._rackSheet) : undefined;
    const rules = f && this.rackRules(f);
    if (!f || !rules) return null;
    const { rack, space, gearOf, looseOf } = rules;
    const lang = this.hass?.language ?? "en";
    const gear: RackGearChoice[] = [];
    // loose gear for shelves (#114): small electric things of the network and tech groups, no racks, no rack gear
    const loose: RackGearChoice[] = [];
    const opening = rack.at.opening;
    for (const pack of this.packs ?? [])
      for (const it of pack.items) {
        const g = readRackGear(it);
        const type = packType(pack.id, it.id);
        if (g && g.inch === space.width && fitsDepth(space, it.size[1])) gear.push({ type, name: packItemName(it, lang) });
        else if (!g && !it.rack_frame && it.electric && (it.group === "network" || it.group === "tech") && it.mount !== "ceiling" && it.size[0] <= opening && it.size[1] <= space.mountDepth && it.size[2] <= 0.3)
          loose.push({ type, name: packItemName(it, lang) });
      }
    gear.sort((a, b) => a.name.localeCompare(b.name));
    loose.sort((a, b) => a.name.localeCompare(b.name));
    return {
      heading: f.name || furnitureName(this.hass, f.type),
      space,
      labels: rack.at.units.map((u) => u.label),
      slots: f.rack?.slots ?? [],
      gear,
      loose,
      gearOf,
      looseOf,
      nameOf: (type: string) => furnitureName(this.hass, type),
      editable: this.isEditor,
      linker: this.rackLinker(),
    };
  }

  /** What the rack sheet links gear with (#119): HA's entities and devices, a device's status and values, suggestions. */
  rackLinker(this: Fp3dEditor): RackLinker | null {
    const hass = this.hass;
    if (!hass) return null;
    const count = Object.keys(hass.states).length;
    const memo = this.rackDevicesMemo;
    if (!memo || memo.entities !== hass.entities || memo.devices !== hass.devices || memo.count !== count)
      this.rackDevicesMemo = { entities: hass.entities, devices: hass.devices, count, options: rackDeviceOptions(hass) };
    return {
      entities: this.entityOptions(this.anyEntity),
      devices: this.rackDevicesMemo!.options,
      fromDevice: (device) => fromDevice(hass, device),
      suggest: (slot) => suggestRackLinks(hass, slot),
      label: (id) => entityName(hass, id),
      status: (slot) => slotStatus(hass, slot),
    };
  }

  /** The racks a placed rack can become (#114): every pack's racks that hang where it does (wall or not). */
  rackFrameChoices(this: Fp3dEditor, f: Furniture): { type: string; name: string }[] {
    const lang = this.hass?.language ?? "en";
    const wall = rackItemOf(f.type)?.mount === "wall";
    const out: { type: string; name: string }[] = [];
    for (const pack of this.packs ?? [])
      for (const it of pack.items) if (readRackFrame(it) && (it.mount === "wall") === wall) out.push({ type: packType(pack.id, it.id), name: packItemName(it, lang) });
    return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  /** Swap the chosen rack for another rack type (#114): its size becomes the new rack's, its gear stays (one undo step). */
  changeRackFrame(this: Fp3dEditor, type: string): void {
    const f = this.furnitureItem;
    const item = rackItemOf(type);
    if (!f || !this.isEditor || !item || !readRackFrame(item) || !this.rackOf(f)) return;
    const [w, d, h] = item.size;
    this.updateFurniture({ type, w, d, h });
  }

  /** The chosen rack's frame picker and the gear that no longer fits it (#114). */
  renderRackFrameForm(this: Fp3dEditor, f: Furniture) {
    const rules = this.rackRules(f);
    if (!rules) return nothing;
    const misfits = rackMisfits(rules.space, f.rack?.slots ?? [], rules.gearOf, rules.looseOf);
    const choices = this.rackFrameChoices(f);
    return html`${this.isEditor && choices.length > 1
      ? html`<div class="fp3d-form">
          <label class="fp3d-field fp3d-wide"
            >${this.t("rack_frame_pick")}
            <select @change=${(e: Event) => this.changeRackFrame((e.target as HTMLSelectElement).value)}>
              ${choices.map((c) => html`<option value=${c.type} ?selected=${c.type === f.type}>${c.name}</option>`)}
            </select></label
          >
        </div>`
      : nothing}
    ${misfits.length
      ? html`<p class="fp3d-sub fp3d-pack-error" role="alert">
          ${this.t("rack_misfits", { n: misfits.length })}
          ${misfits.map((m) => {
            const s = f.rack!.slots.find((o) => o.id === m.id)!;
            return html`<br />${s.name || furnitureName(this.hass, s.type)}: ${this.t(`rack_${m.why}` as I18nKey)}`;
          })}
        </p>`
      : nothing}`;
  }

  /** The values a rack's card shows now (#120): the editors' pick, else the default set. */
  rackCardPicked(this: Fp3dEditor, f: Furniture): string[] {
    return f.rack?.card?.metrics ?? defaultRackMetrics(this.hass, f.rack?.slots ?? []);
  }

  /** Ticks or unticks a value on the chosen rack's card (one undo step); the first change starts from the default set. */
  toggleRackCardMetric(this: Fp3dEditor, key: string): void {
    const f = this.furnitureItem;
    if (!f?.rack || !this.isEditor) return;
    const metrics = toggleRackMetric(f.rack.card?.metrics, defaultRackMetrics(this.hass, f.rack.slots), key);
    this.change((_, floor) => {
      const item = floor.furniture.find((o) => o.id === f.id);
      if (item?.rack) item.rack = { ...item.rack, card: { ...item.rack.card, metrics } };
    });
  }

  /** The chosen rack's card goes back to the default set (one undo step). */
  resetRackCard(this: Fp3dEditor): void {
    const f = this.furnitureItem;
    if (!f?.rack?.card || !this.isEditor) return;
    this.change((_, floor) => {
      const item = floor.furniture.find((o) => o.id === f.id);
      if (item?.rack) {
        const { card: _card, ...rest } = item.rack;
        item.rack = rest;
      }
    });
  }

  /**
   * The rack card's values (#120): what the rack's linked gear offers, grouped by device and kind, ticked when on the
   * card (at most RACK_CARD_MAX; the default set until an editor changes it).
   */
  renderRackCardForm(this: Fp3dEditor, f: Furniture) {
    const hass = this.hass;
    const slots = f.rack?.slots ?? [];
    if (!hass || !slots.length) return nothing;
    const groups = rackMetricOptions(hass, slots, (s) => s.name || furnitureName(hass, s.type ?? ""));
    if (!groups.length) return nothing;
    const picked = this.rackCardPicked(f);
    const full = picked.length >= RACK_CARD_MAX;
    const ro = !this.isEditor;
    const label = (key: string, kind: string) =>
      key === RACK_HOTTEST ? this.t("rack_card_hottest") : key === RACK_ONLINE ? this.t("rack_card_online") : kind === "other" ? entityName(hass, key) : this.t(`rack_kind_${kind}` as I18nKey);
    return this.sideFold("rack-card", "", false, this.t("rack_card_values", { n: picked.length, max: RACK_CARD_MAX }), "", 0, () => html`<div class="fp3d-rack-card-pick"><p class="fp3d-sub">${this.t("rack_card_values_hint")}</p>
      ${groups.map(
        (g) => html`<fieldset class="fp3d-rack-card-group">
          <legend>${g.name ?? this.t("rack_card_rack")}</legend>
          ${g.options.map((o) => {
            const on = picked.includes(o.key);
            return html`<label class="fp3d-check"
              ><input type="checkbox" .checked=${on} ?disabled=${ro || (!on && full)} @change=${() => this.toggleRackCardMetric(o.key)} />
              <span>${label(o.key, o.kind)}${o.key.startsWith("@") ? nothing : html` <small>${o.kind === "other" ? "" : entityName(hass, o.key)} · ${stateText(hass, hass.states[o.key])}</small>`}</span></label
            >`;
          })}
        </fieldset>`,
      )}
      ${f.rack?.card && !ro ? html`<button class="fp3d-btn" @click=${() => this.resetRackCard()}>${this.t("rack_card_default")}</button>` : nothing}</div>`);
  }

  /** The sheet changed the rack's gear: one undo step on the placed rack. */
  onRackChange(this: Fp3dEditor, e: Event): void {
    const id = this._rackSheet;
    const slots = (e as CustomEvent<{ slots: RackSlot[] }>).detail.slots;
    if (!id || !this.isEditor) return;
    this.change((_, floor) => {
      const item = floor.furniture.find((f) => f.id === id);
      if (item) item.rack = { ...item.rack, slots };
    });
  }

  renderRackSheet(this: Fp3dEditor) {
    const p = this.rackSheetProps();
    if (!p) return nothing;
    need(loadRackSheet);
    return html`<fp3d-rack-sheet
      .heading=${p.heading}
      .space=${p.space}
      .labels=${p.labels}
      .slots=${p.slots}
      .gear=${p.gear}
      .loose=${p.loose}
      .gearOf=${p.gearOf}
      .looseOf=${p.looseOf}
      .nameOf=${p.nameOf}
      .editable=${p.editable}
      .linker=${p.linker}
      .t=${(key: string, vars?: Record<string, string | number>) => this.t(key as I18nKey, vars)}
      @rack-change=${(e: Event) => this.onRackChange(e)}
      @rack-close=${() => (this._rackSheet = null)}
    ></fp3d-rack-sheet>`;
  }
}
