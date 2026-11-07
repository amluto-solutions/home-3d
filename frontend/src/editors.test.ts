import assert from "node:assert/strict";
import { test } from "node:test";
import { lastAdmin, pickEditor, pickTabletUser, type EditorUser } from "./editors.ts";

const users: EditorUser[] = [
  { id: "a1", name: "Admin", is_admin: true, editor: true },
  { id: "a2", name: "Tablet", is_admin: true, editor: true },
  { id: "u1", name: "Partner", is_admin: false, editor: false },
];

test("ticking a non-admin adds them to the editors", () => {
  assert.deepEqual(pickEditor(users, "u1", true), ["a1", "a2", "u1"]);
});

test("unticking an admin leaves them off the list", () => {
  assert.deepEqual(pickEditor(users, "a2", false), ["a1"]);
});

test("the last admin on the list cannot be unticked", () => {
  const one = users.map((u) => (u.id === "a2" ? { ...u, editor: false } : u));
  assert.equal(lastAdmin(one, "a1"), true);
  assert.equal(lastAdmin(users, "a1"), false);
  assert.equal(lastAdmin(one, "u1"), false);
});

test("ticking a user as a wall tablet adds them once, unticking removes them, others stay (#92)", () => {
  assert.deepEqual(pickTabletUser(undefined, "wall", true), ["wall"]);
  assert.deepEqual(pickTabletUser(["wall"], "wall", true), ["wall"]);
  assert.deepEqual(pickTabletUser(["wall", "kitchen"], "wall", false), ["kitchen"]);
  assert.deepEqual(pickTabletUser(["kitchen"], "wall", false), ["kitchen"]);
});
