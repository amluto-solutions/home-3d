// What a spoken sentence asks Home 3D to show: a device ("show the washing machine", "where is the floor lamp"), a
// camera to look through ("show the front door camera", "the camera in the garden"), all cameras ("show the
// cameras"), or a place (a room, a floor, the house). Matched on the names in the plan and in Home Assistant – a piece
// of furniture answers to its own name, its kind ("washing machine") and a few everyday words for it ("TV", "telly"),
// with or without an entity.

import type { Building } from "../model.ts";
import { FILLER, findPlace, normalize, SHOW_AMBIGUOUS, showCommand, type Place, type RoomAlias } from "./commands.ts";

/** A device or piece of furniture that can be shown. */
export interface Shown {
  /** The entity, or "furniture:<id>" for an item without one. */
  id: string;
  entity: string | null;
  /** The name shown back ("Washing machine", "Front door camera"). */
  name: string;
  /** Every name it answers to (its own name, its kind, the entity's name, synonyms); `name` when left out. */
  names?: string[];
  /** The room (or outdoor area) it stands in, as named in the plan ("" when none). */
  room: string;
  camera: boolean;
}

export type Target = Place | { kind: "device"; id: string; entity: string | null; name: string; camera: boolean } | { kind: "cameras"; name: string };

/** Words that ask to see something, and "where is …" (the place words of commands.ts and a few more). */
const SHOW = /\b(where|show|go|jump|find|toon|waar|ga|montre|affiche|ou|va|mostra|dove|vai|muestra|donde|ve|mostre|visa|vis|hvor|nayta|missa|pokaz|gdzie|ukaz|kde|pokazi|arata|unde|mutasd|hol)\b/;
/** "camera" in the languages Home 3D speaks (plural forms end the same way or are listed). */
const CAMERA = /\b(kamera|camera|cameras|cam|cams|camera's|telecamera|telecamere|camara|camaras|kamerat|kameraer|kamery|kamere|camerele|kamerak)\b/;
const CAMERAS = /\b(cameras|cams|camera's|telecamere|camaras|kamerat|kameraer|kamery|kamere|camerele|kamerak|all camera)\b/;

/**
 * Words in an entity's name that say what it measures, not what it is: "Washing machine power" is asked for as
 * "washing machine". They only drop out while other words remain.
 */
const GENERIC = new Set(
  "sensor status power consumption energy state switch plug socket outlet meter sensor temperature current puissance consommation prise potenza consumo presa potencia enchufe".split(" "),
);

/**
 * Everyday words for a kind of furniture (English; other languages answer to the kind's translated name). Spoken forms
 * only – what people actually say at a wall tablet.
 */
export const SYNONYMS: Record<string, string[]> = {
  washer: ["washer", "washing machine", "laundry"],
  dryer: ["dryer", "tumble dryer"],
  dishwasher: ["dishwasher"],
  fridge: ["fridge", "refrigerator"],
  fridge_smart: ["fridge", "refrigerator"],
  stove: ["stove", "cooktop", "oven", "hob"],
  tv_board: ["tv", "television", "telly"],
  tv_wall: ["tv", "television", "telly"],
  desk: ["computer", "pc", "desk"],
  robot_vacuum: ["robot", "vacuum", "hoover"],
  pool_pump: ["pool pump", "pump"],
  pool_filter: ["filter", "sand filter", "pool filter"],
  pool_heat_pump: ["pool heat pump", "heat pump"],
  inverter: ["solar", "pv", "inverter", "solar inverter"],
  home_battery: ["battery", "home battery"],
  wallbox: ["wallbox", "charger", "car charger"],
  meter: ["meter", "electricity meter"],
  water_heater: ["boiler", "water heater", "hot water"],
  wifi_ap: ["access point", "router", "wifi", "wi fi"],
  lamp_fan: ["fan", "ceiling fan"],
  radiator: ["radiator", "heating"],
  ac_unit: ["air conditioner", "ac", "aircon"],
  sofa: ["couch", "sofa"],
  sofa_l: ["couch", "sofa", "corner sofa"],
  sofa_u: ["couch", "sofa"],
  bed: ["bed"],
  waste_bin: ["bin", "waste bin", "trash"],
  mailbox: ["post", "mailbox", "letterbox"],
  awning: ["awning"],
  parking: ["car", "parking"],
  led_strip: ["led", "led strip"],
  wall_socket: ["socket", "outlet"],
  wall_switch: ["light switch", "switch"],
};

/** Names written as one word end in the thing itself: "drivewaycam" is said as "driveway" and "cam", "porchlight" as "porch" and "light". */
const COMPOUND_TAILS = ["cam", "light", "lamp", "camera", "door", "window", "sensor"];
const split = (w: string): string[] => {
  for (const tail of COMPOUND_TAILS) {
    if (w.length > tail.length + 2 && w.endsWith(tail)) return [w.slice(0, -tail.length), tail];
  }
  return [w];
};
/** The words of a name or a sentence, compounds split. */
const words = (s: string) => normalize(s).split(" ").filter((w) => w.length > 1).flatMap(split);

/** The words of a name that say what it is: generic measuring words drop out while others remain. */
function telling(name: string): string[] {
  const all = words(name);
  const own = all.filter((w) => !GENERIC.has(w));
  return own.length ? own : all;
}

/**
 * The thing a sentence asks to see, or null (then it is for Assist). A device needs a word that asks to see it
 * ("show", "where is") – "turn on the hall light" names the hall light but switches it.
 */
export function showTarget(sentence: string, building: Building, devices: readonly Shown[], alias?: RoomAlias): Target | null {
  const text = normalize(sentence);
  if (!text) return null;
  const said = new Set(words(text));
  // "switch" and "open" also start switching commands: they ask to see something only when the sentence says nothing
  // but the name of what to show (#161) – "switch off the hall light" is for Assist
  const ambiguous = !SHOW.test(text) && SHOW_AMBIGUOUS.test(text);
  const asks = SHOW.test(text) || ambiguous;
  const nothingElse = (named: readonly string[]) =>
    !ambiguous || [...said].every((w) => FILLER.has(w) || SHOW_AMBIGUOUS.test(w) || CAMERA.test(w) || /^all$/.test(w) || named.includes(w));
  const camWord = CAMERA.test(text) || [...said].some((w) => CAMERA.test(w));
  if (asks && CAMERAS.test(text) && devices.some((d) => d.camera) && nothingElse([])) return { kind: "cameras", name: "" };
  const place = findPlace(sentence, building, alias);
  let best: Shown | null = null;
  let bestScore = 0;
  let bestFull = false;
  let bestWords: string[] = [];
  for (const d of devices) {
    const inRoom = !!d.room && ` ${text} `.includes(` ${normalize(d.room)} `);
    for (const n of d.names?.length ? d.names : [d.name]) {
      const own = telling(n);
      if (!own.length) continue;
      const hit = own.filter((w) => said.has(w)).length;
      const full = hit === own.length;
      // a camera asked for by "camera" and its room or part of its name ("the camera in the garden")
      const camera = camWord && d.camera && (hit > 0 || inRoom || devices.filter((x) => x.camera).length === 1);
      if (!full && !camera) continue;
      // longer names first ("Front door camera" over "Camera"), the one in the room named, cameras asked for as such
      const score = hit + (inRoom ? 0.5 : 0) + (camera ? 1 : 0) + (full ? own.length : 0);
      if (score > bestScore) {
        best = d;
        bestScore = score;
        bestFull = full;
        bestWords = own;
      }
    }
  }
  if (best && asks) {
    // the room wins when the device is only half named ("show the living room" – device "Living room lamp") or
    // its name is no more than the room's ("Living room" in the living room); "the radiator in the living room" and
    // "the living room ceiling" name the device
    const roomWords = place && place.kind !== "house" ? new Set(words(place.name)) : null;
    const roomBetter = !!roomWords && !best.camera && (!bestFull || bestWords.every((w) => roomWords.has(w)));
    const named = [...(best.names?.length ? best.names : [best.name]).flatMap(words), ...words(best.room)];
    // with "switch" or "open" only a camera is claimed: a lamp, cover or lock named like that is Assist's to operate
    if (!roomBetter && (!ambiguous || best.camera) && nothingElse(named)) return { kind: "device", id: best.id, entity: best.entity, name: best.name, camera: best.camera };
  }
  return showCommand(sentence, building, alias);
}
