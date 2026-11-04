import { describe, expect, it, vi } from 'vitest';
import {
  evaluateAuroraAlertDecision,
  evaluateSamOpticalSegmentation,
  evaluateSparkMeasurementInsight,
  evaluateWonderRedTeam,
  MUSE_IMAGE_CONCEPTS,
  runLiveMetaSparkInsight,
} from './meta-suite';

describe('Meta AI Suite', () => {
  it('evaluates clean physical recording with Muse Spark 1.3 as local candidate while keeping single-site regionalVerdict INCONCLUSIVE', () => {
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
    expect(result.executionMode).toBe('LOCAL_DETERMINISTIC_EVALUATOR');
    expect(result.modelCalled).toBe(false);
    expect(result.regionalVerdict).toBe('INCONCLUSIVE');
    expect(result.scientificVerdict).toBe('INCONCLUSIVE_LOCAL_ONLY');
    expect(result.confidence).toBe('LOW');
    expect(result.physicalInterpretation.rateOfChangeAnalysis).toContain('dB/dt');
    expect(result.narrative).toContain('no model call');
    expect(result.narrative).toContain('INCONCLUSIVE');
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
    expect(result.regionalVerdict).toBe('REJECTED');
    expect(result.confidence).toBe('LOW');
    expect(result.narrative).toContain('rejected by scientific QC');
  });

  it('does not invent a rate, resolved Pc5 peak, stationarity or generic sensor noise floor',()=>{
    const result=evaluateSparkMeasurementInsight({sessionSummary:{durationSeconds:30,nominalHz:10,actualHz:9.9,baselineMedianMicroT:45,noiseMadNt:80,p95DeltaNt:300,maxDeltaNt:400,endpointDriftNt:250,dominantFrequencyHz:.004},qcResult:{accepted:true,flags:[]},spaceWeatherContext:{boulderDeflectionNt:1000}});
    expect(result.physicalInterpretation.rateOfChangeAnalysis).toContain('not supplied');
    expect(result.physicalInterpretation.frequencyRegime).toContain('No resolved frequency');
    expect(result.physicalInterpretation.noiseFloorComparison).toContain('not a validated');
    expect(result.scientificVerdict).toBe('INCONCLUSIVE_LOCAL_ONLY');expect(result.confidence).toBe('LOW');
    const invalid=evaluateSparkMeasurementInsight({sessionSummary:{durationSeconds:NaN,nominalHz:10,actualHz:10,baselineMedianMicroT:45,noiseMadNt:80,p95DeltaNt:300,maxDeltaNt:400,endpointDriftNt:250},qcResult:{accepted:true,flags:[]}});
    expect(invalid.regionalVerdict).toBe('REJECTED');expect(invalid.narrative).toContain('invalid');
  });

  it('calls live Meta Responses endpoint when API key is provided and preserves deterministic regionalVerdict', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'resp_123',
        model: 'muse-spark-1.3',
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [
              {
                text: 'Live Muse Spark 1.3 summary: Clean 62.0 nT stationary baseline with -333.5 nT drift. Single-phone regional verdict remains INCONCLUSIVE.',
              },
            ],
          },
        ],
      }),
    });

    const result = await runLiveMetaSparkInsight(
      {
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
        qcResult: { accepted: true, flags: [] },
      },
      'meta_live_test_key_123456',
      mockFetch as unknown as typeof fetch
    );

    expect(result.executionMode).toBe('LIVE_META_API');
    expect(result.modelCalled).toBe(true);
    expect(result.simulatedProvider).toBe(false);
    expect(result.regionalVerdict).toBe('INCONCLUSIVE');
    expect(result.narrative).toContain('Live Muse Spark 1.3 summary');
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

    expect(result.model).toBe('muse-wonder-1.0');
    expect(result.executionMode).toBe('LOCAL_DETERMINISTIC_EVALUATOR');
    expect(result.modelCalled).toBe(false);
    expect(result.critiqueStatus).toBe('CHALLENGE_RAISED');
    expect(result.skepticalChallenges.length).toBeGreaterThanOrEqual(1);
    expect(result.skepticalChallenges[0]).toContain('Single device isolation');
    expect(result.verdictAdjustment).toContain('QUALIFIED');
  });

  it('ignores legacy unsourced aurora claims and reports unknown', () => {
    const result=evaluateAuroraAlertDecision({userLocation:{geomagneticLatitudeDeg:58.5,isNighttime:true,cloudFraction:.15},spaceWeather:{imfBzNt:-14,ovationActivity:85,currentStormScale:'G4'},groundEvidence:{phoneAccepted:true,phoneDeltaNt:432,boulderCoherence:true}});
    expect(result.alertLevel).toBe('INSUFFICIENT_DATA');
    expect(result.visibilityLikelihood).toBe('UNKNOWN');
    expect(result.metaAudit.modelCalled).toBe(false);
    expect(result.numericalProbability).toBeNull();
  });

  it('returns valid conceptual educational artwork descriptions for all 5 stages of Muse Image', () => {
    for (const stage of [1, 2, 3, 4, 5] as const) {
      const concept = MUSE_IMAGE_CONCEPTS[stage];
      expect(concept.stage).toBe(stage);
      expect(concept.title.length).toBeGreaterThan(5);
      expect(concept.scientificPrompt.length).toBeGreaterThan(20);
      expect(concept.model).toBe('muse-image-1.0');
      expect(concept.executionMode).toBe('CONCEPTUAL_SPECIFICATION');
    }
  });

  it('generates SAM 3.1 optical sky segmentation masks with honest conceptual specification metadata', () => {
    const sam = evaluateSamOpticalSegmentation({
      imageWidth: 1920,
      imageHeight: 1080,
      nightSkyAreaRatio: 0.75,
    });

    expect(sam.model).toBe('sam-3.1');
    expect(sam.executionMode).toBe('CONCEPTUAL_SPECIFICATION_DEMO');
    expect(sam.modelCalled).toBe(false);
    expect(sam.masks).toHaveLength(0);
    expect(sam.opticalVerification).toBe('INCONCLUSIVE');
  });
});
