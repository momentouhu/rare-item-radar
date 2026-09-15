/**
 * 手取り計算エンジン（2026年・令和8年基準）
 *
 * 給与所得者（会社員）を想定した概算。次の前提で計算する。
 * - 社会保険は協会けんぽ（東京都）・厚生年金・雇用保険（一般の事業）
 * - 扶養なし、各種控除は基礎控除・給与所得控除・社会保険料控除のみ
 * - 住民税は前年所得ベースだが、便宜上「同じ年収が続く」前提で当年分として算出
 * - 賞与なしの場合は年収を12等分。賞与ありの場合は指定回数で按分
 *
 * 出典（2026年度）:
 *   健康保険料率 東京 9.85% / 介護保険 1.62% / 厚生年金 18.3% / 雇用保険 労働者負担 0.5%
 *   基礎控除（令和8年分）58万円＋所得に応じた上乗せ / 給与所得控除の最低保障 65万円
 */

// ---------- 料率 ----------
export const RATES = {
  year: 2026,
  health: 0.0985, // 協会けんぽ 東京都（労使合計）
  care: 0.0162, // 介護保険（40〜64歳、労使合計）
  pension: 0.183, // 厚生年金（労使合計）
  employment: 0.005, // 雇用保険 労働者負担（一般の事業）
  reconstruction: 1.021, // 復興特別所得税
  residentRate: 0.1, // 住民税 所得割
  residentFlat: 6000, // 均等割 5,000円 + 森林環境税 1,000円
} as const;

// 標準報酬月額 等級表（健康保険 1〜50級）。[下限, 標準報酬月額]
const GRADES: ReadonlyArray<readonly [number, number]> = [
  [0, 58000], [63000, 68000], [73000, 78000], [83000, 88000], [93000, 98000],
  [101000, 104000], [107000, 110000], [114000, 118000], [122000, 126000], [130000, 134000],
  [138000, 142000], [146000, 150000], [155000, 160000], [165000, 170000], [175000, 180000],
  [185000, 190000], [195000, 200000], [210000, 220000], [230000, 240000], [250000, 260000],
  [270000, 280000], [290000, 300000], [310000, 320000], [330000, 340000], [350000, 360000],
  [370000, 380000], [395000, 410000], [425000, 440000], [455000, 470000], [485000, 500000],
  [515000, 530000], [545000, 560000], [575000, 590000], [605000, 620000], [635000, 650000],
  [665000, 680000], [695000, 710000], [730000, 750000], [770000, 790000], [810000, 830000],
  [855000, 880000], [905000, 930000], [955000, 980000], [1005000, 1030000], [1055000, 1090000],
  [1115000, 1150000], [1175000, 1210000], [1235000, 1270000], [1295000, 1330000], [1355000, 1390000],
];

const PENSION_MIN = 88000; // 厚生年金 1級
const PENSION_MAX = 650000; // 厚生年金 32級（2026年時点の上限）
const BONUS_PENSION_CAP = 1500000; // 賞与1回あたりの厚生年金上限
const BONUS_HEALTH_CAP = 5730000; // 賞与の健康保険 年度累計上限

/** 月給 → 標準報酬月額（健康保険） */
export function standardMonthly(salary: number): number {
  let std = GRADES[0][1];
  for (const [lower, s] of GRADES) {
    if (salary >= lower) std = s;
  }
  return std;
}

/** 月給 → 標準報酬月額（厚生年金） */
export function standardMonthlyPension(salary: number): number {
  const s = standardMonthly(salary);
  return Math.min(Math.max(s, PENSION_MIN), PENSION_MAX);
}

// ---------- 控除 ----------

/** 給与所得控除（令和8年分以後） */
export function salaryDeduction(income: number): number {
  if (income <= 1_900_000) return 650_000;
  if (income <= 3_600_000) return Math.floor(income * 0.3 + 80_000);
  if (income <= 6_600_000) return Math.floor(income * 0.2 + 440_000);
  if (income <= 8_500_000) return Math.floor(income * 0.1 + 1_100_000);
  return 1_950_000;
}

