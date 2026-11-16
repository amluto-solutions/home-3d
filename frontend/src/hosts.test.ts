// Hosts rule (#462, owner decision for run 15): Home 3D talks to no server of its own, of NeonPlan 3D or of anyone
// else, except Home Assistant itself, GitHub (the pack index, pack downloads and updates) and, for the neighbourhood
// map only, the two public Overpass servers – and those only when an admin taps Load surroundings. This test scans the
// source that ships (frontend/src without tests and fixtures, custom_components/home_3d without the built bundles)
// and fails on any web address whose host is not on the list below. A new host needs the owner's yes first.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

/** Every host the shipped source may name, and why. */
const ALLOWED: Record<string, string> = {
  "overpass-api.de": "the neighbourhood map (surround-fetch.ts), only on the Load surroundings tap",
  "overpass.kumi.systems": "the second Overpass server, when the first is busy or down",
  "www.openstreetmap.org": "the copyright link next to the map's attribution (opened by the user, never fetched)",
  "github.com": "pack downloads and updates, and the project's own links",
  "api.github.com": "pack downloads and updates (pack_github.py)",
  "raw.githubusercontent.com": "the pack index and pack files",
  "www.w3.org": "the SVG namespace name (an identifier, never fetched)",
  "www.home-assistant.io": "help links the user opens",
  "companion.home-assistant.io": "help links the user opens",
};

/** The hosts the map may be loaded from: only surround-fetch.ts names them. */
const OVERPASS = new Set(["overpass-api.de", "overpass.kumi.systems"]);

const SRC = new URL("./", import.meta.url);
const BACKEND = new URL("../../custom_components/home_3d/", import.meta.url);

function files(dir: URL, keep: (name: string) => boolean, skip: (name: string) => boolean = () => false): URL[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return skip(e.name) ? [] : files(new URL(`${e.name}/`, dir), keep, skip);
    return keep(e.name) ? [new URL(e.name, dir)] : [];
  });
}

/** The shipped source: the frontend's modules (no tests, no fixtures) and the integration (no built bundles). */
function shipped(): URL[] {
  return [
    ...files(SRC, (n) => /\.(ts|js|mjs|json|css|html)$/.test(n) && !/\.(test|fixture)\.|fixture/.test(n)),
    // the built bundles in frontend/ are made from the source above
    // (the item packs are shapes and colours, 16 MB of them: packs.test.ts and the pack schema check what they hold)
    ...files(BACKEND, (n) => /\.(py|json|yaml|js|html|md|txt)$/.test(n), (d) => d === "frontend" || d === "__pycache__" || d === "bundled_packs"),
  ];
}

const ADDRESS = /\bhttps?:\/\/([^/\s"'`)<>\]\\,;]*)/gi;

/** Every web address of the shipped source, with its host and file. */
function addresses(): { host: string; file: string }[] {
  const out: { host: string; file: string }[] = [];
  for (const url of shipped()) {
    const text = readFileSync(url, "utf8");
    const file = url.pathname.replace(/^.*\/(frontend\/src|custom_components\/home_3d)\//, "$1/");
    for (const m of text.matchAll(ADDRESS)) {
      // a scheme alone ("https://", "https://…" in a hint or a check of what was typed) names no host
      const host = m[1].toLowerCase().replace(/:\d+$/, "");
      if (host && host !== "…") out.push({ host, file });
    }
  }
  return out;
}

test("the shipped source names no host but those allowed (hosts rule, #462)", () => {
  const found = addresses();
  assert.ok(found.length > 10, `found ${found.length} web addresses: the scan sees the source`);
  const other = found.filter((a) => !(a.host in ALLOWED)).map((a) => `${a.file}: ${a.host || "(a host made at runtime)"}`);
  assert.deepEqual([...new Set(other)], [], "a host outside the allow-list: no server but Home Assistant, GitHub and Overpass (on a tap) may be called");
});

test("only the map's bundle names the Overpass servers, and nothing loads that bundle before a tap", () => {
  const named = new Set(addresses().filter((a) => OVERPASS.has(a.host)).map((a) => a.file));
  assert.deepEqual([...named], ["frontend/src/surround-fetch.ts"]);
  // surround-fetch.ts is the entry of home-3d-osm.js: no module imports it (types only), so it is in no other bundle
  for (const url of files(SRC, (n) => n.endsWith(".ts") && !/\.(test|fixture)\.ts$/.test(n))) {
    const text = readFileSync(url, "utf8");
    for (const m of text.matchAll(/^\s*import\s+(type\s+)?[^;]*?from\s+"[./]*\/?surround-fetch\.ts"/gm)) assert.ok(m[1], `${url.pathname.split("/src/")[1]} imports surround-fetch.ts: load it with loadOsm() instead`);
    assert.ok(!/import\(\s*["'][./]*\/?surround-fetch/.test(text), `${url.pathname.split("/src/")[1]} imports surround-fetch.ts itself: load it with loadOsm()`);
  }
  const loader = readFileSync(new URL("load-osm.ts", SRC), "utf8");
  assert.match(loader, /lazyBundle<typeof OsmBundle>\("home-3d-osm"/);
});

test("the build makes the map's bundle on its own, with a budget", () => {
  const build = readFileSync(new URL("../build.mjs", import.meta.url), "utf8");
  assert.match(build, /entryPoints: \["src\/surround-fetch\.ts"\], outfile: `\$\{out\}\/home-3d-osm\.js`/);
  assert.match(build, /"home-3d-osm\.js": \d+ \* 1024/);
});
