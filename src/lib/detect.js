/**
 * 前回スナップショット(seen)と今回の取得結果を突き合わせ、
 * 「投稿する価値のある変化」だけをイベントとして返す。
 */
export function detectEvents(items, seen, rules) {
  const events = [];
  const now = new Date().toISOString();

  for (const item of items) {
    const prev = seen[item.id];

    if (!prev) {
      // 初回クロール時は全件が「新着」になってしまうので、その回はイベント化しない
      seen[item.id] = snapshot(item, now, now);
      if (rules.newItem && !rules.firstRun) {
        events.push({ type: 'new', item, label: '新着・予約開始', emoji: '🆕', score: 100 });
      }
      continue;
    }

    if (rules.backInStock && prev.inStock === false && item.inStock === true) {
      events.push({ type: 'restock', item, label: '在庫復活', emoji: '🔥', score: 120 });
    } else if (rules.priceDropPercent && prev.price > 0 && item.price > 0) {
      const dropPct = ((prev.price - item.price) / prev.price) * 100;
      if (dropPct >= rules.priceDropPercent) {
        events.push({
          type: 'pricedrop',
          item,
          label: `${Math.round(dropPct)}%値下げ`,
          emoji: '📉',
          score: 80 + dropPct,
          prevPrice: prev.price,
        });
      }
    }

    seen[item.id] = snapshot(item, prev.firstSeenAt, now);
  }

  // 在庫が落ちたものは「売り切れ」として記録だけする（投稿はしない）
  events.sort((a, b) => b.score - a.score);
  return events;
}

function snapshot(item, firstSeenAt, lastSeenAt) {
  return {
    price: item.price,
    inStock: item.inStock,
    title: item.title,
    firstSeenAt,
    lastSeenAt,
  };
}

/** 除外ワード・価格帯・レビュー数でノイズを落とす */
export function applyFilters(items, filters = {}) {
  const exclude = (filters.excludeWords || []).map((w) => w.toLowerCase());
  return items.filter((it) => {
    if (!it.title || !it.url) return false;
    const t = it.title.toLowerCase();
    if (exclude.some((w) => t.includes(w))) return false;
    if (filters.minPrice && it.price && it.price < filters.minPrice) return false;
    if (filters.maxPrice && it.price && it.price > filters.maxPrice) return false;
    // reviewCount が null のソース（スクレイパ）はレビュー条件の対象外
    if (filters.minReviewCount && it.reviewCount != null && it.reviewCount < filters.minReviewCount) return false;
    return true;
  });
}

/** 同じ商品が複数ショップから来たときに1つに寄せる */
export function dedupe(items) {
  const byKey = new Map();
  for (const it of items) {
    const key = normalizeTitle(it.title);
    const existing = byKey.get(key);
    if (!existing || (it.price && existing.price && it.price < existing.price)) {
      byKey.set(key, it);
    }
  }
  return [...byKey.values()];
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[【】\[\]（）()「」『』\s　,、。･・\-—ー/／]/g, '')
    .replace(/(送料無料|新品|未開封|即日発送|あす楽|ポイント\d+倍)/g, '')
    .slice(0, 40);
}
