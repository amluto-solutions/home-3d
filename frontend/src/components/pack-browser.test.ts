// The Library's Browse tab (#336): the list, the quiet offline note, a pack's page with its pictures, and Install /
// Update / Remove through the install-by-URL path (#25) with the preview's commit (#189). Driven in plain Node.

import assert from "node:assert/strict";
import { test } from "node:test";
import { setAskHost } from "../ask.ts";
import { forgetPackIndex, type IndexPack, type PackIndex } from "../pack-index.ts";
import type { FurniturePack, PackItem } from "../packs.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { PackBrowser } = (await import("./pack-browser.ts")) as unknown as { PackBrowser: new () => Record<string, any> };

const flat = (v: unknown): string => {
  if (v == null || typeof v === "function" || typeof v === "symbol") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  const t = v as { strings?: readonly string[]; values?: unknown[] };
  if (typeof v === "object") return t.strings ? t.strings.map((s, i) => s + (i < t.values!.length ? flat(t.values![i]) : "")).join("") : "";
  return String(v);
};

const chair: PackItem = { id: "cube_chair", name: { en: "Cube chair" }, size: [0.8, 0.8, 0.75], group: "seating", parts: [] } as unknown as PackItem;

function listed(id: string, extra: Partial<IndexPack> = {}): IndexPack {
  return {
    id,
    name: `Pack ${id}`,
    description: "Chairs for testing.",
    publisher: id.split(".")[0],
    licence: "MIT",
    release: 2,
    url: `https://github.com/someone/packs/tree/main/${id}`,
    source: "community",
    kind: "furniture",
    items: 8,
    categories: { seating: 8 },
    thumbnail: "cube_chair",
    previews: [chair],
    ...extra,
  };
}

const COMMIT = "c".repeat(40);

function fakeHass(index: PackIndex | null, calls: Record<string, unknown>[]) {
  return {
    language: "en",
    callWS: async (msg: Record<string, unknown>) => {
      calls.push(msg);
      if (msg.type === "home_3d/packs/index") return index ?? Promise.reject({ code: "offline", message: "no route" });
      if (msg.type === "home_3d/packs/preview_url")
        return {
          pack: { id: "acme.chairs", name: "Pack acme.chairs", publisher: "acme", licence: "MIT", release: 2, items: 8 },
          origin: { url: msg.url, owner: "someone", repo: "packs", ref: "main", folder: "acme.chairs", commit: COMMIT, default_branch: false },
          installed: null,
          changes: { added: [{ id: "cube_chair", name: { en: "Cube chair" } }], changed: [], removed: [], unchanged: 0 },
          warnings: [],
        };
      if (msg.type === "home_3d/packs/install_url") return { id: "acme.chairs", name: "Pack acme.chairs", publisher: "acme", licence: "MIT", items: 8, origin: {} };
      return {};
    },
  };
}

async function browser(index: PackIndex | null, packs: FurniturePack[] = []) {
  forgetPackIndex();
  const calls: Record<string, unknown>[] = [];
  const el = new PackBrowser();
  el.hass = fakeHass(index, calls);
  el.packs = packs;
  el.picture = async (item: PackItem) => `data:image/png;base64,${item.id}`;
  await el.load(false);
  return { el, calls };
}

const index = (...packs: IndexPack[]): PackIndex => ({ url: "https://raw.githubusercontent.com/x/y/main/index.json", fetched_at: 1, packs });

test("the list shows every listed pack with its publisher, size and badges", async () => {
  const { el } = await browser(index(listed("acme.chairs"), listed("bob.lamps", { source: "official" })), [{ id: "bob.lamps", name: "x", publisher: "bob", release: 1, items: [] }]);
  const out = flat(el.render());
  assert.match(out, /Pack acme\.chairs/);
  assert.match(out, /8 items · v2 · MIT/);
  assert.match(out, /Community/);
  assert.match(out, /Update to v2/);
  el._query = "lamps";
  assert.doesNotMatch(flat(el.render()), /Pack acme\.chairs/);
});

test("without internet the tab says so quietly and offers to try again", async () => {
  const { el } = await browser(null);
  const out = flat(el.render());
  assert.match(out, /could not be loaded/);
  assert.match(out, /Try again/);
});

test("a pack's page shows pictures of its items, drawn from the index's copies", async () => {
  const { el } = await browser(index(listed("acme.chairs")));
  el._open = "acme.chairs";
  flat(el.render());
  await new Promise((r) => setTimeout(r, 0));
  const out = flat(el.render());
  assert.match(out, /data:image\/png;base64,cube_chair/);
  assert.match(out, /Cube chair/);
  assert.match(out, /\+ 7 more items/);
  assert.match(out, /Install/);
});

test("Install previews the pack from GitHub, then installs exactly the previewed commit of the listed pack (#372)", async () => {
  const { el, calls } = await browser(index(listed("acme.chairs")));
  const events: string[] = [];
  el.dispatchEvent = (e: Event) => (events.push(e.type), true);
  el._open = "acme.chairs";
  await el.previewInstall(listed("acme.chairs"));
  assert.match(flat(el.render()), /Install “Pack acme\.chairs” v2\?/);
  await el.install(listed("acme.chairs"), COMMIT, 2);
  const url = "https://github.com/someone/packs/tree/main/acme.chairs";
  assert.deepEqual(calls.find((c) => c.type === "home_3d/packs/preview_url"), { type: "home_3d/packs/preview_url", url, pack_id: "acme.chairs" });
  const sent = calls.find((c) => c.type === "home_3d/packs/install_url");
  assert.deepEqual(sent, { type: "home_3d/packs/install_url", url, commit: COMMIT, pack_id: "acme.chairs" });
  assert.deepEqual(events, ["packs-changed"]);
  assert.match(flat(el.render()), /v2 is installed/);
});

test("an installed copy can be removed; a pack that ships with Home 3D cannot", async () => {
  const mine = await browser(index(listed("acme.chairs")), [{ id: "acme.chairs", name: "x", publisher: "acme", release: 2, items: [] }]);
  mine.el._open = "acme.chairs";
  assert.match(flat(mine.el.render()), /Remove/);
  setAskHost({ ask: async () => ({ ok: true, value: "" }) });
  mine.el.dispatchEvent = () => true;
  await mine.el.removeEntry(listed("acme.chairs"));
  setAskHost(null);
  assert.ok(mine.calls.some((c) => c.type === "home_3d/packs/remove" && c.pack_id === "acme.chairs"));

  const bundled = await browser(index(listed("amluto.living")), [{ id: "amluto.living", name: "x", publisher: "t", release: 2, bundled: true, items: [] }]);
  bundled.el._open = "amluto.living";
  const out = flat(bundled.el.render());
  assert.doesNotMatch(out, /Remove/);
  assert.match(out, /Comes with Home 3D/);
});

test("the tab asks for the index once it has a hass (a lazy element gets its properties on its first update)", async () => {
  forgetPackIndex();
  const calls: Record<string, unknown>[] = [];
  const el = new PackBrowser();
  el.willUpdate();
  assert.equal(calls.length, 0);
  el.hass = fakeHass(index(listed("acme.chairs")), calls);
  el.willUpdate();
  el.willUpdate();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls.filter((c) => c.type === "home_3d/packs/index").length, 1);
  assert.match(flat(el.render()), /Pack acme\.chairs/);
});
