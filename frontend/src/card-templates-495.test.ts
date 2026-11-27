// Card templates as a management page (#495): a card set up once in Settings, picked by a tablet or phone and followed
// live; the card form in tabs with "what is the card for"; a preview that switches nothing. Ported from NeonPlan 3D
// 4.0.0 (MIT, Mastershort), with our own tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { cardTemplate, effectiveConfig, renameTemplate, templateId, templateOptions, type CardConfig } from "./card-config.ts";
import type { Building, CardTemplate } from "./model.ts";
import { changesSomething, previewHass } from "./preview-hass.ts";
import type { HomeAssistant } from "./types.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Floorplan3dCardEditor } = (await import("./card-editor.ts")) as unknown as { Floorplan3dCardEditor: { new (): Record<string, any> } }; // eslint-disable-line @typescript-eslint/no-explicit-any
const tpl = await import("./components/card-templates.ts");

function flat(t: unknown): string {
  if (t == null || t === false) return "";
  if (Array.isArray(t)) return t.map(flat).join("");
  if (typeof t === "object" && "strings" in (t as object)) {
    const r = t as { strings: string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(t);
}

const plan = (templates: CardTemplate[]) => ({ floors: [], settings: {}, card_templates: templates }) as unknown as Building;
const hall: CardTemplate = { id: "hall_tablet", name: "Hall tablet", aliases: ["wall_tablet"], config: { theme: "neon", height: 600, room_names: false } };

test("a card with a template takes its options, its own YAML wins, the template's name is its screen name", () => {
  const b = plan([hall]);
  const cfg = effectiveConfig({ type: "custom:home-3d-card", template: "hall_tablet", height: 500 }, b);
  assert.equal(cfg.theme, "neon");
  assert.equal(cfg.room_names, false);
  assert.equal(cfg.height, 500, "the card's own option wins");
  assert.equal(cfg.screen, "Hall tablet");
  assert.equal(cfg.type, "custom:home-3d-card");
  assert.equal(cfg.template, "hall_tablet");
  // an earlier id still finds it; an unknown one keeps the YAML as it is
  assert.equal(cardTemplate(b, " wall_tablet ")?.id, "hall_tablet");
  const yaml: CardConfig = { type: "custom:home-3d-card", template: "gone" };
  assert.equal(effectiveConfig(yaml, b), yaml);
  assert.equal(effectiveConfig(yaml, null), yaml);
});

test("a template never carries a type, a template or a home (the home belongs to the dashboard)", () => {
  const b = plan([{ id: "x", name: "X", config: { home: "other", type: "custom:other", template: "y", theme: "day" } as Partial<CardConfig> }]);
  const cfg = effectiveConfig({ type: "custom:home-3d-card", template: "x" }, b);
  assert.equal(cfg.home, undefined);
  assert.equal(cfg.type, "custom:home-3d-card");
  assert.equal(cfg.template, "x");
  assert.deepEqual(templateOptions({ type: "a", template: "b", home: "c", phone: true }), { phone: true });
});

test("template ids come from the name: plain letters, unique, a fallback for a name without any", () => {
  assert.equal(templateId("Küche Fire 7", []), "kuche_fire_7");
  assert.equal(templateId("Straße", []), "strasse");
  assert.equal(templateId("Hall", ["hall"]), "hall_2");
  assert.equal(templateId("Hall", ["hall", "hall_2"]), "hall_3");
  assert.equal(templateId("✨✨", []), "template");
  assert.ok(templateId("x".repeat(90), []).length <= 40);
});

test("a renamed template's id follows its name; the old id stays as an alias", () => {
  const list: CardTemplate[] = [structuredClone(hall), { id: "kitchen", name: "Kitchen", config: {} }];
  const t = renameTemplate(list, "hall_tablet", "Landing")!;
  assert.equal(t.id, "landing");
  assert.equal(t.name, "Landing");
  assert.deepEqual(t.aliases, ["wall_tablet", "hall_tablet"]);
  // a name another template already has gets its own id; renaming back drops that id from the aliases
  assert.equal(renameTemplate(list, "landing", "Kitchen")!.id, "kitchen_2");
  assert.equal(renameTemplate(list, "kitchen_2", "Hall tablet")!.id, "hall_tablet");
  assert.ok(!list[0].aliases?.includes("hall_tablet"));
  assert.equal(renameTemplate(list, "nope", "X"), undefined);
});

test("the preview calls no service and sends nothing that changes something; reads still go through", async () => {
  const sent: unknown[] = [];
  const services: unknown[] = [];
  const hass = {
    language: "en",
    states: {},
    callService: async (...a: unknown[]) => void services.push(a),
    callWS: async (m: unknown) => (sent.push(m), { ok: true }),
  } as unknown as HomeAssistant;
  const p = previewHass(hass);
  await p.callService("light", "turn_on", { entity_id: "light.sample_lounge" });
  assert.deepEqual(services, []);
  for (const type of ["home_3d/building/save", "home_3d/image/set", "home_3d/history/restore", "home_3d/voice/answer", "call_service", "execute_script", "home_3d/homes/delete"]) {
    assert.equal(await p.callWS({ type }), undefined, type);
  }
  assert.deepEqual(sent, []);
  assert.deepEqual(await p.callWS({ type: "home_3d/building/get" }), { ok: true });
  assert.deepEqual(await p.callWS({ type: "home_3d/packs/list" }), { ok: true });
  assert.equal(sent.length, 2);
  assert.equal(p.states, hass.states, "the same states");
  assert.equal(changesSomething({ type: "home_3d/version" }), false);
  assert.equal(changesSomething(null), false);
});

test("the card saves nothing from a preview and shows a note for a template its plan lacks", () => {
  const card = readFileSync(new URL("./card.ts", import.meta.url), "utf8");
  assert.match(card, /if \(this\.preview\) return;\n\s*this\.data\.update/);
  assert.match(card, /card_template_missing/);
  // a template changed in Settings is applied again when the plan comes (no reload)
  assert.match(card, /const key = this\.templateKey\(\);\n\s*if \(key !== this\.appliedTemplate\)/);
});

test("preview options: the template's own at the screen's size, a phone always on a phone, nothing that acts outside", () => {
  const phone: CardTemplate = { id: "p", name: "P", config: { phone: true, fill: true, voice: true } };
  assert.equal(tpl.screenOf(phone, "tablet"), "phone");
  assert.equal(tpl.screenOf(hall, "upright"), "upright");
  const c = tpl.previewConfig(phone, "phone", "home2");
  assert.equal(c.type, "custom:home-3d-card");
  assert.equal(c.home, "home2");
  assert.equal(c.height, tpl.SCREENS.phone.h - 56);
  assert.equal(c.fill, false);
  assert.equal(c.voice, false, "the preview does not listen");
  assert.equal(c.phone, true);
  assert.equal(tpl.previewHeight(hall, "tablet"), 600);
  assert.equal(tpl.previewHeight({ ...hall, config: { height: 5000 } }, "small"), 600 - 56);
  assert.equal(tpl.previewConfig(hall, "tablet", null).home, undefined);
});

test("new templates: for a screen empty, for a phone filling the screen, a copy with its own id", () => {
  const list = [hall];
  assert.deepEqual(tpl.newTemplate(list, "Wall tablet"), { id: "wall_tablet_2", name: "Wall tablet", config: {} }, "the old alias is taken");
  assert.deepEqual(tpl.newTemplate(list, "Phone", undefined, true).config, { phone: true, fill: true });
  const copy = tpl.newTemplate(list, "Hall tablet (copy)", hall);
  assert.equal(copy.id, "hall_tablet_copy");
  assert.deepEqual(copy.config, hall.config);
  assert.notEqual(copy.config, hall.config, "a copy, not the same object");
  assert.equal(tpl.templateYaml(hall, null), "type: custom:home-3d-card\ntemplate: hall_tablet");
  assert.equal(tpl.templateYaml(hall, "h2"), "type: custom:home-3d-card\nhome: h2\ntemplate: hall_tablet");
});

const editor = (config: CardConfig, embedded: boolean) => {
  const el = new Floorplan3dCardEditor();
  el.hass = { language: "en", states: {} };
  el._config = config;
  el._floors = [];
  el._styles = [];
  el._hasMap = false;
  el.embedded = embedded;
  return el;
};

test("inside Settings the form stands in tabs; on a dashboard it stays one page", () => {
  const inSettings = flat(editor({ type: "custom:home-3d-card" }, true).render());
  assert.match(inSettings, /role="tablist"/);
  for (const t of ["General", "View", "Show", "Features", "Wall tablet (kiosk)"]) assert.ok(inSettings.includes(`>${t}</button>`), t);
  const dashboard = flat(editor({ type: "custom:home-3d-card" }, false).render());
  assert.doesNotMatch(dashboard, /role="tablist"/);
  assert.match(dashboard, /What is the card for\?/);
  assert.match(dashboard, /Wall tablet \(kiosk\)/);
});

test("the form asks what the card is for; a phone gets the bar's options, and options that do not apply make way", () => {
  const large = flat(editor({ type: "custom:home-3d-card" }, true).render());
  assert.match(large, /Tablet or large screen/);
  assert.doesNotMatch(large, /The bar on the phone/);
  assert.match(large, /Floor switcher/);
  assert.match(large, /Switches in the card/);
  const el = editor({ type: "custom:home-3d-card", phone: true, fill: true }, true);
  const phone = flat(el.render());
  assert.match(phone, /The bar on the phone/);
  assert.ok(!phone.includes(">Wall tablet (kiosk)</button>"), "no kiosk tab for a phone");
  assert.doesNotMatch(phone, /Switches in the card/);
  assert.doesNotMatch(phone, /Floor switcher/);
  // picking "phone" fills the screen
  const sent: CardConfig[] = [];
  const pick = editor({ type: "custom:home-3d-card" }, true);
  pick.dispatchEvent = (e: CustomEvent) => (sent.push(e.detail.config), true);
  pick.emit({ ...pick._config, phone: true, fill: true });
  assert.deepEqual(sent.at(-1), { type: "custom:home-3d-card", phone: true, fill: true });
});

test("on a dashboard a card picks a template and the form folds away; picking keeps only the home", () => {
  const el = editor({ type: "custom:home-3d-card", home: "h2", theme: "day" }, false);
  el._templates = [hall];
  const sent: CardConfig[] = [];
  el.dispatchEvent = (e: CustomEvent) => (sent.push(e.detail.config), true);
  assert.match(flat(el.render()), /None: set up this card here/);
  el.pickTemplate("hall_tablet");
  assert.deepEqual(sent.at(-1), { type: "custom:home-3d-card", home: "h2", template: "hall_tablet" });
  const folded = flat(el.render());
  assert.match(folded, /takes its options from the template/);
  assert.doesNotMatch(folded, /What is the card for\?/, "the form folds away");
  // own options written beside the template are named, and can go
  el._config = { type: "custom:home-3d-card", template: "wall_tablet", height: 300 };
  const own = flat(el.render());
  assert.match(own, /win over the template's: height/);
  assert.match(own, /value="hall_tablet" selected|selected/);
  el.pickTemplate(undefined);
  assert.deepEqual(sent.at(-1), { type: "custom:home-3d-card" });
});

test("inside Settings the form takes the plan it is handed and fetches nothing", () => {
  const el = editor({ type: "custom:home-3d-card" }, true);
  let asked = 0;
  el.hass = { language: "en", states: {}, callWS: async () => (asked++, {}) };
  el.building = { floors: [{ id: "f1", name: "Ground" }], settings: { surroundings: { on: true } }, card_templates: [hall] };
  el.willUpdate();
  assert.equal(asked, 0);
  assert.deepEqual(el._floors, [{ id: "f1", name: "Ground" }]);
  assert.equal(el._hasMap, true);
});

test("the page is its own element in a chunk of Settings, sending changes as the other Settings cards do", () => {
  const page = readFileSync(new URL("./settings/settings-page.ts", import.meta.url), "utf8");
  assert.match(page, /import\("\.\.\/components\/card-templates\.ts"\)/);
  assert.match(page, /<fp3d-card-templates /);
  const src = readFileSync(new URL("./components/card-templates.ts", import.meta.url), "utf8");
  assert.match(src, /new CustomEvent\("settings-edit"/);
  assert.match(src, /previewHass\(this\.hass\)/);
  assert.match(src, /preview = true/);
  assert.doesNotMatch(src, /\.callService\(/);
});
