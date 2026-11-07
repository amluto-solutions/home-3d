// Furniture of other programs to Home 3D's built-in types, by its name or category (English, French,
// Spanish, Italian, Dutch words). Anything not recognised becomes a plain cabinet keeping its own name.

import type { FurnitureType } from "../model.ts";

const RULES: [RegExp, FurnitureType | ((h: number, y: number) => FurnitureType)][] = [
  [/upper cabinet|wall cabinet|meuble haut|armario alto|pensile|élément haut/i, "kitchen_wall"],
  [/lower cabinet|base cabinet|meuble bas|élément bas/i, "kitchen"],
  [/glass ?-?door cabinet|vitrine|showcase|display cabinet/i, "tall_cabinet"],
  [/drawers?( cabinet)?|tiroirs|cajonera|cassettiera/i, "dresser"],
  [/stair|escalier|escalera|scala|trap(?!p)/i, "stairs"],
  [/bunk|lits? superpos|litera/i, "bunk_bed"],
  [/night ?stand|bedside|table de chevet|mesita|comodino|nachtkast/i, "nightstand"],
  [/\bbed\b|\blit\b|cama|letto|^bed|double bed|single bed|boxspring/i, "bed"],
  [/corner sofa|l-?sofa|canap[ée] d'angle|capan[ée] d'angle|sofá esquinero|divano angolare|hoekbank/i, "sofa_l"],
  [/sofa|couch|canap[eé]|divano/i, "sofa"],
  [/arm ?chair|fauteuil|sill[oó]n|poltrona|fauteuil/i, "armchair"],
  [/office chair|chaise de bureau|silla de oficina/i, "office_chair"],
  [/bar ?stool|tabouret de bar|taburete/i, "bar_stool"],
  [/stool|tabouret|sgabello/i, "stool"],
  [/chair|chaise|silla|sedia|stoel/i, "chair"],
  [/corner bench/i, "corner_bench"],
  [/bench|banc|banco|panca/i, "bench"],
  [/desk|bureau|escritorio|scrivania|bureau/i, "desk"],
  [/coffee ?table|table basse|mesa de centro|tavolino|salontafel/i, "coffee_table"],
  [/round table|table ronde|mesa redonda/i, "table_round"],
  [/table|mesa|tavolo|tafel/i, "table"],
  [/wardrobe|armoire|penderie|armario|guardaroba|kledingkast/i, "wardrobe"],
  [/dresser|chest of drawers|commode|c[oó]moda|cassettiera/i, "dresser"],
  [/sideboard|buffet|credenza|dressoir/i, "sideboard"],
  [/tv|television|t[eé]l[eé]vis/i, "tv_board"],
  [/book ?case|book ?shelf|shelf|shelves|étagère|biblioth[eè]que|estanter[ií]a|libreria|boekenkast|kast/i, "shelf"],
  [/smart ?fridge|fridge|refrigerator|réfrigérateur|frigo|nevera|frigorifero|koelkast/i, "fridge"],
  [/dishwasher|lave[- ]vaisselle|lavavajillas|lavastoviglie|vaatwasser/i, "dishwasher"],
  [/washing machine|washer|lave[- ]linge|lavadora|lavatrice|wasmachine/i, "washer"],
  [/dryer|s[eè]che[- ]linge|secadora|asciugatrice|droger/i, "dryer"],
  [/oven|four|horno|forno|oven/i, "kitchen_tall"],
  [/cooker|cooktop|hob|stove|cuisini[eè]re|plaque de cuisson|fornello|kookplaat/i, "stove"],
  [/kitchen sink|[ée]vier|fregadero|lavello|gootsteen|\bsink\b/i, "sink"],
  [/wall cabinet|meuble haut|armario alto|pensile/i, "kitchen_wall"],
  [/tall cabinet|colonne|armario columna/i, "kitchen_tall"],
  [/island|îlot|isla|isola/i, "island"],
  [/worktop|counter|plan de travail|encimera|piano di lavoro/i, "worktop"],
  [/kitchen|base cabinet|meuble bas|cocina|cucina|keuken/i, "kitchen"],
  [/toilet|\bwc\b|toilette|inodoro/i, "wc"],
  [/bath ?tub|baignoire|bañera|vasca da bagno|\bbath\b/i, "bathtub"],
  [/shower|douche|ducha|doccia/i, "shower"],
  [/wash ?basin|lavabo|lavandino|wastafel|basin/i, "washbasin"],
  [/radiator|radiateur|radiador|termosifone/i, "radiator"],
  [/air ?con|climatiseur|aire acondicionado|condizionatore/i, "ac_unit"],
  [/coat|garderobe|portemanteau|perchero|appendiabiti/i, "coat_rack"],
  [/plant|plante|planta|pianta|tree|arbre|aspen|birch|oak|pine|fir\b|palm|bush|shrub|hedge|ficus|bonsai/i, "plant"],
  [/rug|carpet|tapis|alfombra|tappeto|vloerkleed/i, "rug"],
  [/robot|vacuum/i, "robot_vacuum"],
  [/wall ?(light|lamp)|applique|aplique/i, "lamp_wall"],
  [/floor ?lamp|lampadaire|l[aá]mpara de pie|piantana/i, "lamp_floor"],
  [/table ?lamp|lampe de table|l[aá]mpara de mesa/i, "lamp_table"],
  [/pendant|suspension/i, "lamp_pendant"],
  [/spot|downlight/i, "lamp_downlight"],
  // other lights: by the height they sit at
  [/lamp|light|lampe|l[aá]mpara|luce|lamp/i, (h, y) => (y > 1.6 ? "lamp_ceiling" : h > 1.2 ? "lamp_floor" : "lamp_table")],
];

