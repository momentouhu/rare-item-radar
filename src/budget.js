import fs from 'node:fs';

const c = JSON.parse(fs.readFileSync('config/watch.json', 'utf8'));
const quota = c.poll?.rakutenDailyQuota ?? 5000;
const tiers = c.poll?.tiers ?? {};

let total = 0;
const rows = [];

for (const w of c.watches) {
  const tier = w.pollTier || 'normal';
  const every = tiers[tier]?.everyMinutes ?? 60;
  const runsPerDay = Math.floor(1440 / every);
  const queries = w.keywords.length * w.sources.filter((s) => s.startsWith('rakuten')).length;
  const daily = queries * runsPerDay;
  total += daily;
  rows.push({ 監視: w.label, 階層: tier, 間隔: `${every}分`, クエリ: queries, '1日': daily });
}

console.table(rows);

// スクレイパは楽天の枠を使わないが、間隔があるので1回のActions実行の所要時間を出す
const INTERVAL = { surugaya: 30, sevennet: 10, tower: 10, hobbysearch: 10 };
const enabled = new Set(c.scrapers?.enabled ?? []);
let secs = 0;
const perSite = {};
for (const w of c.watches) for (const s of w.sources) if (enabled.has(s)) {
  perSite[s] = (perSite[s] ?? 0) + w.keywords.length;
}
for (const [s, n] of Object.entries(perSite)) secs = Math.max(secs, n * (INTERVAL[s] ?? 10));
if (secs) console.log(`スクレイパ（並列時の最長）: ${Object.entries(perSite).map(([s, n]) => `${s}×${n}`).join(', ')} → 約${Math.ceil(secs / 60)}分/回（Actionsの timeout は25分）`);
console.log(`楽天API 1日の消費見込み: ${total.toLocaleString()} / 上限 ${quota.toLocaleString()}`);

if (total > quota) {
  console.error(`\n✗ 上限を ${(total - quota).toLocaleString()} 超過。キーワードを減らすか階層を下げてください。`);
  process.exit(1);
}
console.log(`✓ 余裕 ${(quota - total).toLocaleString()} リクエスト`);
