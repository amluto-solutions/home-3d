// The locating setup assistant: scanners into rooms, devices to track, the calibration walk, and a live check.
// Lab only for now. The texts are the main English table's loc_* keys and the language packs' (#217).

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing } from "lit";
import { translate, type I18nKey } from "../i18n.ts";
import type { Building } from "../model.ts";
import { callServiceSafe } from "../failure.ts";
import type { HomeAssistant } from "../types.ts";
import { locateRooms, roomAt, type LocateRoom } from "./graph.ts";

interface Scanner {
  offline?: boolean;
  source: string;
  name: string;
  kind: string;
  device_id: string | null;
  area_id: string | null;
  scanning: boolean;
}
interface Device {
  id: string;
  name: string;
  kind: "irk" | "ibeacon" | "mac";
  key: string;
  person: string | null;
  icon: string | null;
  notify?: string | null;
  wearable?: boolean;
}
interface Config {
  enabled: boolean;
  admins_only: boolean;
  /** false: no room sensor is created for a device that belongs to a person (default on) */
  person_sensors?: boolean;
  /** spoken questions fly the open views into the room (default on) */
  fly?: boolean;
  devices: Device[];
  scanner_rooms: Record<string, string>;
  scanners: Scanner[];
  bluetooth: boolean;
  private_ble: { title: string; key: string; named?: boolean }[];
  samples: Record<string, Record<string, number>>;
  scanner_hints: Record<string, string>;
}
interface Nearby {
  address: string;
  rssi: number;
  name: string | null;
  ibeacon: string | null;
  apple: boolean;
  random: boolean;
}
interface Live {
  running: boolean;
  devices: { id: string; name: string; room?: string | null; name_room?: string; probability?: number; last_seen?: number | null }[];
  calibration: { room: string; left: number; count: Record<string, number> } | null;
}
type Strip<K> = K extends `loc_${infer R}` ? R : never;
/** The setup's text names (the loc_ keys of the main table without the prefix). */
type LocKey = Strip<I18nKey>;
type Step = "scanners" | "devices" | "walk" | "live";

/** An IRK as 32 hex characters: pasted as hex (with or without separators) or as Base64 (as the Mac keychain shows it). */
export function irkHex(raw: string): string | null {
  const text = raw.trim().replace(/^irk:/i, "");
  const hex = text.replace(/[\s:-]/g, "");
  if (/^[0-9a-f]{32}$/i.test(hex)) return hex.toLowerCase();
  try {
    const bytes = atob(text.replace(/\s/g, ""));
    if (bytes.length === 16) return [...bytes].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  } catch {
    // not Base64
  }
  return null;
}

/** An Android phone's BLE Transmitter as the Home Assistant app reports it (a sensor of the phone's device). */
export interface AppTransmitter {
  entity: string;
  name: string;
  /** uuid + major + minor as hex, the way the backend keys iBeacons */
  key: string;
  state: string;
  power: string;
  mode: string;
  person: string | null;
}

// the app's sensor attribute "id": "<uuid>_<major>_<minor>"
const BEACON_ID = /^([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})_(\d{1,5})_(\d{1,5})$/i;

/** The BLE Transmitters of the Home Assistant Android app, found by their sensor: no need to hold the phone near a receiver. */
export function appTransmitters(hass: HomeAssistant): AppTransmitter[] {
  const out: AppTransmitter[] = [];
  const hex4 = (n: number) => n.toString(16).padStart(4, "0");
  for (const [entity, st] of Object.entries(hass.states)) {
    if (!entity.startsWith("sensor.")) continue;
    const a = st.attributes ?? {};
    if (!("Transmitting power" in a)) continue;
    const m = BEACON_ID.exec(String(a.id ?? ""));
    if (!m) continue;
    const major = Number(m[6]);
    const minor = Number(m[7]);
    if (major > 0xffff || minor > 0xffff) continue;
    const deviceId = hass.entities?.[entity]?.device_id ?? null;
    const device = deviceId ? hass.devices?.[deviceId] : undefined;
    const fallback = String(a.friendly_name ?? entity).replace(/\s*BLE[\s_-]*Transmitter\s*$/i, "");
    // the person whose device tracker sits on the same phone
    const person =
      (deviceId &&
        Object.entries(hass.states).find(
          ([id, p]) =>
            id.startsWith("person.") &&
            ((p.attributes?.device_trackers as string[] | undefined) ?? []).some((tr) => hass.entities?.[tr]?.device_id === deviceId),
        )?.[0]) ||
      null;
    out.push({
      entity,
      name: device?.name_by_user || device?.name || fallback,
      key: (m.slice(1, 6).join("") + hex4(major) + hex4(minor)).toLowerCase(),
      state: String(st.state),
      power: String(a["Transmitting power"] ?? ""),
      mode: String(a["Advertise mode"] ?? ""),
      person,
    });
  }
  return out.sort((x, y) => x.name.localeCompare(y.name));
}

