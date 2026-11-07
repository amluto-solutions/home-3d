// Shared layout tokens (#246): one 4 px spacing scale, radius, type sizes and the 44 px touch minimum, inherited by every
// Home 3D part from the shared `tokens` sheet.
import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutVars, RADIUS, SPACE, TOUCH_MIN, TYPE } from "./design-tokens.ts";
import { tokens } from "./styles.ts";

test("every spacing step is a multiple of 4 px, with 8, 16 and 24 for rows, cards and gaps between cards (#246)", () => {
  for (const v of Object.values(SPACE)) assert.equal(v % 4, 0, `${v}`);
  const steps = Object.values(SPACE) as number[];
  for (const v of [4, 8, 12, 16, 24]) assert.ok(steps.includes(v), `${v}`);
});

test("6 px corners on controls, 8 px on cards and menus, a pill only for switches and chips (#246)", () => {
  assert.deepEqual({ ...RADIUS }, { control: 6, card: 8, pill: 999 });
});

test("type sizes: 14 body, 12 hints and labels, 15 card and 18 section headings; 44 px touch minimum (#246)", () => {
  assert.deepEqual({ ...TYPE }, { section: 18, card: 15, body: 14, hint: 12, label: 12 });
  assert.equal(TOUCH_MIN, 44);
});

test("the shared tokens sheet carries the layout variables to every part (#246)", () => {
  const css = tokens.cssText;
  for (const line of layoutVars().split("\n")) assert.ok(css.includes(line), line);
  assert.ok(css.includes("--fp3d-space-2: 8px;") && css.includes("--fp3d-radius-card: 8px;") && css.includes("--fp3d-touch: 44px;"));
});
