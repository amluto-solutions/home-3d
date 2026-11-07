// The furniture library's index: every item the editor can place (the built-in kinds and the installed packs'
// items), sorted by what it is (a sofa, a table, a lamp …) and which rooms it belongs to, with families of
// variants (a dining table in 120, 160 and 200) folded into one card. Packs may say all this themselves
// (group, room, family, variant – pack format fields since 1.23); older packs and the built-in kinds are
// classified here by their ids and names. Pure logic, no DOM: see library-index.test.ts.

import { FURNITURE_GROUPS, LAMP_TYPES } from "./model.ts";
import { fuzzyEquals } from "./fuzzy.ts";
import { isElectric, packItemName, packName, packType, type FurniturePack, type PackItemInfo } from "./packs.ts";
import { isVocabularyWord, KIND_WORDS, KINDS, ROOMS, synonymWords, type Kind, type Room } from "./vocabulary.ts";

export { KINDS, ROOMS, type Kind, type Room };

export interface LibraryEntry {
  /** The furniture type to place (a built-in kind or "pack:<pack>:<item>"). */
  type: string;
  /** Identifies the entry in the library (the type, or the type + "#m" for a mirrored twin). */
  key: string;
  /** Placed mirrored (the twin of an item that comes left-handed only: the corner sofa for the other side). */
  mirror?: boolean;
  label: string;
  /** Every word that finds it (names in all languages, the id, the pack's name, the kind). */
  search: string;
  /** The item's own words (names, id, tags, IKEA name and their synonyms): the part of `search` that ranks above the kind's and the pack's words. */
  tags: string;
  kind: Kind;
  rooms: Room[];
  /** Links an entity (a power sensor, a switch, a light). */
  electric: boolean;
  light: boolean;
  outdoor: boolean;
  /** Metres: width, depth, height. */
  size: [number, number, number];
  /** The pack it comes from (null for a built-in kind) and its name for the card. */
  pack: string | null;
  packLabel: string | null;
  packRelease: number;
  /** Variants of one thing share a family within their pack; the variant names the chip. */
  family: string | null;
  variant: string | null;
  /** The IKEA product name of a pack item ("KALLAX"), searchable beside the readable name; null for the rest. */
  ikea: string | null;
}

/** One card of the library: an item, or a family with its variants (the first is the card's picture). */
export interface LibraryCard {
  key: string;
  label: string;
  kind: Kind;
  rooms: Room[];
  entries: LibraryEntry[];
}

// ---------------------------------------------------------------------------------------------- built-in kinds

const BASIC: Record<string, [Kind, Room[]]> = {
  lamp_ceiling: ["lamp", []],
  lamp_downlight: ["lamp", []],
  lamp_spot: ["lamp", []],
  lamp_panel: ["lamp", []],
  lamp_pendant: ["lamp", []],
  lamp_fan: ["lamp", []],
  lamp_floor: ["lamp", ["living", "bedroom", "office", "conservatory"]],
  lamp_uplight: ["lamp", ["living", "bedroom", "office"]],
  lamp_table: ["lamp", ["living", "bedroom", "office", "conservatory"]],
  lamp_wall: ["lamp", []],
  led_strip: ["lamp", []],
  lamp_bollard: ["lamp", ["garden"]],
  lamp_garden: ["lamp", ["garden"]],
  radiator: ["heating", []],
  ac_unit: ["heating", []],
  sofa: ["sofa", ["living", "conservatory"]],
  sofa_l: ["sofa", ["living"]],
  sofa_u: ["sofa", ["living"]],
  armchair: ["seating", ["living", "bedroom", "office", "conservatory"]],
  stool: ["seating", ["living", "bath", "kids"]],
  coffee_table: ["table", ["living", "conservatory"]],
  tv_board: ["media", ["living", "bedroom"]],
  tv_wall: ["media", ["living", "bedroom"]],
  sideboard: ["storage", ["living", "dining", "hall"]],
  shelf: ["storage", ["living", "office", "kids", "utility", "garage", "loft"]],
  plant: ["plant", []],
  rug: ["deco", ["living", "bedroom", "kids", "hall", "conservatory"]],
  table: ["table", ["dining", "kitchen", "living", "conservatory"]],
  table_round: ["table", ["dining", "kitchen", "living", "conservatory"]],
  chair: ["seating", ["dining", "kitchen", "living", "conservatory"]],
  bench: ["seating", ["dining", "kitchen", "hall", "garden"]],
  corner_bench: ["seating", ["dining", "kitchen"]],
  bar_stool: ["seating", ["kitchen", "dining"]],
  kitchen: ["kitchen", ["kitchen"]],
  kitchen_wall: ["kitchen", ["kitchen"]],
  kitchen_tall: ["kitchen", ["kitchen"]],
  island: ["kitchen", ["kitchen"]],
  worktop: ["kitchen", ["kitchen", "utility", "garage"]],
  sink: ["kitchen", ["kitchen", "utility"]],
  stove: ["appliance", ["kitchen"]],
  dishwasher: ["appliance", ["kitchen"]],
  fridge: ["appliance", ["kitchen", "utility"]],
  fridge_smart: ["appliance", ["kitchen"]],
  bed: ["bed", ["bedroom", "kids"]],
  bunk_bed: ["bed", ["kids", "bedroom"]],
  nightstand: ["storage", ["bedroom", "kids"]],
  wardrobe: ["storage", ["bedroom", "kids", "hall"]],
  dresser: ["storage", ["bedroom", "kids", "hall"]],
  bathtub: ["bath", ["bath"]],
  shower: ["bath", ["bath"]],
  wc: ["bath", ["bath"]],
  washbasin: ["bath", ["bath"]],
  washer: ["appliance", ["bath", "utility"]],
  dryer: ["appliance", ["bath", "utility"]],
  desk: ["office", ["office", "kids", "bedroom"]],
  office_chair: ["office", ["office", "kids"]],
  tall_cabinet: ["storage", ["office", "hall", "utility", "bath", "loft"]],
  coat_rack: ["household", ["hall"]],
  stairs: ["stairs", ["hall", "living"]],
  stairs_u: ["stairs", ["hall", "living"]],
  stairwell: ["stairs", ["hall", "living"]],
  loft_ladder: ["stairs", ["garage", "hall", "loft"]],
  robot_vacuum: ["appliance", []],
  inverter: ["energy", ["utility", "garage"]],
  home_battery: ["energy", ["utility", "garage"]],
  wallbox: ["energy", ["garage"]],
  meter: ["energy", ["utility", "garage"]],
  grid_point: ["energy", ["utility"]],
  pool_pump: ["outdoor", ["utility", "garage", "garden"]],
  pool_filter: ["outdoor", ["utility", "garage", "garden"]],
  pool_heat_pump: ["outdoor", ["garden", "utility"]],
  pool_dosing: ["outdoor", ["utility", "garage"]],
  pool_valve: ["outdoor", ["utility", "garage"]],
  parking: ["vehicle", ["garage"]],
  awning: ["outdoor", ["garden"]],
  waste_bin: ["household", ["garden", "garage", "utility"]],
  mailbox: ["household", ["garden", "hall"]],
  wall_switch: ["tech", []],
  wall_socket: ["tech", []],
  wifi_ap: ["network", []],
  water_heater: ["heating", ["utility", "bath", "garage", "loft"]],
};

