/** The kinds of the cards drawn, in order: when it changes, their elements are new and know neither place nor view. */
export function holoShape(cards: readonly { kind: string }[]): string {
  return cards.map((c) => c.kind).join(",");
}
