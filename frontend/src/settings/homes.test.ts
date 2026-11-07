// The Homes page in Settings (#296): the home list, New, Load sample, Open, Show on displays, Rename, Duplicate and
// Delete moved here from the header's menu (#53, #57, #58, #59, #160), with the same safeguards.

import assert from "node:assert/strict";
import { test } from "node:test";
import { setAskHost, type AskAnswer, type AskRequest } from "../ask.ts";
import { englishTable } from "../i18n.ts";
import type { HomeAssistant } from "../types.ts";
import { Fp3dHomesPage, namesHome, rowActions } from "./homes.ts";
import { audienceOf, searchSettings, sectionOf, settingById } from "./registry.ts";
import { sampleBuilding, sampleHass } from "./settings.fixture.ts";

const en = englishTable() as Record<string, string>;
const HOMES = [
  { id: "home", name: "Home", revision: 1, floors: 1, rooms: 3, furniture: 10 },
  { id: "flat", name: "Flat", revision: 1, floors: 1, rooms: 0, furniture: 0 },
];

function backend() {
  const state = { active: "home", sent: [] as Record<string, unknown>[] };
  const hass = {
    language: "en",
    callWS: async (msg: Record<string, unknown> & { type: string }) => {
      state.sent.push(msg);
      if (msg.type === "home_3d/homes/set_active") state.active = msg.home_id as string;
      if (msg.type === "home_3d/homes/create" || msg.type === "home_3d/homes/duplicate") {
        const home = { id: "new", name: msg.name as string, revision: 0, floors: 0, rooms: 0, furniture: 0 };
        return { homes: [...HOMES, home], active: state.active, home };
      }
      return { homes: HOMES, active: state.active };
    },
  } as unknown as HomeAssistant;
  return { hass, state };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const setActive = (sent: Record<string, unknown>[]) => sent.filter((m) => m.type === "home_3d/homes/set_active");

/** The events the page sends to the panel, by type. */
function heard(el: unknown, type: string): unknown[] {
  const got: unknown[] = [];
  (el as EventTarget).addEventListener(type, (e) => got.push((e as CustomEvent).detail));
  return got;
}

/** A page showing `home`, its list loaded; `answers` are what the app's dialog answers, one per question. */
async function page(home: string, answers: AskAnswer[] = []) {
  const { hass, state } = backend();
  const asked: AskRequest[] = [];
  setAskHost({ ask: async (req) => (asked.push(req), answers.shift() ?? { ok: false, value: "" }) });
  const el = new Fp3dHomesPage() as unknown as Record<string, any>;
  el.hass = hass;
  el.home = home;
  el.t = (k: string, v?: Record<string, string>) => Object.entries(v ?? {}).reduce((s, [n, x]) => s.replace(`{${n}}`, String(x)), en[k] ?? k);
  el.willUpdate(new Map());
  await tick();
  return { el, state, asked };
}

test("the Homes page is a This home page in Settings that search finds, for editors (#296)", () => {
  const s = settingById("homes")!;
  assert.equal(audienceOf(sectionOf(s.section)!), "home");
  assert.equal(s.permission, "editor");
  const env = { building: sampleBuilding(), hass: sampleHass(), prefs: { get: () => null, set: () => undefined } };
  for (const q of ["homes", "rename", "duplicate", "sample", "displays"]) assert.ok(searchSettings(q, env, (k) => en[k] ?? k).some((r) => r.id === "homes"), q);
  assert.match(en.st_homes_hint!, /Make active/); // "Show on displays" became "Make active" (#263)
});

test("each home's buttons: Open while another home is shown, Show on displays while not active, Delete with two homes (#58, #160)", () => {
  assert.deepEqual(rowActions(HOMES[0]!, HOMES, "home", "home"), ["rename", "duplicate", "delete"]);
  assert.deepEqual(rowActions(HOMES[1]!, HOMES, "home", "home"), ["open", "show", "rename", "duplicate", "delete"]);
  assert.deepEqual(rowActions(HOMES[0]!, HOMES.slice(0, 1), "home", "home"), ["rename", "duplicate"]);
});

test("opening a home shows it in this view only; the active one is followed again (#58)", async () => {
  const { el, state } = await page("home");
  const opened = heard(el, "home-open");
  await el.act("open", HOMES[1]);
  el.home = "flat";
  await el.act("open", HOMES[0]);
  setAskHost(null);
  assert.equal(setActive(state.sent).length, 0);
  assert.deepEqual(opened, [{ home: "flat" }, { home: null }]);
});

test("'Show on displays' makes the home active without asking, and this view follows it when it shows that home (#58)", async () => {
  const { el, state } = await page("flat");
  const opened = heard(el, "home-open");
  setAskHost({ ask: async () => assert.fail("no confirmation") });
  await el.act("show", HOMES[1]);
  setAskHost(null);
  assert.equal(state.active, "flat");
  assert.deepEqual(opened, [{ home: null }]);
});

for (const action of ["new", "duplicate"]) {
  test(`a ${action === "new" ? "new" : "duplicated"} home stays off the displays and opens in this view only (#58, #59)`, async () => {
    const { el, state, asked } = await page("home", [{ ok: true, value: " Experiment " }]);
    const opened = heard(el, "home-open");
    try {
      if (action === "new") await el.create();
      else await el.act("duplicate", HOMES[0]);
    } finally {
      setAskHost(null);
    }
    assert.equal(asked.length, 1);
    assert.equal(state.active, "home");
    assert.equal(setActive(state.sent).length, 0);
    assert.equal(state.sent.at(-1)!.name, "Experiment");
    assert.deepEqual(opened, [{ home: "new" }]);
  });
}

test("cancelling the name dialog creates nothing (#59)", async () => {
  const { el, state } = await page("home", [{ ok: false, value: "typed" }]);
  const before = state.sent.length;
  await el.create();
  setAskHost(null);
  assert.equal(state.sent.length, before);
});

test("deleting a home asks in a warning dialog for the home's name and deletes only when it is typed (#59, #160)", async () => {
  const { el, state, asked } = await page("home", [
    { ok: false, value: "Home" },
    { ok: true, value: "" },
    { ok: true, value: "Flat" },
    { ok: true, value: " home " },
  ]);
  const deletes = () => state.sent.filter((m) => m.type === "home_3d/homes/delete");
  const opened = heard(el, "home-open");
  try {
    await el.act("delete", HOMES[0]);
    assert.deepEqual(deletes(), [], "cancel deletes nothing, even with the name typed");
    await el.act("delete", HOMES[0]);
    assert.deepEqual(deletes(), [], "a plain OK is not enough");
    await el.act("delete", HOMES[0]);
    assert.deepEqual(deletes(), [], "another home's name is not this one's");
    assert.match(asked[2]!.mismatch ?? "", /not the home's name/, "the dialog itself carries the error it shows under the field (#330)");
    assert.equal(asked[2]!.matches?.("Flat"), false);
    assert.equal(asked[2]!.matches?.(" HOME "), true, "Delete enables once the name matches, case and spaces aside");
    await el.act("delete", HOMES[0]);
    assert.equal(asked[3]!.danger, true);
    assert.equal(asked[3]!.input, "", "the field starts empty, the name is typed, not offered");
    assert.deepEqual(deletes(), [{ type: "home_3d/homes/delete", home_id: "home" }]);
    assert.deepEqual(opened, [{ home: null }], "the home shown is gone: the view follows the active one");
  } finally {
    setAskHost(null);
  }
  assert.ok(namesHome(" FLAT ", "flat"));
});
