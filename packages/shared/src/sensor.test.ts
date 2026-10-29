import { describe, expect, it } from 'vitest';
import { analyzeSensorSession, microteslaToNanotesla, parseSensorSession, SENSOR_SCHEMA_VERSION, sessionToCsv, type SensorSession } from './sensor';

/** All values in this file are generated unit-test inputs, never physical measurements. */
function testSession(): SensorSession {
  const start = Date.parse('2026-10-28T15:00:00Z');
  return {
    schemaVersion: SENSOR_SCHEMA_VERSION, id: 'synthetic-unit-test', kind: 'SYNTHETIC', sourceId: 'AURORASENSE_TEST_GENERATOR', frame: 'DEVICE', unit: 'microT',
    startedAtUtc: new Date(start).toISOString(), endedAtUtc: new Date(start + 300_000).toISOString(),
    utcAnchor: { sensorTimestampSeconds: 100, utc: new Date(start).toISOString(), uncertaintyMs: null }, nominalHz: 10,
    device: { platform: 'test', model: null, sensor: 'TEST_GENERATOR', calibration: 'OS_CALIBRATED_ACCURACY_UNKNOWN' },
    consent: { adultConfirmed: true, recording: true, version: 'test-consent', atUtc: new Date(start).toISOString() }, stopReason: 'test', markers: [],
    samples: Array.from({ length: 3001 }, (_, i) => ({ x: 30, y: 0, z: 40 + Math.sin(i / 7) * 0.015, sensorTimestampSeconds: 100 + i / 10, receivedMonotonicMs: 2000 + i * 100, receivedAtUtc: new Date(start + i * 100).toISOString(), accelerationG: { x: 0, y: 0, z: 1 }, accelerationAgeMs: 0 })),
  };
}

