// One scene rebuild per batch of changes (#131). The view hands the viewer new packs, parked cars and a new plan in
// one update (a home switch); inside `run` their rebuilds wait and happen once when it ends.

export class RebuildBatch {
  private depth = 0;
  /** What the batch asked for so far: null nothing, true only incremental rebuilds (new plans), false a full one. */
  private wanted: boolean | null = null;

  private readonly rebuild: (incremental: boolean) => void;

  /** `rebuild(incremental)`: the viewer's own rebuild. */
  constructor(rebuild: (incremental: boolean) => void) {
    this.rebuild = rebuild;
  }

  /** A rebuild now, or when the running batch ends. `incremental`: only floors whose drawing changed. */
  request(incremental: boolean): void {
    if (!this.depth) return this.rebuild(incremental);
    this.wanted = this.wanted !== false && incremental;
  }

  run(changes: () => void): void {
    this.depth++;
    try {
      changes();
    } finally {
      this.depth--;
      if (!this.depth && this.wanted !== null) {
        const incremental = this.wanted;
        this.wanted = null;
        this.rebuild(incremental);
      }
    }
  }
}
