// The item editor (#13): its bundle loads only when an editor opens it.

import type * as ItemsBundle from "./items/entry.ts";
import { lazyBundle } from "./lazy-bundle.ts";

/** Content hash of the item editor's bundle, set by the build (see build.mjs). */
declare const __FP3D_ITEMS_HASH__: string;

export const loadItems = lazyBundle<typeof ItemsBundle>("home-3d-items", () => __FP3D_ITEMS_HASH__);
