import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmGroup } from "./confirm-group.ts";

const name = (id: string) => id.split(".")[1].toUpperCase();

test("a group asks once, naming the devices that ask first", async () => {
  const asked: string[] = [];
  const yes = async (n: string) => (asked.push(n), true);
  const no = async (n: string) => (asked.push(n), false);
  const guarded = new Set(["cover.a", "cover.c"]);
  assert.equal(await confirmGroup(["cover.a", "cover.b", "cover.c"], guarded, name, yes), true);
  assert.deepEqual(asked, ["A, C"]);
  assert.equal(await confirmGroup(["cover.a", "cover.b"], guarded, name, no), false);
  assert.deepEqual(asked, ["A, C", "A"]);
});

test("a group without a device that asks first does not ask", async () => {
  const ask = async () => assert.fail("must not ask");
  assert.equal(await confirmGroup(["light.a", "light.b"], new Set(["cover.x"]), name, ask as never), true);
  assert.equal(await confirmGroup(["light.a"], null, name, ask as never), true);
  assert.equal(await confirmGroup([], new Set(["light.a"]), name, ask as never), true);
});
