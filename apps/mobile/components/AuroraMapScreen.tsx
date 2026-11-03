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

interface AuroraMapScreenProps {
  mode: 'replay' | 'live';
  onChangeMode: (mode: 'replay' | 'live') => void;
  onOpenSightings?: () => void;
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

const COARSE_REGIONS = [
  { id: 'boulder', name: 'Boulder, CO (40.0°N)', lat: 40.0, magLat: 48.6, look: 'Northern Horizon (low elevation)' },
  { id: 'fairbanks', name: 'Fairbanks, AK (64.8°N)', lat: 64.8, magLat: 65.4, look: 'Overhead Zenith & North' },
  { id: 'reykjavik', name: 'Reykjavik, IS (64.1°N)', lat: 64.1, magLat: 64.5, look: 'Overhead Auroral Oval' },
  { id: 'tromso', name: 'Tromsø, NO (69.6°N)', lat: 69.6, magLat: 66.7, look: 'Overhead & Southern Arc' },
] as const;

const LAYERS = [
  { id: 'aurora', label: 'Modeled activity' },
  { id: 'ground', label: 'Ground evidence' },
  { id: 'darkness', label: 'Twilight / Night' },
] as const;

export function AuroraMapScreen({ mode, onChangeMode, onOpenSightings }: AuroraMapScreenProps) {
  const [hemisphere, setHemisphere] = useState<'north' | 'south'>('north');
  const [activeLayer, setActiveLayer] = useState<'aurora' | 'ground' | 'darkness'>('aurora');
  const [selectedRegionIdx, setSelectedRegionIdx] = useState(0);

  const region = COARSE_REGIONS[selectedRegionIdx];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* SCREEN SUBTITLE & PROVENANCE */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleBox}>
          <Text style={styles.screenNumber}>2. Aurora Map</Text>
          <Text style={styles.screenSubtitle}>
            Activity is a clue. Visibility is local (darkness + clear sky).
          </Text>
        </View>
        <View style={styles.provenanceBadge}>
          <Text style={styles.provenanceBadgeText}>
            {mode === 'live' ? 'NOAA OVATION · MODEL' : 'REPLAY · BOU GROUND'}
          </Text>
        </View>
      </View>

