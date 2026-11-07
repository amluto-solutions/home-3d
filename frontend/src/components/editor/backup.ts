// Backups and restore points: the history list, restoring, exporting and importing a backup or a plan.

import { formatDateTime, timeStyleOf } from "../../time-text.ts";
import { html, nothing } from "lit";
import { fetchImage, listHistory, restoreSnapshot, storeImage, takeSnapshot, type Snapshot } from "../../api.ts";
import { download, exportFile, parseExport } from "../../transfer.ts";
import { storedImageIds } from "../../transfer.ts";
import { normalizeBuilding } from "../../model.ts";
import type { Building } from "../../model.ts";
import { errorText, isImagesFull } from "../../failure.ts";
import { fetchBackup, type BackupFile, type BackupHome } from "../../api.ts";
import { migratePlanTypes } from "../../packs.ts";
import type { Fp3dEditor } from "../editor.ts";

/** A size for people (#240): 900 B, 42 KB, 1.3 MB (1 KB = 1,024 bytes). */
export function bytesText(bytes: number, lang?: string): string {
  const unit = bytes < 1024 ? [bytes, "B"] : bytes < 1024 * 1024 ? [bytes / 1024, "KB"] : [bytes / 1024 / 1024, "MB"];
  const n = unit[0] as number;
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: n < 10 && unit[1] !== "B" ? 1 : 0 }).format(n)} ${unit[1]}`;
}

/** BackupPart: methods of `Fp3dEditor`, copied onto its prototype by editor.ts (see parts.ts). */
export class BackupPart {
  async loadHistory(this: Fp3dEditor): Promise<void> {
    if (!this.hass) return;
    try {
      this._history = await listHistory(this.hass, this.home);
    } catch {
      this._history = [];
    }
  }

  async restoreFromHistory(this: Fp3dEditor, snap: Snapshot): Promise<void> {
    // a picture it names may be gone (kept only so many days, #154): it restores without it, and says so
    const lacks = snap.missing_pictures ? ` ${this.t("backup_restore_missing", { n: snap.missing_pictures })}` : "";
    if (!this.hass || !(await this.ask(this.t("backup_restore_confirm", { time: this.snapshotTime(snap) }) + lacks, this.t("backup_restore")))) return;
    let res: Awaited<ReturnType<typeof restoreSnapshot>>;
    try {
      res = await restoreSnapshot(this.hass, snap.id, this.home);
    } catch (err) {
      await this.tell(this.t("restore_failed", { error: errorText(err) }));
      return;
    }
    this._notice = res.missing_pictures ? this.t("backup_restored_missing", { n: res.missing_pictures }) : this.t("backup_restored");
    await this.loadHistory();
  }

  /** The stored pictures a plan uses, fetched one by one (a missing one is left out). */
  async storedImages(this: Fp3dEditor, building: Building, home?: string): Promise<Record<string, string>> {
    const images: Record<string, string> = {};
    for (const id of storedImageIds(building)) {
      try {
        images[id] = await fetchImage(this.hass, id, home);
      } catch {
        /* a missing picture is left out */
      }
    }
    return images;
  }

  /** Everything in one file: every home's plan and pictures (#53) and the packs (with their sources). The active
   * home's pictures sit at the top (`images`), as before several homes; every other home carries its own. */
  async exportBackup(this: Fp3dEditor): Promise<void> {
    if (!this.hass) return;
    this._backupBusy = true;
    try {
      const base = await fetchBackup(this.hass);
      const images = await this.storedImages(base.building, base.active);
      const homes = [];
      for (const home of base.homes ?? []) {
        homes.push(home.id === base.active ? home : { ...home, images: await this.storedImages(home.building, home.id) });
      }
      const day = new Date().toISOString().slice(0, 10);
      const file = { ...base, ...(base.homes ? { homes } : {}), exported_at: new Date().toISOString(), images };
      download(`home-3d-${this.t("export_name_full")}-${day}.json`, JSON.stringify(file));
    } catch (err) {
      await this.tell(this.t("backup_import_error", { error: String((err as { message?: string })?.message ?? err) }));
    } finally {
      this._backupBusy = false;
    }
  }

  async importBackup(this: Fp3dEditor, e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !this.hass) return;
    let data: BackupFile;
    try {
      data = JSON.parse(await file.text()) as BackupFile;
    } catch {
      await this.tell(this.t("import_error_not_json"));
      return;
    }
    if (data?.format !== "home3d-backup" || !data.building) {
      await this.tell(this.t("backup_full_not_backup"));
      return;
    }
    if (!(await this.ask(this.t("backup_full_confirm"), this.t("backup_restore")))) return;
    this._backupBusy = true;
    try {
      // a lazy chunk of its own (#375): the parts and sizes of a large backup
      const { checkBackup, restoreBackup } = await import("../../backup-send.ts");
      // several homes (#53): one restore per home keeps each message small (a plan can be megabytes); a file from
      // before them restores its one plan onto the home being edited
      const homes = data.homes?.length ? data.homes : null;
      const parts: { images: Record<string, string>; home?: BackupHome }[] = homes
        ? homes.map((h) => ({ home: h, images: h.images ?? (h.id === data.active ? (data.images ?? {}) : {}) }))
        : [{ images: data.images ?? {} }];
      // the whole file is checked first, so a broken last home stops it before the first is restored (#153); the
      // packs and custom items come with the last part, after every plan (left out of the file: they stay)
      const message = (part: (typeof parts)[number], i: number) => {
        const last = i === parts.length - 1;
        const one = part.home ? { homes: [{ id: part.home.id, name: part.home.name, building: part.home.building }], ...(last && data.active ? { active: data.active } : {}) } : undefined;
        return [part.home ? null : data.building, last ? data.packs : undefined, last ? data.items : undefined, one, part.home ? undefined : this.home] as const;
      };
      for (const [i, part] of parts.entries()) await checkBackup(this.hass, ...message(part, i));
      let res: Awaited<ReturnType<typeof restoreBackup>> | null = null;
      let pictures = 0;
      let full = false;
      const done: string[] = [];
      // custom items whose id was taken here by another item came in under a new id (#376)
      const renamed = new Set<string>();
      const unreadableHomes: string[] = [];
      for (const [i, part] of parts.entries()) {
        try {
          res = await restoreBackup(this.hass, ...message(part, i));
        } catch (err) {
          // the part that failed was undone; the homes before it stay restored, each with a restore point of before
          if (!done.length) throw err;
          const e = (err ?? {}) as { message?: string };
          await this.tell(this.t("backup_import_partial", { home: part.home?.name ?? "", done: done.join(", "), error: String(e.message ?? err) }));
          return;
        }
        // a home whose plan is unreadable (newer Home 3D, or invalid) is skipped by the backend and listed (#380)
        const unreadable = part.home && res.skipped.some((s) => s.reason === "home_unreadable" && s.id === part.home?.id);
        if (unreadable && part.home) {
          unreadableHomes.push(part.home.name);
          continue;
        }
        if (part.home) done.push(part.home.name);
        for (const r of res.renamed ?? []) renamed.add(`${r.id} → ${r.as}`);
        for (const [id, picture] of Object.entries(part.images)) {
          try {
            await storeImage(this.hass, id, picture, part.home?.id ?? res.home_id ?? this.home);
            pictures++;
          } catch (err) {
            /* an unreadable picture is skipped; a home that holds as many as it may (#364) says so once below */
            if (isImagesFull(err)) full = true;
          }
        }
      }
      if (!res) return;
      if (full) await this.tell(this.t("images_full"));
      // the editor shows its own home again; another one made active by the backup comes with the panel's reload
      if (!res.home_id || !this.home || res.home_id === this.home) {
        this.setDoc(normalizeBuilding(res.building));
        this._floorId = res.building.floors[0]?.id ?? null;
        this.selectItem("room", null);
        this.fit();
      }
      this.dispatchEvent(new CustomEvent("packs-changed", { bubbles: true, composed: true }));
      const packsSkipped = res.skipped.filter((s) => s.reason !== "home_unreadable");
      const skipped = packsSkipped.length ? ` ${this.t("backup_full_skipped", { packs: packsSkipped.map((s) => s.id).join(", ") })}` : "";
      const homesSkipped = unreadableHomes.length ? ` ${this.t("backup_homes_skipped", { homes: unreadableHomes.join(", ") })}` : "";
      const moved = renamed.size ? ` ${this.t("backup_items_renamed", { items: [...renamed].join(", ") })}` : "";
      this._notice = this.t("backup_full_restored", { packs: res.packs, pictures }) + skipped + homesSkipped + moved;
    } catch (err) {
      // a lost connection comes as the whole result message ({ error: { code, message } }), e.g. when the backup is
      // larger than Home Assistant takes in one message
      const e = (err ?? {}) as { code?: string | number; message?: string; error?: { code?: string | number; message?: string } };
      // a pack or a plan larger than one message takes (#375): said before anything is sent
      if (e.code === "backup_too_large") {
        await this.tell(this.t("backup_part_too_large", { detail: String(e.message ?? "") }));
        return;
      }
      await this.tell(this.t("backup_import_error", { error: String(e.message ?? e.error?.message ?? e.code ?? e.error?.code ?? err) }));
    } finally {
      this._backupBusy = false;
    }
  }

  exportPlan(this: Fp3dEditor, shareable: boolean): void {
    const day = new Date().toISOString().slice(0, 10);
    download(`home-3d-${this.t(shareable ? "export_name_template" : "export_name_backup")}-${day}.json`, JSON.stringify(exportFile(this._doc, shareable), null, 2));
  }

  async importPlan(this: Fp3dEditor, e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file || !this.hass) return;
    let building: Building;
    try {
      // a plan exported before items moved between packs takes their new ids (#110)
      building = migratePlanTypes(parseExport(await file.text()));
    } catch (err) {
      const code = (err as Error).message;
      await this.tell(code === "not_json" ? this.t("import_error_not_json") : code === "not_plan" ? this.t("import_error_not_plan") : code === "plan_too_new" ? this.t("import_error_too_new") : this.t("backup_import_error", { error: code }));
      return;
    }
    if (!(await this.ask(this.t("backup_import_confirm"), this.t("ask_ok")))) return;
    // the current plan stays available as a restore point
    await takeSnapshot(this.hass, this.home).catch(() => undefined);
    this.setDoc(building);
    this._floorId = building.floors[0]?.id ?? null;
    this.selectItem("room", null);
    this.fit();
    this._notice = this.t("backup_imported");
  }

  snapshotTime(this: Fp3dEditor, snap: Snapshot): string {
    return formatDateTime(snap.saved_at * 1000, timeStyleOf(this.hass));
  }

  renderBackup(this: Fp3dEditor) {
    return html`<details
      class="fp3d-section"
      @toggle=${(e: Event) => {
        if ((e.target as HTMLDetailsElement).open) void this.loadHistory();
      }}
    >
      <summary>${this.t("backup")}</summary>
      <h4 class="fp3d-lib-head">${this.t("backup_history")}</h4>
      ${this._history === null
        ? html`<p class="fp3d-sub">${this.t("loading")}</p>`
        : this._history.length
          ? html`<div class="fp3d-room-list">
              ${this._history.map(
                (h) => html`<div class="fp3d-row fp3d-dev-row">
                  <span>${this.snapshotTime(h)} <span class="fp3d-muted">· ${this.t("backup_summary", { rooms: h.rooms, furniture: h.furniture })}${h.size ? ` · ${bytesText(h.size, this.hass?.language)}` : ""}</span></span>
                  <button class="fp3d-link" ?disabled=${!this.isHaAdmin} title=${this.isHaAdmin ? "" : this.t("backup_admin_only")} @click=${() => this.restoreFromHistory(h)}>${this.t("backup_restore")}</button>
                </div>`,
              )}
            </div>`
          : html`<p class="fp3d-sub">${this.t("backup_none")}</p>`}
      <h4 class="fp3d-lib-head">${this.t("backup_file")}</h4>
      <div class="fp3d-actions">
        <button class="fp3d-btn" @click=${() => this.exportPlan(false)}>${this.t("backup_export")}</button>
        <button class="fp3d-btn" title=${this.t("backup_export_share_hint")} @click=${() => this.exportPlan(true)}>${this.t("backup_export_share")}</button>
        <label class="fp3d-btn fp3d-upload"
          >${this.t("backup_import")}<input type="file" accept="application/json,.json" @change=${this.importPlan}
        /></label>
      </div>
      <p class="fp3d-sub">${this.t("backup_hint")}</p>
      <h4 class="fp3d-lib-head">${this.t("backup_full")}</h4>
      <div class="fp3d-actions">
        <button class="fp3d-btn" ?disabled=${this._backupBusy} @click=${() => this.exportBackup()}>${this._backupBusy ? "…" : this.t("backup_full_export")}</button>
        ${this.isHaAdmin
          ? html`<label class="fp3d-btn fp3d-upload"
              >${this.t("backup_full_import")}<input type="file" accept="application/json,.json" @change=${this.importBackup}
            /></label>`
          : html`<button class="fp3d-btn" disabled title=${this.t("backup_admin_only")}>${this.t("backup_full_import")}</button>`}
      </div>
      <p class="fp3d-sub">${this.t("backup_full_hint")}</p>
      ${this.isHaAdmin ? nothing : html`<p class="fp3d-sub">${this.t("backup_admin_only")}</p>`}
    </details>`;
  }
}
