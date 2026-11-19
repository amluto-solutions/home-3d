// Fronts and carcass, parts that follow a colour role, built-in worktops and blue colours in the homely styles (#478;
// ported from NeonPlan 3D 3.5.0, MIT, (c) 2026 Mastershort, to our colour roles).
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { itemColourRoles, type RoleColours } from "../colour-roles.ts";
import { partName } from "../colour-parts.ts";
import { setPacks, type FurniturePack, type PackItem, type PackPart } from "../packs.ts";
import { keepBlue, pushFurniture, pushPackLamp, setLightLook } from "./furniture.ts";
import { setNaturalPalette } from "./palette.ts";
import { GeoBuffer, LineBuffer } from "./geo.ts";

const box = (color: string, extra: Partial<PackPart> = {}): PackPart => ({ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color, ...extra });

/** A pack item of the given parts, so every colour of a drawing belongs to them; returns its furniture type. */
function setItem(...parts: PackPart[]): string {
  setPacks([{ id: "t.f", name: "F", publisher: "t", items: [{ id: "one", name: { en: "One" }, size: [0.6, 0.6, 0.9], parts }] } as FurniturePack]);
  return "pack:t.f:one";
}

function draw(type: string, colors?: RoleColours | null): number[] {
  const f: Furniture = { id: "f", type, x: 0, z: 0, rotation: 0, w: 0.6, d: 0.6, h: 0.9, variant: null, entity: null, power: null, colors };
  const buf = new GeoBuffer();
  pushFurniture(buf, new LineBuffer(), new GeoBuffer(), f);
  return buf.c;
}

/** The drawing of a one-part item in the colours given. */
const drawn = (part: PackPart, colors?: RoleColours | null): number[] => draw(setItem(part), colors);

/** Every look the colours matter in: the neon one and the homely styles (natural palette, light look). */
function eachLook(run: (look: string) => void): void {
  try {
    for (const [look, natural] of [["neon", false], ["homely", true]] as const) {
      setNaturalPalette(natural);
      setLightLook(natural);
      run(look);
    }
  } finally {
    setNaturalPalette(false);
    setLightLook(false);
    setPacks([]);
  }
}

test("fronts are drawn like white until the placed item has a colour for them; a front colour colours the carcass too until it has its own", () => {
  eachLook((look) => {
    const usual = drawn(box("white"));
    assert.deepEqual(drawn(box("front")), usual, `${look}: a front is drawn like white`);
    // a front colour colours the fronts and, with no carcass colour, the white parts as well
    const front = drawn(box("front"), { front: "#445566" });
    assert.notDeepEqual(front, usual, `${look}: the front colour colours the fronts`);
    assert.deepEqual(drawn(box("white"), { front: "#445566" }), front, `${look}: and the carcass, while it has no colour of its own`);
    // a carcass colour colours the white parts only
    const carcass = drawn(box("white"), { white: "#445566" });
    assert.notDeepEqual(carcass, usual, `${look}: the carcass colour colours the white parts`);
    assert.deepEqual(drawn(box("front"), { white: "#445566" }), usual, `${look}: and leaves the fronts`);
    assert.deepEqual(front, carcass, `${look}: a colour gives a front what it gives a white part`);
  });
});

/** The vertex colours as sorted triples, so drawings of a part alone and of the item they are in compare. */
const triples = (c: number[]): string[] => Array.from({ length: c.length / 3 }, (_, i) => c.slice(i * 3, i * 3 + 3).map((v) => v.toFixed(6)).join(",")).sort();

