import assert from "node:assert/strict";
import { test } from "node:test";
import type { ActionEnv } from "./item-actions.ts";
import { actionTypeChoosable, performActionLocked, runItemAction } from "./item-actions.ts";

/** An environment that records what an action asked Home Assistant and the app to do. */
function recorder(answer = true) {
  const done: unknown[][] = [];
  const env: ActionEnv = {
    callService: async (domain, service, data) => void done.push(["service", domain, service, data]),
    moreInfo: (entity) => void done.push(["more_info", entity]),
    camera: (entity) => void done.push(["camera", entity]),
    navigate: (path) => void done.push(["navigate", path]),
    openUrl: (url) => void done.push(["url", url]),
    confirm: async (text) => {
      done.push(["confirm", text]);
      return answer;
    },
    ownHost: "ha.example:8123",
    externalText: (host) => `open ${host}?`,
  };
  return { env, done };
}

test("a service call runs through Home Assistant with its data", async () => {
  const { env, done } = recorder();
  const ran = await runItemAction({ action: "perform_action", target: "rest_command.gate_open", data: { duration: 5 } }, "switch.gate", env);
  assert.equal(ran, true);
  assert.deepEqual(done, [["service", "rest_command", "gate_open", { duration: 5 }]]);
});

test("toggle, more-info and camera act on the item's own entity unless another is chosen", async () => {
  const { env, done } = recorder();
  await runItemAction({ action: "toggle" }, "light.desk", env);
  await runItemAction({ action: "toggle", target: "switch.fan" }, "light.desk", env);
  await runItemAction({ action: "more_info" }, "light.desk", env);
  await runItemAction({ action: "camera", target: "camera.drive" }, "light.desk", env);
  assert.deepEqual(done, [
    ["service", "homeassistant", "toggle", { entity_id: "light.desk" }],
    ["service", "homeassistant", "toggle", { entity_id: "switch.fan" }],
    ["more_info", "light.desk"],
    ["camera", "camera.drive"],
  ]);
});

test("navigate opens a dashboard path and url opens an address; without one nothing runs", async () => {
  const { env, done } = recorder();
  assert.equal(await runItemAction({ action: "navigate", target: "/lovelace/garden" }, "light.desk", env), true);
  assert.equal(await runItemAction({ action: "url", target: "https://example.org/manual" }, "light.desk", env), true);
  assert.equal(await runItemAction({ action: "navigate", target: " " }, "light.desk", env), false);
  assert.equal(await runItemAction({ action: "url" }, "light.desk", env), false);
  assert.deepEqual(done, [
    ["navigate", "/lovelace/garden"],
    ["confirm", "open example.org?"],
    ["url", "https://example.org/manual"],
  ]);
});

test("url opens only http(s) addresses and paths on this Home Assistant (#51)", async () => {
  const { env, done } = recorder();
  for (const ok of ["http://192.168.1.10/", "/local/manual.pdf"]) {
    assert.equal(await runItemAction({ action: "url", target: ok }, null, env), true, ok);
  }
  for (const bad of ["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,x", "//evil.example", "vbscript:x"]) {
    assert.equal(await runItemAction({ action: "url", target: bad }, null, env), false, bad);
  }
  // the address of another host asks first, naming it (#384)
  assert.deepEqual(done, [
    ["confirm", "open 192.168.1.10?"],
    ["url", "http://192.168.1.10/"],
    ["url", "/local/manual.pdf"],
  ]);
});

test("a link to another host always asks first, naming the host; no means it does not open (#384)", async () => {
  const yes = recorder();
  assert.equal(await runItemAction({ action: "url", target: "https://login.example.net/x?y=1" }, null, yes.env), true);
  assert.deepEqual(yes.done, [["confirm", "open login.example.net?"], ["url", "https://login.example.net/x?y=1"]]);
  const no = recorder(false);
  assert.equal(await runItemAction({ action: "url", target: "https://user@login.example.net/" }, null, no.env), false);
  assert.deepEqual(no.done, [["confirm", "open login.example.net?"]]);
  // the item's own question comes first, then the one naming the host
  const both = recorder();
  await runItemAction({ action: "url", target: "https://example.org/", confirm: true, confirm_text: "Sure?" }, null, both.env);
  assert.deepEqual(both.done, [["confirm", "Sure?"], ["confirm", "open example.org?"], ["url", "https://example.org/"]]);
  // this Home Assistant's own host and its paths do not ask
  const own = recorder();
  await runItemAction({ action: "url", target: "http://HA.example:8123/lovelace/0" }, null, own.env);
  await runItemAction({ action: "url", target: "/lovelace/0" }, null, own.env);
  assert.deepEqual(own.done, [["url", "http://HA.example:8123/lovelace/0"], ["url", "/lovelace/0"]]);
});

