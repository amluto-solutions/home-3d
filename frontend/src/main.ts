// The app (home-3d-app.js, imported by the start file home-3d.js: boot.ts, #357): sidebar panel, dashboard card and
// editor. three.js is loaded separately on demand.

import "./polyfills.ts";
import { registerFonts } from "./fonts.ts";
import "./panel.ts";
import "./card.ts";
import { installChunkReloadGuard, reloadForCurrentBuild } from "./chunk-reload.ts";
import { mayDefine, OWN_BUILD } from "./define.ts";
import { micProbeAsked } from "./load-voice.ts";

if (mayDefine()) {
  installChunkReloadGuard();
  registerFonts();
  // note "?fp3d_mic=1" before Home Assistant forwards the address to a dashboard and drops it
  micProbeAsked();
} else {
  // another build runs this page (#357): this copy defined nothing; when it is the current build, one reload
  console.info(`Home 3D: this page runs another build; build ${OWN_BUILD} stays out of it`);
  void reloadForCurrentBuild(OWN_BUILD);
}
