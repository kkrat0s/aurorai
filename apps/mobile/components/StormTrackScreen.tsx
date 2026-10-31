import React, { useState } from 'react';
import {
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
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

interface StormTrackScreenProps {
  onOpenWhy: () => void;
  onOpenHistoricalReplay: () => void;
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

const TIME_HORIZONS = ['Now', '+6h', '+12h', '+24h', '+48h', '+72h'];

export function StormTrackScreen({
  onOpenWhy,
  onOpenHistoricalReplay,
}: StormTrackScreenProps) {
  const [selectedHorizon, setSelectedHorizon] = useState('+24h');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* SCREEN SUBTITLE */}
      <View style={styles.headerTitleBox}>
        <Text style={styles.screenNumber}>1. Storm Track</Text>
        <Text style={styles.screenSubtitle}>Solar wind predictions and model projections</Text>
      </View>

      {/* TIME HORIZON PILLS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizonScroll}
      >
        {TIME_HORIZONS.map((h) => {
          const active = selectedHorizon === h;
          return (
            <Pressable
              key={h}
              onPress={() => setSelectedHorizon(h)}
              style={[styles.horizonPill, active && styles.horizonPillActive]}
            >
              <Text style={[styles.horizonText, active && styles.horizonTextActive]}>
                {h}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* CME ENSEMBLE ARRIVAL VISUAL CARD */}
      <View style={styles.cmeCard}>
        <View style={styles.cmeCardHeader}>
          <View>
            <Text style={styles.cmeTitle}>CME (Coronal Mass Ejection)</Text>
            <Text style={styles.cmeSubtitle}>Multiple model projections (hurricane-style)</Text>
          </View>
          <View style={styles.arrivalWindowBadge}>
            <Text style={styles.arrivalWindowLabel}>ESTIMATED ARRIVAL WINDOW</Text>
            <Text style={styles.arrivalWindowTime}>May 11, 18:00 – May 12, 06:00 UTC</Text>
          </View>
        </View>

        {/* SUN-TO-EARTH CME SCHEMATIC SVG */}
        <View style={styles.svgWrapper}>
          <Svg width="100%" height={180} viewBox="0 0 340 180">
            <Defs>
              <RadialGradient id="sunGlow" cx="20%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor="#fff380" stopOpacity="1" />
                <Stop offset="40%" stopColor="#ff9800" stopOpacity="0.9" />
                <Stop offset="80%" stopColor="#ff5722" stopOpacity="0.4" />
                <Stop offset="100%" stopColor="#ff5722" stopOpacity="0" />
              </RadialGradient>
              <LinearGradient id="mostLikelyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#ffd58c" />
                <Stop offset="70%" stopColor="#00e5ff" />
                <Stop offset="100%" stopColor="#20c997" />
              </LinearGradient>
              <RadialGradient id="earthGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor="#80d8ff" stopOpacity="1" />
                <Stop offset="70%" stopColor="#0091ea" stopOpacity="0.8" />
                <Stop offset="100%" stopColor="#01579b" stopOpacity="0.3" />
              </RadialGradient>
            </Defs>

            {/* Sun Body & Corona on Left */}
            <Circle cx="20" cy="90" r="45" fill="url(#sunGlow)" />
            <Circle cx="10" cy="90" r="28" fill="#ffab00" />
            <SvgText x="15" y="94" fill="#ffffff" fontSize="10" fontWeight="bold">
              SUN
            </SvgText>

            {/* Uncertainty Fan Background */}
            <Path
              d="M 38 90 C 120 40, 200 45, 290 75 L 290 105 C 200 135, 120 140, 38 90 Z"
              fill="#00e5ff"
              fillOpacity="0.07"
            />

            {/* NASA ENLIL Range (Yellow/Orange) */}
            <Path
              d="M 38 88 C 110 50, 210 55, 288 80"
              stroke="#ffd58c"
              strokeWidth="2"
              fill="none"
              strokeDasharray="4,2"
            />

            {/* EUROPA Range (Blue/Cyan) */}
            <Path
              d="M 38 92 C 110 130, 210 125, 288 100"
              stroke="#64b5f6"
              strokeWidth="2"
              fill="none"
              strokeDasharray="4,2"
            />

            {/* Other Models (Muted Violet) */}
            <Path
              d="M 38 86 C 130 65, 200 70, 288 86"
              stroke="#9575cd"
              strokeWidth="1.5"
              fill="none"
              opacity="0.8"
            />
            <Path
              d="M 38 94 C 130 115, 200 110, 288 94"
              stroke="#9575cd"
              strokeWidth="1.5"
              fill="none"
              opacity="0.8"
            />

            {/* Most Likely Path (Solid Cyan/Teal Gradient) */}
            <Path
              d="M 38 90 C 120 90, 200 88, 288 90"
              stroke="url(#mostLikelyGrad)"
              strokeWidth="3.5"
              fill="none"
            />

            {/* Uncertainty Window Target Line */}
            <Path
              d="M 288 50 L 288 130"
              stroke="#00e5ff"
              strokeWidth="1.5"
              strokeDasharray="3,3"
            />

            {/* Earth on Right */}
            <Circle cx="295" cy="90" r="16" fill="url(#earthGlow)" />
            <Path
              d="M 283 72 C 277 82, 277 98, 283 108"
              stroke="#80d8ff"
              strokeWidth="2.5"
              fill="none"
              strokeOpacity="0.9"
            />
            <SvgText x="282" y="125" fill="#c3d9ed" fontSize="9" fontWeight="bold">
              EARTH
            </SvgText>
          </Svg>
        </View>

        {/* CME LEGEND */}
        <View style={styles.legendGrid}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ffd58c' }]} />
            <Text style={styles.legendText}>NASA ENLIL (range)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#64b5f6' }]} />
            <Text style={styles.legendText}>EUROPA (range)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#9575cd' }]} />
            <Text style={styles.legendText}>Other models</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#00e5ff' }]} />
            <Text style={styles.legendText}>Most likely path (ensemble)</Text>
          </View>
        </View>
      </View>

      {/* PREDICTION CONFIDENCE CARD */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Prediction confidence ℹ️</Text>
          <Text style={styles.confidenceScore}>Moderate (62%)</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: '62%' }]} />
        </View>

        {/* Milestone Timeline */}
        <View style={styles.timelineRow}>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineTitle}>Initial detection</Text>
            <Text style={styles.timelineTime}>(26h ago)</Text>
          </View>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineTitle}>Model update</Text>
            <Text style={styles.timelineTime}>(12h ago)</Text>
          </View>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineTitle}>Latest update</Text>
            <Text style={styles.timelineTime}>(2h ago)</Text>
          </View>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineTitle}>Next update</Text>
            <Text style={styles.timelineTime}>(in 1h)</Text>
          </View>
        </View>
      </View>

      {/* HISTORICAL REPLAY MAY 2024 CARD */}
      <Pressable onPress={onOpenHistoricalReplay} style={styles.actionCard}>
        <View style={styles.actionIconBox}>
          <Text style={styles.actionIcon}>☀️</Text>
        </View>
        <View style={styles.actionTextBox}>
          <Text style={styles.actionTitle}>Historical replay – May 2024</Text>
          <Text style={styles.actionSubtitle}>
            Explore the extreme storm that produced global auroras.
          </Text>
        </View>
        <Text style={styles.actionChevron}>›</Text>
      </Pressable>

      {/* WHY MIGHT THIS HIT EARTH? CARD */}
      <Pressable onPress={onOpenWhy} style={styles.actionCard}>
        <View style={[styles.actionIconBox, { backgroundColor: '#211c47' }]}>
          <Text style={styles.actionIcon}>📖</Text>
        </View>
        <View style={styles.actionTextBox}>
          <Text style={styles.actionTitle}>Why might this hit Earth?</Text>
          <Text style={styles.actionSubtitle}>
            Learn how solar storms travel from the Sun to Earth.
          </Text>
        </View>
        <Text style={styles.actionChevron}>›</Text>
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
  horizonScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  horizonPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  horizonPillActive: {
    backgroundColor: colors.violet,
    borderColor: '#988cfc',
  },
  horizonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  horizonTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  cmeCard: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cmeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  cmeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  cmeSubtitle: {
    fontSize: 11,
    color: colors.muted,
  },
  arrivalWindowBadge: {
    backgroundColor: '#071526',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#193f66',
    alignItems: 'flex-end',
  },
  arrivalWindowLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.cyan,
  },
  arrivalWindowTime: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
  },
  svgWrapper: {
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#12253d',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10.5,
    color: colors.muted,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  confidenceScore: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.cyan,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#05111f',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.violet,
    borderRadius: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineItem: {
    alignItems: 'center',
  },
  timelineTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.ink,
  },
  timelineTime: {
    fontSize: 9.5,
    color: colors.muted,
    marginTop: 1,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#261b0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 18,
  },
  actionTextBox: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.ink,
  },
  actionSubtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 15,
  },
  actionChevron: {
    fontSize: 20,
    color: colors.muted,
    fontWeight: '300',
  },
});
