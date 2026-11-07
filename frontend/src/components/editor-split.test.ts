import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { editorFiles } from "./editor-source.ts";
import { mixParts } from "./editor/parts.ts";

// #202: the editor was one 18,000-line file. It is split into one module per area (editor/*.ts) and its styles
// (editor/styles/*.ts); these checks keep it that way.

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] ??= "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ ??= "test";

/** The owner's limit (#202): no editor source file over about 1,500 lines. */
const MAX_LINES = 1500;

test("no editor source file is over 1,500 lines (#202)", () => {
  const files = editorFiles();
  assert.ok(files.length > 30, `found ${files.length} editor files`);
  const long = files.map((f) => [f.pathname.split("/src/")[1], readFileSync(f, "utf8").split("\n").length] as const).filter(([, n]) => n > MAX_LINES);
  assert.deepEqual(long, []);
});

test("the styles live in their own files, not in editor.ts (#202)", () => {
  const editor = readFileSync(new URL("./editor.ts", import.meta.url), "utf8");
  assert.doesNotMatch(editor, /\bcss`/);
});

test("every area module's methods are the element's own, the very same functions (#202)", async () => {
  const { Fp3dEditor } = await import("./editor.ts");
  const proto = Fp3dEditor.prototype as unknown as Record<string, unknown>;
  let parts = 0;
  for (const file of editorFiles()) {
    if (!/\/editor\/[^/]+\.ts$/.test(file.pathname)) continue;
    const mod = (await import(file.href)) as Record<string, unknown>;
    for (const [name, value] of Object.entries(mod)) {
      if (!name.endsWith("Part") || typeof value !== "function") continue;
      parts++;
      const own = Object.getOwnPropertyNames(value.prototype).filter((n) => n !== "constructor");
      assert.ok(own.length > 0, `${name} has methods`);
      for (const n of own) assert.equal(proto[n], (value.prototype as Record<string, unknown>)[n], `${name}.${n} is on Fp3dEditor`);
    }
  }
  assert.ok(parts >= 25, `found ${parts} parts`);
});

test("a method defined twice is refused, not silently replaced (#202)", () => {
  class Host {
    a() {
      return 1;
    }
  }
  class Twice {
    a() {
      return 2;
    }
  }
  class Fine {
    b() {
      return 3;
    }
  }
  assert.throws(() => mixParts(Host, [Twice]), /a is defined twice/);
  mixParts(Host, [Fine]);
  assert.equal((new Host() as Host & { b(): number }).b(), 3);
  assert.equal(Object.getOwnPropertyDescriptor(Host.prototype, "b")?.enumerable, false);
});
