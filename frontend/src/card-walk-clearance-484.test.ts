import assert from "node:assert/strict";
import { test } from "node:test";
import { walkRightFor } from "./card-config.ts";

test("the walk button keeps clear of the card's own buttons as wide as they really are (#484)", () => {
  // no buttons: the usual 104 px
  assert.equal(walkRightFor([], 800), 104);
  // the fullscreen button alone (38 px wide at 10 px from the edge): the 104 px already clear it
  assert.equal(walkRightFor([752], 800), 104);
  // a dashboard button with a long label, 190 px wide from the edge: the walk button steps past it
  assert.equal(walkRightFor([800 - 10 - 190], 800), 208);
  // the widest (leftmost) of several counts
  assert.equal(walkRightFor([752, 560], 800), 248);
});
