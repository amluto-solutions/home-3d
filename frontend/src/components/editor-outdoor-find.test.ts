// Finding outdoor areas (#401): a list of every floor's areas that goes to one, the garden drawn faintly from upstairs
// with an offer to go down, a wider pick margin for thin areas, and Fit taking the garden in.

import assert from "node:assert/strict";
import { test } from "node:test";
import { newFloor, type OutdoorArea } from "../model.ts";
import { thinArea } from "./editor/outdoor-find.ts";
import { makeEditor, planEl, square } from "./editor-harness.ts";

function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol" || typeof v === "boolean" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(v);
}

const lawn: OutdoorArea = { id: "lawn", type: "lawn", points: [[20, 0], [30, 0], [30, 8], [20, 8]], name: "Back garden" };
const path: OutdoorArea = { id: "path", type: "path", points: [[6, 0], [18, 0], [18, 0.8], [6, 0.8]] };
const fence: OutdoorArea = { id: "fence", type: "fence", points: [[0, 10], [10, 10], [10, 20]], open: true };
const balcony: OutdoorArea = { id: "balc", type: "balcony", points: [[0, -2], [3, -2], [3, 0], [0, 0]] };

async function editor() {
  const el = await makeEditor([square("lounge", 0, 0, 5, 4)]);
  el._doc.floors[0].name = "Ground";
  el._doc.floors[0].outdoor = [structuredClone(lawn), structuredClone(path), structuredClone(fence)];
  el._doc.floors.push({ ...newFloor("up", "Upper", 2.7), rooms: [square("bed", 0, 0, 5, 4)], outdoor: [structuredClone(balcony)] });
  return el;
}

test("the list holds every floor's outdoor areas, this floor's first: name or kind, size (a fence its length) and floor (#401)", async () => {
  const el = await editor();
  el._floorId = "up";
  const rows = el.outdoorRows();
  assert.deepEqual(rows.map((r: { id: string }) => r.id), ["balc", "lawn", "path", "fence"]);
  assert.deepEqual(rows.map((r: { name: string }) => r.name), ["Balcony", "Back garden", "Path", "Fence"]);
  assert.match(rows[1].note, /80.*m².*Ground/);
  assert.match(rows[3].note, /^20.*m · Ground$/, "an open fence: its length without the closing edge");
});

test("a row goes to the area: its floor, the area chosen and brought into view (#401)", async () => {
  const el = await editor();
  el._floorId = "up";
  el._view = { scale: 100, ox: 0, oy: 0 };
  assert.equal(el.goToOutdoor("f", "lawn"), true);
  assert.equal(el._floorId, "f");
  assert.equal(el._outdoorId, "lawn");
  const [x0] = el.toScreen([20, 0]);
  const [x1] = el.toScreen([30, 8]);
  assert.ok(x0 >= 0 && x1 <= el._size.w, "the whole lawn is in view");
  assert.equal(el.goToOutdoor("f", "gone"), false);
});

test("the floor page lists the outdoor areas like its items (#401)", async () => {
  const el = await editor();
  const shut = flat(el.renderOutdoorList());
  assert.match(shut, /Outdoor areas \(4\)/, "the fold's title counts the areas while it is closed (#413)");
  assert.match(shut, /data-fold=out-list/);
  assert.doesNotMatch(shut, /<fp3d-item-list/, "the fold is closed at first (#413)");
  el.outdoorListOpen = true;
  const out = flat(el.renderOutdoorList());
  assert.match(out, /<fp3d-item-list/, "opened, it holds the same list as the items");
});

test("from upstairs the garden shows faintly; a tap on it asks, and yes goes down and chooses it (#401)", async () => {
  const el = await editor();
  el._floorId = "up";
  const ghosts = flat(el.renderOutdoorGhosts(el.floor));
  assert.equal(ghosts.match(/data-out-ghost=/g)?.length, 3);
  assert.match(ghosts, /data-out-ghost=f:lawn/);
  assert.equal(flat(el.renderOutdoorGhosts(el._doc.floors[0])), "", "nothing from upstairs on the ground floor");
  const asked: string[] = [];
  el.ask = async (text: string) => (asked.push(text), true);
  el.press(2500, 400, { target: planEl({ "data-out-ghost": "f:lawn" }) });
  el.release(2500, 400);
  await new Promise((r) => setTimeout(r, 0));
  assert.match(asked[0]!, /Back garden is on Ground/);
  assert.equal(el._floorId, "f");
  assert.equal(el._outdoorId, "lawn");
});

