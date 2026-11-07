// EV chargers (#237): the zappi and the main UK, European and US brands are wallboxes in the energy flow and
// turn up in the library under "charger", "EV", "car charger" and their brand name.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildIndex, searchLibrary } from "./library-index.ts";
import { energyRole, setPacks, type FurniturePack, type PackItem } from "./packs.ts";

const BUNDLED = fileURLToPath(new URL("../../custom_components/home_3d/bundled_packs", import.meta.url));
const filesIn = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? filesIn(join(dir, n)) : [join(dir, n)]));

const packs: FurniturePack[] = readdirSync(BUNDLED)
  .map((n) => join(BUNDLED, n))
  .filter((d) => statSync(d).isDirectory())
  .map((d) => ({
    ...JSON.parse(readFileSync(join(d, "pack.json"), "utf8")),
    bundled: true,
    items: filesIn(d).filter((f) => f.endsWith(".json") && !f.endsWith("pack.json")).map((f) => JSON.parse(readFileSync(f, "utf8")) as PackItem),
  }));
setPacks(packs);
const devices = packs.find((p) => p.id === "amluto.devices")!;
const chargers = devices.items.filter((i) => /^ev_charger/.test(i.family ?? ""));
const entries = buildIndex({ packs, basics: [], language: "en", basicName: (t) => t, basicNameEn: (t) => t, kindName: (k) => k, size: () => [1, 1, 1] });
const find = (query: string) => searchLibrary(entries, { query, room: null, electric: false, light: false, outdoor: false }).hits.map((e) => e.type);

test("the range covers the zappi and every brand named in the ticket, each a wallbox", () => {
  const brands = ["zappi", "ohme", "hypervolt", "pod point", "andersen", "wallbox", "easee", "zaptec", "tesla", "chargepoint", "juicebox", "emporia", "grizzl"];
  for (const b of brands) assert.ok(chargers.some((i) => (i.tags ?? []).some((t) => t.toLowerCase().includes(b))), b);
  assert.ok(chargers.length >= 16);
  for (const i of chargers) {
    assert.equal(energyRole(`pack:amluto.devices:${i.id}`), "wallbox", i.id);
    assert.equal(i.mount, "wall", i.id);
    assert.ok(i.electric, i.id);
  }
});

test("charger, EV, car charger and the brand name all find them", () => {
  for (const q of ["charger", "ev", "car charger", "ev charger"]) {
    const hits = new Set(find(q));
    for (const i of chargers) assert.ok(hits.has(`pack:amluto.devices:${i.id}`), `${q} finds ${i.id}`);
  }
  for (const i of chargers) {
    const brand = (i.tags ?? []).find((t) => !/^(ev|ev charger|car charger|charger|electric vehicle|electric car|charge point|wallbox|type 2)$/.test(t))!;
    assert.ok(find(brand).includes(`pack:amluto.devices:${i.id}`), `${brand} finds ${i.id}`);
  }
});
