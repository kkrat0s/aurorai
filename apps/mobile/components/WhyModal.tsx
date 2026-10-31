import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MUSE_IMAGE_CONCEPTS } from '@aurorasense/coordinator';

interface WhyModalProps {
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

const WHY_STEPS = [
  {
    stage: 1,
    title: 'From Sun to Solar Wind',
    tag: 'MEASURED / SATELLITE',
    text: 'Coronal mass ejections and high-speed plasma streams drag solar magnetic fields (IMF) across 150 million kilometers to Earth. NASA and NOAA satellites at the L1 Lagrange point measure this supersonic plasma 30 to 60 minutes before it impacts Earth.',
    note: 'Solar wind speed and southward magnetic field direction (negative Bz) determine how strongly Earth’s space environment responds.',
  },
  {
    stage: 2,
    title: 'Magnetic Reconnection',
    tag: 'PHYSICAL PROCESS',
    text: 'When the solar wind’s magnetic field points southward, it connects directly with Earth’s northward dipole field on the dayside magnetopause. This magnetic reconnection acts like an open gate, allowing solar wind energy and momentum to flood into Earth’s magnetosphere.',
    note: 'Reconnection transfers magnetic flux from the sunlit side into the long nightside magnetotail.',
  },
  {
    stage: 3,
    title: 'Magnetotail Energy Storage',
    tag: 'STORAGE & RELEASE',
    text: 'Energy builds up in the nightside magnetotail like a stretched rubber band. Eventually, the stretched tail snaps and reconnects explosively (a magnetospheric substorm), accelerating billions of energetic electrons down along magnetic field lines toward the polar regions.',
    note: 'This explosive release is why auroras brighten and dance suddenly rather than glowing continuously.',
  },
  {
    stage: 4,
    title: 'Atmospheric Collision & Currents',
    tag: 'IONOSPHERIC ELECTROJET',
    text: 'Precipitating relativistic electrons slam into upper atmosphere oxygen and nitrogen atoms between 100 and 300 kilometers altitude. These moving charges create massive electrical currents (electrojets) exceeding 1,000,000 Amperes, which cause the ground magnetic variations that your smartphone detects.',
    note: 'The electrojets produce the nanotesla-scale deflections measured by ground magnetometers.',
  },
  {
    stage: 5,
    title: 'Atomic Light Emission',
    tag: 'DIRECT OPTICAL EMISSION',
    text: 'Colliding electrons excite atmospheric atoms into higher energy states. When oxygen atoms drop back to their ground state, they emit emerald green light at 557.7 nm (lower altitudes) or deep crimson red light at 630.0 nm (higher altitudes). Nitrogen emits blue and violet hues.',
    note: 'Ground magnetic disturbances prove that ionospheric currents exist, but clear dark skies and correct viewing geometry are required to see the glow.',
  },
] as const;

export function WhyModal({ visible, onClose }: WhyModalProps) {
  const [currentStep, setCurrentStep] = useState<number>(0);

  const step = WHY_STEPS[currentStep];
  const concept = MUSE_IMAGE_CONCEPTS[(currentStep + 1) as 1 | 2 | 3 | 4 | 5];

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* TOP BAR */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.superTitle}>WHY? · FIVE-STEP SCIENCE STORY</Text>
              <Text style={styles.sheetTitle}>{step.title}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* STEP NUMBER PILLS */}
          <View style={styles.stepsRow}>
            {WHY_STEPS.map((s, idx) => {
              const active = idx === currentStep;
              return (
                <Pressable
                  key={s.stage}
                  onPress={() => setCurrentStep(idx)}
                  style={[styles.stepNumBtn, active && styles.stepNumBtnActive]}
                >
                  <Text style={[styles.stepNumText, active && styles.stepNumTextActive]}>
                    {idx + 1}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView style={styles.bodyScroll}>
            {/* TAG BADGE */}
            <View style={styles.tagBadge}>
              <Text style={styles.tagBadgeText}>{step.tag}</Text>
            </View>

            {/* CONCEPTUAL ART PROMPT BOX (META MUSE IMAGE) */}
            <View style={styles.conceptBox}>
              <Text style={styles.conceptBadge}>🎨 META MUSE IMAGE CONCEPT</Text>
              <Text style={styles.conceptPrompt}>"{concept.scientificPrompt}"</Text>
              <Text style={styles.conceptDesc}>{concept.diagramDescription}</Text>
            </View>

            {/* STORY TEXT */}
            <Text style={styles.storyText}>{step.text}</Text>

            {/* CALLOUT NOTE */}
            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>Scientific insight:</Text>
              <Text style={styles.noteText}>{step.note}</Text>
            </View>
          </ScrollView>

          {/* NAVIGATION FOOTER */}
          <View style={styles.footerRow}>
            <Pressable
              disabled={currentStep === 0}
              onPress={() => setCurrentStep((s) => s - 1)}
              style={[styles.footerBtn, currentStep === 0 && { opacity: 0.3 }]}
            >
              <Text style={styles.footerBtnText}>← Previous</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (currentStep < 4) setCurrentStep((s) => s + 1);
                else onClose();
              }}
              style={[styles.footerBtn, styles.footerBtnPrimary]}
            >
              <Text style={styles.footerBtnTextPrimary}>
                {currentStep === 4 ? 'Back to Evidence ✓' : 'Next Step →'}
              </Text>
            </Pressable>
          </View>
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
    color: colors.violet,
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
  stepsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  stepNumBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  stepNumBtnActive: {
    backgroundColor: colors.violet,
    borderColor: '#988cfc',
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  stepNumTextActive: {
    color: '#ffffff',
  },
  bodyScroll: {
    flex: 1,
    marginBottom: 12,
  },
  tagBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#171233',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.violet,
    marginBottom: 10,
  },
  tagBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.violet,
  },
  conceptBox: {
    backgroundColor: '#05111f',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#183859',
  },
  conceptBadge: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.cyan,
    marginBottom: 4,
  },
  conceptPrompt: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#a8d2f5',
    lineHeight: 16,
    marginBottom: 6,
  },
  conceptDesc: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
  },
  storyText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.ink,
    marginBottom: 14,
  },
  noteBox: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.mint,
  },
  noteTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.mint,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  footerBtnText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  footerBtnPrimary: {
    backgroundColor: colors.violet,
    borderColor: '#988cfc',
  },
  footerBtnTextPrimary: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
