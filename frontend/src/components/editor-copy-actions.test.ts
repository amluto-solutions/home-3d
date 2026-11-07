// Copying an item with a perform action (#383): a non-admin's copy loses it (the server would refuse the whole save);
// an admin's keeps it.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { makeEditor, square } from "./editor-harness.ts";

const item = (): Furniture =>
  ({
    id: "door",
    type: "tv_board",
    x: 1,
    z: 1,
    rotation: 0,
    w: 1,
    d: 0.4,
    h: 0.5,
    actions: {
      tap: { action: "perform_action", target: "script.sample_open", data: {} },
      hold: { action: "more_info" },
    },
  }) as unknown as Furniture;

async function editor(admin: boolean) {
  const el = await makeEditor([square("r", 0, 0, 4, 4)], [item()]);
  el.hass.user.is_admin = admin;
  el.selectItem("furniture", "door");
  return el;
}

const copyOf = (el: Awaited<ReturnType<typeof editor>>) => (el._doc.floors[0].furniture as Furniture[]).find((f) => f.id !== "door")!;

for (const how of ["duplicate", "paste"] as const) {
  const copy = (el: Awaited<ReturnType<typeof editor>>) => {
    if (how === "duplicate") el.duplicateFurniture();
    else {
      el.copySelection();
      el.pasteClipboard();
    }
  };

  test(`${how} as a non-admin drops the perform action from the copy, with a notice (#383)`, async () => {
    const el = await editor(false);
    copy(el);
    const c = copyOf(el);
    assert.equal(c.actions?.tap?.action, "default");
    assert.equal(c.actions?.hold?.action, "more_info", "other actions stay");
    assert.match(String(el._notice), /1/);
    assert.equal((el._doc.floors[0].furniture as Furniture[])[0].actions?.tap?.action, "perform_action", "the original keeps it");
  });

  test(`${how} as an admin keeps the perform action (#383)`, async () => {
    const el = await editor(true);
    copy(el);
    assert.equal(copyOf(el).actions?.tap?.action, "perform_action");
    assert.equal(el._notice ?? null, null);
  });
}
