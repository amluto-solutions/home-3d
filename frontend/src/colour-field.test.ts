// The shared colour field (#403): every colour in the editor and Settings has a hex value to read, type, paste and
// copy. Typed or pasted "#rgb", "#rrggbb", "rrggbb" and "rgb(…)" set the colour; anything else shows an error and keeps
// the colour; one change is one undo step, from the swatch or the text alike.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "./model.ts";
import { setPacks, type FurniturePack } from "./packs.ts";
import { parseColour } from "./colour-text.ts";
import { ColourField } from "./components/colour-field.ts";
import { makeEditor, square } from "./components/editor-harness.ts";
import { englishTable } from "./i18n.ts";

test("a typed colour: #rgb, #rrggbb, rrggbb and rgb(r, g, b), any case and spacing, as lower-case #rrggbb", () => {
  assert.equal(parseColour("#1E6EBC"), "#1e6ebc");
  assert.equal(parseColour("1e6ebc"), "#1e6ebc");
  assert.equal(parseColour("  #f80 "), "#ff8800");
  assert.equal(parseColour("f80"), "#ff8800");
  assert.equal(parseColour("rgb(30, 110, 188)"), "#1e6ebc");
  assert.equal(parseColour("RGB(30,110,188)"), "#1e6ebc");
  assert.equal(parseColour("rgb(30 110 188)"), "#1e6ebc");
  assert.equal(parseColour("rgba(255, 0, 0, 0.5)"), "#ff0000", "the alpha is dropped");
  assert.equal(parseColour("rgb(0,0,0)"), "#000000");
});

test("anything else is no colour", () => {
  for (const bad of ["", "red", "#12345", "#1234567", "12", "#ggg", "rgb(256, 0, 0)", "rgb(1, 2)", "rgb(1,2,3", "hsl(10, 50%, 50%)", "#1e6ebc;"]) assert.equal(parseColour(bad), null, bad);
});

test("the field's texts come from the host's table and name the colour", () => {
  const table = englishTable() as Record<string, string>;
  const hosted = field("#1e6ebc", { t: (k, v) => table[k]!.replace("{label}", v.label) });
  for (const k of ["colour_hex_of", "colour_copy_of", "colour_copied", "colour_invalid"] as const) assert.ok(table[k], k);
  assert.equal(hosted.text("colour_hex_of"), "Paint: hex value");
  assert.equal(hosted.text("colour_copy_of"), "Copy the hex value of Paint");
});

type Sent = { type: string; value: string | null };

function field(value: string | null, extra: Partial<ColourField> = {}): ColourField & { sent: Sent[] } {
  const f = new ColourField() as ColourField & { sent: Sent[] };
  Object.assign(f, { value, label: "Paint", ...extra });
  f.sent = [];
  f.dispatchEvent = (e: Event) => (f.sent.push({ type: e.type, value: (e as CustomEvent).detail.value }), true);
  return f;
}
const changes = (f: { sent: Sent[] }) => f.sent.filter((s) => s.type === "colour-change").map((s) => s.value);

test("a typed or pasted colour is entered once; the same colour sends nothing", () => {
  const f = field("#1e6ebc");
  assert.equal(f.hex, "#1e6ebc");
  assert.equal(f.commit("rgb(255, 136, 0)"), true);
  assert.deepEqual(changes(f), ["#ff8800"]);
  assert.equal(f.hex, "#ff8800", "the field shows the new colour at once");
  assert.equal(f.commit("#FF8800"), true);
  assert.deepEqual(changes(f), ["#ff8800"], "the same colour again: no change");
  assert.deepEqual(f.sent.map((s) => s.type), ["colour-input", "colour-change"], "every change reaches both listeners");
});

test("a value that is no colour shows the error and keeps the colour", () => {
  const f = field("#1e6ebc");
  assert.equal(f.commit("banana"), false);
  assert.equal(f.invalid, true);
  assert.equal(f.draft, "banana", "what was typed stays to be corrected");
  assert.equal(f.hex, "#1e6ebc");
  assert.deepEqual(f.sent, []);
  // a good value clears the error
  f.commit("#abc");
  assert.equal(f.invalid, false);
  assert.deepEqual(changes(f), ["#aabbcc"]);
});

test("emptying the hex field clears a clearable colour and leaves any other as it is", () => {
  const roles = field("#1e6ebc", { clearable: true });
  roles.commit("  ");
  assert.deepEqual(changes(roles), [null]);
  const bin = field("#1e6ebc");
  assert.equal(bin.commit(""), true);
  assert.deepEqual(bin.sent, []);
  assert.equal(bin.hex, "#1e6ebc");
});

