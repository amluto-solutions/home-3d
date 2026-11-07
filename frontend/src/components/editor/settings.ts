// House-wide settings shown in the editor and on the Settings page: favourites, media presets, own buttons, start
// views, director triggers, editors and tablet users, presence.

import { html, nothing, svg, type TemplateResult } from "lit";
import { entityName } from "../../devices.ts";
import type { DirectorSettings } from "../../director.ts";
import type { I18nKey } from "../../i18n.ts";
import { type StartView, BUTTON_ACTIONS, type ButtonAction, type CustomButton, type MediaPreset, uid, type Building } from "../../model.ts";
import { getEditors, setEditors } from "../../api.ts";
import { lastAdmin, personUserIds, pickTabletUser, userChoices, type EditorUser } from "../../editors.ts";
import { round, numberish } from "./helpers.ts";
import type { Fp3dEditor } from "../editor.ts";
import { need, loadMultiSelect } from "./lazy.ts";

/** A list with the entry at `i` moved by `by` places (stays inside the list). */
const moveAt = <T,>(list: T[], i: number, by: number): T[] => {
  const next = [...list];
  const [x] = next.splice(i, 1);
  next.splice(Math.max(0, Math.min(next.length, i + by)), 0, x);
  return next;
};

const ORDER_PATHS = { up: "M6 15l6-6 6 6", down: "M6 9l6 6 6-6", remove: "M6 6l12 12M18 6L6 18" } as const;

/** SettingsPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class SettingsPart {
  /**
   * The same three compact icon buttons (up, down, remove) in a fixed column at the right of every reorderable list in
   * Settings, so they line up whatever the names are (#326). `vertical` stacks them for a taller entry.
   */
  orderTools(this: Fp3dEditor, label: string, i: number, count: number, move: (by: number) => void, remove: () => void, vertical = false): TemplateResult {
    const btn = (kind: keyof typeof ORDER_PATHS, text: string, off: boolean, run: () => void) => html`<button
      class="fp3d-ord-btn ${kind === "remove" ? "fp3d-ord-remove" : ""}"
      title=${text}
      aria-label="${text}: ${label}"
      ?disabled=${off}
      @click=${run}
    ><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svg`<path d=${ORDER_PATHS[kind]}></path>`}</svg></button>`;
    return html`<span class="fp3d-ord ${vertical ? "fp3d-ord-v" : ""}">
      ${btn("up", this.t("move_up"), i === 0, () => move(-1))}${btn("down", this.t("move_down"), i === count - 1, () => move(1))}${btn("remove", this.t("delete"), false, remove)}
    </span>`;
  }

  /** Favourites of the house: scenes, scripts and switches in the central menu (star) of the 3D view (#145). */
  renderFavorites(this: Fp3dEditor) {
    const list = this._doc.settings.favorites ?? [];
    const domains = ["scene", "script", "automation", "button", "input_button", "switch", "input_boolean", "light", "fan", "cover", "lock"];
    const options = this.entityOptions((id) => domains.includes(id.split(".")[0]) && !list.includes(id), list.join(","));
    const set = (next: string[]) => this.change((d) => (d.settings.favorites = next.length ? next : undefined));
    const move = (i: number, by: number) => {
      const next = [...list];
      const [x] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, x);
      set(next);
    };
    return html`<details class="fp3d-section">
      <summary>${this.t("favorites")}${list.length ? html` <span class="fp3d-lib-count">${list.length}</span>` : nothing}</summary>
      <p class="fp3d-sub">${this.t("favorites_hint")}</p>
      ${list.map(
        (id, i) => html`<div class="fp3d-row fp3d-dev-row fp3d-ord-row">
          <span class="fp3d-dev-name" title=${entityName(this.hass, id)}><span>${entityName(this.hass, id)}</span></span>
          ${this.orderTools(entityName(this.hass, id), i, list.length, (by) => move(i, by), () => set(list.filter((x) => x !== id)))}
        </div>`,
      )}
      ${list.length < 40
        ? html`<div class="fp3d-form">
            ${this.entitySelect(this.t("favorites_add"), null, undefined, options, (v) => {
              if (v && v !== "none" && !list.includes(v)) set([...list, v]);
            })}
          </div>`
        : nothing}
    </details>`;
  }

  /** Klang & Kino: stations and playlists to start on a speaker from its quick menu. */
  renderMediaPresets(this: Fp3dEditor) {
    const list = this._doc.settings.media_presets ?? [];
    const set = (next: MediaPreset[]) => this.change((d) => (d.settings.media_presets = next.length ? next : undefined));
    const upd = (i: number, patch: Partial<MediaPreset>) => set(list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
    return html`<h4>${this.t("presets")}</h4>
      <p class="fp3d-sub">${this.t("presets_hint")}</p>
      <datalist id="fp3d-preset-types">
        ${["music", "url", "playlist", "SPOTIFY", "AMAZON_MUSIC", "TUNEIN", "APPLE_MUSIC"].map((t) => html`<option value=${t}></option>`)}
      </datalist>
      ${list.map(
        (p, i) => html`<div class="fp3d-form fp3d-own-button">
          <label class="fp3d-field"
            >${this.t("own_button_label")}
            <input type="text" maxlength="60" .value=${p.label} @change=${(e: Event) => upd(i, { label: (e.target as HTMLInputElement).value.trim() || "Radio" })}
          /></label>
          <label class="fp3d-field" title=${this.t("preset_type_hint")}
            >${this.t("preset_type")}
            <input type="text" list="fp3d-preset-types" .value=${p.type} @change=${(e: Event) => upd(i, { type: (e.target as HTMLInputElement).value.trim() || "music" })}
          /></label>
          <label class="fp3d-field fp3d-wide" title=${this.t("preset_content_hint")}
            >${this.t("preset_content")}
            <input type="text" .value=${p.content} placeholder="https://… · spotify:playlist:… · Classic FM" @change=${(e: Event) => upd(i, { content: (e.target as HTMLInputElement).value.trim() })}
          /></label>
          <div class="fp3d-actions fp3d-wide">
            <button class="fp3d-btn fp3d-danger" @click=${() => set(list.filter((_, j) => j !== i))}>${this.t("delete")}</button>
          </div>
        </div>`,
      )}
      ${list.length < 30
        ? html`<div class="fp3d-actions">
            <button class="fp3d-btn" @click=${() => set([...list, { id: uid("preset"), label: "Radio", type: "music", content: "" }])}>+ ${this.t("preset_add")}</button>
          </div>`
        : nothing}`;
  }

  /** Own buttons of the central menu (D143): label, icon, action, target and data. */
  renderOwnButtons(this: Fp3dEditor) {
    const list = this._doc.settings.buttons ?? [];
    const set = (next: CustomButton[]) => this.change((d) => (d.settings.buttons = next.length ? next : undefined));
    const upd = (i: number, patch: Partial<CustomButton>) => set(list.map((b, j) => (j === i ? { ...b, ...patch } : b)));
    const placeholder: Record<ButtonAction, string> = { navigate: "/lovelace/blinds", more_info: "cover.living_room", service: "script.turn_on", fire_dom_event: "" };
    // service and event buttons run in the session of whoever taps: only an admin adds or changes one (#151)
    const privileged = (a: ButtonAction) => a === "service" || a === "fire_dom_event";
    const lockedBtn = (b: CustomButton) => !this.isHaAdmin && privileged(b.action);
    return html`<h4>${this.t("own_buttons")}</h4>
      <p class="fp3d-sub">${this.t("own_buttons_hint")}</p>
      ${!this.isHaAdmin ? html`<p class="fp3d-sub">${this.t("own_button_admin")}</p>` : nothing}
      ${list.map(
        (b, i) => html`<div class="fp3d-ord-card">
        ${this.orderTools(b.label, i, list.length, (by) => set(moveAt(list, i, by)), () => set(list.filter((_, j) => j !== i)), true)}
        <div class="fp3d-form fp3d-own-button">
          <label class="fp3d-field"
            >${this.t("own_button_label")}
            <input type="text" maxlength="60" .value=${b.label} @change=${(e: Event) => upd(i, { label: (e.target as HTMLInputElement).value.trim() || this.t("own_button_new") })}
          /></label>
          <label class="fp3d-field"
            >${this.t("own_button_action")}
            <select ?disabled=${lockedBtn(b)} @change=${(e: Event) => upd(i, { action: (e.target as HTMLSelectElement).value as ButtonAction })}>
              ${BUTTON_ACTIONS.filter((a) => this.isHaAdmin || !privileged(a) || a === b.action).map((a) => html`<option value=${a} ?selected=${a === b.action}>${this.t(`own_action_${a}` as I18nKey)}</option>`)}
            </select></label
          >
          ${this.iconInput(b.icon ?? null, (v) => upd(i, { icon: v }))}
          ${b.action !== "fire_dom_event"
            ? html`<label class="fp3d-field fp3d-wide"
                >${this.t(`own_target_${b.action}` as I18nKey)}
                <input type="text" ?disabled=${lockedBtn(b)} .value=${b.target ?? ""} placeholder=${placeholder[b.action]} @change=${(e: Event) => upd(i, { target: (e.target as HTMLInputElement).value.trim() || null })}
              /></label>`
            : nothing}
          ${b.action === "service" || b.action === "fire_dom_event"
            ? html`<label class="fp3d-field fp3d-wide" title=${this.t("own_data_hint")}
                >${this.t("own_data")}
                <textarea
                  rows="4"
                  spellcheck="false"
                  ?disabled=${lockedBtn(b)}
                  placeholder=${b.action === "fire_dom_event" ? '{"browser_mod": {"service": "browser_mod.popup", "data": {"title": "Blinds", "content": {"type": "custom:my-cover-card"}}}}' : '{"entity_id": "script.party"}'}
                  .value=${b.data ? JSON.stringify(b.data, null, 1) : ""}
                  @change=${(e: Event) => {
                    (e.target as HTMLTextAreaElement).setCustomValidity("");
                    const raw = (e.target as HTMLTextAreaElement).value.trim();
                    if (!raw) return upd(i, { data: null });
                    try {
                      const v = JSON.parse(raw);
                      if (v && typeof v === "object" && !Array.isArray(v)) upd(i, { data: v });
                    } catch {
                      (e.target as HTMLTextAreaElement).setCustomValidity(this.t("own_data_bad"));
                      (e.target as HTMLTextAreaElement).reportValidity();
                    }
                  }}
                ></textarea></label
              >`
            : nothing}
        </div></div>`,
      )}
      ${list.length < 20
        ? html`<div class="fp3d-actions">
            <button class="fp3d-btn" @click=${() => set([...list, { id: uid("btn"), label: this.t("own_button_new"), action: "navigate", target: null }])}>+ ${this.t("own_button_add")}</button>
          </div>`
        : nothing}`;
  }

  /** The camera of the editor's 3D pane as it stands right now, rounded for the plan (null: no pane). */
  paneView(this: Fp3dEditor): StartView | null {
    const pane = this.renderRoot.querySelector("fp3d-view3d") as (HTMLElement & { currentView(): StartView | null }) | null;
    const v = pane?.currentView();
    if (!v) return null;
    const t = v.target;
    return { theta: round(v.theta), phi: round(v.phi), radius: round(v.radius), ...(t ? { target: { x: round(t.x), y: round(t.y), z: round(t.z) } } : {}) };
  }

  /** This floor opens with the camera of the editor's 3D pane as it stands right now (#182). */
  rememberFloorView(this: Fp3dEditor): void {
    const v = this.paneView();
    if (!v) {
      void this.tell(this.t("floor_start_view_need_pane"));
      return;
    }
    this.updateFloor({ start_view: v });
  }

  /** Tapping this room in 3D flies to the camera of the editor's 3D pane as it stands right now (#282). */
  rememberRoomView(this: Fp3dEditor): void {
    const v = this.paneView();
    if (!v) {
      void this.tell(this.t("room_start_view_need_pane"));
      return;
    }
    this.updateRoom({ start_view: v });
  }

  /** The camera the house opens with: the editor's 3D pane as it stands right now, or the default. */
  /** Live director: own triggers – an entity that goes on or open and the camera to show for it (D615). */
  renderDirectorTriggers(this: Fp3dEditor, d: DirectorSettings, placed: string[]) {
    const hass = this.hass;
    if (!hass) return nothing;
    const list = d.triggers ?? [];
    const save = (next: { entity: string; camera: string | null }[]) => this.change((doc) => (doc.settings.director = { ...(doc.settings.director ?? {}), triggers: next.length ? next : null }));
    return html`<div class="fp3d-wide">
      <h4 class="fp3d-lib-head">${this.t("director_triggers")}</h4>
      <p class="fp3d-sub">${this.t("director_triggers_hint")}</p>
      ${list.map(
        (t, i) => html`<div class="fp3d-form">
          ${this.entitySelect(this.t("director_trigger_entity"), t.entity || null, undefined, this.entityOptions((id) => /^(event|binary_sensor|cover|lock|switch|input_boolean)\./.test(id)), (v) =>
            save(list.map((x, k) => (k === i ? { ...x, entity: v && v !== "none" ? v : "" } : x)).filter((x) => x.entity)),
          )}
          ${this.entitySelect(this.t("director_doorbell_camera"), t.camera, undefined, this.entityOptions((id) => id.startsWith("camera.") && placed.includes(id), placed.join(",")), (v) =>
            save(list.map((x, k) => (k === i ? { ...x, camera: v && v !== "none" ? v : null } : x))),
          )}
          <button class="fp3d-btn" @click=${() => save(list.filter((_, k) => k !== i))}>✕ ${this.t("delete")}</button>
        </div>`,
      )}
      ${list.length < 20
        ? html`<div class="fp3d-form">
            ${this.entitySelect(this.t("director_trigger_add"), null, undefined, this.entityOptions((id) => /^(event|binary_sensor|cover|lock|switch|input_boolean)\./.test(id)), (v) => {
              if (v && v !== "none") save([...list, { entity: v, camera: null }]);
            })}
          </div>`
        : nothing}
    </div>`;
  }

  /** Who may change the plan: every user with a tick; the default is every admin. Admins only. */
  renderEditors(this: Fp3dEditor) {
    const hass = this.hass;
    if (!hass) return nothing;
    const answer = (p: Promise<{ users: EditorUser[]; custom: boolean }>) =>
      p
        .then((res) => {
          this.editorsList = res;
          this.editorsMsg = null;
        })
        .catch((err: unknown) => {
          const code = (err as { code?: string } | null)?.code;
          this.editorsMsg = this.t(code === "no_admin" ? "editors_no_admin" : "editors_failed");
        })
        .finally(() => this.requestUpdate());
    this.askEditors(answer);
    const list = this.editorsList;
    return html`<div class="fp3d-form">
      <p class="fp3d-sub fp3d-wide">${this.t("editors_hint")}</p>
      ${list
        ? this.userSelect(
            list.users,
            list.users.filter((u) => u.editor).map((u) => u.id),
            list.users.filter((u) => u.editor && lastAdmin(list.users, u.id)).map((u) => u.id),
            this.t("editors_title"),
            (ids) => void answer(setEditors(hass, ids)),
          )
        : html`<p class="fp3d-sub fp3d-wide">${this.t("loading")}</p>`}
      ${this.editorsMsg ? html`<p class="fp3d-sub fp3d-wide fp3d-pack-error">${this.editorsMsg}</p>` : nothing}
      ${list?.custom
        ? html`<div class="fp3d-actions fp3d-wide"><button class="fp3d-btn" @click=${() => void answer(setEditors(hass, null))}>${this.t("editors_reset")}</button></div>`
        : nothing}
    </div>`;
  }

  /** The users (from the editors list, HA admins only): asked once, answered into `editorsList`. */
  askEditors(this: Fp3dEditor, answer?: (p: Promise<{ users: EditorUser[]; custom: boolean }>) => Promise<void>): void {
    const hass = this.hass;
    if (this.editorsAsked || !hass) return;
    this.editorsAsked = true;
    const p = getEditors(hass);
    if (answer) void answer(p);
    else
      void p
        .then((res) => (this.editorsList = res))
        .catch(() => undefined)
        .finally(() => this.requestUpdate());
  }

  /** A user list as a searchable multi-select (#227): real people first, service users (no person) behind a toggle. */
  userSelect(this: Fp3dEditor, users: EditorUser[], picked: string[], locked: string[], label: string, onChange: (ids: string[]) => void, none?: string) {
    need(loadMultiSelect);
    return html`<fp3d-multi-select
      class="fp3d-wide"
      .options=${userChoices(users, personUserIds(this.hass?.states), this.t("editors_admin"))}
      .value=${picked}
      .locked=${locked}
      .label=${label}
      .placeholder=${none ?? ""}
      .searchLabel=${this.t("multi_search")}
      .emptyText=${this.t("multi_none")}
      .secondaryLabel=${this.t("users_show_service")}
      .removeLabel=${this.t("multi_remove")}
      @change=${(e: CustomEvent<{ value: string[] }>) => onChange(e.detail.value)}
    ></fp3d-multi-select>`;
  }

  /** Wall tablets (#92): users whose panel opens locked (no editor, no settings); the idle return is a row of its own. */
  renderTabletUsers(this: Fp3dEditor, users: EditorUser[]) {
    return this.userSelect(users, this._doc.settings.tablet_users ?? [], [], this.t("tablet_users"), (ids) => this.change((d) => (d.settings.tablet_users = ids)), this.t("tablet_users_none"));
  }

  setTabletUser(this: Fp3dEditor, id: string, on: boolean): void {
    this.change((d) => (d.settings.tablet_users = pickTabletUser(d.settings.tablet_users, id, on)));
  }

  renderPresenceSettings(this: Fp3dEditor) {
    const persons = Object.keys(this.hass?.states ?? {})
      .filter((id) => id.startsWith("person."))
      .sort();
    const sensors = (person: string) => {
      // likely room sensors of this person first (ESPresense / Bermuda name them after the device)
      const slug = person.slice("person.".length);
      const all = this.entityOptions((id) => numberish(id));
      const likely = (id: string) => id.includes(slug) && /(area|room|bermuda|espresense)/.test(id);
      return [...all.filter((o) => likely(o.id)), ...all.filter((o) => !likely(o.id))];
    };
    const set = (person: string, sensor: string | null) => {
      const next = structuredClone(this._doc);
      next.presence = next.presence.filter((p) => p.person !== person);
      if (sensor && sensor !== "none") next.presence.push({ person, sensor });
      this.setDoc(next);
    };
    return this.sideFold("presence", "", false, this.t("presence"), "", this._doc.presence.length, () => html`<div class="fp3d-form">
        ${persons.length
          ? persons.map((id) =>
              this.entitySelect(
                `${entityName(this.hass, id)} · ${this.t("presence_sensor")}`,
                this._doc.presence.find((p) => p.person === id)?.sensor ?? null,
                undefined,
                sensors(id),
                (v) => set(id, v),
              ),
            )
          : html`<p class="fp3d-sub fp3d-wide">${this.t("no_persons")}</p>`}
      </div>
      <p class="fp3d-sub">${this.t("presence_hint")}</p>`);
  }

  setSettings(this: Fp3dEditor, patch: Partial<Building["settings"]>): void {
    const next = structuredClone(this._doc);
    Object.assign(next.settings, patch);
    this.setDoc(next);
  }
}
