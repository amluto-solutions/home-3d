// "Room on its own" in the phone view and the card's `rooms` (#500, ported from NeonPlan 3D 4.0.0, MIT, Mastershort; our
// own tests): which rooms the 3D view draws, the device's choice over the card's `phone_solo`, the More entry, the view
// cutting its plan, and the card and panel passing it on.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Room } from "./model.ts";
import { savedSolo, saveSolo, soloOn, viewRooms } from "./phone-solo.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const src = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("the view draws the room jumped into on its own only in the phone view with solo on; else the card's rooms", () => {
  assert.deepEqual(viewRooms({ phone: true, solo: true, roomId: "kids" }), ["kids"]);
  assert.deepEqual(viewRooms({ phone: true, solo: true, roomId: "kids", rooms: ["kids", "bath"] }), ["kids"]);
  assert.equal(viewRooms({ phone: true, solo: true, roomId: null }), null, "the house view stays whole");
  assert.equal(viewRooms({ phone: false, solo: true, roomId: "kids" }), null, "not without the phone view");
  assert.equal(viewRooms({ phone: true, solo: false, roomId: "kids" }), null);
  assert.deepEqual(viewRooms({ phone: false, solo: false, roomId: "kids", rooms: ["kids", "bath"] }), ["kids", "bath"]);
  assert.equal(viewRooms({ phone: false, solo: false, roomId: null, rooms: [] }), null);
});

test("the device's own choice wins over the card's phone_solo; until it has chosen, the card's counts", () => {
  assert.equal(soloOn(null, true), true);
  assert.equal(soloOn(null, undefined), false);
  assert.equal(soloOn(null, "yes"), false, "only true switches it on");
  assert.equal(soloOn(false, true), false);
  assert.equal(soloOn(true, false), true);
});

test("the choice is remembered per device under home3d.phone_solo, and storage that fails is no error", () => {
  const store = new Map<string, string>();
  const g = globalThis as Any;
  const before = g.localStorage;
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  try {
    assert.equal(savedSolo(), null);
    saveSolo(true);
    assert.equal(store.get("home3d.phone_solo"), "1");
    assert.equal(savedSolo(), true);
    saveSolo(false);
    assert.equal(savedSolo(), false);
    g.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    assert.equal(savedSolo(), null);
    assert.doesNotThrow(() => saveSolo(true));
  } finally {
    g.localStorage = before;
  }
});

test("More in the phone bar has 'Room on its own' as a switch; a tap asks the host for the other state", async () => {
  const { Fp3dPhoneShell } = await import("./components/phone-shell.ts");
  const el = new Fp3dPhoneShell() as unknown as Any;
  assert.equal(el.solo, false);
  const got: boolean[] = [];
  el.addEventListener("phone-solo", (e: CustomEvent<boolean>) => got.push(e.detail));
  el.tapMore("solo");
  el.solo = true;
  el.tapMore("solo");
  assert.deepEqual(got, [true, false]);
  const shell = src("./components/phone-shell.ts");
  assert.ok(shell.includes('{ id: "solo", icon: "🔎", label: this.t("nav_solo"), hint: this.t("nav_solo_hint"), pressed: this.solo }'));
});

const room = (id: string, x: number): Room => ({ id, name: id, area_id: null, points: [[x, 0], [x + 4, 0], [x + 4, 3], [x, 3]] }) as unknown as Room;

test("the 3D view cuts its plan to `rooms` (the same object while they stay) and names no map then", async () => {
  const { Fp3dView3d } = await import("./components/view3d.ts");
  const v = new Fp3dView3d() as unknown as Any;
  v.hass = { language: "en", themes: { darkMode: true }, entities: {}, states: {} };
  const b = emptyBuilding();
  const g = newFloor("g", "Ground", 0);
  g.rooms = [room("kids", 0), room("hall", 4)];
  b.floors = [g];
  b.settings = { ...b.settings, surroundings: { on: true, buildings: [] } as never };
  v.building = b;
  assert.equal(v.rooms, null);
  assert.equal(v.viewPlan(b), b, "the whole plan");
  assert.equal(v.mapShown(), true);
  v.rooms = ["kids"];
  const cut = v.viewPlan(b);
  assert.deepEqual(cut.floors[0].rooms.map((r: Room) => r.id), ["kids"]);
  assert.equal(v.viewPlan(b), cut, "no rebuild while nothing changed");
  assert.equal(v.mapShown(), false, "the map is not drawn, so it is not named");
  assert.equal(v.roofHidden(), true, "no roof over some rooms on their own: a section over them reaches over hidden ones");
  v.rooms = ["gone"];
  assert.equal(v.viewPlan(b), b, "rooms the plan no longer has: the whole house");
  assert.equal(v.roofHidden(), false);
  const view = src("./components/view3d.ts");
  assert.ok(view.includes("roomsNew = changed.has(\"rooms\")"), "a change of rooms rebuilds and syncs the devices");
});

test("the card passes rooms and the solo choice to the view and the shell; the panel does too; the card form has one switch", () => {
  const card = src("./card.ts");
  for (const s of [
    ".rooms=${viewRooms({ phone, solo, roomId: this._roomId, rooms })}",
    ".solo=${solo}",
    "@phone-solo=${(e: CustomEvent<boolean>) => saveSolo((this._solo = e.detail))}",
    "const solo = soloOn(this._solo, c?.phone_solo);",
    ".hideRoof=${c?.roof === false || rooms.length > 0}",
    ".building=${this.roomsPlan(b, rooms)}",
  ])
    assert.ok(card.includes(s), s);
  const panel = src("./panel.ts");
  assert.ok(panel.includes(".rooms=${viewRooms({ phone, solo: this._solo, roomId: this._roomId })}"));
  assert.ok(panel.includes(".solo=${this._solo}"));
  const editor = src("./card-editor.ts");
  assert.match(editor, /this\.set\("phone_solo", \(e\.target as HTMLInputElement\)\.checked \|\| undefined\)/);
  const config = src("./card-config.ts");
  assert.match(config, /\n {2}rooms\?: string\[\];/);
  assert.match(config, /\n {2}phone_solo\?: boolean;/);
});
