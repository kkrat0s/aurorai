import { describe, expect, it } from 'vitest';
import {
  classifyMagneticDisturbance,
  createUserLearnedFingerprint,
  UNIVERSAL_FINGERPRINT_DATABASE,
  type MagneticSample,
} from './magnetic-classifier';

describe('Universal Magnetic Disturbance Classifier & Database', () => {
  const BASELINE_MAG = 48.0; // 48 µT typical mid-latitude Earth field

  it('contains complete physics metadata for all seven canonical disturbance classes', () => {
    const keys = Object.keys(UNIVERSAL_FINGERPRINT_DATABASE);
    expect(keys).toHaveLength(7);
    for (const key of keys) {
      const entry = UNIVERSAL_FINGERPRINT_DATABASE[key as keyof typeof UNIVERSAL_FINGERPRINT_DATABASE];
      expect(entry.name).toBeTruthy();
      expect(entry.howAiGuesses).toBeTruthy();
      expect(entry.physicsExplanation).toBeTruthy();
      expect(entry.solarStormComparison).toBeTruthy();
      expect(entry.mitigationAdvice).toBeTruthy();
      expect(entry.typicalDeltaNanoT[1]).toBeGreaterThan(entry.typicalDeltaNanoT[0]);
    }
  });

  it('classifies quiet resting sensor as CLEAN_GEOMAGNETIC_BASELINE', () => {
    const samples: MagneticSample[] = [];
    const t0 = 1000;
    for (let i = 0; i < 20; i++) {
      samples.push({
        x: 18.0 + Math.sin(i) * 0.04,
        y: -4.0 + Math.cos(i) * 0.03,
        z: 44.3 + Math.sin(i * 0.5) * 0.05,
        timestampMs: t0 + i * 100,
      });
    }

    const result = classifyMagneticDisturbance(samples, BASELINE_MAG);
    expect(result.predictedClass).toBe('CLEAN_GEOMAGNETIC_BASELINE');
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.aiReasoning).toContain('minimal');
  });

  it('classifies stationary 250-450 nT window sill excursion with hands off as GEOMAGNETIC_SOLAR_DISTURBANCE', () => {
    const samples: MagneticSample[] = [];
    const t0 = 1000;
    for (let i = 0; i < 20; i++) {
      // 350 nT scalar perturbation that is very slow/steady (0.01 µT/s)
      samples.push({
        x: 18.0 + 0.15,
        y: -4.0 + 0.10,
        z: 44.3 + 0.30 + Math.sin(i * 0.1) * 0.02,
        timestampMs: t0 + i * 100,
      });
    }

    const result = classifyMagneticDisturbance(samples, BASELINE_MAG, [], {
      isStandstill: true,
      isScreenTouched: false,
      motionState: 'STANDSTILL',
      isCharging: false,
    });

    expect(result.predictedClass).toBe('GEOMAGNETIC_SOLAR_DISTURBANCE');
    expect(result.confidence).toBeGreaterThan(0.40);
    expect(result.aiReasoning).toContain('solar storm ground perturbation');
    expect(result.metadata.shortLabel).toBe('Solar Storm Event');
  });

  it('classifies smooth 1.5 µT hand waving as HUMAN_HAND_GESTURE', () => {
    const samples: MagneticSample[] = [];
    const t0 = 1000;
    for (let i = 0; i < 20; i++) {
      const wave = Math.sin((i / 20) * Math.PI) * 1.6; // 0 to 1.6 µT excursion
      samples.push({
        x: 18.0 + wave * 0.55,
        y: -4.0 + wave * 0.45,
        z: 44.3 + wave * 0.7,
        timestampMs: t0 + i * 100,
      });
    }

    const result = classifyMagneticDisturbance(samples, BASELINE_MAG);
    expect(result.predictedClass).toBe('HUMAN_HAND_GESTURE');
    expect(result.confidence).toBeGreaterThan(0.45);
    expect(result.metadata.shortLabel).toBe('Human Hand');
    expect(result.aiReasoning).toContain('sinusoidal');
  });

  it('classifies sharp 20 µT smartwatch dipole as SMARTWATCH_OR_MAGNET', () => {
    const samples: MagneticSample[] = [];
    const t0 = 1000;
    for (let i = 0; i < 20; i++) {
      const spike = i > 8 ? Math.min(20.0, (i - 8) * 4.0) : 0;
      samples.push({
        x: 18.0 + (i > 8 ? 1.0 : 0),
        y: -4.0,
        z: 44.3 + spike,
        timestampMs: t0 + i * 100,
      });
    }

    const result = classifyMagneticDisturbance(samples, BASELINE_MAG);
    expect(result.predictedClass).toBe('SMARTWATCH_OR_MAGNET');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.solarStormSignalRatio).toBeGreaterThan(100);
    expect(result.aiReasoning).toContain('dipole');
  });

  it('classifies steady elevated field with high-frequency switching noise as LAPTOP_OR_COMPUTER', () => {
    const samples: MagneticSample[] = [];
    const t0 = 1000;
    for (let i = 0; i < 20; i++) {
      // High-frequency jitter on top of an 8 µT offset
      const jitter = ((i % 2 === 0 ? 1 : -1) * 0.8) + (Math.sin(i * 3) * 0.5);
      samples.push({
        x: 18.0 + 4.5 + jitter * 0.6,
        y: -4.0 + 3.2 + jitter * 0.4,
        z: 44.3 + 6.0 + jitter * 0.8,
        timestampMs: t0 + i * 100,
      });
    }

    const result = classifyMagneticDisturbance(samples, BASELINE_MAG);
    expect(['LAPTOP_OR_COMPUTER', 'CHARGING_CABLE_INDUCTION']).toContain(result.predictedClass);
  });

  it('allows user to confirm/teach a fingerprint and adapts scoring', () => {
    const samples: MagneticSample[] = [
      { x: 25, y: -4, z: 45, timestampMs: 1000 },
      { x: 26, y: -4, z: 46, timestampMs: 1100 },
    ];
    const initial = classifyMagneticDisturbance(samples, BASELINE_MAG);
    const userFp = createUserLearnedFingerprint(initial, 'CHARGING_CABLE_INDUCTION', 'My USB-C Fast Charger');
    expect(userFp.objectClassId).toBe('CHARGING_CABLE_INDUCTION');
    expect(userFp.userConfirmed).toBe(true);
    expect(userFp.customLabel).toBe('My USB-C Fast Charger');

    // Run classification with user learned fingerprint passed in
    const adapted = classifyMagneticDisturbance(samples, BASELINE_MAG, [userFp]);
    expect(adapted.scores.CHARGING_CABLE_INDUCTION).toBeGreaterThan(initial.scores.CHARGING_CABLE_INDUCTION);
  });

  it('uses screen touch to decisively corroborate human hand proximity', () => {
    const samples: MagneticSample[] = [];
    const t0 = 1000;
    for (let i = 0; i < 20; i++) {
      const wave = Math.sin((i / 20) * Math.PI) * 1.5;
      samples.push({
        x: 18.0 + wave * 0.5,
        y: -4.0 + wave * 0.5,
        z: 44.3 + wave * 0.6,
        timestampMs: t0 + i * 100,
      });
    }

    // With capacitive screen touch active
    const touchedResult = classifyMagneticDisturbance(samples, BASELINE_MAG, [], {
      isScreenTouched: true,
      motionState: 'HAND_TREMOR',
    });
    expect(touchedResult.predictedClass).toBe('HUMAN_HAND_GESTURE');
    expect(touchedResult.confidence).toBeGreaterThan(0.60);
    expect(touchedResult.aiReasoning).toContain('capacitive touchscreen contact');

    // With contactless hover (standstill, no touch)
    const hoverResult = classifyMagneticDisturbance(samples, BASELINE_MAG, [], {
      isScreenTouched: false,
      isStandstill: true,
      motionState: 'STANDSTILL',
    });
    expect(hoverResult.predictedClass).toBe('HUMAN_HAND_GESTURE');
    expect(hoverResult.aiReasoning).toContain('Contactless hand hover');
  });

  it('uses active charging hardware state to corroborate charging cable induction', () => {
    const samples: MagneticSample[] = [];
    const t0 = 1000;
    for (let i = 0; i < 20; i++) {
      // 10 µT offset with switching ripple
      const ripple = (i % 2 === 0 ? 0.3 : -0.3);
      samples.push({
        x: 18.0 + 5.0 + ripple,
        y: -4.0 + 3.0,
        z: 44.3 + 8.0,
        timestampMs: t0 + i * 100,
      });
    }

    const chargingResult = classifyMagneticDisturbance(samples, BASELINE_MAG, [], {
      isCharging: true,
      batteryState: 'CHARGING',
      isStandstill: true,
    });
    expect(chargingResult.predictedClass).toBe('CHARGING_CABLE_INDUCTION');
    expect(chargingResult.confidence).toBeGreaterThanOrEqual(0.60);
    expect(chargingResult.aiReasoning).toContain('active battery charging current flow');
  });

  it('penalizes quiet baseline when phone is actively in motion', () => {
    // Zero magnetic excursion
    const samples: MagneticSample[] = [];
    const t0 = 1000;
    for (let i = 0; i < 20; i++) {
      samples.push({
        x: 18.0,
        y: -4.0,
        z: 44.3,
        timestampMs: t0 + i * 100,
      });
    }

    // Motionless on desk
    const resting = classifyMagneticDisturbance(samples, BASELINE_MAG, [], {
      isStandstill: true,
      isScreenTouched: false,
      motionState: 'STANDSTILL',
    });
    expect(resting.predictedClass).toBe('CLEAN_GEOMAGNETIC_BASELINE');
    expect(resting.aiReasoning).toContain('completely standstill');

    // Phone being moved
    const moving = classifyMagneticDisturbance(samples, BASELINE_MAG, [], {
      isStandstill: false,
      isScreenTouched: true,
      motionState: 'ACTIVE_MOTION',
    });
    expect(moving.scores.CLEAN_GEOMAGNETIC_BASELINE).toBeLessThan(resting.scores.CLEAN_GEOMAGNETIC_BASELINE);
  });
});
