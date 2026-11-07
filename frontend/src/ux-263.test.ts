// The owner's UX decisions (#263): the run 6 defaults, one block per numbered item.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

// 1. Settings, Extensions, the editor and New home follow the chosen look

test("the panel's light and high contrast schemes apply on every page, not only the 3D view (#263)", () => {
  const panel = src("./panel.ts");
  assert.match(panel, /this\.toggleAttribute\("light", lightChrome\(shownLook\(this\._theme, this\.hass\)\)\)/);
  assert.match(panel, /this\.toggleAttribute\("contrast", contrastChrome\(shownLook\(this\._theme, this\.hass\)\)\)/);
});

test("the ask dialog takes the look of the part that asked, found along the focus (#263)", async () => {
  const { focusScheme } = await import("./components/ask-dialog.ts");
  const el = (attrs: string[], inner: unknown = null) =>
    ({ hasAttribute: (a: string) => attrs.includes(a), shadowRoot: inner ? { activeElement: inner } : null }) as unknown as Element;
  assert.equal(focusScheme(null), null);
  assert.equal(focusScheme(el([], el([], el([])))), null);
  // the panel under the Day look, focus on a button deep inside Settings
  assert.equal(focusScheme(el([], el(["light"], el([], el([]))))), "light");
  assert.equal(focusScheme(el(["contrast"], el([]))), "contrast");
  // the innermost scheme wins (a card on a dark page)
  assert.equal(focusScheme(el(["light"], el(["contrast"]))), "contrast");
});

// 2. The phone View sheet opened at half height; #346 replaced it with a full screen page (ux-346.test.ts)

// 3. Colliding room names: the smaller room's gives way

test("room names that would overlap: the larger room's shows, the smaller one's comes back when there is room (#263)", async () => {
  const { clearLabels, pinSize, roomRank } = await import("./viewer/label-clear.ts");
  const box = (x: number, y: number, rank: number) => ({ x, y, w: 80, h: 27, rank });
  // two names on top of each other: the larger room wins, wherever it is in the list
  assert.deepEqual(clearLabels([box(100, 100, 5), box(110, 105, 20)]), [false, true]);
  // zoomed in, the same rooms are far apart on screen: both show
  assert.deepEqual(clearLabels([box(100, 100, 5), box(300, 105, 20)]), [true, true]);
  // a hidden name does not hide others: a chain keeps every other one
  assert.deepEqual(clearLabels([box(0, 0, 30), box(70, 0, 20), box(140, 0, 10)]), [true, false, true]);
  // a longer name is a wider box; a values line makes it taller
  assert.ok(pinSize("Kitchen-diner").w > pinSize("WC").w);
  assert.ok(pinSize("WC", "21.5 °C").h > pinSize("WC").h);
  // a lawn never hides a room's name, however big it is
  const room = { id: "r", name: "WC", points: [[0, 0], [1, 0], [1, 1], [0, 1]] } as never;
  const lawn = { id: "l", name: "Lawn", outdoor: true, points: [[0, 0], [30, 0], [30, 30], [0, 30]] } as never;
  assert.ok(roomRank(room) > roomRank(lawn));
  // the viewer places room names through it
  assert.match(src("./viewer/viewer3d.ts"), /const keep = clearLabels\(names\.map\(\(n\) => n\.box\)\);/);
});

// 4. Narrow cards: what doesn't fit goes into a ⋯ menu

test("a narrow card keeps what fits in its bar and moves the rest into a ⋯ menu; Back always stays (#263)", async () => {
  const { fitBar, itemWidth, MENU_W } = await import("./card-fit.ts");
  const items = [
    { id: "back", keep: true, texts: ["Back"] },
    { id: "tt", texts: ["⏪ Time travel"] },
    { id: "view", texts: ["3D", "2D"] },
    { id: "walls", texts: ["Tall walls", "Cut"] },
    { id: "heat", texts: ["Normal", "Temp.", "Humidity", "CO₂"] },
  ];
  const all = items.reduce((s, it) => s + itemWidth(it), 0) + 8 * (items.length - 1);
  assert.deepEqual(fitBar(items, all), { bar: ["back", "tt", "view", "walls", "heat"], menu: [] });
  const phone = fitBar(items, 320);
  assert.deepEqual(phone.bar.slice(0, 1), ["back"]);
  assert.ok(phone.menu.includes("heat"));
  assert.deepEqual([...phone.bar, ...phone.menu].sort(), items.map((i) => i.id).sort(), "nothing is lost");
  // the bar keeps its order: once one control went into the menu, the later ones follow it there
  const narrow = fitBar(items, itemWidth(items[0]!) + 8 + MENU_W + 4);
  assert.deepEqual(narrow, { bar: ["back"], menu: ["tt", "view", "walls", "heat"] });
  const card = src("./card.ts");
  assert.match(card, /class="fp3d-chip fp3d-card-more" aria-haspopup="true"/);
});

