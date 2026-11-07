"""Assist asks the house: the service `home_3d.ask` and the intent `Home3DAsk`.

A sentence said to Assist (a voice satellite, the Assist dialog, an automation) is handed to the open Home 3D
views: the first one that understands it answers, shows the place and, when asked to, speaks. The sentences
Assist recognises come from `custom_sentences/<lang>/home_3d.yaml`, which is written only when an admin picks
the sentences in the voice settings (never on setup, never over a file the user changed, removed with the
integration); the user may add their own sentences to the same intent in another file.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
import hashlib
import json
import logging
from pathlib import Path
from typing import Any, ClassVar
import uuid

from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers import intent
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.storage import Store
import voluptuous as vol

from .const import DATA_ASK, DATA_VOICE, DOMAIN, STORAGE_KEY_VOICE
from .locate.answers import Located, async_locate
from .locate.service import DATA_LOCATE, SIGNAL_LOCATE_DEVICES

_LOGGER = logging.getLogger(__name__)

SERVICE_ASK = "ask"
INTENT_ASK = "Home3DAsk"
# a view answers within a moment; a voice satellite waits for Assist, so the wait stays short
ANSWER_TIMEOUT = 6.0
SENTENCES_FILE = "home_3d.yaml"
# hass.data key of the open views listening for sentences (voice/subscribe)
DATA_VIEWS = f"{DOMAIN}_voice_views"

ASK_SCHEMA = vol.Schema(
    {
        vol.Required("text"): vol.All(cv.string, vol.Length(min=1, max=300)),
        vol.Optional("screen"): vol.All(cv.string, vol.Length(max=60)),
        vol.Optional("speak", default=False): cv.boolean,
    }
)

# what Assist says when no view answers, by the language of Home Assistant
_NO_SCREEN = {
    "en": "No Home 3D screen is open right now.",
}
_NOT_UNDERSTOOD = {
    "en": "Home 3D did not understand that.",
}

# which sentences Assist hands to Home 3D: only the distinct ones (default), every question, or none at all
SENTENCE_MODES = ("distinct", "all", "off")
DEFAULT_SENTENCE_MODE = "off"

# the distinct sentences: nobody says them to Home Assistant itself, so they never take a sentence meant for it
_DISTINCT = {
    "en": [
        "show [me] {text}",
        "go to [the] {text}",
        "ask the house {text}",
        "(house|home 3d|home three d) {text}",
        "good night",
        "good morning",
        "what can you do",
        "where is my {text}",
        "who is home",
        "ring my {text}",
        "find my {text}",
    ],
}

# the questions: handy, but some of them Home Assistant answers itself ("which windows are open", #641), so
# they go to Home 3D only with the setting "all"
_QUESTIONS = {
    "en": [
        "where (is|are) [the] {text}",
        "what is open",
        "is anything open",
        "which (windows|doors) are [still] open",
        "is a window open in the {text}",
        "where is it (cold|warm|too cold|too warm)",
        "what is (drawing|using) power",
        "what is the solar doing",
        "how full is the battery",
        "are the (blinds|shutters) (down|up|closed|open)",
        "is the {text} (locked|unlocked|closed|open|on|off)",
        "is the {text} running",
        "what is running",
        "what is on today",
        "what is the weather [like] [today|tomorrow]",
    ],
}


# "Where is Sam?": the names locating knows, as a list (not a wildcard), so Assist matches them even when it
# prefers its local commands and leaves everything else to an AI agent (which would only say "is at home")
WHO_LIST = "home3d_who"
_WHO_SENTENCES = {
    "en": [f"where (is|are) [the|my] {{{WHO_LIST}}}"],
}


def located_names(hass: HomeAssistant) -> list[str]:
    """The people and things locating knows, the way they are said: device names ("Sam iPhone", also
    "Sams iPhone"), the person's name and first name."""
    service = hass.data.get(DATA_LOCATE)
    if service is None or not service.enabled:
        return []
    names: list[str] = []

    def add(name: str) -> None:
        name = " ".join(name.replace('"', "").split())
        if len(name) >= 3 and name.lower() not in (n.lower() for n in names):
            names.append(name)

    for device in service.devices:
        add(str(device.get("name") or ""))
        person = device.get("person")
        state = hass.states.get(person) if person else None
        if state is None:
            continue
        full = str(state.attributes.get("friendly_name") or "")
        add(full)
        add(full.split()[0] if full.split() else "")
        words = str(device.get("name") or "").split()
        if len(words) > 1:
            # the owner's name in front ("Alex iPhone"): the first name alone and "Alexs iPhone"
            add(words[0])
            add(f"{words[0]}s {' '.join(words[1:])}")
    return names[:200]


