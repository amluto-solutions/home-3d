// Every service call from the views goes through callServiceSafe, so a refused call shows "That did not work" instead of
// an unhandled promise rejection (#208). A new direct `.callService(` outside the places below fails this test.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL(".", import.meta.url));

/** Where a direct call is the point: the safe wrapper, and code that hands a call on or fakes one. */
const ALLOWED: Record<string, string> = {
  "failure.ts": "callServiceSafe itself",
  "demo.ts": "the demo home forwards a call to the real hass.callService and returns its promise to the caller",
  "item-actions.ts": "the environment an action runs in; every environment the app builds wraps callServiceSafe",
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sources(path);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

/** Source without comments and strings that only talk about calls. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

test("no direct hass.callService( in the views: they use callServiceSafe (#208)", () => {
  const bad: string[] = [];
  for (const file of sources(root)) {
    const rel = relative(root, file).split(sep).join("/");
    if (ALLOWED[rel] !== undefined) continue;
    code(readFileSync(file, "utf8")).split("\n").forEach((line, i) => {
      if (/\.callService\(/.test(line)) bad.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(bad, [], "route these through callServiceSafe (failure.ts)");
});

test("pins, openings, own buttons and device cards use the safe call (#208)", () => {
  const view = readFileSync(join(root, "components/view3d.ts"), "utf8");
  for (const needle of ['safeCall(this.hass, domain, domain === "switch" ? "turn_on" : "press"', 'safeCall(hass, "media_player"']) {
    assert.ok(view.includes(needle), `view3d.ts has ${needle}`);
  }
  assert.ok(/toggleEntity\(hass: HomeAssistant, entityId: string\): void/.test(readFileSync(join(root, "markers.ts"), "utf8")), "a pin tap's toggle never returns a promise to drop");
  assert.ok(/callServiceSafe\(hass, domain, service, b\.data \?\? \{\}, failed\)/.test(readFileSync(join(root, "devices.ts"), "utf8")), "own buttons are safe");
});

test("a pin tap whose service is refused shows the notice (#208)", async () => {
  const { toggleEntity } = await import("./markers.ts");
  const { setFailureSink } = await import("./failure.ts");
  const shown: string[] = [];
  setFailureSink((text) => shown.push(text));
  try {
    const hass = { language: "en", callService: () => Promise.reject(new Error("stubbed failure")) } as never;
    toggleEntity(hass, "switch.sample_plug");
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(shown, ["That did not work: stubbed failure"]);
  } finally {
    setFailureSink(null);
  }
});
