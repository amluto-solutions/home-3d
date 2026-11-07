// The bundled empty racks (#112): the files in the IT & network pack are what tools/rack-frames.ts writes from the
// catalogue, and each is a rack by the rules.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import type { PackItem } from "./packs.ts";
import { RACKS, rackItem, rackItemFile } from "./rack-catalogue.ts";
import { rackLayout, readRackFrame } from "./rack-frame.ts";

const NETWORK = new URL("../../custom_components/home_3d/bundled_packs/amluto.it/network/", import.meta.url);

test("the IT pack has the three starter racks: a 10-inch 6U mini rack, a 9U glass wall cabinet and a 42U floor cabinet (#112)", () => {
  const frames = RACKS.map((r) => r.rack_frame);
  assert.ok(frames.some((f) => f.width === 10 && f.u === 6));
  assert.ok(frames.some((f) => f.form === "wall_cabinet" && f.u === 9 && f.door === "glass"));
  assert.ok(frames.some((f) => f.form === "cabinet" && f.u === 42));
});

test("every catalogue rack is in the pack as the tool writes it, and reads as a rack (#112)", () => {
  for (const entry of RACKS) {
    const file = new URL(`${entry.id}.json`, NETWORK);
    assert.ok(existsSync(file), `${entry.id}.json: run node tools/rack-frames.ts`);
    const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    assert.equal(text, rackItemFile(rackItem(entry)), `${entry.id}.json is out of date: run node tools/rack-frames.ts`);
    const item = JSON.parse(text) as PackItem;
    const frame = readRackFrame(item);
    assert.ok(frame, entry.id);
    // its U space fits inside, as the real rack's does
    const at = rackLayout(frame, ...item.size);
    assert.ok(at.top <= item.size[2] && Math.abs(at.unit - 0.04445) < 1e-9, entry.id);
  }
});

test("the catalogue has about 27 racks, each id once, and docs/rack-frames.md lists every one with its source (#116)", () => {
  assert.ok(RACKS.length >= 27, `${RACKS.length} racks`);
  const ids = RACKS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
  const doc = readFileSync(new URL("../../docs/rack-frames.md", import.meta.url), "utf8");
  for (const id of ids) assert.ok(doc.includes(`\`${id}\``), `docs/rack-frames.md lacks ${id}`);
  // a family has one entry per U count, and a variant names it
  const seen = new Set<string>();
  for (const r of RACKS) {
    assert.equal(r.variant, `${r.rack_frame.u}U`, r.id);
    assert.ok(!seen.has(`${r.family}/${r.variant}`), `${r.id}: family and variant repeat`);
    seen.add(`${r.family}/${r.variant}`);
  }
});

test("the catalogue covers each kind of rack the ticket lists (#116)", () => {
  const has = (form: string, width: number, u: number, size?: (s: [number, number, number]) => boolean) =>
    RACKS.some((r) => r.rack_frame.form === form && (r.rack_frame.width ?? 19) === width && r.rack_frame.u === u && (!size || size(r.size)));
  for (const u of [4, 6, 8]) assert.ok(has("frame4", 10, u), `10-inch desktop ${u}U`);
  assert.ok(has("wall_frame", 10, 6));
  for (const u of [6, 9]) assert.ok(has("wall_cabinet", 10, u));
  for (const u of [6, 9, 12]) assert.ok(has("frame2", 19, u), `19-inch desktop frame ${u}U`);
  for (const u of [6, 12]) assert.ok(has("wall_frame", 19, u));
  for (const u of [4, 6, 9, 12, 15]) assert.ok(has("wall_cabinet", 19, u, (s) => s[1] <= 0.45), `wall cabinet ${u}U`);
  for (const u of [9, 15]) assert.ok(has("wall_cabinet", 19, u, (s) => s[1] > 0.45), `deep wall cabinet ${u}U`);
  for (const u of [18, 22, 27, 32, 42]) assert.ok(has("cabinet", 19, u), `floor cabinet ${u}U`);
  assert.ok(has("cabinet", 19, 42, (s) => s[0] >= 0.8), "wide 42U");
  assert.ok(has("cabinet", 19, 47, (s) => s[0] >= 0.8 && s[1] >= 1.2), "deep 47U");
  for (const u of [22, 42]) assert.ok(has("frame4", 19, u, (s) => s[2] > 1), `open frame ${u}U`);
  for (const u of [25, 42]) assert.ok(has("frame2", 19, u, (s) => s[2] > 1), `relay rack ${u}U`);
  assert.ok(has("cabinet", 19, 12, (s) => s[2] < 1), "12U AV console");
});
