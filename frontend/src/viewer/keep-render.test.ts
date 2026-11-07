import { test } from "node:test";
import assert from "node:assert/strict";
import { keepRender } from "./keep-render.ts";

/** Like a three.js WebGLRenderer: `render` is the instance's own property, set in the constructor. */
class FakeRenderer {
  frames = 0;
  render: (scene: unknown, camera: unknown) => void;
  constructor() {
    this.render = () => {
      this.frames++;
    };
  }
}

test("a wrapper restored with delete (the timing script of #213) leaves render working", () => {
  // the failure without the guard: delete removes the only render there is
  const bare = new FakeRenderer();
  delete (bare as Partial<FakeRenderer>).render;
  assert.equal(typeof bare.render, "undefined");

  const r = keepRender(new FakeRenderer());
  const orig = r.render;
  let timed = 0;
  r.render = function (this: FakeRenderer, scene, camera) {
    timed++;
    return orig.call(this, scene, camera);
  };
  r.render(null, null);
  assert.equal(timed, 1);
  // a sloppy script's `delete` returns false, a strict one throws: either way render stays
  assert.equal(Reflect.deleteProperty(r, "render"), false);
  assert.throws(() => {
    "use strict";
    delete (r as Partial<FakeRenderer>).render;
  }, TypeError);
  assert.equal(typeof r.render, "function");
  r.render(null, null);
  assert.equal(r.frames, 2);
});

test("restoring by assignment works; anything but a function puts the renderer's own render back", () => {
  const r = keepRender(new FakeRenderer());
  const orig = r.render;
  const wrapper = () => undefined;
  r.render = wrapper;
  assert.equal(r.render, wrapper);
  r.render = orig;
  assert.equal(r.render, orig);
  r.render = wrapper;
  (r as unknown as { render: unknown }).render = undefined;
  assert.equal(r.render, orig);
  (r as unknown as { render: unknown }).render = { not: "a function" };
  assert.equal(r.render, orig);
  r.render(null, null);
  assert.equal(r.frames, 1);
});

test("render keeps its renderer as this", () => {
  const r = keepRender(new FakeRenderer());
  r.render(null, null);
  r.render.call(r, null, null);
  assert.equal(r.frames, 2);
});
