import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  type DisturbanceClassificationResult,
} from '@aurorasense/shared/magnetic-classifier';
import { type PrescriptiveSessionReport } from '@aurorasense/shared/prescriptive-evaluator';
import { type SensorQcResult, type SensorSession } from '@aurorasense/shared/sensor';
import { type MotionAnalysis } from '../motion-detector';
import { MagneticField3DView } from './MagneticField3DView';
import { SevenStepsGuidedJourney, type ScanDurationOption } from './SevenStepsGuidedJourney';

interface GroundTruthScreenProps {
  mag: number | null;
  delta: number | null;
  vector: { x: number; y: number; z: number } | null;
  motionAnalysis: MotionAnalysis;
  isScreenTouched: boolean;
  isCharging: boolean;
  classification: DisturbanceClassificationResult | null;
  session: SensorSession | null;
  qc: SensorQcResult | null;
  prescriptiveReport: PrescriptiveSessionReport | null;
  soundMuted: boolean;
  onToggleSound: () => void;
  calibrating: boolean;
  onCalibrate: () => void;
  adultConfirmed: boolean;
  onChangeAdult: (val: boolean) => void;
  recordingConsent: boolean;
  onChangeConsent: (val: boolean) => void;
  guidedProtocol: boolean;
  onChangeGuided: (val: boolean) => void;
  targetDurationSec: ScanDurationOption;
  onChangeTargetDurationSec: (sec: ScanDurationOption) => void;
  isRecording: boolean;
  recordingElapsed: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  hasRecordedSession: boolean;
  onUploadDatabase: () => void;
  isUploading: boolean;
  uploadStatus: string | null;
  onExportSession: (format: 'json' | 'csv' | 'qc') => void;
  onDeleteSession: () => void;
  dataBusy: boolean;
  statusMessage: string;
  currentStep: number;
  onSelectStep: (step: number) => void;
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
  isScreenTouched,
  isCharging,
  classification,
  session,
  qc,
  prescriptiveReport,
  soundMuted,
  onToggleSound,
  calibrating,
  onCalibrate,
  adultConfirmed,
  onChangeAdult,
  recordingConsent,
  onChangeConsent,
  guidedProtocol,
  onChangeGuided,
  targetDurationSec,
  onChangeTargetDurationSec,
  isRecording,
  recordingElapsed,
  onStartRecording,
  onStopRecording,
  hasRecordedSession,
  onUploadDatabase,
  isUploading,
  uploadStatus,
  onExportSession,
  onDeleteSession,
  dataBusy,
  statusMessage,
  currentStep,
  onSelectStep,
}: GroundTruthScreenProps) {
  const [viewMode, setViewMode] = useState<'wireframe' | 'journey'>('journey');
  const [activeSubTab, setActiveSubTab] = useState<'My Sensor' | 'Nearby Devices' | 'Reference Station'>('My Sensor');

  const xVal = vector?.x ?? session?.samples.at(-1)?.x ?? null;
  const yVal = vector?.y ?? session?.samples.at(-1)?.y ?? null;
  const zVal = vector?.z ?? session?.samples.at(-1)?.z ?? null;

  const isInterference =
    !motionAnalysis.isStandstill ||
    classification?.predictedClass === 'HUMAN_HAND_GESTURE' ||
    classification?.predictedClass === 'LAPTOP_OR_COMPUTER' ||
    classification?.predictedClass === 'CHARGING_CABLE_INDUCTION' ||
    classification?.predictedClass === 'SMARTWATCH_OR_MAGNET';

  const noiseMad = prescriptiveReport?.placementQuality.noiseMadNt ?? qc?.noiseMadNt ?? null;
  const p95Delta = prescriptiveReport?.activityLevel.p95DeltaNt ?? qc?.highWater[0]?.p95AbsoluteDeltaNt ?? null;

  if (viewMode === 'journey') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', paddingHorizontal: 14 }}>
        <SevenStepsGuidedJourney
          currentStep={currentStep}
          onSelectStep={onSelectStep}
          mag={mag}
          delta={delta}
          vector={vector}
          classification={classification}
          motionAnalysis={motionAnalysis}
          isScreenTouched={isScreenTouched}
          isCharging={isCharging}
          session={session}
          qc={qc}
          soundMuted={soundMuted}
          onToggleSound={onToggleSound}
          onCalibrate={onCalibrate}
          targetDurationSec={targetDurationSec}
          onChangeTargetDurationSec={onChangeTargetDurationSec}
          adultConfirmed={adultConfirmed}
          onChangeAdult={onChangeAdult}
          recordingConsent={recordingConsent}
          onChangeConsent={onChangeConsent}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
          isRecording={isRecording}
          recordingElapsed={recordingElapsed}
          onExportSession={onExportSession}
          onDeleteSession={onDeleteSession}
          dataBusy={dataBusy}
          statusMessage={statusMessage}
          onUploadToDatabase={onUploadDatabase}
          uploadStatus={uploadStatus}
          isUploading={isUploading}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <>
          {mag !== null && xVal !== null && yVal !== null && zVal !== null && classification ? (
            <MagneticField3DView currentMagMicroT={mag} deltaNt={(delta ?? 0) * 1000}
              bx={xVal} by={yVal} bz={zVal} classification={classification}
              isMuted={soundMuted} onToggleMute={onToggleSound} onZeroBaseline={onCalibrate} compact />
          ) : <Text style={styles.honestyNotice}>Waiting for real phone measurements and a valid classification window.</Text>}
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

          {/* CARD 1: YOUR PHONE MAGNETOMETER (DEVICE FRAME — NEVER GEOGRAPHIC N/E/Z) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                Your phone magnetometer (DEVICE frame · 1 µT = 1000 nT)
              </Text>
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

            {/* 3-AXIS DEVICE-FRAME NUMERICAL HEADERS */}
            <View style={styles.axesRow}>
              <View style={styles.axisItem}>
                <Text style={[styles.axisLabel, { color: colors.blue }]}>X · DEVICE</Text>
                <Text style={styles.axisVal}>{xVal?.toFixed(2) ?? '—'} µT</Text>
              </View>
              <View style={styles.axisItem}>
                <Text style={[styles.axisLabel, { color: colors.mint }]}>Y · DEVICE</Text>
                <Text style={styles.axisVal}>{yVal?.toFixed(2) ?? '—'} µT</Text>
              </View>
              <View style={styles.axisItem}>
                <Text style={[styles.axisLabel, { color: colors.violet }]}>Z · DEVICE</Text>
                <Text style={styles.axisVal}>{zVal?.toFixed(2) ?? '—'} µT</Text>
              </View>
            </View>

            <Text style={styles.honestyNotice}>Source: this phone · DEVICE axes in µT. Export the timestamped recording to inspect the measured series. No illustrative curve is presented as phone data.</Text>
          </View>

          {/* CARD 2: REGIONAL COMPARISON (DETRENDED SCALAR Δ|B| — HONEST PROVENANCE) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                Regional comparison · Scalar Δ|B| (Verdict: INCONCLUSIVE)
              </Text>
            </View>

            <Text style={styles.honestyNotice}>
              No verified synchronous regional comparison is loaded in this view. A single phone cannot establish regional disturbance. Use the professional-reference comparison in the main observation journey; historical archives are not co-temporal with a live session.
            </Text>
          </View>

          {/* CARD 3: LOCAL INTERFERENCE / SESSION QUALITY */}
          {isInterference ? (
            <View style={styles.interferenceCard}>
              <View style={styles.interferenceHeader}>
                <Text style={styles.interferenceWarnIcon}>⚠️</Text>
                <View style={styles.interferenceTextBox}>
                  <Text style={styles.interferenceTitle}>
                    Local interference / motion ({classification?.metadata.shortLabel ?? 'Active'})
                  </Text>
                  <Text style={styles.interferenceSub}>
                    The local matcher suggests possible interference. Deterministic QC determines usable samples; neither step establishes a physical source.
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.qualityCard}>
              <View style={styles.qualityHeader}>
                <Text style={styles.qualityTitle}>Local sensor screening quality</Text>
                <View style={styles.qualityBadge}>
                  <Text style={styles.qualityBadgeText}>
                    {qc ? (qc.accepted ? 'QC Accepted' : 'QC Flagged') : 'QC pending'}
                  </Text>
                </View>
              </View>
              <View style={styles.qualityChecklist}>
                <View style={styles.checkItem}>
                  <Text style={styles.checkIcon}>ℹ️</Text>
                  <Text style={styles.checkText}>{motionAnalysis.isStandstill ? 'Motion screen: stationary' : 'Motion context uncertain'}</Text>
                </View>
                <View style={styles.checkItem}>
                  <Text style={styles.checkIcon}>ℹ️</Text>
                  <Text style={styles.checkText}>{noiseMad === null ? 'Baseline noise unavailable' : `MAD ${noiseMad?.toFixed(1) ?? '—'} nT`}</Text>
                </View>
                <View style={styles.checkItem}>
                  <Text style={styles.checkIcon}>⚖️</Text>
                  <Text style={styles.checkText}>Regional: Inconclusive</Text>
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
                <Text style={styles.gaugeScore}>
                  {noiseMad === null ? 'Unavailable' : noiseMad < 100 ? '🟢 Excellent (<100 nT)' : noiseMad <= 250 ? '🟡 Fair (100–250 nT)' : '🟠 Noisy (>250 nT)'}
                </Text>
              </View>
              <View style={styles.gaugeTrack}>
                <View
                  style={[
                    styles.gaugeFill,
                    {
                      width: `${Math.max(12, Math.min(96, noiseMad === null ? 0 : 100 - (noiseMad / 300) * 100))}%`,
                      backgroundColor: noiseMad === null ? colors.muted : noiseMad < 100 ? colors.mint : noiseMad <= 250 ? colors.amber : colors.red,
                    },
                  ]}
                />
              </View>
              <Text style={styles.gaugeFootnote}>
                Baseline Noise MAD: <Text style={styles.boldWhite}>{noiseMad?.toFixed(1) ?? '—'} nT</Text> (QC limit: 250 nT)
              </Text>
            </View>

            {/* 2. Excursion Amplitude */}
            <View style={[styles.prescriptiveGaugeBlock, { marginTop: 8 }]}>
              <View style={styles.gaugeLabelRow}>
                <Text style={styles.gaugeName}>2. Local Excursion Amplitude:</Text>
                <Text style={[styles.gaugeScore, { color: colors.cyan }]}>
                  {p95Delta === null ? 'Unavailable' : p95Delta >= 200 ? '🟠 Candidate Excursion' : '🟢 Quiet Baseline'}
                </Text>
              </View>
              <View style={styles.gaugeTrack}>
                <View
                  style={[
                    styles.gaugeFill,
                    {
                      width: `${Math.min(95, Math.max(8, p95Delta === null ? 0 : (p95Delta / 600) * 100))}%`,
                      backgroundColor: colors.cyan,
                    },
                  ]}
                />
              </View>
              <Text style={styles.gaugeFootnote}>
                95% Excursion Δ|B|: <Text style={styles.boldWhite}>{p95Delta?.toFixed(0) ?? '—'} nT</Text> · Single-site regional verdict: <Text style={styles.boldWhite}>INCONCLUSIVE</Text>
              </Text>
            </View>
          </View>

          {/* CARD 5: CONSENT, FOREGROUND PROTOCOL & PRIVATE EXPORT / DELETE CONTROLS */}
          <View style={styles.card}>
            <Text style={styles.prescriptiveTitle}>Participation Consent &amp; Private Data Controls</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>I confirm I am an adult (18+)</Text>
              <Switch
                value={adultConfirmed}
                onValueChange={onChangeAdult}
                trackColor={{ false: '#1e334a', true: colors.mint }}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                Explicit foreground sensor recording consent (stops on backgrounding)
              </Text>
              <Switch
                value={recordingConsent}
                onValueChange={onChangeConsent}
                trackColor={{ false: '#1e334a', true: colors.mint }}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>
                Guided local interference experiment cues (scheduled markers)
              </Text>
              <Switch
                value={guidedProtocol}
                onValueChange={onChangeGuided}
                trackColor={{ false: '#1e334a', true: colors.violet }}
              />
            </View>

            <Text style={styles.statusBannerText}>{statusMessage}</Text>

            {hasRecordedSession && (
              <View style={styles.exportActionsGrid}>
                <Pressable onPress={() => onExportSession('json')} style={styles.exportBtn}>
                  <Text style={styles.exportBtnText}>Export JSON</Text>
                </Pressable>
                <Pressable onPress={() => onExportSession('csv')} style={styles.exportBtn}>
                  <Text style={styles.exportBtnText}>Export CSV</Text>
                </Pressable>
                <Pressable onPress={() => onExportSession('qc')} style={styles.exportBtn}>
                  <Text style={styles.exportBtnText}>Export QC</Text>
                </Pressable>
                <Pressable
                  disabled={isUploading}
                  onPress={onUploadDatabase}
                  style={[styles.exportBtn, { borderColor: colors.cyan }]}
                >
                  <Text style={[styles.exportBtnText, { color: colors.cyan }]}>
                    {isUploading ? 'Sending...' : 'Send to DB'}
                  </Text>
                </Pressable>
                <Pressable onPress={onDeleteSession} style={[styles.exportBtn, styles.deleteBtn]}>
                  <Text style={[styles.exportBtnText, { color: '#ff8a8a' }]}>Delete Local</Text>
                </Pressable>
              </View>
            )}
            {uploadStatus && <Text style={styles.uploadStatusText}>{uploadStatus}</Text>}
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
                  ? 'Foreground recording active. Keep phone flat and motionless.'
                  : 'Requires 18+ & foreground consent · Stops automatically on backgrounding'}
              </Text>
            </View>
            <Text style={styles.bigCtaChevron}>›</Text>
          </Pressable>
      </>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerTitleBox: {
    flex: 1,
  },
  screenNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  provenanceBadge: {
    backgroundColor: '#12243d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#234775',
  },
  provenanceBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.mint,
    letterSpacing: 0.4,
  },
  viewSwitcherRow: {
    flexDirection: 'row',
    gap: 8,
  },
  viewSwitchBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  viewSwitchBtnActive: {
    backgroundColor: '#17385c',
    borderColor: colors.mint,
  },
  viewSwitchText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  viewSwitchTextActive: {
    color: colors.ink,
    fontWeight: '800',
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
    gap: 6,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
    flex: 1,
  },
  honestyNotice: {
    fontSize: 10.5,
    color: colors.muted,
    lineHeight: 15,
    marginBottom: 6,
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
    gap: 10,
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
    fontSize: 9.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  axisVal: {
    fontSize: 13.5,
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
    flexWrap: 'wrap',
    gap: 12,
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
    fontSize: 9.5,
    color: colors.muted,
    fontWeight: '600',
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
    fontSize: 10,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#10253d',
    gap: 10,
  },
  switchLabel: {
    flex: 1,
    fontSize: 11.5,
    color: colors.ink,
    lineHeight: 16,
  },
  statusBannerText: {
    fontSize: 11,
    color: colors.amber,
    marginTop: 8,
    lineHeight: 16,
  },
  exportActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  exportBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#071628',
    borderWidth: 1,
    borderColor: '#1f426b',
  },
  deleteBtn: {
    backgroundColor: '#2a1215',
    borderColor: '#66242b',
  },
  exportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
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
