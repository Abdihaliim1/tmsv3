/**
 * Transactional uniqueness claims for load / invoice numbers.
 * Path: tenants/{tenantId}/uniqueKeys/{kind}_{normalizedValue}
 */

import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type UniqueKeyKind =
  | 'loadNumber'
  | 'invoiceNumber'
  | 'settlementNumber'
  | 'expenseRecurrenceKey'
  | 'plannedDispatch';

export function normalizeUniqueValue(value: string): string {
  return value.trim().toLowerCase();
}

function claimDocId(kind: UniqueKeyKind, value: string): string {
  // Firestore doc ids cannot contain '/' — normalize is enough for numbers
  const safe = normalizeUniqueValue(value).replace(/[/#[\]]/g, '_');
  return `${kind}_${safe}`;
}

function claimRef(tenantId: string, kind: UniqueKeyKind, value: string) {
  return doc(db, `tenants/${tenantId}/uniqueKeys`, claimDocId(kind, value));
}

/**
 * Claim a unique key for an entity. Throws if another entity already owns it.
 * Optionally releases a previous key when renaming.
 */
export async function claimUniqueKey(params: {
  tenantId: string;
  kind: UniqueKeyKind;
  value: string;
  entityId: string;
  previousValue?: string | null;
}): Promise<void> {
  const { tenantId, kind, value, entityId, previousValue } = params;
  const normalized = normalizeUniqueValue(value);
  if (!normalized) {
    throw new Error(`${kind} is required`);
  }

  const newRef = claimRef(tenantId, kind, normalized);
  const prevNormalized =
    previousValue && normalizeUniqueValue(previousValue) !== normalized
      ? normalizeUniqueValue(previousValue)
      : null;
  const prevRef = prevNormalized ? claimRef(tenantId, kind, prevNormalized) : null;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(newRef);
    if (snap.exists()) {
      const owner = snap.data()?.entityId;
      if (owner && owner !== entityId) {
        throw new Error(
          kind === 'loadNumber'
            ? `Load number "${value}" already exists. Use a unique load number.`
            : kind === 'settlementNumber'
              ? `Settlement number "${value}" already exists. Use a unique settlement number.`
              : kind === 'expenseRecurrenceKey'
                ? `Recurring expense "${value}" already exists.`
                : kind === 'plannedDispatch'
                  ? 'This planned load is already being dispatched or has already been dispatched.'
                  : `Invoice number "${value}" already exists. Use a unique invoice number.`
        );
      }
    }

    transaction.set(
      newRef,
      {
        kind,
        value: normalized,
        displayValue: value.trim(),
        entityId,
        updatedAt: serverTimestamp(),
        createdAt: snap.exists() ? snap.data()?.createdAt || serverTimestamp() : serverTimestamp(),
      },
      { merge: true }
    );

    if (prevRef) {
      const prevSnap = await transaction.get(prevRef);
      if (prevSnap.exists() && prevSnap.data()?.entityId === entityId) {
        transaction.delete(prevRef);
      }
    }
  });
}

/** Release a claim when an entity is deleted. */
export async function releaseUniqueKey(params: {
  tenantId: string;
  kind: UniqueKeyKind;
  value: string;
  entityId: string;
}): Promise<void> {
  const { tenantId, kind, value, entityId } = params;
  if (!value?.trim()) return;
  const ref = claimRef(tenantId, kind, value);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    if (snap.data()?.entityId !== entityId) return;
    transaction.delete(ref);
  });
}
