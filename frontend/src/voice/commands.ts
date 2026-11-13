// Spoken commands: which room, floor or the whole house a sentence names ("show the living room", "go to the
// first floor", "show the kitchen"). Matched on the plan's own names, so no sentences have to be taught to anyone.

import { styleFromText } from "../looks.ts";
import { zonesOf, type Building, type Room } from "../model.ts";

export type Place = { kind: "room"; floorId: string; roomId: string; name: string } | { kind: "floor"; floorId: string; name: string } | { kind: "house"; name: string };

/** Lower case, without accents and punctuation: "Café (Lea)!" → "cafe lea". */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    // letters that do not decompose: said without their stroke
    .replace(/ł/g, "l")
    .replace(/ø/g, "o")
    .replace(/đ/g, "d")
    // any script's letters, marks (vowel signs) and digits stay: Cyrillic, Greek, Hebrew, Arabic, kana, Hangul, CJK
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

const HOUSE = /\b(house|whole house|home|overview|everything)\b/;

/** Whether `name` stands in `text` as whole words. */
function says(text: string, name: string): boolean {
  if (!name) return false;
  return ` ${text} `.includes(` ${name} `);
}

/**
 * The place a sentence names: a room (the longest name that stands in it wins, "Guest WC" before "WC"), else a
 * floor, else the whole house; null when it names none.
 */
/** Further names of a room: its Home Assistant area's name and its own aliases. */
export type RoomAlias = (room: Room) => string | null | undefined | (string | null | undefined)[];

export function findPlace(sentence: string, building: Building, alias?: RoomAlias): Place | null {
  const text = normalize(sentence);
  if (!text) return null;
  let best: Place | null = null;
  let len = 0;
  // between names of the same length: a room's own name before an outdoor area's, and both before a further name
  // (the Home Assistant area's, an alias) – "Garage" is the room in the cellar, not the driveway linked to the
  // garage's area (#668)
  let rank = -1;
  for (const floor of building.floors) {
    // outdoor areas acting as rooms ("Garden", "Terrace") too; a room answers to its Home Assistant area's name as well
    for (const room of zonesOf(floor)) {
      const indoor = room.outdoor ? 0 : 1;
      const further = ([] as (string | null | undefined)[]).concat(alias?.(room) ?? [], room.aliases ?? []);
      for (const [name, own] of [[room.name, true], ...further.map((n) => [n, false] as const)] as const) {
        const n = name ? normalize(name) : "";
        const r = (own ? 2 : 0) + indoor;
        if ((n.length > len || (n.length === len && r > rank)) && says(text, n)) {
          best = { kind: "room", floorId: floor.id, roomId: room.id, name: room.name };
          len = n.length;
          rank = r;
        }
      }
    }
  }
  if (best) return best;
  for (const floor of building.floors) {
    const n = normalize(floor.name);
    if (n.length > len && says(text, n)) {
      best = { kind: "floor", floorId: floor.id, name: floor.name };
      len = n.length;
    }
  }
  if (best) return best;
  return HOUSE.test(text) ? { kind: "house", name: "" } : null;
}

/** Words that ask to see a place ("show", "go to", "toon", "montre" …). */
const SHOW = /\b(show|go|jump|view|toon|ga|montre|affiche|va|aller|mostra|vai|muestra|ve|vaya|visa|vis|ga till|naytta|nayta|pokaz|ukaz|prejdi|arata|mergi|pokazi|mutasd|menj|显示|去)\b/;
/**
 * Words that also start a switching command ("switch off the lights in the kitchen", "open the blinds in the living room"):
 * they only ask to see a place when nothing else but the place's name follows (#161); anything more is for Assist.
 */
export const SHOW_AMBIGUOUS = /\b(switch|open|apri|abre)\b/;
/** Little words around a bare place name ("the living room please"). */
export const FILLER = new Set("in the to into please me my het de naar le la les au a la il lo al el ett en till".split(" "));

/**
 * What a spoken sentence asks Home 3D to show: a place, when the sentence says "show/go to …" or is no more than a
 * place's name ("Living room", "the first floor please"). Null otherwise – the sentence is for Assist then ("turn on
 * the living room light" names the room but switches a light).
 */
export function showCommand(sentence: string, building: Building, alias?: RoomAlias): Place | null {
  const place = findPlace(sentence, building, alias);
  if (!place) return null;
  const text = normalize(sentence);
  if (SHOW.test(text)) return place;
  const ambiguous = SHOW_AMBIGUOUS.test(text);
  const theRoom = place.kind === "room" ? zonesOf(building.floors.find((f) => f.id === place.floorId)!).find((r) => r.id === place.roomId) : undefined;
  const names = place.kind === "house" ? [] : [place.name, ...(theRoom ? [...([] as (string | null | undefined)[]).concat(alias?.(theRoom) ?? []), ...(theRoom.aliases ?? [])] : [])];
  let rest = ` ${text} `;
  for (const n of names) if (n) rest = rest.replace(` ${normalize(n)} `, " ");
  if (place.kind === "house") rest = rest.replace(HOUSE, " ");
  return rest.split(" ").every((w) => !w || FILLER.has(w) || (ambiguous && SHOW_AMBIGUOUS.test(w))) ? place : null;
}

/** The words that make a sentence one about the style ("style cozy", "Stil Wohnlich"). */
const STYLE_WORD = /\b(style|look|theme|design|stil|farbstil|ansicht|optik)\b/;
/** Little words around a style's name ("please switch the style to cozy"); the name must be all that is left. */
const STYLE_FILLER = /\b(home 3d|home three d|house|haus|please|bitte|set|switch|change|show|use|to|the|on|mode|stelle|stell|schalte|mach|setze|zeige|auf|zu|um|in|den|die|das|an|ein|als|modus)\b/g;
/** Words that ask to go back to the screen's own style. */
const STYLE_BACK = /^(reset|default|back|normal|standard|auto|zuruck|zurucksetzen)$/;

/**
 * A spoken style change: "style cozy", "switch the look to winter evening", "Stil Wohnlich", "reset the style". `id` is the
 * style named (`null`: back to the screen's own style). Null when the sentence is no style sentence: it has no style
 * word, or what is left after the little words names no style as a whole ("the light look" stays a light). `names`:
 * localised names per style id.
 */
export function styleCommand(sentence: string, names: Record<string, string[]> = {}): { id: string | null } | null {
  const text = normalize(sentence);
  if (!STYLE_WORD.test(text)) return null;
  const rest = text.replace(STYLE_WORD, " ").replace(STYLE_FILLER, " ").replace(/\s+/g, " ").trim();
  if (!rest) return null;
  if (STYLE_BACK.test(rest)) return { id: null };
  const id = styleFromText(rest, names);
  return id ? { id } : null;
}
