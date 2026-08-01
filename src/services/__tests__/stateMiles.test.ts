import { describe, it, expect } from 'vitest';
import { allocateStateMiles, sumStateMiles } from '../stateMiles';

describe('allocateStateMiles', () => {
  it('puts all miles in one state when origin === dest', () => {
    expect(allocateStateMiles({ originState: 'TX', destState: 'tx', miles: 100 })).toEqual([
      { state: 'TX', miles: 100 },
    ]);
  });

  it('splits 50/50 across different states', () => {
    const segs = allocateStateMiles({ originState: 'CA', destState: 'NV', miles: 101 });
    expect(segs).toHaveLength(2);
    expect(segs[0].state).toBe('CA');
    expect(segs[1].state).toBe('NV');
    expect(segs[0].miles + segs[1].miles).toBeCloseTo(101, 2);
  });

  it('prefers existing stateMiles', () => {
    const segs = allocateStateMiles({
      originState: 'CA',
      destState: 'NV',
      miles: 100,
      existing: [
        { state: 'ca', miles: 40 },
        { state: 'az', miles: 60 },
      ],
    });
    expect(segs).toEqual([
      { state: 'CA', miles: 40 },
      { state: 'AZ', miles: 60 },
    ]);
  });
});

describe('sumStateMiles', () => {
  it('aggregates across loads', () => {
    const result = sumStateMiles([
      { originState: 'TX', destState: 'TX', miles: 100 },
      { stateMiles: [{ state: 'OK', miles: 50 }] },
    ]);
    expect(result.TX.miles).toBe(100);
    expect(result.OK.miles).toBe(50);
  });
});
