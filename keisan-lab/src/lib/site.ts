// サイト全体で使う定数。独自ドメインへ移行するときはここと astro.config.mjs を変える。

export const SITE_NAME = 'けいさんラボ';
export const SITE_TAGLINE = '手取り・年齢・ローン、暮らしの計算をサクッと。';
export const SITE_DESCRIPTION =
  '年収から手取り額、生まれ年から今の年齢、借入額から住宅ローンの月々返済額まで。暮らしに必要な計算を、最新の税率・保険料率で即座に確認できる無料の計算ツール＆早見表サイトです。';

// 計算に使う「基準年」。年齢・和暦などはこの年を基準に静的生成し、
// クライアント側の JS で今日の日付に補正する。
export const BASE_YEAR = 2026;

// 税・社会保険の基準年度（表示用）
export const TAX_YEAR_LABEL = '2026年（令和8年）';

// GA4 の計測 ID。ビルド時に環境変数 PUBLIC_GA_ID を渡すと有効になる。
export const GA_ID = import.meta.env.PUBLIC_GA_ID ?? '';

// Google AdSense のパブリッシャー ID（例: ca-pub-xxxxxxxxxxxxxxxx）。未設定なら広告枠は空のまま。
export const ADSENSE_CLIENT = import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '';

/** base パスを考慮した内部リンク用ヘルパー。必ず末尾スラッシュ付きで返す。 */
export function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let p = path.startsWith('/') ? path : `/${path}`;
  if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/';
  return `${base}${p}`;
}

/** 絶対 URL（canonical / OGP 用） */
export function absoluteUrl(path: string): string {
  const site = (import.meta.env.SITE ?? '').replace(/\/$/, '');
  return `${site}${url(path)}`;
}
