// Builds the bundles into custom_components/home_3d/frontend and checks the size budgets.
// `node build.mjs --report` also lists the 15 biggest inputs of each bundle (#179), so growth is put down to a module.

import { build, context } from "esbuild";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { shrinkThreeShaders } from "./src/glsl-shrink.ts";
import { borrowEnglish, lateTextsChunk } from "./src/borrow-english.ts";
import { shrinkCssTemplates } from "./src/css-shrink.ts";

const out = "../custom_components/home_3d/frontend";
const watch = process.argv.includes("--watch");
const report = process.argv.includes("--report");

// three.js keeps its shaders as readable text (indented, with comments): about 117 KB of the 3D bundle. They are
// shrunk as they are bundled (#179, src/glsl-shrink.ts); the shaders compile the same.
const shrinkShaders = {
  name: "shrink-three-shaders",
  setup(b) {
    b.onLoad({ filter: /[\\/]three[\\/]build[\\/]three\.module\.js$/ }, (args) => ({ contents: shrinkThreeShaders(readFileSync(args.path, "utf8")).code, loader: "js" }));
  },
};

const common = {
  bundle: true,
  format: "esm",
  // older iPads stay on iOS 15/16: Safari 15 is the oldest with WebGL 2 (three.js needs it); newer syntax such as
  // static class blocks (Safari 16.4) is turned into older code, otherwise the 3D view fails to load there
  target: ["safari15", "chrome94", "firefox93", "edge94"],
  minify: !watch,
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
  metafile: true,
  // every bundle but the main one loads from the main bundle, which holds the English table: they borrow it (#196)
  plugins: [shrinkShaders, borrowEnglish],
};

