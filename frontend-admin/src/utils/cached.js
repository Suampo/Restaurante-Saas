// src/utils/cached.js  (puedes reemplazar tu archivo si quieres)
const _cache = new Map();           // key -> { ts, data }
const _inflight = new Map();        // key -> Promise

export async function withCache(key, ttlMs, fetcher) {
  const now = Date.now();
  const hit = _cache.get(key);
  if (hit && now - hit.ts < ttlMs) return hit.data;

  if (_inflight.has(key)) return _inflight.get(key);

  const p = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      _cache.set(key, { ts: Date.now(), data });
      _inflight.delete(key);
      return data;
    })
    .catch((err) => {
      _inflight.delete(key);
      throw err;
    });

  _inflight.set(key, p);
  return p;
}

export function clearCache(key) {
  if (key) _cache.delete(key);
  else _cache.clear();
}