      {/* SHARED MODE & HEMISPHERE TOOLBAR */}
      <View style={styles.toolbarRow}>
        <View style={styles.segmentedGroup}>
          <Pressable
            onPress={() => onChangeMode('live')}
            style={[styles.segBtn, mode === 'live' && styles.segBtnActive]}
          >
            <Text style={[styles.segText, mode === 'live' && styles.segTextActive]}>
              Live OVATION (~30–90m)
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onChangeMode('replay')}
            style={[styles.segBtn, mode === 'replay' && styles.segBtnActive]}
          >
            <Text style={[styles.segText, mode === 'replay' && styles.segTextActive]}>
              May 2024 Replay
            </Text>
          </Pressable>
        </View>

        <View style={styles.segmentedGroup}>
          <Pressable
            onPress={() => setHemisphere('north')}
            style={[styles.segBtn, hemisphere === 'north' && styles.segBtnActive]}
          >
            <Text style={[styles.segText, hemisphere === 'north' && styles.segTextActive]}>N</Text>
          </Pressable>
          <Pressable
            onPress={() => setHemisphere('south')}
            style={[styles.segBtn, hemisphere === 'south' && styles.segBtnActive]}
          >
            <Text style={[styles.segText, hemisphere === 'south' && styles.segTextActive]}>S</Text>
          </Pressable>
        </View>
      </View>

      {/* POLAR MAP CARD */}
      <View style={styles.mapCard}>
        <View style={styles.polarSvgWrapper}>
          <Svg width="100%" height={250} viewBox="0 0 300 250">
            <Defs>
              <RadialGradient id="oceanGrad" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor="#0b233a" />
                <Stop offset="80%" stopColor="#051524" />
                <Stop offset="100%" stopColor="#030c14" />
              </RadialGradient>
              <RadialGradient id="auroraOvalGlow" cx="50%" cy="48%" rx="50%" ry="50%">
                <Stop offset="40%" stopColor="#00e5ff" stopOpacity="0" />
                <Stop offset="55%" stopColor="#20c997" stopOpacity={mode === 'live' ? '0.82' : '0.45'} />
                <Stop offset="68%" stopColor="#ffd58c" stopOpacity={mode === 'live' ? '0.88' : '0.50'} />
                <Stop offset="75%" stopColor="#ff5252" stopOpacity={mode === 'live' ? '0.70' : '0.35'} />
                <Stop offset="90%" stopColor="#ff5252" stopOpacity="0" />
              </RadialGradient>
            </Defs>

            {/* Earth Globe Background */}
            <Circle cx="150" cy="125" r="112" fill="url(#oceanGrad)" stroke="#1a3f66" strokeWidth="1.5" />

            {/* Twilight / Night Shading Overlay */}
            {activeLayer === 'darkness' && (
              <Path
                d="M 38 125 A 112 112 0 0 1 262 125 Z"
                fill="#02060d"
                opacity="0.55"
              />
            )}

            {/* Graticule Latitude Rings (80°, 65°, 50°) */}
            <Circle cx="150" cy="125" r="34" stroke="#1d4873" strokeWidth="1" strokeDasharray="3,3" fill="none" opacity="0.6" />
            <Circle cx="150" cy="125" r="68" stroke="#1d4873" strokeWidth="1" strokeDasharray="3,3" fill="none" opacity="0.6" />
            <Circle cx="150" cy="125" r="102" stroke="#1d4873" strokeWidth="1" strokeDasharray="3,3" fill="none" opacity="0.6" />

            {/* Longitude Crosshair Graticules (0, 90W, 180, 90E) */}
            <Path d="M 150 13 L 150 237" stroke="#1d4873" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
            <Path d="M 38 125 L 262 125" stroke="#1d4873" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />

            {/* Schematic Landmasses */}
            <Path
              d="M 140 96 Q 148 81, 158 88 Q 165 101, 155 114 Q 145 111, 140 96 Z"
              fill="#163854"
              stroke="#245885"
              strokeWidth="1"
            />
            <Path
              d="M 90 86 Q 75 106, 85 136 Q 110 156, 130 151 Q 120 131, 110 111 Q 100 91, 90 86 Z"
              fill="#163854"
              stroke="#245885"
              strokeWidth="1"
            />
            <Path
              d="M 165 71 Q 185 76, 205 91 Q 220 116, 205 136 Q 185 131, 175 106 Z"
              fill="#163854"
              stroke="#245885"
              strokeWidth="1"
            />

            {/* Modeled Auroral Oval Ring */}
            <Circle cx="150" cy="121" r="70" fill="url(#auroraOvalGlow)" opacity="0.88" />

            {/* USGS Boulder Reference Marker */}
            <Circle cx="98" cy="158" r="4.5" fill={colors.mint} stroke="#ffffff" strokeWidth="1.2" />
            <SvgText x="98" y="171" fill={colors.mint} fontSize="8" fontWeight="800" textAnchor="middle">
              BOU (40°N)
            </SvgText>

            {/* Geomagnetic Pole Marker */}
            <Circle cx="150" cy="121" r="3.5" fill="#ffd58c" />
            <SvgText x="150" y="109" fill="#ffd58c" fontSize="8" fontWeight="800" textAnchor="middle">
              {hemisphere === 'north' ? 'Geographic / Polar North' : 'Geographic / Polar South'}
            </SvgText>

            {/* Graticule Coordinate Labels */}
            <SvgText x="150" y="10" fill="#7fa2c4" fontSize="8.5" fontWeight="bold" textAnchor="middle">
              180°
            </SvgText>
            <SvgText x="24" y="128" fill="#7fa2c4" fontSize="8.5" fontWeight="bold">
              90°W
            </SvgText>
            <SvgText x="265" y="128" fill="#7fa2c4" fontSize="8.5" fontWeight="bold">
              90°E
            </SvgText>
            <SvgText x="150" y="247" fill="#7fa2c4" fontSize="8.5" fontWeight="bold" textAnchor="middle">
              0°
            </SvgText>
          </Svg>
        </View>

        {/* HEATMAP COLOR SCALE */}
        <View style={styles.legendContainer}>
          <View style={styles.legendBarLabels}>
            <Text style={styles.legendLabel}>Lower modeled activity</Text>
            <Text style={styles.legendLabel}>Higher modeled activity</Text>
          </View>
          <View style={styles.legendGradientBar}>
            <Svg width="100%" height={6}>
              <Defs>
                <LinearGradient id="scaleBarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#3b82f6" />
                  <Stop offset="30%" stopColor="#00e5ff" />
                  <Stop offset="55%" stopColor="#20c997" />
                  <Stop offset="75%" stopColor="#ffd58c" />
                  <Stop offset="100%" stopColor="#ff5252" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="6" rx="3" fill="url(#scaleBarGrad)" />
            </Svg>
          </View>
          <Text style={styles.horizonCaption}>
            {mode === 'live'
              ? 'Forecast horizon supplied by NOAA OVATION only (never extrapolated to +72h).'
              : 'Historical May 2024 OVATION archive unavailable; current NOAA grid is never relabeled as 2024.'}
          </Text>
        </View>

        {/* LAYER TOGGLE BUTTONS */}
        <View style={styles.layersRow}>
          {LAYERS.map((layer) => {
            const active = activeLayer === layer.id;
            return (
              <Pressable
                key={layer.id}
                onPress={() => setActiveLayer(layer.id)}
                style={[styles.layerButton, active && styles.layerButtonActive]}
              >
                <Text style={[styles.layerButtonText, active && styles.layerButtonTextActive]}>
                  {layer.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* COARSE VIEWING REGION & LOCAL VISIBILITY CONDITIONS */}
      <View style={styles.regionCard}>
        <Text style={styles.regionCardTitle}>COARSE VIEWING REGION (NO GPS REQUIRED)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionPills}>
          {COARSE_REGIONS.map((r, idx) => {
            const active = selectedRegionIdx === idx;
            return (
              <Pressable
                key={r.id}
                onPress={() => setSelectedRegionIdx(idx)}
                style={[styles.regionPill, active && styles.regionPillActive]}
              >
                <Text style={[styles.regionPillText, active && styles.regionPillTextActive]}>
                  {r.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.regionMetricsGrid}>
          <View style={styles.regionMetricBox}>
            <Text style={styles.regionMetricLabel}>MAG LATITUDE (APPROX)</Text>
            <Text style={styles.regionMetricVal}>~{region.magLat}°</Text>
            <Text style={styles.regionMetricSub}>{region.look}</Text>
          </View>
          <View style={styles.regionMetricBox}>
            <Text style={styles.regionMetricLabel}>CLOUD COVER FEED</Text>
            <Text style={[styles.regionMetricVal, { color: colors.amber }]}>Unknown</Text>
            <Text style={styles.regionMetricSub}>No live weather API connected</Text>
          </View>
        </View>
      </View>

      {/* SCIENTIFIC HONESTY CALLOUT */}
      <View style={styles.calloutCard}>
        <View style={styles.calloutIconBox}>
          <Text style={styles.calloutIcon}>ℹ️</Text>
        </View>
        <View style={styles.calloutTextBox}>
          <Text style={styles.calloutTitle}>
            Modeled auroral activity ≠ guaranteed visible aurora
          </Text>
          <Text style={styles.calloutBody}>
            Magnetometers measure magnetic fields, not photons. Visual sightings require astronomical darkness, clear skies, and active particle precipitation.
          </Text>
        </View>
      </View>

      {/* HONEST OPTICAL SIGHTINGS & SAM 3.1 SCHEMA CARD */}
      <Pressable onPress={onOpenSightings} style={styles.sightingsCard}>
        <View style={styles.sightingsHeader}>
          <View style={styles.cameraIconBox}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
          <View style={styles.sightingsTitleBox}>
            <Text style={styles.sightingsTitle}>Confirmed Optical Sightings: 0 Loaded</Text>
            <Text style={styles.sightingsSub}>
              No verified community sky photos are loaded in this fixture.
            </Text>
          </View>
          <View style={styles.noneBadge}>
            <Text style={styles.noneBadgeText}>NONE LOADED</Text>
          </View>
        </View>
        <Text style={styles.sightingsBody}>
          When adult opt-in sky photos are submitted, our Meta SAM 3.1 segmentation pipeline is designed to separate 557.7 nm green / 630.0 nm red auroral arcs from clouds and urban light domes. Tap to learn how upper-atmosphere emissions work.
        </Text>
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
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  segmentedGroup: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  segBtnActive: {
    backgroundColor: colors.violet,
  },
  segText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
  },
  segTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  mapCard: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  polarSvgWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendContainer: {
    width: '100%',
    marginTop: 8,
    marginBottom: 12,
  },
  legendBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  legendLabel: {
    fontSize: 10,
    color: colors.muted,
  },
  legendGradientBar: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  horizonCaption: {
    fontSize: 9.5,
    color: colors.muted,
    marginTop: 5,
    textAlign: 'center',
  },
  layersRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  layerButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  layerButtonActive: {
    backgroundColor: '#1b3b5e',
    borderColor: colors.cyan,
  },
  layerButtonText: {
    fontSize: 10.5,
    color: colors.muted,
    fontWeight: '600',
  },
  layerButtonTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  regionCard: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  regionCardTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.cyan,
    letterSpacing: 0.8,
  },
  regionPills: {
    flexDirection: 'row',
    gap: 8,
  },
  regionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  regionPillActive: {
    backgroundColor: '#17385c',
    borderColor: colors.mint,
  },
  regionPillText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
  },
  regionPillTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  regionMetricsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  regionMetricBox: {
    flex: 1,
    backgroundColor: '#061221',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#132a45',
  },
  regionMetricLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.muted,
  },
  regionMetricVal: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
    marginVertical: 2,
  },
  regionMetricSub: {
    fontSize: 9.5,
    color: colors.muted,
  },
  calloutCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#071829',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#193f66',
    gap: 10,
  },
  calloutIconBox: {
    marginTop: 1,
  },
  calloutIcon: {
    fontSize: 16,
  },
  calloutTextBox: {
    flex: 1,
  },
  calloutTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  calloutBody: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 15,
  },
  sightingsCard: {
    backgroundColor: colors.panel,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sightingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  cameraIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#271c47',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    fontSize: 16,
  },
  sightingsTitleBox: {
    flex: 1,
  },
  sightingsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  sightingsSub: {
    fontSize: 10.5,
    color: colors.muted,
    marginTop: 1,
  },
  noneBadge: {
    backgroundColor: '#1a2738',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#304969',
  },
  noneBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: colors.amber,
  },
  sightingsBody: {
    fontSize: 11,
    color: colors.muted,
    lineHeight: 16,
  },
});
