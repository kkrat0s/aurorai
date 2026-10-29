/** Deterministic local QC. It does not establish a regional geomagnetic event. */
export { CaptureGate } from './capture';
export { EXPERIMENT_PLAN, EXPERIMENT_VERSION, dueExperimentCues, experimentInstruction, scheduledMarker, analyzeInteractionContext } from './experiment';
export const SENSOR_SCHEMA_VERSION = 'aurorasense.sensor.v1' as const;
export const QC_VERSION = 'phone-qc-0.1.0' as const;
export const SENSOR_PROTOCOL = Object.freeze({
  nominalHz: 10,
  durationSeconds: 600,
  baselineSeconds: 120,
  minimumBaselineSamples: 120,
  minimumUsableFraction: 0.8,
  maximumGapSeconds: 0.5,
  accelerationChangeG: 0.06,
  orientationChangeDegrees: 5,
  abruptJumpMicroT: 1,
  deviationMicroT: 2,
  maximumBaselineMadNt: 250,
  saturationSuspectMicroT: 2000,
  maximumSamples: 20_000,
});

export type Vector3 = { x: number; y: number; z: number };
export type SensorSample = Vector3 & {
  sensorTimestampSeconds: number;
  receivedMonotonicMs: number;
  receivedAtUtc: string;
  accelerationG: Vector3 | null;
  accelerationAgeMs: number | null;
};
export type SensorMarker = { kind: 'BASELINE' | 'INTERFERENCE_START' | 'INTERFERENCE_END' | 'MOTION_START' | 'MOTION_END' | 'SCREEN_INTERACTION'; atUtc: string; elapsedSeconds: number; origin?: 'MANUAL_TOUCH' | 'SCHEDULED_CUE'; scheduledSeconds?: number };
export type SensorSession = {
  schemaVersion: typeof SENSOR_SCHEMA_VERSION;
  id: string;
  kind: 'MEASURED_LIVE' | 'SYNTHETIC';
  sourceId: 'AURORASENSE_PHONE' | 'AURORASENSE_TEST_GENERATOR';
  frame: 'DEVICE';
  unit: 'microT';
  startedAtUtc: string;
  endedAtUtc: string | null;
  utcAnchor: { sensorTimestampSeconds: number; utc: string; uncertaintyMs: number | null } | null;
  nominalHz: number;
  device: { platform: string; model: string | null; sensor: string; calibration: 'OS_CALIBRATED_ACCURACY_UNKNOWN' };
  consent: { adultConfirmed: boolean; recording: boolean; version: string; atUtc: string };
  stopReason: string | null;
  markers: SensorMarker[];
  experimentProtocol?: 'hands-free-protocol-0.1.0';
  samples: SensorSample[];
};
export type QcFlag = 'EMPTY' | 'NON_FINITE' | 'NON_MONOTONIC_TIME' | 'INVALID_UTC' | 'CLOCK_DISCONTINUITY' | 'SAMPLE_GAP' | 'MOTION' | 'ORIENTATION_CHANGED' | 'MOTION_UNKNOWN' | 'SATURATION_SUSPECT' | 'LOCAL_INTERFERENCE' | 'ABRUPT_JUMP' | 'BASELINE_PENDING' | 'NOISY_BASELINE' | 'CONSENT_MISSING';
export type SampleQc = { observedAtUtc: string | null; magnitudeMicroT: number | null; deltaNt: number | null; flags: QcFlag[]; usable: boolean };
export type HighWater = { requestedHours: 1 | 6 | 24; maximumAbsoluteDeltaNt: number | null; p95AbsoluteDeltaNt: number | null; usableSamples: number; observedCoverageSeconds: number; completeWindow: boolean };
export type SensorQcResult = {
  algorithmVersion: typeof QC_VERSION;
  frame: 'DEVICE';
  accepted: boolean;
  sampleCount: number;
  usableCount: number;
  actualHz: number | null;
  durationSeconds: number;
  baselineCoverageSeconds: number;
  baselineMicroT: number | null;
  noiseMadNt: number | null;
  driftNt: number | null;
  flags: QcFlag[];
  sampleResults: SampleQc[];
  highWater: HighWater[];
  regionalVerdict: 'INCONCLUSIVE';
  limitations: string[];
};

