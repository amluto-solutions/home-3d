import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeStep, type EscapeState } from "./editor-keys.ts";

const calm: EscapeState = { typing: false, menu: false, pipeDraft: false, pipeMode: false, drawing: false, item: false, tool: "select", room: false };

test("Escape in a box lets go of the box first (and keeps the selection)", () => {
  assert.equal(escapeStep({ ...calm, typing: true, item: true, tool: "furniture" }), "release");
});

test("with an item chosen while furnishing, Escape goes back to the library (the tool stays)", () => {
  assert.equal(escapeStep({ ...calm, item: true, tool: "furniture" }), "deselect_item");
});

test("with an item chosen in Select, Escape goes back to its room", () => {
  assert.equal(escapeStep({ ...calm, item: true, room: true }), "deselect_item");
});

test("a menu, a pipe being laid and a shape being drawn are undone before the selection", () => {
  assert.equal(escapeStep({ ...calm, menu: true, item: true }), "close_menu");
  assert.equal(escapeStep({ ...calm, pipeDraft: true, item: true }), "cancel_pipe");
  assert.equal(escapeStep({ ...calm, pipeMode: true, item: true }), "end_pipe_mode");
  assert.equal(escapeStep({ ...calm, drawing: true, item: true }), "clear_draft");
});

test("nothing chosen in another tool: Escape returns to Select; in Select it lets go of the room", () => {
  assert.equal(escapeStep({ ...calm, tool: "furniture" }), "select_tool");
  assert.equal(escapeStep({ ...calm, room: true }), "deselect");
});

test("an armed library card is cancelled after the menu and before a pipe, outline or selection (#76)", () => {
  assert.equal(escapeStep({ ...calm, menu: true, placing: true }), "close_menu");
  assert.equal(escapeStep({ ...calm, placing: true, pipeDraft: true, item: true, tool: "furniture" }), "cancel_place");
});
