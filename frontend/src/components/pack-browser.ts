// The Library's Browse tab (#336): the packs the curated index lists (pack-index.ts), with a search, category and
// publisher filters, and a page per pack with pictures of a few of its items. Install and Update go through the
// install-by-URL path (#25) with the preview of what changes first (#189, insisting on the previewed commit); Remove
// is the Extensions page's. Pin and roll back stay on the Extensions page (#48). Home Assistant fetches the index and
// every pack; without internet the tab says so quietly and the installed packs are untouched. A chunk of its own
// (editor/lazy.ts): only an editor who opens the tab loads it. Fires "packs-changed" after an install or a removal.

import { defineElement } from "../define.ts";
import { css, html, LitElement, nothing } from "lit";
import { fetchPackUpdates, installPackFromUrl, previewPackFromUrl, removePack, setPackUpdateSettings } from "../api.ts";
import { askConfirm } from "../ask.ts";
import { errorText } from "../failure.ts";
import { languageCode, loadLanguage, translate, type I18nKey } from "../i18n.ts";
import { allCategories, allPublishers, browsePacks, categoriesOf, LANGUAGE_CATEGORY, loadPackIndex, packStatus, type IndexPack, type PackIndex } from "../pack-index.ts";
import { askingFirst, previewName, shortCommit, type ConfirmCode, type PackPreview } from "../pack-updates.ts";
import type { FurniturePack, PackItem } from "../packs.ts";
import { controls, tokens } from "../styles.ts";
import type { HomeAssistant } from "../types.ts";

const THUMB_PX = 96;
/** Pictures drawn so far, by pack, release and item: kept for the page. */
const pictures = new Map<string, string>();

export class PackBrowser extends LitElement {
  static properties = {
    hass: { attribute: false },
    packs: { attribute: false },
    picture: { attribute: false },
    _index: { state: true },
    _failed: { state: true },
    _loading: { state: true },
    _query: { state: true },
    _category: { state: true },
    _publisher: { state: true },
    _open: { state: true },
    _preview: { state: true },
    _busy: { state: true },
    _msg: { state: true },
    _drawn: { state: true },
    _source: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  /** The packs installed now (bundled and imported). */
  declare packs: FurniturePack[] | undefined;
  /** Draws a whole item (not installed) as a picture; null: no pictures. */
  declare picture: ((item: PackItem, size: number) => Promise<string | null>) | null;
  private declare _index: PackIndex | null;
  /** The index could not be loaded and none is kept. */
  private declare _failed: boolean;
  private declare _loading: boolean;
  private declare _query: string;
  private declare _category: string | null;
  private declare _publisher: string | null;
  /** The pack whose page is open (its id). */
  private declare _open: string | null;
  /** What installing or updating the open pack would change, while the editor decides. */
  private declare _preview: PackPreview | null;
  private declare _busy: boolean;
  private declare _msg: { ok: boolean; text: string } | null;
  /** Bumped when a picture arrives. */
  private declare _drawn: number;
  /** The index URL setting being edited (null: the field is not open). */
  private declare _source: string | null;
  private drawing = new Set<string>();

  constructor() {
    super();
    this.packs = [];
    this.picture = null;
    this._index = null;
    this._failed = false;
    this._loading = false;
    this._query = "";
    this._category = null;
    this._publisher = null;
    this._open = null;
    this._preview = null;
    this._busy = false;
    this._msg = null;
    this._drawn = 0;
    this._source = null;
  }

  /** The first time there is a hass (a lazy element gets its properties on its first update, not when connected). */
  private asked = false;

  protected willUpdate(): void {
    if (!this.asked && this.hass) {
      this.asked = true;
      void this.load(false);
    }
  }

  private t(key: I18nKey, vars?: Record<string, string | number>): string {
    return translate(this.hass, key, vars);
  }

  /** The index from Home Assistant; a failure leaves the copy shown (or the quiet offline note). */
  async load(refresh: boolean): Promise<void> {
    if (!this.hass) return;
    this._loading = true;
    try {
      this._index = await loadPackIndex(this.hass, refresh);
      this._failed = false;
    } catch {
      this._failed = !this._index;
    } finally {
      this._loading = false;
    }
  }

  private label = (category: string): string => {
    if (category === LANGUAGE_CATEGORY) return this.t("languages");
    const key = `lib_kind_${category}` as I18nKey;
    const text = this.t(key);
    return text === key ? category.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase()) : text;
  };

