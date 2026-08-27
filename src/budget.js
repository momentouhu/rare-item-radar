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
console.log(`楽天API 1日の消費見込み: ${total.toLocaleString()} / 上限 ${quota.toLocaleString()}`);

if (total > quota) {
  console.error(`\n✗ 上限を ${(total - quota).toLocaleString()} 超過。キーワードを減らすか階層を下げてください。`);
  process.exit(1);
}
console.log(`✓ 余裕 ${(quota - total).toLocaleString()} リクエスト`);
