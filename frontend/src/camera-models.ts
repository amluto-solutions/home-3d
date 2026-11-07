// Camera models (#9): a placed camera can wear the real shape of the camera (a pack item tagged "security camera",
// such as the core pack's UniFi cameras), chosen by hand or found from the model Home Assistant's device registry
// reports. The shape is only its look (#779): the pin keeps the live view, the aim and the actions.

import { uid, type Floor, type Furniture } from "./model.ts";
import { furnitureSize, packInfo, packType, type FurniturePack, type PackItemInfo } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";

/** The tag that makes a pack item a camera model. */
export const CAMERA_TAG = "security camera";

/** Whether a pack item is the shape of a camera. */
export function isCameraModel(item: Pick<PackItemInfo, "tags">): boolean {
  return !!item.tags?.includes(CAMERA_TAG);
}

/** A model name in one form: lower case, single spaces, without UniFi's "UVC" prefix ("UVC G4 Pro" → "g4 pro"). */
function plain(model: string): string {
  return model.toLowerCase().replace(/\s+/g, " ").trim().replace(/^uvc /, "");
}

/**
 * The camera model (pack type) a device's model names: the camera item with that model among its tags, or with the
 * longest tag the model starts with ("G5 Turret Ultra" → the item tagged "g5 turret"). Only tags with a number count
 * as a model name, and so do those of UniFi's AI line ("ai pro"). Null: no camera item knows it.
 */
export function matchCameraModel(model: string | null | undefined, packs: readonly FurniturePack[]): string | null {
  const want = plain(model ?? "");
  if (!want) return null;
  let best: { type: string; len: number } | null = null;
  for (const pack of packs) {
    for (const item of pack.items) {
      if (!isCameraModel(item)) continue;
      for (const tag of item.tags ?? []) {
        const t = plain(tag);
        // a model has a number in it ("g4 pro", "ai 360") or is one of UniFi's AI line ("ai pro", "ai dslr"): the words
        // every camera carries ("camera", "unifi") are none
        if (!(/\d/.test(t) || /^ai \S/.test(t)) || !(want === t || want.startsWith(`${t} `))) continue;
        if (!best || t.length > best.len) best = { type: packType(pack.id, item.id), len: t.length };
      }
    }
  }
  return best?.type ?? null;
}

/** The camera model of a camera entity's device, by the model the device registry reports (null: none known). */
export function detectCameraModel(hass: HomeAssistant, cameraId: string, packs: readonly FurniturePack[]): string | null {
  const device = hass.entities?.[cameraId]?.device_id;
  return device ? matchCameraModel(hass.devices?.[device]?.model, packs) : null;
}

/**
 * Give a placed camera a look (a pack type), or back the built-in one (null). One look per camera: a new one replaces
 * the last. The pin keeps everything set there (field of view, aim, actions); with a camera model it takes the
 * model's mount, so the camera looks down like the model: a dome or turret hangs from the ceiling, the others sit on
 * a wall with the pin in the middle of the model.
 */
export function setCameraLook(floor: Floor, entityId: string, type: string | null): void {
  const pl = floor.placements.find((p) => p.entity_id === entityId);
  floor.furniture = floor.furniture.filter((m) => m.look_of !== entityId);
  if (!pl || !type) return;
  const [w, d, h] = furnitureSize(type);
  const item = packInfo(type);
  const look: Furniture = {
    id: uid("furniture"),
    type,
    x: pl.x,
    z: pl.z,
    rotation: pl.rotation ?? 0,
    w,
    d,
    h,
    variant: null,
    entity: "none",
    look_of: entityId,
    name: pl.name ?? null,
    ...(pl.locked ? { locked: true } : {}),
  };
  floor.furniture.push(look);
  // any other item as its look (a plant pot hiding it) leaves the pin where it was set
  if (!item || !isCameraModel(item)) return;
  const ceiling = item.mount === "ceiling";
  // the shape is only looks: the camera keeps the angle, reach and tilt it had, though their defaults go by the mount
  if (ceiling !== (pl.mount === "ceiling")) {
    const was = pl.mount === "ceiling";
    pl.fov ??= was ? 360 : 90;
    pl.reach ??= was ? 3 : 4.5;
    pl.tilt ??= was ? 65 : 20;
  }
  if (ceiling) {
    pl.mount = "ceiling";
    pl.y = null;
  } else {
    pl.mount = "wall";
    pl.y = Math.round(((item.wall_y ?? 1) + h / 2) * 1000) / 1000;
  }
}
