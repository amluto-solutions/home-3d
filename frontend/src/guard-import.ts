// A dynamic import that fails (a chunk an update removed) is handed to the guard the main bundle installs
// (chunk-reload.ts), which reloads the page once (#340). Kept tiny and free of imports: every lazy bundle includes it.

export const IMPORT_FAILED = "__fp3dImportFailed";

/** Passes a dynamic import through; a failure goes to the guard (if the main bundle installed one) and still reaches the caller. */
export function guardImport<T>(loading: Promise<T>): Promise<T> {
  return loading.catch((err: unknown) => {
    (globalThis as { [IMPORT_FAILED]?: (e: unknown) => void })[IMPORT_FAILED]?.(err);
    throw err;
  });
}
