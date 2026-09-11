import { fetchHtml, stripTags, scraperEnabled } from '../lib/html.js';

/**
 * カードラボ (c-labo-online.jp) — TCG専門チェーンの通販。おちゃのこネット製。
 * robots.txt に制限なし。検索結果は1ページ約1.8MBと重いので必要な部分だけ切って読む。
 * 構造: inner_list_item_photo(画像 data-src) → list_item_data(goods_name / selling_price > figure)
 */
export const clabo = {
  id: 'clabo',
  label: 'カードラボ',
  enabled: () => scraperEnabled('clabo'),

  async search(keyword, filters = {}) {
    const url = `https://www.c-labo-online.jp/product-list?keyword=${encodeURIComponent(keyword)}`;
    const html = await fetchHtml(url, { minIntervalMs: 10_000 });

    const items = [];
    for (const raw of html.split('class="inner_list_item_photo"').slice(1)) {
      const block = raw.slice(0, 6000);
      const link = block.match(/href="(https:\/\/www\.c-labo-online\.jp\/product\/(\d+))"/);
      const name = block.match(/class="goods_name">([\s\S]*?)<\/span>\s*<\/p>/);
      if (!link || !name) continue;

      const price = Number((block.match(/class="selling_price">[\s\S]*?class="figure">([\d,]+)/)?.[1] ?? '0').replace(/,/g, ''));
      if (filters.minPrice && price && price < filters.minPrice) continue;
      if (filters.maxPrice && price && price > filters.maxPrice) continue;

      const inStock = !/在庫なし|売り切れ|SOLD OUT/i.test(block);
      const img = block.match(/data-src="([^"]+)"/);

      items.push({
        id: `clabo:${link[2]}`,
        source: 'clabo',
        sourceLabel: 'カードラボ',
        title: stripTags(name[1]),
        url: link[1],
        rawUrl: link[1],
        image: img ? img[1] : '',
        price,
        inStock,
        shop: 'カードラボ',
        reviewCount: null, // このサイトはレビュー情報を持たない
        reviewAverage: null,
      });
    }
    return items;
  },
};
