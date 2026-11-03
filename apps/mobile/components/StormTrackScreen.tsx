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
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { SolarStorm3DView } from './SolarStorm3DView';

interface StormTrackScreenProps {
  mode: 'replay' | 'live';
  onChangeMode: (mode: 'replay' | 'live') => void;
  onOpenWhy: () => void;
  onOpenGroundTruth: () => void;
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

// Verified NASA CCMC CME Scoreboard pre-outcome submissions for 2024-05-08T12:24:00-CME-001
const VERIFIED_CME_SUBMISSIONS = [
  { id: 'cme-1', method: 'DBEM (Ensemble)', issuedUtc: 'May 09 09:10 UTC', arrivalUtc: 'May 10 12:58 UTC', family: 'DBEM' },
  { id: 'cme-2', method: 'WSA-ENLIL+Cone (M2M)', issuedUtc: 'May 08 19:42 UTC', arrivalUtc: 'May 10 17:44 UTC', family: 'ENLIL' },
  { id: 'cme-3', method: 'EUHFORIA', issuedUtc: 'May 09 14:20 UTC', arrivalUtc: 'May 10 21:15 UTC', family: 'EUHFORIA' },
  { id: 'cme-4', method: 'WSA-ENLIL+Cone (SWPC)', issuedUtc: 'May 09 01:12 UTC', arrivalUtc: 'May 10 23:00 UTC', family: 'ENLIL' },
  { id: 'cme-5', method: 'HUXt (Ensemble)', issuedUtc: 'May 09 11:05 UTC', arrivalUtc: 'May 11 01:30 UTC', family: 'HUXt' },
  { id: 'cme-6', method: 'EAMv2', issuedUtc: 'May 09 15:48 UTC', arrivalUtc: 'May 11 02:18 UTC', family: 'Other' },
  { id: 'cme-7', method: 'SARM', issuedUtc: 'May 09 16:30 UTC', arrivalUtc: 'May 11 04:11 UTC', family: 'Other' },
] as const;

const REPLAY_CHECKPOINTS = [
  { id: '2024-05-09T18:00:00Z', label: 'May 9 · Pre-Arrival' },
  { id: '2024-05-10T16:45:00Z', label: 'May 10 · Shock Onset' },
  { id: '2024-05-11T03:00:00Z', label: 'May 11 · G5 Peak' },
  { id: '2024-05-12T06:00:00Z', label: 'May 12 · Recovery' },
] as const;

export function StormTrackScreen({
  mode,
  onChangeMode,
  onOpenWhy,
  onOpenGroundTruth,
}: StormTrackScreenProps) {
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string>(REPLAY_CHECKPOINTS[2].id);
  const [showAllSubmissions, setShowAllSubmissions] = useState(false);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* SCREEN SUBTITLE & PROVENANCE */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleBox}>
          <Text style={styles.screenNumber}>1. Storm Track</Text>
          <Text style={styles.screenSubtitle}>
            {mode === 'replay'
              ? 'Verified May 2024 CME Scoreboard ensemble · NASA CCMC'
              : 'Near-Earth solar wind & IMF Bz context · NOAA SWPC RTSW'}
          </Text>
        </View>
        <View style={styles.provenanceBadge}>
          <Text style={styles.provenanceBadgeText}>
            {mode === 'replay' ? 'ISSUED_FORECAST · ARCHIVAL' : 'MEASURED_LIVE · SNAPSHOT'}
          </Text>
        </View>
      </View>

