const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let lastCallAt = 0;

/** 外部APIに優しくする: 直列＋最低間隔＋指数バックオフ */
export async function getJson(url, { minIntervalMs = 1100, retries = 3, timeoutMs = 15000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const wait = Math.max(0, lastCallAt + minIntervalMs - Date.now());
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        headers: { 'User-Agent': 'rare-item-radar/1.0 (+https://github.com/)' },
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        // 400番台は再試行しても無駄なので本文つきで即座に投げる
        const body = await res.text().catch(() => '');
        const err = new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
        err.fatal = true;
        throw err;
      }
      return await res.json();
    } catch (err) {
      if (err.fatal || attempt === retries) throw err;
      await sleep(1000 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
}

export { sleep };
