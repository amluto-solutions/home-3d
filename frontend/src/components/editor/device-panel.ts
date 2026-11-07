// Home Assistant devices on the plan: placing them, unplaced entities and link suggestions, moving and spreading,
// pets, the device form and the room's device list.

import { html, nothing, svg } from "lit";
import { areaEntities, autoPlace, hiddenInHa, defaultHeight, entityName, furnitureEntities, groupByDevice, isPlaceable, kindOf, otherAreaEntities, unassignedEntities } from "../../devices.ts";
import { powerSensorFor } from "../../energy.ts";
import { TOGGLE_KINDS } from "../../devices.ts";
import { iconPath } from "../../icons.ts";
import { bounds, centroid, splitAliases, FURNITURE_SIZE, isLamp, pointInPolygon, uid, type Floor, type LampMount, type Placement, type Room, type Vec2 } from "../../model.ts";
import { detectCameraModel, setCameraLook } from "../../camera-models.ts";
import { petMarks } from "../../pet-place.ts";
import { pinsShown, readPinZoom } from "../../plan-pins.ts";
import { furnitureName } from "../../furniture-names.ts";
import { hiddenUnplaced, setUnplacedHidden, suggestLinks, unplacedByArea, type LinkSuggestion } from "../../unplaced.ts";
import { ENTITY_DRAG, PAW, round, patchItem } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";
import { stateChip } from "./panel-head.ts";

const DEV_ICONS = {
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
  slash: "M4 4l16 16",
  text: "M4 7h16M4 12h10M4 17h13",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
};
/** A 18 px line icon for the device-row buttons; `slash` strikes it through, `fill` fills it (a set star). */
const devIcon = (path: string, slash = false, fill = false) =>
  svg`<svg viewBox="0 0 24 24" width="18" height="18" fill=${fill ? "currentColor" : "none"} stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${path} />${slash ? svg`<path d=${DEV_ICONS.slash} />` : nothing}</svg>`;

/** DevicePanelPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class DevicePanelPart {
  /** Place entities in the selected room; an entity already placed elsewhere moves here. */
  placeDevices(this: Fp3dEditor, entityIds: string[], zone?: Room, floorId?: string): void {
    const room = zone ?? this.room;
    if (!room || !entityIds.length || !this.isEditor) return;
    const ids = new Set(entityIds);
    this.change((doc, current) => {
      // the room's own floor (the unplaced list places into any floor's room, #83)
      const floor = (floorId && doc.floors.find((f) => f.id === floorId)) || current;
      for (const f of doc.floors) {
        f.placements = f.placements.filter((pl) => !ids.has(pl.entity_id));
        f.furniture = f.furniture.filter((m) => !(isLamp(m.type) && m.entity && ids.has(m.entity)));
      }
      const taken = [...floor.placements.map((pl) => [pl.x, pl.z] as Vec2), ...floor.furniture.filter((m) => isLamp(m.type)).map((m) => [m.x, m.z] as Vec2)];
      for (const pl of autoPlace(room, entityIds, taken)) {
        // outside (an outdoor area acting as a room) a light stays a pin: no ceiling lamp over the lawn
        if (!pl.entity_id.startsWith("light.") || room.outdoor) {
          floor.placements.push(pl);
          // a camera whose device names a known model gets that shape right away (#9); changed by hand any time
          const model = pl.entity_id.startsWith("camera.") && this.hass ? detectCameraModel(this.hass, pl.entity_id, this.packs ?? []) : null;
          if (model) setCameraLook(floor, pl.entity_id, model);
          continue;
        }
        // a light becomes a ceiling lamp that is tapped directly in 3D
        const [w, d, h] = FURNITURE_SIZE.lamp_ceiling;
        floor.furniture.push({ id: uid("furniture"), type: "lamp_ceiling", x: pl.x, z: pl.z, rotation: 0, w, d, h, variant: null, entity: pl.entity_id, power: null });
      }
    });
  }

  /** Link a suggested item to an unplaced entity in one tap (#83). */
  acceptLink(this: Fp3dEditor, entityId: string, s: LinkSuggestion): void {
    this.change((doc) => {
      const f = doc.floors.find((fl) => fl.id === s.floorId)?.furniture.find((m) => m.id === s.furnitureId);
      if (f) f.entity = entityId;
    });
  }

  setUnplacedHidden(this: Fp3dEditor, entityId: string, on: boolean): void {
    this.change((doc) => {
      doc.settings.unplaced_hidden = setUnplacedHidden(doc.settings, entityId, on);
    });
  }

  /**
   * "Unplaced entities" (#83): the devices of each HA area the plan does not show yet. Place puts one into the
   * area's room (or drag it onto the plan), a suggested item is linked in one tap, Hide moves it to the Hidden view.
   * Computed only while open: it walks every area.
   */
  renderUnplaced(this: Fp3dEditor) {
    const hass = this.hass;
    if (!hass || !this.isEditor || !hass.areas) return nothing;
    const b = this._doc;
    const open = this._unplacedOpen;
    const hiddenN = (b.settings.unplaced_hidden ?? []).length;
    const icon = (id: string) =>
      html`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${iconPath(kindOf(id) ?? "sensor")} /></svg>`;
    const body = () => {
      if (this._unplacedHiddenView) {
        const hidden = hiddenUnplaced(hass, b);
        return html`<button class="fp3d-link" @click=${() => (this._unplacedHiddenView = false)}>← ${this.t("unplaced_back")}</button>
          ${hidden.length
            ? html`<div class="fp3d-room-list">
                ${hidden.map(
                  (h) => html`<div class="fp3d-row fp3d-dev-row">
                    <span class="fp3d-dev-name">${icon(h.id)}<span>${entityName(hass, h.id)}${h.area ? html`<small class="fp3d-muted"> · ${h.area}</small>` : nothing}</span></span>
                    <button class="fp3d-link" @click=${() => this.setUnplacedHidden(h.id, false)}>${this.t("unplaced_unhide")}</button>
                  </div>`,
                )}
              </div>`
            : html`<p class="fp3d-sub">${this.t("unplaced_hidden_none")}</p>`}`;
      }
      const links = furnitureEntities(hass, b.floors);
      const linked = [...links.values()].flatMap((l) => [l.entity, l.power]).filter((v): v is string => !!v);
      const here = this._floorId;
      // the areas of this floor's rooms first
      const areas = unplacedByArea(hass, b, { linked }).sort((x, y) => Number(y.floorId === here) - Number(x.floorId === here));
      const suggested = suggestLinks(hass, b, areas, links);
      const itemName = (s: LinkSuggestion) => {
        const f = b.floors.find((fl) => fl.id === s.floorId)?.furniture.find((m) => m.id === s.furnitureId);
        return f ? f.name || furnitureName(hass, f.type) : "";
      };
      const LIMIT = 80;
      let shown = 0;
      const total = areas.reduce((n, a) => n + a.ids.length, 0);
      return html`<p class="fp3d-sub">${this.t("unplaced_hint")}</p>
        ${areas.length
          ? html`<div class="fp3d-room-list">
                ${areas.map((a) => {
                  const take = a.ids.slice(0, Math.max(0, LIMIT - shown));
                  shown += take.length;
                  if (!take.length) return nothing;
                  const floor = b.floors.find((f) => f.id === a.floorId);
                  const room = floor?.rooms.find((r) => r.id === a.roomId);
                  return html`<div class="fp3d-dev-area">${a.name}${room ? nothing : html`<small class="fp3d-muted"> · ${this.t("unplaced_no_room")}</small>`}</div>
                    ${take.map((id) => {
                      const s = suggested.get(id);
                      return html`<div
                        class="fp3d-row fp3d-dev-row fp3d-unplaced-row"
                        draggable="true"
                        title=${this.t("unplaced_drag")}
                        @dragstart=${(e: DragEvent) => {
                          e.dataTransfer?.setData(ENTITY_DRAG, id);
                          if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
                        }}
                      >
                        <span class="fp3d-dev-name">${icon(id)}<span>${entityName(hass, id, a.name)}</span></span>
                        ${s ? html`<button class="fp3d-link fp3d-suggest" @click=${() => this.acceptLink(id, s)}>${this.t("unplaced_link", { name: itemName(s) })}</button>` : nothing}
                        ${room && floor ? html`<button class="fp3d-link" @click=${() => this.placeDevices([id], room, floor.id)}>${this.t("devices_place")}</button>` : nothing}
                        <button class="fp3d-pin" title=${this.t("unplaced_hide")} aria-label=${this.t("unplaced_hide")} @click=${() => this.setUnplacedHidden(id, true)}>🙈</button>
                      </div>`;
                    })}`;
                })}
              </div>
              ${total > shown ? html`<p class="fp3d-sub">${this.t("devices_narrow", { n: total - shown })}</p>` : nothing}`
          : html`<p class="fp3d-sub">${this.t("unplaced_none")}</p>`}
        ${hiddenN ? html`<button class="fp3d-link" @click=${() => (this._unplacedHiddenView = true)}>${this.t("unplaced_hidden", { n: hiddenN })}</button>` : nothing}`;
    };
    return this.foldRow("unplaced", open, () => (this._unplacedOpen = !open), this.t("unplaced"), "", 0, body);
  }

  updateDevice(this: Fp3dEditor, patch: Partial<Placement>): void {
    const id = this._deviceId;
    this.change((_, floor) => patchItem(floor.placements.find((p) => p.entity_id === id), patch));
  }

  /** Move the selected device to the middle of its room. */
  centreDevice(this: Fp3dEditor): void {
    const pl = this.device;
    const roomId = pl ? this.roomAt([pl.x, pl.z]) : null;
    const room = this.floor?.rooms.find((r) => r.id === roomId);
    if (!pl || !room) return;
    const [x, z] = centroid(room.points);
    this.updateDevice({ x: round(x), z: round(z) });
  }

  /** Spread the room's ceiling lights evenly over it (grid of cells, one light per cell). */
  spreadCeilingLights(this: Fp3dEditor, room: Room): void {
    const floor = this.floor;
    if (!floor) return;
    const lights = floor.placements.filter(
      (p) => kindOf(p.entity_id) === "light" && (p.mount ?? "ceiling") === "ceiling" && pointInPolygon([p.x, p.z], room.points),
    );
    if (lights.length < 2) return;
    const b = bounds(room.points);
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const cols = Math.max(1, Math.round(Math.sqrt((lights.length * w) / Math.max(0.1, d))));
    const rows = Math.ceil(lights.length / cols);
    const spots = lights.map((_, i) => {
      const r = Math.floor(i / cols);
      // a last row that is not full is spread over the whole width as well
      const inRow = r === rows - 1 ? lights.length - cols * (rows - 1) : cols;
      const c = i - r * cols;
      return [round(b.x0 + (w / inRow) * (c + 0.5)), round(b.z0 + (d / rows) * (r + 0.5))] as Vec2;
    });
    const ids = lights.map((l) => l.entity_id);
    this.change((_, f) => {
      ids.forEach((id, i) => patchItem(f.placements.find((p) => p.entity_id === id), { x: spots[i][0], z: spots[i][1] }));
    });
  }

  removeDevice(this: Fp3dEditor, entityId: string): void {
    this.change((doc) => {
      for (const f of doc.floors) {
        f.placements = f.placements.filter((pl) => pl.entity_id !== entityId);
        f.furniture = f.furniture.filter((m) => !(isLamp(m.type) && m.entity === entityId));
      }
    });
  }

  /**
   * Fun pack "pets": a paw at each pet's first spot on this floor (#17), and for the pet whose panel is open every
   * spot of its routine (numbered) and its triggers' places (⚡, #337); dragged to move, tapped to open the panel.
   */
  renderPets(this: Fp3dEditor, floor: Floor) {
    if (this._doc.settings.pets?.on === false) return nothing;
    const far = !pinsShown(this._view.scale, readPinZoom());
    return svg`<g>${petMarks(this._doc, floor.id, this._petId).map((m) => {
      const sel = m.pet.id === this._petId;
      // zoomed far out the markers hide (#220); the selected room's and the open pet's stay
      if (far && !sel && !(this.room && pointInPolygon([m.x, m.z], this.room.points))) return nothing;
      const [x, y] = this.toScreen([m.x, m.z]);
      return svg`<g data-pet=${m.pet.id} data-pet-ref=${m.ref} class="fp3d-device fp3d-pet${sel ? " fp3d-device-sel" : ""}" transform="translate(${x} ${y})">
        <title>${m.pet.name || this.t(`pet_kind_${m.pet.kind}`)}</title>
        <circle r="18" class="fp3d-hit" /><circle r="12" />
        <path d=${PAW} transform="translate(-7.2 -7.2) scale(0.6)" />
        ${sel ? svg`<text class="fp3d-pet-n" x="11" y="-9">${m.trigger ? "⚡" : ""}${m.n}</text>` : nothing}
      </g>`;
    })}</g>`;
  }

  renderDevices(this: Fp3dEditor, floor: Floor) {
    const far = !pinsShown(this._view.scale, readPinZoom());
    const room = far ? this.room : undefined;
    const grabbed = this.drag && "id" in this.drag ? this.drag.id : null;
    return svg`<g>${floor.placements.map((pl) => {
      const kind = kindOf(pl.entity_id);
      if (!kind) return nothing;
      // zoomed far out the markers hide (#220): the rooms read underneath. The selected device, the one being dragged
      // and those in the selected room stay, so nothing the user is working with vanishes.
      if (far && pl.entity_id !== this._deviceId && pl.entity_id !== grabbed && !(room && pointInPolygon([pl.x, pl.z], room.points))) return nothing;
      const [x, y] = this.toScreen([pl.x, pl.z]);
      const on = this.hass?.states[pl.entity_id]?.state === "on";
      const sel = pl.entity_id === this._deviceId;
      const cls = `fp3d-device${on ? " fp3d-device-on" : ""}${sel ? " fp3d-device-sel" : ""}`;
      return svg`<g data-device=${pl.entity_id} class=${cls} transform="translate(${x} ${y})">
        <title>${entityName(this.hass, pl.entity_id)}</title>
        <circle r="18" class="fp3d-hit" /><circle r="12" />
        <path d=${iconPath(kind)} transform="translate(-7.2 -7.2) scale(0.6)" />
      </g>
      ${sel && pl.locked ? svg`<text class="fp3d-lock" x=${x + 16} y=${y - 12}>🔒</text>` : nothing}`;
    })}</g>`;
  }

  renderDeviceForm(this: Fp3dEditor, pl: Placement) {
    const admin = this.isEditor;
    const kind = kindOf(pl.entity_id);
    const light = kind === "light";
    const mount = pl.mount ?? "ceiling";
    const auto = kind ? defaultHeight(kind, this.floor?.height ?? 2.5, light ? mount : null) : 1;
    const roomId = this.roomAt([pl.x, pl.z]);
    const remove = () => {
      this.removeDevice(pl.entity_id);
      this._deviceId = null;
    };
    return html`<section>
      ${this.renderPanelHeader({
        id: `device:${pl.entity_id}`,
        title: pl.name || entityName(this.hass, pl.entity_id),
        kind: this.t("device"),
        where: (roomId && this.floor?.rooms.find((r) => r.id === roomId)?.name) || this.floor?.name,
        live: [stateChip(this.hass, this.hass?.states[pl.entity_id])],
        lock: this.fixLock("device", pl.entity_id),
        menu: [
          { label: this.t("device_centre"), run: () => this.centreDevice() },
          pl.y != null && { label: this.t("height_auto"), run: () => this.updateDevice({ y: null }) },
          { label: this.t("delete"), keys: ["Del"], danger: true, run: remove },
        ],
      })}
      <div class="fp3d-form">
        ${light
          ? html`<label class="fp3d-field fp3d-wide"
              >${this.t("lamp_mount")}
              <select ?disabled=${!admin} @change=${(e: Event) => this.updateDevice({ mount: (e.target as HTMLSelectElement).value as LampMount, y: null })}>
                ${(["ceiling", "floor", "table", "wall"] as const).map((m) => html`<option value=${m} ?selected=${m === mount}>${this.t(`lamp_${m}`)}</option>`)}
              </select></label
            >
            ${this.glowScaleField(pl.glow_scale, (v) => this.updateDevice({ glow_scale: v }))}`
          : kind === "camera"
            ? html`<label class="fp3d-field fp3d-wide"
                >${this.t("camera_mount")}
                <select ?disabled=${!admin} @change=${(e: Event) => this.updateDevice({ mount: (e.target as HTMLSelectElement).value as LampMount, y: null })}>
                  <option value="wall" ?selected=${(pl.mount ?? "wall") === "wall"}>${this.t("camera_mount_wall")}</option>
                  <option value="ceiling" ?selected=${pl.mount === "ceiling"}>${this.t("camera_mount_ceiling")}</option>
                </select></label
              >${this.renderCameraModel(pl)}`
            : nothing}
        ${this.len(this.t("x"), pl.x, (v) => this.updateDevice({ x: v }))} ${this.len(this.t("z"), pl.z, (v) => this.updateDevice({ z: v }))}
        ${this.len(this.t("mount_height"), pl.y ?? auto, (v) => this.updateDevice({ y: Math.max(0, v) }), 0.05, 0)}
        ${this.num(this.t("rotation"), pl.rotation ?? 0, (v) => this.updateDevice({ rotation: ((v % 360) + 360) % 360 }), 1)}
        ${kind === "camera"
          ? html`${this.num(this.t("camera_fov"), pl.fov ?? (pl.mount === "ceiling" ? 360 : 90), (v) => this.updateDevice({ fov: Math.min(360, Math.max(10, v)) }), 5, 10)}
            ${this.len(this.t("camera_reach"), pl.reach ?? (pl.mount === "ceiling" ? 3 : 4.5), (v) => this.updateDevice({ reach: Math.min(50, Math.max(0.5, v)) }), 0.5, 0.5)}
            ${this.num(this.t("camera_tilt"), pl.tilt ?? (pl.mount === "ceiling" ? 65 : 20), (v) => this.updateDevice({ tilt: Math.min(90, Math.max(0, v)) }), 5, 0)}
            <label class="fp3d-check fp3d-wide" title=${this.t("camera_detect_pins_hint")}
              ><input type="checkbox" .checked=${pl.detect_pins !== false} ?disabled=${!admin} @change=${(ev: Event) => this.updateDevice({ detect_pins: (ev.target as HTMLInputElement).checked ? null : false })} />
              ${this.t("camera_detect_pins")}</label
            >
            ${this.renderCameraDetections(pl.entity_id)}`
          : nothing}
        ${kind && TOGGLE_KINDS.has(kind)
          ? html`<label class="fp3d-check fp3d-wide" title=${this.t("device_confirm_hint")}
              ><input type="checkbox" .checked=${!!pl.confirm} ?disabled=${!admin} @change=${(ev: Event) => this.updateDevice({ confirm: (ev.target as HTMLInputElement).checked })} />
              ${this.t("device_confirm")}</label
            >`
          : nothing}
        ${powerSensorFor(this.hass!, pl.entity_id)
          ? html`<label class="fp3d-check fp3d-wide" title=${this.t("furn_holo_hint")}
              ><input type="checkbox" .checked=${!!pl.holo} ?disabled=${!admin} @change=${(ev: Event) => this.updateDevice({ holo: (ev.target as HTMLInputElement).checked || undefined })} />
              ${this.t("furn_holo")}</label
            >`
          : nothing}
        ${powerSensorFor(this.hass!, pl.entity_id) ? this.circuitSelect(pl.circuit ?? null, powerSensorFor(this.hass!, pl.entity_id), (v) => this.updateDevice({ circuit: v })) : nothing}
        ${powerSensorFor(this.hass!, pl.entity_id) ? this.wireEnergySelect(pl.energy ?? null, powerSensorFor(this.hass!, pl.entity_id)!, (v) => this.updateDevice({ energy: v })) : nothing}
        ${this.markerSelect(pl.marker ?? null, (v) => this.updateDevice({ marker: v }))}
        <label class="fp3d-field fp3d-wide" title=${this.t("device_name_hint")}
          >${this.t("furn_name")}
          <input type="text" .value=${pl.name ?? ""} ?disabled=${!admin} maxlength="60" placeholder=${entityName(this.hass!, pl.entity_id)} @change=${(e: Event) => this.updateDevice({ name: (e.target as HTMLInputElement).value.trim() || null })}
        /></label>
        <label class="fp3d-field fp3d-wide" title=${this.t("aliases_hint")}
          >${this.t("aliases")}
          <input type="text" maxlength="240" .value=${(pl.aliases ?? []).join(", ")} ?disabled=${!admin} placeholder=${this.aliasPlaceholder(pl.name || entityName(this.hass!, pl.entity_id), !!pl.name)} @change=${(e: Event) => this.updateDevice({ aliases: splitAliases((e.target as HTMLInputElement).value) })}
        /></label>
        ${pl.name
          ? html`<label class="fp3d-check fp3d-wide"
              ><input type="checkbox" .checked=${!!pl.show_name} ?disabled=${!admin} @change=${(ev: Event) => this.updateDevice({ show_name: (ev.target as HTMLInputElement).checked || undefined })} />
              ${this.t("show_name")}</label
            >`
          : nothing}
        ${this.iconInput(pl.icon, (v) => this.updateDevice({ icon: v }), String(this.hass?.states[pl.entity_id]?.attributes.icon ?? ""))}
        ${this.renderAsFurniture(pl)}
      </div>
      ${this.renderItemActions(pl.actions, pl.entity_id, (a) => this.updateDevice({ actions: a }))}
    </section>`;
  }

  renderDeviceList(this: Fp3dEditor, room: Room, heading = true) {
    const admin = this.isEditor;
    const hass = this.hass;
    const areaName = room.area_id ? hass?.areas?.[room.area_id]?.name : undefined;
    const area = hass ? areaEntities(hass, room.area_id).filter((id) => isPlaceable(kindOf(id))) : [];
    // placed as a device, or as a lamp with this light
    const placedHere = new Set([
      ...(this.floor?.placements.filter((pl) => pointInPolygon([pl.x, pl.z], room.points)).map((pl) => pl.entity_id) ?? []),
      ...(this.floor?.furniture.filter((m) => isLamp(m.type) && m.entity && pointInPolygon([m.x, m.z], room.points)).map((m) => m.entity!) ?? []),
    ]);
    // placed before it was hidden in Home Assistant: it stays in 3D, so it stays in the list too – to remove or hide it (#645)
    const ids = hass ? [...area, ...[...placedHere].filter((id) => !area.includes(id) && hiddenInHa(hass, id) && isPlaceable(kindOf(id)))] : area;
    const groups = hass ? groupByDevice(hass, ids) : [];
    // the automatic placement only takes each device's main entity
    const unplacedMain = groups.map((g) => g.primary).filter((id) => !placedHere.has(id));
    const q = this._deviceQuery.trim().toLowerCase();
    const matches = (id: string) => !q || entityName(hass, id, areaName).toLowerCase().includes(q) || id.includes(q);
    const ceilingLights = this.floor?.placements.filter(
      (p) => kindOf(p.entity_id) === "light" && (p.mount ?? "ceiling") === "ceiling" && pointInPolygon([p.x, p.z], room.points),
    ).length;
    const pinned = new Set(room.panel ?? []);
    const hidden = new Set(room.hidden ?? []);
    const noState = new Set(room.no_state ?? []);
    // where an entity from elsewhere is placed already (placing it here moves it)
    const placedIn = new Map<string, string>();
    for (const f of this._doc.floors)
      for (const id of [...f.placements.map((p) => [p.entity_id, p.x, p.z] as const), ...f.furniture.filter((m) => isLamp(m.type) && m.entity).map((m) => [m.entity!, m.x, m.z] as const)]) {
        const r = f.rooms.find((x) => pointInPolygon([id[1], id[2]], x.points));
        if (r && r.id !== room.id) placedIn.set(id[0], r.name);
      }
    // extra: an entity from another area (shown only to place it); sub: a further entity of a device, with the same
    // buttons as its main one – hidden or without state on its own (D484)
    const row = (id: string, extra = false, nameArea = areaName, sub = false) => {
      const placed = placedHere.has(id);
      const elsewhere = placed ? undefined : placedIn.get(id);
      return html`<div class="fp3d-row fp3d-dev-row ${extra || sub ? "fp3d-dev-extra" : ""} ${hidden.has(id) ? "fp3d-dev-hidden" : ""}">
        <button class="fp3d-dev-name ${placed ? "" : "fp3d-muted"}" ?disabled=${!placed} @click=${() => this.selectItem("device", id)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d=${iconPath(kindOf(id)!)} />
          </svg>
          <span>${entityName(hass, id, nameArea)}${elsewhere ? html`<small class="fp3d-muted"> · ${this.t("devices_placed_in", { room: elsewhere })}</small>` : nothing}</span>
        </button>
        ${admin && !extra
          ? html`<button
              class="fp3d-pin ${hidden.has(id) ? "fp3d-pin-on" : ""}"
              aria-pressed=${hidden.has(id)}
              title=${this.t(hidden.has(id) ? "panel_unhide" : "panel_hide")}
              aria-label=${this.t(hidden.has(id) ? "panel_unhide" : "panel_hide")}
              @click=${() => this.updateRoom({ hidden: hidden.has(id) ? [...hidden].filter((x) => x !== id) : [...hidden, id] })}
            >
              ${devIcon(DEV_ICONS.eye, hidden.has(id))}
            </button>`
          : nothing}
        ${admin && !extra && !hidden.has(id)
          ? html`<button
              class="fp3d-pin ${noState.has(id) ? "fp3d-pin-on" : ""}"
              aria-pressed=${noState.has(id)}
              title=${this.t(noState.has(id) ? "panel_state_show" : "panel_state_hide")}
              aria-label=${this.t(noState.has(id) ? "panel_state_show" : "panel_state_hide")}
              @click=${() => this.updateRoom({ no_state: noState.has(id) ? [...noState].filter((x) => x !== id) : [...noState, id] })}
            >
              ${devIcon(DEV_ICONS.text, noState.has(id))}
            </button>`
          : nothing}
        ${admin && !placed
          ? html`<button
              class="fp3d-pin ${pinned.has(id) ? "fp3d-pin-on" : ""}"
              aria-pressed=${pinned.has(id)}
              title=${this.t(pinned.has(id) ? "panel_unpin" : "panel_pin")}
              aria-label=${this.t(pinned.has(id) ? "panel_unpin" : "panel_pin")}
              @click=${() => this.updateRoom({ panel: pinned.has(id) ? [...pinned].filter((x) => x !== id) : [...pinned, id] })}
            >
              ${devIcon(DEV_ICONS.star, false, pinned.has(id))}
            </button>`
          : nothing}
        ${admin
          ? placed
            ? html`<button class="fp3d-link" @click=${() => this.removeDevice(id)}>${this.t("devices_remove")}</button>`
            : html`<button class="fp3d-link" @click=${() => this.placeDevices([id])}>${this.t("devices_place")}</button>`
          : nothing}
      </div>`;
    };
    const source = admin ? this._devSource : "area";
    const setSource = (v: "area" | "other" | "none") => {
      this._devSource = v;
      this._deviceQuery = "";
    };
    const searchField = html`<input
      class="fp3d-search"
      type="search"
      placeholder=${this.t("devices_search")}
      .value=${this._deviceQuery}
      @input=${(e: Event) => (this._deviceQuery = (e.target as HTMLInputElement).value)}
    />`;
    const placeAll = async () => {
      if (await this.ask(this.t("devices_place_all_confirm", { n: unplacedMain.length }), this.t("ask_ok"), false)) this.placeDevices(unplacedMain);
    };
    // inside the room panel's Devices fold (#416) the fold row is its heading
    return html`<section>
      ${heading ? html`<h3>${this.t("devices")}</h3>` : nothing}
      <p class="fp3d-sub">${this.t("devices_panel_hint")}</p>
      ${admin && source === "area" && ids.length
        ? html`<p class="fp3d-dev-legend">
            <span>${devIcon(DEV_ICONS.eye)}${this.t("devices_legend_hide")}</span>
            <span>${devIcon(DEV_ICONS.text)}${this.t("devices_legend_state")}</span>
            <span>${devIcon(DEV_ICONS.star)}${this.t("devices_legend_pin")}</span>
          </p>`
        : nothing}
      ${admin
        ? html`<div class="fp3d-seg fp3d-dev-source">
            <button aria-pressed=${source === "area"} @click=${() => setSource("area")}>${this.t("devices_src_area")}${ids.length ? ` (${groups.length})` : ""}</button>
            <button aria-pressed=${source === "other"} @click=${() => setSource("other")}>${this.t("devices_src_other")}</button>
            <button aria-pressed=${source === "none"} @click=${() => setSource("none")}>${this.t("devices_src_none")}</button>
          </div>`
        : nothing}
      ${source !== "area"
        ? html`${searchField}${this.renderDeviceExtras(room, row, source)}`
        : !room.area_id
        ? html`<p class="fp3d-sub">${this.t("devices_none_area")}</p>`
        : !ids.length
          ? html`<p class="fp3d-sub">${this.t("devices_none")}</p>`
          : html`${admin && (ceilingLights ?? 0) >= 2
                ? html`<button class="fp3d-btn fp3d-wide-btn" @click=${() => this.spreadCeilingLights(room)}>${this.t("lights_spread")}</button>`
                : nothing}
              ${ids.length > 8 ? searchField : nothing}
              <div class="fp3d-room-list">
                ${groups.map((g) => {
                  const others = g.others.filter(matches);
                  const open = this._expanded.has(g.primary) || (!!q && others.length > 0);
                  if (!matches(g.primary) && !others.length) return nothing;
                  return html`${row(g.primary)}
                  ${g.others.length
                    ? html`<button
                        class="fp3d-more"
                        @click=${() => {
                          const next = new Set(this._expanded);
                          if (next.has(g.primary)) next.delete(g.primary);
                          else next.add(g.primary);
                          this._expanded = next;
                        }}
                      >
                        ${open ? this.t("devices_less") : this.t("devices_more", { n: g.others.length })}
                      </button>`
                    : nothing}
                  ${open ? this.renderDeviceOthers(q ? others : g.others, (id) => row(id, false, areaName, true), hidden, admin) : nothing}`;
                })}
              </div>
              ${admin && unplacedMain.length > 1
                ? html`<button class="fp3d-link fp3d-place-all" @click=${placeAll}>${this.t("devices_place_all_n", { n: unplacedMain.length })}</button>`
                : nothing}
              <p class="fp3d-sub">${this.t("devices_hint")}</p>`}
    </section>`;
  }

  /**
   * The further entities of an unfolded device: an LED strip from Govee2MQTT brings hundreds of segment lights
   * (#645), so the list stops after a few dozen (the search narrows it) and one button hides or shows them all.
   */
  renderDeviceOthers(this: Fp3dEditor, ids: string[], row: (id: string) => unknown, hidden: Set<string>, admin: boolean) {
    const LIMIT = 40;
    const allHidden = ids.every((id) => hidden.has(id));
    const toggleAll = () => {
      const set = new Set(hidden);
      for (const id of ids) {
        if (allHidden) set.delete(id);
        else set.add(id);
      }
      this.updateRoom({ hidden: [...set] });
    };
    return html`${admin && ids.length >= 5
        ? html`<button class="fp3d-link fp3d-dev-all" @click=${toggleAll}>
            ${this.t(allHidden ? "devices_show_all" : "devices_hide_all", { n: ids.length })}
          </button>`
        : nothing}
      ${ids.slice(0, LIMIT).map(row)}
      ${ids.length > LIMIT ? html`<p class="fp3d-sub">${this.t("devices_narrow", { n: ids.length - LIMIT })}</p>` : nothing}`;
  }

  /** Devices from other areas or without an area, for the chosen source (computed only when shown). */
  renderDeviceExtras(this: Fp3dEditor, room: Room, row: (id: string, extra?: boolean, nameArea?: string) => unknown, source: "other" | "none") {
    const hass = this.hass;
    if (!hass) return nothing;
    const LIMIT = 50;
    const q = this._deviceQuery.trim().toLowerCase();
    const match = (id: string, area?: string) => !q || `${entityName(hass, id, area)} ${id} ${area ?? ""}`.toLowerCase().includes(q);
    const more = (n: number) => (n > 0 ? html`<p class="fp3d-sub">${this.t("devices_narrow", { n })}</p>` : nothing);
    if (source === "other") {
      let shown = 0;
      let hidden = 0;
      const blocks = otherAreaEntities(hass, room.area_id).map((a) => {
        const ids = a.ids.filter((id) => match(id, a.name));
        const take = ids.slice(0, Math.max(0, LIMIT - shown));
        shown += take.length;
        hidden += ids.length - take.length;
        return take.length ? html`<div class="fp3d-dev-area">${a.name}</div>${take.map((id) => row(id, false, a.name))}` : nothing;
      });
      return shown ? html`<div class="fp3d-room-list">${blocks}</div>${more(hidden)}` : html`<p class="fp3d-sub">${this.t("devices_none")}</p>`;
    }
    const ids = unassignedEntities(hass).filter((id) => match(id));
    return ids.length
      ? html`<div class="fp3d-room-list">${ids.slice(0, LIMIT).map((id) => row(id))}</div>${more(ids.length - Math.min(ids.length, LIMIT))}`
      : html`<p class="fp3d-sub">${this.t("devices_none")}</p>`;
  }
}
