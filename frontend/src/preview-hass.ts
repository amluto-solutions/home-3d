// A Home Assistant for a card template's preview (#495, ported from NeonPlan 3D 4.0.0, MIT, Mastershort): the preview
// turns, zooms and opens rooms like the card, but it switches nothing. Its service calls go nowhere, and the messages
// that would change something (saving the plan, a picture, an answer to Assist …) are not sent; reading still works.
// The connection itself is handed on as it is: our code sends no changing message through it (only subscriptions).
import type { HomeAssistant } from "./types.ts";

/** Message types that change something: the preview keeps them back. */
const CHANGES = /^(call_service|execute_script|fire_event)$|\/(save|set|create|delete|remove|restore|snapshot|import|install_url|rename|duplicate|set_active|rollback|pin|update_items|answer|reload|record|send)(\/|$)/;

/** Whether a message to Home Assistant would change something (the preview keeps it back). */
export function changesSomething(msg: unknown): boolean {
  const type = (msg as { type?: unknown } | null)?.type;
  return typeof type === "string" && CHANGES.test(type);
}

/** `hass` for the preview: the same states and reads, no service calls, no changing messages. */
export function previewHass(hass: HomeAssistant): HomeAssistant {
  return {
    ...hass,
    callService: async () => undefined,
    callWS: <T>(msg: Record<string, unknown>) => (changesSomething(msg) ? Promise.resolve(undefined as T) : hass.callWS<T>(msg)),
  };
}