test("the swatch: dragging in the picker previews, closing it is one change", () => {
  const f = field(null) as unknown as { onSwatch(e: Event, done: boolean): void; sent: Sent[]; hex: string };
  const at = (value: string) => ({ target: { value } }) as unknown as Event;
  f.onSwatch(at("#102030"), false);
  f.onSwatch(at("#405060"), false);
  assert.deepEqual(changes(f), [], "no change while the picker is open");
  assert.equal(f.sent.length, 2, "but two previews");
  f.onSwatch(at("#405060"), true);
  assert.deepEqual(changes(f), ["#405060"]);
  assert.equal(f.hex, "#405060");
});

test("a pasted colour is taken at once; other pasted text waits to be entered", () => {
  const f = field("#000000") as unknown as { onPaste(e: ClipboardEvent): void; sent: Sent[] };
  let prevented = 0;
  const paste = (text: string) => ({ clipboardData: { getData: () => text }, preventDefault: () => prevented++ }) as unknown as ClipboardEvent;
  f.onPaste(paste("#C0392B"));
  assert.deepEqual(changes(f), ["#c0392b"]);
  assert.equal(prevented, 1);
  f.onPaste(paste("not a colour"));
  assert.equal(prevented, 1, "pasted as usual");
  assert.deepEqual(changes(f), ["#c0392b"]);
});

test("a new value from outside (an undo, another item) replaces the typed text and its error", () => {
  const f = field("#000000") as unknown as ColourField & { willUpdate(c: Map<string, unknown>): void };
  f.commit("nope");
  f.value = "#ffffff";
  f.willUpdate(new Map([["value", "#000000"]]));
  assert.equal(f.draft, null);
  assert.equal(f.invalid, false);
});

test("the field has a name for the swatch, the hex value and the copy button, and says what is wrong", () => {
  const table = englishTable() as Record<string, string>;
  const f = field("#1e6ebc", { t: (k, v) => table[k]!.replace("{label}", v.label) }) as unknown as { render(): unknown; commit(t: string): boolean };
  const text = flat(f.render());
  assert.match(text, /aria-label=Paint\s/);
  assert.match(text, /aria-label=Paint: hex value\s/);
  assert.match(text, /aria-label=Copy the hex value of Paint\s/);
  assert.doesNotMatch(text, /role="alert"/);
  f.commit("zz");
  assert.match(flat(f.render()), /role="alert"/);
});

const flat = (v: unknown): string => {
  if (v == null || typeof v === "boolean" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  const t = v as { strings?: readonly string[]; values?: unknown[] };
  if (typeof v === "object") return t.strings ? t.strings.map((s, i) => s + (i < t.values!.length ? flat(t.values![i]) : "")).join("") : "";
  return String(v);
};

/** The handler a template binds to `@colour-change` on its first colour field. */
function onColourChange(v: unknown): ((e: Event) => void) | null {
  if (Array.isArray(v)) {
    for (const x of v) {
      const h = onColourChange(x);
      if (h) return h;
    }
    return null;
  }
  const t = v as { strings?: readonly string[]; values?: unknown[] } | null;
  if (!t || typeof t !== "object" || !t.strings) return null;
  if (t.strings[0]?.includes("<fp3d-colour-field")) {
    const i = t.strings.findIndex((s) => s.trimEnd().endsWith("@colour-change="));
    return (t.values![i] as (e: Event) => void) ?? null;
  }
  for (const x of t.values ?? []) {
    const h = onColourChange(x);
    if (h) return h;
  }
  return null;
}

test("a change from the colour field is one undo step in the editor (#403)", async () => {
  const pack: FurniturePack = {
    id: "demo.cars",
    name: "Cars",
    publisher: "Demo",
    items: [{ id: "hatch", name: { en: "Hatch" }, size: [1.8, 4, 1.5], parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0.2, h: 0.4, color: "paint" }] }],
  };
  setPacks([pack]);
  const car: Furniture = { id: "car", type: "pack:demo.cars:hatch", x: 1.5, z: 1.5, rotation: 0, w: 1.8, d: 4, h: 1.5, variant: null };
  const ed = await makeEditor([square("r1", 0, 0, 6, 6)], [car]);
  ed.packs = [pack];
  ed.selectItem("furniture", "car");
  const paint = () => ed._doc.floors[0].furniture[0].colors?.paint ?? null;
  const change = (value: string | null) => onColourChange(ed.renderColourRoles(ed.furnitureItem))!({ detail: { value } } as unknown as Event);
  change("#1e6ebc");
  assert.equal(paint(), "#1e6ebc");
  change("#c0392b");
  assert.equal(paint(), "#c0392b");
  ed.undo();
  assert.equal(paint(), "#1e6ebc", "one undo takes back one change");
  ed.undo();
  assert.equal(paint(), null);
  setPacks([]);
});

