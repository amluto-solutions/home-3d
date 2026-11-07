// Removing a room corner asks first when it would drop doors or windows or change a wall's height or thickness, and
// offers to keep the openings that fit on the joined wall (#206).

import assert from "node:assert/strict";
import { test } from "node:test";
import { setAskHost, type AskAnswer, type AskRequest } from "../ask.ts";
import type { Opening } from "../model.ts";
import { makeEditor, square } from "./editor-harness.ts";

const yes: AskAnswer = { ok: true, value: "" };
const no: AskAnswer = { ok: false, value: "" };
const door = (id: string, edge: number, offset: number): Opening =>
  ({ id, room_id: "r", edge, offset, width: 0.9, type: "door", sill: 0, height: 2, hinge: "left", leaves: 1, swing: "in", cover: null, contact: null, contact2: null, tilt: null }) as Opening;

/** A room that is a square with its corner 1 cut (a pentagon, so no corner lies in line) and doors near corner 1. */
async function setup(answers: AskAnswer[]) {
  const asked: AskRequest[] = [];
  setAskHost({ ask: async (req) => (asked.push(req), answers.shift() ?? no) });
  const r = square("r", 0, 0, 8, 6);
  r.points = [[0, 0], [8, 0], [8, 6], [4, 7], [0, 6]];
  const ed = await makeEditor([r]);
  ed._doc.floors[0].openings = [door("a", 0, 1), door("d", 1, 1.5), door("e", 2, 2)];
  ed.selectItem("room", "r");
  return { ed, asked };
}
const ids = (ed: Record<string, any>) => ed._doc.floors[0].openings.map((o: Opening) => o.id);

test("removing a corner that would drop openings asks, naming them; no keeps everything (#206)", async () => {
  const { ed, asked } = await setup([no]);
  await ed.deleteVertex(1);
  assert.equal(asked.length, 1);
  assert.match(asked[0].text, /2 doors and windows/);
  assert.equal(ed._doc.floors[0].rooms[0].points.length, 5, "the corner stays");
  assert.deepEqual(ids(ed), ["a", "d", "e"]);
});

test("yes, then 'Keep them' keeps the openings that fit at their distance along the joined wall (#206)", async () => {
  const { ed, asked } = await setup([yes, yes]);
  await ed.deleteVertex(1);
  assert.equal(asked.length, 2);
  assert.match(asked[1].text, /2 of the 2/);
  assert.equal(ed._doc.floors[0].rooms[0].points.length, 4);
  const [a, d, e] = ed._doc.floors[0].openings as Opening[];
  assert.deepEqual([a.id, a.edge, a.offset], ["a", 0, 1]);
  assert.deepEqual([d.id, d.edge, d.offset], ["d", 0, 9.5]);
  assert.equal(e.id, "e");
});

test("yes, then 'Drop them' removes the corner and its openings, as agreed (#206)", async () => {
  const { ed } = await setup([yes, no]);
  await ed.deleteVertex(1);
  assert.equal(ed._doc.floors[0].rooms[0].points.length, 4);
  assert.deepEqual(ids(ed), ["e"]);
});

test("a corner that costs nothing goes without a question (#206)", async () => {
  const { ed, asked } = await setup([]);
  // corner 3 touches edges 2 and 3 only: the door on edge 0 is not in its way
  ed._doc.floors[0].openings = [door("a", 0, 1)];
  await ed.deleteVertex(3);
  assert.equal(asked.length, 0);
  assert.equal(ed._doc.floors[0].rooms[0].points.length, 4);
  assert.deepEqual(ids(ed), ["a"]);
});

test("a different wall height or thickness is named in the question too (#206)", async () => {
  const { ed, asked } = await setup([no]);
  ed._doc.floors[0].openings = [];
  ed._doc.floors[0].rooms[0].wall_heights = [2.5, 2, null, null, null];
  await ed.deleteVertex(1);
  assert.equal(asked.length, 1);
  assert.match(asked[0].text, /height/);
  assert.doesNotMatch(asked[0].text, /doors and windows/);
});

test("no dialog host: the corner stays rather than dropping openings unasked (#206)", async () => {
  const { ed } = await setup([]);
  setAskHost(null as never);
  await ed.deleteVertex(1);
  assert.equal(ed._doc.floors[0].rooms[0].points.length, 5);
});
