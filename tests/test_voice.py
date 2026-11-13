"""Assist asks the house: service, intent, sentences and the views' answers."""

from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path
from typing import Any
from unittest.mock import patch

from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import intent
import pytest

from custom_components.home_3d.const import DOMAIN
from custom_components.home_3d.voice import remove_sentences, sentences_of, sentences_yaml, write_sentences

from .test_init import _setup

_OMIT = object()


async def _view(hass_ws_client, hass: HomeAssistant, screen: Any = _OMIT, token: str | None = None):
    """An open Home 3D view: subscribed to the sentences (`screen`: its screen name; left out as an older
    frontend does)."""
    client = await hass_ws_client(hass, token) if token else await hass_ws_client(hass)
    msg: dict[str, Any] = {"id": 1, "type": "home_3d/voice/subscribe"}
    if screen is not _OMIT:
        msg["screen"] = screen
    await client.send_json(msg)
    assert (await client.receive_json())["success"]
    return client


async def _reply(client, ask: dict, text: str, answered: bool, msg_id: int = 2) -> dict:
    await client.send_json(
        {"id": msg_id, "type": "home_3d/voice/answer", "ask_id": ask["ask_id"], "text": text, "answered": answered}
    )
    return (await client.receive_json())["result"]


def _ask_service(hass: HomeAssistant, text: str, **extra: Any) -> asyncio.Task:
    return hass.async_create_task(
        hass.services.async_call(DOMAIN, "ask", {"text": text, **extra}, blocking=True, return_response=True)
    )


