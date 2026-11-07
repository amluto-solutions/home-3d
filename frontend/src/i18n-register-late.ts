// The chunk of the main bundle that holds the English texts of the editor, Settings, time travel and the like (i18n-late.ts):
// i18n.ts fetches it (lazy-bundle.ts) before one of those bundles loads. Importing it registers the texts.

import { registerEnglish } from "./i18n-core.ts";
import { lateEnglish } from "./i18n-late.ts";

registerEnglish(lateEnglish);
