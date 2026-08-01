import { describe, expect, it } from 'vitest';
import {
  buildMarkLoadFundedPatch,
  deriveInvoiceFundingFromLoads,
  getLoadAllocatedFee,
  getLoadExpectedNet,
  getLoadFactoredAmount,
  getLoadFactoringStatus,
  isLoadFunded,
  summarizeFactoredLoads,
} from '../factoringFunding';
import { resolveLoadFactoringFee } from '../businessLogic';
import { Load, LoadStatus, Invoice } from '../../types';

const makeLoad = (partial: Partial<Load> & { id: string }): Load =>
  ({
    loadNumber: partial.id,
    status: LoadStatus.Invoiced,
    rate: 1000,
    grandTotal: 1000,
    miles: 100,
    isFactored: true,
    factoringFeePercent: 2.5,
    createdAt: '2026-07-01',
    ...partial,
  }) as Load;

describe('factoring fee allocation (Test A)', () => {
  it('10 loads × $1,000 at 2.5% → fee $25/load, total fee $250, expected net $9,750', () => {
    const loads = Array.from({ length: 10 }, (_, i) =>
      makeLoad({
        id: `L${i}`,
        // Corrupt: full invoice fee stamped on every load
        factoringFee: 250,
      })
    );
    const invoice = {
      id: 'INV1',
      invoiceNumber: 'T-A',
      amount: 10000,
      isFactored: true,
      factoringFee: 250,
      factoringFeePercent: 2.5,
      loadIds: loads.map(l => l.id),
      status: 'pending',
      customerName: 'Broker',
      date: '2026-07-01',
    } as Invoice;

    const fees = loads.map(l => getLoadAllocatedFee(l, invoice));
    expect(fees.every(f => f === 25)).toBe(true);
    expect(fees.reduce((s, f) => s + f, 0)).toBe(250);

    const summary = summarizeFactoredLoads(loads.map(load => ({ load, invoice })));
    expect(summary.totalFactoredAmount).toBe(10000);
    expect(summary.expectedFees).toBe(250);
    expect(summary.expectedNet).toBe(9750);
    expect(summary.actualNetReceived).toBe(0);

    // resolveLoadFactoringFee must also ignore corrupt stored invoice fee
    expect(resolveLoadFactoringFee(loads[0], invoice)).toBe(25);
  });

  it('does not repeat $3,217.50 invoice fee across 60 loads', () => {
    const loads = Array.from({ length: 60 }, (_, i) =>
      makeLoad({
        id: `L${i}`,
        rate: 2145,
        grandTotal: 2145,
        factoringFee: 3217.5,
      })
    );
    const invoice = {
      id: 'INV60',
      invoiceNumber: 'BIG',
      amount: 128700,
      isFactored: true,
      factoringFee: 3217.5,
      factoringFeePercent: 2.5,
      loadIds: loads.map(l => l.id),
      status: 'pending',
      customerName: 'Broker',
      date: '2026-07-01',
    } as Invoice;

    const summary = summarizeFactoredLoads(loads.map(load => ({ load, invoice })));
    expect(summary.totalFactoredAmount).toBe(128700);
    expect(summary.expectedFees).toBe(3217.5); // invoice fee, not 3217.5×60
    expect(summary.expectedNet).toBe(125482.5);
    expect(summary.expectedNet).toBeGreaterThan(0);
    // Per-load fee is share of invoice fee (~$53.63), never $3,217.50
    expect(getLoadAllocatedFee(loads[0], invoice)).toBeCloseTo(53.63, 1);
    expect(getLoadAllocatedFee(loads[0], invoice)).toBeLessThan(100);
  });
});

describe('factoring status defaults', () => {
  it('Available factored load is not_submitted (not Submitted)', () => {
    const load = makeLoad({
      id: 'AVAIL',
      status: LoadStatus.Available,
      isFactored: true,
      factoringCompanyId: 'fc1',
      factoredAmount: 1800,
    });
    expect(getLoadFactoringStatus(load)).toBe('not_submitted');
  });
});

