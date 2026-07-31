/**
 * Settlement pay math — single source of truth for generate-form totals.
 *
 * grossPay = basePay + detention + layover + TONU + otherEarnings
 * totalDeductions = insurance + fuel + dispatch + advances + otherDeductions
 * netPay = grossPay - totalDeductions
 */

export type SettlementMoneyInputs = {
  insurance?: number | string | null;
  fuel?: number | string | null;
  dispatch?: number | string | null;
  advances?: number | string | null;
  other?: number | string | null;
  /** Manual accessorial earnings (pass-through), not deductions */
  tonu?: number | string | null;
  layover?: number | string | null;
  detention?: number | string | null;
  otherEarnings?: number | string | null;
};

export type SettlementLoadPay = {
  basePay: number;
  detention?: number;
  layover?: number;
  tonu?: number;
};

export type SettlementDeductionsStored = {
  insurance: number;
  fuel: number;
  dispatch: number;
  cashAdvance: number;
  other: number;
  escrow: number;
};

export type SettlementPayResult = {
  loadBasePay: number;
  loadDetention: number;
  loadLayover: number;
  loadTonu: number;
  manualDetention: number;
  manualLayover: number;
  manualTonu: number;
  otherEarnings: number;
  grossPay: number;
  deductions: SettlementDeductionsStored;
  totalDeductions: number;
  netPay: number;
  earningsBreakdown: {
    basePay: number;
    detention: number;
    layover: number;
    tonu: number;
    otherEarnings: number;
  };
};

export type SettlementPayValidation = {
  valid: boolean;
  errors: string[];
};

/** Round to nearest cent (half-up via Number.EPSILON-safe banker's-avoiding pattern). */
export function roundCents(value: number): number {
  if (!Number.isFinite(value)) return NaN;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Parse a money field. Rejects negative, NaN, and infinite values.
 * Blank / null / undefined → 0 (empty input while editing).
 */
export function parseMoneyAmount(
  raw: number | string | null | undefined
): { ok: true; value: number } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { ok: true, value: 0 };
  }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'Amount must be a finite number' };
  }
  if (n < 0) {
    return { ok: false, error: 'Amount cannot be negative' };
  }
  return { ok: true, value: roundCents(n) };
}

/** Sanitize onChange: keep previous value if input is invalid/negative. */
export function sanitizeMoneyInput(
  raw: string,
  previous: number
): number {
  if (raw === '' || raw === undefined) return 0;
  const parsed = parseMoneyAmount(raw);
  if (!parsed.ok) return previous;
  return parsed.value;
}

function requireMoney(
  label: string,
  raw: number | string | null | undefined,
  errors: string[]
): number {
  const parsed = parseMoneyAmount(raw);
  if (!parsed.ok) {
    errors.push(`${label}: ${parsed.error}`);
    return 0;
  }
  return parsed.value;
}

/**
 * Compute settlement pay from load earnings + manual money fields.
 * Always recalculates from the provided inputs (order-independent).
 */
export function computeSettlementPay(
  loadPays: SettlementLoadPay[],
  inputs: SettlementMoneyInputs,
  options?: { includeDriverDeductions?: boolean }
): SettlementPayResult {
  const includeDriverDeductions = options?.includeDriverDeductions !== false;
  const errors: string[] = [];

  let loadBasePay = 0;
  let loadDetention = 0;
  let loadLayover = 0;
  let loadTonu = 0;

  for (const lp of loadPays) {
    loadBasePay += Number(lp.basePay) || 0;
    loadDetention += Number(lp.detention) || 0;
    loadLayover += Number(lp.layover) || 0;
    loadTonu += Number(lp.tonu) || 0;
  }

  loadBasePay = roundCents(loadBasePay);
  loadDetention = roundCents(loadDetention);
  loadLayover = roundCents(loadLayover);
  loadTonu = roundCents(loadTonu);

  const insurance = includeDriverDeductions
    ? requireMoney('Insurance', inputs.insurance, errors)
    : 0;
  const fuel = includeDriverDeductions
    ? requireMoney('Fuel', inputs.fuel, errors)
    : 0;
  const dispatch = requireMoney('Dispatch', inputs.dispatch, errors);
  const advances = requireMoney('Advances', inputs.advances, errors);
  const other = requireMoney('Others', inputs.other, errors);
  const manualTonu = requireMoney('TONU', inputs.tonu, errors);
  const manualLayover = requireMoney('Layover', inputs.layover, errors);
  const manualDetention = requireMoney('Detention', inputs.detention, errors);
  const otherEarnings = requireMoney('Other earnings', inputs.otherEarnings, errors);

  if (errors.length > 0) {
    // Still return a structured result; callers should validate before save.
  }

  const detention = roundCents(loadDetention + manualDetention);
  const layover = roundCents(loadLayover + manualLayover);
  const tonu = roundCents(loadTonu + manualTonu);

  const grossPay = roundCents(
    loadBasePay + detention + layover + tonu + otherEarnings
  );

  const deductions: SettlementDeductionsStored = {
    insurance,
    fuel,
    dispatch,
    cashAdvance: advances,
    other,
    escrow: 0,
  };

  const totalDeductions = roundCents(
    deductions.insurance +
      deductions.fuel +
      deductions.dispatch +
      deductions.cashAdvance +
      deductions.other +
      deductions.escrow
  );

  const netPay = roundCents(grossPay - totalDeductions);

  return {
    loadBasePay,
    loadDetention,
    loadLayover,
    loadTonu,
    manualDetention,
    manualLayover,
    manualTonu,
    otherEarnings,
    grossPay,
    deductions,
    totalDeductions,
    netPay,
    earningsBreakdown: {
      basePay: loadBasePay,
      detention,
      layover,
      tonu,
      otherEarnings,
    },
  };
}

