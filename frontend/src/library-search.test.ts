// Ranked, forgiving library search (#78): label matches before tag matches, exact before prefix before fuzzy,
// everyday words and UK synonyms, and the bundled catalogue tagged well enough that common words find things.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { basicTypes, buildIndex, isShortQuery, searchLibrary, SHORT_QUERY_CAP, warmIndex, type LibraryEntry } from "./library-index.ts";
import { editDistance } from "./fuzzy.ts";
import type { FurniturePack, PackItem } from "./packs.ts";

const part = { shape: "box" as const, x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "dark" };
const item = (id: string, en: string, extra: Partial<PackItem> = {}): PackItem => ({ id, name: { de: en, en }, size: [1, 0.5, 0.8], parts: [part], ...extra });
const none = { query: "", room: null, electric: false, light: false, outdoor: false };
const indexOf = (packs: FurniturePack[], basics: string[] = []) =>
  buildIndex({ packs, basics, language: "en", basicName: (t) => t.replace(/_/g, " "), basicNameEn: (t) => t.replace(/_/g, " "), kindName: (k) => k, size: () => [1, 1, 1] });
const pack = (...items: PackItem[]): FurniturePack => ({ id: "acme.test", name: "Test", publisher: "Acme", items });
const labels = (entries: readonly LibraryEntry[], query: string) => searchLibrary(entries, { ...none, query }).hits.map((e) => e.label);

test("edit distance counts a swapped pair of letters as one slip", () => {
  assert.equal(editDistance("sofa", "sofa"), 0);
  assert.equal(editDistance("sofa", "sfoa"), 1);
  assert.equal(editDistance("wardrobe", "wardrbe"), 1);
  assert.equal(editDistance("wardrobe", "wardrabe"), 1);
  assert.equal(editDistance("table", "chair"), 5);
});

test("label matches rank by word, then prefix, then substring, then tags, then kind words (#78)", () => {
  const entries = indexOf([
    pack(
      item("a_tagged", "Cosy thing", { group: "deco", tags: ["wardrobe"] }),
      item("b_inside", "Daywardrobe unit", { group: "deco" }),
      item("c_prefix", "Wardrobes, fitted", { group: "deco" }),
      item("d_exact", "Wardrobe", { group: "deco" }),
      item("e_kind", "Hanging rail", { group: "storage" }),
    ),
  ]);
  assert.deepEqual(labels(entries, "wardrobe"), ["Wardrobe", "Wardrobes, fitted", "Daywardrobe unit", "Cosy thing", "Hanging rail"]);
});

test("a phrase in the label beats the same words scattered, and the shorter name wins a tie (#78)", () => {
  const entries = indexOf([
    pack(
      item("a", "Bed, single size with a really long name", { group: "bed" }),
      item("b", "Single bed", { group: "bed" }),
      item("c", "Single divan bed", { group: "bed" }),
      item("d", "Daybed with cushions", { group: "sofa", tags: ["single", "bed"] }),
    ),
  ]);
  const found = labels(entries, "single bed");
  assert.equal(found[0], "Single bed");
  assert.equal(found[1], "Single divan bed");
  assert.equal(found[found.length - 1], "Daybed with cushions", "a bed inside another word comes last");
});

test("a misspelt word still finds the item, below every exact and prefix match (#78)", () => {
  const entries = indexOf([
    pack(
      item("a", "Wardrabe, corner", { group: "storage" }),
      item("b", "Wardrobe", { group: "storage" }),
      item("c", "Wardrobes, fitted", { group: "storage" }),
      item("d", "Sofa", { group: "sofa" }),
      item("e", "Lamp", { group: "lamp" }),
    ),
  ]);
  assert.deepEqual(labels(entries, "wardrobe"), ["Wardrobe", "Wardrobes, fitted", "Wardrabe, corner"]);
  assert.ok(labels(entries, "wardrbe").includes("Wardrobe"), "one letter missing from the query");
  assert.ok(labels(entries, "sfoa").includes("Sofa"), "two letters swapped in a short word");
  assert.deepEqual(labels(entries, "lamb"), [], "short words are not guessed at: lamb is not lamp");
  assert.deepEqual(labels(indexOf([pack(item("a", "Cooktop", { group: "kitchen" }))]), "worktop"), [], "two letters off a seven-letter word is a different word");
});

test("every word of the query must match, fuzzily or not, and an exact word beats a fuzzy one (#78)", () => {
  const entries = indexOf([pack(item("a", "Oak desk", { group: "office" }), item("b", "Oak dsek", { group: "office" }), item("c", "Pine desk", { group: "office" }))]);
  assert.deepEqual(labels(entries, "oak desk"), ["Oak desk", "Oak dsek"]);
});

