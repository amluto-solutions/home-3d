/** Stored images used as screen pictures, as data URLs: bounded, and a failed lookup is tried again later (#384). */
export class PictureCache {
  private readonly map = new Map<string, { url: string | null; at: number }>();

  private readonly max: number;
  private readonly retryMs: number;
  private readonly now: () => number;

  constructor(max = 24, retryMs = 60_000, now: () => number = Date.now) {
    this.max = max;
    this.retryMs = retryMs;
    this.now = now;
  }

  /** The cached url (null while loading or after a failure); `fetch` is true when a lookup should start now. */
  get(key: string): { url: string | null; fetch: boolean } {
    const hit = this.map.get(key);
    if (!hit) return { url: null, fetch: true };
    // a failed or missing lookup is tried again after a while
    if (hit.url === null && this.now() - hit.at >= this.retryMs) return { url: null, fetch: true };
    return { url: hit.url, fetch: false };
  }

  /** A lookup started (null) or ended (the url, or null when it failed). The oldest entries go beyond the bound. */
  set(key: string, url: string | null): void {
    this.map.delete(key);
    this.map.set(key, { url, at: this.now() });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
