import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, View } from 'react-native';
import { Accelerometer, Magnetometer } from 'expo-sensors';
import * as Device from 'expo-device';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useKeepAwake } from 'expo-keep-awake';
import {
  analyzeSensorSession,
  dueExperimentCues,
  experimentInstruction,
  scheduledMarker,
  CaptureGate,
  parseSensorSession,
  SENSOR_PROTOCOL,
  SENSOR_SCHEMA_VERSION,
  sessionToCsv,
  EXPERIMENT_PLAN,
  EXPERIMENT_VERSION,
  type SensorMarker,
  type SensorQcResult,
  type SensorSession,
  type Vector3,
} from '@aurorasense/shared/sensor';
import { evaluateSessionPrescriptively } from '@aurorasense/shared/prescriptive-evaluator';
import * as Battery from 'expo-battery';
import {
  classifyMagneticDisturbance,
  type DevicePhysicalContext,
  type DisturbanceClassificationResult,
  type LearnedUserFingerprint,
  type MagneticSample,
} from '@aurorasense/shared/magnetic-classifier';
import { MagneticSoundscapeEngine, BLOOM_PENTATONIC_SCALE, type BloomNote } from './audio-synthesizer';
import { RealtimeMotionDetector, type MotionAnalysis } from './motion-detector';
import { MagneticFieldVisualizer } from './components/MagneticFieldVisualizer';
import { PhysicalSensorContextPills } from './components/PhysicalSensorContextPills';
import { MagneticFieldScaleBar } from './components/MagneticFieldScaleBar';
import { AiObjectLearningCard } from './components/AiObjectLearningCard';
import { SolarReconnectionCard } from './components/SolarReconnectionCard';
import { SevenStepsGuidedJourney } from './components/SevenStepsGuidedJourney';
import { StormTrackScreen } from './components/StormTrackScreen';
import { AuroraMapScreen } from './components/AuroraMapScreen';
import { GroundTruthScreen } from './components/GroundTruthScreen';
import { WhyModal } from './components/WhyModal';
import { MuseSparkDrawer } from './components/MuseSparkDrawer';

const savedFile = () => new File(Paths.document, 'aurorasense-session.json');
const exportsDirectory = () => new Directory(Paths.cache, 'aurorasense-exports');
const colors = {
  background: '#040d1a',
  panel: '#0a192b',
  ink: '#eff7ff',
  muted: '#8ea8c4',
  mint: '#68edc3',
  cyan: '#00e5ff',
  violet: '#b9a5ff',
  amber: '#ffd58c',
};
const display = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

function RecordingAwake() {
  useKeepAwake('aurorasense-foreground-recording');
  return null;
}

function GuidedCue({ elapsed, late }: { elapsed: number; late: boolean }) {
  const next = EXPERIMENT_PLAN.find((cue) => cue.seconds > elapsed);
  return (
    <View style={styles.cueBanner}>
      <Text style={styles.cardTitle}>
        GUIDED EXPERIMENT · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} elapsed
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.value}>
        {late
          ? 'A cue was delayed. Leave the phone still; report this timing issue after export.'
          : experimentInstruction(elapsed)}
      </Text>
      <Text style={styles.muted}>
        No marker taps. {next ? `Next cue at ${next.seconds} seconds elapsed.` : 'Recording ends automatically at ten minutes.'}
      </Text>
    </View>
  );
}

