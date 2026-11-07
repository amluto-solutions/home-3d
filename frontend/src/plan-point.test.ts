// #253: pointer positions are measured against the plan's svg. Since the one-row toolbar (#249) the first svg in the
// editor is a toolbar icon, and measuring that put drawn rooms, doors and windows away from the pointer.
import assert from "node:assert/strict";
import { test } from "node:test";
import { PlanViewPart } from "./components/editor/plan-view.ts";

const box = (left: number, top: number) => ({ getBoundingClientRect: () => ({ left, top }) });

test("localPoint measures from the plan svg, not the first svg in the editor (#253)", () => {
  const icon = box(10, 8);
  const plan = box(225, 43);
  const root = { querySelector: (sel: string) => (sel === "svg.fp3d-plan" ? plan : sel === "svg" ? icon : null) };
  const p = PlanViewPart.prototype.localPoint.call({ renderRoot: root } as never, { clientX: 300, clientY: 100 } as PointerEvent);
  assert.deepEqual(p, [75, 57]);
});