test("paths starting // or /backslash are other hosts, not paths, and do not open (#384)", async () => {
  const { env, done } = recorder();
  for (const bad of ["/\\evil.example", "/\\/evil.example", "/\\", "//evil.example", "/\\evil.example/x", "https://"]) {
    assert.equal(await runItemAction({ action: "url", target: bad }, null, env), false, bad);
  }
  assert.deepEqual(done, []);
});

test("an action that asks first shows the editor's text and runs nothing when cancelled", async () => {
  const no = recorder(false);
  const gate = { action: "perform_action", target: "script.open_gate", confirm: true, confirm_text: "Open the gate?" } as const;
  assert.equal(await runItemAction(gate, null, no.env), false);
  assert.deepEqual(no.done, [["confirm", "Open the gate?"]]);
  const yes = recorder(true);
  assert.equal(await runItemAction(gate, null, yes.env), true);
  assert.deepEqual(yes.done, [["confirm", "Open the gate?"], ["service", "script", "open_gate", {}]]);
  // asking without own text: the app's default question
  const plain = recorder(true);
  await runItemAction({ action: "toggle", confirm: true, confirm_text: "  " }, "switch.pc", plain.env);
  assert.deepEqual(plain.done[0], ["confirm", null]);
});

test("nothing is asked or run for an action that cannot run", async () => {
  const { env, done } = recorder();
  assert.equal(await runItemAction({ action: "perform_action", target: "not-a-service", confirm: true }, null, env), false);
  assert.equal(await runItemAction({ action: "toggle", confirm: true }, null, env), false);
  assert.equal(await runItemAction({ action: "none", confirm: true }, "light.desk", env), false);
  assert.deepEqual(done, []);
});

test("an item's actions are found by what a tap on it reports; items without any stay out", async () => {
  const { actionIndex } = await import("./item-actions.ts");
  const { newFloor } = await import("./model.ts");
  const floor = newFloor("f1", "Ground", 0);
  const tap = { action: "perform_action", target: "script.movie" } as const;
  floor.placements = [
    { entity_id: "light.desk", x: 0, z: 0, y: null, actions: { hold: { action: "more_info" } } },
    { entity_id: "light.plain", x: 1, z: 0, y: null },
  ];
  const item = (id: string, actions?: object) => ({ id, type: "sofa", x: 0, z: 0, rotation: 0, w: 1, d: 1, h: 1, variant: null, ...(actions ? { actions } : {}) });
  floor.furniture = [item("tv", { tap }), item("sofa", { double_tap: { action: "navigate", target: "/lovelace/0" } }), item("chair")] as never;
  const targets = new Map([["tv", "media_player.tv"]]);
  const index = actionIndex([floor], (id) => targets.get(id), (f) => (f.id === "tv" ? "media_player.tv" : null));
  assert.deepEqual(index.get("light.desk"), { actions: { hold: { action: "more_info" } }, entity: "light.desk" });
  assert.deepEqual(index.get("media_player.tv"), { actions: { tap }, entity: "media_player.tv" });
  // an item without an entity is tapped as "item:<id>"
  assert.equal(index.get("item:sofa")?.entity, null);
  assert.equal(index.has("light.plain"), false);
  assert.equal(index.has("item:chair"), false);
  assert.equal(index.size, 3);
});

