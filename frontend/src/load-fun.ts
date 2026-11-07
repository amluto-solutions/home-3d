// Fun packs (pets …): their bundle loads only when one is unlocked and switched on.

import type * as FunBundle from "./fun/entry.ts";
import { lazyBundle } from "./lazy-bundle.ts";

/** Content hash of the fun bundle, set by the build (see build.mjs). */
declare const __FP3D_FUN_HASH__: string;

export const loadFun = lazyBundle<typeof FunBundle>("home-3d-fun", () => __FP3D_FUN_HASH__);
