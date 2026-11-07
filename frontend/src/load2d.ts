// Loads the 2D plan's bundle (#41) only when a view shows the plan flat.

import { guardImport } from "./guard-import.ts";
import type * as Plan2d from "./plan2d/entry.ts";

/** Content hash of the 2D bundle, set by the build (see build.mjs). */
declare const __FP3D_PLAN2D_HASH__: string;

let loading: Promise<typeof Plan2d> | undefined;

export function load2d(): Promise<typeof Plan2d> {
  const url = new URL(`./home-3d-2d.js?v=${__FP3D_PLAN2D_HASH__}`, new URL(import.meta.url)).href;
  loading ??= guardImport(import(/* @vite-ignore */ url) as Promise<typeof Plan2d>).catch((err) => {
    loading = undefined;
    throw err;
  });
  return loading;
}
