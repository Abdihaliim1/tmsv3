/**
 * Planned-load persistence helpers.
 * Ensures create/update only succeed after Firestore write completes,
 * and that callers always use the persisted document ID.
 */

import type { NewPlannedLoadInput, PlannedLoad } from '../types';
import { assertDeliveryOnOrAfterPickup } from '../utils/dateOnly';
import { generateShortId } from '../utils/idGenerator';

export type PlannedLoadSaveFn = (tenantId: string, plannedLoad: PlannedLoad) => Promise<void>;
export type PlannedLoadUpdateFn = (
  tenantId: string,
  id: string,
  updates: Record<string, unknown>
) => Promise<void>;
export type PlannedLoadDeleteFn = (tenantId: string, id: string) => Promise<void>;

function generatePlannedLoadNumber(): string {
  const prefix = 'PL';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/** Build a new PlannedLoad document with a stable client-generated Firestore ID. */
export function buildNewPlannedLoad(
  input: NewPlannedLoadInput,
  opts: { actorUid?: string; id?: string; now?: string } = {}
): PlannedLoad {
  const dateOrderError = assertDeliveryOnOrAfterPickup(
    input.pickups?.[0]?.pickupDate,
    input.deliveries?.[input.deliveries.length - 1]?.deliveryDate
  );
  if (dateOrderError) throw new Error(dateOrderError);

  const now = opts.now || new Date().toISOString();
  const id = opts.id || generateShortId();
  const systemLoadNumber = input.systemLoadNumber || generatePlannedLoadNumber();

  // Drop optional undefined customer fields so nested writes never hit Firestore.
  const customer = input.customer
    ? Object.fromEntries(
        Object.entries({
          id: input.customer.id,
          name: input.customer.name,
          address: input.customer.address,
          city: input.customer.city,
          state: input.customer.state,
          zipCode: input.customer.zipCode,
          phone: input.customer.phone,
          email: input.customer.email,
          contactName: input.customer.contactName,
          rateConAttached: input.customer.rateConAttached,
        }).filter(([, v]) => v !== undefined)
      ) as PlannedLoad['customer']
    : undefined;

  return {
    ...input,
    customer,
    id,
    systemLoadNumber,
    status: 'planned',
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: opts.actorUid || 'system',
  };
}

/**
 * Persist a new planned load. Callers must not treat the load as saved
 * until this promise resolves with the persisted document.
 */
export async function createPlannedLoadPersisted(params: {
  tenantId: string;
  input: NewPlannedLoadInput;
  actorUid?: string;
  save: PlannedLoadSaveFn;
}): Promise<PlannedLoad> {
  const plannedLoad = buildNewPlannedLoad(params.input, { actorUid: params.actorUid });
  await params.save(params.tenantId, plannedLoad);
  return plannedLoad;
}

/**
 * Persist planned-load updates. Throws if the existing document is missing.
 */
export async function updatePlannedLoadPersisted(params: {
  tenantId: string;
  existing: PlannedLoad;
  updates: Partial<PlannedLoad>;
  save: PlannedLoadSaveFn;
  partialUpdate?: PlannedLoadUpdateFn;
}): Promise<PlannedLoad> {
  const merged: PlannedLoad = {
    ...params.existing,
    ...params.updates,
    id: params.existing.id, // never replace persisted ID
    updatedAt: new Date().toISOString(),
  };
  const dateOrderError = assertDeliveryOnOrAfterPickup(
    merged.pickups?.[0]?.pickupDate,
    merged.deliveries?.[merged.deliveries.length - 1]?.deliveryDate
  );
  if (dateOrderError) throw new Error(dateOrderError);

  const isDocAttach =
    Boolean(params.updates.rateConUrl)
    || Boolean(params.updates.bolUrl)
    || Boolean(params.updates.documents);

  if (isDocAttach && params.partialUpdate) {
    await params.partialUpdate(params.tenantId, params.existing.id, {
      ...params.updates,
      updatedAt: merged.updatedAt,
    });
  } else {
    await params.save(params.tenantId, merged);
  }

  return merged;
}

/** Delete only while status is still planned. */
export async function deletePlannedLoadPersisted(params: {
  tenantId: string;
  plannedLoad: PlannedLoad;
  deleteFn: PlannedLoadDeleteFn;
}): Promise<void> {
  if (params.plannedLoad.status !== 'planned') {
    throw new Error('Cannot delete a planned load that has already been dispatched.');
  }
  await params.deleteFn(params.tenantId, params.plannedLoad.id);
}

/**
 * Attachment/dispatch guard: entityId must match a known planned load ID
 * that has already been persisted (present in the provided list or verified by caller).
 */
export function assertPersistedPlannedLoadId(
  plannedLoads: Array<{ id: string }>,
  entityId: string
): void {
  if (!entityId || !plannedLoads.some(pl => pl.id === entityId)) {
    throw new Error('plannedLoad not found');
  }
}
