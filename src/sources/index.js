import { rakuten_ichiba, rakuten_books } from './rakuten.js';
import { yahoo_shopping } from './yahoo.js';
import { surugaya } from './surugaya.js';

export const SOURCES = Object.fromEntries(
  [rakuten_ichiba, rakuten_books, yahoo_shopping, surugaya].map((s) => [s.id, s])
);

/**
 * 新しいショップを足すときはここに import して並べるだけ。
 * search(keyword, filters) が正規化済みアイテム配列を返せばよい。
 * タワレコ/Amazon など公式APIが無い or 審査が要るものは README の Phase 2 を参照。
 */
