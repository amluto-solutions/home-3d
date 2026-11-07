// Long work in short slices (run 6 speed): a new home's floors are modelled and its shaders compiled a few
// milliseconds at a time, with the page free in between, instead of in tasks of a second on a slow tablet.

/** How long one slice may run before the page gets a turn (ms). One step more can run over it. */
export const SLICE_MS = 12;

/** What a slice runner needs from the page: the time, and a way to let other tasks run. */
export interface SliceClock {
  now(): number;
  /** Resolves in a later task (the page can draw a frame or take input in between). */
  pause(): Promise<void>;
}

type SchedulerLike = { yield?: () => Promise<void> };

/**
 * A later task: `scheduler.yield()` where the browser has it (the slice keeps its place in the queue), else a message
 * to ourselves (a timeout of 0 is held back to 4 ms after a few, and much longer in a hidden tab).
 */
export function nextTask(): Promise<void> {
  const s = (globalThis as { scheduler?: SchedulerLike }).scheduler;
  if (typeof s?.yield === "function") return s.yield();
  if (typeof MessageChannel === "function") {
    return new Promise((done) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        ch.port1.close();
        done();
      };
      ch.port2.postMessage(0);
    });
  }
  return new Promise((done) => setTimeout(done, 0));
}

export const pageClock: SliceClock = { now: () => performance.now(), pause: nextTask };

/** Thrown into a job's promise when it was cancelled. */
export class SliceCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "SliceCancelled";
  }
}

/** A running job: its result, and a way to stop it before its next step. */
export interface SliceJob<T> {
  readonly done: Promise<T>;
  cancel(): void;
  readonly cancelled: boolean;
}

/**
 * Runs `steps` (a generator: each `yield` is a point where it may stop for now) in slices of about `budget` ms, each in
 * a task of its own, the first once `after` (if given) has settled. Resolves with the generator's return value; rejects
 * with SliceCancelled once cancelled (the generator is closed, its `finally` blocks run) or with the error a step threw.
 */
export function runSliced<T>(steps: Generator<unknown, T, void>, clock: SliceClock = pageClock, budget = SLICE_MS, after?: Promise<unknown>): SliceJob<T> {
  let cancelled = false;
  const done = (async () => {
    if (after) await after.catch(() => undefined);
    // the first slice runs in a task of its own too: the caller's task ends first
    await clock.pause();
    for (;;) {
      if (cancelled) {
        steps.return(undefined as T);
        throw new SliceCancelled();
      }
      const start = clock.now();
      for (;;) {
        const r = steps.next();
        if (r.done) return r.value;
        if (cancelled || clock.now() - start >= budget) break;
      }
      await clock.pause();
    }
  })();
  // a cancelled job nobody waits for is no unhandled rejection
  done.catch(() => undefined);
  return {
    done,
    cancel() {
      cancelled = true;
    },
    get cancelled() {
      return cancelled;
    },
  };
}

/** Runs `steps` to the end at once (the same work as runSliced, for callers that need the result now). */
export function runAll<T>(steps: Generator<unknown, T, void>): T {
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
  }
}
