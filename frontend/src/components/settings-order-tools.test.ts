// #326: every reorderable list in Settings has the same three compact icon buttons in a fixed column at the right.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { makeEditor } from "./editor-harness.ts";

/** Every value of a lit template, nested templates and arrays included, in order. */
function values(t: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(t)) t.forEach((x) => values(x, out));
  else if (t && typeof t === "object" && "values" in t) (t as { values: unknown[] }).values.forEach((x) => (typeof x === "object" ? values(x, out) : out.push(x)));
  return out;
}

test("up, down and remove buttons: the first can't go up, the last can't go down, each runs its action (#326)", async () => {
  const el = await makeEditor([]);
  const calls: string[] = [];
  const tools = (i: number, n: number) => values(el.orderTools("Scene", i, n, (by: number) => calls.push(`move${by}`), () => calls.push("remove")));
  const first = tools(0, 3);
  const handlers = first.filter((v) => typeof v === "function") as (() => void)[];
  assert.equal(handlers.length, 3);
  handlers.forEach((h) => h());
  assert.deepEqual(calls, ["move-1", "move1", "remove"]);
  // the booleans are the buttons' disabled flags: first row up, last row down
  const flags = (v: unknown[]) => v.filter((x) => typeof x === "boolean");
  assert.deepEqual(flags(first), [true, false, false]);
  assert.deepEqual(flags(tools(2, 3)), [false, true, false]);
  assert.deepEqual(flags(tools(0, 1)), [true, true, false]);
});

test("favourites and own buttons use the shared column, and the column is a fixed width (#326)", () => {
  const settings = readFileSync(new URL("./editor/settings.ts", import.meta.url), "utf8");
  assert.equal((settings.match(/this\.orderTools\(/g) ?? []).length, 2);
  assert.ok(!settings.includes('class="fp3d-pin"'), "no loose arrow buttons left in the Settings lists");
  const css = readFileSync(new URL("./editor/styles/forms.ts", import.meta.url), "utf8");
  assert.match(css, /\.fp3d-ord \{[^}]*repeat\(3, 32px\)/);
  assert.match(css, /fp3d-ord-row \{[^}]*grid-template-columns: minmax\(0, 1fr\) auto/);
});