test("UK and everyday synonyms find the item (#78)", () => {
  const entries = indexOf([
    pack(
      item("car", "Hatchback", { group: "vehicle", tags: ["car"] }),
      item("twin", "Twin bed", { group: "bed" }),
      item("alarm", "Smoke detector", { group: "tech" }),
      item("fire", "Fire alarm", { group: "tech" }),
      item("glass", "Ceiling lamp, smoked glass", { group: "lamp" }),
    ),
  ]);
  assert.ok(labels(entries, "automobile").includes("Hatchback"));
  assert.ok(labels(entries, "single bed").includes("Twin bed"), "twin bed = single bed");
  assert.ok(labels(entries, "smoke alarm").includes("Smoke detector"), "smoke alarm = smoke detector");
  assert.equal(labels(entries, "smoke")[0], "Smoke detector", "an alarm named smoke comes before a smoked lamp");
  assert.ok(labels(entries, "smoke detector").includes("Fire alarm"), "fire alarm = smoke detector");
});

// ---------------------------------------------------------------------------------- the bundled catalogue

const BUNDLED = fileURLToPath(new URL("../../custom_components/home_3d/bundled_packs", import.meta.url));
const filesIn = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? filesIn(join(dir, n)) : [join(dir, n)]));
const bundled = readdirSync(BUNDLED)
  .map((n) => join(BUNDLED, n))
  .filter((d) => statSync(d).isDirectory())
  .map((folder) => {
    const meta = JSON.parse(readFileSync(join(folder, "pack.json"), "utf8"));
    const items = filesIn(folder)
      .filter((p) => p.endsWith(".json") && !p.endsWith("pack.json"))
      .map((p) => JSON.parse(readFileSync(p, "utf8")) as PackItem);
    return { ...meta, bundled: true, items } as FurniturePack;
  });
const catalogue = indexOf(bundled, basicTypes());
const hasWord = (e: LibraryEntry, s: string) => e.label.toLowerCase().split(/[^a-z0-9]+/).includes(s);
const top = (hits: LibraryEntry[], n: number) => hits.slice(0, n).map((e) => e.label).join(" | ");

test("catalogue: 'single bed' puts single beds first and the daybed behind them (#78)", () => {
  const hits = searchLibrary(catalogue, { ...none, query: "single bed" }).hits;
  const singles = hits.filter((e) => /single/i.test(e.label) && hasWord(e, "bed"));
  assert.ok(singles.length >= 2);
  assert.ok(hits.slice(0, singles.length).every((e) => singles.includes(e)), top(hits, singles.length + 3));
  assert.ok(hits.findIndex((e) => /daybed/i.test(e.label)) >= singles.length);
});

test("catalogue: 'desk' lists desks before anything that only mentions a desk (#78)", () => {
  const hits = searchLibrary(catalogue, { ...none, query: "desk" }).hits;
  const desks = hits.filter((e) => hasWord(e, "desk"));
  assert.ok(desks.length >= 3);
  assert.ok(hits.slice(0, desks.length).every((e) => hasWord(e, "desk")), top(hits, desks.length + 3));
  assert.equal(hits[0].label, "desk", "the plain desk first");
});

test("catalogue: 'vehicle' and 'car' find the cars and vehicles first, not rugs (#78)", () => {
  const vehicles = searchLibrary(catalogue, { ...none, query: "vehicle" }).hits;
  assert.ok(vehicles.slice(0, 10).every((e) => e.kind === "vehicle"), top(vehicles, 10));
  const cars = searchLibrary(catalogue, { ...none, query: "car" }).hits;
  assert.ok(cars.slice(0, 12).every((e) => e.kind === "vehicle" || /\bcar\b/i.test(e.search)), top(cars, 12));
  assert.ok(cars.findIndex((e) => /nissan leaf/i.test(e.label)) < 10, "the electric car is in the first ten: " + top(cars, 12));
});

test("catalogue: 'tv', 'fridge' and 'plant' put the thing itself first (#78)", () => {
  const tv = searchLibrary(catalogue, { ...none, query: "tv" }).hits;
  assert.ok(tv.slice(0, 5).every((e) => e.kind === "media"), top(tv, 5));
  const fridge = searchLibrary(catalogue, { ...none, query: "fridge" }).hits;
  const named = fridge.filter((e) => hasWord(e, "fridge"));
  assert.ok(named.length >= 3);
  assert.ok(fridge.slice(0, named.length).every((e) => hasWord(e, "fridge")), top(fridge, named.length + 3));
  const plant = searchLibrary(catalogue, { ...none, query: "plant" }).hits;
  assert.equal(plant[0].kind, "plant");
  const plants = plant.filter((e) => hasWord(e, "plant"));
  assert.ok(plant.slice(0, plants.length).every((e) => hasWord(e, "plant")), top(plant, plants.length + 3));
});

