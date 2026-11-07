// Roaming pets (#337): a pet's panel in the editor (its daily routine and triggers, the element in pet-panel.ts, a
// lazy chunk of its own), the pets list of a floor, and placing a spot or a trigger's place with a tap in the plan.

import { html, nothing } from "lit";
import type { I18nKey } from "../../i18n.ts";
import { uid, type Floor, type Pet } from "../../model.ts";
import { movePet, petFloor, petSpots } from "../../pet-place.ts";
import type { Fp3dEditor } from "../editor.ts";
import { loadPetPanel, need } from "./lazy.ts";

/** PetsPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class PetsPart {
  /** Open a pet's panel (nothing else stays selected). */
  selectPet(this: Fp3dEditor, id: string): void {
    this.selectItem("room", null);
    this._petId = id;
    this._sideOpen = true;
  }

  /** The pets that live on a floor (or have a spot on it): a row each, tapped to open its panel. */
  renderPetList(this: Fp3dEditor, floor: Floor) {
    const pets = this._doc.settings.pets;
    if (!pets || pets.on === false) return nothing;
    const here = pets.list.filter((p) => petFloor(this._doc, p)?.id === floor.id || petSpots(p).some((s) => s.floor_id === floor.id));
    if (!here.length) return nothing;
    return html`<section>
      <h3>${this.t("pets_here")}</h3>
      <div class="fp3d-room-list">
        ${here.map((p) => html`<button class="fp3d-row fp3d-room-btn" @click=${() => this.selectPet(p.id)}><span>🐾 ${p.name || this.t(`pet_kind_${p.kind}`)}</span></button>`)}
      </div>
    </section>`;
  }

  renderPetPanel(this: Fp3dEditor) {
    const pet = this._doc.settings.pets?.list.find((p) => p.id === this._petId);
    if (!pet) return nothing;
    need(loadPetPanel);
    const kind = this.t(`pet_kind_${pet.kind}` as I18nKey);
    return html`${this.renderPanelHeader({
        id: `pet:${pet.id}`,
        title: pet.name || kind,
        kind,
        where: petFloor(this._doc, pet)?.name,
        menu: [{ label: this.t("delete"), danger: true, run: () => void this.deletePet(pet.id) }],
      })}
      <fp3d-pet-panel
      .pet=${pet}
      .floors=${this._doc.floors.map((f) => ({ id: f.id, name: f.name }))}
      .hass=${this.hass}
      .home=${this.home}
      .readonly=${!this.isEditor}
      .roamOff=${this._doc.settings.pets?.roam === false || pet.static === true}
      .picking=${this._petPick}
      .t=${(k: string, v?: Record<string, string | number>) => this.t(k as I18nKey, v)}
      @pet-change=${(e: CustomEvent<{ pet: Pet }>) => this.changePet(e.detail.pet)}
      @pet-pick=${(e: CustomEvent<{ ref: string | null }>) => (this._petPick = e.detail.ref)}
    ></fp3d-pet-panel>`;
  }

  /** Delete a pet (#409: Delete is in the header's "⋯" of every panel), after asking; its panel closes. */
  async deletePet(this: Fp3dEditor, id: string): Promise<void> {
    const pet = this._doc.settings.pets?.list.find((p) => p.id === id);
    if (!pet || !this.isEditor) return;
    if (!(await this.ask(this.t("pet_delete_ask", { name: pet.name || this.t(`pet_kind_${pet.kind}` as I18nKey) })))) return;
    this.change((doc) => {
      const pets = doc.settings.pets;
      if (pets) pets.list = pets.list.filter((p) => p.id !== id);
    });
    if (this._petId === id) this._petId = null;
  }

  changePet(this: Fp3dEditor, pet: Pet): void {
    this.change((doc) => {
      const pets = doc.settings.pets;
      if (pets) pets.list = pets.list.map((p) => (p.id === pet.id ? pet : p));
    });
  }

  /** The tap the panel asked for: a new spot of the routine there, or the spot's or trigger's place moved there. */
  petPickAt(this: Fp3dEditor, world: [number, number]): void {
    const ref = this._petPick;
    const floor = this.floor;
    this._petPick = null;
    if (!ref || !floor || !this._petId || !this.isEditor) return;
    const id = this._petId;
    const grid = this._doc.settings.grid;
    this.change((doc) => {
      const pet = doc.settings.pets?.list.find((p) => p.id === id);
      if (!pet) return;
      let r = ref;
      if (ref === "spot:new") {
        const spot = { id: uid("spot"), floor_id: floor.id, x: 0, z: 0, pose: "sit" as const, rotation: null, from: null, to: null, days: null };
        pet.spots = [...petSpots(pet), spot];
        r = `spot:${spot.id}`;
      }
      movePet(doc, id, world[0], world[1], grid, r, floor.id);
    });
  }
}
