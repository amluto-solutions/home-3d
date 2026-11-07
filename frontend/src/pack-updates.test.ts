import assert from "node:assert/strict";
import { test } from "node:test";
import { askingFirst, changesNothing, libraryUpdates, nextCheck, previewName, shortCommit, updatesOnCard, updateSummary, type PackPreview, type PackUpdateStatus } from "./pack-updates.ts";

const status: PackUpdateStatus = {
  settings: { auto_update: false, frequency: "daily", time: "04:00", weekday: 0 },
  last_check: null,
  packs: [
    { id: "a.one", release: 2, bundled: false, pinned: false, checked: true, previous_release: 1 },
    { id: "a.two", release: 1, bundled: true, pinned: true, checked: false, previous_release: null },
  ],
  items: [
    { type: "pack:a.one:chair", pack: "a.one", item: "chair", name: { en: "Chair" }, release: 1, new_release: 2, placed: 3, pinned: false },
    { type: "pack:a.two:bed", pack: "a.two", item: "bed", name: { en: "Bed" }, release: 1, new_release: 1, placed: 1, pinned: true },
  ],
};

test("an import that would install an older release, or change a pinned pack, is sent again once confirmed", async () => {
  const sent: boolean[] = [];
  const asked: string[] = [];
  const older = Object.assign(new Error("release 1 is older than the installed release 2"), { code: "older_release" });
  const result = await askingFirst(
    async (confirm) => {
      sent.push(confirm);
      if (!confirm) throw older;
      return "installed";
    },
    (code, message) => {
      asked.push(`${code}: ${message}`);
      return true;
    },
  );
  assert.equal(result, "installed");
  assert.deepEqual(sent, [false, true]);
  assert.deepEqual(asked, ["older_release: release 1 is older than the installed release 2"]);

  // declined: nothing is sent again, and the answer is null
  sent.length = 0;
  const pinned = Object.assign(new Error("pinned"), { code: "pinned" });
  const declined = await askingFirst(
    async (confirm) => {
      sent.push(confirm);
      throw pinned;
    },
    () => false,
  );
  assert.equal(declined, null);
  assert.deepEqual(sent, [false]);

  // any other refusal is not a question
  const invalid = Object.assign(new Error("bad"), { code: "invalid_content" });
  await assert.rejects(askingFirst(async () => Promise.reject(invalid), () => true), invalid);
});

test("the summary counts placed items with an update, apart from the pinned ones", () => {
  assert.deepEqual(updateSummary(status), { updates: 1, pinned: 1, placed: 3 });
  assert.deepEqual(updateSummary({ ...status, items: [] }), { updates: 0, pinned: 0, placed: 0 });
});

test("library cards of placed items with an update offer it, to editors only, never for a pinned pack (#48)", () => {
  const updates = libraryUpdates(status);
  assert.deepEqual([...updates], ["pack:a.one:chair"]);
  assert.deepEqual([...libraryUpdates(null)], []);
  // a card (a family of variants too) offers the updates of its items
  assert.deepEqual(updatesOnCard(["pack:a.one:stool", "pack:a.one:chair"], updates, true), ["pack:a.one:chair"]);
  assert.deepEqual(updatesOnCard(["pack:a.one:chair"], updates, false), []);
  assert.deepEqual(updatesOnCard(["pack:a.two:bed", "sofa"], updates, true), []);
});

test("the next check follows the frequency, time and weekday", () => {
  // Wednesday 28 Oct 2026, 10:00 local time
  const now = new Date(2026, 9, 28, 10, 0);
  const at = (s: Partial<PackUpdateStatus["settings"]>) => nextCheck({ ...status.settings, ...s }, now);
  assert.equal(at({ frequency: "off" }), null);
  assert.deepEqual(at({ time: "04:00" }), new Date(2026, 9, 29, 4, 0));
  assert.deepEqual(at({ time: "11:15" }), new Date(2026, 9, 28, 11, 15));
  // weekly on Monday (0)
  assert.deepEqual(at({ frequency: "weekly", weekday: 0, time: "05:30" }), new Date(2026, 10, 2, 5, 30));
  // monthly on the 1st
  assert.deepEqual(at({ frequency: "monthly", time: "03:00" }), new Date(2026, 10, 1, 3, 0));
});

test("the question may be answered later, in the app's own dialog (#59)", async () => {
  const sent: boolean[] = [];
  const pinned = Object.assign(new Error("pinned"), { code: "pinned" });
  const send = async (confirm: boolean) => {
    sent.push(confirm);
    if (!confirm) throw pinned;
    return "installed";
  };
  assert.equal(await askingFirst(send, async () => false), null);
  assert.deepEqual(sent, [false], "an awaited no sends nothing again");
  assert.equal(await askingFirst(send, async () => true), "installed");
});

// ---- what an install or update changes (#189)

const preview: PackPreview = {
  pack: { id: "a.one", name: "One", publisher: "Someone", licence: "MIT", release: 2, items: 3 },
  origin: { url: "https://github.com/o/r/tree/main/a.one", owner: "o", repo: "r", ref: "main", folder: "a.one", commit: "0123456789abcdef0123456789abcdef01234567", default_branch: false },
  installed: { release: 1, publisher: "Someone", bundled: false, pinned: false, commit: "fedcba9876543210fedcba9876543210fedcba98" },
  changes: { added: [{ id: "bench", name: { en: "Bench" } }], changed: [], removed: [], unchanged: 2 },
  warnings: [],
};

test("a commit is shown as its first seven characters; nothing when there is none", () => {
  assert.equal(shortCommit(preview.origin.commit), "0123456");
  assert.equal(shortCommit(null), "");
  assert.equal(shortCommit(undefined), "");
});

test("an item in a preview is named in the viewer's language, then English, then any name, then its id", () => {
  assert.equal(previewName({ id: "x", name: { de: "Bank", en: "Bench" } }, "de-DE"), "Bank");
  assert.equal(previewName({ id: "x", name: { en: "Bench" } }, "de"), "Bench");
  assert.equal(previewName({ id: "x", name: { fr: "Banc" } }, "de"), "Banc");
  assert.equal(previewName({ id: "x", name: {} }, "de"), "x");
});

test("a preview that adds, changes and removes nothing says so", () => {
  assert.equal(changesNothing(preview), false);
  assert.equal(changesNothing({ ...preview, changes: { added: [], changed: [], removed: [], unchanged: 3 } }), true);
  assert.equal(changesNothing({ ...preview, changes: { added: [], changed: [], removed: [{ id: "x", name: {} }], unchanged: 3 } }), false);
});
