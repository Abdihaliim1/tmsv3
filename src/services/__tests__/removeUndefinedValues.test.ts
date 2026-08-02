import { describe, expect, it } from 'vitest';
import { removeUndefinedValues } from '../firestoreService';

describe('removeUndefinedValues (BUG-017)', () => {
  it('strips nested undefined customer fields before Firestore setDoc', () => {
    const cleaned = removeUndefinedValues({
      id: 'pl-1',
      customer: {
        id: 'amazon',
        name: 'Amazon Freight',
        address: undefined,
        city: undefined,
        state: 'WA',
        zipCode: undefined,
      },
      fees: { primaryFee: 1000 },
    });

    expect(cleaned).toEqual({
      id: 'pl-1',
      customer: {
        id: 'amazon',
        name: 'Amazon Freight',
        state: 'WA',
      },
      fees: { primaryFee: 1000 },
    });
    expect('address' in (cleaned as { customer: object }).customer).toBe(false);
  });

  it('cleans undefined inside arrays of nested objects', () => {
    const cleaned = removeUndefinedValues({
      pickups: [
        {
          id: 'p1',
          shipper: { id: 's1', name: 'Shipper', address: undefined, city: 'Columbus' },
        },
      ],
    });

    expect(cleaned).toEqual({
      pickups: [
        {
          id: 'p1',
          shipper: { id: 's1', name: 'Shipper', city: 'Columbus' },
        },
      ],
    });
  });

  it('preserves null and Date values', () => {
    const now = new Date('2026-08-02T00:00:00.000Z');
    const cleaned = removeUndefinedValues({ a: null, b: now, c: undefined });
    expect(cleaned).toEqual({ a: null, b: now });
  });
});
