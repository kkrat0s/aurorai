import { describe, expect, it } from 'vitest';
import { analyzeSensorSession, SENSOR_SCHEMA_VERSION, type SensorSession } from './sensor';
import { analyzeSessionEvidence } from './session-analysis';

function fixture(): SensorSession {
  const start = Date.parse('2026-11-04T20:00:00.000Z');
  return {
    schemaVersion: SENSOR_SCHEMA_VERSION, id: 'test-capture', kind: 'SYNTHETIC', sourceId: 'AURORASENSE_TEST_GENERATOR', frame: 'DEVICE', unit: 'microT',
    startedAtUtc: new Date(start).toISOString(), endedAtUtc: new Date(start + 300_000).toISOString(),
    utcAnchor: { sensorTimestampSeconds: 50, utc: new Date(start).toISOString(), uncertaintyMs: 20 }, nominalHz: 10,
    device: { platform: 'test', model: 'synthetic fixture', sensor: 'test', calibration: 'OS_CALIBRATED_ACCURACY_UNKNOWN' },
    consent: { adultConfirmed: true, recording: true, version: 'test', atUtc: new Date(start).toISOString() }, stopReason: 'TEST',
    markers: [
      { kind: 'INTERFERENCE_START', atUtc: new Date(start + 240_000).toISOString(), elapsedSeconds: 240 },
      { kind: 'SCREEN_INTERACTION', atUtc: new Date(start + 240_000).toISOString(), elapsedSeconds: 240, origin: 'MANUAL_TOUCH' },
      { kind: 'BATTERY_CHARGING', atUtc: new Date(start).toISOString(), elapsedSeconds: 0, origin: 'SYSTEM_EVENT' },
    ],
    samples: Array.from({ length: 3001 }, (_, index) => ({
      x: 28 + Math.sin(index / 20) * 0.002, y: 3 + Math.cos(index / 31) * 0.002,
      z: 39 + Math.sin(index / 17) * 0.002 + (index >= 2400 && index < 2420 ? 3 : 0),
      sensorTimestampSeconds: 50 + index / 10, receivedMonotonicMs: 1000 + index * 100,
      receivedAtUtc: new Date(start + index * 100).toISOString(), accelerationG: { x: 0, y: 0, z: 1 }, accelerationAgeMs: 0,
    })),
  };
}

