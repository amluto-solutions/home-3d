// Build plugin (#196): every bundle but the main one (the editor, the card editor, the 3D bundle …) loads only from the
// main bundle, which holds the English table (i18n.ts) and registers it on the page. For them every import of i18n.ts is
// swapped for i18n-borrowed.ts, the same functions without the table, so none carries a copy of it (about 125 KB).

import { fileURLToPath } from "node:url";
import type { Plugin } from "esbuild";

export const BORROWED = fileURLToPath(new URL("./i18n-borrowed.ts", import.meta.url));

export const borrowEnglish: Plugin = {
  name: "borrow-english",
  setup(b) {
    b.onResolve({ filter: /(?:^|[\/])i18n\.ts$/ }, (args) => (args.importer === BORROWED ? undefined : { path: BORROWED }));
  },
};

const NO_LATE = fileURLToPath(new URL("./i18n-late-none.ts", import.meta.url));

/**
 * The main bundle's plugin: the English texts only the lazy bundles show (i18n-late.ts, two thirds of the table) are
 * not part of i18n.ts there; they are the chunk i18n-register-late.ts, fetched before such a bundle loads.
 */
export const lateTextsChunk: Plugin = {
  name: "late-texts-chunk",
  setup(b) {
    b.onResolve({ filter: /(?:^|[\/])i18n-late\.ts$/ }, (args) => (args.importer.endsWith("i18n.ts") ? { path: NO_LATE } : undefined));
  },
};