/** The built-in kinds the library offers (the pool devices stand in the pool module's tools, energy devices in the energy tool). */
export function basicTypes(extra: string[] = []): string[] {
  const shown = new Set<string>(Object.values(FURNITURE_GROUPS).flat());
  for (const t of extra) shown.add(t);
  return [...shown].filter((t) => t in BASIC);
}

// ---------------------------------------------------------------------------------------------- classification

/** Which room a pack is made for, by its id; the items' words may say otherwise. */
const PACK_ROOMS: Record<string, Room[]> = {
  living: ["living"],
  kitchen: ["kitchen"],
  bedroom: ["bedroom"],
  bath: ["bath"],
  kids: ["kids"],
  office: ["office"],
  garage: ["garage"],
  garden: ["garden"],
  utility: ["utility"],
  cinema: ["living", "hobby"],
  fitness: ["hobby"],
  conservatory: ["conservatory"],
  loft: ["loft"],
  stairs: ["hall"],
  vehicles: ["garage"],
  pets: [],
  smarthome: [],
  architecture: [],
  fun_halloween: [],
  fun_seasons: [],
  fun_pets: [],
};

/** A rule: its words, the kind, the rooms (null: the pack's), and whether it reads the name's head only. */
type Rule = [RegExp, Kind, Room[] | null, boolean?];
/** Words that say what an item is; the first rule that matches wins, so the specific ones stand first. */
const RULES: Rule[] = [
  // vehicles and pets before anything else: "cat tree" is no plant, "campervan" no kitchen
  [/\b(van|estate|suv|compact car|sedan|coup|cabrio|convertible|city ev|minibus|transporter|panel van|pickup|campervan|motorhome|caravan|trailer|motorcycle|electric car|e-bike|bike stand|bike holder|bike rack)\b/, "vehicle", ["garage"]],
  [/\b(cat|dog|pet|pets|litter|hamster|rabbit|bird cage|aquarium|terrarium|bowls|scratch|animal|cage)\b/, "pets", []],
  [/\b(stairs?|stair|winder|landing|railing|spiral|space-saver|outdoor steps)\b/, "stairs", ["hall"]],
  [/\b(treadmill|power rack|rower|rowing|spin bike|dumbbell|punching|yoga|elliptical|cross trainer|gym|wall bars|fitness|smart trainer|kettlebell|massage chair|water cooler|exercise)\b/, "sport", ["hobby"]],
  [/\b(kids|loft bed|teepee|tipi|play kitchen|play mat|play tower|toy|toys|rocking horse|cuddle|cosy corner|ball pit|house bed|baby|crib|cot|changing table|children)\b/, "kids", ["kids"]],
  // lamps: what lights the room (a mirror with light, a wardrobe with inside light and a monitor's light bar are not)
  [/\b(lamp|lamps|lantern|torch|lights|spotlight|downlight|pendant|light cove|led niche|light pillar|ceiling panel|wall light|workshop light|under-cabinet light|night light|star projector|star ceiling|garden spots|up and down|candelabra)\b/, "lamp", null],
  // decor: the sub-kinds before the furniture they lie on ("sofa throw", "bed throw"), read in the name's head only
  // ("bench with cushions" is a bench); a bed frame stays a bed
  [/(?<!drip |ice |baking |oven )\btrays?\b/, "tray", null, true],
  [/(?<!bed |door |window |climbing )\b(picture frames?|photo frames?|frames?|pictures?|paintings?|posters?|wall art|canvas|art print)\b/, "frame", null, true],
  [/\b(vase|vases)\b/, "vase", null, true],
  [/\b(cushion|cushions|pillow|pillows|bolster)\b/, "cushion", null, true],
  [/\b(throw|throws|blanket|plaid)\b/, "throw", null, true],
  [/\b(candle|candles|tealight|tea light|candlestick)\b/, "candle", null, true],
  [/\b(herb garden|tree|shrub|brush|plant|plants|monstera|flower|pots|pampas)\b/, "plant", null],
  // network gear before the screens and the tech: a router, a switch with ports, a NAS, a server rack
  [/\b(server|network|nas|router|modem|mesh|access point|wi-fi|wifi|patch panel|ethernet|poe)\b/, "network", null],
  // media: screens, speakers, players
  [/\b(tv|television|projector|projection screen|screen|speaker|subwoofer|soundbar|receiver|turntable|record shelf|game console|hi-fi|cinema seat|cinema|acoustic|bass trap|smart display|media wall|arcade|monitor|sim racing|piano)\b/, "media", null],
  // appliances (kitchen, laundry, cleaning)
  [/\b(fridge|freezer|oven|hob|cooktop|stovetop|hotplate|cooker|extractor|refrigerator|dishwasher|microwave|coffee|kettle|toaster|mixer|hood|washer|washing machine|dryer|vacuum|ironing|wine|range|popcorn)\b/, "appliance", null],
  // energy, heating and tech before the room words: a meter cabinet is energy, a heat pump outdoors is heating
  [/\b(wallbox|home battery|inverter|solar|balcony|fuse box|meter cabinet|grid)\b/, "energy", null],
  [/\b(heat pump|boiler|buffer tank|manifold|ventilation|radiator|fan|air purifier|humidifier|dehumidifier|thermostat|water softener|water pump|hot water|patio heater|fireplace|wood stove|chimney|stove)\b/, "heating", null],
  [/\b(printer|filament|siren|smoke detector|camera|baby monitor|phone booth|smart home|sensor|leak|switch|socket|compressor|door opener|alarm clock|clock)\b/, "tech", null],
  [/\b(hot tub|outdoor|garden|patio|pergola|parasol|grill|greenhouse|raised bed|shed|trampoline|sprinkler|irrigation|rain barrel|rotary|awning|mower|fire bowl|hammock|lounger)\b/, "outdoor", ["garden"]],
  [/\b(base unit|drawer unit|sink unit|wall unit|corner base|corner wall|pantry|kitchen|island|breakfast bar|spice rack|trolley|worktop|countertop|work surface|splashback|larder|sink)\b/, "kitchen", ["kitchen"]],
  [/\b(bathtub|tub|shower|toilet|wc|bidet|bathroom|washbasin|basin|sauna|whirlpool)\b/, "bath", ["bath"]],
  [/\b(bed|beds|boxspring|box-spring|futon|canopy)\b/, "bed", ["bedroom"]],
  [/\b(wardrobe|closet|clothes|dresser|chest of|nightstand|bedside)\b/, "storage", ["bedroom"]],
  [/\b(desk|office|whiteboard|filing|file cabinet)\b/, "office", ["office"]],
  [/\b(sofa|chesterfield|chaise|r[ée]camière|recamiere|lounge set)\b/, "sofa", ["living"]],
  [/\b(table|tables|workbench|vanity)\b/, "table", null],
  [/\b(armchair|chair|chairs|stool|stools|bench|recliner|bean bag|pouf|seat|rocking)\b/, "seating", null],
  [/\b(waste|bin|mailbox|drying rack|basket|coat|laundry|hooks)\b/, "household", null],
  [/\b(shelf|shelves|cabinet|sideboard|lowboard|highboard|vitrine|display cabinet|cube|rack|bookcase|tool wall|shoe|console table)\b/, "storage", null],
  [/\b(column|beam|beams|partition|sliding wall|divider|podium|platform|gallery|curtain|niche|built-in)\b/, "architecture", []],
  [/\b(rug|mirror|pumpkin|cobweb|garland|gravestone|grave|skeleton|cauldron|ghost|broom|deco|decor)\b/, "deco", null],
];

