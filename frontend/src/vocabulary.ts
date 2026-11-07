// The library's vocabulary, shared by the built-in kinds and every pack (the bundled core pack, the IKEA pack and
// anyone else's): the kinds an item can be (a pack item's `group`), the rooms it is made for (its `room`), the
// everyday words that find a kind, and the other words for a thing (UK first: wardrobe, hob, worktop) that find it
// whichever word a pack or a person uses. docs/packs.md lists the same ids for pack authors. Pure data and logic, no DOM.

/** What an item is; the library's sections, in this order. */
export const KINDS = [
  "sofa",
  "seating",
  "table",
  "storage",
  "bed",
  "kitchen",
  "appliance",
  "bath",
  "lamp",
  "media",
  "office",
  "tech",
  "network",
  "heating",
  "energy",
  "household",
  "deco",
  "tray",
  "frame",
  "vase",
  "cushion",
  "throw",
  "candle",
  "plant",
  "outdoor",
  "kids",
  "sport",
  "pets",
  "vehicle",
  "stairs",
  "architecture",
] as const;
export type Kind = (typeof KINDS)[number];

/** Rooms an item is made for; "any" fits everywhere. */
export const ROOMS = ["living", "dining", "kitchen", "bedroom", "kids", "bath", "office", "hall", "utility", "garage", "garden", "hobby", "conservatory", "loft", "ensuite", "cloakroom", "bootroom", "pantry", "study", "playroom", "nursery", "gym", "cinema", "games", "laundry", "workshop", "shed", "summerhouse", "greenhouse", "cellar", "landing", "porch", "wardrobe", "dressing", "plantroom", "balcony", "terrace", "carport"] as const;
export type Room = (typeof ROOMS)[number];

/** The words every kind of decoration answers to. */
const DECOR = "decor decoration";

/** Everyday words that find a kind: "lamp" finds the lights, "cabinet" the storage. */
export const KIND_WORDS: Record<Kind, string> = {
  sofa: "sofa couch",
  seating: "chair stool bench seat",
  table: "table",
  storage: "cabinet shelf dresser wardrobe",
  bed: "bed",
  kitchen: "kitchen",
  appliance: "appliance",
  bath: "bath",
  lamp: "lamp light",
  media: "tv audio speaker",
  office: "desk office",
  tech: "smart home sensor",
  network: "router lan wifi wi-fi ethernet network",
  heating: "heating climate",
  energy: "solar energy power",
  household: "household",
  deco: DECOR,
  tray: `tray ${DECOR}`,
  frame: `frame picture photo poster art ${DECOR}`,
  vase: `vase ${DECOR}`,
  cushion: `cushion pillow ${DECOR}`,
  throw: `throw blanket ${DECOR}`,
  candle: `candle ${DECOR}`,
  plant: "plant tree",
  outdoor: "garden outdoor",
  kids: "kids",
  sport: "fitness sport",
  pets: "pet",
  vehicle: "car vehicle",
  stairs: "stairs railing",
  architecture: "architecture",
};

/**
 * Words for one thing, the UK word first: an item whose words hold any of them answers to all of them, so "hob"
 * finds a pack's "induction cooktop" and "closet" finds the wardrobe. `also` names what the thing includes (a
 * cooker has a hob and an oven): those words find it too, but not the other way round. `kinds` limits a group to
 * items of those kinds (a wood stove is no cooker).
 */
export interface Synonyms {
  words: string[];
  also?: string[];
  kinds?: Kind[];
}

const KITCHEN: Kind[] = ["kitchen", "appliance"];

