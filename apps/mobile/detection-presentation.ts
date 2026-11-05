import type { DisturbanceClassificationResult } from '@aurorasense/shared/magnetic-classifier';
export { magneticGuessCopy } from '@aurorasense/shared/magnetic-classifier';

/** Display thresholds retained from the existing UI; not calibrated detection limits. */
export function hasSalientMagneticChange(
  classification: DisturbanceClassificationResult,
  deltaNt: number,
  hasMeasurement: boolean,
): boolean {
  if (!hasMeasurement || !Number.isFinite(deltaNt)) return false;
  const magnitude = Math.abs(deltaNt);
  const quiet = classification.predictedClass === 'CLEAN_GEOMAGNETIC_BASELINE'
    || classification.predictedClass === 'GEOMAGNETIC_SOLAR_DISTURBANCE';
  return magnitude > 320 || (!quiet && magnitude > 180);
}

/** Only an eligible observed event may open the ephemeral guess card. Touch is not a detection. */
export function canPresentMagneticDetection(
  classification: DisturbanceClassificationResult,
  deltaNt: number,
  hasMeasurement: boolean,
  isScreenTouched: boolean,
): boolean {
  return hasSalientMagneticChange(classification, deltaNt, hasMeasurement)
    && classification.trainable
    && classification.evidenceStatus !== 'INSUFFICIENT_DATA'
    && classification.predictedClass !== 'CLEAN_GEOMAGNETIC_BASELINE'
    && classification.predictedClass !== 'GEOMAGNETIC_SOLAR_DISTURBANCE'
    && !isScreenTouched;
}
