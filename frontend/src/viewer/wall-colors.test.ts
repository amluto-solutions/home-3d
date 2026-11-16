import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { BufferGeometry } from "three";
import type { Floor, FreeWall, Room } from "../model.ts";
import { newFloor } from "../model.ts";
import { buildFloorGeometry } from "./build.ts";
import { hasWallColours, hexColor, paletteKey, setWallTints, WALL_TINT } from "./palette.ts";

afterEach(() => setWallTints(false));

const room = (id: string, x0: number, x1: number, extra: Partial<Room> = {}): Room => ({ id, name: id, area_id: null, points: [[x0, 0], [x1, 0], [x1, 4], [x0, 4]], floor_material: "wood", ...extra });
const floorOf = (rooms: Room[]): Floor => ({ ...newFloor("f", "Floor", 0), rooms });

/** Untinted colours of the marked vertices of the walls: [x, z, r, g, b]. */
function tinted(g: BufferGeometry): number[][] {
  const p = g.getAttribute("position");
  const c = g.getAttribute("color");
  const out: number[][] = [];
  for (let i = 0; i < c.count; i++) if (c.getX(i) > WALL_TINT - 0.5) out.push([p.getX(i), p.getZ(i), c.getX(i) - WALL_TINT, c.getY(i) - WALL_TINT, c.getZ(i) - WALL_TINT]);
  return out;
}
const build = (f: Floor) => buildFloorGeometry(f, 0.24, 0.12).walls;
const red = (v: number[]) => v[2] > 2 * v[3] && v[2] > 2 * v[4];
const blue = (v: number[]) => v[4] > 2 * v[2] && v[4] > v[3];

test("wall colours are valid hex only", () => {
  assert.equal(hexColor("#c0392b"), 0xc0392b);
  assert.equal(hexColor("c0392b"), null);
  assert.equal(hexColor("#fff"), null);
  assert.equal(hexColor(null), null);
  assert.equal(hasWallColours({ floors: [{ rooms: [room("a", 0, 4)] }] }), false);
  assert.equal(hasWallColours({ floors: [{ rooms: [room("a", 0, 4, { wall_colors: [null, "#112233"] })] }] }), true);
  assert.equal(hasWallColours({ settings: { facade_color: "#d9c7a3" }, floors: [] }), true);
});

test("nothing is coloured while the colours are not built in (Neon and the other looks)", () => {
  setWallTints(false);
  assert.equal(tinted(build(floorOf([room("a", 0, 4, { wall_color: "#c0392b" })]))).length, 0);
  assert.equal(paletteKey(), "");
});

test("a room's wall colour paints its side; a shared wall shows each room's own side (#437)", () => {
  setWallTints(true);
  const g = build(floorOf([room("a", 0, 4, { wall_color: "#c0392b" }), room("b", 4, 8, { wall_colors: ["#3b6ea5", "#3b6ea5", "#3b6ea5", "#3b6ea5"] })]));
  const v = tinted(g);
  assert.ok(v.length > 0);
  // the faces on the shared wall at x = 4: left of it red (room a), right of it blue (room b)
  const left = v.filter((q) => q[0] > 3.85 && q[0] < 3.99);
  const right = v.filter((q) => q[0] > 4.01 && q[0] < 4.15);
  assert.ok(left.length > 0 && left.every(red), "room a's side is red");
  assert.ok(right.length > 0 && right.every(blue), "room b's side is blue");
  // the outer sides have no facade colour: they keep the wall colour
  assert.ok(!v.some((q) => q[1] < -0.05 || q[1] > 4.05));
});

test("a wall's own colour beats the room's; the facade colour paints the outer sides", () => {
  setWallTints(true, "#d9a066");
  assert.match(paletteKey(), /w/);
  const g = build(floorOf([room("a", 0, 4, { wall_color: "#c0392b", wall_colors: [null, null, null, "#3b6ea5"] })]));
  const v = tinted(g);
  // edge 3 runs along x = 0: its inner side (x > 0) is blue, the others red
  const near = (x: number, y: number) => (q: number[]) => Math.abs(q[0] - x) < 0.01 && Math.abs(q[1] - y) < 0.01;
  // the west wall's inner side (edge 3) runs from (0, 4) to (0, 0): blue at its far end; the others stay red
  assert.ok(v.filter(near(0, 4)).some(blue), "edge 3's own colour");
  assert.ok(v.filter(near(4, 0)).some(red), "the room's colour on the other edges");
  assert.ok(!v.filter((q) => q[0] > 3.5).some(blue), "no blue on the east wall");
  const facade = v.filter((q) => q[0] < -0.2);
  assert.ok(facade.length > 0 && facade.every((q) => q[2] > q[3] && q[3] > q[4]), "the outer side takes the facade colour");
});

test("a wall drawn on its own has a colour on both sides, in a room and outside; a reset goes back (#460)", () => {
  setWallTints(true, "#d0c0a0");
  const walls = (color: string | null): FreeWall[] => [
    { id: "in", a: [2, 0.5], b: [2, 3.5], thickness: 0.1, height: 1.2, color },
    { id: "out", a: [10, 0], b: [12, 0], thickness: null, height: null, color },
  ];
  const run = (color: string | null) => {
    const g = build({ ...floorOf([room("a", 0, 4)]), walls: walls(color) });
    const v = tinted(g);
    const mid = (q: number[]) => (Math.abs(q[0] - 2) < 0.1 && q[1] > 0.45 && q[1] < 3.55 ? "inside" : q[0] > 9.95 && q[0] < 12.05 && Math.abs(q[1]) < 0.2 ? "outside" : "other");
    const out = { inside: 0, outside: 0 };
    for (const q of v) if (red(q)) {
      const w = mid(q);
      if (w !== "other") out[w]++;
    }
    return out;
  };
  const own = run("#c0392b");
  assert.ok(own.inside >= 4 && own.outside >= 4, JSON.stringify(own));
  // no colour of its own: the facade colour outside (not red), and the room's none inside
  assert.deepEqual(run(null), { inside: 0, outside: 0 });
  // the room's own walls keep their colour
  const rooms = tinted(build({ ...floorOf([room("a", 0, 4, { wall_color: "#3b6ea5" })]), walls: walls("#c0392b") }));
  assert.ok(rooms.some((q) => blue(q) && Math.abs(q[0] - 4) < 0.01), "the room wall stays blue");
});

test("an own wall colour counts as a wall colour of the home (#460)", () => {
  const plain = { floors: [{ rooms: [room("a", 0, 4)], walls: [{ color: null }] }] };
  assert.equal(hasWallColours(plain), false);
  assert.equal(hasWallColours({ floors: [{ rooms: [room("a", 0, 4)], walls: [{ color: "#c0392b" }] }] }), true);
  assert.equal(hasWallColours({ floors: [{ rooms: [], walls: [{ color: "red" }] }] }), false);
});