/** Things other programs place like furniture that are no furniture in a floor plan: decoration, small things, parts of the building. */
const DECOR =
  /frame|picture|photo|poster|tableau|vase|plate|assiette|bowl|bottle|bouteille|\bglass(es)?\b|verres|candle|bougeoir|clock|horloge|mirror|miroir|curtain|rideau|tringle|blind|\bstore\b|tube|\bvent\b|vmc|outlet|\bprise\b|switch|fence|railing|handrail|rampe|roof|tiles|\bbox\b|cylinder|triangle|\barch\b|keyboard|clavier|mouse|souris|flowers|shampoo|trash|poubelle|\bjar\b|bocal|guitar|\bbike\b|vélo|beetle|\bcar\b|\bauto\b|voiture|\bscale\b|scaletta|ladder|chimney|\bhood\b|hotte|microwave|micro ?-?onde|coffee|cofee|toaster|imac|ibook|laptop|\bpc\b|monitor|écran|ecran|screen|\bdvd\b|phone|telefon|\bbook\b|towel|ustensils|cutlery|sushi|wine|\boil\b|heat system|aquarium|\bfish\b|poisson|\btoy\b|cushion|blanket/i;

/** Whether a named thing is decoration or a small part rather than furniture. */
export function isDecor(name: string): boolean {
  return DECOR.test(name.replace(/[_-]+/g, " "));
}

/** Home 3D's type for a piece of furniture of another program; null when nothing fits. */
export function furnitureType(name: string, h = 0.8, y = 0): FurnitureType | null {
  const text = name.replace(/[_-]+/g, " ");
  for (const [re, t] of RULES) if (re.test(text)) return typeof t === "function" ? t(h, y) : t;
  return null;
}

/** Apple RoomPlan's object categories. */
export const ROOMPLAN_TYPES: Record<string, FurnitureType> = {
  storage: "tall_cabinet",
  refrigerator: "fridge",
  stove: "stove",
  bed: "bed",
  sink: "sink",
  washerDryer: "washer",
  toilet: "wc",
  bathtub: "bathtub",
  oven: "kitchen_tall",
  dishwasher: "dishwasher",
  table: "table",
  sofa: "sofa",
  chair: "chair",
  fireplace: "sideboard",
  television: "tv_board",
  stairs: "stairs",
};
