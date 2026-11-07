"""Config flow for Home 3D (everything is set up in the panel; the options are the sidebar entry and how long the
pictures of restore points are kept)."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
import voluptuous as vol

from .const import (
    CONF_RESTORE_PICTURE_DAYS,
    CONF_SHOW_IN_SIDEBAR,
    DEFAULT_RESTORE_PICTURE_DAYS,
    DEFAULT_SHOW_IN_SIDEBAR,
    DOMAIN,
    PANEL_TITLE,
)


class FloorplanConfigFlow(ConfigFlow, domain=DOMAIN):
    """Single-step flow."""

    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        """The options: show Home 3D in the sidebar (#8), keep the pictures of restore points (#154)."""
        return FloorplanOptionsFlow()

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Confirm and create the entry."""
        if user_input is not None:
            return self.async_create_entry(title=PANEL_TITLE, data={})
        return self.async_show_form(step_id="user")


class FloorplanOptionsFlow(OptionsFlow):
    """Show Home 3D in the sidebar: on or off, applied at once (HA's own per-user sidebar hiding still works). How many
    days a picture that only a restore point still uses is kept (#154): applied at the next start."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        options = self.config_entry.options
        show = options.get(CONF_SHOW_IN_SIDEBAR, DEFAULT_SHOW_IN_SIDEBAR)
        days = options.get(CONF_RESTORE_PICTURE_DAYS, DEFAULT_RESTORE_PICTURE_DAYS)
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_SHOW_IN_SIDEBAR, default=show): bool,
                    vol.Required(CONF_RESTORE_PICTURE_DAYS, default=days): vol.All(
                        vol.Coerce(int), vol.Range(min=0, max=3650)
                    ),
                }
            ),
        )
