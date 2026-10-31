import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UNIVERSAL_FINGERPRINT_DATABASE, type DisturbanceClassId } from '@aurorasense/shared/magnetic-classifier';

interface MagneticFieldScaleBarProps {
  currentDeltaNanoT: number; // in nT (e.g. 1500 nT = 1.5 µT)
  activeClassId?: DisturbanceClassId;
  onSelectClass?: (classId: DisturbanceClassId) => void;
}

interface ScaleZone {
  id: string;
  classId?: DisturbanceClassId;
  label: string;
  icon: string;
  rangeNanoT: [number, number];
  color: string;
  percentRange: [number, number]; // [startPct, endPct] on the visual bar
  description: string;
  electrodynamics: string;
}

const SCALE_ZONES: ScaleZone[] = [
  {
    id: 'solar_storm',
    classId: 'GEOMAGNETIC_SOLAR_DISTURBANCE',
    label: 'Solar Storm',
    icon: '☀️',
    rangeNanoT: [50, 500],
    color: '#4dd0e1',
    percentRange: [0, 20],
    description: 'Natural ionospheric reconnection perturbation from CME solar wind (50–500 nT).',
    electrodynamics: 'Geomagnetic Hall currents in ionosphere ~100 km altitude.',
  },
  {
    id: 'human_hand',
    classId: 'HUMAN_HAND_GESTURE',
    label: 'Hand / Body',
    icon: '🖐️',
    rangeNanoT: [500, 3800],
    color: '#64b5f6',
    percentRange: [20, 42],
    description: 'Human hand proximity, capacitive coupling, and physiological micro-tremor (500–3,800 nT).',
    electrodynamics: 'Diamagnetic tissue micro-tilt & phone sensor enclosure deformation.',
  },
  {
    id: 'charging_cable',
    classId: 'CHARGING_CABLE_INDUCTION',
    label: 'Charger',
    icon: '🔌',
    rangeNanoT: [2500, 20000],
    color: '#ffb74d',
    percentRange: [42, 64],
    description: 'USB-C / MagSafe / Qi charging current induction (2,500–20,000 nT).',
    electrodynamics: "Biot-Savart cylindrical DC field (B = µ₀I/2πr) + AC switching ripple.",
  },
  {
    id: 'laptop_computer',
    classId: 'LAPTOP_OR_COMPUTER',
    label: 'Laptop / PC',
    icon: '💻',
    rangeNanoT: [15000, 35000],
    color: '#ba68c8',
    percentRange: [64, 82],
    description: 'Nearby laptop, monitor, or PC switching power supplies (15,000–35,000 nT).',
    electrodynamics: 'VRM inductors, display inverters, and cooling fan magnetic motors.',
  },
  {
    id: 'smartwatch_magnet',
    classId: 'SMARTWATCH_OR_MAGNET',
    label: 'Smartwatch',
    icon: '⌚',
    rangeNanoT: [35000, 60000],
    color: '#ff7043',
    percentRange: [82, 100],
    description: 'Milanese clasp, magnetic phone case, or neodymium magnet (35,000–60,000+ nT).',
    electrodynamics: 'Permanent magnetic dipole with steep 1/r³ falloff gradient.',
  },
];

/**
 * Maps a delta in nanoTesla (0 to 60,000 nT) to a percentage position [0, 100]% on the scale bar.
 * Uses piecewise non-linear scaling to provide high resolution across both low solar storm levels
 * and high electronics/magnet levels.
 */
function nanoTeslaToPercent(deltaNt: number): number {
  const absNt = Math.max(0, Math.abs(deltaNt));
  if (absNt <= 500) {
    // 0 to 500 nT -> 0% to 20%
    return (absNt / 500) * 20;
  } else if (absNt <= 4000) {
    // 500 to 4,000 nT -> 20% to 42%
    return 20 + ((absNt - 500) / 3500) * 22;
  } else if (absNt <= 20000) {
    // 4,000 to 20,000 nT -> 42% to 64%
    return 42 + ((absNt - 4000) / 16000) * 22;
  } else if (absNt <= 35000) {
    // 20,000 to 35,000 nT -> 64% to 82%
    return 64 + ((absNt - 20000) / 15000) * 18;
  } else {
    // 35,000 to 60,000+ nT -> 82% to 100%
    const pct = 82 + ((absNt - 35000) / 25000) * 18;
    return Math.min(100, pct);
  }
}

