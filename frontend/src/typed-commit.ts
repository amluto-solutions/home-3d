/**
 * Typed numbers that are saved reliably (#69): on Enter, on leaving the box (its change event) and after a short
 * pause in typing, for touch keyboards that never send Enter or Tab. Each text is saved once, so the pause and the
 * change event that follows it make one undo step, not two.
 *
 * While the user types, the box is theirs: `typing()` tells the editor's redraw not to overwrite it (a rotation
 * saved as -9 → 351 mid-way through "-90" would otherwise jump). After Enter or leaving the box the plan's value
 * shows again.
 *
 * Every save says which typing run it belongs to (#127): a run lasts from the box getting the cursor to Enter or
 * leaving it, so the saves of one value typed with pauses ("1.", pause, "5") can be one undo step.
 */

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(id: unknown): void;
}

interface BoxState {
  /** Typed since the box got the cursor, or since the last Enter. */
  dirty: boolean;
  /** The text saved last while the box had the cursor. */
  saved: string | null;
  timer: unknown;
  /** The typing run the next save belongs to. */
  run: number;
}

/** A save: the text typed, and the typing run it belongs to. */
export type TypedSave = (text: string, run: number) => void;

const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) };

export class TypedCommit {
  private readonly boxes = new WeakMap<object, BoxState>();
  private readonly delay: number;
  private readonly timers: Timers;
  private runs = 0;

  constructor(opts: { delay?: number; timers?: Timers } = {}) {
    this.delay = opts.delay ?? 600;
    this.timers = opts.timers ?? realTimers;
  }

  private state(box: object): BoxState {
    let s = this.boxes.get(box);
    if (!s) this.boxes.set(box, (s = { dirty: false, saved: null, timer: null, run: ++this.runs }));
    return s;
  }

  private stop(s: BoxState): void {
    if (s.timer !== null) this.timers.clear(s.timer);
    s.timer = null;
  }

  private save(s: BoxState, text: string, commit: TypedSave): void {
    this.stop(s);
    if (s.saved === text) return;
    s.saved = text;
    commit(text, s.run);
  }

  /** The box got the cursor: it may show another item than last time (Lit reuses it). */
  focus(box: object): void {
    const s = this.state(box);
    this.stop(s);
    s.dirty = false;
    s.saved = null;
    s.run = ++this.runs;
  }

  /** A key typed: saved after a pause, with the latest text and handler. */
  input(box: object, text: string, commit: TypedSave): void {
    const s = this.state(box);
    s.dirty = true;
    this.stop(s);
    s.timer = this.timers.set(() => {
      s.timer = null;
      if (s.dirty) this.save(s, text, commit);
    }, this.delay);
  }

  /** Enter: saved now, and the box shows the plan's value again; what is typed next is a new run. */
  enter(box: object, text: string, commit: TypedSave): void {
    const s = this.state(box);
    this.save(s, text, commit);
    s.dirty = false;
    s.run = ++this.runs;
  }

  /** The browser's change event (leaving the box, or Enter in some browsers). */
  change(box: object, text: string, commit: TypedSave): void {
    this.save(this.state(box), text, commit);
  }

  /** The box lost the cursor: nothing is pending any more and redraws may show the plan's value. */
  blur(box: object): void {
    const s = this.state(box);
    this.stop(s);
    s.dirty = false;
    s.run = ++this.runs;
  }

  /** Whether the user is typing in the box (a redraw leaves its text alone). */
  typing(box: object): boolean {
    return this.boxes.get(box)?.dirty ?? false;
  }
}