export class LocateSetup extends LitElement {
  static properties = {
    hass: { attribute: false },
    building: { attribute: false },
    _step: { state: true },
    _cfg: { state: true },
    _near: { state: true },
    _live: { state: true },
    _quality: { state: true },
    _error: { state: true },
  };

  declare hass: HomeAssistant;
  declare building: Building;
  declare _step: Step;
  declare _cfg: Config | null;
  declare _near: Nearby[];
  declare _live: Live | null;
  declare _quality: Record<string, { overall: number | null; rooms: Record<string, number> }> | null;
  declare _error: string;

  constructor() {
    super();
    // reactive fields are declared, not initialised as class fields (that would hide Lit's accessors)
    this._step = "scanners";
    this._cfg = null;
    this._near = [];
    this._live = null;
    this._quality = null;
    this._error = "";
  }
  private timer = 0;
  /** Where the current Home Assistant state comes from (the panel's live hass): new devices and states show at once. */
  hassSource: (() => HomeAssistant | undefined) | null = null;
  /** Writes how people show in 3D into the plan (the editor's setter; null when opened elsewhere). */
  setLook: ((look: "figure" | "pin" | "off") => void) | null = null;
  private unsub: (() => void) | null = null;

  private get t(): Record<LocKey, string> {
    const hass = this.hass;
    return new Proxy({} as Record<LocKey, string>, { get: (_, key) => translate(hass, `loc_${String(key)}` as I18nKey) });
  }

  /** The voice sentences exist in English only. */
  private get voiceLanguage(): boolean {
    return /^en/.test(this.hass?.language ?? "en");
  }

