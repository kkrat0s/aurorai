import React, { useEffect, useRef, useState } from 'react';
import { Linking, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

export type StormScenarioId = 'QUIET_SOLAR_WIND' | 'MAY_2024_G5' | 'CARRINGTON_1859';

interface SolarStorm3DViewProps {
  initialScenario?: StormScenarioId;
  compact?: boolean;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function projectScene3D(
  p: Vec3,
  rotX: number,
  rotY: number,
  cx: number,
  cy: number,
  fov = 290,
  camDist = 250
) {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = p.x * cosY + p.z * sinY;
  const z1 = -p.x * sinY + p.z * cosY;

  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y2 = p.y * cosX - z1 * sinX;
  const z2 = p.y * sinX + z1 * cosX;

  const depth = Math.max(50, camDist + z2);
  const scale = fov / depth;
  return {
    x: cx + x1 * scale,
    y: cy + y2 * scale,
    scale,
    z: z2,
  };
}

const SCENARIO_META: Record<
  StormScenarioId,
  {
    badge: string;
    title: string;
    compression: number;
    fieldColor: string;
    auroraColor: string;
    headline: string;
    detail: string;
  }
> = {
  QUIET_SOLAR_WIND: {
    badge: '🌤️ QUIET SOLAR BREEZE',
    title: 'Quiet solar wind · conceptual illustration',
    compression: 0.12,
    fieldColor: '#00e5ff',
    auroraColor: '#20c997',
    headline: "Earth's magnetosphere responds to the solar wind.",
    detail:
      'Solar wind shapes the magnetosphere. Ground variation depends on location, time and current systems.',
  },
  MAY_2024_G5: {
    badge: '🌌 MAY 2024 MOTHER’S DAY G5',
    title: 'May 2024 · conceptual storm illustration',
    compression: 0.52,
    fieldColor: '#a882ff',
    auroraColor: '#ff4081',
    headline: 'Solar disturbances can transfer energy into the magnetosphere.',
    detail:
      'Reconnection, currents and particle precipitation contribute to the response. These animated waves are not reconstructed events or a measured count of reconnection cycles.',
  },
  CARRINGTON_1859: {
    badge: '🔥 1859 CARRINGTON SUPERSTORM',
    title: 'Carrington event · historical context',
    compression: 0.78,
    fieldColor: '#ff5252',
    auroraColor: '#ff1744',
    headline: 'The 1859 storm disrupted telegraph communications.',
    detail:
      'Auroras reached unusually low latitudes. Modern severe space weather can affect power grids, satellites, radio and navigation; impacts depend on the event and infrastructure.',
  },
};

export function SolarStorm3DView({
  initialScenario = 'MAY_2024_G5',
  compact = false,
}: SolarStorm3DViewProps) {
  const [scenario, setScenario] = useState<StormScenarioId>(initialScenario);
  const [tick, setTick] = useState(0);
  const [cmeWaveProgress, setCmeWaveProgress] = useState<number>(0.45);
  const [isCharging, setIsCharging] = useState(false);
  const [camRot, setCamRot] = useState({ x: 0.28, y: -0.18 });
  const dragStart = useRef({ x: 0.28, y: -0.18 });

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => (t + 1) % 10000);
      setCmeWaveProgress((prev) => {
        const speed = scenario === 'CARRINGTON_1859' ? 0.032 : scenario === 'MAY_2024_G5' ? 0.022 : 0.013;
        const next = prev + speed;
        return next > 1.35 ? 0 : next;
      });
    }, 50);
    return () => clearInterval(id);
  }, [scenario]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        dragStart.current = { x: camRot.x, y: camRot.y };
      },
      onPanResponderMove: (_, g) => {
        setCamRot({
          x: Math.max(-0.9, Math.min(0.9, dragStart.current.x + g.dy * 0.007)),
          y: Math.max(-1.1, Math.min(1.1, dragStart.current.y + g.dx * 0.007)),
        });
      },
    })
  ).current;

  const meta = SCENARIO_META[scenario];
  const W = 340;
  const H = compact ? 190 : 215;
  const cx = W / 2;
  const cy = H / 2;

  const sunPos3D: Vec3 = { x: -108, y: 0, z: 0 };
  const earthPos3D: Vec3 = { x: 42, y: 0, z: 0 };

  const sunProj = projectScene3D(sunPos3D, camRot.x, camRot.y, cx, cy);
  const earthProj = projectScene3D(earthPos3D, camRot.x, camRot.y, cx, cy);

  // Impact factor peaks when CME wave crosses Earth (around cmeWaveProgress 0.72..1.05)
  const impactBoost =
    cmeWaveProgress > 0.62 && cmeWaveProgress < 1.15
      ? Math.sin(((cmeWaveProgress - 0.62) / 0.53) * Math.PI) * 0.25
      : 0;
  const comp = Math.min(0.88, meta.compression + impactBoost);

  // Build 3D Magnetosphere Field Lines around Earth (ported from storm.html dipole + tail stretch + KHI waves)
  const planes = [0, Math.PI * 0.35, Math.PI * 0.65, Math.PI, Math.PI * 1.35, Math.PI * 1.65];
  const shells = [26, 42, 58];
  const fieldLines: Array<{ d: string; opacity: number; width: number }> = [];

  for (const theta of planes) {
    const isDayside = Math.cos(theta) < 0;
    for (const L of shells) {
      let d = '';
      const segs = 24;
      for (let j = 0; j <= segs; j++) {
        const t = j / segs;
        let phi = 0.08 + t * (Math.PI - 0.16);
        let r = L * Math.sin(phi) * Math.sin(phi);

        if (isDayside) {
          // Compress bow-shock dayside
          r *= 1.0 - comp * 0.65;
        } else {
          // Stretch nightside magnetotail + Kelvin-Helmholtz wave ripple
          r *= 1.0 + comp * 1.35;
          if (comp > 0.3) {
            const khi = Math.sin(t * 12 - tick * 0.22) * (comp * 0.08);
            phi += khi;
          }
          // Reconnection snap in deep tail during impact
          if (impactBoost > 0.14 && t > 0.42 && t < 0.58) {
            r *= 0.52;
          }
        }

        const lx = earthPos3D.x + r * Math.sin(phi) * Math.cos(theta);
        const ly = r * Math.cos(phi) * 0.85;
        const lz = r * Math.sin(phi) * Math.sin(theta);

        const pt = projectScene3D({ x: lx, y: ly, z: lz }, camRot.x, camRot.y, cx, cy);
        d += `${j === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)} `;
      }
      fieldLines.push({
        d,
        opacity: isDayside ? 0.55 + comp * 0.35 : 0.38 + comp * 0.35,
        width: isDayside ? 1.5 + comp * 0.9 : 1.2 + comp * 0.6,
      });
    }
  }

  // 3-Part CME ShockFront + Solar Wind Plasma Stream Particles
  const cmeFrontX = -88 + cmeWaveProgress * 155;
  const bowShockProj = projectScene3D({ x: cmeFrontX, y: 0, z: 0 }, camRot.x, camRot.y, cx, cy);

  const particles: Array<{ x: number; y: number; r: number; color: string; opacity: number }> = [];
  for (let i = 0; i < 28; i++) {
    const seed = (i * 37 + tick * (scenario === 'CARRINGTON_1859' ? 4.2 : 2.6)) % 185;
    const rawX = -92 + seed;
    const spreadY = Math.sin(i * 1.7 + tick * 0.08) * (10 + ((rawX + 95) / 185) * 32);
    const spreadZ = Math.cos(i * 2.3 + tick * 0.06) * 24;

    // Deflect around Earth's magnetopause
    let px = rawX;
    let py = spreadY;
    const dx = px - earthPos3D.x;
    const dist = Math.sqrt(dx * dx + py * py);
    const shieldR = 24 * (1 - comp * 0.35);
    if (dist < shieldR && dx < 12) {
      py += (py >= 0 ? 1 : -1) * (shieldR - dist) * 0.85;
    }

    const proj = projectScene3D({ x: px, y: py, z: spreadZ }, camRot.x, camRot.y, cx, cy);
    const isHotCme = Math.abs(px - cmeFrontX) < 22;
    particles.push({
      x: proj.x,
      y: proj.y,
      r: isHotCme ? 3.2 * proj.scale : 1.8 * proj.scale,
      color: isHotCme ? (scenario === 'CARRINGTON_1859' ? '#ff5252' : '#ffd58c') : '#7CE7FF',
      opacity: isHotCme ? 0.92 : 0.48,
    });
  }

  const handleFireCme = () => {
    setIsCharging(true);
    setTimeout(() => {
      setIsCharging(false);
      setCmeWaveProgress(0.08);
    }, 260);
  };

  return (
    <View style={styles.container}>
      {/* SCENARIO PILLS */}
      <View style={styles.scenarioRow}>
        {(
          [
            ['QUIET_SOLAR_WIND', '🌤️ Quiet Wind'],
            ['MAY_2024_G5', '🌌 2024 G5 Storm'],
            ['CARRINGTON_1859', '🔥 1859 Carrington'],
          ] as const
        ).map(([id, label]) => {
          const active = scenario === id;
          return (
            <Pressable
              key={id}
              onPress={() => {
                setScenario(id);
                setCmeWaveProgress(0.12);
              }}
              style={[
                styles.scenarioPill,
                active && {
                  backgroundColor: id === 'CARRINGTON_1859' ? 'rgba(255,82,82,0.22)' : 'rgba(0,229,255,0.18)',
                  borderColor: id === 'CARRINGTON_1859' ? '#ff5252' : '#00e5ff',
                },
              ]}
            >
              <Text
                style={[
                  styles.scenarioPillText,
                  active && { color: id === 'CARRINGTON_1859' ? '#ff8a80' : '#eff7ff' },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 3D INTERACTIVE CANVAS */}
      <View style={styles.viewport} {...panResponder.panHandlers}>
        <View style={styles.viewportHeader}>
          <Text style={[styles.badgeText, { color: meta.fieldColor }]}>{meta.badge}</Text>
          <Pressable onPress={handleFireCme} style={styles.fireCmeBtn}>
            <Text style={styles.fireCmeBtnText}>
              {isCharging ? '⚡ Launching CME...' : '☀️ Tap to Fire CME'}
            </Text>
          </Pressable>
        </View>

        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#fff3b0" stopOpacity="1" />
              <Stop offset="35%" stopColor="#ff9800" stopOpacity="0.85" />
              <Stop offset="75%" stopColor="#ff3d00" stopOpacity="0.28" />
              <Stop offset="100%" stopColor="#040d1a" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="earthShieldGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={meta.fieldColor} stopOpacity={0.35 + comp * 0.35} />
              <Stop offset="65%" stopColor={meta.auroraColor} stopOpacity={0.14} />
              <Stop offset="100%" stopColor="#040d1a" stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id="cmeArcGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={meta.auroraColor} stopOpacity="0.05" />
              <Stop offset="100%" stopColor="#ffffff" stopOpacity="0.85" />
            </LinearGradient>
          </Defs>

          {/* 3D Sun */}
          <Circle
            cx={sunProj.x}
            cy={sunProj.y}
            r={(isCharging ? 46 : 38) * sunProj.scale}
            fill="url(#sunGlow)"
          />
          <Circle
            cx={sunProj.x}
            cy={sunProj.y}
            r={(isCharging ? 20 : 16) * sunProj.scale}
            fill="#ffd54f"
          />

          {/* Propagating 3-Part CME Shock Arc */}
          {cmeWaveProgress > 0.04 && cmeWaveProgress < 1.15 ? (
            <Path
              d={`M ${(bowShockProj.x - 10).toFixed(1)} ${(bowShockProj.y - 38 * (0.4 + cmeWaveProgress)).toFixed(1)} Q ${(bowShockProj.x + 18).toFixed(1)} ${bowShockProj.y.toFixed(1)} ${(bowShockProj.x - 10).toFixed(1)} ${(bowShockProj.y + 38 * (0.4 + cmeWaveProgress)).toFixed(1)}`}
              stroke="url(#cmeArcGrad)"
              strokeWidth={3.5 + comp * 3}
              fill="none"
            />
          ) : null}

          {/* Earth Magnetosphere Aura */}
          <Circle
            cx={earthProj.x}
            cy={earthProj.y}
            r={54 * earthProj.scale}
            fill="url(#earthShieldGlow)"
          />

          {/* 3D Dipole & Magnetotail Field Lines */}
          {fieldLines.map((fl, idx) => (
            <Path
              key={`fl-${idx}`}
              d={fl.d}
              stroke={meta.fieldColor}
              strokeWidth={fl.width}
              strokeOpacity={fl.opacity}
              fill="none"
            />
          ))}

          {/* Solar Wind & CME Plasma Particles */}
          {particles.map((pt, idx) => (
            <Circle
              key={`sw-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r={pt.r}
              fill={pt.color}
              opacity={pt.opacity}
            />
          ))}

          {/* 3D Earth Sphere */}
          <Circle
            cx={earthProj.x}
            cy={earthProj.y}
            r={12.5 * earthProj.scale}
            fill="#1565c0"
            stroke="#80d8ff"
            strokeWidth="1.4"
          />

          {/* Glowing Polar Aurora Ovals on Earth */}
          <Ellipse
            cx={earthProj.x}
            cy={earthProj.y - 9.5 * earthProj.scale}
            rx={(6 + comp * 5) * earthProj.scale}
            ry={2.8 * earthProj.scale}
            fill={meta.auroraColor}
            opacity={0.75 + impactBoost}
          />
          <Ellipse
            cx={earthProj.x}
            cy={earthProj.y + 9.5 * earthProj.scale}
            rx={(6 + comp * 5) * earthProj.scale}
            ry={2.8 * earthProj.scale}
            fill={meta.auroraColor}
            opacity={0.75 + impactBoost}
          />
        </Svg>

        {/* TELEMETRY PILLS INSIDE VIEWPORT */}
        <View style={styles.telemetryStrip}>
          <View style={styles.telChip}>
            <Text style={styles.telLabel}>SOLAR WIND</Text>
            <Text style={styles.telVal}>Plasma + field</Text>
          </View>
          <View style={styles.telChip}>
            <Text style={styles.telLabel}>MAGNETOSPHERE</Text>
            <Text style={[styles.telVal, { color: '#ff8a80' }]}>Energy transfer</Text>
          </View>
          <View style={styles.telChip}>
            <Text style={styles.telLabel}>GROUND</Text>
            <Text style={[styles.telVal, { color: meta.fieldColor }]}>Field response</Text>
          </View>
        </View>
      </View>

      {/* CONCISE VISUAL STORY CAPTION */}
      <View
        style={[
          styles.storyCard,
          scenario === 'CARRINGTON_1859' && {
            borderColor: '#ff5252',
            backgroundColor: 'rgba(255, 82, 82, 0.08)',
          },
        ]}
      >
        <Text style={styles.storyHeadline}>{meta.headline}</Text>
        <Text style={styles.storyDetail}>{meta.detail}</Text>
        <Text style={[styles.storyDetail, { marginTop: 6 }]}>Conceptual animation · not an event reconstruction or a forecast. Sizes and timing are illustrative.</Text>
        <Text style={[styles.storyDetail, { color: '#7CE7FF', marginTop: 4 }]}
          onPress={() => { void Linking.openURL('https://www.noaa.gov/explainers/space-weather-storms-from-sun'); }}>Source: NOAA space-weather explanation ↗</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
  },
  scenarioRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  scenarioPill: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#08182b',
    borderWidth: 1,
    borderColor: '#173659',
    alignItems: 'center',
  },
  scenarioPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#8ea8c4',
  },
  viewport: {
    backgroundColor: '#030a14',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#193b61',
    padding: 10,
    overflow: 'hidden',
  },
  viewportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 5,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  fireCmeBtn: {
    backgroundColor: 'rgba(255, 179, 0, 0.18)',
    borderWidth: 1,
    borderColor: '#ffb300',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  fireCmeBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#ffd54f',
  },
  telemetryStrip: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  telChip: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 45, 0.85)',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#163354',
    alignItems: 'center',
  },
  telLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#7da0c4',
  },
  telVal: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#eff7ff',
    marginTop: 1,
  },
  storyCard: {
    marginTop: 8,
    backgroundColor: '#08182b',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#173659',
  },
  storyHeadline: {
    fontSize: 12,
    fontWeight: '800',
    color: '#eff7ff',
    marginBottom: 3,
  },
  storyDetail: {
    fontSize: 11,
    color: '#9db8d6',
    lineHeight: 15.5,
  },
});
