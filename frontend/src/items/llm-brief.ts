// The brief for an LLM (#14): a short, self-contained description of the item format that the item editor copies,
// so someone can ask ChatGPT, Claude or Gemini to design an item and paste the answer back into the editor. It is
// written from the lists and limits in item-format.ts (a test holds them equal to the backend's schema in packs.py)
// and the library's sections and rooms (vocabulary.ts), so it says what the import checks. Pure text, no DOM.

import roundSideTable from "../../../custom_components/home_3d/bundled_packs/amluto.living/table/round_side_table_40.json" with { type: "json" };
import vase from "../../../custom_components/home_3d/bundled_packs/amluto.decor/vase/vase.json" with { type: "json" };
import { ITEM_FORMAT, type COLOUR_ROLES, type PART_SHAPES } from "../item-format.ts";
import { englishTable } from "../i18n.ts";

// the brief is English, whatever language the page is in; it names the editor's buttons as the English page shows them
const english = englishTable();

/** Two bundled items to learn from: lofted legs with fixed measures on a table, and a lathe. */
const EXAMPLES: [string, Record<string, unknown>][] = [
  ["A round side table (cylinders for the top and shelf, splayed lofts for the legs, fixed measures)", roundSideTable],
  ["A vase (one lathe)", vase],
];

const FENCE = "```";

/** An example as an LLM should write it: one part per line, without the family of variants a pack groups it in. */
function exampleJson(item: Record<string, unknown>): string {
  const { family: _f, variant: _v, parts, ...rest } = item;
  const head = JSON.stringify(rest).slice(0, -1);
  const lines = (parts as unknown[]).map((p) => `  ${JSON.stringify(p)}`).join(",\n");
  return `${head},"parts":[\n${lines}\n]}`;
}

/** What each shape is: a new shape breaks the build until it has a line here. */
const SHAPES: Record<(typeof PART_SHAPES)[number], string> = {
  box: "a box filling the part's box.",
  cyl: 'a cylinder, upright; its diameter is the smaller of w and d. With "axis": "x" or "z" it lies down along that axis (wheels, rollers, pipes, rails).',
  loft: 'a box whose top face is another rectangle: "tx", "tz" give its centre and "tw", "td" its size (same ranges as x, z, w, d; default: the bottom\'s). For sloped or tapered things: lamp shades, splayed legs, bonnets.',
  sphere: "a ball filling the part's box, squashed when w, d and h differ (knobs, globe lamps, pouffes).",
  lathe: `a "profile" turned around the part's upright axis (vases, bowls, lamp bases, planters). The profile is 2 to ${ITEM_FORMAT.maxProfilePoints} points [radius, height], each ${range(ITEM_FORMAT.level)}: radius 1 touches the part's box, 0 is the axis; height 0 is the part's bottom, 1 its top. Write them from the bottom up the outside, like the right half of the silhouette; for a bowl go up the outside, over the rim and down the inside. A lathe must have a profile, and only a lathe may have one.`,
  rbox: `a box with rounded edges (cushions, mattresses, appliances, soft seats); optional "round" ${range(ITEM_FORMAT.round)} of its shortest side (default 0.2; 0.5 is fully round). Only an rbox or a shell may have "round".`,
  shell: `a curved body (car bodies, boats). "side" (required, shell only): 2 to ${ITEM_FORMAT.maxShellPoints} stations [z, bottom, top], each ${range(ITEM_FORMAT.level)}, z from the part's back (0) to its front (1), never going down. Optional "plan": [z, width] points (width of the part's, default 1), "round" (default 0.25) and "taper" ${range(ITEM_FORMAT.taper)} (top width against the bottom). Smooth curves join the stations. Windows: a second shell in "glass".`,
};

/** What each colour role is for: a new role breaks the build until it has a line here. */
const ROLES: Record<(typeof COLOUR_ROLES)[number], string> = {
  body: "the main painted or laminate body",
  fabric: "upholstery, rugs, curtains",
  cushion: "seat and back cushions, pillows",
  wood: "wood",
  white: "white ceramics, white goods, white plastic",
  metal: "steel, chrome, brass, handles",
  dark: "black parts, screens, rubber, shadows",
  glass: "glass (drawn see-through)",
  plant: "leaves",
  pot: "plant pots, ceramics, terracotta",
  accent: "a highlight colour: buttons, LEDs, a coloured detail",
  paint: "the paint of a vehicle body, which the owner can change to any car colour",
};

function range([lo, hi]: readonly [number, number]): string {
  return `${lo} to ${hi}`;
}

const list = (ids: readonly string[]): string => ids.map((id) => `"${id}"`).join(", ");

