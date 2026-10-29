import { describe, expect, it } from 'vitest';
import { analyzeInteractionContext, dueExperimentCues, EXPERIMENT_PLAN, experimentInstruction, scheduledMarker } from './experiment';
import { analyzeSensorSession, parseSensorSession, type SensorSession } from './sensor';

/** Synthetic software inputs only. No empirical sensor noise. */
function generatedSession(): SensorSession {
  const anchor = Date.parse('2026-10-28T12:00:00Z');
  return {
    schemaVersion: 'aurorasense.sensor.v1', id: 'generated-interaction-test', kind: 'SYNTHETIC', sourceId: 'AURORASENSE_TEST_GENERATOR', frame: 'DEVICE', unit: 'microT',
    startedAtUtc: new Date(anchor).toISOString(), endedAtUtc: new Date(anchor + 200_000).toISOString(), utcAnchor: { utc: new Date(anchor).toISOString(), sensorTimestampSeconds: 0, uncertaintyMs: null }, nominalHz: 10,
    device: { platform: 'test', model: null, sensor: 'TEST_GENERATOR', calibration: 'OS_CALIBRATED_ACCURACY_UNKNOWN' },
    consent: { adultConfirmed: true, recording: true, version: 'test', atUtc: new Date(anchor).toISOString() }, stopReason: 'TEST',
    markers: [{ kind: 'SCREEN_INTERACTION', atUtc: new Date(anchor + 150_000).toISOString(), elapsedSeconds: 150, origin: 'MANUAL_TOUCH' }],
    samples: Array.from({ length: 2001 }, (_, index) => ({ x: 30, y: 0, z: 40, sensorTimestampSeconds: index / 10, receivedMonotonicMs: index * 100, receivedAtUtc: new Date(anchor + index * 100).toISOString(), accelerationG: { x: 0, y: 0, z: 1 }, accelerationAgeMs: 0 })),
  };
}

describe('prospective hands-free experiment and interaction annotations', () => {
  it('emits each cue once and never before the fixed scheduled time', () => {
    const emitted = new Set<string>();
    for (let time = 0; time < 600; time++) {
      for (const cue of dueExperimentCues(time, emitted)) {
        expect(time).toBe(cue.seconds);
        emitted.add(cue.kind);
      }
    }
    expect(emitted.size).toBe(4);
    expect(dueExperimentCues(NaN, emitted)).toEqual([]);
    expect(dueExperimentCues(-1, emitted)).toEqual([]);
  });
  it('records actual delivery time separately from planned action time', () => {
    const marker = scheduledMarker(EXPERIMENT_PLAN[0], '2026-10-28T12:03:03Z', 183);
    expect(marker).toMatchObject({ origin: 'SCHEDULED_CUE', scheduledSeconds: 180, elapsedSeconds: 183 });
    expect(experimentInstruction(0)).toContain('untouched');
    expect(experimentInstruction(185)).toContain('Remove');
    expect(experimentInstruction(305)).toContain('Hands away');
  });
  it('annotates a bounded touch interval without accepting or removing its pulse', () => {
    const session = generatedSession();
    session.samples[1500].z += 20;
    session.samples[1700].z += 20;
    const qc = analyzeSensorSession(session);
    const snapshot = JSON.stringify(qc);
    const context = analyzeInteractionContext(session, qc);
    expect(context.samplesNearTouch).toBe(41);
    expect(context.flaggedNearTouch).toBe(2);
    expect(context.flaggedAwayFromTouch).toBe(2);
    expect(qc.accepted).toBe(false);
    expect(qc.sampleResults[1500].flags).toContain('LOCAL_INTERFERENCE');
    expect(JSON.stringify(qc)).toBe(snapshot);
    expect(context.usableCoverageAwayFromTouchSeconds).toBeLessThan(196);
  });
  it('does not classify scheduled cues or legacy markers as manual touches', () => {
    const session = generatedSession();
    session.markers[0].origin = 'SCHEDULED_CUE';
    session.markers[0].scheduledSeconds = 150;
    session.markers.push({ kind: 'MOTION_START', atUtc: session.startedAtUtc, elapsedSeconds: 0 });
    const context = analyzeInteractionContext(session, analyzeSensorSession(session));
    expect(context.samplesNearTouch).toBe(0);
    expect(context.scheduledCues).toBe(1);
    expect(context.unclassifiedMarkers).toBe(1);
  });
  it('sanitizes optional marker metadata and rejects invented origins/schedules', () => {
    const session = generatedSession();
    session.experimentProtocol = 'hands-free-protocol-0.1.0';
    expect(parseSensorSession(session)).toEqual(session);
    const corrupt = JSON.parse(JSON.stringify(session));
    corrupt.markers[0].origin = 'VERIFIED_ACTION';
    expect(() => parseSensorSession(corrupt)).toThrow('origin');
    corrupt.markers[0].origin = 'MANUAL_TOUCH'; corrupt.markers[0].scheduledSeconds = 150;
    expect(() => parseSensorSession(corrupt)).toThrow('schedule');
  });
  it('counts overlapping touch windows once and refuses mismatched QC rows', () => {
    const session = generatedSession();
    session.markers.push({ ...session.markers[0] });
    const qc = analyzeSensorSession(session);
    expect(analyzeInteractionContext(session, qc).samplesNearTouch).toBe(41);
    expect(() => analyzeInteractionContext(session, { ...qc, sampleResults: [] })).toThrow('match');
  });
});
