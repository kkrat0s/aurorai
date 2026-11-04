import { z } from 'zod';
import { META_RESPONSES_URL } from './meta';

export const META_MODELS = {
  SPARK: 'muse-spark-1.3',
  WONDER: 'muse-wonder-1.0',
  IMAGE: 'muse-image-1.0',
  SAM: 'sam-3.1',
} as const;

export interface SparkInsightRequest {
  sessionSummary: {
    durationSeconds: number;
    nominalHz: number;
    actualHz: number;
    baselineMedianMicroT: number;
    noiseMadNt: number;
    p95DeltaNt: number;
    maxDeltaNt: number;
    endpointDriftNt: number;
    dominantFrequencyHz?: number;
    rateOfChangeMicroTPerSec?: number;
  };
  qcResult: {
    accepted: boolean;
    flags: string[];
  };
  spaceWeatherContext?: {
    imfBzNt?: number;
    solarWindSpeedKmS?: number;
    noaaStormScale?: string;
    boulderDeflectionNt?: number;
  };
}

export interface SparkInsightResult {
  model: typeof META_MODELS.SPARK;
  provider: 'Meta Model API' | 'AuroraSense deterministic analysis';
  timestamp: string;
  executionMode: 'LIVE_META_API' | 'LOCAL_DETERMINISTIC_EVALUATOR';
  modelCalled: boolean;
  regionalVerdict: 'INCONCLUSIVE' | 'REJECTED';
  scientificVerdict: 'INCONCLUSIVE_LOCAL_ONLY' | 'REJECTED_CONTAMINATED';
  confidence: 'HIGH' | 'MODERATE' | 'LOW';
  narrative: string;
  physicalInterpretation: {
    driftCharacter: string;
    rateOfChangeAnalysis: string;
    frequencyRegime: string;
    noiseFloorComparison: string;
  };
  recommendedNextActions: string[];
  simulatedProvider: boolean;
}

export interface WonderRedTeamRequest {
  sparkVerdict: string;
  sessionSummary: SparkInsightRequest['sessionSummary'];
  qcResult: SparkInsightRequest['qcResult'];
  independentSitesCount: number;
  professionalStationCoherence: boolean;
}

export interface WonderRedTeamResult {
  model: typeof META_MODELS.WONDER;
  provider: 'Meta Model API' | 'AuroraSense deterministic analysis';
  timestamp: string;
  executionMode: 'LOCAL_DETERMINISTIC_EVALUATOR';
  modelCalled: boolean;
  critiqueStatus: 'PASSED_SKEPTICISM' | 'CHALLENGE_RAISED' | 'GATE_FAILED';
  skepticalChallenges: string[];
  scientificInvariantsChecked: {
    singleDeviceCannotClaimRegional: boolean;
    temperatureOrDomesticSourcePlausible: boolean;
    professionalReferenceRequired: boolean;
    daylightOrCloudsConsidered: boolean;
  };
  verdictAdjustment: string;
  simulatedProvider: boolean;
}

export { evaluateAuroraAlertDecision, evaluateEvidenceFromNoaa, auroraSolarElevation, AURORA_EVIDENCE_VERSION } from './aurora-evidence';
export type { AuroraAlertEvaluationRequest, AuroraAlertEvaluationResult } from './aurora-evidence';

export interface SamSegmentationRequest {
  imageWidth: number;
  imageHeight: number;
  nightSkyAreaRatio?: number;
}

export interface SamSegmentationResult {
  model: typeof META_MODELS.SAM;
  provider: 'Meta Model API' | 'AuroraSense deterministic analysis';
  timestamp: string;
  executionMode: 'CONCEPTUAL_SPECIFICATION_DEMO';
  modelCalled: false;
  provenanceNote: string;
  masks: Array<{
    label: 'AURORAL_EMISSION_GREEN_557NM' | 'AURORAL_EMISSION_RED_630NM' | 'CLOUD_COVER' | 'LIGHT_POLLUTION' | 'DARK_SKY';
    areaPercentage: number;
    confidence: number;
    spectralBand: string;
  }>;
  opticalVerification: 'CONFIRMED_AURORAL_EMISSION' | 'PROBABLE_CLOUD_OR_LIGHT_POLLUTION' | 'INCONCLUSIVE';
}

