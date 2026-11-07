// Writes the bundled empty racks (#112) into the IT & network pack from the catalogue in
// frontend/src/rack-catalogue.ts: `node tools/rack-frames.ts` (Node 24 runs TypeScript as it is). A frontend test
// (rack-catalogue.test.ts) fails while a file differs from what this writes.

import { writeFileSync } from "node:fs";
import { RACKS, rackItem, rackItemFile } from "../frontend/src/rack-catalogue.ts";

const NETWORK = new URL("../custom_components/home_3d/bundled_packs/amluto.it/network/", import.meta.url);

for (const entry of RACKS) {
  writeFileSync(new URL(`${entry.id}.json`, NETWORK), rackItemFile(rackItem(entry)));
  console.log(`network/${entry.id}.json`);
}
