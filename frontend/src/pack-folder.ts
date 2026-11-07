// Pack folders picked in the browser (format v2, see docs/packs.md): which files of a picked folder make up which
// pack. A pack is the folder holding a pack.json; a picked repository may hold several (a folder per pack). The
// backend checks the content again (custom_components/home_3d/packs.py); this only decides what to send.

/** One pack of a picked folder. */
export interface PackFolderPlan {
  /** The pack's folder, as a path inside the picked folder. */
  root: string;
  /** The files to send: path inside the pack folder -> path as picked. */
  files: Map<string, string>;
  /** Files that have no place in a pack (pictures, code …), as paths inside the pack folder. */
  refused: string[];
}

const PACK_FILE = "pack.json";
/** A readme or licence text may sit next to the data; it is not sent. */
const DOC = /^(?:README|LICEN[CS]E|COPYING|CHANGELOG)(?:\.(?:md|txt))?$/i;

/** The packs in a picked folder, given the picked files' paths ("folder/sub/file.json"), in path order. */
export function planPackFolders(paths: readonly string[]): PackFolderPlan[] {
  // hidden files and folders (.git, .github) are never part of a pack
  const visible = paths.filter((p) => !p.split("/").some((part) => part.startsWith(".")));
  const roots = visible.filter((p) => p === PACK_FILE || p.endsWith(`/${PACK_FILE}`)).map((p) => p.slice(0, -PACK_FILE.length).replace(/\/$/, ""));
  const plans = new Map(roots.sort().map((root) => [root, { root, files: new Map<string, string>(), refused: [] as string[] }]));
  for (const path of visible) {
    // a file belongs to the deepest pack folder around it
    const root = roots.filter((r) => r === "" || path.startsWith(`${r}/`)).sort((a, b) => b.length - a.length)[0];
    if (root === undefined) continue;
    const rel = root ? path.slice(root.length + 1) : path;
    const plan = plans.get(root)!;
    if (DOC.test(rel)) continue;
    if (rel.toLowerCase().endsWith(".json")) plan.files.set(rel, path);
    else plan.refused.push(rel);
  }
  return [...plans.values()];
}
