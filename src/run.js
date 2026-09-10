import fs from 'node:fs';
import { SOURCES } from './sources/index.js';
import { readJson, writeJson, pruneSeen } from './lib/store.js';
import { detectEvents, applyFilters, dedupe } from './lib/detect.js';
import { composePost } from './lib/compose.js';
import { recordHealth, unhealthySources, WARN_AFTER } from './lib/health.js';

const config = JSON.parse(fs.readFileSync('config/watch.json', 'utf8'));

const seen = readJson('seen.json', {});
const firstRun = Object.keys(seen).length === 0;

const feed = readJson('feed.json', { updatedAt: null, events: [] });
const queue = readJson('queue.json', { items: [] });

if (firstRun) {
  console.log('■ 初回クロール: 今回はスナップショットを作るだけで、投稿イベントは出しません');
}

const activeSources = Object.values(SOURCES).filter((s) => s.enabled());
if (activeSources.length === 0) {
  console.error('有効なデータソースがありません。RAKUTEN_APP_ID などを設定してください。');
  process.exit(1);
}
console.log(`■ 有効なソース: ${activeSources.map((s) => s.label).join(', ')}`);

const allEvents = [];
// ソースごとの取得件数とエラーを実行全体で合算する（監視ごとに記録すると最後の監視で上書きされてしまう）
const healthAcc = {};

for (const watch of config.watches) {
  const collected = [];

  for (const sourceId of watch.sources) {
    const source = SOURCES[sourceId];
    if (!source) {
      console.warn(`  ? 未知のソース: ${sourceId}`);
      continue;
    }
    if (!source.enabled()) continue;

    let hits = 0;
    let lastError = null;
    for (const keyword of watch.keywords) {
      try {
        const results = await source.search(keyword, watch.filters);
        collected.push(...results);
        hits += results.length;
        console.log(`  ${source.label} / "${keyword}" → ${results.length}件`);
      } catch (err) {
        // 1ソースの失敗で全体を落とさない
        lastError = err.message;
        console.warn(`  ! ${source.label} / "${keyword}" 失敗: ${err.message}`);
      }
    }
    const acc = (healthAcc[sourceId] ??= { count: 0, error: null });
    acc.count += hits;
    if (lastError) acc.error = lastError;
  }

  const cleaned = dedupe(applyFilters(collected, watch.filters));
  const events = detectEvents(cleaned, seen, { ...config.detect, firstRun });

  for (const ev of events) {
    ev.watchId = watch.id;
    ev.watchLabel = watch.label;
    ev.detectedAt = new Date().toISOString();
    ev.post = composePost(ev, watch, config.site);
  }

  console.log(`【${watch.label}】 取得 ${collected.length} → 精査 ${cleaned.length} → イベント ${events.length}`);
  allEvents.push(...events);
}

// 1回の実行で投稿が溢れないよう、スコア順に上限で切る
allEvents.sort((a, b) => b.score - a.score);
const capped = allEvents.slice(0, config.detect.maxEventsPerRun ?? 40);
if (allEvents.length > capped.length) {
  console.log(`■ イベント ${allEvents.length}件のうち上位 ${capped.length}件のみ採用（maxEventsPerRun）`);
}

feed.events = [...capped, ...feed.events].slice(0, 300);
feed.updatedAt = new Date().toISOString();

const fresh = [
  ...capped.map((ev) => ({
    id: `${ev.item.id}:${ev.type}`,
    detectedAt: ev.detectedAt,
    watchLabel: ev.watchLabel,
    label: ev.label,
    emoji: ev.emoji,
    title: ev.item.title,
    url: ev.item.url,
    image: ev.item.image,
    price: ev.item.price,
    sourceLabel: ev.item.sourceLabel,
    textWithLink: ev.post.textWithLink,
    textNoLink: ev.post.textNoLink,
    posted: {},
  })),
];

// 同じイベントを再検知しても重複させない（既存の配信済みフラグを優先して残す）
const byId = new Map(queue.items.map((q) => [q.id, q]));
for (const item of fresh) {
  if (!byId.has(item.id)) byId.set(item.id, item);
}
queue.items = [...byId.values()]
  .sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt))
  .slice(0, 100);

for (const [sourceId, acc] of Object.entries(healthAcc)) {
  const h = recordHealth(sourceId, acc);
  if (h.consecutiveEmpty >= WARN_AFTER) {
    console.warn(`⚠ ${SOURCES[sourceId].label} は ${h.consecutiveEmpty}回連続で0件。サイト側の改修でセレクタが壊れた可能性があります → npm run probe ${sourceId} "<キーワード>"`);
  }
}

writeJson('seen.json', pruneSeen(seen));
writeJson('feed.json', feed);
writeJson('queue.json', queue);

console.log(`\n■ 完了: 新規イベント ${capped.length}件 / 監視中アイテム ${Object.keys(seen).length}件`);
const sick = unhealthySources(Object.fromEntries(Object.values(SOURCES).map((s) => [s.id, s.label])));
if (sick.length) console.warn(`■ 要確認のソース: ${sick.map((s) => `${s.label}(${s.lastError ? 'エラー' : `${s.consecutiveEmpty}回連続0件`})`).join(', ')}`);
console.log(`  未投稿キュー: ${queue.items.filter((q) => !q.posted || Object.keys(q.posted).length === 0).length}件`);
