import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import type {
  DisturbanceClassId,
  DisturbanceClassificationResult,
} from '@aurorasense/shared/magnetic-classifier';

interface MagneticField3DViewProps {
  currentMagMicroT: number;
  deltaNt: number;
  bx: number;
  by: number;
  bz: number;
  classification: DisturbanceClassificationResult;
  isMuted: boolean;
  onToggleMute: () => void;
  onZeroBaseline?: () => void;
  onConfirmObject?: (classId: DisturbanceClassId, label: string) => void;
  isScreenTouched?: boolean;
  compact?: boolean;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function project3D(
  p: Vec3,
  rotX: number,
  rotY: number,
  rotZ: number,
  cx: number,
  cy: number,
  fov = 290,
  camDist = 235
): { x: number; y: number; scale: number; z: number } {
  const cosZ = Math.cos(rotZ);
  const sinZ = Math.sin(rotZ);
  const x1 = p.x * cosZ - p.y * sinZ;
  const y1 = p.x * sinZ + p.y * cosZ;
  const z1 = p.z;

  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x2 = x1 * cosY + z1 * sinY;
  const y2 = y1;
  const z2 = -x1 * sinY + z1 * cosY;

  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y3 = y2 * cosX - z2 * sinX;
  const z3 = y2 * sinX + z2 * cosX;

  const depth = Math.max(45, camDist + z3);
  const scale = fov / depth;
  return {
    x: cx + x2 * scale,
    y: cy + y3 * scale,
    scale,
    z: z3,
  };
}

function polyStr(pts: Array<{ x: number; y: number }>): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

const QUICK_VALIDATE_ITEMS: Array<{
  classId: DisturbanceClassId;
  icon: string;
  label: string;
}> = [
  { classId: 'HUMAN_HAND_GESTURE', icon: '🖐️', label: 'Hand' },
  { classId: 'SMARTWATCH_OR_MAGNET', icon: '⌚', label: 'Watch' },
  { classId: 'LAPTOP_OR_COMPUTER', icon: '💻', label: 'Laptop' },
  { classId: 'CHARGING_CABLE_INDUCTION', icon: '🔌', label: 'Charger' },
  { classId: 'STRUCTURAL_METALLIC_MASS', icon: '🔑', label: 'Metal' },
];

export function MagneticField3DView({
  currentMagMicroT,
  deltaNt,
  bx,
  by,
  bz,
  classification,
  isMuted,
  onToggleMute,
  onZeroBaseline,
  onConfirmObject,
  isScreenTouched = false,
  compact = false,
}: MagneticField3DViewProps) {
  const [phase, setPhase] = useState(0);
  const [userRot, setUserRot] = useState({ x: 0.46, y: -0.38 });
  const dragRef = useRef({ startX: 0.46, startY: -0.38 });

  // Ephemeral AI Object Whisper state: only visible during or shortly after an active perturbation
  const [whisperVisibleUntil, setWhisperVisibleUntil] = useState<number>(0);
  const [justValidatedLabel, setJustValidatedLabel] = useState<string | null>(null);
  const [lastActiveClassification, setLastActiveClassification] =
    useState<DisturbanceClassificationResult>(classification);

  useEffect(() => {
    const id = setInterval(() => {
      setPhase((p) => (p + 0.065) % (Math.PI * 20));
    }, 42);
    return () => clearInterval(id);
  }, []);

  const absDeltaNt = Math.abs(deltaNt);
  const isPerturbed =
    absDeltaNt > 320 ||
    isScreenTouched ||
    (classification.predictedClass !== 'CLEAN_GEOMAGNETIC_BASELINE' &&
      classification.predictedClass !== 'GEOMAGNETIC_SOLAR_DISTURBANCE' &&
      absDeltaNt > 180);

  useEffect(() => {
    if (isPerturbed) {
      setLastActiveClassification(classification);
      setWhisperVisibleUntil(Date.now() + 5500);
    }
  }, [isPerturbed, classification]);

  const showEphemeralCard = Date.now() < whisperVisibleUntil || isPerturbed || justValidatedLabel !== null;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        dragRef.current = { startX: userRot.x, startY: userRot.y };
      },
      onPanResponderMove: (_, g) => {
        setUserRot({
          x: Math.max(-1.15, Math.min(1.15, dragRef.current.startX + g.dy * 0.008)),
          y: dragRef.current.startY + g.dx * 0.008,
        });
      },
    })
  ).current;

  const intensity = Math.min(1, Math.log10(Math.max(10, absDeltaNt)) / 4.4);
  const primaryColor = isPerturbed
    ? classification.metadata.color || '#38d9a9'
    : absDeltaNt < 100
      ? '#20c997'
      : '#38d9a9';

  const W = 350;
  const H = compact ? 230 : 300;
  const cx = W / 2;
  const cy = H / 2 - 4;

  // Gentle 3D camera orbit + magnetic vector tilt
  const rotX = userRot.x + Math.sin(phase * 0.35) * 0.055 + (by / 110) * 0.1;
  const rotY = userRot.y + phase * 0.14 + (bx / 110) * 0.1;
  const rotZ = (bz / 130) * 0.07;

  // ============================================================================
  // 1. HIGH-CRAFT 3D SMARTPHONE MODEL (Extruded Chassis, Screen, Island, Sensor)
  // ============================================================================
  const pw = 25;
  const ph = 49;
  const pd = 4.6;

  // Back 4 corners (0..3) and Front 4 corners (4..7)
  const phoneCorners: Vec3[] = [
    { x: -pw, y: -ph, z: -pd },
    { x: pw, y: -ph, z: -pd },
    { x: pw, y: ph, z: -pd },
    { x: -pw, y: ph, z: -pd },
    { x: -pw, y: -ph, z: pd },
    { x: pw, y: -ph, z: pd },
    { x: pw, y: ph, z: pd },
    { x: -pw, y: ph, z: pd },
  ];
  const pc = phoneCorners.map((c) => project3D(c, rotX, rotY, rotZ, cx, cy));

  // Inner glass display on front face (z = pd + 0.15)
  const sw = pw - 2.6;
  const sh = ph - 3.2;
  const screenCorners = [
    { x: -sw, y: -sh, z: pd + 0.15 },
    { x: sw, y: -sh, z: pd + 0.15 },
    { x: sw, y: sh, z: pd + 0.15 },
    { x: -sw, y: sh, z: pd + 0.15 },
  ].map((c) => project3D(c, rotX, rotY, rotZ, cx, cy));

  // Dynamic Island pill at top of screen
  const islandCorners = [
    { x: -7.5, y: -sh + 3.2, z: pd + 0.3 },
    { x: 7.5, y: -sh + 3.2, z: pd + 0.3 },
    { x: 7.5, y: -sh + 6.4, z: pd + 0.3 },
    { x: -7.5, y: -sh + 6.4, z: pd + 0.3 },
  ].map((c) => project3D(c, rotX, rotY, rotZ, cx, cy));

  // Screen subtle internal grid lines (shows 3D perspective across display)
  const screenGridLines: string[] = [];
  for (let gy = -30; gy <= 30; gy += 15) {
    const p1 = project3D({ x: -sw + 2, y: gy, z: pd + 0.2 }, rotX, rotY, rotZ, cx, cy);
    const p2 = project3D({ x: sw - 2, y: gy, z: pd + 0.2 }, rotX, rotY, rotZ, cx, cy);
    screenGridLines.push(`M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`);
  }

  // Internal 3-Axis Magnetometer Sensor Chip (upper right inside chassis)
  const sensorChipPos: Vec3 = { x: 8, y: -22, z: pd + 0.4 };
  const sensorProj = project3D(sensorChipPos, rotX, rotY, rotZ, cx, cy);

  // Side bevel walls of the 3D smartphone
  const sideWalls = [
    { pts: [pc[0], pc[1], pc[5], pc[4]], color: '#132c4c' }, // Top rail
    { pts: [pc[1], pc[2], pc[6], pc[5]], color: '#1b3d66' }, // Right rail
    { pts: [pc[2], pc[3], pc[7], pc[6]], color: '#0d213a' }, // Bottom rail
    { pts: [pc[3], pc[0], pc[4], pc[7]], color: '#173559' }, // Left rail
  ];

  // ============================================================================
  // 2. MULTI-SHELL 3D TOROIDAL MAGNETIC DIPOLE LINES & PARTICLES
  // ============================================================================
  const numPlanes = 10;
  const steps = 30;
  const outerRadius = 82 + intensity * 42;
  const innerRadius = 50 + intensity * 20;

  const fieldPaths: Array<{
    d: string;
    opacity: number;
    strokeWidth: number;
    zAvg: number;
    isInner: boolean;
  }> = [];
  const fluxParticles: Array<{ x: number; y: number; r: number; z: number; opacity: number }> = [];

  for (let pIdx = 0; pIdx < numPlanes; pIdx++) {
    const phi = (pIdx / numPlanes) * Math.PI * 2;

    // Outer & Inner shell loops
    [false, true].forEach((isInner) => {
      if (isInner && pIdx % 2 !== 0) return;
      const shellR = isInner ? innerRadius : outerRadius;
      let d = '';
      let zSum = 0;

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const theta = 0.07 + t * (Math.PI - 0.14);
        const wave =
          intensity > 0.18
            ? Math.sin(theta * 6 - phase * (2.2 + intensity * 4.2) + phi) * (intensity * 12)
            : 0;
        const r = (shellR + wave) * Math.sin(theta) * Math.sin(theta);

        const vx = r * Math.sin(theta) * Math.cos(phi);
        const vy = -r * Math.cos(theta) * 1.18;
        const vz = r * Math.sin(theta) * Math.sin(phi);

        const pt = project3D({ x: vx, y: vy, z: vz }, rotX, rotY, rotZ, cx, cy);
        zSum += pt.z;
        d += `${s === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)} `;
      }

      const zAvg = zSum / (steps + 1);
      fieldPaths.push({
        d,
        opacity: isInner
          ? zAvg > 0
            ? 0.22
            : 0.48
          : zAvg > 0
            ? 0.28 + intensity * 0.32
            : 0.68 + intensity * 0.28,
        strokeWidth: isInner ? 1.0 : zAvg > 0 ? 1.2 : 1.9 + intensity * 1.1,
        zAvg,
        isInner,
      });
    });

    // Flowing quantum flux particles along each meridian
    const particleT = ((phase * (0.24 + intensity * 0.58) + pIdx * 0.31) % 1 + 1) % 1;
    const pTheta = 0.1 + particleT * (Math.PI - 0.2);
    const pr = outerRadius * Math.sin(pTheta) * Math.sin(pTheta);
    const pProj = project3D(
      {
        x: pr * Math.sin(pTheta) * Math.cos(phi),
        y: -pr * Math.cos(pTheta) * 1.18,
        z: pr * Math.sin(pTheta) * Math.sin(phi),
      },
      rotX,
      rotY,
      rotZ,
      cx,
      cy
    );
    fluxParticles.push({
      x: pProj.x,
      y: pProj.y,
      r: Math.max(1.8, 3.6 * pProj.scale),
      z: pProj.z,
      opacity: Math.min(1, 0.45 + intensity * 0.5),
    });
  }

  // ============================================================================
  // 3. LIVE 3D MAGNETIC VECTOR ARROW & APPROACHING OBJECT ANOMALY NODE
  // ============================================================================
  const vecNorm = Math.max(1, Math.sqrt(bx * bx + by * by + bz * bz));
  const arrowLen = 62 + intensity * 36;
  const tip3D = project3D(
    {
      x: (bx / vecNorm) * arrowLen,
      y: -(by / vecNorm) * arrowLen,
      z: (bz / vecNorm) * arrowLen,
    },
    rotX,
    rotY,
    rotZ,
    cx,
    cy
  );
  const centerProj = project3D({ x: 0, y: 0, z: 0 }, rotX, rotY, rotZ, cx, cy);

  const handleConfirm = (classId: DisturbanceClassId, label: string) => {
    onConfirmObject?.(classId, label);
    setJustValidatedLabel(label);
    setTimeout(() => {
      setJustValidatedLabel(null);
      setWhisperVisibleUntil(0);
    }, 1400);
  };

  const activeMeta = lastActiveClassification.metadata;

  return (
    <View
      style={[styles.container, compact && styles.containerCompact]}
      {...panResponder.panHandlers}
    >
      {/* MINIMAL FLOATING HUD: ONLY NUMBER (µT), ΔnT, AND ICON ORBS */}
      <View style={styles.topHud}>
        <View style={styles.valueRow}>
          <Text style={[styles.heroMagValue, { color: primaryColor }]}>
            {currentMagMicroT.toFixed(1)}
          </Text>
          <View style={styles.unitCol}>
            <Text style={styles.heroMagUnit}>µT</Text>
            <Text
              style={[
                styles.deltaInline,
                { color: absDeltaNt > 250 ? primaryColor : '#7da0c4' },
              ]}
            >
              {deltaNt >= 0 ? `+${Math.round(deltaNt)}` : Math.round(deltaNt)} nT
            </Text>
          </View>
        </View>

        <View style={styles.hudActions}>
          {onZeroBaseline ? (
            <Pressable
              onPress={onZeroBaseline}
              style={styles.iconOrb}
              accessibilityLabel="Zero magnetic baseline"
            >
              <Text style={styles.iconOrbText}>↺</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onToggleMute}
            style={[styles.iconOrb, !isMuted && styles.iconOrbActive]}
            accessibilityLabel="Toggle magnetic audio hum"
          >
            <Text style={styles.iconOrbText}>{isMuted ? '🔇' : '🔊'}</Text>
          </Pressable>
        </View>
      </View>

      {/* 3D INTERACTIVE VIEWPORT */}
      <View style={styles.canvasWrap}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <RadialGradient id="auraGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={primaryColor} stopOpacity={0.36 + intensity * 0.36} />
              <Stop offset="55%" stopColor={primaryColor} stopOpacity={0.09} />
              <Stop offset="100%" stopColor="#030b17" stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id="phoneChassis" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#1e426e" stopOpacity="0.98" />
              <Stop offset="100%" stopColor="#09192e" stopOpacity="0.98" />
            </LinearGradient>
            <LinearGradient id="phoneGlass" x1="0" y1="0" x2="0.8" y2="1">
              <Stop offset="0%" stopColor="#0b223e" stopOpacity="0.95" />
              <Stop offset="50%" stopColor="#061325" stopOpacity="0.95" />
              <Stop offset="100%" stopColor="#0d2a4a" stopOpacity="0.95" />
            </LinearGradient>
          </Defs>

          {/* Ambient 3D Core Glow */}
          <Circle cx={cx} cy={cy} r={96 + intensity * 30} fill="url(#auraGlow)" />

          {/* Back-facing 3D Dipole Loops */}
          {fieldPaths
            .filter((fp) => fp.zAvg >= 0)
            .map((fp, i) => (
              <Path
                key={`back-${i}`}
                d={fp.d}
                stroke={primaryColor}
                strokeWidth={fp.strokeWidth}
                strokeOpacity={fp.opacity}
                strokeDasharray={fp.isInner ? '3,3' : undefined}
                fill="none"
              />
            ))}

          {/* 3D Smartphone Back Plate */}
          <Polygon
            points={polyStr([pc[0], pc[1], pc[2], pc[3]])}
            fill="#061120"
            stroke="#244a75"
            strokeWidth="1"
          />

          {/* 3D Smartphone Extruded Side Rails */}
          {sideWalls.map((wall, idx) => (
            <Polygon
              key={`wall-${idx}`}
              points={polyStr(wall.pts)}
              fill={wall.color}
              stroke="#295688"
              strokeWidth="0.8"
            />
          ))}

          {/* 3D Smartphone Front Bezel */}
          <Polygon
            points={polyStr([pc[4], pc[5], pc[6], pc[7]])}
            fill="url(#phoneChassis)"
            stroke={primaryColor}
            strokeWidth="1.5"
          />

          {/* 3D Smartphone Illuminated Glass Display */}
          <Polygon
            points={polyStr(screenCorners)}
            fill="url(#phoneGlass)"
            stroke="rgba(56, 217, 169, 0.35)"
            strokeWidth="0.9"
          />

          {/* Subtle 3D Perspective Grid Across Screen */}
          {screenGridLines.map((d, idx) => (
            <Path
              key={`sgrid-${idx}`}
              d={d}
              stroke={primaryColor}
              strokeOpacity="0.16"
              strokeWidth="0.7"
            />
          ))}

          {/* Dynamic Island / Speaker Cutout */}
          <Polygon
            points={polyStr(islandCorners)}
            fill="#020710"
            stroke="#1b3b61"
            strokeWidth="0.7"
          />

          {/* Glowing 3-Axis Magnetometer Sensor Chip Inside Phone */}
          <Circle
            cx={sensorProj.x}
            cy={sensorProj.y}
            r={5.5 + Math.sin(phase * 3) * 1.5}
            fill={primaryColor}
            opacity={0.32}
          />
          <Circle
            cx={sensorProj.x}
            cy={sensorProj.y}
            r={2.6}
            fill="#ffffff"
            stroke={primaryColor}
            strokeWidth="1.2"
          />

          {/* Live 3D Field Vector Arrow & Source Anomaly Node */}
          <Path
            d={`M ${centerProj.x.toFixed(1)} ${centerProj.y.toFixed(1)} L ${tip3D.x.toFixed(1)} ${tip3D.y.toFixed(1)}`}
            stroke="#ffffff"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {isPerturbed ? (
            <Circle
              cx={tip3D.x}
              cy={tip3D.y}
              r={12 + Math.sin(phase * 4) * 3}
              fill={primaryColor}
              opacity={0.26}
            />
          ) : null}
          <Circle
            cx={tip3D.x}
            cy={tip3D.y}
            r="4.5"
            fill="#ffffff"
            stroke={primaryColor}
            strokeWidth="2"
          />

          {/* Front-facing 3D Dipole Loops */}
          {fieldPaths
            .filter((fp) => fp.zAvg < 0)
            .map((fp, i) => (
              <Path
                key={`front-${i}`}
                d={fp.d}
                stroke={primaryColor}
                strokeWidth={fp.strokeWidth}
                strokeOpacity={fp.opacity}
                strokeDasharray={fp.isInner ? '3,3' : undefined}
                fill="none"
              />
            ))}

          {/* Orbiting 3D Flux Particles */}
          {fluxParticles.map((pt, i) => (
            <Circle
              key={`pt-${i}`}
              cx={pt.x}
              cy={pt.y}
              r={pt.r}
              fill="#ffffff"
              opacity={pt.opacity}
            />
          ))}
        </Svg>
      </View>

      {/* EPHEMERAL AI OBJECT WHISPER CARD (ONLY APPEARS WHEN AN OBJECT PERTURBS THE FIELD) */}
      {showEphemeralCard ? (
        <View style={[styles.whisperCard, { borderColor: activeMeta.color || primaryColor }]}>
          {justValidatedLabel ? (
            <View style={styles.validatedRow}>
              <Text style={styles.validatedText}>
                ✓ AI learned fingerprint: {justValidatedLabel}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.whisperHeader}>
                <Text style={styles.whisperIcon}>{activeMeta.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.whisperTitle, { color: activeMeta.color || primaryColor }]}
                    numberOfLines={1}
                  >
                    {lastActiveClassification.confidence >= 0.78
                      ? activeMeta.name
                      : `AI Guess: ${activeMeta.name} — Confirm?`}
                  </Text>
                  <Text style={styles.whisperSub} numberOfLines={1}>
                    {(lastActiveClassification.confidence * 100).toFixed(0)}% match · Tap to validate what is near the phone:
                  </Text>
                </View>
                <Pressable
                  onPress={() => setWhisperVisibleUntil(0)}
                  style={styles.dismissBtn}
                  hitSlop={8}
                >
                  <Text style={styles.dismissBtnText}>✕</Text>
                </Pressable>
              </View>

              {onConfirmObject ? (
                <View style={styles.validatePillsRow}>
                  {QUICK_VALIDATE_ITEMS.map((item) => {
                    const isCurrentGuess = lastActiveClassification.predictedClass === item.classId;
                    return (
                      <Pressable
                        key={item.classId}
                        onPress={() => handleConfirm(item.classId, item.label)}
                        style={[
                          styles.validatePill,
                          isCurrentGuess && {
                            borderColor: activeMeta.color || primaryColor,
                            backgroundColor: 'rgba(56, 217, 169, 0.16)',
                          },
                        ]}
                      >
                        <Text style={styles.validatePillText}>
                          {item.icon} {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(6, 15, 28, 0.65)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  containerCompact: {
    paddingVertical: 10,
  },
  topHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 5,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroMagValue: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  unitCol: {
    justifyContent: 'center',
  },
  heroMagUnit: {
    fontSize: 13,
    fontWeight: '800',
    color: '#8ea8c4',
  },
  deltaInline: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  hudActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(11, 30, 54, 0.85)',
    borderWidth: 1,
    borderColor: '#1d4068',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOrbActive: {
    backgroundColor: 'rgba(32, 201, 151, 0.2)',
    borderColor: '#20c997',
  },
  iconOrbText: {
    fontSize: 15,
    color: '#d5e6f7',
    fontWeight: '800',
  },
  canvasWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -8,
  },
  whisperCard: {
    backgroundColor: 'rgba(7, 21, 38, 0.94)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.2,
    marginTop: 2,
  },
  whisperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  whisperIcon: {
    fontSize: 24,
  },
  whisperTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  whisperSub: {
    fontSize: 10.5,
    color: '#8ea8c4',
    marginTop: 1,
  },
  dismissBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dismissBtnText: {
    color: '#6b89a8',
    fontSize: 13,
    fontWeight: '800',
  },
  validatePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  validatePill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#0b1e36',
    borderWidth: 1,
    borderColor: '#1d4068',
  },
  validatePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#d9ecff',
  },
  validatedRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  validatedText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#20c997',
  },
  subtleHintRow: {
    alignItems: 'center',
    paddingTop: 2,
  },
  subtleHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(142, 168, 196, 0.55)',
    letterSpacing: 0.3,
  },
});