      {/* CLOCK MODE SELECTOR (SHARED LIVE / REPLAY CONCEPT) */}
      <View style={styles.modeSelectorRow}>
        <Pressable
          onPress={() => onChangeMode('replay')}
          style={[styles.modeBtn, mode === 'replay' && styles.modeBtnActive]}
        >
          <Text style={[styles.modeBtnText, mode === 'replay' && styles.modeBtnTextActive]}>
            ⏱️ Historical Replay (May 2024)
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onChangeMode('live')}
          style={[styles.modeBtn, mode === 'live' && styles.modeBtnActive]}
        >
          <Text style={[styles.modeBtnText, mode === 'live' && styles.modeBtnTextActive]}>
            📡 Live Upstream Snapshot
          </Text>
        </Pressable>
      </View>

      {/* INTERACTIVE 3D SUN-TO-EARTH CME & CARRINGTON SIMULATOR */}
      <SolarStorm3DView initialScenario={mode === 'replay' ? 'MAY_2024_G5' : 'QUIET_SOLAR_WIND'} compact />

      {mode === 'replay' ? (
        <>
          {/* REPLAY TIME CHECKPOINTS (NO FABRICATED EXTRAPOLATION) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizonScroll}
          >
            {REPLAY_CHECKPOINTS.map((cp) => {
              const active = selectedCheckpoint === cp.id;
              return (
                <Pressable
                  key={cp.id}
                  onPress={() => setSelectedCheckpoint(cp.id)}
                  style={[styles.horizonPill, active && styles.horizonPillActive]}
                >
                  <Text style={[styles.horizonText, active && styles.horizonTextActive]}>
                    {cp.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* CME ENSEMBLE ARRIVAL VISUAL CARD */}
          <View style={styles.cmeCard}>
            <View style={styles.cmeCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cmeTitle}>CME 2024-05-08T12:24:00-CME-001</Text>
                <Text style={styles.cmeSubtitle}>
                  10 pre-outcome submissions across 7 distinct models (NASA CCMC)
                </Text>
              </View>
              <View style={styles.arrivalWindowBadge}>
                <Text style={styles.arrivalWindowLabel}>ENSEMBLE ARRIVAL RANGE</Text>
                <Text style={styles.arrivalWindowTime}>May 10, 12:58 – May 11, 04:11 UTC</Text>
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

                {/* Ensemble Uncertainty Fan Background */}
                <Path
                  d="M 38 90 C 120 40, 200 45, 290 75 L 290 105 C 200 135, 120 140, 38 90 Z"
                  fill="#00e5ff"
                  fillOpacity="0.07"
                />

                {/* WSA-ENLIL+Cone Range (Amber) */}
                <Path
                  d="M 38 88 C 110 50, 210 55, 288 80"
                  stroke="#ffd58c"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="4,2"
                />

                {/* EUHFORIA / HUXt Range (Cyan/Blue) */}
                <Path
                  d="M 38 92 C 110 130, 210 125, 288 100"
                  stroke="#64b5f6"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="4,2"
                />

                {/* DBEM / EAMv2 / SARM (Muted Violet) */}
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

                {/* Median Ensemble Trajectory (Solid Cyan/Teal Gradient) */}
                <Path
                  d="M 38 90 C 120 90, 200 88, 288 90"
                  stroke="url(#mostLikelyGrad)"
                  strokeWidth="3.5"
                  fill="none"
                />

                {/* Arrival Window Target Line */}
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
                <Text style={styles.legendText}>WSA-ENLIL+Cone (NOAA/M2M)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#64b5f6' }]} />
                <Text style={styles.legendText}>EUHFORIA &amp; HUXt</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#9575cd' }]} />
                <Text style={styles.legendText}>DBEM · EAMv2 · SARM</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#00e5ff' }]} />
                <Text style={styles.legendText}>Ensemble median path (schematic)</Text>
              </View>
            </View>
          </View>

          {/* ENSEMBLE ARRIVAL SPREAD & UNCERTAINTY CARD (NO INVENTED 62% CONFIDENCE) */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Ensemble arrival spread · Pre-outcome</Text>
              <Text style={styles.confidenceScore}>15.2 h spread (10 runs)</Text>
            </View>

            <Text style={styles.uncertaintyNote}>
              Model spread measures arrival-time disagreement across independent forecasting methods—not a calibrated probability percentage. Earth-impacting IMF Bz orientation remains uncertain until measured at L1.
            </Text>

            {/* Spread Visual Bar */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: '74%' }]} />
            </View>

            {/* Verified Milestone Timeline */}
            <View style={styles.timelineRow}>
              <View style={styles.timelineItem}>
                <Text style={styles.timelineTitle}>CME Eruption</Text>
                <Text style={styles.timelineTime}>May 08, 12:24</Text>
              </View>
              <View style={styles.timelineItem}>
                <Text style={styles.timelineTitle}>Earliest Model</Text>
                <Text style={styles.timelineTime}>May 10, 12:58</Text>
              </View>
              <View style={styles.timelineItem}>
                <Text style={styles.timelineTitle}>Observed Shock</Text>
                <Text style={[styles.timelineTime, { color: colors.mint, fontWeight: '700' }]}>
                  May 10, 16:45
                </Text>
              </View>
              <View style={styles.timelineItem}>
                <Text style={styles.timelineTitle}>Latest Model</Text>
                <Text style={styles.timelineTime}>May 11, 04:11</Text>
              </View>
            </View>

            {/* Expandable Original Submissions Table */}
            <Pressable
              onPress={() => setShowAllSubmissions(!showAllSubmissions)}
              style={styles.toggleTableBtn}
            >
              <Text style={styles.toggleTableBtnText}>
                {showAllSubmissions
                  ? '▾ Hide NASA CCMC Scoreboard submissions'
                  : '▸ Inspect verified NASA CCMC Scoreboard submissions'}
              </Text>
            </Pressable>

            {showAllSubmissions && (
              <View style={styles.tableBox}>
                {VERIFIED_CME_SUBMISSIONS.map((sub) => (
                  <View key={sub.id} style={styles.tableRow}>
                    <Text style={styles.tableMethod}>{sub.method}</Text>
                    <Text style={styles.tableTime}>Est: {sub.arrivalUtc}</Text>
                  </View>
                ))}
                <Text style={styles.finePrint}>
                  Source: NASA CCMC CME Scoreboard (2024-05-08T12:24:00-CME-001). Later 2025 post-event rows excluded.
                </Text>
              </View>
            )}
          </View>
        </>
      ) : (
        /* LIVE UPSTREAM SOLAR WIND MODE */
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>NOAA SWPC Real-Time Solar Wind (L1)</Text>
            <Text style={[styles.confidenceScore, { color: colors.mint }]}>RTSW 1-MIN</Text>
          </View>
          <Text style={styles.uncertaintyNote}>
            Near-Earth L1 satellite measurements (DSCOVR / ACE) provide 30–60 minutes of upstream warning before solar wind plasma reaches the dayside magnetopause. They do not provide a multi-day CME arrival forecast.
          </Text>
          <View style={styles.liveStatsGrid}>
            <View style={styles.liveStatBox}>
              <Text style={styles.liveStatLabel}>IMF Bz (GSM)</Text>
              <Text style={[styles.liveStatVal, { color: colors.violet }]}>Live Snapshot</Text>
              <Text style={styles.liveStatSub}>Southward (-Bz) drives reconnection</Text>
            </View>
            <View style={styles.liveStatBox}>
              <Text style={styles.liveStatLabel}>SOLAR WIND SPEED</Text>
              <Text style={[styles.liveStatVal, { color: colors.cyan }]}>km/s · L1</Text>
              <Text style={styles.liveStatSub}>400 km/s quiet · 600+ km/s storm</Text>
            </View>
          </View>
        </View>
      )}

      {/* COMPARE WITH GROUND TRUTH CARD */}
      <Pressable onPress={onOpenGroundTruth} style={styles.actionCard}>
        <View style={styles.actionIconBox}>
          <Text style={styles.actionIcon}>🧭</Text>
        </View>
        <View style={styles.actionTextBox}>
          <Text style={styles.actionTitle}>What happened on the ground?</Text>
          <Text style={styles.actionSubtitle}>
            Compare solar storm predictions with USGS Boulder and your smartphone sensor in Ground Truth.
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
            Follow the 5-step physical chain from solar eruption to magnetic reconnection and auroral light.
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
    color: colors.cyan,
    letterSpacing: 0.4,
  },
  modeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#193558',
    borderColor: colors.cyan,
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  modeBtnTextActive: {
    color: colors.ink,
    fontWeight: '800',
  },
  horizonScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  horizonPill: {
    paddingHorizontal: 12,
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
    fontSize: 11.5,
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
    fontSize: 13.5,
    fontWeight: '800',
    color: colors.ink,
  },
  cmeSubtitle: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
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
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  confidenceScore: {
    fontSize: 11.5,
    fontWeight: '800',
    color: colors.cyan,
  },
  uncertaintyNote: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
    marginBottom: 10,
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
  toggleTableBtn: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#12253d',
  },
  toggleTableBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.cyan,
  },
  tableBox: {
    marginTop: 8,
    backgroundColor: '#061221',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#0f2238',
    paddingBottom: 4,
  },
  tableMethod: {
    fontSize: 10.5,
    color: colors.ink,
    fontWeight: '600',
  },
  tableTime: {
    fontSize: 10.5,
    color: colors.amber,
    fontWeight: '700',
  },
  finePrint: {
    fontSize: 9.5,
    color: colors.muted,
    marginTop: 4,
    lineHeight: 14,
  },
  liveStatsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  liveStatBox: {
    flex: 1,
    backgroundColor: '#061324',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#153152',
  },
  liveStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.muted,
  },
  liveStatVal: {
    fontSize: 14,
    fontWeight: '800',
    marginVertical: 3,
  },
  liveStatSub: {
    fontSize: 9.5,
    color: colors.muted,
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
    backgroundColor: '#0c2838',
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
