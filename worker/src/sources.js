const ICHIBA = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601';
const BOOKS = 'https://app.rakuten.co.jp/services/api/BooksTotal/Search/20170404';
const YAHOO = 'https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 楽天は「1秒に1リクエスト以下」が条件。Worker内でも必ず守る
let lastRakutenAt = 0;
async function rakutenGate() {
  const wait = lastRakutenAt + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastRakutenAt = Date.now();
}

function unwrap(items) {
  if (!Array.isArray(items)) return [];
  return items.map((x) => (x && typeof x === 'object' && 'Item' in x ? x.Item : x)).filter(Boolean);
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'rare-item-radar/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const SOURCES = {
  rakuten_ichiba: {
    label: '楽天市場',
    isRakuten: true,
    enabled: (env) => Boolean(env.RAKUTEN_APP_ID),
    async search(keyword, filters, env, opts = {}) {
      await rakutenGate();
      const p = new URLSearchParams({
        applicationId: env.RAKUTEN_APP_ID,
        keyword,
        hits: '20',
        sort: '-updateTimestamp',
        imageFlag: '1',
        formatVersion: '2',
        // 転送量とCPU時間を削るため必要な項目だけ返させる
        elements: 'itemCode,itemName,itemPrice,itemUrl,affiliateUrl,availability,mediumImageUrls,shopName',
      });
      if (env.RAKUTEN_AFFILIATE_ID) p.set('affiliateId', env.RAKUTEN_AFFILIATE_ID);
      if (filters?.minPrice) p.set('minPrice', String(filters.minPrice));
      if (filters?.maxPrice) p.set('maxPrice', String(filters.maxPrice));
      if (opts.shopCode) p.set('shopCode', opts.shopCode); // 例: あみあみ楽天市場店 = "amiami"

      const json = await getJson(`${ICHIBA}?${p}`);
      return unwrap(json.Items).map((it) => ({
        id: `rakuten_ichiba:${it.itemCode}`,
        sourceLabel: '楽天市場',
        title: it.itemName,
        url: it.affiliateUrl || it.itemUrl,
        image: (it.mediumImageUrls?.[0]?.imageUrl || it.mediumImageUrls?.[0] || '') + '',
        price: Number(it.itemPrice) || 0,
        inStock: Number(it.availability) === 1,
      }));
    },
  },

  rakuten_books: {
    label: '楽天ブックス',
    isRakuten: true,
    enabled: (env) => Boolean(env.RAKUTEN_APP_ID),
    async search(keyword, filters, env) {
      await rakutenGate();
      const p = new URLSearchParams({
        applicationId: env.RAKUTEN_APP_ID,
        keyword,
        hits: '20',
        sort: '-releaseDate',
        formatVersion: '2',
      });
      if (env.RAKUTEN_AFFILIATE_ID) p.set('affiliateId', env.RAKUTEN_AFFILIATE_ID);

      let json;
      try {
        json = await getJson(`${BOOKS}?${p}`);
      } catch (e) {
        if (String(e.message).includes('404')) return []; // ヒット0件を404で返すことがある
        throw e;
      }
      return unwrap(json.Items).map((it) => ({
        id: `rakuten_books:${it.isbn || it.jan || it.itemNumber || it.title}`,
        sourceLabel: '楽天ブックス',
        title: it.title || it.itemName || '',
        url: it.affiliateUrl || it.itemUrl || '',
        image: it.largeImageUrl || it.mediumImageUrl || '',
        price: Number(it.itemPrice) || 0,
        inStock: ['1', '2', '3', '5', 1, 2, 3, 5].includes(it.availability),
      }));
    },
  },

  yahoo_shopping: {
    label: 'Yahoo!ショッピング',
    isRakuten: false,
    enabled: (env) => Boolean(env.YAHOO_CLIENT_ID),
    async search(keyword, filters, env, opts = {}) {
      const p = new URLSearchParams({
        appid: env.YAHOO_CLIENT_ID,
        query: keyword,
        results: '20',
        sort: '-updated',
        in_stock: 'true',
      });
      if (filters?.minPrice) p.set('price_from', String(filters.minPrice));
      if (filters?.maxPrice) p.set('price_to', String(filters.maxPrice));
      if (opts.sellerId) p.set('seller_id', opts.sellerId); // 例: あみあみ Yahoo!店 = "amiami"
      if (env.VC_SID) {
        p.set('affiliate_type', 'vc');
        p.set('affiliate_id', env.VC_SID);
      }
      const json = await getJson(`${YAHOO}?${p}`);
      return (json.hits || []).map((it) => ({
        id: `yahoo_shopping:${it.code}`,
        sourceLabel: 'Yahoo!ショッピング',
        title: it.name || '',
        url: it.url || '',
        image: it.image?.medium || '',
        price: Number(it.price) || 0,
        inStock: it.inStock !== false,
      }));
    },
  },
};
