import fs from 'node:fs';
import { sleep } from './http.js';

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// ホストごとに最終アクセス時刻を持ち、同一サイトへの連続アクセスを間隔で守る
const lastByHost = new Map();

/**
 * 公式APIが無いサイト用の取得関数。
 * minIntervalMs は robots.txt の Crawl-delay があればそれを最低値にすること。
 */
export async function fetchHtml(url, { minIntervalMs = 10_000, timeoutMs = 25_000 } = {}) {
  const host = new URL(url).host;
  const wait = (lastByHost.get(host) ?? 0) + minIntervalMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastByHost.set(host, Date.now());

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept-Language': 'ja,en;q=0.8', Accept: 'text/html' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export function decodeEntities(s = '') {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&yen;/g, '¥')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

export function stripTags(s = '') {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** 「￥1,250 ～ ￥4,450」「3,000円」などから最初の金額を数値で取る */
export function parsePrice(s = '') {
  const m = stripTags(s).match(/(\d{1,3}(?:,\d{3})+|\d{3,})/);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
}

let cachedConfig;
/** config/watch.json の scrapers.enabled に載っているスクレイパだけ動かす */
export function scraperEnabled(id) {
  if (!cachedConfig) cachedConfig = JSON.parse(fs.readFileSync('config/watch.json', 'utf8'));
  return (cachedConfig.scrapers?.enabled ?? []).includes(id);
}
