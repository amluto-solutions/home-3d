// An edit beside the editor's plan (#390): which floors the incremental rebuild leaves as they are for now, to model
// them in slices first (a new home's floors are modelled the same way, run 6 speed).

/**
 * The shown floors an incremental rebuild leaves standing until they are modelled: those whose key changed (an item
 * moved, a wall drawn: the floor is built anew either way) and whose new geometry is not modelled yet. Floors kept as
 * they are, floors gone from the plan and floors already modelled for their new key are not among them; a full rebuild
 * (new packs, another look), a home still loading and the House view (`on` false) leave none.
 */
export function floorsToSlice(
  shown: readonly { id: string; key: string }[],
  keys: ReadonlyMap<string, string>,
  preparedKey: (id: string) => string | undefined,
  opts: { on: boolean; incremental: boolean; loading: boolean },
): Set<string> {
  const out = new Set<string>();
  if (!opts.on || !opts.incremental || opts.loading) return out;
  for (const f of shown) {
    const key = keys.get(f.id);
    if (key === undefined || key === f.key || preparedKey(f.id) === key) continue;
    out.add(f.id);
  }
  return out;
}
