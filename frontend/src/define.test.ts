// #218: elements defined before Home Assistant's scoped-registry polyfill replaced `window.customElements` are defined
// in the new registry too, so it knows them (and builds them) after the swap.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { adoptElements, defineElement } from "./define.ts";

/** A registry like the browser's: get / define / whenDefined, one class per tag. */
function fakeRegistry() {
  const defs = new Map<string, CustomElementConstructor>();
  const waiting = new Map<string, Array<(c: CustomElementConstructor) => void>>();
  return {
    defs,
    get: (tag: string) => defs.get(tag),
    define(tag: string, cls: CustomElementConstructor) {
      if (defs.has(tag)) throw new Error(`${tag} already defined`);
      defs.set(tag, cls);
      for (const done of waiting.get(tag) ?? []) done(cls);
      waiting.delete(tag);
    },
    whenDefined(tag: string) {
      const cls = defs.get(tag);
      if (cls) return Promise.resolve(cls);
      return new Promise<CustomElementConstructor>((done) => waiting.set(tag, [...(waiting.get(tag) ?? []), done]));
    },
  };
}
type Fake = ReturnType<typeof fakeRegistry>;
const page = globalThis as unknown as { customElements: unknown } & Record<symbol, unknown>;
const use = (r: Fake) => {
  page.customElements = r;
  return r;
};
const A = class {} as unknown as CustomElementConstructor;
const B = class {} as unknown as CustomElementConstructor;

beforeEach(() => {
  delete page[Symbol.for("home-3d.custom-elements")];
});

test("defines once per tag and says whether this call defined it", () => {
  const native = use(fakeRegistry());
  assert.equal(defineElement("x-a", A), true);
  assert.equal(defineElement("x-a", B), false);
  assert.equal(native.get("x-a"), A);
});

test("after the registry is replaced, the next define carries the earlier elements over first", () => {
  const native = use(fakeRegistry());
  defineElement("x-a", A);
  const polyfill = use(fakeRegistry());
  assert.equal(polyfill.get("x-a"), undefined);
  defineElement("x-b", B);
  assert.equal(polyfill.get("x-a"), A);
  assert.equal(polyfill.get("x-b"), B);
  assert.equal(native.get("x-b"), undefined);
});

test("they are carried over when <home-assistant> is defined, right after Home Assistant's polyfill", async () => {
  const native = use(fakeRegistry());
  defineElement("x-a", A);
  const polyfill = use(fakeRegistry());
  // the polyfill defines its stand-in for <home-assistant> in the browser's registry
  native.define("home-assistant", class {} as unknown as CustomElementConstructor);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(polyfill.get("x-a"), A);
});

test("a tag another copy already defined in the new registry keeps that class", () => {
  use(fakeRegistry());
  defineElement("x-a", A);
  const polyfill = use(fakeRegistry());
  polyfill.define("x-a", B);
  adoptElements();
  assert.equal(polyfill.get("x-a"), B);
  assert.equal(defineElement("x-a", A), false);
});

test("nothing changes while the registry stays the same", () => {
  const native = use(fakeRegistry());
  defineElement("x-a", A);
  adoptElements();
  assert.deepEqual([...native.defs.keys()], ["x-a"]);
});

/** A page with a browser registry: `builds` is what document.createElement builds for a tag (a plain element else). */
function fakePage() {
  class HTMLElementLike {}
  class Unknown extends HTMLElementLike {}
  const builds = new Map<string, new () => object>();
  const g = globalThis as unknown as Record<string, unknown>;
  g.HTMLElement = HTMLElementLike;
  g.HTMLUnknownElement = Unknown;
  g.document = { createElement: (tag: string) => new (builds.get(tag) ?? HTMLElementLike)() };
  return { HTMLElementLike, builds };
}
const unpage = () => {
  const g = globalThis as unknown as Record<string, unknown>;
  delete g.document;
  delete g.HTMLElement;
  delete g.HTMLUnknownElement;
};

test("a tag an older copy defined in the browser's registry, with no record, is carried over with ITS class", () => {
  try {
    const { HTMLElementLike, builds } = fakePage();
    class Theirs extends HTMLElementLike {}
    builds.set("x-a", Theirs);
    const polyfill = use(fakeRegistry());
    assert.equal(defineElement("x-a", A), false);
    assert.equal(polyfill.get("x-a"), Theirs);
    // a tag the browser has nothing for is ours
    assert.equal(defineElement("x-b", B), true);
    assert.equal(polyfill.get("x-b"), B);
  } finally {
    unpage();
  }
});

test("a class the browser can no longer build (an unknown element comes back) is not carried over", () => {
  try {
    const { builds } = fakePage();
    const g = globalThis as unknown as { HTMLUnknownElement: new () => object };
    builds.set("x-a", g.HTMLUnknownElement);
    const polyfill = use(fakeRegistry());
    assert.equal(defineElement("x-a", A), true);
    assert.equal(polyfill.get("x-a"), A);
  } finally {
    unpage();
  }
});
