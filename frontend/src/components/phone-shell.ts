// The phone view as one piece, for the panel and the dashboard card alike (#493, ported from NeonPlan 3D 4.0.0, MIT,
// Mastershort): the bar at the bottom (Now, the rooms by floor, the blinds, More), the list "What's going on?" as a page
// of its own, and the house check. It lies over the 3D view without taking its touches, reads what the view knows
// (`view().nowInput()`) and asks its host for what only the host can do: open a room or a floor (phone-room) and the
// host's own entries under More (phone-more). A chunk of its own (load-parts.ts): only a phone with the view on loads it.
// #494 adds a card's own places (phone_places: a page of lamps or thermostats, a scene, a dashboard page), the parts a
// card leaves out (phone_hide), opening with the list (phone_start) and the favourites on top of the list.
import { LitElement, css, html, nothing } from "lit";
import { defineElement } from "../define.ts";
import { phonePlaces, type PhonePart, type PhonePlace } from "../card-config.ts";
import { entityName, favoriteCall, tempUnit } from "../devices.ts";
import { callServiceSafe } from "../failure.ts";
import { formatNumber, translate, type I18nKey } from "../i18n.ts";
import type { Building } from "../model.ts";
import { nowItems, nowStops, nowSummary, type NowAction, type NowInput, type NowStop, type NowTarget, type NowWords } from "../now.ts";
import { climateOnMode, fitSlots, floorCovers, floorGroup, navCover, navFloors, navSlots, ownSlots, type NavDevice, type NavFloor } from "../phone-bar.ts";
import { roomTiles } from "../room-tiles.ts";
import type { HomeAssistant } from "../types.ts";
import "./now-list.ts";
import type { NowLabels, NowMode } from "./now-list.ts";
import "./phone-nav.ts";
import type { NavGroup, NavLabels, NavMoreItem, NavSheet } from "./phone-nav.ts";

/** What the shell needs from the 3D view. */
export interface PhoneView {
  nowInput(): NowInput | null;
  showNow(target: NowTarget): void;
  openFind?(): void;
  quietCards?(on: boolean): void;
}

