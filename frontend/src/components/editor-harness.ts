/**
 * Test helper: an `Fp3dEditor` built in plain Node (no browser, no DOM), with just enough stubs to send it plan
 * presses. See the editor map, section 15. Not part of any bundle.
 */
import { emptyBuilding, newFloor, type Building, type Furniture, type Room } from "../model.ts";

for (const name of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) {
  (globalThis as Record<string, unknown>)[`__FP3D_${name}_HASH__`] ??= "test";
}
(globalThis as Record<string, unknown>).__FP3D_VERSION__ ??= "test";

/** A plan element as `pointerDown` sees it: `closest()` answers for its own data attributes only. */
export function planEl(attrs: Record<string, string> = {}): Element {
  const el = {
    closest: (sel: string) => (sel.split(",").some((s) => s.trim().slice(1, -1) in attrs) ? el : null),
    getAttribute: (name: string) => attrs[name] ?? null,
  };
  return el as unknown as Element;
}

export interface PressOptions {
  target?: Element;
  pointerType?: string;
  altKey?: boolean;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  id?: number;
}

export type TestEditor = Record<string, any> & {
  press(sx: number, sy: number, o?: PressOptions): void;
  move(sx: number, sy: number, o?: PressOptions): void;
  release(sx: number, sy: number, o?: PressOptions): void;
  /** A key press with nothing focused (the plan has the keyboard). */
  key(key: string, o?: { shiftKey?: boolean; altKey?: boolean }): { prevented: boolean };
};

/** One floor "f" with the given rooms and items; the view is 100 px per metre with the origin at the top left. */
export async function makeEditor(rooms: Room[], furniture: Furniture[] = []): Promise<TestEditor> {
  const { Fp3dEditor } = await import("./editor.ts");
  const building: Building = emptyBuilding();
  building.floors = [{ ...newFloor("f", "F", 0), rooms, furniture }];
  const el = new Fp3dEditor() as unknown as TestEditor;
  el.hass = { states: {}, areas: {}, user: { is_admin: true }, language: "en", locale: { language: "en" } };
  el.canEdit = true;
  el._doc = building;
  el._floorId = "f";
  el._view = { scale: 100, ox: 0, oy: 0 };
  el._size = { w: 800, h: 600 };
  const svg = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }), setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture: () => true };
  Object.defineProperty(el, "renderRoot", { value: { querySelector: () => svg, querySelectorAll: () => [], activeElement: null }, configurable: true });
  const event = (sx: number, sy: number, o: PressOptions = {}) => ({
    clientX: sx,
    clientY: sy,
    button: 0,
    pointerId: o.id ?? 1,
    pointerType: o.pointerType ?? "mouse",
    altKey: !!o.altKey,
    shiftKey: !!o.shiftKey,
    ctrlKey: !!o.ctrlKey,
    metaKey: false,
    target: o.target ?? planEl(),
    currentTarget: svg,
    preventDefault() {},
    stopPropagation() {},
  });
  el.press = (sx, sy, o) => el.pointerDown(event(sx, sy, o));
  el.move = (sx, sy, o) => el.onPointerMove(event(sx, sy, o));
  el.release = (sx, sy, o) => el.onPointerUp(event(sx, sy, o));
  Object.defineProperty(el, "isConnected", { value: true, configurable: true });
  Object.defineProperty(el, "offsetParent", { value: {}, configurable: true });
  el.key = (key, o = {}) => {
    const out = { prevented: false };
    el.onKey({ key, shiftKey: !!o.shiftKey, altKey: !!o.altKey, ctrlKey: false, metaKey: false, composedPath: () => [], preventDefault: () => (out.prevented = true) });
    return out;
  };
  return el;
}

export const square = (id: string, x0: number, z0: number, x1: number, z1: number): Room => ({
  id,
  name: id,
  area_id: null,
  points: [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  floor_material: "wood",
});