test("catalogue: a short word leads with names starting with it, and 'raspberry pi' finds the PiKVM box (#78)", () => {
  const pi = searchLibrary(catalogue, { ...none, query: "pi" }).hits;
  assert.ok(pi.length > 0);
  const leads = (e: LibraryEntry) => e.label.toLowerCase().split(/[^a-z0-9]+/).some((w) => w.startsWith("pi"));
  const named = pi.filter(leads).length;
  assert.ok(named >= 3 && pi.slice(0, named).every(leads), top(pi, named + 1)); // names with a pi word first, tag matches (the KVM box) after
  assert.ok(labels(catalogue, "raspberry pi").some((l) => /kvm/i.test(l)));
});

test("catalogue: everyday words each find something, and misspellings of them too (#78)", () => {
  for (const q of ["sofa", "bed", "wardrobe", "hob", "cooker", "toilet", "loo", "bin", "kettle", "lamp", "light", "rug", "mirror", "shelf", "bike", "router", "printer", "camera", "sink", "bath"]) {
    assert.ok(searchLibrary(catalogue, { ...none, query: q }).hits.length > 0, q);
  }
  for (const [typo, label] of [["wardrbe", /wardrobe/i], ["refridgerator", /fridge/i], ["bicicle", /bicycle/i], ["printr", /printer/i]] as const) {
    assert.ok(searchLibrary(catalogue, { ...none, query: typo }).hits.some((e) => label.test(e.label)), typo);
  }
});

test("catalogue: 'smoke' puts the smoke and smoke/CO alarms (#79) before the smoked-glass lamps (#78)", () => {
  const hits = searchLibrary(catalogue, { ...none, query: "smoke" }).hits;
  const at = (re: RegExp) => hits.findIndex((e) => re.test(e.label));
  const alarm = at(/^smoke alarm$/i);
  const co = at(/^smoke and co alarm$/i);
  const lamp = at(/smoked glass/i);
  assert.ok(alarm >= 0 && co >= 0, top(hits, 8));
  assert.ok(lamp < 0 || (alarm < lamp && co < lamp), top(hits, 8));
});

// ---------------------------------------------------------------------------------- IT devices (#118)

test("everyday IT words find the item: pi, zigbee stick, coordinator (#118)", () => {
  const entries = indexOf([
    pack(
      item("rpi", "Raspberry Pi board", { group: "tech" }),
      item("stick", "Zigbee USB stick", { group: "tech" }),
      item("dongle", "USB dongle", { group: "tech", tags: ["zigbee dongle"] }),
      item("sofa", "Pie dish", { group: "kitchen" }),
    ),
  ]);
  assert.ok(labels(entries, "pi").includes("Raspberry Pi board"));
  assert.ok(labels(entries, "rpi").includes("Raspberry Pi board"), "rpi = raspberry pi");
  assert.ok(labels(entries, "coordinator").includes("Zigbee USB stick"), "a zigbee stick is a coordinator");
  assert.ok(labels(entries, "zigbee stick").includes("USB dongle"), "stick = dongle");
  assert.ok(labels(entries, "zigbee coordinator").includes("USB dongle"));
  assert.ok(!labels(entries, "coordinator").includes("Pie dish"));
});

test("catalogue: the IT devices are found by the words people type (#118)", () => {
  const find = (query: string, label: RegExp) => assert.ok(searchLibrary(catalogue, { ...none, query }).hits.some((e) => label.test(e.label)), `"${query}" finds ${label}`);
  const first = searchLibrary(catalogue, { ...none, query: "pi" }).hits[0];
  assert.ok(hasWord(first, "pi"), `"pi" starts with a Raspberry Pi, not ${first.label}`);
  find("pi case", /Pi.*case/i);
  find("raspberry pi 5", /Raspberry Pi/i);
  find("esp32", /ESP32/i);
  find("d1 mini", /D1 mini/i);
  find("zigbee stick", /ZBDongle-E/i);
  find("zigbee stick", /ZBT-1/i);
  find("coordinator", /SLZB-06/i);
  find("coordinator", /ZBT-2/i);
  find("thread dongle", /ZBT-2/i);
  find("skyconnect", /ZBT-1/i);
  find("home assistant green", /Green/i);
  find("hue bridge", /Hue/i);
  find("sure petcare", /Sure Petcare/i);
  find("nuc", /NUC/i);
  find("mini pc", /Beelink/i);
  find("mini pc", /ThinkCentre/i);
  find("5 bay nas", /5-bay/i);
  find("unifi u7", /Wi-Fi 7/i);
  find("cloud gateway", /Cloud Gateway/i);
  find("dream router", /Dream Router/i);
});

