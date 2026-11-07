"""The locating engine: pure logic, loaded straight from its file (no Home Assistant needed)."""

import importlib.util
import math
from pathlib import Path
import random
import sys

_spec = importlib.util.spec_from_file_location(
    "locate_engine", Path(__file__).parents[1] / "custom_components" / "home_3d" / "locate" / "engine.py"
)
engine = importlib.util.module_from_spec(_spec)
sys.modules["locate_engine"] = engine
_spec.loader.exec_module(engine)

# three rooms in a row: kitchen - hall - living; one scanner in the kitchen and one in the living room, none in the hall
PROFILE = {
    "kitchen": {"s_kitchen": -60, "s_living": -88},
    "hall": {"s_kitchen": -74, "s_living": -76},
    "living": {"s_kitchen": -90, "s_living": -58},
}
DOORS = [("kitchen", "hall"), ("hall", "living")]


def reading(room: str, rng: random.Random) -> list[tuple[str, float]]:
    return [(s, rssi + rng.gauss(0, 4)) for s, rssi in PROFILE[room].items() if rng.random() > 0.2]


def calibrated(rng: random.Random) -> "engine.Fingerprints":
    fp = engine.Fingerprints()
    for room in PROFILE:
        for _ in range(30):
            vec: dict[str, list[float]] = {}
            for _ in range(4):
                for s, v in reading(room, rng):
                    vec.setdefault(s, []).append(v)
            fp.add(room, {s: sum(v) / len(v) for s, v in vec.items()})
    return fp


def walk(tracker, fp, plan: list[tuple[str, int]], rng: random.Random, t: float = 0.0):
    shown = []
    for room, seconds in plan:
        for _ in range(seconds):
            t += 1.0
            for s, v in reading(room, rng):
                tracker.add(t, s, v)
            est = tracker.step(t, fp.scores(tracker.window(t)))
            shown.append((room, est.room))
    return shown, t


def test_distance_counts_missing_scanners() -> None:
    assert engine.distance({"a": -60}, {"a": -60}) == 0
    one_sided = engine.distance({"a": -60}, {"a": -60, "b": -80})
    assert one_sided > engine.distance({"a": -60, "b": -80}, {"a": -62, "b": -80})


def test_finds_the_hall_without_a_scanner_of_its_own() -> None:
    rng = random.Random(1)
    fp = calibrated(rng)
    tracker = engine.RoomTracker(list(PROFILE), DOORS)
    shown, _t = walk(tracker, fp, [("kitchen", 40), ("hall", 40), ("living", 40)], rng)
    settled = [(want, got) for i, (want, got) in enumerate(shown) if i % 40 >= 12]
    assert sum(want == got for want, got in settled) / len(settled) > 0.9


def test_room_changes_arrive_within_seconds_and_do_not_flicker() -> None:
    rng = random.Random(2)
    fp = calibrated(rng)
    tracker = engine.RoomTracker(list(PROFILE), DOORS)
    shown, _t = walk(tracker, fp, [("kitchen", 30), ("hall", 30)], rng)
    hall = [got for _want, got in shown[30:]]
    assert "hall" in hall[:12]
    first = hall.index("hall")
    assert all(g == "hall" for g in hall[first:])


def test_nearest_scanner_fallback_without_calibration() -> None:
    scores = engine.nearest_scores({"s_kitchen": -60, "s_living": -85}, {"s_kitchen": "kitchen", "s_living": "living"})
    assert max(scores, key=scores.get) == "kitchen"
    assert engine.nearest_scores({"unknown": -50}, {"s_kitchen": "kitchen"}) == {}


def test_unheard_device_is_away() -> None:
    rng = random.Random(3)
    fp = calibrated(rng)
    tracker = engine.RoomTracker(list(PROFILE), DOORS)
    _shown, t = walk(tracker, fp, [("living", 10)], rng)
    later = t + engine.AWAY_AFTER + 5
    est = tracker.step(later, fp.scores(tracker.window(later)))
    assert est.room is None


def test_presence_sensor_moves_to_a_plausible_room_at_once() -> None:
    rng = random.Random(4)
    fp = calibrated(rng)
    tracker = engine.RoomTracker(list(PROFILE), DOORS)
    _shown, t = walk(tracker, fp, [("kitchen", 20)], rng)
    assert tracker.shown == "kitchen"
    # living is two doors away: a sensor there does not pull the kitchen device over
    assert not tracker.confirm("living", t)
    assert tracker.shown == "kitchen"
    # the hall is the neighbour: its sensor moves the device at once
    assert tracker.confirm("hall", t)
    assert tracker.shown == "hall"


