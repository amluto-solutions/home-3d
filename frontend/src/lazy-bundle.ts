// The loader of a bundle that is fetched only when it is needed (the editor, time travel, voice …). The bundles sit
// next to the main one; the content hash in the URL means a new build is never taken from the browser cache.

import { guardImport } from "./guard-import.ts";
import { lateTextsReady } from "./i18n-core.ts";

/**
 * A function that loads the bundle `name` (the file `<name>.js`, `hash` returns its content hash from the build) once
 * and returns the same promise afterwards. A failed download (a short network hiccup) is forgotten, so the next call
 * tries again.
 *
 * `hash` is only called when the bundle is loaded: the build defines a hash constant only in the bundles that load that
 * bundle, and a loader module is often bundled elsewhere too (load-voice.ts sits in the editor bundle), where reading
 * the constant while the module loads would throw (#52).
 *
 * `chunks` (#245): the files a split bundle imports at once (the editor's shared chunks, named by the build). They are
 * fetched together with the bundle, not after it has arrived and named them: one round trip instead of two. A failure
 * there is the bundle's own (its import fails too), so it is not reported twice.
 */
export function lazyBundle<T = unknown>(name: string, hash: () => string, chunks?: () => string[]): () => Promise<T> {
  let loading: Promise<T> | undefined;
  return () => {
    if (!loading) {
      const url = new URL(`./${name}.js?v=${hash()}`, new URL(import.meta.url)).href;
      for (const chunk of chunks?.() ?? []) import(/* @vite-ignore */ new URL(`./${chunk}`, new URL(import.meta.url)).href).catch(() => undefined);
      // the English texts only these bundles show come as a chunk of their own, fetched alongside
      loading = Promise.all([guardImport(import(/* @vite-ignore */ url) as Promise<T>), lateTextsReady()]).then(([bundle]) => bundle).catch((err) => {
        loading = undefined;
        throw err;
      });
    }
    return loading;
  };
}
