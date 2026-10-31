import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { type DisturbanceClassificationResult } from '@aurorasense/shared/magnetic-classifier';
import { type PrescriptiveSessionReport } from '@aurorasense/shared/prescriptive-evaluator';
import { type MotionAnalysis } from '../motion-detector';
import { type BloomNote } from '../audio-synthesizer';

interface GroundTruthScreenProps {
  mag: number | null;
  delta: number | null;
  vector: { x: number; y: number; z: number } | null;
  motionAnalysis: MotionAnalysis;
  classification: DisturbanceClassificationResult | null;
  prescriptiveReport: PrescriptiveSessionReport | null;
  soundMuted: boolean;
  onToggleSound: () => void;
  calibrating: boolean;
  onCalibrate: () => void;
  isRecording: boolean;
  recordingElapsed: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onOpenStationaryModal?: () => void;
  hasRecordedSession: boolean;
  onUploadDatabase: () => void;
  isUploading: boolean;
  uploadStatus: string | null;
}

const colors = {
  background: '#040d1a',
  panel: '#0a192b',
  card: '#0c1d33',
  ink: '#eff7ff',
  muted: '#8ea8c4',
  mint: '#20c997',
  cyan: '#00e5ff',
  violet: '#a855f7',
  blue: '#38bdf8',
  amber: '#ffd58c',
  red: '#ff5252',
  border: '#163354',
};

const SUB_TABS = ['My Sensor', 'Nearby Devices', 'Reference Station'] as const;

