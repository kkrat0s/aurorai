import { describe, expect, it } from 'vitest';
import {
  evaluateAuroraAlertDecision,
  evaluateSamOpticalSegmentation,
  evaluateSparkMeasurementInsight,
  evaluateWonderRedTeam,
  MUSE_IMAGE_CONCEPTS,
} from './meta-suite';

describe('Meta AI Suite', () => {
  it('evaluates clean physical recording with Muse Spark 1.3 as supported regional candidate', () => {
    const result = evaluateSparkMeasurementInsight({
      sessionSummary: {
        durationSeconds: 600,
        nominalHz: 10,
        actualHz: 9.97,
        baselineMedianMicroT: 46.1,
        noiseMadNt: 62.0,
        p95DeltaNt: 432.5,
        maxDeltaNt: 924.6,
        endpointDriftNt: -333.5,
        rateOfChangeMicroTPerSec: 0.076,
      },
      qcResult: {
        accepted: true,
        flags: [],
      },
      spaceWeatherContext: {
        imfBzNt: -12.4,
        solarWindSpeedKmS: 650,
        boulderDeflectionNt: 340,
      },
    });

    expect(result.model).toBe('muse-spark-1.3');
    expect(result.scientificVerdict).toBe('SUPPORTED_REGIONAL_CANDIDATE');
    expect(result.confidence).toBe('HIGH');
    expect(result.physicalInterpretation.rateOfChangeAnalysis).toContain('dB/dt');
    expect(result.narrative).toContain('Meta Muse Spark 1.3');
    expect(result.recommendedNextActions).toHaveLength(3);
  });

  it('evaluates contaminated session with Muse Spark as rejected', () => {
    const result = evaluateSparkMeasurementInsight({
      sessionSummary: {
        durationSeconds: 300,
        nominalHz: 10,
        actualHz: 10,
        baselineMedianMicroT: 50.0,
        noiseMadNt: 400.0,
        p95DeltaNt: 1200,
        maxDeltaNt: 3000,
        endpointDriftNt: 500,
      },
      qcResult: {
        accepted: false,
        flags: ['MOTION', 'LOCAL_INTERFERENCE'],
      },
    });

    expect(result.scientificVerdict).toBe('REJECTED_CONTAMINATED');
    expect(result.confidence).toBe('HIGH');
    expect(result.narrative).toContain('rejected by scientific QC');
  });

  it('runs Muse Wonder adversarial red-team to enforce scientific invariants', () => {
    const result = evaluateWonderRedTeam({
      sparkVerdict: 'SUPPORTED_REGIONAL_CANDIDATE',
      sessionSummary: {
        durationSeconds: 600,
        nominalHz: 10,
        actualHz: 9.97,
        baselineMedianMicroT: 46.1,
        noiseMadNt: 62.0,
        p95DeltaNt: 432.5,
        maxDeltaNt: 924.6,
        endpointDriftNt: -333.5,
      },
      qcResult: { accepted: true, flags: [] },
      independentSitesCount: 1, // Single site!
      professionalStationCoherence: false, // No Boulder corroboration yet
    });

    expect(result.model).toBe('muse-wonder');
    expect(result.critiqueStatus).toBe('CHALLENGE_RAISED');
    expect(result.skepticalChallenges.length).toBeGreaterThanOrEqual(1);
    expect(result.skepticalChallenges[0]).toContain('Single device isolation');
    expect(result.verdictAdjustment).toContain('QUALIFIED');
  });

  it('evaluates aurora alert with nighttime darkness and severe solar storm', () => {
    const alert = evaluateAuroraAlertDecision({
      userLocation: {
        geomagneticLatitudeDeg: 58.5,
        isNighttime: true,
        cloudFraction: 0.15,
        approximateCityOrRegion: 'Fairbanks / High Latitude',
      },
      spaceWeather: {
        imfBzNt: -14.2,
        solarWindSpeedKmS: 720,
        ovationActivity: 85,
        currentStormScale: 'G4',
      },
      groundEvidence: {
        phoneAccepted: true,
        phoneDeltaNt: 432.5,
        boulderCoherence: true,
      },
    });

    expect(alert.alertLevel).toBe('ACTIVE_AURORA_ALERT');
    expect(alert.visibilityLikelihood).toBe('HIGH');
    expect(alert.title).toContain('Active Aurora Alert: Severe G4 Storm');
    expect(alert.localMeasurementTrigger.recommended).toBe(true);
  });

  it('evaluates daylight conditions as elevated watch rather than active visual alert', () => {
    const alert = evaluateAuroraAlertDecision({
      userLocation: {
        geomagneticLatitudeDeg: 55.0,
        isNighttime: false, // Daylight!
        cloudFraction: 0.0,
      },
      spaceWeather: {
        imfBzNt: -10.0,
        solarWindSpeedKmS: 600,
        ovationActivity: 70,
        currentStormScale: 'G3',
      },
      groundEvidence: {
        phoneAccepted: true,
        phoneDeltaNt: 300,
        boulderCoherence: true,
      },
    });

    expect(alert.alertLevel).toBe('ELEVATED_WATCH');
    expect(alert.visibilityLikelihood).toBe('LOW');
    expect(alert.summary).toContain('Daylight currently prevents optical viewing');
  });

  it('returns valid conceptual educational artwork descriptions for all 5 stages of Muse Image', () => {
    for (const stage of [1, 2, 3, 4, 5] as const) {
      const concept = MUSE_IMAGE_CONCEPTS[stage];
      expect(concept.stage).toBe(stage);
      expect(concept.title.length).toBeGreaterThan(5);
      expect(concept.scientificPrompt.length).toBeGreaterThan(20);
      expect(concept.model).toBe('muse-image');
    }
  });

  it('generates SAM 3.1 optical sky segmentation masks', () => {
    const sam = evaluateSamOpticalSegmentation({
      imageWidth: 1920,
      imageHeight: 1080,
      nightSkyAreaRatio: 0.75,
    });

    expect(sam.model).toBe('sam-3.1');
    expect(sam.masks).toHaveLength(4);
    expect(sam.opticalVerification).toBe('CONFIRMED_AURORAL_EMISSION');
  });
});
