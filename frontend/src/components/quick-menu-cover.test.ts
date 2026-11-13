// The 3D quick menu's big cover button follows what the cover supports (#251, same coverControls as the room panel #243).
import assert from "node:assert/strict";
import { test } from "node:test";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener: () => undefined, removeEventListener: () => undefined });
g.location = { search: "", hash: "", pathname: "/home_3d" };
g.history = { state: null, replaceState: () => undefined };

const { Fp3dQuickMenu, coverToggle } = await import("./quick-menu.ts");

/** Everything a lit template contains: its static strings and, recursively, its values. */
function flat(v: unknown): string {
  if (Array.isArray(v)) return v.map(flat).join("");
  const r = v as { strings?: string[]; values?: unknown[] } | null;
  if (r && Array.isArray(r.strings)) return r.strings.reduce((out, str, i) => out + str + (i < r.values!.length ? `\u0001${flat(r.values![i])}\u0002` : ""), "");
  return typeof v === "string" ? v : typeof v === "boolean" ? String(v) : "";
}

const cover = (f: number, attrs: Record<string, unknown> = {}, state = "open") =>
  ({ entity_id: "cover.sample_blind", state, attributes: { friendly_name: "Blind", supported_features: f, device_class: "blind", ...attrs } }) as never;

const OPEN = 1, CLOSE = 2, POS = 4, STOP = 8, TOPEN = 16, TCLOSE = 32, TSTOP = 64, TPOS = 128;

test("open/close covers toggle open_cover / close_cover by position (#251)", () => {
  for (const f of [OPEN | CLOSE, OPEN | CLOSE | STOP, OPEN | CLOSE | POS | TOPEN | TCLOSE]) {
    assert.equal(coverToggle(cover(f, { current_position: 0 }, "closed"))!.service, "open_cover", `closed ${f}`);
    assert.equal(coverToggle(cover(f, { current_position: 100 }))!.service, "close_cover", `open ${f}`);
    assert.equal(coverToggle(cover(f, {}, "closed"))!.service, "open_cover", `closed state, no position ${f}`);
  }
  // a cover that only opens (or only closes) uses the one it has
  assert.equal(coverToggle(cover(OPEN, { current_position: 100 }))!.service, "open_cover");
  assert.equal(coverToggle(cover(CLOSE, { current_position: 0 }, "closed"))!.service, "close_cover");
});

test("a tilt-only blind toggles the slats by its tilt position (#251)", () => {
  for (const f of [TOPEN | TCLOSE, TOPEN | TCLOSE | TSTOP | TPOS]) {
    assert.equal(coverToggle(cover(f, { current_tilt_position: 0 }))!.service, "open_cover_tilt", `shut slats ${f}`);
    assert.equal(coverToggle(cover(f, { current_tilt_position: 100 }))!.service, "close_cover_tilt", `open slats ${f}`);
  }
  assert.equal(coverToggle(cover(TOPEN, { current_tilt_position: 100 }))!.service, "open_cover_tilt", "only opens");
});

test("a position-only cover toggles through set_cover_position 0 / 100 (#251)", () => {
  assert.deepEqual(coverToggle(cover(POS, { current_position: 0 }, "closed")), { service: "set_cover_position", data: { position: 100 }, open: true });
  assert.deepEqual(coverToggle(cover(POS | STOP, { current_position: 80 })), { service: "set_cover_position", data: { position: 0 }, open: false });
  // slats position only
  assert.deepEqual(coverToggle(cover(TPOS, { current_tilt_position: 90 })), { service: "set_cover_tilt_position", data: { tilt_position: 0 }, open: false });
});

test("a cover with none of those gets no big button (#251)", () => {
  assert.equal(coverToggle(cover(0)), null);
  assert.equal(coverToggle(cover(STOP)), null);
  assert.equal(coverToggle(cover(TSTOP)), null);
  // set position without reporting one cannot be toggled
  assert.equal(coverToggle(cover(POS)), null);
});

test("every feature combination: the big button only calls what the cover supports (#251)", () => {
  const needs: Record<string, number[]> = { open_cover: [OPEN], close_cover: [CLOSE], set_cover_position: [POS], open_cover_tilt: [TOPEN], close_cover_tilt: [TCLOSE], set_cover_tilt_position: [TPOS] };
  for (let f = 0; f < 256; f++) {
    for (const attrs of [{ current_position: 10, current_tilt_position: 10 }, { current_position: 90, current_tilt_position: 90 }, {}]) {
      const t = coverToggle(cover(f, attrs));
      if (!t) continue;
      assert.ok(needs[t.service].some((bit) => f & bit), `${t.service} for features ${f}`);
    }
  }
});

function menu(st: unknown): Record<string, any> {
  const el = new Fp3dQuickMenu() as unknown as Record<string, any>;
  el.hass = { language: "en", states: { "cover.sample_blind": st }, entities: {}, devices: {}, callService: async () => undefined };
  el.entity = "cover.sample_blind";
  return el;
}

test("the quick menu draws the big cover button only when there is something to do (#251)", () => {
  const big = (f: number, attrs: Record<string, unknown> = { current_position: 40, current_tilt_position: 30 }) => /qm-blind/.test(flat(menu(cover(f, attrs)).renderCover(cover(f, attrs))));
  assert.ok(big(OPEN | CLOSE), "open/close");
  assert.ok(big(TOPEN | TCLOSE | TPOS), "tilt-only");
  assert.ok(big(POS), "position-only");
  assert.ok(!big(0), "no features");
  assert.ok(!big(STOP), "stop only");
});

test("the ring on a tilt-only blind has no open, close or stop slot it cannot do (#251)", () => {
  const html = flat(menu(cover(TOPEN | TCLOSE)).renderCover(cover(TOPEN | TCLOSE, { current_tilt_position: 30 })));
  assert.doesNotMatch(html, /\u0001Close\u0002|\u0001Stop\u0002|aria-label=\u0001Open\u0002/);
  assert.match(html, /aria-label=\u0001Slats open\u0002/, "the big button is the slats toggle");
  assert.match(html, /Slats open/);
});

test("\"Invert slats\" turns the tilt round in the quick menu: shown, toggled and sent the other way (#453)", () => {
  // the cover reports 10, its integration means 0 = open: the slats stand 90 % open
  assert.deepEqual(coverToggle(cover(TPOS, { current_tilt_position: 10 }), true), { service: "set_cover_tilt_position", data: { tilt_position: 100 }, open: false });
  assert.deepEqual(coverToggle(cover(TPOS, { current_tilt_position: 90 }), true), { service: "set_cover_tilt_position", data: { tilt_position: 0 }, open: true });
  const st = cover(TPOS | OPEN | CLOSE, { current_position: 40, current_tilt_position: 10 });
  const el = menu(st);
  el.slatInvert = true;
  const html = flat(el.renderCover(st));
  assert.match(html, /\.value=\u000190\u0002/, "the slider stands at the turned value");
  // without the option it shows what the cover reports
  assert.match(flat(menu(st).renderCover(st)), /\.value=\u000110\u0002/);
});
