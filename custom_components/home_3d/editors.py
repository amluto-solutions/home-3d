"""Who may change the plan (#7).

A list of Home Assistant users kept in `.storage`. Until an admin picks the editors, every admin is one (and an admin
added later becomes one too); once picked, the list decides, so a non-admin can be an editor and an admin can be left
out (a wall tablet signed in as an admin, say). Only admins change the list (in the editor's settings), so it must keep
at least one admin: otherwise nobody could open the editor to change it back.
"""

from __future__ import annotations

import json
from typing import Any

from homeassistant.auth.models import User
from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import DATA_EDITORS, STORAGE_KEY_EDITORS, STORAGE_VERSION


class EditorsError(Exception):
    """The list was refused; `code` says why."""

    def __init__(self, code: str, detail: str) -> None:
        super().__init__(detail)
        self.code = code
        self.detail = detail


def _people(users: list[User]) -> list[User]:
    """The users a person signs in as (no system users such as the Supervisor's)."""
    return [u for u in users if not u.system_generated and u.is_active]


class Editors:
    """The editors list of one installation."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_EDITORS)
        # None: never picked, every admin edits
        self.custom: list[str] | None = None

    async def async_load(self) -> None:
        stored = await self._store.async_load()
        if stored and isinstance(stored.get("editors"), list):
            self.custom = [str(i) for i in stored["editors"]]

    def can_edit(self, user: User | None) -> bool:
        if user is None:
            return False
        if self.custom is None:
            return user.is_admin
        return user.id in self.custom

    async def async_users(self) -> list[dict[str, Any]]:
        """Everyone who signs in, admins first, each with whether they edit."""
        users = sorted(_people(await self.hass.auth.async_get_users()), key=lambda u: (not u.is_admin, u.name or ""))
        return [{"id": u.id, "name": u.name or "", "is_admin": u.is_admin, "editor": self.can_edit(u)} for u in users]

    async def async_set(self, user_ids: list[str] | None) -> None:
        """Pick the editors (None goes back to "every admin"). Unknown ids are dropped."""
        if user_ids is None:
            self.custom = None
            await self._store.async_save({"editors": None})
            return
        known = {u.id: u for u in _people(await self.hass.auth.async_get_users())}
        picked = list(dict.fromkeys(i for i in user_ids if i in known))
        if not any(known[i].is_admin for i in picked):
            raise EditorsError("no_admin", "The editors must include at least one admin")
        self.custom = picked
        await self._store.async_save({"editors": picked})


def can_edit(hass: HomeAssistant, user: User | None) -> bool:
    """Whether this user may change the plan (admins only while Home 3D is not set up)."""
    editors: Editors | None = hass.data.get(DATA_EDITORS)
    if editors is None:
        return bool(user and user.is_admin)
    return editors.can_edit(user)


def performed_actions(building: dict[str, Any]) -> set[tuple[str, str, str, str]]:
    """Every `perform_action` item action and service/event menu button of a plan, by the item and gesture (#51, #151).

    Such an action runs any Home Assistant action in the session of whoever taps, an admin too, so only an admin adds
    or changes one. Compared by what it does: the item, gesture, action, its data and whether (and what) it asks first.
    """
    found: set[tuple[str, str, str, str]] = set()
    for floor in building.get("floors", []):
        owners = [("furniture", item.get("id"), item) for item in floor.get("furniture", [])]
        owners += [("placement", item.get("entity_id"), item) for item in floor.get("placements", [])]
        for kind, owner_id, item in owners:
            for gesture, action in (item.get("actions") or {}).items():
                if not action or action.get("action") != "perform_action":
                    continue
                what = [action.get("target"), action.get("data") or {}, bool(action.get("confirm"))]
                what.append(action.get("confirm_text") or None)
                found.add((kind, str(owner_id), gesture, json.dumps(what, sort_keys=True)))
    # the central menu's own buttons (#151): a service or an event button runs in the session of whoever taps it too
    for button in (building.get("settings") or {}).get("buttons") or []:
        if button.get("action") in ("service", "fire_dom_event"):
            what = [button.get("target"), button.get("data") or {}]
            found.add(("button", str(button.get("id")), str(button["action"]), json.dumps(what, sort_keys=True)))
    return found


def action_owner(building: dict[str, Any], key: tuple[str, str, str, str]) -> str:
    """The item or button behind one `performed_actions` entry, as 'name (id)' or just the id (#383)."""
    kind, owner_id = key[0], key[1]
    if kind == "button":
        pool = (building.get("settings") or {}).get("buttons") or []
        id_key, name_key = "id", "label"
    else:
        part = "furniture" if kind == "furniture" else "placements"
        pool = [i for f in building.get("floors", []) for i in f.get(part, [])]
        id_key, name_key = ("id" if kind == "furniture" else "entity_id"), "name"
    name = next((str(i[name_key]) for i in pool if str(i.get(id_key)) == owner_id and i.get(name_key)), None)
    return f"{name} ({owner_id})" if name else owner_id
