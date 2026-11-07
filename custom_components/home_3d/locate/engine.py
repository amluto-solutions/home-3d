"""Room locating from Bluetooth signal strengths - pure logic, no Home Assistant imports (unit-testable).

How a room is chosen, every STEP seconds per tracked device:
1. Window: the mean RSSI per scanner over the last WINDOW seconds (a scanner that heard nothing is *missing*, not far).
2. Evidence: weighted kNN against the fingerprints learned on the calibration walk (rooms without fingerprints are
   reached through the nearest-scanner fallback: a scanner placed in a room speaks for it).
3. Filter: a forward filter over the rooms - staying is likely, moving through a door to a neighbour less so, other
   jumps rare (the door graph comes from the floor plan).
4. Hysteresis: the shown room only changes when another room leads with SWITCH_PROB for SWITCH_HOLD steps.
5. Presence sensors: a motion/presence sensor of a room turning on moves the device there at once, when Bluetooth
   finds that room plausible (a neighbour of the shown room, or some belief) - Bluetooth says who, the sensor when.
"""

from __future__ import annotations

from bisect import bisect_left, bisect_right
from dataclasses import dataclass, field
import heapq
import math

WINDOW = 4.0  # seconds of readings per estimate
QUIET_WINDOW = 15.0  # a quiet device (an iPhone in a pocket) heard by fewer than QUIET_SCANNERS: look further back
QUIET_SCANNERS = 3
OWN_SHARE = 0.7  # a device's own learning is used alone once it covers this share of the learned rooms
STEP = 1.0  # seconds between estimates
K = 5
MISS = 12.0  # dB penalty when only one side heard a scanner
STAY = 0.85
NEIGHBOUR_SHARE = 0.97  # of the moving mass that goes through doors
FLOOR_EPS = 0.02
SWITCH_PROB = 0.8
SWITCH_HOLD = 3
AWAY_AFTER = 120.0  # seconds without any reading: a person is no longer placed
THING_AWAY_AFTER = 6 * 3600.0  # a thing (keys, a phone lying somewhere) keeps its last room much longer
UNLEARNED_DISTANCE = 9.5  # dB: farther than this from every learned sample, the device is in a room not learned yet
CONFIRM_PLAUSIBLE = 0.1  # belief a room needs for a presence sensor to move the device there
KEEP = 30.0  # seconds of readings kept per scanner (the longest window any estimate reads is QUIET_WINDOW)
# a window is measured against the samples of the CANDIDATE_ROOMS rooms whose middle is nearest only (#370): the k
# nearest samples lie there, and a house of 12 rooms costs a third
CANDIDATE_ROOMS = 4


Vector = dict[str, float]


def distance(a: Vector, b: Vector, miss: float = MISS) -> float:
    """RMS difference over the scanners either side heard; heard on one side only costs `miss` dB.

    The hot loop of every estimate (#370): one pass over `b`, no key sets built."""
    get = a.get
    total = 0.0
    common = 0
    for k, v in b.items():
        x = get(k)
        if x is not None:
            d = x - v
            total += d * d
            common += 1
    union = len(a) + len(b) - common
    if not union:
        return math.inf
    return math.sqrt((total + miss * miss * (union - common)) / union)


