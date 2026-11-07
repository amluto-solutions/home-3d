// The Settings page (#139): its bundle loads only when someone opens the Settings tab.

import type * as SettingsBundle from "./settings/entry.ts";
import { lazyBundle } from "./lazy-bundle.ts";

/** Content hash of the settings bundle, set by the build (see build.mjs). */
declare const __FP3D_SETTINGS_HASH__: string;
/** Its shared chunks, fetched with it (#245, build.mjs). */
declare const __FP3D_SETTINGS_CHUNKS__: string[];

export const loadSettings = lazyBundle<typeof SettingsBundle>("home-3d-settings", () => __FP3D_SETTINGS_HASH__, () => __FP3D_SETTINGS_CHUNKS__);
