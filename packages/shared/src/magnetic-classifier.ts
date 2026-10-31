/**
 * AuroraSense Magnetic Disturbance Classifier & Universal Fingerprint Database.
 *
 * Teaches users what magnetic fields are, how Earth's geomagnetic field interacts
 * with solar wind reconnection, and how AI analyzes multi-axis sensor physics
 * (gradient, rate of change dB/dt, polarization, AC switching jitter, steadiness)
 * to guestimate whether an unseen field is a human hand, smartwatch, laptop,
 * charging cable induction, or desk steel.
 *
 * Units: microtesla (µT); 1 µT = 1,000 nT.
 * Frame: DEVICE frame.
 */

export type DisturbanceClassId =
  | 'CLEAN_GEOMAGNETIC_BASELINE'
  | 'GEOMAGNETIC_SOLAR_DISTURBANCE'
  | 'HUMAN_HAND_GESTURE'
  | 'SMARTWATCH_OR_MAGNET'
  | 'CHARGING_CABLE_INDUCTION'
  | 'LAPTOP_OR_COMPUTER'
  | 'STRUCTURAL_METALLIC_MASS';

export interface DisturbanceClassMetadata {
  id: DisturbanceClassId;
  name: string;
  shortLabel: string;
  color: string;
  icon: string;
  typicalDeltaMicroT: [number, number]; // [min, max]
  typicalDeltaNanoT: [number, number];
  rateOfChangeRangeMicroTPerSec: [number, number];
  primaryMechanism: string;
  howAiGuesses: string;
  physicsExplanation: string;
  solarStormComparison: string;
  mitigationAdvice: string;
}

export interface SpaceWeatherScaleTier {
  noaaScale: 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5';
  name: string;
  groundPerturbationNanoT: [number, number];
  kpIndex: string;
  phoneDetectability: string;
  scientificDescription: string;
}

export const SPACE_WEATHER_GROUND_SCALES: SpaceWeatherScaleTier[] = [
  {
    noaaScale: 'G0',
    name: 'Quiet Geomagnetic Background',
    groundPerturbationNanoT: [0, 30],
    kpIndex: 'Kp 0–3',
    phoneDetectability: 'Below phone Hall sensor thermal noise floor (~100–150 nT).',
    scientificDescription: 'Undisturbed Earth core dynamo field with minimal solar wind coupling.',
  },
  {
    noaaScale: 'G1',
    name: 'Minor Geomagnetic Storm',
    groundPerturbationNanoT: [30, 60],
    kpIndex: 'Kp 5',
    phoneDetectability: 'Marginal on phone; requires multi-minute averaging on motionless surface.',
    scientificDescription: 'Weak coronal hole high-speed stream coupling at magnetopause.',
  },
  {
    noaaScale: 'G2',
    name: 'Moderate Geomagnetic Storm',
    groundPerturbationNanoT: [60, 120],
    kpIndex: 'Kp 6',
    phoneDetectability: 'Detectability threshold: distinguishable from phone sensor noise with quiet baseline.',
    scientificDescription: 'Moderate CME impact driving sub-auroral electrojet intensifications.',
  },
  {
    noaaScale: 'G3',
    name: 'Strong Geomagnetic Storm',
    groundPerturbationNanoT: [120, 250],
    kpIndex: 'Kp 7',
    phoneDetectability: 'Clearly detectable above phone noise floor (~120–250 nT) on windowsill/desk.',
    scientificDescription: 'Strong southward IMF (Bz < -10 nT) driving major magnetospheric reconnection.',
  },
  {
    noaaScale: 'G4',
    name: 'Severe Geomagnetic Storm',
    groundPerturbationNanoT: [250, 500],
    kpIndex: 'Kp 8',
    phoneDetectability: 'Strong signal on phone sensor (+250 to +500 nT); easily resolved above baseline.',
    scientificDescription: 'Massive fast CME compressions; aurora visible at mid-latitudes (e.g. 45°–50°N).',
  },
  {
    noaaScale: 'G5',
    name: 'Extreme Geomagnetic Storm (May 2024 Event)',
    groundPerturbationNanoT: [500, 1000],
    kpIndex: 'Kp 9',
    phoneDetectability: 'Massive excursion (+500 to +1,000+ nT); dominates local geomagnetic background.',
    scientificDescription: 'Historic super-storm (e.g. May 10–12, 2024 Gannon storm); BOU ground station recorded up to 700 nT deflections.',
  },
];

export const GRANITE_WINDOWSILL_PHYSICS = {
  materialComposition: 'Granite igneous rock containing 1–5% magnetite (Fe3O4), ilmenite, and iron-biotite.',
  staticPermeabilityOffsetNt: [100, 450],
  windowSillAdvantage:
    'Window sills are physically isolated from indoor electromagnetic noise (laptop VRMs, AC power bricks, and floor rebar), providing an optimal line-of-sight toward open space.',
  zeroCalibrationProtocol:
    'Place phone completely motionless on the granite sill, step back, and press ↺ ZERO. This subtracts the granite’s static remanent magnetic offset, calibrating the sensor to measure dynamic space weather perturbations.',
};

