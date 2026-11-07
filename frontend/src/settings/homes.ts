// The Homes page in Settings (#296): the list of homes with New, Load sample, Open, Make active (was Show on displays), Rename, Duplicate
// and Delete. It moved here from the top bar (components/home-switcher.ts, now only an indicator): switching homes is
// rare. A chunk of the Settings bundle of its own, loaded when the page is first shown. Texts come from the page (`t`),
// never from i18n.ts. Opening a home only changes what this view shows ("home-open", null: follow the active home
// again, #58); only "Make active" changes the active home, so an experiment never blanks a wall tablet. The
// backend checks every change again.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { askText, askTyped, tell } from "../ask.ts";
import { createHome, deleteHome, duplicateHome, listHomes, loadSampleHome, renameHome, setActiveHome, type HomeInfo, type HomesList } from "../api.ts";
import { controls, tokens } from "../styles.ts";
import type { HomeAssistant } from "../types.ts";
import "../components/ask-dialog.ts";

export type HomeAction = "open" | "show" | "rename" | "duplicate" | "delete";

/** The buttons of a home's row: Open while this view shows another home, Make active while it is not the active one, Delete while there are two homes. */
export function rowActions(home: HomeInfo, homes: readonly HomeInfo[], active: string | null, shown: string | null): HomeAction[] {
  const out: HomeAction[] = [];
  if (home.id !== shown) out.push("open");
  if (home.id !== active) out.push("show");
  out.push("rename", "duplicate");
  if (homes.length > 1) out.push("delete");
  return out;
}

/** The typed answer names the home to delete (#160): spaces around it and letter case do not matter. */
export function namesHome(typed: string | null, name: string): boolean {
  return typed != null && typed.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase();
}

export class Fp3dHomesPage extends LitElement {
  static properties = {
    hass: { attribute: false },
    home: { attribute: false },
    t: { attribute: false },
    _homes: { state: true },
    _active: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The home this view shows. */
  declare home: string | null;
  /** The page's texts (the panel's translate). */
  declare t: (key: string, vars?: Record<string, string | number>) => string;
  private declare _homes: HomeInfo[] | null;
  /** The home the displays show. */
  private declare _active: string | null;
  private loaded = false;

  constructor() {
    super();
    this.home = null;
    this.t = (key) => key;
    this._homes = null;
    this._active = null;
  }

  protected willUpdate(changed: PropertyValues): void {
    // loaded once, and again when this view shows another home
    if (this.hass && (!this.loaded || (changed.has("home") && changed.get("home") !== undefined))) {
      this.loaded = true;
      listHomes(this.hass).then(
        (res) => this.listed(res),
        () => (this._homes = null),
      );
    }
  }

  private listed(res: HomesList): void {
    this._homes = res.homes;
    this._active = res.active ?? null;
    // the header chip looks again (it says whether the home shown is the one on the displays)
    this.dispatchEvent(new CustomEvent("fp3d-homes-changed", { bubbles: true, composed: true }));
  }

  private async run<T extends HomesList>(change: () => Promise<T>): Promise<T | null> {
    try {
      const res = await change();
      this.listed(res);
      return res;
    } catch (err) {
      await tell(this.t("home_failed", { error: String((err as { message?: string })?.message ?? err) }), { ok: this.t("ask_ok") });
      return null;
    }
  }

  /** Show a home in this view only (#58); null: follow the active home again. */
  private open(home: string | null): void {
    this.dispatchEvent(new CustomEvent("home-open", { detail: { home }, bubbles: true, composed: true }));
  }

  private named(value: string): Promise<string | null> {
    return askText(this.t("home_name_prompt"), value, { ok: this.t("ask_ok"), cancel: this.t("cancel") });
  }

  async create(): Promise<void> {
    const hass = this.hass;
    const name = await this.named(this.t("home_new_name"));
    const res = name && hass ? await this.run(() => createHome(hass, name)) : null;
    if (res) this.open(res.home.id);
  }

  async sample(): Promise<void> {
    const hass = this.hass;
    // a new home of its own (#54), opened in this view only like any new home (#58)
    const res = hass ? await this.run(() => loadSampleHome(hass)) : null;
    if (res) this.open(res.home.id);
  }

  async act(action: HomeAction, home: HomeInfo): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    if (action === "open") {
      this.open(home.id === this._active ? null : home.id);
    } else if (action === "show") {
      // no confirmation (#58): the action says what it does and is undone the same way
      if ((await this.run(() => setActiveHome(hass, home.id))) && home.id === this.home) this.open(null);
    } else if (action === "rename") {
      const name = await this.named(home.name);
      if (name && name !== home.name) await this.run(() => renameHome(hass, home.id, name));
    } else if (action === "duplicate") {
      const name = await this.named(this.t("home_copy_name", { name: home.name }));
      const res = name ? await this.run(() => duplicateHome(hass, home.id, name)) : null;
      if (res) this.open(res.home.id);
    } else {
      // deleting needs the home's name typed (#160): a slip cannot take the real house with it
      // a wrong name keeps the dialog open with the error under the field and Delete disabled (#330)
      const sure = await askTyped(this.t("home_delete_type", { name: home.name }), {
        ok: this.t("delete"),
        cancel: this.t("cancel"),
        danger: true,
        matches: (typed) => namesHome(typed, home.name),
        mismatch: this.t("home_delete_mismatch", { name: home.name }),
      });
      if (!sure) return;
      // the home this view shows is gone: show the active one (the backend picks another if it was the active one)
      if ((await this.run(() => deleteHome(hass, home.id))) && home.id === this.home) this.open(null);
    }
  }

