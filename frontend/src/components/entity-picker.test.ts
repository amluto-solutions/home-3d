// The entity picker (#132): likely entities first, the highlighted row is the one Enter takes, the chosen entity's
// id stays readable under the box, and the picker says whether its list is open (the editor's shortcuts wait).

import assert from "node:assert/strict";
import { test } from "node:test";
import { EntityPicker } from "./entity-picker.ts";

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
  { id: "light.attic", label: "Attic light", area: "attic" },
  { id: "switch.lounge_plug", label: "Lounge plug", area: "lounge" },
  { id: "light.lounge", label: "Lounge lamp", area: "lounge" },
];

function picker(): Record<string, any> {
  const p = new EntityPicker() as unknown as Record<string, any>;
  p.options = OPTIONS;
  p.fixed = [{ id: "none", label: "None" }];
  p.value = "none";
  p.prefer = { area: "lounge", domains: ["light"] };
  return p;
}

const key = (k: string) => ({ key: k, preventDefault() {}, stopPropagation() {} });

test("the open list puts the room's entities of the link's domain first (#132)", () => {
  const p = picker();
  p._open = true;
  assert.deepEqual(
    p.hits.map((o: { id: string }) => o.id),
    ["none", "light.lounge", "switch.lounge_plug", "light.attic"],
  );
});

test("typing moves the highlight to the first entity that matches, and Enter takes exactly that one (#132)", () => {
  const p = picker();
  const changes: string[] = [];
  p.dispatchEvent = (e: CustomEvent) => (changes.push(e.detail.value), true);
  p._open = true;
  p._query = "n";
  p.onQuery();
  const shown = p.hits;
  assert.equal(shown[p._cursor].id, "light.lounge", "the highlighted row is the first entity, not a fixed choice");
  assert.match(flat(p.render()), /class="cursor[^"]*"[^>]*>\s*<span>Lounge lamp/);
  p.onKey(key("Enter"));
  assert.deepEqual(changes, ["light.lounge"]);
  assert.equal(p.open, false);
});

test("the chosen entity's id shows on hover, its friendly name and live value in the box (#132, #396)", () => {
  const p = picker();
  p.value = "light.lounge";
  p.live = "On";
  const text = flat(p.render());
  assert.match(text, /title=light\.lounge/);
  assert.match(text, /\.value=Lounge lamp · On/);
  assert.doesNotMatch(text, /class="picked"/, "no raw id line under the box any more");
  p.value = "none";
  assert.doesNotMatch(flat(p.render()), /title=light/);
});

test("the picker says when its list is open (#132)", () => {
  const p = picker();
  assert.equal(p.open, false);
  p._open = true;
  assert.equal(p.open, true);
});