test("a drag that starts on the faint garden pans the plan and asks nothing (#401)", async () => {
  const el = await editor();
  el._floorId = "up";
  let asked = 0;
  el.ask = async () => (asked++, true);
  const ox = el._view.ox;
  el.press(2500, 400, { target: planEl({ "data-out-ghost": "f:lawn" }) });
  el.move(2560, 400);
  el.release(2560, 400);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(asked, 0);
  assert.equal(el._view.ox, ox + 60);
  assert.equal(el._floorId, "up");
});

test("thin areas (paths, fences, hedges, anything under a metre across) get a wide invisible pick margin (#401)", async () => {
  assert.equal(thinArea(path), true);
  assert.equal(thinArea(fence), true);
  assert.equal(thinArea(lawn), false);
  assert.equal(thinArea({ id: "b", type: "bed", points: [[0, 0], [4, 0], [4, 0.5], [0, 0.5]] }), true);
  const el = await editor();
  const plan = flat(el.renderOutdoor(el.floor));
  assert.equal(plan.match(/fp3d-out-hit/g)?.length, 2, "the path and the fence, not the lawn");
  // a press on the margin (outside the drawn path) selects the path
  el.press(1200, 85, { target: planEl({ "data-outdoor": "path" }) });
  assert.equal(el._outdoorId, "path");
});

test("Fit takes the garden in with the Outside panel or the list open, from upstairs the garden below too (#401)", async () => {
  const el = await editor();
  el.fit();
  const plain = el._view.scale;
  el._toolMenu = "outside";
  el.fit();
  assert.ok(el._view.scale < plain, "zoomed out to the lawn");
  el._toolMenu = null;
  el.outdoorListOpen = true;
  el.fit();
  assert.ok(el._view.scale < plain);
  el.outdoorListOpen = false;
  el._floorId = "up";
  el.fit();
  const up = el._view.scale;
  el._toolMenu = "outside";
  el.fit();
  assert.ok(el._view.scale < up, "the garden below counts");
});

test("an area hidden from the list is not drawn on the plan, and it lets go of the selection (#401)", async () => {
  const el = await editor();
  el.selectItem("outdoor", "lawn");
  el.toggleItemHidden("lawn");
  assert.equal(el._outdoorId, null);
  assert.doesNotMatch(flat(el.renderOutdoor(el.floor)), /data-outdoor=lawn/);
});

/** The value bound to `name=` (a property or an event) of the tool panel element in a template. */
function bound(v: unknown, name: string): unknown {
  if (Array.isArray(v)) {
    for (const x of v) {
      const hit = bound(x, name);
      if (hit !== undefined) return hit;
    }
  } else if (v && typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    for (let i = 0; i < r.values.length; i++) {
      if (r.strings[i]!.endsWith(`${name}=`) && r.strings.slice(0, i + 1).join("").includes("<fp3d-tool-panel")) return r.values[i];
      const hit = bound(r.values[i], name);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}

test("two taps from any floor: Outside, then the area in its list goes to its floor and chooses it (#401)", async () => {
  const el = await editor();
  el._floorId = "up";
  el._toolMenu = "outside";
  const tpl = el.renderToolBar(el.floor);
  const rows = bound(tpl, ".areas") as { id: string; floor: string }[];
  assert.deepEqual(rows.map((r) => r.id), ["balc", "lawn", "path", "fence"]);
  const go = bound(tpl, "@area-go") as (e: unknown) => void;
  go({ detail: { floor: "f", id: "path" } });
  assert.equal(el._floorId, "f");
  assert.equal(el._outdoorId, "path");
  assert.equal(el._toolMenu, null, "the panel closes");
});
