// The View panel element (#247): a non-modal dialog, its sections from view-settings.ts, its rows written where the
// Settings page writes them, a radio group for each segmented choice, and the read-only quality line with the ways on
// to Settings.
import assert from "node:assert/strict";
import { test } from "node:test";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
const store = new Map<string, string>();
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };

const { Fp3dViewPanel } = await import("./view-panel.ts");
const { viewSetting, viewSections } = await import("../settings/view-settings.ts");

/** A template as text, with each function value as <fn>. */
function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol") return "";
  if (typeof v === "function") return "<fn>";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(v);
}

/** The click handlers in a template whose static text just before them matches `re`. */
function handlers(v: unknown, re: RegExp, out: (() => void)[] = []): (() => void)[] {
  if (Array.isArray(v)) v.forEach((x) => handlers(x, re, out));
  else if (v && typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    r.values.forEach((x, i) => {
      if (typeof x === "function" && re.test(r.strings[i])) out.push(x as () => void);
      handlers(x, re, out);
    });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function viewPanel(o: Record<string, unknown> = {}): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = new Fp3dViewPanel() as any;
  el.hass = { language: "en", states: {}, themes: { darkMode: true } };
  el.context = { floors: 2, floorOpen: false, roof: true, plan2d: false, kiosk: false, ...o };
  const events: { type: string; detail: unknown }[] = [];
  el.dispatchEvent = (e: CustomEvent) => (events.push({ type: e.type, detail: e.detail }), true);
  el.events = events;
  return el;
}

test("a non-modal dialog named View, saying who it is saved for (#247)", () => {
  store.clear();
  const out = flat(viewPanel().render());
  assert.match(out, /role="dialog" aria-modal="false" aria-labelledby="vp-title"/);
  assert.match(out, /<h2 id="vp-title">View<\/h2>/);
  assert.ok(out.includes("Saved for this device"));
});

test("wide screens: Appearance, What the 3D shows, Device icons and Clock, then the footer", () => {
  store.clear();
  const out = flat(viewPanel().render());
  const order = ["Appearance", "What the 3D view shows", "Device icons", "Clock", "Quality: Auto", "More view settings ›", "Sun, window light and warnings are home settings"];
  let at = 0;
  for (const text of order) {
    const i = out.indexOf(text, at);
    assert.ok(i >= at, `${text} after the one before`);
    at = i;
  }
  assert.ok(out.includes(`<optgroup label=Automatic>`) && out.includes(`<optgroup label=Neon and classic>`));
  assert.ok(out.includes("Follow Home Assistant (now Neon)"));
  assert.ok(out.includes("Important: devices with no 3D model"));
  for (const label of ["Show room climate as", "Keep the roof on when zooming in", "Motion trail (last 30 minutes)", "Weather outside", "Display what", "11 object types selected"]) assert.ok(out.includes(label), label);
});

test("a change is written under the setting's own key and the panel is told; the panel stays open", () => {
  store.clear();
  const el = viewPanel();
  el.write(viewSetting("walls"), "cut");
  el.write(viewSetting("markers"), "all");
  el.write(viewSetting("theme"), "auto");
  assert.equal(store.get("home3d.walls"), "cut");
  assert.equal(store.get("home3d.markers"), "all");
  assert.equal(store.get("home3d.theme"), "auto");
  assert.deepEqual(
    el.events.map((e: { type: string }) => e.type),
    ["view-change", "view-change", "view-change"],
  );
  assert.ok(!el.events.some((e: { type: string }) => e.type === "view-close"));
  // the accent's reset removes the key (back to the default)
  el.write(viewSetting("accent"), "#ff7a59");
  assert.equal(store.get("home3d.accent"), "#ff7a59");
  el.write(viewSetting("accent"), null);
  assert.equal(store.has("home3d.accent"), false);
});

test("segmented choices are radio groups with a tick on the chosen one; the arrow keys move the choice", () => {
  store.clear();
  const el = viewPanel();
  const tpl = el.renderSegment(viewSetting("walls"), "Walls", false);
  const out = flat(tpl);
  assert.match(out, /role="radiogroup" aria-label=Walls/);
  assert.match(out, /role="radio" aria-checked=true tabindex=0/);
  assert.match(out, /role="radio" aria-checked=false tabindex=-1/);
  assert.ok(out.includes(`class="vp-tick"`));
  const onKey = (tpl.values as unknown[]).find((v) => typeof v === "function") as (e: unknown) => void;
  onKey({ key: "ArrowRight", preventDefault: () => undefined });
  assert.equal(store.get("home3d.walls"), "cut");
});

test("the footer: Quality is read-only and opens Appearance; the links open Settings (#246, #247, #248)", () => {
  store.clear();
  store.set("home3d.quality", "low");
  const el = viewPanel();
  const foot = el.renderFooter();
  assert.ok(flat(foot).includes("Quality: Tablet"));
  for (const h of handlers(foot, /@click=$/)) h();
  assert.deepEqual(
    el.events.filter((e: { type: string }) => e.type === "open-settings").map((e: { detail: unknown }) => e.detail),
    [
      { section: "look", id: "quality" },
      { section: "view3d", id: null },
      { section: "scene", id: null },
    ],
  );
});

test("the X in the header tells the panel to close (it owns the open state) (#265)", () => {
  store.clear();
  const el = viewPanel();
  const tpl = el.render();
  assert.match(flat(tpl), /class="vp-close" title=Close aria-label=Close @click=<fn>>✕</);
  handlers(tpl, /@click=$/)[0]!();
  assert.deepEqual(
    el.events.map((e: { type: string }) => e.type),
    ["view-close"],
  );
});

test("a press outside the panel closes it, a press inside or on the View button does not (#265)", () => {
  store.clear();
  const el = viewPanel();
  const press = (path: unknown[]) => el.onOutside({ composedPath: () => path });
  press([el]);
  assert.equal(el.events.length, 0, "inside");
  press([{ classList: { contains: (c: string) => c === "fp3d-view-btn" } }]);
  assert.equal(el.events.length, 0, "on the View button");
  press([{ classList: { contains: () => false } }, {}]);
  assert.deepEqual(el.events.map((e: { type: string; detail: unknown }) => [e.type, e.detail]), [["view-close", { outside: true }]]);
});

test("a wall tablet gets What the 3D shows only, no footer (#92)", () => {
  store.clear();
  const out = flat(viewPanel({ kiosk: true }).render());
  assert.ok(out.includes("What the 3D view shows"));
  for (const text of ["Device icons", "Quality:", "More view settings", "<optgroup"]) assert.ok(!out.includes(text), text);
});

test("phones: a bottom sheet whose Appearance and Device icons start open, the rest folded with a summary", () => {
  store.clear();
  const el = viewPanel();
  el._phone = true;
  const out = flat(el.render());
  assert.match(out, /<details class="vp-sec vp-look" \?open=true>/);
  assert.match(out, /<details class="vp-sec vp-markers" \?open=true>/);
  assert.match(out, /<details class="vp-sec vp-show" \?open=false>/);
  assert.match(out, /<details class="vp-sec vp-clock" \?open=false>/);
  // What the 3D shows sums up its rows: the walls, and the switches that are on
  assert.ok(out.includes("Tall walls · Weather outside"));
});

test("the sheet respects reduced motion, keeps the safe area, and every control is 44 px on touch", () => {
  const css = (Fp3dViewPanel as unknown as { styles: { cssText: string }[] }).styles.map((s) => s.cssText).join("\n");
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{\s*\.vp\s*\{\s*animation: none;/);
  assert.match(css, /env\(safe-area-inset-bottom, 0px\), 16px/);
});

test("Display what has no search field (#306), and the Furniture switch is gone: its Furniture option does the hiding (#269, #306)", async () => {
  store.clear();
  const { itemHidden, parseHidden } = await import("../object-types.ts");
  const el = viewPanel();
  const shownBy = viewSetting("display")!;
  const out = flat(el.renderDisplay(shownBy, (shownBy.control as { options: { value: string; label: string }[] }).options, "Display what"));
  assert.match(out, /\.noSearch=true/);
  const rowIds = viewSections({ floors: 2, floorOpen: false, roof: true, plan2d: false, kiosk: false }).flatMap((s) => s.rows.map((r) => r.id));
  assert.ok(!rowIds.includes("furniture"), "no Furniture switch in the View panel");
  // the Display what Furniture option hides plain furniture; the lamp stays
  const sofa = { id: "s", type: "sofa", x: 0, z: 0, w: 2, d: 1, h: 1, rotation: 0, variant: null, entity: null } as any;
  const lamp = { id: "l", type: "lamp_ceiling", x: 0, z: 0, w: 1, d: 1, h: 1, rotation: 0, variant: null, entity: null } as any;
  const env = { prefs: { get: (k: string) => store.get(`home3d.${k}`) ?? null, set: (k: string, v: string | null) => (v === null ? store.delete(`home3d.${k}`) : store.set(`home3d.${k}`, v)) } } as any;
  const display = viewSetting("display")!;
  display.write!(env, ["room_names", "lights", "media", "cameras", "sensors", "climate", "covers", "plugs", "decor", "outdoor", "energy"]);
  assert.equal(store.get("home3d.display_hidden"), "furniture");
  const hidden = parseHidden(store.get("home3d.display_hidden") ?? null);
  assert.equal(itemHidden(sofa, hidden, true), true, "furniture unticked: hidden");
  assert.equal(itemHidden(lamp, hidden, true), false, "a lamp is not furniture");
  // an old Furniture switch set to off still applies until the list is written (no setting is lost)
  store.clear();
  store.set("home3d.show_furniture", "0");
  const legacy = display.read!(env) as string[];
  assert.ok(!legacy.includes("furniture") && !legacy.includes("decor"), "read as the Display what values");
  assert.equal(itemHidden(sofa, parseHidden(null, null, "0"), true), true);
  // the switch is never written again
  assert.equal(store.get("home3d.show_furniture"), "0");
});

test("Navigation buttons: a View switch, off by default, kept on this device (#307)", () => {
  store.clear();
  const s = viewSetting("nav")!;
  assert.equal(s.default, false);
  assert.ok(viewSections({ floors: 1, floorOpen: false, roof: false, plan2d: false, kiosk: false }).some((sec) => sec.rows.some((r) => r.id === "nav")));
  const out = flat(viewPanel().render());
  assert.ok(out.includes("Navigation buttons"));
  assert.equal(store.get("home3d.nav"), undefined);
  s.write!({ building: null, hass: undefined, prefs: { get: (k: string) => store.get(`home3d.${k}`) ?? null, set: (k: string, v: string | null) => void (v === null ? store.delete(`home3d.${k}`) : store.set(`home3d.${k}`, v)) } } as never, true as never);
  assert.equal(store.get("home3d.nav"), "1");
});

test("Power flow and Holograms: View switches on this device, flows off and holograms on by default, under the old keys (#315)", () => {
  store.clear();
  const ctx = { floors: 1, floorOpen: false, roof: false, plan2d: false, kiosk: false };
  for (const kiosk of [false, true]) {
    const ids = viewSections({ ...ctx, kiosk }).flatMap((sec) => sec.rows.map((r) => r.id));
    assert.ok(ids.includes("flows") && ids.includes("holos"), `kiosk ${kiosk}`);
  }
  const env = { building: null, hass: undefined, prefs: { get: (k: string) => store.get(`home3d.${k}`) ?? null, set: (k: string, v: string | null) => void (v === null ? store.delete(`home3d.${k}`) : store.set(`home3d.${k}`, v)) } } as never;
  const flows = viewSetting("flows")!;
  const holos = viewSetting("holos")!;
  assert.equal(flows.read(env), false);
  assert.equal(holos.read(env), true);
  flows.write!(env, true as never);
  holos.write!(env, false as never);
  assert.equal(store.get("home3d.flows"), "1", "the key the energy row's own button used");
  assert.equal(store.get("home3d.holos"), "0");
  const out = flat(viewPanel().render());
  assert.ok(out.includes("Power flow") && out.includes("Holograms"));
});

test("Sun path height: a device choice, over the roof by default, on the Settings page (#319)", () => {
  store.clear();
  const s = viewSetting("sun_height")!;
  assert.ok(s, "a Settings row");
  const env = { building: null, hass: undefined, prefs: { get: (k: string) => store.get(`home3d.${k}`) ?? null, set: (k: string, v: string | null) => void (v === null ? store.delete(`home3d.${k}`) : store.set(`home3d.${k}`, v)) } } as never;
  assert.equal(s.default, "auto");
  assert.equal(s.read(env), "auto");
  s.write!(env, "real" as never);
  assert.equal(store.get("home3d.sun_height"), "real");
  store.set("home3d.sun_height", "junk");
  assert.equal(s.read(env), "auto", "anything else reads as the default");
});
