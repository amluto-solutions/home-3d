import assert from "node:assert/strict";
import { test } from "node:test";
import { alertSources, clearedSnoozes, dismissAlert, findAlerts, mayIgnoreAlert, restoreAlert, shownAlerts, type AlertRef, type AlertSnooze } from "./alerts.ts";
import type { OpeningEntities } from "./devices.ts";
import { emptyBuilding, newFloor, type Opening } from "./model.ts";
import type { HomeAssistant } from "./types.ts";

// warnings dismissed from the 3D view's banner: for now (until the warning clears) or for good (#138)

const smoke = { kind: "smoke", entity: "binary_sensor.sample_smoke", roomId: "k", floorId: "f" };
const contact = { kind: "contact_unavailable", entity: "binary_sensor.sample_window", roomId: "k", floorId: "f" };
const rain = { kind: "window_rain", entity: "binary_sensor.sample_window", roomId: "k", floorId: "f" };
const alarm = { kind: "alarm", entity: "alarm_control_panel.sample", roomId: null, floorId: null };

test("smoke, CO, gas, water and the alarm may only be dismissed for now; the rest for good too", () => {
  for (const kind of ["smoke", "co", "gas", "water", "alarm", "alarm_pending"]) assert.equal(mayIgnoreAlert(kind), false, kind);
  for (const kind of ["contact_unavailable", "window_rain", "power_outage", "fridge_door", "pool_ph"]) assert.equal(mayIgnoreAlert(kind), true, kind);
});

test("without dismissals every warning shows", () => {
  const all = [smoke, contact];
  assert.equal(shownAlerts(all, {}), all);
  assert.equal(shownAlerts(all, { alert_snoozed: [], alert_ignored: [] }), all);
});

test("for now: the warning is hidden while it stands", () => {
  const settings = dismissAlert({}, contact, false, 1000);
  assert.deepEqual(settings, { alert_snoozed: [{ kind: "contact_unavailable", entity: contact.entity, at: 1000 }], alert_ignored: [] });
  assert.deepEqual(shownAlerts([smoke, contact], settings), [smoke]);
  // only that kind for that entity: the same window in the rain still warns
  assert.deepEqual(shownAlerts([contact, rain], settings), [rain]);
});

test("for good: the entity never raises that kind of warning again, until restored", () => {
  const settings = dismissAlert({}, contact, true, 1000);
  assert.deepEqual(settings, { alert_snoozed: [], alert_ignored: [{ kind: "contact_unavailable", entity: contact.entity }] });
  assert.deepEqual(shownAlerts([contact, rain], settings), [rain]);
  // a snooze of the same warning is replaced, not kept beside it
  const both = dismissAlert(dismissAlert({}, contact, false, 5), contact, true, 6);
  assert.deepEqual(both.alert_snoozed, []);
  assert.equal(both.alert_ignored?.length, 1);
  // undo from the settings
  const restored = restoreAlert(settings.alert_ignored, contact);
  assert.deepEqual(restored, []);
  assert.deepEqual(shownAlerts([contact], { alert_ignored: restored }), [contact]);
});

test("a safety warning is dismissed for now even when asked for good, and an ignored entry for one never hides it", () => {
  const settings = dismissAlert({}, smoke, true, 1000);
  assert.deepEqual(settings.alert_ignored, []);
  assert.deepEqual(settings.alert_snoozed, [{ kind: "smoke", entity: smoke.entity, at: 1000 }]);
  // a plan edited by hand: smoke and the alarm still warn
  const forged: AlertRef[] = [{ kind: "smoke", entity: smoke.entity }, { kind: "alarm", entity: alarm.entity }];
  assert.deepEqual(shownAlerts([smoke, alarm], { alert_ignored: forged }), [smoke, alarm]);
});

test("for now hides the same activation; a snooze stamped before the warning began never hides it", () => {
  const at = 1000;
  const snoozed: AlertSnooze[] = [{ kind: "contact_unavailable", entity: contact.entity, at }];
  assert.deepEqual(shownAlerts([{ ...contact, since: 900 }], { alert_snoozed: snoozed }), []);
  assert.deepEqual(shownAlerts([{ ...contact, since: at }], { alert_snoozed: snoozed }), []);
  const later = { ...contact, since: 1001 };
  assert.deepEqual(shownAlerts([later], { alert_snoozed: snoozed }), [later]);
  // a warning without a time of its own (a module's) stays hidden until the entry is tidied
  const pool = { kind: "pool_ph", entity: "sensor.sample_ph", roomId: null, floorId: null };
  assert.deepEqual(shownAlerts([pool], { alert_snoozed: [{ ...pool, at }] }), []);
});

