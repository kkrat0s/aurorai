import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import {
  Interactive3DDeviceInsert,
  type DeviceOverloadState,
} from './Intro3DMeshes';

interface MagnetismIntroAnimationProps {
  visible: boolean;
  onComplete: () => void;
}

interface QuoteStage {
  eyebrow: string;
  quote: string;
  subline: string;
  targetZoom: number;
  earthReveal: number;
}

const INITIAL_QUOTES: QuoteStage[] = [
  {
    eyebrow: 'EARLY MAGNETISM · LODESTONES',
    quote: 'A natural magnet can attract iron without touching it.',
    subline: 'Magnetic fields connect everyday observations with planetary science.',
    targetZoom: 0.76,
    earthReveal: 0.28,
  },
  {
    eyebrow: '1600 · WILLIAM GILBERT',
    quote: 'Gilbert described Earth as a magnet.',
    subline: 'Compressed on the sunlit side and stretched into a vast tail away from the Sun.',
    targetZoom: 1.05,
    earthReveal: 0.88,
  },
  {
    eyebrow: '1831 · MICHAEL FARADAY',
    quote: 'Changing magnetic flux can induce an electric field.',
    subline: 'During geomagnetic storms, changing fields can drive currents in long conductors.',
    targetZoom: 1.28,
    earthReveal: 1.0,
  },
];

interface GlowingSpotSeed {
  id: number;
  y0: number;
  z0: number;
  speed: number;
  offset: number;
  coreRadius: number;
  glowRadius: number;
  palette: 'gold' | 'crimson' | 'cyan';
  isCusp: boolean;
}

// 145 glowing plasma spots (no tails!) pouring from the 3D glowing Sun through Earth's magnetosphere
const GLOWING_SWARM_SPOTS: GlowingSpotSeed[] = Array.from({ length: 145 }, (_, i) => {
  const s1 = Math.sin(i * 12.9898 + 0.7) * 43758.5453;
  const r1 = s1 - Math.floor(s1);
  const s2 = Math.sin(i * 78.233 + 1.9) * 43758.5453;
  const r2 = s2 - Math.floor(s2);
  const s3 = Math.sin(i * 39.425 + 3.7) * 43758.5453;
  const r3 = s3 - Math.floor(s3);
  const s4 = Math.sin(i * 93.117 + 5.3) * 43758.5453;
  const r4 = s4 - Math.floor(s4);

  const angle = r1 * Math.PI * 2;
  const radial = Math.pow(r2, 0.75) * 76;
  const coreRadius = 1.1 + r3 * 2.0;

  return {
    id: i,
    y0: Math.sin(angle) * radial,
    z0: Math.cos(angle) * radial,
    speed: 0.42 + r4 * 0.68,
    offset: (i / 145) * 1.0,
    coreRadius,
    glowRadius: coreRadius * (3.2 + (i % 3) * 0.8),
    palette: i % 5 === 0 ? 'cyan' : i % 2 === 0 ? 'gold' : 'crimson',
    isCusp: radial < 28 && i % 3 === 0,
  };
});

// 28 3D Glowing Plasma Granules on the Sun's Spherical Surface (no lines, pure volumetric 3D glow!)
const SUN_GLOW_GRANULES = Array.from({ length: 28 }, (_, i) => {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / 27) * 2;
  const rSlice = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = goldenAngle * i;
  return {
    id: i,
    ux: Math.cos(theta) * rSlice,
    uy: y,
    uz: Math.sin(theta) * rSlice,
    coreR: 1.8 + (i % 4) * 0.9,
    haloR: 7.5 + (i % 3) * 4.2,
    isHotFlare: i % 4 === 0,
  };
});

