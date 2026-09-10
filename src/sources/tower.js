import { fetchHtml, stripTags, parsePrice, scraperEnabled } from '../lib/html.js';

/**
 * タワーレコード オンライン — 公式APIなし。
 * robots.txt は /search/advanced/ と /search/artist/ を禁止しているが /search/item/ は許可。
 * ページが約800KBと重いのでブロック単位で切って読む。アフィリエイトはバリューコマース。
 */
export const tower = {
  id: 'tower',
  label: 'タワレコ',
  enabled: () => scraperEnabled('tower'),

  async search(keyword, filters = {}) {
    const url = `https://tower.jp/search/item/${encodeURIComponent(keyword)}`;
    const html = await fetchHtml(url, { minIntervalMs: 10_000 });

    const items = [];
    for (const raw of html.split('TOL-item-search-result-SP-result-list-display-item"').slice(1)) {
      const block = raw.slice(0, 20_000);
      const link = block.match(/href="(https:\/\/tower\.jp\/item\/(\d+))"/);
      const title = block.match(/tr-item-block-info-item-name">\s*<h3>\s*<a[^>]*>([\s\S]*?)<\/a>/);
      if (!link || !title) continue;

      // 価格は <span class="... is-text-amount ...">&yen;15,400</span> の形
      const price = parsePrice(block.match(/is-text-amount[^>]*>\s*(?:&yen;|¥|￥)?\s*([\d,]+)/)?.[1] ?? '');
      if (filters.minPrice && price && price < filters.minPrice) continue;
      if (filters.maxPrice && price && price > filters.maxPrice) continue;

      const inStock = /在庫あり|予約受付中/.test(block) && !/販売終了|在庫なし/.test(block);
      const img = block.match(/src="(https:\/\/cdn\.tower\.jp\/[^"]+)"/);

      items.push({
        id: `tower:${link[2]}`,
        source: 'tower',
        sourceLabel: 'タワレコ',
        title: stripTags(title[1]),
        url: withAffiliate(link[1]),
        rawUrl: link[1],
        image: img ? img[1] : '',
        price,
        inStock,
        shop: 'タワーレコード',
        reviewCount: null, // このサイトはレビュー情報を持たない
        reviewAverage: null,
      });
    }
    return items;
  },
};

function withAffiliate(url) {
  const { VC_SID, VC_TOWER_PID } = process.env;
  if (!VC_SID || !VC_TOWER_PID) return url;
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC_SID}&pid=${VC_TOWER_PID}&vc_url=${encodeURIComponent(url)}`;
}
