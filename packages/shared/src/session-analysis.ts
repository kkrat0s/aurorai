import { comparePhoneWithReference, stationDistanceKm, type CoarseLocation, type GroundComparison, type GroundReference } from './ground-reference';
import { analyzeInteractionContext } from './experiment';
import { median, type QcFlag, type SensorQcResult, type SensorSession } from './sensor';

export const SESSION_ANALYSIS_VERSION = 'session-evidence-0.1.0';

export type AxisName = 'x' | 'y' | 'z';
export interface AxisAnalysis {
  axis: AxisName;
  baselineMicroT: number | null;
  p95AbsoluteDepartureNt: number | null;
  peakAbsoluteDepartureNt: number | null;
  usableSamples: number;
  flaggedSamples: number;
}
export interface FlagInterval {
  startElapsedSeconds: number;
  endElapsedSeconds: number;
  flags: QcFlag[];
  startAtUtc: string | null;
  endAtUtc: string | null;
}
export interface UpstreamSeries {
  samples: { observedAtUtc: string; bzNt: number | null; speedKmS: number | null; densityCm3: number | null }[];
  retrievedAtUtc?: string;
  sourceUrl?: string;
}
export interface KpSeries {
  sourceId?: string;
  samples: { observedAtUtc: string; kp: number }[];
  retrievedAtUtc?: string;
  sourceUrl?: string;
}
export interface OvationModel {
  observedAtUtc: string;
  validAtUtc: string;
  retrievedAtUtc?: string;
  sourceUrl?: string;
  coordinates: [number, number, number][];
}
export interface SessionAnalysisContext {
  reference?: GroundReference | null;
  coarseLocation?: CoarseLocation;
  upstream?: UpstreamSeries | null;
  kp?: KpSeries | null;
  ovation?: OvationModel | null;
  asOfUtc: string;
}
export interface SessionEvidenceAnalysis {
  version: typeof SESSION_ANALYSIS_VERSION;
  sessionId: string;
  measurement: {
    kind: SensorSession['kind'];
    frame: 'DEVICE';
    unit: 'microT';
    startAtUtc: string;
    endAtUtc: string | null;
    device: SensorSession['device'] & { platform: string };
    durationSeconds: number;
    sampleCount: number;
    actualHz: number | null;
    baselineMagnitudeMicroT: number | null;
    baselineNoiseMadNt: number | null;
    qcAccepted: boolean;
    qcFlags: QcFlag[];
    usableSamples: number;
  };
  axes: AxisAnalysis[];
  flagIntervals: FlagInterval[];
  eventMarkers: SensorSession['markers'];
  groundComparison: GroundComparison;
  upstreamContext: {
    status: 'CONTEXT_FOUND' | 'NO_OVERLAP' | 'UNAVAILABLE';
    windowStartUtc: string;
    windowEndUtc: string;
    sampleCount: number;
    medianBzNt: number | null;
    southwardFraction: number | null;
    medianSpeedKmS: number | null;
    firstSampleUtc: string | null;
    lastSampleUtc: string | null;
    retrievedAtUtc: string | null;
    sourceUrl: string | null;
    propagationLagApplied: false;
  };
  planetaryKp: {
    value: number | null;
    observedAtUtc: string | null;
    retrievedAtUtc: string | null;
    sourceUrl: string | null;
    scope: 'GLOBAL_CONTEXT_ONLY';
  };
  auroraModel: {
    status: 'MODEL_UNAVAILABLE' | 'CAPTURE_LOCATION_UNAVAILABLE' | 'NEAREST_CELL_CONTEXT' | 'VALID_DURING_CAPTURE';
    nearestDistanceKm: number | null;
    activityPercent: number | null;
    observedAtUtc: string | null;
    validAtUtc: string | null;
    retrievedAtUtc: string | null;
    sourceUrl: string | null;
    scope: 'MODELED_ACTIVITY_NOT_VISIBILITY_PROBABILITY';
  };
  capturedContext: {
    accelerometerSamples: number;
    screenTouchMarkers: number;
    qcFlaggedNearTouch: number;
    qcFlaggedAwayFromTouch: number;
    batteryStateEvents: number;
    latestBatteryState: 'CHARGING' | 'FULL' | 'UNPLUGGED' | 'NOT_RECORDED';
    contextNotCaptured: string[];
  };
  interpretation: {
    measuredField: string;
    interference: string;
    geomagneticResponse: string;
    solarDriver: string;
    reconnection: string;
    aurora: string;
  };
  nextMeasurements: string[];
}

