/**
 * Normalize driver payment fields to a single source of truth.
 */

import { Driver, PaymentType } from '../types';
import { resolveDriverPayment } from './businessLogic';

export function hydrateDriverPaymentForm(driver: Driver | null | undefined): {
  type: PaymentType;
  perMileRate: number;
  percentage: number;
  flatRate: number;
  payPercentage: number;
  payRate: number;
  rateOrSplit: number;
} {
  if (!driver) {
    return {
      type: 'per_mile',
      perMileRate: 0,
      percentage: 0,
      flatRate: 0,
      payPercentage: 0,
      payRate: 0,
      rateOrSplit: 0,
    };
  }

  const resolved = resolveDriverPayment(driver);
  return {
    type: resolved.type,
    perMileRate: resolved.perMileRate,
    percentage: resolved.percentageDisplay,
    flatRate: resolved.flatRate,
    payPercentage: resolved.percentageFraction,
    payRate:
      resolved.type === 'per_mile'
        ? resolved.perMileRate
        : resolved.type === 'flat_rate'
          ? resolved.flatRate
          : resolved.percentageDisplay,
    rateOrSplit:
      resolved.type === 'per_mile'
        ? resolved.perMileRate
        : resolved.percentageDisplay || resolved.percentageFraction * 100,
  };
}

/** Canonical payload to persist on save — never leave payRate and payment.* out of sync. */
export function buildNormalizedPaymentSave(
  paymentType: PaymentType,
  payment: {
    perMileRate?: number;
    percentage?: number;
    flatRate?: number;
    detention?: number;
    layover?: number;
    fuelSurcharge?: number | boolean;
  },
  payPercentageInput?: number
): {
  payment: Driver['payment'];
  payType: PaymentType;
  payRate: number;
  rateOrSplit?: number;
  payPercentage?: number;
} {
  if (paymentType === 'per_mile') {
    const rate = Number(payment.perMileRate) || 0;
    return {
      payment: {
        type: 'per_mile',
        perMileRate: rate,
        percentage: 0,
        flatRate: 0,
        detention: payment.detention || 0,
        layover: payment.layover || 0,
        fuelSurcharge: payment.fuelSurcharge || false,
      },
      payType: 'per_mile',
      payRate: rate,
      rateOrSplit: rate,
      payPercentage: undefined,
    };
  }

  if (paymentType === 'flat_rate') {
    const rate = Number(payment.flatRate) || 0;
    return {
      payment: {
        type: 'flat_rate',
        perMileRate: 0,
        percentage: 0,
        flatRate: rate,
        detention: payment.detention || 0,
        layover: payment.layover || 0,
        fuelSurcharge: payment.fuelSurcharge || false,
      },
      payType: 'flat_rate',
      payRate: rate,
      rateOrSplit: undefined,
      payPercentage: undefined,
    };
  }

  // percentage — store fraction in payPercentage, display points in rateOrSplit
  let pctPoints = Number(payPercentageInput);
  if (!Number.isFinite(pctPoints) || pctPoints <= 0) {
    pctPoints = Number(payment.percentage) || 0;
  }
  if (pctPoints > 0 && pctPoints <= 1) pctPoints = pctPoints * 100;
  const fraction = pctPoints / 100;

  return {
    payment: {
      type: 'percentage',
      perMileRate: 0,
      percentage: pctPoints,
      flatRate: 0,
      detention: payment.detention || 0,
      layover: payment.layover || 0,
      fuelSurcharge: payment.fuelSurcharge || false,
    },
    payType: 'percentage',
    payRate: pctPoints,
    rateOrSplit: pctPoints,
    payPercentage: fraction,
  };
}