async def test_a_view_that_understands_wins_over_one_that_did_not_reply_first(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """Two homes on two screens: the one that cannot answer replies first, the one that can still wins (#366)."""
    await _setup(hass)
    first = await _view(hass_ws_client, hass, "")
    second = await _view(hass_ws_client, hass, "")
    with patch("custom_components.home_3d.voice.ANSWER_TIMEOUT", 30):
        task = _ask_service(hass, "Show the kitchen")
        ask = (await first.receive_json())["event"]
        await second.receive_json()
        assert await _reply(first, ask, "", False) == {"taken": True}
        assert not task.done()
        assert await _reply(second, ask, "Showing the kitchen.", True) == {"taken": True}
        result = await asyncio.wait_for(task, 5)
    assert result == {"answered": True, "answer": "Showing the kitchen.", "screen_open": True}


async def test_not_understood_once_every_view_said_so_or_the_time_is_up(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    first = await _view(hass_ws_client, hass, "")
    second = await _view(hass_ws_client, hass)
    # every view asked said it did not understand: answered at once, not after the timeout
    with patch("custom_components.home_3d.voice.ANSWER_TIMEOUT", 30):
        task = _ask_service(hass, "Blubb")
        ask = (await first.receive_json())["event"]
        assert (await second.receive_json())["event"]["ask_id"] == ask["ask_id"]
        await _reply(first, ask, "", False)
        await _reply(second, ask, "", False)
        assert (await asyncio.wait_for(task, 5))["answered"] is False
    # one said so, the other never answers: not understood when the time is up (not "no screen")
    with patch("custom_components.home_3d.voice.ANSWER_TIMEOUT", 0.2):
        task = _ask_service(hass, "Blubb")
        ask = (await first.receive_json())["event"]
        await second.receive_json()
        await _reply(first, ask, "", False, 3)
        assert await task == {"answered": False, "answer": "", "screen_open": True}


async def test_without_a_view_the_answer_comes_at_once(hass: HomeAssistant) -> None:
    """No Home 3D screen open: nobody to wait for (#366)."""
    await _setup(hass)
    with patch("custom_components.home_3d.voice.ANSWER_TIMEOUT", 30):
        result = await asyncio.wait_for(_ask_service(hass, "Show the kitchen"), 5)
        assert result == {"answered": False, "answer": "", "screen_open": False}
        response = await asyncio.wait_for(
            intent.async_handle(hass, "test", "Home3DAsk", {"text": {"value": "kitchen"}}, language="en"), 5
        )
    assert response.speech["plain"]["speech"] == "No Home 3D screen is open right now."


async def test_a_sentence_for_one_screen_reaches_only_that_screen(hass: HomeAssistant, hass_ws_client) -> None:
    """The service's `screen`: the views of that name get it (and a view of an older frontend, which picks for
    itself); a view of another name never sees it."""
    await _setup(hass)
    hall = await _view(hass_ws_client, hass, "Hall ")
    kitchen = await _view(hass_ws_client, hass, "Kitchen")
    older = await _view(hass_ws_client, hass)
    with patch("custom_components.home_3d.voice.ANSWER_TIMEOUT", 30):
        task = _ask_service(hass, "Show the kitchen", screen="hall")
        ask = (await hall.receive_json())["event"]
        assert ask["screen"] == "hall"
        assert (await older.receive_json())["event"]["ask_id"] == ask["ask_id"]
        await _reply(hall, ask, "Showing the kitchen.", True)
        assert (await asyncio.wait_for(task, 5))["answered"] is True
        # the older view is the only one asked for a screen nobody else has: its "not understood" ends it at once
        task = _ask_service(hass, "Show the kitchen", screen="Landing")
        ask = (await older.receive_json())["event"]
        await _reply(older, ask, "", False)
        assert (await asyncio.wait_for(task, 5))["answered"] is False
    # the kitchen view got neither sentence: its next message is the answer to its own ping
    await kitchen.send_json({"id": 9, "type": "ping"})
    assert (await kitchen.receive_json())["type"] == "pong"


async def test_a_satellite_asks_the_screen_next_to_it(hass: HomeAssistant, hass_ws_client) -> None:
    """Said to a satellite whose device or area has the name of an open screen: only that screen is asked (#366).
    No screen of that name open, or no device given: every view, as before."""
    entry = await _setup(hass)
    kitchen_area = ar.async_get(hass).async_create("Sample Kitchen")
    devices = dr.async_get(hass)
    satellite = devices.async_get_or_create(
        config_entry_id=entry.entry_id, identifiers={("test", "sat_kitchen")}, name="Sample satellite"
    )
    devices.async_update_device(satellite.id, area_id=kitchen_area.id)
    lonely = devices.async_get_or_create(
        config_entry_id=entry.entry_id, identifiers={("test", "sat_garage")}, name="Garage satellite"
    )
    kitchen = await _view(hass_ws_client, hass, "sample kitchen")
    hall = await _view(hass_ws_client, hass, "Hall")

    async def ask(device_id: str | None) -> tuple[dict, intent.IntentResponse]:
        task = hass.async_create_task(
            intent.async_handle(
                hass,
                "test",
                "Home3DAsk",
                {"text": {"value": "kitchen"}},
                text_input="show the kitchen",
                language="en",
                device_id=device_id,
            )
        )
        got = (await kitchen.receive_json())["event"]
        await _reply(kitchen, got, "Showing the kitchen.", True, next(ids))
        return got, await task

    ids = iter(range(10, 100))
    got, response = await ask(satellite.id)
    assert got["screen"] == "Sample Kitchen"
    assert response.speech["plain"]["speech"] == "Showing the kitchen."
    # the hall view was not asked
    await hall.send_json({"id": 5, "type": "ping"})
    assert (await hall.receive_json())["type"] == "pong"
    # a satellite by no open screen, and no satellite: every view
    for device_id in (lonely.id, None):
        got, _ = await ask(device_id)
        assert got["screen"] is None
        assert (await hall.receive_json())["event"]["ask_id"] == got["ask_id"]


async def test_where_people_are_reaches_only_the_views_of_admins(
    hass: HomeAssistant, hass_ws_client, hass_read_only_access_token
) -> None:
    """People shown to admins only: the rooms of people go over voice/subscribe to admins' views alone; the server
    filters, the screen is not trusted to hide them (#367). Rooms of things, and sentences, reach every view."""
    from custom_components.home_3d.locate.answers import Located
    from custom_components.home_3d.locate.service import DATA_LOCATE
    from custom_components.home_3d.voice import show_located

    await _setup(hass)
    service = hass.data[DATA_LOCATE]
    service.fly = True
    service.admins_only = True
    admin = await _view(hass_ws_client, hass, "")
    other = await _view(hass_ws_client, hass, "", hass_read_only_access_token)

    show_located(hass, Located("Sample person is in the Kitchen.", ["kitchen"], True))
    show_located(hass, Located("The keys are in the Hall.", ["hall"], False))
    first = (await admin.receive_json())["event"]
    assert first["show_rooms"] == ["kitchen"] and first["admins_only"] is True
    assert (await admin.receive_json())["event"]["show_rooms"] == ["hall"]
    # the other view's first message is the rooms of the keys: the people's rooms never came
    got = (await other.receive_json())["event"]
    assert got["show_rooms"] == ["hall"] and got["admins_only"] is False
    # a sentence goes to both: either may be the one that answers
    task = _ask_service(hass, "what is open")
    ask = (await other.receive_json())["event"]
    assert ask["text"] == "what is open"
    assert (await admin.receive_json())["event"]["ask_id"] == ask["ask_id"]
    await _reply(other, ask, "Nothing is open.", True)
    assert (await task)["answer"] == "Nothing is open."


async def test_switching_off_while_a_refresh_waits_writes_nothing_back(hass: HomeAssistant, tmp_path: Path) -> None:
    """A locate change lands while an admin switches the sentences off: the refresh waits for the switch, then
    finds the sentences off, so no file comes back (before the lock it read the old mode and wrote it back, #369)."""
    from homeassistant.helpers.dispatcher import async_dispatcher_send

    from custom_components.home_3d.const import DATA_VOICE
    from custom_components.home_3d.locate.service import SIGNAL_LOCATE_DEVICES

    await _setup(hass)
    settings = hass.data[DATA_VOICE]
    # the files land in a folder of this test's own
    hass.config.config_dir = str(tmp_path)
    en = tmp_path / "custom_sentences" / "en" / "home_3d.yaml"
    try:
        await settings.async_set_sentences("distinct")
        assert en.is_file()
        with patch("custom_components.home_3d.voice.located_names", return_value=["Sample Phone"]):
            async with settings._lock:
                off = hass.async_create_task(settings.async_set_sentences("off"))
                await asyncio.sleep(0)
                async_dispatcher_send(hass, SIGNAL_LOCATE_DEVICES)
                await asyncio.sleep(0)
                assert len(settings._tasks) == 1
            await off
            await hass.async_block_till_done()
        assert settings.sentences == "off"
        assert not en.exists()
        assert not settings._tasks
    finally:
        await settings.async_set_sentences("off")


async def test_unload_cancels_a_waiting_refresh(hass: HomeAssistant) -> None:
    from custom_components.home_3d.const import DATA_VOICE

    entry = await _setup(hass)
    settings = hass.data[DATA_VOICE]
    async with settings._lock:
        settings.schedule_refresh()
        (task,) = settings._tasks
        assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert task.cancelled()
    assert settings.unsub is None and not settings._tasks


async def test_the_views_still_listen_after_a_reload(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await _setup(hass)
    view = await _view(hass_ws_client, hass, "")
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    task = _ask_service(hass, "Show the kitchen")
    ask = (await view.receive_json())["event"]
    await _reply(view, ask, "Showing the kitchen.", True)
    assert (await task)["answered"] is True


async def test_service_hands_the_sentence_to_the_views_and_returns_the_first_answer(
    hass: HomeAssistant, hass_ws_client
) -> None:
    await _setup(hass)
    view = await _view(hass_ws_client, hass)
    other = await _view(hass_ws_client, hass)

    task = hass.async_create_task(
        hass.services.async_call(
            DOMAIN, "ask", {"text": "Show the living room", "speak": True}, blocking=True, return_response=True
        )
    )
    ask = (await view.receive_json())["event"]
    assert ask["text"] == "Show the living room"
    assert ask["speak"] is True
    assert ask["screen"] is None
    assert (await other.receive_json())["event"]["ask_id"] == ask["ask_id"]

    await view.send_json(
        {"id": 2, "type": "home_3d/voice/answer", "ask_id": ask["ask_id"], "text": "Showing the living room."}
    )
    assert (await view.receive_json())["result"] == {"taken": True}
    # the second view is late
    await other.send_json({"id": 2, "type": "home_3d/voice/answer", "ask_id": ask["ask_id"], "text": "Living room"})
    assert (await other.receive_json())["result"] == {"taken": False}

    assert await task == {"answered": True, "answer": "Showing the living room.", "screen_open": True}


async def test_service_without_an_open_view_says_so(hass: HomeAssistant) -> None:
    await _setup(hass)
    with patch("custom_components.home_3d.voice.ANSWER_TIMEOUT", 0.05):
        result = await hass.services.async_call(
            DOMAIN, "ask", {"text": "Show the kitchen", "screen": "Hall"}, blocking=True, return_response=True
        )
    assert result == {"answered": False, "answer": "", "screen_open": False}


async def test_intent_speaks_the_answer_or_that_nothing_was_understood(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    view = await _view(hass_ws_client, hass)

    ids = iter(range(10, 100))

    async def answer(text: str, answered: bool) -> intent.IntentResponse:
        task = hass.async_create_task(
            intent.async_handle(hass, "test", "Home3DAsk", {"text": {"value": text}}, text_input=text, language="en")
        )
        ask = (await view.receive_json())["event"]
        assert ask["text"] == text
        await view.send_json(
            {
                "id": next(ids),
                "type": "home_3d/voice/answer",
                "ask_id": ask["ask_id"],
                "text": "Three windows are open.",
                "answered": answered,
            }
        )
        await view.receive_json()
        return await task

    assert (await answer("What is open", True)).speech["plain"]["speech"] == "Three windows are open."
    assert (await answer("Blah", False)).speech["plain"]["speech"] == "Home 3D did not understand that."


async def test_intent_without_a_view(hass: HomeAssistant) -> None:
    await _setup(hass)
    with patch("custom_components.home_3d.voice.ANSWER_TIMEOUT", 0.05):
        response = await intent.async_handle(
            hass, "test", "Home3DAsk", {"text": {"value": "living room"}}, language="en"
        )
    assert response.speech["plain"]["speech"] == "No Home 3D screen is open right now."


def test_sentences_are_written_only_on_request_and_never_over_a_changed_file(tmp_path: Path) -> None:
    en = tmp_path / "custom_sentences" / "en" / "home_3d.yaml"
    hashes, kept, changed = write_sentences(tmp_path, "distinct", {})
    assert changed and kept == []
    text = en.read_text(encoding="utf-8")
    assert text == sentences_yaml("en", "distinct")
    assert "show [me] {text}" in text
    # only the distinct sentences: a question Home Assistant answers itself is not taken (#641)
    assert "which (windows|doors) are [still] open" not in text
    # English is the only language with sentences: no file for any other
    assert sorted(p.name for p in (tmp_path / "custom_sentences").iterdir()) == ["en"]
    # unchanged: nothing written
    hashes, kept, changed = write_sentences(tmp_path, "distinct", hashes)
    assert not changed
    # "all" adds the questions
    hashes, kept, changed = write_sentences(tmp_path, "all", hashes)
    assert changed and "which (windows|doors) are [still] open" in en.read_text(encoding="utf-8")
    # a file the user changed is never overwritten, nor removed
    en.write_text("my own sentences", encoding="utf-8")
    hashes, kept, changed = write_sentences(tmp_path, "distinct", hashes)
    assert kept == ["en"]
    assert en.read_text(encoding="utf-8") == "my own sentences"
    hashes, kept, _ = write_sentences(tmp_path, "off", hashes)
    assert kept == ["en"] and en.exists()
    remove_sentences(tmp_path, hashes)
    assert en.read_text(encoding="utf-8") == "my own sentences"
    # removing the integration takes Home 3D's own files
    en.unlink()
    hashes, _, _ = write_sentences(tmp_path, "distinct", hashes)
    assert en.exists()
    remove_sentences(tmp_path, hashes)
    assert not en.exists()


def test_a_language_without_sentences_has_no_file_and_an_old_one_goes(tmp_path: Path) -> None:
    """Older versions also wrote a file for a language Home 3D has no sentences for now: the file Home 3D wrote
    (known by its stored hash) goes in any mode and with the integration; one the user changed stays."""
    assert sentences_of("xx", "all") == []
    assert '          - "' not in sentences_yaml("xx", "all", ["Sample Phone"])
    old = tmp_path / "custom_sentences" / "xx" / "home_3d.yaml"
    old.parent.mkdir(parents=True)
    ours = "# Written by Home 3D\nold sentences\n"
    old.write_text(ours, encoding="utf-8")
    written = {"xx": hashlib.sha256(ours.encode("utf-8")).hexdigest()}
    hashes, kept, changed = write_sentences(tmp_path, "distinct", written)
    assert changed and kept == [] and not old.exists() and "xx" not in hashes
    # with the sentences switched off
    old.write_text(ours, encoding="utf-8")
    hashes, kept, changed = write_sentences(tmp_path, "off", written)
    assert changed and kept == [] and not old.exists() and hashes == {}
    # with the integration
    old.write_text(ours, encoding="utf-8")
    remove_sentences(tmp_path, written)
    assert not old.exists()
    # changed by the user: left alone
    old.write_text("my own sentences", encoding="utf-8")
    hashes, kept, _ = write_sentences(tmp_path, "distinct", written)
    assert kept == ["xx"] and old.exists()
    remove_sentences(tmp_path, written)
    assert old.read_text(encoding="utf-8") == "my own sentences"
    # a stored key that is no language code never names a path
    outside = tmp_path / "home_3d.yaml"
    outside.write_text(ours, encoding="utf-8")
    write_sentences(tmp_path, "off", {"..": written["xx"]})
    remove_sentences(tmp_path, {"..": written["xx"]})
    assert outside.exists()


def test_a_file_an_older_version_wrote_is_still_ours(tmp_path: Path) -> None:
    """Files from 1.22.0 - 1.24.0 (older header lines) are replaced, not kept as the user's own."""
    en = tmp_path / "custom_sentences" / "en" / "home_3d.yaml"
    en.parent.mkdir(parents=True)
    en.write_text(
        sentences_yaml("en", "distinct").replace(
            "# understands answers). Put your own sentences for Home3DAsk into another file.\n",
            "# understands answers). Rewritten on every start: "
            "put your own sentences for Home3DAsk into another file.\n",
        ),
        encoding="utf-8",
    )
    _, kept, changed = write_sentences(tmp_path, "distinct", {})
    assert kept == [] and changed
    assert en.read_text(encoding="utf-8") == sentences_yaml("en", "distinct")


async def test_setup_writes_no_sentence_file(hass: HomeAssistant) -> None:
    """Nothing lands in the configuration folder unless an admin picks the sentences (HACS review)."""
    await _setup(hass)
    assert not (Path(hass.config.config_dir) / "custom_sentences").exists()


async def test_unload_removes_service_and_intent(hass: HomeAssistant) -> None:
    entry = await _setup(hass)
    assert hass.services.has_service(DOMAIN, "ask")
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert not hass.services.has_service(DOMAIN, "ask")


# a file an early version wrote with its own, shorter set of sentences
_EARLY_FILE = """# Written by Home 3D: the sentences Assist hands to the open Home 3D views (the first one that
# understands answers). Rewritten on every start: put your own sentences for Home3DAsk into another file.
language: "en"
intents:
  Home3DAsk:
    data:
      - sentences:
          - "show [me] {text}"
          - "where (is|are) [the] {text}"
          - "good night"
lists:
  text:
    wildcard: true
"""


def test_a_file_with_only_some_of_our_sentences_is_the_users(tmp_path: Path) -> None:
    """Home 3D's header over a subset of its sentences is no file Home 3D wrote (no Home 3D release wrote
    home_3d.yaml with fewer sentences): it stays, also with a sentence of the user's own in it (#369)."""
    en = tmp_path / "custom_sentences" / "en" / "home_3d.yaml"
    en.parent.mkdir(parents=True)
    en.write_text(_EARLY_FILE, encoding="utf-8")
    _, kept, _ = write_sentences(tmp_path, "distinct", {})
    assert kept == ["en"]
    assert en.read_text(encoding="utf-8") == _EARLY_FILE
    en.write_text(
        _EARLY_FILE.replace('          - "good night"\n', '          - "turn off the light"\n'), encoding="utf-8"
    )
    _, kept, _ = write_sentences(tmp_path, "distinct", {})
    assert kept == ["en"]


def test_the_names_locating_knows_are_a_list_not_a_wildcard(tmp_path: Path) -> None:
    """ "Where is Sam?" matches a list of names exactly, so Assist handles it locally and an AI agent behind it
    never gets the question."""
    en = tmp_path / "custom_sentences" / "en" / "home_3d.yaml"
    hashes, _, _ = write_sentences(tmp_path, "distinct", {}, ["Alex Apple Watch", "Alex", 'Sam "K"'])
    text = en.read_text(encoding="utf-8")
    assert "where (is|are) [the|my] {home3d_who}" in text
    assert '      - "Alex Apple Watch"' in text and '      - "Sam \\"K\\""' in text
    # the names change: the file follows; no names: the list goes
    hashes, _, changed = write_sentences(tmp_path, "distinct", hashes, ["Alex"])
    assert changed and "Apple Watch" not in en.read_text(encoding="utf-8")
    write_sentences(tmp_path, "distinct", hashes, [])
    assert "home3d_who" not in en.read_text(encoding="utf-8")


def test_a_file_the_user_trimmed_is_left_alone(tmp_path: Path) -> None:
    """The user took "show [me] {text}" out of Home 3D's file (it competes with Home Assistant's own): the file
    is theirs now, never rewritten, never removed with the sentences switched off or the integration (#369)."""
    en = tmp_path / "custom_sentences" / "en" / "home_3d.yaml"
    hashes, _, _ = write_sentences(tmp_path, "distinct", {}, ["Sample Phone"])
    trimmed = en.read_text(encoding="utf-8").replace('          - "show [me] {text}"\n', "")
    assert trimmed != en.read_text(encoding="utf-8")
    en.write_text(trimmed, encoding="utf-8")
    for mode in ("distinct", "all", "off"):
        _, kept, _ = write_sentences(tmp_path, mode, hashes, ["Sample Phone"])
        assert kept == ["en"], mode
        assert en.read_text(encoding="utf-8") == trimmed
    remove_sentences(tmp_path, hashes)
    assert en.read_text(encoding="utf-8") == trimmed


def test_a_file_we_wrote_is_ours_without_its_hash(tmp_path: Path) -> None:
    """Exactly what Home 3D writes (with the names locating knows now, or none) is ours even when the stored hash
    is gone; the same file with other names is known by its hash only."""
    en = tmp_path / "custom_sentences" / "en" / "home_3d.yaml"
    write_sentences(tmp_path, "distinct", {}, ["Sample Phone"])
    hashes, kept, changed = write_sentences(tmp_path, "all", {}, ["Sample Phone"])
    assert kept == [] and changed
    hashes, _, _ = write_sentences(tmp_path, "distinct", hashes, [])
    assert "Sample Phone" not in en.read_text(encoding="utf-8")
    # written with names that are gone now, and the hash lost: nothing tells it from a file the user wrote
    write_sentences(tmp_path, "distinct", hashes, ["Sample Watch"])
    _, kept, _ = write_sentences(tmp_path, "distinct", {}, ["Sample Phone"])
    assert kept == ["en"]


def test_the_names_locating_knows_are_sentences(tmp_path: Path) -> None:
    """ "Where is Sam?" as a list of names (no wildcard): Assist matches it locally even with an AI agent."""
    en = tmp_path / "custom_sentences" / "en" / "home_3d.yaml"
    hashes, _, _ = write_sentences(tmp_path, "distinct", {}, ["Sam", "Alexs iPhone"])
    text = en.read_text(encoding="utf-8")
    assert "{home3d_who}" in text and '      - "Alexs iPhone"' in text
    # names changed: the file is ours, so it is rewritten
    _, kept, changed = write_sentences(tmp_path, "distinct", hashes, ["Sam"])
    assert kept == [] and changed and "Alexs iPhone" not in en.read_text(encoding="utf-8")


async def _style_view(hass_ws_client, hass: HomeAssistant, screen: Any = "", style: bool = True):
    """An open view that asks for styles (`style`), as a frontend with the flag does."""
    client = await hass_ws_client(hass)
    msg: dict[str, Any] = {"id": 1, "type": "home_3d/voice/subscribe", "screen": screen}
    if style:
        msg["style"] = True
    await client.send_json(msg)
    assert (await client.receive_json())["success"]
    return client


async def test_set_style_schema(hass: HomeAssistant) -> None:
    """The action takes a style, optional screens (a single name too) and minutes; nothing else (#442)."""
    import voluptuous as vol

    from custom_components.home_3d.voice import STYLE_SCHEMA, style_message

    data = STYLE_SCHEMA({"style": "cozy", "minutes": "30", "screens": "Hall"})
    assert data == {"style": "cozy", "screens": ["Hall"], "minutes": 30}
    assert STYLE_SCHEMA({"style": "reset"}) == {"style": "reset", "screens": []}
    assert STYLE_SCHEMA({"style": "", "minutes": None})["minutes"] is None
    for bad in (
        {},
        {"style": "cozy", "minutes": 0},
        {"style": "cozy", "minutes": 10081},
        {"style": "x" * 61},
        {"style": "cozy", "x": 1},
    ):
        with pytest.raises(vol.Invalid):
            STYLE_SCHEMA(bad)
    message = style_message(STYLE_SCHEMA({"style": " cozy ", "screens": ["Hall", " "]}))
    assert (message["style"], message["screens"], message["minutes"]) == ("cozy", ["Hall"], None)


async def test_set_style_reaches_only_the_screens_named_and_only_views_that_asked(
    hass: HomeAssistant, hass_ws_client
) -> None:
    await _setup(hass)
    hall = await _style_view(hass_ws_client, hass, "Hall")
    kitchen = await _style_view(hass_ws_client, hass, "Kitchen")
    unnamed = await _style_view(hass_ws_client, hass, "")
    older = await _style_view(hass_ws_client, hass, "Hall", style=False)
    await hass.services.async_call(
        DOMAIN, "set_style", {"style": "cozy", "screens": ["hall"], "minutes": 30}, blocking=True
    )
    event = (await hall.receive_json())["event"]
    assert event["style"]["style"] == "cozy"
    assert event["style"]["screens"] == ["hall"]
    assert event["style"]["minutes"] == 30
    # every view: the screens left out
    await hass.services.async_call(DOMAIN, "set_style", {"style": "reset"}, blocking=True)
    for view in (kitchen, unnamed):
        # the first thing these views get is the style for every screen, not the one for the hall
        assert (await view.receive_json())["event"]["style"]["style"] == "reset"
    assert (await hall.receive_json())["event"]["style"]["style"] == "reset"
    # a view without the flag never gets a style event (an older frontend would read it as a sentence)
    with pytest.raises(TimeoutError):
        await asyncio.wait_for(older.receive_json(), 0.2)


async def test_style_flag_is_off_by_default_and_a_sentence_still_arrives(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    plain = await _view(hass_ws_client, hass, "")
    await hass.services.async_call(DOMAIN, "set_style", {"style": "cozy"}, blocking=True)
    task = _ask_service(hass, "Show the kitchen")
    ask = (await plain.receive_json())["event"]
    assert ask["text"] == "Show the kitchen"
    assert "style" not in ask
    await _reply(plain, ask, "Showing the kitchen.", True)
    await asyncio.wait_for(task, 5)
