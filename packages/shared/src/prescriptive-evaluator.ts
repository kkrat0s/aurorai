import type { SensorQcResult, SensorSession } from './sensor';

export type PlacementQualityRating = 'EXCELLENT' | 'FAIR' | 'POOR';
export type SpaceWeatherActivityTier = 'G0_QUIET' | 'G1_G2_MODERATE' | 'G3_G4_SEVERE' | 'G5_EXTREME';

export interface PrescriptiveTimelineInterval {
  intervalLabel: string;
  startMinute: number;
  endMinute: number;
  medianDeltaNt: number;
  peakDeltaNt: number;
  description: string;
}

export interface PrescriptiveSessionReport {
  placementQuality: {
    rating: PlacementQualityRating;
    score: number; // 0 to 100
    label: string;
    badgeText: string;
    color: string;
    noiseMadNt: number;
    explanation: string;
    actionAdvice: string;
  };
  activityLevel: {
    tier: SpaceWeatherActivityTier;
    label: string;
    badgeText: string;
    color: string;
    kpEstimate: string;
    maxDeltaNt: number;
    p95DeltaNt: number;
    driftNt: number;
    explanation: string;
    scientificMeaning: string;
  };
  timelineStory: PrescriptiveTimelineInterval[];
  prescriptiveGuidance: string[];
}

/**
 * Evaluates a completed sensor session and produces a clear,
 * color-coded (Green/Yellow/Orange) diagnostic report explaining:
 * 1. Was the phone placed properly? (Sensor Placement Quality)
 * 2. What do the magnetic readings actually mean? (Space Weather Activity Level)
 * 3. What happened over time? (Prescriptive Timeline Story)
 */
