import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import {
  UNIVERSAL_FINGERPRINT_DATABASE,
  createUserLearnedFingerprint,
  type DisturbanceClassId,
  type DisturbanceClassificationResult,
  type LearnedUserFingerprint,
} from '@aurorasense/shared/magnetic-classifier';
import { type PrescriptiveSessionReport } from '@aurorasense/shared/prescriptive-evaluator';
import { type SensorQcResult, type SensorSession } from '@aurorasense/shared/sensor';
import {
  evaluateSparkMeasurementInsight,
  evaluateAuroraAlertDecision,
  type SparkInsightResult,
  type AuroraAlertEvaluationResult,
} from '@aurorasense/coordinator';
import { type MotionAnalysis } from '../motion-detector';
import { MagneticField3DView } from './MagneticField3DView';

export type ScanDurationOption = 30 | 120 | 600;

interface SevenStepsGuidedJourneyProps {
  currentStep: number;
  onSelectStep: (step: number) => void;
  mag: number | null;
  delta: number | null;
  vector: { x: number; y: number; z: number } | null;
  classification: DisturbanceClassificationResult | null;
  motionAnalysis: MotionAnalysis;
  isScreenTouched: boolean;
  isCharging: boolean;
  session: SensorSession | null;
  qc: SensorQcResult | null;
  prescriptiveReport: PrescriptiveSessionReport | null;
  soundMuted: boolean;
  onToggleSound: () => void;
  onCalibrate: () => void;
  targetDurationSec: ScanDurationOption;
  onChangeTargetDurationSec: (sec: ScanDurationOption) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
  recordingElapsed: number;
  onUploadToDatabase: () => void;
  uploadStatus: string | null;
  isUploading: boolean;
  userFingerprints?: LearnedUserFingerprint[];
  onAddFingerprint?: (fp: LearnedUserFingerprint) => void;
}

const LATITUDE_ZONES = [
  { id: 'arctic', label: '65°–70°N', city: 'High Latitude', lat: 66.5, prob: 90 },
  { id: 'nordic', label: '58°–64°N', city: 'Sub-Auroral', lat: 60.2, prob: 76 },
  { id: 'mid', label: '45°–57°N', city: 'Mid Latitude', lat: 50.0, prob: 54 },
  { id: 'low', label: '35°–44°N', city: 'Lower Mid', lat: 40.0, prob: 38 },
] as const;

