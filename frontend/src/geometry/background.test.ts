import assert from "node:assert/strict";
import { test } from "node:test";
import type { Background, Vec2 } from "../model.ts";
import { emptyBuilding, newFloor } from "../model.ts";
import { backgroundMiddle, turnedBackground } from "./background.ts";
import { shiftBy, transformPlan, turnAbout } from "../plan-transform.ts";

const bg: Background = { image_id: "img", x: 2, z: 1, width: 8, opacity: 0.5, rotation: 0 };

test("turning the floor turns a picture that is not square about its middle, so it stays under the rooms (#1124)", () => {
  // a picture 8 m wide and 4 m high (aspect 0.5), turned about (5, 5)
  const t = turnAbout(5, 5);
  const after = turnedBackground(bg, 0.5, t.point);
  assert.deepEqual(backgroundMiddle(after, 0.5), t.point(backgroundMiddle(bg, 0.5)));
  assert.equal(after.rotation, 90);
  assert.equal(after.width, 8);
  // four turns bring it back
  let b = bg;
  for (let i = 0; i < 4; i++) b = turnedBackground(b, 0.5, t.point);
  assert.deepEqual(b, { ...bg, rotation: 0 });
});

test("Turn floor passes the picture's aspect to the turn; a shift moves its corner as before (#1124)", () => {
  const doc = emptyBuilding();
  doc.floors = [{ ...newFloor("g", "Ground", 0), background: { ...bg } }];
  const t = turnAbout(5, 5);
  transformPlan(doc, null, t, (id) => (id === "img" ? 0.5 : undefined));
  const got = { ...doc.floors[0].background! };
  assert.deepEqual(backgroundMiddle(got, 0.5), t.point(backgroundMiddle(bg, 0.5)) as Vec2);
  assert.equal(got.rotation, 90);
  transformPlan(doc, null, shiftBy(1, -2), () => 0.5);
  assert.deepEqual([doc.floors[0].background!.x, doc.floors[0].background!.z, doc.floors[0].background!.rotation], [got.x + 1, got.z - 2, 90]);
});
