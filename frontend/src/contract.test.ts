import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { PROTOCOL } from "./api.ts";
import { PLAN_VERSION } from "./model.ts";
import { PLAN_CONTRACT } from "./plan-contract.fixture.ts";

// The shared contract with the backend (#166). Two files in tests/fixtures/contract, each written by one side and
// checked by the other:
// - plan.json: written from plan-contract.fixture.ts (a plan with every field model.ts has); tests/test_contract.py
//   checks it against schema.py both ways
// - websocket.json: written by tests/test_contract.py from the registered commands; checked here against every
//   command this frontend sends
// UPDATE_CONTRACT=1 rewrites plan.json (and, in pytest, websocket.json) instead of comparing.

const CONTRACT = new URL("../../tests/fixtures/contract/", import.meta.url);
const SRC = new URL("./", import.meta.url);

interface Command {
  required: string[];
  optional: string[];
}
interface WebsocketContract {
  protocol: number;
  plan_version: number;
  commands: Record<string, Command>;
}

const websocket = JSON.parse(readFileSync(new URL("websocket.json", CONTRACT), "utf8")) as WebsocketContract;

test("plan.json is the plan contract fixture as it is now (#166)", () => {
  const file = new URL("plan.json", CONTRACT);
  const text = `${JSON.stringify(PLAN_CONTRACT, null, 2)}\n`;
  if (process.env.UPDATE_CONTRACT) writeFileSync(file, text);
  assert.ok(existsSync(file), "tests/fixtures/contract/plan.json is missing: UPDATE_CONTRACT=1 node --test src/contract.test.ts");
  assert.equal(readFileSync(file, "utf8").replace(/\r\n/g, "\n"), text, "plan.json is out of date: UPDATE_CONTRACT=1 node --test src/contract.test.ts");
});

test("the plan version and the protocol are the backend's (#165, #166)", () => {
  assert.equal(PLAN_CONTRACT.version, PLAN_VERSION);
  assert.equal(websocket.plan_version, PLAN_VERSION, "const.PLAN_VERSION and model.ts PLAN_VERSION differ");
  assert.equal(websocket.protocol, PROTOCOL, "const.PROTOCOL and api.ts PROTOCOL differ");
});

// ---------------------------------------------------------------------------- the messages this frontend sends

/** Every source file of the frontend (no tests, no fixtures). */
function sources(dir: URL = SRC): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) out.push(...sources(new URL(`${entry.name}/`, dir)));
    else if (entry.name.endsWith(".ts") && !/\.(test|fixture)\.ts$/.test(entry.name)) {
      const url = new URL(entry.name, dir);
      out.push({ path: url.pathname.slice(SRC.pathname.length), text: readFileSync(url, "utf8") });
    }
  }
  return out;
}

const OPEN = "([{";
const CLOSE = ")]}";

/** The end of the bracket opened at `start` (strings, template literals and comments skipped). */
function closing(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === "\\") i++;
    } else if (c === "/" && text[i + 1] === "/") {
      i = text.indexOf("\n", i);
    } else if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c) && --depth === 0) return i;
  }
  return -1;
}

/** The brace that opens the object literal holding position `at`. */
function opening(text: string, at: number): number {
  let depth = 0;
  for (let i = at - 1; i >= 0; i--) {
    const c = text[i];
    if (CLOSE.includes(c)) depth++;
    else if (OPEN.includes(c)) {
      if (depth === 0) return c === "{" ? i : -1;
      depth--;
    }
  }
  return -1;
}

/** The top-level entries of an object literal's body, split at commas. */
function entries(body: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < body.length && body[i] !== c; i++) if (body[i] === "\\") i++;
    } else if (OPEN.includes(c)) i = closing(body, i);
    else if (c === ",") {
      out.push(body.slice(from, i));
      from = i + 1;
    }
  }
  out.push(body.slice(from));
  return out.map((e) => e.trim()).filter(Boolean);
}

/** The keys of every object literal in `text` (the entries of a spread such as `...(x ? { a: x } : {})`). */
function literalKeys(text: string): string[] {
  const keys: string[] = [];
  for (let i = text.indexOf("{"); i >= 0; i = text.indexOf("{", i + 1)) {
    const end = closing(text, i);
    if (end < 0) break;
    for (const entry of entries(text.slice(i + 1, end))) {
      const key = /^["']?([A-Za-z_$][\w$]*)["']?\s*(:|$)/.exec(entry)?.[1];
      if (key) keys.push(key);
    }
    i = end;
  }
  return keys;
}

interface Message {
  path: string;
  type: string;
  keys: string[];
  /** A spread whose keys cannot be read here (a variable): required fields are not checked. */
  open: boolean;
}

/** Every websocket message literal (`{ type: "home_3d/…", … }`) in the frontend's sources. */
function messages(): Message[] {
  const found: Message[] = [];
  for (const { path, text } of sources()) {
    for (const m of text.matchAll(/\btype:\s*"(home_3d\/[^"]+)"/g)) {
      const start = opening(text, m.index);
      assert.ok(start >= 0, `${path}: ${m[1]} is not in an object literal`);
      const keys: string[] = [];
      let open = false;
      for (const entry of entries(text.slice(start + 1, closing(text, start)))) {
        if (entry.startsWith("...")) {
          const expr = entry.slice(3).trim();
          // a helper of the same file (api.ts `at(home)`): the object literals it returns
          const helper = /^([A-Za-z_$][\w$]*)\(/.exec(expr)?.[1];
          const source = helper ? (new RegExp(`(?:const|function)\\s+${helper}\\b[^\\n]*`).exec(text)?.[0] ?? "") : expr;
          const spread = literalKeys(source);
          if (!spread.length && !/\{\s*\}/.test(source)) open = true;
          keys.push(...spread);
        } else {
          const key = /^["']?([A-Za-z_$][\w$]*)["']?\s*(:|$)/.exec(entry)?.[1];
          assert.ok(key, `${path}: cannot read the entry "${entry}" of ${m[1]}`);
          if (key !== "type") keys.push(key);
        }
      }
      found.push({ path, type: m[1], keys: [...new Set(keys)], open });
    }
  }
  return found;
}

test("every websocket command this frontend names is one the backend has (#166)", () => {
  const names = sources().flatMap(({ path, text }) => [...text.matchAll(/"(home_3d\/[a-z_/]+)"/g)].map((m) => ({ path, name: m[1] })));
  assert.ok(names.length > 40, "the sources were found");
  const unknown = names.filter(({ name }) => !(name in websocket.commands)).map(({ path, name }) => `${path}: ${name}`);
  assert.deepEqual(unknown, []);
});

test("every message this frontend sends has only fields its command takes, and the required ones (#166)", () => {
  const sent = messages();
  assert.ok(sent.length > 40, "the messages were found");
  const problems: string[] = [];
  for (const { path, type, keys, open } of sent) {
    const command = websocket.commands[type];
    if (!command) continue;
    const known = new Set([...command.required, ...command.optional]);
    for (const key of keys) if (!known.has(key)) problems.push(`${path}: ${type} has no field "${key}"`);
    if (!open) for (const key of command.required) if (!keys.includes(key)) problems.push(`${path}: ${type} needs "${key}"`);
  }
  assert.deepEqual(problems, []);
});

test("the message reader sees spreads, helpers and shorthand fields", () => {
  const keys = messages().find((m) => m.path === "api.ts" && m.type === "home_3d/building/save")?.keys ?? [];
  assert.deepEqual([...keys].sort(), ["base_revision", "building", "home_id", "recipe_bases"]);
});
