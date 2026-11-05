import { describe, expect, it } from 'vitest';
import { classifyMagneticDisturbance, createUserLearnedFingerprint, type DevicePhysicalContext } from './magnetic-classifier';
import { canPresentMagneticDetection, hasSalientMagneticChange, magneticGuessCopy } from '../../../apps/mobile/detection-presentation';

const context: DevicePhysicalContext = {
  isStandstill: true, motionState: 'STANDSTILL', isScreenTouched: false,
  batteryState: 'UNPLUGGED', isCharging: false, sampleKind: 'SYNTHETIC',
};
const trace = (start = 0, amplitude = 0.7) => Array.from({ length: 25 }, (_, i) => ({
  x: 0, y: 0, z: 50 + amplitude * i / 24, timestampMs: start + i * 100,
}));

describe('minimal event-driven pattern presentation', () => {
  it('stays quiet for baseline readings and does not treat a screen touch as an object detection', () => {
    const quiet = classifyMagneticDisturbance(trace(0, 0.01), 50, [], context);
    expect(hasSalientMagneticChange(quiet, 10, true)).toBe(false);
    expect(canPresentMagneticDetection(quiet, 10, true, true)).toBe(false);
    // A classifier/latest-reading mismatch must not offer to teach a quiet baseline as an object.
    expect(canPresentMagneticDetection(quiet, 900, true, false)).toBe(false);
  });

  it('allows an ephemeral guess card only for an eligible salient unknown event', () => {
    const unknown = classifyMagneticDisturbance(trace(), 50, [], context);
    expect(unknown.predictedClass).toBe('UNKNOWN_UNCLASSIFIED');
    expect(canPresentMagneticDetection(unknown, 700, true, false)).toBe(true);
    expect(magneticGuessCopy(unknown.predictedClass)).toMatchObject({ headline: 'Magnetic mystery' });
    expect(canPresentMagneticDetection(unknown, 100, true, false)).toBe(false);
  });

  it('gives one playful, cautious guess for a heuristic candidate without claiming identity', () => {
    expect(magneticGuessCopy('SMARTWATCH_OR_MAGNET')).toEqual({
      headline: 'Maybe a watch or magnet',
      playfulLine: 'Something small and magnetic just entered the plot. I cannot tell which object it is.',
    });
    expect(magneticGuessCopy('CHARGING_CABLE_INDUCTION').playfulLine).toContain('unplugged');
  });

  it('retains deterministic fingerprint matching in the shared classifier, outside the demo UI', () => {
    const example = classifyMagneticDisturbance(trace(), 50, [], context);
    const learned = createUserLearnedFingerprint(example, 'UNKNOWN_UNCLASSIFIED', 'Desk fan');
    const repeat = classifyMagneticDisturbance(trace(10000), 50, [learned], context);
    expect(repeat.learningMatch?.label).toBe('Desk fan');
    expect(canPresentMagneticDetection(repeat, 700, true, false)).toBe(true);
    expect(magneticGuessCopy(repeat.predictedClass).headline).toBe('Magnetic mystery');
  });

  it('does not present a guess for missing data or touch-contaminated windows', () => {
    const unknown = classifyMagneticDisturbance(trace(), 50, [], context);
    const touched = classifyMagneticDisturbance(trace(), 50, [], { ...context, timeSinceLastTouchMs: 100 });
    expect(canPresentMagneticDetection(unknown, 700, false, false)).toBe(false);
    expect(canPresentMagneticDetection(unknown, NaN, true, false)).toBe(false);
    expect(canPresentMagneticDetection(unknown, 700, true, true)).toBe(false);
    expect(canPresentMagneticDetection(touched, 700, true, false)).toBe(false);
    expect(canPresentMagneticDetection(classifyMagneticDisturbance([], 50), 700, true, false)).toBe(false);
  });
});