const viewerConfig = { ...common, entryPoints: ["src/viewer/viewer3d.ts"], outfile: `${out}/home-3d-3d.js` };
// the card's visual editor only loads in the dashboard's card dialog
// Every language but English is a language pack that ships with Home 3D (#196, #217: bundled_languages/amluto.lang-*,
// sent by Home Assistant like an installed language pack); no bundle carries one (#134), the check below makes sure
const de = JSON.parse(readFileSync("../custom_components/home_3d/bundled_languages/amluto.lang-de/strings.json", "utf8"));
const cardEditorConfig = { ...common, entryPoints: ["src/card-editor.ts"], outfile: `${out}/home-3d-card-editor.js` };
// the editor is only needed by admins who open it, so it is a bundle of its own as well
// (it draws furniture previews with the 3D bundle, so it knows that bundle's hash too)
// #245: it is split like the main bundle. The entry (home-3d-editor.js) and its shared chunks (home-3d-editor-chunk-
// <hash>.js) are what the editor's first paint needs; the library, the rack sheet, the Extensions page and the settings
// pickers are one lazy chunk (home-3d-editor-lazy-parts-<hash>.js, components/editor/lazy.ts) that loads when one is
// first drawn or once the editor is idle. One lazy chunk, not one each: each adds shared chunks to the first open, and a
// file more is a round trip more on a slow link. The main bundle loads the entry by its hash (it changes with any chunk's
// name) and fetches the shared chunks alongside it (load-editor.ts).
const EDITOR = `${out}/home-3d-editor.js`;
// run 10 (#397): the editor's stylesheet slices (components/editor/styles/*.ts, about 4,000 lines) lose their indentation and
// comments too (src/css-shrink.ts), so the item panel's folds fit the "editor first open" budget without raising it
const shrinkEditorCss = {
  name: "shrink-editor-css",
  setup(b) {
    b.onLoad({ filter: /src.components.editor.styles.[a-z0-9-]+[.]ts$/ }, (args) => ({ contents: shrinkCssTemplates(readFileSync(args.path, "utf8")), loader: "ts" }));
  },
};
const editorConfig = (viewerHash, locateHash, itemsHash, alignHash) => ({
  ...common,
  plugins: [...common.plugins, shrinkEditorCss],
  entryPoints: { "home-3d-editor": "src/components/editor.ts" },
  outdir: out,
  splitting: true,
  chunkNames: "home-3d-editor-[name]-[hash]",
  define: { __FP3D_VIEWER_HASH__: JSON.stringify(viewerHash), __FP3D_LOCATE_HASH__: JSON.stringify(locateHash), __FP3D_ITEMS_HASH__: JSON.stringify(itemsHash), __FP3D_ALIGN_HASH__: JSON.stringify(alignHash) },
});
// the item editor (#13) only loads when an editor opens it; it draws its live picture with the 3D bundle
const itemsConfig = (viewerHash) => ({ ...common, entryPoints: ["src/items/entry.ts"], outfile: `${out}/home-3d-items.js`, define: { __FP3D_VIEWER_HASH__: JSON.stringify(viewerHash) } });
// the align and distribute tools of the multi-selection panel (#235) load when the editor first selects several items
const alignConfig = { ...common, entryPoints: ["src/align/entry.ts"], outfile: `${out}/home-3d-align.js` };
// the time travel (Pro) only loads when it starts; its texts come from the main bundle
const timeTravelConfig = { ...common, entryPoints: ["src/timetravel/entry.ts"], outfile: `${out}/home-3d-timetravel.js` };
// the fun packs (pets …) only load when one is unlocked and switched on; three.js is lent by the 3D bundle
const funConfig = { ...common, entryPoints: ["src/fun/entry.ts"], outfile: `${out}/home-3d-fun.js` };
// the read-only 2D plan (#41) loads instead of the 3D bundle when a view shows the plan flat
const plan2dConfig = { ...common, entryPoints: ["src/plan2d/entry.ts"], outfile: `${out}/home-3d-2d.js` };
// voice (the microphone probe for now) only loads when it is asked for
const voiceConfig = { ...common, entryPoints: ["src/voice/entry.ts"], outfile: `${out}/home-3d-voice.js` };
// the locating setup assistant only loads when an admin opens it
const locateConfig = { ...common, entryPoints: ["src/locate/entry.ts"], outfile: `${out}/home-3d-locate.js` };
// the Settings page (#139) only loads when someone opens its tab; its labels come from the main bundle (`t`)
// #245: split like the editor: its time and entity pickers are one chunk of their own (home-3d-settings-pickers-<hash>.js)
const SETTINGS = `${out}/home-3d-settings.js`;
// #296: the page's CSS templates lose their indentation and comments as they are bundled (src/css-shrink.ts); the bundle was at its budget
const shrinkSettingsCss = {
  name: "shrink-settings-css",
  setup(b) {
    b.onLoad({ filter: /src.settings.[a-z0-9-]+[.]ts$/ }, (args) => ({ contents: shrinkCssTemplates(readFileSync(args.path, "utf8")), loader: "ts" }));
  },
};
// run 5: the same for the main bundle and its chunks (the 3D view's stylesheet is 80 KB of source): the "wall tablet" path was over its gzip budget
const shrinkViewCss = {
  name: "shrink-view-css",
  setup(b) {
    b.onLoad({ filter: /src.(?:components.)?[a-z0-9-]+[.]ts$/ }, (args) => ({ contents: shrinkCssTemplates(readFileSync(args.path, "utf8")), loader: "ts" }));
  },
};
const settingsConfig = { ...common, plugins: [...common.plugins, shrinkSettingsCss], entryPoints: { "home-3d-settings": "src/settings/entry.ts" }, outdir: out, splitting: true, chunkNames: "home-3d-settings-[name]-[hash]" };
// The main bundle loads the 3D bundle with a hash of its content in the URL, so a new 3D bundle is
// never taken from the browser cache (the integration version only changes after a restart).
// the frontend knows its own version, to notice a backend that still runs an older one
const version = JSON.parse(readFileSync("../custom_components/home_3d/manifest.json", "utf8")).version;
// Which build this is (#60): a hash of everything the bundles are made from. The main bundle knows it, and build.json
// next to the bundles tells the backend, which reports it; an open page whose id differs runs older JavaScript than is
// served now (also when the version stayed the same) and offers a reload.
const inputs = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? inputs(`${dir}/${e.name}`) : [`${dir}/${e.name}`])).sort();
const buildId = (() => {
  const h = createHash("sha256").update(version);
  // line endings do not count: a Windows checkout with CRLF files builds the same id as CI
  for (const file of [...inputs("src"), "package-lock.json", "build.mjs"]) if (existsSync(file)) h.update(file).update(readFileSync(file, "utf8").replace(/\r\n/g, "\n"));
  return h.digest("hex").slice(0, 12);
})();
// `hashes`: the content hash of each bundle it loads, by name (viewer, editor, cardEditor, timeTravel, fun, voice, locate, plan2d, settings)
// Home Assistant loads the main bundle on every page (the card must be known on any dashboard), so the 3D view element
// (components/view3d.ts, the biggest part) is a chunk of its own (#179): it loads where the panel or a card shows.
// Chunks share the main bundle's modules (one pack registry, one language table: modules several of them use are in
// shared chunks, home-3d-chunk-<hash>.js); a chunk's name carries its content hash, so it is never taken stale.
// #245: the editor's chunks too, and a chunk named after a module with a hyphen (home-3d-room-panel-<hash>.js)
const CHUNK = /^home-3d-[\w-]+-[A-Z0-9]{8}\.js$/;
// #357: the start file every page names (boot.ts): it asks build.json which build is served and imports that app. A
// bundle of its own, no chunks, so nothing in it changes with the app.
const bootConfig = { ...common, plugins: [], entryPoints: ["src/boot.ts"], outfile: `${out}/home-3d.js` };
const mainConfig = (hashes) => ({
  ...common,
  // the one bundle with the English table (its chunks share it)
  plugins: [shrinkShaders, shrinkViewCss, lateTextsChunk],
  // #357: the app is home-3d-app.js; home-3d.js is the start file (bootConfig) that imports the current build of it
  entryPoints: { "home-3d-app": "src/main.ts" },
  outdir: out,
  splitting: true,
  chunkNames: "home-3d-[name]-[hash]",
  define: {
    __FP3D_VIEWER_HASH__: JSON.stringify(hashes.viewer),
    __FP3D_EDITOR_HASH__: JSON.stringify(hashes.editor),
    __FP3D_CARD_EDITOR_HASH__: JSON.stringify(hashes.cardEditor),
    __FP3D_TIMETRAVEL_HASH__: JSON.stringify(hashes.timeTravel),
    __FP3D_FUN_HASH__: JSON.stringify(hashes.fun),
    __FP3D_VOICE_HASH__: JSON.stringify(hashes.voice),
    __FP3D_LOCATE_HASH__: JSON.stringify(hashes.locate),
    __FP3D_PLAN2D_HASH__: JSON.stringify(hashes.plan2d),
    __FP3D_SETTINGS_HASH__: JSON.stringify(hashes.settings),
    // #245: the editor's shared chunks, fetched together with its entry (load-editor.ts): no second round trip
    __FP3D_EDITOR_CHUNKS__: JSON.stringify(hashes.editorChunks ?? []),
    __FP3D_SETTINGS_CHUNKS__: JSON.stringify(hashes.settingsChunks ?? []),
    __FP3D_VERSION__: JSON.stringify(version),
    __FP3D_BUILD__: JSON.stringify(buildId),
  },
});
// the bundles the main bundle loads by hash (the keys of mainConfig's `hashes`)
const HASHED = ["viewer", "editor", "cardEditor", "timeTravel", "fun", "voice", "locate", "plan2d", "settings"];
const hashOf = (file) => createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 12);

