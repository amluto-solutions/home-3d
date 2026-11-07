import assert from "node:assert/strict";
import { test } from "node:test";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any>; styles: unknown } };

const css = (() => {
  const s = Fp3dView3d.styles as { cssText?: string } | { cssText?: string }[];
  return (Array.isArray(s) ? s : [s]).map((x) => x.cssText ?? "").join("\n");
})();

test("the TV and player card grows as a whole box under the mouse, not just its text (#335)", () => {
  assert.doesNotMatch(css, /\.fp3d-holo-media:hover \.fp3d-holo-body\s*\{[^}]*scale/);
  assert.match(css, /\.fp3d-holo-media:hover\s*\{[^}]*width:\s*288px/);
  // the titles show in full instead of being cut off
  assert.match(css, /\.fp3d-holo-media:hover \.fp3d-holo-titles b,\s*\.fp3d-holo-media:hover \.fp3d-holo-titles span\s*\{[^}]*white-space:\s*normal/);
});

/** A viewer with one media card of 236 px and a stage of the given size; returns the transform the card was given. */
function place(stageW: number, stageH: number, x: number, y: number, facing = true): string {
  const el = new Fp3dView3d();
  const card: Record<string, any> = {
    hidden: false,
    dataset: { holo: "0" },
    offsetWidth: 236,
    offsetHeight: 130,
    style: { transform: "" },
    classList: { contains: (c: string) => c === "fp3d-holo-media", toggle: () => undefined },
  };
  const stage = { clientWidth: stageW, clientHeight: stageH };
  el.renderRoot = { querySelector: (q: string) => (q.startsWith(".fp3d-holo[") ? card : q === ".fp3d-stage" ? stage : null), querySelectorAll: (q: string) => (q.startsWith(".fp3d-holo[") ? [card] : []) };
  el._holos = [{ kind: "device", name: "TV", w: null, dayIds: [], battery: null }];
  el.holoCount = 1;
  el.placeHolo(0, x, y, true, 1.25, facing);
  return card.style.transform as string;
}

const at = (t: string) => {
  const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(t);
  assert.ok(m, t);
  return { x: Number(m[1]), y: Number(m[2]) };
};

test("the media card is kept inside the stage at its hovered size (#335)", () => {
  // scale 1.25 * 0.8 = 1: the box is 288 px wide hovered; the anchor near the right edge would push it out
  const right = at(place(600, 500, 560, 300));
  assert.ok(right.x + 288 <= 600 - 6 + 0.5, `right edge ${right.x + 288}`);
  // mirrored (seen from behind) the card extends to the left: near the left edge it is pushed in
  const left = at(place(600, 500, 40, 300, false));
  assert.ok(left.x - 288 >= 6 - 0.5, `left edge ${left.x - 288}`);
  // the top: an anchor high on the stage keeps the card's top on screen
  const top = at(place(600, 500, 300, 40));
  assert.ok(top.y - 130 >= 6 - 0.5, `top edge ${top.y - 130}`);
  // plenty of room: the card sits where it always did
  const free = at(place(1200, 800, 300, 400));
  assert.equal(free.x, 300 + 34);
  assert.equal(free.y, 400 - 46);
});

test("the cards' sizes are read in one go before a frame places any of them (run 6 speed)", () => {
  const el = new Fp3dView3d();
  const log: string[] = [];
  const card = (i: number): Record<string, any> => {
    const c: Record<string, any> = {
      hidden: false,
      dataset: { holo: String(i) },
      get offsetWidth() {
        log.push(`read ${i}`);
        return 180;
      },
      get offsetHeight() {
        return 90;
      },
      classList: { contains: () => false, toggle: () => undefined },
    };
    let t = "";
    c.style = {
      get transform() {
        return t;
      },
      set transform(v: string) {
        log.push(`write ${i}`);
        t = v;
      },
    };
    return c;
  };
  const cards = [card(0), card(1), card(2)];
  el.renderRoot = {
    querySelector: (q: string) => {
      const m = /data-holo="(\d+)"/.exec(q);
      return q.startsWith(".fp3d-holo[") && m ? cards[Number(m[1])] : q === ".fp3d-stage" ? { clientWidth: 800, clientHeight: 600 } : null;
    },
    querySelectorAll: (q: string) => (q.startsWith(".fp3d-holo[") ? cards : []),
  };
  el._holos = [0, 1, 2].map(() => ({ kind: "device", name: "Heater", w: null, dayIds: [], battery: null }));
  el.holoCount = 3;
  for (let i = 0; i < 3; i++) el.placeHolo(i, 100 + i * 200, 300, true, 1, true);
  assert.deepEqual(log, ["read 0", "read 1", "read 2", "write 0", "write 1", "write 2"]);
  // the next frame reads nothing (the sizes are kept for 2 s)
  log.length = 0;
  for (let i = 0; i < 3; i++) el.placeHolo(i, 100 + i * 200, 300, true, 1, true);
  assert.deepEqual(log, ["write 0", "write 1", "write 2"]);
});
