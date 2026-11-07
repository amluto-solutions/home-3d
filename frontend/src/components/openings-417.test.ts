// #417 (MANY-5, ORDER-6, HELP-1): a door or window panel has one Type row with picture cards (every style and preset
// is a card), one hinge control, one "Opens" control, Sill and Sill height in one row, and the window sensor help as
// one line with an "i".

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DOOR_STYLES, GARAGE_STYLES, WINDOW_STYLES, type Opening } from "../model.ts";
import { OPENING_CARDS, openingCardOf, openingCardPatch } from "../opening-cards.ts";
import { OPENING_PIC_IDS } from "./editor/opening-pics.ts";
import { makeEditor, square } from "./editor-harness.ts";

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return typeof v === "object" ? "" : String(v);
}

const DOOR = { id: "d", room_id: "r", edge: 0, offset: 2, width: 0.9, type: "door", sill: 0, height: 2.05, hinge: "left", leaves: 1, swing: "in", cover: "none", contact: "none", contact2: null, tilt: null } as Opening;

async function editorWith(o: Opening) {
  const ed = await makeEditor([square("r", 0, 0, 5, 4)]);
  ed._doc.floors[0].openings = [structuredClone(o)];
  ed.selectItem("opening", o.id);
  return ed;
}
const form = (ed: Record<string, any>) => flat(ed.renderOpeningForm(ed.opening));

test("every door, window and garage style has a Type card, and every card a picture (#417)", () => {
  const styles = new Set(OPENING_CARDS.map((c) => `${c.group}:${c.style}`));
  for (const s of DOOR_STYLES) assert.ok(styles.has(`door:${s}`), s);
  for (const s of WINDOW_STYLES.filter((x) => x !== "standard")) assert.ok(styles.has(`window:${s}`), s);
  for (const s of GARAGE_STYLES.filter((x) => x !== "sectional")) assert.ok(styles.has(`garage:${s}`), s);
  assert.ok(OPENING_CARDS.some((c) => c.id === "cellar"), "the cellar window preset is a card (ORDER-6)");
  for (const c of OPENING_CARDS) assert.ok(OPENING_PIC_IDS.includes(c.id), `picture for ${c.id}`);
  assert.equal(new Set(OPENING_CARDS.map((c) => c.id)).size, OPENING_CARDS.length);
});

test("an opening shows the card of its kind and look (#417)", () => {
  assert.equal(openingCardOf(DOOR).id, "door", "a plain door stays automatic");
  assert.equal(openingCardOf({ ...DOOR, style: "sliding" }).id, "sliding");
  assert.equal(openingCardOf({ ...DOOR, leaves: 2 }).id, "door_double");
  const win = { ...DOOR, type: "window", sill: 0.9, height: 1.3 } as Opening;
  assert.equal(openingCardOf(win).id, "window");
  assert.equal(openingCardOf({ ...win, style: "bars" }).id, "window_bars");
  assert.equal(openingCardOf({ ...win, height: 0.5, sill: 1.75 }).id, "cellar");
  assert.equal(openingCardOf({ ...win, sill: 0, leaves: 2 }).id, "terrace_double");
  assert.equal(openingCardOf({ ...DOOR, type: "garage", style: "up_and_over" }).id, "up_and_over");
});

test("a card of the same shape changes only the look; another shape takes its size (#417)", () => {
  const sliding = OPENING_CARDS.find((c) => c.id === "sliding")!;
  assert.deepEqual(openingCardPatch({ ...DOOR, width: 1.2 }, sliding, 2.5), { type: "door", leaves: 1, style: "sliding" });
  const garage = OPENING_CARDS.find((c) => c.id === "garage")!;
  assert.equal(openingCardPatch(DOOR, garage, 2.5).width, 2.5);
  const cellar = OPENING_CARDS.find((c) => c.id === "cellar")!;
  assert.deepEqual(openingCardPatch({ ...DOOR, type: "window", sill: 0.9, height: 1.3 }, cellar, 2.5), { type: "window", leaves: 1, style: null, width: 1, height: 0.5, sill: 1.75 });
  const plain = OPENING_CARDS.find((c) => c.id === "window")!;
  assert.equal(openingCardPatch({ ...DOOR, type: "window", sill: 1.75, height: 0.5, width: 1 }, plain, 2.5).height, 1.3, "a cellar window back to a window gets its usual size");
});

test("a door panel has no duplicate control: one Type row, one hinge control, one Opens control (#417, MANY-5)", async () => {
  const ed = await editorWith(DOOR);
  const text = form(ed);
  assert.equal(text.match(/class="fp3d-type-row"/g)?.length, 1);
  assert.doesNotMatch(text, /Change this opening to|Swap hinge side|Reverse opening direction|>Style</);
  assert.equal(text.match(/Hinge \(seen from the room\)/g)?.length, 2, "one hinge label (and its group name)");
  assert.match(text, /Opens/);
  assert.match(text, /Inwards[^]*Outwards/);
  assert.doesNotMatch(text, /fp3d-oc"/, "the cards are closed at first");
});

test("the Type row opens the cards; a card changes the opening in one step and closes them (#417)", async () => {
  const ed = await editorWith(DOOR);
  ed.toggleOpeningTypes(ed.opening);
  const open = form(ed);
  assert.match(open, /aria-expanded=true/);
  assert.match(open, /data-card=sliding/);
  assert.match(open, /Doors[^]*Windows[^]*Garage doors/);
  const before = ed.history.steps;
  ed.pickOpeningCard(ed.opening, "sliding");
  assert.equal(ed.opening.style, "sliding");
  assert.equal(ed.history.steps, before + 1, "one undo step");
  assert.match(form(ed), /aria-expanded=false/);
  ed.pickOpeningCard(ed.opening, "garage");
  assert.equal(ed.opening.type, "garage");
  assert.ok(ed.opening.width <= 4.9 + 1e-9, "no wider than its wall");
});

test("hinge and opening direction are set by their segments (#417)", async () => {
  const ed = await editorWith(DOOR);
  ed.updateOpening({ hinge: "right" });
  assert.match(form(ed), /aria-pressed=true[^>]*>Right/);
  ed.updateOpening({ swing: "out" });
  assert.match(form(ed), /aria-pressed=true[^>]*>Outwards/);
});

test("a window has Sill and Sill height in one row and its sensor help as one line with an i (#417, ORDER-6, HELP-1)", async () => {
  const ed = await editorWith({ ...DOOR, id: "w", type: "window", sill: 0.9, height: 1.3 } as Opening);
  const text = form(ed);
  assert.match(text, /class="fp3d-pair fp3d-wide"[^]*Sill<[^]*Sill height/);
  assert.doesNotMatch(text, /Cellar window/, "the cellar preset is a card, not a button");
  assert.match(text, /Links the window's sensors and blind\./);
  assert.match(text, /class="fp3d-info"/);
  assert.doesNotMatch(text, /Homematic/, "the long help only opens from the i");
  assert.doesNotMatch(text, /Opens</, "a window above the floor does not swing out");
});

test("the Type cards and the segments use the scheme tokens and reach 44 px on touch (#417)", () => {
  const css = readFileSync(new URL("./editor/styles/type-cards.ts", import.meta.url), "utf8");
  assert.doesNotMatch(css, /(?:color|background|stroke|fill):\s*#/, "no fixed colours: the look's tokens");
  assert.match(css, /\.fp3d-type-row \{[^}]*min-height: 44px/);
  assert.match(css, /pointer: coarse[^]*min-height: 44px/);
});