// 5. Select several: in the phone's More, and a long press on an item starts it

test("a long press on an item starts Select several; on anything else, or already in it, it opens the menu (#263)", async () => {
  await import("./components/editor-harness.ts");
  const { holdStartsMulti } = await import("./components/editor/pointer.ts");
  assert.equal(holdStartsMulti({ kind: "furniture" }, false, true), true);
  assert.equal(holdStartsMulti({ kind: "furnset" }, false, true), true);
  assert.equal(holdStartsMulti({ kind: "furniture" }, true, true), false, "in Select several the menu opens");
  assert.equal(holdStartsMulti({ kind: "room" }, false, true), false);
  assert.equal(holdStartsMulti(null, false, true), false);
  assert.equal(holdStartsMulti({ kind: "furniture" }, false, false), false, "a viewer only pans");
  const pointer = src("./components/editor/pointer.ts");
  assert.match(pointer, /if \(holdStartsMulti\(d, this\._multiMode, this\.isEditor\)\) \{\s*this\._multiMode = true;/);
});

test("the phone's More has a Select several switch that picks the select tool (#263)", async () => {
  const bar = src("./components/editor/phone-bar.ts");
  assert.match(bar, /\{ id: "multi", icon: "pointer", label: this\.t\("multi_more"\), sub: this\.t\("multi_more_sub"\), checked: this\.multi,/);
  assert.match(src("./components/editor/phone.ts"), /\.multi=\$\{this\._multiMode\}/);
  const { lateEnglish } = await import("./i18n-late.ts");
  assert.equal(lateEnglish.multi_more, "Select several");
});

// 6. 3D beside on a phone opens full screen with a way back to 2D

test("on a phone 3D beside covers the plan, its button goes back to 2D, Back closes it and it is not remembered (#263)", () => {
  const css = src("./components/editor/styles/phone.ts");
  assert.match(css, /\.fp3d-phone \.fp3d-split > \.fp3d-editor-3d \{\s*position: absolute;\s*inset: 0;/);
  assert.match(css, /\.fp3d-phone \.fp3d-split > \.fp3d-canvas-wrap \{\s*flex: 1 1 auto;/);
  const pane = src("./components/editor/pane3d.ts");
  assert.match(pane, /this\._phone\s*\? html`<button class="fp3d-3d-fold" title=\$\{this\.t\("split_back_2d_hint"\)\}/);
  assert.match(pane, /this\._split = !this\._split;\s*\/\/[^\n]*\n\s*if \(this\._phone\) return;/);
  const phone = src("./components/editor/phone.ts");
  assert.match(phone, /this\.backLayers\.sync\("3d", this\._phone && this\._split, \(\) => \(this\._split = false\), \(\) => \(this\._split = true\)\);/);
  assert.match(phone, /if \(this\._phone && !was\) this\._split = false;/);
  assert.match(src("./components/editor.ts"), /this\.houseTool && !this\._split && !this\.narrow && !this\._phone\) this\._split = true;/);
});

// 7. Add floor never offers a floor the plan has; floors link to HA floors by name

test("floor names match Home Assistant's whatever the case, punctuation or a trailing 'floor' (#263)", async () => {
  const { floorKey, sameFloorName, floorLinks, firstHaFloor, haFloorNamed } = await import("./floor-link.ts");
  assert.equal(floorKey("Ground Floor"), "ground");
  assert.ok(sameFloorName("Ground floor", "ground"));
  assert.ok(sameFloorName("First-Floor", "first floor"));
  assert.ok(!sameFloorName("Floor 1", "First floor"));
  assert.ok(!sameFloorName("", ""), "an empty name matches nothing");
  const ha = [
    { floor_id: "g", name: "Ground Floor", level: 0 },
    { floor_id: "f", name: "First Floor", level: 1 },
    { floor_id: "b", name: "Basement", level: -1 },
  ];
  // unlinked plan floors link by name, a linked one keeps its link, each HA floor once
  const links = floorLinks(
    [
      { id: "p1", name: "Ground floor", ha_floor: null },
      { id: "p2", name: "First floor", ha_floor: "b" },
      { id: "p3", name: "ground", ha_floor: null },
      { id: "p4", name: "Attic", ha_floor: null },
    ],
    ha,
  );
  assert.deepEqual([...links], [["p1", "g"]]);
  assert.equal(haFloorNamed("first floor", ha, new Set(["f"])), null, "taken by another floor");
  // a home's first floor: level 0 before the basement
  assert.equal(firstHaFloor(ha.slice().sort((a, b) => a.level - b.level))?.floor_id, "g");
  assert.equal(firstHaFloor([]), null);
});

test("Add floor hides HA floors the plan has by name; add, rename and a first open link floors (#263)", () => {
  const ed = src("./components/editor.ts");
  assert.match(ed, /\.filter\(\(f\) => !used\.has\(f\.floor_id\) && !this\._doc\.floors\.some\(\(p\) => sameFloorName\(p\.name, f\.name\)\)\)/);
  assert.match(ed, /queueMicrotask\(\(\) => this\.linkFloorsByName\(\)\);/);
  const floors = src("./components/editor/floors.ts");
  assert.match(floors, /if \(!ha && floors\.length === 0\) ha = firstHaFloor\(this\.freeHaFloors\);/);
  assert.match(floors, /if \(patch\.name !== undefined && !floor\.ha_floor\) \{/);
  // only a home none of whose floors is linked: a link someone removed stays removed
  assert.match(floors, /if \(!this\.isEditor \|\| this\._doc\.floors\.some\(\(f\) => f\.ha_floor\)\) return;/);
});

// 8. What the red badge and "Not on displays" mean, and Make active for a new home

test("the header chip explains 'not on displays' and its Make active makes the shown home the active one (#263)", async () => {
  const { Fp3dHomeSwitcher } = await import("./components/home-switcher.ts");
  const sent: Record<string, unknown>[] = [];
  const homes = [
    { id: "home", name: "Home", revision: 1, floors: 1, rooms: 3, furniture: 10 },
    { id: "new", name: "New home", revision: 1, floors: 0, rooms: 0, furniture: 0 },
  ];
  let active = "home";
  const hass = {
    language: "en",
    callWS: async (msg: Record<string, unknown>) => {
      sent.push(msg);
      if (typeof msg.home_id === "string" && /active/.test(String(msg.type))) active = msg.home_id;
      return { homes, active };
    },
  };
  const el = new Fp3dHomeSwitcher() as unknown as Record<string, any>;
  el.hass = hass;
  el.home = "new";
  el.willUpdate(new Map());
  await new Promise((r) => setTimeout(r, 0));
  const opened: unknown[] = [];
  el.dispatchEvent = (e: CustomEvent) => (opened.push(e.detail), true);
  await el.makeActive();
  assert.ok(sent.some((m) => /active/.test(String(m.type))), "the active home is set");
  assert.equal(el._active, "new");
  assert.deepEqual(opened, [{ home: null }], "the view follows the active home again");
  const { englishTable } = await import("./i18n.ts");
  const en = englishTable() as Record<string, string>;
  assert.ok(en.home_make_active && en.home_not_on_displays_hint);
  const { lateEnglish } = await import("./i18n-late.ts");
  assert.match(lateEnglish.st_homes_legend!, /Active on displays/);
  assert.equal(lateEnglish.st_homes_show, "Make active");
  assert.match(src("./settings/homes.ts"), /<p class="sub legend">\$\{this\.t\("st_homes_legend"\)\}<\/p>/);
  assert.match(src("./panel.ts"), /@home-settings=\$\{\(\) => this\.openSettings\("homes", "homes"\)\}\s*@home-open=/);
});
