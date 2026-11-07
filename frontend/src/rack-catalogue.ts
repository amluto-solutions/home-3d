// The empty racks of the bundled IT & network pack (`amluto.it`, #112): each entry is the rack's spec, its
// external size and its library words; rackItem() turns one into the pack item with its frame drawn by
// rackFrameParts(). tools/rack-frames.ts writes the files, and a test keeps the files and this list the same. The
// rack frames catalogue (#116) grows this list. Sizes in metres (W x D x H, external).

import type { PackItem } from "./packs.ts";
import { rackFrameParts, readRackFrame, type RackFrameSpec } from "./rack-frame.ts";

export interface RackEntry {
  id: string;
  name: string;
  size: [number, number, number];
  mount: "floor" | "surface" | "wall";
  wall_y?: number;
  rack_frame: RackFrameSpec;
  family: string;
  variant: string;
  room: string[];
  tags: string[];
}

const MINI_ROOMS = ["office", "hobby", "loft"];
const WALL_ROOMS = ["office", "garage", "utility", "loft", "hall"];
const FLOOR_ROOMS = ["office", "garage", "utility", "loft"];
const MINI_TAGS = ["10 inch", "mini rack", "homelab", "desktop rack", "rack"];
const DESK_TAGS = ["19 inch", "desktop rack", "open frame", "2 post", "rack"];
const WALLF_TAGS = ["19 inch", "open frame", "wall rack", "2 post", "rack"];
const WALLC_TAGS = ["19 inch", "data cabinet", "comms cabinet", "wall rack", "server rack", "rack"];
const FLOORC_TAGS = ["19 inch", "server cabinet", "data cabinet", "server rack", "rack"];

/** A catalogue entry whose variant is its U count. */
function r(id: string, name: string, size: [number, number, number], mount: RackEntry["mount"], rack_frame: RackFrameSpec, family: string, room: string[], tags: string[], wallY?: number): RackEntry {
  return { id, name, size, mount, ...(wallY !== undefined ? { wall_y: wallY } : {}), rack_frame, family, variant: `${rack_frame.u}U`, room, tags };
}