  private installed(): FurniturePack[] {
    return this.packs ?? [];
  }

  /** A picture of an item of a listed pack, drawn once and kept. */
  private pictureOf(entry: IndexPack, item: PackItem | undefined): string | null {
    if (!item || !this.picture) return null;
    const key = `${entry.id}|${entry.release}|${item.id}`;
    const url = pictures.get(key);
    if (url) return url;
    if (!this.drawing.has(key)) {
      this.drawing.add(key);
      const draw = this.picture;
      void Promise.resolve()
        .then(() => draw(item, THUMB_PX))
        .then((drawn) => {
          if (drawn) pictures.set(key, drawn);
          this._drawn++;
        })
        .catch(() => undefined);
    }
    return null;
  }

  private thumbOf(entry: IndexPack): PackItem | undefined {
    return entry.previews.find((p) => p.id === entry.thumbnail) ?? entry.previews[0];
  }

  protected render() {
    const index = this._index;
    if (!index) {
      if (this._failed) return this.renderOffline();
      return html`<p class="pb-note" role="status">${this.t("loading")}</p>`;
    }
    const open = this._open ? index.packs.find((p) => p.id === this._open) : undefined;
    return html`${index.stale ? html`<p class="pb-note">${this.t("pb_stale", { time: new Date(index.fetched_at * 1000).toLocaleString(this.hass?.language) })}</p>` : nothing}
      ${this._msg ? html`<p class="pb-msg ${this._msg.ok ? "" : "pb-bad"}" role="status">${this._msg.text}</p>` : nothing} ${open ? this.renderPack(open) : this.renderList(index)}`;
  }

  private renderOffline() {
    return html`<div class="pb-offline" role="status">
      <p class="pb-note">${this.t("pb_offline")}</p>
      <button class="fp3d-btn" ?disabled=${this._loading} @click=${() => void this.load(true)}>${this.t("pb_retry")}</button>
      ${this.renderSource()}
    </div>`;
  }

  private renderList(index: PackIndex) {
    const installed = this.installed();
    const filter = { query: this._query, category: this._category, publisher: this._publisher };
    const shown = browsePacks(index.packs, filter, installed, this.label);
    const publishers = allPublishers(index.packs);
    return html`<div class="pb-top">
        <div class="pb-bar">
          <input class="pb-search" type="search" .value=${this._query} placeholder=${this.t("pb_search")} aria-label=${this.t("pb_search")} @input=${(e: Event) => (this._query = (e.target as HTMLInputElement).value)} />
          <button class="fp3d-btn pb-refresh" title=${this.t("pb_refresh")} aria-label=${this.t("pb_refresh")} ?disabled=${this._loading} @click=${() => void this.load(true)}>↻</button>
        </div>
        <div class="pb-bar">
          <select aria-label=${this.t("pb_all_categories")} @change=${(e: Event) => (this._category = (e.target as HTMLSelectElement).value || null)}>
            <option value="" ?selected=${!this._category}>${this.t("pb_all_categories")}</option>
            ${allCategories(index.packs).map((c) => html`<option value=${c} ?selected=${this._category === c}>${this.label(c)}</option>`)}
          </select>
          ${publishers.length > 1
            ? html`<select aria-label=${this.t("pb_all_publishers")} @change=${(e: Event) => (this._publisher = (e.target as HTMLSelectElement).value || null)}>
                <option value="" ?selected=${!this._publisher}>${this.t("pb_all_publishers")}</option>
                ${publishers.map((p) => html`<option value=${p} ?selected=${this._publisher === p}>${p}</option>`)}
              </select>`
            : nothing}
        </div>
      </div>
      ${shown.length
        ? html`<ul class="pb-list">
            ${shown.map((entry) => {
              const status = packStatus(entry, installed);
              const pic = this.pictureOf(entry, this.thumbOf(entry));
              return html`<li>
                <button class="pb-card" @click=${() => this.openPack(entry.id)}>
                  <span class="pb-thumb">${pic ? html`<img src=${pic} alt="" width="48" height="48" />` : nothing}</span>
                  <span class="pb-text">
                    <b>${entry.name}</b>
                    <span class="pb-sub">${entry.publisher} · ${this.meta(entry)}</span>
                  </span>
                  ${this.badge(entry, status.state)}
                </button>
              </li>`;
            })}
          </ul>`
        : html`<p class="pb-note">${this.t("pb_none")}</p>`}
      ${this.renderSource()}`;
  }