/**
 * Validate that money inputs are clean and that saved totals are self-consistent.
 */
export function validateSettlementPay(
  result: SettlementPayResult,
  inputs: SettlementMoneyInputs,
  options?: { includeDriverDeductions?: boolean; allowNegativeNet?: boolean }
): SettlementPayValidation {
  const errors: string[] = [];
  const includeDriverDeductions = options?.includeDriverDeductions !== false;

  const fields: Array<[string, number | string | null | undefined, boolean]> = [
    ['Insurance', inputs.insurance, includeDriverDeductions],
    ['Fuel', inputs.fuel, includeDriverDeductions],
    ['Dispatch', inputs.dispatch, true],
    ['Advances', inputs.advances, true],
    ['Others', inputs.other, true],
    ['TONU', inputs.tonu, true],
    ['Layover', inputs.layover, true],
    ['Detention', inputs.detention, true],
    ['Other earnings', inputs.otherEarnings, true],
  ];

  for (const [label, raw, required] of fields) {
    if (!required) continue;
    const parsed = parseMoneyAmount(raw);
    if (!parsed.ok) errors.push(`${label}: ${parsed.error}`);
  }

  const breakdownSum = roundCents(
    result.deductions.insurance +
      result.deductions.fuel +
      result.deductions.dispatch +
      result.deductions.cashAdvance +
      result.deductions.other +
      result.deductions.escrow
  );

  if (breakdownSum !== result.totalDeductions) {
    errors.push(
      `Deduction breakdown ($${breakdownSum.toFixed(2)}) does not equal totalDeductions ($${result.totalDeductions.toFixed(2)})`
    );
  }

  const expectedNet = roundCents(result.grossPay - result.totalDeductions);
  if (expectedNet !== result.netPay) {
    errors.push(
      `grossPay - deductions ($${expectedNet.toFixed(2)}) does not equal netPay ($${result.netPay.toFixed(2)})`
    );
  }

  if (!options?.allowNegativeNet && result.netPay < 0) {
    errors.push(
      `Deductions ($${result.totalDeductions.toFixed(2)}) exceed gross pay ($${result.grossPay.toFixed(2)}) by $${(result.totalDeductions - result.grossPay).toFixed(2)}. Reduce deductions before saving.`
    );
  }

  for (const key of ['grossPay', 'totalDeductions', 'netPay'] as const) {
    if (!Number.isFinite(result[key])) {
      errors.push(`${key} is not a finite number`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Sum deduction categories from a stored settlement.deductions object. */
export function sumStoredDeductions(
  deductions?: Partial<SettlementDeductionsStored & Record<string, number>> | null
): number {
  if (!deductions) return 0;
  const keys = [
    'insurance',
    'ifta',
    'cashAdvance',
    'fuel',
    'dispatch',
    'trailer',
    'repairs',
    'parking',
    'form2290',
    'eld',
    'toll',
    'irp',
    'ucr',
    'escrow',
    'occupationalAccident',
    'other',
  ] as const;
  let sum = 0;
  for (const key of keys) {
    const v = Number((deductions as Record<string, unknown>)[key]);
    if (Number.isFinite(v) && v > 0) sum += v;
  }
  return roundCents(sum);
}
