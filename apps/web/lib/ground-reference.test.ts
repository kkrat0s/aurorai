import { describe, expect, it } from 'vitest';
import { acquireGroundReference, getBestLiveGroundReference, groundSourceUrl, parseGroundReference } from './ground-reference';
import { coarseLocationFromCoordinates, comparePhoneWithReference, groundFreshness, rankGroundStations } from '@aurorasense/shared/ground-reference';
import { analyzeSensorSession, type SensorSession } from '@aurorasense/shared/sensor';
import { GET } from '../app/api/ground/route';

const now = '2026-11-04T12:00:00.000Z';
const url = groundSourceUrl('BOU', now), sha = 'a'.repeat(64);
function source() {
  return { metadata: { status: 200, generated: now, intermagnet: { imo: { iaga_code: 'BOU', name: 'Boulder', coordinates: [-105.237, 40.137, 1682] }, reported_orientation: 'F', data_type: 'variation', sampling_period: 60 } }, times: Array.from({ length: 8 }, (_, i) => new Date(Date.parse(now) - 10 * 60_000 + i * 60_000).toISOString()), values: [{ id: 'F', metadata: { station: 'BOU', element: 'F' }, values: Array.from({ length: 8 }, (_, i) => 51000 + i * 2) as (number | null)[] }] };
}
function phone(): SensorSession {
  const start = new Date(Date.parse(now) - 10 * 60_000).toISOString();
  return { schemaVersion: 'aurorasense.sensor.v1', id: 'test-phone', kind: 'MEASURED_LIVE', sourceId: 'AURORASENSE_PHONE', frame: 'DEVICE', unit: 'microT', startedAtUtc: start, endedAtUtc: null, utcAnchor: { sensorTimestampSeconds: 0, utc: start, uncertaintyMs: 100 }, nominalHz: 10, device: { platform: 'TEST', model: null, sensor: 'TEST_GENERATED', calibration: 'OS_CALIBRATED_ACCURACY_UNKNOWN' }, consent: { adultConfirmed: true, recording: true, version: 'test', atUtc: start }, markers: [], stopReason: null, samples: Array.from({ length: 4800 }, (_, i) => ({ x: 0, y: 0, z: 50 + i / 600 * 0.002, sensorTimestampSeconds: i / 10, receivedMonotonicMs: i * 100, receivedAtUtc: new Date(Date.parse(start) + i * 100).toISOString(), accelerationG: { x: 0, y: 0, z: 1 }, accelerationAgeMs: 0 })) };
}
describe('USGS live scalar reference', () => {
  it('preserves actual station metadata, units, source bytes hash, missing and latest valid time', () => {
    const data = source(); data.values[0].values[7] = null;
    const result = parseGroundReference(data, 'BOU', url, now, sha);
    expect(result.samples[7].value).toBeNull(); expect(result.latestObservedAtUtc).toBe(data.times[6]);
    expect(result).toMatchObject({ unit: 'nT', frame: 'SCALAR', availableAtUtc: null, status: 'variation', sha256: sha, freshness: 'fresh' });
  });
  it('never changes stale, future, empty or sentinel records into current values', () => {
    const data = source(); data.values[0].values = [99999, -99999, null, null, null, null, null, null];
    expect(parseGroundReference(data, 'BOU', url, now, sha).freshness).toBe('missing');
    expect(groundFreshness({ latestObservedAtUtc: '2026-11-04T11:40:00Z' }, now)).toBe('stale');
    expect(groundFreshness({ latestObservedAtUtc: '2026-11-04T12:02:00Z' }, now)).toBe('future');
  });
  it('rejects station/component/cadence/time spoofing and misaligned arrays', () => {
    const wrongStation = source(); wrongStation.metadata.intermagnet.imo.iaga_code = 'FRD'; expect(() => parseGroundReference(wrongStation, 'BOU', url, now, sha)).toThrow();
    const wrongFrame = source(); wrongFrame.metadata.intermagnet.reported_orientation = 'Z'; expect(() => parseGroundReference(wrongFrame, 'BOU', url, now, sha)).toThrow();
    const missing = source(); missing.values[0].values.pop(); expect(() => parseGroundReference(missing, 'BOU', url, now, sha)).toThrow();
    const duplicate = source(); duplicate.times[1] = duplicate.times[0]; expect(() => parseGroundReference(duplicate, 'BOU', url, now, sha)).toThrow();
    const noUtc = source(); noUtc.times[0] = '2026-11-04T11:50:00'; expect(() => parseGroundReference(noUtc, 'BOU', url, now, sha)).toThrow();
    expect(() => parseGroundReference(source(), 'BOU', url.replace('geomag.usgs.gov', 'example.com'), now, sha)).toThrow();
    expect(() => parseGroundReference(source(), 'BOU', url.replace('sampling_period=60', 'sampling_period=1'), now, sha)).toThrow();
    const invalidCalendar = source(); invalidCalendar.times[0] = '2026-02-30T11:50:00Z'; expect(() => parseGroundReference(invalidCalendar, 'BOU', url, now, sha)).toThrow();
  });
  it('rejects unknown stations and unbounded API inputs before remote acquisition', async () => {
    for (const query of ['station=INVALID', 'station=BOU&station=FRD', 'station=BOU&starttime=1900-01-01', 'url=https://example.com', 'stations=BOU,INVALID', 'stations=BOU,BOU', 'stations=BOU&station=FRD', 'stations=BOU&latitude=28', 'stations=']) {
      const response = await GET(new Request(`http://localhost/api/ground?${query}`));
      expect(response.status).toBe(400); expect((await response.json()).reference).toBeNull();
    }
  });
  it('bounds remote payload before parsing and returns no fabricated fallback', async () => {
    const fetcher = (async () => new Response('a'.repeat(512_001))) as typeof fetch;
    await expect(acquireGroundReference('BOU', now, fetcher)).rejects.toThrow('512 KB');
    await expect(acquireGroundReference('BOU', now, (async () => new Response('', { status: 503 })) as typeof fetch)).rejects.toThrow('503');
  });
});
describe('automatic location and reference selection', () => {
  it('discards precise coordinates and rejects invalid or very inaccurate fixes', () => {
    expect(coarseLocationFromCoordinates(28.12345, -81.98765, 100)).toEqual({ latitude: 28, longitude: -82, uncertaintyKm: 40.1 });
    expect(coarseLocationFromCoordinates(NaN, 0)).toBeUndefined();
    expect(coarseLocationFromCoordinates(91, 0)).toBeUndefined();
    expect(coarseLocationFromCoordinates(28, -82, 50_001)).toBeUndefined();
  });
  it('ranks known public stations using geography, never a fixed Boulder default for a known region', () => {
    expect(rankGroundStations({ latitude: 28, longitude: -82 })[0]).toBe('BSL');
    expect(rankGroundStations({ latitude: 65, longitude: -148 })[0]).toBe('CMO');
    expect(rankGroundStations()).toHaveLength(5);
  });
  it('tries the bounded station list and selects a fresh fallback over a closer stale source', async () => {
    const reference = parseGroundReference(source(), 'BOU', url, now, sha);
    const calls: string[] = [];
    const result = await getBestLiveGroundReference(['BSL', 'FRD', 'BOU'], async station => {
      calls.push(station);
      if (station === 'BSL') throw new Error('Offline');
      return { ...reference, stationId: station, latestObservedAtUtc: station === 'FRD' ? '2026-11-04T10:00:00Z' : reference.latestObservedAtUtc };
    }, now);
    expect(calls).toEqual(['BSL', 'FRD', 'BOU']); expect(result.reference?.stationId).toBe('BOU'); expect(result.selection?.fallback).toBe(true); expect(result.errors).toContain('BSL refresh unavailable.');
  });
  it('does not turn failed, missing or future references into available observations', async () => {
    const reference = parseGroundReference(source(), 'BOU', url, now, sha);
    const result = await getBestLiveGroundReference(['BOU'], async () => ({ ...reference, latestObservedAtUtc: '2026-11-05T12:00:00Z' }), now);
    expect(result.reference).toBeNull();
    await expect(getBestLiveGroundReference(['BOU', 'BOU'])).rejects.toThrow('Invalid station order');
  });
  it('keeps location uncertainty in the local comparison boundary', () => {
    const session = phone(), qc = analyzeSensorSession(session), reference = parseGroundReference(source(), 'BOU', url, now, sha);
    expect(comparePhoneWithReference(session, qc, reference, now, { latitude: 40, longitude: -105, uncertaintyKm: 501 }).correlation).toBeNull();
  });
});
describe('UTC-aligned phone/ground descriptive comparison (test-generated inputs)', () => {
  it('uses µT→nT scalar magnitudes and reports known aligned agreement without regional support', () => {
    const session = phone(), qc = analyzeSensorSession(session), reference = parseGroundReference(source(), 'BOU', url, now, sha);
    expect(qc.accepted).toBe(true);
    const result = comparePhoneWithReference(session, qc, reference, now, { latitude: 40, longitude: -105 });
    expect(result.status).toBe('DESCRIPTIVE_COMPARISON'); expect(result.correlation).toBeCloseTo(1, 8); expect(result.aligned).toHaveLength(8);
    expect(result.aligned[7].phoneDeltaNt).toBeCloseTo(result.aligned[7].referenceDeltaNt, 6); expect(result.regionalVerdict).toBe('INCONCLUSIVE');
  });
  it('blocks synthetic, rejected, absent and wrong-period data', () => {
    const session = phone(), qc = analyzeSensorSession(session), reference = parseGroundReference(source(), 'BOU', url, now, sha);
    expect(comparePhoneWithReference(null, null, reference, now).status).toBe('NO_PHONE');
    expect(comparePhoneWithReference(session, qc, null, now).status).toBe('NO_REFERENCE');
    expect(comparePhoneWithReference({ ...session, kind: 'SYNTHETIC' }, qc, reference, now).correlation).toBeNull();
    expect(comparePhoneWithReference(session, { ...qc, accepted: false }, reference, now).status).toBe('QC_REJECTED');
    expect(comparePhoneWithReference(session, qc, { ...reference, samples: reference.samples.map(s => ({ ...s, observedAtUtc: s.observedAtUtc.replace('2026-', '2024-') })) }, now).status).toBe('NO_OVERLAP');
  });
  it('never correlates sparse bursts, gaps, unknown distance or a far-away station', () => {
    const session = phone(), qc = analyzeSensorSession(session), reference = parseGroundReference(source(), 'BOU', url, now, sha);
    const partial = { ...qc, sampleResults: qc.sampleResults.map((s, i) => ({ ...s, usable: i % 600 < 100 })) };
    expect(comparePhoneWithReference(session, partial, reference, now).status).toBe('NO_OVERLAP');
    expect(comparePhoneWithReference(session, qc, { ...reference, samples: reference.samples.filter((_, i) => i !== 3) }, now).status).toBe('INSUFFICIENT_COVERAGE');
    expect(comparePhoneWithReference(session, qc, reference, now).correlation).toBeNull();
    expect(comparePhoneWithReference(session, qc, reference, now, { latitude: 29, longitude: -81 }).status).toBe('CONTEXT_ONLY');
  });
  it('blocks unknown clock precision, stale references and constant-series false agreement', () => {
    const session = phone(), qc = analyzeSensorSession(session), reference = parseGroundReference(source(), 'BOU', url, now, sha), near = { latitude: 40, longitude: -105 };
    expect(comparePhoneWithReference({ ...session, utcAnchor: null }, qc, reference, now, near).correlation).toBeNull();
    expect(comparePhoneWithReference(session, qc, reference, '2026-11-04T15:00:00Z', near).correlation).toBeNull();
    expect(comparePhoneWithReference(session, qc, { ...reference, samples: reference.samples.map(s => ({ ...s, value: 51000 })) }, now, near).correlation).toBeNull();
    expect(comparePhoneWithReference(session, qc, reference, 'invalid', near).correlation).toBeNull();
    expect(comparePhoneWithReference(session, qc, reference, '2026-11-04T11:56:00Z', near).correlation).toBeNull();
    expect(comparePhoneWithReference({ ...session, utcAnchor: { ...session.utcAnchor!, uncertaintyMs: NaN } }, qc, reference, now, near).correlation).toBeNull();
  });
});
