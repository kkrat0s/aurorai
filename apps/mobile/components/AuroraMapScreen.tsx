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

const MAP_TIMES = ['Now', '+30 min', '+1 hour', '+3 hours'];
const LAYERS = [
  { id: 'aurora', label: 'Aurora probability' },
  { id: 'clouds', label: 'Cloud cover' },
  { id: 'darkness', label: 'Darkness (night)' },
] as const;

export function AuroraMapScreen({ onOpenSightings }: AuroraMapScreenProps) {
  const [selectedTime, setSelectedTime] = useState('Now');
  const [activeLayer, setActiveLayer] = useState<'aurora' | 'clouds' | 'darkness'>('aurora');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* SCREEN SUBTITLE */}
      <View style={styles.headerTitleBox}>
        <Text style={styles.screenNumber}>2. Aurora Map</Text>
        <Text style={styles.screenSubtitle}>Where aurora may be visible</Text>
      </View>

      {/* TIME HORIZON PILLS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timeScroll}
      >
        {MAP_TIMES.map((t) => {
          const active = selectedTime === t;
          return (
            <Pressable
              key={t}
              onPress={() => setSelectedTime(t)}
              style={[styles.timePill, active && styles.timePillActive]}
            >
              <Text style={[styles.timeText, active && styles.timeTextActive]}>{t}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* POLAR MAP CARD */}
      <View style={styles.mapCard}>
        <View style={styles.polarSvgWrapper}>
          <Svg width="100%" height={260} viewBox="0 0 300 260">
            <Defs>
              <RadialGradient id="oceanGrad" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0%" stopColor="#0b233a" />
                <Stop offset="80%" stopColor="#051524" />
                <Stop offset="100%" stopColor="#030c14" />
              </RadialGradient>
              <RadialGradient id="auroraOvalGlow" cx="50%" cy="48%" rx="50%" ry="50%">
                <Stop offset="40%" stopColor="#00e5ff" stopOpacity="0" />
                <Stop offset="55%" stopColor="#20c997" stopOpacity="0.85" />
                <Stop offset="68%" stopColor="#ffd58c" stopOpacity="0.9" />
                <Stop offset="75%" stopColor="#ff5252" stopOpacity="0.75" />
                <Stop offset="90%" stopColor="#ff5252" stopOpacity="0" />
              </RadialGradient>
              <LinearGradient id="legendGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#3b82f6" />
                <Stop offset="25%" stopColor="#00e5ff" />
                <Stop offset="50%" stopColor="#20c997" />
                <Stop offset="75%" stopColor="#ffd58c" />
                <Stop offset="100%" stopColor="#ff5252" />
              </LinearGradient>
            </Defs>

            {/* Earth Globe Background */}
            <Circle cx="150" cy="130" r="115" fill="url(#oceanGrad)" stroke="#1a3f66" strokeWidth="1.5" />

            {/* Graticule Latitude Rings (80N, 65N, 50N) */}
            <Circle cx="150" cy="130" r="35" stroke="#1d4873" strokeWidth="1" strokeDasharray="3,3" fill="none" opacity="0.6" />
            <Circle cx="150" cy="130" r="70" stroke="#1d4873" strokeWidth="1" strokeDasharray="3,3" fill="none" opacity="0.6" />
            <Circle cx="150" cy="130" r="105" stroke="#1d4873" strokeWidth="1" strokeDasharray="3,3" fill="none" opacity="0.6" />

            {/* Longitude Crosshair Graticules (0, 90W, 180, 90E) */}
            <Path d="M 150 15 L 150 245" stroke="#1d4873" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
            <Path d="M 35 130 L 265 130" stroke="#1d4873" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />

            {/* Landmass Outlines (Greenland, North America, Eurasia) */}
            {/* Greenland */}
            <Path
              d="M 140 100 Q 148 85, 158 92 Q 165 105, 155 118 Q 145 115, 140 100 Z"
              fill="#163854"
              stroke="#245885"
              strokeWidth="1"
            />
            {/* North America / Alaska */}
            <Path
              d="M 90 90 Q 75 110, 85 140 Q 110 160, 130 155 Q 120 135, 110 115 Q 100 95, 90 90 Z"
              fill="#163854"
              stroke="#245885"
              strokeWidth="1"
            />
            {/* Scandinavia & Northern Eurasia */}
            <Path
              d="M 165 75 Q 185 80, 205 95 Q 220 120, 205 140 Q 185 135, 175 110 Z"
              fill="#163854"
              stroke="#245885"
              strokeWidth="1"
            />

            {/* Dynamic Auroral Oval Ring (Glowing Heatmap) */}
            <Circle cx="150" cy="125" r="72" fill="url(#auroraOvalGlow)" opacity="0.88" />

            {/* Magnetic North Pole Center Marker */}
            <Circle cx="150" cy="125" r="3.5" fill="#ffd58c" />
            <SvgText x="150" y="112" fill="#ffd58c" fontSize="8" fontWeight="800" textAnchor="middle">
              Magnetic North Pole
            </SvgText>

            {/* Graticule Coordinate Labels */}
            <SvgText x="150" y="11" fill="#7fa2c4" fontSize="8.5" fontWeight="bold" textAnchor="middle">
              180°
            </SvgText>
            <SvgText x="28" y="133" fill="#7fa2c4" fontSize="8.5" fontWeight="bold">
              90°W
            </SvgText>
            <SvgText x="268" y="133" fill="#7fa2c4" fontSize="8.5" fontWeight="bold">
              90°E
            </SvgText>
            <SvgText x="150" y="256" fill="#7fa2c4" fontSize="8.5" fontWeight="bold" textAnchor="middle">
              0°
            </SvgText>
          </Svg>
        </View>

        {/* HEATMAP COLOR SCALE */}
        <View style={styles.legendContainer}>
          <View style={styles.legendBarLabels}>
            <Text style={styles.legendLabel}>Lower chance</Text>
            <Text style={styles.legendLabel}>Higher chance</Text>
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
            Visibility depends on sky conditions, local darkness, and real-time magnetic activity.
          </Text>
        </View>
      </View>

      {/* COMMUNITY SIGHTINGS GALLERY CARD */}
      <Pressable onPress={onOpenSightings} style={styles.sightingsCard}>
        <View style={styles.sightingsHeader}>
          <View style={styles.cameraIconBox}>
            <Text style={styles.cameraIcon}>📷</Text>
          </View>
          <View style={styles.sightingsTitleBox}>
            <Text style={styles.sightingsTitle}>See recent sightings from the community</Text>
            <Text style={styles.sightingsSub}>Verified photos and human optical reports</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </View>

        {/* THUMBNAILS PREVIEW ROW */}
        <View style={styles.thumbRow}>
          <View style={[styles.thumbBox, { backgroundColor: '#0e382b' }]}>
            <Text style={styles.thumbLabel}>Fairbanks</Text>
            <Text style={styles.thumbSub}>Curtain 557nm</Text>
          </View>
          <View style={[styles.thumbBox, { backgroundColor: '#1a1840' }]}>
            <Text style={styles.thumbLabel}>Tromsø</Text>
            <Text style={styles.thumbSub}>Corona</Text>
          </View>
          <View style={[styles.thumbBox, { backgroundColor: '#2e122b' }]}>
            <Text style={styles.thumbLabel}>Yellowknife</Text>
            <Text style={styles.thumbSub}>Red Arc</Text>
          </View>
          <View style={[styles.thumbBox, { backgroundColor: '#10273b' }]}>
            <Text style={styles.thumbLabel}>Reykjavik</Text>
            <Text style={styles.thumbSub}>Pulsating</Text>
          </View>
        </View>
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
  timeScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  timePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timePillActive: {
    backgroundColor: colors.violet,
    borderColor: '#988cfc',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  timeTextActive: {
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
    marginBottom: 10,
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
  actionChevron: {
    fontSize: 20,
    color: colors.muted,
    fontWeight: '300',
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 8,
  },
  thumbBox: {
    flex: 1,
    height: 52,
    borderRadius: 8,
    padding: 6,
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: '#243e5c',
  },
  thumbLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.ink,
  },
  thumbSub: {
    fontSize: 8,
    color: '#9bc8eb',
  },
});
