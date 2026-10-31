import { describe, expect, it } from 'vitest';
import { evaluateSessionPrescriptively } from './prescriptive-evaluator';
import { analyzeSensorSession, type SensorSession } from './sensor';

describe('Prescriptive Session Evaluator', () => {
  it('correctly rates clean 62 nT baseline as EXCELLENT placement and G3-G4 candidate storm', () => {
    // Construct synthetic session with 62 nT noise and 350 nT sustained excursion
    const samples: SensorSession['samples'] = [];
    const t0 = 1000;
    for (let i = 0; i < 1300; i++) {
      const isLate = i >= 1200;
      const drift = isLate ? -0.35 : 0.0;
      samples.push({
        x: 18.0 + (Math.sin(i * 0.7) * 0.04),
        y: -4.0 + (Math.cos(i * 0.7) * 0.03),
        z: 44.3 + drift + (Math.sin(i * 1.1) * 0.05),
        sensorTimestampSeconds: i * 0.1,
        receivedMonotonicMs: t0 + i * 100,
        receivedAtUtc: new Date(1730400000000 + i * 100).toISOString(),
        accelerationG: { x: 0.02, y: -0.01, z: -0.99 },
        accelerationAgeMs: 5,
      });
    }

    const session: SensorSession = {
      schemaVersion: 'aurorasense.sensor.v1',
      id: 'test-session-1',
      kind: 'MEASURED_LIVE',
      sourceId: 'AURORASENSE_PHONE',
      frame: 'DEVICE',
      unit: 'microT',
      startedAtUtc: new Date(1730400000000).toISOString(),
      endedAtUtc: new Date(1730400130000).toISOString(),
      utcAnchor: {
        sensorTimestampSeconds: 0,
        utc: new Date(1730400000000).toISOString(),
        uncertaintyMs: null,
      },
      nominalHz: 10,
      device: {
        platform: 'ios',
        model: 'iPhone 14 Pro Max',
        sensor: 'expo-sensors/Magnetometer',
        calibration: 'OS_CALIBRATED_ACCURACY_UNKNOWN',
      },
      consent: {
        adultConfirmed: true,
        recording: true,
        version: 'foreground-local-v1',
        atUtc: new Date(1730400000000).toISOString(),
      },
      stopReason: 'DURATION_COMPLETE',
      markers: [],
      samples,
    };

    const qc = analyzeSensorSession(session);
    const report = evaluateSessionPrescriptively(session, qc);

    expect(report.placementQuality.rating).toBe('EXCELLENT');
    expect(report.placementQuality.badgeText).toContain('EXCELLENT');
    expect(report.placementQuality.color).toBe('#20c997');
    expect(report.placementQuality.score).toBeGreaterThanOrEqual(80);

    expect(report.activityLevel.tier).toBe('G3_G4_SEVERE');
    expect(report.activityLevel.badgeText).toContain('G3–G4');
    expect(report.timelineStory).toHaveLength(3);
    expect(report.prescriptiveGuidance).toHaveLength(3);
  });
});
