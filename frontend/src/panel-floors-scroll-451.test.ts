// #451 (NeonPlan 3D 3.1.1, MIT, Mastershort): on a desktop the floor row keeps its thin scrollbar's room all the time, so
// the row has the same height with and without the pointer on it. The rule is read from the panel's source (the CSS
// has no layout in Node).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = readFileSync(new URL("./panel.ts", import.meta.url), "utf8");

test("the floor row has a transparent thin scrollbar on a mouse desktop and only colours it on hover (#451)", () => {
  const m = src.match(/@media \(hover: hover\) and \(pointer: fine\) \{\s*\.fp3d-floors \{([^}]*)\}\s*\.fp3d-floors:hover \{([^}]*)\}/);
  assert.ok(m, "a desktop-only rule for the row");
  assert.match(m![1], /scrollbar-width: thin/);
  assert.match(m![1], /scrollbar-color: transparent transparent/);
  assert.doesNotMatch(m![2], /scrollbar-width/, "hover changes only the colour, never the width");
});

test("a touch screen keeps the thin scrollbar on hover only (#451)", () => {
  assert.match(src, /@media not all and \(hover: hover\) and \(pointer: fine\) \{\s*\.fp3d-floors:hover \{\s*scrollbar-width: thin/);
});