test("warming the index up front prepares each entry once and leaves the search as it was (#131)", () => {
  const entries = indexOf([pack(item("sofa_3", "Sofa"), item("bed_double", "Double bed"), item("tv_55", "TV 55 inch"))]);
  const before = labels(entries, "so");
  const fresh = indexOf([pack(item("sofa_3", "Sofa"), item("bed_double", "Double bed"), item("tv_55", "TV 55 inch"))]);
  assert.equal(warmIndex(fresh), fresh.length);
  assert.equal(warmIndex(fresh), 0, "already prepared");
  assert.deepEqual(labels(fresh, "so"), before);
});

test("catalogue: the car catalogue is found by brand, model and body, and 'car' still lists cars (#129)", () => {
  const puma = searchLibrary(catalogue, { ...none, query: "ford puma" }).hits;
  assert.equal(puma[0].label, "Ford Puma", top(puma, 3));
  const tesla = searchLibrary(catalogue, { ...none, query: "tesla" }).hits;
  assert.ok(tesla.slice(0, 7).every((e) => /tesla/i.test(e.label)), top(tesla, 7));
  const suv = searchLibrary(catalogue, { ...none, query: "suv" }).hits;
  assert.ok(suv.slice(0, 10).every((e) => e.kind === "vehicle"), top(suv, 10));
  const cars = searchLibrary(catalogue, { ...none, query: "car" }).hits;
  assert.ok(cars.filter((e) => e.kind === "vehicle").length >= 150, "the catalogue cars are among the hits for car");
  const bikes = searchLibrary(catalogue, { ...none, query: "snowmobile" }).hits;
  assert.ok(bikes.length >= 4 && bikes.slice(0, 4).every((e) => /snowmobile/i.test(e.label)), top(bikes, 5));
});

// ---------------------------------------------------------------------------------- one and two letters (#136)

test("one or two letters show at most the cap, names starting with them first, and say what was left out (#136)", () => {
  const many = Array.from({ length: 70 }, (_, i) => item(`s${i}`, i % 2 ? `Cabinet ${i} for sheets` : `Shelf ${i}`, { group: "storage" }));
  const entries = indexOf([pack(...many, item("a_jar", "Candle in a jar", { group: "deco" }))]);
  const found = searchLibrary(entries, { ...none, query: "s" });
  assert.equal(found.hits.length, SHORT_QUERY_CAP);
  assert.equal(found.cut, 70 - SHORT_QUERY_CAP);
  assert.ok(found.hits.slice(0, 35).every((e) => /^shelf/i.test(e.label)), "names that start with the letter come first");
  assert.equal(isShortQuery("s"), true);
  assert.equal(isShortQuery("sh"), true);
  assert.equal(isShortQuery("she"), false);
  // from three letters on nothing is cut
  const three = searchLibrary(entries, { ...none, query: "she" });
  assert.equal(three.cut, 0);
  assert.equal(three.hits.length, 70);
  // a whole word of the vocabulary is not a start of something
  assert.equal(isShortQuery("tv"), false);
});

test("a one-letter word is not read as a whole word ahead of names starting with it (#136)", () => {
  const entries = indexOf([pack(item("a", "Candle in a jar", { group: "deco" }), item("b", "Armchair", { group: "sofa" }), item("c", "Aloe vera", { group: "plant" }))]);
  assert.equal(labels(entries, "a")[0].length <= 9, true, "Armchair or Aloe vera, not the jar");
  assert.equal(labels(entries, "a")[2], "Candle in a jar");
});

test("catalogue: a short query is cut and leads with names that start with it (#136)", () => {
  for (const q of ["s", "b", "a", "li", "ba"]) {
    const found = searchLibrary(catalogue, { ...none, query: q });
    assert.equal(found.hits.length, SHORT_QUERY_CAP, q);
    assert.ok(found.cut > 0, q);
    const starts = (e: LibraryEntry) => e.label.toLowerCase().split(/[^a-z0-9]+/).some((w) => w.startsWith(q));
    assert.ok(starts(found.hits[0]), `${q}: ${top(found.hits, 3)}`);
  }
  assert.equal(searchLibrary(catalogue, { ...none, query: "sof" }).cut, 0);
});