function buildMagnetospherePaths(stormCompression = 0, tailWavePhase = 0) {
  const ex = 176;
  const ey = 120;

  const daysideLoops: Array<{ d: string; opacity: number; width: number }> = [];
  const daysideShells = [24, 35, 46, 56];
  const azimuths = [-0.85, -0.4, 0, 0.4, 0.85];
  const compression = 0.72 - stormCompression * 0.25;

  for (const L of daysideShells) {
    for (const phi of azimuths) {
      let d = '';
      const steps = 26;
      for (let s = 0; s <= steps; s++) {
        const theta = 0.14 + (s / steps) * (Math.PI - 0.28);
        const jitter =
          stormCompression > 0.1
            ? Math.sin(theta * 8 - tailWavePhase * 4 + phi) * (stormCompression * 3.5)
            : 0;
        const r = (L + jitter) * Math.sin(theta) * Math.sin(theta);
        const x3 = -r * Math.sin(theta) * Math.cos(phi) * compression;
        const y3 = -r * Math.cos(theta) * 1.06;
        const z3 = r * Math.sin(theta) * Math.sin(phi);

        const tilt = 0.16;
        const xt = x3 * Math.cos(tilt) - y3 * Math.sin(tilt);
        const yt = x3 * Math.sin(tilt) + y3 * Math.cos(tilt);

        const persp = 280 / (280 + z3);
        const px = ex + xt * persp;
        const py = ey + yt * persp;
        d += `${s === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)} `;
      }
      daysideLoops.push({
        d,
        opacity: Math.abs(phi) < 0.2 ? 0.82 : 0.44,
        width: L === 56 ? 1.65 : 1.15,
      });
    }
  }

  const innerNightLoops: Array<{ d: string; opacity: number }> = [];
  for (const L of [26, 40, 56]) {
    for (const phi of [-0.55, 0, 0.55]) {
      let d = '';
      const steps = 26;
      for (let s = 0; s <= steps; s++) {
        const theta = 0.16 + (s / steps) * (Math.PI - 0.32);
        const r = L * Math.sin(theta) * Math.sin(theta);
        const tailStretch = 1.42 + (L / 56) * 0.82 * Math.pow(Math.sin(theta), 2);
        const whip =
          stormCompression > 0.1
            ? Math.sin((s / steps) * Math.PI * 2 - tailWavePhase * 3) * (stormCompression * 4.5)
            : 0;
        const x3 = r * Math.sin(theta) * Math.cos(phi) * tailStretch;
        const y3 = -r * Math.cos(theta) * 0.95 + whip;
        const z3 = r * Math.sin(theta) * Math.sin(phi);

        const tilt = 0.16;
        const xt = x3 * Math.cos(tilt) - y3 * Math.sin(tilt);
        const yt = x3 * Math.sin(tilt) + y3 * Math.cos(tilt);

        const persp = 280 / (280 + z3);
        const px = ex + xt * persp;
        const py = ey + yt * persp;
        d += `${s === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)} `;
      }
      innerNightLoops.push({
        d,
        opacity: phi === 0 ? 0.68 : 0.36,
      });
    }
  }

  const tailWave = stormCompression > 0.1 ? Math.sin(tailWavePhase * 2.5) * 7 * stormCompression : 0;
  const tailLines: Array<{ d: string; opacity: number; width: number }> = [
    {
      d: `M ${(ex - 4).toFixed(1)} ${(ey - 12).toFixed(1)} C ${(ex - 16).toFixed(1)} ${(ey - 54).toFixed(1)}, ${(ex + 48).toFixed(1)} ${(ey - 80 + tailWave).toFixed(1)}, 338 ${(ey - 68 - tailWave).toFixed(1)}`,
      opacity: 0.78,
      width: 1.5,
    },
    {
      d: `M ${(ex - 2).toFixed(1)} ${(ey - 12).toFixed(1)} C ${(ex + 4).toFixed(1)} ${(ey - 42).toFixed(1)}, ${(ex + 66).toFixed(1)} ${(ey - 54 + tailWave).toFixed(1)}, 338 ${(ey - 44 - tailWave).toFixed(1)}`,
      opacity: 0.56,
      width: 1.2,
    },
    {
      d: `M ${(ex + 2).toFixed(1)} ${(ey - 10).toFixed(1)} C ${(ex + 22).toFixed(1)} ${(ey - 28).toFixed(1)}, ${(ex + 86).toFixed(1)} ${(ey - 26 + tailWave * 0.5).toFixed(1)}, 338 ${(ey - 18).toFixed(1)}`,
      opacity: 0.45,
      width: 1.1,
    },
    {
      d: `M ${(ex + 4).toFixed(1)} ${(ey + 12).toFixed(1)} C ${(ex - 8).toFixed(1)} ${(ey + 54).toFixed(1)}, ${(ex + 52).toFixed(1)} ${(ey + 82 + tailWave).toFixed(1)}, 338 ${(ey + 74 - tailWave).toFixed(1)}`,
      opacity: 0.78,
      width: 1.5,
    },
    {
      d: `M ${(ex + 4).toFixed(1)} ${(ey + 11).toFixed(1)} C ${(ex + 10).toFixed(1)} ${(ey + 42).toFixed(1)}, ${(ex + 70).toFixed(1)} ${(ey + 56 + tailWave).toFixed(1)}, 338 ${(ey + 48 - tailWave).toFixed(1)}`,
      opacity: 0.56,
      width: 1.2,
    },
    {
      d: `M ${(ex + 6).toFixed(1)} ${(ey + 9).toFixed(1)} C ${(ex + 24).toFixed(1)} ${(ey + 28).toFixed(1)}, ${(ex + 88).toFixed(1)} ${(ey + 28 + tailWave * 0.5).toFixed(1)}, 338 ${(ey + 22).toFixed(1)}`,
      opacity: 0.45,
      width: 1.1,
    },
  ];

  const bowShift = stormCompression * 16;
  const bowShockPath = `M ${214 + bowShift * 0.3} 28 C ${98 + bowShift} 44, ${98 + bowShift} 196, ${214 + bowShift * 0.3} 212`;
  const magnetopausePath = `M ${252 + bowShift * 0.2} 38 C ${114 + bowShift} 52, ${114 + bowShift} 188, ${252 + bowShift * 0.2} 202`;

  return {
    ex,
    ey,
    daysideLoops,
    innerNightLoops,
    tailLines,
    bowShockPath,
    magnetopausePath,
  };
}

/**
 * Memoized 3D Sun + Earth + Magnetosphere + 145 Glowing Spots Backdrop.
 * Once `solarClock` freezes in Stage 4, this component does ZERO re-renders during the 4 3D device showcases!
 */
