import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

interface MagneticFieldVisualizerProps {
  fieldMagnitudeMicroT: number | null;
  deltaMicroT: number | null;
  vector: { x: number; y: number; z: number } | null;
  activeColor: string;
  calibrating?: boolean;
  calibCountdownMs?: number;
  maxExcursionMicroT?: number;
}

/**
 * Real-time Magnetic Field & Flux Streamline Visualizer.
 * Renders the phone sitting within Earth's geomagnetic field and dynamically
 * warps magnetic field lines (flux streamlines) based on the 3-axis sensor vector.
 *
 * Demonstrates how local hands and metallic objects distort field lines around the phone
 * compared to uniform geomagnetic flux.
 */
export function MagneticFieldVisualizer({
  fieldMagnitudeMicroT,
  deltaMicroT,
  vector,
  activeColor,
  calibrating = false,
  calibCountdownMs = 0,
  maxExcursionMicroT = 2.5,
}: MagneticFieldVisualizerProps) {
  const width = 340;
  const height = 260;
  const cx = width / 2;
  const cy = height / 2;

  const phoneW = 74;
  const phoneH = 130;
  const phoneX = cx - phoneW / 2;
  const phoneY = cy - phoneH / 2;

  // Extract normalized vector displacements
  const vx = vector ? vector.x : 0;
  const vy = vector ? vector.y : 0;
  const vz = vector ? vector.z : 0;
  const delta = deltaMicroT ?? 0;
  const absDelta = Math.abs(delta);

  // Warping factor based on delta relative to max excursion
  const warpFactor = Math.min(2.5, absDelta / Math.max(0.8, maxExcursionMicroT));
  const warpX = (vx / (Math.abs(vx) + 10)) * 40 * warpFactor;
  const warpY = (vy / (Math.abs(vy) + 10)) * 30 * warpFactor;

  // Generate 8 dipolar magnetic flux streamlines curving around the phone
  const fieldLineOffsets = [-120, -85, -55, -25, 25, 55, 85, 120];

  const streamLines = fieldLineOffsets.map((offset, idx) => {
    // Dipolar loops starting below, wrapping around the phone, and converging above
    const isLeft = offset < 0;
    const startX = cx + offset * 0.9;
    const startY = height - 12;

    const endX = cx + offset * 0.9;
    const endY = 12;

    // Control points bend outward around the phone and warp toward the disturbance vector
    const bulge = (isLeft ? -1 : 1) * (50 + Math.abs(offset) * 0.35);
    const cp1x = cx + offset + bulge + warpX * (1 - Math.abs(offset) / 160);
    const cp1y = cy + 50 + warpY;

    const cp2x = cx + offset + bulge + warpX * (1 - Math.abs(offset) / 160);
    const cp2y = cy - 50 + warpY;

    const pathData = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
    return { id: idx, pathData, offset };
  });

  return (
    <View style={styles.container}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="fieldGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <Stop offset="0%" stopColor="#4dd0e1" stopOpacity="0.25" />
            <Stop offset="50%" stopColor={activeColor} stopOpacity="0.75" />
            <Stop offset="100%" stopColor="#b9a5ff" stopOpacity="0.25" />
          </LinearGradient>
          <LinearGradient id="phoneScreenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#10253d" stopOpacity="0.95" />
            <Stop offset="100%" stopColor="#081422" stopOpacity="0.95" />
          </LinearGradient>
        </Defs>

        {/* Ambient geomagnetic reference field lines (light faint background) */}
        {[-90, -45, 0, 45, 90].map((xOff, i) => (
          <Line
            key={`ref-${i}`}
            x1={cx + xOff}
            y1={8}
            x2={cx + xOff}
            y2={height - 8}
            stroke="#1c3654"
            strokeWidth={1}
            strokeDasharray="4 6"
            opacity={0.4}
          />
        ))}

        {/* Warped Magnetic Field Streamlines */}
        {streamLines.map((line) => (
          <Path
            key={line.id}
            d={line.pathData}
            fill="none"
            stroke="url(#fieldGrad)"
            strokeWidth={absDelta > 1.2 ? 2.2 : 1.5}
            strokeOpacity={0.85}
          />
        ))}

        {/* Dynamic Disturbance Flare when hand or metal is present */}
        {absDelta > 0.4 && (
          <Circle
            cx={cx + warpX * 1.5}
            cy={cy + warpY * 1.5}
            r={18 + Math.min(30, absDelta * 5)}
            fill={activeColor}
            fillOpacity={0.16}
          />
        )}

        {/* Phone Frame Silhouette */}
        <G>
          {/* Phone body shadow/glow */}
          <Rect
            x={phoneX - 2}
            y={phoneY - 2}
            width={phoneW + 4}
            height={phoneH + 4}
            rx={16}
            fill="#050e18"
            stroke="#2b4766"
            strokeWidth={1.5}
          />
          {/* Phone Screen */}
          <Rect
            x={phoneX + 3}
            y={phoneY + 4}
            width={phoneW - 6}
            height={phoneH - 8}
            rx={12}
            fill="url(#phoneScreenGrad)"
            stroke="#345478"
            strokeWidth={1}
          />
          {/* Top Notch / Earpiece */}
          <Rect
            x={cx - 10}
            y={phoneY + 8}
            width={20}
            height={3}
            rx={1.5}
            fill="#5278a3"
          />

          {/* Magnetometer Sensor Chip location (upper center of phone) */}
          <Circle
            cx={cx}
            cy={cy - 22}
            r={4.5}
            fill={calibrating ? '#ffd58c' : activeColor}
          />
          <Circle
            cx={cx}
            cy={cy - 22}
            r={8.5}
            stroke={calibrating ? '#ffd58c' : activeColor}
            strokeWidth={1}
            strokeDasharray="2 2"
            fill="none"
          />

          {/* Sensor label on phone glass */}
          <SvgText
            x={cx}
            y={cy - 8}
            fill="#8eb4db"
            fontSize="7"
            fontWeight="bold"
            textAnchor="middle"
            letterSpacing={0.5}
          >
            HALL SENSOR
          </SvgText>

          {/* Live Field readout inside phone screen */}
          <SvgText
            x={cx}
            y={cy + 12}
            fill="#ffffff"
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
          >
            {fieldMagnitudeMicroT !== null ? `${fieldMagnitudeMicroT.toFixed(1)} µT` : '—'}
          </SvgText>

          <SvgText
            x={cx}
            y={cy + 24}
            fill={activeColor}
            fontSize="8"
            fontWeight="bold"
            textAnchor="middle"
          >
            {deltaMicroT !== null ? `${deltaMicroT >= 0 ? '+' : ''}${(deltaMicroT * 1000).toFixed(0)} nT` : '0 nT'}
          </SvgText>

          {/* 3D Axis indicator on screen */}
          <Line x1={cx} y1={cy + 36} x2={cx + Math.max(-14, Math.min(14, vx * 0.4))} y2={cy + 36} stroke="#68edc3" strokeWidth={1.5} />
          <Line x1={cx} y1={cy + 36} x2={cx} y2={cy + 36 - Math.max(-14, Math.min(14, vy * 0.4))} stroke="#ffd58c" strokeWidth={1.5} />
        </G>

        {/* Top/Bottom Geomagnetic Polarity Labels */}
        <SvgText x={18} y={22} fill="#68edc3" fontSize="9" fontWeight="bold">
          ↑ GEOMAGNETIC NORTH
        </SvgText>
        <SvgText x={18} y={height - 12} fill="#80cbc4" fontSize="9">
          ↓ GEOMAGNETIC SOUTH
        </SvgText>

        {/* Calibration overlay in visualizer if calibrating */}
        {calibrating && (
          <G>
            <Rect
              x={16}
              y={cy - 28}
              width={width - 32}
              height={56}
              rx={12}
              fill="#061220ee"
              stroke="#ffd58c"
              strokeWidth={1.5}
            />
            <SvgText
              x={cx}
              y={cy - 8}
              fill="#ffd58c"
              fontSize="12"
              fontWeight="bold"
              textAnchor="middle"
            >
              CALIBRATING BASELINE ({(calibCountdownMs / 1000).toFixed(1)}s)
            </SvgText>
            <SvgText
              x={cx}
              y={cy + 12}
              fill="#eff7ff"
              fontSize="9.5"
              textAnchor="middle"
            >
              Step hand back · Measuring undisturbed room field
            </SvgText>
          </G>
        )}
      </Svg>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4dd0e1' }]} />
          <Text style={styles.legendText}>Earth Ambient Flux</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: activeColor }]} />
          <Text style={styles.legendText}>Distorted Field Lines</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ffd58c' }]} />
          <Text style={styles.legendText}>Sensor Core</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#071626',
    borderRadius: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#193452',
    marginVertical: 8,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#12253a',
    paddingHorizontal: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    color: '#8fa8c4',
    fontSize: 10.5,
    fontWeight: '500',
  },
});