// Self-hosted fonts (SIL OFL): latin subset of the variable weight axis, shipped with their licences.
const FONTS = [
  ["figtree", "figtree-latin-wght-normal.woff2", "figtree.woff2"],
  ["bricolage-grotesque", "bricolage-grotesque-latin-wght-normal.woff2", "bricolage-grotesque.woff2"],
];
function copyFonts() {
  mkdirSync(`${out}/fonts`, { recursive: true });
  // every language comes from a language pack (#196, #217); the lang/*.json tables of older builds are gone
  rmSync(`${out}/lang`, { recursive: true, force: true });
  for (const [pkg, file, name] of FONTS) {
    const dir = `node_modules/@fontsource-variable/${pkg}`;
    copyFileSync(`${dir}/files/${file}`, `${out}/fonts/${name}`);
    copyFileSync(`${dir}/LICENSE`, `${out}/fonts/${pkg}-LICENSE.txt`);
  }
}

// size budgets of the bundles (kept small for old wall tablets; the items bundle loads only for editors opening the
// item editor: 72 KB since #84 added list import, the brief dialog and the light preview; the editor bundle loads only
// for editors). #134 moved the German table out of the bundles into lang/de.json; the main, editor and card-editor
// budgets were then set just above their new sizes (668.3 / 961.8 / 154.2 KB) so growth shows again: raise one only
// with a reason in this comment, and keep new strings' growth in the bundle that uses them.
// #139: home-3d.js was already at 683.7 KB on integration (over its 680 KB) before the Settings tab; raised to 695 KB
// for the tab, its loader and the "All settings" links (the page itself and its texts are a bundle of their own).
// #179: the 3D view and walking through the house are chunks of the main bundle, named here without the hash in their
// file name (home-3d-view3d-<hash>.js); shared chunks are counted in the paths below. home-3d.js went from 693 KB to
// 130 KB, and every Home Assistant page loads 386 KB (with its shared chunks) instead of 693 KB. three.js's shaders
// are shrunk and walking left the 3D bundle (895 -> 876 KB). No budget went up. GZIP_BUDGET: as sent, for the files a
// wall tablet waits for.
// #196: only the main bundle carries the English table; every other bundle borrows it from the page (borrow-english.ts).
// The editor went from 971 to 847 KB and the card editor from 157 to 33 KB; their budgets were set just above (975 ->
// 860 KB, 160 -> 40 KB) so growth shows again.
// #217: the item editor, Settings, time travel, locating setup and microphone probe texts moved into the English table
// (18 KB more on every page, 4 KB gzip) and the 16 lang/*.json tables into language packs; the lazy bundles lost their own
// copies (locate 151 -> 40 KB, items 69 -> 62, settings 101 -> 87), so their budgets came down to just above, and the
// "every page" path went from 410 to 425 KB (gzip 140 -> 146). The main bundle itself did not change: the table is in a shared chunk.
// #229: the room panel's "Edit list" mode is a lazy chunk of its own (home-3d-listedit-<hash>.js, 9 KB): only an editor
// who opens it loads it. A new budget, not a raised one.
// #245: the editor and the Settings page are split (editorConfig, settingsConfig). With run4-221/227/229/231 merged the
// editor was 877 KB (over its 860), Settings 95.3 (over its 95), "every page" 433 (over its 425) and "wall tablet" 1633
// (over its 1630). Now the editor's first open (entry + shared chunk, the "editor first open" path) is 800 KB under the
// editor's 860, Settings' first open 87 KB under its 95; their lazy chunks (the editor's lazy parts: library, rack sheet,
// Extensions page, pickers; Settings' pickers) and the main bundle's new ones (the room panel, loaded when a room is
// tapped or once the 3D view is there and the page idle, and the editors' home switcher) have budgets just above their sizes. No budget went up.
// #247: the one View panel on the 3D view (home-3d-view-panel-<hash>.js, 23 KB) is a lazy chunk of its own, loaded when
// the View button is first pointed at or pressed; it took the header's View popover and the stage's Show popover out
// of the main bundle ("every page" 377 -> 363 KB, "wall tablet" 1605 -> 1591 KB). A new budget, not a raised one.
// #249: the floor bar's Rooms picker (home-3d-rooms-picker-<hash>.js) is a lazy chunk of its own, loaded when its button is
// first pointed at or pressed. A new budget, not a raised one.
// #250: the phone editor's bottom bar and More (home-3d-editor-phone-bar-<hash>.js, 9 KB) are a lazy chunk of their
// own, loaded only where the editor is phone-wide; they borrow Lit from the editor, so its first open stays two files.
// A new budget, not a raised one.
// Run 5 merge (#265-#267 + #272): drag/close/dock and resize handles pushed the View panel (25.4 KB) and room panel (30.0 KB)
// chunks to their limits once combined; both are lazy and small, so their budgets go to 28 and 33 KB.
// #296/#287: Settings > Homes and the holiday Dates editor are lazy chunks with budgets of their own.
// #293: the item picker (home-3d-editor-item-picker-<hash>.js) is a lazy chunk of its own, drawn only by an open Item field. A new budget.
// #327: the icon picker (home-3d-editor-icon-picker-<hash>.js) is a lazy chunk of its own, drawn by every icon field. A new budget.
// run 11 (#400-#402): the late English texts (home-3d-i18n-register-late, editor-only, not on the wall tablet) 124 -> 126 KB for
// the new panels', list's and copy texts (base 123.8 KB, now 124.9 KB). Raised, not trimmed; the orchestrator may drop this.
// #402: the Build and Outside panels (home-3d-editor-tool-panel-<hash>.js) are a lazy chunk of their own, loaded when the page is
// idle after the editor's first paint or when Build or Outside is pointed at; like the phone bar they borrow Lit from the editor. A new budget.
// #286: the Settings search words (home-3d-settings-search-words-<hash>.js, 8.8 KB) load with the search box, not on first open. A new budget.
// #333: the weather tile by the clock (home-3d-weather-tile-<hash>.js) and its forecast list (home-3d-weather-forecast-<hash>.js) are lazy chunks with new budgets of their own.
// #268/#297: the Display what multi-select and the 3D nav pad are lazy chunks of their own. New budgets.
// #337: a pet's panel in the editor (home-3d-editor-pet-panel-<hash>.js, its routine and triggers) is a lazy chunk of its own. A new budget.
// run 6 (#337): pet routines and poses in the fun bundle: 40 -> 42 KB.
// #323: today's cost from existing rate sensors (home-3d-energy-rates-<hash>.js, 2.2 KB) loads only for a plan with cost sensors. A new budget.
// #336: the Library's Browse tab (home-3d-editor-pack-browser-<hash>.js, 15.5 KB) is a lazy chunk of its own, loaded when an editor opens the tab. A new budget.
// run 6 (#318 #332): Settings has its own copy of the multi-select (separate entry), and the time format row tips settings first open over 95 KB.
// run 6 (#252 #327 #338): curved shells, the icon field and show-when rules land together in the item forms (editor-only): items 68 -> 72 KB.
// #357: the main bundle is home-3d-app.js now (its budgets moved with it, unchanged), and home-3d.js is the start file
// that imports it (well under 1 KB, a new budget of its own); both are on the "every page" and "wall tablet" paths.
// #350: robot vacuum maps: the 3D overlay (home-3d-vacuum-maps-<hash>.js, only for a plan with maps while the View switch is on) and the editor's section and alignment (home-3d-editor-vacuum-panel-<hash>.js) are lazy chunks with new budgets of their own.
// #375: restoring a backup file (home-3d-editor-backup-send-<hash>.js: the parts and sizes of a large backup) loads when
// one is picked, not with the editor. A new budget, not a raised one.
// home-3d-fun.js 42 -> 44 KB (#385): the holiday effect timer; the bundle loads lazily, only on a holiday or with pets
// home-3d-editor-lazy-parts.js 92 -> 94 KB (#385): the Holiday effect select and its style on the Extensions page
// #398: the floating toolbar over the selected item in the plan (home-3d-editor-item-bar-view-<hash>.js) is a lazy chunk of its own, loaded the first time one item is chosen. A new budget.
// #403: the shared colour field is a lazy chunk in the main bundle (the View panel's accent, the card editor's) and in
// Settings (its first open has no room for it); the editor carries its own copy in its first open. New budgets.
const BUDGET = { "home-3d-colour-field.js": 6 * 1024, "home-3d-settings-colour-field.js": 6 * 1024, "home-3d-editor-item-bar-view.js": 8 * 1024, "home-3d-editor-backup-send.js": 4 * 1024, "home-3d-editor-vacuum-panel.js": 13 * 1024, "home-3d-vacuum-maps.js": 8 * 1024, "home-3d-editor-pet-panel.js": 11 * 1024, "home-3d-i18n-register-late.js": 130 * 1024, "home-3d-energy-rates.js": 4 * 1024, "home-3d-editor-pack-browser.js": 18 * 1024, "home-3d-weather-tile.js": 6 * 1024, "home-3d-weather-forecast.js": 8 * 1024, "home-3d-float-window.js": 8 * 1024, "home-3d-find.js": 8 * 1024, "home-3d-settings-extensions-index.js": 4 * 1024, "home-3d-multi-select.js": 8 * 1024, "home-3d-settings-multi-select.js": 9 * 1024, "home-3d-view-nav.js": 3 * 1024, "home-3d-quick-menu.js": 20 * 1024, "home-3d-settings-search-words.js": 10 * 1024, "home-3d-editor-season-dates.js": 13 * 1024, "home-3d-settings-homes.js": 14 * 1024, "home-3d-device-popup.js": 16 * 1024, "home-3d-editor-item-picker.js": 14 * 1024, "home-3d-editor-icon-picker.js": 8 * 1024, "home-3d-editor-phone-bar.js": 12 * 1024, "home-3d-editor-tool-panel.js": 16 * 1024, "home-3d-rooms-picker.js": 8 * 1024, "home-3d-view-panel.js": 28 * 1024, "home-3d-room-panel.js": 33 * 1024, "home-3d-home-switcher.js": 12 * 1024, "home-3d-editor-lazy-parts.js": 94 * 1024, "home-3d-settings-pickers.js": 12 * 1024, "home-3d-settings-reset.js": 4 * 1024, "home-3d.js": 2 * 1024, "home-3d-app.js": 145 * 1024, "home-3d-view3d.js": 335 * 1024, "home-3d-walk.js": 16 * 1024, "home-3d-listedit.js": 12 * 1024, "home-3d-fun.js": 44 * 1024, "home-3d-voice.js": 40 * 1024, "home-3d-locate.js": 48 * 1024, "home-3d-timetravel.js": 105 * 1024, "home-3d-3d.js": 900 * 1024, "home-3d-editor.js": 860 * 1024, "home-3d-card-editor.js": 40 * 1024, "home-3d-items.js": 75 * 1024, "home-3d-align.js": 12 * 1024, "home-3d-2d.js": 74 * 1024, "home-3d-settings.js": 95 * 1024 };
const GZIP_BUDGET = { "home-3d-app.js": 45 * 1024, "home-3d-view3d.js": 100 * 1024, "home-3d-3d.js": 280 * 1024 };

