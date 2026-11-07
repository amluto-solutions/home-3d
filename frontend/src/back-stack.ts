// The panel's one navigation module (#322, grown from the back stack of #250): the browser's Back and Forward walk the
// way the user went inside Home 3D. Every page (the 3D view, the editor, Extensions, each Settings section) and every
// pane or dialog opened over it (the View panel, a menu, a sheet, a question) is a history entry of its own. Back
// closes what is open before it leaves the page, and coming back to a page opens again what was open on it when the
// user left it (the View panel -> "all settings" -> Back is the View panel again).
//
// Home Assistant owns the address: the panel stays on its own path and keeps its page in the hash ("#settings/view",
// "#editor"), so a reload or a link opens that page; Home Assistant's keys in the history state are kept. Each entry
// carries `fp3dNav: { page, panes }`, so Back and Forward know what to show. Panes register by name with a way to open
// them again (BackLayers); a pane without one is only closed.
//
// Pages follow only while the panel is the host (navHost). A dashboard card has no host: its parts never add an entry
// and never take the dashboard's Back button (navHosted). The state lives on globalThis: the main bundle and the editor
// bundle each carry a copy of this module, and both must share it, as there is one history.

/** What one history entry shows: the panel's page (its hash, "" for the 3D view) and the panes open over it, oldest first. */
export interface NavEntry {
  page: string;
  panes: string[];
}

interface Pane {
  key: string;
  close: () => void;
}

interface Host {
  /** The panel's path: entries on other paths are Home Assistant's. */
  path: string;
  /** The page shown now. */
  page: string;
  /** The page an address hash names, or null when it names none of the panel's. */
  pageOf: (hash: string) => string | null;
  /** Shows a page (Back, Forward or a followed link) without an entry of its own. */
  show: (page: string) => void;
}

interface Nav {
  panes: Pane[];
  next: number;
  /** history.back() calls of our own whose popstate is not a Back press. */
  skip: number;
  /** Entries written while one of our own steps back is on its way (it would otherwise step back from them). */
  waiting: (() => void)[];
  listening: boolean;
  host: Host | null;
  /** How to open each pane again when Back or Forward comes to an entry it was open on, and to close it then. */
  openers: Map<string, { open: () => void; close: () => void }>;
}

const KEY = "__fp3dBackStack";
const STATE = "fp3dNav";

function nav(): Nav {
  const g = globalThis as Record<string, unknown>;
  return (g[KEY] ??= { panes: [], next: 1, skip: 0, waiting: [], listening: false, host: null, openers: new Map() }) as Nav;
}

/** Whether this page can keep a history (not in tests or a page without history). */
function usable(): boolean {
  return typeof window !== "undefined" && typeof window.addEventListener === "function" && typeof history !== "undefined" && typeof history.pushState === "function";
}

/** Our part of a history entry's state (null: an entry of Home Assistant's or the browser's). */
export function navEntryOf(state: unknown): NavEntry | null {
  const e = (state as Record<string, unknown> | null)?.[STATE] as NavEntry | undefined;
  return e && typeof e.page === "string" && Array.isArray(e.panes) ? e : null;
}

function here(n: Nav): NavEntry {
  return { page: n.host?.page ?? "", panes: n.panes.map((p) => p.key) };
}

/** Writes the entry as things stand now: a new one (`push`) or over the one the history is on. */
function write(n: Nav, push: boolean): void {
  const entry = here(n);
  const url = n.host ? `${location.pathname}${location.search}${entry.page}` : undefined;
  const run = () => {
    try {
      const now = (history.state ?? {}) as Record<string, unknown>;
      if (push) {
        // keep what Home Assistant keeps in the entry; never copy its open dialog
        const { dialog: _dialog, ...rest } = now;
        history.pushState({ ...rest, [STATE]: entry }, "", url);
      } else history.replaceState({ ...now, [STATE]: entry }, "", url);
    } catch {
      // a sandboxed frame without history: the page simply has no Back
    }
  };
  if (n.skip > 0) n.waiting.push(run);
  else run();
}

/** Brings what is shown in line with an entry: its page, then its panes (the newest closes first). */
function settle(n: Nav, to: NavEntry, showPage: boolean): void {
  const host = n.host;
  if (showPage && host && to.page !== host.page) {
    host.page = to.page;
    host.show(to.page);
  }
  for (let i = n.panes.length - 1; i >= 0; i--) {
    const pane = n.panes[i]!;
    if (to.panes.includes(pane.key)) continue;
    n.panes.splice(i, 1);
    pane.close();
  }
  if (!host) return;
  for (const key of to.panes) {
    const pane = n.openers.get(key);
    if (!pane || n.panes.some((p) => p.key === key)) continue;
    // its owner takes it over (openBackLayer with this key) when it next renders it open
    n.panes.push({ key, close: pane.close });
    pane.open();
  }
}

/** The panel's own address in an entry not written here (a typed hash, a link): its page shows. */
function follow(n: Nav): boolean {
  const host = n.host;
  if (!host || location.pathname !== host.path) return false;
  const page = host.pageOf(location.hash);
  if (page === null) return false;
  settle(n, { page, panes: [] }, true);
  write(n, false);
  return true;
}

