import { fetchHtml, stripTags, parsePrice, scraperEnabled } from '../lib/html.js';

/**
 * 駿河屋 — 公式APIなし。検索結果ページを読む。
 * robots.txt が User-agent:* に Crawl-delay: 30 を宣言しているので、1リクエスト30秒を厳守。
 * アフィリエイトは自社プログラムあり（https://affiliate.suruga-ya.jp/）。
 */
const MIN_INTERVAL = 30_000;

export const surugaya = {
  id: 'surugaya',
  label: '駿河屋',
  enabled: () => scraperEnabled('surugaya'),

  async search(keyword, filters = {}) {
    const url = `https://www.suruga-ya.jp/search?category=&search_word=${encodeURIComponent(keyword)}&searchbox=1`;
    let html;
    try {
      html = await fetchHtml(url, { minIntervalMs: MIN_INTERVAL });
    } catch (err) {
      if (String(err.message).includes('HTTP 404')) return []; // ヒット0件は404で返ってくる
      throw err;
    }

    const items = [];
    for (const raw of html.split('class="itemTitle"').slice(1)) {
      const block = raw.slice(0, 4000);
      const link = block.match(/href="(\/product\/detail\/(\d+)[^"]*)"/);
      const title = block.match(/<h3 class="product-name">([\s\S]*?)<\/h3>/);
      const priceBox = block.match(/<p class="priceBox">([\s\S]*?)<\/p>/);
      if (!link || !title) continue;

      const id = link[2];
      const priceText = priceBox?.[1] ?? '';
      const inStock = !/品切/.test(priceText);
      const price = parsePrice(priceText);
      if (filters.minPrice && price && price < filters.minPrice) continue;
      if (filters.maxPrice && price && price > filters.maxPrice) continue;

      // 画像は photo.php?shinaban=<商品ID> の固定形式なのでIDから組み立てる
      const rawUrl = `https://www.suruga-ya.jp/product/detail/${id}`;

      items.push({
        id: `surugaya:${id}`,
        source: 'surugaya',
        sourceLabel: '駿河屋',
        title: stripTags(title[1]),
        url: withAffiliate(rawUrl),
        rawUrl,
        image: `https://www.suruga-ya.jp/database/photo.php?shinaban=${id}&size=m`,
        price,
        inStock,
        shop: '駿河屋',
        reviewCount: null, // このサイトはレビュー情報を持たない
        reviewAverage: null,
      });
    }
    return items;
  },
};

/** 駿河屋アフィリエイトのリンク形式は管理画面のリンク生成ツールで確認し、必要ならここを合わせる */
function withAffiliate(url) {
  const aid = process.env.SURUGAYA_AFFILIATE_ID;
  return aid ? `${url}?aid=${encodeURIComponent(aid)}` : url;
}