def sentences_of(language: str, mode: str = DEFAULT_SENTENCE_MODE) -> list[str]:
    """The sentences of a language in a mode (none for "off", and none for a language Home 3D has none for)."""
    if mode == "off":
        return []
    return _DISTINCT.get(language, []) + (_QUESTIONS.get(language, []) if mode == "all" else [])


def sentences_yaml(language: str, mode: str = DEFAULT_SENTENCE_MODE, names: list[str] | tuple[str, ...] = ()) -> str:
    """The custom sentences file of a language (written by hand: the file stays readable for the user); `names`
    are the people and things locating knows ("Where is Sam?")."""
    lines = [
        "# Written by Home 3D: the sentences Assist hands to the open Home 3D views (the first one that",
        "# understands answers). Put your own sentences for Home3DAsk into another file.",
        "# Which sentences stand here is set in the editor: ⚙ Settings → Voice control → Sentences for Assist.",
        "# Changed by hand, the file is never overwritten; removing the integration removes it.",
        f'language: "{language}"',
        "intents:",
        f"  {INTENT_ASK}:",
        "    data:",
        "      - sentences:",
    ]
    sentences = sentences_of(language, mode)
    if names and sentences:
        sentences = sentences + _WHO_SENTENCES.get(language, [])
    lines += [f'          - "{s}"' for s in sentences]
    lines += ["lists:", "  text:", "    wildcard: true"]
    if names and sentences:
        lines += [f"  {WHO_LIST}:", "    values:"] + [f"      - {json.dumps(n, ensure_ascii=False)}" for n in names]
    lines.append("")
    return "\n".join(lines)


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _path(config_dir: Path, language: str) -> Path:
    return config_dir / "custom_sentences" / language / SENTENCES_FILE


def _ours(text: str, language: str, names: list[str] | tuple[str, ...] = ()) -> bool:
    """Exactly a file Home 3D writes for the language (in any mode, with the names locating knows now or none) or
    an older version wrote: the user has not changed it. Anything else is the user's, also a file of Home 3D's with
    a sentence taken out (#369); a file Home 3D wrote with other names is known by its hash."""
    return any(
        text == sentences_yaml(language, mode, known) for mode in ("distinct", "all") for known in ((), names)
    ) or (text.startswith("# Written by Home 3D") and text in _old_files())


# the file as 1.22.0 - 1.23 wrote it (the header without the line about changed files): still ours
_CHANGED_LINE = "# Changed by hand, the file is never overwritten; removing the integration removes it.\n"
_SETTINGS_LINE = (
    "# Which sentences stand here is set in the editor: ⚙ Settings → Voice control → Sentences for Assist.\n"
)


# the second header line as 1.22.0 - 1.24.0 wrote it
_OLD_SECOND_LINE = (
    "# understands answers). Rewritten on every start: put your own sentences for Home3DAsk into another file.\n"
)
_NEW_SECOND_LINE = "# understands answers). Put your own sentences for Home3DAsk into another file.\n"


def _old_files() -> tuple[str, ...]:
    out = []
    for language in _DISTINCT:
        for mode in ("distinct", "all"):
            old = sentences_yaml(language, mode).replace(_NEW_SECOND_LINE, _OLD_SECOND_LINE)
            # 1.24.0
            out.append(old)
            # 1.22.1 - 1.23 (without the line about changed files), 1.22.0 (without the settings line too)
            text = old.replace(_CHANGED_LINE, "")
            out.append(text)
            out.append(text.replace(_SETTINGS_LINE, ""))
    return tuple(out)