  /** Where the list comes from (#336): Home 3D's index, or another one on GitHub (a fork); kept by Home Assistant. */
  private renderSource() {
    return html`<details class="pb-source" @toggle=${(e: Event) => void this.openSource((e.target as HTMLDetailsElement).open)}>
      <summary class="pb-sub">${this.t("pb_index_url")}</summary>
      ${this._source === null
        ? nothing
        : html`<p class="pb-sub">${this.t("pb_index_url_hint")}</p>
            <div class="pb-bar">
              <input class="pb-search" type="url" maxlength="500" .value=${this._source} aria-label=${this.t("pb_index_url")} @input=${(e: Event) => (this._source = (e.target as HTMLInputElement).value)} />
              <button class="fp3d-btn" ?disabled=${this._busy} @click=${() => void this.saveSource()}>${this.t("ask_ok")}</button>
            </div>`}
    </details>`;
  }

  private async openSource(open: boolean): Promise<void> {
    if (!open || !this.hass) return;
    try {
      this._source = (await fetchPackUpdates(this.hass)).settings.index_url ?? "";
    } catch {
      this._source = "";
    }
  }

  private async saveSource(): Promise<void> {
    if (!this.hass || this._source === null) return;
    this._busy = true;
    try {
      await setPackUpdateSettings(this.hass, { index_url: this._source.trim() });
      this._msg = null;
      this._open = null;
      await this.load(true);
    } catch (err) {
      this._msg = { ok: false, text: errorText(err) };
    } finally {
      this._busy = false;
    }
  }

  private meta(entry: IndexPack): string {
    return entry.kind === "language"
      ? this.t("pb_meta_texts", { n: entry.texts ?? 0, release: entry.release, licence: entry.licence })
      : this.t("pb_meta", { n: entry.items, release: entry.release, licence: entry.licence });
  }

  private badge(entry: IndexPack, state: string) {
    if (state === "update") return html`<span class="pb-badge pb-upd">${this.t("pb_update", { release: entry.release })}</span>`;
    if (state === "installed") return html`<span class="pb-badge">${this.t("pb_installed")}</span>`;
    return entry.source === "community" ? html`<span class="pb-badge pb-comm">${this.t("pb_community")}</span>` : nothing;
  }

  private openPack(id: string | null): void {
    this._open = id;
    this._preview = null;
    this._msg = null;
  }

  private renderPack(entry: IndexPack) {
    const status = packStatus(entry, this.installed());
    const more = entry.items - entry.previews.length;
    return html`<div class="pb-page">
      <button class="fp3d-btn pb-back" @click=${() => this.openPack(null)}>← ${this.t("back")}</button>
      <h4>${entry.name}</h4>
      <p class="pb-sub">${entry.publisher} · ${this.meta(entry)} ${entry.source === "community" ? html`· ${this.t("pb_community")}` : nothing}</p>
      ${entry.description ? html`<p>${entry.description}</p>` : nothing}
      ${entry.release_note ? html`<p class="pb-sub">v${entry.release}: ${entry.release_note}</p>` : nothing}
      <div class="pb-cats">${categoriesOf(entry).map((c) => html`<span class="pb-chip">${this.label(c)}${entry.categories[c] ? ` ${entry.categories[c]}` : ""}</span>`)}</div>
      ${entry.previews.length
        ? html`<ul class="pb-previews">
            ${entry.previews.map((item) => {
              const pic = this.pictureOf(entry, item);
              const name = previewName(item, this.hass?.language ?? "en");
              return html`<li>
                <span class="pb-pic">${pic ? html`<img src=${pic} alt=${name} width=${THUMB_PX} height=${THUMB_PX} />` : nothing}</span>
                <span class="pb-sub">${name}</span>
              </li>`;
            })}
          </ul>
          ${more > 0 ? html`<p class="pb-sub">${this.t("pb_more", { n: more })}</p>` : nothing}`
        : nothing}
      ${this._preview ? this.renderPreview(entry, this._preview) : this.renderActions(entry, status)}
      <p><a href=${entry.url} target="_blank" rel="noreferrer noopener">${this.t("pb_on_github")}</a></p>
    </div>`;
  }

