"""The packs that ship with Home 3D (the themed packs, #111): offline, schema-checked, one file per item."""

from __future__ import annotations

import json
from pathlib import Path

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.home_3d import packs
from custom_components.home_3d.const import DOMAIN

BUNDLED = Path(__file__).resolve().parent.parent / "custom_components" / "home_3d" / "bundled_packs"
CORE = BUNDLED / "amluto.living"
KITCHEN_BATH = BUNDLED / "amluto.kitchen-bath"


async def _client(hass: HomeAssistant, hass_ws_client):
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return await hass_ws_client(hass)


async def _listed(client) -> list[dict]:
    await client.send_json_auto_id({"type": "home_3d/packs/list"})
    return (await client.receive_json())["result"]["packs"]


async def test_a_fresh_install_has_the_core_pack(hass: HomeAssistant, hass_ws_client) -> None:
    """Nothing imported, no network (the test harness blocks sockets): the core pack is there from the disk."""
    client = await _client(hass, hass_ws_client)
    listed = await _listed(client)
    core = next(p for p in listed if p["id"] == "amluto.living")
    assert core["bundled"] is True
    assert core["licence"] == "MIT"
    assert core["publisher"] == "Amluto Solutions"
    assert len(core["items"]) >= 5
    # the files are not sent along: the frontend only needs the items
    assert "source" not in core


async def test_a_fresh_install_has_the_ikea_uk_pack_beside_the_core(hass: HomeAssistant, hass_ws_client) -> None:
    """The second bundled pack (#30) loads from the disk like the core: offline, MIT, every item with its IKEA name."""
    client = await _client(hass, hass_ws_client)
    listed = await _listed(client)
    ikea = next(p for p in listed if p["id"] == "amluto.ikea-uk")
    assert ikea["bundled"] is True
    assert ikea["licence"] == "MIT"
    assert len(ikea["items"]) >= 40
    assert [i["id"] for i in ikea["items"] if not i.get("ikea")] == []
    assert "amluto.living" in [p["id"] for p in listed]


def test_the_core_pack_is_retired_and_every_bundled_pack_is_under_the_item_limit() -> None:
    """The core pack was split into themed packs (#111): no folder is left and each pack stays within the limit."""
    assert not (BUNDLED / "amluto.core").exists()
    names = {p.name for p in BUNDLED.iterdir() if p.is_dir()}
    assert {
        "amluto.living",
        "amluto.bedroom",
        "amluto.kitchen-bath",
        "amluto.office",
        "amluto.it",
        "amluto.decor",
        "amluto.outdoor",
        "amluto.outdoor-plants",
        "amluto.outdoor-hardscape",
        "amluto.household",
        "amluto.devices",
        "amluto.makers",
        "amluto.ikea-uk",
        "amluto.unifi",
    } == names
    for folder in BUNDLED.iterdir():
        count = len([f for f in folder.rglob("*.json") if f.name != packs.PACK_FILE])
        assert 1 <= count <= packs.MAX_ITEMS, folder.name


def _bundled_folders() -> list[Path]:
    return sorted(p for p in BUNDLED.iterdir() if (p / packs.PACK_FILE).is_file())


def _item_files() -> list[Path]:
    return sorted(f for folder in _bundled_folders() for f in folder.rglob("*.json") if f.name != packs.PACK_FILE)


@pytest.mark.parametrize("folder", _bundled_folders(), ids=lambda p: p.name)
def test_every_bundled_pack_checks_like_an_imported_one(folder: Path) -> None:
    """The whole folder against the schema and the limits of an import (ids, file names, links, sizes)."""
    pack = packs.verify_folder(packs.read_folder(folder))
    assert pack["id"] == folder.name
    assert pack["licence"] == "MIT"


@pytest.mark.parametrize("path", _item_files(), ids=lambda p: p.relative_to(BUNDLED).as_posix())
def test_every_bundled_item_checks_and_sits_in_its_category_folder(path: Path) -> None:
    """One file per item, in the folder of its library category: <pack>/<group>/<item id>.json."""
    item = packs.ITEM_SCHEMA(json.loads(path.read_text(encoding="utf-8")))
    category = path.relative_to(BUNDLED).parts[1]
    assert len(path.relative_to(BUNDLED).parts) == 3, "items sit directly in a category folder"
    assert item["id"] == path.stem
    assert item.get("group") == category, f'"group" must be the folder name "{category}"'
    assert item["name"].get("en"), "every item has an English name"


def test_core_appliances_can_be_linked_to_a_switch_and_a_power_sensor() -> None:
    """Every appliance in the kitchen-bath pack draws power, so each one is marked electric."""
    files = sorted((KITCHEN_BATH / "appliance").glob("*.json"))
    appliances = [json.loads(f.read_text(encoding="utf-8")) for f in files]
    assert appliances, "the kitchen-bath pack has appliances"
    assert [a["id"] for a in appliances if not a.get("electric")] == []


