import { apiBaseUrl } from './api-base';
import { useForegroundLocation, rememberCaptureLocation, forgetCaptureLocation } from './foreground-location';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, Text, View } from 'react-native';
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
  type MagneticSample,
} from '@aurorasense/shared/magnetic-classifier';
import { MagneticSoundscapeEngine, BLOOM_PENTATONIC_SCALE, type BloomNote } from './audio-synthesizer';
import { RealtimeMotionDetector, type MotionAnalysis } from './motion-detector';
import { MagneticFieldVisualizer } from './components/MagneticFieldVisualizer';
import { PhysicalSensorContextPills } from './components/PhysicalSensorContextPills';
import { MagneticFieldScaleBar } from './components/MagneticFieldScaleBar';
import { SolarReconnectionCard } from './components/SolarReconnectionCard';
import { SevenStepsGuidedJourney, type ScanDurationOption } from './components/SevenStepsGuidedJourney';
import { StormTrackScreen } from './components/StormTrackScreen';
import { AuroraMapScreen } from './components/AuroraMapScreen';
import { GroundTruthScreen } from './components/GroundTruthScreen';
import { WhyModal } from './components/WhyModal';
import { MuseSparkDrawer } from './components/MuseSparkDrawer';
import { MagnetismIntroAnimation } from './components/MagnetismIntroAnimation';

const savedFile = () => new File(Paths.document, 'aurorasense-session.json');
const exportsDirectory = () => new Directory(Paths.cache, 'aurorasense-exports');
function batteryMarkerKind(state: Battery.BatteryState): SensorMarker['kind'] | null {
  if (state === Battery.BatteryState.CHARGING) return 'BATTERY_CHARGING';
  if (state === Battery.BatteryState.FULL) return 'BATTERY_FULL';
  if (state === Battery.BatteryState.UNPLUGGED) return 'BATTERY_UNPLUGGED';
  return null;
}
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
  value == null || !Number.isFinite(value) ? 'â€”' : value.toFixed(digits);

function RecordingAwake() {
  useKeepAwake('aurorasense-foreground-recording');
  return null;
}

