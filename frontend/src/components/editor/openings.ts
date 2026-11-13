// Doors and windows: placing them on walls (snap, spacing, hover notes), their kinds, the plan drawing, the
// room's openings list and the opening form.

import { html, nothing, svg } from "lit";
import { entityName, openingEntities, slatTilt, windowPosition } from "../../devices.ts";
import { snapOnWall, snapTolerance, wallGuides, type Span } from "../../geometry/snap-guides.ts";
import { isPulseDrive } from "../../devices.ts";
import { sidelightLayout } from "../../model.ts";
import { edgeReach, generateWalls, locateOpening, openingHost, pointOnRoomEdge, type Wall } from "../../geometry/walls.ts";
import { edgeStartCorner, openingTap } from "../../geometry/openings.ts";
import type { I18nKey } from "../../i18n.ts";
import { signedArea, OPENING_PRESETS, openingPreset, type OpeningPreset, pointInPolygon, uid, type Floor, type Opening, type OpeningType, type Room, type Vec2, SILL_BOARDS, openingStyle, isFrontDoor, type SillBoard } from "../../model.ts";
import { windowGetsWell } from "../../geometry/wells.ts";
import { wallPeers, SNAP_PX, round, patchItem, numberish } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";
import { stateChip } from "./panel-head.ts";
import { OPENING_CARD_GROUPS, OPENING_CARDS, openingCardOf, openingCardPatch } from "../../opening-cards.ts";
import { openingPic } from "./opening-pics.ts";

/** The opening whose Type cards are open, per editor (#417): a passing state, gone with another selection. */
const typeOpen = new WeakMap<object, string>();

/** How far a door stands open by default in 3D, in degrees (viewer/openings.ts: 1.5 rad, half of it without a sensor). */
const DOOR_OPEN_SENSED = Math.round((1.5 * 180) / Math.PI);
const DOOR_OPEN_FREE = Math.round((0.75 * 180) / Math.PI);

/** OpeningsPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class OpeningsPart {
  /** Centre offset on a room edge closest to `world`, keeping the opening inside the edge. */
  offsetOnEdge(this: Fp3dEditor, room: Room, edge: number, world: Vec2, width: number, free: boolean): number {
    const a = room.points[edge];
    const b = room.points[(edge + 1) % room.points.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const t = ((world[0] - a[0]) * (b[0] - a[0]) + (world[1] - a[1]) * (b[1] - a[1])) / len;
    const g = free ? 0.01 : this._doc.settings.grid;
    return this.clampOffset(room, edge, width, Math.round(t / g) * g);
  }

  /**
   * An opening's centre kept on its room edge with the whole opening inside the edge – or reaching on across
   * a transition without a wall, where the outer wall carries on in line (#624).
   */
  clampOffset(this: Fp3dEditor, room: Room, edge: number, width: number, offset: number): number {
    const a = room.points[edge];
    const b = room.points[(edge + 1) % room.points.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const floor = this.floor;
    const s = this._doc.settings;
    const [before, after] = floor ? edgeReach(generateWalls(floor.rooms, { exterior: s.wall_exterior, interior: s.wall_interior }, floor.walls ?? []).walls, room, edge) : [0, 0];
    const half = Math.min(width, len + before + after) / 2;
    return round(Math.min(len, len + after - half, Math.max(0, half - before, offset)));
  }

  /** A press on an opening: select it, and (for editors) start dragging it along its wall. */
  pressOpening(this: Fp3dEditor, id: string, local: [number, number]): void {
    this.selectItem("opening", id);
    this.drag = this.isEditor ? { kind: "opening", id, startScreen: local, base: this._doc, moved: false } : { kind: "pan", last: local };
  }

  /**
   * What a tap at a screen point does in Doors & windows mode (#62): add a new opening of `preset` on the nearest
   * wall, select the existing one it lands on, or nothing because the new one would overlap another (`blocked`).
   * Null: no wall near enough. Nothing is changed here.
   */
  planOpening(this: Fp3dEditor,
    preset: OpeningPreset,
    screen: [number, number],
    free = false,
  ): { add: Opening } | { select: Opening } | { blocked: Opening } | null {
    const floor = this.floor;
    if (!floor || !this.isEditor) return null;
    let best: { room: Room; edge: number; d: number; wall?: string; roomId?: string } | null = null;
    for (const w of floor.walls ?? []) {
      const host = openingHost({ room_id: "", edge: 0, wall: w.id }, floor.rooms, floor.walls ?? []);
      if (!host) continue;
      const [ax, ay] = this.toScreen(w.a);
      const [bx, by] = this.toScreen(w.b);
      const l2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = Math.min(1, Math.max(0, ((screen[0] - ax) * (bx - ax) + (screen[1] - ay) * (by - ay)) / l2));
      const d = Math.hypot(screen[0] - ax - (bx - ax) * t, screen[1] - ay - (by - ay) * t);
      // a free wall wins over a room edge at the same distance
      const mid: Vec2 = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
      const inside = floor.rooms.find((r) => r.points.length >= 3 && pointInPolygon(mid, r.points));
      if (d < SNAP_PX * 2.2 && (!best || d - 1 < best.d)) best = { room: host.room, edge: 0, d: d - 1, wall: w.id, roomId: inside?.id ?? w.id };
    }
    for (const room of floor.rooms) {
      for (let i = 0; i < room.points.length; i++) {
        const [ax, ay] = this.toScreen(room.points[i]);
        const [bx, by] = this.toScreen(room.points[(i + 1) % room.points.length]);
        const l2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
        const t = Math.min(1, Math.max(0, ((screen[0] - ax) * (bx - ax) + (screen[1] - ay) * (by - ay)) / l2));
        const d = Math.hypot(screen[0] - ax - (bx - ax) * t, screen[1] - ay - (by - ay) * t);
        // the selected room wins on shared edges
        const score = d - (room.id === this._roomId ? 0.5 : 0);
        if (d < SNAP_PX * 2.2 && (!best || score < best.d)) best = { room, edge: i, d: score };
      }
    }
    if (!best) return null;
    const { room, edge, wall } = best;
    const a = room.points[edge];
    const b = room.points[(edge + 1) % room.points.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const defaults = OPENING_PRESETS[preset];
    const type: OpeningType = defaults.type;
    const width = round(Math.min(defaults.width, Math.max(0.3, len - 0.1)));
    const tap = this.toWorld(...screen);
    // the same snap guides as when dragging one along its wall (#143)
    const offset = this.snapOnEdge(room, edge, tap, width, wallPeers(floor, { id: "", room_id: best.roomId ?? room.id, edge, wall }), free);
    // never on top of another door or window (#62): a tap inside one selects it, a tap beside it says why not
    const span: [Vec2, Vec2] = [pointOnRoomEdge(room, edge, offset - width / 2), pointOnRoomEdge(room, edge, offset + width / 2)];
    const clash = openingTap(tap, span, floor.openings, floor.rooms, floor.walls ?? []);
    if (clash) return clash;
    const opening: Opening = {
      id: uid("opening"),
      room_id: best.roomId ?? room.id,
      edge,
      ...(wall ? { wall } : {}),
      offset,
      width,
      type,
      sill: defaults.sill,
      height: defaults.height,
      // a front door or glass wall keeps its look; a plain door stays automatic (front style in an outer wall)
      ...("style" in defaults && preset !== "door" ? { style: defaults.style } : {}),
      hinge: "left",
      leaves: defaults.leaves,
      swing: "in",
      cover: null,
      contact: null,
      contact2: null,
      tilt: null,
    };
    return { add: opening };
  }

  /** Doors & windows mode with a mouse: keep the hint bar saying what a tap at the pointer would do (#62). */
  hoverOpening(this: Fp3dEditor, target: Element, local: [number, number], free = false): void {
    const id = target?.closest?.("[data-opening]")?.getAttribute("data-opening");
    const on = id ? this.floor?.openings.find((o) => o.id === id) : undefined;
    const plan = on ? { select: on } : this.planOpening(this._openingPreset, local, free);
    if (!plan || !("add" in plan)) this.showGuides([]);
    const text = plan ? this.openingHint(plan) : null;
    if (text !== this._openingHover) this._openingHover = text;
  }

  /** A tap in Doors & windows mode: add a door or window on the nearest wall, or select the one tapped (#62). */
  placeOpening(this: Fp3dEditor, preset: OpeningPreset, screen: [number, number], free = false): boolean {
    const plan = this.planOpening(preset, screen, free);
    this.showGuides([]);
    if (!plan) return false;
    if ("select" in plan) this.pressOpening(plan.select.id, screen);
    else if ("blocked" in plan) this._openingNote = this.openingHint(plan);
    else {
      const opening = plan.add;
      this.change((_, f) => f.openings.push(opening));
      // the tool stays: six doors and windows in a row without going back to the menu (Esc or "Select" ends it)
      this.selectItem("opening", opening.id);
    }
    return true;
  }

  /** The hint bar's sentence for what a tap does in Doors & windows mode (#62). */
  openingHint(this: Fp3dEditor, plan: { add: Opening } | { select: Opening } | { blocked: Opening }): string {
    const kind = (o: Opening) => this.t(`preset_${openingPreset(o)}` as I18nKey);
    if ("add" in plan) return this.t("hint_opening_add", { kind: kind(plan.add) });
    if ("select" in plan) return this.t("hint_opening_select", { kind: kind(plan.select) });
    return this.t("opening_overlap", { kind: kind(plan.blocked) });
  }

  /** Turns an opening into another kind (door, double door, window, terrace door, garage door). */
  setOpeningPreset(this: Fp3dEditor, o: Opening, preset: OpeningPreset): void {
    // converting THIS opening never touches the kind the next tap adds (#159): that is pickOpeningKind's job
    const d = OPENING_PRESETS[preset];
    const sameWidth = openingPreset(o) === preset;
    const style = "style" in d ? d.style : null;
    this.updateOpening({ type: d.type, leaves: d.leaves, sill: d.sill, height: d.height, style, ...(sameWidth ? {} : this.fitOpeningWidth(o, d.width)) });
  }

  /** A new width for an opening, with the same limit as placing one: no wider than its wall, and still inside it. */
  fitOpeningWidth(this: Fp3dEditor, o: Opening, wanted: number): Partial<Opening> {
    const floor = this.floor;
    const host = floor ? openingHost(o, floor.rooms, floor.walls ?? []) : null;
    let width = wanted;
    if (host) {
      const a = host.room.points[host.edge];
      const b = host.room.points[(host.edge + 1) % host.room.points.length];
      width = round(Math.min(wanted, Math.max(0.3, Math.hypot(b[0] - a[0], b[1] - a[1]) - 0.1)));
    }
    return { width, ...(host ? { offset: this.clampOffset(host.room, host.edge, width, o.offset) } : {}) };
  }

  /** A Type card picked (#417): the opening takes its kind and look in one undo step; the cards close. */
  pickOpeningCard(this: Fp3dEditor, o: Opening, id: string): void {
    const c = OPENING_CARDS.find((x) => x.id === id);
    if (!c) return;
    typeOpen.delete(this);
    const patch = openingCardPatch(o, c, this.floor?.height ?? 2.5);
    this.updateOpening(patch.width !== undefined ? { ...patch, ...this.fitOpeningWidth(o, patch.width) } : patch);
  }

  /** Opens or closes the Type cards of the selected opening. */
  toggleOpeningTypes(this: Fp3dEditor, o: Opening): void {
    if (typeOpen.get(this) === o.id) typeOpen.delete(this);
    else typeOpen.set(this, o.id);
    this.requestUpdate();
  }

  /**
   * The Type row (#417, MANY-5): the opening's kind and look as one picture row; it opens the picture cards (the Build
   * panel's style, #402) grouped by doors, windows and garage doors. Every style has a card, presets such as the
   * cellar window too (ORDER-6). Read-only users see the row without the cards.
   */
  renderOpeningType(this: Fp3dEditor, o: Opening) {
    const current = openingCardOf(o);
    const open = this.isEditor && typeOpen.get(this) === o.id;
    const id = `fp3d-ocards-${o.id}`;
    return html`<button
        type="button"
        class="fp3d-type-row"
        aria-expanded=${open ? "true" : "false"}
        aria-controls=${id}
        ?disabled=${!this.isEditor}
        @click=${() => this.toggleOpeningTypes(o)}
      >
        <span class="fp3d-oc-pic">${openingPic(current.id)}</span>
        <span class="fp3d-type-text"><span class="fp3d-type-label">${this.t("opening_type")}</span><span class="fp3d-type-value">${this.t(current.name)}</span></span>
        ${this.isEditor ? html`<span class="fp3d-type-chev" aria-hidden="true">${open ? "▴" : "▾"}</span>` : nothing}
      </button>
      ${open
        ? html`<div class="fp3d-ocards" id=${id} role="group" aria-label=${this.t("opening_type")}>
            ${OPENING_CARD_GROUPS.map(
              (g) => html`<div class="fp3d-ocards-head">${this.t(g.name)}</div>
                <div class="fp3d-ocards-grid">
                  ${OPENING_CARDS.filter((c) => c.group === g.group).map(
                    (c) => html`<button type="button" class="fp3d-oc" data-card=${c.id} aria-pressed=${c.id === current.id ? "true" : "false"} @click=${() => this.pickOpeningCard(o, c.id)}>
                      <span class="fp3d-oc-pic">${openingPic(c.id)}</span><span class="fp3d-oc-name">${this.t(c.name)}</span>
                    </button>`,
                  )}
                </div>`,
            )}
          </div>`
        : nothing}`;
  }

  /** Left / Right, or Inwards / Outwards: one segmented control with its label (#417). */
  segField<V extends string>(this: Fp3dEditor, label: string, value: V, options: readonly [V, string][], pick: (v: V) => void) {
    return html`<div class="fp3d-field fp3d-wide fp3d-seg-field">
      <span class="fp3d-field-label">${label}</span>
      <div class="fp3d-seg" role="group" aria-label=${label}>
        ${options.map(([v, text]) => html`<button type="button" aria-pressed=${v === value ? "true" : "false"} ?disabled=${!this.isEditor} @click=${() => v !== value && pick(v)}>${text}</button>`)}
      </div>
    </div>`;
  }

  updateOpening(this: Fp3dEditor, patch: Partial<Opening>): void {
    const id = this._openingId;
    this.change((_, floor) => patchItem(floor.openings.find((o) => o.id === id), patch));
  }

  async deleteOpening(this: Fp3dEditor): Promise<void> {
    const id = this._openingId;
    if (!id || !this.isEditor || !(await this.confirmFixedDelete("opening", id))) return;
    this.change((_, floor) => (floor.openings = floor.openings.filter((o) => o.id !== id)));
    this._openingId = null;
  }

  /**
   * offsetOnEdge with the snap guides (#143): the wall's middle and ends, equal gaps to the other doors and windows on
   * it, set distances from a corner; else the grid. Alt (`free`): by the centimetre, no guides.
   */
  snapOnEdge(this: Fp3dEditor, room: Room, edge: number, world: Vec2, width: number, peers: readonly Span[], free: boolean): number {
    if (!free) {
      const a = room.points[edge];
      const b = room.points[(edge + 1) % room.points.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const t = ((world[0] - a[0]) * (b[0] - a[0]) + (world[1] - a[1]) * (b[1] - a[1])) / len;
      const snap = snapOnWall(t, width, len, peers, snapTolerance(this._view.scale));
      if (snap) {
        const offset = this.clampOffset(room, edge, width, round(snap.offset));
        if (Math.abs(offset - snap.offset) < 0.002) {
          this.showGuides(wallGuides(a, b, snap, 14 / this._view.scale));
          return offset;
        }
      }
    }
    this.showGuides([]);
    return this.offsetOnEdge(room, edge, world, width, free);
  }

  renderOpenings(this: Fp3dEditor, floor: Floor, walls: Wall[]) {
    return svg`<g>${floor.openings.map((o) => {
      const host = openingHost(o, floor.rooms, floor.walls ?? []);
      if (!host) return nothing;
      const { room, edge } = host;
      const hit = locateOpening(walls, o, host);
      const p0 = pointOnRoomEdge(room, edge, o.offset - o.width / 2);
      const p1 = pointOnRoomEdge(room, edge, o.offset + o.width / 2);
      const ux = (p1[0] - p0[0]) / (o.width || 1);
      const uz = (p1[1] - p0[1]) / (o.width || 1);
      // normal into the room (room outlines may run either way round)
      const sgn = signedArea(room.points) >= 0 ? 1 : -1;
      const n: Vec2 = [-uz * sgn, ux * sgn];
      // gap across the whole wall thickness
      let across: [number, number] = [0.06, 0.06];
      if (hit) across = hit.wall.free || hit.wall.roomLeft === room.id ? [hit.wall.left, hit.wall.right] : [hit.wall.right, hit.wall.left];
      const q = (p: Vec2, k: number) => this.toScreen([p[0] + n[0] * k, p[1] + n[1] * k]);
      const gap = [q(p0, across[0] + 0.01), q(p1, across[0] + 0.01), q(p1, -across[1] - 0.01), q(p0, -across[1] - 0.01)];
      const sel = o.id === this._openingId;
      const style = openingStyle(o, hit?.wall.exterior ?? false);
      const front = o.type === "door" && isFrontDoor(style);
      const cls = `fp3d-open fp3d-open-${o.type}${front ? " fp3d-open-front" : ""}${sel ? " fp3d-open-sel" : ""}`;
      let symbol;
      if (o.type === "garage") {
        // door panel just inside the room, with its track under the ceiling drawn dashed
        const a0 = q(p0, across[0] - 0.04);
        const a1 = q(p1, across[0] - 0.04);
        const b0 = q(p0, across[0] + Math.min(2, o.height));
        const b1 = q(p1, across[0] + Math.min(2, o.height));
        // the tracks only while selected (#95): unexplained dashes looked like stray guides
        symbol = svg`<line x1=${a0[0]} y1=${a0[1]} x2=${a1[0]} y2=${a1[1]} />
          ${sel ? svg`<path class="fp3d-open-track" d="M${a0[0]} ${a0[1]}L${b0[0]} ${b0[1]}M${a1[0]} ${a1[1]}L${b1[0]} ${b1[1]}"><title>${this.t("help_legend_track")}</title></path>` : nothing}`;
      } else if (o.type === "door") {
        // leaves swinging into the room (or out of it) from the hinge side; "left" is seen from the
        // room, so it depends on which way round the outline runs
        const out = o.swing === "out";
        const face = out ? -across[1] : across[0];
        const hingeAtP0 = (o.hinge === "left") === sgn > 0;
        const two = o.leaves === 2;
        // sidelights: fixed glass beside the leaf, drawn like window panes
        let l0 = p0;
        let l1 = p1;
        let panes: [Vec2, Vec2][] = [];
        const lights = sidelightLayout(o.width, style, hingeAtP0, o);
        if (lights) {
          const at = (k: number): Vec2 => (k <= 0.02 ? p0 : k >= o.width - 0.02 ? p1 : pointOnRoomEdge(room, edge, o.offset - o.width / 2 + k));
          l0 = at(lights.x0);
          l1 = at(lights.x1);
          panes = lights.panels.map(([a, b]) => [at(a), at(b)]);
        }
        const midP: Vec2 = [(l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2];
        const leafW = (two ? 0.5 : 1) * Math.hypot(l1[0] - l0[0], l1[1] - l0[1]);
        const mid = (across[0] - across[1]) / 2;
        const paneLines = panes.map(([a, b]) => {
          const a0 = q(a, mid + 0.035);
          const b0 = q(b, mid + 0.035);
          const a1 = q(a, mid - 0.035);
          const b1 = q(b, mid - 0.035);
          return svg`<line class="fp3d-open-pane" x1=${a0[0]} y1=${a0[1]} x2=${b0[0]} y2=${b0[1]} /><line class="fp3d-open-pane" x1=${a1[0]} y1=${a1[1]} x2=${b1[0]} y2=${b1[1]} />`;
        });
        const arc = (hinge: Vec2, free: Vec2) => {
          const [hx, hy] = q(hinge, face);
          const [fx, fy] = q(free, face);
          const leaf = q(hinge, face + (out ? -leafW : leafW));
          const r = leafW * this._view.scale;
          const cross = (leaf[0] - hx) * (fy - hy) - (leaf[1] - hy) * (fx - hx);
          // the leaf always; its dashed swing only while the door is selected (#95), explained by a tooltip
          return svg`<line class="fp3d-open-leaf" x1=${hx} y1=${hy} x2=${leaf[0]} y2=${leaf[1]} />${
            sel ? svg`<path class="fp3d-open-swing" d="M${leaf[0]} ${leaf[1]}A${r} ${r} 0 0 ${cross > 0 ? 1 : 0} ${fx} ${fy}"><title>${this.t("help_legend_swing")}</title></path>` : nothing
          }`;
        };
        symbol = svg`${paneLines}${
          style === "passage"
            ? svg`<line class="fp3d-open-passage" x1=${q(p0, mid)[0]} y1=${q(p0, mid)[1]} x2=${q(p1, mid)[0]} y2=${q(p1, mid)[1]} />`
            : style === "sliding"
            ? svg`<line x1=${q(l0, face)[0]} y1=${q(l0, face)[1]} x2=${q(l1, face)[0]} y2=${q(l1, face)[1]} />`
            : two
              ? svg`${arc(l0, midP)}${arc(l1, midP)}`
              : arc(hingeAtP0 ? l0 : l1, hingeAtP0 ? l1 : l0)
        }`;
      } else {
        // two panes in the middle of the wall; a double window has a post in the middle
        const mid = (across[0] - across[1]) / 2;
        const a0 = q(p0, mid + 0.035);
        const a1 = q(p1, mid + 0.035);
        const b0 = q(p0, mid - 0.035);
        const b1 = q(p1, mid - 0.035);
        const midP: Vec2 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        const m0 = q(midP, across[0]);
        const m1 = q(midP, -across[1]);
        symbol = svg`<line x1=${a0[0]} y1=${a0[1]} x2=${a1[0]} y2=${a1[1]} /><line x1=${b0[0]} y1=${b0[1]} x2=${b1[0]} y2=${b1[1]} />${
          o.leaves === 2 ? svg`<line x1=${m0[0]} y1=${m0[1]} x2=${m1[0]} y2=${m1[1]} />` : nothing
        }`;
      }
      // a wide invisible band along the opening, so a door is easy to tap again (#312)
      const h0 = q(p0, (across[0] - across[1]) / 2);
      const h1 = q(p1, (across[0] - across[1]) / 2);
      // the selected one: a ring around its gap, a little past both ends, so it stands out on any wall (#63)
      let ring: unknown = nothing;
      if (sel) {
        const r0: Vec2 = [p0[0] - ux * 0.08, p0[1] - uz * 0.08];
        const r1: Vec2 = [p1[0] + ux * 0.08, p1[1] + uz * 0.08];
        const pts = [q(r0, across[0] + 0.1), q(r1, across[0] + 0.1), q(r1, -across[1] - 0.1), q(r0, -across[1] - 0.1)];
        ring = svg`<polygon class="fp3d-open-ring" points=${pts.map((p) => p.join(",")).join(" ")} />`;
      }
      return svg`<g data-opening=${o.id} class=${cls}>
        <line class="fp3d-open-hit" x1=${h0[0]} y1=${h0[1]} x2=${h1[0]} y2=${h1[1]} />
        <polygon class="fp3d-open-gap" points=${gap.map((p) => p.join(",")).join(" ")} />
        ${symbol} ${ring}
      </g>`;
    })}</g>`;
  }

  /** The room's doors and windows as a list: a tap selects one that is hard to hit in the plan (#312). */
  renderRoomOpenings(this: Fp3dEditor, room: Room) {
    const own = (this.floor?.openings ?? []).filter((o) => o.room_id === room.id);
    if (!own.length) return nothing;
    return this.sideFold("room-openings", room.id, false, `${this.t("room_openings")} (${own.length})`, "", 0, () => html`<div class="fp3d-room-list">
        ${own.map(
          (o) => html`<button class="fp3d-row" @click=${() => (this.selectItem("opening", o.id), this.renderRoot.querySelector(".fp3d-side")?.scrollTo(0, 0))}>
            <span>${this.t(`preset_${openingPreset(o)}` as I18nKey)}</span><span class="fp3d-muted">${this.m(o.width, 2)}</span>
          </button>`,
        )}
      </div>`);
  }

  /** Whether an opening sits in an exterior wall (decides the automatic door style). */
  openingIsExterior(this: Fp3dEditor, o: Opening): boolean {
    const floor = this.floor;
    const host = floor ? openingHost(o, floor.rooms, floor.walls ?? []) : null;
    if (!floor || !host) return false;
    const walls = generateWalls(floor.rooms, { exterior: this._doc.settings.wall_exterior, interior: this._doc.settings.wall_interior }, floor.walls ?? []);
    return locateOpening(walls.walls, o, host)?.wall.exterior ?? false;
  }

  /** The look of a door or window: automatic (by wall), or one of the built-in styles. */
  /** Front doors with sidelights: which side the single one sits on, and the widths (empty = automatic). */
  renderSidelightFields(this: Fp3dEditor, o: Opening) {
    if (o.type !== "door") return nothing;
    const style = openingStyle(o, this.openingIsExterior(o));
    if (style !== "sidelight" && style !== "sidelights") return nothing;
    const admin = this.isEditor;
    const width = (key: "sidelight_width" | "sidelight_width2", label: I18nKey) => html`<label class="fp3d-field"
      >${this.t(label)}
      <input
        type="number"
        step="0.05"
        min="0.1"
        max="3"
        placeholder=${this.t("sidelight_auto")}
        .value=${o[key] == null ? "" : String(o[key])}
        ?disabled=${!admin}
        @change=${(e: Event) => {
          const v = Number((e.target as HTMLInputElement).value);
          this.updateOpening({ [key]: Number.isFinite(v) && v > 0 ? Math.min(3, Math.max(0.1, Math.round(v * 100) / 100)) : null });
        }}
      />
    </label>`;
    return style === "sidelight"
      ? html`<label class="fp3d-check" title=${this.t("sidelight_hinge_hint")}
            ><input type="checkbox" .checked=${!!o.sidelight_hinge} ?disabled=${!admin} @change=${(ev: Event) => this.updateOpening({ sidelight_hinge: (ev.target as HTMLInputElement).checked })} />
            ${this.t("sidelight_hinge")}</label
          >
          ${width("sidelight_width", "sidelight_width")}`
      : html`${width("sidelight_width", "sidelight_width_left")} ${width("sidelight_width2", "sidelight_width_right")}`;
  }

  /** The door and window kinds as a fixed grid of chips: none moves when another is picked (#63). */
  renderOpeningKinds(this: Fp3dEditor, active: OpeningPreset, pick: (p: OpeningPreset, ev: Event) => void) {
    return html`<div class="fp3d-presets" role="group" aria-label=${this.t("opening_type")}>
      ${(Object.keys(OPENING_PRESETS) as OpeningPreset[]).map(
        (p) => html`<button class="fp3d-chip" aria-pressed=${p === active} @click=${(ev: Event) => pick(p, ev)}>${this.t(`preset_${p}` as I18nKey)}</button>`,
      )}
    </div>`;
  }

  /** The kind the next tap in Doors & windows mode adds, picked before placing (#63). */
  pickOpeningKind(this: Fp3dEditor, preset: OpeningPreset): void {
    this._openingPreset = preset;
  }

  /** "Centre from east corner (m)": the position field names the corner it measures from (#63). */
  openingPositionLabel(this: Fp3dEditor, o: Opening): string {
    const floor = this.floor;
    const host = floor ? openingHost(o, floor.rooms, floor.walls ?? []) : null;
    if (!host) return this.t("opening_position");
    const corner = edgeStartCorner(host.room, host.edge, this._doc.settings.north ?? 0);
    return this.t("opening_position_from", { corner: this.t(`compass_${corner}` as I18nKey) });
  }

  /** "Automatic (window board and sill)": what automatic gives this window (#412, DEF-3), as the 3D view decides it. */
  sillAutoText(this: Fp3dEditor, o: Opening): string {
    const exterior = this.openingIsExterior(o);
    const auto = o.sill > 0.3 && openingStyle(o, exterior) !== "glass_wall";
    return this.t("sill_board_auto_of", { what: this.t(!auto ? "sill_board_none" : exterior ? "sill_board_both" : "sill_board_inside") });
  }

  /**
   * Where a window's or door's blind sits (outside as a roller shutter, inside the room as a roller shade), and
   * "Invert slats" once its cover reports a slat tilt (a venetian blind or Raffstore) or the option is already on (#453).
   */
  renderBlindFields(this: Fp3dEditor, o: Opening, cover: string | null) {
    const admin = this.isEditor;
    const slats = !!o.slat_invert || (!!cover && slatTilt(this.hass?.states[cover]) !== null);
    // the blind found by itself is written down with the option, so the sliders know whose slats are turned round
    const setInvert = (on: boolean) => this.updateOpening(on ? { slat_invert: true, ...(cover && !o.cover ? { cover } : {}) } : { slat_invert: null });
    return html`<label class="fp3d-field fp3d-wide"
        >${this.t("blind_sits")}
        <select ?disabled=${!admin} @change=${(e: Event) => this.updateOpening({ blind_side: (e.target as HTMLSelectElement).value === "inside" ? "inside" : null })}>
          <option value="outside" ?selected=${o.blind_side !== "inside"}>${this.t("blind_side_outside")}</option>
          <option value="inside" ?selected=${o.blind_side === "inside"}>${this.t("blind_side_inside")}</option>
        </select></label
      >
      ${slats
        ? html`<label class="fp3d-check fp3d-wide" title=${this.t("slats_invert_hint")}
            ><input type="checkbox" ?disabled=${!admin} .checked=${!!o.slat_invert} @change=${(ev: Event) => setInvert((ev.target as HTMLInputElement).checked)} />
            ${this.t("slats_invert")}</label
          >`
        : nothing}`;
  }

  renderOpeningForm(this: Fp3dEditor, o: Opening) {
    const admin = this.isEditor;
    const window = o.type === "window";
    const garage = o.type === "garage";
    // what "automatic" would pick: resolve with the opening's own links cleared
    const autoPick = (key: "cover" | "contact") =>
      this.keptForPlan(`opening|${o.id}|${key}`, () => {
        if (!this.hass) return null;
        const probe = structuredClone(this._doc.floors);
        for (const f of probe) for (const x of f.openings) if (x.id === o.id) x[key] = null;
        return openingEntities(this.hass, probe).get(o.id)?.[key] ?? null;
      });
    const dc = (id: string) => this.hass?.states[id]?.attributes.device_class as string | undefined;
    const covers = this.entityOptions((id) => id.startsWith("cover."));
    // a garage door's drive may also be a pulse switch or a button that the opener answers (#677)
    const garageDrives = garage ? this.entityOptions((id) => id.startsWith("cover.") || isPulseDrive(id)) : covers;
    // sensors with a number for the live position of a blind
    const positions = this.entityOptions((id) => /^(sensor|number|input_number)\./.test(id) && Number.isFinite(Number(this.hass?.states[id]?.state)));
    // plain contacts, and handle sensors with three states (open / tilted / closed)
    // a garage door may also be a switch or toggle helper (a relay that drives the door): on = open, a tap switches it
    // a contact: a binary sensor of the door/window kind, or one without any class (KNX, enOcean, templates often
    // have none – they were missing from the list)
    const isContact = (id: string) => id.startsWith("binary_sensor.") && ["door", "window", "opening", "garage_door", ""].includes(dc(id) ?? "");
    const contacts = this.entityOptions(
      (id) =>
        isContact(id) ||
        (numberish(id) && windowPosition(this.hass?.states[id]) !== null) ||
        (garage && /^(switch|input_boolean)\./.test(id)),
      garage,
    );
    // handle sensors: text states (open / tilted / closed), a window_state attribute, or a telling name
    const handles = this.entityOptions((id) => {
      const st = this.hass?.states[id];
      if (id.startsWith("binary_sensor.")) return typeof st?.attributes.window_state === "string";
      return numberish(id) && (windowPosition(st) !== null || /handle|window/i.test(`${id} ${entityName(this.hass, id)}`));
    });
    const plainContacts = this.entityOptions(isContact);
    type Kind = NonNullable<Opening["sensor"]>;
    const leafSensors = (leaf: 1 | 2) => {
      const main = leaf === 1;
      const tilt = main ? o.tilt : (o.tilt2 ?? null);
      const contact = main ? o.contact : o.contact2;
      const kind: Kind = (main ? o.sensor : o.sensor2) ?? (tilt && tilt !== "none" ? "contact_tilt" : "contact");
      const setContact = (v: string | null) => this.updateOpening(main ? { contact: v } : { contact2: v === "none" ? null : v });
      return html`<label class="fp3d-field fp3d-wide"
          >${this.t("sensor_kind")}
          <select
            ?disabled=${!admin}
            @change=${(e: Event) => {
              const next = (e.target as HTMLSelectElement).value as Kind;
              const clearTilt = next === "contact_tilt" ? {} : main ? { tilt: null } : { tilt2: null };
              this.updateOpening({ ...(main ? { sensor: next } : { sensor2: next }), ...clearTilt });
            }}
          >
            ${(["contact", "handle", "contact_tilt"] as const).map((k) => html`<option value=${k} ?selected=${k === kind}>${this.t(`sensor_kind_${k}`)}</option>`)}
          </select></label
        >
        ${kind === "handle"
          ? this.entitySelect(this.t("handle_entity"), contact, undefined, handles, (v) => setContact(v === "none" ? (main ? "none" : null) : v))
          : this.entitySelect(this.t("contact_entity"), contact, main ? autoPick("contact") : undefined, plainContacts, setContact)}
        ${kind === "contact_tilt"
          ? this.entitySelect(this.t("tilt_entity"), tilt, undefined, contacts, (v) => this.updateOpening(main ? { tilt: v === "none" ? null : v } : { tilt2: v === "none" ? null : v }))
          : nothing}
        ${main
          ? html`${this.entitySelect(this.t("tilt_angle_entity"), o.tilt_angle ?? null, undefined, this.entityOptions((id) => numberish(id)), (v) => this.updateOpening({ tilt_angle: v === "none" ? null : v }))}
            ${o.tilt_angle && o.tilt_angle !== "none"
              ? html`${this.num(this.t("tilt_angle_max"), o.tilt_max ?? 15, (v) => this.updateOpening({ tilt_max: Math.min(90, Math.max(1, v)) }), 1, 1)}
                ${this.num(this.t("tilt_angle_offset"), o.tilt_offset ?? 0, (v) => this.updateOpening({ tilt_offset: v }), 0.5)}
                <label class="fp3d-check fp3d-wide"
                  ><input type="checkbox" .checked=${!!o.tilt_invert} ?disabled=${!admin} @change=${(ev: Event) => this.updateOpening({ tilt_invert: (ev.target as HTMLInputElement).checked })} />
                  ${this.t("tilt_angle_invert")}</label
                >`
              : nothing}`
          : nothing}`;
    };
    const preset = openingPreset(o);
    const door = o.type === "door";
    const roomName = this.floor?.rooms.find((r) => r.id === o.room_id)?.name;
    return html`<section>
      ${this.renderPanelHeader({
        id: `opening:${o.id}`,
        title: this.t(`preset_${preset}` as I18nKey),
        kind: this.t(window ? "opening_window" : garage ? "preset_garage" : "opening_door"),
        where: roomName || this.floor?.name,
        live: [o.contact && o.contact !== "none" ? stateChip(this.hass, this.hass?.states[o.contact]) : "", o.cover && o.cover !== "none" ? stateChip(this.hass, this.hass?.states[o.cover]) : ""],
        lock: this.fixLock("opening", o.id),
        menu: [{ label: this.t("delete"), keys: ["Del"], danger: true, run: () => this.deleteOpening() }],
      })}
      ${this.renderOpeningType(o)}
      <div class="fp3d-form">
        ${this.len(this.t("width"), o.width, (v) => this.updateOpening({ width: Math.max(0.3, v) }), 0.01, 0.3)}
        ${this.len(this.openingPositionLabel(o), o.offset, (v) => this.updateOpening({ offset: Math.max(0, v) }), 0.01, 0)}
        ${this.len(this.t("opening_height"), o.height, (v) => this.updateOpening({ height: Math.max(0.3, v) }), 0.01, 0.3)}
        ${window
          ? html`<div class="fp3d-pair fp3d-wide">
              <label class="fp3d-field" title=${this.t("sill_board_hint")}
                ><span class="fp3d-field-label">${this.t("sill_board")}</span>
                <select ?disabled=${!admin} @change=${(e: Event) => this.updateOpening({ sill_board: ((e.target as HTMLSelectElement).value || "auto") as SillBoard })}>
                  ${SILL_BOARDS.map((m) => html`<option value=${m} ?selected=${(o.sill_board ?? "auto") === m}>${m === "auto" ? this.sillAutoText(o) : this.t(`sill_board_${m}`)}</option>`)}
                </select></label
              >
              ${this.len(this.t("sill"), o.sill, (v) => this.updateOpening({ sill: Math.max(0, v) }), 0.01, 0)}
            </div>`
          : nothing}
        ${garage
          ? nothing
          : this.segField(
              this.t(o.leaves === 2 ? "main_leaf" : "hinge"),
              o.hinge === "right" ? "right" : "left",
              [
                ["left", this.t("hinge_left")],
                ["right", this.t("hinge_right")],
              ],
              (v) => this.updateOpening({ hinge: v }),
            )}
        ${!garage && (door || (window && o.sill < 0.1))
          ? this.segField(
              this.t("swing_label"),
              o.swing === "out" ? "out" : "in",
              [
                ["in", this.t("swing_in")],
                ["out", this.t("swing_out")],
              ],
              (v) => this.updateOpening({ swing: v }),
            )
          : nothing}
        ${this.renderSidelightFields(o)}
        <label class="fp3d-field fp3d-wide" title=${this.t("opening_mark_hint")}
          >${this.t("opening_mark")}
          <select ?disabled=${!this.isEditor} @change=${(e: Event) => this.updateOpening({ mark: (e.target as HTMLSelectElement).value === "closed" ? "closed" : null })}>
            <option value="" ?selected=${o.mark !== "closed"}>${this.t("opening_mark_open")}</option>
            <option value="closed" ?selected=${o.mark === "closed"}>${this.t("opening_mark_closed")}</option>
          </select></label
        >
        ${window || garage || door ? this.entitySelect(this.t(window ? "cover_entity" : "door_cover"), o.cover, autoPick("cover"), garage ? garageDrives : covers, (v) => this.updateOpening({ cover: v })) : nothing}
        ${garage && isPulseDrive(o.cover) ? html`<p class="fp3d-sub fp3d-wide">${this.t("garage_pulse_hint")}</p>` : nothing}
        ${(window || garage || door) && o.cover !== "none" && (o.cover || autoPick("cover"))
          ? html`${isPulseDrive(o.cover) ? nothing : this.entitySelect(this.t("cover_position_entity"), o.position ?? null, undefined, positions, (v) => this.updateOpening({ position: v === "none" ? null : v }))}
              ${o.position && !isPulseDrive(o.cover)
                ? html`<label class="fp3d-check fp3d-wide"
                    ><input
                      type="checkbox"
                      ?disabled=${!admin}
                      .checked=${!!o.position_inverted}
                      @change=${(ev: Event) => this.updateOpening({ position_inverted: (ev.target as HTMLInputElement).checked })}
                    />
                    ${this.t("cover_position_invert")}</label
                  >`
                : nothing}
              ${garage || isPulseDrive(o.cover) ? nothing : this.renderBlindFields(o, o.cover || autoPick("cover"))}
              <label class="fp3d-check fp3d-wide" title=${this.t("cover_confirm_hint")}
                ><input type="checkbox" ?disabled=${!admin} .checked=${!!o.confirm} @change=${(ev: Event) => this.updateOpening({ confirm: (ev.target as HTMLInputElement).checked })} />
                ${this.t("device_confirm")}</label
              >`
          : nothing}
        ${window
          ? html`${o.leaves === 2 ? html`<h4 class="fp3d-lib-head fp3d-wide">${this.t("leaf_main")}</h4>` : nothing}
              ${leafSensors(1)} ${o.leaves === 2 ? html`<h4 class="fp3d-lib-head fp3d-wide">${this.t("leaf_second")}</h4>${leafSensors(2)}` : nothing}
              ${o.sill <= 0.01
                ? html`${this.entitySelect(this.t("door_lock"), o.lock ?? null, undefined, this.entityOptions((id) => id.startsWith("lock.")), (v) => this.updateOpening({ lock: v === "none" ? null : v }))}
                  <p class="fp3d-sub fp3d-wide">${this.t("door_lock_hint")}</p>`
                : nothing}`
          : html`${this.entitySelect(this.t(o.leaves === 2 ? "contact_main" : "contact_entity"), o.contact, autoPick("contact"), contacts, (v) => this.updateOpening({ contact: v }))}
              ${o.leaves === 2 && !garage
                ? this.entitySelect(this.t("contact_second"), o.contact2, undefined, contacts, (v) => this.updateOpening({ contact2: v === "none" ? null : v }))
                : nothing}
              ${door
                ? html`<label class="fp3d-check fp3d-wide" title=${this.t("door_shut_hint")}
                    ><input type="checkbox" .checked=${!!o.shut} ?disabled=${!admin} @change=${(ev: Event) => this.updateOpening({ shut: (ev.target as HTMLInputElement).checked })} />
                    ${this.t("door_shut")}</label
                  >
                  <label class="fp3d-field" title=${this.t("door_angle_hint")}
                    >${this.t("door_angle")}
                    <select
                      ?disabled=${!admin}
                      @change=${(ev: Event) => {
                        const v = Number((ev.target as HTMLSelectElement).value);
                        this.updateOpening({ open_angle: v > 0 ? v : null });
                      }}
                    >
                      <option value="0" ?selected=${!o.open_angle}>${this.t("door_angle_default_of", { deg: o.contact !== "none" && (o.contact || autoPick("contact")) ? DOOR_OPEN_SENSED : DOOR_OPEN_FREE })}</option>
                      ${[15, 30, 45, 60, 90].map((a) => html`<option value=${a} ?selected=${o.open_angle === a}>${a}°</option>`)}
                      ${o.open_angle && ![15, 30, 45, 60, 90].includes(o.open_angle) ? html`<option value=${o.open_angle} selected>${o.open_angle}°</option>` : nothing}
                    </select></label
                  >
                  ${this.entitySelect(this.t("door_lock"), o.lock ?? null, undefined, this.entityOptions((id) => id.startsWith("lock.")), (v) => this.updateOpening({ lock: v === "none" ? null : v }))}
                  <p class="fp3d-sub fp3d-wide">${this.t("door_lock_hint")}</p>`
                : nothing}`}
        ${o.contact !== "none" && (o.contact || o.contact2 || autoPick("contact"))
          ? html`<label class="fp3d-check fp3d-wide" title=${this.t("contact_invert_hint")}
              ><input type="checkbox" .checked=${!!o.contact_invert} ?disabled=${!admin} @change=${(ev: Event) => this.updateOpening({ contact_invert: (ev.target as HTMLInputElement).checked })} />
              ${this.t("contact_invert")}</label
            >`
          : nothing}
        ${this.floor && windowGetsWell(this._doc, this.floor, o)
          ? html`<label class="fp3d-check fp3d-wide" title=${this.t("well_hint")}
                ><input type="checkbox" .checked=${o.well !== false} ?disabled=${!admin} @change=${(ev: Event) => this.updateOpening({ well: (ev.target as HTMLInputElement).checked ? undefined : false })} />
                ${this.t("well")}</label
              >
              ${o.well !== false ? this.len(this.t("well_rim"), o.well_rim ?? 0, (v) => this.updateOpening({ well_rim: Math.max(-0.3, Math.min(1, v)) || null }), 0.01, -0.3) : nothing}`
          : nothing}
        ${o.type === "window"
          ? html`<label class="fp3d-check fp3d-wide" title=${this.t("rain_ignore_hint")}
              ><input type="checkbox" .checked=${!!o.rain_ignore} ?disabled=${!admin} @change=${(ev: Event) => this.updateOpening({ rain_ignore: (ev.target as HTMLInputElement).checked || undefined })} />
              ${this.t("rain_ignore")}</label
            >`
          : nothing}
      </div>
      ${window
        ? this.withInfo(html`<p class="fp3d-sub">${this.t("window_sensor_short")}</p>`, "opening_hint", this.t("sensor_kind"))
        : html`<p class="fp3d-sub">${this.t(garage ? "garage_hint" : "door_hint")}</p>`}
    </section>`;
  }
}
