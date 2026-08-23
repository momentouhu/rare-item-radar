/**
 * 各ショップのアフィリエイトリンク生成。
 * 楽天・Yahoo はAPIがアフィリンクを直接返すので、ここは
 * それが取れなかった場合のフォールバックと、手動追加ショップ用。
 */
export function ensureAffiliate(item) {
  if (!item.url) return item;

  // 楽天: APIが affiliateUrl を返さなかった場合（アフィID未設定など）は素のURLのまま
  if (item.source.startsWith('rakuten') && !item.url.includes('hb.afl.rakuten')) {
    return item;
  }

  // Yahoo: VC_SID 未設定なら素のURL
  return item;
}

/** サイト側で使う「このリンクはアフィリエイトです」の判定 */
export function isAffiliateLink(url = '') {
  return /hb\.afl\.rakuten|ck\.jp\.ap\.valuecommerce|aid=/.test(url);
}