export const UNIVERSAL_FINGERPRINT_DATABASE: Record<DisturbanceClassId, DisturbanceClassMetadata> = {
  CLEAN_GEOMAGNETIC_BASELINE: {
    id: 'CLEAN_GEOMAGNETIC_BASELINE',
    name: 'Quiet Earth Geomagnetic Baseline',
    shortLabel: 'Quiet Baseline',
    color: '#68edc3',
    icon: '🌍',
    typicalDeltaMicroT: [0.0, 0.28],
    typicalDeltaNanoT: [0, 280],
    rateOfChangeRangeMicroTPerSec: [0.0, 0.35],
    primaryMechanism: "Earth's core dynamo field resting undisturbed.",
    howAiGuesses:
      'Zero local gradient: Flat, quiet 3-axis trajectory with deviation below 250 nT and near-zero jitter.',
    physicsExplanation:
      "The sensor measures Earth's ambient dipolar magnetic field (approx. 30–60 µT), generated 3,000 km below ground by convection in Earth's molten iron outer core. Without local interference, field deviations remain below 250 nT.",
    solarStormComparison:
      "This is the calm state needed to detect real space weather. Earth's ionospheric response to solar wind reconnection is 50–500 nT; only an undisturbed sensor can isolate it.",
    mitigationAdvice:
      'Optimal observation condition. Keep phone resting still on a non-magnetic wooden or plastic surface.',
  },
  GEOMAGNETIC_SOLAR_DISTURBANCE: {
    id: 'GEOMAGNETIC_SOLAR_DISTURBANCE',
    name: 'Candidate Earth Reconnection / Solar Storm',
    shortLabel: 'Solar Storm Event',
    color: '#00e5ff',
    icon: '☀️',
    typicalDeltaMicroT: [0.06, 0.60],
    typicalDeltaNanoT: [60, 600],
    rateOfChangeRangeMicroTPerSec: [0.001, 0.22],
    primaryMechanism:
      'Ionospheric Hall & Birkeland field-aligned currents driven by solar wind magnetopause magnetic reconnection.',
    howAiGuesses:
      'Stationary ultra-slow scalar perturbation (60–600 nT, dB/dt < 0.22 µT/s) with hands off and zero electronic switching jitter. Matches G2–G5 geomagnetic storm signature.',
    physicsExplanation:
      'When southward interplanetary magnetic field (Bz < 0) reconnects with Earth’s dayside magnetopause, solar plasma injects into the polar cusps. This intensifies auroral electrojets at 100 km altitude, producing ground-level magnetic perturbations of 50 to 600+ nT over minutes to hours.',
    solarStormComparison:
      'This IS the target space weather phenomenon! G1 storms produce 20–50 nT; G3 storms reach 100–200 nT; severe G4/G5 storms (like May 10, 2024) exceed 400–800 nT.',
    mitigationAdvice:
      'Keep the phone motionless on a non-magnetic or zeroed granite surface. A single phone cannot confirm a storm alone—cross-check against USGS Boulder observatory (BOU) and independent regional phones.',
  },
  HUMAN_HAND_GESTURE: {
    id: 'HUMAN_HAND_GESTURE',
    name: 'Human Hand / Body Proximity',
    shortLabel: 'Human Hand',
    color: '#ffd58c',
    icon: '🖐️',
    typicalDeltaMicroT: [0.4, 3.8],
    typicalDeltaNanoT: [400, 3800],
    rateOfChangeRangeMicroTPerSec: [0.3, 4.5],
    primaryMechanism: 'Diamagnetic tissue displacement, static field shift, and micro-tilt.',
    howAiGuesses:
      'Smooth sinusoidal dynamics: Moderate delta (0.5–3.5 µT), low rate of change (< 4.5 µT/s), and distributed multi-axis projection with natural physiological tremor.',
    physicsExplanation:
      'Human tissue is mildly diamagnetic (repels magnetic fields slightly due to water content) and carries electrostatic surface charges. Moving your hand also subtly distorts the local field and micro-tilts the phone, rotating Earth’s 50,000 nT field vector against the phone’s axes.',
    solarStormComparison:
      'A simple hand wave creates 500–3,500 nT of disturbance—roughly 5x to 20x LARGER than a moderate geomagnetic solar storm (100–250 nT)!',
    mitigationAdvice:
      'Step back 1–2 feet from the phone during real observation sessions so your body does not contaminate data.',
  },
  SMARTWATCH_OR_MAGNET: {
    id: 'SMARTWATCH_OR_MAGNET',
    name: 'Smartwatch / Neodymium Magnet',
    shortLabel: 'Smartwatch / Magnet',
    color: '#f06292',
    icon: '⌚',
    typicalDeltaMicroT: [4.0, 60.0],
    typicalDeltaNanoT: [4000, 60000],
    rateOfChangeRangeMicroTPerSec: [6.0, 90.0],
    primaryMechanism: 'Permanent ferromagnetic dipole (Milanese clasp, speaker drivers, charging ring).',
    howAiGuesses:
      'Steep 1/r³ dipole gradient: Intense localized field spike (> 4 µT) with rapid rate of change (> 6 µT/s) and strong single-axis polarization.',
    physicsExplanation:
      'Smartwatches contain rare-earth neodymium speaker magnets and magnetic Milanese straps; rings and keys contain iron, cobalt, or nickel. They act as intense point dipoles whose magnetic force falls off with the cube of distance (1/r³).',
    solarStormComparison:
      'A smartwatch held near the phone creates 10,000–50,000 nT of local field—over 100x STRONGER than the strongest G5 geomagnetic storm recorded in decades!',
    mitigationAdvice:
      'Remove all watches, rings, jewelry, and keychains before setting up an observation.',
  },
  CHARGING_CABLE_INDUCTION: {
    id: 'CHARGING_CABLE_INDUCTION',
    name: 'Charging Cable / Induction',
    shortLabel: 'Charging Cable',
    color: '#ffb74d',
    icon: '🔌',
    typicalDeltaMicroT: [2.5, 35.0],
    typicalDeltaNanoT: [2500, 35000],
    rateOfChangeRangeMicroTPerSec: [1.0, 30.0],
    primaryMechanism: "Ampère's law DC current flow (B = µ₀I / 2πr) plus power supply switching ripple.",
    howAiGuesses:
      'Biot-Savart cylindrical symmetry: Persistent elevated DC offset with high-frequency switching jitter from the charger transformer.',
    physicsExplanation:
      "Electric current flowing through a USB-C or MagSafe charging cable generates a circular magnetic field proportional to current (Ampère's law). Fast-charging bricks also induce switching ripple and inductive harmonics.",
    solarStormComparison:
      'Charging cables generate continuous artificial fields of 3,000–25,000 nT, swamping any natural ionospheric solar wind reconnection signature.',
    mitigationAdvice:
      'Unplug charging cables and keep the phone running on internal battery during 10-minute observations.',
  },
  LAPTOP_OR_COMPUTER: {
    id: 'LAPTOP_OR_COMPUTER',
    name: 'Laptop / Computer Nearby',
    shortLabel: 'Laptop / PC',
    color: '#ba68c8',
    icon: '💻',
    typicalDeltaMicroT: [3.5, 45.0],
    typicalDeltaNanoT: [3500, 45000],
    rateOfChangeRangeMicroTPerSec: [0.5, 25.0],
    primaryMechanism: 'Electromagnetic induction from GPU/CPU VRMs, display inverters, and cooling fan motors.',
    howAiGuesses:
      'Stationary high-jitter footprint: Steady elevated field (> 3 µT) accompanied by high-frequency AC ripple without macro physical phone motion.',
    physicsExplanation:
      'Laptops and monitors contain high-frequency switching voltage regulator modules (VRMs), inductive coils, and magnetic fan motors. They emit complex multi-frequency electromagnetic radiation and localized magnetic fields.',
    solarStormComparison:
      'A neighboring computer creates 4,000–30,000 nT of steady magnetic bias, making geomagnetic storm detection impossible.',
    mitigationAdvice:
      'Place the phone at least 3 feet (1 meter) away from laptops, external monitors, and desktop computers.',
  },
  STRUCTURAL_METALLIC_MASS: {
    id: 'STRUCTURAL_METALLIC_MASS',
    name: 'Steel Desk Frame / Floor Rebar',
    shortLabel: 'Desk Steel',
    color: '#80cbc4',
    icon: '🏢',
    typicalDeltaMicroT: [2.0, 25.0],
    typicalDeltaNanoT: [2000, 25000],
    rateOfChangeRangeMicroTPerSec: [0.05, 3.0],
    primaryMechanism: 'Static spatial magnetic permeability gradient in structural building steel.',
    howAiGuesses:
      'Zero-jitter stationary bias: Steady deviation that is completely motionless when untouched, changing only with physical phone sliding across the desk.',
    physicsExplanation:
      'Office desks with steel legs and concrete floors with steel rebar distort Earth’s field lines into a spatial gradient. The reading is completely steady until the phone is nudged or translated across the desk.',
    solarStormComparison:
      'Structural metal causes a constant baseline offset. Sliding the phone even 2 inches mimics a fake solar storm sudden impulse.',
    mitigationAdvice:
      'Elevate the phone on a wooden, cardboard, or plastic riser away from steel table legs.',
  },
};