const INTERPRETIVE_FLAGS: QcFlag[] = ['MOTION', 'MOTION_UNKNOWN', 'ORIENTATION_CHANGED', 'LOCAL_INTERFERENCE', 'ABRUPT_JUMP', 'SATURATION_SUSPECT', 'SAMPLE_GAP', 'CLOCK_DISCONTINUITY'];
const medianFinite = (values: number[]) => median(values.filter(Number.isFinite));
function percentile95(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).map(Math.abs).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] : null;
}
function axisAnalyses(session: SensorSession, qc: SensorQcResult): AxisAnalysis[] {
  const first = session.samples[0]?.sensorTimestampSeconds;
  const baselineReady = qc.baselineMicroT !== null && !qc.flags.includes('BASELINE_PENDING') && first !== undefined;
  return (['x', 'y', 'z'] as const).map(axis => {
    const baselineValues = baselineReady ? session.samples.flatMap((sample, index) => {
      const row = qc.sampleResults[index];
      return sample.sensorTimestampSeconds - first! < 120 && row?.usable && Number.isFinite(sample[axis]) ? [sample[axis]] : [];
    }) : [];
    const baseline = baselineValues.length >= 30 ? medianFinite(baselineValues) : null;
    const values = session.samples.flatMap((sample, index) => {
      const row = qc.sampleResults[index];
      return baseline !== null && row?.usable && Number.isFinite(sample[axis]) ? [(sample[axis] - baseline) * 1000] : [];
    });
    return {
      axis,
      baselineMicroT: baseline,
      p95AbsoluteDepartureNt: percentile95(values),
      peakAbsoluteDepartureNt: values.length ? Math.max(...values.map(Math.abs)) : null,
      usableSamples: values.length,
      flaggedSamples: qc.sampleResults.filter((row, index) => !row.usable && Number.isFinite(session.samples[index]?.[axis])).length,
    };
  });
}
function flagIntervals(session: SensorSession, qc: SensorQcResult): FlagInterval[] {
  const intervals: FlagInterval[] = [];
  let active: FlagInterval | null = null;
  for (let i = 0; i < qc.sampleResults.length; i++) {
    const row = qc.sampleResults[i];
    const sample = session.samples[i];
    const flags = INTERPRETIVE_FLAGS.filter(flag => row?.flags.includes(flag));
    if (!flags.length || !sample) {
      if (active) intervals.push(active);
      active = null;
      continue;
    }
    const elapsed = sample.sensorTimestampSeconds - (session.samples[0]?.sensorTimestampSeconds ?? sample.sensorTimestampSeconds);
    if (active && active.flags.join('|') === flags.join('|') && elapsed - active.endElapsedSeconds <= 1) {
      active.endElapsedSeconds = elapsed;
      active.endAtUtc = row.observedAtUtc;
    } else {
      if (active) intervals.push(active);
      active = { startElapsedSeconds: elapsed, endElapsedSeconds: elapsed, flags, startAtUtc: row.observedAtUtc, endAtUtc: row.observedAtUtc };
    }
  }
  if (active) intervals.push(active);
  return intervals;
}
function upstreamContext(upstream: UpstreamSeries | null | undefined, startUtc: string, endUtc: string | null, asOfUtc: string): SessionEvidenceAnalysis['upstreamContext'] {
  const start = Date.parse(startUtc), end = Date.parse(endUtc ?? asOfUtc);
  const contextStart = start - 2 * 60 * 60 * 1000;
  const rows = upstream?.samples.filter(row => {
    const time = Date.parse(row.observedAtUtc);
    return Number.isFinite(time) && time >= contextStart && time <= (Number.isFinite(end) ? end : Date.now());
  }) ?? [];
  const bz = rows.flatMap(row => row.bzNt !== null && Number.isFinite(row.bzNt) ? [row.bzNt] : []);
  const speeds = rows.flatMap(row => row.speedKmS !== null && Number.isFinite(row.speedKmS) ? [row.speedKmS] : []);
  const fraction = bz.length ? bz.filter(value => value < 0).length / bz.length : null;
  return {
    status: !upstream ? 'UNAVAILABLE' : rows.length ? 'CONTEXT_FOUND' : 'NO_OVERLAP',
    windowStartUtc: new Date(contextStart).toISOString(), windowEndUtc: Number.isFinite(end) ? new Date(end).toISOString() : startUtc,
    sampleCount: bz.length, medianBzNt: medianFinite(bz), southwardFraction: fraction,
    medianSpeedKmS: medianFinite(speeds), firstSampleUtc: rows[0]?.observedAtUtc ?? null,
    lastSampleUtc: rows.at(-1)?.observedAtUtc ?? null, retrievedAtUtc: upstream?.retrievedAtUtc ?? null,
    sourceUrl: upstream?.sourceUrl ?? null, propagationLagApplied: false,
  };
}
function planetaryKp(kp: KpSeries | null | undefined, endUtc: string | null, asOfUtc: string): SessionEvidenceAnalysis['planetaryKp'] {
  const end = Date.parse(endUtc ?? asOfUtc);
  const point = kp?.samples.filter(row => {
    const at = Date.parse(row.observedAtUtc);
    return Number.isFinite(at) && at <= end && at >= end - 4 * 60 * 60 * 1000;
  }).at(-1);
  return { value: point?.kp ?? null, observedAtUtc: point?.observedAtUtc ?? null, retrievedAtUtc: kp?.retrievedAtUtc ?? null, sourceUrl: kp?.sourceUrl ?? null, scope: 'GLOBAL_CONTEXT_ONLY' };
}
function auroraModel(ovation: OvationModel | null | undefined, location: CoarseLocation | undefined, startUtc: string, endUtc: string | null, asOfUtc: string): SessionEvidenceAnalysis['auroraModel'] {
  const base = { nearestDistanceKm: null, activityPercent: null, observedAtUtc: ovation?.observedAtUtc ?? null, validAtUtc: ovation?.validAtUtc ?? null, retrievedAtUtc: ovation?.retrievedAtUtc ?? null, sourceUrl: ovation?.sourceUrl ?? null, scope: 'MODELED_ACTIVITY_NOT_VISIBILITY_PROBABILITY' as const };
  if (!ovation) return { ...base, status: 'MODEL_UNAVAILABLE' };
  if (!location) return { ...base, status: 'CAPTURE_LOCATION_UNAVAILABLE' };
  const nearest = ovation.coordinates.map(([lon, lat, percent]) => {
    const normalizedLon = ((lon + 180) % 360 + 360) % 360 - 180;
    return { distanceKm: stationDistanceKm(location, { latitude: lat, longitude: normalizedLon }), percent };
  }).filter((cell): cell is { distanceKm: number; percent: number } => cell.distanceKm !== null && Number.isFinite(cell.distanceKm) && Number.isFinite(cell.percent)).sort((a,b) => a.distanceKm-b.distanceKm)[0];
  if (!nearest || nearest.distanceKm > 250) return { ...base, status: 'NEAREST_CELL_CONTEXT', nearestDistanceKm: nearest?.distanceKm ?? null };
  const valid = Date.parse(ovation.validAtUtc), start = Date.parse(startUtc), end = Date.parse(endUtc ?? asOfUtc);
  const sameTime = Number.isFinite(valid) && valid >= start && valid <= end;
  return { ...base, status: sameTime ? 'VALID_DURING_CAPTURE' : 'NEAREST_CELL_CONTEXT', nearestDistanceKm: nearest.distanceKm, activityPercent: nearest.percent };
}

