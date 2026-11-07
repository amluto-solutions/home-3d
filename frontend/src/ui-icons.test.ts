import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { editorSource } from "./components/editor-source.ts";

// #221: these glyphs fall back to an empty box on many devices; toolbar buttons use ui-icons.ts instead
const BOX_GLYPHS = ["▢", "◧", "◨", "◫", "⛶", "↶", "↷"];

test("toolbar controls draw SVG icons, not glyphs that render as a box (#221)", () => {
  const sources = {
    editor: editorSource(),
    view3d: readFileSync(new URL("./components/view3d.ts", import.meta.url), "utf8"),
    panel: readFileSync(new URL("./panel.ts", import.meta.url), "utf8"),
    card: readFileSync(new URL("./card.ts", import.meta.url), "utf8"),
  };
  for (const [name, text] of Object.entries(sources)) {
    const code = text
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n");
    for (const g of BOX_GLYPHS) assert.ok(!code.includes(g), `${name} still uses ${g}`);
  }
});
