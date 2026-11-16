// The neighbourhood's map loading (#462): its bundle (home-3d-osm.js, surround-fetch.ts) loads only when an admin
// taps Load surroundings or Align again; nothing of it is on any page before that.

import { lazyBundle } from "./lazy-bundle.ts";
import type * as OsmBundle from "./surround-fetch.ts";

/** Content hash of the map bundle, set by the build in the bundles that load it (see build.mjs). */
declare const __FP3D_OSM_HASH__: string;

export const loadOsm = lazyBundle<typeof OsmBundle>("home-3d-osm", () => __FP3D_OSM_HASH__);
