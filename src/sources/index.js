import { rakuten_ichiba, rakuten_books } from './rakuten.js';
import { yahoo_shopping } from './yahoo.js';
import { surugaya } from './surugaya.js';
import { sevennet } from './sevennet.js';
import { tower } from './tower.js';
import { hobbysearch } from './hobbysearch.js';

/**
 * 公式APIがあるもの: rakuten_ichiba / rakuten_books / yahoo_shopping（Worker でも動く）
 * スクレイパ: surugaya / sevennet / tower / hobbysearch（GitHub Actions でのみ動く。
 *   有効化は config/watch.json の scrapers.enabled）
 *
 * 新しいショップを足すときは search(keyword, filters) が正規化済みアイテム配列を返す
 * モジュールを作ってここに並べる。README の「ショップ対応表」も更新すること。
 */
export const SOURCES = Object.fromEntries(
  [rakuten_ichiba, rakuten_books, yahoo_shopping, surugaya, sevennet, tower, hobbysearch].map((s) => [s.id, s])
);
