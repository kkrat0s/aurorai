import { createHash } from 'node:crypto';
import { GROUND_STATIONS, groundFreshness, type GroundReference, type GroundStationId, type GroundResponse } from '@aurorasense/shared/ground-reference';

export const USGS_GROUND_URL = 'https://geomag.usgs.gov/ws/data/';
export function isGroundStation(value: string): value is GroundStationId { return GROUND_STATIONS.some(station => station.id === value); }
function utc(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 19) !== value.slice(0, 19)) throw new Error('USGS timestamp must be valid UTC');
  return new Date(value).toISOString();
}
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid USGS metadata'); return value as Record<string, unknown>; }

export function groundSourceUrl(station: GroundStationId, asOfUtc: string): string {
  if (!isGroundStation(station)) throw new Error('Unsupported station');
  const end = Math.floor(Date.parse(utc(asOfUtc)) / 60_000) * 60_000;
  const query = new URLSearchParams({ id: station, format: 'json', elements: 'F', sampling_period: '60', type: 'variation', starttime: new Date(end - 3 * 3600_000).toISOString(), endtime: new Date(end).toISOString() });
  return `${USGS_GROUND_URL}?${query.toString()}`;
}

export function parseGroundReference(data: unknown, station: GroundStationId, sourceUrl: string, retrievedAtUtc: string, sha256: string): GroundReference {
  if (!isGroundStation(station) || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid station provenance');
  const source = new URL(sourceUrl);
  if (source.origin !== 'https://geomag.usgs.gov' || source.pathname !== '/ws/data/' || source.searchParams.get('id') !== station || source.searchParams.get('elements') !== 'F' || source.searchParams.get('type') !== 'variation' || source.searchParams.get('sampling_period') !== '60' || source.searchParams.get('format') !== 'json') throw new Error('USGS source identity mismatch');
  const start = Date.parse(utc(source.searchParams.get('starttime'))), end = Date.parse(utc(source.searchParams.get('endtime')));
  if (end < start || end - start > 3 * 3600_000) throw new Error('Invalid USGS request interval');
  const body = object(data), metadata = object(body.metadata), intermagnet = object(metadata.intermagnet), imo = object(intermagnet.imo);
  if (metadata.status !== 200 || imo.iaga_code !== station || intermagnet.data_type !== 'variation' || intermagnet.sampling_period !== 60 || intermagnet.reported_orientation !== 'F') throw new Error('USGS station, component, cadence or status mismatch');
  const coords = imo.coordinates;
  if (!Array.isArray(coords) || coords.length < 2 || !coords.slice(0, 2).every(value => typeof value === 'number' && Number.isFinite(value)) || Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 90) throw new Error('Invalid station coordinates');
  if (!Array.isArray(body.times) || !Array.isArray(body.values) || body.times.length > 200) throw new Error('USGS response shape or size invalid');
  const channels = body.values.map(object).filter(channel => channel.id === 'F');
  if (channels.length !== 1) throw new Error('Missing or ambiguous scalar F channel');
  const channel = channels[0], channelMetadata = object(channel.metadata);
  if (channelMetadata.station !== station || channelMetadata.element !== 'F' || !Array.isArray(channel.values) || channel.values.length !== body.times.length) throw new Error('USGS channel alignment mismatch');
  let previous = -Infinity;
  const samples = body.times.map((time, index) => {
    const observedAtUtc = utc(time), epoch = Date.parse(observedAtUtc);
    if (epoch <= previous || epoch % 60_000 !== 0) throw new Error('USGS samples must be unique increasing UTC minutes'); previous = epoch;
    if (epoch < start || epoch > end) throw new Error('USGS sample outside requested window');
    const raw = (channel.values as unknown[])[index];
    if (raw !== null && (typeof raw !== 'number' || !Number.isFinite(raw))) throw new Error('Invalid USGS numeric scalar');
    const value = raw === null || (raw as number) <= 0 || (raw as number) >= 99999 ? null : raw as number;
    return { observedAtUtc, value };
  });
  const latestObservedAtUtc = [...samples].reverse().find(sample => sample.value !== null)?.observedAtUtc ?? null;
  const result: GroundReference = { stationId: station, stationName: typeof imo.name === 'string' ? imo.name.slice(0, 80) : station, latitude: coords[1], longitude: coords[0], sourceUrl, kind: 'MEASURED_LIVE', component: 'F', frame: 'SCALAR', unit: 'nT', status: 'variation', cadenceSeconds: 60, availableAtUtc: null, retrievedAtUtc: utc(retrievedAtUtc), generatedAtUtc: metadata.generated ? utc(metadata.generated) : null, latestObservedAtUtc, freshness: 'missing', sha256, samples };
  result.freshness = groundFreshness(result, retrievedAtUtc);
  return result;
}

export async function acquireGroundReference(station: GroundStationId, nowUtc = new Date().toISOString(), fetcher: typeof fetch = fetch): Promise<GroundReference> {
  const sourceUrl = groundSourceUrl(station, nowUtc);
  const response = await fetcher(sourceUrl, { cache: 'no-store', signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`USGS returned HTTP ${response.status}`);
  if (!response.body) throw new Error('USGS response has no body');
  const limit = 512_000, reader = response.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
  try { while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > limit) { await reader.cancel(); throw new Error('USGS response exceeds 512 KB limit'); } chunks.push(chunk.value); } } finally { reader.releaseLock(); }
  const raw = Buffer.concat(chunks); const data: unknown = JSON.parse(raw.toString('utf8'));
  return parseGroundReference(data, station, sourceUrl, new Date().toISOString(), createHash('sha256').update(raw).digest('hex'));
}

