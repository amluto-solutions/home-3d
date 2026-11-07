// The energy tool: cables, energy markers, the energy panel, hologram settings, checklist, energy devices, the
// meter, circuit and wiring pickers and the energy balance.

import { html, nothing, svg } from "lit";
import { entityName, furnitureEntities } from "../../devices.ts";
import { snapToWall } from "../../geometry/snap.ts";
import { deviceSensors, energySummary, flowSegments, gridPoint, proposeEnergySensors, type EnergyPrefs, type FlowSegment, proposeMeters } from "../../energy.ts";
import { energySensorFor } from "../../wire-ends.ts";
import { ON_OFF_RATE, ratesFromSensors, tariffStates } from "../../cheap-rate.ts";
import { prefsRates, type EnergyInfo, type RatePrefs } from "../../energy-rates.ts";
import { formatNumber } from "../../i18n-core.ts";
import { need, loadMultiSelect } from "./lazy.ts";
import type { EntityOption } from "../../entity-options.ts";
import { type I18nKey } from "../../i18n.ts";
import { centroid, ENERGY_DEVICES, DEFAULT_HOLOGRAM, type HologramSettings, signedArea, pointInPolygon, uid, type Building, type EnergySystem, MAX_ENERGY_SYSTEMS, type Floor, type Furniture, type SolarField, type Room, type Vec2 } from "../../model.ts";
import { energyRole, furnitureSize, packInfo, packItemName } from "../../packs.ts";
import { round, isEnergyDevice, numberish } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";

/** The two ways a grid or battery sensor can count (#423): the default (no inversion) first. */
export const SIGN_CHOICES = {
  grid: ["energy_grid_sign_import", "energy_grid_sign_export"],
  battery: ["energy_battery_sign_discharge", "energy_battery_sign_charge"],
} as const satisfies Record<"grid" | "battery", readonly [I18nKey, I18nKey]>;

/** EnergyPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class EnergyPart {
  /** Energy tool: a round marker with a symbol and its name on every energy device of the floor, above all else. */
  /** The cables' ways (with a still picture of the flows: all sensors at zero), once per document. */
  cableSegments(this: Fp3dEditor): FlowSegment[] {
    if (this.cableCache?.doc === this._doc) return this.cableCache.segs;
    const b = this._doc;
    const fieldPower = new Map((b.settings.roof.solar ?? []).map((f) => [f.id, 0]));
    const summary = { grid: 0, solar: 0, battery: 0, soc: null, tariff: null, consumption: 0 };
    let segs: FlowSegment[] = [];
    try {
      segs = flowSegments({ building: b, consumers: [], summary, fieldPower }).filter((x) => x.key);
    } catch {
      segs = [];
    }
    this.cableCache = { doc: b, segs };
    return segs;
  }

  /** The cables by key, in order: solar fields, inverters, batteries, the grid. */
  cableKeys(this: Fp3dEditor): string[] {
    const keys = [...new Set(this.cableSegments().map((x) => x.key!))];
    const rank = (k: string) => (k.startsWith("solar:") ? 0 : k.startsWith("inv:") ? 1 : k.startsWith("bat:") ? 2 : 3);
    return keys.sort((p, q) => rank(p) - rank(q) || p.localeCompare(q));
  }

  /** What a cable key means to the user: "Solar field 1 → Inverter north". */
  cableLabel(this: Fp3dEditor, key: string): string {
    const furn = (id: string) => {
      const m = this._doc.floors.flatMap((f) => f.furniture).find((x) => x.id === id);
      return m ? m.name || this.typeName(m.type) : "?";
    };
    const meter = this._doc.floors.flatMap((f) => f.furniture).find((x) => energyRole(x.type) === "meter");
    const meterName = meter ? meter.name || this.t("furn_meter") : this.t("energy_meter");
    if (key === "grid") return `${meterName} → ${this.t("furn_grid_point")}`;
    const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    if (kind === "solar") {
      const fields = this._doc.settings.roof.solar ?? [];
      const i = fields.findIndex((f) => f.id === id);
      // a solar panel placed as an item (#22)
      if (i < 0 && this._doc.floors.some((fl) => fl.furniture.some((m) => m.id === id))) return `${furn(id)} → ${this.t("furn_inverter")}`;
      const f = fields[i];
      return `${f?.name || `${this.t("solar_field")} ${i + 1}`} → ${this.t("furn_inverter")}`;
    }
    if (kind === "inv") return `${furn(id)} → ${meterName}`;
    return `${this.t("furn_inverter")} ↔ ${furn(id)}`;
  }

  /** Lay a cable by hand: its automatic way (on the plan) becomes points to drag. */
  layCable(this: Fp3dEditor, key: string): void {
    if (!this.isEditor || !this._floorId) return;
    const pts: Vec2[] = [];
    for (const seg of this.cableSegments().filter((x) => x.key === key)) {
      for (const q of [seg.a, seg.b]) {
        const p: Vec2 = [round(q[0]), round(q[2])];
        const last = pts[pts.length - 1];
        if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 0.05) pts.push(p);
      }
    }
    // the ends are the devices themselves: only the way between them is laid
    const inner = pts.length > 2 ? pts.slice(1, -1) : pts;
    const floorId = this._floorId;
    this.change((d) => {
      d.settings.roof.cables = [...(d.settings.roof.cables ?? []).filter((c) => c.id !== key), { id: key, floor_id: floorId, points: inner.length ? inner : [pts[0] ?? [0, 0]], height: 0.03 }];
    });
    this._cableId = key;
  }

  /** The cables in the plan: faint for the automatic ways, solid for laid ones, with points on the picked cable. */
  renderCables(this: Fp3dEditor) {
    const all = this.cableSegments();
    if (!all.length) return nothing;
    const segs = all.filter((x) => x.floorId === this._floorId);
    const cables = this._doc.settings.roof.cables ?? [];
    const sel = this._cableId;
    const keys = [...new Set(all.map((x) => x.key!))];
    return svg`<g class="fp3d-cable-layer">${keys.map((key) => {
      const laid = cables.find((c) => c.id === key);
      const cls = `fp3d-cable fp3d-cable-${key.split(":")[0]}${laid ? " fp3d-cable-laid" : ""}${key === sel ? " fp3d-cable-sel" : ""}`;
      const mine = all.filter((x) => x.key === key);
      const lines = segs
        .filter((x) => x.key === key)
        .map((x) => {
          const a = this.toScreen([x.a[0], x.a[2]]);
          const b = this.toScreen([x.b[0], x.b[2]]);
          return svg`<line x1=${a[0]} y1=${a[1]} x2=${b[0]} y2=${b[1]} />`;
        });
      if (!(laid && key === sel && laid.floor_id === this._floorId && !laid.locked)) return lines.length ? svg`<g class=${cls} data-cable=${key}><g class="fp3d-cable-hit">${lines}</g>${lines}</g>` : nothing;
      // the picked laid cable: its points to drag; every piece from device to device takes new points
      const first = mine[0];
      const last = mine[mine.length - 1];
      const chain = [this.toScreen([first.a[0], first.a[2]]), ...laid.points.map((p) => this.toScreen(p)), this.toScreen([last.b[0], last.b[2]])];
      const pieces = chain.slice(0, -1).map((p, i) => svg`<line class="fp3d-cable-piece" data-cable-line=${key} data-cable-seg=${i} x1=${p[0]} y1=${p[1]} x2=${chain[i + 1][0]} y2=${chain[i + 1][1]} />`);
      const handles = laid.points.map((p, i) => {
        const q = this.toScreen(p);
        return svg`<g class="fp3d-vertex" data-cable-pt=${`${key}:${i}`}><circle cx=${q[0]} cy=${q[1]} r="16" class="fp3d-hit" /><circle cx=${q[0]} cy=${q[1]} r="6" /></g>`;
      });
      return svg`<g class=${cls} data-cable=${key}>${lines}${pieces}${handles}</g>`;
    })}</g>`;
  }

  /** The energy panel's Cables fold (#418, MANY-7): each cable a 44 px row to pick, then lay it by hand with points and a height. */
  renderCableSettings(this: Fp3dEditor) {
    const keys = this.cableKeys();
    if (!keys.length) return nothing;
    const admin = this.isEditor;
    const cables = this._doc.settings.roof.cables ?? [];
    const sel = this._cableId ? cables.find((c) => c.id === this._cableId) : undefined;
    const laidN = keys.filter((k) => cables.some((c) => c.id === k)).length;
    return this.sideFold("energy-cables", "", !!this._cableId, `〰 ${this.t("cables_title")} (${keys.length})`, laidN ? this.t("cables_laid_n", { n: laidN }) : this.t("cables_auto_all"), 0, () => html`
      <div class="fp3d-with-info"><p class="fp3d-sub">${this.t("cables_hint_short")}</p>${this.infoButton("cables_hint", this.t("cables_title"))}</div>
      <div class="fp3d-pick-list">
        ${keys.map((key) =>
          this.pickRow(this.cableLabel(key), cables.some((c) => c.id === key) ? this.t("cable_laid") : "", key === this._cableId, () => {
            this._cableId = key === this._cableId ? null : key;
            // a laid cable lives on its floor: the plan goes there so its points can be dragged
            const laid = cables.find((c) => c.id === key);
            if (this._cableId && laid && this._doc.floors.some((f) => f.id === laid.floor_id)) this._floorId = laid.floor_id;
          }),
        )}
      </div>
      ${this._cableId
        ? html`<div class="fp3d-actions">
              ${sel
                ? html`<button class="fp3d-btn fp3d-fix" aria-pressed=${!!sel.locked} title=${this.t("fix_hint")} ?disabled=${!admin} @click=${() => this.change((d) => {
                      const c = d.settings.roof.cables?.find((x) => x.id === sel.id);
                      if (c) c.locked = !c.locked;
                    })}>
                      ${sel.locked ? `🔒 ${this.t("unfix")}` : `🔓 ${this.t("fix")}`}
                    </button>
                    <button class="fp3d-btn" ?disabled=${!admin} @click=${() => this.change((d) => (d.settings.roof.cables = (d.settings.roof.cables ?? []).filter((c) => c.id !== this._cableId)))}>${this.t("cable_auto")}</button>`
                : html`<button class="fp3d-btn fp3d-primary" ?disabled=${!admin || !this._floorId} @click=${() => this.layCable(this._cableId!)}>${this.t("cable_lay")}</button>`}
            </div>
            ${sel
              ? html`<div class="fp3d-form">
                    ${this.len(this.t("cable_height"), sel.height, (v) => this.change((d) => {
                      const c = d.settings.roof.cables?.find((x) => x.id === sel.id);
                      if (c) c.height = Math.min(30, Math.max(0, round(v)));
                    }), 0.05, 0)}
                  </div>
                  <p class="fp3d-sub">${sel.floor_id === this._floorId ? this.t("cable_points_hint") : this.t("cable_other_floor", { floor: this._doc.floors.find((f) => f.id === sel.floor_id)?.name ?? "" })}</p>`
              : nothing}`
        : nothing}`);
  }

  renderEnergyMarkers(this: Fp3dEditor) {
    const floor = this.floor;
    if (!floor) return nothing;
    const icons: Record<string, string> = { inverter: "⚡", home_battery: "🔋", wallbox: "🔌", meter: "📟", grid_point: "🏁", solar: "☀" };
    const h = this._doc.settings.roof.hologram;
    const holoPt = h?.place === "free" && Number.isFinite(h.x) && Number.isFinite(h.z) ? this.toScreen([h.x!, h.z!]) : null;
    return svg`<g class="fp3d-energy-markers">${
      holoPt
        ? svg`<g data-holo-pt="1" class="fp3d-energy-marker fp3d-holo-pt">
          <circle cx=${holoPt[0]} cy=${holoPt[1]} r="17" />
          <text x=${holoPt[0]} y=${holoPt[1] + 6} class="fp3d-energy-icon">◈</text>
          <text x=${holoPt[0]} y=${holoPt[1] + 32} class="fp3d-energy-name">${this.t("holo_settings")}</text>
          <title>${this.t("holo_place_free")}</title>
        </g>`
        : nothing
    }${floor.furniture
      .filter((m) => isEnergyDevice(m.type))
      .map((m) => {
        const [x, y] = this.toScreen([m.x, m.z]);
        const sel = m.id === this._furnitureId;
        return svg`<g data-energy-device=${m.id} class=${`fp3d-energy-marker${sel ? " fp3d-energy-marker-sel" : ""}`}>
          <circle cx=${x} cy=${y} r="17" />
          <text x=${x} y=${y + 6} class="fp3d-energy-icon">${icons[energyRole(m.type) ?? m.type] ?? "⚡"}</text>
          ${sel ? svg`<text x=${x} y=${y + 32} class="fp3d-energy-name">${this.typeName(m.type)}</text>` : nothing}
          <title>${this.typeName(m.type)}</title>
        </g>`;
      })}</g>`;
  }

  /** Sidebar of the energy tool: the selected solar field, or the overview (fields, strings). */
  renderEnergyPanel(this: Fp3dEditor) {
    const field = this._solarId ? this._doc.settings.roof.solar?.find((x) => x.id === this._solarId) : undefined;
    if (field) return this.renderSolarForm(field);
    const device = this._furnitureId ? this.floor?.furniture.find((x) => x.id === this._furnitureId && isEnergyDevice(x.type)) : undefined;
    if (device)
      return html`<button class="fp3d-btn fp3d-back" @click=${() => this.selectItem("furniture", null)}>‹ ${this.t("tool_energy")}</button>
        ${this.renderFurnitureForm(device)}`;
    return html`${this.renderEnergyChecklist()}${this.renderSolarList()}${this.renderEnergyDevices()}${this.renderCableSettings()}
      ${this.renderSettingsLink("energy", null, "settings_moved_energy")}`;
  }

  /**
   * Energy: which solar field the hologram hangs on, how big it is and where exactly. Shown without solar
   * fields too (the house card then hangs beside the house), only the field's own settings wait for a field (#334).
   */
  renderHologramSettings(this: Fp3dEditor) {
    const fields = this._doc.settings.roof.solar ?? [];
    const admin = this.isEditor;
    const h = this._doc.settings.roof.hologram ?? DEFAULT_HOLOGRAM;
    const free = h.place === "free";
    const set = (patch: Partial<HologramSettings>) => this.change((d) => (d.settings.roof.hologram = { ...(d.settings.roof.hologram ?? DEFAULT_HOLOGRAM), ...patch }));
    const name = (f: SolarField, i: number) => f.name || `${this.t("solar_field")} ${i + 1}`;
    // setting it free for the first time puts the handle beside the house, to the right of the rooms
    const setFree = () => {
      let x1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      for (const f of this._doc.floors) for (const r of f.rooms) for (const [x, z] of r.points) {
        x1 = Math.max(x1, x);
        z0 = Math.min(z0, z);
        z1 = Math.max(z1, z);
      }
      const ok = Number.isFinite(x1);
      set({ place: "free", x: h.x ?? (ok ? round(x1 + 2) : 0), z: h.z ?? (ok ? round((z0 + z1) / 2) : 0), height: h.height ?? 3 });
    };
    return html`<section>
      <h3>◈ ${this.t("holo_settings")}</h3>
      <p class="fp3d-sub">${this.t("holo_settings_hint")}</p>
      <div class="fp3d-form">
        <label class="fp3d-field fp3d-wide"
          >${this.t("holo_place")}
          <select ?disabled=${!admin} @change=${(e: Event) => ((e.target as HTMLSelectElement).value === "free" ? setFree() : set({ place: "field" }))}>
            <option value="field" ?selected=${!free}>${this.t("holo_place_field")}</option>
            <option value="free" ?selected=${free}>${this.t("holo_place_free")}</option>
          </select>
        </label>
        ${free
          ? html`<p class="fp3d-sub fp3d-wide">${this.t("holo_free_hint")}</p>
              ${this.len("X (m)", h.x ?? 0, (v) => set({ x: round(v) }), 0.25)} ${this.len("Z (m)", h.z ?? 0, (v) => set({ z: round(v) }), 0.25)}
              ${this.len(this.t("holo_height"), h.height ?? 3, (v) => set({ height: Math.min(60, Math.max(0, round(v))) }), 0.25, 0)}`
          : !fields.length
            ? html`<p class="fp3d-sub fp3d-wide">${this.t("holo_no_field")}</p>`
          : html`<label class="fp3d-field fp3d-wide"
                >${this.t("holo_field")}
                <select ?disabled=${!admin} @change=${(e: Event) => set({ field: (e.target as HTMLSelectElement).value || null })}>
                  <option value="" ?selected=${!h.field}>${this.t("holo_field_auto")}</option>
                  ${fields.map((f, i) => html`<option value=${f.id} ?selected=${f.id === h.field}>${name(f, i)}</option>`)}
                </select>
              </label>
              ${this.len(this.t("holo_right"), h.right, (v) => set({ right: Math.min(30, Math.max(-30, round(v))) }), 0.25)}
              ${this.len(this.t("holo_up"), h.up, (v) => set({ up: Math.min(30, Math.max(-30, round(v))) }), 0.25)}`}
        ${this.num(this.t("holo_size"), h.size, (v) => set({ size: Math.min(3, Math.max(0.3, round(v))) }), 0.1, 0.3)}
        ${this.num(this.t("holo_device_min_w"), h.device_min_w ?? 0, (v) => set({ device_min_w: Math.max(0, Math.round(v)) }), 1, 0)}
        <label class="fp3d-check fp3d-wide" title=${this.t("holo_device_house_hint")}
          ><input type="checkbox" .checked=${h.device_house !== false} ?disabled=${!admin} @change=${(e: Event) => set({ device_house: (e.target as HTMLInputElement).checked ? undefined : false })} />
          ${this.t("holo_device_house")}</label
        >
        <label class="fp3d-check fp3d-wide" title=${this.t("holo_device_room_hint")}
          ><input type="checkbox" .checked=${!!h.device_room} ?disabled=${!admin} @change=${(e: Event) => set({ device_room: (e.target as HTMLInputElement).checked || undefined })} />
          ${this.t("holo_device_room")}</label
        >
        <label class="fp3d-check fp3d-wide" title=${this.t("holo_plant_floor_hint")}
          ><input type="checkbox" .checked=${!!h.plant_floor} ?disabled=${!admin} @change=${(e: Event) => set({ plant_floor: (e.target as HTMLInputElement).checked || undefined })} />
          ${this.t("holo_plant_floor")}</label
        >
        <label class="fp3d-check fp3d-wide" title=${this.t("holo_mirror_hint")}
          ><input type="checkbox" .checked=${h.mirror !== false} ?disabled=${!admin} @change=${(e: Event) => set({ mirror: (e.target as HTMLInputElement).checked ? undefined : false })} />
          ${this.t("holo_mirror")}</label
        >
      </div>
    </section>`;
  }

  /** A power sensor: device class power, or a plain sensor in W or kW (templates, MQTT, many meters have no class). */
  isPowerSensor(this: Fp3dEditor, id: string): boolean {
    if (!numberish(id)) return false;
    const a = this.hass?.states[id]?.attributes;
    return a?.device_class === "power" || a?.unit_of_measurement === "W" || a?.unit_of_measurement === "kW";
  }

  /** The name of a furniture type: a pack item's own name, else the built-in type's. */
  typeName(this: Fp3dEditor, type: string): string {
    const item = packInfo(type);
    return item ? packItemName(item, this.hass?.language ?? "en") : this.t(`furn_${type}` as I18nKey);
  }

  /** The power sensor of an energy device: set by hand, or the one found on its Home Assistant device. */
  devicePower(this: Fp3dEditor, m: Furniture, links: Map<string, { power: string | null }>): string | null {
    return m.power && m.power !== "none" ? m.power : (links.get(m.id)?.power ?? null);
  }

  /** What the energy tool still needs, ticked off live; every row jumps to the right place. */
  renderEnergyChecklist(this: Fp3dEditor) {
    const doc = this._doc;
    const links = this.hass ? furnitureEntities(this.hass, doc.floors) : new Map<string, { power: string | null }>();
    const all = doc.floors.flatMap((fl) => fl.furniture.map((m) => ({ m, fl })));
    const of = (type: string) => all.filter((x) => (energyRole(x.m.type) ?? x.m.type) === type);
    const goTo = (x: (typeof all)[number]) => {
      this._floorId = x.fl.id;
      this._solarId = null;
      this.selectItem("furniture", x.m.id);
      this.showPoint(x.m.x, x.m.z);
    };
    const fields = doc.settings.roof.solar ?? [];
    const meters = of("meter");
    const inverters = of("inverter");
    const batteries = of("home_battery");
    const grid = of("grid_point");
    const meterOk = !!doc.energy.grid || meters.some((x) => this.devicePower(x.m, links));
    const inverterOk = !!doc.energy.solar || (inverters.length > 0 && inverters.every((x) => this.devicePower(x.m, links)));
    const batteryOk = batteries.every((x) => this.devicePower(x.m, links) && x.m.soc && x.m.soc !== "none") || !!doc.energy.battery;
    type Row = { state: "ok" | "todo" | "opt"; label: string; action?: () => void; href?: string };
    const rows: Row[] = [
      { state: fields.length ? "ok" : "todo", label: this.t(fields.length ? "chk_solar" : "chk_solar_add"), action: fields.length ? () => (this._solarId = fields[0].id) : () => this.addSolarField() },
      meters.length
        ? { state: meterOk ? "ok" : "todo", label: this.t(meterOk ? "chk_meter" : "chk_meter_sensor"), action: () => goTo(meters[0]) }
        : { state: "todo", label: this.t("chk_meter_add"), action: () => this.addEnergyDevice("meter") },
      inverters.length
        ? { state: inverterOk ? "ok" : "todo", label: this.t(inverterOk ? "chk_inverter" : "chk_inverter_sensor"), action: () => goTo(inverters.find((x) => !this.devicePower(x.m, links)) ?? inverters[0]) }
        : { state: "todo", label: this.t("chk_inverter_add"), action: () => this.addEnergyDevice("inverter") },
      batteries.length
        ? { state: batteryOk ? "ok" : "todo", label: this.t(batteryOk ? "chk_battery" : "chk_battery_sensor"), action: () => goTo(batteries[0]) }
        : { state: "opt", label: this.t("chk_battery_opt"), action: () => this.addEnergyDevice("home_battery") },
      grid.length ? { state: "ok", label: this.t("chk_grid"), action: () => goTo(grid[0]) } : { state: "opt", label: this.t("chk_grid_opt"), action: () => this.addEnergyDevice("grid_point") },
    ];
    const done = rows.filter((r) => r.state === "ok").length;
    return html`<section class="fp3d-checklist">
      <h3>☑ ${this.t("chk_title")} <span class="fp3d-sub">${done}/${rows.length}</span></h3>
      <p class="fp3d-sub">${this.t("chk_hint")}</p>
      ${rows.map((r) =>
        r.href
          ? html`<a class="fp3d-chk fp3d-chk-${r.state}" href=${r.href} target="_blank" rel="noopener"><span>${r.state === "ok" ? "✓" : r.state === "todo" ? "○" : "·"}</span>${r.label}</a>`
          : html`<button class="fp3d-chk fp3d-chk-${r.state}" ?disabled=${!this.isEditor && !!r.action && r.state !== "ok"} @click=${r.action}><span>${r.state === "ok" ? "✓" : r.state === "todo" ? "○" : "·"}</span>${r.label}</button>`,
      )}
    </section>`;
  }

  /**
   * Add an energy device where it belongs: a wallbox in the garage (or carport), an inverter or a battery in a
   * utility room (or the garage), else in the selected room; against the nearest wall, and the plan goes there.
   */
  addEnergyDevice(this: Fp3dEditor, type: string): void {
    const floor = this.floor;
    if (!floor || !this.isEditor) return;
    if (type === "grid_point") {
      // the grid connection goes where the cable would reach the street by itself; then it can be dragged
      const auto = gridPoint(this._doc);
      const [gw, gd, gh] = furnitureSize(type);
      const [gx, gz] = auto ? auto.end : this.toWorld(this._size.w / 2, this._size.h / 2);
      const point: Furniture = { id: uid("furniture"), type, x: round(gx), z: round(gz), rotation: 0, w: gw, d: gd, h: gh, variant: null };
      this.change((_, f) => f.furniture.push(point));
      this.selectItem("furniture", point.id);
      this.showPoint(point.x, point.z);
      return;
    }
    const areaName = (r: Room) => `${r.name} ${(r.area_id && this.hass?.areas?.[r.area_id]?.name) || ""} ${r.area_id ?? ""}`.toLowerCase();
    const rooms = floor.rooms.filter((r) => r.points.length >= 3);
    const find = (re: RegExp) => rooms.find((r) => re.test(areaName(r)));
    const parked = rooms.find((r) => floor.furniture.some((m) => m.type === "parking" && pointInPolygon([m.x, m.z], r.points)));
    const garage = find(/garage|carport/) ?? parked;
    const utility = find(/utility|basement|cellar|boiler|plant ?room/);
    const hall = find(/hall|entr|lobby/);
    const room = (type === "wallbox" ? garage : type === "meter" ? (utility ?? hall ?? garage) : (utility ?? garage)) ?? this.room ?? rooms.sort((a, b) => Math.abs(signedArea(b.points)) - Math.abs(signedArea(a.points)))[0];
    const [w, d, h] = furnitureSize(type);
    let [x, z] = room ? centroid(room.points) : this.toWorld(this._size.w / 2, this._size.h / 2);
    if (room) {
      // in front of the room's longest wall, so it snaps to that wall (from the middle no wall is near enough)
      const [cx, cz] = centroid(room.points);
      let best: { mx: number; mz: number; nx: number; nz: number; l: number } | null = null;
      // walls with a door, gate or window are no place for it (the garage door wall least of all)
      const open = new Set(floor.openings.filter((o) => o.room_id === room.id).map((o) => o.edge));
      const free = room.points.some((_, i) => !open.has(i));
      room.points.forEach((p, i) => {
        if (free && open.has(i)) return;
        const q = room.points[(i + 1) % room.points.length];
        const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (best && l <= best.l) return;
        const mx = (p[0] + q[0]) / 2;
        const mz = (p[1] + q[1]) / 2;
        let nx = -(q[1] - p[1]) / l;
        let nz = (q[0] - p[0]) / l;
        if ((cx - mx) * nx + (cz - mz) * nz < 0) [nx, nz] = [-nx, -nz];
        best = { mx, mz, nx, nz, l };
      });
      const b = best as { mx: number; mz: number; nx: number; nz: number; l: number } | null;
      if (b) [x, z] = [b.mx + b.nx * (d / 2 + 0.25), b.mz + b.nz * (d / 2 + 0.25)];
    }
    const item: Furniture = { id: uid("furniture"), type, x: round(x), z: round(z), rotation: 0, w, d, h, variant: null };
    // against the nearest wall of its room, like furniture snapping to a wall
    const snapped = room ? snapToWall({ ...floor, furniture: [...floor.furniture, item] }, item, this._doc.settings.wall_interior) : null;
    if (snapped) Object.assign(item, { x: round(snapped.x), z: round(snapped.z), rotation: snapped.rotation });
    this.change((_, f) => f.furniture.push(item));
    this.selectItem("furniture", item.id);
    this.showPoint(item.x, item.z);
  }

  /**
   * The energy panel's Devices fold (#418, MANY-7): the floor shown (where new ones go), the inverters, batteries,
   * wallboxes, meter and grid connection of all floors as 44 px rows, and the buttons to add them.
   */
  renderEnergyDevices(this: Fp3dEditor) {
    const admin = this.isEditor;
    const list = this._doc.floors.flatMap((fl) => fl.furniture.filter((m) => isEnergyDevice(m.type)).map((m) => ({ fl, m })));
    const names = [...new Set(list.map(({ m }) => this.typeName(m.type)))].join(" · ");
    return this.sideFold("energy-devices", "", false, `⚡ ${this.t("energy_devices")} (${list.length})`, names || this.t("energy_devices_none"), 0, () => html`
      ${this.renderRoofFloors()}
      <div class="fp3d-with-info"><p class="fp3d-sub">${this.t("energy_devices_hint_short")}</p>${this.infoButton("energy_devices_hint", this.t("energy_devices"))}</div>
      ${list.length
        ? html`<div class="fp3d-pick-list">
            ${list.map(({ fl, m }) =>
              this.pickRow(m.name || this.typeName(m.type), fl.name, m.id === this._furnitureId, () => {
                this._floorId = fl.id;
                this._solarId = null;
                this.selectItem("furniture", m.id);
                this.showPoint(m.x, m.z);
              }),
            )}
          </div>`
        : nothing}
      <div class="fp3d-actions">
        ${ENERGY_DEVICES.map(
          (type) => html`<button
            class="fp3d-btn"
            ?disabled=${!admin || !this.floor}
            @click=${() => {
              this._solarId = null;
              this.addEnergyDevice(type);
            }}
          >
            + ${this.t(`furn_${type}` as I18nKey)}
          </button>`,
        )}
      </div>`);
  }

  renderMeter(this: Fp3dEditor, floor: Floor) {
    const m = this._doc.energy?.meter;
    if (!m || m.floor_id !== floor.id) return nothing;
    const [x, y] = this.toScreen([m.x, m.z]);
    return svg`<g class="fp3d-meter" transform="translate(${x} ${y})" pointer-events="none">
      <rect x="-11" y="-11" width="22" height="22" rx="5" />
      <path d="M1.5 -7 L-4 1 H0 L-1.5 7 L4 -1 H0 Z" />
    </g>`;
  }

  /** The circuit a device hangs on (a circuit monitor's channel), so its watts are not counted on top of it (#43). */
  circuitSelect(this: Fp3dEditor, value: string | null, own: string | null, onChange: (v: string | null) => void) {
    const options = this.entityOptions((id) => this.isPowerSensor(id)).filter((o) => o.id !== own);
    return html`${this.entitySelect(this.t("energy_circuit"), value ?? "none", undefined, options, (v) => onChange(v && v !== "none" ? v : null))}
      <p class="fp3d-sub fp3d-wide">${this.t("energy_circuit_hint")}</p>
      ${value ? nothing : html`<p class="fp3d-sub fp3d-wide fp3d-warn">${this.t("energy_circuit_unset")}</p>`}`;
  }

  /** The energy sensor whose today's kWh its cable end shows (#29): found on the device unless chosen here. */
  wireEnergySelect(this: Fp3dEditor, value: string | null, power: string, onChange: (v: string | null) => void) {
    const options = this.entityOptions((id) => id.startsWith("sensor.") && this.hass?.states[id]?.attributes.device_class === "energy");
    const auto = this.hass ? energySensorFor(this.hass, power) : null;
    return html`${this.entitySelect(this.t("energy_wire_sensor"), value, auto, options, onChange)}
      <p class="fp3d-sub fp3d-wide">${this.t("energy_wire_sensor_hint")}</p>`;
  }

  setEnergy(this: Fp3dEditor, patch: Partial<Building["energy"]>): void {
    const next = structuredClone(this._doc);
    next.energy = { ...next.energy, ...patch };
    this.setDoc(next);
  }

  /** Fill the balance from Home Assistant's energy dashboard: its statistics lead to power sensors of the same devices. */
  async importEnergyPrefs(this: Fp3dEditor): Promise<void> {
    if (!this.hass) return;
    let prefs: EnergyPrefs;
    try {
      prefs = await this.hass.callWS<EnergyPrefs>({ type: "energy/get_prefs" });
    } catch {
      this._energyNote = this.t("energy_import_failed");
      return;
    }
    const found = proposeEnergySensors(this.hass, prefs);
    // the sensors go to the devices in the plan (meter, inverter, battery), which are created when missing;
    // only empty fields are filled: what the user chose stays
    let n = 0;
    const find = (type: string) => this._doc.floors.flatMap((f) => f.furniture).find((m) => m.type === type);
    const put = (type: string, key: "power" | "soc", value: string | null | undefined) => {
      if (!value) return;
      let m = find(type);
      if (!m && this.floor) {
        this.addEnergyDevice(type);
        m = find(type);
      }
      if (!m || (m[key] && m[key] !== "none")) return;
      const id = m.id;
      this.change((d) => {
        const x = d.floors.flatMap((f) => f.furniture).find((y) => y.id === id);
        if (x) x[key] = value;
      });
      n++;
    };
    put("meter", "power", found.grid);
    put("inverter", "power", found.solar);
    put("home_battery", "power", found.battery);
    put("home_battery", "soc", found.battery_soc);
    // gas and water meters go to the balance itself (they have no device in the plan)
    const meters = proposeMeters(prefs);
    for (const key of ["gas", "water"] as const) {
      if (meters[key] && !this._doc.energy[key]) {
        this.setEnergy({ [key]: meters[key] });
        n++;
      }
    }
    this.selectItem("furniture", null);
    this._energyNote = n ? this.t("energy_import_done", { n }) : this.t("energy_import_none");
  }

  /** Further inverter / battery setups (#285): each with its own sensors, added to the totals. */
  renderEnergySystems(this: Fp3dEditor, power: Parameters<Fp3dEditor["entitySelect"]>[3], soc: Parameters<Fp3dEditor["entitySelect"]>[3]) {
    const systems = this._doc.energy.systems ?? [];
    const admin = this.isEditor;
    const set = (id: string, patch: Partial<EnergySystem>) => this.setEnergy({ systems: systems.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
    const inverters = this._doc.floors.flatMap((fl) => fl.furniture.filter((m) => energyRole(m.type) === "inverter"));
    const pick = (id: string, key: "grid" | "solar" | "battery" | "battery_soc") => (v: string | null) => set(id, { [key]: v === "none" ? null : v });
    return html`<div class="fp3d-wide">
      <h4>${this.t("energy_systems_title")}</h4>
      <p class="fp3d-sub">${this.t("energy_systems_hint")}</p>
      ${systems.map(
        (x, i) => html`<div class="fp3d-form">
          <label class="fp3d-field fp3d-wide"
            ><span>${this.t("energy_system_name")}</span>
            <input type="text" .value=${x.name} placeholder=${this.t("energy_system_n", { n: i + 2 })} ?disabled=${!admin} @change=${(ev: Event) => set(x.id, { name: (ev.target as HTMLInputElement).value })}
          /></label>
          <label class="fp3d-field fp3d-wide"
            ><span>${this.t("energy_system_inverter")}</span>
            <select ?disabled=${!admin} @change=${(ev: Event) => set(x.id, { inverter: (ev.target as HTMLSelectElement).value || null })}>
              <option value="" ?selected=${!x.inverter}>${this.t("energy_system_inverter_none")}</option>
              ${inverters.map((m, n) => html`<option value=${m.id} ?selected=${m.id === x.inverter}>${m.name?.trim() || `${this.t("furn_inverter")} ${n + 1}`}</option>`)}
            </select></label
          >
          ${this.entitySelect(this.t("energy_grid"), x.grid, undefined, power, pick(x.id, "grid"))}
          ${this.renderSignChoice("grid", x.grid_invert, (v) => set(x.id, { grid_invert: v }))}
          ${this.entitySelect(this.t("energy_solar_sensor"), x.solar, undefined, power, pick(x.id, "solar"))}
          ${this.entitySelect(this.t("energy_battery_sensor"), x.battery, undefined, power, pick(x.id, "battery"))}
          ${this.renderSignChoice("battery", x.battery_invert, (v) => set(x.id, { battery_invert: v }))}
          ${this.entitySelect(this.t("energy_battery_soc"), x.battery_soc, undefined, soc, pick(x.id, "battery_soc"))}
          <button class="fp3d-btn" ?disabled=${!admin} @click=${() => this.setEnergy({ systems: systems.filter((y) => y.id !== x.id) })}>${this.t("energy_system_remove")}</button>
        </div>`,
      )}
      <button
        class="fp3d-btn"
        ?disabled=${!admin || systems.length >= MAX_ENERGY_SYSTEMS}
        @click=${() => this.setEnergy({ systems: [...systems, { id: uid("sys"), name: "", inverter: null, grid: null, grid_invert: false, solar: null, battery: null, battery_invert: false, battery_soc: null }] })}
      >
        ${this.t("energy_system_add")}
      </button>
    </div>`;
  }

  /**
   * Rates and costs (#323), either/or: set up here (the price sensor, the cheap rate entity or daily window; the default)
   * or Home Assistant's existing sensors (price, peak/off-peak tariff entity, cost and earning sensors, or the Energy
   * dashboard's grid setup in one tap). Switching keeps the other side's choices.
   */
  renderEnergyRates(this: Fp3dEditor, tariff: EntityOption[], cheap: EntityOption[]) {
    const e = this._doc.energy;
    const admin = this.isEditor;
    const sensors = ratesFromSensors(e);
    const priceSelect = this.entitySelect(this.t("energy_tariff_sensor"), e.tariff, undefined, tariff, (v) => this.setEnergy({ tariff: v === "none" ? null : v }));
    return html`<h4 class="fp3d-lib-head">${this.t("energy_rates_title")}</h4>
      <div class="fp3d-seg" role="group" aria-label=${this.t("energy_rates_title")}>
        <button aria-pressed=${!sensors} ?disabled=${!admin} @click=${() => this.setEnergy({ rates_from: "here" })}>${this.t("energy_rates_here")}</button>
        <button aria-pressed=${sensors} ?disabled=${!admin} @click=${() => this.setEnergy({ rates_from: "sensors", ...(!e.rate_entity && e.cheap_rate && e.cheap_rate !== "none" ? { rate_entity: e.cheap_rate } : {}) })}>${this.t("energy_rates_sensors")}</button>
      </div>
      <p class="fp3d-sub">${this.t("energy_rates_hint")}</p>
      ${sensors
        ? this.renderRateSensors()
        : html`<div class="fp3d-form">
              ${priceSelect}
              ${this.entitySelect(this.t("energy_cheap_rate"), e.cheap_rate ?? null, undefined, cheap, (v) => this.setEnergy({ cheap_rate: v === "none" ? null : v }))}
              <div class="fp3d-field">
                <span>${this.t("energy_cheap_from")}</span>
                ${this.timeField(this.t("energy_cheap_from"), e.cheap_from ?? "", !admin, (v) => this.setEnergy({ cheap_from: v || null }))}
              </div>
              <div class="fp3d-field">
                <span>${this.t("energy_cheap_to")}</span>
                ${this.timeField(this.t("energy_cheap_to"), e.cheap_to ?? "", !admin, (v) => this.setEnergy({ cheap_to: v || null }))}
              </div>
            </div>
            <p class="fp3d-sub">${this.t("energy_cheap_hint")}</p>`}`;
  }

  /** Up to three entity names, then "and N more" (#323: a home can have dozens of unavailable cost sensors). */
  someNames(this: Fp3dEditor, ids: string[]): string {
    const shown = ids.slice(0, 3).map((id) => (id.includes(".") ? entityName(this.hass, id) : id)).join(", ");
    return ids.length > 3 ? this.t("energy_rates_and_more", { names: shown, n: ids.length - 3 }) : shown;
  }

  /** A price that is an entity (sensor, input_number, number) or a typed number per kWh (#323). */
  priceSource(this: Fp3dEditor, label: string, value: string | number | null | undefined, options: EntityOption[], onChange: (v: string | number | null) => void) {
    const typed = typeof value === "number" ? String(value) : "";
    return html`${this.entitySelect(label, typeof value === "string" ? value : null, undefined, options, (v) => onChange(v === "none" ? null : v), ["input_number", "number", "sensor"])}
      <label class="fp3d-field"
        >${this.t("energy_price_typed")}
        <input
          type="number"
          step="any"
          inputmode="decimal"
          .value=${typed}
          ?disabled=${!this.isEditor}
          @change=${(ev: Event) => {
            const raw = (ev.target as HTMLInputElement).value.trim();
            const n = Number(raw);
            onChange(raw !== "" && Number.isFinite(n) ? n : null);
          }}
      /></label>`;
  }

  /** The existing-sensor side of the rates (#323): the Energy dashboard button, tariff entity and its cheap states, price, costs. */
  renderRateSensors(this: Fp3dEditor) {
    const e = this._doc.energy;
    const admin = this.isEditor;
    const states = this.hass?.states ?? {};
    const attr = (id: string, key: string) => states[id]?.attributes[key] as string | undefined;
    // the rate now: a tariff select (utility meter), a sensor naming it (not a number), or anything on while it is cheap
    const rates = this.entityOptions((id) => ON_OFF_RATE.test(id) || /^(select|input_select)\./.test(id) || (id.startsWith("sensor.") && !numberish(id)));
    // a price: a number helper or number entity, a monetary sensor or one per kWh
    const prices = this.entityOptions(
      (id) => numberish(id) && (/^(input_number|number)\./.test(id) || attr(id, "device_class") === "monetary" || /\/(kWh|MWh)$/.test(attr(id, "unit_of_measurement") ?? "")),
    );
    // money: a monetary sensor, or one in the home's currency
    const currency = this.hass?.config?.currency;
    const money = this.entityOptions((id) => numberish(id) && (attr(id, "device_class") === "monetary" || (!!currency && attr(id, "unit_of_measurement") === currency)), currency);
    const rate = e.rate_entity ?? null;
    const choices = rate && !ON_OFF_RATE.test(rate) ? tariffStates(states[rate]) : [];
    const picked = e.cheap_states ?? [];
    const toggle = (s: string, on: boolean) => this.setEnergy({ cheap_states: on ? [...picked.filter((x) => x !== s), s] : picked.filter((x) => x !== s) });
    const costs = e.cost_sensors ?? [];
    const earnings = e.earning_sensors ?? [];
    const split = e.price_mode === "split";
    // a chosen statistic without an entity (the dashboard's external statistics) stays a choice
    const withPicked = (list: EntityOption[], ids: string[]) => [...list, ...ids.filter((id) => !list.some((o) => o.id === id)).map((id) => ({ id, label: id }))];
    const gone = (id: unknown): id is string => typeof id === "string" && id !== "none" && id.includes(".") && (!states[id] || states[id].state === "unavailable");
    const missing = [...(split ? [e.price_peak, e.price_cheap] : [e.tariff]), rate, ...costs, ...earnings].filter(gone);
    const fixed = !split && !e.tariff && typeof e.price_fixed === "number" ? `${formatNumber(this.hass, e.price_fixed, 4)} ${currency ?? ""}/kWh` : null;
    return html`<div class="fp3d-actions">
        <button class="fp3d-btn" ?disabled=${!admin || !this.hass} @click=${() => this.importRatePrefs()}>${this.t("energy_rates_prefs")}</button>
      </div>
      <div class="fp3d-form">
        ${this.entitySelect(this.t("energy_rate_entity"), rate, undefined, rates, (v) => this.setEnergy({ rate_entity: v === "none" ? null : v, cheap_states: [] }), ["select", "sensor", "binary_sensor"])}
        ${choices.length
          ? html`<div class="fp3d-field fp3d-wide" role="group" aria-label=${this.t("energy_cheap_states")}>
              <span>${this.t("energy_cheap_states")}</span>
              ${choices.map(
                (s) => html`<label class="fp3d-check"
                  ><input type="checkbox" .checked=${picked.includes(s)} ?disabled=${!admin} @change=${(ev: Event) => toggle(s, (ev.target as HTMLInputElement).checked)} />
                  ${s}</label
                >`,
              )}
              ${picked.length ? nothing : html`<span class="fp3d-sub">${this.t("energy_cheap_states_guess")}</span>`}
            </div>`
          : nothing}
        <div class="fp3d-seg fp3d-wide" role="group" aria-label=${this.t("energy_price_title")}>
          <button aria-pressed=${!split} ?disabled=${!admin} @click=${() => this.setEnergy({ price_mode: "one" })}>${this.t("energy_price_one")}</button>
          <button aria-pressed=${split} ?disabled=${!admin} @click=${() => this.setEnergy({ price_mode: "split" })}>${this.t("energy_price_split")}</button>
        </div>
        ${split
          ? html`${this.priceSource(this.t("energy_price_peak"), e.price_peak, prices, (v) => this.setEnergy({ price_peak: v }))}
              ${this.priceSource(this.t("energy_price_cheap"), e.price_cheap, prices, (v) => this.setEnergy({ price_cheap: v }))}
              <p class="fp3d-sub fp3d-wide">${this.t("energy_price_split_hint")}</p>`
          : html`${this.entitySelect(this.t("energy_price_sensor"), e.tariff, undefined, prices, (v) => this.setEnergy({ tariff: v === "none" ? null : v }), ["sensor", "input_number", "number"])}
              ${fixed ? html`<p class="fp3d-sub fp3d-wide">${this.t("energy_price_fixed", { price: fixed })}</p>` : nothing}`}
        <div class="fp3d-field fp3d-wide">
          <span>${this.t("energy_cost_sensors")}</span>
          ${this.moneySelect(withPicked(money, costs), costs, this.t("energy_cost_sensors"), (ids) => this.setEnergy({ cost_sensors: ids }))}
        </div>
        <div class="fp3d-field fp3d-wide">
          <span>${this.t("energy_earning_sensors")}</span>
          ${this.moneySelect(withPicked(money, earnings), earnings, this.t("energy_earning_sensors"), (ids) => this.setEnergy({ earning_sensors: ids }))}
        </div>
      </div>
      ${missing.length ? html`<p class="fp3d-sub fp3d-pack-error">${this.t("energy_rates_missing", { ids: this.someNames(missing) })}</p>` : nothing}`;
  }

  /** A searchable multi-select of money sensors (#323). */
  moneySelect(this: Fp3dEditor, options: EntityOption[], value: string[], label: string, onChange: (ids: string[]) => void) {
    need(loadMultiSelect);
    return html`<fp3d-multi-select
      .options=${options}
      .value=${value}
      .locked=${[]}
      .label=${label}
      .placeholder=${this.t("entity_none")}
      .searchLabel=${this.t("multi_search")}
      .emptyText=${this.t("multi_none")}
      .removeLabel=${this.t("multi_remove")}
      ?disabled=${!this.isEditor}
      @change=${(ev: CustomEvent<{ value: string[] }>) => {
        ev.stopPropagation();
        onChange(ev.detail.value);
      }}
    ></fp3d-multi-select>`;
  }

  /** "Use Home Assistant's Energy dashboard setup" (#323): its grid's price and cost sources become the existing sensors. */
  async importRatePrefs(this: Fp3dEditor): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    let prefs: RatePrefs;
    try {
      prefs = await hass.callWS<RatePrefs>({ type: "energy/get_prefs" });
    } catch {
      this._energyNote = this.t("energy_import_failed");
      return;
    }
    const info = await hass.callWS<EnergyInfo>({ type: "energy/info" }).catch(() => null);
    const r = prefsRates(prefs, info);
    if (!r.cost_sensors.length && !r.earning_sensors.length && !r.tariff && r.price_fixed === null) {
      this._energyNote = this.t("energy_rates_prefs_none");
      return;
    }
    // a price from the dashboard replaces the chosen one; without one, the chosen price sensor stays
    const e = this._doc.energy;
    const priced = r.tariff !== null || r.price_fixed !== null;
    this.setEnergy({
      rates_from: "sensors",
      tariff: r.tariff ?? (r.price_fixed !== null ? null : e.tariff),
      price_fixed: r.price_fixed,
      cost_sensors: r.cost_sensors,
      earning_sensors: r.earning_sensors,
      ...(priced ? { price_mode: "one" as const } : {}),
    });
    // e.g. "Taken from the Energy dashboard – costs: Grid import cost. It sets no price: choose one below."
    const names = (ids: string[]) => (ids.length ? this.someNames(ids) : this.t("entity_none"));
    const price = r.tariff ? entityName(hass, r.tariff) : r.price_fixed !== null ? `${formatNumber(hass, r.price_fixed, 4)} ${hass.config?.currency ?? ""}/kWh` : null;
    this._energyNote = [
      this.t("energy_rates_prefs_done", { costs: names(r.cost_sensors) }),
      r.earning_sensors.length ? this.t("energy_rates_prefs_earnings", { earnings: names(r.earning_sensors) }) : "",
      price ? this.t("energy_rates_prefs_price", { price }) : this.t("energy_rates_prefs_no_price"),
    ]
      .filter(Boolean)
      .join(" ");
  }


  /** Grid, solar, battery and house sensors: from the devices in the plan unless chosen here. */
  /**
   * Which way a grid or battery power sensor counts (#423): a choice of two plain sentences next to the sensor. It
   * writes the plan's `grid_invert` / `battery_invert` (false or absent: import / discharging shows as positive).
   */
  renderSignChoice(this: Fp3dEditor, kind: "grid" | "battery", invert: boolean | undefined, onChange: (invert: boolean) => void) {
    const [normal, flipped] = SIGN_CHOICES[kind];
    const label = this.t(kind === "grid" ? "energy_grid_sign" : "energy_battery_sign");
    return html`<label class="fp3d-field fp3d-wide"
      ><span>${label}</span>
      <select
        data-sign=${kind}
        ?disabled=${!this.isEditor}
        @change=${(ev: Event) => onChange((ev.target as HTMLSelectElement).value === "flipped")}
      >
        <option value="normal" ?selected=${!invert}>${this.t(normal)}</option>
        <option value="flipped" ?selected=${!!invert}>${this.t(flipped)}</option>
      </select></label
    >`;
  }

  renderEnergyBalance(this: Fp3dEditor) {
    const e = this._doc.energy;
    const admin = this.isEditor;
    const attr = (id: string, key: string) => this.hass?.states[id]?.attributes[key] as string | undefined;
    const power = this.entityOptions((id) => this.isPowerSensor(id));
    const soc = this.entityOptions((id) => numberish(id) && attr(id, "device_class") === "battery");
    const tariff = this.entityOptions(
      (id) => numberish(id) && (attr(id, "device_class") === "monetary" || /\/(kWh|MWh)$/.test(attr(id, "unit_of_measurement") ?? "")),
    );
    // the cheap rate (#29): anything that is on while it runs (a binary sensor, a schedule, an input boolean)
    const cheap = this.entityOptions((id) => /^(binary_sensor|schedule|input_boolean|switch)\./.test(id));
    const pick = (key: "grid" | "solar" | "battery" | "battery_soc" | "consumption" | "tariff") => (v: string | null) => this.setEnergy({ [key]: v === "none" ? null : v });
    // gas and water meters: counters of that device class, or in m³, litres, ft³ or gallons
    const meter = (kind: "gas" | "water") =>
      this.entityOptions((id) => numberish(id) && (attr(id, "device_class") === kind || /^(m³|m3|L|l|ft³|gal|CCF)$/.test(attr(id, "unit_of_measurement") ?? "")), kind);
    const links = this.hass ? furnitureEntities(this.hass, this._doc.floors) : new Map<string, { power: string | null }>();
    const devices = deviceSensors(this._doc, (f) => this.devicePower(f, links));
    // the usual trap: a sign the wrong way round – exporting without any sun, or a battery charging at night
    const sum = this.hass ? energySummary(this.hass, this._doc, [], devices) : null;
    const night = !!sum && (sum.solar ?? 0) < 20;
    const gridWrong = night && sum!.grid !== null && sum!.grid < -50;
    const batteryWrong = night && sum!.battery !== null && sum!.battery < -50 && (sum!.grid ?? 0) <= 0;
    return html`<section>
      <h3>⚖ ${this.t("energy_balance")}</h3>
      <p class="fp3d-sub">${this.t("energy_balance_hint")}</p>
      ${gridWrong
        ? html`<p class="fp3d-sub fp3d-pack-error">${this.t("energy_sign_grid")} <button class="fp3d-btn" ?disabled=${!admin} @click=${() => this.setEnergy({ grid_invert: !e.grid_invert })}>${this.t("energy_sign_flip")}</button></p>`
        : nothing}
      ${batteryWrong
        ? html`<p class="fp3d-sub fp3d-pack-error">${this.t("energy_sign_battery")} <button class="fp3d-btn" ?disabled=${!admin} @click=${() => this.setEnergy({ battery_invert: !e.battery_invert })}>${this.t("energy_sign_flip")}</button></p>`
        : nothing}
      <div class="fp3d-form">
        ${this.entitySelect(this.t("energy_grid"), e.grid, devices.grid, power, pick("grid"))}
        ${this.renderSignChoice("grid", e.grid_invert, (v) => this.setEnergy({ grid_invert: v }))}
        ${this.entitySelect(this.t("energy_solar_sensor"), e.solar, devices.solar[0] ?? null, power, pick("solar"))}
        ${this.entitySelect(this.t("energy_battery_sensor"), e.battery, devices.battery[0] ?? null, power, pick("battery"))}
        ${this.renderSignChoice("battery", e.battery_invert, (v) => this.setEnergy({ battery_invert: v }))}
        ${this.entitySelect(this.t("energy_battery_soc"), e.battery_soc, devices.soc[0] ?? null, soc, pick("battery_soc"))}
        ${this.renderEnergySystems(power, soc)}
        ${this.entitySelect(this.t("energy_consumption_sensor"), e.consumption, null, power, pick("consumption"))}
        ${this.entitySelect(this.t("energy_gas_meter"), e.gas ?? null, undefined, meter("gas"), (v) => this.setEnergy({ gas: v === "none" ? null : v }))}
        ${this.entitySelect(this.t("energy_water_meter"), e.water ?? null, undefined, meter("water"), (v) => this.setEnergy({ water: v === "none" ? null : v }))}
      </div>
      <p class="fp3d-sub">${this.t("energy_meters_hint")}</p>
      <div class="fp3d-actions">
        <button class="fp3d-btn" ?disabled=${!admin || !this.hass} @click=${() => this.importEnergyPrefs()}>${this.t("energy_import_prefs")}</button>
      </div>
      <p class="fp3d-sub">${this.t("energy_hint")}</p>
      ${this.renderEnergyRates(tariff, cheap)}
      ${this._energyNote ? html`<p class="fp3d-sub" role="status">${this._energyNote}</p>` : nothing}
    </section>`;
  }
}
