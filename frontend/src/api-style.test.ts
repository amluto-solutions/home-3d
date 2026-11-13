import assert from "node:assert/strict";
import { test } from "node:test";
import { subscribeAsk } from "./api.ts";
import type { HomeAssistant } from "./types.ts";

type Handler = (ev: unknown) => void;
const fake = (reject: (msg: Record<string, unknown>) => boolean = () => false) => {
  const sent: Record<string, unknown>[] = [];
  let handler: Handler = () => {};
  const hass = {
    connection: {
      subscribeMessage: async (cb: Handler, msg: Record<string, unknown>) => {
        sent.push(msg);
        if (reject(msg)) throw new Error("extra keys not allowed");
        handler = cb;
        return async () => {};
      },
    },
  } as unknown as HomeAssistant;
  return { hass, sent, emit: (ev: unknown) => handler(ev) };
};

test("a view that wants styles says so; a style event goes to its handler and never counts as a sentence", async () => {
  const f = fake();
  const asks: string[] = [];
  const styles: string[] = [];
  await subscribeAsk(f.hass, "Hall", (a) => asks.push(a.text), (s) => styles.push(s.style));
  assert.equal(f.sent[0]!.style, true);
  f.emit({ style: { id: "a", style: "cozy", screens: [], minutes: 5 } });
  f.emit({ ask_id: "x", text: "Show the kitchen", screen: null, speak: false });
  assert.deepEqual(styles, ["cozy"]);
  assert.deepEqual(asks, ["Show the kitchen"]);
});

test("a view without a style handler sends no flag and drops a style event", async () => {
  const f = fake();
  const asks: string[] = [];
  await subscribeAsk(f.hass, "", (a) => asks.push(a.text));
  assert.equal("style" in f.sent[0]!, false);
  f.emit({ style: { id: "a", style: "cozy", screens: [] } });
  assert.deepEqual(asks, []);
});

test("a backend that does not know the flag: the view subscribes again without it and still gets sentences", async () => {
  const f = fake((m) => m.style === true);
  const asks: string[] = [];
  await subscribeAsk(f.hass, "", (a) => asks.push(a.text), () => {});
  assert.equal(f.sent.length, 2);
  assert.equal("style" in f.sent[1]!, false);
  f.emit({ ask_id: "x", text: "hello", screen: null, speak: false });
  assert.deepEqual(asks, ["hello"]);
});
