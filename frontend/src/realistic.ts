// The realistic look (#39): lit surfaces, the sun from sun.sun with moving shadows, and a sky that follows the weather
// entity. The numbers live here, apart from three.js, so both bundles can use them and they can be tested.

export type DeviceTier = "phone" | "tablet" | "desktop";

/**
 * What kind of device shows the view, from its user agent, the short side of its screen (CSS px) and its touch
 * points. Phones stay light in the realistic look (no shadows); tablets and desktops get them.
 */
export function deviceTier(ua: string, shortSide: number, touchPoints: number): DeviceTier {
  if (/\b(iPhone|iPod)\b/.test(ua) || (/Android/.test(ua) && /\bMobile\b/.test(ua))) return "phone";
  if (touchPoints > 0 && shortSide > 0 && shortSide < 600) return "phone";
  // iPadOS reports a Mac with a touch screen
  if (/\biPad\b/.test(ua) || /Android|\bSilk\b/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return "tablet";
  return "desktop";
}

/** How the sun's shadows are drawn: the shadow map's size, soft edges, and whether it is drawn every frame. */
export interface ShadowPlan {
  size: number;
  soft: boolean;
  /** False: the map is drawn again only when something other than the camera moved (the sun, a door, a floor). */
  live: boolean;
}

/**
 * The shadows for a device: none on phones or with the house's sun shadow switched off (⚙ House); on the tablet level
 * (`low`, old wall tablets) a small hard-edged map that is only redrawn when the scene changes.
 */
export function shadowPlan(tier: DeviceTier, low: boolean, enabled: boolean): ShadowPlan | null {
  if (tier === "phone" || !enabled) return null;
  return low ? { size: 1024, soft: false, live: false } : { size: 2048, soft: true, live: true };
}

export interface SunLight {
  /** Unit vector from the house towards the sun, in scene coordinates (x right, y up, z south on an unturned plan). */
  dir: [number, number, number];
  /** Strength of the direct sunlight (0 at night). */
  sun: number;
  /** Its colour, 0…1 (warm when the sun is low). */
  color: [number, number, number];
  /** Strength of the light from the whole sky (never 0, so the house stays visible at night). */
  sky: number;
  /** How dark the shadows are (0 none … 1 full), lighter under clouds. */
  shadow: number;
}

const RAD = Math.PI / 180;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix3 = (a: readonly number[], b: readonly number[], t: number) => a.map((v, i) => v + (b[i] - v) * t) as [number, number, number];

/**
 * The sky light left at night (#194): the Realistic look at night was near black, furniture and lamps vanished. With this the
 * lit floors and walls stay readable by moonlight and street light (the day's strength is unchanged).
 */
export const NIGHT_SKY_LIGHT = 0.75;

/** The share of the lawn's daylight colour kept at night (#194; the lawn was almost black at 0.15). */
export const NIGHT_GROUND = 0.3;

/** The sunlight for a sun.sun position (degrees, azimuth clockwise from north), the cloud cover 0…1 and the plan's north. */
export function sunLight(sun: { azimuth: number; elevation: number } | null, cloud: number, north: number): SunLight {
  if (!sun) return { dir: [0, 1, 0], sun: 0, color: [1, 1, 1], sky: 1.6, shadow: 0 };
  const c = clamp01(cloud);
  const a = (north + sun.azimuth) * RAD;
  const e = Math.max(0, sun.elevation) * RAD;
  const dir: [number, number, number] = [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
  // the sun comes up over the first 10° and loses most of its strength behind clouds
  const up = clamp01(sun.elevation / 10);
  const strength = 2.6 * up * (1 - 0.75 * c);
  // day from 6° below the horizon (civil twilight) to 6° above; a dim moonlit sky at night
  const day = clamp01((sun.elevation + 6) / 12);
  return {
    dir,
    sun: strength,
    color: mix3([1, 0.62, 0.38], [1, 0.96, 0.9], clamp01(sun.elevation / 20)),
    sky: NIGHT_SKY_LIGHT + day * (1.1 - NIGHT_SKY_LIGHT + 0.4 * c),
    shadow: strength > 0 ? 1 - 0.8 * c : 0,
  };
}

export interface SkyWeather {
  cloud: number;
  rain: number;
  snow: number;
  fog: number;
}

/** Sky and ground behind the house (0…255): the zenith, the horizon and the ground at the bottom of the stage. */
export interface RealisticSky {
  top: [number, number, number];
  horizon: [number, number, number];
  ground: [number, number, number];
}

const CLEAR = { top: [74, 140, 214], horizon: [178, 208, 234] };
const OVERCAST = { top: [148, 155, 164], horizon: [192, 197, 203] };
const NIGHT = { top: [8, 12, 26], horizon: [24, 32, 54] };
const GLOW = [244, 156, 104];
const FOG = [186, 190, 195];
const LAWN = [88, 112, 70];
const SNOW = [226, 231, 238];

/**
 * The sky for a sun elevation (degrees, null without sun.sun) and the weather (null without a weather entity): blue on a
 * clear day, grey under clouds and darker in rain, one pale grey in fog, a warm horizon at sunrise and sunset, dark at
 * night; the ground turns white under snow.
 */
export function realisticSky(elevation: number | null, weather: SkyWeather | null): RealisticSky {
  const w = weather ?? { cloud: 0, rain: 0, snow: 0, fog: 0 };
  const el = elevation ?? 90;
  const cloud = clamp01(w.cloud);
  const day = clamp01((el + 6) / 12);
  // the day's sky: clear to overcast, darker the harder it rains
  const wet = 1 - 0.32 * clamp01(w.rain);
  let top = mix3(CLEAR.top, OVERCAST.top, cloud).map((v) => v * wet) as [number, number, number];
  let horizon = mix3(CLEAR.horizon, OVERCAST.horizon, cloud).map((v) => v * wet) as [number, number, number];
  // a warm glow over the horizon while the sun is near it, gone under thick cloud
  const glow = clamp01(1 - Math.abs(el - 1) / 7) * (1 - cloud);
  horizon = mix3(horizon, GLOW, glow * 0.85);
  top = mix3(top, [92, 112, 168], glow * 0.4);
  // fog: everything one pale grey
  const fog = clamp01(w.fog);
  top = mix3(top, FOG, fog);
  horizon = mix3(horizon, FOG, fog);
  top = mix3(NIGHT.top, top, day);
  horizon = mix3(NIGHT.horizon, horizon, day);
  const lawn = mix3(LAWN, SNOW, clamp01(w.snow * 1.25));
  const ground = lawn.map((v) => v * (NIGHT_GROUND + (1 - NIGHT_GROUND) * day)) as [number, number, number];
  const round = (c: number[]) => c.map((v) => Math.round(v)) as [number, number, number];
  return { top: round(top), horizon: round(horizon), ground: round(ground) };
}