// What is loaded before something shows, raw and as sent (gzip), with everything those files import (#179): a module
// moved from one bundle to another does not slip through. Every page of Home Assistant loads the main bundle; a wall
// tablet showing the house (the panel or a card) loads the 3D view and the 3D bundle on top.
const PATHS = {
  "every page": { files: ["home-3d.js", "home-3d-app.js"], raw: 425 * 1024, gzip: 146 * 1024 },
  "wall tablet": { files: ["home-3d.js", "home-3d-app.js", "home-3d-view3d.js", "home-3d-3d.js"], raw: 1630 * 1024, gzip: 500 * 1024 },
  // #245: the editor's entry and its shared chunks, under the editor's old budget (the lazy chunks have their own)
  "editor first open": { files: ["home-3d-editor.js"], raw: 1000 * 1024 }, // run 12 (#406-#422, set 7 Nov 2026): 1000 KB, items 75 KB; speed checked at 4x. Before: run 7 (#363 #378 #382 #383 #384): 869.4 KB; owner: speed over size, editor open time checked live
  // #245: the Settings page split the same way, under its old 95 KB
  "settings first open": { files: ["home-3d-settings.js"], raw: 98 * 1024 },
};

/** The file a budget name stands for: a chunk's is found by its name without the hash. */
function shippedFile(name) {
  if (existsSync(`${out}/${name}`)) return name;
  const stem = name.replace(/\.js$/, "-");
  return readdirSync(out).find((f) => CHUNK.test(f) && f.startsWith(stem)) ?? name;
}

