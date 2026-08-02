/**
 * Resolve planned loads linked to a live load / trip so delete cascades
 * do not leave hidden delivered planned-load orphans.
 */

import type { Load } from '../types';
import type { PlannedLoad, Trip } from '../types/plannedLoad';

/** Match a live load to its source planned load(s). */
export function resolveLinkedPlannedLoads(
  load: Load,
  plannedLoads: PlannedLoad[],
  trip?: Trip | null
): PlannedLoad[] {
  if (load.plannedLoadId) {
    const byId = plannedLoads.filter(pl => pl.id === load.plannedLoadId);
    if (byId.length > 0) return byId;
  }

  const byNumber = plannedLoads.filter(pl => {
    const plannedNumber = pl.customLoadNumber || pl.systemLoadNumber;
    return (
      plannedNumber === load.loadNumber
      || pl.systemLoadNumber === load.loadNumber
      || pl.customLoadNumber === load.loadNumber
      || Boolean(load.notes && pl.systemLoadNumber && load.notes.includes(pl.systemLoadNumber))
    );
  });

  if (load.tripId) {
    const onTrip = byNumber.filter(pl => pl.tripId === load.tripId);
    if (onTrip.length > 0) return onTrip;
  }

  if (trip?.plannedLoadIds?.length) {
    const fromTripIds = byNumber.filter(pl => trip.plannedLoadIds.includes(pl.id));
    if (fromTripIds.length > 0) return fromTripIds;
  }

  return byNumber;
}

/**
 * When a trip shell is removed (last load deleted or trip delete),
 * collect planned loads that would otherwise remain hidden in non-planned status.
 */
export function resolvePlannedLoadsForTripCascade(
  trip: Trip,
  plannedLoads: PlannedLoad[],
  remainingLiveLoads: Load[]
): PlannedLoad[] {
  const remainingIds = new Set(
    remainingLiveLoads.flatMap(l => {
      const linked = resolveLinkedPlannedLoads(l, plannedLoads, trip);
      return linked.map(pl => pl.id);
    })
  );

  return plannedLoads.filter(pl => {
    if (remainingIds.has(pl.id)) return false;
    if (pl.tripId === trip.id) return true;
    if (trip.plannedLoadIds?.includes(pl.id)) return true;
    return false;
  });
}
