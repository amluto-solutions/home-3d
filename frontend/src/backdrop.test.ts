import assert from "node:assert/strict";
import { test } from "node:test";
import { backdropCss, backdropImage } from "./backdrop.ts";

test("no backdrop or the default keeps the look's own sky", () => {
  assert.equal(backdropCss(null), null);
  assert.equal(backdropCss({}), null);
});

test("a colour, a gradient and a picture behind a veil", () => {
  assert.equal(backdropCss({ kind: "color", color: "#112233" }), "#112233");
  assert.equal(backdropCss({ kind: "gradient", color: "#112233", color2: "#000000" }), "linear-gradient(180deg, #112233, #000000)");
  assert.match(backdropCss({ kind: "image", image: "/local/garden.jpg", dim: 0.3 })!, /rgba\(4, 8, 16, 0.3\).*url\("\/local\/garden.jpg"\)/);
  // a broken colour falls back to the dark blue
  assert.equal(backdropCss({ kind: "color", color: "red; x" }), "#0b1426");
});

test("only safe picture addresses get into the CSS", () => {
  assert.equal(backdropImage("https://example.org/a.jpg"), "https://example.org/a.jpg");
  assert.equal(backdropImage("/local/bg.png"), "/local/bg.png");
  assert.equal(backdropImage("javascript:alert(1)"), null);
  assert.equal(backdropImage('/local/a.jpg") ; x'), null);
  assert.equal(backdropCss({ kind: "image", image: "" }), null);
});
