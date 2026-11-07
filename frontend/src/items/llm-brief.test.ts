// The brief for an LLM (#14): the item editor copies it so someone can ask an LLM to design an item and paste the
// answer back in. It is written from the same lists and limits the backend checks (packs.py), so it cannot drift.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ITEM_FORMAT } from "../item-format.ts";
import { KINDS, ROOMS } from "../vocabulary.ts";
import { readItemFile } from "../custom-items.ts";
import { llmBrief } from "./llm-brief.ts";
import { englishTable } from "../i18n.ts";

const english = englishTable();

const PACKS_PY = readFileSync(new URL("../../../custom_components/home_3d/packs.py", import.meta.url), "utf8");

/** A module-level constant of packs.py (a list, a tuple or a number), read as JSON. */
function pyConstant(name: string): unknown {
  const start = PACKS_PY.match(new RegExp(`^${name}\\s*=\\s*`, "m"));
  assert.ok(start?.index !== undefined, `packs.py names ${name}`);
  let text = PACKS_PY.slice(start.index + start[0].length);
  const open = text[0];
  if (open === "[" || open === "(") {
    const close = open === "[" ? "]" : ")";
    let depth = 0;
    let end = 0;
    for (; end < text.length; end++) {
      if (text[end] === open) depth++;
      else if (text[end] === close && --depth === 0) break;
    }
    text = text.slice(0, end + 1);
  } else text = text.split("\n")[0];
  return JSON.parse(text.replace(/\(/g, "[").replace(/\)/g, "]").replace(/,(\s*)\]/g, "$1]").replace(/(\d)_(?=\d)/g, "$1"));
}

test("the brief's lists and limits are the ones the backend checks an item against", () => {
  assert.deepEqual(ITEM_FORMAT.shapes, pyConstant("PART_SHAPES"));
  assert.deepEqual(ITEM_FORMAT.colourRoles, pyConstant("COLOUR_ROLES"));
  assert.deepEqual(ITEM_FORMAT.partNames, pyConstant("PART_NAMES"));
  assert.deepEqual(ITEM_FORMAT.mounts, pyConstant("MOUNTS"));
  assert.deepEqual(ITEM_FORMAT.lights, pyConstant("LIGHTS"));
  assert.equal(ITEM_FORMAT.maxParts, pyConstant("MAX_PARTS"));
  assert.equal(ITEM_FORMAT.maxProfilePoints, pyConstant("MAX_PROFILE_POINTS"));
  assert.equal(ITEM_FORMAT.maxShellPoints, pyConstant("MAX_SHELL_POINTS"));
  assert.deepEqual(ITEM_FORMAT.taper, pyConstant("TAPER_RANGE"));
  assert.deepEqual(ITEM_FORMAT.metres, pyConstant("METRES_RANGE"));
  assert.deepEqual(ITEM_FORMAT.centre, pyConstant("FRACTION_RANGE"));
  assert.deepEqual(ITEM_FORMAT.extent, pyConstant("SPAN_RANGE"));
  assert.deepEqual(ITEM_FORMAT.level, pyConstant("LEVEL_RANGE"));
  assert.deepEqual(ITEM_FORMAT.round, pyConstant("ROUND_RANGE"));
  assert.deepEqual(ITEM_FORMAT.wallY, pyConstant("WALL_Y_RANGE"));
  assert.deepEqual(ITEM_FORMAT.rot, pyConstant("ROT_RANGE"));
  assert.equal(ITEM_FORMAT.maxRooms, pyConstant("MAX_ROOMS"));
  assert.equal(ITEM_FORMAT.maxTags, pyConstant("MAX_TAGS"));
  assert.equal(ITEM_FORMAT.maxTagLength, pyConstant("MAX_TAG_LENGTH"));
  assert.equal(ITEM_FORMAT.maxNameLength, pyConstant("MAX_NAME_LENGTH"));
});

test("the brief covers every shape, colour role, mount, light, section and room by its id", () => {
  const brief = llmBrief({ kinds: KINDS, rooms: ROOMS });
  const ids = [...ITEM_FORMAT.shapes, ...ITEM_FORMAT.colourRoles, ...ITEM_FORMAT.mounts, ...ITEM_FORMAT.lights, ...KINDS, ...ROOMS];
  for (const id of ids) assert.ok(brief.includes(`"${id}"`), `the brief names "${id}"`);
});

const BUNDLED = new URL("../../../custom_components/home_3d/bundled_packs/", import.meta.url);

/** The JSON blocks of a text (between ```json fences). */
function jsonBlocks(text: string): unknown[] {
  return [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
}

test("the brief shows real bundled items as examples, as their files hold them", () => {
  const examples = jsonBlocks(llmBrief({ kinds: KINDS, rooms: ROOMS })) as { id: string }[];
  assert.deepEqual(
    examples.map((e) => e.id),
    ["round_side_table_40", "vase"],
  );
  for (const [example, file] of [
    [examples[0], "amluto.living/table/round_side_table_40.json"],
    [examples[1], "amluto.decor/vase/vase.json"],
  ] as const) {
    // a family of variants is a pack's business, not an LLM's
    const { family: _f, variant: _v, ...item } = JSON.parse(readFileSync(new URL(file, BUNDLED), "utf8"));
    assert.deepEqual(example, item, file);
  }
});

test("an item an LLM wrote from the brief reads for import as it is (the backend test saves the same answer)", () => {
  const answer = readFileSync(new URL("../../../tests/fixtures/llm_item_answer.txt", import.meta.url), "utf8");
  for (const pasted of [answer, `\`\`\`json\n${answer}\`\`\``]) {
    const read = readItemFile(pasted, ["some_other_item"]);
    assert.ok("item" in read, "it reads as an item");
    assert.deepEqual(read.item, JSON.parse(answer));
    assert.equal(read.item.id, "oak_bedside_table");
  }
});

test("the brief says where in the item editor the answer goes, by the editor's own labels", () => {
  const brief = llmBrief({ kinds: KINDS, rooms: ROOMS });
  assert.ok(brief.includes(`${english.ie_paste} → ${english.ie_paste_import}`), "the paste box and its button");
  assert.ok(brief.includes(english.ie_import), "the file import");
});

test("the brief lets the LLM answer several items as one JSON list, which the paste box takes (#84)", () => {
  const brief = llmBrief({ kinds: KINDS, rooms: ROOMS });
  assert.match(brief, /several items[^.]*JSON list/i);
});
