/**
 * How the editor is split (#202): `Fp3dEditor` (editor.ts) keeps its reactive state, fields, getters and the Lit
 * lifecycle; every editor area (rooms, walls, openings, the wall view, the pool …) is a class of plain methods in its
 * own module here, written with `this: Fp3dEditor`. editor.ts declares `interface Fp3dEditor extends <the parts>` for
 * the types and calls `mixParts` once, which copies each part's methods onto the element's prototype: at runtime it is
 * one element with the same methods as before, so `this`, events and reactivity work exactly as they did.
 */

/** A part: a class whose prototype holds methods (getters and fields stay on the element). */
type Part = { prototype: object; name: string };

/** Copies the parts' methods onto `target.prototype`; a name that is already there is a mistake (two parts, or a part and the element). */
export function mixParts(target: { prototype: object }, parts: readonly Part[]): void {
  for (const part of parts) {
    for (const [name, desc] of Object.entries(Object.getOwnPropertyDescriptors(part.prototype))) {
      if (name === "constructor") continue;
      if (Object.prototype.hasOwnProperty.call(target.prototype, name)) throw new Error(`editor part ${part.name}: ${name} is defined twice`);
      Object.defineProperty(target.prototype, name, desc);
    }
  }
}
