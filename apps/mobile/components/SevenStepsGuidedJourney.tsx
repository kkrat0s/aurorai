import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
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
  classifyMagneticDisturbance,
  type DisturbanceClassificationResult,
} from '@aurorasense/shared/magnetic-classifier';
import { type SensorQcResult, type SensorSession } from '@aurorasense/shared/sensor';
import { AuroraEvidencePanel } from './AuroraEvidencePanel';
import { CaptureEvidenceAnalysis } from './CaptureEvidenceAnalysis';
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
  soundMuted: boolean;
  onToggleSound: () => void;
  onCalibrate: () => void;
  targetDurationSec: ScanDurationOption;
  onChangeTargetDurationSec: (sec: ScanDurationOption) => void;
  adultConfirmed: boolean;
  onChangeAdult: (value: boolean) => void;
  recordingConsent: boolean;
  onChangeConsent: (value: boolean) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  isRecording: boolean;
  recordingElapsed: number;
  onExportSession: (format: 'json' | 'csv' | 'qc') => void;
  onDeleteSession: () => void;
  dataBusy: boolean;
  statusMessage: string;
  onUploadToDatabase: () => void;
  uploadStatus: string | null;
  isUploading: boolean;
}

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
  soundMuted,
  onToggleSound,
  onCalibrate,
  targetDurationSec,
  onChangeTargetDurationSec,
  adultConfirmed,
  onChangeAdult,
  recordingConsent,
  onChangeConsent,
  onStartRecording,
  onStopRecording,
  isRecording,
  recordingElapsed,
  onExportSession,
  onDeleteSession,
  dataBusy,
  statusMessage,
  onUploadToDatabase,
  uploadStatus,
  isUploading,
}: SevenStepsGuidedJourneyProps) {
  // Clamp active stage to 1..5
  const stage = Math.min(5, Math.max(1, currentStep));

  const stageOpacity = useRef(new Animated.Value(1)).current;
  const stageSlideY = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState(0);

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

  const liveMag = mag ?? 0;
  const liveDeltaNt = (delta ?? 0) * 1000;
  const bx = vector?.x ?? 0;
  const by = vector?.y ?? 0;
  const bz = vector?.z ?? 0;
  const fallbackClass = classification ?? classifyMagneticDisturbance([], Number.NaN);

  // Placement checklist score; not a probability or verified quietness
  const humanClear = Boolean(classification?.trainable) && !isScreenTouched && fallbackClass.predictedClass !== 'HUMAN_HAND_GESTURE';
  const magnetClear =
    fallbackClass.predictedClass !== 'SMARTWATCH_OR_MAGNET' &&
    fallbackClass.predictedClass !== 'STRUCTURAL_METALLIC_MASS' &&
    liveMag >= 22 &&
    liveMag <= 68;
  const powerClear =
    classification?.context?.batteryState === 'UNPLUGGED' && !isCharging &&
    fallbackClass.predictedClass !== 'CHARGING_CABLE_INDUCTION' &&
    fallbackClass.predictedClass !== 'LAPTOP_OR_COMPUTER';
  const motionClear = Boolean(classification?.trainable) && motionAnalysis.isStandstill;

  const spotScore =
    (humanClear ? 25 : 5) +
    (magnetClear ? 25 : 0) +
    (powerClear ? 25 : 5) +
    (motionClear ? 25 : 0);

  const spotColor = spotScore >= 85 ? '#20c997' : spotScore >= 55 ? '#ffd58c' : '#ff6b6b';

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
                hasMeasurement={mag !== null}
                deltaNt={liveDeltaNt}
                bx={bx}
                by={by}
                bz={bz}
                classification={fallbackClass}
                isMuted={soundMuted}
                onToggleMute={onToggleSound}
                onZeroBaseline={onCalibrate}
                isScreenTouched={isScreenTouched}
              />
            </View>

            <View style={styles.appleCopyBlock}>
              <Text style={styles.appleHeadline}>Explore local magnetic patterns.</Text>
              <Text style={styles.appleSubline}>
                Bring one item near the stationary phone. It will make one cautious guess—or admit it is stumped.
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
            <View style={styles.spotDial} accessibilityLabel={`Placement checklist ${spotScore} out of 100`}>
            <Svg width="100%" height="100%" viewBox="0 0 220 220">
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
            </Svg>
            <View pointerEvents="none" style={styles.spotScoreOverlay}>
              <View style={styles.spotScoreContent}>
                <Text style={styles.spotScoreValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} maxFontSizeMultiplier={1.2}>{spotScore}</Text>
                <Text style={styles.spotScoreDenominator} numberOfLines={1} maxFontSizeMultiplier={1.2}>/ 100</Text>
              </View>
            </View>
            </View>

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
                  ? 'Placement checklist completed.'
                  : 'Seek a quiet magnetic window.'}
              </Text>
              <Text style={styles.appleSubline}>
                {spotScore >= 85
                  ? 'No checklist warning detected. A full baseline is still required; nearby objects are not independently verified.'
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
            STAGE 3: EXPLICIT CONSENT AND LOCAL FOREGROUND RECORDING
           =================================================================== */}
        {stage === 3 ? (
          <ScrollView style={{flex:1}} contentContainerStyle={[styles.centeredStage,{paddingVertical:12,flexGrow:1}]}>
            <View style={styles.consentPanel}>
              <Text style={styles.consentTitle}>Your recording, your choice</Text>
              <Pressable accessibilityRole="checkbox" accessibilityState={{checked:adultConfirmed}} onPress={()=>onChangeAdult(!adultConfirmed)} style={styles.consentRow}>
                <Text style={[styles.consentBox,adultConfirmed&&styles.consentBoxChecked]}>{adultConfirmed?'✓':''}</Text>
                <Text style={styles.consentLabel}>I confirm I am 18 or older.</Text>
              </Pressable>
              <Pressable accessibilityRole="checkbox" accessibilityState={{checked:recordingConsent}} onPress={()=>onChangeConsent(!recordingConsent)} style={styles.consentRow}>
                <Text style={[styles.consentBox,recordingConsent&&styles.consentBoxChecked]}>{recordingConsent?'✓':''}</Text>
                <Text style={styles.consentLabel}>I consent to a foreground recording saved privately on this phone.</Text>
              </Pressable>
              <Text style={styles.consentNote}>Live preview is temporary. Saving starts only when you tap Record. Stop, backgrounding, or withdrawing consent ends recording. Upload requires a separate Sync action.</Text>
              {!adultConfirmed||!recordingConsent?<Text accessibilityLiveRegion="polite" style={styles.consentNotice}>Confirm both choices to enable recording.</Text>:null}
            </View>
            <View style={styles.actionRow}>{([30,120,600] as const).map(seconds=><Pressable key={seconds} disabled={isRecording} onPress={()=>onChangeTargetDurationSec(seconds)} style={[styles.secondaryAppleBtn,{borderColor:targetDurationSec===seconds?'#68edc3':'#163354'}]}><Text style={styles.secondaryAppleBtnText}>{seconds<60?`${seconds}s`:`${seconds/60}m`}</Text></Pressable>)}</View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isRecording?'Stop recording':'Start foreground local recording'}
              disabled={!isRecording&&(!adultConfirmed||!recordingConsent)}
              onPress={isRecording ? onStopRecording : onStartRecording}
              style={[styles.orbPressable,{opacity:!isRecording&&(!adultConfirmed||!recordingConsent)?0.5:1}]}
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
                    : 'Tap to Record'}
                </SvgText>
                <SvgText
                  x="115"
                  y="138"
                  fill="#20c997"
                  fontSize="11.5"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {isRecording ? 'LISTENING TO EARTH' : mag === null ? 'No reading' : `${liveMag.toFixed(1)} µT`}
                </SvgText>
              </Svg>
            </Pressable>

            <View style={styles.appleCopyBlock}>
              <Text style={styles.appleHeadline}>
                {isRecording
                  ? 'Sensing Earth’s magnetic field…'
                  : isUploading
                    ? 'Checking private upload availability…'
                    : 'Capture a stationary pulse.'}
              </Text>
              <Text style={styles.appleSubline}>
                {isRecording
                  ? 'Keep the phone still. Recording stays local and stops when the app backgrounds.'
                  : uploadStatus
                    ? uploadStatus
                    : '30 seconds checks acquisition. Two minutes establishes a baseline; ten minutes supports reference comparison.'}
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
                <Text style={styles.applePrimaryBtnText}>View Evidence Analysis ›</Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : null}

        {/* ===================================================================
            STAGE 4: CAPTURE-BOUND SCIENTIFIC EVIDENCE ANALYSIS
           =================================================================== */}
        {stage === 4 ? (
          <ScrollView style={{flex:1}} contentContainerStyle={[styles.centeredStage,{paddingVertical:12,flexGrow:1}]}>
            <CaptureEvidenceAnalysis session={session} qc={qc} />
            <View style={styles.consentPanel}>
              <Text style={styles.consentTitle}>Your local recording</Text>
              <Text style={styles.consentNote}>{session?`${session.samples.length} samples · ${isRecording?'recording in progress':'local session available'}`:'No readable recording is loaded. A retained file can still be deleted below.'}</Text>
              <View style={[styles.actionRow,{flexWrap:'wrap'}]}>
                {(['json','csv','qc'] as const).map(format=><Pressable key={format} accessibilityRole="button" disabled={!session||isRecording||dataBusy} onPress={()=>onExportSession(format)} style={[styles.secondaryAppleBtn,{opacity:!session||isRecording||dataBusy?0.45:1}]}><Text style={styles.secondaryAppleBtnText}>{format==='qc'?'Export QC':`Export ${format.toUpperCase()}`}</Text></Pressable>)}
                <Pressable accessibilityRole="button" disabled={isRecording||dataBusy} onPress={onDeleteSession} style={[styles.secondaryAppleBtn,{borderColor:'#ff8c8c',opacity:isRecording||dataBusy?0.45:1}]}><Text style={[styles.secondaryAppleBtnText,{color:'#ffaaaa'}]}>Delete local recording</Text></Pressable>
              </View>
              <Text accessibilityLiveRegion="polite" style={styles.consentNote}>{statusMessage}</Text>
              <Pressable accessibilityRole="button" onPress={()=>transitionToStage(3)} style={styles.secondaryAppleBtn}><Text style={styles.secondaryAppleBtnText}>Back to recording</Text></Pressable>
            </View>
            <Pressable onPress={() => transitionToStage(5)} style={styles.applePrimaryBtn}>
              <Text style={styles.applePrimaryBtnText}>Local Aurora Evidence ›</Text>
            </Pressable>
          </ScrollView>
        ) : null}
        {stage === 5 ? (
          <View style={styles.centeredStage}>
            <AuroraEvidencePanel />
            <Pressable onPress={() => transitionToStage(1)} style={styles.applePrimaryBtn}>
              <Text style={styles.applePrimaryBtnText}>3D Forcefield ›</Text>
            </Pressable>
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
  consentPanel:{width:'100%',maxWidth:440,padding:14,borderWidth:1,borderColor:'#26435e',borderRadius:14,backgroundColor:'#0a192b',gap:10},
  consentTitle:{color:'#eff7ff',fontWeight:'700',fontSize:15},
  consentRow:{flexDirection:'row',alignItems:'center',gap:10,minHeight:44},
  consentBox:{width:25,height:25,borderWidth:1,borderColor:'#8ea8c4',borderRadius:5,textAlign:'center',textAlignVertical:'center',color:'#04101a',fontWeight:'800',fontSize:18},
  consentBoxChecked:{backgroundColor:'#68edc3',borderColor:'#68edc3'},
  consentLabel:{flex:1,color:'#eff7ff',fontSize:14,lineHeight:20},
  consentNote:{color:'#aebdce',fontSize:12,lineHeight:17},
  consentNotice:{color:'#ffd58c',fontSize:13,lineHeight:18},
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
  spotDial: {
    width: 220,
    maxWidth: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  spotScoreOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotScoreContent: {
    width: '43%',
    height: '43%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotScoreValue: {
    width: '100%',
    color: '#ffffff',
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    includeFontPadding: false,
  },
  spotScoreDenominator: {
    color: '#aebdce',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    includeFontPadding: false,
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