/** 所得税の基礎控除（令和8年分。令和7・8年限定の上乗せを含む） */
export function basicDeductionIncomeTax(totalIncome: number): number {
  if (totalIncome <= 1_320_000) return 950_000;
  if (totalIncome <= 3_360_000) return 880_000;
  if (totalIncome <= 4_890_000) return 680_000;
  if (totalIncome <= 6_550_000) return 630_000;
  if (totalIncome <= 23_500_000) return 580_000;
  if (totalIncome <= 24_000_000) return 480_000;
  if (totalIncome <= 24_500_000) return 320_000;
  if (totalIncome <= 25_000_000) return 160_000;
  return 0;
}

/** 住民税の基礎控除 */
export function basicDeductionResident(totalIncome: number): number {
  if (totalIncome <= 24_000_000) return 430_000;
  if (totalIncome <= 24_500_000) return 290_000;
  if (totalIncome <= 25_000_000) return 150_000;
  return 0;
}

/** 所得税額（復興特別所得税込み）。課税所得は千円未満切り捨て */
export function incomeTax(taxable: number): number {
  const t = Math.floor(Math.max(taxable, 0) / 1000) * 1000;
  let tax: number;
  if (t <= 1_950_000) tax = t * 0.05;
  else if (t <= 3_300_000) tax = t * 0.1 - 97_500;
  else if (t <= 6_950_000) tax = t * 0.2 - 427_500;
  else if (t <= 9_000_000) tax = t * 0.23 - 636_000;
  else if (t <= 18_000_000) tax = t * 0.33 - 1_536_000;
  else if (t <= 40_000_000) tax = t * 0.4 - 2_796_000;
  else tax = t * 0.45 - 4_796_000;
  // 復興特別所得税 2.1% を上乗せし、百円未満切り捨て
  return Math.floor((tax * RATES.reconstruction) / 100) * 100;
}

/** 住民税額（所得割 + 均等割 − 調整控除）。課税所得は千円未満切り捨て */
export function residentTax(taxable: number): number {
  const t = Math.floor(Math.max(taxable, 0) / 1000) * 1000;
  if (t <= 0) return 0;
  // 調整控除: 人的控除の差額（基礎控除 5万円）に基づく
  const diff = 50_000;
  let adjust: number;
  if (t <= 2_000_000) adjust = Math.min(diff, t) * 0.05;
  else adjust = Math.max((diff - (t - 2_000_000)) * 0.05, 2_500);
  const incomePortion = Math.floor((t * RATES.residentRate - adjust) / 100) * 100;
  return Math.max(incomePortion, 0) + RATES.residentFlat;
}

// ---------- 本体 ----------

export interface TedoriInput {
  /** 年収（額面、賞与込み） */
  annualIncome: number;
  /** 40〜64歳なら true（介護保険料が加わる） */
  over40?: boolean;
  /** 賞与の回数（0 なら賞与なし） */
  bonusCount?: number;
  /** 年収に占める賞与の合計額（bonusCount > 0 のとき有効） */
  bonusTotal?: number;
}

export interface TedoriResult {
  annualIncome: number;
  monthlySalary: number; // 月給（額面）
  bonusEach: number; // 賞与1回あたり（額面）
  bonusCount: number;
  over40: boolean;
  // 社会保険（年額・本人負担）
  health: number;
  care: number;
  pension: number;
  employment: number;
  socialTotal: number;
  // 税
  salaryDeduction: number;
  incomeAfterDeduction: number; // 給与所得
  basicIncomeTax: number;
  basicResident: number;
  taxableIncomeTax: number;
  taxableResident: number;
  incomeTax: number;
  residentTax: number;
  taxTotal: number;
  // 手取り
  deductionTotal: number;
  netAnnual: number;
  netMonthly: number; // 月給からの手取り（賞与除く）
  netBonusEach: number;
  netRatio: number; // 手取り率
}

