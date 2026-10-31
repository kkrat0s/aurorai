import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DevicePhysicalContext } from '@aurorasense/shared/magnetic-classifier';

interface PhysicalSensorContextPillsProps {
  context?: DevicePhysicalContext;
  tiltDegrees?: number;
}

export function PhysicalSensorContextPills({
  context,
  tiltDegrees = 0,
}: PhysicalSensorContextPillsProps) {
  if (!context) return null;

  const { isStandstill, motionState, isScreenTouched, isCharging, isFlatOnSurface } = context;

  // Motion styling
  let motionIcon = '🛑';
  let motionLabel = 'Standstill (Still)';
  let motionColor = '#68edc3';
  if (motionState === 'HAND_TREMOR') {
    motionIcon = '🤝';
    motionLabel = 'Hand Tremor';
    motionColor = '#ffd58c';
  } else if (motionState === 'ACTIVE_MOTION') {
    motionIcon = '🏃';
    motionLabel = 'In Motion';
    motionColor = '#ff7043';
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>AI MULTI-MODAL SENSOR CONTEXT</Text>
        <Text style={styles.realtimeText}>Live Hardware Inputs</Text>
      </View>

      <View style={styles.pillRow}>
        {/* 1. Motion Pill */}
        <View style={[styles.pill, { borderColor: motionColor, backgroundColor: `${motionColor}18` }]}>
          <Text style={styles.pillIcon}>{motionIcon}</Text>
          <Text style={[styles.pillText, { color: motionColor }]}>{motionLabel}</Text>
        </View>

        {/* 2. Touch / Capacitive Proximity Pill */}
        <View
          style={[
            styles.pill,
            {
              borderColor: isScreenTouched ? '#b9a5ff' : '#223c58',
              backgroundColor: isScreenTouched ? '#b9a5ff25' : '#0a1727',
            },
          ]}
        >
          <Text style={styles.pillIcon}>{isScreenTouched ? '👆' : '✋'}</Text>
          <Text style={[styles.pillText, { color: isScreenTouched ? '#b9a5ff' : '#8fa8c4' }]}>
            {isScreenTouched ? 'Screen Touched' : 'Hands Off'}
          </Text>
        </View>

        {/* 3. Charger / Induction Hardware Pill */}
        <View
          style={[
            styles.pill,
            {
              borderColor: isCharging ? '#ffb74d' : '#223c58',
              backgroundColor: isCharging ? '#ffb74d22' : '#0a1727',
            },
          ]}
        >
          <Text style={styles.pillIcon}>{isCharging ? '⚡' : '🔋'}</Text>
          <Text style={[styles.pillText, { color: isCharging ? '#ffb74d' : '#8fa8c4' }]}>
            {isCharging ? 'Charging (Cable/Qi)' : 'Battery Power'}
          </Text>
        </View>

        {/* 4. Orientation / Posture Pill */}
        <View
          style={[
            styles.pill,
            {
              borderColor: isFlatOnSurface ? '#4dd0e1' : '#223c58',
              backgroundColor: isFlatOnSurface ? '#4dd0e118' : '#0a1727',
            },
          ]}
        >
          <Text style={styles.pillIcon}>{isFlatOnSurface ? '📐' : '📱'}</Text>
          <Text style={[styles.pillText, { color: isFlatOnSurface ? '#4dd0e1' : '#8fa8c4' }]}>
            {isFlatOnSurface ? 'Flat on Desk' : `Tilted (${tiltDegrees}°)`}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#071626',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#183452',
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eyebrow: {
    color: '#7fa1c4',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  realtimeText: {
    color: '#68edc3',
    fontSize: 9.5,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
  },
  pillIcon: {
    fontSize: 12,
  },
  pillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});
