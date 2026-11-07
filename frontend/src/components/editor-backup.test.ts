// A backup import never destroys what the file leaves out, and is checked whole before anything is written (#153).

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor, square } from "./editor-harness.ts";

const plan = (room: string) => ({
  version: 1,
  settings: {},
  floors: [{ id: "f", name: "F", elevation: 0, height: 2.5, rooms: [{ ...square("r", 0, 0, 4, 4), name: room }], walls: [], openings: [], placements: [], furniture: [], outdoor: [] }],
});

/** An editor whose backend records every backup message; `fail` names a home whose restore fails. */
async function importing(file: unknown, fail?: string) {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)]);
  const sent: Record<string, any>[] = [];
  const told: string[] = [];
  ed.hass = {
    ...ed.hass,
    callWS: async (msg: Record<string, any>) => {
      sent.push(msg);
      if (msg.type === "home_3d/backup/import") {
        if (msg.check_only) return { checked: true, skipped: [] };
        if (fail && msg.homes?.[0]?.id === fail) throw { code: "restore_failed", message: "disk full; everything was put back as it was" };
        const building = msg.homes?.[0]?.building ?? msg.building;
        return { revision: 2, building, home_id: msg.homes?.[0]?.id ?? "home", packs: msg.packs?.length ?? 0, skipped: [] };
      }
      if (msg.type === "home_3d/image/set") return null;
      if (msg.type === "home_3d/backup/stage") return { token: msg.token ?? "t1" };
      throw new Error(`unexpected ${msg.type}`);
    },
  };
  ed.ask = async () => true;
  ed.tell = async (text: string) => void told.push(text);
  ed.dispatchEvent = () => true;
  ed.fit = () => undefined;
  const input = { files: [{ text: async () => JSON.stringify(file) }], value: "x" };
  await ed.importBackup({ target: input });
  return { ed, sent, told, imports: sent.filter((m) => m.type === "home_3d/backup/import") };
}

const twoHomes = {
  format: "home3d-backup",
  version: 1,
  building: plan("A"),
  homes: [
    { id: "home", name: "Home", building: plan("A") },
    { id: "flat", name: "Flat", building: plan("B") },
  ],
  active: "home",
  packs: [{ id: "some.pack" }],
  items: [{ id: "own" }],
};

test("an older backup without packs sends none, so the installed packs stay (#153)", async () => {
  const { imports } = await importing({ format: "home3d-backup", version: 1, building: plan("Old") });
  assert.equal(imports.length, 2);
  for (const msg of imports) {
    assert.ok(!("packs" in msg), "no packs key: the backend leaves the installed ones");
    assert.ok(!("items" in msg));
  }
});

test("every part of the file is checked before the first home is restored; packs and items come last (#153)", async () => {
  const { imports } = await importing(twoHomes);
  assert.deepEqual(
    imports.map((m) => [m.check_only === true, m.homes?.[0]?.id, "packs" in m, "items" in m]),
    [
      [true, "home", false, false],
      [true, "flat", true, true],
      [false, "home", false, false],
      [false, "flat", true, true],
    ],
  );
});

test("a backup whose second home fails says which homes were restored before it (#153)", async () => {
  const { told, imports } = await importing(twoHomes, "flat");
  assert.equal(imports.filter((m) => !m.check_only).length, 2);
  assert.equal(told.length, 1);
  assert.match(told[0], /Flat/);
  assert.match(told[0], /Restored before it: Home/);
  assert.match(told[0], /disk full/);
});

test("a backup that fails the check restores nothing (#153)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)]);
  const sent: Record<string, any>[] = [];
  ed.hass = {
    ...ed.hass,
    callWS: async (msg: Record<string, any>) => {
      sent.push(msg);
      if (msg.check_only && msg.homes?.[0]?.id === "flat") throw { code: "invalid_format", message: "bad plan" };
      if (msg.check_only) return { checked: true, skipped: [] };
      throw new Error("restored although the check failed");
    },
  };
  const told: string[] = [];
  ed.ask = async () => true;
  ed.tell = async (text: string) => void told.push(text);
  await ed.importBackup({ target: { files: [{ text: async () => JSON.stringify(twoHomes) }], value: "x" } });
  assert.equal(sent.filter((m) => !m.check_only).length, 0);
  assert.match(told[0], /bad plan/);
});

