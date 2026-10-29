import type { SensorMarker, SensorQcResult, SensorSession } from './sensor';

/** Prospectively fixed interaction annotations; these never change phone-qc-0.1.0. */
export const EXPERIMENT_VERSION = 'hands-free-protocol-0.1.0';
export const EXPERIMENT_PLAN = Object.freeze([
  { seconds: 180, kind: 'INTERFERENCE_START' as const, instruction: 'Bring the accessory a little closer without touching the phone. No screen tap.' },
  { seconds: 185, kind: 'INTERFERENCE_END' as const, instruction: 'Remove the accessory well away. Leave the phone still. No screen tap.' },
  { seconds: 300, kind: 'MOTION_START' as const, instruction: 'Gently rotate the phone, then return it to its original position.' },
  { seconds: 305, kind: 'MOTION_END' as const, instruction: 'Hands away. Leave the phone still until the recording stops.' },
]);

export function dueExperimentCues(elapsedSeconds: number, emitted: ReadonlySet<string>) {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return [];
  return EXPERIMENT_PLAN.filter(cue => cue.seconds <= elapsedSeconds && !emitted.has(cue.kind));
}

export function experimentInstruction(elapsedSeconds: number): string {
  const last = [...EXPERIMENT_PLAN].reverse().find(cue => elapsedSeconds >= cue.seconds);
  return last?.instruction ?? 'Leave the phone untouched. At 3:00 elapsed, follow the on-screen accessory cue.';
}

export function analyzeInteractionContext(session: SensorSession, qc: SensorQcResult) {
  if (session.samples.length !== qc.sampleResults.length) throw new Error('QC rows must match samples.');
  // Manual annotations are explicitly provided metadata, not a causal classifier.
  // Windows are fixed before the next acquisition; never optimized on the first run.
  const windows = session.markers.filter(marker => marker.origin === 'MANUAL_TOUCH').map(marker => ({
    startMs: Date.parse(marker.atUtc) - 1000,
    endMs: Date.parse(marker.atUtc) + 3000,
  }));
  let samplesNearTouch = 0; let flaggedNearTouch = 0; let flaggedAwayFromTouch = 0;
  let usableAwayFromTouch = 0; let usableCoverageAwayFromTouchSeconds = 0; let previousUsable = -2;
  qc.sampleResults.forEach((row, index) => {
    const time = row.observedAtUtc ? Date.parse(row.observedAtUtc) : NaN;
    const nearTouch = windows.some(window => time >= window.startMs && time <= window.endMs);
    if (nearTouch) { samplesNearTouch++; if (!row.usable) flaggedNearTouch++; }
    else if (!row.usable) flaggedAwayFromTouch++;
    else {
      usableAwayFromTouch++;
      const dt = index > 0 ? session.samples[index].sensorTimestampSeconds - session.samples[index - 1].sensorTimestampSeconds : 0;
      if (previousUsable === index - 1 && dt > 0 && dt <= 0.5) usableCoverageAwayFromTouchSeconds += dt;
      previousUsable = index;
    }
  });
  return {
    version: EXPERIMENT_VERSION, annotationBeforeSeconds: 1, annotationAfterSeconds: 3,
    manualMarkers: windows.length,
    scheduledCues: session.markers.filter(marker => marker.origin === 'SCHEDULED_CUE').length,
    unclassifiedMarkers: session.markers.filter(marker => marker.origin === undefined).length,
    samplesNearTouch, flaggedNearTouch, flaggedAwayFromTouch, usableAwayFromTouch, usableCoverageAwayFromTouchSeconds,
    limitations: 'Touch proximity is annotation only. Raw samples, QC flags, acceptance and high-water marks are unchanged. Scheduled cues do not prove an action occurred. Timing uses the callback UTC anchor with unknown latency.',
  };
}

export function scheduledMarker(cue: typeof EXPERIMENT_PLAN[number], atUtc: string, elapsedSeconds: number): SensorMarker {
  return { kind: cue.kind, atUtc, elapsedSeconds, origin: 'SCHEDULED_CUE', scheduledSeconds: cue.seconds };
}
