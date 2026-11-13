import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Room } from "../model.ts";
import { findPlace, normalize, showCommand } from "./commands.ts";

const room = (id: string, name: string): Room => ({ id, name, area_id: null, points: [], floor_material: "wood" });
const building = {
  ...emptyBuilding(),
  floors: [
    { ...newFloor("ground", "Ground floor", 0), rooms: [room("lr", "Living room"), room("wc", "WC"), room("gwc", "Guest WC")] },
    { ...newFloor("first", "First floor", 2.8), rooms: [room("kr", "Nursery")] },
  ],
};

test("normalize: lower case, no accents or punctuation", () => {
  assert.equal(normalize("Café-WC!"), "cafe wc");
  assert.equal(normalize("  ß "), "ss");
});

test("a sentence names a room, a floor or the house", () => {
  assert.deepEqual(findPlace("Show me the living room", building), { kind: "room", floorId: "ground", roomId: "lr", name: "Living room" });
  assert.equal(findPlace("go to the guest WC", building)?.name, "Guest WC");
  assert.equal(findPlace("WC please", building)?.name, "WC");
  assert.deepEqual(findPlace("First floor", building), { kind: "floor", floorId: "first", name: "First floor" });
  assert.equal(findPlace("show the whole house", building)?.kind, "house");
  assert.equal(findPlace("turn the light on", building), null);
  assert.equal(findPlace("", building), null);
});

test("a command to show: a show word or a bare place name – not a sentence that only names the room", () => {
  assert.equal(showCommand("Show the living room", building)?.name, "Living room");
  assert.equal(showCommand("Living room", building)?.name, "Living room");
  assert.equal(showCommand("the first floor please", building)?.name, "First floor");
  assert.equal(showCommand("show the whole house", building)?.kind, "house");
  assert.equal(showCommand("turn on the living room light", building), null);
  assert.equal(showCommand("How warm is it in the nursery", building), null);
  // the Home Assistant area's own name counts too
  assert.equal(showCommand("go to the lounge", building, (r) => (r.id === "lr" ? "Lounge" : null))?.name, "Living room");
});

test("switch and open claim a sentence only when it names nothing but a place (#161)", () => {
  // switching and opening commands that happen to name a room are for Assist
  for (const s of ["switch off the lights in the living room", "switch the living room light on", "open the blinds in the living room", "open the window in the nursery", "apri la tapparella del living room"]) {
    assert.equal(showCommand(s, building), null, s);
  }
  // asking to see the place with them still works
  assert.equal(showCommand("switch to the living room", building)?.name, "Living room");
  assert.equal(showCommand("open the living room", building)?.name, "Living room");
  assert.equal(showCommand("open the living room please", building)?.name, "Living room");
  assert.equal(showCommand("show the living room", building)?.name, "Living room");
});

test("room names in other scripts and with undecomposable letters can be addressed (#199)", () => {
  assert.equal(normalize("Кухня"), "кухня");
  assert.equal(normalize("Σαλόνι"), "σαλονι");
  assert.notEqual(normalize("リビング"), "");
  assert.notEqual(normalize("거실"), "");
  assert.equal(normalize("Łazienka"), "lazienka");
  assert.equal(normalize("Køkken"), "kokken");
  assert.equal(normalize("Phòng đọc"), normalize("Phong doc"));
  const b = {
    ...emptyBuilding(),
    floors: [{ ...newFloor("ground", "Ground floor", 0), rooms: [room("k", "Кухня"), room("l", "Łazienka"), room("r", "リビング")] }],
  };
  assert.equal(findPlace("покажи Кухня", b)?.name, "Кухня");
  assert.equal(findPlace("show lazienka", b)?.name, "Łazienka");
  assert.equal(findPlace("リビング を 表示", b)?.name, "リビング");
});

test("a style sentence names a style as a whole, or asks for the screen's own style back", async () => {
  const { styleCommand } = await import("./commands.ts");
  const names = { evening: ["Wohnlich Abend"], warm: ["Holz und Papier"] };
  assert.deepEqual(styleCommand("Style cozy"), { id: "cozy" });
  assert.deepEqual(styleCommand("please switch the look to winter", names), { id: "winter" });
  assert.deepEqual(styleCommand("Set style to realistic"), { id: "realistic" });
  assert.deepEqual(styleCommand("Home 3D style Pastel"), { id: "pastel" });
  assert.deepEqual(styleCommand("Stil Wohnlich Abend", names), { id: "evening" });
  assert.deepEqual(styleCommand("stelle den Stil auf Holz und Papier", names), { id: "warm" });
  assert.deepEqual(styleCommand("reset the style"), { id: null });
  assert.deepEqual(styleCommand("Stil zurück"), { id: null });
  // not a style sentence
  assert.equal(styleCommand("turn on the light"), null);
  assert.equal(styleCommand("show the living room"), null);
  assert.equal(styleCommand("the red look"), null);
  assert.equal(styleCommand("style"), null);
  assert.equal(styleCommand("style of the kitchen"), null);
});
