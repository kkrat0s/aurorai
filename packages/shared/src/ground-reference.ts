import { QC_VERSION, type SensorQcResult, type SensorSession } from './sensor';

export const GROUND_STATIONS = [
  // Geographic coordinates from the USGS Geomagnetism observatory pages.
  { id: 'BOU', name: 'Boulder, Colorado', latitude: 40.1375, longitude: -105.2372 },
  { id: 'FRD', name: 'Fredericksburg, Virginia', latitude: 38.2047, longitude: -77.3729 },
  { id: 'BSL', name: 'Stennis, Mississippi', latitude: 30.3507, longitude: -89.6359 },
  { id: 'CMO', name: 'College, Alaska', latitude: 64.8742, longitude: -147.8597 },
  { id: 'TUC', name: 'Tucson, Arizona', latitude: 32.1745, longitude: -110.7337 },
] as const;
export type GroundStationId = typeof GROUND_STATIONS[number]['id'];
export type GroundReference = {
  stationId: GroundStationId; stationName: string; latitude: number; longitude: number;
  sourceUrl: string; kind: 'MEASURED_LIVE'; component: 'F'; frame: 'SCALAR'; unit: 'nT';
  status: 'variation'; cadenceSeconds: 60; availableAtUtc: null; retrievedAtUtc: string;
  generatedAtUtc: string | null; latestObservedAtUtc: string | null;
  freshness: 'fresh' | 'stale' | 'missing' | 'future'; sha256: string;
  samples: { observedAtUtc: string; value: number | null }[];
};
export type GroundResponse = { reference: GroundReference | null; stations: typeof GROUND_STATIONS; errors: string[]; selection?: { mode: 'automatic' | 'requested'; attemptedStationIds: GroundStationId[]; fallback: boolean } };
export const GROUND_COMPARISON_VERSION = 'phone-usgs-minute-v1.0.0';
export type CoarseLocation = { latitude: number; longitude: number; uncertaintyKm?: number };
/** Discard precise coordinates immediately; 0.5-degree cells remain local to the client. */
export function coarseLocationFromCoordinates(latitude: number, longitude: number, accuracyMeters = 0): CoarseLocation | undefined {
  if (![latitude, longitude, accuracyMeters].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracyMeters < 0 || accuracyMeters > 50_000) return undefined;
  return { latitude: Math.round(latitude * 2) / 2, longitude: Math.round(longitude * 2) / 2, uncertaintyKm: 40 + accuracyMeters / 1000 };
}
/** Client sends only ranked public station IDs, never the user's coordinates. */
export function rankGroundStations(location?: CoarseLocation): GroundStationId[] {
  return [...GROUND_STATIONS].sort((a, b) => location ? (stationDistanceKm(location, a) ?? Infinity) - (stationDistanceKm(location, b) ?? Infinity) : 0).map(station => station.id);
}
export type GroundComparison = {
  version: typeof GROUND_COMPARISON_VERSION;
  status: 'NO_PHONE' | 'NO_REFERENCE' | 'QC_REJECTED' | 'NO_OVERLAP' | 'INSUFFICIENT_COVERAGE' | 'CONTEXT_ONLY' | 'DESCRIPTIVE_COMPARISON';
  regionalVerdict: 'INCONCLUSIVE'; correlation: number | null; distanceKm: number | null;
  aligned: { observedAtUtc: string; phoneDeltaNt: number; referenceDeltaNt: number }[];
  reasons: string[];
};
export function groundFreshness(reference: Pick<GroundReference, 'latestObservedAtUtc'>, asOfUtc: string): GroundReference['freshness'] {
  const at = Date.parse(reference.latestObservedAtUtc ?? ''); const now = Date.parse(asOfUtc);
  if (!Number.isFinite(at) || !Number.isFinite(now)) return 'missing';
  return at > now + 60_000 ? 'future' : now - at > 10 * 60_000 ? 'stale' : 'fresh';
}
export function stationDistanceKm(location: CoarseLocation, reference: CoarseLocation): number | null {
  if (![location.latitude, location.longitude, reference.latitude, reference.longitude].every(Number.isFinite) || Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180 || Math.abs(reference.latitude) > 90 || Math.abs(reference.longitude) > 180) return null;
  const radians = Math.PI / 180; const dLat = (reference.latitude - location.latitude) * radians; const dLon = (reference.longitude - location.longitude) * radians;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(location.latitude * radians) * Math.cos(reference.latitude * radians) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const n = sorted.length; return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2; };