describe('phone QC scientific invariants', () => {
  it('preserves device frame and converts microtesla to nanotesla exactly', () => {
    expect(microteslaToNanotesla(1)).toBe(1000);
    expect(microteslaToNanotesla(-0.5)).toBe(-500);
    expect(() => microteslaToNanotesla(NaN)).toThrow();
    const result = analyzeSensorSession(testSession());
    expect(result.frame).toBe('DEVICE');
    expect(result.regionalVerdict).toBe('INCONCLUSIVE');
    expect(result.accepted).toBe(true);
    expect(result.actualHz).toBeCloseTo(10);
    expect(result.sampleResults[100].observedAtUtc).toBe('2026-10-28T15:00:10.000Z');
  });
  it('rejects a local pulse from usable high-water marks without claiming aurora', () => {
    const session = testSession();
    for (let i = 1600; i < 1700; i++) session.samples[i].z += 20;
    const result = analyzeSensorSession(session);
    expect(result.sampleResults[1650].flags).toContain('LOCAL_INTERFERENCE');
    expect(result.sampleResults[1650].usable).toBe(false);
    expect(result.accepted).toBe(false);
    expect(result.regionalVerdict).toBe('INCONCLUSIVE');
    expect(result.highWater[0].maximumAbsoluteDeltaNt).toBeLessThan(30);
    expect(result.highWater[0].observedCoverageSeconds).toBeLessThan(290);
    expect(result.highWater.every((window) => !window.completeWindow)).toBe(true);
  });
  it('flags rotation even when magnitude is unchanged', () => {
    const session = testSession();
    session.samples[1800] = { ...session.samples[1800], x: 0, y: 30, z: 40 };
    const result = analyzeSensorSession(session);
    expect(result.sampleResults[1800].magnitudeMicroT).toBe(50);
    expect(result.sampleResults[1800].flags).toContain('ORIENTATION_CHANGED');
    expect(result.sampleResults[1800].usable).toBe(false);
  });
  it('flags motion, absent motion measurements and possible range failure', () => {
    const session = testSession();
    session.samples[1500].accelerationG = { x: 0.2, y: 0, z: 1 };
    session.samples[1501].accelerationG = null;
    session.samples[1502].x = 2500;
    session.samples[1503].accelerationAgeMs = 501;
    const result = analyzeSensorSession(session);
    expect(result.sampleResults[1500].flags).toContain('MOTION');
    expect(result.sampleResults[1501].flags).toContain('MOTION_UNKNOWN');
    expect(result.sampleResults[1502].flags).toContain('SATURATION_SUSPECT');
    expect(result.sampleResults[1503].flags).toContain('MOTION_UNKNOWN');
  });
  it('fails closed on invalid samples, duplicate time, clock jumps and missing consent', () => {
    const session = testSession();
    session.samples[1500].x = NaN;
    session.samples[1501].sensorTimestampSeconds = session.samples[1500].sensorTimestampSeconds;
    session.samples[1502].receivedAtUtc = '2026-10-28T15:06:00Z';
    session.consent.adultConfirmed = false;
    const result = analyzeSensorSession(session);
    expect(result.accepted).toBe(false);
    expect(result.flags).toEqual(expect.arrayContaining(['NON_FINITE', 'NON_MONOTONIC_TIME', 'CLOCK_DISCONTINUITY', 'CONSENT_MISSING']));
  });
  it('shows short or missing baseline as pending, with no manufactured baseline', () => {
    const session = testSession();
    session.samples = session.samples.slice(0, 100);
    const result = analyzeSensorSession(session);
    expect(result.baselineMicroT).toBeNull();
    expect(result.noiseMadNt).toBeNull();
    expect(result.accepted).toBe(false);
    expect(result.flags).toContain('BASELINE_PENDING');
    session.samples = [];
    expect(analyzeSensorSession(session).flags).toContain('EMPTY');
  });
  it('does not count missing time as measured coverage', () => {
    const session = testSession();
    session.samples.splice(1700, 300);
    const result = analyzeSensorSession(session);
    expect(result.flags).toContain('SAMPLE_GAP');
    expect(result.highWater[0].observedCoverageSeconds).toBeLessThan(270);
    expect(result.highWater[0].completeWindow).toBe(false);
    expect(result.actualHz).toBeLessThan(10);
  });
  it('does not infer two minutes of baseline from sparse timestamps', () => {
    const session = testSession();
    session.samples.splice(120, 1080);
    const result = analyzeSensorSession(session);
    expect(result.baselineCoverageSeconds).toBeLessThan(12);
    expect(result.baselineMicroT).toBeNull();
    expect(result.accepted).toBe(false);
  });
  it('rejects contaminated baseline instead of learning artifact-sized tolerances', () => {
    const session = testSession();
    session.samples.forEach((sample, index) => { if (index < 1200) sample.z += Math.sin(index) * 5; });
    const result = analyzeSensorSession(session);
    expect(result.flags).toContain('NOISY_BASELINE');
    expect(result.accepted).toBe(false);
  });
  it('keeps raw inputs immutable and produces deterministic QC and labeled CSV', () => {
    const session = testSession(); const before = JSON.stringify(session);
    expect(analyzeSensorSession(session)).toEqual(analyzeSensorSession(session));
    expect(JSON.stringify(session)).toBe(before);
    const csv = sessionToCsv(session);
    expect(csv).toContain('x_microT,y_microT,z_microT');
    expect(csv).toContain('SYNTHETIC,DEVICE');
  });
});

describe('untrusted session import', () => {
  it('round-trips supported exports and drops unknown precise location fields', () => {
    const session = testSession();
    const result = parseSensorSession({ ...session, exactLatitude: 10, exactLongitude: 20 });
    expect(result).toEqual(session);
    expect(result).not.toHaveProperty('exactLatitude');
  });
  it('rejects units, nonfinite values, malformed times, mismatched provenance and oversized input', () => {
    const session = testSession();
    expect(() => parseSensorSession({ ...session, unit: 'nT' })).toThrow();
    expect(() => parseSensorSession({ ...session, kind: 'MEASURED_LIVE' })).toThrow();
    expect(() => parseSensorSession({ ...session, startedAtUtc: 'yesterday' })).toThrow();
    expect(() => parseSensorSession({ ...session, startedAtUtc: '2024-02-30T00:00:00Z' })).toThrow();
    expect(() => parseSensorSession({ ...session, samples: Array(20_001).fill(session.samples[0]) })).toThrow();
    session.samples[0].x = Infinity;
    expect(() => parseSensorSession(session)).toThrow();
  });
});