function GuidedCue({ elapsed, late }: { elapsed: number; late: boolean }) {
  const next = EXPERIMENT_PLAN.find((cue) => cue.seconds > elapsed);
  return (
    <View style={styles.cueBanner}>
      <Text style={styles.cardTitle}>
        GUIDED EXPERIMENT Â· {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} elapsed
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
  const [livePhonePoints, setLivePhonePoints] = useState<Array<{ receivedAtUtc: string; sensorTimestampSeconds: number; magnitudeMicroT: number; deltaNt: number }>>([]);
  const [vector, setVector] = useState<{ x: number; y: number; z: number } | null>(null);
  const [activeNote, setActiveNote] = useState<BloomNote>(BLOOM_PENTATONIC_SCALE[0]);
  const [calibrating, setCalibrating] = useState(false);
  const [calibCountdownMs, setCalibCountdownMs] = useState(2000);
  const [maxDelta, setMaxDelta] = useState(1.5);
  const [aiClassification, setAiClassification] = useState<DisturbanceClassificationResult | null>(null);
  const [showSolarDetails, setShowSolarDetails] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'storm' | 'map' | 'ground'>('ground');
  const [clockMode, setClockMode] = useState<'replay' | 'live'>('replay');
  const [whyModalOpen, setWhyModalOpen] = useState(false);
  const [sparkDrawerOpen, setSparkDrawerOpen] = useState(false);
  const [targetDurationSec, setTargetDurationSec] = useState<ScanDurationOption>(30);
  const targetDurationRef = useRef<ScanDurationOption>(30);
  const [showIntro, setShowIntro] = useState(true);
  useForegroundLocation(!showIntro);
  const [titleFlash, setTitleFlash] = useState(true);
  const [titleMenuOpen, setTitleMenuOpen] = useState(false);

  useEffect(() => {
    if (!showIntro) {
      setTitleFlash(true);
      const t = setTimeout(() => setTitleFlash(false), 2400);
      return () => clearTimeout(t);
    }
  }, [showIntro]);

  // Physical Device Multi-Modal Context
  const [motionAnalysis, setMotionAnalysis] = useState<MotionAnalysis>({
    isStandstill: false,
    motionState: 'UNKNOWN',
    accelVarianceG: null,
    isFlatOnSurface: false,
    dynamicAccelG: null,
    tiltDegrees: null,
  });
  const [isScreenTouched, setIsScreenTouched] = useState(false);
  const [isCharging, setIsCharging] = useState(false);

  // References
  const baselineRef = useRef<number | null>(null);
  const maxExcursionRef = useRef(1.5);
  const soundEngine = useRef<MagneticSoundscapeEngine | null>(null);
  const soundMutedRef = useRef(soundMuted);
  useEffect(() => { soundMutedRef.current=soundMuted; }, [soundMuted]);
  const idleSubscription = useRef<{ remove: () => void } | null>(null);
  const accelSubscription = useRef<{ remove: () => void } | null>(null);
  const lastUpdateRef = useRef(0);
  const lastPhoneTracePointMsRef = useRef(-Infinity);
  const lastAiClassifyRef = useRef(0);
  const calibrationSamplesRef = useRef<number[]>([]);
  const calibrationEndTimeRef = useRef(0);
  const rollingSamplesRef = useRef<MagneticSample[]>([]);

  const motionDetector = useRef(new RealtimeMotionDetector());
  const isScreenTouchedRef = useRef(false);
  const lastTouchEndMs = useRef<number | null>(null);
  const lastTouchMarkerMs = useRef(Number.NEGATIVE_INFINITY);
  const foregroundRef = useRef(AppState.currentState === 'active');
  const idleGenerationRef = useRef(0);
  const previewAllowedRef = useRef(true);
  const isChargingRef = useRef(false);
  const batteryKnownRef = useRef(false);
  const batteryStateRef = useRef(Battery.BatteryState.UNKNOWN);
  const acquisitionRunIdRef = useRef(`capture-${Date.now()}`);
  function getPhysicalContext(): DevicePhysicalContext {
    const motion = motionDetector.current.analyze();
    const now = performance.now();
    const timeSinceTouch = isScreenTouchedRef.current ? 0 : lastTouchEndMs.current === null ? undefined : Math.max(0, now - lastTouchEndMs.current);
    return {
      isStandstill: motion.isStandstill,
      motionState: motion.motionState,
      accelVarianceG: motion.accelVarianceG,
      isFlatOnSurface: motion.isFlatOnSurface,
      isScreenTouched: isScreenTouchedRef.current,
      timeSinceLastTouchMs: timeSinceTouch,
      isCharging: batteryKnownRef.current ? isChargingRef.current : undefined,
      batteryState: batteryKnownRef.current ? (isChargingRef.current ? 'CHARGING' : 'UNPLUGGED') : 'UNKNOWN',
      sensorDeviceKey: `${Device.modelName ?? 'unknown'}:${Platform.OS}`,
      sampleKind: 'MEASURED',
      acquisitionRunId: acquisitionRunIdRef.current,
    };
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
    rollingSamplesRef.current = [];
    setAiClassification(null);
    calibrationEndTimeRef.current = performance.now() + 2000;
    maxExcursionRef.current = 1.2;
    setMaxDelta(1.2);
    setCalibrating(true);
    setCalibCountdownMs(2000);
    setDelta(0);
    setActiveNote(BLOOM_PENTATONIC_SCALE[0]);
  }

  function handleMagnetometerReading(x: number, y: number, z: number, sensorTimestampSeconds: number) {
    if (!mounted.current || !foregroundRef.current) return;
    if (![x,y,z,sensorTimestampSeconds].every(Number.isFinite) || sensorTimestampSeconds < 0) {
      rollingSamplesRef.current=[];calibrationSamplesRef.current=[];baselineRef.current=null;
      setAiClassification(null);setMag(null);setVector(null);setDelta(null);
      setStatus('Native magnetic values or sensor timing are unavailable. No replacement samples were generated.');
      return;
    }
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

    const sampleTimeMs = sensorTimestampSeconds * 1000;
    const d = totalMag - baselineRef.current;
    const absD = Math.abs(d);

    // A short, in-memory display trace for the intro comparison page. Native
    // sensor time stays monotonic; UTC here is the app receipt time, not a
    // reconstructed measurement timestamp. This trace is never persisted.
    if (sampleTimeMs - lastPhoneTracePointMsRef.current >= 500) {
      lastPhoneTracePointMsRef.current = sampleTimeMs;
      const point = {
        receivedAtUtc: new Date().toISOString(),
        sensorTimestampSeconds,
        magnitudeMicroT: totalMag,
        deltaNt: d * 1000,
      };
      setLivePhonePoints(previous => [...previous, point].slice(-60));
    }

    // 2. Dynamic Sensitivity Scaling: Expand range to match hand distance
    if (absD > maxExcursionRef.current) {
      const updated = Math.min(35.0, Math.max(maxExcursionRef.current * 1.05, absD));
      maxExcursionRef.current = updated;
      setMaxDelta(updated);
    }

    // 3. Rolling sample buffer for AI classifier
    if (rollingSamplesRef.current.length && sampleTimeMs<=rollingSamplesRef.current.at(-1)!.timestampMs) rollingSamplesRef.current=[];
    rollingSamplesRef.current.push({ x, y, z, timestampMs: sampleTimeMs });
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
        [],
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

  function stopIdleMonitoring(clearDisplay = true) {
    idleGenerationRef.current++;
    soundEngine.current?.setMuted(true);
    const subscriptions=[idleSubscription.current,accelSubscription.current];
    idleSubscription.current=null;accelSubscription.current=null;
    for (const subscription of subscriptions) { try { subscription?.remove(); } catch { /* Remove the other listener even if one fails. */ } }
    motionDetector.current.reset();rollingSamplesRef.current=[];lastAcceleration.current=null;
    if (clearDisplay && mounted.current) {
      setMag(null);setVector(null);setDelta(null);setAiClassification(null);
      setMotionAnalysis(motionDetector.current.analyze());
      setCalibrating(false);calibrationEndTimeRef.current=0;
    }
  }

  async function startIdleMonitoring() {
    if (!mounted.current || !foregroundRef.current || !previewAllowedRef.current || gate.current?.recording || gate.current?.starting) return;
    stopIdleMonitoring();
    const generation=idleGenerationRef.current;
    const canContinue=()=>mounted.current && foregroundRef.current && previewAllowedRef.current && generation===idleGenerationRef.current && !gate.current?.recording && !gate.current?.starting;
    try {
      const [magAvailable,accelAvailable]=await Promise.all([Magnetometer.isAvailableAsync(),Accelerometer.isAvailableAsync()]);
      if (!canContinue() || !magAvailable) return;
      if (!soundEngine.current) {
        soundEngine.current=new MagneticSoundscapeEngine();
        await soundEngine.current.init();
      }
      if (!canContinue()) { if (!mounted.current || !foregroundRef.current) soundEngine.current?.setMuted(true); return; }
      soundEngine.current.setMuted(soundMutedRef.current);
      calibrateBaseline();
      Magnetometer.setUpdateInterval(100);
      idleSubscription.current=Magnetometer.addListener(m=>{
        if (canContinue()) handleMagnetometerReading(m.x,m.y,m.z,m.timestamp);
      });
      if (accelAvailable && canContinue()) {
        Accelerometer.setUpdateInterval(100);
        accelSubscription.current=Accelerometer.addListener(a=>{
          if (canContinue()) motionDetector.current.pushSample(a.x,a.y,a.z,performance.now());
        });
      }
    } catch (err) {
      if (canContinue()) { stopIdleMonitoring();setStatus('Live sensor preview could not start. Check sensor availability and foreground permissions.'); }
      console.warn('Idle monitoring initialization failed:',err);
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
    if (reason === 'USER_STOPPED' || reason === 'CONSENT_REVOKED') previewAllowedRef.current=false;
    stopIdleMonitoring();
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
      if (foregroundRef.current && previewAllowedRef.current) void startIdleMonitoring();
      if (reason === 'DURATION_COMPLETE') {
        setCurrentStep(4);
        // Local recording consent does not authorize a cloud upload; Sync remains explicit.
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

    foregroundRef.current=AppState.currentState==='active';
    gate.current!.setForeground(foregroundRef.current);
    const subscription=AppState.addEventListener('change',state=>{
      const wasForeground=foregroundRef.current;
      foregroundRef.current=state==='active';
      if (!foregroundRef.current) {
        stopIdleMonitoring();
        isScreenTouchedRef.current=false;setIsScreenTouched(false);
        soundEngine.current?.setMuted(true);
      }
      gate.current!.setForeground(foregroundRef.current);
      if (foregroundRef.current && !wasForeground && previewAllowedRef.current) void startIdleMonitoring();
    });

    // Initialize battery charging listener
    void Battery.getBatteryStateAsync().then((state) => {
      if (!mounted.current) return;
      const previousState = batteryStateRef.current;
      batteryKnownRef.current = state !== Battery.BatteryState.UNKNOWN;
      batteryStateRef.current = state;
      const charging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
      setIsCharging(charging);
      isChargingRef.current = charging;
      const current = sessionRef.current;
      const batteryMarker = batteryMarkerKind(state);
      if (batteryMarker && previousState !== state && current && gate.current?.recording && current.markers.length < 90) {
        const atUtc = new Date().toISOString();
        current.markers.push({ kind: batteryMarker, atUtc, elapsedSeconds: Math.max(0, (performance.now() - startMonotonic.current) / 1000), origin: 'SYSTEM_EVENT' });
      }
    }).catch(() => {});

    const batterySub = Battery.addBatteryStateListener(({ batteryState }) => {
      const previousState = batteryStateRef.current;
      batteryKnownRef.current = batteryState !== Battery.BatteryState.UNKNOWN;
      batteryStateRef.current = batteryState;
      const charging = batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL;
      setIsCharging(charging);
      isChargingRef.current = charging;
      const current = sessionRef.current;
      const batteryMarker = batteryMarkerKind(batteryState);
      if (batteryMarker && previousState !== batteryState && current && gate.current?.recording && current.markers.length < 90) {
        const atUtc = new Date().toISOString();
        current.markers.push({ kind: batteryMarker, atUtc, elapsedSeconds: Math.max(0, (performance.now() - startMonotonic.current) / 1000), origin: 'SYSTEM_EVENT' });
      }
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
      if (el >= targetDurationRef.current * 1000) gate.current!.stop('DURATION_COMPLETE');
      else if (
        el >= 10_000 &&
        (!sessionRef.current?.samples.length || performance.now() - lastUiUpdate.current > 5000)
      ) {
        gate.current!.stop('SENSOR_STALLED');
      }
    }, 1000);

    return () => {
      mounted.current = false;
      foregroundRef.current=false;
      stopIdleMonitoring(false);
      subscription.remove();
      batterySub.remove();
      clearInterval(watchdog);
      gate.current!.dispose();
      void soundEngine.current?.dispose();
    };
  }, []);

  async function start(replaceExisting = false) {
    if (!adult || !consent) {
      setStatus('Before recording, confirm you are 18 or older and consent to foreground recording on this phone.');
      return;
    }
    if (busy || !foregroundRef.current || gate.current!.recording) return;
    if (!replaceExisting) {
      let hasSaved=Boolean(sessionRef.current);
      try { hasSaved=hasSaved||savedFile().exists; }
      catch { setStatus('The saved recording could not be checked. Review or delete it before starting another.');setCurrentStep(4);return; }
      if (hasSaved) {
        Alert.alert('Replace saved recording?','A recording is already saved on this phone. Review and export it first, or explicitly replace it with the next recording.',[
          {text:'Cancel',style:'cancel'},
          {text:'Review / export',onPress:()=>setCurrentStep(4)},
          {text:'Replace recording',style:'destructive',onPress:()=>{void start(true);}},
        ]);
        return;
      }
    }
    previewAllowedRef.current=true;
    stopIdleMonitoring();
    // Keep the previous file until an explicitly authorized replacement is actually saved.
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
          // Cancel any preview preparation before registering recorded acquisition.
          stopIdleMonitoring();

          const now = new Date().toISOString();
          const initialBatteryMarker = batteryMarkerKind(batteryStateRef.current);
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
            markers: [
              { kind: 'BASELINE', atUtc: now, elapsedSeconds: 0, origin: 'MANUAL_TOUCH' },
              ...(initialBatteryMarker ? [{ kind: initialBatteryMarker, atUtc: now, elapsedSeconds: 0, origin: 'SYSTEM_EVENT' as const }] : []),
            ],
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
          soundEngine.current?.setMuted(soundMutedRef.current);
          Accelerometer.setUpdateInterval(1000 / SENSOR_PROTOCOL.nominalHz);
          Magnetometer.setUpdateInterval(1000 / SENSOR_PROTOCOL.nominalHz);

          register(
            Accelerometer.addListener((measurement) => {
              if (!mounted.current || !foregroundRef.current || !gate.current!.recording) return;
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
              if (!mounted.current || !foregroundRef.current || !gate.current!.recording || !sessionRef.current) return;
              const current = sessionRef.current;
              const receivedMonotonicMs = performance.now();
              const receivedAtUtc = new Date().toISOString();
              if (![measurement.x, measurement.y, measurement.z, measurement.timestamp].every(Number.isFinite) || measurement.timestamp < 0) {
                gate.current!.stop('INVALID_NATIVE_SAMPLE');
                return;
              }
              if (current.samples.length && measurement.timestamp <= current.samples.at(-1)!.sensorTimestampSeconds) { gate.current!.stop('NON_MONOTONIC_NATIVE_TIME'); return; }
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
                accelerationG: accel && age !== null && age >= 0 && age <= 500 ? { ...accel.vector } : null,
                accelerationAgeMs: age,
              });

              // Also update the live top-middle visualizer and ambient sound
              handleMagnetometerReading(measurement.x, measurement.y, measurement.z, measurement.timestamp);

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
                receivedMonotonicMs - startMonotonic.current >= targetDurationRef.current * 1000 ||
                current.samples.length >= SENSOR_PROTOCOL.maximumSamples
              ) {
                gate.current!.stop('DURATION_COMPLETE');
              }
            })
          );
        }
      );
      if (started && gate.current!.recording && mounted.current) {
        if (sessionRef.current) rememberCaptureLocation(sessionRef.current.id);
        setRecording(true);
        setStatus('LIVE PHONE Â· Keep phone resting flat on non-magnetic surface.');
        refresh();
      }
    } catch (error) {
      if (mounted.current) setStatus(error instanceof Error ? error.message : 'Sensor start failed.');
    } finally {
      if (mounted.current) {
        setBusy(false);
        if (!gate.current!.recording && foregroundRef.current && previewAllowedRef.current) void startIdleMonitoring();
      }
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
      const serverUrl = apiBaseUrl();
      const response = await fetch(`${serverUrl}/api/recordings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(current),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Server rejected recording');
      const msg = `âœ… Uploaded to Central Database (#${data.submissionId}). Server response received; inspect QC.`;
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

  function requestDeleteSession() {
    if (recording || busy) return;
    Alert.alert('Delete local recording?','This deletes the saved recording and its temporary export files from this phone. Previously shared copies are unaffected.',[
      {text:'Cancel',style:'cancel'},
      {text:'Delete recording',style:'destructive',onPress:deleteSession},
    ]);
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
      if (sessionRef.current) forgetCaptureLocation(sessionRef.current.id);
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
    <View
      style={styles.root}
      onTouchStart={() => {
        const touchAt = performance.now();
        if (touchAt - lastTouchMarkerMs.current >= 500) {
          lastTouchMarkerMs.current = touchAt;
          marker('SCREEN_INTERACTION');
        }
        isScreenTouchedRef.current = true;
        setIsScreenTouched(true);
      }}
      onTouchEnd={() => {
        lastTouchEndMs.current = performance.now();
        isScreenTouchedRef.current = false;
        setIsScreenTouched(false);
      }}
      onTouchCancel={() => {
        lastTouchEndMs.current = performance.now();
        isScreenTouchedRef.current = false;
        setIsScreenTouched(false);
      }}
    >
      <StatusBar barStyle="light-content" />
      {recording && <RecordingAwake />}
      {recording && guidedActive.current && <GuidedCue elapsed={elapsed} late={lateCue} />}

      {showIntro ? (
        <MagnetismIntroAnimation
          visible={showIntro}
          onComplete={() => setShowIntro(false)}
          phonePoints={livePhonePoints}
          phoneCurrentMicroT={mag}
          phoneDeltaNt={delta === null ? null : delta * 1000}
          isRecording={recording}
        />
      ) : (
        <>
          {/* MINIMAL TOP HEADER: AURORASENSE FLASHES THEN DIMS; MUSE SPARK PROMINENT */}
          <View style={styles.topHeader}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowIntro(true)}
              style={{
                opacity: titleFlash ? 1 : 0.2,
                paddingVertical: 2,
              }}
            >
              <Text style={styles.wordmark}>
                Aurora<Text style={{ color: colors.mint }}>Sense</Text>
              </Text>
            </Pressable>

            {/* Open the dated real-run audit and explicitly scripted policy replay. */}
            <Pressable
              accessibilityRole="button"
              onPress={() => setSparkDrawerOpen(true)}
              style={styles.museSparkPill}
            >
              <View style={styles.museSparkDot} />
              <View>
                <Text style={styles.museSparkTitle}>Muse Spark · Evidence</Text>
                <Text style={styles.museSparkSub}>Recorded run · tools</Text>
              </View>
            </Pressable>
          </View>

          {/* SINGLE APPLE-STYLE GUIDED VISUAL EXPERIENCE */}
          <View style={styles.screenContainer}>
            <GroundTruthScreen
              mag={mag}
              delta={delta}
              vector={vector}
              motionAnalysis={motionAnalysis}
              isScreenTouched={isScreenTouched}
              isCharging={isCharging}
              classification={aiClassification}
              session={session}
              qc={qc}
              prescriptiveReport={prescriptiveReport}
              soundMuted={soundMuted}
              onToggleSound={() => {
                const next = !soundMuted;
                setSoundMuted(next);
                soundEngine.current?.setMuted(next);
              }}
              calibrating={calibrating}
              onCalibrate={calibrateBaseline}
              adultConfirmed={adult}
              onChangeAdult={(val) => {
                setAdult(val);
                if (!val) { if (sessionRef.current) forgetCaptureLocation(sessionRef.current.id); previewAllowedRef.current=false;stopIdleMonitoring();soundEngine.current?.setMuted(true); }
                gate.current!.setConsent(val, consent);
              }}
              recordingConsent={consent}
              onChangeConsent={(val) => {
                setConsent(val);
                if (!val) { if (sessionRef.current) forgetCaptureLocation(sessionRef.current.id); previewAllowedRef.current=false;stopIdleMonitoring();soundEngine.current?.setMuted(true); }
                gate.current!.setConsent(adult, val);
              }}
              guidedProtocol={guided}
              onChangeGuided={setGuided}
              targetDurationSec={targetDurationSec}
              onChangeTargetDurationSec={(sec) => {
                setTargetDurationSec(sec);
                targetDurationRef.current = sec;
              }}
              isRecording={recording}
              recordingElapsed={elapsed}
              onStartRecording={() => {
                if (!adult || !consent) {
                  setStatus('Confirm both adult participation and foreground local recording consent before starting.');
                  return;
                }
                gate.current!.setConsent(adult, consent);
                void start();
              }}
              onStopRecording={() => gate.current!.stop()}
              hasRecordedSession={!!session}
              onUploadDatabase={() => void uploadToCentralDatabase()}
              isUploading={isUploading}
              uploadStatus={uploadStatus}
              onExportSession={(fmt) => void exportSession(fmt)}
              onDeleteSession={requestDeleteSession}
              dataBusy={busy}
              statusMessage={status}
              currentStep={currentStep}
              onSelectStep={setCurrentStep}
            />
          </View>

          {/* MUSE SPARK EVIDENCE DRAWER */}
          <WhyModal visible={whyModalOpen} onClose={() => setWhyModalOpen(false)} />
          <MuseSparkDrawer
            visible={sparkDrawerOpen}
            onClose={() => setSparkDrawerOpen(false)}
            hasLocalSession={!!session}
          />
        </>
      )}
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
    paddingTop: 46,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#030a14',
  },
  wordmark: { color: colors.ink, fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  quickTitleMenu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#030a14',
    borderBottomWidth: 1,
    borderBottomColor: '#12253b',
  },
  quickMenuPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#0a1c33',
    borderWidth: 1,
    borderColor: '#1a3b60',
  },
  quickMenuPillActive: {
    backgroundColor: 'rgba(104, 237, 195, 0.16)',
    borderColor: colors.mint,
  },
  quickMenuPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#d9ecff',
  },
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
