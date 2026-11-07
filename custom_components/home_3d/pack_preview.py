"""What installing a pack release from GitHub would change (#189): the items added, changed and removed against the
pack the library offers now, so an editor sees it before confirming. Pure functions, nothing is written."""

from __future__ import annotations

from typing import Any

from .packs import is_language_pack


def item_changes(current: dict[str, Any] | None, payload: dict[str, Any]) -> dict[str, Any]:
    """The items of `payload` against the pack installed now (None: a pack not installed yet, every item is new).
    Items are matched by id; one counts as changed when anything in it differs. Names are the items' own name maps."""
    old = {i["id"]: i for i in (current or {}).get("items", [])}
    new = {i["id"]: i for i in payload["items"]}
    added = [{"id": i, "name": new[i].get("name") or {}} for i in new if i not in old]
    changed = [{"id": i, "name": new[i].get("name") or {}} for i in new if i in old and new[i] != old[i]]
    removed = [{"id": i, "name": old[i].get("name") or {}} for i in old if i not in new]
    return {"added": added, "changed": changed, "removed": removed, "unchanged": len(new) - len(added) - len(changed)}


def text_changes(current: dict[str, Any] | None, payload: dict[str, Any]) -> dict[str, Any]:
    """A language pack's texts (#196) against the installed one, in the shape of item_changes: each entry is a text
    key (as the id, with no name)."""
    old: dict[str, str] = (current or {}).get("strings", {})
    new: dict[str, str] = payload["strings"]
    added = [{"id": k, "name": {}} for k in new if k not in old]
    changed = [{"id": k, "name": {}} for k in new if k in old and new[k] != old[k]]
    removed = [{"id": k, "name": {}} for k in old if k not in new]
    return {"added": added, "changed": changed, "removed": removed, "unchanged": len(new) - len(added) - len(changed)}


def pack_preview(
    payload: dict[str, Any],
    origin: dict[str, Any],
    current: dict[str, Any] | None,
    *,
    pinned: bool,
    warnings: list[str],
) -> dict[str, Any]:
    """The answer of a preview: the pack, where it comes from (the commit is the pin an install can insist on), what
    is installed now and the changes. `warnings` are codes the page words (older release, pinned, shadowing)."""
    installed_origin = ((current or {}).get("source") or {}).get("origin")
    return {
        "pack": {
            "id": payload["id"],
            "name": payload["name"],
            "publisher": payload["publisher"],
            "licence": payload["licence"],
            "release": payload["release"],
            **({"note": payload["release_note"]} if payload.get("release_note") else {}),
            "items": len(payload["items"]),
            # a language pack (#196): its language and how many texts it has
            **(
                {"kind": "language", "language": payload["language"], "texts": len(payload["strings"])}
                if is_language_pack(payload)
                else {}
            ),
        },
        "origin": {k: origin[k] for k in ("url", "owner", "repo", "ref", "folder", "commit", "default_branch")},
        "installed": None
        if current is None
        else {
            "release": current.get("release", 1),
            "publisher": current.get("publisher"),
            "bundled": bool(current.get("bundled")),
            "pinned": pinned,
            "commit": installed_origin.get("commit") if isinstance(installed_origin, dict) else None,
        },
        "changes": text_changes(current, payload) if is_language_pack(payload) else item_changes(current, payload),
        "warnings": warnings,
    }