/** Reproducible, source-aware session analysis. It reports evidence, not physical causation. */
export function analyzeSessionEvidence(session: SensorSession, qc: SensorQcResult, context: SessionAnalysisContext): SessionEvidenceAnalysis {
  const comparison = comparePhoneWithReference(session, qc, context.reference ?? null, context.asOfUtc, context.coarseLocation);
  const upstream = upstreamContext(context.upstream, session.startedAtUtc, session.endedAtUtc, context.asOfUtc);
  const kp = planetaryKp(context.kp, session.endedAtUtc, context.asOfUtc);
  const ovation = auroraModel(context.ovation, context.coarseLocation, session.startedAtUtc, session.endedAtUtc, context.asOfUtc);
  const interaction = analyzeInteractionContext(session, qc);
  const batteryMarkers = session.markers.filter(marker => ['BATTERY_CHARGING', 'BATTERY_FULL', 'BATTERY_UNPLUGGED'].includes(marker.kind));
  const latestBattery = batteryMarkers.at(-1);
  const contextNotCaptured = [
    'Wi-Fi, Bluetooth and cellular radio state or traffic',
    'Incoming calls, notifications and other interruptions as sample-level events',
    'Phone temperature, CPU load and sensor calibration/absolute accuracy',
    ...(batteryMarkers.length ? [] : ['Battery power state during this session (no system-event marker was recorded)']),
  ];
  const capturedContext = {
    accelerometerSamples: session.samples.filter(sample => sample.accelerationG !== null && sample.accelerationAgeMs !== null && sample.accelerationAgeMs >= 0 && sample.accelerationAgeMs <= 500).length,
    screenTouchMarkers: interaction.manualMarkers, qcFlaggedNearTouch: interaction.flaggedNearTouch,
    qcFlaggedAwayFromTouch: interaction.flaggedAwayFromTouch, batteryStateEvents: batteryMarkers.length,
    latestBatteryState: latestBattery?.kind === 'BATTERY_CHARGING' ? 'CHARGING' as const : latestBattery?.kind === 'BATTERY_FULL' ? 'FULL' as const : latestBattery?.kind === 'BATTERY_UNPLUGGED' ? 'UNPLUGGED' as const : 'NOT_RECORDED' as const,
    contextNotCaptured,
  };
  const flags = new Set(qc.flags);
  const intervals = flagIntervals(session, qc);
  const localFlags = ['LOCAL_INTERFERENCE', 'ABRUPT_JUMP', 'MOTION', 'ORIENTATION_CHANGED', 'SATURATION_SUSPECT'].filter(flag => flags.has(flag as QcFlag));
  const measuredField = session.samples.length
    ? `The phone recorded ${session.samples.length.toLocaleString()} three-axis DEVICE-frame samples in µT. ${qc.baselineMicroT === null ? 'No protocol baseline was established, so baseline-relative physical interpretation is unavailable.' : `The first two-minute scalar baseline median was ${qc.baselineMicroT.toFixed(2)} µT.`} Absolute calibration and the phone’s magnetic bias are unknown; a plausible terrestrial magnitude does not separate Earth’s field from nearby sources.`
    : 'No phone samples are available to interpret.';
  const interference = localFlags.length
    ? `QC marked ${localFlags.join(', ')}. These flags show data-quality or abrupt-change patterns, not a unique cause. ${interaction.manualMarkers ? `${interaction.manualMarkers} screen-touch markers were recorded; ${interaction.flaggedNearTouch} flagged samples fell within the fixed −1/+3 second touch windows, compared with ${interaction.flaggedAwayFromTouch} flagged samples away from them. This is temporal association, not causation.` : 'No screen-touch markers were recorded, so touch-related timing cannot be tested.'} ${batteryMarkers.length ? `The phone logged ${batteryMarkers.length} system battery-state observation(s); latest was ${capturedContext.latestBatteryState}.` : 'Battery power state was not retained for this session.'} Wi-Fi, Bluetooth/cellular activity, calls and phone temperature were not recorded. Controlled one-source-at-a-time tests are needed to attribute an artifact.`
    : qc.accepted
      ? `No configured interference flag was raised in this session. That does not prove the area was magnetically quiet or exclude smooth nearby-device fields, temperature drift or unmeasured sensor bias. ${interaction.manualMarkers ? `Touch markers: ${interaction.manualMarkers}; flagged samples near/away: ${interaction.flaggedNearTouch}/${interaction.flaggedAwayFromTouch}.` : 'No screen-touch markers were recorded.'} Battery-state observations: ${batteryMarkers.length ? `${batteryMarkers.length} state event(s)` : 'not recorded'}. Radio, call and temperature context was not collected.`
      : `QC did not accept this session (${qc.flags.join(', ') || 'baseline or coverage incomplete'}). Do not use it as positive geomagnetic evidence; QC rejection alone does not identify what caused the issue.`;
  const geomagneticResponse = comparison.status === 'DESCRIPTIVE_COMPARISON'
    ? `The phone and USGS ${context.reference?.stationId ?? 'reference'} have ${comparison.aligned.length} simultaneous minute bins and descriptive r=${comparison.correlation?.toFixed(3)}. This is scalar co-variation at a remote station, not independent regional confirmation or proof that the shared cause was geomagnetic.`
    : `No eligible descriptive phone–USGS comparison is available (${comparison.status.replaceAll('_', ' ').toLowerCase()}). ${comparison.reasons[0] ?? 'A QC-passing, time-overlapping reference is required.'} The single-phone regional verdict remains INCONCLUSIVE.`;
  const solarDriver = upstream.status === 'CONTEXT_FOUND'
    ? `${upstream.sampleCount} NOAA upstream Bz samples fall in the two hours before through the end of this capture; median Bz ${upstream.medianBzNt?.toFixed(1) ?? 'unavailable'} nT, with ${(100 * (upstream.southwardFraction ?? 0)).toFixed(0)}% of finite samples southward (Bz<0). This is upstream context only; propagation lag and source availability time are not resolved.`
    : upstream.status === 'UNAVAILABLE'
      ? 'No NOAA upstream solar-wind series was available to compare with this capture.'
      : 'No NOAA upstream sample time overlaps the two-hour pre-capture context window. Missing overlap is not evidence that solar-wind driving was absent.';
  const reconnection = 'Magnetic reconnection is not measured by this phone, a ground scalar station, or Bz alone. A reconnection interpretation would require appropriately time-shifted upstream conditions plus independent regional ground/ionospheric evidence; this capture cannot establish reconnection or causation.';
  const aurora = 'Magnetic measurements do not establish visible aurora. Optical confirmation, darkness, clouds and an appropriately validated regional forecast are separate evidence.';
  const nextMeasurements: string[] = [];
  if (qc.baselineMicroT === null || qc.durationSeconds < 120) nextMeasurements.push('Repeat a stationary recording for at least two minutes before testing objects, so the app can establish its protocol baseline.');
  if (localFlags.length) nextMeasurements.push('Repeat the suspected source present/absent in a fixed-distance sequence, one source at a time, while keeping phone position, charging and motion consistent.');
  if (!batteryMarkers.length) nextMeasurements.push('If charger influence is suspected, repeat once unplugged and once connected; no battery power-state observation was retained for this session.');
  if (comparison.status !== 'DESCRIPTIVE_COMPARISON') nextMeasurements.push('Run a 10-minute stationary capture during a live USGS window; require at least eight consecutive overlapping UTC minutes and disclose the station distance.');
  if (upstream.status !== 'CONTEXT_FOUND') nextMeasurements.push('Refresh NOAA upstream data during a new capture; retain each observation and retrieval time and do not apply an unverified propagation lag.');
  nextMeasurements.push('For regional support, collect adult opt-in observations from independent sites and require professional ground coherence; never count co-located phones as separate regions.');
  return {
    version: SESSION_ANALYSIS_VERSION, sessionId: session.id,
    measurement: { kind: session.kind, frame: 'DEVICE', unit: 'microT', startAtUtc: session.startedAtUtc, endAtUtc: session.endedAtUtc, device: session.device, durationSeconds: qc.durationSeconds, sampleCount: qc.sampleCount, actualHz: qc.actualHz, baselineMagnitudeMicroT: qc.baselineMicroT, baselineNoiseMadNt: qc.noiseMadNt, qcAccepted: qc.accepted, qcFlags: [...qc.flags], usableSamples: qc.usableCount },
    axes: axisAnalyses(session, qc), flagIntervals: intervals, eventMarkers: session.markers,
    groundComparison: comparison, upstreamContext: upstream, planetaryKp: kp, auroraModel: ovation, capturedContext,
    interpretation: { measuredField, interference, geomagneticResponse, solarDriver, reconnection, aurora },
    nextMeasurements,
  };
}
