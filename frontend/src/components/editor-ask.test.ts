// The editor asks in the app's own dialog (#59): destructive steps wait for the answer and only act on yes.

import assert from "node:assert/strict";
import { test } from "node:test";
import { setAskHost, type AskAnswer, type AskRequest } from "../ask.ts";
import type { Building } from "../model.ts";
import type { HomeAssistant } from "../types.ts";

for (const name of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${name}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dEditor } = await import("./editor.ts");

const floor = (id: string, rooms: unknown[] = []) => ({ id, name: id === "f" ? "Ground" : "Upper", elevation: 0, height: 2.5, rooms, walls: [], openings: [], placements: [], furniture: [], outdoor: [] });
const room = (id: string) => ({ id, name: id, points: [[0, 0], [4, 0], [4, 3], [0, 3]] });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function editor(building: unknown, answers: AskAnswer[]): { el: any; asked: AskRequest[] } {
  const asked: AskRequest[] = [];
  setAskHost({ ask: async (req) => (asked.push(req), answers.shift() ?? { ok: false, value: "" }) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = new Fp3dEditor() as any;
  el.hass = { language: "en", user: { is_admin: true }, states: {}, areas: {} } as unknown as HomeAssistant;
  el._doc = building as Building;
  el._floorId = "f";
  return { el, asked };
}

const yes = { ok: true, value: "" };
const no = { ok: false, value: "" };

test("deleting a floor asks in the app's dialog and deletes only on yes (#59)", async () => {
  const { el, asked } = editor({ version: 1, settings: { roof: {} }, floors: [floor("f"), floor("g")] }, [no, yes]);
  try {
    await el.deleteFloor();
    assert.equal(el._doc.floors.length, 2, "no keeps the floor");
    await el.deleteFloor();
    assert.deepEqual(
      el._doc.floors.map((f: { id: string }) => f.id),
      ["g"],
    );
    assert.equal(asked.length, 2);
    assert.match(asked[0].text, /Ground/);
    assert.equal(asked[0].danger, true, "a delete is shown as a warning");
  } finally {
    setAskHost(null);
  }
});

test("a fixed item is deleted only after the dialog says yes; a free one without asking (#59)", async () => {
  const item = (id: string, locked = false) => ({ id, type: "chair", x: 1, z: 1, width: 0.5, depth: 0.5, height: 0.9, rotation: 0, ...(locked ? { locked: true } : {}) });
  const f = { ...floor("f", [room("r")]), furniture: [item("a", true), item("b")] };
  const { el, asked } = editor({ version: 1, settings: { roof: {} }, floors: [f] }, [no, yes]);
  const ids = () => el._doc.floors[0].furniture.map((m: { id: string }) => m.id);
  try {
    el._furnitureId = "a";
    await el.deleteFurniture();
    assert.deepEqual(ids(), ["a", "b"]);
    el._furnitureId = "a";
    await el.deleteFurniture();
    assert.deepEqual(ids(), ["b"]);
    el._furnitureId = "b";
    await el.deleteFurniture();
    assert.deepEqual(ids(), []);
    assert.equal(asked.length, 2, "the free item is not asked about");
  } finally {
    setAskHost(null);
  }
});

test("restoring a restore point asks first; no sends nothing (#59)", async () => {
  const { el, asked } = editor({ version: 1, settings: { roof: {} }, floors: [floor("f")] }, [no]);
  const sent: unknown[] = [];
  el.hass.callWS = async (msg: unknown) => (sent.push(msg), { revision: 2, snapshots: [] });
  try {
    await el.restoreFromHistory({ id: "s1", time: "2026-10-30T10:00:00Z", revision: 1 });
    assert.equal(asked.length, 1);
    assert.deepEqual(sent, []);
  } finally {
    setAskHost(null);
  }
});
