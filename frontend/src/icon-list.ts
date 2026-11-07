// The icon names the fallback icon picker offers (#327). Home Assistant's frontend serves the full Material Design list
// (name + keywords) at /static/mdi/iconList.json; when that cannot be read (an older or newer frontend, offline) a
// short list of common names stands in, and a typed name always works. Pure functions: no DOM.

export interface IconEntry {
  name: string;
  keywords: string[];
}

/** Common icons for the fallback when the full list is not available. */
export const COMMON_ICONS: string[] = [
  "lightbulb", "lamp", "ceiling-light", "floor-lamp", "led-strip", "power", "power-plug", "power-socket-eu", "toggle-switch", "light-switch",
  "thermometer", "water-thermometer", "radiator", "fire", "snowflake", "fan", "air-conditioner", "air-filter", "water-percent", "water",
  "water-alert", "water-boiler", "shower", "toilet", "faucet", "pipe", "gas-cylinder", "flash", "flash-alert", "solar-power",
  "battery", "battery-charging", "ev-station", "car", "car-electric", "garage", "garage-open", "door", "door-open", "door-closed",
  "window-closed", "window-open", "blinds", "blinds-open", "curtains", "lock", "lock-open", "key", "shield-home", "bell",
  "bell-ring", "alarm-light", "cctv", "camera", "doorbell", "motion-sensor", "smoke-detector", "fire-alert", "alert", "information",
  "television", "speaker", "music", "play", "pause", "volume-high", "remote", "gamepad-variant", "router-wireless", "wifi",
  "bluetooth", "cellphone", "tablet", "laptop", "desktop-tower", "printer", "server", "nas", "home", "home-outline",
  "sofa", "bed", "table-furniture", "desk", "fridge", "stove", "microwave", "dishwasher", "washing-machine", "tumble-dryer",
  "coffee-maker", "kettle", "robot-vacuum", "broom", "trash-can", "flower", "tree", "pot-mix", "sprinkler", "weather-sunny",
  "weather-night", "weather-rainy", "weather-windy", "umbrella", "paw", "dog", "cat", "baby-carriage", "account", "human-greeting",
  "clock-outline", "calendar", "cog", "wrench", "hammer", "tools", "chart-line", "gauge", "information-outline", "help-circle",
];

/** Accepts "mdi:name" or "name"; returns the bare name or null. */
export function bareIconName(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().replace(/^mdi:/i, "");
  return s || null;
}

/** Entries of a downloaded list (name or {name, keywords}) in a safe shape; anything else is dropped. */
export function parseIconList(data: unknown): IconEntry[] {
  if (!Array.isArray(data)) return [];
  const out: IconEntry[] = [];
  for (const d of data) {
    if (typeof d === "string") out.push({ name: d, keywords: [] });
    else if (d && typeof d === "object" && typeof (d as { name?: unknown }).name === "string") {
      const kw = (d as { keywords?: unknown }).keywords;
      out.push({ name: (d as { name: string }).name, keywords: Array.isArray(kw) ? kw.filter((k): k is string => typeof k === "string") : [] });
    }
  }
  return out;
}

/** The entries that match every word of the search (in the name or a keyword), names starting with the search first; at most `limit`. */
export function filterIcons(list: IconEntry[], query: string, limit = 120): IconEntry[] {
  const words = query.toLowerCase().replace(/^mdi:/, "").split(/[\s-]+/).filter(Boolean);
  if (!words.length) return list.slice(0, limit);
  const q = words.join("-");
  const hits: { e: IconEntry; rank: number }[] = [];
  for (const e of list) {
    const name = e.name.toLowerCase();
    const hay = `${name} ${e.keywords.join(" ").toLowerCase()}`;
    if (!words.every((w) => hay.includes(w))) continue;
    hits.push({ e, rank: name === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : 3 });
  }
  hits.sort((a, b) => a.rank - b.rank);
  return hits.slice(0, limit).map((h) => h.e);
}
