import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  UNIVERSAL_FINGERPRINT_DATABASE,
  createUserLearnedFingerprint,
  SPACE_WEATHER_GROUND_SCALES,
  GRANITE_WINDOWSILL_PHYSICS,
  type DisturbanceClassId,
  type DisturbanceClassificationResult,
  type LearnedUserFingerprint,
} from '@aurorasense/shared/magnetic-classifier';

interface AiObjectLearningCardProps {
  classification: DisturbanceClassificationResult | null;
  userFingerprints: LearnedUserFingerprint[];
  onAddFingerprint: (fingerprint: LearnedUserFingerprint) => void;
  onClearFingerprints: () => void;
}

export function AiObjectLearningCard({
  classification,
  userFingerprints,
  onAddFingerprint,
  onClearFingerprints,
}: AiObjectLearningCardProps) {
  const [teachModalOpen, setTeachModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [scienceModalOpen, setScienceModalOpen] = useState(false);
  const [selectedCorrectionClass, setSelectedCorrectionClass] = useState<DisturbanceClassId | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  if (!classification) return null;

  const { metadata, confidence, signature, solarStormSignalRatio, aiReasoning, fingerprintHash } =
    classification;

  // Handle User Confirmation: "Yes, Correct!"
  function handleConfirmCorrect() {
    if (!classification) return;
    const fp = createUserLearnedFingerprint(classification, classification.predictedClass);
    onAddFingerprint(fp);
    setFeedbackBanner(`✨ Learned! Fingerprint #${fingerprintHash} confirmed for ${metadata.shortLabel}.`);
    setTimeout(() => setFeedbackBanner(null), 4000);
  }

  // Handle User Teaching / Correction
  function handleTeachSubmit(classId: DisturbanceClassId) {
    if (!classification) return;
    const label = customLabel.trim() || UNIVERSAL_FINGERPRINT_DATABASE[classId].name;
    const fp = createUserLearnedFingerprint(classification, classId, label);
    onAddFingerprint(fp);
    setTeachModalOpen(false);
    setSelectedCorrectionClass(null);
    setCustomLabel('');
    setFeedbackBanner(`🧠 Calibrated! AI learned to recognize '${label}' from this vector profile.`);
    setTimeout(() => setFeedbackBanner(null), 4500);
  }

  return (
    <>
      <View style={[styles.card, { borderColor: metadata.color }]}>
        {/* Top Header: AI Guess & Confidence */}
        <View style={styles.topRow}>
          <View style={styles.titleGroup}>
            <Text style={styles.icon}>{metadata.icon}</Text>
            <View>
              <Text style={styles.eyebrow}>AI OBJECT GUESS</Text>
              <Text style={[styles.title, { color: metadata.color }]}>{metadata.name}</Text>
            </View>
          </View>
          <View style={[styles.confidenceBadge, { backgroundColor: `${metadata.color}25` }]}>
            <Text style={[styles.confidenceText, { color: metadata.color }]}>
              {Math.round(confidence * 100)}% match
            </Text>
          </View>
        </View>

        {/* Dynamic Physics Reasoning: How the AI Guesstimates This */}
        <View style={styles.reasoningBox}>
          <Text style={styles.reasoningLabel}>💡 How AI Guesses This:</Text>
          <Text style={styles.reasoningText}>{aiReasoning}</Text>
        </View>

        {/* Multi-Axis Physical Metrics */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCell}>
            <Text style={styles.cellLabel}>Rate of Change (dB/dt)</Text>
            <Text style={styles.cellValue}>{signature.rateOfChangeMicroTPerSec.toFixed(1)} µT/s</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.cellLabel}>Axis Polarization</Text>
            <Text style={styles.cellValue}>{(signature.polarizationRatio * 100).toFixed(0)}%</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.cellLabel}>Switching Jitter</Text>
            <Text style={styles.cellValue}>{(signature.jitterRatio * 100).toFixed(0)}%</Text>
          </View>
          <View style={styles.metricCell}>
            <Text style={styles.cellLabel}>Solar Storm Ratio</Text>
            <Text style={[styles.cellValue, { color: solarStormSignalRatio > 10 ? '#ffd58c' : '#68edc3' }]}>
              {solarStormSignalRatio}x
            </Text>
          </View>
        </View>

        {/* Temporary Feedback Banner after teaching */}
        {feedbackBanner && (
          <View style={styles.feedbackBanner}>
            <Text style={styles.feedbackBannerText}>{feedbackBanner}</Text>
          </View>
        )}

        {/* Interactive Human-in-the-Loop Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={handleConfirmCorrect}
            style={[styles.confirmBtn, { backgroundColor: '#10392c', borderColor: '#20c997' }]}
          >
            <Text style={styles.confirmBtnText}>👍 Correct!</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setTeachModalOpen(true)}
            style={[styles.teachBtn, { borderColor: '#7c4dff', backgroundColor: '#21184a' }]}
          >
            <Text style={styles.teachBtnText}>✎ Teach AI Object</Text>
          </Pressable>
        </View>

        {/* User Learned Fingerprints Counter & Inspection Link */}
        <View style={styles.footerRow}>
          <Pressable onPress={() => setHistoryModalOpen(true)} style={styles.counterLink}>
            <Text style={styles.counterText}>
              🧠 {userFingerprints.length} Learned Fingerprints Active
            </Text>
          </Pressable>
          <Text style={styles.hashText}>Hash: {fingerprintHash}</Text>
        </View>

        {/* Space Weather & Granite Window Sill Science Guide Button */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setScienceModalOpen(true)}
          style={styles.scienceGuideBtn}
        >
          <Text style={styles.scienceGuideBtnText}>
            ☀️ What Magnetic Level Detects Solar Reconnection?
          </Text>
        </Pressable>
      </View>

      {/* TEACH THE AI MODAL (Pick the real object) */}
      <Modal visible={teachModalOpen} animationType="slide" transparent={false} onRequestClose={() => setTeachModalOpen(false)}>
        <View style={styles.modalRoot}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalEyebrow}>UNIVERSAL ELECTROMAGNETIC DATABASE</Text>
              <Text style={styles.modalTitle}>Teach AI What Caused This Field</Text>
              <Text style={styles.modalSubtitle}>
                Tell the AI what object is near your phone. It will record the current 3-axis electrodynamic
                fingerprint and dynamically adapt its classification weights.
              </Text>
            </View>

            {/* Current Signal Summary */}
            <View style={styles.sampleProfileBox}>
              <Text style={styles.sampleProfileTitle}>Current Sensor Excursion:</Text>
              <Text style={styles.sampleProfileText}>
                Δ|B| = +{(signature.peakDeltaMicroT).toFixed(1)} µT ({signature.deltaNanoT.toLocaleString()} nT) ·{' '}
                dB/dt = {signature.rateOfChangeMicroTPerSec.toFixed(1)} µT/s · Polarization = {(signature.polarizationRatio * 100).toFixed(0)}%
              </Text>
            </View>

            {/* Custom Nickname Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Optional Custom Label / Brand:</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. MacBook Pro M3, Anker USB-C, Milanese Watch"
                placeholderTextColor="#607d9b"
                value={customLabel}
                onChangeText={setCustomLabel}
              />
            </View>

            {/* Object Selection List */}
            <Text style={styles.sectionHeader}>Select Real Physical Object:</Text>
            <View style={styles.classList}>
              {Object.values(UNIVERSAL_FINGERPRINT_DATABASE).map((entry) => (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  onPress={() => setSelectedCorrectionClass(entry.id)}
                  style={[
                    styles.classItem,
                    selectedCorrectionClass === entry.id && {
                      borderColor: entry.color,
                      backgroundColor: `${entry.color}20`,
                    },
                  ]}
                >
                  <Text style={styles.classIcon}>{entry.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.className, { color: entry.color }]}>{entry.name}</Text>
                    <Text style={styles.classMechanism}>{entry.howAiGuesses}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {/* Submit / Cancel Buttons */}
            <View style={styles.modalBtnRow}>
              <Pressable
                accessibilityRole="button"
                disabled={!selectedCorrectionClass}
                onPress={() => selectedCorrectionClass && handleTeachSubmit(selectedCorrectionClass)}
                style={[
                  styles.saveBtn,
                  { opacity: selectedCorrectionClass ? 1.0 : 0.4 },
                ]}
              >
                <Text style={styles.saveBtnText}>Save & Adapt AI Model</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setTeachModalOpen(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* LEARNED FINGERPRINTS HISTORY MODAL */}
      <Modal visible={historyModalOpen} animationType="slide" transparent={false} onRequestClose={() => setHistoryModalOpen(false)}>
        <View style={styles.modalRoot}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalEyebrow}>ACTIVE KNOWLEDGE REPOSITORY</Text>
              <Text style={styles.modalTitle}>Your Learned Fingerprints</Text>
              <Text style={styles.modalSubtitle}>
                These confirmed fingerprints are cached in your device’s memory to personalize local disturbance
                detection without transmitting raw magnetic data.
              </Text>
            </View>

            {userFingerprints.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No user fingerprints confirmed yet.</Text>
                <Text style={styles.emptySubtext}>
                  Tap [ 👍 Correct! ] or [ ✎ Teach AI Object ] when disturbing the phone with objects to build your library.
                </Text>
              </View>
            ) : (
              <View style={styles.fpList}>
                {userFingerprints.map((fp, i) => {
                  const meta = UNIVERSAL_FINGERPRINT_DATABASE[fp.objectClassId];
                  return (
                    <View key={fp.id} style={[styles.fpItem, { borderColor: meta.color }]}>
                      <Text style={styles.fpIcon}>{meta.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fpName, { color: meta.color }]}>
                          #{i + 1} {fp.customLabel ?? meta.name}
                        </Text>
                        <Text style={styles.fpDetails}>
                          Δ|B| = +{fp.signature.peakDeltaMicroT.toFixed(1)} µT · dB/dt = {fp.signature.rateOfChangeMicroTPerSec.toFixed(1)} µT/s · Confirmed at {new Date(fp.confirmedAtUtc).toLocaleTimeString()}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {userFingerprints.length > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onClearFingerprints();
                  setHistoryModalOpen(false);
                }}
                style={styles.clearBtn}
              >
                <Text style={styles.clearBtnText}>Reset Learned Fingerprints</Text>
              </Pressable>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={() => setHistoryModalOpen(false)}
              style={styles.closeHistoryBtn}
            >
              <Text style={styles.closeHistoryBtnText}>Done</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* SPACE WEATHER & GRANITE WINDOW SILL SCIENCE GUIDE MODAL */}
      <Modal visible={scienceModalOpen} animationType="slide" transparent={false} onRequestClose={() => setScienceModalOpen(false)}>
        <View style={styles.modalRoot}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalEyebrow}>SPACE WEATHER SCIENCE & SENSOR LIMITS</Text>
              <Text style={styles.modalTitle}>Detecting Earth's Solar Reconnection</Text>
              <Text style={styles.modalSubtitle}>
                Understanding what magnetic levels phones can actually measure from coronal mass ejections,
                how AI isolates space weather from everyday objects, and why windowsill tests work.
              </Text>
            </View>

            {/* NOAA Space Weather Tiers Grid */}
            <Text style={styles.sectionHeader}>NOAA Space Weather Ground Tiers (B-Field)</Text>
            <View style={styles.tierList}>
              {SPACE_WEATHER_GROUND_SCALES.map((tier) => (
                <View key={tier.noaaScale} style={styles.tierCard}>
                  <View style={styles.tierHeader}>
                    <View style={styles.tierBadge}>
                      <Text style={styles.tierBadgeText}>{tier.noaaScale}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tierName}>{tier.name}</Text>
                      <Text style={styles.tierPerturbation}>
                        Δ|B|: {tier.groundPerturbationNanoT[0]}–{tier.groundPerturbationNanoT[1]} nT ({tier.kpIndex})
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detectabilityBox}>
                    <Text style={styles.detectabilityLabel}>📱 Phone Detectability:</Text>
                    <Text style={styles.detectabilityText}>{tier.phoneDetectability}</Text>
                  </View>
                  <Text style={styles.tierScientificDesc}>{tier.scientificDescription}</Text>
                </View>
              ))}
            </View>

            {/* Granite Window Sill Mineralogy & Zero Calibration */}
            <Text style={styles.sectionHeader}>🪨 The Granite Window Sill Phenomenon</Text>
            <View style={styles.graniteBox}>
              <Text style={styles.graniteTitle}>Why did your window sill read 250–450 nT?</Text>
              <Text style={styles.graniteText}>
                <Text style={{ fontWeight: '700', color: '#ffd58c' }}>Mineral Magnetism: </Text>
                {GRANITE_WINDOWSILL_PHYSICS.materialComposition} These minerals retain a permanent static remanence
                of {GRANITE_WINDOWSILL_PHYSICS.staticPermeabilityOffsetNt[0]}–{GRANITE_WINDOWSILL_PHYSICS.staticPermeabilityOffsetNt[1]} nT.
              </Text>
              <Text style={[styles.graniteText, { marginTop: 8 }]}>
                <Text style={{ fontWeight: '700', color: '#68edc3' }}>Window Sill Advantage: </Text>
                {GRANITE_WINDOWSILL_PHYSICS.windowSillAdvantage}
              </Text>
              <View style={styles.zeroStepBox}>
                <Text style={styles.zeroStepTitle}>↺ ZERO CALIBRATION PROTOCOL:</Text>
                <Text style={styles.zeroStepText}>{GRANITE_WINDOWSILL_PHYSICS.zeroCalibrationProtocol}</Text>
              </View>
            </View>

            {/* AI Discrimination Physics */}
            <Text style={styles.sectionHeader}>🧠 How AI Differentiates Solar Storms vs. Local Objects</Text>
            <View style={styles.aiRulesCard}>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleIcon}>⏱️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleTitle}>Rate of Change (dB/dt) — The Primary Discriminator</Text>
                  <Text style={styles.ruleText}>
                    Solar reconnection ionospheric currents evolve over minutes to hours (dB/dt &lt; 0.20 µT/s).
                    Moving hands or smartwatches shift fields in seconds (dB/dt &gt; 1.0–5.0 µT/s) — over 1,000x faster!
                  </Text>
                </View>
              </View>

              <View style={styles.ruleRow}>
                <Text style={styles.ruleIcon}>📐</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleTitle}>Multi-Modal Motion &amp; Touch Context</Text>
                  <Text style={styles.ruleText}>
                    The AI checks that the phone is in verified accelerometer STANDSTILL and HANDS OFF capacitive screen contact.
                    If the phone moves or is touched, solar disturbance is ruled out.
                  </Text>
                </View>
              </View>

              <View style={styles.ruleRow}>
                <Text style={styles.ruleIcon}>🛡️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleTitle}>Scientific Verification Boundary</Text>
                  <Text style={styles.ruleText}>
                    Per strict physical invariants: a single phone or co-located pair can NEVER establish a regional
                    reconnection event alone. A candidate classification requires USGS Boulder (BOU) validation and
                    independent geographically separated sensors.
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setScienceModalOpen(false)}
              style={styles.closeScienceBtn}
            >
              <Text style={styles.closeScienceBtnText}>Close Science Guide</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0a1727',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    marginVertical: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  icon: {
    fontSize: 22,
  },
  eyebrow: {
    color: '#8fa8c4',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '800',
  },
  reasoningBox: {
    backgroundColor: '#0e2338',
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
  },
  reasoningLabel: {
    color: '#ffd58c',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  reasoningText: {
    color: '#dce8f5',
    fontSize: 11,
    lineHeight: 15,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#071320',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
  },
  metricCell: {
    alignItems: 'center',
  },
  cellLabel: {
    color: '#6e8ba8',
    fontSize: 8.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  cellValue: {
    color: '#eff7ff',
    fontSize: 11,
    fontWeight: '700',
  },
  feedbackBanner: {
    backgroundColor: '#0d3b2e',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#20c997',
  },
  feedbackBannerText: {
    color: '#b2f2bb',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#68edc3',
    fontSize: 12,
    fontWeight: '700',
  },
  teachBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  teachBtnText: {
    color: '#b9a5ff',
    fontSize: 12,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#162b42',
  },
  counterLink: {
    paddingVertical: 2,
  },
  counterText: {
    color: '#8fa8c4',
    fontSize: 10,
    fontWeight: '600',
  },
  hashText: {
    color: '#557291',
    fontSize: 9.5,
    fontFamily: 'monospace',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#040b14',
  },
  modalScroll: {
    padding: 16,
    paddingTop: 48,
    paddingBottom: 40,
  },
  modalHeader: {
    marginBottom: 16,
  },
  modalEyebrow: {
    color: '#7fa1c4',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalTitle: {
    color: '#eff7ff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  modalSubtitle: {
    color: '#9db4cc',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  sampleProfileBox: {
    backgroundColor: '#0c1b2c',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1d3b5d',
    marginBottom: 14,
  },
  sampleProfileTitle: {
    color: '#ffd58c',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  sampleProfileText: {
    color: '#eff7ff',
    fontSize: 11,
    lineHeight: 15,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    color: '#cad9e8',
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0a1727',
    borderWidth: 1,
    borderColor: '#243e5c',
    borderRadius: 8,
    padding: 10,
    color: '#eff7ff',
    fontSize: 12.5,
  },
  sectionHeader: {
    color: '#eff7ff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  classList: {
    gap: 8,
    marginBottom: 16,
  },
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#091624',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1b334d',
  },
  classIcon: {
    fontSize: 22,
  },
  className: {
    fontSize: 13,
    fontWeight: '700',
  },
  classMechanism: {
    color: '#95adc7',
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 2,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#1b4a3a',
    borderWidth: 1,
    borderColor: '#20c997',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#68edc3',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#162536',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#a0b6cd',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyBox: {
    backgroundColor: '#091624',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
  },
  emptyText: {
    color: '#eff7ff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtext: {
    color: '#7f9cb8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  fpList: {
    gap: 8,
    marginVertical: 10,
  },
  fpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#091624',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  fpIcon: {
    fontSize: 20,
  },
  fpName: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  fpDetails: {
    color: '#8fa8c4',
    fontSize: 10,
    marginTop: 2,
  },
  clearBtn: {
    backgroundColor: '#38161e',
    borderColor: '#e55353',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
  },
  clearBtnText: {
    color: '#ffa2a2',
    fontSize: 12,
    fontWeight: '700',
  },
  closeHistoryBtn: {
    backgroundColor: '#162536',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  closeHistoryBtnText: {
    color: '#eff7ff',
    fontSize: 13,
    fontWeight: '700',
  },
  scienceGuideBtn: {
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#07242b',
    borderWidth: 1,
    borderColor: '#00e5ff',
    alignItems: 'center',
  },
  scienceGuideBtnText: {
    color: '#00e5ff',
    fontSize: 11.5,
    fontWeight: '700',
  },
  tierList: {
    gap: 10,
    marginBottom: 16,
  },
  tierCard: {
    backgroundColor: '#091828',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#19334f',
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  tierBadge: {
    backgroundColor: '#00e5ff25',
    borderWidth: 1,
    borderColor: '#00e5ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tierBadgeText: {
    color: '#00e5ff',
    fontSize: 12,
    fontWeight: '800',
  },
  tierName: {
    color: '#eff7ff',
    fontSize: 13,
    fontWeight: '700',
  },
  tierPerturbation: {
    color: '#ffd58c',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  detectabilityBox: {
    backgroundColor: '#06111d',
    borderRadius: 6,
    padding: 8,
    marginVertical: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#00e5ff',
  },
  detectabilityLabel: {
    color: '#68edc3',
    fontSize: 9.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  detectabilityText: {
    color: '#d6e8fa',
    fontSize: 11,
    lineHeight: 15,
  },
  tierScientificDesc: {
    color: '#8fa9c6',
    fontSize: 10.5,
    lineHeight: 14,
    fontStyle: 'italic',
  },
  graniteBox: {
    backgroundColor: '#0c2235',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#21496d',
    marginBottom: 16,
  },
  graniteTitle: {
    color: '#ffd58c',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  graniteText: {
    color: '#dce8f5',
    fontSize: 11.5,
    lineHeight: 16,
  },
  zeroStepBox: {
    backgroundColor: '#061320',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#20c997',
  },
  zeroStepTitle: {
    color: '#68edc3',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  zeroStepText: {
    color: '#eff7ff',
    fontSize: 11,
    lineHeight: 15,
  },
  aiRulesCard: {
    backgroundColor: '#091828',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#19334f',
    gap: 12,
    marginBottom: 16,
  },
  ruleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ruleIcon: {
    fontSize: 18,
    marginTop: 1,
  },
  ruleTitle: {
    color: '#ffd58c',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  ruleText: {
    color: '#d1e3f7',
    fontSize: 11,
    lineHeight: 15,
  },
  closeScienceBtn: {
    backgroundColor: '#00e5ff20',
    borderWidth: 1,
    borderColor: '#00e5ff',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  closeScienceBtnText: {
    color: '#00e5ff',
    fontSize: 13,
    fontWeight: '700',
  },
});
