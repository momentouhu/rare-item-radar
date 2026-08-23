const HASHTAGS = {
  pokemon: ['#ポケカ', '#ポケモンカード'],
  onepiece: ['#ワンピカード', '#ONEPIECEカードゲーム'],
  mtg: ['#MTG'],
  chinhin: ['#変わり種', '#面白グッズ'],
};

const yen = (n) => `¥${Number(n).toLocaleString('ja-JP')}`;

/** Xの文字数は全角=2/半角=1で280が上限。URLは実長に関わらず23としてカウントされる */
export function weightedLength(text, { hasLink = false } = {}) {
  let n = 0;
  for (const ch of text) n += /[\x00-\x7F]/.test(ch) ? 1 : 2;
  return hasLink ? n + 23 : n;
}

function truncateTitle(title, limit) {
  let n = 0;
  let out = '';
  for (const ch of title) {
    const w = /[\x00-\x7F]/.test(ch) ? 1 : 2;
    if (n + w > limit) return out + '…';
    out += ch;
    n += w;
  }
  return out;
}

export function composePost(event, watch, site) {
  const { item, label, emoji, prevPrice } = event;
  const tags = [...(HASHTAGS[watch.id] || []), watch.emoji ? '' : ''].filter(Boolean).join(' ');

  const priceLine = prevPrice
    ? `${yen(prevPrice)} → ${yen(item.price)}`
    : item.price
      ? yen(item.price)
      : '価格未定';

  const head = `${emoji}【${label}】${watch.label}`;
  const title = truncateTitle(item.title, 120);
  const meta = `${priceLine}／${item.sourceLabel}`;

  // リンク付き（X APIだと1件$0.20。手動投稿ならこちらを使う）
  const textWithLink = [head, title, meta, item.url, tags].filter(Boolean).join('\n');

  // リンクなし（X APIで$0.01。プロフィールのリンクからサイトへ誘導する運用）
  const textNoLink = [head, title, meta, `🔗 詳細はプロフィールのリンクから`, tags]
    .filter(Boolean)
    .join('\n');

  return {
    textWithLink,
    textNoLink,
    lenWithLink: weightedLength(textWithLink.replace(item.url, ''), { hasLink: true }),
    lenNoLink: weightedLength(textNoLink),
    image: item.image,
  };
}
