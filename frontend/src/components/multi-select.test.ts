// The searchable multi-select (#227) and its use for the editors and wall tablet user lists.

import assert from "node:assert/strict";
import { test } from "node:test";
import { MultiSelect } from "./multi-select.ts";
import { personUserIds, userChoices, type EditorUser } from "../editors.ts";

/** Every string and value of a lit template, flattened into one text. */
function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return String(v);
}

const OPTIONS = [
  { id: "a", label: "Alex", note: "admin" },
  { id: "b", label: "Blake" },
  { id: "s", label: "Backup service", secondary: true },
];

function select(value: string[] = []): Record<string, any> {
  const m = new MultiSelect() as unknown as Record<string, any>;
  m.options = OPTIONS;
  m.value = value;
  m.label = "Editors";
  m.secondaryLabel = "Show service users";
  m.removeLabel = "Remove {name}";
  const changes: string[][] = [];
  m.dispatchEvent = (e: CustomEvent) => (changes.push(e.detail.value), true);
  m.changes = changes;
  return m;
}

const key = (k: string) => ({ key: k, preventDefault() {}, stopPropagation() {} });

test("picks show as chips with a labelled remove button", () => {
  const m = select(["a", "b"]);
  const html = flat(m.render());
  assert.match(html, /class="chip">Alex/);
  assert.match(html, /aria-label=Remove Alex/);
  m.dropPick("a");
  assert.deepEqual(m.changes, [["b"]]);
});

test("the list hides service options behind the toggle, and search filters the rest", () => {
  const m = select();
  m._open = true;
  assert.deepEqual(m.rows.map((o: { id: string }) => o.id), ["a", "b"]);
  assert.equal(m.hiddenCount, 1);
  m._more = true;
  assert.deepEqual(m.rows.map((o: { id: string }) => o.id), ["a", "b", "s"]);
  m._query = "bl";
  assert.deepEqual(m.rows.map((o: { id: string }) => o.id), ["b"]);
  assert.match(flat(m.render()), /Show service users/);
});

test("a picked service option stays visible while the toggle is off", () => {
  const m = select(["s"]);
  assert.deepEqual(m.rows.map((o: { id: string }) => o.id), ["a", "b", "s"]);
});

test("Enter ticks the highlighted row and keeps the list open; ticking again unticks", () => {
  const m = select();
  m._open = true;
  m.onKey(key("ArrowDown"));
  m.onKey(key("Enter"));
  assert.deepEqual(m.value, ["b"]);
  assert.equal(m.open, true);
  m.onKey(key("Enter"));
  assert.deepEqual(m.value, []);
});

test("Backspace in an empty box removes the last chip; Escape closes", () => {
  const m = select(["a", "b"]);
  m._open = true;
  m.onKey(key("Backspace"));
  assert.deepEqual(m.value, ["a"]);
  m.onKey(key("Escape"));
  assert.equal(m.open, false);
});

test("a locked pick (the last admin) has no remove button and survives Backspace", () => {
  const m = select(["a", "b"]);
  m.locked = ["a"];
  assert.doesNotMatch(flat(m.render()), /aria-label=Remove Alex/);
  m.onKey(key("Backspace"));
  m.onKey(key("Backspace"));
  assert.deepEqual(m.value, ["a"]);
  m.toggle("a");
  assert.deepEqual(m.value, ["a"]);
});

test("a disabled select changes nothing", () => {
  const m = select(["a"]);
  m.disabled = true;
  m.toggle("b");
  m.dropPick("a");
  assert.deepEqual(m.value, ["a"]);
});

const users: EditorUser[] = [
  { id: "svc", name: "Backup", is_admin: false, editor: false },
  { id: "p2", name: "Zed", is_admin: false, editor: true },
  { id: "p1", name: "Amy", is_admin: false, editor: false },
  { id: "ad", name: "Root", is_admin: true, editor: true },
];

test("users: real people first (admins, then by name), users with no person attached last as service users", () => {
  const persons = personUserIds({ "person.amy": { attributes: { user_id: "p1" } }, "person.zed": { attributes: { user_id: "p2" } }, "person.root": { attributes: { user_id: "ad" } }, "light.x": { attributes: { user_id: "svc" } } });
  const rows = userChoices(users, persons);
  assert.deepEqual(rows.map((r) => [r.id, r.secondary]), [["ad", false], ["p1", false], ["p2", false], ["svc", true]]);
  assert.equal(rows[0].note, "admin");
});

test("users: without any person entity nobody is a service user", () => {
  assert.ok(userChoices(users, new Set()).every((r) => !r.secondary));
});

test("with noSearch (#306) there is no search field: the box takes the focus and the keys, the list still opens and moves", () => {
  const shown = flat(select().render());
  assert.match(shown, /<input\s+type="text"/, "the search field shows by default");
  const m = select();
  m.noSearch = true;
  const out = flat(m.render());
  assert.doesNotMatch(out, /<input\s+type="text"/, "no text field, so no keyboard");
  assert.match(out, /<span class="pick" tabindex="0" role="combobox"/);
  m.onKey(key("ArrowDown"));
  assert.equal(m.open, true, "arrows open the list");
  m.onKey(key("ArrowDown"));
  m.onKey(key("Enter"));
  assert.deepEqual(m.value, ["b"], "the arrows move the cursor and Enter ticks the option");
});
