import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, View } from 'react-native';
import { Accelerometer, Magnetometer } from 'expo-sensors';
import * as Device from 'expo-device';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useKeepAwake } from 'expo-keep-awake';
import Svg, { Line, Polyline } from 'react-native-svg';
import { analyzeSensorSession, analyzeInteractionContext, EXPERIMENT_VERSION, EXPERIMENT_PLAN, dueExperimentCues, experimentInstruction, scheduledMarker, CaptureGate, parseSensorSession, SENSOR_PROTOCOL, SENSOR_SCHEMA_VERSION, sessionToCsv, type SensorMarker, type SensorQcResult, type SensorSession, type Vector3 } from '@aurorasense/shared/sensor';

const savedFile = () => new File(Paths.document, 'aurorasense-session.json');
const exportsDirectory = () => new Directory(Paths.cache, 'aurorasense-exports');
const colors = { background: '#061122', panel: '#102338', ink: '#eff7ff', muted: '#b0c1d4', mint: '#68edc3', violet: '#b9a5ff', amber: '#ffd58c' };
const display = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

function RecordingAwake() { useKeepAwake('aurorasense-foreground-recording'); return null; }

function GuidedCue({ elapsed, late }: { elapsed: number; late: boolean }) {
  const next = EXPERIMENT_PLAN.find(cue => cue.seconds > elapsed);
  return <View style={styles.cueBanner}>
    <Text style={styles.cardTitle}>GUIDED EXPERIMENT · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} elapsed</Text>
    <Text accessibilityLiveRegion="polite" style={styles.value}>{late ? 'A cue was delayed. Leave the phone still; report this timing issue after export.' : experimentInstruction(elapsed)}</Text>
    <Text style={styles.muted}>No marker taps. {next ? `Next cue at ${next.seconds} seconds elapsed.` : 'Recording ends automatically at ten minutes.'}</Text>
  </View>;
}

function Trace({ values, label, color }: { values: Array<number | null>; label: string; color: string }) {
  const width = 320; const height = 80;
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (valid.length < 2) return <Text style={styles.muted}>{label}: waiting for enough samples</Text>;
  const low = Math.min(...valid); const high = Math.max(...valid); const span = Math.max(high - low, 0.02);
  const segments: string[] = []; let points: string[] = [];
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) { if (points.length) segments.push(points.join(' ')); points = []; }
    else points.push(`${index / Math.max(1, values.length - 1) * width},${height - 8 - (value - low) / span * (height - 16)}`);
  });
  if (points.length) segments.push(points.join(' '));
  return <View accessibilityLabel={`${label}. Minimum ${display(low)}, maximum ${display(high)}.`}>
    <Text style={[styles.muted, { color }]}>{label} · {display(low)} to {display(high)}</Text>
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="#294056" strokeDasharray="3 4" />
      {segments.map((segment, index) => <Polyline key={index} points={segment} fill="none" stroke={color} strokeWidth={1.8} />)}
    </Svg>
  </View>;
}