export class Fp3dPhoneShell extends LitElement {
  static properties = {
    hass: { attribute: false },
    building: { attribute: false },
    view: { attribute: false },
    floorId: { attribute: false },
    roomId: { attribute: false },
    solo: { type: Boolean },
    extras: { attribute: false },
    hide: { attribute: false },
    start: { attribute: false },
    places: { attribute: false },
    mode: { reflect: true },
    _sheet: { state: true },
    _navFloor: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare building: Building | null;
  /** A getter, not the element: the view comes and goes with the host's rendering. */
  declare view: () => PhoneView | null | undefined;
  declare floorId: string | null;
  declare roomId: string | null;
  /** "Room on its own" (#500): a room jumped into stands alone in the picture; the host keeps it (phone-solo). */
  declare solo: boolean;
  /** The host's own entries under More (the panel's View settings, time travel, Home Assistant's menu …). */
  declare extras: NavMoreItem[];
  /** Parts left out (card option `phone_hide`): the rooms and the blinds in the bar, the favourites on top of the list. */
  declare hide: readonly PhonePart[];
  /** "now" (card option `phone_start`): opens with the list, once, as soon as the house is there. */
  declare start: string | undefined;
  /** The card's own places in the bar (`phone_places`, checked by phonePlaces()). */
  declare places: unknown;
  /** bar: only the bar; page: the list; check: the house check steps through the house. */
  declare mode: NowMode;
  private declare _sheet: NavSheet;
  private declare _navFloor: string | null;
  private stops: NowStop[] = [];
  private lastFloors: NavFloor[] = [];
  /** The own place whose page is open (sheet "group"). */
  private own = 0;
  private started = false;

  constructor() {
    super();
    this.building = null;
    this.view = () => null;
    this.floorId = null;
    this.roomId = null;
    this.solo = false;
    this.extras = [];
    this.hide = [];
    this.start = undefined;
    this.places = undefined;
    this.mode = "bar";
    this._sheet = null;
    this._navFloor = null;
  }

  private t(key: I18nKey): string {
    return translate(this.hass, key);
  }

  private fire<T>(type: string, detail?: T): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  private watts(w: number): string {
    return Math.abs(w) >= 1000 ? `${formatNumber(this.hass, w / 1000, 1)} kW` : `${Math.round(w)} W`;
  }

  private words(away: boolean): NowWords {
    const n = (one: I18nKey, many: I18nKey) => (count: number) => this.t(count === 1 ? one : many).replace("{n}", String(count));
    return {
      open: n("now_open_one", "now_open"),
      tilted: this.t("now_tilted"),
      unlocked: n("now_unlocked_one", "now_unlocked"),
      home: this.t("now_home"),
      away: this.t("now_away"),
      nobodyHome: this.t("now_nobody"),
      lights: n("now_lights_one", "now_lights"),
      energyUse: this.t("energy_consumption"),
      energySolar: this.t("energy_solar"),
      energyGrid: this.t("energy_grid_import"),
      energyFeed: this.t("energy_grid_export"),
      battery: this.t("now_battery"),
      charging: this.t("wallbox_charging"),
      carAway: this.t("now_car_away"),
      calm: this.t(away ? "now_calm_away" : "now_calm"),
      calmDetail: this.t("now_calm_detail"),
      watts: (w) => this.watts(w),
    };
  }

  private setMode(mode: NowMode): void {
    if (mode === "check") {
      // the stops as they are now: what is switched off on the way must not reorder them
      const input = this.view()?.nowInput();
      this.stops = input ? nowStops(input, this.words(input.away)) : [];
    }
    // the check went from room to room: back to the house as it was
    if (this.mode === "check" && mode !== "check") this.fire("phone-room", { floorId: this.floorId, roomId: null });
    if ((mode === "check") !== (this.mode === "check")) this.view()?.quietCards?.(mode === "check");
    this._sheet = null;
    this.mode = mode;
    this.fire<NowMode>("phone-mode", mode);
  }

  protected updated(): void {
    // a card set to open with the list: once, as soon as the house is there
    if (this.started || !this.hass || !this.building) return;
    this.started = true;
    if (this.start === "now" && this.mode === "bar") this.setMode("page");
  }

  /** The host opens the list (Back closes it again through `close()`). */
  openList(): void {
    this.setMode("page");
  }

  /** Closes what is open (a sheet, the list, the check); false when only the bar showed. */
  close(): boolean {
    if (this._sheet) {
      this._sheet = null;
      return true;
    }
    if (this.mode === "bar") return false;
    this.setMode("bar");
    return true;
  }

  private go(target: NowTarget): void {
    if (this.mode === "page") this.setMode("bar");
    this.view()?.showNow(target);
  }

  private act(action: NowAction): void {
    const hass = this.hass;
    if (!hass || !action.entities.length) return;
    const msg = (error: string) => translate(hass, "service_failed", { error });
    if (action.kind === "lock") callServiceSafe(hass, "lock", "lock", { entity_id: action.entities }, msg);
    else callServiceSafe(hass, "homeassistant", "turn_off", { entity_id: action.entities }, msg);
  }

  private failed(error: string): string {
    return translate(this.hass, "service_failed", { error });
  }

  /** A favourite on top of the list: scenes and scripts start, buttons are pressed, the rest toggles. */
  private fav(entity: string): void {
    if (!this.hass) return;
    const [domain, service] = favoriteCall(entity);
    callServiceSafe(this.hass, domain, service, { entity_id: entity }, (e) => this.failed(e));
  }

  /** An own group place's page: the lamps (with their brightness) or the thermostats (what they have and want) by floor. */
  private groupOf(place: PhonePlace, floors: readonly NavFloor[]): NavGroup | null {
    const hass = this.hass;
    if (!hass || (place.kind !== "lights" && place.kind !== "climate")) return null;
    const lights = place.kind === "lights";
    const deg = (v: unknown) => (typeof v === "number" ? `${formatNumber(hass, v, 1)}°` : "");
    const device = (id: string): NavDevice => {
      const st = hass.states[id];
      const a = st?.attributes ?? {};
      const on = lights ? st?.state === "on" : !!st && !["off", "unavailable", "unknown"].includes(st.state);
      const detail = lights
        ? on && typeof a.brightness === "number"
          ? `${Math.round(a.brightness / 2.55)} %`
          : ""
        : [deg(a.current_temperature), on ? deg(a.temperature) : ""].filter(Boolean).join(" → ");
      return { entity: id, name: entityName(hass, id), on, detail };
    };
    const groups = floorGroup(floors, place.kind).map((f) => ({ id: f.id, name: f.name, items: f.entities.map(device) }));
    return { title: place.name || this.t(lights ? "nav_lights" : "nav_climate"), allOn: lights, floors: groups };
  }

  /** Switches an own page's devices: lamps on and off, thermostats off or back to heating (their first mode that is not off). */
  private switchGroup(entities: string[], on: boolean): void {
    const hass = this.hass;
    if (!hass || !entities.length) return;
    const climates = entities.filter((id) => id.startsWith("climate."));
    const rest = entities.filter((id) => !id.startsWith("climate."));
    if (rest.length) callServiceSafe(hass, "homeassistant", on ? "turn_on" : "turn_off", { entity_id: rest }, (e) => this.failed(e));
    for (const id of climates) {
      const modes = (hass.states[id]?.attributes.hvac_modes as string[] | undefined) ?? [];
      const mode = on ? climateOnMode(modes) : "off";
      if (mode && (on || !modes.length || modes.includes("off"))) callServiceSafe(hass, "climate", "set_hvac_mode", { entity_id: id, hvac_mode: mode }, (e) => this.failed(e));
    }
  }

  private tapSlot(id: string, floors: NavFloor[]): void {
    if (id === "now") return this.setMode(this.mode === "page" ? "bar" : "page");
    if (this.mode !== "bar") this.setMode("bar");
    if (id.startsWith("own:")) {
      const index = Number(id.slice(4));
      const place = phonePlaces(this.places)[index];
      if (!place) return;
      if (place.kind === "action" && place.entity) {
        this._sheet = null;
        const [domain, service] = favoriteCall(place.entity);
        if (this.hass) callServiceSafe(this.hass, domain, service === "toggle" ? "turn_on" : service, { entity_id: place.entity }, (e) => this.failed(e));
      } else if (place.kind === "link" && place.path) {
        this._sheet = null;
        this.fire<string>("phone-link", place.path);
      } else {
        const same = this._sheet === "group" && this.own === index;
        this.own = index;
        this._sheet = same ? null : "group";
      }
      return;
    }
    const floor = id.startsWith("floor:") ? id.slice(6) : null;
    const sheet: NavSheet = floor || id === "rooms" ? "rooms" : id === "covers" ? "covers" : "more";
    const same = this._sheet === sheet && (!floor || floor === this._navFloor);
    this._sheet = same ? null : sheet;
    if (sheet === "rooms") this._navFloor = floor ?? (floors.some((f) => f.id === this.floorId) ? this.floorId : (floors[0]?.id ?? null));
  }

  private tapMore(id: string): void {
    this._sheet = null;
    if (id === "check") this.setMode("check");
    else if (id === "house") this.fire("phone-room", { floorId: null, roomId: null });
    else if (id === "solo") this.fire<boolean>("phone-solo", !this.solo);
    else if (id === "find") this.view()?.openFind?.();
    // a place that found no room in the bar
    else if (id.startsWith("slot:")) this.tapSlot(id.slice(5), this.lastFloors);
    else this.fire<string>("phone-more", id);
  }

  render() {
    const hass = this.hass;
    const b = this.building;
    if (!hass || !b) return nothing;
    const input = this.view()?.nowInput() ?? null;
    const items = input ? nowItems(input, this.words(input.away)) : [];
    const summary = input ? nowSummary(items) : { text: "", level: 0 as const };

    const floors = navFloors(b.floors, roomTiles(hass, b, null));
    const out = new Set<string>(this.hide ?? []);
    const covers = floorCovers(floors).map((f) => ({ id: f.id, name: f.name, items: f.entities.map((id) => navCover(id, entityName(hass, id), hass.states[id]?.state, hass.states[id]?.attributes.current_position)) }));
    const shut = covers.reduce((n, f) => n + f.items.filter((c) => c.shut).length, 0);
    const places = phonePlaces(this.places);
    const groups = places.map((p) => this.groupOf(p, floors));
    const fallback = (p: PhonePlace) => (p.kind === "lights" ? this.t("nav_lights") : p.kind === "climate" ? this.t("nav_climate") : p.kind === "action" && p.entity ? entityName(hass, p.entity) : this.t("nav_page"));
    const own = ownSlots(
      places.map((p, i) => {
        const devices = groups[i]?.floors.flatMap((f) => f.items) ?? [];
        return { ...p, devices: devices.length, on: devices.filter((d) => d.on).length, exists: !!p.entity && !!hass.states[p.entity], fallback: fallback(p) };
      }),
    );
    const { bar: slots, over } = fitSlots(navSlots(out.has("rooms") ? [] : floors, items.filter((it) => it.level > 0).length, shut, covers.length > 0 && !out.has("covers"), own));
    this.lastFloors = floors;
    const active =
      this.mode === "page" ? "now" : this._sheet === "rooms" ? (slots.some((sl) => sl.id === "rooms") ? "rooms" : `floor:${this._navFloor}`) : this._sheet === "group" ? `own:${this.own}` : this._sheet;
    const favorites = out.has("favorites") ? [] : (b.settings.favorites ?? []).filter((id) => !!hass.states[id]).map((id) => ({ entity: id, name: entityName(hass, id) }));

    const nowLabels: NowLabels = {
      title: this.t("now_title"),
      close: this.t("close"),
      lightsOff: this.t("now_lights_off"),
      lock: this.t("now_lock"),
      check: this.t("now_check"),
      checkHint: this.t("now_check_hint"),
      next: this.t("now_next"),
      done: this.t("now_done"),
      checkDone: this.t("now_check_done"),
      checkNothing: this.t("now_check_nothing"),
      windowHint: this.t("now_window_hint"),
      allLightsOff: this.t("now_all_lights_off"),
    };
    const navLabels: NavLabels = {
      now: this.t("nav_now"),
      rooms: this.t("nav_rooms"),
      covers: this.t("nav_covers"),
      more: this.t("nav_more"),
      wholeFloor: this.t("nav_whole_floor"),
      allUp: this.t("nav_all_up"),
      allDown: this.t("nav_all_down"),
      allOn: this.t("nav_all_on"),
      allOff: this.t("nav_all_off"),
      on: this.t("nav_dev_on"),
      off: this.t("nav_dev_off"),
      close: this.t("close"),
    };
    const more: NavMoreItem[] = [
      ...over.map((s): NavMoreItem => ({ id: `slot:${s.id}`, icon: s.icon ?? (s.id === "covers" ? "▤" : "▦"), label: s.label || this.t(s.id === "covers" ? "nav_covers" : "nav_rooms"), hint: s.badge ? String(s.badge) : undefined })),
      ...(this.view()?.openFind ? [{ id: "find", icon: "🔍", label: this.t("find") }] : []),
      { id: "check", icon: "🚪", label: this.t("now_check"), hint: this.t("now_check_hint") },
      { id: "house", icon: "🏠", label: this.t("nav_house") },
      { id: "solo", icon: "🔎", label: this.t("nav_solo"), hint: this.t("nav_solo_hint"), pressed: this.solo },
      ...this.extras,
    ];
    const unit = tempUnit(hass);

    return html`${this.mode !== "bar"
        ? html`<fp3d-now-list
            class="list"
            .items=${items}
            .stops=${this.stops}
            .favorites=${favorites}
            .labels=${nowLabels}
            .mode=${this.mode}
            @now-mode=${(e: CustomEvent<NowMode>) => this.setMode(e.detail)}
            @now-go=${(e: CustomEvent<NowTarget>) => this.go(e.detail)}
            @now-act=${(e: CustomEvent<NowAction>) => this.act(e.detail)}
            @now-fav=${(e: CustomEvent<string>) => this.fav(e.detail)}
          ></fp3d-now-list>`
        : nothing}
      ${this.mode !== "check"
        ? html`<fp3d-phone-nav
            class="nav"
            .slots=${slots}
            .floors=${floors}
            .covers=${covers}
            .more=${more}
            .group=${this._sheet === "group" ? (groups[this.own] ?? null) : null}
            .labels=${navLabels}
            .sheet=${this._sheet}
            .floorId=${this._navFloor}
            .roomId=${this.roomId}
            .active=${active}
            .level=${summary.level}
            .attention=${summary.level > 0 && !this.roomId ? summary.text : ""}
            .unit=${(v: number) => `${formatNumber(hass, v, 1)}${unit === "°F" ? "°F" : "°"}`}
            @nav-slot=${(e: CustomEvent<string>) => this.tapSlot(e.detail, floors)}
            @nav-floor=${(e: CustomEvent<string>) => (this._navFloor = e.detail)}
            @nav-close=${() => (this._sheet = null)}
            @nav-room=${(e: CustomEvent<{ floorId: string; roomId: string | null }>) => {
              this._sheet = null;
              this.fire("phone-room", e.detail);
            }}
            @nav-cover=${(e: CustomEvent<{ entities: string[]; service: string }>) => callServiceSafe(hass, "cover", e.detail.service, { entity_id: e.detail.entities }, (error) => translate(hass, "service_failed", { error }))}
            @nav-group=${(e: CustomEvent<{ entities: string[]; on: boolean }>) => this.switchGroup(e.detail.entities, e.detail.on)}
            @nav-more=${(e: CustomEvent<string>) => this.tapMore(e.detail)}
          ></fp3d-phone-nav>`
        : nothing}`;
  }

  static styles = css`
    /* over the 3D view without taking its touches: only the bar, the sheets, the list and the card catch them */
    :host {
      position: absolute;
      inset: 0;
      z-index: 9;
      pointer-events: none;
    }
    .nav,
    .list {
      pointer-events: auto;
      position: absolute;
      left: 0;
      right: 0;
    }
    .nav {
      bottom: 0;
      z-index: 2;
    }
    .list[mode="page"] {
      top: 0;
      bottom: calc(64px + env(safe-area-inset-bottom, 0px));
      z-index: 1;
    }
    .list[mode="check"] {
      left: 8px;
      right: 8px;
      bottom: calc(8px + env(safe-area-inset-bottom, 0px));
    }
  `;
}

defineElement("fp3d-phone-shell", Fp3dPhoneShell);