def _retired(written: dict[str, str]) -> list[str]:
    """Languages an older version wrote a sentence file for that have no sentences now: known only by the hash
    of what was written. Only plain language codes, so a stored key never points outside custom_sentences."""
    return [lang for lang in written if lang not in _DISTINCT and lang.isascii() and lang.isalpha()]


def write_sentences(
    config_dir: Path, mode: str, written: dict[str, str], names: list[str] | tuple[str, ...] = ()
) -> tuple[dict[str, str], list[str], bool]:
    """Writes the sentence files for a mode (removes them for "off") - never over a file the user changed.

    `written`: the hash of what Home 3D last wrote per language. Returns the new hashes, the languages whose
    file was left alone because the user changed it, and whether any file changed (Assist then reloads).
    """
    hashes = dict(written)
    kept: list[str] = []
    changed = False
    for language in _retired(written):
        # a language Home 3D no longer has sentences for: the file an older version wrote goes, in every mode
        path = _path(config_dir, language)
        try:
            old: str | None = path.read_text(encoding="utf-8")
        except OSError:
            old = None
        if old is not None and _sha(old) != written.get(language):
            kept.append(language)
            continue
        if old is not None:
            path.unlink()
            changed = True
        hashes.pop(language, None)
    for language in _DISTINCT:
        path = _path(config_dir, language)
        try:
            current: str | None = path.read_text(encoding="utf-8")
        except OSError:
            current = None
        if current is not None and _sha(current) != written.get(language) and not _ours(current, language, names):
            # the user wrote or changed this file: it stays as it is
            kept.append(language)
            continue
        if mode == "off":
            if current is not None:
                path.unlink()
                changed = True
            hashes.pop(language, None)
            continue
        text = sentences_yaml(language, mode, names)
        if current != text:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
            changed = True
        hashes[language] = _sha(text)
    return hashes, kept, changed


def remove_sentences(config_dir: Path, written: dict[str, str]) -> None:
    """Removes the files Home 3D wrote (and the user did not change) when the integration is removed."""
    for language in (*_DISTINCT, *_retired(written)):
        path = _path(config_dir, language)
        try:
            current = path.read_text(encoding="utf-8")
        except OSError:
            continue
        if _sha(current) == written.get(language) or (language in _DISTINCT and _ours(current, language)):
            path.unlink()