export interface MagneticSample {
  x: number;
  y: number;
  z: number;
  timestampMs: number;
}

export interface DisturbanceSignature {
  deltaMicroT: number; // Current |B| - B_baseline
  deltaNanoT: number;
  peakDeltaMicroT: number;
  rateOfChangeMicroTPerSec: number;
  polarizationRatio: number; // Ratio of dominant axis variation to total variation
  jitterRatio: number; // High frequency variance / gross trajectory
  steadinessRatio: number; // 0.0 (erratic/moving) to 1.0 (steady plateau)
  sampleCount: number;
  durationMs: number;
}

export type DeviceMotionState = 'STANDSTILL' | 'HAND_TREMOR' | 'ACTIVE_MOTION';
export type DeviceBatteryState = 'CHARGING' | 'UNPLUGGED' | 'FULL' | 'UNKNOWN';

export interface DevicePhysicalContext {
  /** Accelerometer motion status: true if resting completely motionless on a table/surface */
  isStandstill: boolean;
  /** Granular motion classification: STANDSTILL, HAND_TREMOR (held in hand), or ACTIVE_MOTION */
  motionState: DeviceMotionState;
  /** Accelerometer norm variance (g) across rolling buffer */
  accelVarianceG?: number;
  /** True if phone is resting flat face-up or face-down (|az| > 0.88g) */
  isFlatOnSurface?: boolean;

