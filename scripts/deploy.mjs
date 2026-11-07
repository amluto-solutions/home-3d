// Copies custom_components/home_3d to a Home Assistant config folder (e.g. a Samba share).
// The target comes from HOME3D_DEPLOY_TARGET or deploy.local.json ({"target": "..."}), which is
// not committed. Files in the target that no longer exist here are removed, except the chunks (main bundle and editor) of the
// last builds, for two days (#223, frontend/src/deploy-keep.ts: a page still running the old bundle draws its plan).

import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { keepOldFile } from "../frontend/src/deploy-keep.ts";

const root = resolve(import.meta.dirname, "..");
const source = join(root, "custom_components", "home_3d");
const localConfig = join(root, "deploy.local.json");
const target = process.env.HOME3D_DEPLOY_TARGET ?? (existsSync(localConfig) ? JSON.parse(readFileSync(localConfig, "utf8")).target : null);

if (!target) {
  console.error('No target. Set HOME3D_DEPLOY_TARGET or create deploy.local.json with {"target": "<ha config>/custom_components/home_3d"}.');
  process.exit(1);
}
if (basename(target) !== "home_3d") {
  console.error(`Refusing to deploy: the target folder must be named home_3d (got ${target}).`);
  process.exit(1);
}

const skip = (name) => name === "__pycache__" || name.endsWith(".pyc");

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (skip(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(full));
    else out.push(full);
  }
  return out;
}

const wanted = new Set(files(source).map((f) => relative(source, f)));
let removed = 0;
const now = Date.now();
if (existsSync(target)) {
  for (const f of files(target)) {
    const rel = relative(target, f);
    if (!wanted.has(rel) && !keepOldFile(rel, statSync(f).mtimeMs, now)) {
      rmSync(f);
      removed++;
    }
  }
}
// build.json last (#357): until it names the new build, the start file imports the app it had before
const last = (rel) => (rel.endsWith("build.json") ? 1 : 0);
for (const rel of [...wanted].sort((a, b) => last(a) - last(b))) cpSync(join(source, rel), join(target, rel), { force: true });
console.log(`Deployed ${wanted.size} files to ${target}${removed ? `, removed ${removed} old files` : ""}.`);
