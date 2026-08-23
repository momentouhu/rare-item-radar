import { sleep } from '../lib/http.js';

/**
 * 駿河屋には公式APIが存在しないため、検索ページのHTMLを読む実装。
 *
 * 既定では無効。使う場合は SURUGAYA_ENABLE=1 を設定するが、その前に
 * 駿河屋の利用規約・robots.txt を必ず確認すること。
 * アクセス間隔は 3秒/リクエスト に固定してある（下げないこと）。
 */
const SEARCH = 'https://www.suruga-ya.jp/search';

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function absolute(href) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  return `https://www.suruga-ya.jp${href.startsWith('/') ? '' : '/'}${href}`;
}

/** アフィリエイトIDがあれば駿河屋のリンク形式に載せ替える */
function withAffiliate(url) {
  const aid = process.env.SURUGAYA_AFFILIATE_ID;
  if (!aid) return url;
  return `${url}${url.includes('?') ? '&' : '?'}aid=${encodeURIComponent(aid)}`;
}

export const surugaya = {
  id: 'surugaya',
  label: '駿河屋',
  enabled: () => process.env.SURUGAYA_ENABLE === '1',

  async search(keyword, filters = {}) {
    await sleep(3000);
    const url = `${SEARCH}?category=&search_word=${encodeURIComponent(keyword)}&searchbox=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; rare-item-radar/1.0)',
        'Accept-Language': 'ja,en;q=0.8',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    const items = [];
    // 検索結果1件分の塊を切り出してから各フィールドを拾う
    const blocks = html.split(/<div class="item_box"/i).slice(1);
    for (const block of blocks) {
      const linkMatch = block.match(/href="(\/product\/detail\/[^"]+)"/i);
      const titleMatch = block.match(/<p class="title">\s*<a[^>]*>([\s\S]*?)<\/a>/i);
      const priceMatch = block.match(/([0-9][0-9,]*)\s*円/);
      const imgMatch = block.match(/<img[^>]+src="([^"]+)"/i);
      if (!linkMatch || !titleMatch) continue;

      const title = decodeEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim());
      const price = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : 0;
      if (filters.minPrice && price && price < filters.minPrice) continue;
      if (filters.maxPrice && price && price > filters.maxPrice) continue;

      const rawUrl = absolute(linkMatch[1]);
      items.push({
        id: `surugaya:${linkMatch[1]}`,
        source: 'surugaya',
        sourceLabel: '駿河屋',
        title,
        url: withAffiliate(rawUrl),
        rawUrl,
        image: imgMatch ? absolute(imgMatch[1]) : '',
        price,
        inStock: !/品切|在庫なし|売切/.test(block),
        shop: '駿河屋',
        reviewCount: 0,
        reviewAverage: 0,
      });
    }
    return items;
  },
};
