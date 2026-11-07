"""An open panel learns of an update (#60): the backend says which frontend build it serves now."""

from __future__ import annotations

import json
from pathlib import Path

from homeassistant.core import HomeAssistant
import pytest

from custom_components.home_3d import frontend_build
from tests.test_init import _setup


@pytest.fixture
def build_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    file = tmp_path / "build.json"
    monkeypatch.setattr(frontend_build, "BUILD_FILE", file)
    return file


async def test_version_names_the_build_on_disk_now(hass: HomeAssistant, hass_ws_client, build_file: Path) -> None:
    build_file.write_text(json.dumps({"build": "aaa111"}))
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/version"})
    result = (await client.receive_json())["result"]
    assert result["build"] == "aaa111"
    assert result["version"]
    # new files copied in without a restart: the next ask sees them
    build_file.write_text(json.dumps({"build": "bbb222"}))
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    assert (await client.receive_json())["result"]["build"] == "bbb222"


async def test_no_build_file_reports_no_build(hass: HomeAssistant, hass_ws_client, build_file: Path) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/version"})
    result = (await client.receive_json())["result"]
    assert "build" not in result
    build_file.write_text("not json")
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    assert "build" not in (await client.receive_json())["result"]
