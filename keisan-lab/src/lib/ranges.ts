/**
 * 静的生成するページの範囲定義。
 * SEO 上のロングテール（「年収450万 手取り」など）を網羅するための刻み。
 */

/** 年収（万円）: 100〜2000 は10万刻み、2000〜3000 は100万刻み、以降は主要値 */
export const NENSHU_MAN: number[] = [
  ...range(100, 2000, 10),
  ...range(2100, 3000, 100),
  3500, 4000, 5000,
];

/** 月給（万円）: 10〜100 は1万刻み */
export const GEKKYU_MAN: number[] = range(10, 100, 1);

/** 住宅ローン借入額（万円）: 500〜3000 は100万刻み、3000〜6000 は200万刻み、以降 1000万刻み */
export const LOAN_MAN: number[] = [
  ...range(500, 3000, 100),
  ...range(3200, 6000, 200),
  ...range(7000, 10000, 1000),
  12000, 15000,
];

/** 年齢早見表の生まれ年: 1920〜基準年 */
export function birthYears(baseYear: number): number[] {
  return range(1920, baseYear, 1);
}

/** 西暦→和暦ページ: 1868〜基準年+2（未来の年も少し） */
export function seirekiYears(baseYear: number): number[] {
  return range(1868, baseYear + 2, 1);
}

export function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

/** 配列の中で value に近い n 件（前後）を返す */
export function neighbors<T>(arr: T[], index: number, n: number): T[] {
  const start = Math.max(0, index - n);
  const end = Math.min(arr.length, index + n + 1);
  return arr.slice(start, end);
}