export const RACKS: RackEntry[] = [
  {
    // a 10" desktop mini rack (DeskPi RackMate class: 280 x 200 footprint)
    id: "rack_mini_10in_6u",
    name: "Mini rack 10-inch 6U",
    size: [0.28, 0.2, 0.32],
    mount: "surface",
    rack_frame: { u: 6, form: "frame4", width: 10 },
    family: "rack_mini",
    variant: "6U",
    room: ["office", "hobby", "loft"],
    tags: ["10 inch", "mini rack", "homelab", "desktop rack", "server rack", "rack"],
  },
  {
    // a 19" 9U wall cabinet, 600 x 450, glass door (9U = 400 mm of rails in a 500 mm cabinet)
    id: "rack_wall_cabinet_9u",
    name: "Wall cabinet 19-inch 9U",
    size: [0.6, 0.45, 0.5],
    mount: "wall",
    wall_y: 1.2,
    rack_frame: { u: 9, form: "wall_cabinet", door: "glass" },
    family: "rack_wall_cabinet",
    variant: "9U",
    room: ["office", "garage", "utility", "loft", "hall"],
    tags: ["19 inch", "data cabinet", "comms cabinet", "wall rack", "server rack", "rack"],
  },
  {
    // a 19" 42U floor cabinet, 600 x 1000 x 2050 (42U = 1867 mm of rails), mesh door, on a 100 mm plinth
    id: "rack_floor_cabinet_42u",
    name: "Floor cabinet 19-inch 42U",
    size: [0.6, 1.0, 2.05],
    mount: "floor",
    rack_frame: { u: 42, form: "cabinet", door: "mesh", bottom: 0.1 },
    family: "rack_floor_cabinet",
    variant: "42U",
    room: ["office", "garage", "utility", "loft"],
    tags: ["19 inch", "server cabinet", "data cabinet", "server rack", "42u", "rack"],
  },
  // ---- the rest of the catalogue (#116): sizes and sources in docs/rack-frames.md
  // 10-inch desktop racks
  r("rack_mini_10in_4u", "Mini rack 10-inch 4U", [0.28, 0.2, 0.274], "surface", { u: 4, form: "frame4", width: 10 }, "rack_mini", MINI_ROOMS, MINI_TAGS),
  r("rack_mini_10in_8u", "Mini rack 10-inch 8U", [0.28, 0.2, 0.406], "surface", { u: 8, form: "frame4", width: 10 }, "rack_mini", MINI_ROOMS, MINI_TAGS),
  // 10-inch wall racks
  r("rack_wall_frame_10in_6u", "Wall frame 10-inch 6U", [0.28, 0.3, 0.322], "wall", { u: 6, form: "wall_frame", width: 10 }, "rack_wall_frame_10in", WALL_ROOMS, ["10 inch", "open frame", "wall rack", "homelab", "rack"], 1.2),
  // wall brackets and mini-rack mounts (#122): open 10-inch frames, the 6U above is the family's middle size
  r("rack_wall_frame_10in_4u", "Wall frame 10-inch 4U", [0.28, 0.3, 0.233], "wall", { u: 4, form: "wall_frame", width: 10 }, "rack_wall_frame_10in", WALL_ROOMS, ["10 inch", "open frame", "wall rack", "mini rack mount", "homelab", "rack"], 1.3),
  r("rack_wall_frame_10in_9u", "Wall frame 10-inch 9U", [0.28, 0.3, 0.455], "wall", { u: 9, form: "wall_frame", width: 10 }, "rack_wall_frame_10in", WALL_ROOMS, ["10 inch", "open frame", "wall rack", "mini rack mount", "homelab", "rack"], 1.1),
  r("rack_wall_cabinet_10in_6u", "Wall cabinet 10-inch 6U", [0.28, 0.31, 0.336], "wall", { u: 6, form: "wall_cabinet", width: 10, door: "glass" }, "rack_wall_cabinet_10in", WALL_ROOMS, ["10 inch", "mini cabinet", "wall rack", "homelab", "rack"], 1.2),
  r("rack_wall_cabinet_10in_9u", "Wall cabinet 10-inch 9U", [0.28, 0.31, 0.469], "wall", { u: 9, form: "wall_cabinet", width: 10, door: "glass" }, "rack_wall_cabinet_10in", WALL_ROOMS, ["10 inch", "mini cabinet", "wall rack", "homelab", "rack"], 1.2),
  // 19-inch desktop open frames (2-post)
  r("rack_desktop_frame_6u", "Desktop rack frame 19-inch 6U", [0.508, 0.292, 0.33], "surface", { u: 6, form: "frame2" }, "rack_desktop_frame", MINI_ROOMS, DESK_TAGS),
  r("rack_desktop_frame_9u", "Desktop rack frame 19-inch 9U", [0.504, 0.292, 0.451], "surface", { u: 9, form: "frame2" }, "rack_desktop_frame", MINI_ROOMS, DESK_TAGS),
  r("rack_desktop_frame_12u", "Desktop rack frame 19-inch 12U", [0.504, 0.292, 0.584], "surface", { u: 12, form: "frame2" }, "rack_desktop_frame", MINI_ROOMS, DESK_TAGS),
  // 19-inch wall frames
  r("rack_wall_frame_6u", "Wall frame 19-inch 6U", [0.555, 0.457, 0.407], "wall", { u: 6, form: "wall_frame" }, "rack_wall_frame", WALL_ROOMS, WALLF_TAGS, 1.2),
  r("rack_wall_frame_9u", "Wall frame 19-inch 9U", [0.551, 0.457, 0.541], "wall", { u: 9, form: "wall_frame" }, "rack_wall_frame", WALL_ROOMS, WALLF_TAGS, 1.1),
  r("rack_wall_frame_12u", "Wall frame 19-inch 12U", [0.504, 0.305, 0.641], "wall", { u: 12, form: "wall_frame" }, "rack_wall_frame", WALL_ROOMS, WALLF_TAGS, 1.0),
  // 19-inch wall cabinets, 600 x 450, glass door (the 9U is above)
  r("rack_wall_cabinet_4u", "Wall cabinet 19-inch 4U", [0.6, 0.45, 0.29], "wall", { u: 4, form: "wall_cabinet", door: "glass" }, "rack_wall_cabinet", WALL_ROOMS, WALLC_TAGS, 1.3),
  r("rack_wall_cabinet_6u", "Wall cabinet 19-inch 6U", [0.6, 0.45, 0.379], "wall", { u: 6, form: "wall_cabinet", door: "glass" }, "rack_wall_cabinet", WALL_ROOMS, WALLC_TAGS, 1.3),
  r("rack_wall_cabinet_12u", "Wall cabinet 19-inch 12U", [0.6, 0.45, 0.645], "wall", { u: 12, form: "wall_cabinet", door: "glass" }, "rack_wall_cabinet", WALL_ROOMS, WALLC_TAGS, 1.0),
  r("rack_wall_cabinet_15u", "Wall cabinet 19-inch 15U", [0.6, 0.45, 0.774], "wall", { u: 15, form: "wall_cabinet", door: "glass" }, "rack_wall_cabinet", WALL_ROOMS, WALLC_TAGS, 0.9),
  // 19-inch wall cabinets, deep (600 x 600)
  r("rack_wall_cabinet_deep_9u", "Wall cabinet 19-inch deep 9U", [0.6, 0.6, 0.512], "wall", { u: 9, form: "wall_cabinet", door: "glass" }, "rack_wall_cabinet_deep", WALL_ROOMS, WALLC_TAGS, 1.2),
  r("rack_wall_cabinet_deep_15u", "Wall cabinet 19-inch deep 15U", [0.6, 0.6, 0.774], "wall", { u: 15, form: "wall_cabinet", door: "glass" }, "rack_wall_cabinet_deep", WALL_ROOMS, WALLC_TAGS, 0.9),
  // floor cabinets (the 42U is above), on castors or a plinth
  r("rack_floor_cabinet_18u", "Floor cabinet 19-inch 18U", [0.6, 0.6, 0.973], "floor", { u: 18, form: "cabinet", door: "glass", bottom: 0.1 }, "rack_floor_cabinet", FLOOR_ROOMS, FLOORC_TAGS),
  r("rack_floor_cabinet_22u", "Floor cabinet 19-inch 22U", [0.6, 0.6, 1.159], "floor", { u: 22, form: "cabinet", door: "glass", bottom: 0.1 }, "rack_floor_cabinet", FLOOR_ROOMS, FLOORC_TAGS),
  r("rack_floor_cabinet_27u", "Floor cabinet 19-inch 27U", [0.6, 0.6, 1.381], "floor", { u: 27, form: "cabinet", door: "glass", bottom: 0.1 }, "rack_floor_cabinet", FLOOR_ROOMS, FLOORC_TAGS),
  r("rack_floor_cabinet_32u", "Floor cabinet 19-inch 32U", [0.6, 0.8, 1.603], "floor", { u: 32, form: "cabinet", door: "mesh", bottom: 0.1 }, "rack_floor_cabinet", FLOOR_ROOMS, FLOORC_TAGS),
  r("rack_floor_cabinet_wide_42u", "Floor cabinet 19-inch wide 42U", [0.8, 1.0, 2.0475], "floor", { u: 42, form: "cabinet", door: "mesh", bottom: 0.1 }, "rack_floor_cabinet_wide", FLOOR_ROOMS, FLOORC_TAGS),
  r("rack_floor_cabinet_deep_47u", "Floor cabinet 19-inch deep 47U", [0.8, 1.2, 2.35], "floor", { u: 47, form: "cabinet", door: "glass", bottom: 0.1 }, "rack_floor_cabinet_deep", FLOOR_ROOMS, FLOORC_TAGS),
  // free-standing open frames (4-post), relay racks (2-post) and an AV rack
  r("rack_open_frame_22u", "Open frame rack 19-inch 22U", [0.6, 0.8, 1.229], "floor", { u: 22, form: "frame4", bottom: 0.1 }, "rack_open_frame", FLOOR_ROOMS, ["19 inch", "open frame", "4 post", "server rack", "rack"]),
  r("rack_open_frame_42u", "Open frame rack 19-inch 42U", [0.604, 1.048, 2.04], "floor", { u: 42, form: "frame4", bottom: 0.05 }, "rack_open_frame", FLOOR_ROOMS, ["19 inch", "open frame", "4 post", "server rack", "42u", "rack"]),
  r("rack_relay_25u", "Relay rack 19-inch 25U", [0.597, 0.6, 1.252], "floor", { u: 25, form: "frame2", bottom: 0.1 }, "rack_relay", FLOOR_ROOMS, ["19 inch", "relay rack", "2 post", "telco rack", "rack"]),
  r("rack_relay_42u", "Relay rack 19-inch 42U", [0.597, 0.6, 2.008], "floor", { u: 42, form: "frame2", bottom: 0.1 }, "rack_relay", FLOOR_ROOMS, ["19 inch", "relay rack", "2 post", "telco rack", "42u", "rack"]),
  r("rack_av_console_12u", "AV rack 19-inch 12U", [0.543, 0.6, 0.785], "floor", { u: 12, form: "cabinet", door: "none", bottom: 0.1 }, "rack_av_console", ["living", "office", "hobby", "garage"], ["19 inch", "av rack", "av console", "audio rack", "contractor rack", "rack"]),
];

