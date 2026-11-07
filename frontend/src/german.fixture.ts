// Test helper: the German texts (#196), as Home 3D ships them in its German language pack
// (custom_components/home_3d/bundled_languages/amluto.lang-de/strings.json). Not part of any bundle.

import { readFileSync } from "node:fs";
import type { I18nKey } from "./i18n.ts";

export const de = JSON.parse(readFileSync(new URL("../../custom_components/home_3d/bundled_languages/amluto.lang-de/strings.json", import.meta.url), "utf8")) as Record<I18nKey, string>;
