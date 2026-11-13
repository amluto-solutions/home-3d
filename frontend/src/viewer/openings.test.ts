import assert from "node:assert/strict";
import { test } from "node:test";
import type { Opening } from "../model.ts";
import type { OpeningInfo } from "./build.ts";
import { ALWAYS } from "./geo.ts";
import { blindInside, buildOpeningParts, lightCover, type OpeningState, sillBoards, stackedOnOpening } from "./openings.ts";

/** A window (or door) on the wall along x from (sx, sz), as the floor builder describes it. */
function info(id: string, sx: number, width: number, sill: number, top: number, extra: Partial<Opening> & { axis?: [number, number]; exterior?: boolean; sz?: number } = {}): OpeningInfo {
  const { axis = [1, 0], exterior = true, sz = 0, ...o } = extra;
  const opening: Opening = { id, room_id: "r", edge: 0, offset: sx + width / 2, width, type: "window", sill, height: top - sill, hinge: "left", leaves: 1, swing: "in", cover: null, contact: null, contact2: null, tilt: null, ...o };
  return { opening, bucket: 0, start: [sx, sz], axis, width, toRoom: [0, 1], faceRoom: 0.12, faceOut: 0.12, sill, top, hingeAtStart: true, exterior };
}

test("a window gets a board inside and a sill outside from 0.3 m sill height, interior walls only the board", () => {
  const low = info("low", 1, 1.2, 0.2, 1.5);
  const normal = info("w", 1, 1.2, 0.9, 2.2);
  assert.deepEqual(sillBoards(low, [low]), { inside: false, outside: false });
  assert.deepEqual(sillBoards(normal, [normal]), { inside: true, outside: true });
  const inner = info("i", 1, 1.2, 0.9, 2.2, { exterior: false });
  assert.deepEqual(sillBoards(inner, [inner]), { inside: true, outside: false });
});

test("a window directly above another opening of the same wall has no sill in automatic mode (#655)", () => {
  const lower = info("lower", 1, 1.2, 0.9, 2.0);
  const transom = info("transom", 1, 1.2, 2.0, 2.4);
  const all = [lower, transom];
  assert.equal(stackedOnOpening(transom, all), true);
  assert.equal(stackedOnOpening(lower, all), false);
  assert.deepEqual(sillBoards(transom, all), { inside: false, outside: false });
  assert.deepEqual(sillBoards(lower, all), { inside: true, outside: true });
  // a small gap (a transom bar) still counts, a big one does not
  const t2 = info("t2", 1, 1.2, 2.2, 2.4);
  assert.equal(stackedOnOpening(t2, [lower, t2]), true);
  const t3 = info("t3", 1, 1.2, 2.35, 2.45);
  assert.equal(stackedOnOpening(t3, [lower, t3]), false);
  // a transom light over a door, and the same wall drawn the other way round
  const door = info("door", 3, 0.9, 0, 2.05, { type: "door" });
  const fanlight = info("fan", 3.1, 0.7, 2.05, 2.4);
  assert.equal(stackedOnOpening(fanlight, [door, fanlight]), true);
  const reversed = info("rev", 2.2, 1.2, 2.0, 2.4, { axis: [-1, 0] });
  assert.equal(stackedOnOpening(reversed, [lower, reversed]), true);
});

test("windows beside each other, on another wall or hardly overlapping keep their sills", () => {
  const a = info("a", 1, 1.2, 0.9, 2.0);
  const beside = info("b", 2.4, 1.2, 2.0, 2.4);
  assert.equal(stackedOnOpening(beside, [a, beside]), false);
  const otherWall = info("o", 1, 1.2, 2.0, 2.4, { sz: 3 });
  assert.equal(stackedOnOpening(otherWall, [a, otherWall]), false);
  const across = info("x", 1, 1.2, 2.0, 2.4, { axis: [0, 1] });
  assert.equal(stackedOnOpening(across, [a, across]), false);
  const edge = info("e", 1.9, 1.2, 2.0, 2.4);
  assert.equal(stackedOnOpening(edge, [a, edge]), false);
});

