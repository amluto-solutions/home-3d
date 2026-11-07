import assert from "node:assert/strict";
import { test } from "node:test";
import { rackAnswer, type SpokenRack } from "./racks.ts";

// the sentence parts as the i18n table would give them (English)
const TEXT: Record<string, string> = {
  voice_rack_hot: "{name}: {gear} is the hottest at {value}.",
  voice_rack_value: "{gear}: {what} {value}.",
  voice_rack_online: "{name}: {on} of {total} devices are online.",
  voice_rack_summary: "{name}: {list}.",
  voice_rack_missing: "{name} has no {what} linked.",
  voice_rack_unavailable: "{what} of {gear} is not available.",
  rack_kind_temperature: "Temperature",
  rack_kind_battery: "Battery",
  rack_kind_runtime: "Runtime",
  rack_kind_load: "Load",
  rack_kind_disk: "Volume",
};
const say = (key: string, vars: Record<string, string | number> = {}) => Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), TEXT[key] ?? key);

const v = (key: string, kind: string, slot: string | null, text: string, value: number | null = Number.parseFloat(text), of?: number) => ({ key, kind, slot, label: key, text, value, of });
const rack: SpokenRack = {
  id: "r1",
  name: "Comms rack",
  room: "Hall",
  names: { s1: "Core switch", s2: "UPS", s3: "NAS" },
  values: [
    v("sensor.sample_ups_load", "load", "s2", "40 %"),
    v("sensor.sample_ups_battery", "battery", "s2", "98 %"),
    v("sensor.sample_ups_runtime", "runtime", "s2", "45 min"),
    v("@hottest", "temperature", "s3", "51 °C"),
    v("@online", "status", null, "2/3", 2, 3),
  ],
};
const ask = (s: string, racks: SpokenRack[] = [rack]) => rackAnswer(s, racks, say);

test("how hot is the rack: the hottest gear and its figure", () => {
  assert.equal(ask("How hot is the rack?")?.text, "Comms rack: NAS is the hottest at 51 °C.");
  assert.equal(ask("how warm is the server cabinet")?.text, "Comms rack: NAS is the hottest at 51 °C.");
  assert.equal(ask("How hot is the rack?")?.rackId, "r1");
});

test("the UPS battery and runtime come from the gear named, without the word rack", () => {
  assert.equal(ask("What's the UPS battery?")?.text, "UPS: Battery 98 %.");
  assert.equal(ask("how long will the UPS run")?.text, "UPS: Runtime 45 min.");
});

test("devices online, and a summary of the card", () => {
  assert.equal(ask("Which devices in the rack are online?")?.text, "Comms rack: 2 of 3 devices are online.");
  assert.match(ask("How is the rack doing?")?.text ?? "", /^Comms rack: .*40 %.*98 %/);
});

test("a figure the rack has nothing for is said so; sentences that are not about a rack stay null", () => {
  assert.equal(ask("What is the rack disk space?")?.text, "Comms rack has no Volume linked.");
  assert.equal(ask("How hot is the living room?"), null);
  assert.equal(ask("Turn off the rack"), null);
  assert.equal(ask("How hot is the rack?", []), null);
});

test("several racks: the one named wins", () => {
  const other: SpokenRack = { ...rack, id: "r2", name: "Garage rack", room: "Garage", values: [v("@hottest", "temperature", "s1", "30 °C")] };
  assert.equal(ask("How hot is the garage rack?", [rack, other])?.rackId, "r2");
  assert.equal(ask("How hot is the rack in the hall?", [other, rack])?.rackId, "r1");
});