// Bounded warm-instance cache and deduplication; no persistent worker or background polling.
const cache = new Map<GroundStationId, { reference: GroundReference; at: number }>();
const pending = new Map<GroundStationId, Promise<GroundReference>>();
export async function getLiveGroundReference(station: GroundStationId): Promise<GroundReference> {
  const now = Date.now(), cached = cache.get(station);
  if (cached && now - cached.at < 60_000) return { ...cached.reference, freshness: groundFreshness(cached.reference, new Date(now).toISOString()) };
  const existing = pending.get(station); if (existing) return existing;
  const task = acquireGroundReference(station, new Date(now).toISOString()).then(reference => { cache.set(station, { reference, at: now }); return reference; }).finally(() => { pending.delete(station); });
  pending.set(station, task); return task;
}

/** Fixed allowlist, at most five cached 10-second probes; nearest fresh result wins. */
export async function getBestLiveGroundReference(order: GroundStationId[], loader = getLiveGroundReference, nowUtc = new Date().toISOString()): Promise<GroundResponse> {
  if (!order.length || order.length > GROUND_STATIONS.length || new Set(order).size !== order.length || order.some(id => !isGroundStation(id))) throw new Error('Invalid station order');
  const attempts = await Promise.allSettled(order.map(id => loader(id)));
  const errors: string[] = [];
  const candidates = attempts.flatMap((attempt, index) => {
    if (attempt.status === 'rejected') { errors.push(`${order[index]} refresh unavailable.`); return []; }
    const reference = { ...attempt.value, freshness: groundFreshness(attempt.value, nowUtc) };
    if (reference.stationId !== order[index] || reference.freshness === 'future' || reference.freshness === 'missing') { errors.push(`${order[index]} has no valid current reference.`); return []; }
    return [reference];
  });
  // Freshness precedes distance. If every live feed fails, retain actual old bytes with their original times.
  const retained = order.flatMap(id => { const entry = cache.get(id); return entry ? [{ ...entry.reference, freshness: groundFreshness(entry.reference, nowUtc) }] : []; }).filter(item => item.freshness !== 'future' && item.freshness !== 'missing');
  const fresh = candidates.find(item => item.freshness === 'fresh');
  const stale = [...candidates, ...retained].sort((a, b) => Date.parse(b.latestObservedAtUtc ?? '') - Date.parse(a.latestObservedAtUtc ?? ''))[0];
  const reference = fresh ?? stale ?? null;
  if (reference && reference.freshness !== 'fresh') errors.push(`Showing the latest verified ${reference.stationId} snapshot; its observations are ${reference.freshness}.`);
  if (!candidates.length && reference) errors.push('Live refresh failed; retained source timestamps are unchanged.');
  if (!reference) errors.push('Professional ground feeds could not be verified. NOAA upstream context remains a separate source.');
  return { reference, stations: GROUND_STATIONS, errors, selection: { mode: 'automatic', attemptedStationIds: order, fallback: reference !== null && reference.stationId !== order[0] } };
}