  /** True if user's finger or hand is actively touching the capacitive touchscreen */
  isScreenTouched: boolean;
  /** Milliseconds since the last capacitive screen touch ended */
  timeSinceLastTouchMs?: number;

  /** True if phone is connected to USB-C cable or Qi wireless charging pad */
  isCharging?: boolean;
  /** Battery hardware state */
  batteryState?: DeviceBatteryState;

  /** Ambient illuminance lux if light sensor available */
  ambientLux?: number | null;
}

export interface DisturbanceClassificationResult {
  predictedClass: DisturbanceClassId;
  confidence: number; // 0.0 to 1.0
  scores: Record<DisturbanceClassId, number>;
  metadata: DisturbanceClassMetadata;
  signature: DisturbanceSignature;
  solarStormSignalRatio: number; // Ratio compared to a 100 nT solar storm
  fingerprintHash: string;
  aiReasoning: string;
  context?: DevicePhysicalContext;
}

export interface LearnedUserFingerprint {
  id: string;
  confirmedAtUtc: string;
  objectClassId: DisturbanceClassId;
  customLabel?: string;
  signature: DisturbanceSignature;
  userConfirmed: boolean;
}

/**
 * Computes statistical and spectral signature features from a rolling buffer of 3-axis samples.
 */
export function extractDisturbanceSignature(
  samples: MagneticSample[],
  baselineMagMicroT: number
): DisturbanceSignature {
  if (samples.length === 0) {
    return {
      deltaMicroT: 0,
      deltaNanoT: 0,
      peakDeltaMicroT: 0,
      rateOfChangeMicroTPerSec: 0,
      polarizationRatio: 0,
      jitterRatio: 0,
      steadinessRatio: 0,
      sampleCount: 0,
      durationMs: 0,
    };
  }

  const latest = samples[samples.length - 1];
  const latestMag = Math.sqrt(latest.x * latest.x + latest.y * latest.y + latest.z * latest.z);
  const deltaMicroT = latestMag - baselineMagMicroT;

  let peakDelta = Math.abs(deltaMicroT);
  let maxRateOfChange = 0;
  let totalDeltaX = 0;
  let totalDeltaY = 0;
  let totalDeltaZ = 0;

  const firstMag = Math.sqrt(samples[0].x * samples[0].x + samples[0].y * samples[0].y + samples[0].z * samples[0].z);
  let prevMag = firstMag;
  let prevTime = samples[0].timestampMs;
  let totalAbsDiffStep = 0;
  let magSum = 0;

  for (let i = 1; i < samples.length; i++) {
    const s = samples[i];
    const mag = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
    magSum += mag;
    const d = Math.abs(mag - baselineMagMicroT);
    if (d > peakDelta) peakDelta = d;

    const dt = Math.max(1, s.timestampMs - prevTime) / 1000;
    const rate = Math.abs(mag - prevMag) / dt;
    if (rate > maxRateOfChange) maxRateOfChange = rate;

    totalAbsDiffStep += Math.abs(mag - prevMag);
    totalDeltaX += Math.abs(s.x - samples[0].x);
    totalDeltaY += Math.abs(s.y - samples[0].y);
    totalDeltaZ += Math.abs(s.z - samples[0].z);

    prevMag = mag;
    prevTime = s.timestampMs;
  }

  const durationMs = Math.max(1, samples[samples.length - 1].timestampMs - samples[0].timestampMs);
  const totalVecVar = totalDeltaX + totalDeltaY + totalDeltaZ + 1e-6;
  const maxAxisVar = Math.max(totalDeltaX, totalDeltaY, totalDeltaZ);
  const polarizationRatio = Math.min(1.0, maxAxisVar / totalVecVar);

  const meanStepDiff = totalAbsDiffStep / Math.max(1, samples.length - 1);
  const grossTraj = Math.abs(latestMag - firstMag) + 0.05;
  const jitterRatio = Math.min(1.0, meanStepDiff / grossTraj);

  // Steadiness ratio: how flat is the field across the window (steady plateau)
  const meanMag = (magSum + firstMag) / samples.length;
  let varianceSum = 0;
  for (const s of samples) {
    const mag = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
    varianceSum += (mag - meanMag) * (mag - meanMag);
  }
  const variance = varianceSum / samples.length;
  const steadinessRatio = Math.max(0, Math.min(1.0, 1.0 - Math.sqrt(variance) / (peakDelta + 0.1)));

  return {
    deltaMicroT,
    deltaNanoT: Math.round(deltaMicroT * 1000),
    peakDeltaMicroT: peakDelta,
    rateOfChangeMicroTPerSec: maxRateOfChange,
    polarizationRatio,
    jitterRatio,
    steadinessRatio,
    sampleCount: samples.length,
    durationMs,
  };
}

