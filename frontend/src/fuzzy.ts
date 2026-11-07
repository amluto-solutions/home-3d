// Forgiving word matching for the library search (#78): a small edit-distance check, written here on purpose (no
// fuzzy-search library). Pure logic, no DOM.

/**
 * Optimal string alignment distance: the fewest single-letter inserts, deletes, replacements and swaps of two
 * neighbouring letters that turn `a` into `b` ("sofa" -> "sfoa" is one).
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  if (!n) return m;
  if (!m) return n;
  let prev2: number[] = [];
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const row = [i];
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      row.push(d);
    }
    prev2 = prev;
    prev = row;
  }
  return prev[m];
}

/**
 * How many slips a typed word may have and still count: none under 4 letters, only a swap of two letters at 4
 * ("sfoa", but not "lamb" for "lamp"), one at 5-8, two from 9 letters.
 */
export function fuzzyLimit(word: string): number {
  return word.length < 4 ? 0 : word.length < 9 ? 1 : 2;
}

/** Is `candidate` the typed `word` with a few slips? Both already folded (lower case, no accents). */
export function fuzzyEquals(word: string, candidate: string): boolean {
  const limit = fuzzyLimit(word);
  // a slip rarely lands on the first letter, and requiring it keeps "worktop" from finding "cooktop"
  if (!limit || word === candidate || word[0] !== candidate[0] || Math.abs(word.length - candidate.length) > limit) return false;
  if (word.length === 4) {
    // four letters: only the same letters in another order, so "lamb" is not "lamp"
    return candidate.length === 4 && [...word].sort().join("") === [...candidate].sort().join("") && editDistance(word, candidate) === 1;
  }
  return editDistance(word, candidate) <= limit;
}