/** Descriptive simultaneous scalar comparison, never a regional or optical validator. */
export function comparePhoneWithReference(session: SensorSession | null, qc: SensorQcResult | null, reference: GroundReference | null, nowUtc: string, location?: CoarseLocation): GroundComparison {
  const result: GroundComparison = { version: GROUND_COMPARISON_VERSION, status: 'NO_PHONE', regionalVerdict: 'INCONCLUSIVE', correlation: null, distanceKm: reference && location ? stationDistanceKm(location, reference) : null, aligned: [], reasons: [] };
  if (!reference) return { ...result, status: 'NO_REFERENCE', reasons: ['No professional ground reference is available.'] };
  if (!session || !qc) return { ...result, reasons: ['Record or import a phone session; upstream solar-wind Bz cannot substitute for a ground reference.'] };
  const now = Date.parse(nowUtc);
  if (!Number.isFinite(now)) return { ...result, status: 'CONTEXT_ONLY', reasons: ['Current UTC time is invalid; live alignment cannot be verified.'] };
  if (session.unit !== 'microT' || session.frame !== 'DEVICE' || reference.unit !== 'nT' || reference.component !== 'F' || reference.frame !== 'SCALAR') return { ...result, status: 'CONTEXT_ONLY', reasons: ['Incompatible units or physical field quantity.'] };
  if (session.kind !== 'MEASURED_LIVE') return { ...result, status: 'CONTEXT_ONLY', reasons: ['Synthetic phone records cannot establish measured station agreement.'] };
  if (!qc.accepted || qc.algorithmVersion !== QC_VERSION || qc.sampleCount !== session.samples.length || qc.sampleResults.length !== session.samples.length) return { ...result, status: 'QC_REJECTED', reasons: ['The phone session has not passed current acquisition QC; station agreement cannot rescue rejected data.'] };
  const bins = new Map<number, { at: number; value: number }[]>();
  for (const sample of qc.sampleResults) {
    const at = Date.parse(sample.observedAtUtc ?? '');
    if (!sample.usable || sample.magnitudeMicroT === null || !Number.isFinite(sample.magnitudeMicroT) || !Number.isFinite(at)) continue;
    const minute = Math.floor(at / 60_000) * 60_000;
    const bin = bins.get(minute) ?? []; bin.push({ at, value: sample.magnitudeMicroT * 1000 }); bins.set(minute, bin);
  }
  const phone = new Map<number, number>();
  for (const [minute, bin] of bins) {
    bin.sort((a, b) => a.at - b.at);
    const coverage = bin.slice(1).reduce((sum, item, i) => { const dt = item.at - bin[i].at; return sum + (dt > 0 && dt <= 500 ? dt : 0); }, 0);
    if (coverage >= 45_000 && bin.length >= 120) phone.set(minute, median(bin.map(item => item.value)));
  }
  const paired = reference.samples.flatMap(sample => {
    const time = Date.parse(sample.observedAtUtc); const value = phone.get(time);
    return value !== undefined && sample.value !== null && Number.isFinite(sample.value) ? [{ time, phone: value, ground: sample.value }] : [];
  }).sort((a, b) => a.time - b.time);
  if (!paired.length) return { ...result, status: 'NO_OVERLAP', reasons: ['No common UTC minute with at least 45 seconds of usable phone coverage. Phone and station histories must overlap.'] };
  const baselinePhone = median(paired.slice(0, 2).map(p => p.phone)); const baselineGround = median(paired.slice(0, 2).map(p => p.ground));
  result.aligned = paired.map(p => ({ observedAtUtc: new Date(p.time).toISOString(), phoneDeltaNt: p.phone - baselinePhone, referenceDeltaNt: p.ground - baselineGround }));
  const reasons: string[] = [];
  if (paired.length < 8 || paired.slice(1).some((p, i) => p.time - paired[i].time !== 60_000)) return { ...result, status: 'INSUFFICIENT_COVERAGE', reasons: ['Need at least eight consecutive common UTC minute bins before reporting descriptive correlation.'] };
  if (groundFreshness(reference, nowUtc) !== 'fresh') reasons.push('The reference is missing, stale or future-dated for live comparison.');
  if (paired.some(sample => sample.time > now)) reasons.push('A matched minute is in the future; live comparison cannot use it.');
  if (result.distanceKm === null) reasons.push('Recording location is unverified; the station remains reference context.');
  else if (!Number.isFinite(location?.uncertaintyKm ?? 0) || (location?.uncertaintyKm ?? 0) < 0 || result.distanceKm + (location?.uncertaintyKm ?? 0) > 500) reasons.push(`Reference is about ${Math.round(result.distanceKm)} km away; distance and location uncertainty do not establish local corroboration.`);
  const uncertainty = session.utcAnchor?.uncertaintyMs;
  if (uncertainty === null || uncertainty === undefined || !Number.isFinite(uncertainty) || uncertainty < 0 || uncertainty > 5000) reasons.push('Phone UTC anchoring uncertainty is unknown, invalid or exceeds five seconds.');
  if (reasons.length) return { ...result, status: 'CONTEXT_ONLY', reasons };
  const meanP = paired.reduce((s, p) => s + p.phone, 0) / paired.length; const meanG = paired.reduce((s, p) => s + p.ground, 0) / paired.length;
  let covariance = 0, varianceP = 0, varianceG = 0;
  for (const p of paired) { const x = p.phone - meanP, y = p.ground - meanG; covariance += x * y; varianceP += x * x; varianceG += y * y; }
  if (varianceP <= 1e-12 || varianceG <= 1e-12) return { ...result, status: 'CONTEXT_ONLY', reasons: ['A constant trace has no defined correlation; stable values do not demonstrate signal agreement.'] };
  return { ...result, status: 'DESCRIPTIVE_COMPARISON', correlation: Math.max(-1, Math.min(1, covariance / Math.sqrt(varianceP * varianceG))), reasons: ['Pearson correlation of simultaneous minute scalar readings; each plotted trace is offset by its first two common minutes.', 'Single-phone agreement does not establish independent regional detection or visible aurora. Provisional USGS variation records may be revised.'] };
}
