import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

interface SolarReconnectionCardProps {
  currentDeltaNanoT: number;
  disturbanceLabel: string;
}

/**
 * Educational Card & Diagram explaining Solar Wind Reconnection
 * and why phone magnetometer readings behave the way they do.
 */
export function SolarReconnectionCard({ currentDeltaNanoT, disturbanceLabel }: SolarReconnectionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const absDeltaNanoT = Math.abs(currentDeltaNanoT);

  // Reference storm strengths (in nT)
  const minorStormNanoT = 60; // G1-G2 typical ground perturbation
  const majorStormNanoT = 250; // G4 severe storm perturbation
  const extremeStormNanoT = 500; // G5 historical Carrington-class event

  // Ratio of user's local reading to a 100 nT solar storm
  const ratio = (absDeltaNanoT / 100).toFixed(1);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setExpanded(!expanded)}
        style={styles.headerRow}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.badge}>SPACE WEATHER SCIENCE</Text>
          <Text style={styles.title}>Solar Wind Reconnection vs. Your Phone</Text>
        </View>
        <Text style={styles.expandIcon}>{expanded ? '▲ Hide' : '▼ Learn'}</Text>
      </Pressable>

      <Text style={styles.summaryText}>
        When the Sun's solar wind connects with Earth's magnetosphere, it alters ground magnetic fields by{' '}
        <Text style={{ color: '#68edc3', fontWeight: 'bold' }}>50–500 nT</Text>.
        {absDeltaNanoT > 400 && (
          <Text style={{ color: '#ffd58c' }}>
            {' '}Your current {disturbanceLabel} creates{' '}
            <Text style={{ fontWeight: 'bold' }}>{absDeltaNanoT.toLocaleString()} nT</Text> ({ratio}x larger)!
          </Text>
        )}
      </Text>

      {/* Mini Comparative Scale Bar */}
      <View style={styles.comparisonBarContainer}>
        <View style={styles.barLabelRow}>
          <Text style={styles.barLabel}>Solar Storm (50–500 nT)</Text>
          <Text style={[styles.barLabel, { color: '#ffd58c' }]}>
            Your Local Field ({absDeltaNanoT.toLocaleString()} nT)
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.stormFill, { width: '12%' }]} />
          <View
            style={[
              styles.localFill,
              { width: `${Math.min(100, Math.max(6, (absDeltaNanoT / 4000) * 100))}%` },
            ]}
          />
        </View>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          {/* Interactive Reconnection Vector Graphic */}
          <View style={styles.diagramBox}>
            <Svg width={300} height={130} viewBox="0 0 300 130">
              {/* Solar Wind arrows coming from Left */}
              <Line x1={10} y1={25} x2={60} y2={25} stroke="#ffd58c" strokeWidth={1.5} />
              <Polygon points="60,22 68,25 60,28" fill="#ffd58c" />
              <Line x1={10} y1={65} x2={60} y2={65} stroke="#ffd58c" strokeWidth={1.5} />
              <Polygon points="60,62 68,65 60,68" fill="#ffd58c" />
              <Line x1={10} y1={105} x2={60} y2={105} stroke="#ffd58c" strokeWidth={1.5} />
              <Polygon points="60,102 68,105 60,108" fill="#ffd58c" />
              <SvgText x={14} y={16} fill="#ffd58c" fontSize="8" fontWeight="bold">
                SOLAR WIND (IMF Bz ↓)
              </SvgText>

              {/* Dayside Reconnection "X-Point" */}
              <Path d="M 80 35 Q 110 65 80 95" fill="none" stroke="#f06292" strokeWidth={2} />
              <Path d="M 140 35 Q 110 65 140 95" fill="none" stroke="#68edc3" strokeWidth={2} />
              <Circle cx={110} cy={65} r={5} fill="#f06292" />
              <SvgText x={90} y={55} fill="#f06292" fontSize="7.5" fontWeight="bold">
                RECONNECTION X-POINT
              </SvgText>

              {/* Earth and Magnetosphere Shield */}
              <Path
                d="M 140 15 Q 190 20 280 25 M 140 115 Q 190 110 280 105"
                fill="none"
                stroke="#4dd0e1"
                strokeWidth={1.2}
                strokeDasharray="3 3"
              />
              <Circle cx={210} cy={65} r={18} fill="#1d3d63" stroke="#4dd0e1" strokeWidth={1.5} />
              <SvgText x={210} y={69} fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">
                EARTH
              </SvgText>

              {/* Ionosphere electrojet ring */}
              <Circle cx={210} cy={65} r={24} fill="none" stroke="#68edc3" strokeWidth={1} strokeDasharray="2 2" />
              <SvgText x={210} y={100} fill="#68edc3" fontSize="7.5" textAnchor="middle">
                Electrojets (100 km)
              </SvgText>

              {/* Phone on ground */}
              <Rect x={198} y={42} width={6} height={10} rx={1} fill="#eff7ff" stroke="#ffd58c" strokeWidth={0.8} />
              <SvgText x={201} y={38} fill="#ffd58c" fontSize="6.5" textAnchor="middle">
                PHONE
              </SvgText>
            </Svg>
          </View>

          <View style={styles.stepList}>
            <View style={styles.stepItem}>
              <Text style={styles.stepNum}>1</Text>
              <Text style={styles.stepText}>
                <Text style={styles.stepBold}>Magnetic Reconnection:</Text> When solar wind plasma carries a southward
                magnetic field (negative IMF Bz), it collides with Earth's northward field lines. The lines break and
                reconnect, funneling massive solar energy into the magnetotail.
              </Text>
            </View>

            <View style={styles.stepItem}>
              <Text style={styles.stepNum}>2</Text>
              <Text style={styles.stepText}>
                <Text style={styles.stepBold}>Ionospheric Electrojets:</Text> Snapping field lines accelerate electrons
                down into the upper atmosphere, generating glowing aurora and huge electric currents (100,000+ Amperes)
                in the ionosphere 100 km overhead.
              </Text>
            </View>

            <View style={styles.stepItem}>
              <Text style={styles.stepNum}>3</Text>
              <Text style={styles.stepText}>
                <Text style={styles.stepBold}>Ground Magnetometer Response:</Text> By Ampère’s law, these overhead currents
                produce magnetic ripples at ground level of roughly 50 to 500 nT.
              </Text>
            </View>

            <View style={styles.stepItem}>
              <Text style={styles.stepNum}>4</Text>
              <Text style={styles.stepText}>
                <Text style={[styles.stepBold, { color: '#ffd58c' }]}>Why Your Phone Must Rest Untouched:</Text> Because
                moving your hand, wearing a watch, or sitting near a laptop generates thousands of nanoteslas of local
                noise, the only way a phone can detect the subtle whisper of a solar storm is to remain completely
                stationary on a non-magnetic support.
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0c1b2c',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1d3856',
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badge: {
    color: '#68edc3',
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
  expandIcon: {
    color: '#8fa8c4',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryText: {
    color: '#b0c1d4',
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 6,
  },
  comparisonBarContainer: {
    marginTop: 10,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  barLabel: {
    color: '#68edc3',
    fontSize: 10.5,
    fontWeight: '600',
  },
  barTrack: {
    height: 8,
    backgroundColor: '#081422',
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#1e334a',
  },
  stormFill: {
    backgroundColor: '#68edc3',
    height: '100%',
  },
  localFill: {
    backgroundColor: '#ffd58c',
    height: '100%',
  },
  expandedContent: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#172f4a',
  },
  diagramBox: {
    alignItems: 'center',
    backgroundColor: '#071524',
    borderRadius: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#18324e',
    marginBottom: 12,
  },
  stepList: {
    gap: 10,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  stepNum: {
    color: '#68edc3',
    backgroundColor: '#122e47',
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 'bold',
    lineHeight: 18,
  },
  stepText: {
    color: '#c2d4e6',
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  stepBold: {
    color: '#eff7ff',
    fontWeight: '700',
  },
});