export function microteslaToNanotesla(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Magnetic value must be finite.');
  return value * 1000;
}
export function magnitude(vector: Vector3): number { return Math.hypot(vector.x, vector.y, vector.z); }
function finiteVector(vector: Vector3): boolean { return [vector.x, vector.y, vector.z].every(Number.isFinite); }
export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const center = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[center] : (sorted[center - 1] + sorted[center]) / 2;
}
function utc(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19); }
function angleDegrees(a: Vector3, b: Vector3): number {
  const scale = magnitude(a) * magnitude(b);
  return scale > 0 ? Math.acos(Math.min(1, Math.max(-1, (a.x * b.x + a.y * b.y + a.z * b.z) / scale))) * 180 / Math.PI : 180;
}
function distance(a: Vector3, b: Vector3): number { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }

export function analyzeSensorSession(session: SensorSession): SensorQcResult {
  const samples = session.samples;
  const first = samples[0];
  const origin = first?.sensorTimestampSeconds ?? 0;
  const durationSeconds = samples.length > 1 ? Math.max(0, samples[samples.length - 1].sensorTimestampSeconds - origin) : 0;
  const intervals = samples.slice(1).map((sample, i) => sample.sensorTimestampSeconds - samples[i].sensorTimestampSeconds).filter((value) => Number.isFinite(value) && value > 0);
  const sampleInterval = median(intervals);
  const actualHz = durationSeconds > 0 ? (samples.length - 1) / durationSeconds : null;
  const baselineSamples = samples.filter((sample) => finiteVector(sample) && sample.sensorTimestampSeconds - origin < SENSOR_PROTOCOL.baselineSeconds && sample.sensorTimestampSeconds >= origin);
  const baselineCoverageSeconds = baselineSamples.slice(1).reduce((sum, sample, index) => { const dt = sample.sensorTimestampSeconds - baselineSamples[index].sensorTimestampSeconds; return sum + (dt > 0 && dt <= SENSOR_PROTOCOL.maximumGapSeconds ? dt : 0); }, 0);
  const baselineReady = durationSeconds >= SENSOR_PROTOCOL.baselineSeconds && baselineSamples.length >= SENSOR_PROTOCOL.minimumBaselineSamples && baselineCoverageSeconds >= SENSOR_PROTOCOL.baselineSeconds * 0.9;
  const baselineMicroT = baselineReady ? median(baselineSamples.map(magnitude)) : null;
  const noiseMadNt = baselineMicroT === null ? null : median(baselineSamples.map((sample) => Math.abs(magnitude(sample) - baselineMicroT) * 1000));
  const baselineVector = baselineSamples.length ? { x: median(baselineSamples.map((s) => s.x))!, y: median(baselineSamples.map((s) => s.y))!, z: median(baselineSamples.map((s) => s.z))! } : null;
  const accelerationSamples = baselineSamples.map((sample) => sample.accelerationG).filter((value): value is Vector3 => value !== null && finiteVector(value));
  const baselineAcceleration = accelerationSamples.length ? { x: median(accelerationSamples.map((s) => s.x))!, y: median(accelerationSamples.map((s) => s.y))!, z: median(accelerationSamples.map((s) => s.z))! } : null;
  const noisyBaseline = noiseMadNt !== null && noiseMadNt > SENSOR_PROTOCOL.maximumBaselineMadNt;
  const flags = new Set<QcFlag>();
  if (!samples.length) flags.add('EMPTY');
  if (!session.consent.adultConfirmed || !session.consent.recording) flags.add('CONSENT_MISSING');
  if (!baselineReady) flags.add('BASELINE_PENDING');
  if (noisyBaseline) flags.add('NOISY_BASELINE');
  const sampleResults = samples.map((sample, index): SampleQc => {
    const rowFlags: QcFlag[] = [];
    const previous = samples[index - 1];
    const valid = finiteVector(sample) && Number.isFinite(magnitude(sample)) && Number.isFinite(sample.sensorTimestampSeconds) && Number.isFinite(sample.receivedMonotonicMs);
    const field = valid ? magnitude(sample) : null;
    if (!valid) rowFlags.push('NON_FINITE');
    if (!utc(sample.receivedAtUtc)) rowFlags.push('INVALID_UTC');
    if (previous) {
      const dt = sample.sensorTimestampSeconds - previous.sensorTimestampSeconds;
      if (!(dt > 0) || !(sample.receivedMonotonicMs > previous.receivedMonotonicMs)) rowFlags.push('NON_MONOTONIC_TIME');
      if (dt > SENSOR_PROTOCOL.maximumGapSeconds) rowFlags.push('SAMPLE_GAP');
      const wallElapsed = Date.parse(sample.receivedAtUtc) - Date.parse(previous.receivedAtUtc);
      const monotonicElapsed = sample.receivedMonotonicMs - previous.receivedMonotonicMs;
      if (Number.isFinite(wallElapsed) && Math.abs(wallElapsed - monotonicElapsed) > 1000) rowFlags.push('CLOCK_DISCONTINUITY');
      if (field !== null && finiteVector(previous) && Math.abs(field - magnitude(previous)) > SENSOR_PROTOCOL.abruptJumpMicroT) rowFlags.push('ABRUPT_JUMP');
    }
    if (field !== null && (field > SENSOR_PROTOCOL.saturationSuspectMicroT || field < 1)) rowFlags.push('SATURATION_SUSPECT');
    if (!sample.accelerationG || !finiteVector(sample.accelerationG) || !baselineAcceleration || sample.accelerationAgeMs === null || !Number.isFinite(sample.accelerationAgeMs) || sample.accelerationAgeMs < 0 || sample.accelerationAgeMs > 500) rowFlags.push('MOTION_UNKNOWN');
    else if (Math.abs(magnitude(sample.accelerationG) - 1) > SENSOR_PROTOCOL.accelerationChangeG || distance(sample.accelerationG, baselineAcceleration) > SENSOR_PROTOCOL.accelerationChangeG) rowFlags.push('MOTION');
    if (baselineReady && baselineVector && valid && angleDegrees(sample, baselineVector) > SENSOR_PROTOCOL.orientationChangeDegrees) rowFlags.push('ORIENTATION_CHANGED');
    const deltaNt = field === null || baselineMicroT === null ? null : (field - baselineMicroT) * 1000;
    if (deltaNt !== null && Math.abs(deltaNt) > Math.max(SENSOR_PROTOCOL.deviationMicroT * 1000, 8 * (noiseMadNt ?? 0))) rowFlags.push('LOCAL_INTERFERENCE');
    if (!baselineReady) rowFlags.push('BASELINE_PENDING');
    if (noisyBaseline) rowFlags.push('NOISY_BASELINE');
    if (!session.consent.adultConfirmed || !session.consent.recording) rowFlags.push('CONSENT_MISSING');
    rowFlags.forEach((flag) => flags.add(flag));
    const anchoredMs = session.utcAnchor && utc(session.utcAnchor.utc) && Number.isFinite(sample.sensorTimestampSeconds) ? Date.parse(session.utcAnchor.utc) + (sample.sensorTimestampSeconds - session.utcAnchor.sensorTimestampSeconds) * 1000 : NaN;
    const observedAtUtc = Number.isFinite(anchoredMs) && Math.abs(anchoredMs) < 8.64e15 ? new Date(anchoredMs).toISOString() : null;
    if (!observedAtUtc && !rowFlags.includes('INVALID_UTC')) { rowFlags.push('INVALID_UTC'); flags.add('INVALID_UTC'); }
    return { observedAtUtc, magnitudeMicroT: field, deltaNt, flags: rowFlags, usable: rowFlags.length === 0 };
  });
  const usableCount = sampleResults.filter((row) => row.usable).length;
  const highWater = ([1, 6, 24] as const).map((requestedHours): HighWater => {
    const lastTime = samples[samples.length - 1]?.sensorTimestampSeconds ?? 0;
    const selected = sampleResults.map((result, index) => ({ result, index })).filter(({ result, index }) => result.usable && result.deltaNt !== null && lastTime - samples[index].sensorTimestampSeconds <= requestedHours * 3600);
    const absolute = selected.map(({ result }) => Math.abs(result.deltaNt!)).sort((a, b) => a - b);
    let covered = 0;
    for (let i = 1; i < selected.length; i++) {
      const now = selected[i].index;
      const prev = selected[i - 1].index;
      const dt = samples[now].sensorTimestampSeconds - samples[prev].sensorTimestampSeconds;
      if (now === prev + 1 && dt > 0 && dt <= SENSOR_PROTOCOL.maximumGapSeconds) covered += dt;
    }
    return { requestedHours, maximumAbsoluteDeltaNt: absolute.at(-1) ?? null, p95AbsoluteDeltaNt: absolute.length ? absolute[Math.ceil(absolute.length * 0.95) - 1] : null, usableSamples: selected.length, observedCoverageSeconds: covered, completeWindow: covered >= requestedHours * 3600 - (sampleInterval ?? 0) };
  });
  const accepted = baselineReady && !noisyBaseline && samples.length > 0 && usableCount / samples.length >= SENSOR_PROTOCOL.minimumUsableFraction && !['NON_FINITE', 'NON_MONOTONIC_TIME', 'CLOCK_DISCONTINUITY', 'INVALID_UTC', 'CONSENT_MISSING', 'LOCAL_INTERFERENCE', 'ABRUPT_JUMP', 'ORIENTATION_CHANGED', 'SATURATION_SUSPECT'].some((flag) => flags.has(flag as QcFlag));
  const lastUsable = sampleResults.filter((row) => row.usable).slice(-Math.round((actualHz ?? 1) * 30));
  return { algorithmVersion: QC_VERSION, frame: 'DEVICE', accepted, sampleCount: samples.length, usableCount, actualHz, durationSeconds, baselineCoverageSeconds, baselineMicroT, noiseMadNt, driftNt: median(lastUsable.map((row) => row.deltaNt!)), flags: [...flags], sampleResults, highWater, regionalVerdict: 'INCONCLUSIVE', limitations: [
    'A single phone cannot establish a regional geomagnetic event or visible aurora.',
    'Local QC thresholds are engineering screening rules, not calibrated storm-detection sensitivity.',
    'UTC is anchored to first callback receipt; sensor-to-callback latency and clock accuracy are unmeasured.',
    'OS-calibrated sensor accuracy, saturation range and absolute calibration are unknown.',
    session.kind === 'SYNTHETIC' ? 'Synthetic test signal; not empirical sensor noise or a physical phone observation.' : 'Exported device data requires independent hardware/provenance verification before publication.',
  ] };
}

