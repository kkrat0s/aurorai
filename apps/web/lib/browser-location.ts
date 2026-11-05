import { coarseLocationFromCoordinates, type CoarseLocation } from '@aurorasense/shared/ground-reference';

export type BrowserLocation = { location: CoarseLocation; observedAtUtc: string; uncertaintyKm: number };

/** Immediately discard precise coordinates; only a coarse cell reaches React state. */
export function coarseBrowserPosition(position: Pick<GeolocationPosition, 'coords' | 'timestamp'>, nowMs = Date.now()): BrowserLocation | null {
  const { latitude, longitude, accuracy } = position.coords;
  if (![latitude, longitude, accuracy, position.timestamp, nowMs].every(Number.isFinite)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0 || accuracy > 50_000
    || position.timestamp > nowMs + 60_000 || nowMs - position.timestamp > 5 * 60_000) return null;
  const location = coarseLocationFromCoordinates(latitude, longitude);
  if (!location) return null;
  const uncertaintyKm = accuracy / 1000 + 40; // Covers half-degree cell rounding at the equator.
  return { location: { ...location, uncertaintyKm }, observedAtUtc: new Date(position.timestamp).toISOString(), uncertaintyKm };
}
