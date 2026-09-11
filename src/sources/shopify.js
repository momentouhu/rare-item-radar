import { fetchHtml, decodeEntities, scraperEnabled } from '../lib/html.js';

/**
 * Shopify 製ショップ共通アダプタ。
 * Shopify は /products.json?limit=250 で最新250商品（published_at 降順）を公開JSONで返す。
 * HTMLを解析しないので壊れにくく、1回の取得を同一実行内でキーワード間で使い回す。
 * キーワードは商品名に全語を含むもの（大文字小文字無視）で絞る。
 */
export function shopifySource({ id, label, domain, shop = label, minIntervalMs = 10_000 }) {
  let cache = null;

  return {
    id,
    label,
    enabled: () => scraperEnabled(id),

    async search(keyword, filters = {}) {
      if (!cache || Date.now() - cache.at > 60_000) {
        const text = await fetchHtml(`https://${domain}/products.json?limit=250`, {
          minIntervalMs,
          accept: 'application/json',
        });
        cache = { at: Date.now(), products: JSON.parse(text).products ?? [] };
      }

      const words = keyword.toLowerCase().split(/\s+/).filter(Boolean);
      const items = [];
      for (const p of cache.products) {
        const title = decodeEntities(p.title ?? '');
        const t = title.toLowerCase();
        if (!words.every((w) => t.includes(w))) continue;

        const v = p.variants?.[0] ?? {};
        const price = Math.round(Number(v.price) || 0);
        if (filters.minPrice && price && price < filters.minPrice) continue;
        if (filters.maxPrice && price && price > filters.maxPrice) continue;

        items.push({
          id: `${id}:${p.id}`,
          source: id,
          sourceLabel: label,
          title,
          url: `https://${domain}/products/${p.handle}`,
          rawUrl: `https://${domain}/products/${p.handle}`,
          image: p.images?.[0]?.src ?? '',
          price,
          inStock: v.available !== false,
          shop,
          reviewCount: null, // Shopify の公開JSONにレビューは無い
          reviewAverage: null,
          releaseDate: p.published_at ?? '',
        });
      }
      return items;
    },
  };
}

/** 晴れる屋2 — ポケカ専門。シールド品は事前抽選販売なので「抽選開始」の通知として使う */
export const hareruya2 = shopifySource({ id: 'hareruya2', label: '晴れる屋2', domain: 'www.hareruya2.com' });