test("the sill setting overrides the automatic rule", () => {
  const lower = info("lower", 1, 1.2, 0.9, 2.0);
  const forced = info("f", 1, 1.2, 2.0, 2.4, { sill_board: "inside" });
  assert.deepEqual(sillBoards(forced, [lower, forced]), { inside: true, outside: false });
  const outside = info("o", 1, 1.2, 0.9, 2.2, { sill_board: "outside", exterior: false });
  assert.deepEqual(sillBoards(outside, [outside]), { inside: false, outside: true });
  const none = info("n", 1, 1.2, 0.9, 2.2, { sill_board: "none" });
  assert.deepEqual(sillBoards(none, [none]), { inside: false, outside: false });
  // a terrace door gets none by itself; one chosen by hand lies at the floor (#702)
  const terrace = info("t", 1, 1.0, 0, 2.1);
  assert.deepEqual(sillBoards(terrace, [terrace]), { inside: false, outside: false });
  const chosen = info("tc", 1, 1.0, 0, 2.1, { sill_board: "inside" });
  assert.deepEqual(sillBoards(chosen, [chosen]), { inside: true, outside: false });
});

test("a board chosen by hand shows on a window down to the floor; a glass wall has none unless chosen (#702)", () => {
  const floorLong = info("f", 1, 1.2, 0, 2.2, { sill_board: "inside" });
  assert.deepEqual(sillBoards(floorLong, [floorLong]), { inside: true, outside: false });
  const out = info("o", 1, 1.2, 0, 2.2, { sill_board: "outside" });
  assert.deepEqual(sillBoards(out, [out]), { inside: false, outside: true });
  const glass = info("g", 1, 2.4, 0.9, 2.4, { style: "glass_wall" });
  assert.deepEqual(sillBoards(glass, [glass]), { inside: false, outside: false });
  const glassBoard = info("gb", 1, 2.4, 0.9, 2.4, { style: "glass_wall", sill_board: "inside" });
  assert.deepEqual(sillBoards(glassBoard, [glassBoard]), { inside: true, outside: false });
});

/** A garage door's leaf (y and z of every vertex) at a closed fraction: 2.4 m wide, 2.1 m high, the garage towards +z. */
function garageLeaf(style: Opening["style"], closed: number): { y: number[]; z: number[] } {
  const g = info("g", 0, 2.4, 0, 2.1, { type: "garage", style });
  const parts = buildOpeningParts([g], new Map([["g", { open: 0, tilt: 0, cover: closed, sensed: true }]]), 3);
  const pos = parts.blinds.getAttribute("position");
  const y: number[] = [];
  const z: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    y.push(pos.getY(i));
    z.push(pos.getZ(i));
  }
  return { y, z };
}

test("an up-and-over garage door hangs in its opening when shut and tilts up into a canopy when open (#24)", () => {
  const shut = garageLeaf("up_and_over", 1);
  assert.ok(shut.y.length > 0);
  assert.ok(Math.min(...shut.y) < 0.05 && Math.max(...shut.y) > 2.05, "shut: from the ground to the head");
  assert.ok(Math.max(...shut.z) - Math.min(...shut.z) < 0.1, "shut: upright in the wall");
  const open = garageLeaf("up_and_over", 0);
  assert.ok(Math.min(...open.y) > 1.9, `open: lying under the head (${Math.min(...open.y)})`);
  // about a third sticks out over the drive as a canopy, the rest lies in the garage
  assert.ok(Math.min(...open.z) < -0.5 && Math.min(...open.z) > -1, `canopy ${Math.min(...open.z)}`);
  assert.ok(Math.max(...open.z) > 1.1, `inside ${Math.max(...open.z)}`);
  // half way: tilted, neither upright nor flat
  const half = garageLeaf("up_and_over", 0.5);
  assert.ok(Math.min(...half.y) > 0.3 && Math.min(...half.y) < 1.9, `half ${Math.min(...half.y)}`);
  // a sectional door rolls up into the garage and never sticks out
  const sectional = garageLeaf(null, 0);
  assert.ok(Math.min(...sectional.z) > -0.2);
});

