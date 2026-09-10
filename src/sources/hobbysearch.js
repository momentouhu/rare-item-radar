import { fetchHtml, stripTags, scraperEnabled } from '../lib/html.js';

/**
 * ホビーサーチ (1999.co.jp) — フィギュア・プラモ・ホビーの大手。公式APIなし。
 * robots.txt は User-agent:* に制限なし。
 */
export const hobbysearch = {
  id: 'hobbysearch',
  label: 'ホビーサーチ',
  enabled: () => scraperEnabled('hobbysearch'),

  async search(keyword, filters = {}) {
    const url = `https://www.1999.co.jp/search?typ1_c=100&cat=&target=&searchkey=${encodeURIComponent(keyword)}`;
    const html = await fetchHtml(url, { minIntervalMs: 10_000 });

    const items = [];
    for (const raw of html.split('c-product-list__item"').slice(1)) {
      const block = raw.slice(0, 6000);
      const link = block.match(/href="\/(\d{5,})"/);
      const title = block.match(/c-card__title">([\s\S]*?)<\//);
      if (!link || !title) continue;

      const price = Number((block.match(/lbStreetPrice[^>]*>([\d,]+)</)?.[1] ?? '0').replace(/,/g, ''));
      if (filters.minPrice && price && price < filters.minPrice) continue;
      if (filters.maxPrice && price && price > filters.maxPrice) continue;

      const tag = block.match(/data-tags="[^"]*">([^<]+)</)?.[1]?.trim() ?? '';
      const inStock = !/在庫なし|販売終了/.test(block) && /在庫あり|残り\d|販売中|予約品/.test(block + tag);
      const img = block.match(/src="(\/itbig\d+\/\d+\.jpg)"/);
      const release = block.match(/c-card__maker">([^<]+)</)?.[1]?.trim() ?? '';
      const rawUrl = `https://www.1999.co.jp/${link[1]}`;

      items.push({
        id: `hobbysearch:${link[1]}`,
        source: 'hobbysearch',
        sourceLabel: 'ホビーサーチ',
        title: stripTags(title[1]),
        url: rawUrl,
        rawUrl,
        image: img ? `https://www.1999.co.jp${img[1]}` : '',
        price,
        inStock,
        shop: 'ホビーサーチ',
        reviewCount: null, // このサイトはレビュー情報を持たない
        reviewAverage: null,
        releaseDate: release,
      });
    }
    return items;
  },
};
