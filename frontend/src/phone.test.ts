import assert from "node:assert/strict";
import { test } from "node:test";
import { isPhoneWidth, PHONE_MAX_PX, thumbsCompact } from "./phone.ts";

test("a phone is a screen up to about 600 px wide (#93)", () => {
  assert.equal(PHONE_MAX_PX, 600);
  assert.equal(isPhoneWidth(375), true);
  assert.equal(isPhoneWidth(600), true);
  assert.equal(isPhoneWidth(601), false);
  assert.equal(isPhoneWidth(1280), false);
});

test("on a phone the floor pictures start folded to plain buttons; the user's own choice wins (#93)", () => {
  assert.equal(thumbsCompact(null, true), true);
  assert.equal(thumbsCompact(null, false), false);
  assert.equal(thumbsCompact("0", true), false);
  assert.equal(thumbsCompact("1", false), true);
});

test("the narrow-phone rule is 480 px (#216); the View panel no longer folds after a pick (#247)", async () => {
  const phone = await import("./phone.ts");
  assert.equal(phone.PHONE_NARROW_MAX_PX, 480);
  assert.equal(phone.PHONE_NARROW_MEDIA, "(max-width: 480px)");
  assert.ok(!("closesViewMenuAfterPick" in phone));
});

test("size classes come from one place: phone to 600, compact to 1024, wide above, short up to 500 high (#246)", async () => {
  const { sizeClass, isShortHeight, COMPACT_MEDIA, WIDE_MEDIA, SHORT_MEDIA, PHONE_MEDIA } = await import("./phone.ts");
  assert.equal(sizeClass(390), "phone");
  assert.equal(sizeClass(600), "phone");
  assert.equal(sizeClass(601), "compact");
  assert.equal(sizeClass(800), "compact");
  assert.equal(sizeClass(1024), "compact");
  assert.equal(sizeClass(1025), "wide");
  assert.equal(sizeClass(1440), "wide");
  assert.equal(isShortHeight(390), true);
  assert.equal(isShortHeight(500), true);
  assert.equal(isShortHeight(844), false);
  assert.equal(PHONE_MEDIA, "(max-width: 600px)");
  assert.equal(COMPACT_MEDIA, "(min-width: 601px) and (max-width: 1024px)");
  assert.equal(WIDE_MEDIA, "(min-width: 1025px)");
  assert.equal(SHORT_MEDIA, "(max-height: 500px)");
});
