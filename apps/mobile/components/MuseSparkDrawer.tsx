import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { runDemoCoordinator, type DemoCoordinatorResult, META_TOOLS } from '@aurorasense/coordinator';

interface MuseSparkDrawerProps {
  visible: boolean;
  onClose: () => void;
  hasLocalSession?: boolean;
}

const colors = {
  background: '#040d1a',
  panel: '#0a192b',
  card: '#0c1d33',
  ink: '#eff7ff',
  muted: '#8ea8c4',
  mint: '#20c997',
  cyan: '#00e5ff',
  violet: '#7064e9',
  amber: '#ffd58c',
  border: '#163354',
};

export function MuseSparkDrawer({ visible, onClose, hasLocalSession = false }: MuseSparkDrawerProps) {
  const [coordinatorResult, setCoordinatorResult] = useState<DemoCoordinatorResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  function handleRunCoordinator() {
    setIsRunning(true);
    setTimeout(() => {
      const res = runDemoCoordinator();
      setCoordinatorResult(res);
      setIsRunning(false);
    }, 350);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* TOP BAR */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.superTitle}>OBSERVATION COORDINATOR · META MODEL API</Text>
              <Text style={styles.sheetTitle}>Muse Spark 1.3 Policy &amp; Tools</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.bodyScroll}>
            {/* HONEST EXECUTION MODE BADGES */}
            <View style={styles.badgeRow}>
              <View style={[styles.badgePill, { borderColor: colors.amber }]}>
                <View style={[styles.greenGlowDot, { backgroundColor: colors.amber }]} />
                <Text style={[styles.badgeText, { color: colors.amber }]}>
                  SCRIPTED POLICY DEMO · NO LIVE MODEL CALL
                </Text>
              </View>
              <View style={[styles.badgePill, { backgroundColor: '#21183b', borderColor: colors.violet }]}>
                <Text style={[styles.badgeText, { color: '#c4b5fd' }]}>Deterministic Validator</Text>
              </View>
            </View>

            {/* KEY SCIENTIFIC QUESTION */}
            <View style={styles.questionCard}>
              <Text style={styles.questionTitle}>One phone. Enough evidence?</Text>
              <Text style={styles.questionBody}>
                A local magnetic excursion requires deterministic quality checks, time-aligned professional observatory reference data, and ≥3 geographically independent phones (≥20 km apart) before it can support a regional disturbance verdict.
              </Text>
            </View>

            {/* COVERAGE COUNTERS */}
            <View style={styles.countersGrid}>
              <View style={styles.counterBox}>
                <Text style={styles.counterLabel}>LOCAL PHONE SITES</Text>
                <Text style={styles.counterVal}>{hasLocalSession ? '1' : '0'}</Text>
                <Text style={styles.counterSub}>Needs ≥3 Independent</Text>
              </View>
              <View style={styles.counterBox}>
                <Text style={styles.counterLabel}>OPTICAL SIGHTINGS</Text>
                <Text style={styles.counterVal}>0</Text>
                <Text style={styles.counterSub}>None Loaded</Text>
              </View>
              <View style={styles.counterBox}>
                <Text style={styles.counterLabel}>REGIONAL VERDICT</Text>
                <Text style={[styles.counterVal, { color: colors.amber, fontSize: 13 }]}>
                  INCONCLUSIVE
                </Text>
                <Text style={styles.counterSub}>Validator Owned</Text>
              </View>
            </View>

            {/* 7 APPROVED TYPED TOOLS */}
            <View style={styles.loopCard}>
              <Text style={styles.loopTitle}>7 Approved Typed Scientific Tools (muse-spark-1.3):</Text>
              <View style={styles.loopSteps}>
                {META_TOOLS.map((t, idx) => (
                  <Text key={t.name} style={styles.loopStepItem}>
                    {idx + 1}. <Text style={styles.toolName}>{t.name}</Text> — {t.description}
                  </Text>
                ))}
              </View>
            </View>

            {/* RUN / REPLAY COORDINATOR BUTTON */}
            <Pressable
              disabled={isRunning}
              onPress={handleRunCoordinator}
              style={[styles.runBtn, isRunning && { opacity: 0.6 }]}
            >
              <Text style={styles.runBtnText}>
                {isRunning
                  ? 'Replaying Deterministic Policy Scenario...'
                  : '▶ Run Scripted Policy Workflow (Offline Demo)'}
              </Text>
            </Pressable>

            {/* AUDITED ACTION TRAIL */}
            {coordinatorResult && (
              <View style={styles.auditBox}>
                <Text style={styles.auditTitle}>
                  Deterministic Verdict:{' '}
                  <Text style={{ color: colors.amber }}>{coordinatorResult.verdict}</Text>
                </Text>
                <Text style={styles.auditSub}>
                  Scenario: Synthetic May 2024 policy replay ({coordinatorResult.reasons.join(' · ')}). Model prose never overrides the deterministic validator.
                </Text>
                <View style={styles.auditList}>
                  <Text style={styles.auditHeader}>
                    Audited Tool Calls ({coordinatorResult.timeline.length}):
                  </Text>
                  {coordinatorResult.timeline.map((act) => (
                    <Text key={act.id} style={styles.auditItem}>
                      • <Text style={styles.toolName}>{act.tool}</Text>: {act.status}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 16, 0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '86%',
    backgroundColor: colors.panel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  superTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.cyan,
    letterSpacing: 1.1,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#071526',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: 'bold',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#071726',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#193f66',
  },
  greenGlowDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.mint,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.ink,
  },
  questionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.amber,
  },
  questionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.amber,
    marginBottom: 4,
  },
  questionBody: {
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.ink,
  },
  countersGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  counterBox: {
    flex: 1,
    backgroundColor: '#051221',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  counterLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 4,
  },
  counterVal: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.ink,
  },
  counterSub: {
    fontSize: 8.5,
    color: colors.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  loopCard: {
    backgroundColor: '#081729',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#183859',
  },
  loopTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.cyan,
    marginBottom: 6,
  },
  loopSteps: {
    gap: 5,
  },
  loopStepItem: {
    fontSize: 10.5,
    color: colors.ink,
    lineHeight: 15,
  },
  runBtn: {
    backgroundColor: '#1b4a7d',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  runBtnText: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: '700',
  },
  auditBox: {
    backgroundColor: '#061324',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  auditTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
  },
  auditSub: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
    marginBottom: 8,
  },
  auditList: {
    borderTopWidth: 1,
    borderTopColor: '#10253d',
    paddingTop: 8,
    gap: 4,
  },
  auditHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    marginBottom: 4,
  },
  auditItem: {
    fontSize: 10.5,
    color: colors.ink,
  },
  toolName: {
    color: colors.cyan,
    fontWeight: '700',
  },
  bodyScroll: {
    flex: 1,
  },
});
