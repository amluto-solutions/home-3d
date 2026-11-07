import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { bundledLanguages } from "./bundled-languages.fixture.ts";

// #217: a text of the UI lives in the English table (i18n.ts) or in a language pack, nowhere else. These tests fail when
// a per-language table, a lang/*.json file or a "German or English" switch for texts shows up in the sources again.

const SRC = new URL("./", import.meta.url);
const sources = (dir: URL): URL[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(new URL(`${e.name}/`, dir)) : e.name.endsWith(".ts") && !/\.(test|fixture)\.ts$/.test(e.name) ? [new URL(e.name, dir)] : [],
  );
const rel = (u: URL) => u.pathname.split("/src/")[1]!;

// Where a language test on a code is not about UI texts:
// - import/*: names given to floors and rooms of an imported plan (plan data, in the language the import was asked for)
// - library-index.ts: the decimal separator of a number
const OK_LANGUAGE_TESTS = /^(import\/|library-index\.ts$)/;

const LANG = "(?:de|en|fr|es|nl|it|hu|da|sv|nb|nn|fi|cs|pl|ro|sl|zh|pt)";
const PATTERNS: [string, RegExp][] = [
  ["a per-language block (de: { … })", new RegExp(String.raw`^\s*${LANG}\s*:\s*\{\s*$`, "m")],
  ["a table named for a language (DE = {…}, ITEMS_DE)", new RegExp(String.raw`\b(?:const|let)\s+(?:[A-Z][A-Z0-9]*_)?${LANG.toUpperCase()}\b|\b[A-Z][A-Z0-9]*_${LANG.toUpperCase()}\b`)],
  ["texts picked by language (…startsWith(\"de\") ? …)", new RegExp(String.raw`startsWith\("${LANG}"\)\s*\?`)],
  ["a text table by language (TEXT.de, T[lang])", /\b(?:TEXTS?|TABLES?|STRINGS|LABELS_BY_LANG)\.(?:de|en)\b|\bTEXTS\[/],
];

test("no source holds a string table of its own: texts are in the English table and the language packs", () => {
  const found: string[] = [];
  for (const file of sources(SRC)) {
    const name = rel(file);
    if (name === "i18n.ts") continue; // the English table
    const text = readFileSync(file, "utf8");
    for (const [what, re] of PATTERNS) {
      if (OK_LANGUAGE_TESTS.test(name) && what.startsWith("texts picked")) continue;
      if (re.test(text)) found.push(`${name}: ${what}`);
    }
  }
  assert.deepEqual(found, [], "move these texts into i18n.ts (English) and the language packs (custom_components/home_3d/bundled_languages)");
});

test("there is no lang/*.json next to the bundles, and the build neither copies nor reads one", () => {
  assert.equal(existsSync(new URL("../lang/", import.meta.url)), false, "frontend/lang is gone (#217)");
  const build = readFileSync(new URL("../build.mjs", import.meta.url), "utf8");
  assert.ok(!/copyFileSync\(`lang\//.test(build) && !/LANGS\b/.test(build), "build.mjs copies no language files");
  const core = readFileSync(new URL("./i18n-core.ts", import.meta.url), "utf8");
  assert.ok(!/lang\/\$\{|\.json\?v=|fetch\(/.test(core), "i18n-core.ts loads texts only from language packs");
});

test("every bundled language pack is a language pack and holds nothing but its texts", () => {
  const root = new URL("../../custom_components/home_3d/bundled_languages/", import.meta.url);
  const packs = bundledLanguages();
  assert.ok(packs.length >= 17);
  for (const { folder, pack, strings } of packs) {
    assert.equal(pack.kind, "language", folder);
    assert.ok(Object.keys(strings).length > 100, `${folder}: has texts`);
    const files = readdirSync(new URL(`${folder}/`, root)).sort();
    for (const f of files) assert.ok(["LICENSE", "README.md", "pack.json", "strings.json"].includes(f), `${folder}: ${f} is not part of a language pack`);
  }
  assert.deepEqual(readdirSync(root, { withFileTypes: true }).filter((e) => !e.isDirectory()).map((e) => e.name), [], "only pack folders in bundled_languages");
});
