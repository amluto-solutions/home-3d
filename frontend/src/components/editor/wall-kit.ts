// The wall view's kit: adding pieces to a wall or into a gap, recently used types, the pieces list and pictures.

import { html, nothing } from "lit";
import { sharedEdge } from "../../geometry/snap.ts";
import { fromWall, furnitureOnWall, openingsOnWall, type WallFrame } from "../../geometry/wall-frame.ts";
import { translate, type I18nKey } from "../../i18n.ts";
import { FURNITURE_TYPES, LAMP_MODEL, uid, type Furniture, type Room } from "../../model.ts";
import { load3d } from "../../load3d.ts";
import { ensureRecipes } from "../../pack-recipes.ts";
import { furnitureSize, packInfo, packItemName, packType, renamedPackType } from "../../packs.ts";
import { WALL_CATS, HANGING, WALL_FIT, WALL_FIT_MIN, round, type RunCtx, fold, EN_HASS } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";

/** WallKitPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class WallKitPart {
  // ------------------------------------------------------------------ pipes on walls (pool module)

  /**
   * A device from the wall view's side bar straight onto the wall shown: at the first free place from the left
   * (not in front of a door), its back to the wall, chosen so it can be dragged where it belongs.
   */
  addOnWall(this: Fp3dEditor, type: string, frame: WallFrame, room: Room): void {
    const floor = this.floor;
    if (!floor || !this.isEditor) return;
    this.rememberWallType(type);
    const gap = this._wallGap;
    if (gap) return this.addIntoGap(type, frame, room, gap);
    const [w, d, h] = furnitureSize(type);
    const taken = [
      ...furnitureOnWall(frame, floor, room).map((i) => [i.s0, i.s1]),
      ...openingsOnWall(frame, floor)
        .filter((o) => o.y0 < 0.05)
        .map((o) => [o.s0, o.s1]),
    ];
    let s0 = Math.max(0, frame.length / 2 - w / 2);
    for (let t = 0.1; t + w <= frame.length - 0.05; t += 0.05)
      if (!taken.some(([a, b]) => t < b + 0.05 && t + w > a - 0.05)) {
        s0 = t;
        break;
      }
    const face = sharedEdge(floor, room.id, frame.a, frame.b) ? this._doc.settings.wall_interior / 2 : 0;
    const [x, z] = fromWall(frame, s0 + w / 2, face + d / 2 + 0.01);
    const rotation = Math.round((((Math.atan2(-frame.n[0], frame.n[1]) * 180) / Math.PI) % 360 + 360) % 360);
    const item: Furniture = { id: uid("furniture"), type, x: round(x), z: round(z), rotation, w, d, h, variant: null };
    this.change((_, f) => f.furniture.push(item));
    this._runSel = null;
    this._runMode = null;
    this._wallSel = item.id;
  }

  /** A piece into the tapped stretch of wall: at its left end, as wide as the gap when the piece is a cabinet that can be (and is too wide). */
  addIntoGap(this: Fp3dEditor, type: string, frame: WallFrame, room: Room, gap: { s0: number; s1: number; low: boolean }): void {
    const floor = this.floor!;
    const gw = gap.s1 - gap.s0;
    let [w, d, h] = furnitureSize(type);
    if (WALL_FIT.has(type) && (w > gw + 0.005 || gw - w < 0.1)) w = Math.round(gw * 1000) / 1000;
    const face = sharedEdge(floor, room.id, frame.a, frame.b) ? this._doc.settings.wall_interior / 2 : 0;
    const sMid = gap.s0 + Math.min(w, gw) / 2;
    const [x, z] = fromWall(frame, sMid, face + d / 2 + 0.01);
    const rotation = Math.round((((Math.atan2(-frame.n[0], frame.n[1]) * 180) / Math.PI) % 360 + 360) % 360);
    const item: Furniture = { id: uid("furniture"), type, x: round(x), z: round(z), rotation, w, d, h, variant: null };
    this.change((_, f) => f.furniture.push(item));
    this._wallGap = null;
    this._wallSel = item.id;
    this._wallMulti = [];
  }

  rememberWallType(this: Fp3dEditor, type: string): void {
    try {
      const list = JSON.parse(localStorage.getItem("home3d.wallRecent") ?? "[]") as string[];
      localStorage.setItem("home3d.wallRecent", JSON.stringify([type, ...list.filter((t) => t !== type)].slice(0, 6)));
    } catch {
      // no storage
    }
  }

  wallRecent(this: Fp3dEditor): string[] {
    try {
      const list = JSON.parse(localStorage.getItem("home3d.wallRecent") ?? "[]");
      // a type kept before #424 under our packs' old ids (theovencook.*) is read under the new one
      const types = Array.isArray(list) ? list.filter((t): t is string => typeof t === "string").map(renamedPackType) : [];
      return types.filter((t) => FURNITURE_TYPES.includes(t as never) || !!packInfo(t));
    } catch {
      return [];
    }
  }

  /**
   * The wall view's side bar: a few category symbols, a search and the recently used – no long list. A tapped gap
   * in the wall narrows it to what fits there (best fit first); a cabinet too wide for the gap is fitted to it.
   */
  renderWallFurniture(this: Fp3dEditor, frame: WallFrame, room: Room) {
    const lang = this.hass?.language ?? "en";
    const gap = this._wallGap;
    const gw = gap ? gap.s1 - gap.s0 : 0;
    const q = fold(this._wallQuery.trim());
    const cat = this._wallCat;
    const packItems = (this.packs ?? []).flatMap((p) => p.items.filter((it) => !it.light && !it.vehicle && !it.hole && it.mount !== "ceiling").map((it) => ({ type: packType(p.id, it.id), label: packItemName(it, lang), search: `${Object.values(it.name).join(" ")} ${p.name}`, wall: it.mount === "wall" })));
    const label = (t: string) => this.t(`furn_${t}` as I18nKey);
    let pool: { type: string; label: string; search: string; wall?: boolean }[] = [];
    if (cat === "pack") pool = packItems;
    else if (cat === "energy") pool = (["meter", "inverter", "home_battery", "wallbox"] as const).map((t) => ({ type: t, label: label(t), search: "" }));
    else if (cat) pool = (WALL_CATS[cat] ?? []).map((t) => ({ type: t, label: label(t), search: translate(EN_HASS, `furn_${t}` as I18nKey) }));
    else if (q || gap) pool = [...Object.values(WALL_CATS).flat().filter((t, i, a) => a.indexOf(t) === i).map((t) => ({ type: t, label: label(t), search: translate(EN_HASS, `furn_${t}` as I18nKey) })), ...packItems];
    // nothing chosen yet and nothing used before: the base cabinets as a start, so the bar is never empty
    else if (!this.wallRecent().length) pool = WALL_CATS.base.map((t) => ({ type: t, label: label(t), search: "" }));
    const words = q.split(/\s+/).filter(Boolean);
    let hits = words.length ? pool.filter((it) => words.every((w) => fold(`${it.label} ${it.search} ${it.type.replace(/[_:.]/g, " ")}`).includes(w))) : pool;
    // a gap: standing or hanging pieces that fit (or can be fitted), the closest width first
    if (gap) {
      const hanging = (t: string, wall?: boolean) => wall || HANGING.has(t);
      hits = hits
        .filter((it) => hanging(it.type, it.wall) === !gap.low)
        .filter((it) => furnitureSize(it.type)[0] <= gw + 0.01 || (WALL_FIT.has(it.type) && gw >= (WALL_FIT_MIN[it.type] ?? 0.2)))
        // what fills the gap best first: cabinets built to measure fill it completely, then the closest widths;
        // the built-in pieces before pack items of the same fill
        .sort((a, b) => {
          const fill = (t: string) => (WALL_FIT.has(t) ? 1 : Math.min(1, furnitureSize(t)[0] / gw));
          return fill(b.type) - fill(a.type) || Number(a.type.startsWith("pack:")) - Number(b.type.startsWith("pack:"));
        });
    }
    const recent = !cat && !q && !gap ? this.wallRecent() : [];
    const cats: [string, string][] = [
      ["base", "▭"],
      ["hang", "▔"],
      ["tall", "▯"],
      ["living", "🛋"],
      ["light", "💡"],
      ["switches", "🔌"],
      ...((this.packs ?? []).some((p) => p.items.length) ? ([["pack", "🧩"]] as [string, string][]) : []),
      ...([["energy", "⚡"]] as [string, string][]),
    ];
    const shown = [...recent, ...hits.slice(0, 40).map((h) => h.type)];
    void this.askKitPics(shown);
    void this._wallPicTick;
    const item = (t: string, name: string) => {
      const w = furnitureSize(t)[0];
      const fitted = gap && WALL_FIT.has(t) && (w > gw + 0.005 || gw - w < 0.1);
      const pic = this.kitPics.get(t);
      return html`<button class="fp3d-wv-tile" title=${name} @click=${() => this.addOnWall(t, frame, room)}>
        <span class="fp3d-wv-tile-pic">${pic ? html`<img src=${pic} alt="" />` : html`<i></i>`}</span>
        <span class="fp3d-wv-tile-name">${name}</span>
        <small class=${fitted ? "fp3d-wv-fit" : ""}>${fitted ? `↔ ${this.m(gw, 2)}` : this.m(w, 2)}</small>
      </button>`;
    };
    return html`<aside class="fp3d-wv-kit">
      <h4>${this.t("wv_kit_title")}</h4>
      <div class="fp3d-wv-cats">
        ${cats.map(([k, icon]) => html`<button class="fp3d-wv-cat ${cat === k ? "fp3d-on" : ""}" title=${this.t(`wv_cat_${k}` as I18nKey)} @click=${() => (this._wallCat = cat === k ? null : k)}><span>${icon}</span>${this.t(`wv_cat_${k}` as I18nKey)}</button>`)}
      </div>
      <input class="fp3d-search" type="search" placeholder=${this.t("furniture_search")} .value=${this._wallQuery} @input=${(e: Event) => (this._wallQuery = (e.target as HTMLInputElement).value)} />
      ${gap
        ? html`<p class="fp3d-sub fp3d-wv-gapnote">${this.t("wv_gap", { w: this.m(gw, 2) })} <button class="fp3d-link" @click=${() => (this._wallGap = null)}>✕</button></p>`
        : !cat && !q
          ? html`<p class="fp3d-sub">${this.t("wv_gap_hint")}</p>`
          : nothing}
      ${cat ? html`<h4>${this.t(`wv_cat_${cat}` as I18nKey)}</h4>` : nothing}
      ${recent.length ? html`<h4>${this.t("wv_recent")}</h4><div class="fp3d-wv-tiles">${recent.map((t) => item(t, packInfo(t) ? packItemName(packInfo(t)!, lang) : label(t)))}</div>` : nothing}
      ${(cat || q || gap) && !hits.length ? html`<p class="fp3d-sub">${this.t(gap ? "wv_none_fits" : "furniture_search_none")}</p>` : nothing}
      <div class="fp3d-wv-tiles">${hits.slice(0, 40).map((it) => item(it.type, it.label))}</div>
    </aside>`;
  }

  /** Draws the side bar's pictures with the 3D bundle (once per type). */
  async askKitPics(this: Fp3dEditor, types: string[]): Promise<void> {
    const missing = types.filter((t) => !this.kitPicsAsked.has(t));
    if (!missing.length) return;
    for (const t of missing) this.kitPicsAsked.add(t);
    try {
      const [mod] = await Promise.all([load3d(), this.hass ? ensureRecipes(this.hass, missing) : undefined]);
      for (const t of missing) {
        const [w, d, h] = furnitureSize(t);
        this.kitPics.set(t, mod.furniturePreview({ type: t, w, d, h, variant: null, lamp: LAMP_MODEL[t] ?? null }, 120, this.packs ?? []));
      }
    } catch {
      // no 3D: names only
    }
    this._wallPicTick++;
  }

  /** The wall view's side bar: pool devices, ball valves and sight glasses (pool module), energy devices (energy feature). */
  renderWallKit(this: Fp3dEditor, frame: WallFrame, room: Room, rc: RunCtx | null) {
    const pool = !!rc;
    if (!pool) return this.isEditor ? this.renderWallFurniture(frame, room) : nothing;
    if (this._techMode && rc) return this.renderTechKit(frame, room, rc);
    if (!this.isEditor) return nothing;
    const add = (t: string) => html`<button class="fp3d-btn" @click=${() => this.addOnWall(t, frame, room)}>+ ${this.t(`furn_${t}` as I18nKey)}</button>`;
    const fit = (mode: "valve" | "sight", label: I18nKey) =>
      html`<button class="fp3d-btn ${this._runMode === mode ? "fp3d-primary" : ""}" title=${this.t("wall_run_fit")} @click=${() => this.kitFitting(rc, mode)}>+ ${this.t(label)}</button>`;
    return html`<aside class="fp3d-wv-kit">
      ${pool
        ? html`<h4>${this.t("wall_kit_pool")}</h4>
            ${(["pool_pump", "pool_filter", "pool_heat_pump", "pool_dosing"] as const).map(add)} ${fit("valve", "wall_run_valve")} ${fit("sight", "wall_run_sight")}
            ${(["hole_wall", "hole_floor", "tee", "y"] as const).map(
              (m) => html`<button class="fp3d-btn ${this._runMode === m ? "fp3d-primary" : ""}" title=${this.t("wall_run_place")} @click=${() => {
                this._runDraft = null;
                this._runMode = this._runMode === m ? null : m;
              }}>+ ${this.t(`wall_kit_${m}` as I18nKey)}</button>`,
            )}`
        : nothing}
      ${html`<h4>${this.t("wall_kit_energy")}</h4>${(["meter", "inverter", "home_battery", "wallbox"] as const).map(add)}`}
    </aside>`;
  }
}
