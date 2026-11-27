// Whether a sideways-scrolling row has more past its start and its end (1 px of rounding allowed) (#259): the panel's
// floor bar and the card's floor tabs (#548) fade out at that edge.
export const navEdges = (left: number, scrollWidth: number, clientWidth: number): { start: boolean; end: boolean } => ({
  start: left > 1,
  end: left + clientWidth < scrollWidth - 1,
});
