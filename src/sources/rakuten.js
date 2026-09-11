import { getJson } from '../lib/http.js';

const ICHIBA = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601';
const BOOKS = 'https://app.rakuten.co.jp/services/api/BooksTotal/Search/20170404';

/** 楽天APIは Items:[{Item:{...}}] と Items:[{...}] の両方の形があるので吸収する */
function unwrap(items) {
  if (!Array.isArray(items)) return [];
  return items.map((x) => (x && typeof x === 'object' && 'Item' in x ? x.Item : x)).filter(Boolean);
}

function requireAppId() {
  const id = process.env.RAKUTEN_APP_ID;
  if (!id) throw new Error('RAKUTEN_APP_ID が未設定です（GitHub Secrets に登録してください）');
  return id;
}

export const rakuten_ichiba = {
  id: 'rakuten_ichiba',
  label: '楽天市場',
  enabled: () => Boolean(process.env.RAKUTEN_APP_ID),

  async search(keyword, filters = {}, opts = {}) {
    const params = new URLSearchParams({
      applicationId: requireAppId(),
      keyword,
      hits: '30',
      sort: '-updateTimestamp',
      imageFlag: '1',
      formatVersion: '2',
    });
    if (process.env.RAKUTEN_AFFILIATE_ID) params.set('affiliateId', process.env.RAKUTEN_AFFILIATE_ID);
    if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
    // 特定店舗に絞る（例: あみあみ楽天市場店 = "amiami"）。本店がbot遮断している店でも公式APIで在庫が追える
    if (opts.shopCode) params.set('shopCode', opts.shopCode);

    const json = await getJson(`${ICHIBA}?${params}`);
    return unwrap(json.Items).map((it) => ({
      id: `rakuten_ichiba:${it.itemCode}`,
      source: 'rakuten_ichiba',
      sourceLabel: '楽天市場',
      title: it.itemName,
      url: it.affiliateUrl || it.itemUrl,
      rawUrl: it.itemUrl,
      image: (it.mediumImageUrls?.[0]?.imageUrl || it.mediumImageUrls?.[0] || '').replace(/\?_ex=\d+x\d+$/, '?_ex=400x400'),
      price: Number(it.itemPrice) || 0,
      inStock: Number(it.availability) === 1,
      shop: it.shopName || '',
      reviewCount: Number(it.reviewCount) || 0,
      reviewAverage: Number(it.reviewAverage) || 0,
    }));
  },
};

export const rakuten_books = {
  id: 'rakuten_books',
  label: '楽天ブックス',
  enabled: () => Boolean(process.env.RAKUTEN_APP_ID),

  async search(keyword) {
    const params = new URLSearchParams({
      applicationId: requireAppId(),
      keyword,
      hits: '30',
      sort: '-releaseDate',
      formatVersion: '2',
    });
    if (process.env.RAKUTEN_AFFILIATE_ID) params.set('affiliateId', process.env.RAKUTEN_AFFILIATE_ID);

    let json;
    try {
      json = await getJson(`${BOOKS}?${params}`);
    } catch (err) {
      // 楽天ブックスAPIはヒット0件を404で返すことがある
      if (String(err.message).includes('HTTP 404')) return [];
      throw err;
    }

    return unwrap(json.Items).map((it) => {
      const key = it.isbn || it.jan || it.itemNumber || it.title;
      return {
        id: `rakuten_books:${key}`,
        source: 'rakuten_books',
        sourceLabel: '楽天ブックス',
        title: it.title || it.itemName || '',
        url: it.affiliateUrl || it.itemUrl || it.affiliateUrls || '',
        rawUrl: it.itemUrl || '',
        image: it.largeImageUrl || it.mediumImageUrl || it.smallImageUrl || '',
        price: Number(it.itemPrice) || 0,
        // 楽天ブックスの availability: 1=在庫あり 2=通常3-7日 3=通常7-9日 4=注文不可/予約 5=予約受付中
        inStock: ['1', '2', '3', '5', 1, 2, 3, 5].includes(it.availability),
        shop: '楽天ブックス',
        reviewCount: Number(it.reviewCount) || 0,
        reviewAverage: Number(it.reviewAverage) || 0,
        releaseDate: it.salesDate || '',
      };
    });
  },
};
