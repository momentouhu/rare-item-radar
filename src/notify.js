import fs from 'node:fs';
import { readJson, writeJson } from './lib/store.js';
import { threads } from './notify/threads.js';
import { bluesky } from './notify/bluesky.js';
import { discord } from './notify/discord.js';
import { x } from './notify/x.js';
import { sleep } from './lib/http.js';

const config = JSON.parse(fs.readFileSync('config/watch.json', 'utf8'));
const budget = config.budget;

const CHANNELS = [threads, bluesky, discord, x];
const active = CHANNELS.filter((c) => c.enabled());

if (active.length === 0) {
  console.log('■ 有効な配信先がありません。docs/queue.html から手動投稿してください。');
  process.exit(0);
}
console.log(`■ 有効な配信先: ${active.map((c) => c.label).join(', ')}`);

const today = new Date().toISOString().slice(0, 10);
const month = today.slice(0, 7);
const spend = readJson('spend.json', { month, usd: 0, days: {} });
if (spend.month !== month) Object.assign(spend, { month, usd: 0, days: {} });
const dayStat = (spend.days[today] ??= { link: 0, plain: 0 });

const queue = readJson('queue.json', { items: [] });
const counts = {};

for (const channel of active) {
  const pending = queue.items.filter((it) => !it.posted?.[channel.id]);
  if (pending.length === 0) continue;

  // 無料チャンネルは全部流す。Xだけ予算で絞る
  const targets = channel.metered ? pending : pending.slice(0, 30);

  for (const item of targets) {
    let text = item.textWithLink;
    let cost = 0;

    if (channel.metered) {
      const linkRoom = (budget.maxLinkPostsPerDay ?? 0) - dayStat.link;
      const plainRoom = (budget.maxPlainPostsPerDay ?? 0) - dayStat.plain;
      if (linkRoom > 0) {
        cost = channel.priceLink;
      } else if (plainRoom > 0) {
        text = item.textNoLink;
        cost = channel.pricePlain;
      } else {
        console.log(`  · ${channel.label}: 本日の投稿上限に到達`);
        break;
      }
      if (spend.usd + cost > (budget.monthlyUsdCap ?? 0)) {
        console.log(`  · ${channel.label}: 月間予算 $${budget.monthlyUsdCap} に到達（現在 $${spend.usd.toFixed(2)}）`);
        break;
      }
    }

    try {
      await channel.post({
        text,
        url: item.url,
        title: item.title,
        image: item.image,
        price: item.price,
        sourceLabel: item.sourceLabel,
        label: item.label,
        emoji: item.emoji,
      });
      item.posted ??= {};
      item.posted[channel.id] = new Date().toISOString();
      counts[channel.label] = (counts[channel.label] || 0) + 1;

      if (channel.metered) {
        dayStat[text === item.textWithLink ? 'link' : 'plain']++;
        spend.usd += cost;
      }
      await sleep(1500);
    } catch (err) {
      // 認証切れやレート制限で連投しない
      console.error(`  ! ${channel.label} 投稿失敗: ${err.message}`);
      break;
    }
  }
}

// 自動配信済みでも手動投稿(X)の候補として残したいので、掃除は経過日数で行う
const cutoff = Date.now() - 7 * 86400_000;
queue.items = queue.items.filter((it) => new Date(it.detectedAt).getTime() >= cutoff).slice(0, 100);

writeJson('queue.json', queue);
if (x.enabled()) writeJson('spend.json', spend);

const summary = Object.entries(counts).map(([k, v]) => `${k} ${v}件`).join(' / ') || '投稿なし';
console.log(`\n■ ${summary}`);
if (x.enabled()) console.log(`  X の今月推定コスト: $${spend.usd.toFixed(2)} / 上限 $${budget.monthlyUsdCap}`);
