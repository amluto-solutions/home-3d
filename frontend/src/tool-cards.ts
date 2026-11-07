// The editor's Build and Outside panels (#402): one card per thing that can be drawn, in the style of the furniture
// library. Plain data and small functions (which card is in use, search, last used first), so tests can hold them.

import type { I18nKey } from "./i18n.ts";
import type { OutdoorType } from "./model.ts";
import type { Tool } from "./editor-hint.ts";

export type ToolGroup = "build" | "outside";
export type PoolShape = "rect" | "round" | "oval" | "free";

/** How a card's tool is drawn: the one-line hint under the panel says it. */
export type DrawHow = "drag" | "box" | "corners" | "measure" | "wall" | "opening" | "hole" | "roof" | "pipes";

export interface ToolCard {
  /** "rect", "wall" …, "out_lawn" …, "pool_round" …, "pool_pipes" */
  id: string;
  group: ToolGroup;
  tool: Tool;
  name: I18nKey;
  how: DrawHow;
  /** An outdoor area card: its type (drawn as a rectangle or by its corners, as the panel's shape choice says). */
  outdoor?: OutdoorType;
  pool?: PoolShape;
  pipes?: boolean;
  /** English words the search also matches (the names are searched in the page's language). */
  words: string;
}

const area = (t: OutdoorType, words: string): ToolCard => ({ id: `out_${t}`, group: "outside", tool: "outdoor", name: `out_${t}` as I18nKey, how: "drag", outdoor: t, words });
const pool = (s: PoolShape, how: DrawHow): ToolCard => ({ id: `pool_${s}`, group: "outside", tool: "pool", name: `tc_pool_${s}` as I18nKey, how, pool: s, words: "pool swimming water" });

/** Every card, in the order the panels show them. */
export const TOOL_CARDS: readonly ToolCard[] = [
  { id: "rect", group: "build", tool: "rect", name: "tc_rect", how: "drag", words: "room rectangle square box" },
  { id: "polygon", group: "build", tool: "polygon", name: "tc_polygon", how: "corners", words: "room free shape polygon corners l-shape" },
  { id: "measure", group: "build", tool: "measure", name: "tc_measure", how: "measure", words: "room measure length metres feet dimensions" },
  { id: "wall", group: "build", tool: "wall", name: "tool_wall", how: "wall", words: "wall partition half wall" },
  { id: "opening", group: "build", tool: "opening", name: "tc_opening", how: "opening", words: "door window opening garage glass" },
  { id: "hole", group: "build", tool: "hole", name: "tool_hole", how: "hole", words: "floor opening hole stairwell stairs gallery void" },
  { id: "roof", group: "build", tool: "roof", name: "tool_roof", how: "roof", words: "roof gable hip flat" },
  area("lawn", "lawn grass garden"),
  area("terrace", "terrace patio deck"),
  area("path", "path walkway footpath"),
  area("driveway", "driveway drive car parking"),
  area("bed", "flower bed border plants"),
  area("wild", "wild patch meadow pond"),
  area("hedge", "hedge bushes shrubs"),
  area("fence", "fence railing boundary"),
  area("pergola", "pergola frame arbour carport"),
  area("balcony", "balcony"),
  pool("rect", "drag"),
  pool("round", "box"),
  pool("oval", "box"),
  pool("free", "corners"),
  { id: "pool_pipes", group: "outside", tool: "pool", name: "pool_pipe_draw", how: "pipes", pipes: true, words: "pool pipe pipes plumbing pump" },
];

/** The cards of a panel; the pool pipes only where a module brings their rules. */
export function cardsOf(group: ToolGroup, pipes: boolean): ToolCard[] {
  return TOOL_CARDS.filter((c) => c.group === group && (!c.pipes || pipes));
}

/** The editor's drawing state, as far as the cards care. */
export interface ToolState {
  tool: Tool;
  outdoorType: OutdoorType;
  poolShape: PoolShape;
  pipeMode: boolean;
}

/** The card of the tool in use, or null (Select, Furniture, Energy). */
export function activeCard(s: ToolState): string | null {
  if (s.tool === "outdoor") return `out_${s.outdoorType}`;
  if (s.tool === "pool") return s.pipeMode ? "pool_pipes" : `pool_${s.poolShape}`;
  return TOOL_CARDS.some((c) => c.id === s.tool && c.group === "build") ? s.tool : null;
}

/** The line that says how to draw: the hint bar's own where it has one, so both say the same. */
const HOW: Record<DrawHow, I18nKey> = {
  drag: "tp_how_drag",
  box: "tp_how_box",
  corners: "hint_polygon",
  measure: "hint_measure",
  wall: "hint_wall",
  opening: "tp_how_opening",
  hole: "hint_hole",
  roof: "hint_roof",
  pipes: "hint_pipe_pool",
};

/** The hint text key for how a card draws; an area drawn by its corners says so. */
export function howKey(card: ToolCard, free: boolean): I18nKey {
  return HOW[card.outdoor && free ? "corners" : card.how];
}

export function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

/** The cards whose name (as shown), hint or English words hold every word of the query. */
export function searchCards(cards: readonly ToolCard[], query: string, text: (c: ToolCard) => string): ToolCard[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [...cards];
  return cards.filter((c) => {
    const hay = fold(`${text(c)} ${c.words}`);
    return words.every((w) => hay.includes(w));
  });
}

/** Where the last used cards are remembered on this device. */
export const RECENT_KEY = "home3d.toolRecent";
export const RECENT_SHOWN = 4;

/** A card used: first in the list, kept to a dozen. */
export function useCard(recent: readonly string[], id: string): string[] {
  return [id, ...recent.filter((x) => x !== id)].slice(0, 12);
}

/** The last used cards of a panel, newest first (as many as the Recent row shows). */
export function recentCards(cards: readonly ToolCard[], recent: readonly string[]): ToolCard[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return recent
    .map((id) => byId.get(id))
    .filter((c): c is ToolCard => !!c)
    .slice(0, RECENT_SHOWN);
}