@dataclass
class Fingerprints:
    """Calibration samples: room id -> list of window vectors.

    `version` goes up whenever a sample is added or dropped through the methods, so a caller can tell cheaply whether
    anything it derived from the samples (the pooled set, a remembered estimate) is still good."""

    samples: dict[str, list[Vector]] = field(default_factory=dict)
    version: int = field(default=0, compare=False)
    _middles: tuple[tuple[int, int], dict[str, Vector]] | None = field(
        default=None, init=False, compare=False, repr=False
    )

    def add(self, room: str, vector: Vector, keep: int | None = None) -> None:
        """Learn one window for a room; with `keep` only the newest `keep` samples of the room stay."""
        if vector:
            rows = self.samples.setdefault(room, [])
            rows.append(dict(vector))
            if keep is not None:
                del rows[:-keep]
            self.version += 1

    def drop(self, room: str | None = None) -> None:
        """Forget one room, or (without a room) everything."""
        if room is None:
            self.samples.clear()
        else:
            self.samples.pop(room, None)
        self.version += 1

    def stamp(self) -> tuple[int, int]:
        """Changes whenever the samples do (the version, and the count for samples edited in place)."""
        return self.version, sum(len(v) for v in self.samples.values())

    def rooms(self) -> list[str]:
        return [r for r, s in self.samples.items() if s]

    def distances(self, vector: Vector, rooms: list[str] | None = None) -> list[tuple[float, str]]:
        """(distance, room) of every learned sample (of `rooms` only, when given) - computed once per estimate and
        shared by nearest and scores."""
        samples = self.samples if rooms is None else {r: self.samples[r] for r in rooms if r in self.samples}
        return [(distance(vector, v), room) for room, vectors in samples.items() for v in vectors]

    def middles(self) -> dict[str, Vector]:
        """Room -> the mean of its samples, over the scanners heard in at least half of them (kept until a sample
        changes)."""
        stamp = self.stamp()
        if self._middles is None or self._middles[0] != stamp:
            out: dict[str, Vector] = {}
            for room, vectors in self.samples.items():
                sums: dict[str, float] = {}
                counts: dict[str, int] = {}
                for v in vectors:
                    for k, x in v.items():
                        sums[k] = sums.get(k, 0.0) + x
                        counts[k] = counts.get(k, 0) + 1
                if vectors:
                    out[room] = {k: sums[k] / counts[k] for k in sums if counts[k] * 2 >= len(vectors)}
            self._middles = (stamp, out)
        return self._middles[1]

    def candidate_rooms(self, vector: Vector, n: int = CANDIDATE_ROOMS) -> list[str] | None:
        """The n rooms whose middle is nearest the window, None (all) when there are no more than n (#370)."""
        middles = self.middles()
        if len(middles) <= n:
            return None
        return heapq.nsmallest(n, middles, key=lambda r: distance(vector, middles[r]))

    def nearest(self, vector: Vector) -> float:
        """Distance to the closest learned sample (inf without samples)."""
        return min((d for d, _room in self.distances(vector)), default=math.inf)

    def scores(self, vector: Vector, k: int = K) -> dict[str, float]:
        """Room -> share of the weighted votes of the k nearest samples (empty without samples)."""
        return scores_from(self.distances(vector), k)


def scores_from(dists: list[tuple[float, str]], k: int = K) -> dict[str, float]:
    """Votes of the k nearest of already measured samples (a partial selection, not a sort of all of them)."""
    votes: dict[str, float] = {}
    for d, room in heapq.nsmallest(k, dists, key=lambda x: x[0]):
        votes[room] = votes.get(room, 0.0) + 1.0 / (0.5 + d)
    total = sum(votes.values())
    return {r: v / total for r, v in votes.items()} if total else {}


def nearest_scores(vector: Vector, scanner_rooms: dict[str, str]) -> dict[str, float]:
    """Fallback without fingerprints: the strongest placed scanner speaks for its room (softly for the runner-up)."""
    placed = sorted(((rssi, scanner_rooms[s]) for s, rssi in vector.items() if s in scanner_rooms), reverse=True)
    if not placed:
        return {}
    scores: dict[str, float] = {}
    for rank, (_rssi, room) in enumerate(placed[:3]):
        scores[room] = scores.get(room, 0.0) + (0.7, 0.2, 0.1)[rank]
    total = sum(scores.values())
    return {r: v / total for r, v in scores.items()}


def evidence(fp: Fingerprints | None, vector: Vector, scanner_rooms: dict[str, str]) -> dict[str, float]:
    """Room scores for a window: the learned fingerprints; where nothing learned is near (a room not learned yet,
    upstairs say), the placed scanners of the rooms not learned; without any learning the nearest scanner."""
    if fp is None or len(fp.rooms()) < 2:
        return nearest_scores(vector, scanner_rooms)
    # one pass over the samples serves both the nearest check and the votes; in a big house only over the samples
    # of the rooms the window is near (#370)
    dists = fp.distances(vector, fp.candidate_rooms(vector))
    if min((d for d, _room in dists), default=math.inf) <= UNLEARNED_DISTANCE:
        return scores_from(dists)
    learned = set(fp.rooms())
    return nearest_scores(vector, {s: r for s, r in scanner_rooms.items() if r not in learned})


@dataclass
class Estimate:
    room: str | None
    probability: float
    since: float | None
    last_seen: float | None


