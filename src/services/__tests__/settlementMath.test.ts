import { describe, expect, it } from 'vitest';
import {
  computeSettlementPay,
  parseMoneyAmount,
  roundCents,
  sanitizeMoneyInput,
  sumStoredDeductions,
  validateSettlementPay,
  type SettlementMoneyInputs,
} from '../settlementMath';

const BASE_LOAD = [{ basePay: 577.5, detention: 0, layover: 0, tonu: 0 }];

/** All deduction/earnings field keys that must trigger the same final totals. */
const MONEY_KEYS: Array<keyof SettlementMoneyInputs> = [
  'insurance',
  'fuel',
  'dispatch',
  'advances',
  'other',
  'tonu',
  'layover',
  'detention',
];

function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permute(rest)) {
      result.push([arr[i], ...p]);
    }
  }
  return result;
}

describe('roundCents', () => {
  it('rounds money values to two decimals', () => {
    expect(roundCents(10.999)).toBe(11);
    expect(roundCents(3465)).toBe(3465);
    expect(roundCents(577.5)).toBe(577.5);
    expect(roundCents(2.665 * 1000)).toBe(2665);
  });
});

describe('parseMoneyAmount', () => {
  it('accepts zero and positive amounts', () => {
    expect(parseMoneyAmount(0)).toEqual({ ok: true, value: 0 });
    expect(parseMoneyAmount('100.5')).toEqual({ ok: true, value: 100.5 });
    expect(parseMoneyAmount('')).toEqual({ ok: true, value: 0 });
  });

  it('rejects negatives, NaN, and Infinity', () => {
    expect(parseMoneyAmount(-50).ok).toBe(false);
    expect(parseMoneyAmount('-50').ok).toBe(false);
    expect(parseMoneyAmount(NaN).ok).toBe(false);
    expect(parseMoneyAmount(Infinity).ok).toBe(false);
    expect(parseMoneyAmount('abc').ok).toBe(false);
  });
});

describe('sanitizeMoneyInput', () => {
  it('keeps previous value when negative is entered', () => {
    expect(sanitizeMoneyInput('-50', 100)).toBe(100);
    expect(sanitizeMoneyInput('25.5', 100)).toBe(25.5);
    expect(sanitizeMoneyInput('', 100)).toBe(0);
  });
});

describe('computeSettlementPay — ST-2026-1003 case', () => {
  it('computes $3465 gross, $800 deductions, $2665 net', () => {
    const loads = [
      { basePay: 924 },
      { basePay: 847 },
      { basePay: 808.5 },
      { basePay: 885.5 },
    ];
    const result = computeSettlementPay(loads, {
      insurance: 400,
      fuel: 200,
      other: 200,
    });
    expect(result.grossPay).toBe(3465);
    expect(result.totalDeductions).toBe(800);
    expect(result.netPay).toBe(2665);
    expect(result.deductions.dispatch).toBe(0);
    expect(result.deductions.other).toBe(200);
  });

  it('stores dispatch separately from other', () => {
    const result = computeSettlementPay(BASE_LOAD, {
      dispatch: 100,
      other: 50,
    });
    expect(result.deductions.dispatch).toBe(100);
    expect(result.deductions.other).toBe(50);
    expect(result.totalDeductions).toBe(150);
  });
});

describe('accessorials are earnings, not deductions', () => {
  it('adds TONU / layover / detention to gross pay', () => {
    const result = computeSettlementPay(BASE_LOAD, {
      tonu: 100,
      layover: 50,
      detention: 25,
      fuel: 40,
    });
    expect(result.grossPay).toBe(752.5); // 577.50 + 175
    expect(result.totalDeductions).toBe(40);
    expect(result.netPay).toBe(712.5);
    expect(result.earningsBreakdown.tonu).toBe(100);
    expect(result.earningsBreakdown.layover).toBe(50);
    expect(result.earningsBreakdown.detention).toBe(25);
  });
});