  private tr(text: string, vars: Record<string, string | number>): string {
    return text.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? ""));
  }

  private get rooms(): LocateRoom[] {
    return locateRooms(this.building);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.closed = false;
    this.load().catch((e: unknown) => (this._error = `load: ${(e as Error)?.stack ?? String(e)}`));
    this.timer = window.setInterval(() => void this.tick(), 1000);
    void this.hass.connection
      .subscribeMessage<Live>((live) => (this._live = live), { type: "home_3d/locate/subscribe" })
      .then((u) => {
        // closed before the answer came: the server must not keep pushing to a dead element (#200)
        if (this.closed) u();
        else this.unsub = u;
      })
      .catch(() => undefined);
  }

  private closed = false;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.closed = true;
    window.clearInterval(this.timer);
    this.unsub?.();
    this.unsub = null;
  }

  /** `poll`: the 1 s refresh must not wipe the message of a failed save. */
  private async call<T>(msg: Record<string, unknown>, poll = false): Promise<T | null> {
    try {
      if (!poll) this._error = "";
      return await this.hass.callWS<T>(msg);
    } catch (e) {
      this._error = (e as { message?: string }).message ?? String(e);
      return null;
    }
  }

  private async load(): Promise<void> {
    const cfg = await this.call<Config>({ type: "home_3d/locate/config" });
    if (!cfg) return;
    // scanners not placed yet: the room of their device in the plan (a placed switch of a Shelly), else its area
    const rooms = { ...cfg.scanner_rooms };
    let guessed = false;
    for (const s of cfg.scanners) {
      if (rooms[s.source]) continue;
      const guess = this.guessRoom(s) ?? cfg.scanner_hints?.[s.source] ?? null;
      if (guess) {
        rooms[s.source] = guess;
        guessed = true;
      }
    }
    this._cfg = { ...cfg, scanner_rooms: rooms };
    if (guessed) await this.save({ scanner_rooms: rooms });
  }

  /**
   * The room a scanner most likely stands in: a pin or a piece of furniture of its device in the plan (a Shelly's
   * switch, the washing machine with the plug's power sensor), its Home Assistant area, or a room named in its name
   * ("Office PC plug", "bluetooth-proxy-kitchen"). After the calibration walk the signals tell as well (backend).
   */
  private guessRoom(s: Scanner): string | null {
    const ofDevice = (entity: unknown) => typeof entity === "string" && !!s.device_id && this.hass.entities?.[entity]?.device_id === s.device_id;
    if (s.device_id) {
      for (const f of this.building.floors) {
        for (const p of f.placements) {
          const room = ofDevice(p.entity_id) ? roomAt(this.building, f.id, p.x, p.z) : null;
          if (room) return room;
        }
        for (const m of f.furniture) {
          if (!Object.values(m).some(ofDevice)) continue;
          const room = roomAt(this.building, f.id, m.x, m.z);
          if (room) return room;
        }
      }
    }
    // the Home Assistant area of the scanner's device (found by name when the backend did not find it by address)
    const deviceId =
      s.device_id ?? Object.values(this.hass.devices ?? {}).find((d) => [d.name_by_user, d.name].some((n) => n && n.toLowerCase() === s.name.toLowerCase()))?.id ?? null;
    const entityAreas = deviceId ? Object.values(this.hass.entities ?? {}).filter((e) => e.device_id === deviceId && e.area_id).map((e) => e.area_id!) : [];
    const area = s.area_id ?? (deviceId ? this.hass.devices?.[deviceId]?.area_id : null) ?? entityAreas[0] ?? null;
    if (area) {
      const room = this.rooms.find((r) => r.area_id === area);
      if (room) return room.id;
    }
    const plain = (text: string) =>
      text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, " ");
    const name = ` ${plain(s.name)} `;
    const hits = this.rooms.filter((r) => plain(r.name).trim().length >= 3 && name.includes(plain(r.name).trim()));
    // the longest name wins ("bathroom" over "bath"); a name on two floors is no answer
    hits.sort((a, b) => plain(b.name).length - plain(a.name).length);
    if (hits.length && hits.filter((r) => plain(r.name) === plain(hits[0].name)).length === 1) return hits[0].id;
    return null;
  }

  /** Save settings. The service reads the rooms and doors from the active home's plan itself (#169), so they are not sent. */
  private async save(changes: Record<string, unknown>): Promise<void> {
    const cfg = await this.call<Config>({ type: "home_3d/locate/configure", ...changes });
    if (cfg) this._cfg = { ...cfg, scanner_rooms: { ...cfg.scanner_rooms } };
  }

  private async tick(): Promise<void> {
    const live = this.hassSource?.();
    if (live && live !== this.hass) this.hass = live;
    if (this._step === "devices" && this.nearOpen) {
      const res = await this.call<{ devices: Nearby[] }>({ type: "home_3d/locate/nearby" }, true);
      if (res) this._near = res.devices;
    }
    if (this._step === "walk") {
      // the countdown and the sample counts come from here (the live state only changes when a room changes)
      const res = await this.call<{ calibration: Live["calibration"]; samples: Config["samples"] }>({ type: "home_3d/locate/calibrate", action: "status" }, true);
      if (res && this._cfg) {
        this._cfg = { ...this._cfg, samples: res.samples };
        this._live = { ...(this._live ?? { running: true, devices: [] }), calibration: res.calibration };
      }
    }
  }

  protected render() {
    const t = this.t;
    const cfg = this._cfg;
    const steps: [Step, string][] = [
      ["scanners", t.s_scanners],
      ["devices", t.s_devices],
      ["walk", t.s_walk],
      ["live", t.s_live],
    ];
    return html`<div class="box" role="dialog" aria-label=${t.title}>
      <header>
        <b>📡 ${t.title}</b>
        <button class="x" @click=${() => this.remove()} aria-label=${t.close}>✕</button>
      </header>
      <nav>${steps.map(([s, label]) => html`<button class=${this._step === s ? "on" : ""} @click=${() => (this._step = s)}>${label}</button>`)}</nav>
      ${this._error ? html`<pre class="err">${this._error}</pre>` : nothing}
      ${!cfg ? html`<p>…</p>` : !cfg.bluetooth ? html`<p>${t.no_bt}</p>` : this.renderStep(cfg)}
    </div>`;
  }

  private renderStep(cfg: Config) {
    switch (this._step) {
      case "scanners":
        return this.renderScanners(cfg);
      case "devices":
        return this.renderDevices(cfg);
      case "walk":
        return this.renderWalk(cfg);
      default:
        return this.renderLive(cfg);
    }
  }

  private roomSelect(value: string | null, onPick: (room: string | null) => void) {
    const floors = [...new Set(this.rooms.map((r) => r.floor))];
    return html`<select @change=${(e: Event) => onPick((e.target as HTMLSelectElement).value || null)}>
      <option value="" ?selected=${!value}>${this.t.not_placed}</option>
      ${floors.map((f) => html`<optgroup label=${f}>${this.rooms.filter((r) => r.floor === f).map((r) => html`<option value=${r.id} ?selected=${r.id === value}>${r.name}</option>`)}</optgroup>`)}
    </select>`;
  }

  private renderScanners(cfg: Config) {
    const t = this.t;
    const covered = new Set(Object.values(cfg.scanner_rooms));
    const bare = this.rooms.filter((r) => !covered.has(r.id));
    return html`<p>${t.scanners_intro}</p>
      <ul class="list">
        ${cfg.scanners.map(
          (s) => html`<li>
            <span><b>${s.name}</b><small>${s.offline ? `⚠ ${t.offline}` : s.kind === "shelly" ? "Shelly" : s.kind === "esphome" ? "ESPHome" : "Bluetooth"}</small></span>
            ${this.roomSelect(cfg.scanner_rooms[s.source] ?? null, (room) => {
              const next = { ...cfg.scanner_rooms };
              if (room) next[s.source] = room;
              else delete next[s.source];
              void this.save({ scanner_rooms: next });
            })}
            ${cfg.scanner_hints?.[s.source] && cfg.scanner_hints[s.source] !== cfg.scanner_rooms[s.source]
              ? html`<button class="ghost" @click=${() => void this.save({ scanner_rooms: { ...cfg.scanner_rooms, [s.source]: cfg.scanner_hints[s.source] } })}>
                  ${this.tr(t.hint_room, { room: this.rooms.find((r) => r.id === cfg.scanner_hints[s.source])?.name ?? "" })}
                </button>`
              : nothing}
          </li>`,
        )}
      </ul>
      ${bare.length ? html`<p class="hint">${t.coverage} ${bare.map((r) => r.name).join(", ")}</p>` : nothing}
      <p class="end"><button class="primary" @click=${() => (this._step = "devices")}>${t.next} →</button></p>`;
  }

  private personSelect(value: string | null, onPick: (p: string | null) => void) {
    const persons = Object.keys(this.hass.states).filter((id) => id.startsWith("person."));
    return html`<select @change=${(e: Event) => onPick((e.target as HTMLSelectElement).value || null)}>
      <option value="" ?selected=${!value}>${this.t.person}: ${this.t.none}</option>
      ${persons.map((p) => html`<option value=${p} ?selected=${p === value}>${(this.hass.states[p].attributes.friendly_name as string) ?? p}</option>`)}
    </select>`;
  }

  /**
   * The Home 3D key helper (an ESP32 with irk-capture, see site/keys): found by its profile select ("Heart Sensor" /
   * "Keyboard"); its IRK sensor shows the key of the device that paired last.
   */
  private keyHelpers(): { name: string; select: string; option: string; irk: string | null; ours: boolean; refresh: string | null }[] {
    const out = [];
    for (const [id, st] of Object.entries(this.hass.states)) {
      const options = st.attributes.options;
      if (!id.startsWith("select.") || !Array.isArray(options) || !options.includes("Heart Sensor") || !options.includes("Keyboard")) continue;
      const device = this.hass.entities?.[id]?.device_id;
      const irkEntity = Object.values(this.hass.entities ?? {}).find((e) => e.device_id === device && /_irk$/.test(e.entity_id))?.entity_id;
      const raw = irkEntity ? this.hass.states[irkEntity]?.state : undefined;
      const entry = device ? (this.hass.devices?.[device] as { name?: string | null; name_by_user?: string | null; model?: string | null } | undefined) : undefined;
      const name = entry?.name_by_user || entry?.name || String(st.attributes.friendly_name ?? id);
      const refresh = Object.values(this.hass.entities ?? {}).find((e) => e.device_id === device && /_refresh_ble_identity$/.test(e.entity_id))?.entity_id ?? null;
      out.push({ name, select: id, option: st.state, irk: raw ? irkHex(raw) : null, ours: entry?.model === "home3d_key" || /home3d[ _]key/i.test(id), refresh });
    }
    // Home 3D's own helper first
    return out.sort((x, y) => Number(y.ours) - Number(x.ours));
  }

  /** Devices left out of the next calibration (not carried right now). */
  private notCarried = new Set<string>();
  /** The "Android phone or key tag" part is open: only then are nearby devices polled. */
  private nearOpen = false;

  /** The chosen key helper (several ESP32s with irk-capture can be in Home Assistant). */
  private helperId: string | null = null;
  /** Name and person for the next key the helper reads (typed before pairing). */
  private helperName = "";
  private helperPerson: string | null = null;
  private helperAdded: string | null = null;

  private renderKeyHelper(cfg: Config) {
    const t = this.t;
    const helpers = this.keyHelpers();
    const helper = helpers.find((h) => h.select === this.helperId) ?? helpers[0];
    const head = html`<div class="helper-head">
        <h4>${t.helper_title}</h4>
      </div>
      <p class="hint">${t.helper_pitch}</p>
      <p class="hint">${t.helper_android}</p>`;
    if (!helper) return head;
    const watch = helper.option === "Heart Sensor";
    const pick = (option: string) => callServiceSafe(this.hass, "select", "select_option", { entity_id: helper.select, option }, (error) => error);
    // the key in either byte order: whose is it? (a device of the list, or a Private BLE Device of Home Assistant)
    const flip = (hex: string) => hex.match(/../g)!.reverse().join("");
    const same = (k: string | null | undefined) => !!helper.irk && !!k && (k.toLowerCase() === helper.irk || k.toLowerCase() === flip(helper.irk));
    const owner = cfg.devices.find((d) => same(d.key))?.name ?? null;
    const privateOwner = cfg.private_ble.find((pb) => same(pb.key))?.title ?? null;
    const name = this.helperName || (watch ? "Apple Watch" : "iPhone");
    const short = (hex: string) => `${hex.slice(0, 4)}…${hex.slice(-4)}`;
    return html`${head}
      ${helpers.length > 1
        ? html`<p class="hint">
            <select
              @change=${(e: Event) => {
                this.helperId = (e.target as HTMLSelectElement).value;
                this.requestUpdate();
              }}
            >
              ${helpers.map((h) => html`<option value=${h.select} ?selected=${h.select === helper.select}>${h.name}</option>`)}
            </select>
          </p>`
        : html`<p class="hint">${this.tr(t.helper_found, { name: helper.name })}</p>`}
      <div class="row">
        <button class=${watch ? "on" : ""} @click=${() => pick("Heart Sensor")}>⌚ ${t.helper_watch}</button>
        <button class=${!watch ? "on" : ""} @click=${() => pick("Keyboard")}>📱 ${t.helper_phone}</button>
      </div>
      <div class="row">
        <input
          placeholder=${t.helper_name}
          title=${t.helper_name}
          .value=${this.helperName}
          @input=${(e: Event) => (this.helperName = (e.target as HTMLInputElement).value)}
        />
        ${this.personSelect(this.helperPerson, (pp) => {
          this.helperPerson = pp;
          this.requestUpdate();
        })}
      </div>
      <p class="hint">${watch ? t.helper_watch_steps : t.helper_phone_steps}</p>
      <ul class="list">
        <li>
          <span>
            <b>${t.helper_irk}</b>
            <small>${helper.irk ? short(helper.irk) : t.helper_wait}</small>
            ${owner || privateOwner ? html`<small>${this.tr(t.helper_belongs, { name: owner ?? privateOwner ?? "" })}</small>` : nothing}
          </span>
          ${helper.irk && !owner
            ? html`<button
                class="primary"
                @click=${() => {
                  this.addDevice(cfg, { name, kind: "irk", key: helper.irk! }, this.helperPerson);
                  this.helperAdded = name;
                  this.helperName = "";
                }}
              >
                ${this.tr(t.helper_add_as, { name })}
              </button>`
            : nothing}
        </li>
      </ul>
      ${this.helperAdded ? html`<p class="hint">${this.tr(t.helper_added, { name: this.helperAdded })}</p>` : nothing}
      <p class="hint">${t.helper_after}</p>
      ${helper.refresh
        ? html`<p class="end">
            <small>${t.helper_next_hint}</small>
            <button @click=${() => callServiceSafe(this.hass, "button", "press", { entity_id: helper.refresh }, (error) => error)}>${t.helper_next}</button>
          </p>`
        : nothing}`;
  }

  /** The Home Assistant app on a phone, to ring it ("Ring my iPhone"). */
  private notifySelect(value: string | null, onPick: (n: string | null) => void) {
    const all = (this.hass as unknown as { services?: Record<string, Record<string, unknown>> }).services;
    const services = Object.keys(all?.notify ?? {}).filter((s) => s.startsWith("mobile_app_"));
    if (!services.length) return nothing;
    return html`<select title=${this.t.ring_hint} @change=${(e: Event) => onPick((e.target as HTMLSelectElement).value || null)}>
      <option value="" ?selected=${!value}>🔔 ${this.t.ring}: ${this.t.none}</option>
      ${services.map((s) => html`<option value=${`notify.${s}`} ?selected=${value === `notify.${s}`}>🔔 ${s.replace(/^mobile_app_/, "").replace(/_/g, " ")}</option>`)}
    </select>`;
  }

  /** Step-by-step phone guide with a link to the official Home Assistant page ("android" or "iphone"). */
  private phoneGuide(kind: "android" | "iphone", open = false, only?: string) {
    const t = this.t;
    const android = kind === "android";
    const steps = android
      ? [t.guide_android_1, t.guide_android_2, t.guide_android_3, t.guide_android_4]
      : [t.guide_iphone_1, t.guide_iphone_2, t.guide_iphone_3, t.guide_iphone_4];
    const url = android ? "https://companion.home-assistant.io/docs/core/sensors/#bluetooth-sensors" : "https://www.home-assistant.io/integrations/private_ble_device/";
    return html`<details class="guide" ?open=${open}>
      <summary>${android ? t.guide_android_title : t.guide_iphone_title}</summary>
      <ol>
        ${steps.map((st) => html`<li class=${only && st !== only ? "dim" : ""}>${st}</li>`)}
      </ol>
      <a href=${url} target="_blank" rel="noopener noreferrer">${android ? t.guide_android_link : t.guide_iphone_link}</a>
    </details>`;
  }

  /** "not heard" next to a device while locating runs and no receiver hears it (an Android phone added by key, a
   * switched-off transmitter): learning with it would collect nothing. */
  private unheardBadge(id: string, kind?: string) {
    const live = this._live;
    if (!live?.running) return nothing;
    const d = live.devices.find((x) => x.id === id);
    if (!d || d.room || (d.last_seen && Date.now() / 1000 - d.last_seen < 120)) return nothing;
    return html`<small class="warn" title=${this.t.unheard_hint}>${this.t.unheard}</small>${this.phoneGuide(kind === "irk" ? "iphone" : "android")}`;
  }

  private addDevice(cfg: Config, device: Omit<Device, "id" | "person" | "icon">, person: string | null = null): void {
    const id = `${device.kind}_${device.key.replace(/[^a-z0-9]/gi, "").slice(-10).toLowerCase()}`;
    if (cfg.devices.some((d) => d.id === id)) return;
    void this.save({ devices: [...cfg.devices, { ...device, id, person, icon: null }] });
  }

  private renderDevices(cfg: Config) {
    const t = this.t;
    const has = (key: string) => cfg.devices.some((d) => d.key.toLowerCase() === key.toLowerCase());
    const setDevice = (id: string, patch: Partial<Device>) => void this.save({ devices: cfg.devices.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
    const apps = appTransmitters(this.hass);
    return html`<p>${t.devices_intro}</p>
      ${cfg.devices.length
        ? html`<ul class="list">
            ${cfg.devices.map(
              (d) => html`<li>
                <input .value=${d.name} @change=${(e: Event) => setDevice(d.id, { name: (e.target as HTMLInputElement).value })} />
                ${this.personSelect(d.person, (p) => setDevice(d.id, { person: p }))}
                ${this.notifySelect(d.notify ?? null, (n) => setDevice(d.id, { notify: n }))}
                <label class="row" title=${t.worn_hint}
                  ><input type="checkbox" .checked=${!!d.wearable} @change=${(e: Event) => setDevice(d.id, { wearable: (e.target as HTMLInputElement).checked })} />⌚
                  ${t.worn}</label
                >
                ${this.unheardBadge(d.id, d.kind)}
                <button @click=${() => void this.save({ devices: cfg.devices.filter((x) => x.id !== d.id) })}>${t.remove}</button>
              </li>`,
            )}
          </ul>`
        : nothing}
      ${apps.length
        ? html`<h4>📱 ${t.app_title}</h4>
            <ul class="list">
              ${apps.map((a) => {
                const warnings = [
                  a.state !== "Transmitting" ? { text: t.app_off, step: t.guide_android_2 } : null,
                  a.power === "ultraLow" || a.power === "low" ? { text: t.app_power, step: t.guide_android_3 } : null,
                  a.mode === "lowPower" ? { text: t.app_mode, step: t.guide_android_4 } : null,
                ].filter((w): w is { text: string; step: string } => !!w);
                return html`<li>
                  <span
                    ><b>${a.name}</b>${warnings.map((w) => html`<small class="warn">⚠ ${w.text}</small>`)}${warnings.length
                      ? this.phoneGuide("android", true, warnings[0].step)
                      : nothing}</span
                  >
                  ${has(a.key)
                    ? html`<small>${t.added}</small>`
                    : html`<button @click=${() => this.addDevice(cfg, { name: a.name, kind: "ibeacon", key: a.key }, a.person)}>${t.add}</button>`}
                </li>`;
              })}
            </ul>`
        : nothing}
      ${apps.length ? nothing : this.phoneGuide("android")}
      ${this.phoneGuide("iphone")}
      ${this.renderKeyHelper(cfg)}
      <details
        class="pbd"
        @toggle=${(e: Event) => {
          this.nearOpen = (e.target as HTMLDetailsElement).open;
        }}
      >
        <summary>📱 ${t.near_summary}</summary>
        <p class="hint">${t.near_intro}</p>
        ${apps.length ? nothing : html`<p class="hint">${t.app_none}</p>`}
        <ul class="list">
          ${(() => {
            // beacons first (the Android app sends weakly by default, so they count from -90 dBm), then what is held
            // close to a scanner; one row per beacon although its address rotates
            const seen = new Set<string>();
            const close = this._near
              .filter((n) => (n.ibeacon ? n.rssi >= -90 : !n.random && n.rssi >= -68))
              .sort((x, y) => Number(!!y.ibeacon) - Number(!!x.ibeacon) || y.rssi - x.rssi)
              .filter((n) => !n.ibeacon || (!seen.has(n.ibeacon) && !!seen.add(n.ibeacon)))
              .slice(0, 5);
            return close.length
              ? close.map(
                  (n) => html`<li>
                    <span><b>${n.ibeacon ? `📱 ${t.android_label}` : (n.name ?? n.address)}</b><small>${n.rssi} dBm</small></span>
                    ${has(n.ibeacon ?? n.address)
                      ? html`<small>${t.added}</small>`
                      : html`<button @click=${() => this.addDevice(cfg, n.ibeacon ? { name: t.android_label, kind: "ibeacon", key: n.ibeacon } : { name: n.name ?? n.address, kind: "mac", key: n.address })}>${t.add}</button>`}
                  </li>`,
                )
              : html`<li><small>${t.near_empty}</small></li>`;
          })()}
        </ul>
      </details>
      <details class="pbd">
        <summary>🔑 ${t.paste_summary}</summary>
      <div class="row">
        <input id="keyname" placeholder=${t.key_name} />
        <input id="keyvalue" placeholder=${t.key_value} spellcheck="false" autocomplete="off" />
        <button
          @click=${() => {
            const name = (this.renderRoot.querySelector("#keyname") as HTMLInputElement).value.trim();
            const key = irkHex((this.renderRoot.querySelector("#keyvalue") as HTMLInputElement).value);
            if (!key) {
              this._error = t.key_bad;
              return;
            }
            this._error = "";
            this.addDevice(cfg, { name: name || "iPhone", kind: "irk", key });
          }}
        >
          ${t.add}
        </button>
      </div>
      </details>
      <p class="hint">${t.irk_help}</p>
      <p class="end"><button class="primary" ?disabled=${!cfg.devices.length} @click=${() => (this._step = "walk")}>${t.next} →</button></p>`;
  }

  private renderWalk(cfg: Config) {
    const t = this.t;
    const cal = this._live?.calibration ?? null;
    if (!cfg.devices.length) return html`<p>${t.need_device}</p>`;
    // a room counts as learned when any device walked it (the others use those samples too)
    const count = (room: string) => Math.max(0, ...cfg.devices.map((d) => cfg.samples[d.id]?.[room] ?? 0));
    const floors = [...new Set(this.rooms.map((r) => r.floor))];
    const q = this._quality;
    return html`<p>${t.walk_intro}</p>
      ${cfg.devices.length > 1
        ? html`<div class="row">
            <b>${t.carry}</b>
            ${cfg.devices.map(
              (d) => html`<label class="row"
                ><input
                  type="checkbox"
                  .checked=${!this.notCarried.has(d.id)}
                  @change=${(e: Event) => {
                    if ((e.target as HTMLInputElement).checked) this.notCarried.delete(d.id);
                    else this.notCarried.add(d.id);
                    this.requestUpdate();
                  }}
                />
                ${d.name} ${this.unheardBadge(d.id)}</label
              >`,
            )}
          </div>`
        : nothing}
      ${cal
        ? html`<div class="learning">
            ${this.tr(t.learning, { room: this.rooms.find((r) => r.id === cal.room)?.name ?? "", left: cal.left })}
            <div class="bar"><i style="width:${Math.round(((90 - cal.left) / 90) * 100)}%"></i></div>
            <button @click=${() => void this.call({ type: "home_3d/locate/calibrate", action: "stop" })}>${t.stop}</button>
          </div>`
        : nothing}
      ${floors.map(
        (f) => html`<h4>${f}</h4>
          <div class="rooms">
            ${this.rooms
              .filter((r) => r.floor === f)
              .map((r) => {
                const n = count(r.id);
                const values = q && n > 0 ? cfg.devices.map((d) => q[d.id]?.rooms[r.id]).filter((v): v is number => typeof v === "number") : [];
                const acc = values.length ? Math.min(...values) : null;
                return html`<button
                  class=${cal?.room === r.id ? "on" : n >= 30 ? "done" : ""}
                  ?disabled=${!!cal}
                  @click=${async () => {
                    const devices = cfg.devices.filter((d) => !this.notCarried.has(d.id)).map((d) => d.id);
                    const res = await this.call<{ calibration: Live["calibration"] }>({ type: "home_3d/locate/calibrate", action: "start", room: r.id, seconds: 90, devices });
                    if (res) this._live = { ...(this._live ?? { running: true, devices: [] }), calibration: res.calibration };
                    // learning the first room switches locating on (one switch less to find)
                    if (res && !cfg.enabled) await this.save({ enabled: true });
                  }}
                >
                  ${n >= 30 ? "✓ " : ""}${r.name}<small>${this.tr(t.samples, { n })}${acc !== null ? ` · ${Math.round(acc * 100)} %` : ""}</small>
                </button>`;
              })}
          </div>`,
      )}
      <p class="end">
        <button @click=${async () => (this._quality = await this.call({ type: "home_3d/locate/quality" }))}>${t.quality}</button>
        ${q
          ? html`<b>${this.tr(t.quality_result, {
              p: cfg.devices.map((d) => `${d.name} ${q[d.id]?.overall != null ? Math.round(q[d.id].overall! * 100) : "–"} %`).join(" · "),
            })}</b>`
          : nothing}
        <button class="primary" @click=${() => (this._step = "live")}>${t.next} →</button>
      </p>
      <p class="end"><button class="ghost" @click=${() => void this.call({ type: "home_3d/locate/calibrate", action: "clear" }).then(() => this.load())}>${t.relearn_all}</button></p>`;
  }

  private renderLive(cfg: Config) {
    const t = this.t;
    const live = this._live;
    const name = (id: string | null | undefined) => this.rooms.find((r) => r.id === id)?.name;
    return html`<p>${t.live_intro}</p>
      ${this.voiceLanguage ? html`<p class="hint">${t.voice_hint}</p>` : nothing}
      <label class="row"><input type="checkbox" .checked=${cfg.enabled} @change=${(e: Event) => void this.save({ enabled: (e.target as HTMLInputElement).checked })} /> ${t.enabled}</label>
      <label class="row"><input type="checkbox" .checked=${cfg.admins_only} @change=${(e: Event) => void this.save({ admins_only: (e.target as HTMLInputElement).checked })} /> ${t.admins_only}</label>
      <label class="row" title=${t.person_sensors_hint}
        ><input type="checkbox" .checked=${cfg.person_sensors === false} @change=${(e: Event) => void this.save({ person_sensors: !(e.target as HTMLInputElement).checked })} /> ${t.person_sensors}</label
      >
      <label class="row" title=${t.fly_hint}
        ><input type="checkbox" .checked=${cfg.fly !== false} @change=${(e: Event) => void this.save({ fly: (e.target as HTMLInputElement).checked })} /> ${t.fly}</label
      >
      ${this.setLook
        ? html`<div class="row">
            <b>${t.look_title}</b>
            ${(["figure", "pin", "off"] as const).map(
              (look) => html`<button
                class=${(this.building.settings.person_look ?? "figure") === look ? "on" : ""}
                @click=${() => {
                  this.setLook?.(look);
                  this.building = { ...this.building, settings: { ...this.building.settings, person_look: look === "figure" ? null : look } };
                }}
              >
                ${look === "figure" ? t.look_figure : look === "pin" ? t.look_pin : t.look_off}
              </button>`,
            )}
          </div>`
        : nothing}
      <ul class="list big">
        ${(live?.devices ?? []).map(
          (d) => html`<li>
            <span><b>${d.name}</b></span>
            <span>${d.room ? html`<b class="room">${name(d.room)}</b> <small>${Math.round((d.probability ?? 0) * 100)} %</small>` : html`<small>${t.not_heard}</small>`}</span>
          </li>`,
        )}
      </ul>`;
  }

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      background: #02060fcc;
      font: 14px/1.4 system-ui, sans-serif;
      color: #e6f7ff;
    }
    .box {
      width: min(640px, calc(100vw - 16px));
      max-height: calc(100vh - 16px);
      overflow: auto;
      background: #0b1120;
      border: 1px solid #37e0ff66;
      border-radius: 14px;
      padding: 14px;
      box-shadow: 0 10px 40px #000a;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    header small {
      font-weight: 400;
      color: #ffb86b;
      margin-left: 6px;
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 10px 0;
    }
    button,
    select,
    input {
      font: inherit;
      color: #e6f7ff;
      background: #16233d;
      border: 1px solid #37e0ff44;
      border-radius: 8px;
      padding: 7px 10px;
    }
    button {
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    button.on,
    button.primary {
      background: #37e0ff;
      color: #04121c;
      font-weight: 700;
    }
    button.done {
      border-color: #5dd39e;
    }
    button.ghost {
      background: transparent;
    }
    .x {
      background: transparent;
      border: none;
      font-size: 18px;
    }
    .list {
      list-style: none;
      padding: 0;
      margin: 8px 0;
      display: grid;
      gap: 6px;
    }
    .list li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      background: #101a2e;
      border-radius: 10px;
      padding: 8px 10px;
    }
    .list li span {
      display: flex;
      flex-direction: column;
    }
    .list.big li {
      font-size: 16px;
    }
    small {
      opacity: 0.75;
      font-size: 12px;
    }
    .rooms {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .rooms button {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      min-width: 120px;
    }
    .learning {
      background: #13233f;
      border: 1px solid #37e0ff;
      border-radius: 10px;
      padding: 10px;
      margin: 8px 0;
      font-weight: 700;
    }
    .bar {
      height: 8px;
      background: #0b1120;
      border-radius: 4px;
      margin: 8px 0;
      overflow: hidden;
    }
    .bar i {
      display: block;
      height: 100%;
      background: #37e0ff;
    }
    .hint {
      opacity: 0.8;
      font-size: 13px;
    }
    details.guide {
      font-size: 13px;
      margin: 4px 0;
    }
    details.guide summary {
      cursor: pointer;
      opacity: 0.9;
    }
    details.guide ol {
      margin: 4px 0;
      padding-left: 20px;
    }
    details.guide li.dim {
      opacity: 0.65;
    }
    details.guide a {
      color: #37e0ff;
    }
    .warn {
      display: block;
      color: #ffb74d;
      font-size: 12px;
    }
    .end {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 6px 0;
    }
    .room {
      color: #37e0ff;
    }
    a {
      color: #37e0ff;
    }
    .helper-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    .helper-head h4 {
      margin: 0;
    }
    a.install {
      background: #37e0ff;
      color: #04121c;
      font-weight: 700;
      text-decoration: none;
      border-radius: 10px;
      padding: 8px 14px;
    }
    details.pbd summary {
      cursor: pointer;
      opacity: 0.85;
      margin: 8px 0;
    }
    .err {
      color: #ff8fa3;
      white-space: pre-wrap;
      font-size: 12px;
    }
    h4 {
      margin: 12px 0 4px;
    }
  `;
}

defineElement("fp3d-locate-setup", LocateSetup);
