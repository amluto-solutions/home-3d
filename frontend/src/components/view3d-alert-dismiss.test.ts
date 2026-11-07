import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, type Building } from "../model.ts";
import type { HomeAssistant } from "../types.ts";
import type { Alert } from "../alerts.ts";

// the view's 3D bundle and lazy chunks read their hashes from build-time constants
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = await import("./view3d.ts");

// spent "for now" dismissals leave the plan (tidying only) – written by an editor's live view only (#138)

const ENTITY = "binary_sensor.sample_window";
const contact: Alert = { kind: "contact_unavailable", entity: ENTITY, roomId: "k", floorId: "f" };

type View = {
  building: Building;
  hass: HomeAssistant;
  canEdit?: boolean;
  replay: unknown;
  tidySnoozes(b: Building, active: Alert[], modulesOn: boolean): void;
  dismiss(a: Alert, forGood: boolean): void;
};

function view(state: string, canEdit: boolean, replay: unknown = null) {
  const saved: Building[] = [];
  const b = emptyBuilding();
  b.settings.alert_snoozed = [{ kind: "contact_unavailable", entity: ENTITY, at: 1000 }];
  const hass = {
    language: "en",
    user: { is_admin: true },
    states: { [ENTITY]: { entity_id: ENTITY, state, attributes: {} } },
    // the view's own save goes through the controller (#363): it loads the plan, then saves from its revision
    callWS: async (msg: { type: string; building: Building }) => {
      if (msg.type === "home_3d/building/get") return { building: structuredClone(b), revision: 1, can_edit: true };
      if (msg.type === "home_3d/history/snapshot") return null;
      saved.push(msg.building);
      return { revision: 2 };
    },
  } as unknown as HomeAssistant;
  const el = new Fp3dView3d() as unknown as View;
  Object.assign(el, { hass, building: b, canEdit, replay });
  return { el, hass, b, saved };
}

const settle = () => new Promise((r) => setTimeout(r, 20));

test("an editor's view takes a cleared warning's snooze out of the plan", async () => {
  const { el, b, saved } = view("off", true);
  el.tidySnoozes(b, [], false);
  await settle();
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].settings.alert_snoozed, []);
  assert.deepEqual(el.building.settings.alert_snoozed, []);
});

test("while the warning stands nothing is written", () => {
  const { el, b, saved } = view("unavailable", true);
  el.tidySnoozes(b, [{ ...contact, since: 500 }], false);
  assert.equal(saved.length, 0);
});

test("a view without edit rights never writes", () => {
  const { el, b, saved } = view("off", false);
  el.tidySnoozes(b, [], false);
  assert.equal(saved.length, 0);
});

test("time travel never writes", () => {
  const { el, b, saved } = view("off", true, { t: 0 });
  el.tidySnoozes(b, [], false);
  assert.equal(saved.length, 0);
});

test("a module's warning is kept snoozed while the modules do not report", () => {
  const { el, b, saved } = view("off", true);
  b.settings.alert_snoozed = [{ kind: "pool_ph", entity: ENTITY, at: 1 }];
  el.tidySnoozes(b, [], false);
  assert.equal(saved.length, 0);
});

test("dismissing from the banner saves the choice; a viewer without edit rights cannot", async () => {
  const { el, saved } = view("unavailable", true);
  el.building.settings.alert_snoozed = [];
  el.dismiss(contact, true);
  await settle();
  assert.deepEqual(saved.at(-1)?.settings.alert_ignored, [{ kind: "contact_unavailable", entity: ENTITY }]);
  const ro = view("unavailable", false);
  ro.el.dismiss(contact, false);
  assert.equal(ro.saved.length, 0);
});
