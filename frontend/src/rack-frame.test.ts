// Rack frames (#112): a pack item with a `rack_frame` spec is an empty rack. The frontend reads the spec with the same
// rules the backend checks (custom_components/home_3d/packs.py), and lays out its U positions for the 3D and 2D views
// and for the gear fitted into it later (#113).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { PackItem, PackPart } from "./packs.ts";
import { type RackFrame, rackFrameParts, rackLayout, rackMarks, RACK_CABINET_FORMS, RACK_DOORS, RACK_FORMS, RACK_MAX_U, RACK_PANEL_WIDTH, RACK_UNIT, RACK_WALL_FORMS, RACK_WIDTHS, rackFrameProblems, readRackFrame } from "./rack-frame.ts";

const PACKS_PY = readFileSync(new URL("../../custom_components/home_3d/packs.py", import.meta.url), "utf8");

/** A module-level constant of packs.py written as a JSON-like literal (a list, a dict of numbers, a number). */
function py(name: string): unknown {
  const line = PACKS_PY.match(new RegExp(`^${name} = (.*)$`, "m"));
  assert.ok(line, `packs.py names ${name}`);
  return JSON.parse(line[1].replace(/(\d+):/g, '"$1":'));
}

const CABINET: PackItem = {
  id: "wall_cabinet_9u",
  name: { en: "Wall cabinet 9U" },
  size: [0.6, 0.45, 0.45],
  mount: "wall",
  parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "dark" }],
  rack_frame: { u: 9, form: "wall_cabinet", door: "glass" },
};

function withFrame(frame: Record<string, unknown>, item: Partial<PackItem> = {}): PackItem {
  return { ...CABINET, ...item, rack_frame: { ...CABINET.rack_frame!, ...frame } as PackItem["rack_frame"] };
}

test("the rack lists and measures are the ones the backend checks (#112)", () => {
  assert.deepEqual(RACK_FORMS, py("RACK_FORMS"));
  assert.deepEqual(RACK_WALL_FORMS, py("RACK_WALL_FORMS"));
  assert.deepEqual(RACK_CABINET_FORMS, py("RACK_CABINET_FORMS"));
  assert.deepEqual(RACK_DOORS, py("RACK_DOORS"));
  assert.deepEqual(RACK_WIDTHS, py("RACK_WIDTHS"));
  assert.equal(RACK_UNIT, py("RACK_UNIT"));
  assert.equal(RACK_MAX_U, py("RACK_MAX_U"));
  assert.deepEqual(RACK_PANEL_WIDTH, py("RACK_PANEL_WIDTH"));
});

test("a rack frame reads with its defaults filled in (#112)", () => {
  assert.deepEqual(readRackFrame(CABINET), { u: 9, form: "wall_cabinet", width: 19, door: "glass", startU: 1, desc: false, mountDepth: null, bottom: null });
  assert.equal(readRackFrame({ ...CABINET, rack_frame: undefined }), null, "an item without a spec is no rack");
});

test("a rack frame that breaks the rules is no rack, and says why (#112)", () => {
  const cases: [PackItem, string][] = [
    [withFrame({ u: 0 }), "u"],
    [withFrame({ u: 61 }), "u"],
    [withFrame({ u: 4.5 }), "u"],
    [withFrame({ u: true }), "u"],
    [withFrame({ form: "frame6" }), "form"],
    [withFrame({ width: 23 }), "width"],
    [withFrame({ door: "curtain" }), "door"],
    [withFrame({ start_u: 0 }), "start_u"],
    [withFrame({ desc: "yes" }), "desc"],
    [withFrame({ mount_depth: 0.6 }), "mount_depth"],
    [withFrame({ u: 10, bottom: 0.02 }), "u"],
    [withFrame({ bottom: 0.1 }), "u"],
    [withFrame({ colour: "red" }), "colour"],
    [withFrame({}, { size: [0.45, 0.45, 0.45] }), "width"],
    [withFrame({ form: "wall_frame" }), "door"],
    [withFrame({}, { mount: "floor" }), "mount"],
    [withFrame({ form: "cabinet" }), "mount"],
  ];
  for (const [item, field] of cases) {
    const problems = rackFrameProblems(item);
    assert.ok(problems.some((p) => p.field === field), `${JSON.stringify(item.rack_frame)} ${item.mount} ${item.size}: ${field} (${JSON.stringify(problems)})`);
    assert.equal(readRackFrame(item), null);
  }
  assert.deepEqual(rackFrameProblems(CABINET), []);
  assert.deepEqual(rackFrameProblems(withFrame({ form: "cabinet" }, { mount: "surface" })), [], "a desktop cabinet stands on a desk");
  assert.deepEqual(rackFrameProblems(withFrame({ width: 10 }, { size: [0.3, 0.2, 0.45] })), [], "a 10-inch rack is 254 mm across its ears");
});