export function MagneticFieldScaleBar({
  currentDeltaNanoT,
  activeClassId,
  onSelectClass,
}: MagneticFieldScaleBarProps) {
  const [selectedZone, setSelectedZone] = useState<ScaleZone | null>(null);

  const absDeltaNt = Math.abs(currentDeltaNanoT);
  const pinPercent = nanoTeslaToPercent(absDeltaNt);

  // Find active zone
  const activeZone =
    SCALE_ZONES.find((z) => absDeltaNt >= z.rangeNanoT[0] && absDeltaNt <= z.rangeNanoT[1]) ??
    (absDeltaNt > 60000 ? SCALE_ZONES[SCALE_ZONES.length - 1] : SCALE_ZONES[0]);

  return (
    <View style={styles.container}>
      {/* Title & Live Status */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.eyebrow}>ELECTROMAGNETIC DISTURBANCE SCALE</Text>
          <Text style={styles.title}>Where Your Signal Lands</Text>
        </View>
        <View style={[styles.livePinBadge, { borderColor: activeZone.color }]}>
          <Text style={[styles.livePinText, { color: activeZone.color }]}>
            📍 Live: {absDeltaNt >= 1000 ? `+${(absDeltaNt / 1000).toFixed(1)} µT` : `+${absDeltaNt} nT`}
          </Text>
        </View>
      </View>

      {/* Segmented Color Spectrum Bar */}
      <View style={styles.barWrapper}>
        <View style={styles.track}>
          {SCALE_ZONES.map((zone) => {
            const widthPct = zone.percentRange[1] - zone.percentRange[0];
            const isZoneActive = activeZone.id === zone.id || (activeClassId && zone.classId === activeClassId);

            return (
              <Pressable
                key={zone.id}
                onPress={() => setSelectedZone(zone)}
                style={[
                  styles.segment,
                  {
                    width: `${widthPct}%`,
                    backgroundColor: zone.color,
                    opacity: isZoneActive ? 1.0 : 0.65,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Live Pin Marker */}
        <View
          style={[
            styles.pinIndicator,
            {
              left: `${Math.max(2, Math.min(97, pinPercent))}%`,
              borderColor: activeZone.color,
            },
          ]}
        >
          <View style={[styles.pinPoint, { backgroundColor: activeZone.color }]} />
        </View>
      </View>

      {/* Axis Scale Labels */}
      <View style={styles.ticksRow}>
        <Text style={styles.tickLabel}>0 nT</Text>
        <Text style={styles.tickLabel}>500 nT</Text>
        <Text style={styles.tickLabel}>4 µT</Text>
        <Text style={styles.tickLabel}>20 µT</Text>
        <Text style={styles.tickLabel}>35 µT</Text>
        <Text style={styles.tickLabel}>60+ µT</Text>
      </View>

      {/* Quick Interactive Zone Chips */}
      <View style={styles.chipsRow}>
        {SCALE_ZONES.map((zone) => {
          const isCurrent = activeZone.id === zone.id || (activeClassId && zone.classId === activeClassId);
          return (
            <Pressable
              key={zone.id}
              accessibilityRole="button"
              onPress={() => {
                setSelectedZone(zone);
                if (zone.classId && onSelectClass) {
                  onSelectClass(zone.classId);
                }
              }}
              style={[
                styles.chip,
                {
                  borderColor: isCurrent ? zone.color : '#253d5a',
                  backgroundColor: isCurrent ? `${zone.color}22` : '#0b1928',
                },
              ]}
            >
              <Text style={styles.chipIcon}>{zone.icon}</Text>
              <Text style={[styles.chipText, { color: isCurrent ? zone.color : '#9bb5cf' }]}>
                {zone.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Detailed Physics Popover / Drawer for Selected Zone */}
      {selectedZone && (
        <View style={[styles.detailCard, { borderColor: selectedZone.color }]}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>
              {selectedZone.icon} {selectedZone.label} ({selectedZone.rangeNanoT[0].toLocaleString()}–{selectedZone.rangeNanoT[1].toLocaleString()} nT)
            </Text>
            <Pressable onPress={() => setSelectedZone(null)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.detailDescription}>{selectedZone.description}</Text>
          <View style={styles.electrodynamicsBox}>
            <Text style={[styles.electrodynamicsLabel, { color: selectedZone.color }]}>
              ⚡ Electrodynamic Physics:
            </Text>
            <Text style={styles.electrodynamicsText}>{selectedZone.electrodynamics}</Text>
          </View>
          {selectedZone.classId && (
            <Text style={styles.mitigationNote}>
              {UNIVERSAL_FINGERPRINT_DATABASE[selectedZone.classId]?.mitigationAdvice}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a1727',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1d3753',
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  titleGroup: {
    flex: 1,
  },
  eyebrow: {
    color: '#7f9cb8',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    color: '#eff7ff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  livePinBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#071320',
  },
  livePinText: {
    fontSize: 11,
    fontWeight: '700',
  },
  barWrapper: {
    position: 'relative',
    height: 20,
    justifyContent: 'center',
    marginVertical: 4,
  },
  track: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#122538',
  },
  segment: {
    height: '100%',
  },
  pinIndicator: {
    position: 'absolute',
    top: -2,
    width: 6,
    height: 24,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    marginLeft: -3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 4,
  },
  pinPoint: {
    width: 3,
    height: 10,
    borderRadius: 1.5,
  },
  ticksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
    marginBottom: 8,
  },
  tickLabel: {
    color: '#65809e',
    fontSize: 9,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  chipIcon: {
    fontSize: 12,
  },
  chipText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  detailCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#071320',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailTitle: {
    color: '#eff7ff',
    fontSize: 12.5,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 3,
  },
  closeBtnText: {
    color: '#8fa8c4',
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailDescription: {
    color: '#cad9e8',
    fontSize: 11,
    lineHeight: 15,
  },
  electrodynamicsBox: {
    marginTop: 6,
    padding: 6,
    backgroundColor: '#0d1f33',
    borderRadius: 6,
  },
  electrodynamicsLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  electrodynamicsText: {
    color: '#eff7ff',
    fontSize: 10.5,
    lineHeight: 14,
  },
  mitigationNote: {
    color: '#ffd58c',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 6,
  },
});