export interface MuseImageConcept {
  stage: 1 | 2 | 3 | 4 | 5;
  title: string;
  scientificPrompt: string;
  diagramDescription: string;
  educationalCaption: string;
  model: typeof META_MODELS.IMAGE;
  executionMode: 'CONCEPTUAL_SPECIFICATION';
}

/**
 * 5-Stage Conceptual Educational Visuals for Muse Image (Meta Image Generation)
 */
export const MUSE_IMAGE_CONCEPTS: Record<1 | 2 | 3 | 4 | 5, MuseImageConcept> = {
  1: {
    stage: 1,
    title: 'Solar Wind Plasma & Interplanetary Magnetic Field (IMF)',
    scientificPrompt: 'Scientific illustration of coronal mass ejection plasma eruption from the Sun into the heliosphere, showing spiral Parker interplanetary magnetic field lines and energetic solar protons.',
    diagramDescription: 'The Sun continuously expands a supersonic plasma stream (solar wind) carrying embedded magnetic fields (IMF) across 150 million kilometers to Earth.',
    educationalCaption: 'Stage 1: Solar wind carries magnetized plasma through the heliosphere; an Earth-directed CME can disturb this flow.',
    model: META_MODELS.IMAGE,
    executionMode: 'CONCEPTUAL_SPECIFICATION',
  },
  2: {
    stage: 2,
    title: 'Dayside Magnetic Reconnection & Flux Transfer',
    scientificPrompt: 'Cutaway technical schematic of Earth magnetopause dayside magnetic reconnection, with southward IMF Bz lines breaking and reconnecting with Earth dipolar geomagnetic field lines at the subsolar point.',
    diagramDescription: 'When the IMF points southward (negative Bz), it directly reconnects with Earth’s northward dipole field, peeling back magnetic flux into the nightside magnetotail.',
    educationalCaption: 'Stage 2: Magnetic reconnection acts as an open gate, allowing solar wind kinetic energy to couple into Earth’s magnetosphere.',
    model: META_MODELS.IMAGE,
    executionMode: 'CONCEPTUAL_SPECIFICATION',
  },
  3: {
    stage: 3,
    title: 'Magnetotail Energy Storage & Substorm Onset',
    scientificPrompt: 'Cross-section of Earth nightside magnetotail showing plasma sheet thinning, cross-tail electric currents, and explosive magnetic reconnection accelerating energetic electrons towards polar ionosphere.',
    diagramDescription: 'Stored magnetic flux in the magnetotail reaches a critical threshold and reconnects explosively, converting magnetic tension into particle kinetic energy.',
    educationalCaption: 'Stage 3: Magnetotail reconnection releases stored magnetic energy and accelerates particles; some electrons travel toward the upper atmosphere.',
    model: META_MODELS.IMAGE,
    executionMode: 'CONCEPTUAL_SPECIFICATION',
  },
  4: {
    stage: 4,
    title: 'Auroral Electrojet Currents & Atmospheric Collisions',
    scientificPrompt: 'Upper atmosphere cross section at 100-300km altitude showing incoming energetic electrons colliding with atomic oxygen and molecular nitrogen, creating Birkeland field-aligned currents and ground magnetometer deflections.',
    diagramDescription: 'Precipitating electrons strike upper atmosphere gases at 100–300 km altitude. The intense currents (electrojets) produce ground magnetic deflections measurable by magnetometers.',
    educationalCaption: 'Stage 4: Precipitating electrons collide with atmospheric oxygen and nitrogen, producing intense horizontal ionospheric electrojets that alter Earth’s ground magnetic field.',
    model: META_MODELS.IMAGE,
    executionMode: 'CONCEPTUAL_SPECIFICATION',
  },
  5: {
    stage: 5,
    title: 'Atmospheric Light Emission & Auroral Glow',
    scientificPrompt: 'Night sky view of vibrant green 557.7 nm atomic oxygen auroral curtain and high-altitude red 630.0 nm aurora over a dark northern landscape with starry sky.',
    diagramDescription: 'De-excitation of oxygen atoms emits the iconic 557.7 nm emerald green glow (100–150 km) and 630.0 nm crimson red curtains (>200 km).',
    educationalCaption: 'Stage 5: Excited atmospheric atoms drop back to ground state, emitting photons that create the breathtaking visual aurora borealis and australis.',
    model: META_MODELS.IMAGE,
    executionMode: 'CONCEPTUAL_SPECIFICATION',
  },
};