/** The library's sections and rooms (vocabulary.ts KINDS and ROOMS; the panel passes them to the item editor). */
export interface BriefLibrary {
  kinds: readonly string[];
  rooms: readonly string[];
}

/** The brief an editor copies for an LLM. */
export function llmBrief({ kinds, rooms }: BriefLibrary): string {
  const f = ITEM_FORMAT;
  return `You design one item (a piece of furniture or another thing in a home) for Home 3D, a 3D floor plan for Home Assistant. Ask me what the item is if I have not said, then answer with the item.

ANSWER
Answer with ONE JSON object and nothing else: no explanation, no comments, no trailing commas. If I ask for several items, answer with one JSON list of those objects instead ([{...}, {...}]). I paste it into Home 3D's item editor (${english.ie_paste} → ${english.ie_paste_import}), or save it as <id>.json for "${english.ie_import}"; the editor checks it against the rules below, and it must import as it is.

THE ITEM
- "id" (required): 1 to 40 characters: lower-case letters, digits, "_", "." and "-", starting with a letter or a digit. Make it from the name ("Oak wall shelf" → "oak_wall_shelf").
- "name" (required): the name by language code, at least English: {"en": "Oak wall shelf"}. 1 to ${f.maxNameLength} characters, a readable name in UK English (Wardrobe, Hob, Worktop), not a product name.
- "size" (required): the real size in metres as [width, depth, height], each ${range(f.metres)}. Width runs left to right as you face the item's front, depth from back to front.
- "parts" (required): 1 to ${f.maxParts} parts (see PARTS). 5 to 30 is usually right; keep it low-poly.
- "group": what it is, its section in the library: ${list(kinds)}.
- "room": up to ${f.maxRooms} rooms it is made for: ${list(rooms)}. Leave it out for any room.
- "tags": up to ${f.maxTags} more search words, 1 to ${f.maxTagLength} characters each.
- "mount": where it sits: ${list(f.mounts)}. "floor" is the default; "surface" stands on the item below it (a lamp on a table); "wall" hangs on a wall with its bottom "wall_y" metres above the floor (${range(f.wallY)}, default 1); "ceiling" hangs from the ceiling.
- "surface": true when its top carries other items (tables, worktops, sideboards).
- "electric": true when it can be linked to a switch and a power sensor (appliances, lamps, TVs).
- "light": for a lamp, how its light spreads: ${list(f.lights)}.
- "ikea": the IKEA product name, only if it is one ("KALLAX").
No other fields are allowed, in the item or in a part. Leave out any optional field you do not need.

PARTS
Every measure of a part is a fraction of the item's size, so the item can be resized in the plan:
- "x", "z": the part's centre across and in depth, ${range(f.centre)}. x 0.5 is the right edge, z 0.5 is the FRONT edge, z -0.5 the back (against the wall).
- "w", "d", "h": the part's width, depth and height, ${range(f.extent)} (1 is the item's whole width, depth or height).
- "y": the part's bottom, ${range(f.level)} of the item's height (0 is the floor). Keep y + h at most 1 and every part inside the item's box: x ± w/2 and z ± d/2 within -0.5 to 0.5.
- "shape": one of:
${f.shapes.map((s) => `  - "${s}": ${SHAPES[s]}`).join("\n")}
- "color": a colour role (preferred: the plan's theme colours it) or "#rrggbb" for a fixed colour. Roles:
${f.colourRoles.map((r) => `  - "${r}": ${ROLES[r]}`).join("\n")}
- "top": another colour (role or "#rrggbb") for the part's top face.
- "fix": the measures the part KEEPS when the item is resized: "w", "d", "h" or several ("wd", "wdh"). Legs keep "wd", table tops, shelves and plinths keep "h", handles keep "wdh". Parts without fix (the carcass, a seat) stretch between them.
- "rot": a turn of the part around its own upright axis in degrees (${range(f.rot)}), for diagonal struts or spiral steps.
- "glow": true for the part of a lamp that lights up (shade, bulb).
- "screen": true for a TV or monitor screen; its front (+z) shows the picture.
- "edges": true, "glow" or "faint" draws outlines; rarely needed.

GOOD ITEMS
- Parts touch or overlap; nothing floats. Legs stand on y 0, a top sits on its legs.
- Use the real proportions of the thing; fractions are of the item's own size, so a 2 cm top on a 75 cm table is h 0.027.
- Put the front (doors, drawers, the screen, the seat) towards +z.

EXAMPLES (items Home 3D ships with)
${EXAMPLES.map(([what, item]) => `${what}:\n${FENCE}json\n${exampleJson(item)}\n${FENCE}`).join("\n\n")}
`;
}
