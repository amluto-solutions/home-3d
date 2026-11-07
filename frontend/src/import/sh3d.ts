// Sweet Home 3D (.sh3d): a ZIP whose Home.xml describes levels, walls, rooms, doors and windows and furniture in
// centimetres (x to the right, y down the plan – the same way round as Home 3D's x/z). Files saved before
// Sweet Home 3D 5.3 (2016) have no Home.xml: they need opening and saving again in a current version.

import type { Vec2 } from "../model.ts";
import type { RawFloor, RawOpening, RawPlan, RawWall } from "./builder.ts";
import { readZip } from "./zip.ts";
import { findAll, parseXml, type XmlNode } from "./xml.ts";

const num = (n: XmlNode, key: string, def = 0) => {
  const v = parseFloat(n.attrs[key] ?? "");
  return Number.isFinite(v) ? v : def;
};
const cm = (v: number) => v / 100;

/** A wall's centre line; a curved wall (arcExtent) as a few straight pieces along its arc. */
function wallPieces(w: XmlNode, wallHeight: number): RawWall[] {
  const a: Vec2 = [cm(num(w, "xStart")), cm(num(w, "yStart"))];
  const b: Vec2 = [cm(num(w, "xEnd")), cm(num(w, "yEnd"))];
  const thickness = cm(num(w, "thickness", 12));
  const height = cm(num(w, "height", wallHeight));
  const arc = num(w, "arcExtent", 0);
  if (Math.abs(arc) < 1e-3) return [{ a, b, thickness, height }];
  // Sweet Home 3D sweeps a positive extent counter-clockwise on screen (y runs down), which is a falling angle in
  // atan2 terms. The centre lies on the perpendicular bisector, on the left of a->b for a sweep turning left; for a
  // sweep past a half circle it flips to the other side. Rotating a about the centre by the sweep lands on b.
  const sweep = -Math.max(-2 * Math.PI + 1e-3, Math.min(2 * Math.PI - 1e-3, arc));
  const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (chord < 1e-6) return [{ a, b, thickness, height }];
  const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const n: Vec2 = [-(b[1] - a[1]) / chord, (b[0] - a[0]) / chord];
  const off = chord / 2 / Math.tan(sweep / 2);
  const c: Vec2 = [mid[0] + n[0] * off, mid[1] + n[1] * off];
  const radius = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 12)));
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = a0 + (sweep * i) / steps;
    pts.push([c[0] + Math.cos(t) * radius, c[1] + Math.sin(t) * radius]);
  }
  pts[0] = a;
  pts[steps] = b;
  return pts.slice(1).map((p, i) => ({ a: pts[i], b: p, thickness, height }));
}

function openingKind(n: XmlNode): RawOpening["kind"] {
  const text = `${n.attrs.catalogId ?? ""} ${n.attrs.name ?? ""}`.toLowerCase();
  if (/garage/.test(text)) return "garage";
  if (/window|fen[eê]tre|ventana|finestra|raam|velux/.test(text)) return "window";
  if (/door|porte|puerta|porta|deur/.test(text)) return "door";
  return null;
}

export async function readSh3d(bytes: Uint8Array): Promise<RawPlan> {
  const entries = readZip(bytes);
  const home = entries.find((e) => e.name === "Home.xml");
  if (!home) throw new Error(entries.some((e) => e.name === "Home") ? "sh3d_old" : "sh3d_broken");
  const xml = parseXml(new TextDecoder().decode(await home.read()));
  const root = xml.children.find((c) => c.name === "home");
  if (!root) throw new Error("sh3d_broken");
  const wallHeight = num(root, "wallHeight", 250);

  const levels = findAll(root, "level").map((l) => ({
    id: l.attrs.id,
    name: l.attrs.name ?? "",
    elevation: cm(num(l, "elevation")),
    height: cm(num(l, "height", wallHeight)),
    index: num(l, "elevationIndex"),
  }));
  levels.sort((a, b) => a.elevation - b.elevation || a.index - b.index);
  const floors = new Map<string, RawFloor>();
  const floorOf = (n: XmlNode): RawFloor => {
    const id = n.attrs.level ?? "";
    let f = floors.get(id);
    if (!f) {
      const lv = levels.find((l) => l.id === id);
      f = { name: lv?.name ?? "", elevation: lv?.elevation ?? 0, height: lv ? lv.height : cm(wallHeight), rooms: [], walls: [], openings: [], furniture: [] };
      floors.set(id, f);
    }
    return f;
  };
  // levels without anything on them still become floors (an attic drawn later)
  for (const l of levels) floorOf({ name: "level", attrs: { level: l.id }, children: [] });

  for (const w of findAll(root, "wall")) floorOf(w).walls.push(...wallPieces(w, wallHeight));
  for (const r of findAll(root, "room")) {
    const pts = r.children.filter((c) => c.name === "point").map((p) => [cm(num(p, "x")), cm(num(p, "y"))] as Vec2);
    if (pts.length >= 3) floorOf(r).rooms.push({ name: r.attrs.name ?? "", points: pts });
  }
  for (const o of findAll(root, "doorOrWindow")) {
    if (o.attrs.visible === "false") continue;
    floorOf(o).openings.push({
      kind: openingKind(o),
      at: [cm(num(o, "x")), cm(num(o, "y"))],
      width: cm(num(o, "width", 90)),
      height: cm(num(o, "height", 210)),
      sill: cm(num(o, "elevation")),
    });
  }
  for (const name of ["pieceOfFurniture", "light"])
    for (const m of findAll(root, name)) {
      if (m.attrs.visible === "false") continue;
      floorOf(m).furniture.push({
        name: `${m.attrs.name ?? ""} ${m.attrs.catalogId ?? ""}`.trim() || (name === "light" ? "light" : ""),
        x: cm(num(m, "x")),
        z: cm(num(m, "y")),
        w: cm(num(m, "width", 50)),
        d: cm(num(m, "depth", 50)),
        h: cm(num(m, "height", 50)),
        rotation: (num(m, "angle") * 180) / Math.PI,
        y: cm(num(m, "elevation")),
      });
    }

  const list = [...floors.entries()].map(([id, f]) => ({ id, f })).filter(({ f }) => f.rooms.length || f.walls.length);
  list.sort((a, b) => a.f.elevation - b.f.elevation);
  if (!list.length) throw new Error("nothing_found");
  return { source: "Sweet Home 3D", floors: list.map(({ f }) => f), roomsAtInnerFaces: true };
}