export function evaluateSessionPrescriptively(
  session: SensorSession,
  qc: SensorQcResult
): PrescriptiveSessionReport {
  const noiseMadNt = qc.noiseMadNt ?? 100.0;
  const highWater = qc.highWater?.[0];
  const maxDeltaNt = highWater?.maximumAbsoluteDeltaNt ?? Math.abs(qc.driftNt ?? 0);
  const p95DeltaNt = highWater?.p95AbsoluteDeltaNt ?? maxDeltaNt * 0.65;
  const driftNt = qc.driftNt ?? 0;

  // 1. Placement Quality (Green / Yellow / Orange)
  let placementRating: PlacementQualityRating = 'EXCELLENT';
  let placementScore = 95;
  let placementLabel = '🟢 Excellent Placement (Quiet Baseline)';
  let placementBadge = 'EXCELLENT PLACEMENT';
  let placementColor = '#20c997'; // Mint green
  let placementExplanation =
    'Your phone was placed on an optimal, motionless surface. Sensor thermal noise was well below the 250 nT limit with zero motion or orientation errors.';
  let placementAction = 'Outstanding position. Continue using this exact observation spot (e.g. windowsill or non-magnetic table).';

  if (!qc.accepted || qc.flags.includes('NOISY_BASELINE') || noiseMadNt > 250.0 || qc.flags.includes('MOTION')) {
    placementRating = 'POOR';
    placementScore = 35;
    placementLabel = '🟠 Poor Placement / High Interference';
    placementBadge = 'POOR PLACEMENT';
    placementColor = '#ff6b6b'; // Red/Coral
    placementExplanation =
      'High noise floor or device movement detected. The phone was disturbed or placed too close to electrical appliances, steel rebar, or chargers.';
    placementAction =
      'Elevate the phone on a wooden, plastic or cardboard block on a windowsill, step back 1 meter, and do not touch the phone during the 10-minute run.';
  } else if (noiseMadNt >= 100.0 || qc.flags.length > 0) {
    placementRating = 'FAIR';
    placementScore = 70;
    placementLabel = '🟡 Fair Placement (Moderate Ambient Noise)';
    placementBadge = 'FAIR PLACEMENT';
    placementColor = '#ffd58c'; // Amber/Yellow
    placementExplanation =
      'Acceptable baseline, but elevated local jitter was detected. Some nearby electrical wiring or subtle floor vibrations influenced the sensor.';
    placementAction =
      'Try placing the phone on a firmer windowsill or wooden chair further away from AC power bricks, laptops, and metallic desk legs.';
  } else {
    // Fine tune score based on how quiet the baseline is
    placementScore = Math.max(80, Math.min(99, Math.round(100 - (noiseMadNt / 100) * 20)));
  }

  // 2. Space Weather Activity Level (Green / Yellow / Orange / Red)
  let activityTier: SpaceWeatherActivityTier = 'G0_QUIET';
  let activityLabel = '🟢 Quiet Earth Baseline';
  let activityBadge = 'G0 QUIET (< 60 nT)';
  let activityColor = '#20c997'; // Green
  let kpEstimate = 'Kp 0–3';
  let activityExplanation =
    "Earth's magnetic field remained quiet and undisturbed at your location. Core dynamo background only.";
  let scientificMeaning =
    'Minimal solar wind coupling at the magnetopause. No significant space weather storm detected.';

  if (p95DeltaNt >= 500.0) {
    activityTier = 'G5_EXTREME';
    activityLabel = '🔴 Extreme Space Weather / Severe Anomaly';
    activityBadge = 'G5 EXTREME (> 500 nT)';
    activityColor = '#ff5252'; // Deep Red
    kpEstimate = 'Kp 9';
    activityExplanation = `Massive excursion detected (+${p95DeltaNt.toFixed(0)} nT sustained, peak ${maxDeltaNt.toFixed(0)} nT). Matches historic extreme space weather events (like the May 10, 2024 Gannon storm).`;
    scientificMeaning =
      'Severe magnetospheric compression. If verified across independent regional stations, this indicates major ionospheric electrojet disruption.';
  } else if (p95DeltaNt >= 200.0 || Math.abs(driftNt) >= 200.0) {
    activityTier = 'G3_G4_SEVERE';
    activityLabel = '🟠 Candidate Space Weather Perturbation (Severe G3–G4)';
    activityBadge = 'G3–G4 SEVERE (200–500 nT)';
    activityColor = '#00e5ff'; // Cyan / Orange
    kpEstimate = 'Kp 7–8';
    activityExplanation = `Significant sustained magnetic excursion detected (${p95DeltaNt.toFixed(0)} nT sustained high-water, ${Math.abs(driftNt).toFixed(0)} nT net drift). The field underwent a slow, substantial departure from the baseline.`;
    scientificMeaning =
      'Strong southward interplanetary magnetic field (IMF Bz) coupling with Earth’s magnetosphere. A single phone cannot confirm regional storms alone—submit to central database to cross-validate!';
  } else if (p95DeltaNt >= 60.0 || Math.abs(driftNt) >= 60.0) {
    activityTier = 'G1_G2_MODERATE';
    activityLabel = '🟡 Moderate Magnetic Disturbance (G1–G2)';
    activityBadge = 'G1–G2 MODERATE (60–200 nT)';
    activityColor = '#ffd58c'; // Yellow
    kpEstimate = 'Kp 5–6';
    activityExplanation = `Noticeable magnetic field drift of ${p95DeltaNt.toFixed(0)} nT. Exceeds standard sensor noise and enters the detectability zone for minor-to-moderate geomagnetic storms.`;
    scientificMeaning =
      'Minor coronal hole high-speed stream or moderate CME impact driving sub-auroral ionospheric currents.';
  }

  // 3. Timeline Breakdown (Minute-by-minute Story)
  const timelineStory: PrescriptiveTimelineInterval[] = [];
  const samples = session.samples;
  if (samples.length >= 100) {
    const t0 = samples[0].sensorTimestampSeconds;
    const baseMag = qc.baselineMicroT ?? 46.0;

    // Segment into 3 natural acts: Baseline (0-2m or 1st third), Mid, Late
    const totalDuration = samples[samples.length - 1].sensorTimestampSeconds - t0;
    const windows = totalDuration > 200
      ? [
          { start: 0, end: 120, label: 'Minutes 0–2 (Fixed Baseline)' },
          { start: 120, end: Math.min(360, totalDuration * 0.6), label: `Minutes 2–${Math.round(Math.min(360, totalDuration * 0.6) / 60)} (Mid Observation)` },
          { start: Math.min(360, totalDuration * 0.6), end: totalDuration + 1, label: `Minutes ${Math.round(Math.min(360, totalDuration * 0.6) / 60)}–${Math.round(totalDuration / 60)} (Late Progression)` },
        ]
      : [
          { start: 0, end: totalDuration / 3, label: 'Phase 1: Initial Baseline' },
          { start: totalDuration / 3, end: (2 * totalDuration) / 3, label: 'Phase 2: Mid Observation' },
          { start: (2 * totalDuration) / 3, end: totalDuration + 1, label: 'Phase 3: Final Interval' },
        ];

    for (const w of windows) {
      const winSamples = samples.filter(
        (s) => s.sensorTimestampSeconds - t0 >= w.start && s.sensorTimestampSeconds - t0 < w.end
      );
      if (winSamples.length === 0) continue;

      const deltas = winSamples.map((s) => {
        const mag = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
        return (mag - baseMag) * 1000;
      });
      deltas.sort((a, b) => a - b);
      const medianD = deltas[Math.floor(deltas.length / 2)];
      const maxAbsD = Math.max(Math.abs(deltas[0]), Math.abs(deltas[deltas.length - 1]));

      let desc = '';
      if (w.start === 0) {
        desc = `Calm baseline established at ${baseMag.toFixed(1)} µT with ${noiseMadNt.toFixed(1)} nT noise floor. Phone motionless.`;
      } else if (medianD > 50) {
        desc = `Field drifted upward by +${medianD.toFixed(0)} nT (peak +${maxAbsD.toFixed(0)} nT).`;
      } else if (medianD < -50) {
        desc = `Field dropped significantly by ${medianD.toFixed(0)} nT below baseline (trough ${deltas[0].toFixed(0)} nT).`;
      } else {
        desc = `Field remained near baseline (${medianD > 0 ? '+' : ''}${medianD.toFixed(0)} nT drift).`;
      }

      timelineStory.push({
        intervalLabel: w.label,
        startMinute: w.start / 60,
        endMinute: w.end / 60,
        medianDeltaNt: medianD,
        peakDeltaNt: maxAbsD,
        description: desc,
      });
    }
  }

  // 4. Prescriptive Guidance
  const prescriptiveGuidance: string[] = [
    `Placement Quality: ${placementBadge} (${noiseMadNt.toFixed(1)} nT noise) — ${placementAction}`,
    `Space Weather Scale: ${activityBadge} — ${activityExplanation}`,
    'Next Action: Submit this recording to the central database to cross-check regional coherence with USGS Boulder and independent phones.',
  ];

  return {
    placementQuality: {
      rating: placementRating,
      score: placementScore,
      label: placementLabel,
      badgeText: placementBadge,
      color: placementColor,
      noiseMadNt,
      explanation: placementExplanation,
      actionAdvice: placementAction,
    },
    activityLevel: {
      tier: activityTier,
      label: activityLabel,
      badgeText: activityBadge,
      color: activityColor,
      kpEstimate,
      maxDeltaNt,
      p95DeltaNt,
      driftNt,
      explanation: activityExplanation,
      scientificMeaning,
    },
    timelineStory,
    prescriptiveGuidance,
  };
}