test("a gesture without an own action (or set to default) keeps the item's usual behaviour", async () => {
  const { gestureAction } = await import("./item-actions.ts");
  const entry = { actions: { tap: { action: "default" }, hold: { action: "none" } }, entity: "light.desk" } as const;
  assert.equal(gestureAction(entry, "tap"), null);
  assert.equal(gestureAction(entry, "double_tap"), null);
  assert.equal(gestureAction(undefined, "tap"), null);
  // "none" is an own choice: the hold then does nothing
  assert.deepEqual(gestureAction(entry, "hold"), { action: "none" });
});

test("with a double-tap action a tap waits for a second one; without, it runs at once", async (t) => {
  const { TapSequencer } = await import("./item-actions.ts");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const seq = new TapSequencer(300);
  const log: string[] = [];
  const on = (id: string, double: boolean) => seq.tap(id, double, () => log.push(`tap ${id}`), () => log.push(`double ${id}`));
  on("light.a", false);
  assert.deepEqual(log, ["tap light.a"]);
  // one tap: it runs once the wait is over
  on("light.b", true);
  assert.deepEqual(log, ["tap light.a"]);
  t.mock.timers.tick(300);
  assert.deepEqual(log, ["tap light.a", "tap light.b"]);
  // two taps in time: only the double tap
  on("light.b", true);
  t.mock.timers.tick(100);
  on("light.b", true);
  t.mock.timers.tick(1000);
  assert.deepEqual(log.slice(2), ["double light.b"]);
  // the view's own double-tap event (the second tap on the canvas) ends a waiting tap as a double tap
  on("light.b", true);
  assert.equal(seq.doubleTap("light.b"), true);
  assert.equal(seq.doubleTap("light.c"), false);
  t.mock.timers.tick(1000);
  assert.deepEqual(log.slice(3), ["double light.b"]);
  // a tap on another item meanwhile: the waiting one runs as a single tap first
  on("light.b", true);
  on("light.d", false);
  assert.deepEqual(log.slice(4), ["tap light.b", "tap light.d"]);
});

test("editing a gesture keeps only real choices; nothing left means no own actions", async () => {
  const { withGesture } = await import("./item-actions.ts");
  const a = withGesture(null, "tap", { action: "toggle" });
  assert.deepEqual(a, { tap: { action: "toggle" } });
  const b = withGesture(a, "hold", { action: "url", target: "https://example.org" });
  assert.deepEqual(b, { tap: { action: "toggle" }, hold: { action: "url", target: "https://example.org" } });
  // back to default drops the gesture; the last one gone leaves null
  assert.deepEqual(withGesture(b, "tap", { action: "default" }), { hold: { action: "url", target: "https://example.org" } });
  assert.equal(withGesture({ tap: { action: "toggle" } }, "tap", null), null);
});

test("service data is written as JSON; empty is none, anything but an object is refused", async () => {
  const { parseActionData } = await import("./item-actions.ts");
  assert.deepEqual(parseActionData('{"entity_id": "script.movie", "variables": {"volume": 0.4}}'), { entity_id: "script.movie", variables: { volume: 0.4 } });
  assert.equal(parseActionData("   "), null);
  assert.throws(() => parseActionData("[1, 2]"));
  assert.throws(() => parseActionData("{oops"));
});

test("only an admin adds or changes a perform_action; an editor may still replace one with another action (#51)", () => {
  const perform = { action: "perform_action" as const, target: "lock.unlock", data: { entity_id: "lock.front" } };
  // an admin picks and edits anything
  assert.equal(actionTypeChoosable("perform_action", null, true), true);
  assert.equal(performActionLocked(perform, true), false);
  // an editor who is no admin: not a new perform_action, and an existing one is read only
  assert.equal(actionTypeChoosable("perform_action", null, false), false);
  assert.equal(actionTypeChoosable("perform_action", { action: "toggle" }, false), false);
  assert.equal(actionTypeChoosable("perform_action", perform, false), true, "the one that is there stays selectable");
  assert.equal(actionTypeChoosable("toggle", perform, false), true, "replacing it is allowed");
  assert.equal(performActionLocked(perform, false), true);
  assert.equal(performActionLocked({ action: "navigate", target: "/x" }, false), false);
  assert.equal(performActionLocked(null, false), false);
});
