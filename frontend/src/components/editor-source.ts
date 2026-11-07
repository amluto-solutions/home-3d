/**
 * Test helper (#202): the editor's source text, for tests that check what the code does or no longer does by reading
 * it. The editor is `editor.ts` plus its area modules and styles under `editor/`; this joins them all, so a check
 * still sees code that moved between them. Not part of any bundle.
 */
import { readdirSync, readFileSync } from "node:fs";

/** Every `.ts` file of the editor (tests excluded), `editor.ts` first, then `editor/**` in name order. */
export function editorFiles(): URL[] {
  const walk = (dir: URL): URL[] =>
    readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, dir)) : e.name.endsWith(".ts") && !e.name.endsWith(".test.ts") ? [new URL(e.name, dir)] : []));
  return [new URL("./editor.ts", import.meta.url), ...walk(new URL("./editor/", import.meta.url))];
}

/** The text of all of them, joined. */
export function editorSource(): string {
  return editorFiles()
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
}
