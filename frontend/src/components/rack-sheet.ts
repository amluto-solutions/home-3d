// The "Edit rack" sheet (#113, #114): a front (or rear) elevation of one rack with its U positions numbered down both
// sides. Pick gear from the list and tap a U to put it there (its lowest U; half- and third-width gear in the column
// under the pointer); 0U gear (a vertical PDU) goes in the side lanes left and right of the rails. Tap gear to choose
// it, then move it a U up or down or a column across, to the other face, tap "Move" and another U, rename or delete
// it. A chosen shelf takes loose gear (a hub, a mini PC) on its top. Where gear would overlap (or stick out, or not
// fit) the tap is refused and the U and the gear in the way turn red; while gear is picked, the U under the pointer
// shows a green or red ghost. The head sums up U used / free and the estimated watts; the front / rear toggle shows
// either face (a 2-post rack has only the front). Gear that no longer fits (the rack frame changed) is listed with
// why and shown red. The rules are rack.ts's. The sheet keeps no plan: every change goes out as "rack-change" {slots},
// and "rack-close" asks to close it. Someone who can't edit sees the rack and nothing to change it with.
//
// Links to Home Assistant (#119): the chosen gear's panel picks the HA device behind it (its status entity and useful
// values come along, rack-suggest.ts), its status entity and further links by hand, and offers more from the same
// device. Linked gear shows its status LED in the grid. Someone who can't edit sees the links, nothing to change.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing } from "lit";
import {
  addSlot,
  checkSlot,
  moveSlot,
  rackMisfits,
  rackTotals,
  RACK_COLUMNS,
  removeSlot,
  slotFaces,
  slotUnits,
  type GearOf,
  type LooseOf,
  type RackFace,
  type RackRefusal,
  type RackSlot,
  type RackSpace,
} from "../rack.ts";
import { RACK_MAX_LINKS, RACK_STATUS_COLOURS, type RackStatus } from "../rack-links.ts";
import { modalFocus } from "../dialog-focus.ts";
import { controls, tokens } from "../styles.ts";
import type { PickerOption } from "./entity-picker.ts";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** A piece of gear the sheet offers. */
export interface RackGearChoice {
  type: string;
  name: string;
}

/** What the sheet needs from Home Assistant to link gear (#119); the editor builds it (rack-suggest.ts). */
export interface RackLinker {
  /** Every entity and every HA device a piece of gear can be, for the searchable pickers. */
  entities: PickerOption[];
  devices: PickerOption[];
  /** What gear links when it is said to be this HA device. */
  fromDevice(device: string): { entity: string | null; links: string[]; name: string | null };
  /** More entities for the gear, from the devices of what it links. */
  suggest(slot: RackSlot): string[];
  label(id: string): string;
  status(slot: RackSlot): RackStatus | null;
}

/** What is picked: new gear to add, or chosen gear to move to a tapped U. */
type Pick = { add: string } | { move: string };

/** The U the pointer is over with picked gear: where the gear would go and whether it may. */
export interface RackGhost {
  units: number[];
  ok: boolean;
  clash: string[];
  /** Its column (or lane) as the slot would have it. */
  col?: number;
}

/** A refused change: the U it wanted, what was in the way, why. */
export interface RackRefused {
  units: number[];
  clash: string[];
  why: RackRefusal;
}

/** Height of one U row in the elevation (px). */
const ROW = 24;
/** The U space is split in 6 grid columns (halves take 3, thirds 2); grid column 2 and 9 are the 0U lanes. */
const SUB = 6;
const FIRST = 3;
const LANE_COL = [2, FIRST + SUB];

let counter = 0;
/** A slot id unique within its rack (the rack's other ids are checked too). */
function newSlotId(taken: readonly RackSlot[]): string {
  let id = "";
  do id = `g${Date.now().toString(36)}${(counter++).toString(36)}`;
  while (taken.some((s) => s.id === id));
  return id;
}

/** Where across its target the pointer is (0 = left edge, 1 = right). */
function fraction(e: MouseEvent): number {
  const el = e.currentTarget as HTMLElement | null;
  const w = el?.clientWidth || 1;
  return Math.min(0.999, Math.max(0, e.offsetX / w));
}

export class RackSheet extends LitElement {
  static properties = {
    heading: {},
    space: { attribute: false },
    labels: { attribute: false },
    slots: { attribute: false },
    gear: { attribute: false },
    loose: { attribute: false },
    gearOf: { attribute: false },
    looseOf: { attribute: false },
    nameOf: { attribute: false },
    editable: { type: Boolean },
    linker: { attribute: false },
    t: { attribute: false },
    selected: { state: true },
    pick: { state: true },
    ghost: { state: true },
    refused: { state: true },
    face: { state: true },
  };

