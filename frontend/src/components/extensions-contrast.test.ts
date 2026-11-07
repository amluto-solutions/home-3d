import assert from "node:assert/strict";
import { test } from "node:test";
import { contrast, DARK, type Scheme } from "../scheme.ts";

const { Extensions } = await import("./extensions.ts");
const css = (Extensions.styles as unknown as { cssText: string }[]).map((s) => s.cssText).join("\n");
// the page's own rules (the shared tokens and controls come first and are tested with the schemes)
const own = css.slice(css.indexOf(".fp3d-sum {"));
const token = (name: string) => DARK[name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()) as keyof Scheme];

test("every text colour on the Extensions page reads comfortably on its dark cards (6:1, past AA) (#88)", () => {
  const colours = [...own.matchAll(/(?<![-\w])color:\s*(?:var\(--fp3d-([\w-]+)[^)]*\)|(#[0-9a-f]{6}))/gi)].map((m) => (m[1] ? token(m[1]) : m[2]));
  assert.ok(colours.length > 5);
  for (const c of colours) {
    if (typeof c !== "string" || !c.startsWith("#")) continue;
    assert.ok(contrast(c, DARK.chromeSolid) >= 6, `${c} on the card`);
  }
});

test("only one call to action is loud on the Extensions page: pack import buttons are quiet (#88)", () => {
  const el = new Extensions() as unknown as Record<string, unknown> & { renderPacks(): { strings: string[] } };
  Object.assign(el, { hass: { language: "en", user: { is_admin: true } }, packs: [] });
  const markup = el.renderPacks().strings.join("");
  assert.match(markup, /fp3d-pack-import/);
  assert.doesNotMatch(markup, /fp3d-primary fp3d-pack-import/);
});
