import config from '../../config/watch.json';
import { SOURCES } from './sources.js';
import { toDiscord, toThreads, toBluesky } from './notify.js';

const TIERS = config.poll?.tiers ?? {
  realtime: { everyMinutes: 1, offset: 0 },
  fast: { everyMinutes: 10, offset: 3 },
  normal: { everyMinutes: 60, offset: 7 },
};

// 1回の起動でSNSに流す上限（Discordは速報なので別枠、こちらはタイムライン汚染を防ぐため）
const MAX_SOCIAL_PER_RUN = 3;

export default {
  async scheduled(event, env, ctx) {
    const minute = Math.floor(event.scheduledTime / 60000) % 60;
    const due = config.watches.filter((w) => isDue(w, minute));
    if (due.length === 0) return;

    for (const watch of due) {
      try {
        await runWatch(watch, env, ctx);
      } catch (err) {
        console.error(`[${watch.id}] ${err.message}`);
      }
    }
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/events.json') {
      const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 300);
      const { results } = await env.DB.prepare(
        'SELECT * FROM events ORDER BY detected_at DESC LIMIT ?1'
      ).bind(limit).all();
      return json({ updatedAt: new Date().toISOString(), events: results });
    }

    if (url.pathname === '/health') {
      const { results } = await env.DB.prepare(
        'SELECT COUNT(*) AS items, MAX(last_seen_at) AS latest FROM items'
      ).all();
      return json({
        ok: true,
        watching: results[0]?.items ?? 0,
        lastCrawlAt: results[0]?.latest ?? null,
        tiers: Object.fromEntries(
          config.watches.map((w) => [w.label, w.pollTier || 'normal'])
        ),
      });
    }

    return new Response('rare-item-radar worker', { status: 200 });
  },
};

function isDue(watch, minute) {
  const t = TIERS[watch.pollTier || 'normal'];
  if (!t) return false;
  if (t.everyMinutes <= 1) return true;
  // 監視ごとの pollOffset を優先し、同じ分に負荷が集中しないようずらす
  const offset = watch.pollOffset ?? t.offset ?? 0;
  return minute % t.everyMinutes === offset % t.everyMinutes;
}

async function runWatch(watch, env, ctx) {
  // --- 収集 ---
  const collected = [];
  for (const sourceId of watch.sources) {
    const source = SOURCES[sourceId];
    if (!source?.enabled(env)) continue;
    for (const keyword of watch.keywords) {
      try {
        collected.push(...(await source.search(keyword, watch.filters, env)));
      } catch (err) {
        console.error(`  ${sourceId} "${keyword}": ${err.message}`);
      }
    }
  }

  const items = dedupe(applyFilters(collected, watch.filters));
  if (items.length === 0) return;

  // --- 前回状態を1クエリで引く ---
  const ids = items.map((i) => i.id);
  const placeholders = ids.map((_, i) => `?${i + 1}`).join(',');
  const { results: prevRows } = await env.DB.prepare(
    `SELECT id, price, in_stock FROM items WHERE id IN (${placeholders})`
  ).bind(...ids).all();
  const prev = new Map(prevRows.map((r) => [r.id, r]));

  // 初回は全部が「新着」になってしまうので、スナップショットだけ取る
  const firstRun = prev.size === 0;
  const now = new Date().toISOString();
  const events = [];
  const upserts = [];

  for (const item of items) {
    const before = prev.get(item.id);
    upserts.push(
      env.DB.prepare(
        `INSERT INTO items (id, price, in_stock, title, first_seen_at, last_seen_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)
         ON CONFLICT(id) DO UPDATE SET price=?2, in_stock=?3, title=?4, last_seen_at=?5`
      ).bind(item.id, item.price, item.inStock ? 1 : 0, item.title, now)
    );

    if (firstRun) continue;

    if (!before) {
      if (config.detect?.newItem) events.push(mkEvent('new', '新着・予約開始', '🆕', 100, item, watch, now));
    } else if (config.detect?.backInStock && !before.in_stock && item.inStock) {
      events.push(mkEvent('restock', '在庫復活', '🔥', 120, item, watch, now));
    } else if (config.detect?.priceDropPercent && before.price > 0 && item.price > 0) {
      const drop = ((before.price - item.price) / before.price) * 100;
      if (drop >= config.detect.priceDropPercent) {
        const ev = mkEvent('pricedrop', `${Math.round(drop)}%値下げ`, '📉', 80 + drop, item, watch, now);
        ev.prevPrice = before.price;
        events.push(ev);
      }
    }
  }

  await env.DB.batch(upserts);
  if (events.length === 0) return;

  events.sort((a, b) => b.score - a.score);
  console.log(`[${watch.id}] ${items.length}件チェック → ${events.length}件検知`);

  // --- 保存 ---
  await env.DB.batch(
    events.map((ev) =>
      env.DB.prepare(
        `INSERT OR IGNORE INTO events
         (id, type, watch_id, watch_label, label, emoji, title, url, image, price, prev_price, source_label, detected_at, posted)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,'{}')`
      ).bind(ev.id, ev.type, watch.id, watch.label, ev.label, ev.emoji, ev.title, ev.url,
             ev.image, ev.price, ev.prevPrice ?? null, ev.sourceLabel, now)
    )
  );

  // --- 配信。Discordは全件（速報の本命）、SNSは上限つき ---
  ctx.waitUntil(deliver(events, watch, env));
}