/** The house's warnings as a fresh screen computes them from Home Assistant's states. */
function evaluate(states: Record<string, { state: string; changed: string; cls?: string }>) {
  const hass = {
    language: "en",
    areas: { k: { area_id: "k", name: "Kitchen" } },
    entities: Object.fromEntries(Object.keys(states).map((id) => [id, { entity_id: id, area_id: "k" }])),
    states: Object.fromEntries(Object.entries(states).map(([id, s]) => [id, { entity_id: id, state: s.state, last_changed: s.changed, attributes: { device_class: s.cls } }])),
  } as unknown as HomeAssistant;
  const b = emptyBuilding();
  const floor = newFloor("f", "Ground", 0);
  floor.rooms = [{ id: "k", name: "Kitchen", area_id: "k", points: [[0, 0], [4, 0], [4, 3], [0, 3]], floor_material: "tiles" }];
  const win: Opening = { id: "w", room_id: "k", edge: 0, offset: 2, width: 1.2, type: "window", sill: 0.9, height: 1.3, hinge: "left", leaves: 1, swing: "in", cover: null, contact: contact.entity, contact2: null, tilt: null };
  floor.openings = [win];
  b.floors = [floor];
  b.settings.alert_unavailable = true;
  const links = new Map<string, OpeningEntities>([["w", { cover: null, contact: contact.entity, tilt: null }]]);
  return { b, alerts: findAlerts(hass, b, alertSources(hass, b), links) };
}

test("a snoozed warning that went off and on again while nothing watched shows on a fresh evaluation", () => {
  // dismissed for now at 10:05 while the contact had been unavailable since 09:00
  const first = evaluate({ [contact.entity]: { state: "unavailable", changed: "2026-10-30T09:00:00Z", cls: "window" } });
  assert.equal(first.alerts.length, 1);
  const settings = dismissAlert({}, first.alerts[0], false, Date.parse("2026-10-30T10:05:00Z"));
  assert.deepEqual(shownAlerts(first.alerts, settings), []);
  // later: it reported again at 11:00 and went unavailable again at 12:00; no screen was open in between
  const again = evaluate({ [contact.entity]: { state: "unavailable", changed: "2026-10-30T12:00:00Z", cls: "window" } });
  assert.deepEqual(shownAlerts(again.alerts, settings).map((a) => a.kind), ["contact_unavailable"]);
  assert.equal(clearedSnoozes(settings.alert_snoozed, again.alerts).length, 1);
});

test("a snoozed smoke alarm that fires again shows on a fresh evaluation", () => {
  const id = smoke.entity;
  const first = evaluate({ [id]: { state: "on", changed: "2026-10-30T09:00:00Z", cls: "smoke" } });
  assert.deepEqual(first.alerts.map((a) => a.kind), ["smoke"]);
  const settings = dismissAlert({}, first.alerts[0], false, Date.parse("2026-10-30T09:01:00Z"));
  assert.deepEqual(shownAlerts(first.alerts, settings), []);
  // still the same activation a while later: still hidden
  assert.deepEqual(shownAlerts(evaluate({ [id]: { state: "on", changed: "2026-10-30T09:00:00Z", cls: "smoke" } }).alerts, settings), []);
  // off at 09:30, on again at 14:00, nobody watching: it shows
  const again = evaluate({ [id]: { state: "on", changed: "2026-10-30T14:00:00Z", cls: "smoke" } });
  assert.deepEqual(shownAlerts(again.alerts, settings).map((a) => a.kind), ["smoke"]);
});

test("a dismissal from a screen whose clock runs behind still hides the warning it dismissed", () => {
  const settings = dismissAlert({}, { ...smoke, since: 5000 }, false, 4000);
  assert.deepEqual(shownAlerts([{ ...smoke, since: 5000 }], settings), []);
});

test("tidying: a snooze goes once its warning is gone or fired again, and stays while the same one stands", () => {
  const snoozed: AlertSnooze[] = [{ kind: "smoke", entity: smoke.entity, at: 1000 }];
  assert.deepEqual(clearedSnoozes(snoozed, [{ ...smoke, since: 900 }]), []);
  assert.deepEqual(clearedSnoozes(snoozed, []), snoozed);
  assert.deepEqual(clearedSnoozes(snoozed, [{ ...smoke, since: 2000 }]), snoozed);
  assert.deepEqual(clearedSnoozes(undefined, []), []);
});
