import { fetchHtml, decodeEntities, scraperEnabled } from '../lib/html.js';

/**
 * セブンネットショッピング — 公式APIなし。
 * 検索結果の各 <li> に data-gtm-criteo-view 属性として商品JSONが埋まっているので、それを読む。
 * robots.txt に制限なし。アフィリエイトはバリューコマースのみ（料率1.1%）。
 */
export const sevennet = {
  id: 'sevennet',
  label: 'セブンネット',
  enabled: () => scraperEnabled('sevennet'),

  async search(keyword, filters = {}) {
    const url = `https://7net.omni7.jp/search/?keyword=${encodeURIComponent(keyword)}`;
    const html = await fetchHtml(url, { minIntervalMs: 10_000 });

    const items = [];
    for (const m of html.matchAll(/<li data-gtm-criteo-view="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g)) {
      let meta;
      try {
        meta = JSON.parse(decodeEntities(m[1]));
      } catch {
        continue;
      }
      const body = m[2];
      if (!meta.item_id || !meta.item_name) continue;

      const price = Math.round(Number(meta.price) || 0);
      if (filters.minPrice && price && price < filters.minPrice) continue;
      if (filters.maxPrice && price && price > filters.maxPrice) continue;

      // カート投入ボタンが disabled = 在庫なし/販売終了
      const inStock = !/c-btnCartin[^>]*\bdisabled\b/.test(body) && !/在庫なし/.test(body);
      const img = body.match(/<img[^>]+src="([^"]+)"/);
      const rawUrl = `https://7net.omni7.jp/detail/${meta.item_id}.html`;

      items.push({
        id: `sevennet:${meta.item_id}`,
        source: 'sevennet',
        sourceLabel: 'セブンネット',
        title: decodeEntities(meta.item_name),
        url: withAffiliate(rawUrl),
        rawUrl,
        image: img ? img[1] : '',
        price,
        inStock,
        shop: 'セブンネットショッピング',
        reviewCount: null, // このサイトはレビュー情報を持たない
        reviewAverage: null,
      });
    }
    return items;
  },
};

/** バリューコマースのリンクは MyLink 形式。VC_SID/VC_PID があれば包む */
function withAffiliate(url) {
  const { VC_SID, VC_7NET_PID } = process.env;
  if (!VC_SID || !VC_7NET_PID) return url;
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC_SID}&pid=${VC_7NET_PID}&vc_url=${encodeURIComponent(url)}`;
}
