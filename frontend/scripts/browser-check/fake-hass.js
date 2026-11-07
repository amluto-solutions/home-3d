// A stand-in Home Assistant for the browser check (#178): the `hass` object the panel gets, with a websocket that
// answers the home_3d/* calls from one plan, about 5,000 states (the plan's own entities plus filler sensors, as in a
// big install) and `tick()`, which hands the panel a new hass with one state changed, as Home Assistant does.
// Nothing here talks to a real Home Assistant, and nothing is saved.

const FILLER = 4900;

/** A plausible state for an entity id the plan links. */
function stateFor(id, i) {
  const [domain, name] = id.split(".");
  const at = new Date(Date.UTC(2026, 0, 1, 12, 0, i % 60)).toISOString();
  const s = (state, attributes = {}) => ({ entity_id: id, state, attributes: { friendly_name: name.replace(/_/g, " "), ...attributes }, last_changed: at, last_updated: at });
  if (domain === "light") return s(i % 3 ? "off" : "on", { brightness: 180, color_mode: "brightness", supported_color_modes: ["brightness"] });
  if (domain === "climate") return s("heat", { current_temperature: 19.5, temperature: 20, hvac_modes: ["off", "heat"] });
  if (domain === "media_player") return s("off");
  if (domain === "camera") return s("idle", { entity_picture: "" });
  if (domain === "binary_sensor") return s("off");
  if (domain === "switch" || domain === "input_boolean") return s(i % 2 ? "off" : "on");
  if (domain === "sensor") {
    if (/temperature/.test(name)) return s("20.5", { unit_of_measurement: "°C", device_class: "temperature", state_class: "measurement" });
    if (/soc|battery$/.test(name)) return s("64", { unit_of_measurement: "%", device_class: "battery", state_class: "measurement" });
    if (/power/.test(name)) return s(String(100 + (i % 7) * 40), { unit_of_measurement: "W", device_class: "power", state_class: "measurement" });
    return s("online");
  }
  return s("on");
}

/** Every entity id a plan names (as the backend's sample.entity_ids does). */
function entityIds(plan) {
  const ids = new Set();
  const re = /(?<![\w.])(?:binary_sensor|camera|climate|cover|input_boolean|light|lock|media_player|person|sensor|switch|weather)\.[a-z0-9_]+/g;
  for (const m of JSON.stringify(plan).matchAll(re)) ids.add(m[0]);
  return [...ids].sort();
}

/**
 * Builds the fake. `plan`: the building; `build`: build.json ({ build, version }) so the panel sees a backend that
 * runs the same build.
 */
export function makeFakeHass(plan, build) {
  const linked = entityIds(plan);
  const states = {};
  linked.forEach((id, i) => (states[id] = stateFor(id, i)));
  const filler = [];
  for (let i = 0; i < FILLER; i++) {
    const id = `sensor.filler_${String(i).padStart(4, "0")}`;
    filler.push(id);
    states[id] = { entity_id: id, state: String(i % 100), attributes: { unit_of_measurement: "W" }, last_changed: "2026-01-01T12:00:00Z", last_updated: "2026-01-01T12:00:00Z" };
  }
  const entities = Object.fromEntries(linked.map((id) => [id, { entity_id: id, platform: "harness", name: null, device_id: null, area_id: null }]));
  const calls = [];
  const unknown = new Set();
  let revision = 1;
  // the websocket protocol of the backend of this release (#166: const.PROTOCOL, api.ts PROTOCOL)
  const protocol = 3;
  const answer = (msg) => {
    calls.push(msg.type);
    switch (msg.type) {
      case "home_3d/building/get":
        return { building: structuredClone(plan), revision, version: build.version, build: build.build, protocol, can_edit: true, home_id: "harness", home_name: "Harness home" };
      case "home_3d/version":
        return { version: build.version, build: build.build, protocol };
      case "home_3d/packs/list":
        return { packs: [] };
      case "home_3d/languages/get":
        return { language: msg.language, packs: [], hash: "harness", strings: {} };
      case "home_3d/packs/items":
        return { pack_id: msg.pack_id, hash: "harness", release: 1, items: [] };
      case "home_3d/packs/updates":
        return { settings: { auto_update: false, frequency: "weekly", time: "03:00", weekday: 0 }, last_check: null, packs: [], items: [] };
      case "home_3d/homes/list":
        return { homes: [{ id: "harness", name: "Harness home", revision, floors: plan.floors.length, rooms: 0, furniture: 0 }], active: "harness" };
      case "home_3d/editors/get":
        return { users: [], custom: false };
      case "home_3d/history/list":
        return { snapshots: [] };
      case "home_3d/building/save":
        // the check never keeps a plan: a save only moves the revision on, as the backend would
        revision++;
        return { revision };
      case "recorder/statistics_during_period":
        return {};
      case "home_3d/voice/settings":
        return { sentences: [] };
      default:
        unknown.add(msg.type);
        return {};
    }
  };
  const connection = {
    subscribeMessage: async () => async () => undefined,
    addEventListener() {},
    removeEventListener() {},
  };
  const hass = {
    language: "en",
    locale: { language: "en", number_format: "language", time_format: "24" },
    user: { id: "harness-user", is_admin: true, name: "Harness" },
    states,
    entities,
    devices: {},
    areas: {},
    floors: {},
    config: { unit_system: { temperature: "°C", length: "km" }, latitude: 51.5, longitude: -0.1, time_zone: "UTC", country: "GB", version: "2026.10.0" },
    themes: { darkMode: true, theme: "default" },
    connection,
    callWS: async (msg) => answer(msg),
    callService: async () => undefined,
  };
  let current = hass;
  let n = 0;
  return {
    get hass() {
      return current;
    },
    linked,
    filler,
    calls,
    unknown,
    /** A new hass with `id` (default: one filler sensor, which no plan links) at a new state. */
    tick(id) {
      n++;
      const which = id ?? filler[(n * 7919) % filler.length];
      const old = current.states[which];
      const value = old && !Number.isNaN(Number(old.state)) ? String(Number(old.state) + 1) : old?.state === "on" ? "off" : "on";
      const at = new Date().toISOString();
      current = { ...current, states: { ...current.states, [which]: { ...old, entity_id: which, state: value, last_changed: at, last_updated: at } } };
      return current;
    },
  };
}