export function GroundTruthScreen({
  mag,
  delta,
  vector,
  motionAnalysis,
  classification,
  prescriptiveReport,
  soundMuted,
  onToggleSound,
  calibrating,
  onCalibrate,
  isRecording,
  recordingElapsed,
  onStartRecording,
  onStopRecording,
  hasRecordedSession,
  onUploadDatabase,
  isUploading,
  uploadStatus,
}: GroundTruthScreenProps) {
  const [activeSubTab, setActiveSubTab] = useState<'My Sensor' | 'Nearby Devices' | 'Reference Station'>('My Sensor');

  const xVal = vector?.x ?? -19.92;
  const yVal = vector?.y ?? -38.26;
  const zVal = vector?.z ?? 15.65;

  const isInterference =
    !motionAnalysis.isStandstill ||
    classification?.predictedClass === 'HUMAN_HAND_GESTURE' ||
    classification?.predictedClass === 'LAPTOP_OR_COMPUTER' ||
    classification?.predictedClass === 'CHARGING_CABLE_INDUCTION' ||
    classification?.predictedClass === 'SMARTWATCH_OR_MAGNET';

  const noiseMad = prescriptiveReport?.placementQuality.noiseMadNt ?? 62.0;
  const p95Delta = prescriptiveReport?.activityLevel.p95DeltaNt ?? 432.5;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* SCREEN SUBTITLE */}
      <View style={styles.headerTitleBox}>
        <Text style={styles.screenNumber}>3. Ground Truth</Text>
        <Text style={styles.screenSubtitle}>Live measurements from your device and the network</Text>
      </View>

      {/* SUB-TABS: [ My Sensor ] [ Nearby Devices ] [ Reference Station ] */}
      <View style={styles.subTabsRow}>
        {SUB_TABS.map((tab) => {
          const active = activeSubTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveSubTab(tab)}
              style={[styles.subTabButton, active && styles.subTabButtonActive]}
            >
              <Text style={[styles.subTabText, active && styles.subTabTextActive]}>{tab}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* CARD 1: YOUR PHONE MAGNETOMETER (STATIONARY READING) */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Your phone magnetometer (stationary reading) ℹ️</Text>
          <View style={styles.headerMiniActions}>
            <Pressable onPress={onToggleSound} style={styles.miniBtn}>
              <Text style={styles.miniBtnText}>{soundMuted ? '🔇' : '🔊'}</Text>
            </Pressable>
            <Pressable onPress={onCalibrate} style={styles.miniBtn}>
              <Text style={[styles.miniBtnText, { color: colors.mint }]}>
                {calibrating ? '…' : '↺ ZERO'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 3-AXIS NUMERICAL HEADERS */}
        <View style={styles.axesRow}>
          <View style={styles.axisItem}>
            <Text style={[styles.axisLabel, { color: colors.blue }]}>X</Text>
            <Text style={styles.axisVal}>{xVal.toFixed(1)} µT</Text>
          </View>
          <View style={styles.axisItem}>
            <Text style={[styles.axisLabel, { color: colors.mint }]}>Y</Text>
            <Text style={styles.axisVal}>{yVal.toFixed(1)} µT</Text>
          </View>
          <View style={styles.axisItem}>
            <Text style={[styles.axisLabel, { color: colors.violet }]}>Z</Text>
            <Text style={styles.axisVal}>{zVal.toFixed(1)} µT</Text>
          </View>
        </View>

        {/* 3-AXIS TIME SERIES CHART (DEVICE FRAME nT) */}
        <View style={styles.chartWrapper}>
          <Svg width="100%" height={110} viewBox="0 0 320 110">
            {/* Horizontal Grid lines */}
            <Line x1="30" y1="20" x2="310" y2="20" stroke="#163354" strokeWidth="0.8" strokeDasharray="3,3" />
            <Line x1="30" y1="55" x2="310" y2="55" stroke="#1c436e" strokeWidth="1" />
            <Line x1="30" y1="90" x2="310" y2="90" stroke="#163354" strokeWidth="0.8" strokeDasharray="3,3" />

            {/* Y-axis Ticks */}
            <SvgText x="6" y="23" fill="#698cae" fontSize="8" fontWeight="bold">80</SvgText>
            <SvgText x="10" y="58" fill="#698cae" fontSize="8" fontWeight="bold">0</SvgText>
            <SvgText x="2" y="93" fill="#698cae" fontSize="8" fontWeight="bold">-80</SvgText>

            {/* X Axis Curve (Blue) */}
            <Path
              d="M 30 55 Q 80 50, 130 52 T 210 50 T 270 45 T 310 56"
              stroke={colors.blue}
              strokeWidth="1.8"
              fill="none"
            />
            {/* Y Axis Curve (Mint) */}
            <Path
              d="M 30 57 Q 70 65, 110 63 T 190 62 T 260 70 T 310 60"
              stroke={colors.mint}
              strokeWidth="1.8"
              fill="none"
            />
            {/* Z Axis Curve (Violet) */}
            <Path
              d="M 30 55 C 80 40, 140 38, 200 42 C 240 45, 270 25, 290 35 L 310 52"
              stroke={colors.violet}
              strokeWidth="2"
              fill="none"
            />

            {/* Bottom Time Ticks */}
            <SvgText x="30" y="106" fill="#698cae" fontSize="7.5">10:00</SvgText>
            <SvgText x="95" y="106" fill="#698cae" fontSize="7.5">10:02</SvgText>
            <SvgText x="160" y="106" fill="#698cae" fontSize="7.5">10:04</SvgText>
            <SvgText x="225" y="106" fill="#698cae" fontSize="7.5">10:06</SvgText>
            <SvgText x="285" y="106" fill="#698cae" fontSize="7.5">10:10</SvgText>
          </Svg>
        </View>

        {/* CHART LEGEND */}
        <View style={styles.chartLegendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendBar, { backgroundColor: colors.blue }]} />
            <Text style={styles.legendText}>X (North-South)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBar, { backgroundColor: colors.mint }]} />
            <Text style={styles.legendText}>Y (East-West)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBar, { backgroundColor: colors.violet }]} />
            <Text style={styles.legendText}>Z (Vertical)</Text>
          </View>
        </View>
      </View>

      {/* CARD 2: REGIONAL COMPARISON (DETRENDED) */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Regional comparison (detrended) ℹ️</Text>
        </View>

        {/* COMPARISON CHART */}
        <View style={styles.chartWrapper}>
          <Svg width="100%" height={105} viewBox="0 0 320 105">
            <Line x1="30" y1="18" x2="310" y2="18" stroke="#163354" strokeWidth="0.8" strokeDasharray="3,3" />
            <Line x1="30" y1="52" x2="310" y2="52" stroke="#1c436e" strokeWidth="1" />
            <Line x1="30" y1="86" x2="310" y2="86" stroke="#163354" strokeWidth="0.8" strokeDasharray="3,3" />

            <SvgText x="2" y="21" fill="#698cae" fontSize="8" fontWeight="bold">100</SvgText>
            <SvgText x="10" y="55" fill="#698cae" fontSize="8" fontWeight="bold">0</SvgText>
            <SvgText x="0" y="89" fill="#698cae" fontSize="8" fontWeight="bold">-100</SvgText>

            {/* Reference Station (Black/Dark) */}
            <Path
              d="M 30 52 Q 90 55, 140 48 T 230 46 T 280 38 T 310 50"
              stroke="#8ba2ba"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="2,2"
            />
            {/* Nearby Community Average (Cyan with dots) */}
            <Path
              d="M 30 53 Q 90 58, 140 50 T 230 42 T 275 32 T 310 53"
              stroke={colors.cyan}
              strokeWidth="2"
              fill="none"
            />
            {/* Your Device Filtered (Violet) */}
            <Path
              d="M 30 52 C 90 60, 150 45, 210 40 C 250 35, 275 22, 290 38 L 310 54"
              stroke={colors.violet}
              strokeWidth="2.5"
              fill="none"
            />

            <SvgText x="30" y="100" fill="#698cae" fontSize="7.5">10:00</SvgText>
            <SvgText x="95" y="100" fill="#698cae" fontSize="7.5">10:02</SvgText>
            <SvgText x="160" y="100" fill="#698cae" fontSize="7.5">10:04</SvgText>
            <SvgText x="225" y="100" fill="#698cae" fontSize="7.5">10:06</SvgText>
            <SvgText x="285" y="100" fill="#698cae" fontSize="7.5">10:10</SvgText>
          </Svg>
        </View>

        {/* COMPARISON LEGEND */}
        <View style={styles.chartLegendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendBar, { backgroundColor: colors.violet }]} />
            <Text style={styles.legendText}>Your device (filtered)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBar, { backgroundColor: colors.cyan }]} />
            <Text style={styles.legendText}>Nearby community average</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBar, { backgroundColor: '#8ba2ba' }]} />
            <Text style={styles.legendText}>Reference station (BOU)</Text>
          </View>
        </View>
      </View>

      {/* CARD 3: LOCAL INTERFERENCE / SESSION QUALITY */}
      {isInterference ? (
        <View style={styles.interferenceCard}>
          <View style={styles.interferenceHeader}>
            <Text style={styles.interferenceWarnIcon}>⚠️</Text>
            <View style={styles.interferenceTextBox}>
              <Text style={styles.interferenceTitle}>Local interference detected (excluded)</Text>
              <Text style={styles.interferenceSub}>
                A short spike likely from nearby device or movement.
              </Text>
            </View>
          </View>
          {/* Mini Sparkline showing rejected spike */}
          <View style={styles.miniSparklineWrapper}>
            <Svg width="100%" height={26} viewBox="0 0 280 26">
              <Path
                d="M 10 18 L 80 17 L 120 18 L 140 4 L 155 24 L 170 17 L 270 18"
                stroke="#ff5252"
                strokeWidth="1.8"
                fill="none"
              />
            </Svg>
          </View>
        </View>
      ) : (
        <View style={styles.qualityCard}>
          <View style={styles.qualityHeader}>
            <Text style={styles.qualityTitle}>Session quality</Text>
            <View style={styles.qualityBadge}>
              <Text style={styles.qualityBadgeText}>Good</Text>
            </View>
          </View>
          <View style={styles.qualityChecklist}>
            <View style={styles.checkItem}>
              <Text style={styles.checkIcon}>✅</Text>
              <Text style={styles.checkText}>Device stable</Text>
            </View>
            <View style={styles.checkItem}>
              <Text style={styles.checkIcon}>✅</Text>
              <Text style={styles.checkText}>Low motion</Text>
            </View>
            <View style={styles.checkItem}>
              <Text style={styles.checkIcon}>✅</Text>
              <Text style={styles.checkText}>Usable data</Text>
            </View>
          </View>
        </View>
      )}

      {/* CARD 4: WHAT YOUR PHONE RECORDING MEANS (PRESCRIPTIVE GAUGES) */}
      <View style={styles.card}>
        <Text style={styles.prescriptiveTitle}>What Your Phone Recording Means</Text>

        {/* 1. Placement Quietness */}
        <View style={styles.prescriptiveGaugeBlock}>
          <View style={styles.gaugeLabelRow}>
            <Text style={styles.gaugeName}>1. Sensor Placement Quietness:</Text>
            <Text style={styles.gaugeScore}>🟢 Excellent Placement</Text>
          </View>
          <View style={styles.gaugeTrack}>
            <View style={[styles.gaugeFill, { width: '88%', backgroundColor: colors.mint }]} />
          </View>
          <Text style={styles.gaugeFootnote}>
            Noise MAD: <Text style={styles.boldWhite}>{noiseMad.toFixed(1)} nT</Text> (Scientific Benchmark: &lt; 100 nT)
          </Text>
        </View>

        {/* 2. Space Weather Activity */}
        <View style={[styles.prescriptiveGaugeBlock, { marginTop: 8 }]}>
          <View style={styles.gaugeLabelRow}>
            <Text style={styles.gaugeName}>2. Space Weather Activity Level:</Text>
            <Text style={[styles.gaugeScore, { color: colors.cyan }]}>🟠 G3–G4 Candidate</Text>
          </View>
          <View style={styles.gaugeTrack}>
            <View style={[styles.gaugeFill, { width: '78%', backgroundColor: colors.cyan }]} />
          </View>
          <Text style={styles.gaugeFootnote}>
            Sustained Excursion: <Text style={styles.boldWhite}>{p95Delta.toFixed(0)} nT</Text> (Extreme: 925 nT)
          </Text>
        </View>

        {/* Central Database Action */}
        {hasRecordedSession && (
          <Pressable
            disabled={isUploading}
            onPress={onUploadDatabase}
            style={[styles.uploadDbButton, isUploading && { opacity: 0.6 }]}
          >
            <Text style={styles.uploadDbButtonText}>
              {isUploading ? 'Archiving to Central Database...' : '📤 Send to Central Database'}
            </Text>
          </Pressable>
        )}
        {uploadStatus && (
          <Text style={styles.uploadStatusText}>{uploadStatus}</Text>
        )}
      </View>

      {/* BOTTOM BIG CTA: CONTRIBUTE 10-MIN STATIONARY READING */}
      <Pressable
        onPress={isRecording ? onStopRecording : onStartRecording}
        style={[styles.bigCtaButton, isRecording && { backgroundColor: '#b83232' }]}
      >
        <View style={styles.bigCtaIconBox}>
          <Text style={styles.bigCtaIcon}>{isRecording ? '■' : '((•))'}</Text>
        </View>
        <View style={styles.bigCtaTextBox}>
          <Text style={styles.bigCtaTitle}>
            {isRecording
              ? `Stop recording (${Math.floor((600 - recordingElapsed) / 60)}:${String((600 - recordingElapsed) % 60).padStart(2, '0')} left)`
              : 'Contribute 10-min stationary reading'}
          </Text>
          <Text style={styles.bigCtaSub}>
            {isRecording
              ? 'Recording stationary baseline. Do not move phone.'
              : 'Help improve forecasts with your data'}
          </Text>
        </View>
        <Text style={styles.bigCtaChevron}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  headerTitleBox: {
    marginBottom: 4,
  },
  screenNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 2,
  },
  subTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  subTabButtonActive: {
    backgroundColor: '#1b3f66',
    borderColor: colors.cyan,
  },
  subTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  subTabTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
    flex: 1,
  },
  headerMiniActions: {
    flexDirection: 'row',
    gap: 6,
  },
  miniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#071526',
    borderWidth: 1,
    borderColor: '#193f66',
  },
  miniBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.ink,
  },
  axesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  axisItem: {
    flex: 1,
    backgroundColor: '#051221',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  axisLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 2,
  },
  axisVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  chartWrapper: {
    width: '100%',
    marginVertical: 4,
  },
  chartLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#10253d',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendBar: {
    width: 12,
    height: 3,
    borderRadius: 1.5,
  },
  legendText: {
    fontSize: 10,
    color: colors.muted,
  },
  interferenceCard: {
    backgroundColor: '#261314',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#592020',
  },
  interferenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  interferenceWarnIcon: {
    fontSize: 18,
  },
  interferenceTextBox: {
    flex: 1,
  },
  interferenceTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.red,
  },
  interferenceSub: {
    fontSize: 10.5,
    color: '#e0a4a4',
    marginTop: 1,
  },
  miniSparklineWrapper: {
    marginTop: 6,
    alignItems: 'center',
  },
  qualityCard: {
    backgroundColor: '#071b26',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#154a43',
  },
  qualityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  qualityTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  qualityBadge: {
    backgroundColor: '#0d3b2e',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.mint,
  },
  qualityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.mint,
  },
  qualityChecklist: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkIcon: {
    fontSize: 11,
  },
  checkText: {
    fontSize: 10.5,
    color: colors.ink,
    fontWeight: '600',
  },
  prescriptiveTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 8,
  },
  prescriptiveGaugeBlock: {
    backgroundColor: '#051221',
    borderRadius: 8,
    padding: 10,
  },
  gaugeLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  gaugeName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  gaugeScore: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.mint,
  },
  gaugeTrack: {
    height: 6,
    backgroundColor: '#0a1d33',
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 4,
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 3,
  },
  gaugeFootnote: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
  },
  boldWhite: {
    fontWeight: '700',
    color: colors.ink,
  },
  uploadDbButton: {
    backgroundColor: '#16436e',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  uploadDbButtonText: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: '700',
  },
  uploadStatusText: {
    fontSize: 10.5,
    color: colors.mint,
    textAlign: 'center',
    marginTop: 6,
  },
  bigCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b2f8a',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#5d4eb8',
    gap: 12,
  },
  bigCtaIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#271f61',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigCtaIcon: {
    fontSize: 18,
    color: '#ffffff',
  },
  bigCtaTextBox: {
    flex: 1,
  },
  bigCtaTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  bigCtaSub: {
    fontSize: 11,
    color: '#c2bce8',
    marginTop: 2,
  },
  bigCtaChevron: {
    fontSize: 20,
    color: '#c2bce8',
    fontWeight: '300',
  },
});
