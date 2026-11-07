import type { Building } from "./model.ts";

/** Undo steps kept; older ones drop off. */
export const HISTORY_STEPS = 100;
/**
 * The most plan JSON the steps may hold together, in characters (about bytes: plan JSON is nearly all ASCII). Past it
 * the oldest steps drop off, so a big plan can't fill a tablet's memory (#185). The newest step always stays.
 */
export const HISTORY_CHARS = 25_000_000;
/** Changes with the same merge key this close together (ms) are one step: a run of arrow nudges (#66). */
export const MERGE_MS = 500;

/**
 * The editor's undo history (#66), kept by the panel rather than by the editor element: panel.ts removes the editor
 * when another tab opens, and the history used to go with it.
 *
 * It belongs to one home and to the plan as this panel last left it (`doc`). A plan that arrives from anywhere else
 * (another home, a reload from the server, someone else's edit, a restored draft) starts a fresh history: an old step
 * would otherwise jump back over a change that is not in it.
 */
/**
 * One stored plan: the JSON of each top-level field in the plan's own order, the floors one string each. A part that
 * is the same as in another step is one shared string (#185): an edit on one floor stores that floor again, not the
 * other floors, the settings or the recipe copies (most of a big plan).
 */
type Step = [key: string, json: string | string[]][];

export class UndoHistory {
  private past: Step[] = [];
  private future: Step[] = [];
  /** Every distinct part string the steps hold, with how many steps hold it; `chars` is their total length. */
  private readonly pool = new Map<string, { s: string; n: number }>();
  private chars = 0;
  /** The home the steps belong to. */
  private home: string | null | undefined = undefined;
  /** The plan the steps lead up to: the last one this history handed out or was told about. */
  private doc: Building | null = null;
  /** The merge key of the last step and when a change last joined it. */
  private run: { key: string; at: number } | null = null;
  private readonly now: () => number;
  private readonly maxSteps: number;
  private readonly maxChars: number;

  constructor(opts: { now?: () => number; maxSteps?: number; maxChars?: number } = {}) {
    this.now = opts.now ?? Date.now;
    this.maxSteps = opts.maxSteps ?? HISTORY_STEPS;
    this.maxChars = opts.maxChars ?? HISTORY_CHARS;
  }

  /** The plan JSON the steps hold, in characters (each shared part counted once). */
  get size(): number {
    return this.chars;
  }

  /** Undo steps held. */
  get steps(): number {
    return this.past.length;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * A plan is shown (an editor opened, or a new plan came from the panel): the steps stay when it is the plan they
   * lead up to and the same home, else they are dropped. True when they were kept.
   */
  adopt(building: Building, home: string | null | undefined): boolean {
    const keep = home === this.home && building === this.doc;
    if (!keep) this.clear();
    this.home = home;
    this.doc = building;
    return keep;
  }

  /**
   * A change made outside the editor (the 3D view's furnishing, the start view, the Extensions page): one more step,
   * so the editor opened next keeps the history. `base` is the plan it was made on.
   */
  record(base: Building, next: Building, home: string | null | undefined, key: string | null = null): void {
    this.adopt(base, home);
    this.push(base, key);
    this.track(next);
  }

  /** The plan is now `doc` without a new step (a drag on the move; the step comes when it ends). */
  track(doc: Building): void {
    this.doc = doc;
  }

  /**
   * A change was made: `base` (the plan before it) becomes a step. With a `key` (the same for, say, nudges of one
   * item), a change that follows the last one of that key within `within` ms (MERGE_MS) joins its step instead: one
   * undo takes back the whole run. A key that is unique to one run (a typed value, #127) may join without a limit.
   */
  push(base: Building, key: string | null = null, within = MERGE_MS): void {
    const at = this.now();
    const joins = key !== null && this.run?.key === key && at - this.run.at <= within && this.past.length > 0;
    this.run = key === null ? null : { key, at };
    for (const step of this.future) this.release(step);
    this.future = [];
    if (joins) return;
    this.past.push(this.store(base));
    this.trim();
  }

  /** One step back from `current`; null when there is none. The caller shows the returned plan. */
  undo(current: Building): Building | null {
    const prev = this.past.pop();
    if (!prev) return null;
    this.run = null;
    this.future.push(this.store(current));
    this.release(prev);
    return (this.doc = this.load(prev));
  }

  /** One step forward again; null when there is none. */
  redo(current: Building): Building | null {
    const next = this.future.pop();
    if (!next) return null;
    this.run = null;
    this.past.push(this.store(current));
    this.release(next);
    this.trim();
    return (this.doc = this.load(next));
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.pool.clear();
    this.chars = 0;
    this.run = null;
  }

  /** The oldest steps drop off past the step and size limits; the newest one always stays. */
  private trim(): void {
    while (this.past.length > this.maxSteps || (this.chars > this.maxChars && this.past.length > 1)) this.release(this.past.shift()!);
  }

  private store(b: Building): Step {
    const step: Step = [];
    for (const [key, value] of Object.entries(b)) {
      if (key === "floors" && Array.isArray(value)) step.push([key, value.map((f) => this.keep(JSON.stringify(f)))]);
      else {
        const json = JSON.stringify(value) as string | undefined;
        if (json !== undefined) step.push([key, this.keep(json)]);
      }
    }
    return step;
  }

  private load(step: Step): Building {
    const out: Record<string, unknown> = {};
    for (const [key, json] of step) out[key] = Array.isArray(json) ? json.map((s) => JSON.parse(s) as unknown) : JSON.parse(json);
    return out as unknown as Building;
  }

  /** The shared copy of `s`, counted once more. */
  private keep(s: string): string {
    const had = this.pool.get(s);
    if (had) {
      had.n++;
      return had.s;
    }
    this.pool.set(s, { s, n: 1 });
    this.chars += s.length;
    return s;
  }

  /** A step is gone: its parts no other step holds are let go. */
  private release(step: Step): void {
    for (const [, json] of step) {
      for (const s of Array.isArray(json) ? json : [json]) {
        const had = this.pool.get(s);
        if (!had) continue;
        if (--had.n === 0) {
          this.pool.delete(s);
          this.chars -= s.length;
        }
      }
    }
  }
}
