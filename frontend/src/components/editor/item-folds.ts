// The item panel by kind profile (#397, option A): the main section of each kind and the bodies and summary lines of
// the folds (Appearance, Size, Occupancy sensor / Glow, Screen pictures, Energy, Taps and visibility, More options).
// The fields themselves are item-form.ts's; the frame (header, Position, folds) is item-sections.ts's.

import { html, nothing } from "lit";
import { energySensorFor } from "../../wire-ends.ts";
import { itemColourRoles, roleColour } from "../../colour-roles.ts";
import { presetKey } from "../../colour-parts.ts";
import { furnitureName } from "../../furniture-names.ts";
import { type I18nKey } from "../../i18n.ts";
import { itemProfile, type ItemProfile, type PanelFold } from "../../item-profile.ts";
import { GESTURES } from "../../item-actions.ts";
import { isLamp, type Furniture } from "../../model.ts";
import { isElectric, packInfo } from "../../packs.ts";
import { isPackBin, isPackPlant } from "../../household.ts";
import { isVehicleItem } from "../../furniture-links.ts";
import { volumeMeter } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";

/** Pack families and tags of a circuit monitor or a CT clamp (the double-count warning only means something with one). */
const CIRCUIT_MONITOR = /(circuit|ct_clamp|ct clamp|consumer_unit|consumer unit|emporia|shelly_em|shelly em|iotawatt|energy monitor)/i;

/** The icon an item's kind suggests (#408, WORD-5): the placeholder of its own icon; none where no one icon fits. */
export function kindIcon(kind: ItemProfile["kind"]): string {
  const icons: Partial<Record<ItemProfile["kind"], string>> = {
    car: "mdi:car",
    parking: "mdi:car",
    lamp: "mdi:lamp",
    screen: "mdi:television",
    bed: "mdi:bed",
    seating: "mdi:sofa",
    energy: "mdi:lightning-bolt",
    switch: "mdi:power-socket",
    stairs: "mdi:stairs",
    camera: "mdi:cctv",
    heating: "mdi:radiator",
    network: "mdi:server-network",
    printer: "mdi:printer-3d",
  };
  return icons[kind] ?? "";
}

const linked = (v: unknown): boolean => typeof v === "string" && !!v && v !== "none";

/**
 * The folds an item shows: its kind's, plus Energy where a power sensor is set already although the kind has none
 * (#414: a kind drops fields that cannot apply, but never hides a link that is set). A floor opening keeps Size only.
 */
export function itemFolds(f: Pick<Furniture, "power">, p: ItemProfile): PanelFold[] {
  if (p.kind === "opening" || p.folds.includes("energy") || !linked(f.power)) return p.folds;
  const at = p.folds.indexOf("taps");
  return at < 0 ? [...p.folds, "energy"] : [...p.folds.slice(0, at), "energy", ...p.folds.slice(at)];
}

/** ItemFoldsPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class ItemFoldsPart {
  /** The item panel (#396, #397): header, Position, the kind's main section, then its closed folds. */
  renderFurnitureForm(this: Fp3dEditor, f: Furniture) {
    if (this.selection().length > 1 || this._multiOut.length) return this.renderBlockForm();
    const p = itemProfile(f.type);
    return html`<section class="fp3d-item-panel" data-kind=${p.kind}>
      ${this.renderItemHeader(f, p)} ${this.renderItemPosition(f)}
      ${f.group
        ? html`<p class="fp3d-sub fp3d-block-note">▣ ${this.t("block_part")} <button class="fp3d-link" @click=${() => {
            this._single = false;
            this.requestUpdate();
          }}>${this.t("block_select")}</button></p>`
        : nothing}
      ${this.renderItemMain(f, p)} ${this.renderModuleFurnitureFields(f)}
      ${this.rackOf(f) ? this.renderRackFrameForm(f) : nothing} ${this.renderRackElevation(f)} ${this.renderRackCardForm(f)}
      ${this.rackOf(f) ? html`<div class="fp3d-actions"><button class="fp3d-btn" @click=${() => this.openRackSheet()}>▤ ${this.t("rack_edit")}</button></div>` : nothing}
      ${itemFolds(f, p).map((fold) => this.renderItemFold(f, p, fold))}
    </section>`;
  }

  /** The kind's main section, open under Position: the car, the parking spot, the lamp's or device's links, the bin … */
  renderItemMain(this: Fp3dEditor, f: Furniture, p: ItemProfile) {
    switch (p.main) {
      case "car":
        return this.renderCarMain(f, true);
      case "parking":
        return html`<section class="fp3d-link-block"><h3>${this.t("item_kind_parking")}</h3>${this.renderParkingForm(f)}</section>`;
      case "lamp":
      case "device": {
        if (!this.hass) return nothing;
        return html`<section class="fp3d-link-block" aria-labelledby="fp3d-main-h">
          <div class="fp3d-h3row"><h3 id="fp3d-main-h">${this.t(p.main === "lamp" ? "link_light" : "link_device")}</h3></div>
          ${this.renderFurnitureLinks(f)}
        </section>`;
      }
      case "household":
        return html`${f.type === "waste_bin" ? this.renderBinKerb(f) : nothing}${this.renderHouseholdForm(f)}`;
      case "switch":
        return this.renderGangsForm(f);
      case "tech":
        return this.renderTechForm(f);
      case "stairs":
        return html`<section>
          ${f.type === "stairs" ? html`<p class="fp3d-sub">${this.t("stairs_hint")}</p>${this.renderStairOptions(f)}` : nothing}
          ${f.type === "stairs_u" ? html`<p class="fp3d-sub">${this.t("stairs_u_hint")}</p>` : nothing}
          ${f.type === "stairwell" ? this.renderStairwellNote(f) : nothing}
        </section>`;
      default:
        // a kitchen unit linked before #414 keeps its link where it can be changed or set to none
        if (p.kind === "kitchen" && linked(f.entity) && this.hass)
          return html`<section class="fp3d-link-block" aria-labelledby="fp3d-main-h">
            <div class="fp3d-h3row"><h3 id="fp3d-main-h">${this.t("link_device")}</h3></div>
            ${this.renderFurnitureLinks(f)}
          </section>`;
        // a plant's moisture; a bin from a pack says where its kerb spot and calendar are (#170)
        return f.type === "plant" || isPackPlant(f.type) || isPackBin(f.type) ? this.renderHouseholdExtras(f) : nothing;
    }
  }

  /** One fold of the profile, with its title, summary and badge. */
  renderItemFold(this: Fp3dEditor, f: Furniture, p: ItemProfile, fold: PanelFold) {
    const [summary, set] = this.foldSummary(f, p, fold);
    const title =
      fold === "glow"
        ? this.t(p.kind === "seating" || p.kind === "bed" ? "fold_occupancy" : "fold_glow")
        : this.t(`fold_${fold}` as I18nKey);
    return this.renderFold(p, fold, title, summary, set, () => this.foldBody(f, p, fold));
  }

  /** What a closed fold shows: its set values in one line, and how many are set (#396 rule 13: never hide data). */
  foldSummary(this: Fp3dEditor, f: Furniture, p: ItemProfile, fold: PanelFold): [string, number] {
    const ref = (v: unknown) => typeof v === "string" && !!v && v !== "none";
    const join = (parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" · ");
    switch (fold) {
      case "appearance": {
        const roles = itemColourRoles(f.type);
        const own = roles.map((r) => roleColour(f.colors, r)).filter((c): c is string => !!c);
        const names = own.map((hex) => {
          const key = presetKey(hex);
          return key ? this.t(key as I18nKey) : this.t("colour_own");
        });
        const materials = Object.keys(f.materials ?? {}).length;
        // the glow colour is with the link now (#410), not a part
        const set = own.length + materials + (f.variant && !isVehicleItem(f.type) ? 1 : 0);
        return [join([furnitureName(this.hass, f.type), ...[...new Set(names)]]), set];
      }
      case "size": {
        // a hole in the floor has no height
        const size = (p.kind === "opening" ? [f.w, f.d] : [f.w, f.d, f.h]).map((v) => this.m(v)).join(" × ");
        return [join([size, this._doc.floors.length > 1 && this.floor?.name, f.mirror && p.mirror && this.t("item_mirrored")]), (f.mirror && p.mirror ? 1 : 0) + (f.mount_y != null ? 1 : 0)];
      }
      case "glow": {
        const n = (ref(f.state_entity) ? 1 : 0) + (ref(f.state_entity2) ? 1 : 0);
        return [n ? join([this.linkName(f.state_entity), this.linkName(f.state_entity2)]) : this.t(p.kind === "seating" || p.kind === "bed" ? "glow_hint_seat" : "glow_hint_on"), n];
      }
      case "screen": {
        const n = (f.pictures ?? []).length;
        return [n ? this.t("pictures_n", { n }) : this.t("pictures_none"), n];
      }
      case "energy": {
        const power = ref(f.power) ? (f.power as string) : null;
        const now = power ? this.hass?.states[power] : undefined;
        const set = [power, f.run_w, f.circuit, f.energy, f.holo].filter((v) => (typeof v === "string" ? ref(v) : !!v)).length;
        if (!power) return [this.t("energy_none"), set];
        return [join([this.linkName(power), now && this.t("energy_now", { value: `${now.state} ${String(now.attributes.unit_of_measurement ?? "")}`.trim() })]), set];
      }
      case "taps": {
        const own = GESTURES.filter((g) => f.actions?.[g]).length;
        const set = own + (f.show_when ? 1 : 0) + (f.confirm ? 1 : 0);
        return [join([own ? this.t("taps_own", { n: own }) : this.t("taps_default"), f.show_when ? this.t("shown_rule") : this.t("shown_always"), f.confirm && this.t("device_confirm")]), set];
      }
      case "more": {
        const parts: string[] = [];
        if (f.name) parts.push(f.name);
        if (f.aliases?.length) parts.push(f.aliases.join(", "));
        if (f.show_name) parts.push(this.t("more_name_3d"));
        if (ref(f.extra) && !volumeMeter(f.type)) parts.push(this.linkName(f.extra));
        if (f.marker || f.icon) parts.push(this.t("marker_show"));
        if (!p.folds.includes("glow") && ref(f.state_entity)) parts.push(this.t("furn_state_entity"));
        if (ref(f.service)) parts.push(this.linkName(f.service));
        return [parts.length ? parts.join(" · ") : this.t("more_none"), parts.length];
      }
    }
  }

  /** The fields inside an open fold. */
  foldBody(this: Fp3dEditor, f: Furniture, p: ItemProfile, fold: PanelFold) {
    switch (fold) {
      case "appearance":
        return html`<div class="fp3d-form">${this.furnitureField(f, "type")}${this.renderModelSelect(f)}</div>
          ${this.renderColourRoles(f)}`;
      case "size":
        // a floor opening: its width and depth only (#414, MANY-8)
        if (p.kind === "opening") return html`<div class="fp3d-form">${this.furnitureField(f, "w")} ${this.furnitureField(f, "d")}</div>`;
        return html`<div class="fp3d-form">
          ${this.furnitureField(f, "w")} ${this.furnitureField(f, "d")} ${this.furnitureField(f, "h")}
          ${this.furnitureField(f, "mount")} ${p.mirror ? this.furnitureField(f, "mirror") : nothing} ${f.type === "led_strip" ? this.furnitureField(f, "strip") : nothing}
          ${this._doc.floors.length > 1 ? this.furnitureField(f, "floor") : nothing}
        </div>`;
      case "glow":
        return html`<div class="fp3d-form fp3d-links">${this.renderStateLinks(f, p)}</div>`;
      case "screen":
        return this.renderPictureRules(f);
      case "energy":
        return this.renderEnergyFields(f);
      case "taps": {
        // "Ask before switching" where the kind switches something, or where it is set already (#414);
        // Tap, Hold and Double tap behind one "Taps: Default" row (#413, MANY-6): rarely changed, so closed
        const own = GESTURES.filter((g) => f.actions?.[g]).length;
        return html`${(p.confirm || f.confirm) && isElectric(f.type) && (!isLamp(f.type) || f.entity) ? html`<div class="fp3d-form">${this.confirmField(f)}</div>` : nothing}
          ${this.sideFold("taps-gestures", f.id, false, this.t("taps_row"), own ? this.t("taps_own", { n: own }) : this.t("item_action_default"), own, () =>
            this.renderItemActions(f.actions, f.entity && f.entity !== "none" ? f.entity : null, (a) => this.updateFurniture({ actions: a })),
          )}
          ${this.renderShowWhen(f)}`;
      }
      case "more": {
        const electric = isElectric(f.type);
        const lamp = isLamp(f.type);
        return html`<div class="fp3d-form">
            ${this.furnitureField(f, "name")} ${this.furnitureField(f, "show_name")} ${this.furnitureField(f, "aliases")}
            ${electric && !lamp && !volumeMeter(f.type) && f.type !== "grid_point"
              ? this.entitySelect(this.t("furn_extra"), f.extra ?? null, undefined, this.entityOptions((id) => id.startsWith("sensor.")), (v) => this.updateFurniture({ extra: v === "none" ? null : v }))
              : nothing}
            ${(p.glow || linked(f.state_entity)) && !p.folds.includes("glow") ? html`<div class="fp3d-form fp3d-links fp3d-wide">${this.renderStateLinks(f, p)}</div>` : nothing}
            ${electric && (!lamp || f.entity) ? html`${this.markerSelect(f.marker ?? null, (v) => this.updateFurniture({ marker: v }))}${this.iconInput(f.icon, (v) => this.updateFurniture({ icon: v }), kindIcon(p.kind))}` : nothing}
          </div>
          ${(p.consumable || linked(f.service)) && electric ? this.renderServiceFields(f) : nothing}`;
      }
    }
  }

  /** The model of an inverter, home battery or pendant (#132): part of its appearance. */
  renderModelSelect(this: Fp3dEditor, f: Furniture) {
    const admin = this.isEditor;
    const choose = (label: string, values: readonly string[], key: (v: string) => I18nKey) => html`<label class="fp3d-field fp3d-wide"
      >${label}
      <select ?disabled=${!admin} @change=${(e: Event) => this.updateFurniture({ variant: (e.target as HTMLSelectElement).value || null })}>
        ${values.map((v) => html`<option value=${v} ?selected=${(f.variant ?? "") === v}>${this.t(key(v))}</option>`)}
      </select></label
    >`;
    if (f.type === "inverter") return choose(this.t("furn_model"), ["", "slim", "hybrid"], (v) => `inverter_${v || "std"}` as I18nKey);
    if (f.type === "home_battery") return choose(this.t("furn_model"), ["", "wall", "cube"], (v) => `battery_${v || "std"}` as I18nKey);
    if (f.type === "lamp_pendant") return choose(this.t("pendant_shape"), ["", "globe", "cone", "drum"], (v) => `pendant_${v || "shade"}` as I18nKey);
    return nothing;
  }

  /** "Ask before switching", with its help behind "i". */
  confirmField(this: Fp3dEditor, f: Furniture) {
    return this.withInfo(
      html`<label class="fp3d-check"
        ><input type="checkbox" .checked=${!!f.confirm} ?disabled=${!this.isEditor} @change=${(ev: Event) => this.updateFurniture({ confirm: (ev.target as HTMLInputElement).checked })} />
        ${this.t("device_confirm")}</label
      >`,
      "device_confirm_hint",
      this.t("device_confirm"),
    );
  }

  /**
   * The Energy fold (#397): every power field of an appliance or a car. Plain labels ("Fuse circuit", "Counts as on
   * above"); the double-count warning only when the home has a circuit monitor.
   */
  renderEnergyFields(this: Fp3dEditor, f: Furniture) {
    if (!this.hass) return nothing;
    const hass = this.hass;
    const autoPick = this.autoFurnitureLink(f, "power");
    const power = f.power && f.power !== "none" ? f.power : null;
    const sensors = this.entityOptions((id) => this.isPowerSensor(id));
    return html`<div class="fp3d-form fp3d-links">
      ${this.entitySelect(this.t("furn_power"), f.power ?? null, autoPick, sensors, (v) => this.updateFurniture({ power: v }))}
      ${power
        ? html`${this.withInfo(
              html`<label class="fp3d-field"
                >${this.t("furn_run_w")}
                <input type="number" min="1" max="5000" step="5" placeholder="10" .value=${f.run_w ? String(f.run_w) : ""} ?disabled=${!this.isEditor}
                  @change=${(ev: Event) => {
                    const v = Number((ev.target as HTMLInputElement).value);
                    this.updateFurniture({ run_w: v > 0 ? Math.min(5000, Math.round(v)) : null });
                  }} /></label
              >`,
              "furn_run_w_hint",
              this.t("furn_run_w"),
            )}
            ${this.withInfo(
              this.entitySelect(this.t("energy_circuit"), f.circuit ?? "none", undefined, sensors.filter((o) => o.id !== power), (v) => this.updateFurniture({ circuit: v && v !== "none" ? v : null })),
              "energy_circuit_hint",
              this.t("energy_circuit"),
            )}
            ${!f.circuit && this.homeHasCircuitMonitor() ? html`<p class="fp3d-sub fp3d-wide fp3d-warn">${this.t("energy_circuit_unset")}</p>` : nothing}
            ${this.withInfo(
              this.entitySelect(this.t("energy_wire_sensor"), f.energy ?? null, energySensorFor(hass, power), this.entityOptions((id) => id.startsWith("sensor.") && hass.states[id]?.attributes.device_class === "energy"), (v) => this.updateFurniture({ energy: v })),
              "energy_wire_sensor_hint",
              this.t("energy_wire_sensor"),
            )}`
        : nothing}
      ${this.holoField(f)}
    </div>`;
  }

  /** "Show a power card above it" (the energy hologram), with its help behind "i". */
  holoField(this: Fp3dEditor, f: Furniture) {
    return this.withInfo(
      html`<label class="fp3d-check"
        ><input type="checkbox" .checked=${!!f.holo} ?disabled=${!this.isEditor} @change=${(ev: Event) => this.updateFurniture({ holo: (ev.target as HTMLInputElement).checked })} />
        ${this.t("furn_holo")}</label
      >`,
      "furn_holo_hint",
      this.t("furn_holo"),
    );
  }

  /** The home has a circuit monitor: an item or device inside a circuit, or a monitor or CT clamp from a pack. */
  homeHasCircuitMonitor(this: Fp3dEditor): boolean {
    return this.keptForPlan("circuit-monitor", () =>
      this._doc.floors.some(
        (fl) =>
          fl.furniture.some((m) => !!m.circuit || CIRCUIT_MONITOR.test(`${packInfo(m.type)?.family ?? ""} ${(packInfo(m.type)?.tags ?? []).join(" ")}`)) ||
          fl.placements.some((pl) => !!pl.circuit),
      ),
    );
  }
}
