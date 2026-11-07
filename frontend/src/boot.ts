// home-3d.js, the start file (#357, see boot-core.ts): imports the current build's app. The import is awaited, so a
// dashboard or the panel that waits for this module waits for the app's elements as before. Every copy on the page
// shares one import of one app URL (#361), and a failed one is tried again under a URL the browser has not failed on (#360).

import { bootBase, loadApp } from "./boot-core.ts";

await loadApp(bootBase(import.meta.url), (url) => import(url));
