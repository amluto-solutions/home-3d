"""The pictures of a home (#364): a cap on how many and how much; set/delete in line with the home's other changes."""

from __future__ import annotations

import asyncio

from homeassistant.core import HomeAssistant
import pytest

from custom_components.home_3d import storage
from custom_components.home_3d.const import DOMAIN
from custom_components.home_3d.storage import HomesError
from tests.test_init import IMAGE, _setup


async def _call(client, msg: dict) -> dict:
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def test_a_home_refuses_pictures_beyond_the_count(hass: HomeAssistant, hass_ws_client, monkeypatch) -> None:
    monkeypatch.setattr(storage, "MAX_IMAGES", 2)
    await _setup(hass)
    client = await hass_ws_client(hass)
    for name in ("a", "b"):
        assert (await _call(client, {"type": "home_3d/image/set", "image_id": name, "data": IMAGE}))["success"]
    full = await _call(client, {"type": "home_3d/image/set", "image_id": "c", "data": IMAGE})
    assert not full["success"] and full["error"]["code"] == "images_full"
    # replacing one is not a new picture
    assert (await _call(client, {"type": "home_3d/image/set", "image_id": "a", "data": IMAGE}))["success"]
    assert sorted(hass.data[DOMAIN].active.images) == ["a", "b"]
    # removing one makes room
    assert (await _call(client, {"type": "home_3d/image/delete", "image_id": "a"}))["success"]
    assert (await _call(client, {"type": "home_3d/image/set", "image_id": "c", "data": IMAGE}))["success"]
    assert sorted(hass.data[DOMAIN].active.images) == ["b", "c"]


async def test_a_home_refuses_pictures_beyond_the_total_size(hass: HomeAssistant, monkeypatch) -> None:
    monkeypatch.setattr(storage, "MAX_IMAGES_CHARS", 2 * len(IMAGE))
    await _setup(hass)
    home = hass.data[DOMAIN].active
    await home.async_set_image("a", IMAGE)
    await home.async_set_image("b", IMAGE)
    with pytest.raises(HomesError) as err:
        await home.async_set_image("c", IMAGE)
    assert err.value.code == "images_full"
    # a bigger replacement is refused, a smaller or equal one is not
    with pytest.raises(HomesError):
        await home.async_set_image("a", IMAGE + "AAAA")
    await home.async_set_image("a", IMAGE)
    assert sorted(home.images) == ["a", "b"]


async def test_a_home_over_the_limits_from_before_keeps_its_pictures(hass: HomeAssistant, monkeypatch) -> None:
    await _setup(hass)
    home = hass.data[DOMAIN].active
    for name in ("a", "b", "c"):
        await home.async_set_image(name, IMAGE)
    monkeypatch.setattr(storage, "MAX_IMAGES", 2)
    monkeypatch.setattr(storage, "MAX_IMAGES_CHARS", len(IMAGE))
    with pytest.raises(HomesError):
        await home.async_set_image("d", IMAGE)
    await home.async_set_image("a", IMAGE)  # replacing with one no bigger still works
    await home.async_delete_image("c")
    assert sorted(home.images) == ["a", "b"]


async def test_a_duplicate_or_start_is_not_refused(hass: HomeAssistant, monkeypatch) -> None:
    await _setup(hass)
    data = hass.data[DOMAIN]
    monkeypatch.setattr(storage, "MAX_IMAGES", 1)
    home = await data.async_create_home("Flat", images={"a": IMAGE, "b": IMAGE})
    assert sorted(home.images) == ["a", "b"]


async def test_set_and_delete_wait_for_the_lock(hass: HomeAssistant) -> None:
    await _setup(hass)
    home = hass.data[DOMAIN].active
    async with home._lock:
        task = hass.async_create_task(home.async_set_image("a", IMAGE))
        await asyncio.sleep(0.05)
        assert not task.done() and "a" not in home.images
    await task
    async with home._lock:
        gone = hass.async_create_task(home.async_delete_image("a"))
        await asyncio.sleep(0.05)
        assert not gone.done() and "a" in home.images
    await gone
    assert "a" not in home.images


async def test_a_deleted_home_takes_no_pictures(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    home = hass.data[DOMAIN].active
    await home.async_delete()
    with pytest.raises(HomesError) as err:
        await home.async_set_image("a", IMAGE)
    assert err.value.code == "home_not_found"
    with pytest.raises(HomesError):
        await home.async_delete_image("a")