export function calcTedori(input: TedoriInput): TedoriResult {
  const annual = Math.max(0, Math.round(input.annualIncome));
  const over40 = !!input.over40;
  const bonusCount = Math.max(0, Math.floor(input.bonusCount ?? 0));
  const bonusTotal = bonusCount > 0 ? Math.min(Math.max(0, input.bonusTotal ?? 0), annual) : 0;
  const monthlySalary = Math.round((annual - bonusTotal) / 12);
  const bonusEach = bonusCount > 0 ? Math.round(bonusTotal / bonusCount) : 0;

  // 月給に対する社会保険料（本人負担 = 労使合計の半分）
  const stdHealth = standardMonthly(monthlySalary);
  const stdPension = standardMonthlyPension(monthlySalary);
  const mHealth = Math.round((stdHealth * RATES.health) / 2);
  const mCare = over40 ? Math.round((stdHealth * RATES.care) / 2) : 0;
  const mPension = Math.round((stdPension * RATES.pension) / 2);
  const mEmployment = Math.round(monthlySalary * RATES.employment);

  // 賞与に対する社会保険料（標準賞与額 = 千円未満切り捨て）
  let bHealth = 0, bCare = 0, bPension = 0, bEmployment = 0;
  if (bonusCount > 0 && bonusEach > 0) {
    const stdBonus = Math.floor(bonusEach / 1000) * 1000;
    const healthBase = Math.min(stdBonus, BONUS_HEALTH_CAP / bonusCount);
    const pensionBase = Math.min(stdBonus, BONUS_PENSION_CAP);
    bHealth = Math.round((healthBase * RATES.health) / 2) * bonusCount;
    bCare = over40 ? Math.round((healthBase * RATES.care) / 2) * bonusCount : 0;
    bPension = Math.round((pensionBase * RATES.pension) / 2) * bonusCount;
    bEmployment = Math.round(bonusEach * RATES.employment) * bonusCount;
  }

  const health = mHealth * 12 + bHealth;
  const care = mCare * 12 + bCare;
  const pension = mPension * 12 + bPension;
  const employment = mEmployment * 12 + bEmployment;
  const socialTotal = health + care + pension + employment;

  // 所得税
  const sd = salaryDeduction(annual);
  const income = Math.max(annual - sd, 0);
  const basicIT = basicDeductionIncomeTax(income);
  const taxableIT = Math.max(income - socialTotal - basicIT, 0);
  const it = incomeTax(taxableIT);

  // 住民税
  const basicRT = basicDeductionResident(income);
  const taxableRT = Math.max(income - socialTotal - basicRT, 0);
  const rt = residentTax(taxableRT);

  const taxTotal = it + rt;
  const deductionTotal = socialTotal + taxTotal;
  const netAnnual = annual - deductionTotal;

  // 月々の手取り: 月給から社保・税（年額を12等分）を引く。賞与分は賞与に配分。
  const monthlyShare = (annual - bonusTotal) / (annual || 1);
  const monthlyTax = Math.round((taxTotal * monthlyShare) / 12);
  const netMonthly = monthlySalary - (mHealth + mCare + mPension + mEmployment) - monthlyTax;
  const netBonusEach =
    bonusCount > 0
      ? Math.round(
          bonusEach -
            (bHealth + bCare + bPension + bEmployment) / bonusCount -
            (taxTotal * (1 - monthlyShare)) / bonusCount,
        )
      : 0;

  return {
    annualIncome: annual,
    monthlySalary,
    bonusEach,
    bonusCount,
    over40,
    health,
    care,
    pension,
    employment,
    socialTotal,
    salaryDeduction: sd,
    incomeAfterDeduction: income,
    basicIncomeTax: basicIT,
    basicResident: basicRT,
    taxableIncomeTax: taxableIT,
    taxableResident: taxableRT,
    incomeTax: it,
    residentTax: rt,
    taxTotal,
    deductionTotal,
    netAnnual,
    netMonthly,
    netBonusEach,
    netRatio: annual ? netAnnual / annual : 0,
  };
}

/** 月給（額面）から手取りを計算する。賞与なし前提。 */
export function calcTedoriFromMonthly(monthly: number, over40 = false): TedoriResult {
  return calcTedori({ annualIncome: monthly * 12, over40 });
}