/** `files` and every file they import (not the lazy imports), by esbuild's metafiles. */
function withImports(metafiles, files) {
  const outputs = Object.fromEntries(metafiles.flatMap((m) => Object.entries(m.outputs)).map(([path, o]) => [path.split("/").pop(), o]));
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const i of outputs[file]?.imports ?? []) if (i.kind === "import-statement") visit(i.path.split("/").pop());
  };
  files.forEach(visit);
  return [...seen];
}

/** The biggest inputs of a bundle, from esbuild's metafile. */
function topInputs(metafile, file, n = 15) {
  const output = Object.entries(metafile.outputs).find(([path]) => path.endsWith(`/${file}`))?.[1];
  if (!output) return [];
  return Object.entries(output.inputs)
    .map(([path, v]) => [path, v.bytesInOutput])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

copyFonts();
if (watch) {
  // in watch mode the hash is not tracked; a dev reload fetches the bundle anyway
  for (const c of [bootConfig, viewerConfig, itemsConfig("dev"), editorConfig("dev", "dev", "dev", "dev"), alignConfig, cardEditorConfig, timeTravelConfig, funConfig, voiceConfig, locateConfig, plan2dConfig, settingsConfig, mainConfig(Object.fromEntries(HASHED.map((name) => [name, "dev"])))]) await (await context(c)).watch();
} else {
  // the main bundle's chunks of an earlier build go (their names change with their content)
  for (const f of readdirSync(out)) if (CHUNK.test(f)) rmSync(`${out}/${f}`);
  const metafiles = [];
  const run = async (config) => metafiles.push((await build(config)).metafile);
  // the 3D bundle knows the build too: the geometry it keeps in the browser between loads belongs to one (run 6 speed)
  await run({ ...viewerConfig, define: { __FP3D_BUILD__: JSON.stringify(buildId) } });
  await run(locateConfig);
  const items = itemsConfig(hashOf(viewerConfig.outfile));
  await run(items);
  await run(alignConfig);
  await run(editorConfig(hashOf(viewerConfig.outfile), hashOf(locateConfig.outfile), hashOf(items.outfile), hashOf(alignConfig.outfile)));
  await run(cardEditorConfig);
  await run(timeTravelConfig);
  await run(funConfig);
  await run(voiceConfig);
  await run(plan2dConfig);
  await run(settingsConfig);
  await run(bootConfig);
  await run(
    mainConfig({
      viewer: hashOf(viewerConfig.outfile),
      editor: hashOf(EDITOR),
      cardEditor: hashOf(cardEditorConfig.outfile),
      timeTravel: hashOf(timeTravelConfig.outfile),
      fun: hashOf(funConfig.outfile),
      voice: hashOf(voiceConfig.outfile),
      locate: hashOf(locateConfig.outfile),
      plan2d: hashOf(plan2dConfig.outfile),
      settings: hashOf(SETTINGS),
      settingsChunks: withImports(metafiles, ["home-3d-settings.js"]).filter((f) => f !== "home-3d-settings.js"),
      editorChunks: withImports(metafiles, ["home-3d-editor.js"]).filter((f) => f !== "home-3d-editor.js"),
    }),
  );
  writeFileSync(`${out}/build.json`, `${JSON.stringify({ build: buildId, version })}
`);
  let over = false;
  // old Fire-tablet WebViews (Chrome before 91, e.g. Fully Kiosk on a Fire 7) throw on an optional call with spread
  // arguments, `a?.b(...x)` – the roof failed there; lowering the target for it would cost ~11 KB, so it is banned
  // every bundle and chunk shipped, shared chunks too
  const shipped = readdirSync(out).filter((f) => f.endsWith(".js"));
  for (const file of shipped) {
    const hit = readFileSync(`${out}/${file}`, "utf8").match(/\?\.(?:[\w$]+)?\(\.\.\./);
    if (hit) {
      over = true;
      console.log(`OLD-WEBVIEW ${file}: "${hit[0]}" breaks Chrome < 91 – write it as "if (a.b) a.b(...x)"`);
    }
  }
  // the same WebViews lack newer functions (Object.hasOwn and findLast from Chrome 93/97, the toSorted family from 110)
  // and dvh (108): our own sources may not use them, and dvh only inside @supports – a dvh line with var() is not
  // dropped by an old browser, it loses the whole height (the Fire 7 showed an empty panel; idea: CasaNeon)
  const NEWER = /\bObject\.hasOwn\(|\.findLast(?:Index)?\(|\.to(?:Sorted|Reversed|Spliced)\(/;
  const sources = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(`${dir}/${e.name}`) : e.name.endsWith(".ts") && !e.name.endsWith(".test.ts") ? [`${dir}/${e.name}`] : []));
  for (const file of sources("src")) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const newer = line.match(NEWER);
      const dvh = /\d+dvh\b/.test(line) && !line.includes("@supports") && !lines.slice(Math.max(0, i - 3), i).some((l) => l.includes("@supports"));
      if (newer || dvh) {
        over = true;
        console.log(`OLD-WEBVIEW ${file}:${i + 1}: ${newer ? `"${newer[0]}" is missing in old WebViews` : "dvh outside @supports (height: 100dvh)"}`);
      }
    });
  }
  // German comes from its language pack (#134, #196): a bundle that imports the German table again carries it for everyone
  const german = [de.no_building_admin, de.no_persons, de.phone_hint];
  for (const file of shipped) {
    const text = readFileSync(`${out}/${file}`, "utf8");
    if (german.some((s) => text.includes(JSON.stringify(s).slice(1, -1)))) {
      over = true;
      console.log(`GERMAN ${file}: holds the German table – German comes from its language pack, never from a bundle`);
    }
  }
  // the Settings page borrows the main bundle's texts (#139), the editor and the card editor its English table (#196):
  // a bundle of these that holds the table carries the whole English table a second time
  {
    const { englishTable } = await import("./src/i18n.ts");
    for (const file of ["home-3d-card-editor.js", ...shipped.filter((f) => f.startsWith("home-3d-editor") || f.startsWith("home-3d-settings"))]) {
      const text = readFileSync(`${out}/${file}`, "utf8");
      if (text.includes(JSON.stringify(englishTable().no_building_admin).slice(1, -1))) {
        over = true;
        console.log(`ENGLISH ${file}: holds the main texts – ${file.startsWith("home-3d-settings") ? "take them from the panel (t), never import i18n.ts" : "the borrow-english plugin must swap i18n.ts for i18n-borrowed.ts"}`);
      }
    }
  }
  // a lazy import gets a budget of its own; a shared chunk (modules two of them use) is counted in the paths
  for (const f of readdirSync(out)) {
    if (CHUNK.test(f) && !/^home-3d-(?:editor-|settings-)?chunk-/.test(f) && !Object.keys(BUDGET).some((name) => shippedFile(name) === f)) {
      over = true;
      console.log(`CHUNK ${f}: a lazy import without a budget`);
    }
  }
  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  const gz = (file) => gzipSync(readFileSync(`${out}/${file}`), { level: 9 }).length;
  for (const [name, limit] of Object.entries(BUDGET)) {
    const file = shippedFile(name);
    const size = statSync(`${out}/${file}`).size;
    const gzip = gz(file);
    const gzipLimit = GZIP_BUDGET[name];
    const ok = size <= limit && (gzipLimit === undefined || gzip <= gzipLimit);
    over ||= !ok;
    console.log(`${ok ? "ok  " : "OVER"} ${file}: ${kb(size)} (budget ${limit / 1024} KB), gzip ${kb(gzip)}${gzipLimit ? ` (budget ${gzipLimit / 1024} KB)` : ""}`);
  }
  for (const [path, { files, raw, gzip }] of Object.entries(PATHS)) {
    const all = withImports(metafiles, files.map(shippedFile));
    const size = all.reduce((n, f) => n + statSync(`${out}/${f}`).size, 0);
    const zipped = all.reduce((n, f) => n + gz(f), 0);
    const ok = size <= raw && (gzip === undefined || zipped <= gzip);
    over ||= !ok;
    console.log(`${ok ? "ok  " : "OVER"} ${path} (${all.join(" + ")}): ${kb(size)} (budget ${raw / 1024} KB), gzip ${kb(zipped)}${gzip ? ` (budget ${gzip / 1024} KB)` : ""}`);
  }
  if (report) {
    for (const name of Object.keys(BUDGET)) {
      const file = shippedFile(name);
      const meta = metafiles.find((m) => Object.keys(m.outputs).some((o) => o.endsWith(`/${file}`)));
      if (!meta) continue;
      console.log(`\n${file}, the 15 biggest inputs:`);
      for (const [path, bytes] of topInputs(meta, file)) console.log(`  ${kb(bytes).padStart(9)}  ${path}`);
    }
  }
  if (over) process.exit(1);
}
