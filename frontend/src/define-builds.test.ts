// #357: one build per page. Each copy of define.ts here is a copy of the main bundle of the build set before it is
// imported (build.mjs puts __FP3D_BUILD__ into it).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const page = globalThis as unknown as { customElements: unknown; __FP3D_BUILD__?: string } & Record<symbol, unknown>;
let n = 0;
async function copyOf(build: string | undefined): Promise<typeof import("./define.ts")> {
  if (build === undefined) delete page.__FP3D_BUILD__;
  else page.__FP3D_BUILD__ = build;
  try {
    return await import(`./define.ts?copy=${++n}`);
  } finally {
    delete page.__FP3D_BUILD__;
  }
}

function registry() {
  const defs = new Map<string, CustomElementConstructor>();
  return {
    defs,
    get: (tag: string) => defs.get(tag),
    define(tag: string, cls: CustomElementConstructor) {
      if (defs.has(tag)) throw new Error(`${tag} already defined`);
      defs.set(tag, cls);
    },
    whenDefined: () => new Promise<CustomElementConstructor>(() => undefined),
  };
}
const cls = () => class {} as unknown as CustomElementConstructor;
let reg: ReturnType<typeof registry>;

beforeEach(() => {
  delete page[Symbol.for("home-3d.custom-elements")];
  delete page[Symbol.for("home-3d.build")];
  page.customElements = reg = registry();
});

test("the panel and the card never run two builds in one page: a copy of another build defines nothing", async () => {
  const old = await copyOf("aaaaaaaaaaaa");
  const current = await copyOf("bbbbbbbbbbbb");
  const [oldPanel, oldCard] = [cls(), cls()];
  assert.equal(old.defineElement("home-3d-panel", oldPanel), true);
  assert.equal(old.defineElement("home-3d-card", oldCard), true);
  assert.equal(old.pageBuild(), "aaaaaaaaaaaa");
  // the current build arrives second (the panel's module after a cached page's entry)
  assert.equal(current.defineElement("home-3d-panel", cls()), false);
  assert.equal(current.defineElement("home-3d-card", cls()), false);
  // not even an element the old build has no class for: its chunks would mix with the old panel
  assert.equal(current.defineElement("fp3d-view3d", cls()), false);
  assert.equal(current.mayDefine(), false);
  assert.equal(reg.get("home-3d-panel"), oldPanel);
  assert.equal(reg.get("home-3d-card"), oldCard);
  assert.equal(reg.get("fp3d-view3d"), undefined);
  // the page's build goes on defining its lazy elements
  assert.equal(old.defineElement("fp3d-view3d", cls()), true);
});

test("a second copy of the same build is a second copy as before (#218): it defines what is not taken", async () => {
  const first = await copyOf("aaaaaaaaaaaa");
  const second = await copyOf("aaaaaaaaaaaa");
  const panel = cls();
  first.defineElement("home-3d-panel", panel);
  assert.equal(second.mayDefine(), true);
  assert.equal(second.defineElement("home-3d-panel", cls()), false);
  assert.equal(reg.get("home-3d-panel"), panel);
});

test("a build from before #357 (no claim) that defined our elements counts as another build", async () => {
  const before = await copyOf(undefined); // keeps a record of its elements, no claim
  before.defineElement("home-3d-panel", cls());
  delete page[Symbol.for("home-3d.build")];
  const current = await copyOf("bbbbbbbbbbbb");
  assert.equal(current.mayDefine(), false);
  assert.equal(current.defineElement("home-3d-card", cls()), false);
  assert.equal(reg.get("home-3d-card"), undefined);
});

test("the first copy on an empty page claims it", async () => {
  const current = await copyOf("bbbbbbbbbbbb");
  assert.equal(current.pageBuild(), undefined);
  assert.equal(current.defineElement("home-3d-panel", cls()), true);
  assert.equal(current.pageBuild(), "bbbbbbbbbbbb");
});