function Action({
  title,
  onPress,
  disabled,
  danger,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, danger && styles.dangerButton, disabled && styles.disabled]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export default function App() {
  // Scientific Observation Gate state
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guided, setGuided] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lateCue, setLateCue] = useState(false);
  const [status, setStatus] = useState('Live magnetic field active. Wave hand or bring accessories near phone.');
  const [session, setSession] = useState<SensorSession | null>(null);
  const [qc, setQc] = useState<SensorQcResult | null>(null);

  // Live Magnetic Field & Soundscape state
  const [soundMuted, setSoundMuted] = useState(false);
  const [mag, setMag] = useState<number | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const [vector, setVector] = useState<{ x: number; y: number; z: number } | null>(null);
  const [activeNote, setActiveNote] = useState<BloomNote>(BLOOM_PENTATONIC_SCALE[0]);
  const [calibrating, setCalibrating] = useState(false);
  const [calibCountdownMs, setCalibCountdownMs] = useState(2000);
  const [maxDelta, setMaxDelta] = useState(1.5);
  const [aiClassification, setAiClassification] = useState<DisturbanceClassificationResult | null>(null);
  const [userFingerprints, setUserFingerprints] = useState<LearnedUserFingerprint[]>([]);
  const [showSolarDetails, setShowSolarDetails] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'storm' | 'map' | 'ground'>('ground');
  const [whyModalOpen, setWhyModalOpen] = useState(false);
  const [sparkDrawerOpen, setSparkDrawerOpen] = useState(false);
  const [deepDiagnosticsOpen, setDeepDiagnosticsOpen] = useState(false);

  // Physical Device Multi-Modal Context
  const [motionAnalysis, setMotionAnalysis] = useState<MotionAnalysis>({
    isStandstill: true,
    motionState: 'STANDSTILL',
    accelVarianceG: 0.01,
    isFlatOnSurface: true,
    dynamicAccelG: 0.01,
    tiltDegrees: 0,
  });
  const [isScreenTouched, setIsScreenTouched] = useState(false);
  const [isCharging, setIsCharging] = useState(false);

  // References
  const baselineRef = useRef<number | null>(null);
  const maxExcursionRef = useRef(1.5);
  const soundEngine = useRef<MagneticSoundscapeEngine | null>(null);
  const idleSubscription = useRef<{ remove: () => void } | null>(null);
  const accelSubscription = useRef<{ remove: () => void } | null>(null);
  const lastUpdateRef = useRef(0);
  const lastAiClassifyRef = useRef(0);
  const calibrationSamplesRef = useRef<number[]>([]);
  const calibrationEndTimeRef = useRef(0);
  const rollingSamplesRef = useRef<MagneticSample[]>([]);
  const userFingerprintsRef = useRef<LearnedUserFingerprint[]>([]);

  const motionDetector = useRef(new RealtimeMotionDetector());
  const isScreenTouchedRef = useRef(false);
  const lastTouchEndMs = useRef(0);
  const isChargingRef = useRef(false);

  function getPhysicalContext(): DevicePhysicalContext {
    const motion = motionDetector.current.analyze();
    const now = performance.now();
    const timeSinceTouch = isScreenTouchedRef.current ? 0 : Math.max(0, now - lastTouchEndMs.current);
    return {
      isStandstill: motion.isStandstill,
      motionState: motion.motionState,
      accelVarianceG: motion.accelVarianceG,
      isFlatOnSurface: motion.isFlatOnSurface,
      isScreenTouched: isScreenTouchedRef.current,
      timeSinceLastTouchMs: timeSinceTouch,
      isCharging: isChargingRef.current,
      batteryState: isChargingRef.current ? 'CHARGING' : 'UNPLUGGED',
    };
  }

  function handleAddFingerprint(fp: LearnedUserFingerprint) {
    userFingerprintsRef.current = [fp, ...userFingerprintsRef.current].slice(0, 30);
    setUserFingerprints([...userFingerprintsRef.current]);
    if (rollingSamplesRef.current.length >= 4 && baselineRef.current !== null) {
      const updated = classifyMagneticDisturbance(
        rollingSamplesRef.current,
        baselineRef.current,
        userFingerprintsRef.current,
        getPhysicalContext()
      );
      setAiClassification(updated);
    }
  }

  function handleClearFingerprints() {
    userFingerprintsRef.current = [];
    setUserFingerprints([]);
    if (rollingSamplesRef.current.length >= 4 && baselineRef.current !== null) {
      const updated = classifyMagneticDisturbance(
        rollingSamplesRef.current,
        baselineRef.current,
        [],
        getPhysicalContext()
      );
      setAiClassification(updated);
    }
  }

  const sessionRef = useRef<SensorSession | null>(null);
  const mounted = useRef(true);
  const lastAcceleration = useRef<{ vector: Vector3; receivedMs: number } | null>(null);
  const lastUiUpdate = useRef(0);
  const lastSave = useRef(0);
  const startMonotonic = useRef(0);
  const exportFiles = useRef<File[]>([]);
  const stopHandler = useRef<(reason: string) => void>(() => {});
  const gate = useRef<CaptureGate | null>(null);
  if (!gate.current) gate.current = new CaptureGate((reason) => stopHandler.current(reason));
  const guidedActive = useRef(false);
  const emittedCues = useRef(new Set<string>());

  function calibrateBaseline() {
    calibrationSamplesRef.current = [];
    calibrationEndTimeRef.current = performance.now() + 2000;
    maxExcursionRef.current = 1.2;
    setMaxDelta(1.2);
    setCalibrating(true);
    setCalibCountdownMs(2000);
    setDelta(0);
    setActiveNote(BLOOM_PENTATONIC_SCALE[0]);
  }

  function handleMagnetometerReading(x: number, y: number, z: number) {
    if (!mounted.current) return;
    const totalMag = Math.sqrt(x * x + y * y + z * z);
    const now = performance.now();

    // 1. Hands-Free Baseline Calibration Phase (2 seconds)
    if (calibrationEndTimeRef.current > 0) {
      calibrationSamplesRef.current.push(totalMag);
      const remaining = Math.max(0, calibrationEndTimeRef.current - now);
      setMag(totalMag);
      setVector({ x, y, z });
      setCalibCountdownMs(remaining);

      if (remaining <= 0) {
        calibrationEndTimeRef.current = 0;
        const samples = calibrationSamplesRef.current;
        let base = totalMag;
        if (samples.length > 0) {
          const sorted = [...samples].sort((a, b) => a - b);
          base = sorted[Math.floor(sorted.length / 2)];
        }
        baselineRef.current = base;
        setCalibrating(false);
        setCalibCountdownMs(0);
        setDelta(0);
      }
      return;
    }

    if (baselineRef.current === null) {
      baselineRef.current = totalMag;
    }

    const d = totalMag - baselineRef.current;
    const absD = Math.abs(d);

    // 2. Dynamic Sensitivity Scaling: Expand range to match hand distance
    if (absD > maxExcursionRef.current) {
      const updated = Math.min(35.0, Math.max(maxExcursionRef.current * 1.05, absD));
      maxExcursionRef.current = updated;
      setMaxDelta(updated);
    }

    // 3. Rolling sample buffer for AI classifier
    rollingSamplesRef.current.push({ x, y, z, timestampMs: now });
    if (rollingSamplesRef.current.length > 25) {
      rollingSamplesRef.current.shift();
    }

    // Run AI disturbance classification every 200ms
    if (now - lastAiClassifyRef.current > 200 && rollingSamplesRef.current.length >= 4) {
      lastAiClassifyRef.current = now;
      const motion = motionDetector.current.analyze();
      setMotionAnalysis(motion);

      const context = getPhysicalContext();
      const classification = classifyMagneticDisturbance(
        rollingSamplesRef.current,
        baselineRef.current,
        userFingerprintsRef.current,
        context
      );
      setAiClassification(classification);
    }

    // 4. Update UI & Play ambient soundscape
    if (now - lastUpdateRef.current > 75) {
      lastUpdateRef.current = now;
      setMag(totalMag);
      setVector({ x, y, z });
      setDelta(d);

      if (soundEngine.current) {
        const tierInfo = soundEngine.current.getTier(d, maxExcursionRef.current);
        setActiveNote(tierInfo.tier);
        void soundEngine.current.playForDeviation(d, maxExcursionRef.current);
      }
    }
  }

  async function startIdleMonitoring() {
    try {
      const [magAvailable, accelAvailable] = await Promise.all([
        Magnetometer.isAvailableAsync(),
        Accelerometer.isAvailableAsync(),
      ]);
      if (!magAvailable) return;

      if (!soundEngine.current) {
        soundEngine.current = new MagneticSoundscapeEngine();
        await soundEngine.current.init();
        soundEngine.current.setMuted(soundMuted);
      }

      calibrateBaseline();
      Magnetometer.setUpdateInterval(100);
      idleSubscription.current?.remove();
      idleSubscription.current = Magnetometer.addListener((m) => {
        handleMagnetometerReading(m.x, m.y, m.z);
      });

      if (accelAvailable) {
        Accelerometer.setUpdateInterval(100);
        accelSubscription.current?.remove();
        accelSubscription.current = Accelerometer.addListener((a) => {
          motionDetector.current.pushSample(a.x, a.y, a.z, performance.now());
        });
      }
    } catch (err) {
      console.warn('Idle monitoring initialization failed:', err);
    }
  }

  function refresh() {
    if (!mounted.current) return;
    const current = sessionRef.current;
    setSession(current ? { ...current, samples: [...current.samples] } : null);
    setQc(current ? analyzeSensorSession(current) : null);
  }

  function save() {
    if (sessionRef.current) savedFile().writeSync(JSON.stringify(sessionRef.current));
  }

  stopHandler.current = (reason) => {
    const current = sessionRef.current;
    if (current) {
      current.endedAtUtc = new Date().toISOString();
      current.stopReason = reason;
    }
    let message = `Recording stopped: ${reason.replaceAll('_', ' ').toLowerCase()}.`;
    try {
      save();
    } catch {
      message = 'Recording stopped. Local save failed; keep this screen open and export.';
    }
    if (mounted.current) {
      setRecording(false);
      setStatus(message);
      refresh();
      void startIdleMonitoring();
      if (reason === 'DURATION_COMPLETE') {
        setCurrentStep(4);
        setTimeout(() => {
          void uploadToCentralDatabase();
        }, 500);
      }
    }
  };

  useEffect(() => {
    mounted.current = true;
    try {
      const file = savedFile();
      if (file.exists) {
        const restored = parseSensorSession(JSON.parse(file.textSync()));
        if (!restored.endedAtUtc) {
          restored.stopReason = 'RECOVERED_AFTER_INTERRUPTION';
          restored.endedAtUtc = restored.samples.at(-1)?.receivedAtUtc ?? restored.startedAtUtc;
        }
        sessionRef.current = restored;
        refresh();
        setStatus('Private local session restored. Export or delete before another recording.');
      }
    } catch {
      setStatus('A retained session could not be read. Delete local session to clear it.');
    }

    gate.current!.setForeground(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      const isForeground = state === 'active';
      gate.current!.setForeground(isForeground);
      if (!isForeground && soundEngine.current) {
        soundEngine.current.setMuted(true);
      } else if (isForeground && soundEngine.current) {
        soundEngine.current.setMuted(soundMuted);
      }
    });

    // Initialize battery charging listener
    void Battery.getBatteryStateAsync().then((state) => {
      const charging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
      setIsCharging(charging);
      isChargingRef.current = charging;
    }).catch(() => {});

    const batterySub = Battery.addBatteryStateListener(({ batteryState }) => {
      const charging = batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL;
      setIsCharging(charging);
      isChargingRef.current = charging;
    });

    // Start live monitoring immediately on app launch!
    void startIdleMonitoring();

    const watchdog = setInterval(() => {
      if (!gate.current!.recording) return;
      const el = performance.now() - startMonotonic.current;
      setElapsed(Math.floor(el / 1000));
      if (guidedActive.current && sessionRef.current) {
        for (const cue of dueExperimentCues(el / 1000, emittedCues.current)) {
          emittedCues.current.add(cue.kind);
          if (el / 1000 - cue.seconds > 2) setLateCue(true);
          sessionRef.current.markers.push(scheduledMarker(cue, new Date().toISOString(), el / 1000));
        }
      }
      if (el >= SENSOR_PROTOCOL.durationSeconds * 1000) gate.current!.stop('DURATION_COMPLETE');
      else if (
        el >= 10_000 &&
        (!sessionRef.current?.samples.length || performance.now() - lastUiUpdate.current > 5000)
      ) {
        gate.current!.stop('SENSOR_STALLED');
      }
    }, 1000);

    return () => {
      mounted.current = false;
      subscription.remove();
      batterySub.remove();
      clearInterval(watchdog);
      gate.current!.dispose();
      idleSubscription.current?.remove();
      accelSubscription.current?.remove();
      void soundEngine.current?.dispose();
    };
  }, []);

  async function start() {
    if (sessionRef.current || busy) return;
    if (savedFile().exists) {
      setStatus('A private recording is retained. Delete the local session before starting another.');
      return;
    }
    setBusy(true);
    try {
      const started = await gate.current!.start(
        async () => {
          if (Platform.OS === 'web' || !Device.isDevice) {
            throw new Error('Use a physical Android phone or iPhone; this collector does not synthesize readings.');
          }
          const [magAvailable, accelAvailable] = await Promise.all([
            Magnetometer.isAvailableAsync(),
            Accelerometer.isAvailableAsync(),
          ]);
          if (!magAvailable || !accelAvailable) {
            throw new Error('A magnetometer and accelerometer are both required for this recording.');
          }
          const magPermission = await Magnetometer.requestPermissionsAsync();
          const accelPermission = await Accelerometer.requestPermissionsAsync();
          if (!magPermission.granted || !accelPermission.granted) {
            throw new Error('Sensor permission was not granted. No recording started.');
          }
        },
        (register) => {
          // Pause idle listeners during recording
          idleSubscription.current?.remove();
          idleSubscription.current = null;
          accelSubscription.current?.remove();
          accelSubscription.current = null;

          const now = new Date().toISOString();
          sessionRef.current = {
            schemaVersion: SENSOR_SCHEMA_VERSION,
            id: `phone-${Date.now()}`,
            kind: 'MEASURED_LIVE',
            sourceId: 'AURORASENSE_PHONE',
            frame: 'DEVICE',
            unit: 'microT',
            startedAtUtc: now,
            endedAtUtc: null,
            utcAnchor: null,
            nominalHz: SENSOR_PROTOCOL.nominalHz,
            device: {
              platform: Platform.OS,
              model: Device.modelName,
              sensor: 'expo-sensors/Magnetometer',
              calibration: 'OS_CALIBRATED_ACCURACY_UNKNOWN',
            },
            consent: { adultConfirmed: true, recording: true, version: 'foreground-local-v1', atUtc: now },
            stopReason: null,
            markers: [{ kind: 'BASELINE', atUtc: now, elapsedSeconds: 0, origin: 'MANUAL_TOUCH' }],
            samples: [],
            ...(guided ? { experimentProtocol: EXPERIMENT_VERSION } : {}),
          };
          guidedActive.current = guided;
          emittedCues.current.clear();
          setElapsed(0);
          setLateCue(false);
          lastAcceleration.current = null;
          startMonotonic.current = performance.now();
          lastSave.current = performance.now();
          lastUiUpdate.current = 0;
          Accelerometer.setUpdateInterval(1000 / SENSOR_PROTOCOL.nominalHz);
          Magnetometer.setUpdateInterval(1000 / SENSOR_PROTOCOL.nominalHz);

          register(
            Accelerometer.addListener((measurement) => {
              motionDetector.current.pushSample(measurement.x, measurement.y, measurement.z, performance.now());
              if (gate.current!.recording) {
                lastAcceleration.current = {
                  vector: { x: measurement.x, y: measurement.y, z: measurement.z },
                  receivedMs: performance.now(),
                };
              }
            })
          );

          register(
            Magnetometer.addListener((measurement) => {
              if (!gate.current!.recording || !sessionRef.current) return;
              const current = sessionRef.current;
              const receivedMonotonicMs = performance.now();
              const receivedAtUtc = new Date().toISOString();
              if (![measurement.x, measurement.y, measurement.z, measurement.timestamp].every(Number.isFinite)) {
                gate.current!.stop('INVALID_NATIVE_SAMPLE');
                return;
              }
              if (!current.utcAnchor) {
                current.utcAnchor = { sensorTimestampSeconds: measurement.timestamp, utc: receivedAtUtc, uncertaintyMs: null };
              }
              const accel = lastAcceleration.current;
              const age = accel ? receivedMonotonicMs - accel.receivedMs : null;
              current.samples.push({
                x: measurement.x,
                y: measurement.y,
                z: measurement.z,
                sensorTimestampSeconds: measurement.timestamp,
                receivedMonotonicMs,
                receivedAtUtc,
                accelerationG: accel && age !== null && age <= 500 ? { ...accel.vector } : null,
                accelerationAgeMs: age,
              });

              // Also update the live top-middle visualizer and ambient sound
              handleMagnetometerReading(measurement.x, measurement.y, measurement.z);

              if (receivedMonotonicMs - lastUiUpdate.current >= 500) {
                lastUiUpdate.current = receivedMonotonicMs;
                refresh();
              }
              if (receivedMonotonicMs - lastSave.current >= 10_000) {
                try {
                  save();
                  lastSave.current = receivedMonotonicMs;
                } catch {
                  gate.current!.stop('LOCAL_STORAGE_ERROR');
                  return;
                }
              }
              if (
                receivedMonotonicMs - startMonotonic.current >= SENSOR_PROTOCOL.durationSeconds * 1000 ||
                current.samples.length >= SENSOR_PROTOCOL.maximumSamples
              ) {
                gate.current!.stop('DURATION_COMPLETE');
              }
            })
          );
        }
      );
      if (started && gate.current!.recording && mounted.current) {
        setRecording(true);
        setStatus('LIVE PHONE · Keep phone resting flat on non-magnetic surface.');
        refresh();
      }
    } catch (error) {
      if (mounted.current) setStatus(error instanceof Error ? error.message : 'Sensor start failed.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function marker(kind: SensorMarker['kind']) {
    const current = sessionRef.current;
    if (!current || !gate.current!.recording || current.markers.length >= 90) return;
    current.markers.push({
      kind,
      atUtc: new Date().toISOString(),
      elapsedSeconds: (performance.now() - startMonotonic.current) / 1000,
      origin: 'MANUAL_TOUCH',
    });
    if (kind !== 'SCREEN_INTERACTION') refresh();
  }

  async function exportSession(format: 'json' | 'csv' | 'qc') {
    const current = sessionRef.current;
    if (!current || gate.current!.recording) return;
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Device file sharing is unavailable. Your private session remains saved locally.');
      }
      const folder = exportsDirectory();
      if (!folder.exists) folder.create();
      const safeId = current.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const file = new File(folder, `${safeId}-${format}.${format === 'csv' ? 'csv' : 'json'}`);
      const quality = analyzeSensorSession(current);
      if (format === 'json') file.writeSync(JSON.stringify(current, null, 2));
      else if (format === 'csv') file.writeSync(sessionToCsv(current));
      else file.writeSync(JSON.stringify(quality, null, 2));
      exportFiles.current.push(file);
      await Sharing.shareAsync(file.uri, {
        mimeType: format === 'csv' ? 'text/csv' : 'application/json',
        dialogTitle: `Export AuroraSense ${format.toUpperCase()}`,
        UTI: format === 'csv' ? 'public.comma-separated-values-text' : 'public.json',
      });
      setStatus(`Export opened for ${format.toUpperCase()}. Data remains on your device.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function uploadToCentralDatabase() {
    const current = sessionRef.current;
    if (!current || gate.current!.recording) return;
    setIsUploading(true);
    setBusy(true);
    setStatus('Uploading recording to central database...');
    setUploadStatus('Uploading recording to central database...');
    try {
      const serverUrl = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3000';
      const response = await fetch(`${serverUrl}/api/recordings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(current),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Server rejected recording');
      const msg = `✅ Uploaded to Central Database (#${data.submissionId}). Verified clean placement.`;
      setStatus(msg);
      setUploadStatus(msg);
    } catch (error) {
      const msg = `Upload note: ${error instanceof Error ? error.message : 'Upload failed'}. Use 'Export raw session JSON' to share directly.`;
      setStatus(msg);
      setUploadStatus(msg);
    } finally {
      if (mounted.current) {
        setBusy(false);
        setIsUploading(false);
      }
    }
  }

  function deleteSession() {
    if (recording || busy) return;
    try {
      const file = savedFile();
      if (file.exists) file.delete();
      for (const exported of exportFiles.current) if (exported.exists) exported.delete();
      const folder = exportsDirectory();
      if (folder.exists) folder.delete();
      exportFiles.current = [];
      sessionRef.current = null;
      refresh();
      setStatus('Local session deleted. You can start a new observation.');
    } catch {
      setStatus('Could not delete local file.');
    }
  }

  const latest = session?.samples.at(-1);
  const latestQc = qc?.sampleResults.at(-1);
  const seconds = Math.max(0, Math.ceil(SENSOR_PROTOCOL.durationSeconds - (qc?.durationSeconds ?? 0)));
  const prescriptiveReport = session && qc ? evaluateSessionPrescriptively(session, qc) : null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      {recording && <RecordingAwake />}
      {recording && guidedActive.current && <GuidedCue elapsed={elapsed} late={lateCue} />}

      {/* TOP HEADER (MATCHING WIREFRAME) */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.wordmark}>
            Aurora<Text style={{ color: colors.mint }}>Sense</Text>
          </Text>
          <Text style={styles.headerSubtitle}>AI-POWERED AURORA FORECASTING</Text>
        </View>

        {/* TOP RIGHT CAPSULE PILL: 🟢 Muse Spark | Evidence checked */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setSparkDrawerOpen(true)}
          style={styles.museSparkPill}
        >
          <View style={styles.museSparkDot} />
          <View>
            <Text style={styles.museSparkTitle}>Muse Spark</Text>
            <Text style={styles.museSparkSub}>Evidence checked</Text>
          </View>
        </Pressable>
      </View>

      {/* SCREEN CONTAINER BASED ON currentTab */}
      <View style={styles.screenContainer}>
        {currentTab === 'storm' && (
          <StormTrackScreen
            onOpenWhy={() => setWhyModalOpen(true)}
            onOpenHistoricalReplay={() => setCurrentTab('ground')}
          />
        )}

        {currentTab === 'map' && (
          <AuroraMapScreen
            onOpenSightings={() => setWhyModalOpen(true)}
          />
        )}

        {currentTab === 'ground' && (
          <GroundTruthScreen
            mag={mag}
            delta={delta}
            vector={vector}
            motionAnalysis={motionAnalysis}
            classification={aiClassification}
            prescriptiveReport={prescriptiveReport}
            soundMuted={soundMuted}
            onToggleSound={() => {
              const next = !soundMuted;
              setSoundMuted(next);
              soundEngine.current?.setMuted(next);
            }}
            calibrating={calibrating}
            onCalibrate={calibrateBaseline}
            isRecording={recording}
            recordingElapsed={elapsed}
            onStartRecording={() => {
              setAdult(true);
              setConsent(true);
              gate.current!.setConsent(true, true);
              void start();
            }}
            onStopRecording={() => gate.current!.stop()}
            hasRecordedSession={!!session}
            onUploadDatabase={() => void uploadToCentralDatabase()}
            isUploading={isUploading}
            uploadStatus={uploadStatus}
          />
        )}
      </View>

      {/* BOTTOM THREE-TAB NAVIGATION BAR (MATCHING WIREFRAME) */}
      <View style={styles.bottomTabBar}>
        <Pressable
          onPress={() => setCurrentTab('storm')}
          style={[styles.bottomTabItem, currentTab === 'storm' && styles.bottomTabItemActive]}
        >
          <Text style={styles.bottomTabIcon}>🛰️</Text>
          <Text style={[styles.bottomTabText, currentTab === 'storm' && styles.bottomTabTextActive]}>
            1. Storm Track
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setCurrentTab('map')}
          style={[styles.bottomTabItem, currentTab === 'map' && styles.bottomTabItemActive]}
        >
          <Text style={styles.bottomTabIcon}>🗺️</Text>
          <Text style={[styles.bottomTabText, currentTab === 'map' && styles.bottomTabTextActive]}>
            2. Aurora Map
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setCurrentTab('ground')}
          style={[styles.bottomTabItem, currentTab === 'ground' && styles.bottomTabItemActive]}
        >
          <Text style={styles.bottomTabIcon}>🧭</Text>
          <Text style={[styles.bottomTabText, currentTab === 'ground' && styles.bottomTabTextActive]}>
            3. Ground Truth
          </Text>
        </Pressable>
      </View>

      {/* WHY MODAL & MUSE SPARK DRAWER */}
      <WhyModal visible={whyModalOpen} onClose={() => setWhyModalOpen(false)} />
      <MuseSparkDrawer visible={sparkDrawerOpen} onClose={() => setSparkDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  screenContainer: { flex: 1 },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#040d1a',
    borderBottomWidth: 1,
    borderBottomColor: '#12253b',
  },
  wordmark: { color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { color: colors.mint, fontSize: 8.5, letterSpacing: 1.1, fontWeight: '800', marginTop: 1 },
  museSparkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#0a1d33',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#193f66',
  },
  museSparkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.mint,
  },
  museSparkTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  museSparkSub: {
    fontSize: 8.5,
    color: '#9bc8eb',
  },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#071526',
    borderTopWidth: 1,
    borderTopColor: '#163354',
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 6,
  },
  bottomTabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
  },
  bottomTabItemActive: {
    backgroundColor: '#112947',
  },
  bottomTabIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  bottomTabText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.muted,
  },
  bottomTabTextActive: {
    color: colors.cyan,
    fontWeight: '800',
  },
  container: { padding: 16, paddingTop: 48, paddingBottom: 40, gap: 14 },
  headerButtons: { flexDirection: 'row', gap: 8 },
  headerBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: { fontSize: 11, fontWeight: '700' },
  visualizerCard: {
    backgroundColor: '#071626',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: '#193452',
  },
  aiStatusBar: {
    backgroundColor: '#0a1727',
    borderRadius: 12,
    padding: 11,
    borderWidth: 1.5,
    marginTop: 8,
  },
  aiStatusTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  aiStatusIcon: { fontSize: 24 },
  aiStatusTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  aiStatusDetail: { fontSize: 11, color: '#b0c1d4', marginTop: 2, lineHeight: 15 },
  matchBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  matchText: { fontSize: 11, fontWeight: 'bold' },
  solarExplorationToggleRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#15273b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  solarExplorationText: { fontSize: 11, color: '#eff7ff', flex: 1, lineHeight: 16 },
  solarStormRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#15273b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  solarStormText: { fontSize: 11, color: '#eff7ff', flex: 1, lineHeight: 16 },
  learnMoreBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#13283f' },
  learnMoreText: { fontSize: 10.5, color: '#68edc3', fontWeight: '700' },
  card: { backgroundColor: colors.panel, borderWidth: 1, borderColor: '#203954', borderRadius: 18, padding: 16, gap: 12 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchLabel: { flex: 1, color: colors.ink, fontSize: 13.5, lineHeight: 19 },
  button: { backgroundColor: '#6653bf', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 46, justifyContent: 'center' },
  dangerButton: { backgroundColor: '#743d45' },
  buttonText: { color: '#fff', fontSize: 13.5, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.38 },
  status: { color: colors.amber, fontSize: 12.5, lineHeight: 18 },
  axes: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { color: colors.ink, fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  muted: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  cueBanner: { padding: 16, paddingTop: 48, gap: 8, backgroundColor: colors.panel, borderBottomColor: colors.amber, borderBottomWidth: 2 },
});