function Action({ title, onPress, disabled, danger }: { title: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[styles.button, danger && styles.dangerButton, disabled && styles.disabled]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
}

export default function App() {
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guided, setGuided] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lateCue, setLateCue] = useState(false);
  const guidedActive = useRef(false);
  const emittedCues = useRef(new Set<string>());
  const [status, setStatus] = useState('Ready for an opt-in foreground recording.');
  const [session, setSession] = useState<SensorSession | null>(null);
  const [qc, setQc] = useState<SensorQcResult | null>(null);
  const sessionRef = useRef<SensorSession | null>(null);
  const mounted = useRef(true);
  const lastAcceleration = useRef<{ vector: Vector3; receivedMs: number } | null>(null);
  const lastUiUpdate = useRef(0); const lastSave = useRef(0); const startMonotonic = useRef(0);
  const exportFiles = useRef<File[]>([]);
  const stopHandler = useRef<(reason: string) => void>(() => {});
  const gate = useRef<CaptureGate | null>(null);
  if (!gate.current) gate.current = new CaptureGate((reason) => stopHandler.current(reason));

  function refresh() {
    if (!mounted.current) return;
    const current = sessionRef.current;
    setSession(current ? { ...current, samples: [...current.samples] } : null);
    setQc(current ? analyzeSensorSession(current) : null);
  }
  function save() { if (sessionRef.current) savedFile().writeSync(JSON.stringify(sessionRef.current)); }
  stopHandler.current = (reason) => {
    const current = sessionRef.current;
    if (current) { current.endedAtUtc = new Date().toISOString(); current.stopReason = reason; }
    let message = `Recording stopped: ${reason.replaceAll('_', ' ').toLowerCase()}.`;
    try { save(); } catch { message = 'Recording stopped. Local save failed; keep this screen open and export.'; }
    if (mounted.current) { setRecording(false); setStatus(message); refresh(); }
  };

  useEffect(() => {
    mounted.current = true;
    try {
      const file = savedFile();
      if (file.exists) {
        const restored = parseSensorSession(JSON.parse(file.textSync()));
        if (!restored.endedAtUtc) { restored.stopReason = 'RECOVERED_AFTER_INTERRUPTION'; restored.endedAtUtc = restored.samples.at(-1)?.receivedAtUtc ?? restored.startedAtUtc; }
        sessionRef.current = restored; refresh(); setStatus('Private local session restored. Export or delete before another recording.');
      }
    } catch { setStatus('A retained session could not be read. Delete local session to clear it; recording has not started.'); }
    gate.current!.setForeground(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => gate.current!.setForeground(state === 'active'));
    const watchdog = setInterval(() => {
      if (!gate.current!.recording) return;
      const elapsed = performance.now() - startMonotonic.current;
      setElapsed(Math.floor(elapsed / 1000));
      if (guidedActive.current && sessionRef.current) {
        for (const cue of dueExperimentCues(elapsed / 1000, emittedCues.current)) {
          emittedCues.current.add(cue.kind);
          if (elapsed / 1000 - cue.seconds > 2) setLateCue(true);
          sessionRef.current.markers.push(scheduledMarker(cue, new Date().toISOString(), elapsed / 1000));
        }
      }
      if (elapsed >= SENSOR_PROTOCOL.durationSeconds * 1000) gate.current!.stop('DURATION_COMPLETE');
      else if (elapsed >= 10_000 && (!sessionRef.current?.samples.length || performance.now() - lastUiUpdate.current > 5000)) gate.current!.stop('SENSOR_STALLED');
    }, 1000);
    return () => { mounted.current = false; subscription.remove(); clearInterval(watchdog); gate.current!.dispose(); };
  }, []);

  async function start() {
    if (sessionRef.current || busy) return;
    if (savedFile().exists) { setStatus('A private recording is retained. Delete the local session before starting another.'); return; }
    setBusy(true);
    try {
      const started = await gate.current!.start(async () => {
        if (Platform.OS === 'web' || !Device.isDevice) throw new Error('Use a physical Android phone or iPhone; this collector does not synthesize sensor readings.');
        const [magAvailable, accelAvailable] = await Promise.all([Magnetometer.isAvailableAsync(), Accelerometer.isAvailableAsync()]);
        if (!magAvailable || !accelAvailable) throw new Error('A magnetometer and accelerometer are both required for this quality-controlled recording.');
        const magPermission = await Magnetometer.requestPermissionsAsync(); const accelPermission = await Accelerometer.requestPermissionsAsync();
        if (!magPermission.granted || !accelPermission.granted) throw new Error('Sensor permission was not granted. No recording started.');
      }, (register) => {
        const now = new Date().toISOString();
        sessionRef.current = {
          schemaVersion: SENSOR_SCHEMA_VERSION, id: `phone-${Date.now()}`, kind: 'MEASURED_LIVE', sourceId: 'AURORASENSE_PHONE', frame: 'DEVICE', unit: 'microT',
          startedAtUtc: now, endedAtUtc: null, utcAnchor: null, nominalHz: SENSOR_PROTOCOL.nominalHz,
          device: { platform: Platform.OS, model: Device.modelName, sensor: 'expo-sensors/Magnetometer', calibration: 'OS_CALIBRATED_ACCURACY_UNKNOWN' },
          consent: { adultConfirmed: true, recording: true, version: 'foreground-local-v1', atUtc: now }, stopReason: null,
          markers: [{ kind: 'BASELINE', atUtc: now, elapsedSeconds: 0, origin: 'MANUAL_TOUCH' }], samples: [],
          ...(guided ? { experimentProtocol: EXPERIMENT_VERSION } : {}),
        };
        guidedActive.current = guided; emittedCues.current.clear(); setElapsed(0); setLateCue(false);
        lastAcceleration.current = null; startMonotonic.current = performance.now(); lastSave.current = performance.now(); lastUiUpdate.current = 0;
        Accelerometer.setUpdateInterval(1000 / SENSOR_PROTOCOL.nominalHz); Magnetometer.setUpdateInterval(1000 / SENSOR_PROTOCOL.nominalHz);
        register(Accelerometer.addListener((measurement) => { if (gate.current!.recording) lastAcceleration.current = { vector: { x: measurement.x, y: measurement.y, z: measurement.z }, receivedMs: performance.now() }; }));
        register(Magnetometer.addListener((measurement) => {
          if (!gate.current!.recording || !sessionRef.current) return;
          const current = sessionRef.current; const receivedMonotonicMs = performance.now(); const receivedAtUtc = new Date().toISOString();
          if (![measurement.x, measurement.y, measurement.z, measurement.timestamp].every(Number.isFinite)) { gate.current!.stop('INVALID_NATIVE_SAMPLE'); return; }
          if (!current.utcAnchor) current.utcAnchor = { sensorTimestampSeconds: measurement.timestamp, utc: receivedAtUtc, uncertaintyMs: null };
          const accel = lastAcceleration.current; const age = accel ? receivedMonotonicMs - accel.receivedMs : null;
          current.samples.push({ x: measurement.x, y: measurement.y, z: measurement.z, sensorTimestampSeconds: measurement.timestamp, receivedMonotonicMs, receivedAtUtc, accelerationG: accel && age !== null && age <= 500 ? { ...accel.vector } : null, accelerationAgeMs: age });
          if (receivedMonotonicMs - lastUiUpdate.current >= 500) { lastUiUpdate.current = receivedMonotonicMs; refresh(); }
          if (receivedMonotonicMs - lastSave.current >= 10_000) { try { save(); lastSave.current = receivedMonotonicMs; } catch { gate.current!.stop('LOCAL_STORAGE_ERROR'); return; } }
          if (receivedMonotonicMs - startMonotonic.current >= SENSOR_PROTOCOL.durationSeconds * 1000 || current.samples.length >= SENSOR_PROTOCOL.maximumSamples) gate.current!.stop('DURATION_COMPLETE');
        }));
      });
      if (started && gate.current!.recording && mounted.current) { setRecording(true); setStatus('LIVE PHONE · Keep the phone still on a nonmagnetic surface.'); refresh(); }
    } catch (error) { if (mounted.current) setStatus(error instanceof Error ? error.message : 'Sensor start failed.'); }
    finally { if (mounted.current) setBusy(false); }
  }

  function marker(kind: SensorMarker['kind']) {
    const current = sessionRef.current; if (!current || !gate.current!.recording || current.markers.length >= 90) return;
    current.markers.push({ kind, atUtc: new Date().toISOString(), elapsedSeconds: (performance.now() - startMonotonic.current) / 1000, origin: 'MANUAL_TOUCH' });
    if (kind !== 'SCREEN_INTERACTION') refresh();
  }
  async function exportSession(format: 'json' | 'csv' | 'qc') {
    const current = sessionRef.current; if (!current || gate.current!.recording) return;
    setBusy(true);
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Device file sharing is unavailable. Your private session remains saved locally.');
      const folder = exportsDirectory(); if (!folder.exists) folder.create();
      const safeId = current.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const file = new File(folder, `${safeId}-${format}.${format === 'csv' ? 'csv' : 'json'}`);
      const quality = analyzeSensorSession(current);
      await file.write(format === 'csv' ? sessionToCsv(current) : JSON.stringify(format === 'qc' ? { sourceSessionId: current.id, kind: current.kind, ...quality, interactionContext: analyzeInteractionContext(current, quality) } : current, null, 2));
      exportFiles.current.push(file);
      await Sharing.shareAsync(file.uri, { mimeType: format === 'csv' ? 'text/csv' : 'application/json', dialogTitle: 'Export private AuroraSense session' });
      setStatus('Export prepared. The operating system controls where you share it; no automatic cloud upload occurred.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Export failed.'); }
    finally { setBusy(false); }
  }
  function deleteSession() {
    gate.current!.stop('USER_DELETED');
    try {
      const file = savedFile(); if (file.exists) file.delete();
      for (const exported of exportFiles.current) if (exported.exists) exported.delete();
      const folder = exportsDirectory(); if (folder.exists) folder.delete();
      exportFiles.current = []; sessionRef.current = null; refresh();
      setStatus('Local recording deleted. Previously shared copies are outside this app and must be deleted separately.');
    } catch { setStatus('Could not delete local file. Please try again; data was not uploaded.'); }
  }

  const latest = session?.samples.at(-1); const latestQc = qc?.sampleResults.at(-1);
  const seconds = Math.max(0, Math.ceil(SENSOR_PROTOCOL.durationSeconds - (qc?.durationSeconds ?? 0)));
  const trace = qc?.sampleResults.slice(-300) ?? []; const rawTrace = session?.samples.slice(-300) ?? [];
  const localFlagged = qc?.flags.some((flag) => ['LOCAL_INTERFERENCE', 'ABRUPT_JUMP', 'MOTION', 'ORIENTATION_CHANGED'].includes(flag));
  const interaction = session && qc ? analyzeInteractionContext(session, qc) : null;

  return <View style={styles.root}><StatusBar barStyle="light-content" />{recording && <RecordingAwake />}{recording && guidedActive.current && <GuidedCue elapsed={elapsed} late={lateCue} />}<ScrollView contentContainerStyle={styles.container} onTouchStart={() => marker('SCREEN_INTERACTION')}>
    <Text style={styles.wordmark}>Aurora<Text style={{ color: colors.mint }}>Sense</Text></Text>
    <Text style={styles.eyebrow}>GROUND TRUTH · FOREGROUND COLLECTOR</Text>
    <Text style={styles.heading}>Measure. Check. Understand.</Text>
    <Text style={styles.muted}>One phone measures its local environment. Regional space weather needs independent evidence.</Text>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Your observation, your choice</Text>
      <View style={styles.switchRow}><Text style={styles.switchLabel}>I am at least 18 years old.</Text><Switch accessibilityLabel="I am at least 18 years old" value={adult} onValueChange={(value) => { setAdult(value); gate.current!.setConsent(value, consent); }} /></View>
      <View style={styles.switchRow}><Text style={styles.switchLabel}>I consent to a 10-minute foreground magnetic and motion recording.</Text><Switch accessibilityLabel="Consent to foreground recording" value={consent} onValueChange={(value) => { setConsent(value); gate.current!.setConsent(adult, value); }} /></View>
      <Text style={styles.muted}>No location is collected. Samples stay on this device until you choose to export. Leaving the app stops recording. Keep this screen open and export before deleting.</Text>
      <View style={styles.switchRow}><Text style={styles.switchLabel}>Guided local experiment · timed visual cues, no marker taps after Start</Text><Switch accessibilityLabel="Guided local experiment" value={guided} disabled={recording || busy || !!session} onValueChange={setGuided} /></View>
      {guided && <Text style={styles.muted}>Leave still for three minutes. Accessory cue at 3:00 elapsed, remove at 3:05; rotate at 5:00, return and leave still at 5:05. Cues mark planned actions only. No vibration or sound is used.</Text>}
      <Action title={busy ? 'Preparing…' : 'Start 10-minute observation'} onPress={() => void start()} disabled={!adult || !consent || recording || busy || !!session} />
      {recording && <Action title={`Stop recording · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} remaining`} onPress={() => gate.current!.stop()} danger />}
      <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{recording ? 'LIVE PHONE' : session ? 'RECORDED PHONE SESSION' : 'No measurement yet'}</Text>
      <Text style={styles.muted}>Device frame · x/y/z in µT · OS calibration accuracy unknown</Text>
      <View style={styles.axes}>{(['x', 'y', 'z'] as const).map((axis, i) => <View key={axis}><Text style={{ color: [colors.mint, colors.violet, colors.amber][i] }}>{axis.toUpperCase()}</Text><Text style={styles.value}>{display(latest?.[axis])}</Text></View>)}</View>
      <Text style={styles.value}>|B| {display(latestQc?.magnitudeMicroT)} µT</Text><Text style={styles.value}>Δ|B| {display(latestQc?.deltaNt, 0)} nT</Text>
      <Text style={styles.muted}>UTC {latestQc?.observedAtUtc ?? 'awaiting samples'}</Text>
      <Text style={styles.muted}>{session?.device.model ?? 'Device model not read'} · {qc?.sampleCount ?? 0} samples · {display(qc?.actualHz)} Hz actual / 10 Hz requested</Text>
      <Trace values={rawTrace.map((sample) => sample.x)} label="Raw x · µT" color={colors.mint} /><Trace values={rawTrace.map((sample) => sample.y)} label="Raw y · µT" color={colors.violet} /><Trace values={rawTrace.map((sample) => sample.z)} label="Raw z · µT" color={colors.amber} />
      <Trace values={trace.map((row) => row.usable ? row.deltaNt : null)} label="Quality-screened Δ|B| · nT · last 300 samples" color={colors.mint} />
    </View>
    <View style={[styles.card, localFlagged && styles.warning]}>
      <Text style={styles.cardTitle}>{localFlagged ? 'Possible local interference / motion' : 'Quality check'}</Text>
      <Text style={styles.muted}>{localFlagged ? 'Flagged intervals are excluded. This is not regional confirmation or an aurora alert.' : 'First 120 seconds form a fixed median baseline. Continue stationary for several minutes before a controlled perturbation.'}</Text>
      <Text style={styles.status}>{qc?.flags.join(' · ') || 'No QC result yet'}</Text>
      <Text style={styles.muted}>Baseline {display(qc?.baselineMicroT)} µT · baseline MAD {display(qc?.noiseMadNt, 1)} nT</Text>
      <Text style={styles.muted}>Usable {qc?.usableCount ?? 0} / {qc?.sampleCount ?? 0} · local QC {qc?.accepted ? 'passing, screened intervals only' : 'pending / needs review'}</Text><Text style={styles.muted}>Regional inference: INCONCLUSIVE</Text>
      {interaction && <Text style={styles.muted}>Interaction context · {interaction.samplesNearTouch} samples within 1 s before / 3 s after a recorded touch; {interaction.flaggedNearTouch} flagged there, {interaction.flaggedAwayFromTouch} flagged elsewhere. {interaction.unclassifiedMarkers > 0 ? 'Older markers have unknown interaction origin. ' : ''}Annotations do not relax QC or prove a magnetic cause.</Text>}
      {qc?.highWater.map((window) => <Text key={window.requestedHours} style={styles.muted}>{window.requestedHours} h high-water: {display(window.maximumAbsoluteDeltaNt, 0)} nT · {display(window.observedCoverageSeconds / 60, 1)} measured minutes{window.completeWindow ? '' : ' · partial window'}</Text>)}
    </View>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Controlled interference experiment</Text>
      <Text style={styles.muted}>After several stationary minutes, mark the start, briefly move a small magnetic accessory closer without contact, remove it, then mark the end. Test motion separately. Markers record your actions; they do not force a QC verdict.</Text>
      <View style={styles.actions}>{(['INTERFERENCE_START', 'INTERFERENCE_END', 'MOTION_START', 'MOTION_END'] as const).map((kind) => <Action key={kind} title={kind.replaceAll('_', ' ').toLowerCase()} onPress={() => marker(kind)} disabled={!recording || guidedActive.current} />)}</View>
      {session?.markers.filter(entry => entry.kind !== 'SCREEN_INTERACTION').map((entry, index) => <Text key={index} style={styles.muted}>{entry.kind} @ {display(entry.elapsedSeconds, 1)} s · {entry.origin === 'SCHEDULED_CUE' ? 'PLANNED CUE · action unverified' : entry.origin ?? 'legacy origin unknown'}</Text>)}
    </View>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Private export & delete</Text><Text style={styles.muted}>Stop before exporting. JSON preserves raw samples, time anchor, consent and markers; CSV includes derived screening. No automatic upload or public publication is enabled.</Text>
      <Action title="Export raw session JSON" onPress={() => void exportSession('json')} disabled={!session || recording || busy} /><Action title="Export samples CSV" onPress={() => void exportSession('csv')} disabled={!session || recording || busy} /><Action title="Export QC report JSON" onPress={() => void exportSession('qc')} disabled={!session || recording || busy} />
      <Action title="Delete local session" onPress={deleteSession} disabled={recording || busy} danger />
    </View>
    <Text style={styles.footnote}>AuroraSense sensor protocol v0.1 · Engineering QC thresholds await empirical device calibration. UTC anchors use callback receipt time; timing uncertainty is unknown. Hardware validation must be recorded separately for each phone platform.</Text>
  </ScrollView></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background }, container: { padding: 20, paddingTop: 62, paddingBottom: 48, gap: 16 },
  cueBanner: { padding: 18, paddingTop: 54, gap: 10, backgroundColor: colors.panel, borderBottomColor: colors.amber, borderBottomWidth: 2 },
  wordmark: { color: colors.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.7 }, eyebrow: { color: colors.mint, fontSize: 11, letterSpacing: 1.7, fontWeight: '700' }, heading: { color: colors.ink, fontSize: 31, fontWeight: '700', letterSpacing: -1 }, muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  card: { backgroundColor: colors.panel, borderWidth: 1, borderColor: '#253c56', borderRadius: 20, padding: 18, gap: 13 }, cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' }, switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, switchLabel: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20 },
  button: { backgroundColor: '#6653bf', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 15, minHeight: 48, justifyContent: 'center' }, dangerButton: { backgroundColor: '#743d45' }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' }, disabled: { opacity: 0.38 }, status: { color: colors.amber, fontSize: 13, lineHeight: 20 },
  axes: { flexDirection: 'row', justifyContent: 'space-between' }, value: { color: colors.ink, fontSize: 22, fontWeight: '600', fontVariant: ['tabular-nums'] }, warning: { borderColor: '#b17e40' }, actions: { gap: 8 }, footnote: { color: colors.muted, fontSize: 11, lineHeight: 18 },
});
