// The home indicator in the panel header (editors only). Switching, adding, renaming, duplicating and deleting homes
// moved to Settings > Homes (#296, settings/homes.ts): it is not done often enough to take room in the top bar. What stays
// is a small amber chip while this view shows a home that is not the one on the displays (a test home, #58), so nobody
// edits a copy thinking it is the house; it opens the Homes page. Nothing shows while the view follows the active home.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { listHomes, setActiveHome, type HomeInfo, type HomesList } from "../api.ts";
import { translate, type I18nKey } from "../i18n.ts";
import type { HomeAssistant } from "../types.ts";

/** Fired on the page by the Homes page when it changed the homes (the active one, a rename …): the chip looks again. */
export const HOMES_CHANGED = "fp3d-homes-changed";

/** The chip (#57): the shown home's name when it is not the home the displays show; null when nothing needs saying. */
export function homeChip(homes: readonly HomeInfo[], active: string | null, shown: string | null): { name: string } | null {
  const home = homes.find((h) => h.id === shown);
  return home && home.id !== active ? { name: home.name } : null;
}

export class Fp3dHomeSwitcher extends LitElement {
  static properties = {
    hass: { attribute: false },
    home: { attribute: false },
    _homes: { state: true },
    _active: { state: true },
  };

  declare hass: HomeAssistant;
  /** The home the panel shows. */
  declare home: string | null;
  private declare _homes: HomeInfo[] | null;
  /** The home the displays show (the active one). */
  private declare _active: string | null;
  private loaded = false;
  private readonly again = () => this.load();

  constructor() {
    super();
    this.home = null;
    this._homes = null;
    this._active = null;
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener(HOMES_CHANGED, this.again);
  }

  disconnectedCallback(): void {
    window.removeEventListener(HOMES_CHANGED, this.again);
    super.disconnectedCallback();
  }

  private t(key: I18nKey, vars?: Record<string, string | number>): string {
    return translate(this.hass, key, vars);
  }

  private load(): void {
    if (!this.hass) return;
    listHomes(this.hass).then(
      (res: HomesList) => {
        this._homes = res.homes;
        this._active = res.active ?? null;
      },
      () => (this._homes = null), // a backend from before #53, or no longer an editor
    );
  }

  protected willUpdate(changed: PropertyValues): void {
    // loaded once, and again when the panel shows another home (switched here or elsewhere)
    if (this.hass && (!this.loaded || (changed.has("home") && changed.get("home") != null))) {
      this.loaded = true;
      this.load();
    }
  }

  protected render() {
    const chip = this._homes ? homeChip(this._homes, this._active, this.home) : null;
    if (!chip) return nothing;
    const text = `${chip.name} · ${this.t("home_not_on_displays")}`;
    // what "not on displays" means, and the way to make this home the one they show (#263)
    return html`<button
      class="chip"
      title=${`${text}. ${this.t("home_not_on_displays_hint")}`}
      aria-label=${`${this.t("home")}: ${text}. ${this.t("st_homes_open_page")}`}
      @click=${() => this.dispatchEvent(new CustomEvent("home-settings", { bubbles: true, composed: true }))}
    >
      <span class="name">${chip.name}</span><small aria-hidden="true">${this.t("home_not_on_displays")}</small>
    </button>
    <button class="make" title=${this.t("home_make_active_hint")} @click=${() => void this.makeActive()}>${this.t("home_make_active")}</button>`;
  }

  /** The home shown becomes the one on the displays (#263); the view follows the active home again. */
  private async makeActive(): Promise<void> {
    if (!this.hass || !this.home) return;
    try {
      const res = await setActiveHome(this.hass, this.home);
      this._active = res.active ?? this.home;
      globalThis.dispatchEvent?.(new CustomEvent(HOMES_CHANGED));
      this.dispatchEvent(new CustomEvent("home-open", { detail: { home: null }, bubbles: true, composed: true }));
    } catch {
      this.load(); // not allowed or gone: the chip shows what is true
    }
  }

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      min-width: 0;
    }
    .chip {
      font: inherit;
      font-size: 13px;
      color: inherit;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 36px;
      max-width: 22em;
      min-width: 0;
      padding: 0 10px;
      background: transparent;
      border: 1px solid rgba(255, 170, 0, 0.6);
      border-radius: var(--fp3d-radius-control, 6px);
      white-space: nowrap;
      cursor: pointer;
    }
    .chip:focus-visible {
      outline: 2px solid var(--fp3d-accent, #03a9f4);
      outline-offset: 1px;
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 600;
      min-width: 0;
    }
    small {
      color: #ffb547;
      font-size: 12px;
    }
    .make {
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      height: 36px;
      margin-left: 6px;
      padding: 0 10px;
      border: 0;
      border-radius: var(--fp3d-radius-control, 6px);
      background: var(--fp3d-primary, #1f6fd1);
      color: var(--fp3d-primary-text, #fff);
      white-space: nowrap;
      cursor: pointer;
    }
    .make:focus-visible {
      outline: 2px solid var(--fp3d-accent, #03a9f4);
      outline-offset: 1px;
    }
    /* compact and phone screens: the name alone, the amber border still says it is not the home on the displays */
    @media (max-width: 1024px) {
      small {
        display: none;
      }
    }
    @media (max-width: 600px) {
      .chip {
        height: 44px;
        max-width: 120px;
        padding: 0 6px;
      }
      /* no room for it in a phone's header: the chip opens Settings > Homes, which has Make active */
      .make {
        display: none;
      }
    }
  `;
}

defineElement("fp3d-home-switcher", Fp3dHomeSwitcher);