  declare heading: string;
  declare space: RackSpace;
  /** The number shown at each rail position, from the lowest up (rack-frame.ts rackLayout units' labels). */
  declare labels: number[];
  declare slots: RackSlot[];
  declare gear: RackGearChoice[];
  /** Loose gear a shelf can carry (#114). */
  declare loose: RackGearChoice[];
  declare gearOf: GearOf;
  declare looseOf: LooseOf;
  declare nameOf: (type: string) => string;
  declare editable: boolean;
  /** Linking to Home Assistant (#119); null: no links shown (no hass). */
  declare linker: RackLinker | null;
  declare t: Translate;
  declare selected: string | null;
  declare pick: Pick | null;
  declare ghost: RackGhost | null;
  declare refused: RackRefused | null;
  /** The face shown, and where new gear goes (#114). */
  declare face: RackFace;

  constructor() {
    super();
    this.heading = "";
    this.labels = [];
    this.slots = [];
    this.gear = [];
    this.loose = [];
    this.gearOf = () => null;
    this.looseOf = () => null;
    this.nameOf = (type) => type;
    this.editable = false;
    this.linker = null;
    this.t = (key) => key;
    this.selected = null;
    this.pick = null;
    this.ghost = null;
    this.refused = null;
    this.face = "front";
  }

  /** Whether the rack has a rear face for gear (a 2-post rack has not). */
  private get hasRear(): boolean {
    return this.space?.rear !== false;
  }

  /** The face shown: the rear only while the rack has one. */
  private get shownFace(): RackFace {
    return this.hasRear ? this.face : "front";
  }

  // ---------------------------------------------------------------------------------------------- actions

  private send(slots: RackSlot[]): void {
    this.slots = slots;
    this.dispatchEvent(new CustomEvent("rack-change", { detail: { slots }, bubbles: true, composed: true }));
  }

  private refuse(r: { units: number[]; clash: string[]; why?: RackRefusal }): void {
    this.refused = { units: r.units, clash: r.clash, why: r.why ?? "overlap" };
  }

  /** Show the front or the rear face; new gear goes on it. */
  setFace(face: RackFace): void {
    this.face = face;
    this.ghost = null;
    this.refused = null;
  }

  /** Pick new gear: the next tap on a U puts it there (the same again drops it). */
  pickGear(type: string): void {
    if (!this.editable) return;
    this.refused = null;
    this.ghost = null;
    this.pick = this.pick && "add" in this.pick && this.pick.add === type ? null : { add: type };
  }

  /** Choose gear in the rack (again: let it go). */
  tapSlot(id: string): void {
    this.refused = null;
    this.ghost = null;
    this.pick = null;
    this.selected = this.selected === id ? null : id;
  }

  /** The chosen gear goes where the next tapped U is. */
  startMove(): void {
    const s = this.slots.find((o) => o.id === this.selected);
    if (!this.editable || !s || s.on) return;
    this.refused = null;
    this.pick = { move: s.id };
  }

  /** The picked gear under the pointer at rail position `u`, `across` (0-1) its width (null: the pointer left). */
  hoverUnit(u: number | null, across = 0): void {
    if (u === null || !this.pick) {
      this.ghost = null;
      return;
    }
    const s = this.candidate(u, across, null);
    if (!s || this.isLane(s)) return;
    this.showGhost(s);
  }

  /** The picked 0U gear over the side lane `lane` (0 left, 1 right) at rail position `u`. */
  hoverLane(u: number, lane: number): void {
    const s = this.pick ? this.candidate(u, 0, lane) : null;
    if (!s || !this.isLane(s)) return;
    this.showGhost(s);
  }

  private showGhost(s: RackSlot): void {
    const c = checkSlot(this.space, this.slots, s, this.gearOf, this.looseOf);
    this.ghost = { units: c.units, ok: c.ok, clash: c.clash, ...(s.col ? { col: s.col } : {}) };
  }

  /** A tap on rail position `u`, `across` (0-1) its width: places the picked gear there, else lets the chosen gear go. */
  tapUnit(u: number, across = 0): void {
    const s = this.pick && this.candidate(u, across, null);
    if (!s || this.isLane(s)) {
      if (!this.pick || !this.editable) {
        this.selected = null;
        this.refused = null;
      }
      return;
    }
    this.place(s);
  }

  /** A tap on the side lane `lane` (0 left, 1 right) at rail position `u`: places picked 0U gear there. */
  tapLane(u: number, lane: number): void {
    const s = this.pick && this.candidate(u, 0, lane);
    if (s && this.isLane(s)) this.place(s);
  }

  private place(s: RackSlot): void {
    const pick = this.pick;
    if (!pick || !this.editable) return;
    const r = addSlot(this.space, this.slots, s, this.gearOf, this.looseOf);
    if (!r.ok) return this.refuse(r);
    this.refused = null;
    this.ghost = null;
    this.pick = null;
    this.selected = s.id;
    this.send(r.slots);
  }

