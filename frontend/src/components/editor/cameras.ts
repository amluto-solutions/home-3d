// Cameras: the camera model picker and the detection sensors of a camera.

import { html, nothing } from "lit";
import { entityName } from "../../devices.ts";
import { cameraMotionSensors, cameraOwnSensors, detectionKind } from "../../markers.ts";
import type { I18nKey } from "../../i18n.ts";
import type { Placement } from "../../model.ts";
import { detectCameraModel, isCameraModel, setCameraLook } from "../../camera-models.ts";
import { furnitureName } from "../../furniture-names.ts";
import { packItemName, packType } from "../../packs.ts";
import type { Fp3dEditor } from "../editor.ts";

/** CamerasPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class CamerasPart {
  /**
   * A camera's real shape (#9): the camera models of the packs (the core pack's UniFi cameras), the one its device
   * reports marked. Only its look: the pin keeps the live view, the aim and the actions.
   */
  renderCameraModel(this: Fp3dEditor, pl: Placement) {
    const lang = this.hass?.language ?? "en";
    const packs = this.packs ?? [];
    const models = packs
      .flatMap((p) => p.items.filter(isCameraModel).map((it) => ({ type: packType(p.id, it.id), label: packItemName(it, lang) })))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (!models.length) return nothing;
    const look = this.floor?.furniture.find((m) => m.look_of === pl.entity_id)?.type ?? "";
    const found = this.hass ? detectCameraModel(this.hass, pl.entity_id, packs) : null;
    return html`<label class="fp3d-field fp3d-wide" title=${this.t("camera_model_hint")}
      >${this.t("camera_model")}
      <select
        ?disabled=${!this.isEditor}
        @change=${(e: Event) => {
          const v = (e.target as HTMLSelectElement).value;
          this.change((_, f) => setCameraLook(f, pl.entity_id, v || null));
        }}
      >
        <option value="" ?selected=${!look}>${this.t("camera_look_builtin")}</option>
        ${look && !models.some((m) => m.type === look) ? html`<option value=${look} selected>${furnitureName(this.hass, look)}</option>` : nothing}
        ${models.map((m) => html`<option value=${m.type} ?selected=${m.type === look}>${m.type === found ? this.t("camera_model_found", { name: m.label }) : m.label}</option>`)}
      </select></label
    >`;
  }

  /**
   * Kamera-Cockpit: which detection sensors count for the camera (person, vehicle, animal, motion). Found by
   * themselves on the camera's device; with "choose" a tick per sensor, and sensors of other devices can be added
   * (Frigate's person sensor for a Reolink camera, #815).
   */
  renderCameraDetections(this: Fp3dEditor, cameraId: string) {
    if (!this.hass) return nothing;
    const hass = this.hass;
    const pl = this.floor?.placements.find((p) => p.entity_id === cameraId);
    const chosen = Array.isArray(pl?.detect_sensors) ? pl!.detect_sensors : null;
    const own = cameraOwnSensors(hass, cameraId);
    const sensors = cameraMotionSensors(hass, cameraId);
    const kinds = [...new Set(sensors.map((id) => detectionKind(hass, id)))];
    const admin = this.isEditor;
    const set = (list: string[] | null) => this.updateDevice({ detect_sensors: list });
    const detectClass = (id: string) => id.startsWith("binary_sensor.") && ["motion", "occupancy", "presence"].includes(String(hass.states[id]?.attributes.device_class));
    // the list to tick: the camera's own sensors and every one chosen before
    const listed = [...new Set([...own, ...(chosen ?? [])])];
    return html`<p class="fp3d-sub fp3d-wide">
        ${sensors.length
          ? html`${this.t("camera_detect_found", { kinds: kinds.map((k) => this.t(`detect_${k}` as I18nKey)).join(", "), n: sensors.length })}`
          : this.t("camera_detect_none")}
      </p>
      <label class="fp3d-check fp3d-wide" title=${this.t("camera_detect_choose_hint")}
        ><input type="checkbox" .checked=${chosen !== null} ?disabled=${!admin} @change=${(ev: Event) => set((ev.target as HTMLInputElement).checked ? [...own] : null)} />
        ${this.t("camera_detect_choose")}</label
      >
      ${chosen !== null
        ? html`${listed.map(
              (id) =>
                html`<label class="fp3d-check fp3d-wide fp3d-indent"
                  ><input type="checkbox" .checked=${chosen.includes(id)} ?disabled=${!admin} @change=${(ev: Event) => set((ev.target as HTMLInputElement).checked ? [...chosen, id] : chosen.filter((x) => x !== id))} />
                  ${entityName(hass, id)} <span class="fp3d-sub">${id}</span></label
                >`,
            )}
            ${this.entitySelect(this.t("camera_detect_add"), null, undefined, this.entityOptionsFor(this.detectFilter(detectClass, listed)), (v) => {
              if (v && v !== "none") set([...chosen, v]);
            })}`
        : nothing}`;
  }
  detectFilter(this: Fp3dEditor, cls: (id: string) => boolean, listed: string[]): (id: string) => boolean {
    const key = listed.join(",");
    if (this._detectFilter?.key !== key) this._detectFilter = { key, fn: (id) => cls(id) && !listed.includes(id) };
    return this._detectFilter.fn;
  }
}
