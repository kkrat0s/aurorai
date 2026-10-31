import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  UNIVERSAL_FINGERPRINT_DATABASE,
  type DisturbanceClassificationResult,
} from '@aurorasense/shared/magnetic-classifier';

interface AiDisturbanceClassifierCardProps {
  classification: DisturbanceClassificationResult | null;
  onRecalibrate: () => void;
  calibrating?: boolean;
}

export function AiDisturbanceClassifierCard({
  classification,
  onRecalibrate,
  calibrating = false,
}: AiDisturbanceClassifierCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!classification) return null;

  const { metadata, confidence, signature, solarStormSignalRatio, fingerprintHash } = classification;

  return (
    <>
      <View style={[styles.card, { borderColor: metadata.color }]}>
        <View style={styles.topRow}>
          <View style={styles.titleWithIcon}>
            <Text style={styles.icon}>{metadata.icon}</Text>
            <View>
              <Text style={styles.eyebrow}>AI DISTURBANCE DETECTOR</Text>
              <Text style={[styles.title, { color: metadata.color }]}>
                {metadata.name}
              </Text>
            </View>
          </View>
          <View style={[styles.confidenceBadge, { backgroundColor: `${metadata.color}22` }]}>
            <Text style={[styles.confidenceText, { color: metadata.color }]}>
              {Math.round(confidence * 100)}% match
            </Text>
          </View>
        </View>

        <Text style={styles.mechanismText}>
          {metadata.primaryMechanism}
        </Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Peak Deviation</Text>
            <Text style={[styles.metricValue, { color: metadata.color }]}>
              {Math.round(signature.peakDeltaMicroT * 1000).toLocaleString()} nT
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Rate of Change</Text>
            <Text style={styles.metricValue}>
              {signature.rateOfChangeMicroTPerSec.toFixed(1)} µT/s
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Solar Storm Ratio</Text>
            <Text style={[styles.metricValue, { color: solarStormSignalRatio > 10 ? '#ffd58c' : '#68edc3' }]}>
              {solarStormSignalRatio}x
            </Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDetailsOpen(true)}
            style={[styles.actionBtn, { borderColor: metadata.color, backgroundColor: `${metadata.color}18` }]}
          >
            <Text style={[styles.actionBtnText, { color: metadata.color }]}>
              🔬 Deep AI Physics Analysis
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={calibrating}
            onPress={onRecalibrate}
            style={[styles.recalBtn, { opacity: calibrating ? 0.5 : 1 }]}
          >
            <Text style={styles.recalBtnText}>
              {calibrating ? 'Calibrating…' : '↺ Recalibrate'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Detailed Modal for AI Physics Analysis & Universal Database */}
      <Modal visible={detailsOpen} animationType="slide" transparent={false} onRequestClose={() => setDetailsOpen(false)}>
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalEyebrow}>UNIVERSAL MAGNETIC FINGERPRINT DATABASE</Text>
              <Text style={[styles.modalTitle, { color: metadata.color }]}>
                {metadata.icon} {metadata.name}
              </Text>
              <Text style={styles.fingerprintBadge}>Fingerprint: {fingerprintHash}</Text>
            </View>

            <View style={[styles.sectionCard, { borderColor: metadata.color }]}>
              <Text style={[styles.sectionTitle, { color: metadata.color }]}>Electrodynamic Physics</Text>
              <Text style={styles.bodyText}>{metadata.physicsExplanation}</Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { color: '#ffd58c' }]}>Why This Impacts Solar Storm Detection</Text>
              <Text style={styles.bodyText}>{metadata.solarStormComparison}</Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { color: '#68edc3' }]}>Mitigation & Best Practices</Text>
              <Text style={styles.bodyText}>{metadata.mitigationAdvice}</Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { color: '#b9a5ff' }]}>AI Learning & Universal Database</Text>
              <Text style={styles.bodyText}>
                The AuroraSense AI classifier compares multi-axis vector gradients, frequency spectrums, and rate of change
                against canonical signatures in our open database. By learning to recognize the distinctive electromagnetic
                fingerprints of human hands, smartwatches, and electronics, the system can automatically flag local artifacts
                and verify true global ionospheric disturbances caused by solar wind reconnection.
              </Text>
            </View>

            <View style={styles.databaseOverviewCard}>
              <Text style={styles.databaseHeader}>Canonical Database Signatures</Text>
              {Object.values(UNIVERSAL_FINGERPRINT_DATABASE).map((entry) => {
                const isCurrent = entry.id === metadata.id;
                return (
                  <View
                    key={entry.id}
                    style={[
                      styles.dbItem,
                      isCurrent && { borderColor: entry.color, backgroundColor: `${entry.color}15` },
                    ]}
                  >
                    <Text style={styles.dbIcon}>{entry.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dbName, { color: isCurrent ? entry.color : '#eff7ff' }]}>
                        {entry.name} {isCurrent && '← (Active Match)'}
                      </Text>
                      <Text style={styles.dbDelta}>
                        Typical ΔB: {entry.typicalDeltaNanoT[0].toLocaleString()}–{entry.typicalDeltaNanoT[1].toLocaleString()} nT
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setDetailsOpen(false)}
              style={styles.closeBtn}
            >
              <Text style={styles.closeBtnText}>Done</Text>
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
    marginVertical: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  icon: {
    fontSize: 24,
  },
  eyebrow: {
    color: '#8fa8c4',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  confidenceBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '800',
  },
  mechanismText: {
    color: '#b0c1d4',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#071220',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#15273b',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    color: '#7e96b0',
    fontSize: 9.5,
  },
  metricValue: {
    color: '#eff7ff',
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  recalBtn: {
    backgroundColor: '#13283f',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#244569',
    justifyContent: 'center',
  },
  recalBtnText: {
    color: '#68edc3',
    fontSize: 12,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#061122',
  },
  modalContent: {
    padding: 18,
    paddingTop: 36,
    gap: 12,
  },
  modalHeader: {
    marginBottom: 6,
  },
  modalEyebrow: {
    color: '#68edc3',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  fingerprintBadge: {
    color: '#8fa8c4',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#0b192b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1b3452',
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  bodyText: {
    color: '#c2d4e6',
    fontSize: 12.5,
    lineHeight: 18,
  },
  databaseOverviewCard: {
    backgroundColor: '#081423',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#19324e',
    gap: 8,
  },
  databaseHeader: {
    color: '#eff7ff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  dbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0c1d30',
    borderRadius: 8,
    padding: 9,
    borderWidth: 1,
    borderColor: '#1e3857',
  },
  dbIcon: {
    fontSize: 18,
  },
  dbName: {
    fontSize: 12,
    fontWeight: '700',
  },
  dbDelta: {
    color: '#8fa8c4',
    fontSize: 10.5,
  },
  closeBtn: {
    backgroundColor: '#68edc3',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  closeBtnText: {
    color: '#061122',
    fontWeight: '800',
    fontSize: 15,
  },
});
