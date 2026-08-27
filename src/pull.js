import fs from 'node:fs';
import { readJson, writeJson } from './lib/store.js';

/**
 * Cloudflare Worker がリアルタイム検知したイベントを取り込む。
 * Worker を使う場合、GitHub Actions 側では商品APIを叩かない
 * （楽天の1日5,000リクエストを二重に消費してしまうため）。
 */
const base = process.env.WORKER_EVENTS_URL;
if (!base) {
  console.error('WORKER_EVENTS_URL が未設定です');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync('config/watch.json', 'utf8'));
const res = await fetch(`${base.replace(/\/$/, '')}/events.json?limit=300`);
if (!res.ok) {
  console.error(`Worker から取得できませんでした: HTTP ${res.status}`);
  process.exit(1);
}
const { events: rows } = await res.json();
console.log(`■ Worker から ${rows.length}件のイベントを取得`);

const watchById = Object.fromEntries(config.watches.map((w) => [w.id, w]));
const HASHTAGS = {
  'pokemon-hot': '#ポケカ #ポケモンカード',
  pokemon: '#ポケカ #ポケモンカード',
  onepiece: '#ワンピカード',
  mtg: '#MTG',
  chinhin: '#変わり種',
};
const yen = (n) => (n ? `¥${Number(n).toLocaleString('ja-JP')}` : '価格未定');

const events = rows.map((r) => {
  const priceLine = r.prev_price ? `${yen(r.prev_price)} → ${yen(r.price)}` : yen(r.price);
  const head = `${r.emoji}【${r.label}】${r.watch_label}`;
  const meta = `${priceLine}／${r.source_label}`;
  const tags = HASHTAGS[r.watch_id] || '';
  return {
    type: r.type,
    watchId: r.watch_id,
    watchLabel: r.watch_label,
    label: r.label,
    emoji: r.emoji,
    detectedAt: r.detected_at,
    item: {
      id: r.id, title: r.title, url: r.url, image: r.image,
      price: r.price, sourceLabel: r.source_label,
    },
    post: {
      textWithLink: [head, r.title, meta, r.url, tags].filter(Boolean).join('\n'),
      textNoLink: [head, r.title, meta, '🔗 詳細はプロフィールのリンクから', tags].filter(Boolean).join('\n'),
    },
  };
});

writeJson('feed.json', { updatedAt: new Date().toISOString(), events: events.slice(0, 300) });

// 手動X投稿用のキュー。既存の配信済みフラグは保持する
const queue = readJson('queue.json', { items: [] });
const existing = new Map(queue.items.map((q) => [q.id, q]));
for (const ev of events) {
  const id = `${ev.item.id}:${ev.type}`;
  if (existing.has(id)) continue;
  existing.set(id, {
    id,
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
    // WorkerがDiscord/Threads/Blueskyに配信済み。Xだけが手動で残る
    posted: { worker: ev.detectedAt },
  });
}
const cutoff = Date.now() - 7 * 86400_000;
queue.items = [...existing.values()]
  .filter((q) => new Date(q.detectedAt).getTime() >= cutoff)
  .sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt))
  .slice(0, 100);
writeJson('queue.json', queue);

console.log(`■ 取り込み完了: 速報 ${events.length}件 / X未投稿 ${queue.items.filter((q) => !q.posted?.x).length}件`);