/**
 * Meta Muse Spark 1.3 Scientific Measurement Evaluator (Deterministic Local Baseline)
 * Note: Regional verdict is strictly owned by the deterministic validator (INCONCLUSIVE for a single phone).
 */
const finite = z.number().finite();
export const sparkInsightRequestSchema = z.object({
  sessionSummary:z.object({durationSeconds:finite.positive().max(86400),nominalHz:finite.positive().max(1000),actualHz:finite.positive().max(1000),baselineMedianMicroT:finite.nonnegative(),noiseMadNt:finite.nonnegative(),p95DeltaNt:finite.nonnegative(),maxDeltaNt:finite.nonnegative(),endpointDriftNt:finite,dominantFrequencyHz:finite.positive().optional(),rateOfChangeMicroTPerSec:finite.nonnegative().optional()}),
  qcResult:z.object({accepted:z.boolean(),flags:z.array(z.string().max(120)).max(100)}),
  spaceWeatherContext:z.object({imfBzNt:finite.optional(),solarWindSpeedKmS:finite.optional(),noaaStormScale:z.string().max(10).optional(),boulderDeflectionNt:finite.optional()}).optional(),
});
export function evaluateSparkMeasurementInsight(request: SparkInsightRequest, _apiKey?: string): SparkInsightResult {
  void _apiKey;
  const parsed=sparkInsightRequestSchema.safeParse(request);
  const session=parsed.success?parsed.data.sessionSummary:null;
  const accepted=parsed.success&&parsed.data.qcResult.accepted;
  const format=(n:number|undefined|null,digits=1)=>n===undefined||n===null?'not measured':n.toFixed(digits);
  const frequency=session?.dominantFrequencyHz;
  const enoughCycles=frequency!==undefined&&session!==null&&session.durationSeconds*frequency>=3&&frequency<session.actualHz/2;
  const regionalVerdict=accepted?'INCONCLUSIVE':'REJECTED';
  return {
    model:META_MODELS.SPARK,provider:'AuroraSense deterministic analysis',timestamp:new Date().toISOString(),
    executionMode:'LOCAL_DETERMINISTIC_EVALUATOR',modelCalled:false,simulatedProvider:true,
    regionalVerdict,scientificVerdict:accepted?'INCONCLUSIVE_LOCAL_ONLY':'REJECTED_CONTAMINATED',confidence:'LOW',
    narrative:!parsed.success?'Summary rejected: invalid or non-finite measurement metadata. No physical conclusion is available.':!accepted
      ?`Recording rejected by scientific QC (${parsed.data.qcResult.flags.join(', ')||'QC not accepted'}). A quality gate does not identify the physical source of interference. No regional space-weather conclusion is available.`
      :`Deterministic measurement summary (no model call): ${format(session?.p95DeltaNt)} nT p95 variation, ${format(session?.endpointDriftNt)} nT endpoint change and ${format(session?.noiseMadNt)} nT MAD over ${format(session?.durationSeconds,0)} seconds. Passing QC does not establish stationarity or identify a magnetic source. Handling, nearby devices and thermal drift remain plausible. Regional verdict: INCONCLUSIVE from this single phone; timestamped independent sites and a time-aligned professional reference are required.`,
    physicalInterpretation:{
      driftCharacter:`Endpoint change ${format(session?.endpointDriftNt)} nT; endpoints alone do not determine monotonicity or cause.`,
      rateOfChangeAnalysis:session?.rateOfChangeMicroTPerSec===undefined?'dB/dt not supplied; no rate was imputed.':`Reported dB/dt ${format(session.rateOfChangeMicroTPerSec,3)} µT/s; rate alone cannot separate handling, domestic fields, thermal effects and regional variation.`,
      frequencyRegime:enoughCycles?`Reported spectral peak ${format(frequency,5)} Hz; window contains at least three cycles. No geomagnetic source attribution is established.`:'No resolved frequency attribution: no measured peak, insufficient cycles or above Nyquist. A short recording cannot establish a Pc5 oscillation.',
      noiseFloorComparison:`Session MAD ${format(session?.noiseMadNt)} nT is an empirical spread statistic, not a validated sensor noise floor or proof of stationarity; no universal phone benchmark is assumed.`,
    },
    recommendedNextActions:[
      'Preserve the raw session privately with explicit consent, UTC/monotonic time and QC flags.',
      'Compare time-aligned phone scalar variation against a suitable professional scalar reference; report distance, units and missing intervals.',
      'Collect consenting independent sites to test regional coherence; one phone or co-located pair remains INCONCLUSIVE.',
    ],
  };
}

