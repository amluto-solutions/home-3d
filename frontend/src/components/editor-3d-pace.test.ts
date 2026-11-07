// The 3D view beside the editor's plan (#389): a state change reaches it at most once a second, and a sync that finds
// the same household list or no floor pictures again changes no reactive state (no second update of the view).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { EDITOR_SYNC_MS, pacedSyncDelay } from "../viewer/pace.ts";
import { sameHousehold } from "../household.ts";
import { editorSource } from "./editor-source.ts";

test("a paced state change waits for the rest of the pace; unpaced or late ones show at once", () => {
  assert.equal(pacedSyncDelay(200, EDITOR_SYNC_MS), EDITOR_SYNC_MS - 200);
  assert.equal(pacedSyncDelay(EDITOR_SYNC_MS + 5, EDITOR_SYNC_MS), 0);
  assert.equal(pacedSyncDelay(10, 0), 0);
  assert.ok(EDITOR_SYNC_MS >= 500 && EDITOR_SYNC_MS <= 1000);
});

test("the editor's 3D pane is paced; the House view is not", () => {
  assert.match(editorSource(), /\.syncPace=\$\{EDITOR_SYNC_MS\}/);
  const view = readFileSync(new URL("./view3d.ts", import.meta.url), "utf8");
  assert.match(view, /syncPace = 0;/);
  // the pace never holds back a forced sync (a new plan, the look, the packs)
  assert.match(view, /if \(!force && !timed && this\.syncPace > 0 && !this\.replay\)/);
});

test("the same household lines are the same list: no new array, no second update after a sync", () => {
  const a = [{ icon: "trash-can", text: "Bins out", entity: "sensor.sample_bins", hot: true }, { icon: "pin-outline", text: "Milk", entity: null }];
  assert.equal(sameHousehold(a, a.map((x) => ({ ...x }))), true);
  assert.equal(sameHousehold(a, [a[0]]), false);
  assert.equal(sameHousehold(a, [{ ...a[0], hot: false }, a[1]]), false);
  assert.equal(sameHousehold([], []), true);
  const view = readFileSync(new URL("./view3d.ts", import.meta.url), "utf8");
  assert.match(view, /if \(!sameHousehold\(household, this\._household\)\) this\._household = household;/);
  assert.match(view, /if \(this\._thumbs\.length\) this\._thumbs = \[\];/);
});
