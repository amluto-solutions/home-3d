// The home indicator (#296): the header shows a chip only while this view shows a home that is not the one on the
// displays (#57); everything else about homes is on the Settings Homes page (settings/homes.test.ts).

import assert from "node:assert/strict";
import { test } from "node:test";
import type { HomeAssistant } from "../types.ts";
import { Fp3dHomeSwitcher, homeChip } from "./home-switcher.ts";

const HOMES = [
  { id: "home", name: "Home", revision: 1, floors: 1, rooms: 3, furniture: 10 },
  { id: "flat", name: "Flat", revision: 1, floors: 1, rooms: 0, furniture: 0 },
];

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Every string and value of a lit template, flattened into one text. */
function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return String(v);
}

async function indicator(home: string) {
  const hass = { language: "en", callWS: async () => ({ homes: HOMES, active: "home" }) } as unknown as HomeAssistant;
  const el = new Fp3dHomeSwitcher() as unknown as Record<string, any>;
  el.hass = hass;
  el.home = home;
  el.willUpdate(new Map());
  await tick();
  return el;
}

test("the chip names the shown home only while it is not the one on the displays (#57, #296)", () => {
  assert.equal(homeChip(HOMES, "home", "home"), null);
  assert.deepEqual(homeChip(HOMES, "home", "flat"), { name: "Flat" });
  assert.equal(homeChip(HOMES, "home", "gone"), null);
});

test("nothing shows in the header on the active home; another home shows an amber chip that opens Settings, Homes (#296)", async () => {
  const el = await indicator("home");
  assert.equal(flat(el.render()), "");
  const other = await indicator("flat");
  const shown = other.render() as { values: unknown[] };
  assert.match(flat(shown), /class="chip"[^]*<span class="name">Flat<\/span>[^]*Not on displays/);
  const heard: string[] = [];
  (other as unknown as EventTarget).addEventListener("home-settings", () => heard.push("settings"));
  // the click handler is the template's own function value
  const click = shown.values.find((v) => typeof v === "function") as () => void;
  click.call(other);
  assert.deepEqual(heard, ["settings"]);
});
