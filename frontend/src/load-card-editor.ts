// Loads the card's visual editor only when the dashboard opens it (it defines <home-3d-card-editor>).
import { lazyBundle } from "./lazy-bundle.ts";

/** Content hash of the card editor bundle, set by the build (see build.mjs). */
declare const __FP3D_CARD_EDITOR_HASH__: string;

export const loadCardEditor = lazyBundle("home-3d-card-editor", () => __FP3D_CARD_EDITOR_HASH__);