def test_a_quiet_device_keeps_its_last_room() -> None:
    rng = random.Random(5)
    fp = calibrated(rng)
    tracker = engine.RoomTracker(list(PROFILE), DOORS, away_after=engine.THING_AWAY_AFTER)
    _shown, t = walk(tracker, fp, [("living", 15)], rng)
    later = t + 600  # a phone in a drawer for ten minutes
    est = tracker.step(later, fp.scores(tracker.window(later)))
    assert est.room == "living"
    assert est.last_seen == t or est.last_seen <= t


def test_a_room_not_learned_yet_comes_from_its_scanner() -> None:
    rng = random.Random(6)
    fp = calibrated(rng)
    del fp.samples["living"]  # the living room was never learned
    rooms = {"s_kitchen": "kitchen", "s_living": "living"}
    # far from every learned sample: the living room's own scanner speaks
    far = {"s_kitchen": -95.0, "s_living": -55.0}
    assert fp.nearest(far) > engine.UNLEARNED_DISTANCE
    assert max(engine.evidence(fp, far, rooms).items(), key=lambda kv: kv[1])[0] == "living"
    # close to the kitchen: the fingerprints decide
    near = {"s_kitchen": -60.0, "s_living": -88.0}
    assert max(engine.evidence(fp, near, rooms).items(), key=lambda kv: kv[1])[0] == "kitchen"


def test_a_quiet_device_gets_a_longer_window() -> None:
    tracker = engine.RoomTracker(list(PROFILE), DOORS)
    tracker.add(100.0, "s_kitchen", -60)
    tracker.add(92.0, "s_living", -85)
    tracker.add(90.0, "s_hall", -75)
    assert set(tracker.adaptive_window(101.0)) == {"s_kitchen", "s_living", "s_hall"}
    # a talkative device keeps the short window
    for s in ("s_a", "s_b", "s_c"):
        tracker.add(100.5, s, -70)
    assert "s_hall" not in tracker.adaptive_window(101.0)


# ---------------------------------------------------------------- the estimate reads only what it needs (#191)


def brute_window(readings: list[tuple[float, str, float]], now: float, length: float) -> dict[str, float]:
    sums: dict[str, list[float]] = {}
    for t, scanner, rssi in readings:
        if now - length <= t <= now:
            sums.setdefault(scanner, []).append(rssi)
    return {s: sum(v) / len(v) for s, v in sums.items()}


def test_the_window_is_the_same_as_a_scan_of_every_reading() -> None:
    rng = random.Random(7)
    tracker = engine.RoomTracker(list(PROFILE), DOORS)
    seen: list[tuple[float, str, float]] = []
    for step in range(200):
        now = float(step)
        for s in ("a", "b", "c"):
            for _ in range(rng.randint(0, 6)):
                t = now - rng.random() * 1.5  # some arrive late, out of order
                r = rng.uniform(-95, -50)
                tracker.add(t, s, r)
                seen.append((t, s, r))
        for length in (engine.WINDOW, engine.QUIET_WINDOW):
            got, want = tracker.window(now, length), brute_window(seen, now, length)
            assert got.keys() == want.keys()
            assert all(abs(got[k] - want[k]) < 1e-9 for k in want)


def test_a_window_reads_only_its_own_slice_and_old_readings_go() -> None:
    tracker = engine.RoomTracker(list(PROFILE), DOORS)
    for t in range(3000):  # a busy scanner: ten readings a second for five minutes
        for i in range(10):
            tracker.add(t + i / 10, "s", -60.0)
    tracker.window(3000.0)
    times, _values = tracker._series["s"]
    assert len(times) <= int(engine.KEEP) * 10 + 10  # the last thirty seconds only
    reads: list[int] = []

    class Spy(list):
        def __getitem__(self, key):
            out = super().__getitem__(key)
            if isinstance(key, slice):
                reads.append(len(out))
            return out

    tracker._series["s"] = (Spy(times), Spy(tracker._series["s"][1]))
    tracker.window(3000.0)
    assert sum(reads) <= int(engine.WINDOW) * 10 * 2 + 20  # four seconds of values, not thirty


def test_the_samples_are_measured_once_per_estimate(monkeypatch) -> None:
    fp = calibrated(random.Random(3))
    calls = 0
    real = engine.distance

    def counting(a, b, miss=engine.MISS):
        nonlocal calls
        calls += 1
        return real(a, b, miss)

    monkeypatch.setattr(engine, "distance", counting)
    vector = {"s_kitchen": -61.0, "s_living": -87.0}
    scores = engine.evidence(fp, vector, {})
    assert calls == sum(len(v) for v in fp.samples.values())  # once each, not once for nearest and again for scores
    assert max(scores, key=scores.__getitem__) == "kitchen"


