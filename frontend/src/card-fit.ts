// The dashboard card's bar of switches on a narrow card (#263, V18): the controls that fit stay in the bar, the rest
// go into a ⋯ menu at its end. Widths are estimated from the texts (no layout read), so the split is the same on
// every render and needs no second pass.

/** One control of the card's bar: its id and the texts of its buttons (one for a chip, several for a segmented row). */
export interface BarItem {
  id: string;
  texts: readonly string[];
  /** Kept in the bar whatever the width (Back: the way out of a room or floor). */
  keep?: boolean;
}

/** The gap between controls and the ⋯ button's width (px). */
const GAP = 8;
export const MENU_W = 44;

/** A control's estimated width: 14 px medium text, 13 px padding each side per button, 3 px around a segmented row. */
export function itemWidth(item: BarItem): number {
  const buttons = item.texts.reduce((sum, t) => sum + [...t].length * 7.6 + 26, 0);
  return Math.ceil(buttons + (item.texts.length > 1 ? 6 + 2 * (item.texts.length - 1) : 0));
}

/**
 * Which controls stay in the bar and which go into the menu for a bar `room` px wide. Everything fits: no menu. Else
 * the bar keeps, in order, what fits next to the ⋯ button (the kept ones always), and the menu takes the rest.
 */
export function fitBar(items: readonly BarItem[], room: number): { bar: string[]; menu: string[] } {
  const width = (list: readonly BarItem[]) => list.reduce((s, it, i) => s + itemWidth(it) + (i ? GAP : 0), 0);
  if (width(items) <= room) return { bar: items.map((i) => i.id), menu: [] };
  const bar: string[] = [];
  const menu: string[] = [];
  let used = MENU_W;
  for (const it of items) {
    const w = itemWidth(it) + GAP;
    if (it.keep || (menu.length === 0 && used + w <= room)) {
      bar.push(it.id);
      used += w;
    } else menu.push(it.id);
  }
  return { bar, menu };
}
