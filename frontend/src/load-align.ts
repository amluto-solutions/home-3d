// The align and distribute tools (#235): their bundle loads when the editor first selects several items.

import type * as AlignBundle from "./align/entry.ts";
import { lazyBundle } from "./lazy-bundle.ts";

/** Content hash of the align bundle, set by the build (see build.mjs). */
declare const __FP3D_ALIGN_HASH__: string;

export const loadAlign = lazyBundle<typeof AlignBundle>("home-3d-align", () => __FP3D_ALIGN_HASH__);