def _core_files(release: int) -> dict[str, str]:
    files = packs.read_folder(CORE)
    meta = json.loads(files["pack.json"])
    files["pack.json"] = json.dumps({**meta, "release": release, "name": f"Core release {release}"})
    return files


async def test_the_bundled_pack_cannot_be_removed(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    await client.send_json_auto_id({"type": "home_3d/packs/remove", "pack_id": "amluto.living"})
    result = await client.receive_json()
    assert not result["success"] and result["error"]["code"] == "bundled"
    assert "amluto.living" in [p["id"] for p in await _listed(client)]


async def _add_copy(hass: HomeAssistant, files: dict[str, str]) -> None:
    """An imported copy of the core pack as the packs repository installs it (files can't carry our id, #372)."""
    payload, source = packs.checked_folder(files)
    await hass.data[DOMAIN].async_add_pack(
        payload, {**source, "origin": {"type": "github", "owner": "amluto-solutions"}}
    )


async def test_a_newer_imported_copy_replaces_the_bundled_one_until_removed(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """A newer release installed from the packs repository wins; removing it brings the bundled one back."""
    client = await _client(hass, hass_ws_client)
    await _add_copy(hass, _core_files(99))
    cores = [p for p in await _listed(client) if p["id"] == "amluto.living"]
    assert [(p["name"], p.get("bundled", False)) for p in cores] == [("Core release 99", False)]

    await client.send_json_auto_id({"type": "home_3d/packs/remove", "pack_id": "amluto.living"})
    assert (await client.receive_json())["success"]
    cores = [p for p in await _listed(client) if p["id"] == "amluto.living"]
    assert [p["bundled"] for p in cores] == [True]


async def test_an_older_imported_copy_does_not_hide_the_bundled_one(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    bundled_release = json.loads((CORE / "pack.json").read_text(encoding="utf-8"))["release"]
    data = hass.data[DOMAIN]
    data.bundled = [{**p, "release": bundled_release + 1} for p in data.bundled]
    await _add_copy(hass, _core_files(bundled_release))
    cores = [p for p in await _listed(client) if p["id"] == "amluto.living"]
    assert [p.get("bundled", False) for p in cores] == [True]


async def test_a_fresh_install_has_the_makers_and_devices_packs(hass: HomeAssistant, hass_ws_client) -> None:
    """The themed packs (#109) load from the disk like the core: offline, MIT, with items, under the item limit."""
    client = await _client(hass, hass_ws_client)
    listed = await _listed(client)
    for pack_id, name in (("amluto.makers", "Makers"), ("amluto.devices", "Smart-home devices")):
        found = next(p for p in listed if p["id"] == pack_id)
        assert found["bundled"] is True
        assert found["name"] == name
        assert found["licence"] == "MIT"
        assert 1 <= len(found["items"]) <= packs.MAX_ITEMS
    assert "amluto.living" in [p["id"] for p in listed]


def test_every_printer_in_the_makers_pack_gets_the_live_printer_state() -> None:
    """The progress ring, chamber light and camera (#11) are found by the item id and `electric`; a makers printer
    needs both and a glowing chamber light part."""
    printers = [
        json.loads(path.read_text(encoding="utf-8"))
        for path in sorted((BUNDLED / "amluto.makers").glob("*/*.json"))
        if "3d_printer" in path.stem
    ]
    assert printers, "the makers pack has a printer"
    for item in printers:
        assert item["electric"] is True, item["id"]
        if not item["id"].endswith("_mini"):  # the open-frame mini has no chamber to light
            assert any(part.get("glow") for part in item["parts"]), item["id"]


def test_the_risholmen_wing_chair_is_in_the_ikea_pack_at_ikeas_size() -> None:
    """Run 6: the rattan wing chair (68 x 67 x 80 cm on the IKEA UK page), found by its IKEA name."""
    folder = BUNDLED / "amluto.ikea-uk"
    item = json.loads((folder / "seating" / "risholmen_wing_chair.json").read_text(encoding="utf-8"))
    assert item["size"] == [0.68, 0.67, 0.8]
    assert item["ikea"] == "RISHOLMEN"
    assert "wing chair" in item["tags"]
    assert json.loads((folder / "pack.json").read_text(encoding="utf-8"))["release"] >= 4


def test_every_curved_car_has_wheel_arches_so_its_tyres_show() -> None:
    """Run 6: the curved bodies (#252) hid the tyres down to the sill and the cars looked sunk into the ground. The
    tyres stand on the ground, and over each axle the body's bottom rises above the middle of the wheel."""
    folder = BUNDLED / "amluto.outdoor"
    checked = 0
    for path in sorted((folder / "vehicle").glob("*.json")):
        item = json.loads(path.read_text(encoding="utf-8"))
        shells = [p for p in item["parts"] if p["shape"] == "shell" and p.get("color") not in ("glass", "dark")]
        tyres = [
            p
            for p in item["parts"]
            if p["shape"] == "cyl" and p.get("axis") == "x" and p["color"] == "dark" and p["y"] == 0
        ]
        if not shells or len(tyres) < 4:
            continue
        body = min(shells, key=lambda p: p["y"])  # the lower body
        tyre = tyres[0]
        assert min(t["y"] for t in tyres) == 0, item["id"]
        z0 = body["z"] - body["d"] / 2
        wheel_mid = tyre["h"] / 2  # fraction of the height
        for t in {round(t["z"], 4) for t in tyres}:
            zf = (t - z0) / body["d"]  # the axle in the body's own fractions
            over = [s for s in body["side"] if abs(s[0] - zf) < 1e-3]
            assert over, f"{item['id']}: a station over the axle"
            assert body["y"] + over[0][1] * body["h"] > wheel_mid, f"{item['id']}: the arch clears the wheel's middle"
        checked += 1
    assert checked > 190
    assert json.loads((folder / "pack.json").read_text(encoding="utf-8"))["release"] >= 5


RUN6_ITEMS = {
    "amluto.ikea-uk/table/skruvby_coffee_table_60x60": [0.6, 0.6, 0.5],
    "amluto.outdoor/outdoor/rattan_tub_chair_black_legs": [0.66, 0.64, 0.72],
    "amluto.outdoor/outdoor/rattan_bench_2_black_legs": [1.18, 0.64, 0.72],
    "amluto.outdoor/outdoor/rattan_glass_coffee_table_small": [0.6, 0.4, 0.4],
    "amluto.outdoor/sport/bike_helmet": [0.2, 0.27, 0.17],
    "amluto.outdoor/outdoor/pizza_peel_wall": [0.35, 0.03, 0.8],
    "amluto.household/pets/cat_tunnel_crinkle_90": [0.9, 0.27, 0.27],
    "amluto.household/household/boot_tray_75": [0.75, 0.38, 0.03],
    "amluto.kitchen-bath/bath/pedal_bin_5l": [0.21, 0.24, 0.28],
    "amluto.kitchen-bath/kitchen/pedal_bin_30l": [0.3, 0.36, 0.65],
    "amluto.kitchen-bath/bath/toilet_roll_holder_freestanding": [0.18, 0.18, 0.62],
    "amluto.kitchen-bath/bath/toilet_roll_holder_wall": [0.16, 0.12, 0.12],
    "amluto.kitchen-bath/bath/shower_curtain_rail_170": [1.7, 0.06, 1.45],
    "amluto.outdoor-plants/plant/silver_birch_young": [1.6, 1.6, 4.0],
    "amluto.outdoor-plants/plant/silver_birch_mature": [5.0, 5.0, 10.0],
    "amluto.living/lamp/uplighter_slim_floor": [0.25, 0.25, 1.8],
    "amluto.living/lamp/uplighter_slim_desk": [0.12, 0.12, 0.45],
    "amluto.decor/deco/cardboard_cutout_person": [0.5, 0.3, 1.75],
}


def test_the_run6_library_items_are_valid_and_their_packs_moved_on() -> None:
    """Run 6: new items modelled from our own shapes at typical product sizes, each pack's release bumped."""
    releases = {
        "amluto.ikea-uk": 5,
        "amluto.outdoor": 5,
        "amluto.household": 3,
        "amluto.kitchen-bath": 3,
        "amluto.outdoor-plants": 2,
        "amluto.living": 3,
        "amluto.decor": 3,
    }
    for path, size in RUN6_ITEMS.items():
        item = json.loads((BUNDLED / f"{path}.json").read_text(encoding="utf-8"))
        packs.ITEM_SCHEMA(item)
        assert item["size"] == size, path
        assert item["group"] == path.split("/")[1], path
    for pack_id, release in releases.items():
        assert json.loads((BUNDLED / pack_id / "pack.json").read_text(encoding="utf-8"))["release"] >= release, pack_id


def test_the_smastad_platsa_white_birch_units_are_in_the_ikea_pack_at_ikeas_size() -> None:
    """Run 6: the 6-drawer bookcase and the 2-door wardrobe, white with birch fronts, 60 x 57 x 181 cm."""
    folder = BUNDLED / "amluto.ikea-uk" / "kids"
    for name in ("smastad_platsa_bookcase_6dr_60x57x181", "smastad_platsa_wardrobe_60x57x181"):
        item = json.loads((folder / f"{name}.json").read_text(encoding="utf-8"))
        assert item["size"] == [0.6, 0.57, 1.81]
        assert item["ikea"] == "SMÅSTAD / PLATSA"
        assert {part["color"] for part in item["parts"]} >= {"white", "wood", "metal"}
