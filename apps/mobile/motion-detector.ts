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
  accelVarianceG: number | null;
  isFlatOnSurface: boolean;
  dynamicAccelG: number | null;
  tiltDegrees: number | null;
}

/**
 * Real-time accelerometer motion classifier.
 * Screens acceleration variation. It cannot establish the supporting surface,
 * identify a human hand, or detect every rotation (notably yaw about gravity).
 */
export class RealtimeMotionDetector {
  private buffer: AccelSample[] = [];
  private maxBufferSize: number;

  constructor(maxBufferSize = 20) {
    this.maxBufferSize = maxBufferSize;
  }

  public pushSample(x: number, y: number, z: number, timestampMs: number): void {
    const previous=this.buffer.at(-1);
    if (![x,y,z,timestampMs].every(Number.isFinite) || Math.hypot(x,y,z)<0.1) { this.reset(); return; }
    if (previous && (timestampMs<=previous.timestampMs || timestampMs-previous.timestampMs>500)) this.reset();
    this.buffer.push({ x, y, z, timestampMs });
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  public analyze(nowMs = performance.now()): MotionAnalysis {
    const age=nowMs-(this.buffer.at(-1)?.timestampMs ?? NaN);
    if (this.buffer.length < 3 || !Number.isFinite(age) || age<0 || age>500) {
      return {
        isStandstill: false,
        motionState: 'UNKNOWN',
        accelVarianceG: null,
        isFlatOnSurface: false,
        dynamicAccelG: null,
        tiltDegrees: null,
      };
    }

    const latest = this.buffer[this.buffer.length - 1];

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
    // Norm variance alone misses pitch/roll changes at constant gravity magnitude.
    const meanVector = {x:0,y:0,z:0};
    for (const sample of this.buffer) { meanVector.x+=sample.x/this.buffer.length; meanVector.y+=sample.y/this.buffer.length; meanVector.z+=sample.z/this.buffer.length; }
    const vectorVariance=this.buffer.reduce((sum,s)=>sum+(s.x-meanVector.x)**2+(s.y-meanVector.y)**2+(s.z-meanVector.z)**2,0)/this.buffer.length;
    const stdDev = Math.sqrt(Math.max(variance,vectorVariance));

    // Posture: Is the phone resting flat on surface face-up or face-down?
    const horizontalNorm = Math.sqrt(latest.x * latest.x + latest.y * latest.y);
    const isFlat = Math.abs(latest.z) > 0.88 && horizontalNorm < 0.45;
    const tiltDegrees = Math.round((Math.atan2(horizontalNorm, Math.abs(latest.z)) * 180) / Math.PI);

    // Motion classification
    // 1. STANDSTILL: motionless on a desk/stand (stdDev < 0.035g and dynamic deviation < 0.08g)
    // 2. HAND_TREMOR: low motion candidate (stdDev < 0.12g); no tremor-frequency or hand identification
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