  protected render() {
    const homes = this._homes;
    if (!homes) return html`<p class="sub">${this.t("st_homes_none")}</p>`;
    return html`<div class="bar">
        <button class="fp3d-btn" @click=${() => void this.create()}>${this.t("st_homes_new")}</button>
        <button class="fp3d-btn" @click=${() => void this.sample()}>${this.t("home_sample")}</button>
      </div>
      <ul>
        ${homes.map(
          (h) => html`<li class=${h.id === this.home ? "shown" : ""}>
            <div class="what">
              <b>${h.name}</b>
              <span class="badges"
                >${h.id === this._active ? html`<i class="live">${this.t("home_active_badge")}</i>` : nothing}${h.id === this.home ? html`<i>${this.t("st_homes_shown")}</i>` : nothing}</span
              >
              <span class="sub">${this.t("st_homes_counts", { floors: h.floors, rooms: h.rooms, furniture: h.furniture })}</span>
            </div>
            <div class="acts">
              ${rowActions(h, homes, this._active, this.home).map((a) => html`<button class="fp3d-btn ${a === "delete" ? "fp3d-danger" : ""}" @click=${() => void this.act(a, h)}>${this.t(`st_homes_${a}`)}</button>`)}
            </div>
          </li>`,
        )}
      </ul>
      <p class="sub legend">${this.t("st_homes_legend")}</p>`;
  }

  static styles = [
    tokens,
    controls,
    css`
      :host {
        display: block;
      }
      .bar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 10px;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 8px;
      }
      li {
        display: grid;
        gap: 8px;
        padding: 10px 12px;
        border: 1px solid var(--fp3d-line, rgba(127, 127, 127, 0.4));
        border-radius: 10px;
      }
      li.shown {
        border-color: var(--fp3d-accent, #03a9f4);
      }
      .what {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 4px 10px;
      }
      .badges i {
        font-style: normal;
        font-size: 12px;
        margin-right: 6px;
        padding: 1px 8px;
        border-radius: 999px;
        border: 1px solid var(--fp3d-line, rgba(127, 127, 127, 0.4));
      }
      .badges i.live {
        border-color: #ff5d6c;
      }
      /* what the badges mean (#263): under the list */
      .legend {
        display: block;
        margin: 10px 0 0;
      }
      .sub {
        color: var(--fp3d-muted, #94a3b8);
        font-size: 12.5px;
      }
      .acts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      button {
        min-height: 36px;
      }
      @media (pointer: coarse) {
        button {
          min-height: 44px;
        }
      }
    `,
  ];
}

defineElement("fp3d-homes-page", Fp3dHomesPage);