class VoiceSettings:
    """The voice settings of the installation (.storage/home_3d.voice): which sentences Assist hands on, and the
    hash of each sentence file Home 3D wrote (so a file the user changed is never overwritten). Nothing is written
    on setup: only when an admin picks the sentences in the voice settings."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, 1, STORAGE_KEY_VOICE)
        self.sentences = DEFAULT_SENTENCE_MODE
        self.written: dict[str, str] = {}
        self.unsub: Callable[[], None] | None = None
        # one write of the sentence files at a time: a refresh never writes back what an admin just switched off
        self._lock = asyncio.Lock()
        self._tasks: set[asyncio.Task[None]] = set()

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        mode = data.get("sentences")
        if mode in SENTENCE_MODES:
            self.sentences = mode
        written = data.get("written")
        if isinstance(written, dict) and written:
            self.written = {str(k): str(v) for k, v in written.items()}
        elif mode in SENTENCE_MODES and mode != "off":
            # stored by 1.22.1 - 1.23 (no hashes yet), or nothing recognised then: the files there are ours as
            # long as they are exactly what Home 3D writes (#369)
            self.written = await self.hass.async_add_executor_job(self._adopt, located_names(self.hass))

    def _adopt(self, names: list[str]) -> dict[str, str]:
        out: dict[str, str] = {}
        for language in _DISTINCT:
            try:
                text = _path(Path(self.hass.config.config_dir), language).read_text(encoding="utf-8")
            except OSError:
                continue
            if _ours(text, language, names):
                out[language] = _sha(text)
        return out

    @callback
    def schedule_refresh(self) -> None:
        """A device added or renamed, locating switched on or off: the files learn the names, after any write
        under way (#369)."""
        task = self.hass.async_create_task(self.async_refresh())
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    @callback
    def async_stop(self) -> None:
        """The integration unloads: no more refreshes, and one waiting or under way is cancelled."""
        if self.unsub is not None:
            self.unsub()
            self.unsub = None
        for task in self._tasks:
            task.cancel()
        self._tasks.clear()

    async def async_refresh(self) -> None:
        """After an update: the sentence files an admin picked get the sentences of this version (a file the user
        changed stays as it is). Nothing happens while the sentences are off."""
        async with self._lock:
            # read under the lock: an admin's choice made meanwhile is the one that counts
            if self.sentences == "off" or not self.written:
                return
            try:
                hashes, _kept, changed = await self.hass.async_add_executor_job(
                    write_sentences,
                    Path(self.hass.config.config_dir),
                    self.sentences,
                    self.written,
                    located_names(self.hass),
                )
            except OSError:
                _LOGGER.warning("Could not refresh the Assist sentences", exc_info=True)
                return
            if not changed:
                return
            self.written = hashes
            await self._store.async_save({"sentences": self.sentences, "written": hashes})
        if self.hass.services.has_service("conversation", "reload"):
            await self.hass.services.async_call("conversation", "reload", {}, blocking=False)

    async def async_set_sentences(self, mode: str) -> list[str]:
        """An admin picked the sentences: writes (or removes) the files, Assist reloads them. Returns the
        languages whose file was left alone because the user changed it."""
        if mode not in SENTENCE_MODES:
            raise ValueError(mode)
        async with self._lock:
            try:
                hashes, kept, changed = await self.hass.async_add_executor_job(
                    write_sentences, Path(self.hass.config.config_dir), mode, self.written, located_names(self.hass)
                )
            except OSError:
                _LOGGER.warning("Could not write the Assist sentences", exc_info=True)
                raise
            self.sentences = mode
            self.written = hashes
            await self._store.async_save({"sentences": mode, "written": hashes})
        # Assist reads custom sentences at its start: a changed file is loaded now
        if changed and self.hass.services.has_service("conversation", "reload"):
            await self.hass.services.async_call("conversation", "reload", {}, blocking=False)
        return kept


async def async_remove_sentences(hass: HomeAssistant) -> None:
    """The integration is removed: the sentence files Home 3D wrote go with it."""
    settings = VoiceSettings(hass)
    await settings.async_load()
    if not settings.written:
        return
    await hass.async_add_executor_job(remove_sentences, Path(hass.config.config_dir), settings.written)
    await settings._store.async_remove()


@dataclass(eq=False)
class _View:
    """An open view listening for sentences (voice/subscribe): how to reach it, its screen name in lower case
    ("": a view without a name; None: a view of an older frontend that did not say and picks its sentences itself)
    and whether its user is an admin (#367)."""

    send: Callable[[dict[str, Any]], None]
    screen: str | None
    admin: bool = False


@dataclass(eq=False)
class _Question:
    """A sentence handed to `asked` views, waiting for the first that understands it."""

    future: asyncio.Future[dict[str, Any]]
    asked: int
    declined: int = 0
    not_understood: dict[str, Any] | None = None


def _screen_key(screen: str | None) -> str:
    return (screen or "").strip().lower()


def _views(hass: HomeAssistant) -> list[_View]:
    """The open views: kept over a reload of the integration, as their subscriptions stay open."""
    views: list[_View] = hass.data.setdefault(DATA_VIEWS, [])
    return views


@callback
def subscribe_view(
    hass: HomeAssistant, send: Callable[[dict[str, Any]], None], screen: str | None, admin: bool = False
) -> Callable[[], None]:
    """An open view listens for sentences (voice/subscribe); returns how it stops. `admin`: the view's user is an
    admin, so it may be shown where people are while people are shown to admins only."""
    view = _View(send, None if screen is None else _screen_key(screen), admin)
    views = _views(hass)
    views.append(view)

    @callback
    def unsubscribe() -> None:
        if view in views:
            views.remove(view)

    return unsubscribe


class AskBroker:
    """Hands a sentence to the open views and waits for the first that understands it (#366)."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._pending: dict[str, _Question] = {}

    def screens(self) -> set[str]:
        """The screen names of the open views (lower case)."""
        return {view.screen for view in _views(self.hass) if view.screen}

    def _views_for(self, screen: str | None) -> list[_View]:
        """The views a sentence is for: all of them, or for one screen the views of that name (and those of an
        older frontend, which pick for themselves)."""
        key = _screen_key(screen)
        return [view for view in _views(self.hass) if not key or view.screen is None or view.screen == key]

    @callback
    def show(self, message: dict[str, Any], screen: str | None, admins_only: bool = False) -> None:
        """Something for the views to show that nobody waits for (the rooms of a locating answer). `admins_only`:
        only the views of admins get it at all; the server filters, the screen is not trusted to hide it (#367)."""
        for view in self._views_for(screen):
            if view.admin or not admins_only:
                view.send(message)

    async def ask(self, text: str, screen: str | None, speak: bool) -> dict[str, Any] | None:
        """The answer of the first view that understands ({"text", "answered": True}). A view that did not
        understand counts only when no view does: once every view asked said so, or when the time is up after one
        did ({"text", "answered": False}). None when no view is open (at once) or none answered in time."""
        views = self._views_for(screen)
        if not views:
            return None
        ask_id = uuid.uuid4().hex
        question = _Question(self.hass.loop.create_future(), len(views))
        self._pending[ask_id] = question
        try:
            ask = {"ask_id": ask_id, "text": text, "screen": screen, "speak": speak}
            for view in views:
                view.send(ask)
            async with asyncio.timeout(ANSWER_TIMEOUT):
                return await question.future
        except TimeoutError:
            return question.not_understood
        finally:
            self._pending.pop(ask_id, None)

    def answer(self, ask_id: str, text: str, answered: bool) -> bool:
        """A view's answer: the first that understood is taken, one that did not is counted. False when the
        question is unknown or answered already."""
        question = self._pending.get(ask_id)
        if question is None or question.future.done():
            return False
        if answered:
            question.future.set_result({"text": text, "answered": True})
            return True
        question.declined += 1
        if question.not_understood is None:
            question.not_understood = {"text": text, "answered": False}
        if question.declined >= question.asked:
            question.future.set_result(question.not_understood)
        return True


def satellite_screen(
    hass: HomeAssistant, device_id: str | None, satellite_id: str | None, screens: set[str]
) -> str | None:
    """The screen next to the voice satellite that heard a sentence (#366): an open view whose screen name is the
    satellite's device name or the name of its area (a wall tablet named "Kitchen" by the kitchen's satellite).
    None when Home Assistant names no device or no open view has such a name: then every view is asked."""
    if not screens or not (device_id or satellite_id):
        return None
    entity = er.async_get(hass).async_get(satellite_id) if satellite_id else None
    device_id = device_id or (entity.device_id if entity else None)
    device = dr.async_get(hass).async_get(device_id) if device_id else None
    names: list[str | None] = [device.name_by_user, device.name] if device else []
    areas = ar.async_get(hass)
    for area_id in (entity.area_id if entity else None, device.area_id if device else None):
        if area_id and (area := areas.async_get_area(area_id)) is not None:
            names.append(area.name)
    return next((name.strip() for name in names if name and _screen_key(name) in screens), None)


def show_located(hass: HomeAssistant, located: Located, screen: str | None = None) -> None:
    """The open views fly into the room of the answer ("Where is Alex?"), or tour the rooms of everyone at home.
    Nobody waits for them. Not when switched off in the locating settings; while people are shown to admins only,
    only the views of admins fly to people (a wall tablet would show everyone where they are): the rooms are not
    sent to any other view at all (#367)."""
    service = hass.data.get(DATA_LOCATE)
    broker: AskBroker | None = hass.data.get(DATA_ASK)
    if not located.rooms or service is None or not service.fly or broker is None:
        return
    admins_only = bool(located.persons and service.admins_only)
    broker.show(
        {
            "ask_id": "",
            "text": "",
            "screen": screen,
            "speak": False,
            "show_rooms": located.rooms,
            # kept for the views of older frontends, which hide such rooms themselves
            "admins_only": admins_only,
        },
        screen,
        admins_only,
    )


class AskIntentHandler(intent.IntentHandler):
    """Assist's "show me the living room" and the questions the modules answer."""

    intent_type = INTENT_ASK
    description = "Shows a place or device in Home 3D or asks the house a question (the open Home 3D views answer)"
    slot_schema: ClassVar[dict] = {vol.Optional("text"): cv.string, vol.Optional(WHO_LIST): cv.string}

    def __init__(self, broker: AskBroker) -> None:
        self.broker = broker

    async def async_handle(self, intent_obj: intent.Intent) -> intent.IntentResponse:
        slots = self.async_validate_slots(intent_obj.slots)
        # the views understand the whole sentence ("show the living room"); the wildcard alone is the fallback
        text = (intent_obj.text_input or str(slots.get("text", {}).get("value") or "")).strip()
        if not text:
            raise intent.InvalidSlotInfo("no sentence")
        hass = intent_obj.hass
        language = (intent_obj.language or hass.config.language or "en").split("-")[0]
        response = intent_obj.create_response()
        # said to a satellite by a screen: that screen shows it, not every open view (#366)
        screen = satellite_screen(
            hass, intent_obj.device_id, getattr(intent_obj, "satellite_id", None), self.broker.screens()
        )
        # where people and things are: answered here, no screen needed
        located = await async_locate(hass, hass.data.get(DATA_LOCATE), text, language, intent_obj.context.user_id)
        if located is not None:
            show_located(hass, located, screen)
            response.async_set_speech(located.text)
            return response
        answer = await self.broker.ask(text, screen, False)
        if answer is None:
            response.async_set_speech(_NO_SCREEN.get(language, _NO_SCREEN["en"]))
        elif not answer["answered"]:
            response.async_set_speech(_NOT_UNDERSTOOD.get(language, _NOT_UNDERSTOOD["en"]))
        else:
            response.async_set_speech(answer["text"])
        return response


async def async_setup_voice(hass: HomeAssistant) -> None:
    """Registers the service and the intent and writes the sentences Assist understands."""
    broker = AskBroker(hass)
    hass.data[DATA_ASK] = broker

    async def handle_ask(call: ServiceCall) -> ServiceResponse:
        language = (hass.config.language or "en").split("-")[0]
        locate = hass.data.get(DATA_LOCATE)
        located = await async_locate(hass, locate, call.data["text"], language, call.context.user_id)
        if located is not None:
            show_located(hass, located, call.data.get("screen"))
            return {"answered": True, "answer": located.text, "screen_open": False}
        answer = await broker.ask(call.data["text"], call.data.get("screen"), call.data["speak"])
        if answer is None:
            return {"answered": False, "answer": "", "screen_open": False}
        return {"answered": answer["answered"], "answer": answer["text"], "screen_open": True}

    hass.services.async_register(
        DOMAIN, SERVICE_ASK, handle_ask, schema=ASK_SCHEMA, supports_response=SupportsResponse.OPTIONAL
    )
    intent.async_register(hass, AskIntentHandler(broker))

    # the sentence files are written only when an admin picks them in the voice settings (never on setup)
    settings = VoiceSettings(hass)
    await settings.async_load()
    hass.data[DATA_VOICE] = settings
    await settings.async_refresh()

    # a device added or renamed, locating switched on or off: "Where is …?" learns the names
    settings.unsub = async_dispatcher_connect(hass, SIGNAL_LOCATE_DEVICES, settings.schedule_refresh)


def async_unload_voice(hass: HomeAssistant) -> None:
    """Service and intent go with the integration."""
    hass.services.async_remove(DOMAIN, SERVICE_ASK)
    intent.async_remove(hass, INTENT_ASK)
    hass.data.pop(DATA_ASK, None)
    settings: VoiceSettings | None = hass.data.pop(DATA_VOICE, None)
    if settings is not None:
        settings.async_stop()
