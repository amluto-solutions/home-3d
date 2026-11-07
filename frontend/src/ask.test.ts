import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { AskQueue, askConfirm, askText, askTyped, setAskHost, showText, tell, type AskRequest } from "./ask.ts";

const confirmQ = (text: string): AskRequest => ({ text, ok: "Delete", cancel: "Cancel", danger: true });

test("the dialog shows one question at a time; the next waits until the first is answered (#59)", async () => {
  const q = new AskQueue();
  const first = q.ask(confirmQ("Delete the floor?"));
  const second = q.ask(confirmQ("Delete the room?"));
  assert.equal(q.current?.text, "Delete the floor?");
  q.answer(true);
  assert.deepEqual(await first, { ok: true, value: "" });
  assert.equal(q.current?.text, "Delete the room?");
  q.answer(false);
  assert.deepEqual(await second, { ok: false, value: "" });
  assert.equal(q.current, null);
});

test("a question with a text field answers with what was typed (#59)", async () => {
  const q = new AskQueue();
  const named = q.ask({ text: "Name of the home", ok: "OK", cancel: "Cancel", input: "New home" });
  assert.equal(q.current?.input, "New home");
  q.answer(true, "Holiday flat");
  assert.deepEqual(await named, { ok: true, value: "Holiday flat" });
});

test("listeners hear every change of the open question (#59)", async () => {
  const q = new AskQueue();
  const seen: (string | null)[] = [];
  q.onChange = () => seen.push(q.current?.text ?? null);
  const a = q.ask(confirmQ("A?"));
  q.answer(false);
  await a;
  assert.deepEqual(seen, ["A?", null]);
});

test("askConfirm, askText and tell go through the page's one dialog (#59)", async () => {
  const asked: AskRequest[] = [];
  const answers = [
    { ok: true, value: "" },
    { ok: false, value: "" },
    { ok: true, value: "  Flat  " },
    { ok: true, value: "   " },
    { ok: false, value: "typed, then cancelled" },
    { ok: true, value: "" },
  ];
  setAskHost({ ask: async (req) => (asked.push(req), answers.shift()!) });
  try {
    assert.equal(await askConfirm("Delete?", { ok: "Delete", cancel: "Cancel", danger: true }), true);
    assert.equal(await askConfirm("Delete?", { ok: "Delete", cancel: "Cancel" }), false);
    assert.equal(await askText("Name", "New home", { ok: "OK", cancel: "Cancel" }), "Flat");
    assert.equal(await askText("Name", "x", { ok: "OK", cancel: "Cancel" }), null, "an empty name is no name");
    assert.equal(await askText("Name", "x", { ok: "OK", cancel: "Cancel" }), null);
    await tell("It did not work", { ok: "OK" });
    assert.equal(asked[0].danger, true);
    assert.equal(asked[2].input, "New home");
    assert.equal(asked[5].cancel, undefined, "a message has only the OK button");
  } finally {
    setAskHost(null);
  }
});

test("without a page to show the dialog on, a question is answered no and nothing breaks (#59)", async () => {
  setAskHost(null);
  assert.equal(await askConfirm("Delete?", { ok: "Delete", cancel: "Cancel" }), false);
  assert.equal(await askText("Name", "x", { ok: "OK", cancel: "Cancel" }), null);
  await tell("note", { ok: "OK" });
});

test("a long text is shown in the dialog to read and select, with an action and a close button (#84)", async () => {
  const asked: AskRequest[] = [];
  const answers = [
    { ok: true, value: "" },
    { ok: false, value: "" },
  ];
  setAskHost({ ask: async (req) => (asked.push(req), answers.shift()!) });
  try {
    assert.equal(await showText("Paste this into the chat", "Line 1\nLine 2", { ok: "Copy", cancel: "Close" }), true);
    assert.equal(await showText("Paste this into the chat", "Line 1\nLine 2", { ok: "Copy", cancel: "Close" }), false);
    assert.deepEqual(asked[0], { text: "Paste this into the chat", detail: "Line 1\nLine 2", ok: "Copy", cancel: "Close" });
  } finally {
    setAskHost(null);
  }
});

test("a typed confirmation is true only when the typed text matches, and the request carries the rule and the error (#330)", async () => {
  const asked: AskRequest[] = [];
  const answers = [
    { ok: true, value: "nope" },
    { ok: true, value: " Flat " },
    { ok: false, value: "Flat" },
  ];
  setAskHost({ ask: async (req) => (asked.push(req), answers.shift()!) });
  const labels = { ok: "Delete", cancel: "Cancel", danger: true, matches: (t: string) => t.trim() === "Flat", mismatch: "Not the name" };
  try {
    assert.equal(await askTyped("Type Flat", labels), false, "a wrong name never confirms, even if a host let it through");
    assert.equal(await askTyped("Type Flat", labels), true);
    assert.equal(await askTyped("Type Flat", labels), false, "cancel is no");
    assert.equal(asked[0]!.input, "");
    assert.equal(asked[0]!.mismatch, "Not the name");
    assert.equal(asked[0]!.matches!("Flat"), true);
  } finally {
    setAskHost(null);
  }
});

test("the dialog keeps a typed confirmation open: OK is disabled until the text matches and the error shows under the field (#330)", () => {
  const src = readFileSync(new URL("./components/ask-dialog.ts", import.meta.url), "utf8");
  // aria-disabled, not disabled, so tapping the dimmed button still answers with the error (#344)
  assert.match(src, /aria-disabled=\$\{!!req\.matches && !req\.matches\(this\.typed\) \? "true" : "false"\} @click=\$\{\(\) => this\.answer\(true\)\}/, "OK is dimmed until the text matches");
  assert.match(src, /setTimeout\(\(\) => this\.showWrong\(true\), 900\)/, "a wrong name is called wrong after a pause in typing (#344)");
  assert.match(src, /if \(ok && req\.matches && !req\.matches\(this\.typed\)\) \{\s*this\.showWrong\(\);\s*return;/, "a wrong answer returns before the dialog is answered");
  assert.match(src, /class="ask-error" role="alert"/, "the error is announced under the field");
  assert.match(src, /setTimeout\([\s\S]*5000\)/, "and goes after a few seconds");
});
