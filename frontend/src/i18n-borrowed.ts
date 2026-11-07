// What the editor and card-editor bundles get for "i18n.ts" (#196; build.mjs swaps it in): the same functions, with the
// English texts borrowed from the page. The main bundle loads both bundles, and its i18n.ts has registered the table by
// then, so they no longer carry a copy each (about 125 KB apiece).

import { english } from "./i18n-core.ts";
import type { I18nKey } from "./i18n.ts";

export * from "./i18n-core.ts";
export type { I18nKey } from "./i18n.ts";

/** The English texts, as the main bundle registered them. */
export const englishTable = (): Readonly<Record<I18nKey, string>> => english() as Record<I18nKey, string>;
