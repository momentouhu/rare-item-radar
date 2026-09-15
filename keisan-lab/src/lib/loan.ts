/**
 * ローン返済計算（元利均等 / 元金均等）
 */

export interface LoanInput {
  principal: number; // 借入額（円）
  annualRate: number; // 年利（0.01 = 1%）
  years: number; // 返済期間（年）
  bonusPayment?: number; // ボーナス月の加算返済額（1回あたり、年2回）は簡略化のため未対応
}

export interface LoanResult {
  principal: number;
  annualRate: number;
  years: number;
  months: number;
  monthlyPayment: number; // 元利均等の月々返済額
  totalPayment: number;
  totalInterest: number;
  firstPaymentEqualPrincipal: number; // 元金均等の初回返済額
  lastPaymentEqualPrincipal: number; // 元金均等の最終回返済額
  totalInterestEqualPrincipal: number;
}

/** 元利均等返済の月々返済額 */
export function monthlyPayment(principal: number, annualRate: number, years: number): number {
  const n = years * 12;
  if (n <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return Math.round(principal / n);
  return Math.round((principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

export function calcLoan(input: LoanInput): LoanResult {
  const { principal, annualRate, years } = input;
  const months = years * 12;
  const r = annualRate / 12;
  const monthly = monthlyPayment(principal, annualRate, years);
  const totalPayment = monthly * months;
  const totalInterest = totalPayment - principal;

  // 元金均等
  const principalPart = principal / months;
  const firstEP = Math.round(principalPart + principal * r);
  const lastEP = Math.round(principalPart + principalPart * r);
  // 総利息 = Σ (残高 × r) = r × principal × (months + 1) / 2
  const totalInterestEP = Math.round((r * principal * (months + 1)) / 2);

  return {
    principal,
    annualRate,
    years,
    months,
    monthlyPayment: monthly,
    totalPayment,
    totalInterest,
    firstPaymentEqualPrincipal: firstEP,
    lastPaymentEqualPrincipal: lastEP,
    totalInterestEqualPrincipal: totalInterestEP,
  };
}

/** 月々の返済額から逆算した借入可能額（元利均等） */
export function principalFromMonthly(monthly: number, annualRate: number, years: number): number {
  const n = years * 12;
  const r = annualRate / 12;
  if (r === 0) return Math.round(monthly * n);
  return Math.round((monthly * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n)));
}

/** 年収から見た返済負担率（%） */
export function repaymentRatio(annualPayment: number, annualIncome: number): number {
  if (!annualIncome) return 0;
  return (annualPayment / annualIncome) * 100;
}

/** 早見表に使う金利・期間のプリセット */
export const RATE_PRESETS = [0.004, 0.006, 0.008, 0.01, 0.015, 0.02, 0.03] as const;
export const YEAR_PRESETS = [10, 15, 20, 25, 30, 35] as const;
