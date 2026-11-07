// Loads the editor bundle only when the editor is opened (it defines <fp3d-editor>).
import type * as EditorBundle from "./components/editor.ts";
import { lazyBundle } from "./lazy-bundle.ts";

/** Content hash of the editor bundle, set by the build (see build.mjs). */
declare const __FP3D_EDITOR_HASH__: string;
/** Its shared chunks, fetched with it (#245, build.mjs). */
declare const __FP3D_EDITOR_CHUNKS__: string[];

export const loadEditor = lazyBundle<typeof EditorBundle>("home-3d-editor", () => __FP3D_EDITOR_HASH__, () => __FP3D_EDITOR_CHUNKS__);

/** The Extensions page (<fp3d-extensions>): a chunk of the editor bundle (#245), loaded with the bundle's own loader. */
export const loadExtensionsPage = (): Promise<void> => loadEditor().then((bundle) => bundle.loadExtensions());
