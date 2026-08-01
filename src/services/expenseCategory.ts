/**
 * Canonical expense categories for reports — prevents overlap / double-bucketing.
 */

export const CANONICAL_EXPENSE_CATEGORIES = [
  'fuel',
  'insurance',
  'maintenance',
  'tolls',
  'lodging',
  'permits',
  'repairs',
  'tires',
  'office',
  'payroll',
  'factoring',
  'dispatcher_commission',
  'other',
] as const;

export type CanonicalExpenseCategory = (typeof CANONICAL_EXPENSE_CATEGORIES)[number];

const ALIASES: Record<string, CanonicalExpenseCategory> = {
  fuel: 'fuel',
  diesel: 'fuel',
  gas: 'fuel',
  gasoline: 'fuel',
  insurance: 'insurance',
  cargo_insurance: 'insurance',
  liability: 'insurance',
  maintenance: 'maintenance',
  repair: 'repairs',
  repairs: 'repairs',
  service: 'maintenance',
  toll: 'tolls',
  tolls: 'tolls',
  lodging: 'lodging',
  hotel: 'lodging',
  motel: 'lodging',
  permit: 'permits',
  permits: 'permits',
  tire: 'tires',
  tires: 'tires',
  office: 'office',
  admin: 'office',
  payroll: 'payroll',
  wages: 'payroll',
  factoring: 'factoring',
  factor_fee: 'factoring',
  dispatcher: 'dispatcher_commission',
  dispatcher_commission: 'dispatcher_commission',
  commission: 'dispatcher_commission',
  other: 'other',
  misc: 'other',
  miscellaneous: 'other',
};

/**
 * Normalize free-text type/category into one canonical bucket.
 * Prefer structured `type` / `category` fields — never description keywords.
 */
export function normalizeExpenseCategory(
  type?: string | null,
  category?: string | null
): CanonicalExpenseCategory {
  const raw = String(category || type || 'other')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (!raw) return 'other';
  if (ALIASES[raw]) return ALIASES[raw];
  // Partial match on known keys
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (raw.includes(alias) || alias.includes(raw)) return canonical;
  }
  return 'other';
}

export function formatExpenseCategoryLabel(category: string): string {
  return category
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