  private renderActions(entry: IndexPack, status: ReturnType<typeof packStatus>) {
    return html`<div class="pb-actions">
      ${status.state === "available" ? html`<button class="fp3d-btn fp3d-primary" ?disabled=${this._busy} @click=${() => void this.previewInstall(entry)}>${this.t("pp_do_install")}</button>` : nothing}
      ${status.state === "update" ? html`<button class="fp3d-btn fp3d-primary" ?disabled=${this._busy} @click=${() => void this.previewInstall(entry)}>${this.t("pb_update", { release: entry.release })}</button>` : nothing}
      ${status.state !== "available" && !status.removable ? html`<span class="pb-sub">${this.t("pb_bundled")}</span>` : nothing}
      ${status.state === "installed" && status.removable ? html`<span class="pb-badge">${this.t("pb_installed")}</span>` : nothing}
      ${status.removable ? html`<button class="fp3d-btn fp3d-danger" ?disabled=${this._busy} @click=${() => void this.removeEntry(entry)}>${this.t("pack_remove")}</button>` : nothing}
    </div>`;
  }

  /** What an install or update changes, from GitHub (the commit shown is the one installed). */
  private renderPreview(entry: IndexPack, p: PackPreview) {
    const c = p.changes;
    const update = p.installed !== null;
    return html`<div class="pb-preview">
      <p>
        <b>${update ? this.t("pp_update", { name: p.pack.name, from: p.installed!.release, to: p.pack.release }) : this.t("pp_install", { name: p.pack.name, release: p.pack.release })}</b>
      </p>
      <p class="pb-sub">${this.t("pp_from")} ${p.origin.owner}/${p.origin.repo}${p.origin.folder ? `/${p.origin.folder}` : ""} · ${this.t("pp_commit")} ${shortCommit(p.origin.commit)}</p>
      ${p.warnings.map((w) => html`<p class="pb-bad">${this.t(`pp_warn_${w}` as I18nKey)}</p>`)}
      <p class="pb-sub">
        ${[c.added.length ? this.t("pp_added", { n: c.added.length }) : "", c.changed.length ? this.t("pp_changed", { n: c.changed.length }) : "", c.removed.length ? this.t("pp_removed", { n: c.removed.length }) : ""]
          .filter(Boolean)
          .join(" · ")}
      </p>
      ${update ? html`<p class="pb-sub">${this.t("pp_placed_hint")}</p>` : nothing}
      <div class="pb-actions">
        <button class="fp3d-btn fp3d-primary" ?disabled=${this._busy} @click=${() => void this.install(entry, p.origin.commit, p.pack.release)}>${this.t(update ? "pp_do_update" : "pp_do_install")}</button>
        <button class="fp3d-btn" ?disabled=${this._busy} @click=${() => (this._preview = null)}>${this.t("cancel")}</button>
      </div>
    </div>`;
  }

  private async previewInstall(entry: IndexPack): Promise<void> {
    if (!this.hass) return;
    this._busy = true;
    this._msg = null;
    try {
      // the pack at the URL must be the one the list names (#372)
      this._preview = await previewPackFromUrl(this.hass, entry.url, entry.id);
    } catch (err) {
      this._msg = { ok: false, text: this.packError(err) };
    } finally {
      this._busy = false;
    }
  }

  private askFirst = (code: ConfirmCode, message: string): Promise<boolean> => askConfirm(this.t(`pack_confirm_${code}`, { detail: message }), { ok: this.t("ask_ok"), cancel: this.t("cancel") });

  /** Installs (or updates to) the release the preview showed, insisting on its commit (#189). */
  private async install(entry: IndexPack, commit: string, release: number): Promise<void> {
    if (!this.hass) return;
    const hass = this.hass;
    this._busy = true;
    try {
      const res = await askingFirst((confirm) => installPackFromUrl(hass, entry.url, confirm, commit, entry.id), this.askFirst);
      if (!res) return;
      this._preview = null;
      this._msg = { ok: true, text: this.t("pb_done", { name: res.name, release }) };
      if (res.language && res.language === languageCode(hass.language)) await loadLanguage(hass.language, hass, true);
      this.dispatchEvent(new CustomEvent("packs-changed", { bubbles: true, composed: true }));
    } catch (err) {
      this._preview = null;
      this._msg = { ok: false, text: this.packError(err) };
    } finally {
      this._busy = false;
    }
  }