describe('legacy double-fee prevention (audit $1800 @ 2.5%)', () => {
  it('treats factoredAmount stored as net as gross revenue so expected net is $1,755', () => {
    // Bug: writers stored net ($1,755) in factoredAmount; UI then applied fee again → $1,711.12
    const load = makeLoad({
      id: 'LEGACY',
      rate: 1800,
      grandTotal: 1800,
      factoredAmount: 1755, // legacy net
      factoringFeePercent: 2.5,
    });
    expect(getLoadFactoredAmount(load)).toBe(1800);
    expect(getLoadAllocatedFee(load)).toBe(45);
    expect(getLoadExpectedNet(load)).toBe(1755);
  });

  it('keeps explicitly higher custom factoredAmount when not legacy net', () => {
    const load = makeLoad({
      id: 'CUSTOM',
      rate: 1800,
      grandTotal: 1800,
      factoredAmount: 1900,
      factoringFeePercent: 2.5,
    });
    expect(getLoadFactoredAmount(load)).toBe(1900);
    expect(getLoadExpectedNet(load)).toBe(1852.5);
  });
});

describe('per-load funding (Tests B–D)', () => {
  it('funding 5 of 10 leaves invoice Partial and actual net $4,875', () => {
    const loads = Array.from({ length: 10 }, (_, i) => makeLoad({ id: `L${i}` }));
    const invoice = {
      id: 'INV1',
      invoiceNumber: 'T-B',
      amount: 10000,
      isFactored: true,
      factoringFee: 250,
      factoringFeePercent: 2.5,
      loadIds: loads.map(l => l.id),
      status: 'pending',
      customerName: 'Broker',
      date: '2026-07-01',
    } as Invoice;

    const funded = loads.map((l, i) =>
      i < 5 ? { ...l, ...buildMarkLoadFundedPatch(l, invoice) } : l
    );

    expect(funded.filter(isLoadFunded)).toHaveLength(5);
    expect(isLoadFunded(funded[5])).toBe(false);

    const derived = deriveInvoiceFundingFromLoads(invoice, funded);
    expect(derived.status).toBe('partial');
    expect(derived.paidAmount).toBe(4875);

    const summary = summarizeFactoredLoads(funded.map(load => ({ load, invoice })));
    expect(summary.fundedLoads).toBe(5);
    expect(summary.pendingLoads).toBe(5);
    expect(summary.actualNetReceived).toBe(4875);
    expect(summary.expectedNet).toBe(9750);
  });

  it('held loads stay unpaid when siblings are funded (Test C)', () => {
    const loads = Array.from({ length: 10 }, (_, i) =>
      makeLoad({
        id: `L${i}`,
        factoringStatus: i < 5 ? 'held' : 'submitted',
      })
    );
    const invoice = {
      id: 'INV1',
      invoiceNumber: 'T-C',
      amount: 10000,
      isFactored: true,
      factoringFeePercent: 2.5,
      loadIds: loads.map(l => l.id),
      status: 'pending',
      customerName: 'Broker',
      date: '2026-07-01',
    } as Invoice;

    const after = loads.map((l, i) =>
      i >= 5 ? { ...l, ...buildMarkLoadFundedPatch(l, invoice) } : l
    );

    expect(after.slice(0, 5).every(l => l.factoringStatus === 'held')).toBe(true);
    expect(after.slice(5).every(isLoadFunded)).toBe(true);

    const derived = deriveInvoiceFundingFromLoads(invoice, after);
    expect(derived.status).toBe('partial');
    expect(isLoadFunded(after[0])).toBe(false);
  });

  it('Mark Load Funded updates only that load (Test D)', () => {
    const a = makeLoad({ id: 'A' });
    const b = makeLoad({ id: 'B' });
    const invoice = {
      id: 'INV1',
      invoiceNumber: 'T-D',
      amount: 2000,
      isFactored: true,
      factoringFeePercent: 2.5,
      loadIds: ['A', 'B'],
      status: 'pending',
      customerName: 'Broker',
      date: '2026-07-01',
    } as Invoice;

    const patchA = buildMarkLoadFundedPatch(a, invoice);
    const next = [{ ...a, ...patchA }, b];

    expect(isLoadFunded(next[0])).toBe(true);
    expect(isLoadFunded(next[1])).toBe(false);
    expect(getLoadExpectedNet(next[0], invoice)).toBe(975);
    expect(deriveInvoiceFundingFromLoads(invoice, next).status).toBe('partial');
  });
});