  /** Move the chosen gear `by` U up (negative: down). */
  nudge(by: number): void {
    const s = this.slots.find((o) => o.id === this.selected);
    if (!this.editable || !s || s.on) return;
    const r = moveSlot(this.space, this.slots, s.id, s.u + by, this.gearOf, this.looseOf);
    if (!r.ok) return this.refuse(r);
    this.refused = null;
    this.send(r.slots);
  }

  /** Move the chosen half / third-width gear (or 0U gear: to the other lane) `by` columns to the right. */
  nudgeCol(by: number): void {
    const s = this.slots.find((o) => o.id === this.selected);
    if (!s || s.on) return;
    this.replace({ ...s, col: (s.col ?? 0) + by });
  }

  /** Mount the chosen half-depth gear on the other face. */
  flipFace(): void {
    const s = this.slots.find((o) => o.id === this.selected);
    if (!s || s.on) return;
    const { face: _, ...rest } = s;
    this.replace(s.face === "rear" ? rest : { ...rest, face: "rear" });
  }

  /** Put loose gear on the chosen shelf. */
  putOnShelf(type: string): void {
    const shelf = this.slots.find((o) => o.id === this.selected);
    if (!this.editable || !shelf || shelf.on || !this.gearOf(shelf.type)?.gear.shelf) return;
    const s: RackSlot = { id: newSlotId(this.slots), type, u: shelf.u, on: shelf.id };
    const r = addSlot(this.space, this.slots, s, this.gearOf, this.looseOf);
    if (!r.ok) return this.refuse(r);
    this.refused = null;
    this.send(r.slots);
  }

  /** Put a slot anew (its id kept) where it says now, or refuse. */
  private replace(s: RackSlot): void {
    if (!this.editable) return;
    const r = addSlot(this.space, this.slots, s, this.gearOf, this.looseOf);
    if (!r.ok) return this.refuse(r);
    this.refused = null;
    this.send(r.slots);
  }

  rename(name: string): void {
    if (!this.editable || !this.selected) return;
    const clean = name.trim().slice(0, 60);
    this.send(this.slots.map((s) => (s.id === this.selected ? { ...s, name: clean || null } : s)));
  }

  /** Change the chosen gear's links (#119): one change, one undo step. */
  private relink(patch: (s: RackSlot) => Partial<RackSlot>): void {
    if (!this.editable || !this.selected) return;
    this.send(this.slots.map((s) => (s.id === this.selected ? { ...s, ...patch(s) } : s)));
  }

  /** The chosen gear is this HA device: its status entity and useful values; its name when it has none of its own. */
  linkDevice(device: string): void {
    if (!this.editable || !this.linker || !device) return;
    const got = this.linker.fromDevice(device);
    this.relink((s) => ({ entity: got.entity, links: got.links.slice(0, RACK_MAX_LINKS), ...(!s.name && got.name ? { name: got.name.slice(0, 60) } : {}) }));
  }

  /** The chosen gear's status entity (null: none); it leaves the further links if it was one. */
  setStatusEntity(id: string | null): void {
    this.relink((s) => ({ entity: id || null, links: (s.links ?? []).filter((l) => l !== id) }));
  }

  addLink(id: string): void {
    const s = this.slots.find((o) => o.id === this.selected);
    const links = s?.links ?? [];
    if (!s || !id || id === s.entity || links.includes(id) || links.length >= RACK_MAX_LINKS) return;
    this.relink(() => ({ links: [...links, id] }));
  }

  removeLink(id: string): void {
    this.relink((s) => ({ links: (s.links ?? []).filter((l) => l !== id) }));
  }

  deleteSelected(): void {
    if (!this.editable || !this.selected) return;
    const id = this.selected;
    this.selected = null;
    this.pick = null;
    this.refused = null;
    this.send(removeSlot(this.slots, id));
  }

  close(): void {
    this.dispatchEvent(new CustomEvent("rack-close", { bubbles: true, composed: true }));
  }

  private isLane(s: RackSlot): boolean {
    const of = this.gearOf(s.type);
    return !!of && of.gear.u < 1;
  }

  /**
   * The slot the picked gear would be at rail position `u`: in the column `across` (0-1) its width points at, or in
   * side lane `lane`, on the face shown (full-depth gear and the front face write no face).
   */
  private candidate(u: number, across: number, lane: number | null): RackSlot | null {
    const pick = this.pick;
    if (!pick) return null;
    const base: RackSlot | undefined = "add" in pick ? { id: newSlotId(this.slots), type: pick.add, u } : this.slots.find((o) => o.id === pick.move);
    if (!base) return null;
    const of = this.gearOf(base.type);
    const { col: _c, face: _f, ...s } = { ...base, u };
    const out: RackSlot = s;
    const col = lane ?? (of && of.gear.u >= 1 ? Math.floor(across * RACK_COLUMNS[of.gear.width]) : 0);
    if (col) out.col = col;
    // moved gear keeps its face; new gear goes on the face shown
    const face = "add" in pick ? this.shownFace : (base.face ?? "front");
    if (face === "rear" && of?.gear.depth !== "full") out.face = "rear";
    return out;
  }

