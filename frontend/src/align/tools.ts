// <fp3d-align>: the align and distribute buttons of the multi-selection panel (#235). Plain DOM in the editor's own
// tree (no shadow root), so the editor's button styles apply. It lives in its own bundle, loaded when a second item is
// selected for the first time: the editor bundle is full.

import type { I18nKey } from "../i18n.ts";
import type { Fp3dEditor } from "../components/editor.ts";
import { arrange, needs, type AlignOp } from "./arrange.ts";

const ICON = (body: string) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">${body}</svg>`;

/** Button order: the six aligns (left to right, then top to bottom), then the two spreads. */
const TOOLS: [AlignOp, I18nKey, string][] = [
  ["left", "align_left", ICON('<path d="M4 3v18"/><rect x="7" y="6" width="12" height="4" rx="1"/><rect x="7" y="14" width="7" height="4" rx="1"/>')],
  ["centre", "align_centre", ICON('<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>')],
  ["right", "align_right", ICON('<path d="M20 3v18"/><rect x="5" y="6" width="12" height="4" rx="1"/><rect x="10" y="14" width="7" height="4" rx="1"/>')],
  ["top", "align_top", ICON('<path d="M3 4h18"/><rect x="6" y="7" width="4" height="12" rx="1"/><rect x="14" y="7" width="4" height="7" rx="1"/>')],
  ["middle", "align_middle", ICON('<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>')],
  ["bottom", "align_bottom", ICON('<path d="M3 20h18"/><rect x="6" y="5" width="4" height="12" rx="1"/><rect x="14" y="10" width="4" height="7" rx="1"/>')],
  ["across", "distribute_across", ICON('<path d="M4 4v16M20 4v16"/><rect x="10" y="7" width="4" height="10" rx="1"/>')],
  ["down", "distribute_down", ICON('<path d="M4 4h16M4 20h16"/><rect x="7" y="10" width="10" height="4" rx="1"/>')],
];

export class AlignTools extends HTMLElement {
  // Accessors, not class fields: the editor sets these on the bare element before this bundle has defined it, and a
  // field would overwrite that value on upgrade (#261).
  private _host: Fp3dEditor | null = null;
  private n = 0;
  private locked = false;

  get host(): Fp3dEditor | null {
    return this._host;
  }

  set host(v: Fp3dEditor | null) {
    this._host = v;
    this.draw();
  }

  get count(): number {
    return this.n;
  }

  set count(v: number) {
    if (v === this.n) return;
    this.n = v;
    this.draw();
  }

  set fixed(v: boolean) {
    if (v === this.locked) return;
    this.locked = v;
    this.draw();
  }

  connectedCallback(): void {
    // Properties set before the upgrade sit on the element itself and hide the accessors above: take them back.
    for (const k of ["host", "count", "fixed"] as const) {
      if (!Object.prototype.hasOwnProperty.call(this, k)) continue;
      const v = (this as unknown as Record<string, unknown>)[k];
      delete (this as unknown as Record<string, unknown>)[k];
      (this as unknown as Record<string, unknown>)[k] = v;
    }
    this.draw();
  }

  /** One undo step: the whole move is one change of the plan. */
  run(op: AlignOp): void {
    const host = this.host;
    const ids = new Set(host?.selection() ?? []);
    const items = (host?.floor?.furniture ?? []).filter((m) => ids.has(m.id));
    const moves = arrange(items, op);
    if (!host || !moves?.size) return;
    host.change((_, f) => {
      for (const m of f.furniture) {
        const d = moves.get(m.id);
        if (d) [m.x, m.z] = [Math.round((m.x + d[0]) * 1000) / 1000, Math.round((m.z + d[1]) * 1000) / 1000];
      }
    });
  }

  private draw(): void {
    if (!this.isConnected) return;
    const t = (k: I18nKey) => this.host?.t(k) ?? k;
    this.replaceChildren();
    this.className = "fp3d-align";
    this.setAttribute("role", "group");
    this.setAttribute("aria-label", t("align_title"));
    const head = document.createElement("span");
    head.className = "fp3d-align-head";
    head.textContent = t("align_group");
    this.append(head);
    for (const [op, key, icon] of TOOLS) {
      if (this.n < needs(op)) continue;
      const b = document.createElement("button");
      b.className = "fp3d-btn fp3d-align-btn";
      b.type = "button";
      b.title = b.ariaLabel = t(key);
      b.disabled = this.locked;
      b.innerHTML = icon;
      const txt = document.createElement("span");
      txt.className = "fp3d-align-txt";
      txt.textContent = t(key);
      b.append(txt);
      b.addEventListener("click", () => this.run(op));
      this.append(b);
    }
  }
}
