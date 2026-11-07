// The toolbar's Build and Outside panels (#402): a card picks its tool with its kind and shape, the area shape choice
// follows the Outside panel, and the panel closes; the drop-down menus with their chips are gone.

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor, square } from "./editor-harness.ts";

function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol" || typeof v === "boolean" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(v);
}

/** The property values given to the tool panel element in a template (`.name=${value}`). */
function props(v: unknown, out: Record<string, unknown> = {}): Record<string, unknown> {
  if (Array.isArray(v)) v.forEach((x) => props(x, out));
  else if (v && typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    r.values.forEach((x, i) => {
      const m = /[.?]([a-z]+)=$/.exec(r.strings[i]!);
      if (m && r.strings.slice(0, i + 1).join("").includes("<fp3d-tool-panel")) out[m[1]!] ??= x;
      props(x, out);
    });
  }
  return out;
}

async function editor() {
  const el = await makeEditor([square("lounge", 0, 0, 5, 4)]);
  el.renderRoot.querySelector = () => null;
  return el;
}

test("Build and Outside open a panel of cards, not a menu of chips; closed, there is none (#402)", async () => {
  const el = await editor();
  let bar = flat(el.renderToolBar(el.floor));
  assert.doesNotMatch(bar, /fp3d-tool-panel|fp3d-menu-sub/);
  assert.match(bar, /data-group=build aria-pressed= aria-haspopup="dialog"/);
  el._toolMenu = "build";
  const tpl = el.renderToolBar(el.floor);
  bar = flat(tpl);
  assert.match(bar, /<fp3d-tool-panel/);
  assert.doesNotMatch(bar, /fp3d-menu-sub|role="menu"/);
  const p = props(tpl);
  assert.equal(p.group, "build");
  assert.deepEqual((p.cards as { id: string }[]).map((c) => c.id), ["rect", "polygon", "measure", "wall", "opening", "hole", "roof"]);
  el._toolMenu = "outside";
  const out = props(el.renderToolBar(el.floor));
  assert.equal((out.cards as { id: string }[]).length, 14, "ten area types and four pool shapes");
  Object.defineProperty(el, "pipeRules", { get: () => ({}), configurable: true });
  assert.equal((props(el.renderToolBar(el.floor)).cards as { id: string }[]).at(-1)!.id, "pool_pipes", "the pipes behind their rule");
});

test("a card sets its tool, kind and shape and closes the panel; the group's button names it (#402)", async () => {
  const el = await editor();
  el._toolMenu = "outside";
  el.pickToolCard("out_driveway");
  assert.equal(el._toolMenu, null);
  assert.equal(el._tool, "outdoor");
  assert.equal(el._outdoorType, "driveway");
  assert.equal(el._outdoorFree, false);
  assert.match(flat(el.renderToolBar(el.floor)), /Outside: Driveway/);
  el.pickToolCard("measure");
  assert.equal(el._tool, "measure");
  assert.match(flat(el.renderToolBar(el.floor)), /Build: Room by measurements/);
  el.pickToolCard("pool_oval");
  assert.deepEqual([el._tool, el._poolShape, el._outdoorFree, el._pipeMode], ["pool", "oval", false, false]);
  el.pickToolCard("pool_free");
  assert.equal(el._outdoorFree, true);
  el.pickToolCard("pool_pipes");
  assert.deepEqual([el._tool, el._pipeMode], ["pool", true]);
});

test("the Outside panel's shape choice: areas by their corners, kept when a pool shape is picked in between (#402)", async () => {
  const el = await editor();
  el.pickToolCard("out_lawn");
  el.setAreaFree(true);
  assert.equal(el._outdoorFree, true, "the area tool in use follows at once");
  el.pickToolCard("pool_round");
  assert.equal(el._outdoorFree, false);
  el.pickToolCard("out_path");
  assert.equal(el._outdoorFree, true, "the next area is drawn by its corners again");
  el.setTool("select");
  el.setAreaFree(false);
  assert.equal(el._areaFree, false);
});

test("Escape in the panel closes it; the phone draws it as a sheet above the bar (#402)", async () => {
  const el = await editor();
  el._toolMenu = "build";
  el.closeToolPanel(true);
  assert.equal(el._toolMenu, null);
  el._phone = true;
  el._toolMenu = "outside";
  assert.equal(props(el.renderToolBar(el.floor)).sheet, true);
});