/**
 * Universal classifier matching real-time phone magnetometer dynamics
 * against physical electrodynamics models of human body, ferromagnetic metals, and electronics.
 */
export function classifyMagneticDisturbance(
  samples: MagneticSample[],
  baselineMagMicroT: number,
  userLearnedFingerprints: LearnedUserFingerprint[] = [],
  context?: Partial<DevicePhysicalContext>
): DisturbanceClassificationResult {
  const fullContext: DevicePhysicalContext = {
    isStandstill: context?.isStandstill ?? true,
    motionState: context?.motionState ?? (context?.isStandstill === false ? 'ACTIVE_MOTION' : 'STANDSTILL'),
    accelVarianceG: context?.accelVarianceG ?? 0.01,
    isFlatOnSurface: context?.isFlatOnSurface ?? true,
    isScreenTouched: context?.isScreenTouched ?? false,
    timeSinceLastTouchMs: context?.timeSinceLastTouchMs ?? 10000,
    isCharging: context?.isCharging ?? false,
    batteryState: context?.batteryState ?? (context?.isCharging ? 'CHARGING' : 'UNPLUGGED'),
    ambientLux: context?.ambientLux ?? null,
  };

  const sig = extractDisturbanceSignature(samples, baselineMagMicroT);
  const absPeak = sig.peakDeltaMicroT;
  const roc = sig.rateOfChangeMicroTPerSec;
  const pol = sig.polarizationRatio;
  const jitter = sig.jitterRatio;
  const steady = sig.steadinessRatio;

  // Raw likelihood scores for each disturbance class
  const rawScores: Record<DisturbanceClassId, number> = {
    CLEAN_GEOMAGNETIC_BASELINE: 0,
    GEOMAGNETIC_SOLAR_DISTURBANCE: 0,
    HUMAN_HAND_GESTURE: 0,
    SMARTWATCH_OR_MAGNET: 0,
    CHARGING_CABLE_INDUCTION: 0,
    LAPTOP_OR_COMPUTER: 0,
    STRUCTURAL_METALLIC_MASS: 0,
  };

  // 1. Clean Baseline: Deviation < 0.20 µT, low rate of change, motionless phone
  if (absPeak < 0.20 && roc < 0.4) {
    let baseScore = 14.0 + (0.20 - absPeak) * 20;
    if (fullContext.isStandstill && !fullContext.isScreenTouched) baseScore *= 1.3;
    if (fullContext.isScreenTouched || fullContext.motionState === 'ACTIVE_MOTION') baseScore *= 0.05;
    rawScores.CLEAN_GEOMAGNETIC_BASELINE = baseScore;
  } else if (absPeak < 0.35 && roc < 0.3) {
    let baseScore = 3.5;
    if (fullContext.isScreenTouched || fullContext.motionState === 'ACTIVE_MOTION') baseScore *= 0.05;
    rawScores.CLEAN_GEOMAGNETIC_BASELINE = baseScore;
  } else {
    rawScores.CLEAN_GEOMAGNETIC_BASELINE = 0.01;
  }

  // 2. Candidate Geomagnetic Solar Disturbance (Earth Reconnection): 50–650 nT scalar perturbation
  // Physical criteria: Standstill on surface (e.g. windowsill), hands off, low dB/dt (< 0.25 µT/s), low electronic jitter (< 0.30)
  if (absPeak >= 0.06 && absPeak <= 0.65 && roc <= 0.28 && jitter < 0.30) {
    let solarScore = 4.0;
    if (absPeak >= 0.12 && absPeak <= 0.55) solarScore += 8.5; // Sweet spot for G2–G5 geomagnetic storms
    if (roc <= 0.15) solarScore += 5.5; // Natural ionospheric electrojets unfold over minutes, not seconds
    if (steady >= 0.70) solarScore += 3.0;

    // Multi-modal physical requirements for space weather
    if (fullContext.isStandstill && !fullContext.isScreenTouched) {
      solarScore += 7.0; // Motionless on non-magnetic/granite surface with hands off
      solarScore *= 1.8;
    }
    if (fullContext.isScreenTouched || fullContext.motionState === 'ACTIVE_MOTION') {
      solarScore *= 0.10; // Motion or skin contact invalidates natural space weather
    }
    if (fullContext.isCharging) {
      solarScore *= 0.10; // Power supply switching invalidates clean space weather
    }

    rawScores.GEOMAGNETIC_SOLAR_DISTURBANCE = solarScore;
  } else {
    rawScores.GEOMAGNETIC_SOLAR_DISTURBANCE = 0.05;
  }

  // 3. Human Hand Proximity: Smooth, moderate delta (0.4 to 3.8 µT), rate of change (0.3–4.5 µT/s), balanced axes
  if (absPeak >= 0.35 && absPeak <= 5.0) {
    let handScore = 4.0;
    if (absPeak >= 0.6 && absPeak <= 3.2) handScore += 5.0;
    if (roc <= 4.5) handScore += 3.5;
    if (pol < 0.72) handScore += 2.5; // Hand causes broad 3D field warping, not a single point pole
    if (jitter < 0.45) handScore += 2.0; // Smooth motion
    if (steady < 0.8) handScore += 2.0; // Hand naturally sways

    // Multi-modal physical corroboration
    if (fullContext.isScreenTouched) {
      handScore += 8.0; // Direct capacitive skin contact confirmed
      handScore *= 1.6;
    } else if (fullContext.motionState === 'HAND_TREMOR') {
      handScore += 5.0; // Physiological micro-tremor confirms device is held in hands
    } else if (fullContext.isStandstill && !fullContext.isScreenTouched) {
      // Phone is resting motionless on a surface with hands off
      if (absPeak <= 0.60 && roc <= 0.22) {
        // Slow <= 600 nT field on a motionless phone is a solar perturbation or granite sill offset, NOT a moving hand!
        handScore *= 0.15;
      } else if (roc >= 0.35) {
        // Hand hovering and waving near phone
        handScore += 3.0;
      }
    }

    rawScores.HUMAN_HAND_GESTURE = handScore;
  } else if (absPeak > 5.0 && absPeak < 8.0) {
    let handScore = 1.2;
    if (fullContext.isScreenTouched) handScore += 4.0;
    rawScores.HUMAN_HAND_GESTURE = handScore;
  } else {
    rawScores.HUMAN_HAND_GESTURE = fullContext.isScreenTouched ? 1.0 : 0.05;
  }

  // 4. Smartwatch / Neodymium Magnet: Sharp dipolar gradient (> 4 µT), high rate of change, high polarization, LOW jitter (smooth physical dipole approach)
  if (absPeak >= 3.5 && jitter < 0.45) {
    let watchScore = 3.0;
    if (absPeak >= 5.0 && absPeak <= 55.0) watchScore += 7.0;
    if (roc > 4.5) watchScore += 6.0;
    if (pol >= 0.60) watchScore += 5.0; // Dipole falls off sharply along orientation axis
    if (fullContext.isScreenTouched && absPeak >= 4.0) watchScore += 4.0; // Smartwatch on wrist touching screen
    rawScores.SMARTWATCH_OR_MAGNET = watchScore;
  } else if (absPeak >= 1.8 && roc > 4.0 && jitter < 0.40) {
    rawScores.SMARTWATCH_OR_MAGNET = 2.0;
  } else {
    rawScores.SMARTWATCH_OR_MAGNET = 0.05;
  }

  // 5. Charging Cable / Induction: Persistent DC offset with high-frequency switching ripple, moderate polarization
  if (absPeak >= 2.0) {
    let cableScore = 1.5;
    if (absPeak >= 3.0 && absPeak <= 30.0) cableScore += 4.0;
    if (steady >= 0.60) cableScore += 3.5; // Cable stays plugged in
    if (jitter >= 0.25) cableScore += 3.0; // Power brick switching ripple

    // Multi-modal charging hardware corroboration
    if (fullContext.isCharging) {
      cableScore += 8.0; // Hardware confirms active battery charging current flow
      cableScore *= 1.6;
    } else if (fullContext.batteryState === 'UNPLUGGED') {
      cableScore *= 0.8;
    }

    rawScores.CHARGING_CABLE_INDUCTION = cableScore;
  } else {
    rawScores.CHARGING_CABLE_INDUCTION = fullContext.isCharging ? 0.8 : 0.05;
  }

  // 6. Laptop / Computer Nearby: Elevated stationary field with high spectral jitter across multiple axes
  if (absPeak >= 3.0) {
    let pcScore = 1.5;
    if (absPeak >= 4.0 && absPeak <= 45.0) pcScore += 5.0;
    if (steady >= 0.65) pcScore += 3.0; // Computer rests beside phone
    if (jitter >= 0.35) pcScore += 6.0; // CPU/GPU VRM switching harmonics
    if (pol < 0.80) pcScore += 2.5; // Distributed chassis EM field

    // Laptop proximity is stationary on a desk
    if (fullContext.isStandstill && !fullContext.isScreenTouched) {
      pcScore *= 1.35;
    } else if (fullContext.motionState === 'ACTIVE_MOTION') {
      pcScore *= 0.25; // Walking away from stationary desk laptop
    }

    rawScores.LAPTOP_OR_COMPUTER = pcScore;
  } else {
    rawScores.LAPTOP_OR_COMPUTER = 0.05;
  }

  // 7. Structural Metal Gradient: Static spatial field, very low rate of change when still, very low jitter
  if (absPeak >= 1.5 && absPeak <= 25.0 && jitter < 0.30) {
    let structScore = 1.0;
    if (roc < 1.0) structScore += 4.5;
    if (jitter < 0.20) structScore += 3.0;
    if (steady >= 0.85) structScore += 3.5; // Perfectly motionless

    if (fullContext.isStandstill && !fullContext.isScreenTouched) {
      structScore *= 1.35;
    } else if (fullContext.isFlatOnSurface && fullContext.motionState === 'ACTIVE_MOTION' && roc < 2.0) {
      // Sliding phone across steel desk surface
      structScore += 5.0;
    }

    rawScores.STRUCTURAL_METALLIC_MASS = structScore;
  } else {
    rawScores.STRUCTURAL_METALLIC_MASS = 0.05;
  }

  // Boost scores based on previous user-confirmed learning fingerprints
  for (const fp of userLearnedFingerprints) {
    if (fp.userConfirmed) {
      const deltaDiff = Math.abs(fp.signature.peakDeltaMicroT - absPeak);
      const rocDiff = Math.abs(fp.signature.rateOfChangeMicroTPerSec - roc);
      if (deltaDiff < 2.0 && rocDiff < 3.0) {
        rawScores[fp.objectClassId] = (rawScores[fp.objectClassId] ?? 0) * 1.35;
      }
    }
  }

  // Normalize into confidence probabilities via Softmax
  const totalScore = Object.values(rawScores).reduce((sum, v) => sum + v, 0);
  const normalizedScores: Record<DisturbanceClassId, number> = {
    CLEAN_GEOMAGNETIC_BASELINE: rawScores.CLEAN_GEOMAGNETIC_BASELINE / totalScore,
    GEOMAGNETIC_SOLAR_DISTURBANCE: rawScores.GEOMAGNETIC_SOLAR_DISTURBANCE / totalScore,
    HUMAN_HAND_GESTURE: rawScores.HUMAN_HAND_GESTURE / totalScore,
    SMARTWATCH_OR_MAGNET: rawScores.SMARTWATCH_OR_MAGNET / totalScore,
    CHARGING_CABLE_INDUCTION: rawScores.CHARGING_CABLE_INDUCTION / totalScore,
    LAPTOP_OR_COMPUTER: rawScores.LAPTOP_OR_COMPUTER / totalScore,
    STRUCTURAL_METALLIC_MASS: rawScores.STRUCTURAL_METALLIC_MASS / totalScore,
  };

  let bestClass: DisturbanceClassId = 'CLEAN_GEOMAGNETIC_BASELINE';
  let bestScore = -1;
  for (const [key, val] of Object.entries(normalizedScores) as Array<[DisturbanceClassId, number]>) {
    if (val > bestScore) {
      bestScore = val;
      bestClass = key;
    }
  }

  // Educational AI Reasoning text explaining how the AI reached its guess
  let reasoning = '';
  switch (bestClass) {
    case 'CLEAN_GEOMAGNETIC_BASELINE':
      if (fullContext.isStandstill && !fullContext.isScreenTouched) {
        reasoning = `Phone is completely standstill on surface with hands off. Field deviation is minimal (${Math.round(absPeak * 1000)} nT). Matches undisturbed Earth geomagnetic baseline.`;
      } else {
        reasoning = `Field deviation is minimal (${Math.round(absPeak * 1000)} nT) with no localized gradient. Matches undisturbed geomagnetic background.`;
      }
      break;
    case 'GEOMAGNETIC_SOLAR_DISTURBANCE':
      reasoning = `Stationary on surface with hands off. Slow scalar deviation (+${Math.round(absPeak * 1000)} nT, rate: ${roc.toFixed(2)} µT/s) matches G2–G5 solar storm ground perturbation levels (100–500 nT). Candidate reconnection event; cross-check USGS observatory & regional phones.`;
      break;
    case 'HUMAN_HAND_GESTURE':
      if (fullContext.isScreenTouched) {
        reasoning = `Direct capacitive touchscreen contact confirmed. Smooth +${Math.round(absPeak * 1000)} nT deflection with balanced 3D axes matches hand/finger proximity.`;
      } else if (fullContext.motionState === 'HAND_TREMOR') {
        reasoning = `Physiological hand-holding micro-tremor detected by accelerometer (~${(fullContext.accelVarianceG ?? 0.04).toFixed(3)}g). Hand handling corroborates +${Math.round(absPeak * 1000)} nT diamagnetic field.`;
      } else if (fullContext.isStandstill) {
        reasoning = `Contactless hand hover: Phone is standstill on surface with zero screen touch. Smooth sinusoidal wave (${roc.toFixed(1)} µT/s, +${Math.round(absPeak * 1000)} nT) reflects approaching hand tissue.`;
      } else {
        reasoning = `Smooth sinusoidal trajectory (rate: ${roc.toFixed(1)} µT/s, deviation: +${Math.round(absPeak * 1000)} nT) with balanced multi-axis projection. Typical of diamagnetic hand movement.`;
      }
      break;
    case 'SMARTWATCH_OR_MAGNET':
      if (fullContext.isScreenTouched) {
        reasoning = `Screen touch coincides with steep dipolar spike (${roc.toFixed(1)} µT/s, ${(pol * 100).toFixed(0)}% polarization), characteristic of a wrist-worn smartwatch clasp touching the display.`;
      } else {
        reasoning = `High gradient spike (${roc.toFixed(1)} µT/s) and sharp single-axis polarization (${(pol * 100).toFixed(0)}%). Characteristics match a 1/r³ permanent magnetic dipole.`;
      }
      break;
    case 'CHARGING_CABLE_INDUCTION':
      if (fullContext.isCharging) {
        reasoning = `Hardware confirms active battery charging current flow. Coupled with steady +${absPeak.toFixed(1)} µT offset and power supply switching ripple, Ampère's law cable induction is confirmed.`;
      } else {
        reasoning = `Persistent DC offset (+${absPeak.toFixed(1)} µT) with high-frequency switching ripple. Matches Biot-Savart cylindrical current flow in a charging cable.`;
      }
      break;
    case 'LAPTOP_OR_COMPUTER':
      if (fullContext.isStandstill) {
        reasoning = `Phone is standstill on desk with zero touch. Elevated multi-axis field (+${absPeak.toFixed(1)} µT) with ${(jitter * 100).toFixed(0)}% switching jitter matches nearby computer VRM inductors & fan motor.`;
      } else {
        reasoning = `Stationary multi-axis field (+${absPeak.toFixed(1)} µT) with elevated high-frequency jitter (${(jitter * 100).toFixed(0)}%). Matches computer switching regulators & inductors.`;
      }
      break;
    case 'STRUCTURAL_METALLIC_MASS':
      reasoning = `Steady baseline shift (+${absPeak.toFixed(1)} µT) with near-zero motion jitter. Matches stationary spatial gradient of steel desk rebar.`;
      break;
  }

  const solarStormSignalRatio = Math.max(0.1, Number((absPeak / 0.1).toFixed(1)));

  // Generate lightweight deterministic fingerprint hash
  const hashVal = Math.abs(
    Math.round(absPeak * 100) * 31 +
    Math.round(roc * 10) * 17 +
    Math.round(pol * 100) * 7
  ).toString(16).padStart(6, '0');

  return {
    predictedClass: bestClass,
    confidence: Number(bestScore.toFixed(2)),
    scores: normalizedScores,
    metadata: UNIVERSAL_FINGERPRINT_DATABASE[bestClass],
    signature: sig,
    solarStormSignalRatio,
    fingerprintHash: `fp-${bestClass.slice(0, 4).toLowerCase()}-${hashVal}`,
    aiReasoning: reasoning,
    context: fullContext,
  };
}

/**
 * Creates a learned user fingerprint when the user confirms or corrects an AI guess.
 */
export function createUserLearnedFingerprint(
  classification: DisturbanceClassificationResult,
  confirmedClassId: DisturbanceClassId,
  customLabel?: string
): LearnedUserFingerprint {
  return {
    id: `learned-${Date.now()}-${classification.fingerprintHash}`,
    confirmedAtUtc: new Date().toISOString(),
    objectClassId: confirmedClassId,
    customLabel: customLabel || UNIVERSAL_FINGERPRINT_DATABASE[confirmedClassId].name,
    signature: { ...classification.signature },
    userConfirmed: true,
  };
}
