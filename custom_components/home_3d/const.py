"""Constants for Home 3D."""

from __future__ import annotations

DOMAIN = "home_3d"

STORAGE_VERSION = 1
# minor versions of the building store; each step has a migration in storage.py
STORAGE_MINOR_VERSION = 2
# the format of a plan (#165): its `version`; an older plan is brought up to this one by the steps in migrations.py.
# One up (with a step) whenever the stored plan can hold a value an older Home 3D would not read, a new choice of a
# field too (#379): tests/fixtures/plan-choices.json keeps the choices of each version
PLAN_VERSION = 4
# the websocket protocol (#166): one up whenever a command or a field of one is added, changed or removed, so the
# frontend can tell what the backend it talks to understands (building/get and version send it). The commands are
# listed in tests/fixtures/contract/websocket.json, which tests/test_contract.py keeps in step and the frontend
# checks its calls against
PROTOCOL = 5
STORAGE_KEY_BUILDING = f"{DOMAIN}.building"
STORAGE_KEY_IMAGES = f"{DOMAIN}.images"
STORAGE_KEY_HISTORY = f"{DOMAIN}.history"
STORAGE_KEY_PACKS = f"{DOMAIN}.packs"
# several homes (#53): the list of homes and which one is active; the first home (FIRST_HOME_ID) keeps the stores
# above, so an install from before #53 needs no data moved; every other home has its own three stores
STORAGE_KEY_HOMES = f"{DOMAIN}.homes"
FIRST_HOME_ID = "home"
DEFAULT_HOME_NAME = "Home"

# restore points: at most this many, and a new one only after this pause since the last one
HISTORY_MAX = 20
HISTORY_INTERVAL = 600
# a stored plan as it was before a repair (#379) is kept as a restore point the others never push out: at most this many
KEPT_MAX = 5
# the clean-up on load keeps a picture set in the last this many days though no plan uses it (#379: a draft may), at
# most the restore pictures' days
UPLOAD_GRACE_DAYS = 7

# The frontend files are served under /api/ (#218): Home Assistant's service worker takes /api/ paths from the network
# only, while it answers any other path, and Home Assistant's own page, from its cache first. The extra module, the
# panel's module_url and the card loader all name ONE URL, the start file (MAIN_BUNDLE), for every restart and every
# update, so a page the service worker kept from before an update names the same module as the panel. The start file
# (frontend boot.ts) holds no build: it asks build.json at a URL no cache has seen which build is served and imports
# that build's app (APP_BUNDLE?v=<build>, kept for a year). So a page that names an old entry, a proxy that turns
# no-cache into hours (#340) or a browser that kept the start file still run the current build after one load (#357).
# The start file and the loader are never kept (no-cache); a stale one does no harm.
URL_BASE = "/api/home_3d/static"
# the path before #218, still served: a cached page or an old dashboard resource can name it
LEGACY_URL_BASE = "/home_3d_static"
MAIN_BUNDLE = "home-3d.js"
# the app the start file imports (#357)
APP_BUNDLE = "home-3d-app.js"
MAIN_URL = f"{URL_BASE}/{MAIN_BUNDLE}"
PANEL_URL_PATH = "home_3d"
PANEL_COMPONENT = "home-3d-panel"
PANEL_ICON = "mdi:floor-plan"
PANEL_TITLE = "Home 3D"
# integration option (#8): whether the panel has an entry in the sidebar (the panel URL and the card work either way)
CONF_SHOW_IN_SIDEBAR = "show_in_sidebar"
DEFAULT_SHOW_IN_SIDEBAR = True
# integration option (#154): how many days a picture only a restore point still uses is kept (0: not at all)
CONF_RESTORE_PICTURE_DAYS = "restore_picture_days"
DEFAULT_RESTORE_PICTURE_DAYS = 90

# a home's plan changed: (home id, revision)
SIGNAL_BUILDING_UPDATED = f"{DOMAIN}_building_updated"
# the homes changed (one added, renamed, removed, or another one made active)
SIGNAL_HOMES_UPDATED = f"{DOMAIN}_homes_updated"
# roaming pets (#337): where each pet of a home is now, worked out on the server: (home id, targets), and the
# hass.data key of the routines
SIGNAL_PETS_UPDATED = f"{DOMAIN}_pets_updated"
DATA_PETS = f"{DOMAIN}_pets"
# the hass.data key of the broker that hands sentences to the open views (see voice.py)
DATA_ASK = f"{DOMAIN}_ask"
# a style for the open views (the service `set_style`): the screens named, or every one (#442)
SIGNAL_STYLE = f"{DOMAIN}_style"
# the voice settings (which sentences Assist hands to Home 3D), kept in .storage
DATA_VOICE = f"{DOMAIN}_voice"
STORAGE_KEY_VOICE = f"{DOMAIN}.voice"
# the editors list (#7): who may change the plan, kept in .storage (see editors.py)
DATA_EDITORS = f"{DOMAIN}_editors"
STORAGE_KEY_EDITORS = f"{DOMAIN}.editors"
# the household's own items, made in the item editor (#13), kept in .storage and offered as one more pack
STORAGE_KEY_ITEMS = f"{DOMAIN}.custom_items"
# pack updates (#26): the settings, pins and previous releases, kept in .storage (see pack_updates.py)
DATA_PACK_UPDATES = f"{DOMAIN}_pack_updates"
STORAGE_KEY_PACK_UPDATES = f"{DOMAIN}.pack_updates"
# a time of day as the plan and the update settings store it: "HH:MM", 00:00 to 23:59 (frontend show-when.ts HHMM)
TIME_PATTERN = r"^([01][0-9]|2[0-3]):[0-5][0-9]$"

# pet event triggers (#359): an event type every Home Assistant event or very many events a second would match makes a
# pet's trigger fire (and every view redraw) all the time, so these are refused. `*` is MATCH_ALL; the rest are the
# core events fired for every state change, service call, entity or service registration, and so on.
PET_EVENT_REFUSED = frozenset(
    {
        "*",
        "state_changed",
        "state_reported",
        "call_service",
        "service_registered",
        "service_removed",
        "component_loaded",
        "themes_updated",
        "entity_registry_updated",
        "device_registry_updated",
        "area_registry_updated",
        "core_config_updated",
        "homeassistant_start",
        "homeassistant_started",
        "homeassistant_stop",
        "homeassistant_final_write",
        "homeassistant_close",
        "logbook_entry",
        "panels_updated",
        "lovelace_updated",
        "user_added",
        "user_removed",
        "automation_reloaded",
        "scene_reloaded",
        "event_template_reloaded",
    }
)
