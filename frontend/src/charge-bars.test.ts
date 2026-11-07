import assert from "node:assert/strict";
import { test } from "node:test";
import { chargeBars } from "./charge-bars.ts";

const show = (soc: number) => chargeBars(soc).map((b) => (b ? b[0] : "-")).join("");

test("charge bars follow the table (#282)", () => {
  const rows: [number, string][] = [[0, "r---"], [10, "r---"], [11, "o---"], [20, "o---"], [21, "g---"], [25, "g---"], [26, "go--"], [40, "go--"], [41, "gg--"], [50, "gg--"], [51, "ggo-"], [65, "ggo-"], [66, "ggg-"], [75, "ggg-"], [76, "gggo"], [90, "gggo"], [91, "gggg"], [100, "gggg"], [140, "gggg"], [-5, "r---"]];
  for (const [soc, want] of rows) assert.equal(show(soc), want, `${soc} %`);
});
