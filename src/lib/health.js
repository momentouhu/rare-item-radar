import { readJson, writeJson } from './store.js';

/**
 * スクレイパはサイト側の改修で黙って0件になる。
 * ソースごとに「連続で0件」「直近エラー」を記録し、サイトと実行ログで気づけるようにする。
 */
const FILE = 'source-health.json';
export const WARN_AFTER = 3;

export function recordHealth(sourceId, { count, error }) {
  const all = readJson(FILE, {});
  const h = all[sourceId] ?? { consecutiveEmpty: 0, lastOkAt: null, lastError: null, lastRunAt: null };
  h.lastRunAt = new Date().toISOString();
  if (error) {
    h.lastError = String(error).slice(0, 200);
  } else if (count > 0) {
    h.consecutiveEmpty = 0;
    h.lastOkAt = h.lastRunAt;
    h.lastError = null;
  } else {
    h.consecutiveEmpty += 1;
  }
  all[sourceId] = h;
  writeJson(FILE, all);
  return h;
}

export function unhealthySources(labels = {}) {
  const all = readJson(FILE, {});
  return Object.entries(all)
    .filter(([, h]) => h.consecutiveEmpty >= WARN_AFTER || h.lastError)
    .map(([id, h]) => ({ id, label: labels[id] ?? id, ...h }));
}
