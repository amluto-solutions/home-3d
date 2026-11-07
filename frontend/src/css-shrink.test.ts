import assert from "node:assert/strict";
import { test } from "node:test";
import { shrinkCss, shrinkCssTemplates } from "./css-shrink.ts";

test("whitespace and comments go, the rules stay", () => {
  const css = `
    :host {
      display: block; /* a note */
    }
    .a .b:hover,
    .c > .d {
      color: red;
      margin: 0 4px;
    }
    @media (max-width: 600px) {
      .a { gap: 2px; }
    }
  `;
  assert.equal(shrinkCss(css), ":host{display:block}.a .b:hover,.c > .d{color:red;margin:0 4px}@media (max-width:600px){.a{gap:2px}}");
});

test("strings and interpolations stay as they are", () => {
  assert.equal(shrinkCss('a[x="1  2"] {\n  content: "";\n  top: ${N}px;\n}'), 'a[x="1  2"]{content:"";top:${N}px}');
  const withValue = "css`\n  a { color: ${c}; }\n`";
  assert.equal(shrinkCssTemplates(withValue), "css`a{color:${c}}`");
  assert.equal(shrinkCssTemplates("x = css`\n  a { b: c; }\n`;"), "x = css`a{b:c}`;");
});

test("an apostrophe in a comment does not start a string", () => {
  assert.equal(shrinkCss("/* a bin's colour */ a { color: red; }"), "a{color:red}");
  assert.equal(shrinkCss('a::after { content: "/* kept */"; }'), 'a::after{content:"/* kept */"}');
});
