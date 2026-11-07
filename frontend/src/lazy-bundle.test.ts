import assert from "node:assert/strict";
import { test } from "node:test";
import { lazyBundle } from "./lazy-bundle.ts";

// The build sets each hash (__FP3D_*_HASH__) only in the bundles that load that bundle, but the loader modules are
// also pulled into other bundles: the editor bundle includes load-voice.ts (for the voice settings), and the voice
// bundle includes it too. There the constant does not exist, so reading it while the module loads threw a
// ReferenceError and the editor tab stayed on "Loading …" (#52). Node defines none of them, like such a bundle.
const LOADERS = ["load-card-editor", "load-editor", "load-fun", "load-items", "load-locate", "load-settings", "load-timetravel", "load-voice"];

for (const name of LOADERS) {
  test(`${name}.ts loads in a bundle the build gave no hash`, async () => {
    await assert.doesNotReject(import(`./${name}.ts`));
  });
}

test("the hash is only read when the bundle is loaded", () => {
  let read = 0;
  lazyBundle("home-3d-none", () => {
    read++;
    return "x";
  });
  assert.equal(read, 0);
});