describe('order independence of money fields', () => {
  const VALUES: SettlementMoneyInputs = {
    insurance: 100,
    fuel: 100,
    dispatch: 100,
    advances: 100,
    other: 100,
    tonu: 100,
    layover: 0,
    detention: 0,
  };

  // 5 deduction keys that were historically buggy — full 8! is large; test all
  // orders of the five deduction-only fields, plus spot-check with earnings.
  const DEDUCTION_KEYS: Array<keyof SettlementMoneyInputs> = [
    'insurance',
    'fuel',
    'dispatch',
    'advances',
    'other',
  ];

  it('yields identical totals for every order of deduction entry', () => {
    const expected = computeSettlementPay(BASE_LOAD, VALUES);
    const orders = permute(DEDUCTION_KEYS);
    expect(orders.length).toBe(120);

    for (const order of orders) {
      const progressive: SettlementMoneyInputs = {
        insurance: 0,
        fuel: 0,
        dispatch: 0,
        advances: 0,
        other: 0,
        tonu: VALUES.tonu,
        layover: 0,
        detention: 0,
      };
      let last = computeSettlementPay(BASE_LOAD, progressive);
      for (const key of order) {
        progressive[key] = VALUES[key];
        last = computeSettlementPay(BASE_LOAD, { ...progressive });
      }
      expect(last.grossPay).toBe(expected.grossPay);
      expect(last.totalDeductions).toBe(expected.totalDeductions);
      expect(last.netPay).toBe(expected.netPay);
    }
  });

  it('matches expected totals for the reported UI bug sequence', () => {
    // Insurance → Fuel → Dispatch → Others → Advance → TONU
    const steps: SettlementMoneyInputs[] = [
      { insurance: 100 },
      { insurance: 100, fuel: 100 },
      { insurance: 100, fuel: 100, dispatch: 100 },
      { insurance: 100, fuel: 100, dispatch: 100, other: 100 },
      { insurance: 100, fuel: 100, dispatch: 100, other: 100, advances: 100 },
      { insurance: 100, fuel: 100, dispatch: 100, other: 100, advances: 100, tonu: 100 },
    ];
    const finals = steps.map(s => computeSettlementPay(BASE_LOAD, s));
    expect(finals[0].totalDeductions).toBe(100);
    expect(finals[1].totalDeductions).toBe(200);
    expect(finals[2].totalDeductions).toBe(300);
    expect(finals[3].totalDeductions).toBe(400);
    expect(finals[4].totalDeductions).toBe(500);
    // TONU increases gross, not deductions
    expect(finals[5].totalDeductions).toBe(500);
    expect(finals[5].grossPay).toBe(677.5);
    expect(finals[5].netPay).toBe(177.5);
  });

  it('is order-independent across all money keys (spot permutations)', () => {
    const expected = computeSettlementPay(BASE_LOAD, {
      insurance: 10,
      fuel: 20,
      dispatch: 30,
      advances: 40,
      other: 50,
      tonu: 5,
      layover: 6,
      detention: 7,
    });
    // A few representative reverse / shuffled orders
    const orders: Array<Array<keyof SettlementMoneyInputs>> = [
      [...MONEY_KEYS],
      [...MONEY_KEYS].reverse(),
      ['other', 'tonu', 'insurance', 'detention', 'fuel', 'layover', 'dispatch', 'advances'],
      ['detention', 'layover', 'tonu', 'other', 'advances', 'dispatch', 'fuel', 'insurance'],
    ];
    for (const order of orders) {
      const progressive: SettlementMoneyInputs = {};
      const values: SettlementMoneyInputs = {
        insurance: 10,
        fuel: 20,
        dispatch: 30,
        advances: 40,
        other: 50,
        tonu: 5,
        layover: 6,
        detention: 7,
      };
      for (const key of order) {
        progressive[key] = values[key];
      }
      const result = computeSettlementPay(BASE_LOAD, progressive);
      expect(result).toMatchObject({
        grossPay: expected.grossPay,
        totalDeductions: expected.totalDeductions,
        netPay: expected.netPay,
      });
    }
  });
});

describe('validateSettlementPay', () => {
  it('blocks negative net when deductions exceed gross', () => {
    const result = computeSettlementPay(BASE_LOAD, { insurance: 1000 });
    const validation = validateSettlementPay(result, { insurance: 1000 });
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('exceed'))).toBe(true);
  });

  it('rejects negative input values', () => {
    const result = computeSettlementPay(BASE_LOAD, { fuel: 0 });
    const validation = validateSettlementPay(result, { fuel: -50 });
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('negative'))).toBe(true);
  });

  it('passes a consistent balanced settlement', () => {
    const inputs = { insurance: 400, fuel: 200, other: 200 };
    const loads = [
      { basePay: 924 },
      { basePay: 847 },
      { basePay: 808.5 },
      { basePay: 885.5 },
    ];
    const result = computeSettlementPay(loads, inputs);
    expect(validateSettlementPay(result, inputs).valid).toBe(true);
  });
});

describe('sumStoredDeductions', () => {
  it('includes dispatch and does not treat accessorial keys as deductions', () => {
    expect(
      sumStoredDeductions({
        insurance: 400,
        fuel: 200,
        other: 200,
        dispatch: 50,
        tonu: 999, // legacy misuse — ignored
        layover: 999,
        detention: 999,
      } as any)
    ).toBe(850);
  });
});
