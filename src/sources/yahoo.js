import { getJson } from '../lib/http.js';

const ENDPOINT = 'https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch';

export const yahoo_shopping = {
  id: 'yahoo_shopping',
  label: 'Yahoo!ショッピング',
  enabled: () => Boolean(process.env.YAHOO_CLIENT_ID),

  async search(keyword, filters = {}, opts = {}) {
    const params = new URLSearchParams({
      appid: process.env.YAHOO_CLIENT_ID,
      query: keyword,
      results: '30',
      sort: '-updated',
      in_stock: 'true',
    });
    if (filters.minPrice) params.set('price_from', String(filters.minPrice));
    if (filters.maxPrice) params.set('price_to', String(filters.maxPrice));
    if (opts.sellerId) params.set('seller_id', opts.sellerId); // 例: あみあみ Yahoo!店 = "amiami"
    // アフィリエイトはバリューコマース経由。sid を入れると url がアフィリンクで返る
    if (process.env.VC_SID) {
      params.set('affiliate_type', 'vc');
      params.set('affiliate_id', process.env.VC_SID);
    }

    const json = await getJson(`${ENDPOINT}?${params}`);
    return (json.hits || []).map((it) => ({
      id: `yahoo_shopping:${it.code}`,
      source: 'yahoo_shopping',
      sourceLabel: 'Yahoo!ショッピング',
      title: it.name || '',
      url: it.url || '',
      rawUrl: it.url || '',
      image: it.image?.medium || it.image?.small || '',
      price: Number(it.price) || 0,
      inStock: it.inStock !== false,
      shop: it.seller?.name || '',
      reviewCount: Number(it.review?.count) || 0,
      reviewAverage: Number(it.review?.rate) || 0,
    }));
  },
};