function listen(n: Nav): void {
  if (n.listening) return;
  n.listening = true;
  window.addEventListener("popstate", (e: PopStateEvent) => {
    if (n.skip > 0) {
      n.skip--;
      if (n.skip === 0) for (const run of n.waiting.splice(0)) run();
      return;
    }
    const entry = navEntryOf(e.state);
    if (entry) settle(n, entry, !!n.host && location.pathname === n.host.path);
    // not ours: the panel's address (a typed hash), or the page before the panel, where nothing of ours stays open
    else if (!follow(n)) settle(n, { page: n.host?.page ?? "", panes: [] }, false);
  });
}

function release(n: Nav, key: string): void {
  const i = n.panes.findIndex((p) => p.key === key);
  if (i < 0) return;
  n.panes.splice(i, 1);
  // its entry is the one the history stands on: step back over it (that popstate is ours, not a Back press)
  if (navEntryOf(history.state)?.panes.at(-1) === key) {
    n.skip++;
    history.back();
  }
}

/**
 * A pane or dialog opens: Back will call `close` (once). Returns the release to call when it closes some other way
 * (its Close button, Escape, a tap outside): its history entry goes again, so Back is not used up on something already
 * shut. `key` names the pane (BackLayers); one that Back or Forward opened again is taken over without a new entry.
 */
export function openBackLayer(close: () => void, key?: string): () => void {
  if (!usable()) return () => undefined;
  const n = nav();
  listen(n);
  const k = key ?? `~${n.next++}`;
  const had = n.panes.find((p) => p.key === k);
  if (had) had.close = close;
  else {
    n.panes.push({ key: k, close });
    write(n, true);
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    release(n, k);
  };
}

/**
 * The panel becomes the host: its page follows Back, Forward and its address. `page` is the page it shows now (written
 * into the entry the history stands on, address included); `show` shows another. Returns the release for when it leaves.
 */
export function navHost(page: string, pageOf: (hash: string) => string | null, show: (page: string) => void): () => void {
  if (!usable()) return () => undefined;
  const n = nav();
  listen(n);
  const host: Host = { path: location.pathname, page, pageOf, show };
  n.host = host;
  // what an element that left had open is gone with it
  n.panes = [];
  write(n, false);
  // parts that do not carry this module (the question dialog in the items and Settings bundles) open panes through it
  const g = globalThis as { __fp3dNavOpen?: (close: () => void, key: string) => () => void };
  g.__fp3dNavOpen = (close, key) => (navHosted() ? openBackLayer(close, key) : () => undefined);
  return () => {
    if (n.host !== host) return;
    n.host = null;
    delete g.__fp3dNavOpen;
  };
}

/**
 * The user went to another page of the panel: a new entry (`push`), or the one the history is on rewritten. What was
 * open over the old page stays in its entry (Back opens it again); the page closes it itself.
 */
export function navPage(page: string, push = true): void {
  const n = nav();
  if (!n.host || !usable()) return;
  if (page === n.host.page && push) return;
  n.panes = [];
  n.host.page = page;
  write(n, push);
}

/** An address change made inside the panel by Home Assistant or a link (hashchange, location-changed): its page shows. */
export function navFollowAddress(): void {
  if (usable() && !navEntryOf(history.state)) follow(nav());
}

/** Whether entries are kept here: the panel is the host. A dashboard card never adds one. */
export function navHosted(): boolean {
  const host = nav().host;
  return !!host && typeof location !== "undefined" && location.pathname === host.path;
}

/**
 * One layer per named thing that is open or shut, kept in step on every render: `sync("sheet", open, close, reopen)`
 * opens the layer when `open` turns true and releases it when it turns false; `reopen` lets Back and Forward open it
 * again. `scope` keeps different owners' names apart; `on` says whether layers are kept at all (a dashboard card's
 * parts: no). `closeAll` releases every layer (the element left).
 */
export class BackLayers {
  private readonly open = new Map<string, () => void>();
  /** The openers this owner set, to take them out again when it leaves (#384). */
  private readonly mine = new Map<string, { open: () => void; close: () => void }>();
  private readonly scope: string;
  private readonly on: () => boolean;

  constructor(scope = "", on: () => boolean = () => true) {
    this.scope = scope;
    this.on = on;
  }

  sync(name: string, isOpen: boolean, close: () => void, reopen?: () => void): void {
    const key = this.scope ? `${this.scope}:${name}` : name;
    const on = this.on();
    if (reopen && on) {
      const opener = { open: reopen, close };
      this.mine.set(key, opener);
      nav().openers.set(key, opener);
    }
    const release = this.open.get(name);
    if (isOpen && !release && on) {
      this.open.set(
        name,
        openBackLayer(() => {
          this.open.delete(name);
          close();
        }, key),
      );
    } else if (!isOpen && release) {
      this.open.delete(name);
      release();
    }
  }

  /**
   * Several at once, as `sync` each: the ones that closed first, so their entries go before new ones are added (a menu
   * that closes as the sheet it chose opens).
   */
  syncAll(rows: [name: string, isOpen: boolean, close: () => void, reopen?: () => void][]): void {
    for (const r of rows) if (!r[1]) this.sync(...r);
    for (const r of rows) if (r[1]) this.sync(...r);
  }

  closeAll(): void {
    for (const release of [...this.open.values()].reverse()) release();
    this.open.clear();
    // the closures hold the owner (an editor, a 3D view and its plan): they go with it, unless a newer owner took the key
    const openers = nav().openers;
    for (const [key, opener] of this.mine) if (openers.get(key) === opener) openers.delete(key);
    this.mine.clear();
  }
}