test("an item with fronts and a carcass colours both parts apart", () => {
  eachLook((look) => {
    const carcass = box("white", { h: 0.5 });
    const front = box("front", { y: 0.5, h: 0.5 });
    const colours = { white: "#445566", front: "#aa5533" };
    const both = triples(draw(setItem(carcass, front), colours));
    const apart = triples([...draw(setItem(carcass), colours), ...draw(setItem(front), colours)]);
    assert.deepEqual(both, apart, `${look}: each part has its own colour`);
    assert.notDeepEqual(both, triples(draw(setItem(carcass, front), { white: "#445566" })), `${look}: the fronts have a colour of their own`);
    // a front colour alone colours both, as it always did
    const alone = triples(draw(setItem(carcass, front), { front: "#aa5533" }));
    assert.deepEqual(alone, triples([...draw(setItem(carcass), { front: "#aa5533" }), ...draw(setItem(front), { front: "#aa5533" })]));
    assert.deepEqual(alone, triples(draw(setItem(carcass, front), { white: "#aa5533", front: "#aa5533" })), `${look}: as if both were set to it`);
  });
});

test("a part in a colour of its own follows the role it names once the placed item has a colour for it", () => {
  eachLook((look) => {
    const cover = box("#a02020", { finish: "fabric" });
    const own = drawn(cover);
    assert.notDeepEqual(own, drawn(box("fabric")), `${look}: it keeps its own colour`);
    assert.deepEqual(drawn(cover, { wood: "#112233" }), own, `${look}: another role does not reach it`);
    assert.deepEqual(drawn(cover, { fabric: "#445566" }), drawn(box("fabric"), { fabric: "#445566" }), `${look}: it takes the fabric colour`);
    // a part with a top of its own follows with the top too, not only its sides
    const oak = box("#a02020", { top: "#ff0000", finish: "wood" });
    assert.deepEqual(drawn(oak, { wood: "#334455" }), drawn(box("wood"), { wood: "#334455" }), `${look}: the whole part follows`);
    assert.notDeepEqual(drawn(oak), drawn(box("wood")), `${look}: until then it keeps its sides and top`);
  });
});

test("a pack item's own colourway counts as a colour for the role a part follows", () => {
  eachLook((look) => {
    const type = setItem(box("#a02020", { finish: "fabric" }));
    setPacks([{ id: "t.f", name: "F", publisher: "t", items: [{ id: "one", name: { en: "One" }, size: [0.6, 0.6, 0.9], colors: { fabric: "#445566" }, parts: [box("#a02020", { finish: "fabric" })] } as PackItem] } as FurniturePack]);
    const followed = draw(type);
    setPacks([{ id: "t.f", name: "F", publisher: "t", items: [{ id: "one", name: { en: "One" }, size: [0.6, 0.6, 0.9], colors: { fabric: "#445566" }, parts: [box("fabric")] } as PackItem] } as FurniturePack]);
    assert.deepEqual(followed, draw(type), look);
  });
});

test("the panel lists the rows a pack item's parts ask for: fronts, a carcass beside them, a followed role", () => {
  try {
    const type = setItem(box("white"), box("front"), box("#a02020", { finish: "fabric" }), box("#223344", { top: "#334455" }));
    assert.deepEqual(itemColourRoles(type), ["fabric", "white", "front"]);
    const roles = itemColourRoles(type);
    assert.equal(partName(type, "front", roles), "fronts");
    assert.equal(partName(type, "white", roles), "carcass", "the white parts are the carcass next to fronts");
    // without fronts the white parts keep their old name
    const plain = setItem(box("white"));
    assert.equal(partName(plain, "white", itemColourRoles(plain)), "main");
  } finally {
    setPacks([]);
  }
});

test("a built-in kitchen's, island's and worktop's wood colour takes the whole slab", () => {
  eachLook((look) => {
    for (const type of ["kitchen", "island", "worktop"]) {
      const usual = draw(type);
      const wood = draw(type, { wood: "#8a5a36" });
      const white = draw(type, { white: "#8a5a36" });
      assert.notDeepEqual(wood, usual, `${look} ${type}: wood changes it`);
      assert.equal(wood.length, usual.length);
      // the slab is the only part drawn in the white role: wood or white colours the same triangles the same way
      assert.deepEqual(wood, white, `${look} ${type}: the slab takes the wood colour as it takes white`);
      // and the wood colour wins where both are set
      assert.deepEqual(draw(type, { wood: "#8a5a36", white: "#223344" }), wood, `${look} ${type}: wood before white`);
      // the carcass keeps its own colour
      assert.notDeepEqual(draw(type, { body: "#8a5a36" }), wood, `${look} ${type}: body colours the carcass`);
      assert.ok(itemColourRoles(type).includes("wood"), `${type} offers the wood row`);
    }
    // an older plan's white colour still colours the slab
    assert.notDeepEqual(draw("worktop", { white: "#8a5a36" }), draw("worktop"));
  });
});