def test_the_votes_are_the_same_as_sorting_every_sample() -> None:
    rng = random.Random(11)
    fp = calibrated(rng)
    for _ in range(20):
        vec = {s: -60 + rng.gauss(0, 15) for s in PROFILE["kitchen"] if rng.random() > 0.2}
        if not vec:
            continue
        ranked = sorted(
            ((engine.distance(vec, v), room) for room, vs in fp.samples.items() for v in vs), key=lambda x: x[0]
        )
        votes: dict[str, float] = {}
        for d, room in ranked[: engine.K]:
            votes[room] = votes.get(room, 0.0) + 1.0 / (0.5 + d)
        total = sum(votes.values())
        want = {r: v / total for r, v in votes.items()}
        got = fp.scores(vec)
        assert got.keys() == want.keys() and all(abs(got[r] - want[r]) < 1e-9 for r in want)


def test_learning_and_dropping_change_the_stamp() -> None:
    fp = engine.Fingerprints()
    first = fp.stamp()
    fp.add("kitchen", {"s": -60.0}, keep=2)
    fp.add("kitchen", {"s": -61.0}, keep=2)
    fp.add("kitchen", {"s": -62.0}, keep=2)  # at the cap the count stays, the version does not
    assert len(fp.samples["kitchen"]) == 2 and fp.samples["kitchen"][-1] == {"s": -62.0}
    assert fp.stamp() not in (first,)
    before = fp.stamp()
    fp.drop("kitchen")
    assert fp.stamp() != before and fp.rooms() == []


def _big_house(rng: random.Random) -> tuple["engine.Fingerprints", dict[str, tuple[float, float]]]:
    """12 rooms in a 4 x 3 grid with a scanner in each, 120 samples a room (#370)."""
    spots = {f"s{n}": (4.0 * (n % 4) + 2, 4.0 * (n // 4) + 2) for n in range(12)}

    def heard(x: float, y: float) -> dict[str, float]:
        out = {}
        for s, (sx, sy) in spots.items():
            rssi = -45 - 25 * math.log10(max(1.0, math.hypot(x - sx, y - sy))) + rng.gauss(0, 4)
            if rssi > -92 and rng.random() > 0.15:
                out[s] = round(rssi, 1)
        return out

    fp = engine.Fingerprints(
        {
            f"room{n}": [heard(sx + rng.uniform(-1.5, 1.5), sy + rng.uniform(-1.5, 1.5)) for _ in range(120)]
            for n, (sx, sy) in enumerate(spots.values())
        }
    )
    return fp, spots


def test_a_big_house_is_measured_against_the_near_rooms_only(monkeypatch) -> None:
    """#370: a window is measured against the samples of the CANDIDATE_ROOMS rooms whose middle is nearest; the
    room it votes for is the one all samples vote for."""
    rng = random.Random(370)
    fp, spots = _big_house(rng)
    agree = 0
    windows = 200
    for _ in range(windows):
        x, y = rng.uniform(0, 16), rng.uniform(0, 12)
        window = {
            s: -45 - 25 * math.log10(max(1.0, math.hypot(x - sx, y - sy))) + rng.gauss(0, 3)
            for s, (sx, sy) in spots.items()
        }
        window = {s: v for s, v in window.items() if v > -92 and rng.random() > 0.15}
        every = engine.scores_from(fp.distances(window))
        near = engine.evidence(fp, window, {})
        agree += max(every, key=every.__getitem__) == max(near, key=near.__getitem__)
    assert agree >= 0.98 * windows

    calls = 0
    real = engine.distance

    def counting(a, b, miss=engine.MISS):
        nonlocal calls
        calls += 1
        return real(a, b, miss)

    monkeypatch.setattr(engine, "distance", counting)
    engine.evidence(fp, {"s0": -50.0, "s1": -60.0, "s4": -62.0}, {})
    # 12 room middles, then the 4 nearest rooms' samples: a third of the 1440
    assert calls == 12 + engine.CANDIDATE_ROOMS * 120
    # a small house is measured against everything (no middles needed)
    assert calibrated(random.Random(1)).candidate_rooms({"s_kitchen": -60.0}) is None


def test_the_room_middles_follow_the_samples() -> None:
    fp = engine.Fingerprints({"kitchen": [{"a": -60.0, "b": -80.0}, {"a": -62.0}], "hall": [{"a": -80.0}]})
    assert fp.middles() == {"kitchen": {"a": -61.0, "b": -80.0}, "hall": {"a": -80.0}}
    assert fp.middles() is fp.middles()
    fp.add("kitchen", {"a": -64.0})  # b now heard in only one of three samples: left out
    assert fp.middles()["kitchen"] == {"a": -62.0}