test("on its default the field shows the colour it really has, muted and named so (#403)", () => {
  const table = englishTable() as Record<string, string>;
  const f = field(null, { base: "#293962", t: (k, v) => table[k]!.replace("{label}", v.label) }) as unknown as ColourField & { render(): unknown };
  assert.equal(f.hex, "", "no colour of its own");
  assert.equal(f.shown, "#293962");
  const text = flat(f.render());
  assert.match(text, /\.value=#293962/, "the swatch and the hex text show the default");
  assert.match(text, /class=hex dflt/);
  assert.match(text, /aria-label=Paint: hex value \(default colour\)/);
  // a colour of its own shows plainly
  const own = field("#c0392b", { base: "#293962" }) as unknown as ColourField & { render(): unknown };
  assert.equal(own.shown, "#c0392b");
  assert.doesNotMatch(flat(own.render()), /dflt/);
  // no base: nothing to show
  assert.equal(field(null).shown, "");
});

test("copying a colour on its default copies the default's hex (#403)", async () => {
  const copied: string[] = [];
  const nav = globalThis.navigator as unknown as { clipboard?: unknown };
  const before = Object.getOwnPropertyDescriptor(globalThis.navigator, "clipboard");
  Object.defineProperty(globalThis.navigator, "clipboard", { value: { writeText: async (t: string) => void copied.push(t) }, configurable: true });
  try {
    const f = field(null, { base: "#293962" });
    await f.copy();
    assert.deepEqual(copied, ["#293962"]);
    assert.equal(f.copied, true);
    await field("#c0392b", { base: "#293962" }).copy();
    assert.deepEqual(copied, ["#293962", "#c0392b"]);
  } finally {
    if (before) Object.defineProperty(globalThis.navigator, "clipboard", before);
    else delete nav.clipboard;
  }
});

test("typing or pasting over a default sets a colour of its own, the default's own hex too (#403)", () => {
  const f = field(null, { base: "#293962" });
  f.commit("#ffffff");
  assert.deepEqual(changes(f), ["#ffffff"]);
  const same = field(null, { base: "#293962" });
  same.commit("#293962");
  assert.deepEqual(changes(same), ["#293962"], "the default typed in becomes the item's own colour");
  const cleared = field(null, { base: "#293962", clearable: true });
  cleared.commit("");
  assert.deepEqual(cleared.sent, [], "emptying a default changes nothing");
});

test("an item part on its default shows its role's colour in the device's look (#403)", async () => {
  const { roleInLook } = await import("./look-surface.ts");
  const ed = await makeEditor([square("r1", 0, 0, 6, 6)], [{ id: "s", type: "sofa", x: 1, z: 1, rotation: 0, w: 2, d: 0.9, h: 0.8, variant: null } as Furniture]);
  ed.selectItem("furniture", "s");
  const text = flat(ed.renderColourRoles(ed.furnitureItem));
  const neon = roleInLook("fabric", "neon")!;
  assert.match(text, new RegExp(`\.base=${neon}`), "the fabric role's neon colour (the look Home Assistant's dark theme shows)");
  assert.notEqual(roleInLook("fabric", "day"), neon, "the Day look has its own");
  assert.equal(roleInLook("nope", "day"), null);
});

test("in menu mode the swatch is a button that asks the host for its popover, and says whether it is open (#410)", () => {
  const f = field(null, { base: "#293962", menu: true, expanded: false }) as ColourField & { sent: Sent[]; render(): unknown };
  const text = flat(f.render());
  assert.doesNotMatch(text, /type="color"/, "no browser picker on the row");
  assert.match(text, /<button type="button" class=sw dflt sb aria-label=Paint aria-haspopup="true" aria-expanded=false/);
  assert.match(text, /background:#293962/, "the swatch shows the colour it has now, not a faded grey");
  assert.match(text, /class=hex dflt/, "the hex value is still there to read, type and paste");
  // its click sends colour-menu, no colour change
  type Tpl = { strings: readonly string[]; values: unknown[] };
  const t = (f.render() as Tpl).values.find((v): v is Tpl => !!v && typeof v === "object" && "strings" in v && (v as Tpl).strings[0]!.startsWith("<button"))!;
  const click = t.values[t.strings.findIndex((s) => s.trimEnd().endsWith("@click="))] as () => void;
  click();
  assert.deepEqual(f.sent.map((s) => s.type), ["colour-menu"]);
  f.expanded = true;
  assert.match(flat(f.render()), /aria-expanded=true/);
});