const frame = (spec: Partial<RackFrame> = {}): RackFrame => ({ u: 9, form: "wall_cabinet", width: 19, door: "glass", startU: 1, desc: false, mountDepth: null, bottom: null, ...spec });
const near = (a: number, b: number, why = "", tol = 1e-6): void => assert.ok(Math.abs(a - b) < tol, `${why} ${a} != ${b}`);

test("a rack's U positions are 44.45 mm apart, centred in its height unless the pack says where they start (#112)", () => {
  // 9U = 400.05 mm of rails in a 450 mm cabinet: 24.975 mm below and above
  const at = rackLayout(frame(), 0.6, 0.45, 0.45);
  assert.equal(at.units.length, 9);
  near(at.units[0].y0, 0.024975, "lowest U bottom");
  near(at.units[0].y1, 0.024975 + 0.04445, "lowest U top");
  near(at.units[8].y1, 0.45 - 0.024975, "top U top");
  near(at.top, 0.45 - 0.024975);
  // a 42U floor cabinet on a plinth: 100 mm up
  const tall = rackLayout(frame({ u: 42, form: "cabinet", bottom: 0.1 }), 0.6, 1.0, 2.05);
  near(tall.units[0].y0, 0.1);
  near(tall.units[41].y1, 0.1 + 42 * 0.04445);
});

test("U numbers count from the start U, upwards or from the top down (#112)", () => {
  assert.deepEqual(rackLayout(frame({ u: 4 }), 0.6, 0.45, 0.45).units.map((u) => u.label), [1, 2, 3, 4]);
  assert.deepEqual(rackLayout(frame({ u: 4, desc: true }), 0.6, 0.45, 0.45).units.map((u) => u.label), [4, 3, 2, 1]);
  assert.deepEqual(rackLayout(frame({ u: 3, startU: 10 }), 0.6, 0.45, 0.45).units.map((u) => u.label), [10, 11, 12]);
});

test("a rack's rails stand 450.85 mm apart (19 inch) or 222.25 mm (10 inch), centred in its width (#112)", () => {
  const wide = rackLayout(frame(), 0.6, 0.45, 0.45);
  near(wide.opening, 0.45085);
  near(wide.panel, 0.4826);
  const mini = rackLayout(frame({ width: 10, form: "frame4", door: "none" }), 0.28, 0.2, 0.3);
  near(mini.opening, 0.22225);
  near(mini.panel, 0.254);
});

test("gear goes in from the front (+z): the front rails sit behind a cabinet's door, the mounting depth behind them (#112)", () => {
  const cab = rackLayout(frame(), 0.6, 0.45, 0.45);
  assert.ok(cab.front < 0.45 / 2 && cab.front > 0.45 / 2 - 0.1, "front rails just behind the door");
  near(cab.front - cab.rear!, cab.mountDepth, "rear rails one mounting depth behind");
  assert.ok(cab.rear! > -0.45 / 2, "rear rails inside the cabinet");
  const set = rackLayout(frame({ mountDepth: 0.3 }), 0.6, 0.45, 0.45);
  near(set.mountDepth, 0.3, "the pack's mounting depth");
  const open = rackLayout(frame({ form: "frame4", door: "none" }), 0.6, 0.45, 0.45);
  assert.ok(open.front > cab.front, "an open frame has its rails nearer the front");
  const post = rackLayout(frame({ form: "frame2", door: "none" }), 0.52, 0.3, 0.45);
  assert.ok(Math.abs(post.front) < 0.05, "a 2-post rack holds gear by its ears at the posts in the middle");
  assert.equal(post.rear, null, "a 2-post rack has no rear rails");
});

test("a rack squeezed below its U space keeps its U count, the units shrink to fit (#112)", () => {
  const at = rackLayout(frame(), 0.6, 0.45, 0.3);
  assert.equal(at.units.length, 9);
  assert.ok(at.top <= 0.3 + 1e-6);
  assert.ok(at.unit < RACK_UNIT);
});