async function deliver(events, watch, env) {
  for (const ev of events) {
    try {
      await toDiscord(env, ev);
    } catch (err) {
      console.error(`Discord: ${err.message}`);
      break;
    }
  }

  for (const ev of events.slice(0, MAX_SOCIAL_PER_RUN)) {
    const text = compose(ev, watch);
    for (const [name, fn] of [['Threads', toThreads], ['Bluesky', toBluesky]]) {
      try {
        await fn(env, ev, text);
      } catch (err) {
        console.error(`${name}: ${err.message}`);
      }
    }
  }
}

function mkEvent(type, label, emoji, score, item, watch, now) {
  return {
    id: `${item.id}:${type}:${now.slice(0, 13)}`, // 同じ商品の同種イベントを1時間に1回までに抑える
    type, label, emoji, score,
    title: item.title, url: item.url, image: item.image,
    price: item.price, sourceLabel: item.sourceLabel,
  };
}

const HASHTAGS = {
  'pokemon-hot': '#ポケカ #ポケモンカード',
  pokemon: '#ポケカ #ポケモンカード',
  onepiece: '#ワンピカード',
  mtg: '#MTG',
  chinhin: '#変わり種',
};

function compose(ev, watch) {
  const yen = (n) => (n ? `¥${n.toLocaleString('ja-JP')}` : '価格未定');
  const price = ev.prevPrice ? `${yen(ev.prevPrice)} → ${yen(ev.price)}` : yen(ev.price);
  return [
    `${ev.emoji}【${ev.label}】${watch.label}`,
    truncate(ev.title, 120),
    `${price}／${ev.sourceLabel}`,
    ev.url,
    HASHTAGS[watch.id] || '',
  ].filter(Boolean).join('\n');
}

/** Xの文字数は全角2・半角1でカウントされる */
function truncate(s, limit) {
  let n = 0, out = '';
  for (const ch of s) {
    const w = /[\x00-\x7F]/.test(ch) ? 1 : 2;
    if (n + w > limit) return out + '…';
    out += ch;
    n += w;
  }
  return out;
}

function applyFilters(items, filters = {}) {
  const exclude = (filters.excludeWords || []).map((w) => w.toLowerCase());
  return items.filter((it) => {
    if (!it.title || !it.url) return false;
    const t = it.title.toLowerCase();
    if (exclude.some((w) => t.includes(w))) return false;
    if (filters.minPrice && it.price && it.price < filters.minPrice) return false;
    if (filters.maxPrice && it.price && it.price > filters.maxPrice) return false;
    return true;
  });
}

function dedupe(items) {
  const m = new Map();
  for (const it of items) {
    const key = it.title.toLowerCase().replace(/[【】\[\]（）()「」\s　,、。・\-ー\/]/g, '').slice(0, 40);
    const cur = m.get(key);
    if (!cur || (it.price && cur.price && it.price < cur.price)) m.set(key, it);
  }
  return [...m.values()];
}

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
