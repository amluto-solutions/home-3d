// Spoken answers about racks (#122): "how hot is the rack?", "what's the UPS battery?", "which devices are online?".
// Answered from the rack card's values (rack-card.ts, built by the view and handed in as `SpokenRack`), so what voice
// says is what the card shows. Pure; lives in the voice bundle, not the main one.

import { normalize } from "./commands.ts";

/** One card value ready to speak (the view formats the text, as the card does). */
export interface SpokenRackValue {
  key: string;
  kind: string;
  /** The gear it comes from (slot id); null for figures over the whole rack. */
  slot: string | null;
  label: string;
  text: string;
  value: number | null;
  /** "@online": of how many. */
  of?: number;
}

export interface SpokenRack {
  id: string;
  name: string;
  /** The room it stands in ("" when none). */
  room: string;
  /** Gear names by slot id. */
  names: Record<string, string>;
  values: SpokenRackValue[];
}

export interface RackAnswer {
  text: string;
  rackId: string;
}

type Say = (key: string, vars?: Record<string, string | number>) => string;

const RACK = /\b(rack|racks|serverrack|server cabinet|network cabinet|cabinet|armoire reseau|baie|armario de red|armadio rete|netwerkkast|szafa)\b/;
/** Gear that stands for a rack on its own ("the UPS battery"). */
const UPS = /\b(ups)\b/;
const COMMAND = /\b(turn|switch|make|set|start|stop|reboot|restart|boot)\b/;
const STATUS = /\b(status|state|how|doing|ok|okay|ca va|como|come)\b/;

/** What a sentence asks for, in the order that settles clashes ("battery runtime" is a runtime). */
const KINDS: [string, RegExp][] = [
  ["status", /\b(online|offline|reachable|alive|en ligne|en linea|raggiungibil)\b/],
  ["temperature", /\b(temperatur\w*|temperature|temp|warm|warme|hot|heat\w*|chaud|temperatura|caliente|caldo|heet|warmte|cool)\b/],
  ["runtime", /\b(runtime|autonomie|autonomia|autonomy|how long|backup time)\b/],
  ["battery", /\b(batterie|akku|accu|battery|bateria|batteria|charge level)\b/],
  ["load", /\b(load|carga|carico)\b/],
  ["power", /\b(watt|watts|power|consumption|strom|poe|puissance|potenza|potencia)\b/],
  ["cpu", /\b(cpu|processor)\b/],
  ["memory", /\b(ram|memory|memoire)\b/],
  ["disk", /\b(disk|volume|storage|space|raid)\b/],
  ["throughput", /\b(throughput|bandwidth|speed|internet|wan|download|upload|traffic)\b/],
];

const words = (s: string): string[] => normalize(s).split(" ").filter((w) => w.length > 1);
const stands = (text: string, name: string): boolean => {
  const w = words(name);
  return w.length > 0 && ` ${text} `.includes(` ${w.join(" ")} `);
};

/**
 * The answer to a sentence about a rack, or null when it is none (it then goes on to Assist). A rack is meant by the
 * word "rack" (or cabinet …), by its own name, or by a gear it holds that the sentence names ("the UPS").
 */
export function rackAnswer(sentence: string, racks: readonly SpokenRack[], say: Say): RackAnswer | null {
  const text = normalize(sentence);
  if (!text || !racks.length || COMMAND.test(text)) return null;
  let kind = KINDS.find(([, re]) => re.test(text))?.[0] ?? null;
  const rackWord = RACK.test(text);
  const upsWord = UPS.test(text);
  if (!kind && upsWord) kind = "battery";
  if (!kind && !(rackWord && STATUS.test(text))) return null;

  // which rack: the one named (4), the room named (2), gear named or a UPS (3); it needs the word rack, its name, its gear or a UPS
  let best: SpokenRack | null = null;
  let bestScore = 0;
  for (const r of racks) {
    const gear = Object.entries(r.names).filter(([slot, n]) => stands(text, n) && r.values.some((x) => x.slot === slot));
    const named = stands(text, r.name);
    const ups = upsWord && r.values.some((x) => x.kind === "battery" || x.kind === "runtime");
    if (!rackWord && !named && !gear.length && !ups) continue;
    const score = (named ? 4 : 0) + (r.room && stands(text, r.room) ? 2 : 0) + (gear.length ? 3 : 0) + (ups ? 3 : 0) + (rackWord ? 1 : 0) + (kind && r.values.some((x) => x.kind === kind) ? 0.5 : 0);
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  if (!best) return null;
  const rack = best;
  const out = (t: string): RackAnswer => ({ text: t, rackId: rack.id });
  const gearName = (slot: string | null) => (slot && rack.names[slot]) || rack.name;

  if (!kind) {
    const list = rack.values.slice(0, 4).map((x) => `${x.label} ${x.text}`).join(", ");
    return out(list ? say("voice_rack_summary", { name: rack.name, list }) : say("voice_rack_nothing", { name: rack.name }));
  }
  const of = rack.values.filter((x) => x.kind === kind);
  // the gear named in the sentence wins (a UPS word names the UPS), else the first
  const pick = of.find((x) => x.slot && stands(text, rack.names[x.slot] ?? "")) ?? (upsWord ? of.find((x) => x.slot && UPS.test(normalize(rack.names[x.slot] ?? ""))) : undefined) ?? of[0];
  const what = say(`rack_kind_${kind}`);
  if (!pick) return out(say("voice_rack_missing", { name: rack.name, what }));
  if (pick.key === "@online") return out(say("voice_rack_online", { name: rack.name, on: pick.value ?? 0, total: pick.of ?? 0 }));
  if (pick.value === null) return out(say("voice_rack_unavailable", { what, gear: gearName(pick.slot) }));
  if (pick.key === "@hottest") return out(say("voice_rack_hot", { name: rack.name, gear: gearName(pick.slot), value: pick.text }));
  return out(say("voice_rack_value", { gear: gearName(pick.slot), what, value: pick.text }));
}
