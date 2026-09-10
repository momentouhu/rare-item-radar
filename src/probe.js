import { SOURCES } from './sources/index.js';

/**
 * 1ソース×1キーワードを実際に取得して結果を表示する。
 * サイト改修でスクレイパが壊れたときの切り分けに使う:
 *   node src/probe.js surugaya "ポケモンカード"
 */
const [, , sourceId, keyword] = process.argv;
const source = SOURCES[sourceId];
if (!source || !keyword) {
  console.error(`使い方: node src/probe.js <${Object.keys(SOURCES).join('|')}> "<キーワード>"`);
  process.exit(1);
}
if (!source.enabled()) console.warn(`(注意) ${source.label} は現在 enabled=false ですが、probe は強制実行します`);

const t0 = Date.now();
const items = await source.search(keyword, {});
console.log(`■ ${source.label} / "${keyword}" → ${items.length}件 (${Date.now() - t0}ms)`);
for (const it of items.slice(0, 8)) {
  console.log(`  ${it.inStock ? '● 在庫あり' : '○ 在庫なし'}  ¥${it.price.toLocaleString('ja-JP').padStart(8)}  ${it.title.slice(0, 50)}`);
  console.log(`      ${it.rawUrl}${it.image ? '  [img]' : '  [画像なし]'}`);
}
const bad = items.filter((i) => !i.title || !i.url);
if (bad.length) console.warn(`! タイトル/URLが欠けている項目: ${bad.length}件`);
