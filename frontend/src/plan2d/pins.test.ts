import assert from "node:assert/strict";
import { test } from "node:test";
import { pinIn2d } from "./pins.ts";

test("in 2D lights and cameras keep their marker: no lamp or camera model stands for them there", () => {
  const lamp = { id: "light.hall", lamp: "ceiling" as const };
  const cam = { id: "camera.drive", model: "camera_wall" as const };
  // the 3D view leaves their pins out (its models show them) …
  assert.equal(pinIn2d(lamp, "important", false), true);
  assert.equal(pinIn2d(cam, "important", false), true);
  // … a pin the 3D view shows stays, whatever it is
  assert.equal(pinIn2d({ id: "sensor.temp" }, "important", true), true);
  // a lamp item too: a lamp seen from above is a few centimetres, its pin is what a finger finds on a wall tablet
  assert.equal(pinIn2d({ ...lamp, furnitureId: "floor_lamp" }, "important", false), true);
  // other items show their state on the item itself (a TV playing)
  assert.equal(pinIn2d({ id: "media_player.tv", furnitureId: "tv" }, "important", false), false);
});

test("in 2D markers switched off stay off", () => {
  const lamp = { id: "light.hall", lamp: "ceiling" as const };
  assert.equal(pinIn2d({ ...lamp, show: "never" as const }, "important", false), false);
  assert.equal(pinIn2d(lamp, "none", false), false);
  // symbols only in an open room: as in 3D
  assert.equal(pinIn2d(lamp, "room", false), false);
});
