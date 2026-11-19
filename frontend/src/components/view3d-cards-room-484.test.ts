// Port 3.5 (#484): the now-playing cards show in an opened room (whatever the "Device cards in an opened room" switch
// says), and a speaker's pin steps aside only while the cards can show at all.
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding } from "../model.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };

function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol" || typeof v === "boolean" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(v);
}

function view() {
  const el = new Fp3dView3d();
  el.building = emptyBuilding();
  el._energy = null;
  el.renderMediaCard = (card: { kind: string }) => `[media:${card.kind}]`;
  el.renderBinCard = () => "[bin]";
  el.renderRackCard = () => "[rack]";
  el.renderDeviceCard = () => "[device]";
  el._holos = [
    { kind: "media", name: "Speaker" },
    { kind: "device", name: "Plug" },
    { kind: "bin", name: "Bins" },
  ];
  return el;
}

test("an opened room shows its music cards with the device-card switch off, and no device cards (#484)", () => {
  const el = view();
  el.roomId = "r1";
  el.showEnergy = true;
  el.holograms = true;
  assert.equal(el.cardsOn(), true);
  assert.equal(flat(el.renderHologram()), "[media:media][bin]");
});

test("an opened room with the device-card switch on shows the device cards too (#484)", () => {
  const el = view();
  el.roomId = "r1";
  el.showEnergy = true;
  el.holograms = true;
  el.building.settings.roof.hologram = { ...(el.building.settings.roof.hologram ?? {}), device_room: true };
  assert.match(flat(el.renderHologram()), /\[device\]/);
});

test("with the cards switched off no music card shows, and the pins stay (#484)", () => {
  const el = view();
  el.roomId = "r1";
  el.showEnergy = true;
  el.holograms = false;
  assert.equal(el.cardsOn(), false);
  assert.equal(flat(el.renderHologram()), "[bin]");
  el.holograms = null;
  el._holoShow = false;
  assert.equal(el.cardsOn(), false);
  el._holoShow = true;
  el.showEnergy = false;
  assert.equal(el.cardsOn(), false);
  el.showEnergy = true;
  assert.equal(el.cardsOn(), true);
});
