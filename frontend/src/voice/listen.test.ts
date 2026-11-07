import assert from "node:assert/strict";
import { test } from "node:test";
import { speak } from "./listen.ts";

test("speak() lets go of its subscription when the run ended before the subscription was confirmed (#200)", async () => {
  let unsubscribed = 0;
  const hass = {
    callWS: async () => ({ pipelines: [{ id: "p", tts_engine: "tts.x" }], preferred_pipeline: "p" }),
    connection: {
      // the run's end arrives before the answer to the subscription
      subscribeMessage: (cb: (ev: { type: string }) => void) => {
        cb({ type: "run-end" });
        return Promise.resolve(async () => void unsubscribed++);
      },
    },
  };
  assert.equal(await speak(hass as never, "hello"), false);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(unsubscribed, 1);
});
