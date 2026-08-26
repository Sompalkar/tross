/**
 * Tiny in-memory TTL cache. Keeps repeated lookups of the same profile from
 * hitting LinkedIn again, which is both faster and much safer for the account.
 * Swap for Redis if you ever run more than one instance.
 */
type Entry<T> = { value: T; expiresAt: number };

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(private readonly ttlSeconds: number) {}

  get(key: string): T | undefined {
    if (this.ttlSeconds <= 0) return undefined;
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.ttlSeconds <= 0) return;
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlSeconds * 1000 });
  }

  clear(): void {
    this.store.clear();
  }
}
