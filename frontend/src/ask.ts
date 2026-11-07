// The app's own ask / confirm / message dialog (#59), in place of the browser's prompt(), confirm() and alert():
// those are unthemed, kiosk browsers can block them, and a blocked confirm() once made a restore silently do nothing.
//
// One dialog per page: the main bundle and the lazy bundles (editor, items) each carry a copy of this module, so the
// host that shows the dialog is kept on globalThis and every copy asks through the same one. The dialog element
// (components/ask-dialog.ts) registers the host; this file has no DOM and no texts of its own (the items bundle has
// no room for i18n.ts), so callers hand in their button labels.

/** One question. `cancel` missing = a message with only the OK button; `input` set = a text field with that value. */
export interface AskRequest {
  text: string;
  ok: string;
  cancel?: string;
  input?: string;
  /** A long text under the question (a brief to read or copy, #84): shown read-only, scrolling, selectable. */
  detail?: string;
  /** The OK button deletes or overwrites something: drawn as a warning. */
  danger?: boolean;
  /**
   * A typed confirmation (#330): OK stays disabled until this says the text matches. A wrong answer (Enter, or leaving
   * the field) keeps the dialog open and shows `mismatch` under the field for a few seconds.
   */
  matches?: (typed: string) => boolean;
  /** The error shown under the field when the text does not match. */
  mismatch?: string;
}

export interface AskAnswer {
  ok: boolean;
  /** What the text field held (empty without one). */
  value: string;
}

export interface AskHost {
  ask(req: AskRequest): Promise<AskAnswer>;
}

/** The questions waiting for the dialog: one shown, the rest in order behind it. */
export class AskQueue {
  private waiting: { req: AskRequest; resolve: (a: AskAnswer) => void }[] = [];
  /** Called whenever the shown question changes (the dialog re-renders). */
  onChange: (() => void) | null = null;

  get current(): AskRequest | null {
    return this.waiting[0]?.req ?? null;
  }

  ask(req: AskRequest): Promise<AskAnswer> {
    return new Promise((resolve) => {
      this.waiting.push({ req, resolve });
      if (this.waiting.length === 1) this.onChange?.();
    });
  }

  /** Answers the shown question and shows the next one. */
  answer(ok: boolean, value = ""): void {
    const open = this.waiting.shift();
    if (!open) return;
    open.resolve({ ok, value });
    this.onChange?.();
  }
}

type AskGlobal = { __fp3dAskHost?: AskHost | null; __fp3dAskFactory?: () => AskHost | null };
const g = globalThis as AskGlobal;

/** Sets the host every question goes to (tests; the dialog element registers a factory instead). */
export function setAskHost(host: AskHost | null): void {
  g.__fp3dAskHost = host;
}

/** The dialog element's module calls this once; the first question creates the dialog. */
export function registerAskFactory(factory: () => AskHost | null): void {
  if (!g.__fp3dAskFactory) g.__fp3dAskFactory = factory;
}

function host(): AskHost | null {
  return g.__fp3dAskHost ?? g.__fp3dAskFactory?.() ?? null;
}

const NO: AskAnswer = { ok: false, value: "" };

function send(req: AskRequest): Promise<AskAnswer> {
  const h = host();
  return h ? h.ask(req) : Promise.resolve(NO);
}

/** A yes / no question; true for yes. */
export async function askConfirm(text: string, labels: { ok: string; cancel: string; danger?: boolean }): Promise<boolean> {
  return (await send({ text, ...labels })).ok;
}

/** Asks for a text (a name); the trimmed text, or null when cancelled or left empty. */
export async function askText(text: string, value: string, labels: { ok: string; cancel: string; danger?: boolean }): Promise<string | null> {
  const a = await send({ text, input: value, ...labels });
  const typed = a.value.trim();
  return a.ok && typed ? typed : null;
}

/**
 * A typed confirmation (delete a home: type its name): true only when the typed text matches. The dialog stays open
 * with an error under the field and a disabled OK until it does, so a wrong answer never closes it (#330).
 */
export async function askTyped(text: string, labels: { ok: string; cancel: string; matches: (typed: string) => boolean; mismatch: string; danger?: boolean }): Promise<boolean> {
  const a = await send({ text, input: "", ...labels });
  return a.ok && labels.matches(a.value);
}

/** A message with only an OK button; resolves once it is closed. */
export async function tell(text: string, labels: { ok: string }): Promise<void> {
  await send({ text, ok: labels.ok });
}

/** A long text to read (and select) under a short line; true when the action button (`ok`, e.g. Copy) was pressed. */
export async function showText(text: string, detail: string, labels: { ok: string; cancel: string }): Promise<boolean> {
  return (await send({ text, detail, ...labels })).ok;
}
