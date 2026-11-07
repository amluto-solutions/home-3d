// The editor's '?' help (#95): an overlay with the keyboard shortcuts and a legend of the plan's marks, including
// the orange dashed door swings, which are drawn only for the selected opening.

import assert from "node:assert/strict";
import { test } from "node:test";
import { LEGEND, SHORTCUTS } from "../help.ts";
import { translate } from "../i18n.ts";
import type { HomeAssistant } from "../types.ts";

for (const name of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${name}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
// the key handler's text-field guard looks for these DOM classes
for (const name of ["HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement"]) (globalThis as Record<string, unknown>)[name] ??= class {};
const { Fp3dEditor } = await import("./editor.ts");

const hass = { language: "en", user: { is_admin: true }, states: {}, areas: {} } as unknown as HomeAssistant;

/** Everything a lit template would print: its static text and every value, nested templates included. */
function text(v: unknown): string {
  if (v == null || typeof v === "boolean" || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(text).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? text(t.values[i]) : "")).join("");
  }
  return typeof v === "object" ? "" : String(v);
}

// a room 4 x 3 m with two doors on its first wall
const building = () => ({
  version: 1,
  settings: { roof: {}, grid: 0.1 },
  floors: [
    {
      id: "f",
      name: "Ground",
      elevation: 0,
      height: 2.5,
      rooms: [{ id: "r", name: "Hall", points: [[0, 0], [4, 0], [4, 3], [0, 3]] }],
      walls: [],
      openings: [
        { id: "d1", type: "door", room_id: "r", edge: 0, offset: 1, width: 0.8, height: 2, sill: 0 },
        { id: "d2", type: "door", room_id: "r", edge: 0, offset: 3, width: 0.8, height: 2, sill: 0 },
      ],
      placements: [],
      furniture: [],
      outdoor: [],
    },
  ],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function editor(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = new Fp3dEditor() as any;
  el.hass = hass;
  el._doc = building();
  el._floorId = "f";
  // shown on the page (the key handler ignores a hidden editor tab)
  Object.defineProperty(el, "isConnected", { value: true });
  Object.defineProperty(el, "offsetParent", { value: {} });
  return el;
}

const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
  ({ key: k, shiftKey: k === "?", ctrlKey: false, metaKey: false, altKey: false, composedPath: () => [], preventDefault() {}, ...extra }) as unknown as KeyboardEvent;

test("'?' opens the help overlay and closes it again; Esc closes it before anything else (#95)", () => {
  const el = editor();
  el._roomId = "r";
  el.onKey(key("?"));
  assert.equal(el._help, true);
  el.onKey(key("?"));
  assert.equal(el._help, false);
  el.onKey(key("?"));
  el.onKey(key("Escape"));
  assert.equal(el._help, false);
  assert.equal(el._roomId, "r", "the first Esc only closes the help, the selection stays");
});

test("while the help is open, Delete and the other editing keys do nothing (#95)", async () => {
  const el = editor();
  el._roomId = "r";
  el.onKey(key("?"));
  el.onKey(key("Delete"));
  await new Promise((r) => setTimeout(r, 10)); // deletes wait for the dialog's answer
  assert.equal(el._doc.floors[0].rooms.length, 1);
});

test("'?' typed into a text field is just a character (#95)", () => {
  const el = editor();
  const input = new (globalThis as unknown as { HTMLInputElement: new () => object }).HTMLInputElement();
  el.onKey(key("?", { composedPath: () => [input] } as Partial<KeyboardEvent>));
  assert.equal(el._help, false);
});

test("the help lists every shortcut of the shortcut table and every legend entry, the door swing among them (#95)", () => {
  const el = editor();
  el._help = true;
  const shown = text(el.renderHelp());
  for (const s of SHORTCUTS) {
    assert.ok(shown.includes(translate(hass, s.text)), `shortcut "${s.text}" is listed`);
    for (const k of s.keys) assert.ok(shown.includes(k), `key ${k} is shown`);
  }
  for (const l of LEGEND) assert.ok(shown.includes(translate(hass, l.text)), `legend "${l.text}" is listed`);
  assert.ok(LEGEND.some((l) => l.mark === "swing"), "the orange dashed door swing is explained");
  assert.ok(SHORTCUTS.some((s) => s.keys.includes("?")), "the help names its own key");
  for (const k of ["Ctrl+C", "Ctrl+V", "Ctrl+A"]) assert.ok(SHORTCUTS.some((s) => s.keys.includes(k)), `copy/paste key ${k} is listed (#74)`);
});

test("a door's dashed swing is drawn only while that door is selected, with a tooltip (#95)", () => {
  const el = editor();
  const swings = () => text(el.renderOpenings(el._doc.floors[0], [])).split("fp3d-open-swing").length - 1;
  assert.equal(swings(), 0, "no swing marks while nothing is selected");
  el._openingId = "d1";
  el._roomId = "r";
  assert.equal(swings(), 1, "only the selected door shows its swing");
  assert.match(text(el.renderOpenings(el._doc.floors[0], [])), /<title>[^<]*swing/i);
});

test("the help tells Alt+click (through a stack) apart from Alt-drag (free move) (#125)", () => {
  const pick = SHORTCUTS.find((s) => s.keys.includes("Alt+click"));
  assert.ok(pick, "Alt+click is listed");
  const en = translate({ ...hass, language: "en" } as HomeAssistant, pick.text);
  assert.match(en, /without moving/);
  assert.match(en, /stack/);
  assert.match(translate(hass, "help_key_snap"), /Alt drags without snapping/);
});