test("each restore point shows its size next to the date and the counts (#240)", async () => {
  const { bytesText } = await import("./editor/backup.ts");
  assert.equal(bytesText(900, "en"), "900 B");
  assert.equal(bytesText(1536, "en"), "1.5 KB");
  assert.equal(bytesText(42 * 1024, "en"), "42 KB");
  assert.equal(bytesText(1.3 * 1024 * 1024, "en"), "1.3 MB");
  const ed = await makeEditor([square("r", 0, 0, 4, 4)]);
  ed._history = [
    { id: "a", revision: 3, saved_at: 1_700_000_000, floors: 1, rooms: 4, furniture: 9, size: 43_008 },
    { id: "b", revision: 2, saved_at: 1_600_000_000, floors: 1, rooms: 3, furniture: 2 },
  ];
  const flat = (v: unknown): string => {
    if (v == null || typeof v === "boolean") return "";
    if (Array.isArray(v)) return v.map(flat).join("");
    const t = v as { strings?: readonly string[]; values?: unknown[] };
    return typeof v === "object" ? (t.strings ? t.strings.map((s, i) => s + (i < t.values!.length ? flat(t.values![i]) : "")).join("") : "") : String(v);
  };
  const out = flat(ed.renderBackup());
  assert.match(out, /4 rooms, 9 items · 42 KB/);
  // a point from a server that sent no size shows none
  assert.match(out, /3 rooms, 2 items<\/span>/);
});

/** A pack entry as a backup carries it: the payload and its source, each about `kb` kilobytes. */
const bigPack = (id: string, kb: number) => {
  const text = "x".repeat(kb * 1024);
  return { id, name: id, items: [{ id: "a", note: text }], source: { files: { "pack.json": text } } };
};

test("a backup's packs go with their source only, and ahead in parts when they don't fit with the rest (#375)", async () => {
  const file = { ...twoHomes, packs: [bigPack("a.one", 1500), bigPack("a.two", 1500), bigPack("a.three", 1500)] };
  const { sent, told } = await importing(file);
  assert.deepEqual(told, []);
  const stages = sent.filter((m) => m.type === "home_3d/backup/stage");
  // every import that carries the packs (the check and the restore) sends them ahead: two parts of at most 4 MiB
  assert.equal(stages.length, 4);
  for (const m of stages) assert.ok(new TextEncoder().encode(JSON.stringify(m)).length < 4 * 1024 * 1024);
  assert.deepEqual(
    stages.flatMap((m) => m.packs.map((p: Record<string, unknown>) => Object.keys(p).sort().join(","))),
    Array(6).fill("id,source"),
  );
  const last = sent.filter((m) => m.type === "home_3d/backup/import" && m.homes?.[0]?.id === "flat");
  for (const m of last) assert.ok(!("packs" in m) && typeof m.staged === "string");
});

test("a small backup sends its packs inline, with their source only (#375)", async () => {
  const { imports } = await importing({ ...twoHomes, packs: [bigPack("a.one", 2)] });
  const withPacks = imports.filter((m) => "packs" in m);
  assert.equal(withPacks.length, 2);
  for (const m of withPacks) assert.deepEqual(Object.keys(m.packs[0]).sort(), ["id", "source"]);
});

test("a pack too large for any message is refused with a clear message before anything is sent (#375)", async () => {
  const { sent, told } = await importing({ ...twoHomes, packs: [bigPack("a.huge", 4500)] });
  assert.equal(sent.filter((m) => m.type === "home_3d/backup/import" && !m.check_only).length, 0);
  assert.equal(told.length, 1);
  assert.match(told[0], /4 MB/);
  assert.match(told[0], /a\.huge/);
});
