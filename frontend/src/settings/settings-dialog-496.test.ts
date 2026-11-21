// Settings as one compact dialog (#496, ported from NeonPlan 3D 4.0.0): the topics in five groups on the left, the
// chosen topic on the right, the same size from topic to topic, the card templates with the whole width (their topics
// folded away until "All settings"), the topics as a choice in a narrow window, and its keys.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { englishTable } from "../i18n.ts";
import { liveSections, SECTIONS, TOPIC_GROUPS, type SettingsEnv } from "./registry.ts";
import { sampleBuilding, sampleHass } from "./settings.fixture.ts";

const { SettingsPage } = await import("./settings-page.ts");
const en = englishTable() as Record<string, string>;
const t = (k: string, vars: Record<string, string | number> = {}) => {
  let s = en[k] ?? k;
  for (const [n, v] of Object.entries(vars)) s = s.replace(`{${n}}`, String(v));
  return s;
};
const code = readFileSync(new URL("./settings-page.ts", import.meta.url), "utf8");

function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  if (typeof v === "function") return "";
  return String(v);
}

/** The handlers bound to an attribute whose text ends like `re`, in template order. */
function handlers(v: unknown, re: RegExp, out: ((e?: unknown) => void)[] = []): ((e?: unknown) => void)[] {
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

const env = (): SettingsEnv => ({ building: sampleBuilding(), hass: sampleHass(), prefs: { get: () => null, set: () => undefined }, lastView: null, remote: {} });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function page(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (SettingsPage as any)();
  p.hass = sampleHass();
  p.building = sampleBuilding();
  p.canEdit = true;
  p.t = t;
  p.events = [];
  p.renderRoot = {};
  p.dispatchEvent = (e: CustomEvent) => (p.events.push({ type: e.type, detail: e.detail }), true);
  return p;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function show(p: any, section: string): string {
  p._section = section;
  p.willUpdate(new Map());
  return flat(p.render());
}

test("five groups hold every topic of the menu exactly once, and no hidden one", () => {
  assert.equal(TOPIC_GROUPS.length, 5);
  const listed = TOPIC_GROUPS.flatMap((g) => g.sections);
  assert.equal(new Set(listed).size, listed.length, "a topic in two groups");
  assert.deepEqual(new Set(listed), new Set(SECTIONS.filter((s) => !s.hidden).map((s) => s.id)));
  for (const g of TOPIC_GROUPS) assert.ok(en[g.title], g.title);
  assert.equal(en.st_topics_all, "All settings");
});

test("one dialog: the groups and their topics on the left, in order, the chosen topic on the right", () => {
  const p = page();
  const text = show(p, "scene");
  assert.match(text, /role="dialog"\s+aria-modal="true"\s+aria-label=Settings/);
  const shown = new Set(liveSections(env()).filter((s) => !s.hidden).map((s) => s.id));
  let at = 0;
  for (const g of TOPIC_GROUPS) {
    const i = text.indexOf(`<div class="st-group">${t(g.title)}</div>`, at);
    assert.ok(i >= at, `${g.id} after the group before it`);
    at = i;
    for (const id of g.sections.filter((x) => shown.has(x))) {
      const sec = SECTIONS.find((s) => s.id === id)!;
      const j = text.indexOf(`>${t(sec.title)}</button>`, at);
      assert.ok(j > at, `${id} in ${g.id}`);
      at = j;
    }
  }
  assert.match(text, /aria-current=page @click=>Scene</);
  // the topics carry no symbols (upstream: the groups without icons)
  const nav = text.slice(text.indexOf('<nav class="st-nav"'), text.indexOf("</nav>"));
  assert.equal((nav.match(/<fp3d-line-icon/g) ?? []).length, 1, "only the search box's icon");
});

test("a narrow window shows the topics as a choice with the same groups; choosing one opens it", () => {
  const p = page();
  const text = show(p, "voice");
  const pick = text.slice(text.indexOf('<select class="st-pick"'), text.indexOf("</select>"));
  for (const g of TOPIC_GROUPS) assert.ok(pick.includes(`<optgroup label=${t(g.title)}>`), g.id);
  assert.match(pick, /<option value=voice \?selected=>/);
  assert.match(code, /<option value=\$\{s\.id\} \?selected=\$\{s\.id === this\._section\}>/);
  assert.equal((pick.match(/<option /g) ?? []).length, liveSections(env()).filter((s) => !s.hidden).length);
  const change = handlers(p.render(), /@change=$/).at(0)!;
  change({ target: { value: "backup" } });
  assert.equal(p._section, "backup");
  assert.deepEqual(p.events.at(-1), { type: "settings-nav", detail: { section: "backup", id: null } });
  // under the phone width the list goes, the search box stays and the choice shows
  assert.match(code, /@media \(max-width: \$\{NARROW_PX\}px\) \{[\s\S]*?\.st-pick \{\s*display: block/);
});

test("the dialog keeps its size from topic to topic; only the card templates get a wider and higher one", () => {
  assert.match(code, /\.st \{[^}]*width: min\(1020px, 100%\);\s*height: min\(780px, 100%\);/);
  assert.match(code, /\.st\.st-wide \{\s*width: min\(1800px, 100%\);\s*height: min\(1000px, 100%\);/);
  const p = page();
  for (const sec of ["general", "look", "advanced", "voice"]) assert.doesNotMatch(show(p, sec), /class="st st-wide/, sec);
  assert.match(show(p, "cards"), /class="st st-wide st-folded/);
});

test("card templates: the topics fold away; 'All settings' brings them back, another topic is the usual dialog again", () => {
  const p = page();
  let text = show(p, "cards");
  assert.match(text, /class="st st-wide st-folded/);
  assert.match(text, /class="fp3d-btn st-fold" aria-expanded=false/);
  assert.ok(text.includes(t("st_topics_all")));
  assert.match(text, /<fp3d-card-templates /);
  const fold = () => handlers(p.render(), /@click=$/).find((h) => String(h).includes("_navOpen"))!;
  fold()();
  assert.equal(p._navOpen, true);
  text = flat(p.render());
  assert.match(text, /class="st st-wide\s+"/);
  assert.match(text, /st-fold" aria-expanded=true/);
  fold()();
  assert.equal(p._navOpen, false);
  p._navOpen = true;
  p.open("general");
  assert.equal(p._navOpen, false);
  text = flat(p.render());
  assert.doesNotMatch(text, /st-wide|st-fold/);
  // a search over the card templates shows its hits in the usual dialog
  p._section = "cards";
  p._query = "sun";
  assert.doesNotMatch(flat(p.render()), /class="st st-wide/);
  // too narrow for both: the topics are the choice on top and the fold button goes
  assert.match(code, /@media \(max-width: \$\{WIDE_PX\}px\) \{[\s\S]*?\.st-wide \.st-pick \{\s*display: block;[\s\S]*?\.st-fold \{\s*display: none/);
});

test("keys: Escape closes the dialog for where it was opened from; a box inside keeps its Escape; no key reaches the plan", () => {
  const p = page();
  p.backTo = "editor";
  let stopped = 0;
  let focused = 0;
  const box = { focus: () => focused++ };
  const key = (k: string, from: unknown = box, prevented = false) => ({
    key: k,
    defaultPrevented: prevented,
    currentTarget: box,
    composedPath: () => [from],
    stopPropagation: () => stopped++,
    preventDefault: () => undefined,
  });
  p.dialogKey(key("Delete"));
  assert.equal(stopped, 1, "the editor's Delete behind it never sees the key");
  assert.equal(p.events.length, 0);
  p.dialogKey(key("Escape"));
  assert.deepEqual(p.events.at(-1), { type: "settings-back", detail: { mode: "editor" } });
  p.events.length = 0;
  p.dialogKey(key("Escape", box, true));
  assert.equal(p.events.length, 0, "a part that used Escape keeps it");
  // an entity picker's box: its list closes, the focus comes back to the dialog, the dialog stays
  p.dialogKey(key("Escape", { localName: "input", closest: () => null }));
  assert.equal(p.events.length, 0);
  assert.equal(focused, 1);
  // the search box's own Escape, with nothing typed, closes the dialog
  p.dialogKey(key("Escape", { localName: "input", closest: (q: string) => (q === ".st-search" ? {} : null) }));
  assert.deepEqual(p.events.at(-1), { type: "settings-back", detail: { mode: "editor" } });
  // a tap beside the dialog closes it too (the veil rule of #489)
  assert.match(code, /class="st-veil" @click=\$\{\(e: Event\) => onVeil\(e\) && this\.close\(\)\}/);
  assert.match(code, /\$\{modalFocus\(\)\}/);
});

test("deep links and search still open their row inside the dialog", () => {
  const p = page();
  p.section = "scene";
  p.focusId = "sun_shadow";
  p.willUpdate(new Map([["section", null], ["focusId", null]]));
  assert.equal(p._section, "scene");
  assert.equal(p._flash, "sun_shadow");
  clearTimeout(p.flashTimer);
  p._query = "frame rate";
  const text = flat(p.render());
  assert.match(text, /role="dialog"/);
  assert.match(text, /id="st-hits"/);
});