class RoomTracker:
    """Readings in, a stable room out - one per tracked device."""

    def __init__(
        self, rooms: list[str], doors: list[tuple[str, str]] | None = None, away_after: float = AWAY_AFTER
    ) -> None:
        self.rooms = list(rooms)
        self.away_after = away_after
        self.neighbours: dict[str, set[str]] = {r: set() for r in self.rooms}
        for a, b in doors or []:
            if a in self.neighbours and b in self.neighbours:
                self.neighbours[a].add(b)
                self.neighbours[b].add(a)
        self.belief = {r: 1.0 / len(self.rooms) for r in self.rooms} if self.rooms else {}
        # readings per scanner, in time order (times and values side by side): a window reads only its own slice
        self._series: dict[str, tuple[list[float], list[float]]] = {}
        self.shown: str | None = None
        self.since: float | None = None
        self.last_seen: float | None = None
        self._candidate: str | None = None
        self._streak = 0

    def add(self, t: float, scanner: str, rssi: float) -> None:
        times, values = self._series.setdefault(scanner, ([], []))
        if not times or t >= times[-1]:
            times.append(t)
            values.append(rssi)
        else:  # a late reading goes where its time belongs
            i = bisect_right(times, t)
            times.insert(i, t)
            values.insert(i, rssi)
        self.last_seen = t if self.last_seen is None else max(self.last_seen, t)

    def window(self, now: float, length: float = WINDOW) -> Vector:
        """Mean RSSI per scanner over the last `length` seconds; only that slice of each scanner's readings is read."""
        out: Vector = {}
        for scanner in list(self._series):
            times, values = self._series[scanner]
            old = bisect_left(times, now - KEEP)
            if old:
                del times[:old], values[:old]
            if not times:
                del self._series[scanner]
                continue
            lo, hi = bisect_left(times, now - length), bisect_right(times, now)
            if hi > lo:
                out[scanner] = sum(values[lo:hi]) / (hi - lo)
        return out

    def adaptive_window(self, now: float) -> Vector:
        """The usual window; for a quiet device (few scanners heard) a longer one, so it is placed at all."""
        vector = self.window(now)
        if len(vector) < QUIET_SCANNERS:
            longer = self.window(now, QUIET_WINDOW)
            if len(longer) > len(vector):
                return longer
        return vector

    def _move(self, src: str, dst: str) -> float:
        """Probability mass share from src to dst for one step (dst != src)."""
        moving = 1.0 - STAY
        near = self.neighbours.get(src, set())
        if not near:
            return moving / max(len(self.rooms) - 1, 1)
        if dst in near:
            return moving * NEIGHBOUR_SHARE / len(near)
        return moving * (1.0 - NEIGHBOUR_SHARE) / max(len(self.rooms) - 1 - len(near), 1)

    def confirm(self, room: str, now: float) -> bool:
        """A presence sensor of `room` turned on: move there at once if Bluetooth finds it plausible."""
        if room not in self.belief or room == self.shown or self.shown is None:
            return False
        if self.last_seen is None or now - self.last_seen > self.away_after:
            return False
        if self.belief[room] < CONFIRM_PLAUSIBLE and room not in self.neighbours.get(self.shown, set()):
            return False
        rest = (1.0 - 0.9) / max(len(self.belief) - 1, 1)
        self.belief = {r: 0.9 if r == room else rest for r in self.belief}
        self.shown, self.since = room, now
        self._streak, self._candidate = 0, None
        return True

    def step(self, now: float, evidence: dict[str, float]) -> Estimate:
        if self.last_seen is None or now - self.last_seen > self.away_after:
            self.shown, self.since = None, None
            return Estimate(None, 0.0, None, self.last_seen)
        if now - self.last_seen > WINDOW * 3 and self.shown is not None:
            # nothing heard for a while: the last room stays (a phone in a pocket goes quiet), the belief does not move
            return Estimate(self.shown, round(self.belief.get(self.shown, 0.0), 3), self.since, self.last_seen)
        if evidence and self.rooms:
            prior = {
                r: self.belief[r] * STAY + sum(self.belief[o] * self._move(o, r) for o in self.rooms if o != r)
                for r in self.rooms
            }
            post = {r: prior[r] * (evidence.get(r, 0.0) + FLOOR_EPS) for r in self.rooms}
            total = sum(post.values())
            self.belief = {r: v / total for r, v in post.items()}
        if not self.belief:
            return Estimate(None, 0.0, None, self.last_seen)
        lead = max(self.belief, key=self.belief.__getitem__)
        if self.shown is None:
            self.shown, self.since = lead, now
        elif lead != self.shown and self.belief[lead] >= SWITCH_PROB:
            self._streak = self._streak + 1 if self._candidate == lead else 1
            self._candidate = lead
            if self._streak >= SWITCH_HOLD:
                self.shown, self.since = lead, now
                self._streak, self._candidate = 0, None
        else:
            self._streak, self._candidate = 0, None
        return Estimate(self.shown, round(self.belief.get(self.shown, 0.0), 3), self.since, self.last_seen)
