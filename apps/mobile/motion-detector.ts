import type { DeviceMotionState } from '@aurorasense/shared/magnetic-classifier';

export interface AccelSample {
  x: number;
  y: number;
  z: number;
  timestampMs: number;
}

export interface MotionAnalysis {
  isStandstill: boolean;
  motionState: DeviceMotionState;
  accelVarianceG: number;
  isFlatOnSurface: boolean;
  dynamicAccelG: number;
  tiltDegrees: number;
}

/**
 * Real-time accelerometer motion classifier.
 * Distinguishes motionless resting on a table from subtle hand micro-tremor
 * and active macro device motion.
 */
export class RealtimeMotionDetector {
  private buffer: AccelSample[] = [];
  private maxBufferSize: number;

  constructor(maxBufferSize = 20) {
    this.maxBufferSize = maxBufferSize;
  }

  public pushSample(x: number, y: number, z: number, timestampMs: number): void {
    this.buffer.push({ x, y, z, timestampMs });
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  public analyze(): MotionAnalysis {
    if (this.buffer.length < 3) {
      return {
        isStandstill: true,
        motionState: 'STANDSTILL',
        accelVarianceG: 0.01,
        isFlatOnSurface: true,
        dynamicAccelG: 0.01,
        tiltDegrees: 0,
      };
    }

    const latest = this.buffer[this.buffer.length - 1];
    const latestMag = Math.sqrt(latest.x * latest.x + latest.y * latest.y + latest.z * latest.z);

    // Compute mean norm and variance over window
    let magSum = 0;
    for (const s of this.buffer) {
      magSum += Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
    }
    const meanMag = magSum / this.buffer.length;

    let varSum = 0;
    let maxDyn = 0;
    for (const s of this.buffer) {
      const mag = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
      varSum += (mag - meanMag) * (mag - meanMag);
      const dyn = Math.abs(mag - 1.0);
      if (dyn > maxDyn) maxDyn = dyn;
    }
    const variance = varSum / this.buffer.length;
    const stdDev = Math.sqrt(variance);

    // Posture: Is the phone resting flat on surface face-up or face-down?
    const horizontalNorm = Math.sqrt(latest.x * latest.x + latest.y * latest.y);
    const isFlat = Math.abs(latest.z) > 0.88 && horizontalNorm < 0.45;
    const tiltDegrees = Math.round((Math.atan2(horizontalNorm, Math.abs(latest.z)) * 180) / Math.PI);

    // Motion classification
    // 1. STANDSTILL: motionless on a desk/stand (stdDev < 0.035g and dynamic deviation < 0.08g)
    // 2. HAND_TREMOR: held in hand with natural physiological human micro-tremor (~4-8 Hz, stdDev < 0.12g)
    // 3. ACTIVE_MOTION: walking, waving, translating, rotating (stdDev >= 0.12g or dynamic > 0.22g)
    let motionState: DeviceMotionState = 'STANDSTILL';
    let isStandstill = false;

    if (stdDev < 0.035 && maxDyn < 0.08) {
      motionState = 'STANDSTILL';
      isStandstill = true;
    } else if (stdDev < 0.12 && maxDyn < 0.22) {
      motionState = 'HAND_TREMOR';
      isStandstill = false;
    } else {
      motionState = 'ACTIVE_MOTION';
      isStandstill = false;
    }

    return {
      isStandstill,
      motionState,
      accelVarianceG: Number(stdDev.toFixed(4)),
      isFlatOnSurface: isFlat,
      dynamicAccelG: Number(maxDyn.toFixed(3)),
      tiltDegrees,
    };
  }

  public reset(): void {
    this.buffer = [];
  }
}
