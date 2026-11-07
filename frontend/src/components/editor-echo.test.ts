// One render per edit (#391): the panel hands the editor's own plan back as `building` after every edit; that echo is
// no update, and it never asks the backend for pack updates (a drag sent one websocket call per pointer move).
import assert from "node:assert/strict";
import { test } from "node:test";
import { echoedPlan } from "./editor/helpers.ts";
import { sameSet } from "../pack-updates.ts";
import { editorSource } from "./editor-source.ts";

test("the editor's own plan handed back is an echo; a plan from elsewhere is not", () => {
  const doc = { floors: [] };
  assert.equal(echoedPlan(doc, doc), true);
  assert.equal(echoedPlan({ ...doc }, doc), false);
  assert.equal(echoedPlan(undefined, undefined), false);
  assert.equal(echoedPlan(null, null), false);
});

test("an echo alone skips the update, and only a plan from elsewhere (or new packs) asks for pack updates", () => {
  const src = editorSource();
  assert.match(src, /if \(changed\.size === 1 && changed\.has\("building"\) && echoedPlan\(this\.building, this\._doc\)\) return false;/);
  assert.match(src, /const fromElsewhere = changed\.has\("building"\) && !echoedPlan\(this\.building, this\._doc\);/);
  assert.match(src, /if \(\(fromElsewhere \|\| changed\.has\("packs"\)\) && this\.isEditor && !this\.topic\) this\.refreshLibUpdates\(\);/);
  assert.doesNotMatch(src, /\(changed\.has\("building"\) \|\| changed\.has\("packs"\)\) && this\.isEditor/);
});

test("the same pack updates again are no new state (no third render)", () => {
  assert.equal(sameSet(new Set(["a", "b"]), new Set(["b", "a"])), true);
  assert.equal(sameSet(new Set(["a"]), new Set(["a", "b"])), false);
  assert.equal(sameSet(new Set(), new Set()), true);
  assert.match(editorSource(), /if \(!sameSet\(next, this\._libUpdates\)\) this\._libUpdates = next;/);
});
