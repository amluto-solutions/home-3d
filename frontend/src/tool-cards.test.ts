// The Build and Outside panels' cards (#402): every tool the old menus had is a card, with a picture and texts.

import assert from "node:assert/strict";
import { test } from "node:test";
import { OUTDOOR_TYPES } from "./model.ts";
import { activeCard, cardsOf, howKey, recentCards, searchCards, TOOL_CARDS, useCard } from "./tool-cards.ts";
import { lateEnglish } from "./i18n-late.ts";
import { svg } from "lit";
import { toolPictures } from "./components/tool-pics.ts";

const PICTURED = toolPictures(svg).ids;

const en = lateEnglish as Record<string, string>;
const name = (id: string) => en[TOOL_CARDS.find((c) => c.id === id)!.name];

test("Build has every drawing tool of the old Build menu, Outside every area type, the four pool shapes and the pipes behind their rule (#402)", () => {
  assert.deepEqual(
    cardsOf("build", false).map((c) => c.tool),
    ["rect", "polygon", "measure", "wall", "opening", "hole", "roof"],
  );
  const outside = cardsOf("outside", false);
  assert.deepEqual(
    outside.filter((c) => c.outdoor).map((c) => c.outdoor).sort(),
    OUTDOOR_TYPES.filter((t) => t !== "pool").sort(),
  );
  assert.deepEqual(outside.filter((c) => c.pool).map((c) => c.pool), ["rect", "round", "oval", "free"]);
  assert.equal(outside.some((c) => c.pipes), false, "no pipes without a module's rules");
  assert.equal(cardsOf("outside", true).at(-1)?.id, "pool_pipes");
});

test("every card has a picture drawn in code, an English name and a how-to line for both area shapes (#402)", () => {
  for (const c of TOOL_CARDS) {
    assert.ok(PICTURED.includes(c.id), `${c.id}: picture`);
    assert.ok(en[c.name], `${c.id}: name ${c.name}`);
    assert.ok(en[howKey(c, false)], `${c.id}: ${howKey(c, false)}`);
    assert.ok(en[howKey(c, true)], `${c.id}: ${howKey(c, true)}`);
  }
  assert.equal(howKey(TOOL_CARDS.find((c) => c.id === "out_lawn")!, true), "hint_polygon", "an area drawn by its corners says so");
  assert.equal(howKey(TOOL_CARDS.find((c) => c.id === "pool_round")!, true), "tp_how_box", "a round pool keeps its own way");
});

test("the card in use follows the tool, the area type, the pool shape and the pipe mode (#402)", () => {
  const s = { tool: "select" as const, outdoorType: "lawn" as const, poolShape: "rect" as const, pipeMode: false };
  assert.equal(activeCard(s), null);
  assert.equal(activeCard({ ...s, tool: "polygon" }), "polygon");
  assert.equal(activeCard({ ...s, tool: "outdoor", outdoorType: "driveway" }), "out_driveway");
  assert.equal(activeCard({ ...s, tool: "pool", poolShape: "oval" }), "pool_oval");
  assert.equal(activeCard({ ...s, tool: "pool", pipeMode: true }), "pool_pipes");
  assert.equal(activeCard({ ...s, tool: "furniture" }), null);
});

test("search matches the shown name, the hint and English words, every word, without accents or case (#402)", () => {
  const text = (c: (typeof TOOL_CARDS)[number]) => en[c.name] ?? "";
  const ids = (q: string, group: "build" | "outside" = "outside") => searchCards(cardsOf(group, true), q, text).map((c) => c.id);
  assert.deepEqual(ids("drive"), ["out_driveway"]);
  assert.deepEqual(ids("PATIO"), ["out_terrace"]);
  assert.deepEqual(ids("round pool"), ["pool_round"]);
  assert.deepEqual(ids("stairs", "build"), ["hole"]);
  assert.deepEqual(ids("door", "build"), ["opening"]);
  assert.equal(ids("").length, cardsOf("outside", true).length);
  assert.deepEqual(ids("zzz"), []);
  assert.equal(name("pool_free"), "Free-form pool");
});

test("the last used cards come first, newest first, at most four, only the panel's own (#402)", () => {
  let recent: string[] = [];
  for (const id of ["out_lawn", "wall", "pool_round", "out_path", "out_lawn", "out_fence", "out_bed"]) recent = useCard(recent, id);
  assert.deepEqual(recent.slice(0, 3), ["out_bed", "out_fence", "out_lawn"]);
  assert.deepEqual(recentCards(cardsOf("outside", false), recent).map((c) => c.id), ["out_bed", "out_fence", "out_lawn", "out_path"]);
  assert.deepEqual(recentCards(cardsOf("build", false), recent).map((c) => c.id), ["wall"]);
  for (let i = 0; i < 20; i++) recent = useCard(recent, `x${i}`);
  assert.equal(recent.length, 12);
});
