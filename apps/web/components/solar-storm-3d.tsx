'use client';

import React, { useEffect, useRef, useState } from 'react';

export type WebStormScenario = 'QUIET_WIND' | 'MAY_2024_G5' | 'CARRINGTON_1859';

const SCENARIOS: Record<
  WebStormScenario,
  {
    badge: string;
    title: string;
    speedKms: number;
    bzNt: number;
    groundNt: string;
    compression: number;
    fieldHex: string;
    auroraHex: string;
    summary: string;
  }
> = {
  QUIET_WIND: {
    badge: '🌤️ QUIET SOLAR WIND',
    title: 'Calm Solar Breeze (~390 km/s)',
    speedKms: 390,
    bzNt: -2.1,
    groundNt: '10–30 nT',
    compression: 0.14,
    fieldHex: '#00e5ff',
    auroraHex: '#20c997',
    summary:
      "Earth's dipole magnetic shield deflects routine solar wind plasma; ground sensors see only gentle 10–30 nT daily variations.",
  },
  MAY_2024_G5: {
    badge: '🌌 MAY 2024 MOTHER’S DAY G5',
    title: 'Extreme G5 Storm · 11 KHI Reconnection Cycles',
    speedKms: 880,
    bzNt: -41.0,
    groundNt: '400–700 nT',
    compression: 0.54,
    fieldHex: '#a882ff',
    auroraHex: '#ff4081',
    summary:
      'Successive CME shocks compressed Earth’s shield and triggered Kelvin-Helmholtz vortices & 11 magnetotail reconnection snaps ($500M GPS farming impact).',
  },
  CARRINGTON_1859: {
    badge: '🔥 1859 CARRINGTON SUPERSTORM',
    title: 'Telegraphs Caught Fire · $2.4T Modern Grid Risk',
    speedKms: 2150,
    bzNt: -85.0,
    groundNt: '1,600–5,000+ nT',
    compression: 0.8,
    fieldHex: '#ff5252',
    auroraHex: '#ff1744',
    summary:
      'In Sept 1859, geomagnetically induced currents sparked fires in telegraph stations and let operators transmit with batteries unplugged. A repeat today threatens global transformers & satellites ($2.4T Lloyd’s estimate).',
  },
};

