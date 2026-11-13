// Which Home Assistant states a render read (#130). Home Assistant hands a new `hass` object for every state change,
// several a second in a big home; the editor reads only a handful of them (the selected item's links, the devices on
// the plan). A render reads the states through `wrap(hass)` between `begin()` and `end()`, and `matters(old, next)`
// then tells whether a new hass changed anything that render used: if not, the editor need not render again.
// The panel, the card and the 3D view do the same (#177): a wall tablet showing the house gets several updates a
// second of states it never shows.

import type { HomeAssistant } from "./types.ts";

type States = HomeAssistant["states"];

/**
 * The object behind each watch's proxies (#177). A parent hands its children the hass it renders with, its own proxy,
 * and a child's watch wraps that again: `matters` compares the plain objects underneath, which is much faster.
 */
const targets = new WeakMap<object, object>();
function unwrap<T extends object>(value: T): T {
  let out = value;
  for (let inner = targets.get(out); inner; inner = targets.get(out)) out = inner as T;
  return out;
}

/** How many entities a states object has, counted once (the panel, the 3D view and the editor all ask per update). */
const counts = new WeakMap<object, number>();
/** How many entities a states object has, counted once per object (#392: the editor's lists ask on every render). */
export function stateCount(states: object | undefined): number {
  return countOf(states as States | undefined);
}
function countOf(states: States | undefined): number {
  if (!states) return 0;
  let n = counts.get(states);
  if (n === undefined) counts.set(states, (n = Object.keys(states).length));
  return n;
}

export class HassWatch {
  private watched = new Set<string>();
  /** The render went through all states (a list of entities): any state change matters. */
  private all = true;
  private active = false;
  private paused = 0;
  private wrapped = new WeakMap<object, HomeAssistant>();
  /**
   * Whether the renders keep entity lists (the editor's link pickers, read unnoted) that an entity coming or going
   * changes. Without them (the panel, the card, the 3D view) a new hass is not checked for that: going through some
   * 5,000 states costs more than the render it would save, and what they show is in the states they read.
   */
  private readonly entityLists: boolean;

  constructor(options: { entityLists?: boolean } = {}) {
    this.entityLists = options.entityLists ?? true;
  }

  /**
   * Start recording a render's reads (forgets the last render's). `keep`: add to them instead – an update that is not
   * about a new hass runs only part of the work a new hass runs, and must not forget what the rest read.
   */
  begin(keep = false): void {
    if (!keep) {
      this.watched.clear();
      this.all = false;
    }
    this.active = true;
  }

  end(): void {
    this.active = false;
  }

  /** Run `fn` without recording what it reads (work whose result is kept until the registry changes). */
  pause<T>(fn: () => T): T {
    this.paused++;
    try {
      return fn();
    } finally {
      this.paused--;
    }
  }

  /** Between `begin()` and `end()`. */
  get rendering(): boolean {
    return this.active;
  }

  /** Reads are noted now (rendering and not paused). */
  get recording(): boolean {
    return this.active && !this.paused;
  }

  /** The hass a render reads: the same object for the same hass; it records state reads only while recording. */
  wrap(hass: HomeAssistant): HomeAssistant {
    const kept = this.wrapped.get(hass);
    if (kept) return kept;
    const states = this.watchStates(hass.states);
    const proxy = new Proxy(hass, {
      get: (target, key, receiver) => (key === "states" ? states : Reflect.get(target, key, receiver)),
    });
    this.wrapped.set(hass, proxy);
    targets.set(proxy, hass);
    return proxy;
  }

  private watchStates(states: States): States {
    if (!states) return states;
    const proxy = new Proxy(states, {
      get: (target, key, receiver) => {
        if (typeof key === "string" && this.recording) this.watched.add(key);
        return Reflect.get(target, key, receiver);
      },
      has: (target, key) => {
        if (typeof key === "string" && this.recording) this.watched.add(key);
        return Reflect.has(target, key);
      },
      ownKeys: (target) => {
        if (this.recording) this.all = true;
        return Reflect.ownKeys(target);
      },
    });
    targets.set(proxy, states);
    return proxy;
  }

  /** Whether going from `old` to `next` changes anything the last render read. */
  matters(old: HomeAssistant | undefined, next: HomeAssistant | undefined): boolean {
    if (!old || !next || this.all) return true;
    old = unwrap(old);
    next = unwrap(next);
    const a = old as unknown as Record<string, unknown>;
    const b = next as unknown as Record<string, unknown>;
    // a function (callService, callWS) draws nothing: the demo home hands a new one with every update (demo.ts)
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (key !== "states" && a[key] !== b[key] && !(typeof a[key] === "function" && typeof b[key] === "function")) return true;
    const was = unwrap(old.states ?? {});
    const now = unwrap(next.states ?? {});
    if (was === now) return false;
    if (this.entityLists && countOf(was) !== countOf(now)) return true;
    for (const id of this.watched) if (was[id] !== now[id]) return true;
    // the same number of entities: one that went and another that came shows as a watched-for id or not at all
    if (this.entityLists) for (const id in now) if (!(id in was)) return true;
    return false;
  }
}

/**
 * The elements each component's render hands `hass` to (`.hass=`): a skipped render forwards it to them (#177).
 * hass-watch.test.ts checks these against the sources, so a new child that takes hass cannot be forgotten.
 */
export const HASS_CHILDREN = {
  "panel.ts": ["fp3d-mic-probe", "ha-menu-button", "fp3d-home-switcher", "fp3d-extensions", "fp3d-settings-page", "fp3d-editor", "fp3d-view3d", "fp3d-room-panel", "fp3d-view-panel", "fp3d-styles-dialog", "fp3d-find"],
  "card.ts": ["fp3d-view3d", "fp3d-room-panel"],
  "components/view3d.ts": ["fp3d-quick-menu", "fp3d-device-popup", "fp3d-mic-probe", "fp3d-find", "fp3d-weather-tile"],
} as const;

/**
 * A render that was skipped would have handed the new hass to the elements it draws (#177): each of `tags` straight
 * in `root` (not inside their own shadow roots) whose `hass` is one of the `from` objects gets the matching `to`, so a
 * child that shows a state the parent never reads (the room panel, the quick menu) still follows it.
 */
export function forwardHass(root: ParentNode | null | undefined, tags: readonly string[], pairs: [from: unknown, to: unknown][]): void {
  if (!root) return;
  for (const el of root.querySelectorAll(tags.join(","))) {
    const holder = el as Element & { hass?: unknown };
    const pair = pairs.find(([from]) => from === holder.hass);
    if (pair && pair[1] !== pair[0]) holder.hass = pair[1];
  }
}