  private async removeEntry(entry: IndexPack): Promise<void> {
    if (!this.hass) return;
    if (!(await askConfirm(this.t("pack_remove_confirm", { name: entry.name }), { ok: this.t("pack_remove"), cancel: this.t("cancel"), danger: true }))) return;
    this._busy = true;
    try {
      await removePack(this.hass, entry.id);
      this._msg = { ok: true, text: this.t("pb_removed", { name: entry.name }) };
      this.dispatchEvent(new CustomEvent("packs-changed", { bubbles: true, composed: true }));
    } catch (err) {
      this._msg = { ok: false, text: this.t("pack_remove_failed", { error: errorText(err) }) };
    } finally {
      this._busy = false;
    }
  }

  private packError(err: unknown): string {
    const { code, message } = (err ?? {}) as { code?: string; message?: string };
    const key = `pack_error_${code}` as I18nKey;
    const text = this.t(key, { detail: message ?? String(err) });
    return text === key ? this.t("pack_error_other", { detail: message ?? String(err) }) : text;
  }

  static styles = [
    tokens,
    controls,
    css`
      :host {
        display: block;
      }
      .fp3d-btn {
        font: inherit;
        font-size: 13px;
        min-height: 34px;
        padding: 0 12px;
        color: var(--fp3d-text);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        cursor: pointer;
      }
      .fp3d-btn:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .fp3d-primary {
        background: var(--fp3d-primary);
        color: var(--fp3d-primary-text);
        border-color: transparent;
      }
      .fp3d-danger {
        color: var(--fp3d-danger, #ff6b6b);
      }
      .pb-top {
        position: sticky;
        top: 0;
        z-index: 2;
        padding: 6px 0 2px;
        background: var(--fp3d-chrome-solid, var(--fp3d-panel, #0d1424));
      }
      .pb-bar {
        display: flex;
        gap: 6px;
        margin-bottom: 6px;
      }
      .pb-search,
      select {
        flex: 1;
        min-width: 0;
        min-height: 36px;
        box-sizing: border-box;
        font: inherit;
        font-size: 14px;
        color: var(--fp3d-text);
        background: var(--fp3d-panel, #0d1424);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        padding: 6px 10px;
      }
      .pb-refresh {
        flex: none;
      }
      .pb-list,
      .pb-previews {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .pb-card {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 60px;
        margin-bottom: 6px;
        padding: 6px 8px;
        font: inherit;
        text-align: left;
        color: var(--fp3d-text);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        cursor: pointer;
      }
      .pb-card:hover {
        border-color: var(--fp3d-accent);
      }
      .pb-thumb {
        flex: none;
        width: 48px;
        height: 48px;
      }
      .pb-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .pb-sub,
      .pb-note {
        color: var(--fp3d-muted);
        font-size: 12px;
      }
      .pb-badge {
        flex: none;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--fp3d-line);
        color: var(--fp3d-muted);
      }
      .pb-upd {
        background: var(--fp3d-primary);
        color: var(--fp3d-primary-text);
        border-color: transparent;
      }
      .pb-comm {
        color: var(--fp3d-accent);
      }
      .pb-page h4 {
        margin: 8px 0 2px;
        font-size: 16px;
      }
      .pb-back {
        margin-top: 6px;
      }
      .pb-cats {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin: 6px 0;
      }
      .pb-chip {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
      }
      .pb-previews {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
        gap: 6px;
      }
      .pb-previews li {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 2px;
      }
      .pb-pic {
        width: 96px;
        height: 96px;
        max-width: 100%;
      }
      .pb-pic img {
        max-width: 100%;
        height: auto;
      }
      .pb-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin: 8px 0;
      }
      .pb-preview {
        margin: 8px 0;
        padding: 8px;
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
      }
      .pb-preview p {
        margin: 4px 0;
      }
      .pb-msg {
        font-size: 13px;
      }
      .pb-bad {
        color: var(--fp3d-danger, #ff6b6b);
      }
      a {
        color: var(--fp3d-accent);
      }
    `,
  ];
}

defineElement("fp3d-pack-browser", PackBrowser);
