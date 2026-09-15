/**
 * 和暦・年齢・干支・学年・厄年などの計算
 */

export interface Era {
  name: string;
  short: string; // M / T / S / H / R
  start: { y: number; m: number; d: number };
  end?: { y: number; m: number; d: number };
}

export const ERAS: Era[] = [
  { name: '明治', short: 'M', start: { y: 1868, m: 1, d: 25 }, end: { y: 1912, m: 7, d: 29 } },
  { name: '大正', short: 'T', start: { y: 1912, m: 7, d: 30 }, end: { y: 1926, m: 12, d: 24 } },
  { name: '昭和', short: 'S', start: { y: 1926, m: 12, d: 25 }, end: { y: 1989, m: 1, d: 7 } },
  { name: '平成', short: 'H', start: { y: 1989, m: 1, d: 8 }, end: { y: 2019, m: 4, d: 30 } },
  { name: '令和', short: 'R', start: { y: 2019, m: 5, d: 1 } },
];

export const ERA_SLUGS: Record<string, string> = {
  meiji: '明治',
  taisho: '大正',
  showa: '昭和',
  heisei: '平成',
  reiwa: '令和',
};

export function eraBySlug(slug: string): Era | undefined {
  const name = ERA_SLUGS[slug];
  return ERAS.find((e) => e.name === name);
}

export function eraSlug(era: Era): string {
  return Object.entries(ERA_SLUGS).find(([, n]) => n === era.name)![0];
}

/** 西暦年に対応する和暦（年内に複数の元号がある場合は全て返す） */
export function warekiOfYear(year: number): { era: Era; n: number; label: string }[] {
  const out: { era: Era; n: number; label: string }[] = [];
  for (const era of ERAS) {
    const endY = era.end?.y ?? 9999;
    if (year >= era.start.y && year <= endY) {
      const n = year - era.start.y + 1;
      out.push({ era, n, label: `${era.name}${n === 1 ? '元' : n}年` });
    }
  }
  return out;
}

/** 西暦年の「主な」和暦表記（その年の大半を占める元号）。 */
export function warekiLabel(year: number): string {
  const list = warekiOfYear(year);
  if (list.length === 0) return `${year}年`;
  if (list.length === 1) return list[0].label;
  // 複数ある年: 「昭和64年/平成元年」のように併記
  return list.map((w) => w.label).join('/');
}

/** 和暦 → 西暦 */
export function warekiToYear(era: Era, n: number): number {
  return era.start.y + n - 1;
}

/** 元号の最終年（n の上限） */
export function eraMaxYear(era: Era, currentYear: number): number {
  if (era.end) return era.end.y - era.start.y + 1;
  return currentYear - era.start.y + 1;
}

// ---------- 干支 ----------
const JUNISHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
const JUNISHI_ANIMAL = ['ねずみ', 'うし', 'とら', 'うさぎ', 'たつ', 'へび', 'うま', 'ひつじ', 'さる', 'とり', 'いぬ', 'いのしし'] as const;
const JIKKAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const JIKKAN_YOMI = ['きのえ', 'きのと', 'ひのえ', 'ひのと', 'つちのえ', 'つちのと', 'かのえ', 'かのと', 'みずのえ', 'みずのと'] as const;
const JUNISHI_YOMI = ['ね', 'うし', 'とら', 'う', 'たつ', 'み', 'うま', 'ひつじ', 'さる', 'とり', 'いぬ', 'い'] as const;

export function eto(year: number) {
  const j = ((year - 4) % 12 + 12) % 12;
  const k = ((year - 4) % 10 + 10) % 10;
  return {
    junishi: JUNISHI[j],
    animal: JUNISHI_ANIMAL[j],
    jikkan: JIKKAN[k],
    kanshi: `${JIKKAN[k]}${JUNISHI[j]}`,
    kanshiYomi: `${JIKKAN_YOMI[k]}${JUNISHI_YOMI[j]}`,
  };
}

// ---------- 年齢 ----------

/** 満年齢（誕生日を迎えていれば birthYear からの差、そうでなければ −1） */
export function ageOn(birth: { y: number; m: number; d: number }, on: { y: number; m: number; d: number }): number {
  let age = on.y - birth.y;
  if (on.m < birth.m || (on.m === birth.m && on.d < birth.d)) age -= 1;
  return age;
}

/** 生まれ年から、基準年での年齢（誕生日後 / 誕生日前） */
export function ageRange(birthYear: number, baseYear: number) {
  return { after: baseYear - birthYear, before: baseYear - birthYear - 1 };
}

/** 数え年 */
export function kazoedoshi(birthYear: number, baseYear: number): number {
  return baseYear - birthYear + 1;
}

// ---------- 学年・入学卒業 ----------
/**
 * 4月2日〜翌年4月1日生まれが同じ学年。
 * early = true（1/1〜4/1 生まれ、早生まれ）の場合は前年生まれと同学年。
 */
export function schoolYears(birthYear: number, early = false) {
  const base = early ? birthYear - 1 : birthYear; // 学年基準年（4/2〜12/31生まれ換算）
  return {
    elementaryIn: base + 7,
    elementaryOut: base + 13,
    juniorIn: base + 13,
    juniorOut: base + 16,
    highIn: base + 16,
    highOut: base + 19,
    universityIn: base + 19,
    universityOut: base + 23,
    seijin: base + 21, // 20歳の年度（成人式は 18 歳成人後も多くの自治体で20歳の年度に開催）
  };
}

// ---------- 厄年（数え年） ----------
export const YAKUDOSHI = {
  male: { main: [25, 42, 61], label: '男性' },
  female: { main: [19, 33, 37, 61], label: '女性' },
} as const;

export function yakudoshiInfo(birthYear: number, baseYear: number) {
  const k = kazoedoshi(birthYear, baseYear);
  const check = (ages: readonly number[]) => {
    for (const a of ages) {
      if (k === a) return { kind: '本厄', age: a };
      if (k === a - 1) return { kind: '前厄', age: a };
      if (k === a + 1) return { kind: '後厄', age: a };
    }
    return null;
  };
  return {
    kazoe: k,
    male: check(YAKUDOSHI.male.main),
    female: check(YAKUDOSHI.female.main),
  };
}

// ---------- 長寿祝い ----------
export const CHOJU = [
  { age: 60, name: '還暦', yomi: 'かんれき' },
  { age: 70, name: '古希', yomi: 'こき' },
  { age: 77, name: '喜寿', yomi: 'きじゅ' },
  { age: 80, name: '傘寿', yomi: 'さんじゅ' },
  { age: 88, name: '米寿', yomi: 'べいじゅ' },
  { age: 90, name: '卒寿', yomi: 'そつじゅ' },
  { age: 99, name: '白寿', yomi: 'はくじゅ' },
  { age: 100, name: '百寿', yomi: 'ももじゅ' },
] as const;

/** その生まれ年の人が各長寿祝いを迎える西暦年 */
export function chojuYears(birthYear: number) {
  return CHOJU.map((c) => ({ ...c, year: birthYear + c.age }));
}
