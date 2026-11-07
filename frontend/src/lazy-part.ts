// A part of a page that is a chunk of its own (#245): an element whose code loads the first time it is drawn. The page
// draws the element's tag at once; the element takes the properties it was given when its code arrives (as the 3D view
// does, load-view.ts). Used by the editor (components/editor/lazy.ts), the Settings page and the panel (load-parts.ts).

import { guardImport } from "./guard-import.ts";

/** Loads `load` once; a failed download is forgotten, so the next call tries again. */
export function once(load: () => Promise<unknown>): () => Promise<void> {
  let loading: Promise<void> | undefined;
  return () =>
    (loading ??= guardImport(load()).then(
      () => undefined,
      (err: unknown) => {
        loading = undefined;
        throw err;
      },
    ));
}

/** Starts loading a part (from a render): a failure is logged, and the next call tries again. */
export function need(load: () => Promise<void>): void {
  load().catch((err: unknown) => console.error("Home 3D: a part of the page failed to load", err));
}
