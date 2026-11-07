// The align tools' bundle (#235): loaded when a second item is selected, registers <fp3d-align>.

import { defineElement } from "../define.ts";
import { AlignTools } from "./tools.ts";

defineElement("fp3d-align", AlignTools);

export { arrange, needs, type AlignOp } from "./arrange.ts";