  private onKey = (e: KeyboardEvent): void => {
    if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
    if (e.key === "Escape") {
      e.stopPropagation();
      if (this.pick || this.refused) {
        this.pick = null;
        this.ghost = null;
        this.refused = null;
      } else this.close();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      this.nudge(e.key === "ArrowUp" ? 1 : -1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      this.nudgeCol(e.key === "ArrowRight" ? 1 : -1);
    } else if (e.key === "Delete") {
      e.stopPropagation();
      this.deleteSelected();
    }
  };

  // ---------------------------------------------------------------------------------------------- render

  /** The grid row (1 = top) where gear from rail position `u` up `n` U starts. */
  private row(u: number, n: number): string {
    return `${this.space.u - (u + n - 1) + 1} / span ${n}`;
  }

  /** The grid columns a slot of `type` takes in column (or lane) `col`. */
  private column(type: string, col: number): string {
    const of = this.gearOf(type);
    if (of && of.gear.u < 1) return `${LANE_COL[col] ?? LANE_COL[0]} / span 1`;
    const n = of ? RACK_COLUMNS[of.gear.width] : 1;
    const span = SUB / n;
    return `${FIRST + Math.min(col, n - 1) * span} / span ${span}`;
  }

  /** Whether a slot shows on the face shown. */
  private onFace(s: RackSlot): boolean {
    const of = this.gearOf(s.type);
    return of ? slotFaces(s, of.gear).includes(this.shownFace) : this.shownFace === "front";
  }

  render() {
    const t = this.t;
    const u = this.space?.u ?? 0;
    const tops = Array.from({ length: u }, (_, i) => u - i);
    const misfits = this.space ? rackMisfits(this.space, this.slots, this.gearOf, this.looseOf) : [];
    const bad = new Set(this.refused?.units ?? []);
    const clash = new Set([...(this.refused?.clash ?? []), ...(this.ghost && !this.ghost.ok ? this.ghost.clash : []), ...misfits.map((m) => m.id)]);
    const chosen = this.slots.find((s) => s.id === this.selected) ?? null;
    const label = (p: number) => this.labels[p - 1] ?? p;
    const shown = this.slots.filter((s) => !s.on && this.onFace(s));
    const ghostType = this.pick ? ("add" in this.pick ? this.pick.add : this.slots.find((s) => this.pick && "move" in this.pick && s.id === this.pick.move)?.type) : undefined;
    return html`<div class="fp3d-rack-veil" @click=${(e: Event) => e.target === e.currentTarget && this.close()} @keydown=${this.onKey}>
      <div class="fp3d-rack-sheet" role="dialog" aria-modal="true" aria-label=${t("rack_edit")} tabindex="-1" ${modalFocus()}>
        <div class="fp3d-rack-head">
          <h3>${this.heading || t("rack_edit")}</h3>
          ${this.renderTotals()}
          ${this.hasRear
            ? html`<div class="fp3d-rack-faces" role="group">
                ${(["front", "rear"] as const).map((f) => html`<button class="fp3d-btn" aria-pressed=${this.shownFace === f} @click=${() => this.setFace(f)}>${t(`rack_face_${f}`)}</button>`)}
              </div>`
            : nothing}
          <button class="fp3d-btn" aria-label=${t("close")} @click=${() => this.close()}>✕</button>
        </div>
        <div class="fp3d-rack-body">
          <div class="fp3d-rack-elev" style="grid-template-rows: repeat(${u}, ${ROW}px)" @pointerleave=${() => this.hoverUnit(null)}>
            ${tops.map(
              (p) => html`<span class="fp3d-rack-num fp3d-rack-left" style="grid-row: ${this.row(p, 1)}">${label(p)}</span>
                ${LANE_COL.map(
                  (c, lane) =>
                    html`<button
                      class="fp3d-rack-lane"
                      style="grid-row: ${this.row(p, 1)}; grid-column: ${c}"
                      aria-label=${`${lane ? "▶" : "◀"} ${t("rack_unit", { n: label(p) })}`}
                      @pointerenter=${() => this.hoverLane(p, lane)}
                      @click=${() => this.tapLane(p, lane)}
                    ></button>`,
                )}
                <button
                  class="fp3d-rack-cell ${bad.has(p) ? "fp3d-rack-bad" : ""}"
                  style="grid-row: ${this.row(p, 1)}"
                  data-u=${p}
                  aria-label=${t("rack_unit", { n: label(p) })}
                  @pointermove=${(e: PointerEvent) => this.hoverUnit(p, fraction(e))}
                  @click=${(e: MouseEvent) => this.tapUnit(p, fraction(e))}
                ></button>
                <span class="fp3d-rack-num fp3d-rack-right" style="grid-row: ${this.row(p, 1)}">${label(p)}</span>`,
            )}
            ${shown.map((s) => this.renderSlot(s, clash))}
            ${this.ghost?.units.length && ghostType
              ? html`<div
                  class="fp3d-rack-ghost ${this.ghost.ok ? "fp3d-rack-ok" : "fp3d-rack-bad"}"
                  style="grid-row: ${this.row(Math.max(1, this.ghost.units[0]), Math.min(this.ghost.units.length, u - Math.max(1, this.ghost.units[0]) + 1))}; grid-column: ${this.column(ghostType, this.ghost.col ?? 0)}"
                ></div>`
              : nothing}
          </div>
          <div class="fp3d-rack-side">
            ${this.refused ? html`<p class="fp3d-rack-why" role="alert">${t(`rack_${this.refused.why}`)}</p>` : nothing}
            ${misfits.length
              ? html`<section class="fp3d-rack-misfits">
                  <p class="fp3d-rack-why" role="alert">${t("rack_misfits", { n: misfits.length })}</p>
                  <ul>
                    ${misfits.map((m) => {
                      const s = this.slots.find((o) => o.id === m.id)!;
                      return html`<li><button class="fp3d-link" @click=${() => this.tapSlot(s.id)}>${s.name || this.nameOf(s.type)}: ${t(`rack_${m.why}`)}</button></li>`;
                    })}
                  </ul>
                </section>`
              : nothing}
            ${chosen ? this.renderChosen(chosen) : nothing}
            ${this.editable ? this.renderGear() : html`<p class="fp3d-sub">${t("rack_read_only")}</p>`}
          </div>
        </div>
      </div>
    </div>`;
  }

  /** U used / free and the estimated watts. */
  private renderTotals() {
    if (!this.space) return nothing;
    const t = this.t;
    const sum = rackTotals(this.space, this.slots, this.gearOf, this.looseOf);
    return html`<p class="fp3d-rack-totals">
      <span>${t("rack_totals", { used: sum.used, free: sum.free })}</span>
      <span>${sum.unknown ? t("rack_watts_about", { w: sum.watts }) : `${sum.watts} W`}</span>
    </p>`;
  }

  /** One slot in the elevation (a shelf with its loose gear on it). */
  private renderSlot(s: RackSlot, clash: Set<string>) {
    const u = this.space.u;
    const n = slotUnits(s, this.gearOf).length;
    if (s.u < 1 || s.u + n - 1 > u) return nothing;
    const of = this.gearOf(s.type);
    const cls = (id: string) =>
      ["fp3d-rack-gear", id === this.selected ? "fp3d-rack-chosen" : "", clash.has(id) ? "fp3d-rack-bad" : "", this.pick && "move" in this.pick && this.pick.move === id ? "fp3d-rack-moving" : ""].join(" ");
    const place = `grid-row: ${this.row(s.u, n)}; grid-column: ${this.column(s.type, s.col ?? 0)}`;
    const name = s.name || this.nameOf(s.type);
    if (of && of.gear.u < 1)
      return html`<button class="${cls(s.id)} fp3d-rack-pdu" style=${place} data-slot=${s.id} title=${name} aria-label=${name} aria-pressed=${s.id === this.selected} @click=${() => this.tapSlot(s.id)}></button>`;
    const st = this.linker?.status(s) ?? null;
    const led = st ? html`<i class="fp3d-rack-led fp3d-rack-led-${st}" style="background:${RACK_STATUS_COLOURS[st]}"></i>` : nothing;
    const label = html`<span>${name}</span>${n > 1 ? html`<small>${n}U</small>` : nothing}${led}`;
    if (!of?.gear.shelf)
      return html`<button class=${cls(s.id)} style=${place} data-slot=${s.id} aria-pressed=${s.id === this.selected} @click=${() => this.tapSlot(s.id)}>${label}</button>`;
    const on = this.slots.filter((o) => o.on === s.id);
    return html`<div class="fp3d-rack-shelf" style=${place}>
      <button class="${cls(s.id)} fp3d-rack-shelf-tray" data-slot=${s.id} aria-pressed=${s.id === this.selected} @click=${() => this.tapSlot(s.id)}>${label}</button>
      ${on.map((o) => html`<button class="${cls(o.id)} fp3d-rack-loose" data-slot=${o.id} aria-pressed=${o.id === this.selected} @click=${() => this.tapSlot(o.id)}>${o.name || this.nameOf(o.type)}</button>`)}
    </div>`;
  }

  private renderChosen(s: RackSlot) {
    const t = this.t;
    const units = slotUnits(s, this.gearOf);
    const label = (p: number) => this.labels[p - 1] ?? p;
    const where = units.length > 1 ? `${label(units[0])}-${label(units.at(-1)!)}` : `${label(units[0])}`;
    const of = s.on ? null : this.gearOf(s.type);
    const cols = of ? (of.gear.u < 1 ? 2 : RACK_COLUMNS[of.gear.width]) : 1;
    const shelf = s.on ? this.slots.find((o) => o.id === s.on) : null;
    return html`<section class="fp3d-rack-chosen-box">
      <h4>${s.name || this.nameOf(s.type)}</h4>
      <p class="fp3d-sub">${shelf ? `⤒ ${shelf.name || this.nameOf(shelf.type)}` : t("rack_at", { u: where })}${of && of.gear.depth === "full" ? html` · ${t("rack_full_depth")}` : s.face === "rear" && this.hasRear ? html` · ${t("rack_face_rear")}` : nothing}</p>
      ${this.editable
        ? html`<label class="fp3d-field"
              >${t("furn_name")}
              <input type="text" maxlength="60" .value=${s.name ?? ""} placeholder=${this.nameOf(s.type)} @change=${(e: Event) => this.rename((e.target as HTMLInputElement).value)}
            /></label>
            <div class="fp3d-rack-actions">
              ${s.on
                ? nothing
                : html`<button class="fp3d-btn" title=${t("rack_up")} @click=${() => this.nudge(1)}>▲</button>
                    <button class="fp3d-btn" title=${t("rack_down")} @click=${() => this.nudge(-1)}>▼</button>
                    ${cols > 1
                      ? html`<button class="fp3d-btn" ?disabled=${(s.col ?? 0) <= 0} @click=${() => this.nudgeCol(-1)}>◀</button>
                          <button class="fp3d-btn" ?disabled=${(s.col ?? 0) >= cols - 1} @click=${() => this.nudgeCol(1)}>▶</button>`
                      : nothing}
                    ${this.hasRear && of && of.gear.depth !== "full" ? html`<button class="fp3d-btn" @click=${() => this.flipFace()}>⇄ ${t(s.face === "rear" ? "rack_face_front" : "rack_face_rear")}</button>` : nothing}
                    <button class="fp3d-btn" aria-pressed=${!!this.pick && "move" in this.pick} @click=${() => this.startMove()}>${t("rack_move")}</button>`}
              <button class="fp3d-btn fp3d-danger" @click=${() => this.deleteSelected()}>${t("delete")}</button>
            </div>
            ${this.pick && "move" in this.pick ? html`<p class="fp3d-sub">${t("rack_move_hint")}</p>` : nothing}
            ${of?.gear.shelf ? this.renderShelf() : nothing}`
        : nothing}
      ${this.renderLinks(s)}
    </section>`;
  }

  /** The chosen gear's links to Home Assistant (#119): pickers for editors, the list for everyone. */
  private renderLinks(s: RackSlot) {
    const k = this.linker;
    if (!k) return nothing;
    const t = this.t;
    const links = s.links ?? [];
    const picker = (options: PickerOption[], value: string | null, fixed: PickerOption[], onPick: (v: string) => void) =>
      html`<fp3d-entity-picker
        .options=${options}
        .fixed=${fixed}
        .value=${value}
        .placeholder=${t("entity_search")}
        @change=${(e: CustomEvent<{ value: string }>) => {
          e.stopPropagation();
          onPick(e.detail.value);
        }}
      ></fp3d-entity-picker>`;
    const none = { id: "none", label: t("entity_none") };
    if (!this.editable)
      return s.entity || links.length
        ? html`<h4>${t("rack_links")}</h4>
            <ul class="fp3d-rack-links">
              ${[s.entity, ...links].filter((id): id is string => !!id).map((id) => html`<li>${k.label(id)}</li>`)}
            </ul>`
        : nothing;
    const suggested = k.suggest(s).filter((id) => id !== s.entity && !links.includes(id));
    return html`<h4>${t("rack_links")}</h4>
      <label class="fp3d-field">${t("rack_ha_device")} ${picker(k.devices, null, [], (v) => this.linkDevice(v))}</label>
      <label class="fp3d-field">${t("rack_status_from")} ${picker(k.entities, s.entity ?? "none", [none], (v) => this.setStatusEntity(v === "none" ? null : v))}</label>
      ${links.length
        ? html`<ul class="fp3d-rack-links">
            ${links.map((id) => html`<li><span>${k.label(id)}</span><button class="fp3d-btn" aria-label=${t("delete")} @click=${() => this.removeLink(id)}>✕</button></li>`)}
          </ul>`
        : nothing}
      ${links.length < RACK_MAX_LINKS ? html`<label class="fp3d-field">${t("rack_link_add")} ${picker(k.entities, null, [], (v) => this.addLink(v))}</label>` : nothing}
      ${suggested.length && links.length < RACK_MAX_LINKS
        ? html`<p class="fp3d-sub">${t("rack_suggested")}</p>
            <div class="fp3d-rack-list">${suggested.map((id) => html`<button class="fp3d-btn fp3d-rack-choice" @click=${() => this.addLink(id)}>+ ${k.label(id)}</button>`)}</div>`
        : nothing}`;
  }

  /** Loose gear the chosen shelf can take. */
  private renderShelf() {
    const t = this.t;
    return html`<h4>${t("rack_on_shelf")}</h4>
      ${this.loose.length
        ? html`<div class="fp3d-rack-list">${this.loose.map((g) => html`<button class="fp3d-btn fp3d-rack-choice" @click=${() => this.putOnShelf(g.type)}>${g.name}</button>`)}</div>`
        : html`<p class="fp3d-sub">${t("rack_no_loose")}</p>`}`;
  }

  private renderGear() {
    const t = this.t;
    const picked = this.pick && "add" in this.pick ? this.pick.add : null;
    const lane = picked ? (this.gearOf(picked)?.gear.u ?? 1) < 1 : false;
    return html`<section>
      <h4>${t("rack_add")}</h4>
      ${this.gear.length
        ? html`<div class="fp3d-rack-list">
            ${this.gear.map((g) => {
              const of = this.gearOf(g.type)?.gear;
              const n = of?.u ?? 1;
              const size = `${n}U${of && of.width !== "full" ? ` ${t(`rack_width_${of.width}`)}` : ""}`;
              return html`<button class="fp3d-btn fp3d-rack-choice" aria-pressed=${picked === g.type} @click=${() => this.pickGear(g.type)}>${g.name}<small>${size}</small></button>`;
            })}
          </div>`
        : html`<p class="fp3d-sub">${t("rack_no_gear")}</p>`}
      ${picked ? html`<p class="fp3d-sub">${t(lane ? "rack_lane_hint" : "rack_add_hint")}</p>` : nothing}
    </section>`;
  }

  static styles = [
    tokens,
    controls,
    css`
      .fp3d-rack-veil {
        position: fixed;
        inset: 0;
        z-index: 30;
        display: flex;
        align-items: center;
        /* at the left, so the editor's 3D pane on the right shows the rack as it changes */
        justify-content: flex-start;
        background: rgba(0, 0, 0, 0.25);
        padding: 16px;
      }
      .fp3d-rack-sheet {
        background: var(--fp3d-chrome-solid);
        color: var(--fp3d-text);
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
        box-shadow: var(--fp3d-shadow);
        width: min(720px, 100%);
        max-height: calc(100% - 16px);
        display: flex;
        flex-direction: column;
        outline: none;
      }
      .fp3d-rack-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 14px;
        border-bottom: 1px solid var(--fp3d-line);
      }
      .fp3d-rack-head h3 {
        margin: 0;
        font-size: 16px;
      }
      .fp3d-rack-body {
        display: flex;
        gap: 16px;
        padding: 14px;
        overflow: auto;
      }
      .fp3d-rack-elev {
        display: grid;
        /* U numbers, the left 0U lane, the U space in 6 (halves take 3, thirds 2), the right lane, U numbers */
        grid-template-columns: 28px 14px repeat(6, minmax(30px, 47px)) 14px 28px;
        flex: none;
        align-self: flex-start;
        border-radius: 6px;
        background: var(--fp3d-bg);
        padding: 6px 0;
      }
      .fp3d-rack-num {
        font-size: 11px;
        color: var(--fp3d-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        font-variant-numeric: tabular-nums;
        border-bottom: 1px dotted var(--fp3d-line);
      }
      .fp3d-rack-left {
        grid-column: 1;
      }
      .fp3d-rack-right {
        grid-column: 10;
      }
      .fp3d-rack-cell,
      .fp3d-rack-gear,
      .fp3d-rack-ghost {
        grid-column: 3 / span 6;
      }
      .fp3d-rack-lane {
        border: 0;
        border-bottom: 1px dotted var(--fp3d-line);
        background: rgba(120, 170, 255, 0.04);
        padding: 0;
        cursor: pointer;
      }
      .fp3d-rack-lane:hover {
        background: rgba(120, 170, 255, 0.14);
      }
      .fp3d-rack-gear.fp3d-rack-pdu {
        margin: 1px 1px;
        padding: 0;
        background: repeating-linear-gradient(180deg, var(--fp3d-bg2) 0 6px, var(--fp3d-line) 6px 8px);
      }
      .fp3d-rack-shelf {
        z-index: 1;
        display: flex;
        align-items: stretch;
        gap: 2px;
        margin: 1px 2px;
        border-bottom: 3px solid var(--fp3d-muted);
        min-width: 0;
      }
      .fp3d-rack-shelf .fp3d-rack-gear {
        margin: 0;
      }
      .fp3d-rack-shelf-tray {
        flex: 0 0 auto;
        max-width: 45%;
        background: transparent;
        border-style: dashed;
      }
      .fp3d-rack-loose {
        flex: 1 1 0;
        min-width: 0;
        align-self: flex-end;
        height: 75%;
      }
      .fp3d-rack-totals {
        margin: 0 0 0 auto;
        display: flex;
        flex-wrap: wrap;
        gap: 4px 12px;
        font-size: 12px;
        color: var(--fp3d-muted);
        font-variant-numeric: tabular-nums;
      }
      .fp3d-rack-faces {
        display: flex;
        gap: 4px;
      }
      .fp3d-rack-faces [aria-pressed="true"] {
        border-color: var(--fp3d-accent);
        color: var(--fp3d-accent);
      }
      .fp3d-rack-misfits ul {
        margin: 6px 0 0;
        padding-left: 18px;
        font-size: 12px;
      }
      .fp3d-link {
        background: none;
        border: 0;
        padding: 0;
        color: inherit;
        font: inherit;
        text-decoration: underline;
        cursor: pointer;
        text-align: left;
      }
      .fp3d-rack-cell {
        border: 0;
        border-bottom: 1px dotted var(--fp3d-line);
        background: transparent;
        padding: 0;
        cursor: pointer;
        font: inherit;
      }
      .fp3d-rack-cell:hover {
        background: rgba(120, 170, 255, 0.08);
      }
      .fp3d-rack-gear {
        z-index: 1;
        margin: 1px 2px;
        border: 1px solid var(--fp3d-line);
        border-radius: 3px;
        background: var(--fp3d-bg2);
        color: var(--fp3d-text);
        font: inherit;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 0 8px;
        cursor: pointer;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .fp3d-rack-gear small {
        color: var(--fp3d-muted);
      }
      .fp3d-rack-led {
        display: inline-block;
        flex: none;
        width: 8px;
        height: 8px;
        margin-left: auto;
        border-radius: 2px;
      }
      .fp3d-rack-links {
        list-style: none;
        margin: 0 0 6px;
        padding: 0;
        display: grid;
        gap: 4px;
      }
      .fp3d-rack-links li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      .fp3d-rack-gear.fp3d-rack-chosen {
        border-color: var(--fp3d-accent);
        box-shadow: inset 0 0 0 1px var(--fp3d-accent);
      }
      .fp3d-rack-gear.fp3d-rack-moving {
        opacity: 0.55;
      }
      .fp3d-rack-ghost {
        z-index: 2;
        pointer-events: none;
        margin: 1px 2px;
        border-radius: 3px;
        border: 2px dashed var(--fp3d-accent);
        background: rgba(55, 224, 255, 0.16);
      }
      .fp3d-rack-ghost.fp3d-rack-bad,
      .fp3d-rack-cell.fp3d-rack-bad,
      .fp3d-rack-gear.fp3d-rack-bad {
        border: 2px solid var(--fp3d-danger);
        background: rgba(255, 107, 139, 0.22);
      }
      .fp3d-rack-side {
        position: sticky;
        top: 0;
        align-self: flex-start;
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .fp3d-rack-side h4 {
        margin: 0 0 6px;
        font-size: 13px;
      }
      .fp3d-rack-why {
        margin: 0;
        padding: 8px 10px;
        border-radius: 6px;
        color: var(--fp3d-danger);
        border: 1px solid var(--fp3d-danger);
      }
      .fp3d-rack-list,
      .fp3d-rack-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .fp3d-rack-choice {
        display: flex;
        gap: 6px;
        align-items: baseline;
      }
      .fp3d-rack-choice small {
        color: var(--fp3d-muted);
      }
      .fp3d-rack-choice[aria-pressed="true"],
      .fp3d-rack-actions [aria-pressed="true"] {
        border-color: var(--fp3d-accent);
        color: var(--fp3d-accent);
      }
      .fp3d-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        color: var(--fp3d-muted);
        margin-bottom: 8px;
      }
      @media (max-width: 600px) {
        .fp3d-rack-veil {
          padding: 0;
          align-items: stretch;
        }
        .fp3d-rack-sheet {
          border-radius: 0;
          max-height: none;
        }
        .fp3d-rack-body {
          flex-direction: column;
        }
        .fp3d-rack-side {
          position: static;
          align-self: stretch;
        }
        .fp3d-rack-elev {
          align-self: stretch;
          grid-template-columns: 28px 14px repeat(6, 1fr) 14px 28px;
        }
      }
    `,
  ];
}

defineElement("fp3d-rack-sheet", RackSheet);
