// A restore point whose picture is no longer kept restores without it and says so (#154).

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor, square } from "./editor-harness.ts";

async function restoring(missingInList: number, missingRestored: number) {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)]);
  const asked: string[] = [];
  ed.hass = {
    ...ed.hass,
    callWS: async (msg: Record<string, unknown>) => {
      if (msg.type === "home_3d/history/restore") return { revision: 7, missing_pictures: missingRestored };
      if (msg.type === "home_3d/history/list") return { snapshots: [] };
      throw new Error(`unexpected ${String(msg.type)}`);
    },
  };
  ed.ask = async (text: string) => (asked.push(text), true);
  const snap = { id: "p1", revision: 3, saved_at: 1_700_000_000, floors: 1, rooms: 1, furniture: 0, missing_pictures: missingInList };
  await ed.restoreFromHistory(snap);
  return { asked, notice: ed._notice as string };
}

test("restoring a restore point that lacks pictures warns first and says so after (#154)", async () => {
  const { asked, notice } = await restoring(2, 2);
  assert.match(asked[0], /2 of its pictures are no longer kept/);
  assert.equal(notice, "Restored without 2 pictures that are no longer kept.");
});

test("a restore point with all its pictures restores as before", async () => {
  const { asked, notice } = await restoring(0, 0);
  assert.doesNotMatch(asked[0], /no longer kept/);
  assert.equal(notice, "Restored.");
});
