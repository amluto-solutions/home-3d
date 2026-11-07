import { noChange } from "lit";
import { Directive, directive, PartType, type PartInfo, type PropertyPart } from "lit/directive.js";
import type { TypedCommit } from "../typed-commit.ts";

/**
 * `.value=${typedValue(typed, text)}` on a number or length box (#69): the box shows the plan's value, except while
 * the user is typing in it (a value saved after a pause must not rewrite the text under the cursor). Unlike a plain
 * `.value` binding it also puts the plan's value back after Enter or leaving the box, when the saved value reads
 * differently (-90° shows as 270°, rubbish typed shows the old value again).
 */
class TypedValue extends Directive {
  constructor(info: PartInfo) {
    super(info);
    if (info.type !== PartType.PROPERTY) throw new Error("typedValue() belongs on .value");
  }

  render(_typed: TypedCommit, text: string): string {
    return text;
  }

  update(part: PropertyPart, [typed, text]: [TypedCommit, string]): typeof noChange {
    const box = part.element as HTMLInputElement;
    if (!typed.typing(box) && box.value !== text) box.value = text;
    return noChange;
  }
}

export const typedValue = directive(TypedValue);
