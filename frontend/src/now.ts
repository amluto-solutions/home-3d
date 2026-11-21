// "What's going on?" (#493, ported from NeonPlan 3D 4.0.0, MIT, Mastershort): the phone view's short answer to "is all
// well at home?". It is built only from what the 3D view has already worked out (warnings, openings, locks, people,
// the household card, lights, energy, cars): nothing extra is asked from Home Assistant. Pure code, no DOM.

/** Where a tap on a line goes: an entity of the plan, a room, or a window or door of the plan. */
export interface NowTarget {
  entity?: string | null;
  floorId?: string | null;
  roomId?: string | null;
  /** An opening of the plan (its id): the view looks at it from inside its room. */
  opening?: string;
  /** The place's name in the list of a line with several places ("Bathroom", "Front door"). */
  label?: string;
}

/** The button beside a line: lights off, or lock the locks. */
export interface NowAction {
  kind: "lights_off" | "lock";
  entities: string[];
}

export interface NowInput {
  /** The house's warnings, as the 3D view words them. */
  alerts: (NowTarget & { text: string })[];
  /** Doors and windows with a contact or a cover; several entities of one opening share its id. */
  openings: (NowTarget & { id: string; kind: "door" | "window" | "garage" | "roof_window"; name?: string; room: string; open: boolean; tilted: boolean })[];
  /** Locks that are not locked. */
  unlocked: (NowTarget & { name: string })[];
  /** Home Assistant's persons: home or not, with the room where the plan knows it. */
  people: (NowTarget & { name: string; home: boolean; room: string | null })[];
  /** The household card's lines. */
  household: { text: string; entity: string | null; hot: boolean }[];
  /** Lights on, per room (`on`: their entities). */
  lights: (NowTarget & { room: string; count: number; on?: string[] })[];
  /** Watts (and the battery's %); null where the house has no such sensor. */
  energy: { consumption: number | null; solar: number | null; grid: number | null; soc: number | null } | null;
  cars: (NowTarget & { name: string; present: boolean; charging: boolean; soc: number | null })[];
  /** The person who looks is away from home: safety lines come first. */
  away: boolean;
}

export type NowKind = "alert" | "open" | "unlocked" | "people" | "household" | "lights" | "energy" | "car" | "calm";

export interface NowItem {
  kind: NowKind;
  /** 2 a warning, 1 needs a look, 0 good to know. */
  level: 0 | 1 | 2;
  title: string;
  detail: string;
  /** The places a tap shows; empty: the line shows nothing. */
  targets: NowTarget[];
  /** The obvious thing to do for the whole line. */
  action?: NowAction;
}

/** The words the list uses; `n` is the count in the plural forms. */
export interface NowWords {
  open(n: number): string;
  tilted: string;
  unlocked(n: number): string;
  home: string;
  away: string;
  nobodyHome: string;
  lights(n: number): string;
  energyUse: string;
  energySolar: string;
  energyGrid: string;
  energyFeed: string;
  battery: string;
  charging: string;
  carAway: string;
  calm: string;
  calmDetail: string;
  watts(w: number): string;
}

/** At most `max` names, then an ellipsis. */
const join = (parts: string[], max = 4) => (parts.length > max ? [...parts.slice(0, max), "…"] : parts).join(", ");

