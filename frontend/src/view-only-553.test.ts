// A card with view_only shows everything and switches nothing (#553).

import assert from "node:assert/strict";
import { test } from "node:test";
import { viewOnlyHass } from "./kiosk.ts";
import type { HomeAssistant } from "./types.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = (await import("./components/view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };

function live() {
  const sent: string[] = [];
  const hass = {
    language: "en",
    states: { "light.sample": { entity_id: "light.sample", state: "on", attributes: {} } },
    entities: {},
    config: { unit_system: {} },
    callService: async (domain: string, service: string) => void sent.push(`${domain}.${service}`),
    callWS: async (msg: { type: string; service?: string }) => (sent.push(msg.service ? `${msg.type}:${msg.service}` : msg.type), "answer"),
  } as unknown as HomeAssistant;
  return { hass, sent };
}

test("view only: the card's Home Assistant reads everything and switches nothing; one copy per hass (#553)", async () => {
  const { hass, sent } = live();
  const ro = viewOnlyHass(hass);
  await ro.callService("light", "turn_off", { entity_id: "light.sample" });
  for (const type of ["call_service", "execute_script", "fire_event", "conversation/process", "home_3d/building/save", "home_3d/image/set"])
    assert.equal(await ro.callWS({ type, domain: "light", service: "turn_off" }), undefined, type);
  assert.deepEqual(sent, []);
  assert.equal(ro.states["light.sample"].state, "on");
  assert.equal(viewOnlyHass(hass), ro);
});

test("view only keeps the reads: the plan, history, the weather forecast and an answer to Assist (#553)", async () => {
  const { hass, sent } = live();
  const ro = viewOnlyHass(hass);
  for (const msg of [{ type: "home_3d/building/get" }, { type: "history/history_during_period" }, { type: "call_service", domain: "weather", service: "get_forecasts" }, { type: "home_3d/voice/answer" }])
    assert.equal(await ro.callWS(msg), "answer", msg.type);
  assert.equal(sent.length, 4);
});

test("view only: no question and no switching for a tap, a double tap or an own action (#553)", async () => {
  const { hass, sent } = live();
  const el = new Fp3dView3d();
  el.viewOnly = true;
  el.hass = viewOnlyHass(hass);
  let asked = 0;
  el.ask = async () => (asked++, true);
  el.confirmSet = new Set(["light.sample"]);
  assert.equal(await el.confirmFor("light.sample"), false);
  el.runOwnAction({ action: "toggle", confirm: true }, { entity: "light.sample" }, 0, 0);
  el.runOwnAction({ action: "perform_action", target: "light.turn_off", confirm: true }, { entity: "light.sample" }, 0, 0);
  el.runScene("scene.sample");
  assert.equal(el.onDeviceSwipe("light.sample", "start", 0, 0, 0), false);
  assert.equal(asked, 0);
  assert.deepEqual(sent, []);
});

test("without view only the same card asks and switches as before (#553)", async () => {
  const { hass, sent } = live();
  const el = new Fp3dView3d();
  el.hass = hass;
  el.ask = async () => true;
  el.confirmSet = new Set(["light.sample"]);
  assert.equal(await el.confirmFor("light.sample"), true);
  el.runScene("scene.sample");
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(sent, ["scene.turn_on"]);
});
