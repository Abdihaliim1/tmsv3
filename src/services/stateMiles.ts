/**
 * Per-state loaded miles for IFTA / IRP reporting.
 */

export interface StateMileSegment {
  state: string;
  miles: number;
}

/** Round to hundredths of a mile. */
function roundMiles(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Build state mile segments from origin/dest + total miles.
 * Same state → 100% there. Different → 50/50 (until GPS polyline segmentation exists).
 */
export function allocateStateMiles(input: {
  originState?: string;
  destState?: string;
  miles?: number;
  existing?: StateMileSegment[] | null;
}): StateMileSegment[] {
  if (input.existing && input.existing.length > 0) {
    return input.existing
      .map(s => ({
        state: String(s.state || '').toUpperCase().trim(),
        miles: roundMiles(Number(s.miles) || 0),
      }))
      .filter(s => s.state && s.miles > 0);
  }

  const miles = Number(input.miles) || 0;
  if (miles <= 0) return [];

  const origin = String(input.originState || '').toUpperCase().trim();
  const dest = String(input.destState || '').toUpperCase().trim();
  if (!origin && !dest) return [];
  if (origin && (!dest || origin === dest)) {
    return [{ state: origin, miles: roundMiles(miles) }];
  }
  if (dest && !origin) {
    return [{ state: dest, miles: roundMiles(miles) }];
  }

  const half = roundMiles(miles / 2);
  const remainder = roundMiles(miles - half);
  return [
    { state: origin, miles: half },
    { state: dest, miles: remainder },
  ];
}

/** Aggregate segments across loads into state → miles. */
export function sumStateMiles(
  rows: Array<{ stateMiles?: StateMileSegment[]; originState?: string; destState?: string; miles?: number }>
): Record<string, { miles: number; loads: number }> {
  const byState: Record<string, { miles: number; loads: number }> = {};
  rows.forEach(row => {
    const segments = allocateStateMiles({
      originState: row.originState,
      destState: row.destState,
      miles: row.miles,
      existing: row.stateMiles,
    });
    const touched = new Set<string>();
    segments.forEach(seg => {
      if (!byState[seg.state]) byState[seg.state] = { miles: 0, loads: 0 };
      byState[seg.state].miles += seg.miles;
      touched.add(seg.state);
    });
    touched.forEach(st => {
      byState[st].loads += 1;
    });
  });
  Object.keys(byState).forEach(k => {
    byState[k].miles = roundMiles(byState[k].miles);
  });
  return byState;
}