describe('session evidence analysis', () => {
  it('summarizes the three device axes and keeps a marked local pulse as a QC event', () => {
    const session = fixture();
    const qc = analyzeSensorSession(session);
    const report = analyzeSessionEvidence(session, qc, { asOfUtc: '2026-11-04T20:06:00.000Z' });
    expect(report.version).toBe('session-evidence-0.1.0');
    expect(report.axes.map(axis => axis.axis)).toEqual(['x', 'y', 'z']);
    expect(report.axes[0].baselineMicroT).toBeCloseTo(28, 1);
    expect(qc.flags).toContain('LOCAL_INTERFERENCE');
    expect(report.flagIntervals.some(interval => interval.flags.includes('LOCAL_INTERFERENCE'))).toBe(true);
    expect(report.measurement.frame).toBe('DEVICE');
    expect(report.interpretation.interference).toContain('not a unique cause');
    expect(report.capturedContext.screenTouchMarkers).toBe(1);
    expect(report.capturedContext.qcFlaggedNearTouch).toBeGreaterThan(0);
    expect(report.capturedContext.latestBatteryState).toBe('CHARGING');
    expect(report.interpretation.reconnection).toContain('cannot establish reconnection');
  });

  it('does not invent a baseline or imply that missing sources were quiet', () => {
    const session = fixture();
    session.samples = session.samples.slice(0, 50);
    session.endedAtUtc = new Date(Date.parse(session.startedAtUtc) + 4_900).toISOString();
    const qc = analyzeSensorSession(session);
    const report = analyzeSessionEvidence(session, qc, { asOfUtc: '2026-11-04T20:01:00.000Z' });
    expect(report.axes.every(axis => axis.baselineMicroT === null && axis.p95AbsoluteDepartureNt === null)).toBe(true);
    expect(report.upstreamContext.status).toBe('UNAVAILABLE');
    expect(report.interpretation.solarDriver).toContain('No NOAA upstream');
    expect(report.capturedContext.contextNotCaptured).toContain('Wi-Fi, Bluetooth and cellular radio state or traffic');
    expect(report.groundComparison.regionalVerdict).toBe('INCONCLUSIVE');
    expect(report.nextMeasurements.some(action => action.includes('at least two minutes'))).toBe(true);
  });

  it('uses only the declared upstream context window and leaves propagation unshifted', () => {
    const session = fixture();
    const qc = analyzeSensorSession(session);
    const report = analyzeSessionEvidence(session, qc, {
      asOfUtc: '2026-11-04T20:06:00.000Z',
      upstream: {
        sourceUrl: 'https://example.test/noaa', retrievedAtUtc: '2026-11-04T20:06:00.000Z',
        samples: [
          { observedAtUtc: '2026-11-04T17:30:00.000Z', bzNt: -2, speedKmS: 420, densityCm3: 4 },
          { observedAtUtc: '2026-11-04T19:59:00.000Z', bzNt: -5, speedKmS: 430, densityCm3: 5 },
          { observedAtUtc: '2026-11-04T21:00:00.000Z', bzNt: -30, speedKmS: 900, densityCm3: 80 },
        ],
      },
    });
    expect(report.upstreamContext.sampleCount).toBe(1);
    expect(report.upstreamContext.medianBzNt).toBe(-5);
    expect(report.upstreamContext.propagationLagApplied).toBe(false);
    expect(report.interpretation.solarDriver).toContain('upstream context only');
  });

  it('keeps OVATION modeled activity separate and requires capture-time alignment', () => {
    const session = fixture();
    const qc = analyzeSensorSession(session);
    const report = analyzeSessionEvidence(session, qc, {
      asOfUtc: '2026-11-04T20:06:00.000Z', coarseLocation: { latitude: 40, longitude: -105, uncertaintyKm: 40 },
      ovation: { observedAtUtc: '2026-11-04T19:00:00.000Z', validAtUtc: '2026-11-04T19:30:00.000Z', retrievedAtUtc: '2026-11-04T19:00:05.000Z', sourceUrl: 'https://example.test/ovation', coordinates: [[255, 40, 65]] },
    });
    expect(report.auroraModel.status).toBe('NEAREST_CELL_CONTEXT');
    expect(report.auroraModel.activityPercent).toBe(65);
    expect(report.auroraModel.scope).toBe('MODELED_ACTIVITY_NOT_VISIBILITY_PROBABILITY');
    expect(report.auroraModel.nearestDistanceKm).toBeLessThan(50);
    const aligned = analyzeSessionEvidence(session, qc, {
      asOfUtc: '2026-11-04T20:06:00.000Z', coarseLocation: { latitude: 40, longitude: -105, uncertaintyKm: 40 },
      ovation: { observedAtUtc: '2026-11-04T20:00:00.000Z', validAtUtc: '2026-11-04T20:03:00.000Z', coordinates: [[255, 40, 65]] },
    });
    expect(aligned.auroraModel.status).toBe('VALID_DURING_CAPTURE');
  });

  it('reports descriptive phone–USGS alignment without upgrading regional verdict', () => {
    const session = fixture();
    // Generated test fixture exercises the comparison route; it is not stored or presented as phone measurement evidence.
    session.kind = 'MEASURED_LIVE'; session.sourceId = 'AURORASENSE_PHONE';
    session.markers = [];
    const start = Date.parse(session.startedAtUtc);
    session.endedAtUtc = new Date(start + 600_000).toISOString();
    session.samples = Array.from({ length: 6001 }, (_, index) => ({
      x: 28 + Math.sin(index/20)*0.002, y: 3 + Math.cos(index/31)*0.002, z: 39 + Math.sin(index/17)*0.002,
      sensorTimestampSeconds: 50 + index/10, receivedMonotonicMs: 1000 + index*100,
      receivedAtUtc: new Date(start + index*100).toISOString(), accelerationG: { x: 0, y: 0, z: 1 }, accelerationAgeMs: 0,
    }));
    const qc = analyzeSensorSession(session);
    const reference = {
      stationId: 'BOU' as const, stationName: 'Boulder, Colorado', latitude: 40.1375, longitude: -105.2372,
      sourceUrl: 'https://example.test/usgs', kind: 'MEASURED_LIVE' as const, component: 'F' as const,
      frame: 'SCALAR' as const, unit: 'nT' as const, status: 'variation' as const, cadenceSeconds: 60 as const,
      availableAtUtc: null, retrievedAtUtc: '2026-11-04T20:10:00.000Z', generatedAtUtc: null,
      latestObservedAtUtc: '2026-11-04T20:09:00.000Z', freshness: 'fresh' as const, sha256: 'test-hash',
      samples: Array.from({ length: 10 }, (_, minute) => ({ observedAtUtc: new Date(start + minute*60_000).toISOString(), value: 48_000 + Math.sin(minute/2)*20 })),
    };
    const report = analyzeSessionEvidence(session, qc, { asOfUtc: '2026-11-04T20:10:00.000Z', reference, coarseLocation: { latitude: 40.1375, longitude: -105.2372, uncertaintyKm: 1 } });
    expect(report.groundComparison.status).toBe('DESCRIPTIVE_COMPARISON');
    expect(report.groundComparison.aligned).toHaveLength(10);
    expect(report.groundComparison.regionalVerdict).toBe('INCONCLUSIVE');
    expect(report.interpretation.geomagneticResponse).toContain('not independent regional confirmation');
  });
});
