// The room panel's list as an editor arranges it (#229): pinned rows on top, rows and groups in the chosen order,
// stale ids ignored, and the steps of "Edit list".
import assert from "node:assert/strict";
import { test } from "node:test";
import { kindOf } from "./devices.ts";
import type { Building } from "./model.ts";
import { arrangePanel, groupOrder, PANEL_GROUPS, sortByOrder } from "./panel-layout.ts";
import { moveIn, storePanelChoice, tidyLayout, toggleHidden, togglePinned, withGroupOrder, withPinnedOrder, withRowOrder } from "./panel-layout-edit.ts";

const IDS = ["light.sample_a", "light.sample_b", "cover.sample_blind", "switch.sample_fan", "sensor.sample_temp", "scene.sample_movie"];

test("without a layout the panel lists its groups and rows as before", () => {
  const a = arrangePanel(IDS, kindOf, undefined);
  assert.deepEqual(a.pinned, []);
  assert.deepEqual(
    a.groups.map((g) => g.group),
    ["lights", "covers", "switches", "sensors", "scenes"],
  );
  assert.deepEqual(a.groups[0].ids, ["light.sample_a", "light.sample_b"]);
});

test("pinned rows come first in their order and leave their group", () => {
  const a = arrangePanel(IDS, kindOf, { pinned: ["switch.sample_fan", "light.sample_b"] });
  assert.deepEqual(a.pinned, ["switch.sample_fan", "light.sample_b"]);
  assert.deepEqual(a.groups[0].ids, ["light.sample_a"]);
  assert.ok(!a.groups.some((g) => g.group === "switches"), "an emptied group is left out");
});

test("rows follow the chosen order within their group; rows it does not name follow after", () => {
  const ids = [...IDS, "light.sample_c"];
  const a = arrangePanel(ids, kindOf, { order: ["light.sample_b", "light.sample_a"] });
  assert.deepEqual(a.groups[0].ids, ["light.sample_b", "light.sample_a", "light.sample_c"]);
});

test("groups follow the chosen order; unknown names and the rest are handled", () => {
  assert.deepEqual(groupOrder({ groups: ["scenes", "nonsense", "covers", "scenes"] }).slice(0, 3), ["scenes", "covers", "lights"]);
  assert.equal(groupOrder({ groups: ["scenes"] }).length, PANEL_GROUPS.length);
  const a = arrangePanel(IDS, kindOf, { groups: ["scenes", "covers"] });
  assert.deepEqual(
    a.groups.map((g) => g.group),
    ["scenes", "covers", "lights", "switches", "sensors"],
  );
});

test("ids of renamed or removed entities are ignored", () => {
  const a = arrangePanel(IDS, kindOf, { pinned: ["light.sample_gone", "light.sample_a"], order: ["cover.sample_gone", "light.sample_b"] });
  assert.deepEqual(a.pinned, ["light.sample_a"]);
  assert.deepEqual(a.groups[0].ids, ["light.sample_b"]);
  assert.deepEqual(sortByOrder(["x", "y"], ["gone", "y"]), ["y", "x"]);
});

test("entities the panel does not list (no kind) stay out", () => {
  const a = arrangePanel(["light.sample_a", "weather.sample_home"], kindOf, { pinned: ["weather.sample_home"] });
  assert.deepEqual(a.pinned, []);
  assert.deepEqual(a.groups.flatMap((g) => g.ids), ["light.sample_a"]);
});

test("moving a row keeps the other groups' order and the ids of entities away for now", () => {
  const layout = { order: ["light.sample_away", "light.sample_a", "light.sample_b"] };
  const a = arrangePanel(IDS, kindOf, layout);
  const next = withRowOrder(layout, a, "lights", moveIn(a.groups[0].ids, 1, 0))!;
  assert.deepEqual(next.order!.slice(0, 2), ["light.sample_b", "light.sample_a"]);
  assert.ok(next.order!.includes("light.sample_away"));
  assert.deepEqual(arrangePanel(IDS, kindOf, next).groups[0].ids, ["light.sample_b", "light.sample_a"]);
});

test("moving a group, pinning, unpinning and ordering the pinned rows", () => {
  const all = groupOrder(null);
  const g = withGroupOrder(null, ["covers", "lights", "switches", "sensors", "scenes"], all)!;
  assert.deepEqual(g.groups!.slice(0, 2), ["covers", "lights"]);
  assert.equal(g.groups!.length, PANEL_GROUPS.length);
  let l = togglePinned(null, "light.sample_a");
  l = togglePinned(l, "switch.sample_fan");
  assert.deepEqual(l!.pinned, ["light.sample_a", "switch.sample_fan"]);
  l = withPinnedOrder(l, ["switch.sample_fan", "light.sample_a"]);
  assert.deepEqual(l!.pinned, ["switch.sample_fan", "light.sample_a"]);
  assert.equal(togglePinned(togglePinned(null, "light.sample_a"), "light.sample_a"), null, "nothing chosen: no layout");
  assert.deepEqual(toggleHidden(["a"], "b"), ["a", "b"]);
  assert.deepEqual(toggleHidden(["a", "b"], "a"), ["b"]);
  assert.deepEqual(moveIn(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
  assert.deepEqual(tidyLayout({ pinned: [], order: [], groups: [] }), null);
});

test("the choice is stored on the room, or on the outdoor area acting as one", () => {
  const b = {
    floors: [
      { id: "f1", rooms: [], outdoor: [] },
      { id: "f2", rooms: [{ id: "r1", hidden: ["x"] }], outdoor: [{ id: "o1" }] },
    ],
  } as unknown as Building;
  storePanelChoice("r1", { hidden: ["y"], layout: { pinned: ["light.sample_a"] } })(b);
  assert.deepEqual(b.floors[1].rooms[0].hidden, ["y"]);
  assert.deepEqual(b.floors[1].rooms[0].panel_layout, { pinned: ["light.sample_a"] });
  storePanelChoice("r1", { layout: null })(b);
  assert.ok(!("panel_layout" in b.floors[1].rooms[0]));
  assert.deepEqual(b.floors[1].rooms[0].hidden, ["y"], "hidden untouched when not given");
  storePanelChoice("o1", { layout: { groups: ["covers"] } })(b);
  assert.deepEqual(b.floors[1].outdoor![0].panel_layout, { groups: ["covers"] });
});
