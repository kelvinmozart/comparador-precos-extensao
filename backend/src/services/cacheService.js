const entries = new Map();

const stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  expired: 0,
};

function now() {
  return Date.now();
}

function isExpired(entry, currentTime = now()) {
  return Number.isFinite(entry?.expiresAt) && entry.expiresAt <= currentTime;
}

function get(key) {
  const entry = entries.get(key);

  if (!entry) {
    stats.misses += 1;
    return null;
  }

  if (isExpired(entry)) {
    entries.delete(key);
    stats.expired += 1;
    stats.misses += 1;
    return null;
  }

  stats.hits += 1;
  return entry.value;
}

function set(key, value, ttlMs) {
  const normalizedTtlMs = Number(ttlMs);

  if (!key || !Number.isFinite(normalizedTtlMs) || normalizedTtlMs <= 0) {
    return false;
  }

  entries.set(key, {
    value,
    createdAt: now(),
    expiresAt: now() + normalizedTtlMs,
    ttlMs: normalizedTtlMs,
  });
  stats.sets += 1;
  return true;
}

function clear() {
  entries.clear();
  stats.hits = 0;
  stats.misses = 0;
  stats.sets = 0;
  stats.expired = 0;
}

function getStats() {
  const currentTime = now();
  let activeEntries = 0;
  let expiredEntries = 0;

  for (const entry of entries.values()) {
    if (isExpired(entry, currentTime)) {
      expiredEntries += 1;
    } else {
      activeEntries += 1;
    }
  }

  return {
    ...stats,
    entries: entries.size,
    activeEntries,
    expiredEntries,
  };
}

module.exports = {
  clear,
  get,
  getStats,
  set,
};
