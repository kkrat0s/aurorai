import fs from 'fs';
import { parseSensorSession, analyzeSensorSession } from '../packages/shared/src/sensor.ts';
import { classifyMagneticDisturbance, UNIVERSAL_FINGERPRINT_DATABASE } from '../packages/shared/src/magnetic-classifier.ts';

const rawData = fs.readFileSync('phone-1793471459272-json.json', 'utf-8');
const session = parseSensorSession(JSON.parse(rawData));
const qc = analyzeSensorSession(session);

console.log('=== TYPESCRIPT QC RUN ON REAL PHONE DATA ===');
console.log('Accepted:', qc.accepted);
console.log('Sample Count:', qc.sampleCount);
console.log('Usable Count:', qc.usableCount);
console.log('Actual Hz:', qc.actualHz.toFixed(3));
console.log('Duration Seconds:', qc.durationSeconds.toFixed(2));
console.log('Baseline MicroT:', qc.baselineMicroT?.toFixed(3));
console.log('Noise MAD (nT):', qc.noiseMadNt?.toFixed(2));
console.log('Drift (nT):', qc.driftNt?.toFixed(2));
console.log('Flags:', qc.flags);
console.log('High Water:', qc.highWater);

// Now run classification on various windows (e.g. baseline, minute 6, minute 9)
console.log('\n=== CLASSIFICATION OVER TIME WINDOWS ===');

// Window 1: First 120s baseline
const baselineSamples = session.samples.slice(0, 1200);
const classBaseline = classifyMagneticDisturbance(baselineSamples, qc.baselineMicroT ?? 46.0, [], {
  isStandstill: true,
  motionState: 'STANDSTILL',
  isScreenTouched: false,
  isCharging: false,
  isFlatOnSurface: true,
});
console.log('1. Baseline (0-120s):', classBaseline.predictedClass, classBaseline.metadata.name, `(${Math.round(classBaseline.confidence*100)}%)`, 'Reason:', classBaseline.aiReasoning);

// Window 2: Minutes 6-7 (+78 nT excursion)
const midSamples = session.samples.slice(3600, 4200);
const classMid = classifyMagneticDisturbance(midSamples, qc.baselineMicroT ?? 46.0, [], {
  isStandstill: true,
  motionState: 'STANDSTILL',
  isScreenTouched: false,
  isCharging: false,
  isFlatOnSurface: true,
});
console.log('2. Minute 6-7 (+78 nT):', classMid.predictedClass, classMid.metadata.name, `(${Math.round(classMid.confidence*100)}%)`, 'Reason:', classMid.aiReasoning);

// Window 3: Minute 9-10 (-321 nT excursion)
const endSamples = session.samples.slice(5385, 5985);
const classEnd = classifyMagneticDisturbance(endSamples, qc.baselineMicroT ?? 46.0, [], {
  isStandstill: true,
  motionState: 'STANDSTILL',
  isScreenTouched: false,
  isCharging: false,
  isFlatOnSurface: true,
});
console.log('3. Minute 9-10 (-321 nT):', classEnd.predictedClass, classEnd.metadata.name, `(${Math.round(classEnd.confidence*100)}%)`, 'Reason:', classEnd.aiReasoning);
