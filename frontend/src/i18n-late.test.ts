import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { lateEnglish } from "./i18n-late.ts";
import { englishTable } from "./i18n.ts";

// The English texts that only the lazy bundles show are a chunk of their own (i18n-late.ts); a text any module of the
// main bundle, the 3D bundle, the flat plan or the fun packs names must stay in the table every page carries (i18n.ts).

const here = dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(["i18n.ts", "i18n-late.ts", "i18n-core.ts", "i18n-borrowed.ts", "i18n-late-none.ts", "i18n-register-late.ts"]);

/** The source files an entry reaches by import statements and literal dynamic imports (type-only imports are not code). */
function reach(entries: string[]): Map<string, string> {
  const seen = new Map<string, string>();
  const todo = entries.map((e) => resolve(here, e));
  while (todo.length) {
    const file = todo.pop()!;
    if (seen.has(file) || !existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    seen.set(file, text);
    for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\b)[^"';]*?from\s+"(\.[^"]+\.ts)"|(?:^|\n)\s*import\s+"(\.[^"]+\.ts)"|\bimport\("(\.[^"]+\.ts)"\)/g)) {
      const rel = m[1] ?? m[2] ?? m[3]!;
      todo.push(resolve(dirname(file), rel));
    }
  }
  return seen;
}

test("no text of the lazy-bundle table is named by code every page loads", () => {
  const files = reach(["main.ts", "viewer/viewer3d.ts", "plan2d/entry.ts", "fun/entry.ts"]);
  const words = new Set<string>();
  for (const [file, text] of files) {
    if (SKIP.has(file.slice(here.length + 1).split("\\").join("/"))) continue;
    for (const w of text.match(/[A-Za-z0-9_]+/g) ?? []) words.add(w);
  }
  const wrong = Object.keys(lateEnglish).filter((k) => words.has(k));
  assert.deepEqual(wrong, [], "these keys belong in i18n.ts");
});

// a prefix: "name_" or `name_ followed by ${ or a +
const PREFIX = /[`"']([a-z0-9]+(?:_[a-z0-9]+)*_)(?:\$\{|["']\s*\+)/g;

test("a key built from a prefix in code every page loads stays in the main table", () => {
  const files = reach(["main.ts", "viewer/viewer3d.ts", "plan2d/entry.ts", "fun/entry.ts"]);
  const prefixes = new Set<string>();
  for (const text of files.values()) for (const m of text.matchAll(PREFIX)) prefixes.add(m[1]!);
  const wrong = Object.keys(lateEnglish).filter((k) => [...prefixes].some((p) => k.startsWith(p)));
  assert.deepEqual(wrong, [], "these keys belong in i18n.ts");
});

test("the two tables hold every key once", () => {
  const table = englishTable() as Record<string, string>;
  assert.equal(Object.keys(table).length, 1142 + Object.keys(lateEnglish).length);
  assert.ok(table.no_building_admin);
});
