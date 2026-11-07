// Loads the three.js bundle only when a 3D view is opened.

import { guardImport } from "./guard-import.ts";
import type * as Viewer from "./viewer/viewer3d.ts";

export type ViewerModule = typeof Viewer;

/** Content hash of the 3D bundle, set by the build (see build.mjs). */
declare const __FP3D_VIEWER_HASH__: string;

const base = new URL(import.meta.url);
const url = new URL(`./home-3d-3d.js?v=${__FP3D_VIEWER_HASH__}`, base).href;

let loading: Promise<ViewerModule> | undefined;

export function load3d(): Promise<ViewerModule> {
  loading ??= guardImport(import(/* @vite-ignore */ url) as Promise<ViewerModule>);
  return loading;
}

let preloaded = false;

/**
 * Fetches and compiles the 3D bundle without running it (run 6 speed), as the panel starts: it is the biggest file and
 * was asked for only once the 3D view's own code had arrived and started, one round trip after it. load3d then finds
 * it ready. Not on a page that shows the plan flat (#41).
 */
export function preload3d(): void {
  if (preloaded || loading || typeof document === "undefined") return;
  preloaded = true;
  const link = document.createElement("link");
  link.rel = "modulepreload";
  link.href = url;
  document.head.append(link);
}
