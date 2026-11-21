import assert from "node:assert/strict";
import { test } from "node:test";
import { overlapInfo } from "./overlap-rooms.ts";

const rooms = [{ id: "a", name: "Hall" }, { id: "b", name: "Kitchen" }, { id: "c", name: "" }, { id: "d", name: "Study" }];

test("the overlap warning names the rooms, counts the rest and selects the first (#1195)", () => {
  const info = overlapInfo(rooms, ["overlap:a:b", "overlap:b:a", "overlap:c:d", "overlap:d:a", "other:x"]);
  assert.deepEqual(info.shown, ["Hall / Kitchen", "? / Study"]);
  assert.equal(info.more, 1, "the same pair twice counts once");
  assert.equal(info.first, "a");
  assert.equal(info.all, "Hall / Kitchen, ? / Study, Study / Hall");
});

test("no overlap warning, or a room that is gone, selects nothing", () => {
  assert.equal(overlapInfo(rooms, []).first, null);
  assert.equal(overlapInfo(rooms, ["overlap:zz:a"]).first, null);
});
