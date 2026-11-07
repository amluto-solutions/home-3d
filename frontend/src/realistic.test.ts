import assert from "node:assert/strict";
import { test } from "node:test";
import { deviceTier, NIGHT_SKY_LIGHT, realisticSky, shadowPlan, sunLight } from "./realistic.ts";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const PIXEL = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const GALAXY_TAB = "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const FIRE = "Mozilla/5.0 (Linux; Android 9; KFMUWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/124 like Chrome/124.0 Safari/537.36";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

test("phones are told apart from tablets and desktops", () => {
  assert.equal(deviceTier(IPHONE, 390, 5), "phone");
  assert.equal(deviceTier(PIXEL, 412, 5), "phone");
  assert.equal(deviceTier(GALAXY_TAB, 800, 10), "tablet");
  assert.equal(deviceTier(FIRE, 600, 10), "tablet");
  // iPadOS says it is a Mac; it has a touch screen
  assert.equal(deviceTier(IPAD, 820, 5), "tablet");
  assert.equal(deviceTier(WINDOWS, 1080, 0), "desktop");
  // a touch screen this small is a phone whatever it says
  assert.equal(deviceTier(WINDOWS, 360, 5), "phone");
  // a touch laptop stays a desktop
  assert.equal(deviceTier(WINDOWS, 1080, 10), "desktop");
});

test("shadows on tablets and desktops, none on phones or when the house turns them off", () => {
  assert.equal(shadowPlan("phone", false, true), null);
  assert.equal(shadowPlan("desktop", false, false), null);
  assert.deepEqual(shadowPlan("desktop", false, true), { size: 2048, soft: true, live: true });
  assert.deepEqual(shadowPlan("tablet", false, true), { size: 2048, soft: true, live: true });
  // the tablet level (old wall tablets): a smaller map, hard edges, drawn again only when something else than the camera moved
  assert.deepEqual(shadowPlan("tablet", true, true), { size: 1024, soft: false, live: false });
});

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

test("the sun light comes from where sun.sun says, turned with the plan's north", () => {
  // due south at 30°: from +z in the scene (south is down the plan), half way up
  const south = sunLight({ azimuth: 180, elevation: 30 }, 0, 0);
  assert.ok(near(south.dir[0], 0) && near(south.dir[1], 0.5) && near(south.dir[2], Math.sqrt(3) / 2), String(south.dir));
  // due east on the horizon: from +x
  const east = sunLight({ azimuth: 90, elevation: 0 }, 0, 0);
  assert.ok(near(east.dir[0], 1) && near(east.dir[1], 0) && near(east.dir[2], 0), String(east.dir));
  // a plan turned so north points right: the south sun now comes from the left
  const turned = sunLight({ azimuth: 180, elevation: 0 }, 0, 90);
  assert.ok(near(turned.dir[0], -1) && near(turned.dir[2], 0), String(turned.dir));
});

test("no sunlight at night, less under clouds, warmer when the sun is low", () => {
  const noon = sunLight({ azimuth: 180, elevation: 50 }, 0, 0);
  const night = sunLight({ azimuth: 0, elevation: -12 }, 0, 0);
  const overcast = sunLight({ azimuth: 180, elevation: 50 }, 1, 0);
  const evening = sunLight({ azimuth: 280, elevation: 3 }, 0, 0);
  assert.equal(night.sun, 0);
  assert.ok(night.sky > 0, "the moon and the street keep the house visible");
  assert.ok(noon.sun > overcast.sun * 3);
  assert.ok(noon.shadow > overcast.shadow);
  assert.ok(evening.sun < noon.sun && evening.sun > 0);
  // red over blue: the evening light is warmer than noon's
  assert.ok(evening.color[0] / evening.color[2] > noon.color[0] / noon.color[2] + 0.2);
  // and no sun.sun at all: an even daylight without a sun
  const none = sunLight(null, 0, 0);
  assert.equal(none.sun, 0);
  assert.ok(none.sky >= noon.sky);
});

const lum = (c: readonly number[]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const sat = (c: readonly number[]) => (Math.max(...c) - Math.min(...c)) / Math.max(...c);
const dry = { cloud: 0, rain: 0, snow: 0, fog: 0 };

test("the sky follows the weather entity", () => {
  const clear = realisticSky(45, dry);
  const cloudy = realisticSky(45, { ...dry, cloud: 0.9 });
  const pouring = realisticSky(45, { ...dry, cloud: 1, rain: 1 });
  const foggy = realisticSky(45, { ...dry, cloud: 0.6, fog: 1 });
  const snowy = realisticSky(45, { ...dry, cloud: 0.9, snow: 0.8 });
  // a clear day is blue, a cloudy one grey, rain darkens it
  assert.ok(clear.top[2] > clear.top[0] + 60, String(clear.top));
  assert.ok(sat(cloudy.top) < sat(clear.top) / 2, String(cloudy.top));
  assert.ok(lum(pouring.top) < lum(cloudy.top) - 20, String(pouring.top));
  // fog: the sky is one pale grey from top to horizon
  assert.ok(Math.abs(lum(foggy.top) - lum(foggy.horizon)) < 12, `${foggy.top} ${foggy.horizon}`);
  // snow lies on the ground
  assert.ok(lum(snowy.ground) > 200, String(snowy.ground));
  assert.ok(lum(clear.ground) < 140, String(clear.ground));
});

test("the sky darkens at night and glows warm at sunset", () => {
  const night = realisticSky(-20, dry);
  assert.ok(lum(night.top) < 30 && lum(night.horizon) < 50, `${night.top} ${night.horizon}`);
  const sunset = realisticSky(1, dry);
  assert.ok(sunset.horizon[0] > sunset.horizon[2] + 40, String(sunset.horizon));
  // under thick cloud there is no glow
  const grey = realisticSky(1, { ...dry, cloud: 1 });
  assert.ok(grey.horizon[0] - grey.horizon[2] < 20, String(grey.horizon));
  // without sun.sun or a weather entity: a clear day
  assert.deepEqual(realisticSky(null, null), realisticSky(90, dry));
});

test("the Realistic look keeps a night minimum: the sky light and the lawn stay readable (#194)", () => {
  const night = sunLight({ azimuth: 0, elevation: -30 }, 0, 0);
  const day = sunLight({ azimuth: 0, elevation: 50 }, 0, 0);
  // night is at least two thirds of the day's sky light, so lit floors and furniture are not black
  assert.ok(night.sky >= NIGHT_SKY_LIGHT && night.sky >= day.sky * 0.6, `${night.sky} vs ${day.sky}`);
  // the day itself is unchanged by the floor
  assert.ok(Math.abs(day.sky - 1.1) < 1e-9, String(day.sky));
  // a hemisphere-lit wooden floor at night against the night lawn: 3:1 by relative luminance, as the lit floor shows it
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const lum = (rgb: number[]) => 0.2126 * lin(rgb[0] / 255) + 0.7152 * lin(rgb[1] / 255) + 0.0722 * lin(rgb[2] / 255);
  const wood = [0x8a, 0x5a, 0x36].map((v) => (v / 255) * night.sky);
  const lawn = realisticSky(-30, null).ground;
  const lit = 0.2126 * lin(Math.min(1, wood[0])) + 0.7152 * lin(Math.min(1, wood[1])) + 0.0722 * lin(Math.min(1, wood[2]));
  const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert.ok(ratio(lit, lum(lawn)) >= 1.5, `${ratio(lit, lum(lawn)).toFixed(2)}`);
  assert.ok(lum(lawn) > lum([13, 17, 10]), "the night lawn is lighter than it was");
});