/**
 * Vertices of an opening's frames and glass standing above the cut height that do not fold away with the walls
 * (up to the door frame's head: the small light over an outside door is not part of the opening).
 */
function standingAboveCut(o: OpeningInfo, st: OpeningState, cut: number): number {
  const parts = buildOpeningParts([o], new Map([[o.opening.id, st]]), cut);
  let n = 0;
  for (const geo of [parts.frames, parts.glass]) {
    const pos = geo.getAttribute("position");
    const fold = geo.getAttribute("fold");
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > cut + 1e-6 && pos.getY(i) < o.top + 0.05 && fold.getX(i) === ALWAYS) n++;
  }
  return n;
}

test("with cut walls, door leaves and window sashes are cut at the wall height whether shut, opening or open (#244)", () => {
  const cut = 1.2;
  const states = [0, 0.03, 0.3, 0.7, 1];
  for (const style of ["interior", "front", "front_glass", "sidelight", "sidelights", "glass", "sliding"] as const) {
    for (const leaves of [1, 2] as const) {
      for (const swing of ["in", "out"] as const) {
        const door = info("d", 1, 1.6, 0, 2.05, { type: "door", style, leaves, swing });
        for (const open of states) assert.equal(standingAboveCut(door, { open, open2: open, tilt: 0, cover: null, sensed: true }, cut), 0, `${style} x${leaves} ${swing} at ${open}`);
      }
    }
  }
  // a door standing open by its own angle without a sensor, and an unlocked one with its glowing edge
  const angled = info("a", 1, 0.9, 0, 2.05, { type: "door", open_angle: 90 });
  assert.equal(standingAboveCut(angled, { open: 0.5, tilt: 0, cover: null, sensed: false, unlocked: true }, cut), 0);
  for (const style of ["standard", "bars"] as const) {
    for (const leaves of [1, 2] as const) {
      const win = info("w", 1, 1.4, 0.9, 2.2, { style, leaves });
      for (const open of states) {
        assert.equal(standingAboveCut(win, { open, open2: open, tilt: 0, cover: 0.5 }, cut), 0, `${style} x${leaves} open ${open}`);
        assert.equal(standingAboveCut(win, { open: 0, tilt: open, tilt2: open, cover: null }, cut), 0, `${style} x${leaves} tilted ${open}`);
      }
    }
  }
});

test("a tilted sash is cut at the wall's cut height in the room, not along its own slant (#244)", () => {
  const cut = 1.5;
  const win = info("w", 1, 1.2, 0.9, 2.2);
  const parts = buildOpeningParts([win], new Map([["w", { open: 0, tilt: 1, cover: null }]]), cut);
  const pos = parts.frames.getAttribute("position");
  const fold = parts.frames.getAttribute("fold");
  let lowestFolding = Infinity;
  for (let i = 0; i < pos.count; i++) if (fold.getX(i) !== ALWAYS) lowestFolding = Math.min(lowestFolding, pos.getY(i));
  assert.ok(Math.abs(lowestFolding - cut) < 1e-6, `the folding part starts at ${lowestFolding}`);
});

