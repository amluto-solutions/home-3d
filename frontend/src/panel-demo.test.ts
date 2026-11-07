// The panel shows a demo home with demo states (#100): built in plain Node, its lit templates searched.
import assert from "node:assert/strict";
import { test } from "node:test";
import { demoHome } from "./demo-home.fixture.ts";
import type { Building } from "./model.ts";
import type { HomeAssistant } from "./types.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener: () => undefined, removeEventListener: () => undefined });
g.location ??= { search: "" };

const { Floorplan3dPanel } = await import("./panel.ts");

/** The Home Assistant objects bound as `.hass` on the given element tags (nested templates and lists included). */
function hassOn(v: unknown, tags: string[], out: HomeAssistant[] = []): HomeAssistant[] {
  if (Array.isArray(v)) v.forEach((x) => hassOn(x, tags, out));
  else if (v && typeof v === "object" && "strings" in v && "values" in v) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    let text = "";
    r.values.forEach((value, i) => {
      text += r.strings[i];
      const tag = /<([a-z0-9-]+)[^<]*$/.exec(text)?.[1];
      if (text.endsWith(".hass=") && tag && tags.includes(tag)) out.push(value as HomeAssistant);
      else hassOn(value, tags, out);
    });
  }
  return out;
}
const VIEWS = ["fp3d-view3d", "fp3d-room-panel"];

/** The text of a lit template. */
function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol" || typeof v === "boolean" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return typeof v === "object" ? "" : String(v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function panel(b: Building): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (Floorplan3dPanel as any)();
  p.hass = { language: "en", user: { id: "admin", is_admin: true, name: "x" }, states: {}, themes: { darkMode: true }, callService: async () => undefined, callWS: async () => undefined };
  p.data.building = b;
  p.data.canEdit = true;
  p.data.homeName = "Sample Home";
  p.data.homeId = "h1";
  p.willUpdate(new Map());
  return p;
}

test("the house view of a demo home gets the demo states and says it shows demo devices (#100)", () => {
  const p = panel(demoHome());
  const tpl = p.render();
  const bound = hassOn(tpl, VIEWS);
  assert.ok(bound.length > 0);
  assert.ok(bound.every((h) => h.states["light.sample_lounge"]?.state === "on"));
  assert.match(flat(tpl), /fp3d-demo-chip/);
});

test("an ordinary home's view gets the live Home Assistant and no demo chip (#100)", () => {
  const p = panel(demoHome(false));
  const tpl = p.render();
  const bound = hassOn(tpl, VIEWS);
  assert.ok(bound.length > 0);
  assert.ok(bound.every((h) => h === p.hass));
  assert.doesNotMatch(flat(tpl), /fp3d-demo-chip/);
});