export function SolarMagnetosphere3DCanvas({
  initialScenario = 'MAY_2024_G5',
}: {
  initialScenario?: WebStormScenario;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scenario, setScenario] = useState<WebStormScenario>(initialScenario);
  const [cmePulse, setCmePulse] = useState(0.35);
  const rotRef = useRef({ x: 0.25, y: -0.18 });
  const draggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const cmeProgressRef = useRef(0.35);

  useEffect(() => {
    cmeProgressRef.current = cmePulse;
  }, [cmePulse]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let tick = 0;

    const project = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number
    ) => {
      const rx = rotRef.current.x;
      const ry = rotRef.current.y + Math.sin(tick * 0.008) * 0.06;

      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;

      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;

      const fov = 340;
      const dist = Math.max(60, 280 + z2);
      const scale = fov / dist;
      return {
        x: w * 0.5 + x1 * scale,
        y: h * 0.5 + y2 * scale,
        scale,
        z: z2,
      };
    };

    const render = () => {
      tick += 1;
      const w = canvas.width;
      const h = canvas.height;
      const meta = SCENARIOS[scenario];

      const speedStep =
        scenario === 'CARRINGTON_1859' ? 0.012 : scenario === 'MAY_2024_G5' ? 0.008 : 0.005;
      cmeProgressRef.current = (cmeProgressRef.current + speedStep) % 1.35;
      const cmeProg = cmeProgressRef.current;

      ctx.clearRect(0, 0, w, h);

      // Deep space background gradient
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, w * 0.7);
      bg.addColorStop(0, '#07182e');
      bg.addColorStop(1, '#020710');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const impactBoost =
        cmeProg > 0.6 && cmeProg < 1.12
          ? Math.sin(((cmeProg - 0.6) / 0.52) * Math.PI) * 0.25
          : 0;
      const comp = Math.min(0.88, meta.compression + impactBoost);

      // 1. Draw 3D Sun on Left
      const sunP = project(-135, 0, 0, w, h);
      const sunR = 34 * sunP.scale;
      const sunGlow = ctx.createRadialGradient(
        sunP.x,
        sunP.y,
        sunR * 0.15,
        sunP.x,
        sunP.y,
        sunR * 2.4
      );
      sunGlow.addColorStop(0, '#fff7b2');
      sunGlow.addColorStop(0.35, '#ff9800');
      sunGlow.addColorStop(0.7, 'rgba(255, 61, 0, 0.28)');
      sunGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunP.x, sunP.y, sunR * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // 2. Draw 3-Part CME Shock Arc
      const cmeX = -110 + cmeProg * 195;
      if (cmeProg > 0.03 && cmeProg < 1.15) {
        const arcP = project(cmeX, 0, 0, w, h);
        ctx.save();
        ctx.strokeStyle = scenario === 'CARRINGTON_1859' ? '#ff5252' : '#ffd58c';
        ctx.lineWidth = 3 + comp * 3;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(arcP.x - 18, arcP.y, (28 + cmeProg * 42) * arcP.scale, -0.85, 0.85);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Draw 3D Earth Magnetosphere Field Lines (dipole r = L * sin^2(phi) + KHI waves)
      const earthX = 52;
      const earthP = project(earthX, 0, 0, w, h);

      const planes = 12;
      const shells = [28, 46, 64];
      for (let pIdx = 0; pIdx < planes; pIdx++) {
        const theta = (pIdx / planes) * Math.PI * 2;
        const isDayside = Math.cos(theta) < 0;
        for (const L of shells) {
          ctx.beginPath();
          const segs = 28;
          for (let j = 0; j <= segs; j++) {
            const t = j / segs;
            let phi = 0.08 + t * (Math.PI - 0.16);
            let r = L * Math.sin(phi) * Math.sin(phi);

            if (isDayside) {
              r *= 1.0 - comp * 0.65;
            } else {
              r *= 1.0 + comp * 1.4;
              if (comp > 0.3) {
                phi += Math.sin(t * 14 - tick * 0.12) * comp * 0.07;
              }
              if (impactBoost > 0.14 && t > 0.42 && t < 0.58) {
                r *= 0.5;
              }
            }

            const lx = earthX + r * Math.sin(phi) * Math.cos(theta);
            const ly = r * Math.cos(phi) * 0.85;
            const lz = r * Math.sin(phi) * Math.sin(theta);
            const pt = project(lx, ly, lz, w, h);
            if (j === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.strokeStyle = meta.fieldHex;
          ctx.globalAlpha = isDayside ? 0.52 : 0.34;
          ctx.lineWidth = isDayside ? 1.7 : 1.2;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // 4. Draw Solar Wind & CME Plasma Particles
      for (let i = 0; i < 65; i++) {
        const seed = (i * 29 + tick * (scenario === 'CARRINGTON_1859' ? 2.6 : 1.6)) % 230;
        const px = -115 + seed;
        let py = Math.sin(i * 1.9 + tick * 0.04) * (10 + ((px + 115) / 230) * 38);
        const pz = Math.cos(i * 2.3 + tick * 0.03) * 28;

        const dx = px - earthX;
        const d2 = Math.sqrt(dx * dx + py * py);
        const shieldR = 26 * (1 - comp * 0.35);
        if (d2 < shieldR && dx < 14) {
          py += (py >= 0 ? 1 : -1) * (shieldR - d2) * 0.9;
        }

        const pt = project(px, py, pz, w, h);
        const isHot = Math.abs(px - cmeX) < 24;
        ctx.fillStyle = isHot
          ? scenario === 'CARRINGTON_1859'
            ? '#ff5252'
            : '#ffd58c'
          : '#7ce7ff';
        ctx.globalAlpha = isHot ? 0.92 : 0.48;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (isHot ? 3.1 : 1.7) * pt.scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 5. Draw 3D Earth Sphere & Glowing Polar Aurora Ovals
      const earthR = 14 * earthP.scale;
      const eGrad = ctx.createRadialGradient(
        earthP.x - earthR * 0.3,
        earthP.y - earthR * 0.2,
        earthR * 0.1,
        earthP.x,
        earthP.y,
        earthR * 1.4
      );
      eGrad.addColorStop(0, '#4fc3f7');
      eGrad.addColorStop(0.65, '#0d47a1');
      eGrad.addColorStop(1, '#041226');
      ctx.fillStyle = eGrad;
      ctx.beginPath();
      ctx.arc(earthP.x, earthP.y, earthR, 0, Math.PI * 2);
      ctx.fill();

      // North & South Polar Aurora Rings
      ctx.save();
      ctx.fillStyle = meta.auroraHex;
      ctx.globalAlpha = 0.78 + impactBoost;
      ctx.beginPath();
      ctx.ellipse(
        earthP.x,
        earthP.y - earthR * 0.78,
        earthR * (0.55 + comp * 0.35),
        earthR * 0.22,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(
        earthP.x,
        earthP.y + earthR * 0.78,
        earthR * (0.55 + comp * 0.35),
        earthR * 0.22,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [scenario]);

  const [quoteIdx, setQuoteIdx] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const QUOTES: Array<{
    era: string;
    quote: string;
    sub: string;
    scen: WebStormScenario;
  }> = [
    {
      era: '600 BC · THALES OF MILETUS',
      quote: '“The lodestone has a soul, for it moves the iron.”',
      sub: 'Humanity’s first glimpse of an invisible magnetic force.',
      scen: 'QUIET_WIND',
    },
    {
      era: '1600 · WILLIAM GILBERT',
      quote: '“The Earth itself is a great magnet.”',
      sub: 'A planetary shield born in our molten iron core.',
      scen: 'QUIET_WIND',
    },
    {
      era: '1831 · FARADAY & MAXWELL',
      quote: '“Every electric current creates a magnetic field — and every shifting magnetic field induces electricity.”',
      sub: 'Wires, watches, and solar plasma weave coupled electromagnetic waves.',
      scen: 'MAY_2024_G5',
    },
    {
      era: 'SEPTEMBER 1859 · THE CARRINGTON EVENT',
      quote: 'A solar superstorm struck Earth. Telegraph systems caught fire.',
      sub: 'Induced ground currents were so strong that operators sent messages with batteries unplugged.',
      scen: 'CARRINGTON_1859',
    },
    {
      era: 'IF 1859 STRIKES TODAY',
      quote: 'Microprocessors, AI chips, satellites, and transformers would fry in minutes.',
      sub: 'A direct hit today could send modern civilization back to the Stone Age — unless we monitor Earth’s shield.',
      scen: 'CARRINGTON_1859',
    },
  ];

  useEffect(() => {
    const id = setInterval(() => {
      setFadeIn(false);
      setTimeout(() => {
        setQuoteIdx((q) => {
          const next = (q + 1) % QUOTES.length;
          setScenario(QUOTES[next].scen);
          setCmePulse(0.08);
          return next;
        });
        setFadeIn(true);
      }, 450);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        background: '#02060e',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 24,
        padding: '1.25rem',
        marginBottom: '1rem',
        textAlign: 'center',
      }}
    >
      {/* APPLE-STYLE AUTO-FADING QUOTE & 1859 CARRINGTON STORY */}
      <div
        style={{
          minHeight: 86,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '0.85rem',
          opacity: fadeIn ? 1 : 0,
          transform: fadeIn ? 'translateY(0px)' : 'translateY(6px)',
          transition: 'opacity 0.45s ease, transform 0.45s ease',
        }}
      >
        <span
          style={{
            fontSize: '0.66rem',
            fontWeight: 800,
            letterSpacing: '0.16em',
            color: '#20c997',
            marginBottom: '0.35rem',
          }}
        >
          {QUOTES[quoteIdx].era}
        </span>
        <div
          style={{
            fontSize: '1.2rem',
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            maxWidth: 640,
          }}
        >
          {QUOTES[quoteIdx].quote}
        </div>
        <div
          style={{
            fontSize: '0.84rem',
            color: 'rgba(255, 255, 255, 0.58)',
            marginTop: '0.28rem',
            maxWidth: 580,
          }}
        >
          {QUOTES[quoteIdx].sub}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={760}
        height={220}
        onMouseDown={(e) => {
          draggingRef.current = true;
          lastMouseRef.current = { x: e.clientX, y: e.clientY };
        }}
        onMouseMove={(e) => {
          if (!draggingRef.current) return;
          const dx = e.clientX - lastMouseRef.current.x;
          const dy = e.clientY - lastMouseRef.current.y;
          lastMouseRef.current = { x: e.clientX, y: e.clientY };
          rotRef.current = {
            x: Math.max(-0.9, Math.min(0.9, rotRef.current.x + dy * 0.007)),
            y: Math.max(-1.1, Math.min(1.1, rotRef.current.y + dx * 0.007)),
          };
        }}
        onMouseUp={() => {
          draggingRef.current = false;
        }}
        onMouseLeave={() => {
          draggingRef.current = false;
        }}
        style={{
          width: '100%',
          height: 220,
          borderRadius: 16,
          cursor: 'grab',
          display: 'block',
        }}
      />
    </div>
  );
}