function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.'); return value as Record<string, unknown>; }
function number(value: unknown, name: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be finite.`); return value; }
function string(value: unknown, name: string): string { if (typeof value !== 'string' || !value || value.length > 200) throw new Error(`${name} must be a nonempty short string.`); return value; }
function timestamp(value: unknown): string { if (!utc(value)) throw new Error('UTC timestamp required.'); return value; }
function vector(value: unknown): Vector3 { const v = object(value); return { x: number(v.x, 'x'), y: number(v.y, 'y'), z: number(v.z, 'z') }; }

/** Sanitizes untrusted file imports. Unknown keys, including location/identifiers, are dropped. */
export function parseSensorSession(value: unknown): SensorSession {
  const v = object(value);
  if (v.schemaVersion !== SENSOR_SCHEMA_VERSION || v.frame !== 'DEVICE' || v.unit !== 'microT') throw new Error('Unsupported session schema, frame or units.');
  if (v.kind !== 'MEASURED_LIVE' && v.kind !== 'SYNTHETIC') throw new Error('Unsupported provenance kind.');
  const sourceId = v.kind === 'SYNTHETIC' ? 'AURORASENSE_TEST_GENERATOR' : 'AURORASENSE_PHONE';
  if (v.sourceId !== sourceId) throw new Error('Source and provenance disagree.');
  if (!Array.isArray(v.samples) || v.samples.length > SENSOR_PROTOCOL.maximumSamples) throw new Error('Invalid or oversized sensor samples.');
  const device = object(v.device); const consent = object(v.consent);
  if (device.calibration !== 'OS_CALIBRATED_ACCURACY_UNKNOWN') throw new Error('Unknown calibration declaration.');
  if (typeof consent.adultConfirmed !== 'boolean' || typeof consent.recording !== 'boolean') throw new Error('Consent flags required.');
  const nominalHz = number(v.nominalHz, 'nominalHz');
  if (nominalHz <= 0 || nominalHz > 100) throw new Error('Invalid requested cadence.');
  const anchor = v.utcAnchor === null ? null : object(v.utcAnchor);
  const uncertaintyMs = anchor?.uncertaintyMs === null ? null : anchor ? number(anchor.uncertaintyMs, 'uncertaintyMs') : null;
  if (uncertaintyMs !== null && uncertaintyMs < 0) throw new Error('Invalid time uncertainty.');
  if (!Array.isArray(v.markers) || v.markers.length > 100) throw new Error('Invalid experiment markers.');
  if (v.experimentProtocol !== undefined && v.experimentProtocol !== 'hands-free-protocol-0.1.0') throw new Error('Unsupported experiment protocol.');
  const markerKinds = ['BASELINE', 'INTERFERENCE_START', 'INTERFERENCE_END', 'MOTION_START', 'MOTION_END', 'SCREEN_INTERACTION'];
  const samples = v.samples.map((raw): SensorSample => { const row = object(raw); return { ...vector(row), sensorTimestampSeconds: number(row.sensorTimestampSeconds, 'sensorTimestampSeconds'), receivedMonotonicMs: number(row.receivedMonotonicMs, 'receivedMonotonicMs'), receivedAtUtc: timestamp(row.receivedAtUtc), accelerationG: row.accelerationG === null ? null : vector(row.accelerationG), accelerationAgeMs: row.accelerationAgeMs === null ? null : number(row.accelerationAgeMs, 'accelerationAgeMs') }; });
  return {
    schemaVersion: SENSOR_SCHEMA_VERSION, id: string(v.id, 'id'), kind: v.kind, sourceId, frame: 'DEVICE', unit: 'microT',
    startedAtUtc: timestamp(v.startedAtUtc), endedAtUtc: v.endedAtUtc === null ? null : timestamp(v.endedAtUtc),
    utcAnchor: anchor ? { sensorTimestampSeconds: number(anchor.sensorTimestampSeconds, 'anchor sensor time'), utc: timestamp(anchor.utc), uncertaintyMs } : null,
    nominalHz, ...(v.experimentProtocol === undefined ? {} : { experimentProtocol: v.experimentProtocol }), device: { platform: string(device.platform, 'platform'), model: device.model === null ? null : string(device.model, 'model'), sensor: string(device.sensor, 'sensor'), calibration: 'OS_CALIBRATED_ACCURACY_UNKNOWN' },
    consent: { adultConfirmed: consent.adultConfirmed, recording: consent.recording, version: string(consent.version, 'consent version'), atUtc: timestamp(consent.atUtc) },
    stopReason: v.stopReason === null ? null : string(v.stopReason, 'stopReason'),
    markers: v.markers.map((raw): SensorMarker => {
      const marker = object(raw); if (!markerKinds.includes(String(marker.kind))) throw new Error('Invalid marker.');
      if (marker.origin !== undefined && marker.origin !== 'MANUAL_TOUCH' && marker.origin !== 'SCHEDULED_CUE') throw new Error('Invalid marker origin.');
      const scheduledSeconds = marker.scheduledSeconds === undefined ? undefined : number(marker.scheduledSeconds, 'scheduledSeconds');
      if (scheduledSeconds !== undefined && (marker.origin !== 'SCHEDULED_CUE' || scheduledSeconds < 0 || scheduledSeconds > SENSOR_PROTOCOL.durationSeconds)) throw new Error('Invalid cue schedule.');
      return { kind: marker.kind as SensorMarker['kind'], atUtc: timestamp(marker.atUtc), elapsedSeconds: number(marker.elapsedSeconds, 'elapsedSeconds'), ...(marker.origin === undefined ? {} : { origin: marker.origin }), ...(scheduledSeconds === undefined ? {} : { scheduledSeconds }) };
    }), samples,
  };
}

export function sessionToCsv(session: SensorSession): string {
  const qc = analyzeSensorSession(session);
  const header = 'kind,frame,sensor_timestamp_s,received_monotonic_ms,observed_at_utc,received_at_utc,x_microT,y_microT,z_microT,ax_g,ay_g,az_g,acceleration_age_ms,magnitude_microT,delta_nT,usable,qc_flags';
  return [header, ...session.samples.map((sample, index) => {
    const row = qc.sampleResults[index];
    return [session.kind, session.frame, sample.sensorTimestampSeconds, sample.receivedMonotonicMs, row.observedAtUtc ?? '', sample.receivedAtUtc, sample.x, sample.y, sample.z, sample.accelerationG?.x ?? '', sample.accelerationG?.y ?? '', sample.accelerationG?.z ?? '', sample.accelerationAgeMs ?? '', row.magnitudeMicroT ?? '', row.deltaNt ?? '', row.usable, row.flags.join('|')].join(',');
  })].join('\n');
}