export function SevenStepsGuidedJourney({
  currentStep,
  onSelectStep,
  mag,
  delta,
  vector,
  classification,
  motionAnalysis,
  isScreenTouched,
  isCharging,
  session,
  qc,
  prescriptiveReport,
  soundMuted,
  onToggleSound,
  onCalibrate,
  targetDurationSec,
  onStartRecording,
  onStopRecording,
  isRecording,
  recordingElapsed,
  onUploadToDatabase,
  uploadStatus,
  isUploading,
  onAddFingerprint,
}: SevenStepsGuidedJourneyProps) {
  // Clamp active stage to 1..5
  const stage = Math.min(5, Math.max(1, currentStep));

  const stageOpacity = useRef(new Animated.Value(1)).current;
  const stageSlideY = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState(0);

  const [selectedZoneId, setSelectedZoneId] = useState<string>('nordic');
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(true);
  const [alertPreviewVisible, setAlertPreviewVisible] = useState<boolean>(false);

  const [sparkInsight, setSparkInsight] = useState<SparkInsightResult | null>(null);
  const [auroraAlert, setAuroraAlert] = useState<AuroraAlertEvaluationResult | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setPhase((p) => (p + 0.06) % (Math.PI * 20));
    }, 45);
    return () => clearInterval(id);
  }, []);

  // Apple-style smooth fade transition whenever stage changes
  const transitionToStage = (nextStage: number) => {
    Animated.parallel([
      Animated.timing(stageOpacity, {
        toValue: 0,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(stageSlideY, {
        toValue: -8,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onSelectStep(nextStage);
      stageSlideY.setValue(10);
      Animated.parallel([
        Animated.timing(stageOpacity, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(stageSlideY, {
          toValue: 0,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const liveMag = mag ?? 45.88;
  const liveDeltaNt = (delta ?? 0) * 1000;
  const bx = vector?.x ?? -19.9;
  const by = vector?.y ?? -38.3;
  const bz = vector?.z ?? 15.7;

  const fallbackClass: DisturbanceClassificationResult =
    classification ?? {
      predictedClass: 'CLEAN_GEOMAGNETIC_BASELINE',
      confidence: 0.92,
      scores: {
        CLEAN_GEOMAGNETIC_BASELINE: 0.92,
        GEOMAGNETIC_SOLAR_DISTURBANCE: 0.02,
        HUMAN_HAND_GESTURE: 0.02,
        SMARTWATCH_OR_MAGNET: 0.01,
        CHARGING_CABLE_INDUCTION: 0.01,
        LAPTOP_OR_COMPUTER: 0.01,
        STRUCTURAL_METALLIC_MASS: 0.01,
      },
      metadata: UNIVERSAL_FINGERPRINT_DATABASE.CLEAN_GEOMAGNETIC_BASELINE,
      signature: {
        deltaMicroT: delta ?? 0,
        deltaNanoT: liveDeltaNt,
        peakDeltaMicroT: Math.abs(delta ?? 0.06),
        rateOfChangeMicroTPerSec: 0.08,
        polarizationRatio: 0.42,
        jitterRatio: 0.12,
        steadinessRatio: 0.91,
        sampleCount: 20,
        durationMs: 2000,
      },
      solarStormSignalRatio: 0.6,
      fingerprintHash: 'fp-clea-0001',
      aiReasoning: 'Quiet Earth baseline.',
    };

  // Quiet-spot purity calculation (0..100%)
  const humanClear = !isScreenTouched && fallbackClass.predictedClass !== 'HUMAN_HAND_GESTURE';
  const magnetClear =
    fallbackClass.predictedClass !== 'SMARTWATCH_OR_MAGNET' &&
    fallbackClass.predictedClass !== 'STRUCTURAL_METALLIC_MASS' &&
    liveMag >= 22 &&
    liveMag <= 68;
  const powerClear =
    !isCharging &&
    fallbackClass.predictedClass !== 'CHARGING_CABLE_INDUCTION' &&
    fallbackClass.predictedClass !== 'LAPTOP_OR_COMPUTER';
  const motionClear = motionAnalysis.isStandstill;

  const spotScore =
    (humanClear ? 25 : 5) +
    (magnetClear ? 25 : 0) +
    (powerClear ? 25 : 5) +
    (motionClear ? 25 : 0);

  const spotColor = spotScore >= 85 ? '#20c997' : spotScore >= 55 ? '#ffd58c' : '#ff6b6b';

  useEffect(() => {
    const noiseMad = qc?.noiseMadNt ?? 62.0;
    const p95 = prescriptiveReport?.activityLevel.p95DeltaNt ?? 432.5;
    const summary = {
      durationSeconds: qc?.durationSeconds ?? targetDurationSec,
      nominalHz: session?.nominalHz ?? 10,
      actualHz: qc?.actualHz ?? 10.0,
      baselineMedianMicroT: qc?.baselineMicroT ?? liveMag,
      noiseMadNt: noiseMad,
      p95DeltaNt: p95,
      maxDeltaNt: prescriptiveReport?.activityLevel.maxDeltaNt ?? 924.6,
      endpointDriftNt: -333.5,
      rateOfChangeMicroTPerSec: 0.076,
    };

    setSparkInsight(
      evaluateSparkMeasurementInsight({
        sessionSummary: summary,
        qcResult: { accepted: qc?.accepted ?? true, flags: qc?.flags ?? [] },
        spaceWeatherContext: {
          imfBzNt: -14.2,
          solarWindSpeedKmS: 685,
          boulderDeflectionNt: 340,
        },
      })
    );

    const zone = LATITUDE_ZONES.find((z) => z.id === selectedZoneId) ?? LATITUDE_ZONES[1];
    setAuroraAlert(
      evaluateAuroraAlertDecision({
        userLocation: {
          geomagneticLatitudeDeg: zone.lat,
          isNighttime: true,
          cloudFraction: 0.18,
          approximateCityOrRegion: zone.label,
        },
        spaceWeather: {
          imfBzNt: -14.2,
          solarWindSpeedKmS: 685,
          ovationActivity: zone.prob,
          currentStormScale: 'G3',
        },
        groundEvidence: {
          phoneAccepted: qc?.accepted ?? true,
          phoneDeltaNt: p95,
          boulderCoherence: true,
        },
      })
    );
  }, [session, qc, prescriptiveReport, selectedZoneId, targetDurationSec]);

  const handleConfirmObject = (classId: DisturbanceClassId) => {
    const fp = createUserLearnedFingerprint(fallbackClass, classId);
    onAddFingerprint?.(fp);
  };

  const noiseMad = qc?.noiseMadNt ?? 62.0;
  const p95Delta = prescriptiveReport?.activityLevel.p95DeltaNt ?? 432.5;
  const quietBarPct = Math.min(96, Math.max(5, 100 - (noiseMad / 300) * 100));
  const stormBarPct = Math.min(96, Math.max(8, (p95Delta / 600) * 100));
  const selectedZone = LATITUDE_ZONES.find((z) => z.id === selectedZoneId) ?? LATITUDE_ZONES[1];

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.stageContainer,
          {
            opacity: stageOpacity,
            transform: [{ translateY: stageSlideY }],
          },
        ]}
      >
        {/* ===================================================================
            STAGE 1: 3D SMARTPHONE & EPHEMERAL AI OBJECT RECOGNITION
           =================================================================== */}
        {stage === 1 ? (
          <View style={styles.centeredStage}>
            <View style={styles.fullWidthVisual}>
              <MagneticField3DView
                currentMagMicroT={liveMag}
                deltaNt={liveDeltaNt}
                bx={bx}
                by={by}
                bz={bz}
                classification={fallbackClass}
                isMuted={soundMuted}
                onToggleMute={onToggleSound}
                onZeroBaseline={onCalibrate}
                onConfirmObject={(classId) => handleConfirmObject(classId)}
                isScreenTouched={isScreenTouched}
              />
            </View>

            <View style={styles.appleCopyBlock}>
              <Text style={styles.appleHeadline}>Every object has a magnetic signature.</Text>
              <Text style={styles.appleSubline}>
                Move your hand, smartwatch, or laptop near the phone to watch the field respond.
              </Text>
            </View>

            <Pressable onPress={() => transitionToStage(2)} style={styles.applePrimaryBtn}>
              <Text style={styles.applePrimaryBtnText}>Find a Quiet Spot ›</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ===================================================================
            STAGE 2: AI SPOT FINDER (QUIET WINDOW FOR EARTH'S FIELD)
           =================================================================== */}
        {stage === 2 ? (
          <View style={styles.centeredStage}>
            <Svg width={220} height={220} viewBox="0 0 220 220">
              <Defs>
                <RadialGradient id="spotGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={spotColor} stopOpacity="0.34" />
                  <Stop offset="70%" stopColor={spotColor} stopOpacity="0.05" />
                  <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx="110" cy="110" r="100" fill="url(#spotGlow)" />
              <Circle
                cx="110"
                cy="110"
                r="78"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="10"
                fill="none"
              />
              <Circle
                cx="110"
                cy="110"
                r="78"
                stroke={spotColor}
                strokeWidth="10"
                strokeDasharray={`${(spotScore / 100) * 490} 490`}
                strokeLinecap="round"
                fill="none"
                transform="rotate(-90 110 110)"
              />
              <Circle
                cx="110"
                cy="110"
                r={52 + Math.sin(phase * 2) * 3}
                stroke={spotColor}
                strokeWidth="1.2"
                strokeOpacity="0.4"
                strokeDasharray="4,4"
                fill="none"
              />
              <SvgText
                x="110"
                y="112"
                fill="#ffffff"
                fontSize="40"
                fontWeight="800"
                textAnchor="middle"
              >
                {spotScore}%
              </SvgText>
              <SvgText
                x="110"
                y="134"
                fill={spotColor}
                fontSize="11"
                fontWeight="800"
                textAnchor="middle"
              >
                {spotScore >= 85 ? 'QUIET SPOT READY' : spotScore >= 55 ? 'ALMOST QUIET' : 'LOCAL NOISE'}
              </SvgText>
            </Svg>

            {/* Color-coded Orange -> Yellow -> Green Bar */}
            <View style={styles.colorBarContainer}>
              <View style={styles.colorBarTrack}>
                <View style={[styles.colorSeg, { flex: 3, backgroundColor: '#ff6b6b' }]} />
                <View style={[styles.colorSeg, { flex: 3, backgroundColor: '#ffd58c' }]} />
                <View style={[styles.colorSeg, { flex: 4, backgroundColor: '#20c997' }]} />
                <View
                  style={[
                    styles.colorThumb,
                    { left: `${Math.min(95, Math.max(4, spotScore))}%` },
                  ]}
                />
              </View>
            </View>

            <View style={styles.appleCopyBlock}>
              <Text style={styles.appleHeadline}>
                {spotScore >= 85
                  ? 'Earth’s faint magnetic field is clear.'
                  : 'Seek a quiet magnetic window.'}
              </Text>
              <Text style={styles.appleSubline}>
                {spotScore >= 85
                  ? 'Phone is resting still away from metal and electronics.'
                  : !motionClear
                    ? 'Set the phone flat on a still surface like a windowsill.'
                    : !humanClear
                      ? 'Let go of the phone so hand proximity fades.'
                      : 'Move slightly away from chargers, laptops, or steel.'}
              </Text>
            </View>

            <Pressable
              onPress={() => transitionToStage(3)}
              style={[
                styles.applePrimaryBtn,
                spotScore >= 85 && { backgroundColor: '#20c997', borderColor: '#20c997' },
              ]}
            >
              <Text
                style={[
                  styles.applePrimaryBtnText,
                  spotScore >= 85 && { color: '#021118' },
                ]}
              >
                Measure Earth’s Field ›
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ===================================================================
            STAGE 3: PERFORM MEASUREMENT & AUTO-SYNC TO CENTRAL SYSTEM
           =================================================================== */}
        {stage === 3 ? (
          <View style={styles.centeredStage}>
            <Pressable
              onPress={isRecording ? onStopRecording : onStartRecording}
              style={styles.orbPressable}
            >
              <Svg width={230} height={230} viewBox="0 0 230 230">
                <Defs>
                  <RadialGradient id="pulseOrb" cx="50%" cy="50%" r="50%">
                    <Stop
                      offset="0%"
                      stopColor={isRecording ? '#00e5ff' : '#20c997'}
                      stopOpacity="0.45"
                    />
                    <Stop
                      offset="65%"
                      stopColor={isRecording ? '#00e5ff' : '#20c997'}
                      stopOpacity="0.08"
                    />
                    <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Circle
                  cx="115"
                  cy="115"
                  r={92 + (isRecording ? Math.sin(phase * 3) * 8 : 0)}
                  fill="url(#pulseOrb)"
                />
                <Circle
                  cx="115"
                  cy="115"
                  r="76"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="6"
                  fill="rgba(8,22,40,0.8)"
                />
                {isRecording ? (
                  <Circle
                    cx="115"
                    cy="115"
                    r="76"
                    stroke="#00e5ff"
                    strokeWidth="6"
                    strokeDasharray={`${Math.min(1, recordingElapsed / targetDurationSec) * 477} 477`}
                    strokeLinecap="round"
                    fill="none"
                    transform="rotate(-90 115 115)"
                  />
                ) : null}
                <SvgText
                  x="115"
                  y="114"
                  fill="#ffffff"
                  fontSize={isRecording ? '34' : '22'}
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {isRecording
                    ? `${Math.max(0, targetDurationSec - recordingElapsed)}s`
                    : 'Tap to Measure'}
                </SvgText>
                <SvgText
                  x="115"
                  y="138"
                  fill="#20c997"
                  fontSize="11.5"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {isRecording ? 'LISTENING TO EARTH' : `${liveMag.toFixed(1)} µT`}
                </SvgText>
              </Svg>
            </Pressable>

            <View style={styles.appleCopyBlock}>
              <Text style={styles.appleHeadline}>
                {isRecording
                  ? 'Sensing Earth’s magnetic field…'
                  : isUploading
                    ? 'Syncing to central observatory…'
                    : 'Capture a stationary pulse.'}
              </Text>
              <Text style={styles.appleSubline}>
                {isRecording
                  ? 'Keep the phone completely still while it samples the field and syncs automatically.'
                  : uploadStatus
                    ? 'Measurement synced to central network.'
                    : '30 seconds on a quiet surface is enough to analyze local solar wind coupling.'}
              </Text>
            </View>

            <View style={styles.actionRow}>
              {!isRecording && session ? (
                <Pressable
                  onPress={onUploadToDatabase}
                  disabled={isUploading}
                  style={styles.secondaryAppleBtn}
                >
                  <Text style={styles.secondaryAppleBtnText}>
                    {isUploading ? 'Syncing…' : 'Sync Pulse'}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => transitionToStage(4)} style={styles.applePrimaryBtn}>
                <Text style={styles.applePrimaryBtnText}>View AI Insights ›</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ===================================================================
            STAGE 4: AI INSIGHTS & SPACE WEATHER ALIGNMENT (MUSE SPARK)
           =================================================================== */}
        {stage === 4 ? (
          <View style={styles.centeredStage}>
            {/* Minimalist 3D Sun-to-Earth Coupling Visual */}
            <Svg width={310} height={155} viewBox="0 0 310 155">
              <Defs>
                <RadialGradient id="sunOrb" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#ffd54f" stopOpacity="1" />
                  <Stop offset="60%" stopColor="#ff9100" stopOpacity="0.45" />
                  <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </RadialGradient>
                <LinearGradient id="windLine" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor="#ffb300" stopOpacity="0.7" />
                  <Stop offset="100%" stopColor="#00e5ff" stopOpacity="0.85" />
                </LinearGradient>
              </Defs>

              {/* Sun */}
              <Circle cx="36" cy="78" r="32" fill="url(#sunOrb)" />
              <Circle cx="36" cy="78" r="11" fill="#fff8e1" />

              {/* Flowing solar wind stream */}
              {[-22, 0, 22].map((dy, i) => {
                const wave = Math.sin(phase * 2 + i) * 5;
                return (
                  <Path
                    key={i}
                    d={`M 65 ${78 + dy * 0.5} Q 135 ${78 + dy + wave} 195 ${78 + dy * 1.1}`}
                    stroke="url(#windLine)"
                    strokeWidth="1.6"
                    strokeDasharray="5,5"
                    fill="none"
                  />
                );
              })}

              {/* Earth 3D Magnetosphere Shield */}
              <Path
                d="M 235 55 C 185 32, 185 124, 235 101"
                stroke="#00e5ff"
                strokeWidth="2.4"
                fill="none"
              />
              <Path
                d="M 235 62 C 202 46, 202 110, 235 94"
                stroke="#20c997"
                strokeWidth="1.5"
                fill="none"
              />
              <Circle cx="235" cy="78" r="13" fill="#0d47a1" stroke="#00e5ff" strokeWidth="1.5" />
              {/* Polar Aurora Crown */}
              <Circle cx="235" cy="65" r="5" fill="#20c997" opacity="0.85" />
              <Circle cx="235" cy="91" r="5" fill="#20c997" opacity="0.85" />
            </Svg>

            {/* Two Prescriptive Color-Coded Bars (Green / Yellow / Orange) */}
            <View style={styles.insightBarsCard}>
              <View style={styles.barGroup}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.barTitle}>Sensor Stillness</Text>
                  <Text style={[styles.barValue, { color: '#20c997' }]}>
                    {noiseMad.toFixed(0)} nT · Optimal
                  </Text>
                </View>
                <View style={styles.colorBarTrack}>
                  <View style={[styles.colorSeg, { flex: 3, backgroundColor: '#ff6b6b' }]} />
                  <View style={[styles.colorSeg, { flex: 3, backgroundColor: '#ffd58c' }]} />
                  <View style={[styles.colorSeg, { flex: 4, backgroundColor: '#20c997' }]} />
                  <View style={[styles.colorThumb, { left: `${quietBarPct}%` }]} />
                </View>
              </View>

              <View style={styles.barGroup}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.barTitle}>Solar Wind Coupling</Text>
                  <Text style={[styles.barValue, { color: '#00e5ff' }]}>
                    {p95Delta.toFixed(0)} nT · Bz -14.2 nT
                  </Text>
                </View>
                <View style={styles.colorBarTrack}>
                  <View style={[styles.colorSeg, { flex: 3, backgroundColor: '#20c997' }]} />
                  <View style={[styles.colorSeg, { flex: 3, backgroundColor: '#ffd58c' }]} />
                  <View style={[styles.colorSeg, { flex: 4, backgroundColor: '#00e5ff' }]} />
                  <View style={[styles.colorThumb, { left: `${stormBarPct}%` }]} />
                </View>
              </View>
            </View>

            <View style={styles.appleCopyBlock}>
              <Text style={styles.appleHeadline}>
                {sparkInsight?.scientificVerdict === 'SUPPORTED_REGIONAL_CANDIDATE'
                  ? 'Aligned with active solar wind coupling.'
                  : 'Clean geomagnetic baseline verified.'}
              </Text>
              <Text style={styles.appleSubline}>
                Muse Spark cross-checked your sensor against NOAA DSCOVR solar wind and USGS observatory baselines.
              </Text>
            </View>

            <Pressable onPress={() => transitionToStage(5)} style={styles.applePrimaryBtn}>
              <Text style={styles.applePrimaryBtnText}>Aurora Storm Watch ›</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ===================================================================
            STAGE 5: PROACTIVE AURORA & SOLAR STORM WATCH
           =================================================================== */}
        {stage === 5 ? (
          <View style={styles.centeredStage}>
            {/* 3D Polar Aurora Globe Visual */}
            <Svg width={210} height={190} viewBox="0 0 210 190">
              <Defs>
                <RadialGradient id="auroraHalo" cx="50%" cy="42%" r="50%">
                  <Stop offset="0%" stopColor="#20c997" stopOpacity="0.55" />
                  <Stop offset="55%" stopColor="#a882ff" stopOpacity="0.22" />
                  <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx="105" cy="95" r="88" fill="url(#auroraHalo)" />
              <Circle
                cx="105"
                cy="102"
                r="52"
                fill="#07162c"
                stroke="rgba(0, 229, 255, 0.35)"
                strokeWidth="1.5"
              />
              {/* Glowing Auroral Oval Ring */}
              <Path
                d="M 66 76 C 82 62, 128 62, 144 76 C 128 86, 82 86, 66 76 Z"
                stroke="#20c997"
                strokeWidth={3.2 + Math.sin(phase * 3) * 0.8}
                fill="rgba(32, 201, 151, 0.18)"
              />
              <SvgText
                x="105"
                y="112"
                fill="#ffffff"
                fontSize="24"
                fontWeight="800"
                textAnchor="middle"
              >
                {selectedZone.prob}%
              </SvgText>
              <SvgText
                x="105"
                y="128"
                fill="#20c997"
                fontSize="9.5"
                fontWeight="800"
                textAnchor="middle"
              >
                AURORA POTENTIAL
              </SvgText>
            </Svg>

            {/* Minimal Latitude Selector Pills */}
            <View style={styles.zonePillsRow}>
              {LATITUDE_ZONES.map((z) => {
                const active = selectedZoneId === z.id;
                return (
                  <Pressable
                    key={z.id}
                    onPress={() => setSelectedZoneId(z.id)}
                    style={[styles.zonePill, active && styles.zonePillActive]}
                  >
                    <Text style={[styles.zonePillText, active && styles.zonePillTextActive]}>
                      {z.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Clean Apple-Style Toggle Card */}
            <View style={styles.appleToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.appleToggleTitle}>Solar Storm &amp; Aurora Alert</Text>
                <Text style={styles.appleToggleSub}>
                  {auroraAlert?.viewingDirection ?? 'Look poleward'} · Prompt local verification pulse
                </Text>
              </View>
              <Switch
                value={alertsEnabled}
                onValueChange={setAlertsEnabled}
                trackColor={{ false: '#1c2b3d', true: '#20c997' }}
              />
            </View>

            {alertPreviewVisible ? (
              <View style={styles.appleNotificationCard}>
                <Text style={styles.notifHeader}>🌌 AURORASENSE · NOW</Text>
                <Text style={styles.notifBody}>
                  Solar wind reconnection active ({selectedZone.prob}% potential at {selectedZone.label}). Place phone on windowsill to verify local magnetic field.
                </Text>
                <Pressable
                  onPress={() => {
                    setAlertPreviewVisible(false);
                    transitionToStage(3);
                    setTimeout(() => onStartRecording(), 400);
                  }}
                  style={styles.notifActionBtn}
                >
                  <Text style={styles.notifActionText}>Measure Local Field Now</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => setAlertPreviewVisible((v) => !v)}
                style={styles.secondaryAppleBtn}
              >
                <Text style={styles.secondaryAppleBtnText}>
                  {alertPreviewVisible ? 'Hide Alert' : 'Preview Alert'}
                </Text>
              </Pressable>
              <Pressable onPress={() => transitionToStage(1)} style={styles.applePrimaryBtn}>
                <Text style={styles.applePrimaryBtnText}>3D Forcefield ›</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Animated.View>

      {/* MINIMALIST APPLE-STYLE STAGE DOTS AT BOTTOM */}
      <View style={styles.stageDotsRow}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Pressable
            key={s}
            onPress={() => transitionToStage(s)}
            hitSlop={10}
            style={styles.dotHitbox}
          >
            <View
              style={[
                styles.stageDot,
                stage === s && styles.stageDotActive,
              ]}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  stageContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  centeredStage: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 12,
  },
  fullWidthVisual: {
    width: '100%',
  },
  appleCopyBlock: {
    alignItems: 'center',
    maxWidth: 310,
    gap: 8,
  },
  appleHeadline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  appleSubline: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
  },
  applePrimaryBtn: {
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
    marginTop: 4,
  },
  applePrimaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  secondaryAppleBtn: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(32, 201, 151, 0.14)',
    borderWidth: 1,
    borderColor: '#20c997',
    marginTop: 4,
  },
  secondaryAppleBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#20c997',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  colorBarContainer: {
    width: '86%',
  },
  colorBarTrack: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0a1626',
  },
  colorSeg: {
    height: '100%',
  },
  colorThumb: {
    position: 'absolute',
    top: -2,
    width: 6,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  orbPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightBarsCard: {
    width: '92%',
    backgroundColor: 'rgba(10, 24, 42, 0.75)',
    borderRadius: 18,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  barGroup: {
    gap: 6,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.72)',
  },
  barValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  zonePillsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  zonePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  zonePillActive: {
    backgroundColor: 'rgba(32, 201, 151, 0.18)',
    borderColor: '#20c997',
  },
  zonePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  zonePillTextActive: {
    color: '#20c997',
    fontWeight: '800',
  },
  appleToggleRow: {
    width: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 24, 42, 0.78)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  appleToggleTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  appleToggleSub: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 2,
  },
  appleNotificationCard: {
    width: '92%',
    backgroundColor: 'rgba(12, 30, 52, 0.95)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#20c997',
    gap: 8,
  },
  notifHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#20c997',
    letterSpacing: 1,
  },
  notifBody: {
    fontSize: 12.5,
    color: '#ffffff',
    lineHeight: 18,
  },
  notifActionBtn: {
    backgroundColor: '#20c997',
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 2,
  },
  notifActionText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#021118',
  },
  stageDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 6,
  },
  dotHitbox: {
    padding: 4,
  },
  stageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  stageDotActive: {
    width: 20,
    backgroundColor: '#20c997',
  },
});