const inside = (parts: PackPart[]): void => {
  for (const p of parts) {
    assert.ok(p.x - p.w / 2 >= -0.5 - 1e-6 && p.x + p.w / 2 <= 0.5 + 1e-6, `x ${JSON.stringify(p)}`);
    assert.ok(p.z - p.d / 2 >= -0.5 - 1e-6 && p.z + p.d / 2 <= 0.5 + 1e-6, `z ${JSON.stringify(p)}`);
    assert.ok(p.y >= 0 && p.y + p.h <= 1 + 1e-6, `y ${JSON.stringify(p)}`);
  }
};
/** Parts that close the front opening: on the front (+z) quarter, wider and taller than half the item. */
const frontPanels = (parts: PackPart[]): PackPart[] => parts.filter((p) => p.z > 0.25 && p.w > 0.5 && p.h > 0.5);
/** Parts that close a side: deeper and taller than half the item. */
const sidePanels = (parts: PackPart[]): PackPart[] => parts.filter((p) => p.d > 0.5 && p.h > 0.5);

test("a rack frame's parts draw the frame inside its box, well within the part limit (#112)", () => {
  for (const [spec, size] of [
    [frame(), [0.6, 0.45, 0.5]],
    [frame({ u: 42, form: "cabinet", door: "mesh", bottom: 0.1 }), [0.6, 1.0, 2.05]],
    [frame({ u: 6, width: 10, form: "frame4", door: "none" }), [0.28, 0.2, 0.32]],
    [frame({ u: 12, form: "wall_frame", door: "none" }), [0.52, 0.3, 0.6]],
    [frame({ u: 25, form: "frame2", door: "none" }), [0.52, 0.38, 1.3]],
  ] as [RackFrame, [number, number, number]][]) {
    const { parts } = rackFrameParts(spec, size);
    inside(parts);
    assert.ok(parts.length >= 6 && parts.length <= 30, `${spec.form}: ${parts.length} parts`);
  }
});

test("a glass or mesh door leaves the gear inside in view, a solid door closes the front (#112)", () => {
  const size: [number, number, number] = [0.6, 0.45, 0.5];
  assert.equal(frontPanels(rackFrameParts(frame({ door: "glass" }), size).parts).length, 0);
  assert.equal(frontPanels(rackFrameParts(frame({ door: "mesh" }), size).parts).length, 0);
  assert.equal(frontPanels(rackFrameParts(frame({ door: "none" }), size).parts).length, 0);
  assert.equal(frontPanels(rackFrameParts(frame({ door: "solid" }), size).parts).length, 1);
});

test("a cabinet has closed sides, an open frame has none (#112)", () => {
  assert.equal(sidePanels(rackFrameParts(frame(), [0.6, 0.45, 0.5]).parts).length, 2);
  assert.equal(sidePanels(rackFrameParts(frame({ form: "frame4", door: "none" }), [0.6, 0.6, 0.6]).parts).length, 0);
});

test("the frame's front rails stand where the layout puts them (#112)", () => {
  const size: [number, number, number] = [0.6, 0.45, 0.5];
  const at = rackLayout(frame(), ...size);
  const rails = rackFrameParts(frame(), size).parts.filter((p) => p.color === "metal" && p.h > 0.7);
  const front = rails.filter((p) => Math.abs((p.z + p.d / 2) * size[1] - at.front) < 1e-3);
  assert.equal(front.length, 2, "two front rails");
  for (const r of front) near(Math.abs(r.x * size[0]) - (r.w * size[0]) / 2, at.opening / 2, "inner edge on the opening", 1e-3);
  near(front[0].y * size[2], at.bottom, "", 1e-3);
  near((front[0].y + front[0].h) * size[2], at.top, "", 1e-3);
});

test("the plan shows a rack's footprint and where its front is (#112)", () => {
  const { symbol } = rackFrameParts(frame(), [0.6, 0.45, 0.5]);
  assert.ok(symbol.some((s) => s.shape === "rect" && s.w === 1 && s.d === 1), "the outline");
  assert.ok(symbol.some((s) => s.shape === "line" && s.z1 === s.z2 && s.z1 > 0.3), "a line across the front");
});

test("U marks: one tick on each front rail at every U boundary, a longer one every fifth U (#112)", () => {
  const at = rackLayout(frame({ u: 12 }), 0.6, 0.45, 0.6);
  const marks = rackMarks(at);
  assert.equal(marks.length, 2 * 13);
  assert.equal(marks.filter((m) => m.major).length, 2 * 3, "boundaries 0, 5 and 10");
  for (const m of marks) assert.ok(m.z0 >= at.front - 1e-6 && m.x0 * m.x1 > 0, "in front of a rail, beside the opening");
});