/**
 * Optional Live Server-Side Meta Model API Call (`muse-spark-1.3`)
 * Invokes `https://api.meta.ai/v1/responses` when a valid API key is present on the server;
 * falls back cleanly to `evaluateSparkMeasurementInsight` (`modelCalled: false`) if unconfigured or offline.
 */
export async function runLiveMetaSparkInsight(
  request: SparkInsightRequest,
  apiKey?: string,
  fetcher: typeof fetch = fetch
): Promise<SparkInsightResult> {
  const fallback = evaluateSparkMeasurementInsight(request);
  if (!sparkInsightRequestSchema.safeParse(request).success || !apiKey || apiKey.trim().length < 10 || typeof window !== 'undefined') {
    return fallback;
  }

  try {
    const prompt = `Summarize this smartphone magnetometer session concisely (under 90 words) without overriding the deterministic regional verdict (${fallback.regionalVerdict}). Session: duration=${request.sessionSummary.durationSeconds}s, cadence=${request.sessionSummary.actualHz}Hz, baselineNoiseMad=${request.sessionSummary.noiseMadNt}nT, p95Delta=${request.sessionSummary.p95DeltaNt}nT, drift=${request.sessionSummary.endpointDriftNt}nT, qcAccepted=${request.qcResult.accepted}. Emphasize that a single phone cannot establish regional space weather disturbance.`;
    const response = await fetcher(META_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: META_MODELS.SPARK,
        instructions: 'You are AuroraSense scientific observation coordinator. Never override the deterministic validator verdict. A single phone is always INCONCLUSIVE for regional disturbance.',
        input: [{ role: 'user', content: prompt }],
        max_output_tokens: 220,
        store: false,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) return fallback;
    const data = (await response.json()) as {
      model?: string;
      status?: string;
      output?: Array<{ type?: string; content?: Array<{ text?: string }> }>;
    };
    if (data.status !== 'completed') return fallback;

    const textBlock = data.output
      ?.flatMap((item) => item.content ?? [])
      .find((c) => typeof c.text === 'string' && c.text.trim().length > 10)?.text;

    if (!textBlock || textBlock.length > 2000 || data.model !== META_MODELS.SPARK) return fallback;

    return {
      ...fallback,
      executionMode: 'LIVE_META_API',
      provider: 'Meta Model API',
      modelCalled: true,
      simulatedProvider: false,
      narrative: `${textBlock.trim()} Deterministic regional verdict: ${fallback.regionalVerdict}. Model narrative is not scientific validation.`,
    };
  } catch {
    return fallback;
  }
}

/**
 * Meta Muse Wonder Adversarial Red-Team Evaluator (Deterministic Invariant Gate)
 */