const SolarMagnetosphereBackdrop = React.memo(function SolarMagnetosphereBackdrop({
  solarClock,
  isStormActive,
  cameraZoom,
  earthOpacity,
}: {
  solarClock: number;
  isStormActive: boolean;
  cameraZoom: Animated.Value;
  earthOpacity: Animated.Value;
}) {
  const impactProgress = isStormActive
    ? Math.min(1, Math.max(0, (solarClock - 0.25) / 0.85))
    : 0;

  const { ex, ey, daysideLoops, innerNightLoops, tailLines, bowShockPath, magnetopausePath } =
    buildMagnetospherePaths(impactProgress, solarClock);

  const renderedGlowingSpots: Array<{
    id: number;
    x: number;
    y: number;
    coreR: number;
    glowR: number;
    gradId: string;
    opacity: number;
  }> = [];

  if (isStormActive) {
    for (const spot of GLOWING_SWARM_SPOTS) {
      const rawT = solarClock * spot.speed - spot.offset;
      if (rawT < 0) continue;
      const t = rawT % 1;

      const worldX = -146 + t * 314;
      let worldY = spot.y0 * (0.28 + t * 0.85);
      let worldZ = spot.z0 * (0.28 + t * 0.85);

      const distFromAxis = Math.sqrt(worldY * worldY + worldZ * worldZ);
      let isReconnecting = false;

      if (worldX > -52 && worldX < 44) {
        if (spot.isCusp) {
          const cuspProgress = Math.min(1, (worldX + 52) / 52);
          const signY = worldY >= 0 ? 1 : -1;
          worldY = worldY * (1 - cuspProgress * 0.58) + signY * 11 * cuspProgress;
          worldZ = worldZ * (1 - cuspProgress * 0.62);
          isReconnecting = true;
        } else {
          const compressWave = Math.sin(((worldX + 52) / 96) * Math.PI) * 16;
          const radialScale = (distFromAxis + compressWave) / Math.max(1, distFromAxis);
          worldY *= radialScale;
          worldZ *= radialScale;
        }
      }

      const persp = 280 / Math.max(75, 280 + worldZ);
      const sx = ex + worldX * persp;
      const sy = ey + worldY * persp;

      const fadeEdge = Math.sin(t * Math.PI);
      const gradId = isReconnecting
        ? 'spotGlowCrimson'
        : spot.palette === 'gold'
          ? 'spotGlowGold'
          : spot.palette === 'cyan'
            ? 'spotGlowCyan'
            : 'spotGlowCrimson';

      renderedGlowingSpots.push({
        id: spot.id,
        x: sx,
        y: sy,
        coreR: spot.coreRadius * persp,
        glowR: spot.glowRadius * persp * (isReconnecting ? 1.25 : 1),
        gradId,
        opacity: Math.min(0.98, fadeEdge * 1.25),
      });
    }
  }

  const sunCx = 28;
  const sunCy = 120;
  const sunRadius = isStormActive ? 21 : 18.5;
  const sunRotAngle = solarClock * 0.55;
  const cosSun = Math.cos(sunRotAngle);
  const sinSun = Math.sin(sunRotAngle);

  const visibleSunGranules = SUN_GLOW_GRANULES.map((g) => {
    const rx = g.ux * cosSun + g.uz * sinSun;
    const ry = g.uy;
    const rz = -g.ux * sinSun + g.uz * cosSun;
    return {
      ...g,
      sx: sunCx + rx * sunRadius * 0.88,
      sy: sunCy + ry * sunRadius * 0.88,
      rz,
    };
  })
    .filter((g) => g.rz > -0.35)
    .sort((a, b) => a.rz - b.rz);

  return (
    <>
      {/* 1. ZOOMING 3D EARTH MAGNETOSPHERE & GLOWING PLASMA SWARM */}
      <Animated.View
        style={[
          styles.sceneWrap,
          {
            transform: [{ scale: cameraZoom }],
          },
        ]}
      >
        <Svg width={340} height={240} viewBox="0 0 340 240">
          <Defs>
            <RadialGradient id="magFieldGlow" cx="52%" cy="50%" r="50%">
              <Stop
                offset="0%"
                stopColor={impactProgress > 0.2 ? '#ff5252' : '#00e5ff'}
                stopOpacity={0.32 + impactProgress * 0.28}
              />
              <Stop
                offset="60%"
                stopColor={impactProgress > 0.2 ? '#ff9100' : '#20c997'}
                stopOpacity="0.1"
              />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>

            <RadialGradient id="earthSphere" cx="38%" cy="38%" r="60%">
              <Stop offset="0%" stopColor="#4fc3f7" stopOpacity="1" />
              <Stop offset="55%" stopColor="#0277bd" stopOpacity="1" />
              <Stop offset="100%" stopColor="#011627" stopOpacity="1" />
            </RadialGradient>

            <LinearGradient id="tailGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop
                offset="0%"
                stopColor={impactProgress > 0.2 ? '#ff6b6b' : '#38d9a9'}
                stopOpacity="0.88"
              />
              <Stop
                offset="65%"
                stopColor={impactProgress > 0.2 ? '#ff9100' : '#00e5ff'}
                stopOpacity="0.48"
              />
              <Stop offset="100%" stopColor="#a882ff" stopOpacity="0.08" />
            </LinearGradient>

            <RadialGradient id="spotGlowGold" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#fff8e1" stopOpacity="0.95" />
              <Stop offset="35%" stopColor="#ffd54f" stopOpacity="0.65" />
              <Stop offset="100%" stopColor="#ff9100" stopOpacity="0" />
            </RadialGradient>

            <RadialGradient id="spotGlowCrimson" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <Stop offset="35%" stopColor="#ff5252" stopOpacity="0.7" />
              <Stop offset="100%" stopColor="#ff1744" stopOpacity="0" />
            </RadialGradient>

            <RadialGradient id="spotGlowCyan" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <Stop offset="35%" stopColor="#38d9a9" stopOpacity="0.65" />
              <Stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          <Circle cx={ex} cy={ey} r={108} fill="url(#magFieldGlow)" />

          <Path
            d={bowShockPath}
            stroke={impactProgress > 0.2 ? '#ff6b6b' : '#00e5ff'}
            strokeWidth={1 + impactProgress * 1.2}
            strokeOpacity={0.28 + impactProgress * 0.4}
            strokeDasharray="4,4"
            fill="none"
          />
          <Path
            d={magnetopausePath}
            stroke={impactProgress > 0.2 ? '#ffd54f' : '#38d9a9'}
            strokeWidth={1.2 + impactProgress * 1.1}
            strokeOpacity={0.35 + impactProgress * 0.4}
            fill="none"
          />

          <Path
            d={`M ${ex + 14} ${ey + 2} L 338 ${ey + 4}`}
            stroke={impactProgress > 0.2 ? '#ff5252' : '#a882ff'}
            strokeWidth={impactProgress > 0.2 ? 2.2 : 1.1}
            strokeOpacity={impactProgress > 0.2 ? 0.78 : 0.35}
            strokeDasharray="3,4"
          />

          {tailLines.map((tl, idx) => (
            <Path
              key={`tail-${idx}`}
              d={tl.d}
              stroke="url(#tailGrad)"
              strokeWidth={tl.width}
              strokeOpacity={tl.opacity}
              fill="none"
            />
          ))}

          {innerNightLoops.map((nl, idx) => (
            <Path
              key={`nloop-${idx}`}
              d={nl.d}
              stroke={impactProgress > 0.2 ? '#ff8787' : '#00e5ff'}
              strokeWidth="1.15"
              strokeOpacity={nl.opacity}
              fill="none"
            />
          ))}

          {daysideLoops.map((dl, idx) => (
            <Path
              key={`dloop-${idx}`}
              d={dl.d}
              stroke={impactProgress > 0.2 ? '#ff6b6b' : '#38d9a9'}
              strokeWidth={dl.width}
              strokeOpacity={dl.opacity}
              fill="none"
            />
          ))}

          {isStormActive
            ? renderedGlowingSpots.map((sp) => (
                <G key={`spot-${sp.id}`} opacity={sp.opacity}>
                  <Circle
                    cx={sp.x}
                    cy={sp.y}
                    r={sp.glowR}
                    fill={`url(#${sp.gradId})`}
                  />
                  <Circle cx={sp.x} cy={sp.y} r={sp.coreR} fill="#ffffff" />
                </G>
              ))
            : null}

          <Circle cx={ex} cy={ey} r={3.5} fill="#ffffff" />
        </Svg>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.overlaySvg,
            {
              opacity: earthOpacity,
            },
          ]}
        >
          <Svg width={340} height={240} viewBox="0 0 340 240">
            <G>
              {impactProgress > 0.15 ? (
                <>
                  <Circle
                    cx={ex}
                    cy={ey}
                    r={19 + Math.sin(solarClock * 6) * 2.5}
                    stroke="#20c997"
                    strokeWidth="2.8"
                    strokeOpacity={0.8 * impactProgress}
                    fill="rgba(32, 201, 151, 0.22)"
                  />
                  <Circle
                    cx={ex}
                    cy={ey}
                    r={25 + Math.cos(solarClock * 5) * 3}
                    stroke="#ff4081"
                    strokeWidth="2.4"
                    strokeOpacity={0.72 * impactProgress}
                    fill="rgba(255, 64, 129, 0.16)"
                  />
                </>
              ) : null}

              <Circle
                cx={ex}
                cy={ey}
                r={14}
                fill="url(#earthSphere)"
                stroke="#80d8ff"
                strokeWidth="0.9"
              />
              <Ellipse
                cx={ex}
                cy={ey}
                rx={14}
                ry={5.5}
                stroke="rgba(255,255,255,0.32)"
                strokeWidth="0.6"
                fill="none"
                transform={`rotate(9 ${ex} ${ey})`}
              />
              <Ellipse
                cx={ex}
                cy={ey}
                rx={6.5}
                ry={14}
                stroke="rgba(255,255,255,0.28)"
                strokeWidth="0.6"
                fill="none"
                transform={`rotate(9 ${ex} ${ey})`}
              />
              <Ellipse
                cx={ex - 2}
                cy={ey - (impactProgress > 0.3 ? 7 : 11)}
                rx={6.5 + impactProgress * 5.5}
                ry={2.2 + impactProgress * 2.8}
                stroke={impactProgress > 0.3 ? '#ff4081' : '#20c997'}
                strokeWidth={1.6 + impactProgress * 1.2}
                fill={
                  impactProgress > 0.3
                    ? 'rgba(255, 64, 129, 0.48)'
                    : 'rgba(32, 201, 151, 0.35)'
                }
              />
              <Ellipse
                cx={ex + 2}
                cy={ey + (impactProgress > 0.3 ? 7 : 11)}
                rx={6.5 + impactProgress * 5.5}
                ry={2.2 + impactProgress * 2.8}
                stroke={impactProgress > 0.3 ? '#ff4081' : '#20c997'}
                strokeWidth={1.6 + impactProgress * 1.2}
                fill={
                  impactProgress > 0.3
                    ? 'rgba(255, 64, 129, 0.48)'
                    : 'rgba(32, 201, 151, 0.35)'
                }
              />
            </G>
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* 2. REALISTIC VOLUMETRIC 3D GLOWING SUN ON THE LEFT (ZERO FIELD LINES!) */}
      <View pointerEvents="none" style={styles.overlaySvg}>
        <Svg width={340} height={240} viewBox="0 0 340 240">
          <Defs>
            <RadialGradient id="sunDeepBloom" cx="50%" cy="50%" r="50%">
              <Stop
                offset="0%"
                stopColor={isStormActive ? '#ff6d00' : '#ffab00'}
                stopOpacity={isStormActive ? '0.68' : '0.48'}
              />
              <Stop
                offset="40%"
                stopColor={isStormActive ? '#ff1744' : '#ff6d00'}
                stopOpacity={isStormActive ? '0.28' : '0.18'}
              />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>

            <RadialGradient id="sunInnerHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
              <Stop offset="28%" stopColor="#fff59d" stopOpacity="0.92" />
              <Stop offset="58%" stopColor="#ffab00" stopOpacity="0.62" />
              <Stop offset="82%" stopColor="#ff3d00" stopOpacity="0.22" />
              <Stop offset="100%" stopColor="#dd2c00" stopOpacity="0" />
            </RadialGradient>

            <RadialGradient id="sunGranuleGold" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
              <Stop offset="38%" stopColor="#ffe082" stopOpacity="0.72" />
              <Stop offset="100%" stopColor="#ff6d00" stopOpacity="0" />
            </RadialGradient>

            <RadialGradient id="sunGranuleFlare" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <Stop offset="32%" stopColor="#ff8a80" stopOpacity="0.82" />
              <Stop offset="100%" stopColor="#ff1744" stopOpacity="0" />
            </RadialGradient>

            <RadialGradient id="sunCoreHot" cx="44%" cy="44%" r="56%">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <Stop offset="48%" stopColor="#fffde7" stopOpacity="0.94" />
              <Stop offset="80%" stopColor="#ffd54f" stopOpacity="0.45" />
              <Stop offset="100%" stopColor="#ff9100" stopOpacity="0" />
            </RadialGradient>
          </Defs>

          <Circle
            cx={sunCx}
            cy={sunCy}
            r={isStormActive ? 86 + Math.sin(solarClock * 5) * 6 : 68}
            fill="url(#sunDeepBloom)"
          />

          <Circle
            cx={sunCx}
            cy={sunCy}
            r={isStormActive ? 42 + Math.cos(solarClock * 7) * 3 : 35}
            fill="url(#sunInnerHalo)"
          />

          {visibleSunGranules.map((g) => {
            const depthAlpha = Math.min(1, Math.max(0.25, (g.rz + 0.35) / 1.1));
            return (
              <G key={`sun-gran-${g.id}`} opacity={depthAlpha}>
                <Circle
                  cx={g.sx}
                  cy={g.sy}
                  r={g.haloR * (isStormActive && g.isHotFlare ? 1.35 : 1)}
                  fill={g.isHotFlare ? 'url(#sunGranuleFlare)' : 'url(#sunGranuleGold)'}
                />
                <Circle cx={g.sx} cy={g.sy} r={g.coreR} fill="#ffffff" />
              </G>
            );
          })}

          <Circle
            cx={sunCx}
            cy={sunCy}
            r={sunRadius * 1.05}
            fill="url(#sunCoreHot)"
          />
        </Svg>
      </View>
    </>
  );
});

