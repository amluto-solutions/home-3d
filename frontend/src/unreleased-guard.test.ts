// Guard: a feature on the UNRELEASED list must not show anywhere public – not in the README, the changelog or the docs.
// CI fails as soon as one of these texts names it. Releasing a feature means taking it off UNRELEASED first.

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { UNRELEASED } from "./features.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const PUBLIC = ["README.md", "CHANGELOG.md", "docs/plan-format.md", "docs/ai-import.md", "docs/packs.md"];

/** The names users would read for each gated add-on (case-insensitive). */
const NAMES: Record<string, RegExp> = {
  pool: /pool\s*pro|pro_pool|pool module/i,
  diagnostics: /diagnostics_report|usage and error reports/i,
  locate: /\blocating\b|room locating/i,
};

test("unreleased add-ons are named in no public text", () => {
  for (const feature of UNRELEASED) {
    const name = NAMES[feature];
    assert.ok(name, `add a public name pattern for the unreleased add-on "${feature}" to NAMES`);
    for (const file of PUBLIC) {
      const text = readFileSync(join(ROOT, file), "utf8");
      const lines = text.split("\n").map((line, i) => [i + 1, line] as const).filter(([, line]) => name.test(line));
      assert.deepEqual(lines, [], `${file} names the unreleased add-on "${feature}" (lines ${lines.map(([n]) => n).join(", ")})`);
    }
  }
});

test("the pool stays unreleased (its logic is not in this repository)", () => {
  assert.ok(UNRELEASED.includes("pool" as never), "the pool left the UNRELEASED list – its logic is not part of this repository");
});

test("no local test harness and nothing private is tracked by git", () => {
  // frontend/_*.mjs are local screenshot and probe scripts (they name private modules and local paths); private/ is
  // never public. Both slipped into a merge commit once.
  let tracked: string[];
  try {
    tracked = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" }).split("\n");
  } catch {
    return; // not a git checkout (a release archive): nothing to check
  }
  const bad = tracked.filter((f) => /^frontend\/_[^/]+\.(m?js|mts|ts)$/.test(f) || f.startsWith("private/"));
  assert.deepEqual(bad, [], `tracked by git but must stay local: ${bad.join(", ")}`);
});
