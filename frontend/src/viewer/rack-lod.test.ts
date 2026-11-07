// Big racks stay fast (#121): a rack's gear in full detail only near the camera, a simple slab per piece further away.

import assert from "node:assert/strict";
import { test } from "node:test";
import { RACK_DETAIL_FAR, RACK_DETAIL_NEAR, rackDetailWanted } from "./rack-lod.ts";

test("a rack's gear shows in detail near the camera and as slabs further away (#121)", () => {
  assert.equal(rackDetailWanted(2, false, false), true, "close up: detail");
  assert.equal(rackDetailWanted(RACK_DETAIL_FAR + 1, false, false), false, "across the house: slabs");
  // the whole-house view of a usual home (radius 16 m) never pays for the detail
  assert.equal(rackDetailWanted(16, true, false), false);
});

test("the switch has some slack, so a camera resting at the distance does not flip it every frame (#121)", () => {
  const between = (RACK_DETAIL_NEAR + RACK_DETAIL_FAR) / 2;
  assert.ok(RACK_DETAIL_FAR > RACK_DETAIL_NEAR);
  assert.equal(rackDetailWanted(between, true, false), true, "stays detailed until past the far distance");
  assert.equal(rackDetailWanted(between, false, false), false, "stays a slab until inside the near distance");
});

test("the tablet level (low quality) switches to slabs sooner (#121)", () => {
  const d = RACK_DETAIL_NEAR - 0.5;
  assert.equal(rackDetailWanted(d, false, false), true);
  assert.equal(rackDetailWanted(d, false, true), false);
  assert.equal(rackDetailWanted(1.5, false, true), true, "right in front of it: detail on the tablet too");
});
