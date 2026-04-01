/**
 * Simple caching layer for public, read-heavy endpoints.
 *
 * Uses Redis when REDIS_URL is configured (shared across instances),
 * falls back to an in-memory Map otherwise.
 *
 * Default TTL: 5 minutes — location data rarely changes.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── In-memory fallback ───────────────────────────────────────────────────

const memoryStore = new Map<string, { data: string; expiresAt: number }>();

function memGet(key: string): string | null {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.data;
}

function memSet(key: string, data: string, ttlMs: number): void {
  memoryStore.set(key, { data, expiresAt: Date.now() + ttlMs });
  // Lazy eviction: prune expired entries when map grows large
  if (memoryStore.size > 200) {
    const now = Date.now();
    for (const [k, v] of memoryStore) {
      if (v.expiresAt <= now) memoryStore.delete(k);
    }
  }
}

// ─── Redis client (lazy-initialized, optional) ───────────────────────────

let redisClient: { get: (key: string) => Promise<string | null>; setex: (key: string, seconds: number, value: string) => Promise<unknown> } | null = null;
let redisInitialized = false;

async function getRedis() {
  if (redisInitialized) return redisClient;
  redisInitialized = true;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    // @ts-expect-error — ioredis is an optional production dependency (not in devDependencies)
    const { default: Redis } = await import('ioredis');
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: 5000,
      keyPrefix: 'cache:',
      retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });

    await client.connect();
    client.on('error', (err: Error) => {
      console.warn('[cache] Redis error:', err.message);
    });

    redisClient = client;
    console.log('[cache] Connected to Redis for endpoint caching');
    return redisClient;
  } catch (err) {
    console.warn('[cache] Redis unavailable for caching, using in-memory:', (err as Error).message);
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Get a cached value, or compute + store it if missing.
 *
 * @param key   Cache key (e.g. "locations:all", "locations:countries")
 * @param fn    Async function that produces the value to cache
 * @param ttlMs Cache TTL in milliseconds (default: 5 minutes)
 */
export async function cached<T>(key: string, fn: () => Promise<T>, ttlMs: number = DEFAULT_TTL_MS): Promise<T> {
  const redis = await getRedis();
  const ttlSec = Math.ceil(ttlMs / 1000);

  // Try Redis first
  if (redis) {
    try {
      const hit = await redis.get(key);
      if (hit) return JSON.parse(hit) as T;
    } catch {
      // Redis read failed — fall through to compute
    }
  } else {
    // Try in-memory
    const hit = memGet(key);
    if (hit) return JSON.parse(hit) as T;
  }

  // Cache miss — compute the value
  const value = await fn();
  const serialized = JSON.stringify(value);

  // Store in cache (fire-and-forget, don't block the response)
  if (redis) {
    redis.setex(key, ttlSec, serialized).catch(() => {});
  } else {
    memSet(key, serialized, ttlMs);
  }

  return value;
}
