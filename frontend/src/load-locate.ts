// Locating setup: its bundle loads only when an admin opens it.

import type * as LocateBundle from "./locate/entry.ts";
import { lazyBundle } from "./lazy-bundle.ts";

/** Content hash of the locating bundle, set by the build (see build.mjs). */
declare const __FP3D_LOCATE_HASH__: string;

export const loadLocate = lazyBundle<typeof LocateBundle>("home-3d-locate", () => __FP3D_LOCATE_HASH__);
