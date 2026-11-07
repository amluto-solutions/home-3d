// The parts of the Home Assistant frontend object this integration uses.

/** Floor of Home Assistant's floor registry (hass.floors). */
export interface HassFloor {
  floor_id: string;
  name: string;
  level?: number | null;
}

export interface HassArea {
  area_id: string;
  name: string;
  floor_id?: string | null;
}

/** Entry of the entity registry as the frontend sees it (hass.entities). */
export interface HassEntityEntry {
  entity_id: string;
  name?: string | null;
  device_id?: string | null;
  area_id?: string | null;
  hidden?: boolean;
  /** Set when the full registry entry is at hand (the frontend's short entry only has `hidden`). */
  hidden_by?: string | null;
  disabled_by?: string | null;
  entity_category?: "config" | "diagnostic" | null;
  /** The integration that made it ("unifi", "nut" …). */
  platform?: string | null;
  /** The integration's key for the entity (e.g. "current_room"). */
  translation_key?: string | null;
  /** Decimals set for a sensor in Home Assistant (null = default). */
  display_precision?: number | null;
}

export interface HassDevice {
  id: string;
  area_id?: string | null;
  name?: string | null;
  name_by_user?: string | null;
  /** The maker and the model the integration reports ("Ubiquiti", "G4 Pro"). */
  manufacturer?: string | null;
  model?: string | null;
}

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed?: string;
  last_updated?: string;
}

export interface HassConnection {
  subscribeMessage<T>(callback: (msg: T) => void, msg: Record<string, unknown>): Promise<() => Promise<void>>;
  /** "ready" fires when the websocket is back after a disconnect (home-assistant-js-websocket). */
  addEventListener?(event: "ready" | "disconnected", cb: () => void): void;
  removeEventListener?(event: "ready" | "disconnected", cb: () => void): void;
}

export interface HomeAssistant {
  language: string;
  /** The profile's language and 12/24 hour choice (time_format: "language", "system", "12", "24"). */
  locale?: { language?: string; time_format?: string };
  user?: { id?: string; is_admin: boolean; name: string };
  areas?: Record<string, HassArea>;
  floors?: Record<string, HassFloor>;
  entities?: Record<string, HassEntityEntry>;
  devices?: Record<string, HassDevice>;
  states: Record<string, HassEntity>;
  config?: { unit_system?: { temperature?: string; length?: string }; latitude?: number; longitude?: number; time_zone?: string; currency?: string };
  /** The theme this device shows (HA works it out per browser): its name and whether it is in dark mode. */
  themes?: { darkMode?: boolean; theme?: string };
  connection: HassConnection;
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  /** `notifyOnError` false: Home Assistant shows no toast of its own when the call fails (we show one, #243). */
  callService(domain: string, service: string, data?: Record<string, unknown>, target?: Record<string, unknown>, notifyOnError?: boolean): Promise<unknown>;
}
