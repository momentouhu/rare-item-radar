/** 1234567 → "1,234,567" */
export function yen(n: number): string {
  return Math.round(n).toLocaleString('ja-JP');
}

/** 4500000 → "450万円" / 4550000 → "455万円" / 12345678 → "1,234.6万円" */
export function man(n: number, digits = 0): string {
  const m = n / 10000;
  if (Number.isInteger(m) || digits === 0) {
    return `${Math.round(m).toLocaleString('ja-JP')}万円`;
  }
  return `${m.toLocaleString('ja-JP', { maximumFractionDigits: digits })}万円`;
}

/** 0.0985 → "9.85%" */
export function pct(rate: number, digits = 2): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

/** 4500000 → "450万" (単位なし、URL や見出し用) */
export function manNum(n: number): string {
  return `${Math.round(n / 10000).toLocaleString('ja-JP')}万`;
}