// 4 3D Devices and their 2x2 Square offsets relative to the grid center
const MODERN_DEVICES = [
  { id: 'sat' as const, label: 'ORBITAL SATELLITE', slotX: -82, slotY: -62 },
  { id: 'car' as const, label: 'NAVIGATION', slotX: 82, slotY: -62 },
  { id: 'phone' as const, label: 'COMMUNICATIONS', slotX: -82, slotY: 62 },
  { id: 'chip' as const, label: 'POWER DEPENDENCE', slotX: 82, slotY: 62 },
];

export function MagnetismIntroAnimation({
  visible,
  onComplete,
}: MagnetismIntroAnimationProps) {
  const [stageIdx, setStageIdx] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // `solarClock` drives the 3D Sun, Earth, magnetosphere & particles (freezes smoothly in Stage 4!)
  const [solarClock, setSolarClock] = useState(0);
  const solarClockValRef = useRef(0);
  const freezeStartRef = useRef<number | null>(null);

  // `deviceClock` drives ONLY the currently showcasing 3D mesh
  const [deviceClock, setDeviceClock] = useState(0);
  const activeShowcaseStartRef = useRef(0);
  const [showcaseElapsed, setShowcaseElapsed] = useState(0);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Persistent 3D camera zoom & Earth reveal
  const cameraZoom = useRef(new Animated.Value(INITIAL_QUOTES[0].targetZoom)).current;
  const earthOpacity = useRef(new Animated.Value(INITIAL_QUOTES[0].earthReveal)).current;

  // Subtle dimming of the frozen Sun/Earth backdrop during the 3D device showcases (Stages 5..8)
  const backdropDimOpacity = useRef(new Animated.Value(1)).current;

  // Slow quote fade-in / fade-out
  const quoteOpacity = useRef(new Animated.Value(0)).current;
  const quoteTranslateY = useRef(new Animated.Value(12)).current;

  // Stage 3: Carrington 1859 two-part progressive narrative on the same page
  const carringtonWrapOpacity = useRef(new Animated.Value(1)).current;
  const carringtonPart1Opacity = useRef(new Animated.Value(0)).current;
  const carringtonPart1TranslateY = useRef(new Animated.Value(12)).current;
  const carringtonPart2Opacity = useRef(new Animated.Value(0)).current;
  const carringtonPart2TranslateY = useRef(new Animated.Value(10)).current;

  // Stage 4..8: Modern consequence text
  const modernTextOpacity = useRef(new Animated.Value(0)).current;
  const modernTextTranslateY = useRef(new Animated.Value(10)).current;

  // Master screen opacity for final fade to black
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // Per-device Animated transforms for: Zoomed-in Center Showcase -> Zoom-out into respective 2x2 Square!
  const devScale = useRef(MODERN_DEVICES.map(() => new Animated.Value(0.4))).current;
  const devTransX = useRef(MODERN_DEVICES.map(() => new Animated.Value(0))).current;
  const devTransY = useRef(MODERN_DEVICES.map(() => new Animated.Value(0))).current;
  const devOpacity = useRef(MODERN_DEVICES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    return () => {
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    };
  }, []);

  // Initial slow fade-in of Quote 1 on mount
  useEffect(() => {
    if (!visible) return;
    quoteOpacity.setValue(0);
    quoteTranslateY.setValue(12);
    Animated.parallel([
      Animated.timing(quoteOpacity, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(quoteTranslateY, {
        toValue: 0,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, quoteOpacity, quoteTranslateY]);

  // Unified simulation loop (automatically idles once a showcase docks so nothing ever lags!)
  useEffect(() => {
    if (!visible) return;
    let lastTick = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - lastTick) / 1000);
      lastTick = now;

      // Update active device showcase timer (Stages 5..8) only while showcasing (< 3.2s)
      if (stageIdx >= 5 && stageIdx <= 8) {
        const elapsed = (now - activeShowcaseStartRef.current) / 1000;
        if (elapsed <= 3.3) {
          setShowcaseElapsed(elapsed);
          setDeviceClock((prev) => prev + dt);
        }
      }

      // Advance solar/magnetosphere clock:
      // - Normal speed during Quotes (0..2) and 1859 Carrington (3)
      // - Smoothly decelerates to 0 (frozen in time!) during Stage 4
      let speedMultiplier = 1.0;
      if (stageIdx >= 4 && freezeStartRef.current !== null) {
        const freezeElapsed = (now - freezeStartRef.current) / 1000;
        const freezeDuration = 2.4;
        const rawRemaining = Math.max(0, 1 - freezeElapsed / freezeDuration);
        speedMultiplier = rawRemaining * rawRemaining;
      }

      if (speedMultiplier > 0.001) {
        solarClockValRef.current += dt * speedMultiplier;
        setSolarClock(solarClockValRef.current);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [visible, stageIdx]);

  // Helper to run a single 3D device showcase on Tap (Stages 5, 6, 7, 8):
  // 1. Zoom in at center of page (ONLINE)
  // 2. Throw sparks & brownout at center of page (BROWNOUT -> BLACKOUT + smoke)
  // 3. Zoom out into its respective 2x2 square!
  const triggerDeviceShowcase = (devIdx: number, nextStageIdx: number) => {
    setIsTransitioning(true);
    setStageIdx(nextStageIdx);
    activeShowcaseStartRef.current = Date.now();
    setShowcaseElapsed(0);

    if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
    // Deterministic safety guard so `isTransitioning` never hangs even on the 4th object!
    unlockTimerRef.current = setTimeout(() => {
      setIsTransitioning(false);
    }, 3150);

    if (devIdx === 0) {
      Animated.timing(backdropDimOpacity, {
        toValue: 0.42,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }

    devTransX[devIdx].setValue(0);
    devTransY[devIdx].setValue(-20);
    devScale[devIdx].setValue(0.55);
    devOpacity[devIdx].setValue(0);

    const targetSlot = MODERN_DEVICES[devIdx];

    Animated.sequence([
      // Phase A (0.0s - 0.42s): Zoom in to the middle of the page
      Animated.parallel([
        Animated.timing(devOpacity[devIdx], {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(devScale[devIdx], {
          toValue: 1.46,
          duration: 420,
          easing: Easing.out(Easing.back(1.12)),
          useNativeDriver: true,
        }),
      ]),
      // Phase B (0.42s - 2.35s): Hold zoomed-in at the middle of the page while it throws sparks, browns out & smokes!
      Animated.delay(1900),
      // Phase C (2.35s - 3.05s): Zoom out from the middle of the page into its respective square!
      Animated.parallel([
        Animated.timing(devScale[devIdx], {
          toValue: 1.0,
          duration: 700,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(devTransX[devIdx], {
          toValue: targetSlot.slotX,
          duration: 700,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(devTransY[devIdx], {
          toValue: targetSlot.slotY,
          duration: 700,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
      setIsTransitioning(false);
    });
  };

  const handleUserTap = () => {
    if (isTransitioning) return;

    // Taps 1 & 2: Slow succession of Quotes 1 -> 2 -> 3 while zooming into Earth
    if (stageIdx < 2) {
      const nextIdx = stageIdx + 1;
      const nextQuote = INITIAL_QUOTES[nextIdx];
      setIsTransitioning(true);

      Animated.parallel([
        Animated.timing(cameraZoom, {
          toValue: nextQuote.targetZoom,
          duration: 2000,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(earthOpacity, {
          toValue: nextQuote.earthReveal,
          duration: 2000,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      Animated.parallel([
        Animated.timing(quoteOpacity, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(quoteTranslateY, {
          toValue: -10,
          duration: 900,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setStageIdx(nextIdx);
        quoteTranslateY.setValue(12);
        Animated.parallel([
          Animated.timing(quoteOpacity, {
            toValue: 1,
            duration: 1150,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(quoteTranslateY, {
            toValue: 0,
            duration: 1150,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsTransitioning(false);
        });
      });
      return;
    }

    // Tap 3: Transition from Quote 3 -> Stage 3 (1859 Carrington Event: 145 glowing spots pummeling Earth)
    if (stageIdx === 2) {
      setIsTransitioning(true);
      carringtonWrapOpacity.setValue(1);
      carringtonPart1Opacity.setValue(0);
      carringtonPart1TranslateY.setValue(12);
      carringtonPart2Opacity.setValue(0);
      carringtonPart2TranslateY.setValue(10);

      Animated.parallel([
        Animated.timing(quoteOpacity, {
          toValue: 0,
          duration: 850,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cameraZoom, {
          toValue: 1.06,
          duration: 1500,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        solarClockValRef.current = 0;
        setSolarClock(0);
        setStageIdx(3);

        Animated.sequence([
          Animated.delay(1500),
          Animated.parallel([
            Animated.timing(carringtonPart1Opacity, {
              toValue: 1,
              duration: 1100,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(carringtonPart1TranslateY, {
              toValue: 0,
              duration: 1100,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(1350),
          Animated.parallel([
            Animated.timing(carringtonPart2Opacity, {
              toValue: 1,
              duration: 1150,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(carringtonPart2TranslateY, {
              toValue: 0,
              duration: 1150,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          setIsTransitioning(false);
        });
      });
      return;
    }

    // Tap 4: Keep Sun, Earth, Magnetic Fields & Glowing Particles on screen!
    // Slowly decelerate & freeze them while fading out 1859 text and writing the Modern Consequence text!
    if (stageIdx === 3) {
      setIsTransitioning(true);
      freezeStartRef.current = Date.now();
      modernTextOpacity.setValue(0);
      modernTextTranslateY.setValue(12);

      Animated.sequence([
        Animated.timing(carringtonWrapOpacity, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(200),
      ]).start(() => {
        setStageIdx(4);
        Animated.parallel([
          Animated.timing(modernTextOpacity, {
            toValue: 1,
            duration: 1200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(modernTextTranslateY, {
            toValue: 0,
            duration: 1200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          setIsTransitioning(false);
        });
      });
      return;
    }

    // Taps 5, 6, 7, 8: Showcase each of the 4 3D objects separately (Zoom in center -> Sparks -> Brownout -> Zoom out into square)
    if (stageIdx >= 4 && stageIdx < 8) {
      const nextDevIdx = stageIdx - 4; // 0 = Satellite, 1 = Car, 2 = Smartphone, 3 = Microprocessor
      triggerDeviceShowcase(nextDevIdx, stageIdx + 1);
      return;
    }

    // Final Tap (after the 4th 3D object — Microprocessor — has zoomed out into its square):
    // Fade to black and enter the operational screen!
    if (stageIdx === 8) {
      setIsTransitioning(true);
      Animated.sequence([
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(180),
      ]).start(() => {
        onCompleteRef.current();
      });
    }
  };

  if (!visible) return null;

  const currentQuote = INITIAL_QUOTES[Math.min(2, stageIdx)];
  const isStormActive = stageIdx >= 3;

  // Determine bottom prompt text
  let bottomPromptText = 'Tap to continue';
  if (stageIdx === 4) {
    bottomPromptText = 'Tap to explore risk (1/4: Satellite services) ›';
  } else if (stageIdx === 5) {
    bottomPromptText = isTransitioning
      ? 'Illustrating possible satellite service disruption...'
      : 'Tap for next risk (2/4: Navigation) ›';
  } else if (stageIdx === 6) {
    bottomPromptText = isTransitioning
      ? 'Illustrating possible navigation disruption...'
      : 'Tap for next risk (3/4: Communications) ›';
  } else if (stageIdx === 7) {
    bottomPromptText = isTransitioning
      ? 'Illustrating possible communications disruption...'
      : 'Tap for final risk (4/4: Power-dependent services) ›';
  } else if (stageIdx === 8) {
    bottomPromptText = isTransitioning
      ? 'Illustrating dependence on reliable electric power...'
      : 'Tap to enter AuroraSense ›';
  }

  return (
    <View style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: screenOpacity }}>
        <Pressable onPress={handleUserTap} style={styles.touchCanvas}>
          {/* ===============================================================
              PERSISTENT 3D GLOWING SUN + EARTH + MAGNETOSPHERE + PARTICLES
              (Memoized! Decelerates & freezes in Stage 4+)
             =============================================================== */}
          <Animated.View
            style={[
              styles.visualViewport,
              stageIdx >= 5 && { height: 158 },
              {
                opacity: backdropDimOpacity,
              },
            ]}
          >
            <SolarMagnetosphereBackdrop
              solarClock={solarClock}
              isStormActive={isStormActive}
              cameraZoom={cameraZoom}
              earthOpacity={earthOpacity}
            />
          </Animated.View>

          {/* ===============================================================
              NARRATIVE & 3D DEVICE SHOWCASE AREA
             =============================================================== */}
          <View style={styles.narrativeContainer}>
            {stageIdx < 3 ? (
              /* STAGES 0..2: INITIAL 3 QUOTES */
              <Animated.View
                style={[
                  styles.quoteBlock,
                  {
                    opacity: quoteOpacity,
                    transform: [{ translateY: quoteTranslateY }],
                  },
                ]}
              >
                <Text style={styles.eyebrow}>{currentQuote.eyebrow}</Text>
                <Text style={styles.quoteHeadline}>{currentQuote.quote}</Text>
                <Text style={styles.quoteSubline}>{currentQuote.subline}</Text>
              </Animated.View>
            ) : stageIdx === 3 ? (
              /* STAGE 3: SEPTEMBER 1, 1859 CARRINGTON SUPERSTORM */
              <Animated.View
                style={[
                  styles.carringtonStoryWrap,
                  {
                    opacity: carringtonWrapOpacity,
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.carringtonPart1,
                    {
                      opacity: carringtonPart1Opacity,
                      transform: [{ translateY: carringtonPart1TranslateY }],
                    },
                  ]}
                >
                  <Text style={styles.carringtonBigDate}>September 1859</Text>
                  <Text style={styles.carringtonEventBadge}>THE CARRINGTON SUPERSTORM</Text>
                  <Text style={styles.carringtonLeadText}>
                    An exceptional geomagnetic storm followed solar activity observed by Richard Carrington.
                  </Text>
                </Animated.View>

                <Animated.View
                  style={[
                    styles.carringtonPart2,
                    {
                      opacity: carringtonPart2Opacity,
                      transform: [{ translateY: carringtonPart2TranslateY }],
                    },
                  ]}
                >
                  <Text style={styles.carringtonExpandText}>
                    Telegraph communications were disrupted across the world. Auroras reached unusually low latitudes, including Hawaii and Central America.
                  </Text>
                </Animated.View>
              </Animated.View>
            ) : (
              /* STAGES 4..8: MODERN CONSEQUENCE TEXT + INSIGHTFUL MICROPROCESSOR CALLOUT + 2x2 SQUARES */
              <View style={styles.modernStageWrap}>
                <Animated.View
                  style={[
                    styles.modernTextHeader,
                    {
                      opacity: modernTextOpacity,
                      transform: [{ translateY: modernTextTranslateY }],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.modernHeadline,
                      stageIdx >= 5 && styles.modernHeadlineCompact,
                    ]}
                  >
                    Severe space weather can disrupt services we depend on.
                  </Text>
                  <Text
                    style={[
                      styles.modernSubheadline,
                      stageIdx >= 5 && styles.modernSubheadlineCompact,
                    ]}
                  >
                    Power grids, satellites, radio and navigation can be affected.
                  </Text>

                  {/* INSIGHTFUL TEXT BELOW THE STATEMENT & ABOVE THE SQUARES */}
                  <View
                    style={[
                      styles.microprocessorInsightBox,
                      stageIdx >= 5 && styles.microprocessorInsightBoxCompact,
                    ]}
                  >
                    <Text
                      style={[
                        styles.microprocessorInsightText,
                        stageIdx >= 5 && styles.microprocessorInsightTextCompact,
                      ]}
                    >
                      Extreme geomagnetic storms can damage high-voltage transformers. Satellite and ionospheric disturbances can affect navigation and communications. These stylized effects illustrate service risks, not predicted damage to consumer devices.
                    </Text>
                  </View>
                </Animated.View>

                {/* 2x2 DESTINATION SQUARES + CENTER ZOOM SHOWCASE STAGE */}
                <View style={styles.showcaseArena}>
                  {stageIdx >= 5 ? (
                    <View style={styles.gridPlaceholders} pointerEvents="none">
                      {MODERN_DEVICES.map((dev, idx) => (
                        <View
                          key={`slot-bg-${dev.id}`}
                          style={[
                            styles.placeholderSquare,
                            idx < stageIdx - 4 && styles.placeholderSquareFilled,
                          ]}
                        />
                      ))}
                    </View>
                  ) : null}

                  {/* Render each revealed 3D device (0 .. stageIdx - 5) */}
                  {MODERN_DEVICES.map((dev, idx) => {
                    const activeDevIdx = stageIdx - 5;
                    if (idx > activeDevIdx) return null;

                    const isCurrentlyShowcasing = idx === activeDevIdx && showcaseElapsed < 3.1;

                    let state: DeviceOverloadState = 'BLACKOUT';
                    let stateElapsedSec = 2.4 + idx * 0.35;
                    let effectiveClock = 3.2 + idx * 0.8;

                    if (isCurrentlyShowcasing) {
                      effectiveClock = deviceClock;
                      if (showcaseElapsed < 0.58) {
                        state = 'ONLINE';
                        stateElapsedSec = showcaseElapsed;
                      } else if (showcaseElapsed < 1.78) {
                        state = 'BROWNOUT';
                        stateElapsedSec = showcaseElapsed - 0.58;
                      } else {
                        state = 'BLACKOUT';
                        stateElapsedSec = showcaseElapsed - 1.78;
                      }
                    }

                    return (
                      <Animated.View
                        key={dev.id}
                        style={[
                          styles.deviceSquareCard,
                          state === 'BROWNOUT' && styles.insertCardBrownout,
                          state === 'BLACKOUT' && styles.insertCardBlackout,
                          {
                            zIndex: isCurrentlyShowcasing ? 40 : 10 + idx,
                            opacity: devOpacity[idx],
                            transform: [
                              { translateX: devTransX[idx] },
                              { translateY: devTransY[idx] },
                              { scale: devScale[idx] },
                            ],
                          },
                        ]}
                      >
                        <View style={styles.meshViewport}>
                          <Interactive3DDeviceInsert
                            deviceId={dev.id}
                            state={state}
                            animClock={effectiveClock}
                            stateElapsedSec={stateElapsedSec}
                            width={152}
                            height={96}
                          />
                        </View>

                        <View style={styles.insertFooter}>
                          <Text style={styles.insertLabel}>{dev.label}</Text>
                          <Text
                            style={[
                              styles.insertStatus,
                              state === 'ONLINE' && { color: '#38d9a9' },
                              state === 'BROWNOUT' && { color: '#ffa94d' },
                              state === 'BLACKOUT' && { color: '#ff6b6b' },
                            ]}
                          >
                            {state === 'ONLINE'
                              ? '● SERVICE'
                              : state === 'BROWNOUT'
                                ? '⚠ DISRUPTION'
                                : '◌ UNAVAILABLE'}
                          </Text>
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* SUBTLE BOTTOM TAP PROMPT */}
          <View style={styles.bottomFooter}>
            <Text style={[styles.tapPrompt, { fontSize: 10, marginBottom: 6 }]}
              onPress={(event) => { event.stopPropagation(); void Linking.openURL('https://www.spaceweather.gov/impacts'); }}>
              Conceptual animation · not an event reconstruction. Source: NOAA impacts ↗
            </Text>
            <View style={styles.dotsRow}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    stageIdx === i && {
                      width: 16,
                      backgroundColor:
                        stageIdx === 3 ? '#ff6b6b' : stageIdx >= 4 ? '#ffa94d' : '#38d9a9',
                    },
                  ]}
                />
              ))}
            </View>
            <Text
              style={[
                styles.tapPrompt,
                stageIdx === 8 && !isTransitioning && styles.tapPromptFinal,
              ]}
            >
              {bottomPromptText}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#000000',
    zIndex: 200,
  },
  touchCanvas: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 38,
    paddingBottom: 24,
    paddingHorizontal: 18,
  },
  visualViewport: {
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  sceneWrap: {
    width: 340,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlaySvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 340,
    height: 240,
  },
  narrativeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quoteBlock: {
    alignItems: 'center',
    maxWidth: 330,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: '#38d9a9',
    marginBottom: 12,
    textAlign: 'center',
  },
  quoteHeadline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  quoteSubline: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
  },
  carringtonStoryWrap: {
    alignItems: 'center',
    maxWidth: 336,
    gap: 14,
  },
  carringtonPart1: {
    alignItems: 'center',
  },
  carringtonBigDate: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  carringtonEventBadge: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.8,
    color: '#ff6b6b',
    marginTop: 4,
    marginBottom: 8,
    textAlign: 'center',
  },
  carringtonLeadText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  carringtonPart2: {
    backgroundColor: 'rgba(255, 82, 82, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  carringtonExpandText: {
    fontSize: 13.5,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.86)',
    textAlign: 'center',
    lineHeight: 19,
  },
  modernStageWrap: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  modernTextHeader: {
    alignItems: 'center',
    maxWidth: 344,
    gap: 5,
  },
  modernHeadline: {
    fontSize: 19.5,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 25,
    letterSpacing: -0.3,
  },
  modernHeadlineCompact: {
    fontSize: 15.5,
    lineHeight: 20,
  },
  modernSubheadline: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#ffa94d',
    textAlign: 'center',
    lineHeight: 19,
  },
  modernSubheadlineCompact: {
    fontSize: 12.5,
    lineHeight: 16,
  },
  microprocessorInsightBox: {
    marginTop: 4,
    backgroundColor: 'rgba(56, 217, 169, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 217, 169, 0.26)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  microprocessorInsightBoxCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 2,
  },
  microprocessorInsightText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.88)',
    textAlign: 'center',
    lineHeight: 18,
  },
  microprocessorInsightTextCompact: {
    fontSize: 11.5,
    lineHeight: 15.5,
  },
  showcaseArena: {
    width: 332,
    height: 248,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gridPlaceholders: {
    position: 'absolute',
    width: 324,
    height: 240,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  placeholderSquare: {
    width: 154,
    height: 116,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  placeholderSquareFilled: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  deviceSquareCard: {
    position: 'absolute',
    width: 154,
    height: 116,
    backgroundColor: '#050b14',
    borderRadius: 16,
    borderWidth: 1.3,
    borderColor: 'rgba(56, 217, 169, 0.45)',
    overflow: 'hidden',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.85,
    shadowRadius: 16,
    elevation: 10,
  },
  insertCardBrownout: {
    borderColor: '#ff9100',
    backgroundColor: '#1a0c04',
  },
  insertCardBlackout: {
    borderColor: 'rgba(255, 107, 107, 0.24)',
    backgroundColor: '#06070a',
  },
  meshViewport: {
    width: 152,
    height: 94,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020408',
  },
  insertFooter: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: 'rgba(6, 12, 20, 0.96)',
  },
  insertLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.78)',
    letterSpacing: 0.3,
  },
  insertStatus: {
    fontSize: 8,
    fontWeight: '900',
  },
  bottomFooter: {
    alignItems: 'center',
    gap: 6,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  tapPrompt: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.2,
  },
  tapPromptFinal: {
    color: '#38d9a9',
    fontWeight: '800',
    fontSize: 13.5,
  },
});