export function evaluateWonderRedTeam(
  request: WonderRedTeamRequest,
  _apiKey?: string
): WonderRedTeamResult {
  void _apiKey;
  const { sessionSummary, qcResult, independentSitesCount, professionalStationCoherence } = request;
  const now = new Date().toISOString();

  const challenges: string[] = [];
  let critiqueStatus: WonderRedTeamResult['critiqueStatus'] = 'PASSED_SKEPTICISM';

  // Invariant 1: Single device cannot establish regional disturbance
  const singleDeviceCannotClaimRegional = independentSitesCount >= 3;
  if (!singleDeviceCannotClaimRegional) {
    challenges.push('Single device isolation: A single phone (or fewer than 3 independent sites ≥20 km apart), regardless of quietness, cannot differentiate a building HVAC motor or thermal drift from a regional geomagnetic storm.');
    critiqueStatus = 'CHALLENGE_RAISED';
  }

  // Invariant 2: Professional observatory coherence
  const professionalReferenceRequired = professionalStationCoherence;
  if (!professionalReferenceRequired) {
    challenges.push('Missing time-aligned professional ground truth: USGS Boulder or equivalent INTERMAGNET station trace has not corroborated this specific UTC window.');
    critiqueStatus = 'CHALLENGE_RAISED';
  }

  // Invariant 3: Temperature settling check
  const temperatureOrDomesticSourcePlausible = Math.abs(sessionSummary.endpointDriftNt) > 250 && sessionSummary.durationSeconds <= 600;
  if (temperatureOrDomesticSourcePlausible) {
    challenges.push('Temperature-related sensor drift or a domestic magnetic source remains plausible; this session contains no calibrated temperature control that identifies the cause.');
    if (critiqueStatus === 'PASSED_SKEPTICISM') critiqueStatus = 'CHALLENGE_RAISED';
  }

  // Invariant 4: Sensor QC
  const qcPassed = qcResult.accepted;
  if (!qcPassed) {
    challenges.push(`Engineering QC failure: Flags [${qcResult.flags.join(', ')}] invalidate physical inference.`);
    critiqueStatus = 'GATE_FAILED';
  }

  const verdictAdjustment = critiqueStatus === 'GATE_FAILED'
    ? 'OVERRULED: Rejection confirmed. No regional alert permitted.'
    : critiqueStatus === 'CHALLENGE_RAISED'
    ? 'QUALIFIED: Locally clean candidate, but regional verdict remains strictly INCONCLUSIVE until ≥3 independent sites and a time-aligned observatory reference confirm.'
    : 'UNVERIFIED: Supplied summary checks passed, but counts and a coherence boolean do not establish independence or alignment. Only the scientific validator can publish SUPPORTED.';

  return {
    model: META_MODELS.WONDER,
    provider: 'Meta Model API',
    timestamp: now,
    executionMode: 'LOCAL_DETERMINISTIC_EVALUATOR',
    modelCalled: false,
    critiqueStatus,
    skepticalChallenges: challenges,
    scientificInvariantsChecked: {
      singleDeviceCannotClaimRegional,
      temperatureOrDomesticSourcePlausible,
      professionalReferenceRequired,
      daylightOrCloudsConsidered: false,
    },
    verdictAdjustment,
    simulatedProvider: true,
  };
}

/**
 * Meta SAM 3.1 Optical Sky Segmentation Schema & Benchmark Simulator
 * Explicitly labeled as a conceptual specification / simulated benchmark when no live camera frame is provided.
 */
export function evaluateSamOpticalSegmentation(request: SamSegmentationRequest): SamSegmentationResult {
  void request;
  return {
    model:META_MODELS.SAM,provider:'AuroraSense deterministic analysis',timestamp:new Date().toISOString(),
    executionMode:'CONCEPTUAL_SPECIFICATION_DEMO',modelCalled:false,
    provenanceNote:'Conceptual schema only. No camera image, segmentation model or verified optical observation was processed. RGB color alone cannot establish spectral emission wavelengths.',
    masks:[],opticalVerification:'INCONCLUSIVE',
  };
}