export const SYNONYMS: Synonyms[] = [
  { words: ["hob", "cooktop", "stovetop", "hotplate", "cooking plate"], kinds: KITCHEN },
  { words: ["cooker", "stove", "range cooker", "freestanding cooker"], also: ["hob", "oven"], kinds: KITCHEN },
  { words: ["cooker hood", "extractor", "extractor hood", "range hood", "hood"], kinds: KITCHEN },
  { words: ["worktop", "countertop", "counter top", "benchtop", "work surface"], kinds: ["kitchen"] },
  { words: ["splashback", "backsplash"], kinds: ["kitchen"] },
  { words: ["kitchen unit", "base unit", "base cabinet", "lower cabinet"], kinds: ["kitchen"] },
  { words: ["wall unit", "wall cabinet", "upper cabinet"], kinds: ["kitchen"] },
  { words: ["tall unit", "tall cabinet", "larder", "pantry cabinet"], kinds: ["kitchen", "storage"] },
  { words: ["tap", "faucet", "mixer tap"], kinds: ["kitchen", "bath"] },
  { words: ["fridge", "refrigerator"] },
  { words: ["washing machine", "washer"], kinds: ["appliance"] },
  { words: ["tumble dryer", "dryer", "clothes dryer"], kinds: ["appliance"] },
  { words: ["hoover", "vacuum", "vacuum cleaner"] },
  { words: ["wardrobe", "closet", "armoire"], kinds: ["storage"] },
  { words: ["cupboard", "cabinet"], kinds: ["storage", "kitchen", "bath", "office"] },
  { words: ["chest of drawers", "dresser", "drawers"], kinds: ["storage"] },
  { words: ["bedside table", "nightstand", "night stand", "bedside cabinet"] },
  { words: ["sofa", "couch", "settee"], kinds: ["sofa"] },
  { words: ["sofa bed", "sleeper sofa"] },
  { words: ["pouffe", "pouf", "ottoman", "footstool"] },
  { words: ["tv unit", "tv stand", "tv board", "tv bench", "media unit", "lowboard"] },
  { words: ["toilet", "wc", "loo", "lavatory"], kinds: ["bath"] },
  { words: ["basin", "washbasin", "wash basin", "vanity basin"], kinds: ["bath"] },
  { words: ["bath", "bathtub", "tub"], kinds: ["bath"] },
  { words: ["bin", "rubbish bin", "dustbin", "waste bin", "trash can", "garbage can"] },
  { words: ["letterbox", "mailbox", "postbox"] },
  { words: ["socket", "plug socket", "power point", "outlet"], kinds: ["tech"] },
  { words: ["torch", "flashlight"] },
  { words: ["fairy lights", "string lights"] },
  { words: ["curtains", "drapes"] },
  { words: ["duvet", "comforter"] },
  { words: ["loft ladder", "attic ladder"] },
  { words: ["cushion", "pillow"] },
  { words: ["throw", "blanket", "plaid"] },
  { words: ["photo frame", "picture frame"] },
  { words: ["candle", "tealight", "tea light"] },
  { words: ["access point", "wi-fi", "wifi"], kinds: ["network"] },
  { words: ["network switch", "ethernet switch"], kinds: ["network"] },
  { words: ["trolley", "cart"] },
  // everyday words people type (#78)
  { words: ["single bed", "twin bed", "one person bed"], kinds: ["bed", "kids"] },
  { words: ["double bed", "queen bed", "king bed"], kinds: ["bed"] },
  { words: ["car", "automobile", "motor car"], kinds: ["vehicle"] },
  { words: ["bicycle", "bike", "cycle", "push bike"], kinds: ["vehicle"] },
  { words: ["tv", "television", "telly"], kinds: ["media"] },
  { words: ["plant", "houseplant", "house plant", "pot plant", "indoor plant"], kinds: ["plant"] },
  // IT devices (#118): a Pi is a Raspberry Pi; a Zigbee stick, dongle and coordinator are the same thing
  { words: ["raspberry pi", "pi", "rpi", "raspi"], kinds: ["tech", "network"] },
  { words: ["zigbee stick", "zigbee dongle", "zigbee usb stick", "zigbee coordinator", "zigbee adapter", "coordinator", "usb stick"], kinds: ["tech", "network"] },
  { words: ["mini pc", "nuc", "micro pc", "small form factor pc"], kinds: ["tech", "network"] },
  { words: ["smoke detector", "smoke alarm", "smoke sensor", "fire alarm", "fire detector"], kinds: ["tech"] },
];

/** Letters only, no accents (the search's own folding). */
function foldWords(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss");
}

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = SYNONYMS.map((g) => ({ ...g, re: new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${g.words.map((w) => escape(foldWords(w))).join("|")})(?=$|[^\\p{L}\\p{N}])`, "u") }));

/** The other words for an item, by the words it already has and its kind: "Induction cooktop" -> "hob stovetop …". */
export function synonymWords(text: string, kind: Kind): string {
  const groups = MATCHERS.filter((g) => !g.kinds || g.kinds.includes(kind));
  const folded = foldWords(text);
  const hit = groups.filter((g) => g.re.test(folded));
  // what it includes brings that thing's words too: a cooker has a hob, so "cooktop" finds it
  const also = foldWords(hit.flatMap((g) => g.also ?? []).join(" "));
  const more = also ? groups.filter((g) => !hit.includes(g) && g.re.test(also)) : [];
  return [...hit.flatMap((g) => [...g.words, ...(g.also ?? [])]), ...more.flatMap((g) => g.words)].join(" ");
}

const WHOLE = new Set(SYNONYMS.flatMap((g) => [...g.words, ...(g.also ?? [])]).map(foldWords));

/** A word of the vocabulary ("hob", "tap", "bin"): a short one finds whole words only, not "hobby" or "tape". */
export function isVocabularyWord(word: string): boolean {
  return WHOLE.has(foldWords(word));
}