test("a pack lamp's body follows the placed item's colours; its glowing parts keep the light's colour", () => {
  eachLook((look) => {
    const body = box("white", { h: 0.5 });
    const glow = box("white", { y: 0.5, h: 0.5, glow: true });
    const lamp = (colors: RoleColours | undefined, ...parts: PackPart[]) => {
      const item = { id: "lamp", name: { en: "Lamp" }, size: [0.3, 0.3, 0.5], light: "table", parts } as unknown as PackItem;
      const buf = new GeoBuffer();
      pushPackLamp(buf, item, { x: 0, z: 0, rotation: 0, w: 0.3, d: 0.3, h: 0.5, colors }, 0, 0x336699);
      return buf.c;
    };
    const colours = { white: "#aa5533" };
    assert.notDeepEqual(lamp(colours, body), lamp(undefined, body), `${look}: the body takes the colour`);
    assert.deepEqual(lamp(colours, glow), lamp(undefined, glow), `${look}: the glow keeps the light's colour`);
    assert.deepEqual(triples(lamp(colours, body, glow)), triples([...lamp(colours, body), ...lamp(colours, glow)]), `${look}: both in one lamp`);
  });
});

/** The shader's test on every colour a triangle can show, interpolated: dark and blue far over red and green. */
function greyHits(c: number[]): number {
  let hits = 0;
  for (let t = 0; t + 8 < c.length; t += 9) {
    for (let i = 0; i <= 8; i++) {
      for (let j = 0; j <= 8 - i; j++) {
        const [a, b, d] = [i / 8, j / 8, 1 - i / 8 - j / 8];
        const at = (k: number) => c[t + k] * a + c[t + 3 + k] * b + c[t + 6 + k] * d;
        const [r, g, blue] = [at(0), at(1), at(2)];
        if (Math.max(r, g, blue) < 0.2 && blue > r * 2 && blue > g * 1.5) hits++;
      }
    }
  }
  return hits;
}

test("blue colours never fall into the styles' navy-to-grey rule on a rounded part's darker faces", () => {
  try {
    setNaturalPalette(true);
    setLightLook(true);
    // the rule did take the darker faces of rounded and round parts (before the guard: some dozens of colours each)
    for (const shape of ["rbox", "sphere", "box", "cyl", "lathe"] as const) {
      for (const role of ["front", "white", "fabric"] as const) {
        const part = box(role, { shape, round: 0.2, profile: [[1, 0], [0.5, 1]] });
        for (const hex of ["#5d7590", "#2e3f66", "#17274a", "#2f63b5"]) assert.equal(greyHits(drawn(part, { [role]: hex })), 0, `${shape} ${role} ${hex}`);
      }
    }
  } finally {
    setNaturalPalette(false);
    setLightLook(false);
    setPacks([]);
  }
});

test("other colours are drawn exactly as before: the guard touches dark blue vertices only", () => {
  const c = [0.1, 0.2, 0.6, 0.02, 0.03, 0.14, 0.5, 0.4, 0.3, 0.9, 0.9, 0.95, 0.1, 0.1, 0.1];
  const before = [...c];
  keepBlue(c, 0);
  assert.ok(c[4] > before[4], "the dark blue gets green");
  assert.ok(c[5] / c[4] < 1.5, "and the rule no longer takes it");
  for (const k of [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) assert.equal(c[k], before[k], `channel ${k} stays`);
  // a bright blue stays; only from the offset on
  const d = [0.02, 0.03, 0.14, 0.02, 0.03, 0.14];
  keepBlue(d, 3);
  assert.deepEqual(d.slice(0, 3), [0.02, 0.03, 0.14]);
  assert.ok(d[4] > 0.03);
});
