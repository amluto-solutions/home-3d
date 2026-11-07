// The language packs that ship with Home 3D (custom_components/home_3d/bundled_languages/*), read for the tests. Not
// part of any bundle.
import { readdirSync, readFileSync } from "node:fs";

const DIR = new URL("../../custom_components/home_3d/bundled_languages/", import.meta.url);

export interface BundledLanguage {
  folder: string;
  pack: Record<string, unknown>;
  language: string;
  strings: Record<string, string>;
}

/** Every bundled language pack, by folder name. */
export function bundledLanguages(): BundledLanguage[] {
  return readdirSync(DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const read = (f: string) => JSON.parse(readFileSync(new URL(`${e.name}/${f}`, DIR), "utf8")) as Record<string, unknown>;
      const pack = read("pack.json");
      return { folder: e.name, pack, language: String(pack.language), strings: read("strings.json") as Record<string, string> };
    });
}