/** The pack item of a catalogue entry, its frame drawn from its spec. */
export function rackItem(entry: RackEntry): PackItem {
  const base = { size: entry.size, mount: entry.mount, rack_frame: entry.rack_frame };
  const frame = readRackFrame(base);
  if (!frame) throw new Error(`${entry.id}: the rack frame breaks the rules`);
  const { parts, symbol } = rackFrameParts(frame, entry.size);
  return {
    id: entry.id,
    name: { en: entry.name },
    size: entry.size,
    group: "network",
    room: entry.room,
    tags: entry.tags,
    family: entry.family,
    variant: { en: entry.variant },
    mount: entry.mount,
    ...(entry.wall_y !== undefined ? { wall_y: entry.wall_y } : {}),
    rack_frame: entry.rack_frame,
    parts,
    symbol,
  };
}

/** An item file in the bundled packs' style: one field per line, one part or symbol shape per line. */
export function rackItemFile(item: PackItem): string {
  const lines = Object.entries(item).map(([key, value]) => {
    if (Array.isArray(value) && value.length && typeof value[0] === "object") {
      return `  ${JSON.stringify(key)}: [\n${value.map((v) => `    ${JSON.stringify(v).replace(/,"/g, ', "').replace(/":/g, '": ')}`).join(",\n")}\n  ]`;
    }
    const text = Array.isArray(value) ? `[${value.map((v) => JSON.stringify(v)).join(", ")}]` : JSON.stringify(value);
    return `  ${JSON.stringify(key)}: ${text.replace(/,"/g, ', "').replace(/":/g, '": ')}`;
  });
  return `{\n${lines.join(",\n")}\n}\n`;
}
