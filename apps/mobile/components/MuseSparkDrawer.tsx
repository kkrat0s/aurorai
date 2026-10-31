import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { runDemoCoordinator, type DemoCoordinatorResult } from '@aurorasense/coordinator';

interface MuseSparkDrawerProps {
  visible: boolean;
  onClose: () => void;
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

export function MuseSparkDrawer({ visible, onClose }: MuseSparkDrawerProps) {
  const [coordinatorResult, setCoordinatorResult] = useState<DemoCoordinatorResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  function handleRunCoordinator() {
    setIsRunning(true);
    setTimeout(() => {
      const res = runDemoCoordinator();
      setCoordinatorResult(res);
      setIsRunning(false);
    }, 400);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* TOP BAR */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.superTitle}>META AI AGENTIC COORDINATOR</Text>
              <Text style={styles.sheetTitle}>Meta Muse Spark 1.3</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.bodyScroll}>
            {/* EVIDENCE BADGE */}
            <View style={styles.badgeRow}>
              <View style={styles.badgePill}>
                <View style={styles.greenGlowDot} />
                <Text style={styles.badgeText}>Evidence before conclusions</Text>
              </View>
              <View style={[styles.badgePill, { backgroundColor: '#21183b', borderColor: colors.violet }]}>
                <Text style={[styles.badgeText, { color: colors.violet }]}>Standard Privacy Mode</Text>
              </View>
            </View>

            {/* KEY SCIENTIFIC QUESTION */}
            <View style={styles.questionCard}>
              <Text style={styles.questionTitle}>One phone. Enough evidence?</Text>
              <Text style={styles.questionBody}>
                A local magnetic spike requires deterministic quality checks, professional observatory alignment, and geographically independent observations before it can support a regional space weather claim.
              </Text>
            </View>

            {/* COVERAGE COUNTERS */}
            <View style={styles.countersGrid}>
              <View style={styles.counterBox}>
                <Text style={styles.counterLabel}>REAL INDEPENDENT SITES</Text>
                <Text style={styles.counterVal}>1</Text>
                <Text style={styles.counterSub}>Boulder Region</Text>
              </View>
              <View style={styles.counterBox}>
                <Text style={styles.counterLabel}>VERIFIED OPTICAL SIGHTINGS</Text>
                <Text style={styles.counterVal}>0</Text>
                <Text style={styles.counterSub}>Awaiting Clear Night</Text>
              </View>
              <View style={styles.counterBox}>
                <Text style={styles.counterLabel}>BOULDER (BOU) COHERENCE</Text>
                <Text style={[styles.counterVal, { color: colors.mint }]}>0.88</Text>
                <Text style={styles.counterSub}>Coordinated Excursion</Text>
              </View>
            </View>

            {/* 4-STEP AGENTIC LOOP */}
            <View style={styles.loopCard}>
              <Text style={styles.loopTitle}>Observation Coordinator Loop:</Text>
              <View style={styles.loopSteps}>
                <Text style={styles.loopStepItem}>✓ 1. Inspect upstream CME & local QC</Text>
                <Text style={styles.loopStepItem}>✓ 2. Find regional observation gap</Text>
                <Text style={styles.loopStepItem}>✓ 3. Request opt-in 10-minute session</Text>
                <Text style={styles.loopStepItem}>✓ 4. Run deterministic validation tools</Text>
              </View>
            </View>

            {/* RUN / REPLAY COORDINATOR BUTTON */}
            <Pressable
              disabled={isRunning}
              onPress={handleRunCoordinator}
              style={[styles.runBtn, isRunning && { opacity: 0.6 }]}
            >
              <Text style={styles.runBtnText}>
                {isRunning ? 'Executing Typed Scientific Tools...' : '▶ Run Observation Coordinator Loop'}
              </Text>
            </Pressable>

            {/* AUDITED ACTION TRAIL */}
            {coordinatorResult && (
              <View style={styles.auditBox}>
                <Text style={styles.auditTitle}>
                  Deterministic Verdict: <Text style={{ color: colors.amber }}>{coordinatorResult.verdict}</Text>
                </Text>
                <Text style={styles.auditSub}>
                  {coordinatorResult.reasons.join('. ')}
                </Text>
                <View style={styles.auditList}>
                  <Text style={styles.auditHeader}>Audited Tool Calls ({coordinatorResult.timeline.length}):</Text>
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
    height: '84%',
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
    letterSpacing: 1.2,
  },
  sheetTitle: {
    fontSize: 18,
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
    fontSize: 10,
    fontWeight: '700',
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
    fontSize: 12,
    lineHeight: 18,
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
    fontSize: 20,
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
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.cyan,
    marginBottom: 6,
  },
  loopSteps: {
    gap: 4,
  },
  loopStepItem: {
    fontSize: 11,
    color: colors.ink,
    lineHeight: 16,
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
    fontSize: 13,
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