/** Each opening that is open or tilted, once (two contacts and a blind of one window are one window). */
function openNow(i: NowInput): NowInput["openings"] {
  const seen = new Set<string>();
  return i.openings.filter((o) => {
    if (!(o.open || o.tilted) || seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}

const openLabel = (o: NowInput["openings"][number], w: NowWords, sep: string) => [o.room, o.name, o.tilted ? `(${w.tilted})` : ""].filter(Boolean).join(sep);

/**
 * The list, most urgent first: warnings; open windows and doors and unlocked locks; the household's jobs that are due;
 * then people, the other household lines, lights, cars and energy. Away from home, the people line comes right after
 * the warnings. With nothing that needs a look, one "all is well" line leads.
 */
export function nowItems(i: NowInput, w: NowWords): NowItem[] {
  const out: NowItem[] = [];
  for (const a of i.alerts) out.push({ kind: "alert", level: 2, title: a.text, detail: "", targets: [a] });

  const openings = openNow(i);
  if (openings.length) {
    const rooms = [...new Set(openings.map((o) => (o.tilted ? `${o.room} (${w.tilted})` : o.room)).filter(Boolean))];
    const targets = openings.map((o) => ({ entity: o.entity, opening: o.id, floorId: o.floorId, roomId: o.roomId, label: openLabel(o, w, " ") }));
    out.push({ kind: "open", level: 1, title: w.open(openings.length), detail: join(rooms), targets });
  }
  if (i.unlocked.length) {
    out.push({
      kind: "unlocked",
      level: 1,
      title: w.unlocked(i.unlocked.length),
      detail: join(i.unlocked.map((l) => l.name)),
      targets: i.unlocked.map((l) => ({ entity: l.entity, floorId: l.floorId, roomId: l.roomId, label: l.name })),
      action: { kind: "lock", entities: i.unlocked.flatMap((l) => (l.entity ? [l.entity] : [])) },
    });
  }

  if (i.people.length) {
    const home = i.people.filter((p) => p.home);
    const gone = i.people.filter((p) => !p.home);
    const title = home.length ? `${w.home}: ${join(home.map((p) => (p.room ? `${p.name} (${p.room})` : p.name)))}` : w.nobodyHome;
    const targets = home.filter((p) => p.roomId).map((p) => ({ floorId: p.floorId, roomId: p.roomId, label: `${p.name} · ${p.room ?? ""}` }));
    out.push({ kind: "people", level: 0, title, detail: gone.length ? `${w.away}: ${join(gone.map((p) => p.name))}` : "", targets });
  }

  for (const h of i.household.filter((x) => x.hot)) out.push({ kind: "household", level: 1, title: h.text, detail: "", targets: h.entity ? [{ entity: h.entity }] : [] });
  const calm = i.household.filter((x) => !x.hot);
  if (calm.length) out.push({ kind: "household", level: 0, title: calm[0].text, detail: join(calm.slice(1).map((h) => h.text), 3), targets: [] });

  const lit = i.lights.filter((l) => l.count > 0);
  const lightsOn = lit.reduce((n, l) => n + l.count, 0);
  if (lightsOn) {
    const entities = lit.flatMap((l) => l.on ?? []);
    out.push({
      kind: "lights",
      level: 0,
      title: w.lights(lightsOn),
      detail: join(lit.map((l) => l.room)),
      targets: lit.map((l) => ({ floorId: l.floorId, roomId: l.roomId, label: l.count > 1 ? `${l.room} (${l.count})` : l.room })),
      ...(entities.length ? { action: { kind: "lights_off" as const, entities } } : {}),
    });
  }

  for (const c of i.cars) {
    const soc = c.soc !== null ? `${Math.round(c.soc)} %` : "";
    const state = !c.present ? w.carAway : c.charging ? w.charging : "";
    if (state || soc) out.push({ kind: "car", level: 0, title: c.name, detail: [state, soc].filter(Boolean).join(" · "), targets: [] });
  }

  const e = i.energy;
  if (e && (e.consumption !== null || e.solar !== null)) {
    const parts: string[] = [];
    if (e.solar !== null && e.solar > 5) parts.push(`${w.energySolar} ${w.watts(e.solar)}`);
    if (e.grid !== null && Math.abs(e.grid) > 5) parts.push(`${e.grid < 0 ? w.energyFeed : w.energyGrid} ${w.watts(Math.abs(e.grid))}`);
    if (e.soc !== null) parts.push(`${w.battery} ${Math.round(e.soc)} %`);
    const title = e.consumption !== null ? `${w.energyUse} ${w.watts(e.consumption)}` : (parts.shift() ?? "");
    if (title) out.push({ kind: "energy", level: 0, title, detail: parts.join(" · "), targets: [] });
  }

  const rank = (it: NowItem) => (it.level === 2 ? 0 : i.away && it.kind === "people" ? 1 : it.level === 1 ? 2 : 3);
  const sorted = out
    .map((it, n) => ({ it, n }))
    .sort((a, b) => rank(a.it) - rank(b.it) || a.n - b.n)
    .map((x) => x.it);
  if (!sorted.some((it) => it.level > 0)) sorted.unshift({ kind: "calm", level: 0, title: w.calm, detail: w.calmDetail, targets: [] });
  return sorted;
}

/**
 * The status line above the bar: the first warning (with the count of the others), else the lines that need a look
 * (with the lights when there is room), else "all is well" and the lights. `level` gives its colour.
 */
export function nowSummary(items: NowItem[]): { text: string; level: 0 | 1 | 2 } {
  const alerts = items.filter((it) => it.level === 2);
  if (alerts.length) return { text: alerts.length > 1 ? `${alerts[0].title} (+${alerts.length - 1})` : alerts[0].title, level: 2 };
  const look = items.filter((it) => it.level === 1);
  const lights = items.find((it) => it.kind === "lights");
  if (look.length) return { text: [...look.slice(0, 2).map((it) => it.title), ...(lights && look.length < 2 ? [lights.title] : [])].join(" · "), level: 1 };
  const calm = items.find((it) => it.kind === "calm");
  return { text: [calm?.title ?? "", lights?.title ?? ""].filter(Boolean).join(" · "), level: 0 };
}

/** One stop of the house check: a place to look at, and what can be done there. */
export interface NowStop {
  kind: "open" | "unlocked" | "lights";
  title: string;
  target: NowTarget;
  action?: NowAction;
}

/**
 * The house check (before going out or to bed): every open window or door, every unlocked lock and every room with a
 * light on, one after another. Openings come first (they need a hand), then locks, then lights.
 */
export function nowStops(i: NowInput, w: NowWords): NowStop[] {
  const stops: NowStop[] = [];
  for (const o of openNow(i)) stops.push({ kind: "open", title: openLabel(o, w, " · "), target: { entity: o.entity, opening: o.id, floorId: o.floorId, roomId: o.roomId } });
  for (const l of i.unlocked) stops.push({ kind: "unlocked", title: l.name, target: { entity: l.entity, floorId: l.floorId, roomId: l.roomId }, ...(l.entity ? { action: { kind: "lock" as const, entities: [l.entity] } } : {}) });
  for (const l of i.lights) {
    if (l.count <= 0) continue;
    stops.push({ kind: "lights", title: `${l.room} · ${w.lights(l.count)}`, target: { floorId: l.floorId, roomId: l.roomId }, ...(l.on?.length ? { action: { kind: "lights_off" as const, entities: l.on } } : {}) });
  }
  return stops;
}