test("a venetian blind is drawn as single slats that turn; shut it is the plain blind; the light follows the slats (#453)", () => {
  const w = info("w", 1, 1.2, 0.9, 2.3);
  const tris = (slats: number | null | undefined, o: Partial<Opening> = {}) =>
    buildOpeningParts([info("w", 1, 1.2, 0.9, 2.3, o)], new Map([["w", { open: 0, tilt: 0, cover: 1, slats }]]), 99).blinds.getAttribute("position").count / 3;
  // a roller shutter and a shut venetian blind: one panel (two triangles)
  assert.equal(tris(undefined), 2);
  assert.equal(tris(null), 2);
  assert.equal(tris(0), 2);
  // open slats: one strip every 7 cm over the 1.4 m of the window, inside the room too
  assert.equal(tris(1), 20 * 2);
  assert.equal(tris(0.5), 20 * 2);
  assert.equal(tris(0.5, { blind_side: "inside" }), 20 * 2);
  // level slats lie flat, half-open ones rise from one edge to the other; outside the outer edge is the low one
  const slat = (slats: number, o: Partial<Opening> = {}) => {
    const pos = buildOpeningParts([info("w", 1, 1.2, 0.9, 2.3, o)], new Map([["w", { open: 0, tilt: 0, cover: 1, slats }]]), 99).blinds.getAttribute("position");
    // vertex 0 is the low edge, vertex 2 the high one
    return { rise: pos.getY(2) - pos.getY(0), lowZ: pos.getZ(0), highZ: pos.getZ(2) };
  };
  assert.ok(Math.abs(slat(1).rise) < 1e-6);
  assert.ok(slat(0.5).rise > 0.03);
  assert.ok(slat(0.5).lowZ < slat(0.5).highZ, "outside: the edge away from the room drops");
  assert.ok(slat(0.5, { blind_side: "inside" }).lowZ > slat(0.5, { blind_side: "inside" }).highZ, "inside: the edge towards the room drops");
  // a blind half way down shows only the slats it has let down
  const half = buildOpeningParts([w], new Map([["w", { open: 0, tilt: 0, cover: 0.5, slats: 1 }]]), 99).blinds.getAttribute("position").count / 6;
  assert.equal(half, 10);
  // light: a blind that is down lets through what its slats leave open
  assert.equal(lightCover({ cover: 1, slats: null }), 1);
  assert.equal(lightCover({ cover: 1, slats: 1 }), 0);
  assert.equal(lightCover({ cover: 0.5, slats: 0.5 }), 0.25);
  assert.equal(lightCover({ cover: null }), 0);
  assert.equal(lightCover(undefined), 0);
  // a garage door never turns into slats
  assert.equal(tris(1, { type: "garage" }) > 0 && tris(1, { type: "garage" }) <= 4, true);
});

test("a blind set to hang inside is a roller shade on the room's side of the wall; outside stays the default (#453)", () => {
  const zs = (o: Partial<Opening>) => {
    const w = info("w", 1, 1.2, 0.9, 2.3, o);
    const pos = buildOpeningParts([w], new Map([["w", { open: 0, tilt: 0, cover: 0.5 }]]), 99).blinds.getAttribute("position");
    return Array.from({ length: pos.count }, (_, i) => pos.getZ(i));
  };
  // the wall's faces lie 12 cm to either side of its axis (z = 0), the room on the +z side
  assert.ok(zs({}).every((z) => z < -0.12), "outside: in front of the outer face");
  assert.ok(zs({ blind_side: "outside" }).every((z) => z < -0.12));
  assert.ok(zs({ blind_side: "inside" }).every((z) => z > 0.12), "inside: in front of the room's face");
  // the cassette sits on the room's side above the opening too
  const frames = (o: Partial<Opening>) => {
    const pos = buildOpeningParts([info("w", 1, 1.2, 0.9, 2.3, o)], new Map([["w", { open: 0, tilt: 0, cover: 0 }]]), 99).frames.getAttribute("position");
    const above: number[] = [];
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 2.3 + 1e-6) above.push(pos.getZ(i));
    return above;
  };
  assert.ok(frames({}).every((z) => z < 0), "outside: the box hangs outside");
  assert.ok(frames({ blind_side: "inside" }).length > 0 && frames({ blind_side: "inside" }).every((z) => z > 0.12 - 1e-6), "inside: the cassette on the room's side");
  // a garage door has no shade inside
  assert.equal(blindInside({ type: "garage", blind_side: "inside" }), false);
  assert.equal(blindInside({ type: "door", blind_side: "inside" }), true);
  assert.equal(blindInside({ type: "window", blind_side: "outside" }), false);
  assert.equal(blindInside({ type: "window" }), false);
});