/** The bath pack knows its own: a lit mirror, a towel rail or a laundry basket there is bathroom furniture. */
const BATH_OWN = /\b(mirror|towel|laundry|washer|cabinet|shelf|plant|fan|rain shower)\b/;

/** The id's words and the English name: what the rules read. */
function wordsOf(item: PackItemInfo): string {
  return `${item.id.replace(/_/g, " ")} ${item.name.en ?? ""}`.toLowerCase();
}

/** The English name (else the id) without what the item comes with: "Bench with cushions" -> "bench". */
function headOf(item: PackItemInfo): string {
  const name = (item.name.en ?? item.id.replace(/_/g, " ")).toLowerCase();
  return name.replace(/\s+(with|and|plus|incl\.?|including)\b.*$/, "").replace(/\s*\(.*$/, "");
}

/** Where an item belongs: the pack's own fields, else its words, else its pack. */
export function classify(packId: string, item: PackItemInfo): { kind: Kind; rooms: Room[] } {
  const own = (item.group && (KINDS as readonly string[]).includes(item.group) ? item.group : null) as Kind | null;
  const ownRooms = item.room?.filter((r) => (ROOMS as readonly string[]).includes(r)) as Room[] | undefined;
  // the pack's own name after its publisher's prefix ("home3d.living" -> "living")
  const key = packId.replace(/^[a-z0-9_-]+\./, "");
  const packRooms = PACK_ROOMS[key] ?? [];
  if (own) return { kind: own, rooms: ownRooms ?? packRooms };
  const text = wordsOf(item);
  const head = headOf(item);
  if (key === "bath" && BATH_OWN.test(text) && !/\b(washing machine cabinet|fan)\b/.test(text)) return { kind: "bath", rooms: ownRooms ?? ["bath"] };
  for (const [re, kind, rooms, headOnly] of RULES) {
    if (re.test(headOnly ? head : text)) return { kind, rooms: ownRooms ?? (rooms && rooms.length ? [...new Set([...rooms, ...packRooms])] : packRooms) };
  }
  return { kind: "deco", rooms: ownRooms ?? packRooms };
}

/** Which room kind a room is, by its name (English and the other languages Home 3D speaks); null when unclear. */
export function roomKindOf(name: string): Room | null {
  const n = name.toLowerCase();
  const table: [RegExp, Room][] = [
    [/en[- ]?suite|ensuite/, "ensuite"],
    [/cloak ?room|garderobe|guardaroba|vestiaire/, "cloakroom"],
    [/boot ?room|mud ?room/, "bootroom"],
    [/pantry|larder|dispensa|despensa|garde-manger/, "pantry"],
    [/walk-?in (wardrobe|closet)|cabina armadio|vestidor/, "wardrobe"],
    [/dressing ?room/, "dressing"],
    [/\bstudy\b|studeerkamer|estudio/, "study"],
    [/play ?room|speelkamer|sala giochi|salle de jeux/, "playroom"],
    [/nursery|baby ?room/, "nursery"],
    [/\bgym\b|fitness ?room|palestra|gimnasio/, "gym"],
    [/cinema|home theat(er|re)|media room/, "cinema"],
    [/games? ?room|billiard|snooker/, "games"],
    [/laundry|lavander|buanderie|wasruimte|pralni|prádeln|vaskerom/, "laundry"],
    [/plant ?room|boiler room|sala de m[áa]quinas/, "plantroom"],
    [/workshop|werkplaats|taller/, "workshop"],
    [/summer ?house|gazebo|pavilion/, "summerhouse"],
    [/green ?house|invernadero|broeikas|szklarnia/, "greenhouse"],
    [/\bshed\b|cobertizo|capanno/, "shed"],
    [/cellar|basement|s[óo]tano|cantina|kælder|kjeller|kellari/, "cellar"],
    [/landing/, "landing"],
    [/porch|vestibule/, "porch"],
    [/balcon|balkon/, "balcony"],
    [/terrace|terrasse|patio|terraza|terrazza/, "terrace"],
    [/car ?port/, "carport"],
    [/kids|child|niñ|bambin|enfant|dziec|děts|barn|lapsi|gyerek|copi|otro|儿童|kinderkamer/, "kids"],
    [/bedroom|dormit|camera da letto|chambre|slaapkamer|sypial|ložnic|sover|makuu|háló|dormitor|spaln|卧室|soveværelse/, "bedroom"],
    [/living|lounge|salon|soggiorno|sala de estar|woonkamer|obývací|stue|olohuone|nappali|sufrag|dnevn|客厅/, "living"],
    [/dining|comedor|pranzo|salle à manger|eetkamer|jadal|jídel|spise|ruokailu|étkez|jedil|餐厅/, "dining"],
    [/kitchen|cocina|cucina|cuisine|keuken|kuchn|kuchyn|kjøkken|køkken|keittiö|konyha|bucăt|kuhinj|厨房/, "kitchen"],
    [/\bbad\b|bath|baño|bagno|salle de bain|badkamer|łazienk|koupeln|baderom|badevær|kylpy|fürdő|baie|kopaln|wc|toilet|guest|浴室|dusch|shower/, "bath"],
    [/office|studio|bureau|kantoor|biuro|pracovn|kontor|työhuone|iroda|birou|pisarn|gaming|办公/, "office"],
    [/hall|corridor|entrance|ingresso|gang|hal\b|przedpok|chodba|entré|eteinen|előszoba|hol\b|hodnik|stair|walk/, "hall"],
    [/conservatory|orangery|sun ?room|v[ée]randa|jard[ií]n de invierno|giardino d.inverno|vinterhave|uterum|talvipuutarha|ogr[óo]d zimowy|zimn[íi] zahrada/, "conservatory"],
    [/\bloft\b|attic|grenier|zolder|soffitta|desv[áa]n|strych|p[ůu]da|loftet|ullakko|padl[áa]s|mansard|podstre[šs]|阁楼/, "loft"],
    [/utility|laundry|lavander|buanderie|berging|bijkeuken|pralni|prádeln|vaskerom|kodinhoito|mosó|tehnic|pralnic|cellar|basement|storage|pantry|boiler/, "utility"],
    [/garage|carport|workshop|garaje|garaż|garáž|verkstad|autotalli|garázs|garaj|garaž|车库/, "garage"],
    [/garden|terrasse|terrace|balkon|balcony|jardin|giardino|tuin|ogród|zahrad|hage|have|puutarha|kert|grădin|vrt|pool|yard|patio|driveway|花园/, "garden"],
    [/fitness|gym|sport|hobby|kino|cinema|home theater|play|party|bar\b|sauna|wellness/, "hobby"],
  ];
  for (const [re, room] of table) if (re.test(n)) return room;
  return null;
}

// ---------------------------------------------------------------------------------------------- families

/** The sizes and counts in a name that make it a variant: "160 × 200", "2-seater", "3-door", "4 × 2", "15″". */
const VARIANT_WORDS = /\s*\(?\b\d+(?:[.,]\d+)?\s*(?:[×x]\s*\d+(?:[.,]\d+)?)*\s*(?:cm|m|l|u|″|"|-seater|-door|-drawer|-piece|seats|parts)?\)?/gi;

/** A name without its numbers: "Dining table 160 × 90" → "Dining table", "2-seater sofa" → "Sofa". */
export function familyLabel(name: string): string {
  const out = name
    .replace(VARIANT_WORDS, " ")
    .replace(/\s+(with|avec|con)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,–-]+|[\s,–-]+$/g, "")
    .trim();
  return out ? out[0].toUpperCase() + out.slice(1) : name;
}

/** The numbers of a name as the variant's chip: "Bed 160 × 200" → "160 × 200", "2-seater sofa" → "2". */
export function variantLabel(name: string): string | null {
  const hits = [...name.matchAll(/\d+(?:[.,]\d+)?(?:\s*[×x]\s*\d+(?:[.,]\d+)?)*/g)].map((m) => m[0].replace(/\s*[×x]\s*/g, " × "));
  if (hits.length) return hits.join(" · ");
  const side = name.match(/\b(left|right)\b/i);
  return side ? side[1].toLowerCase() : null;
}

/** The side an item is made for, by its name: "left" / "right", null for the rest. */
export function sideOf(name: string): "left" | "right" | null {
  if (/\bleft\b/i.test(name)) return "left";
  if (/\bright\b/i.test(name)) return "right";
  return null;
}

/** The name for the other side: "Corner sofa (left)" → "Corner sofa (right)". */
export function otherSideName(name: string): string {
  return name.replace(/\b(left|right)\b/i, (w) => {
    const map: Record<string, string> = { left: "right", right: "left" };
    const out = map[w.toLowerCase()] ?? w;
    return w[0] === w[0].toUpperCase() ? out[0].toUpperCase() + out.slice(1) : out;
  });
}

/** An item's family key: its own field, else its id without the size suffix (sofa_3 → sofa, base_60 → base, cube_4x2 → cube). */
export function familyOf(item: PackItemInfo): string | null {
  if (item.family) return item.family;
  const m = item.id.match(/^(.*?)_(\d+(?:x\d+)?|left|right)$/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------------------------- the index

export interface IndexSource {
  packs: readonly FurniturePack[];
  /** Built-in kinds to offer (the groups, plus exclusive ones such as the smart fridge). */
  basics: string[];
  language: string;
  /** The user's name of a built-in kind, and the English one for the search. */
  basicName: (type: string) => string;
  basicNameEn: (type: string) => string;
  kindName: (kind: Kind) => string;
  size: (type: string) => [number, number, number];
}

const OUTDOOR_ROOMS = new Set<Room>(["garden", "balcony", "terrace", "carport"]);

export function buildIndex(src: IndexSource): LibraryEntry[] {
  const out: LibraryEntry[] = [];
  for (const type of src.basics) {
    const meta = BASIC[type];
    if (!meta) continue;
    const [kind, rooms] = meta;
    const label = src.basicName(type);
    const own = `${label} ${src.basicNameEn(type)} ${type.replace(/_/g, " ")}`;
    out.push({
      type,
      key: type,
      label,
      search: `${own} ${synonymWords(own, kind)} ${src.kindName(kind)} ${KIND_WORDS[kind]}`,
      tags: `${own} ${synonymWords(own, kind)}`,
      kind,
      rooms,
      electric: isElectric(type),
      light: LAMP_TYPES.has(type),
      outdoor: rooms.length > 0 && rooms.every((r) => OUTDOOR_ROOMS.has(r)),
      size: src.size(type),
      pack: null,
      packLabel: null,
      packRelease: 0,
      family: null,
      variant: null,
      ikea: null,
    });
  }
  for (const pack of src.packs) {
    if (!pack.items.length) continue;
    const packLabel = packName(pack, src.language);
    for (const it of pack.items) {
      const { kind, rooms } = classify(pack.id, it);
      const type = packType(pack.id, it.id);
      const label = packItemName(it, src.language);
      // the item's own words (its names, id, tags and IKEA name) bring their synonyms; the kind's and the pack's words don't
      const own = `${Object.values(it.name).join(" ")} ${it.id.replace(/_/g, " ")} ${(it.tags ?? []).join(" ")} ${it.ikea ?? ""}`;
      out.push({
        type,
        key: type,
        label,
        search: `${own} ${synonymWords(own, kind)} ${packLabel} ${packName(pack, "en")} ${src.kindName(kind)} ${KIND_WORDS[kind]}`,
        tags: `${own} ${synonymWords(own, kind)}`,
        kind,
        rooms,
        electric: !!it.electric || !!it.light,
        light: !!it.light,
        outdoor: rooms.length > 0 && rooms.every((r) => OUTDOOR_ROOMS.has(r)),
        size: it.size,
        pack: pack.id,
        packLabel,
        packRelease: pack.release ?? 1,
        family: familyOf(it),
        ikea: it.ikea ?? null,
        variant: it.variant ? (it.variant[src.language.split("-")[0]] ?? it.variant.en ?? Object.values(it.variant)[0] ?? null) : variantLabel(label),
      });
    }
  }
  // an item that comes for one side only gets a twin for the other side, placed mirrored (#645: a left corner
  // sofa or cabinet must also exist as a right one)
  const byType = new Map(out.map((e) => [e.type, e]));
  for (const e of [...out]) {
    const side = sideOf(e.label);
    if (!side || e.mirror) continue;
    const twinType = e.type.replace(/(_|\b)(left|right)(?=$|[_\s)])/i, (_m: string, sep: string, w: string) => sep + (({ left: "right", right: "left" } as Record<string, string>)[w.toLowerCase()] ?? w));
    if (twinType !== e.type && byType.has(twinType)) continue;
    const label = otherSideName(e.label);
    out.push({ ...e, key: `${e.type}#m`, mirror: true, label, search: `${e.search} ${label}`, tags: `${e.tags} ${label}`, family: e.family ?? e.type, variant: variantLabel(label) });
    if (!e.family) e.family = e.type;
  }
  return out;
}

/** Letters only, no accents, for the search. */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss");
}

export interface LibraryFilter {
  query: string;
  room: Room | null;
  electric: boolean;
  light: boolean;
  outdoor: boolean;
  /** Only the items of this pack (its id); null or left out: every pack (#109). */
  pack?: string | null;
}

/**
 * How a query word matches: a longer one (4 letters and up) anywhere, so "kochfeld" still finds an
 * "Induktionskochfeld"; a short one at the start of a word ("so" while typing "sofa"), and a short word of the
 * vocabulary ("hob", "tap", "bin") only as a whole word, so "hob" does not find a hobby bench.
 */
function wordMatcher(w: string): (hay: string) => boolean {
  if (w.length > 3) return (hay) => hay.includes(w);
  const end = isVocabularyWord(w) ? "(?=$|[^\\p{L}\\p{N}])" : "";
  const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${end}`, "u");
  return (hay) => re.test(hay);
}

/** The newer room types also fit the items of the rooms they resemble (#291): a cellar gets the utility items. */
const RELATED: Partial<Record<Room, Room[]>> = {
  ensuite: ["bath"], cloakroom: ["bath", "hall"], bootroom: ["hall", "utility"], pantry: ["kitchen", "utility"], study: ["office"], playroom: ["kids"],
  nursery: ["kids", "bedroom"], gym: ["hobby"], cinema: ["living", "hobby"], games: ["hobby", "living"], laundry: ["utility"], workshop: ["garage", "hobby"],
  shed: ["garden", "garage"], summerhouse: ["garden", "conservatory"], greenhouse: ["garden", "conservatory"], cellar: ["utility", "hobby"], landing: ["hall"], porch: ["hall"],
  wardrobe: ["bedroom"], dressing: ["bedroom"], plantroom: ["utility"], balcony: ["garden"], terrace: ["garden"], carport: ["garage", "garden"],
};

/** Does an entry fit the open room? Items for any room fit every room. */
function fitsRoom(e: LibraryEntry, room: Room | null): boolean {
  return !room || !e.rooms.length || e.rooms.includes(room) || !!RELATED[room]?.some((r) => e.rooms.includes(r));
}

/** The toggle chips (Electric, Lights up, Outdoor) and the pack chip: hard filters, with or without a query. */
function fitsChips(e: LibraryEntry, f: LibraryFilter): boolean {
  return (!f.pack || e.pack === f.pack) && (!f.electric || e.electric) && (!f.light || e.light) && (!f.outdoor || e.outdoor);
}

/** What the ranking reads of an entry: its folded label and words, worked out once. */
interface Prepared {
  search: string;
  label: string;
  labelWords: string[];
  tags: string;
  tagWords: Set<string>;
  hay: string;
}
const WORDS = /[^\p{L}\p{N}]+/u;
const prepared = new WeakMap<LibraryEntry, Prepared>();
function prepare(e: LibraryEntry): Prepared {
  let p = prepared.get(e);
  if (!p || p.search !== e.search) {
    const label = fold(e.label);
    const tags = fold(e.tags ?? "");
    p = { search: e.search, label, labelWords: label.split(WORDS).filter(Boolean), tags, tagWords: new Set(tags.split(WORDS).filter(Boolean)), hay: fold(e.search) };
    prepared.set(e, p);
  }
  return p;
}

/** A query this short (letters, after trimming) matches most of the catalogue: it shows only the first SHORT_QUERY_CAP hits (#136). */
export const SHORT_QUERY = 2;
/** How many hits a one- or two-letter query shows; "keep typing" shows the rest of the way. */
export const SHORT_QUERY_CAP = 40;

/** Is this query so short that its results are cut (#136)? Whole words of the vocabulary ("tv", "pc") are not cut. */
export function isShortQuery(query: string): boolean {
  const q = fold(query).trim();
  return q.length > 0 && q.length <= SHORT_QUERY && !/\s/.test(q) && !isVocabularyWord(q);
}

/**
 * Works out what the search reads of each entry ahead of the first keystroke (#131: folding 1,500 names and tags
 * otherwise landed on the first letter typed); returns how many it prepared now.
 */
export function warmIndex(entries: readonly LibraryEntry[]): number {
  let n = 0;
  for (const e of entries) {
    const p = prepared.get(e);
    if (p && p.search === e.search) continue;
    prepare(e);
    n++;
  }
  return n;
}

/**
 * How well one typed word fits an entry, from 7 down to 0 (no match): a whole word of the name (7), the start of
 * a word of the name (6), inside the name (5), a whole tag word (4), inside the tags (3), the kind's or the pack's
 * words (2), and last a slip of the pen in a name or tag word (1: fuzzy, never above an exact or prefix match).
 */
function wordScore(w: string, match: (hay: string) => boolean, p: Prepared): number {
  if (match(p.label) || match(p.hay)) {
    const whole = w.length <= 3 && isVocabularyWord(w);
    // one or two letters that are no word of the vocabulary are the start of something: a name starting with them
    // is as good as one that has them as a whole word ("a" in "Candle in a jar") and wins on its first letters (#136)
    if (p.labelWords.includes(w)) return w.length <= SHORT_QUERY && !whole ? 6 : 7;
    if (!whole && p.labelWords.some((lw) => lw.startsWith(w))) return 6;
    if (w.length > 3 && p.label.includes(w)) return 5;
    if (p.tagWords.has(w)) return 4;
    if (match(p.tags)) return 3;
    return 2;
  }
  if (w.length < 4) return 0;
  for (const lw of p.labelWords) if (fuzzyEquals(w, lw)) return 1;
  for (const tw of p.tagWords) if (fuzzyEquals(w, tw)) return 1;
  return 0;
}

/** Scores an entry against a query (higher is better), or null when a word of the query finds nothing in it. */
function queryScorer(query: string): ((e: LibraryEntry) => number | null) | null {
  const typed = fold(query).split(/\s+/).filter(Boolean);
  if (!typed.length) return null;
  const words = typed.map((w) => ({ w, match: wordMatcher(w) }));
  const phrase = typed.join(" ");
  return (e) => {
    const p = prepare(e);
    let weakest = 7;
    let sum = 0;
    for (const { w, match } of words) {
      const s = wordScore(w, match, p);
      if (!s) return null;
      weakest = Math.min(weakest, s);
      sum += s;
    }
    // the whole query as the name (or its start, or a run of its words) beats the same words scattered
    const label = p.labelWords.join(" ");
    const bonus = label === phrase ? 300 : label.startsWith(phrase) ? 200 : weakest > 1 && ` ${label} `.includes(` ${phrase} `) ? 100 : 0;
    return weakest * 1000 + sum * 10 + bonus - Math.min(label.length, 90) / 100;
  };
}

/**
 * The entries a filter leaves, in index order: every word of the query somewhere and the toggle chips. The room
 * chip narrows the library only while nothing is typed: with a query it ranks instead (#77, see `rankEntries`).
 */
export function filterEntries(entries: readonly LibraryEntry[], f: LibraryFilter): LibraryEntry[] {
  const score = queryScorer(f.query);
  return entries.filter((e) => fitsChips(e, f) && (score ? score(e) !== null : fitsRoom(e, f.room)));
}

/**
 * The order of the hits (stable): best match first (the name before the tags before the kind's words, a whole
 * word before the start of a word before the inside of one, and a fuzzy match after all of those: #78), then the
 * open room's items ahead of the others. Without a query it is only the room step.
 */
export function rankEntries(hits: readonly LibraryEntry[], f: LibraryFilter): LibraryEntry[] {
  const score = queryScorer(f.query);
  const ranked = [...hits];
  if (score) {
    const scores = new Map(ranked.map((e) => [e, score(e) ?? 0]));
    ranked.sort((a, b) => scores.get(b)! - scores.get(a)!);
  }
  if (!f.room) return ranked;
  const room = f.room;
  return [...ranked.filter((e) => fitsRoom(e, room)), ...ranked.filter((e) => !fitsRoom(e, room))];
}

export interface LibraryHits {
  /** Everything found, ranked (the first SHORT_QUERY_CAP of it for a one- or two-letter query, #136). */
  hits: LibraryEntry[];
  /** How many hits a one- or two-letter query left out ("keep typing to see more"); 0 otherwise. */
  cut: number;
  /** The hits for the room chip (all of them without one), in rank order. */
  inRoom: LibraryEntry[];
  /** Hits a query found in other rooms ("N more in other rooms"); empty without a query or a room chip. */
  otherRooms: LibraryEntry[];
  /** Query matches the toggle chips hide, so a lingering chip is never silent; 0 without a query. */
  hiddenByChips: number;
}

export type LibraryChip = "room" | "pack" | "electric" | "light" | "outdoor";

/** The chips a filter has switched on, for the "Filters: ... · Clear filters" line (#77). */
export function activeFilters(f: LibraryFilter): LibraryChip[] {
  const on: LibraryChip[] = [];
  if (f.room) on.push("room");
  if (f.pack) on.push("pack");
  if (f.electric) on.push("electric");
  if (f.light) on.push("light");
  if (f.outdoor) on.push("outdoor");
  return on;
}

/** What the library shows for a filter: filter, rank, then split the hits by the room chip. */
export function searchLibrary(entries: readonly LibraryEntry[], f: LibraryFilter): LibraryHits {
  const all = rankEntries(filterEntries(entries, f), f);
  const short = isShortQuery(f.query) && all.length > SHORT_QUERY_CAP;
  const hits = short ? all.slice(0, SHORT_QUERY_CAP) : all;
  const inRoom = hits.filter((e) => fitsRoom(e, f.room));
  const score = queryScorer(f.query);
  const hiddenByChips = score ? entries.filter((e) => !fitsChips(e, f) && score(e) !== null).length : 0;
  return { hits, cut: all.length - hits.length, inRoom, otherRooms: hits.filter((e) => !fitsRoom(e, f.room)), hiddenByChips };
}

/** Cards of a kind: families folded (two or more variants of one family in one pack), the rest one card each. */
export function cardsOf(entries: readonly LibraryEntry[], kind: Kind): LibraryCard[] {
  const mine = entries.filter((e) => e.kind === kind);
  const families = new Map<string, LibraryEntry[]>();
  for (const e of mine) {
    if (!e.family) continue;
    const key = `${e.pack ?? "basic"}:${e.family}`;
    families.set(key, [...(families.get(key) ?? []), e]);
  }
  const cards: LibraryCard[] = [];
  const done = new Set<string>();
  for (const e of mine) {
    if (done.has(e.key)) continue;
    const key = e.family ? `${e.pack ?? "basic"}:${e.family}` : null;
    const group = key ? families.get(key) : undefined;
    if (key && group && group.length > 1) {
      for (const g of group) done.add(g.key);
      const rooms = [...new Set(group.flatMap((g) => g.rooms))];
      cards.push({ key, label: familyLabel(e.label), kind, rooms, entries: group });
    } else {
      done.add(e.key);
      cards.push({ key: e.key, label: e.label, kind, rooms: e.rooms, entries: [e] });
    }
  }
  return cards;
}

/** "210 × 92 cm" (or "2,10 × 0,92 m" for big things) for a card. */
export function sizeText(size: [number, number, number], language: string): string {
  const [w, d] = size;
  const cm = (v: number) => Math.round(v * 100);
  const sep = language.startsWith("de") || language.startsWith("fr") || language.startsWith("it") || language.startsWith("es") || language.startsWith("nl") ? "," : ".";
  if (w >= 10 || d >= 10) return `${(Math.round(w * 10) / 10).toString().replace(".", sep)} × ${(Math.round(d * 10) / 10).toString().replace(".", sep)} m`;
  return `${cm(w)} × ${cm(d)} cm`;
}
