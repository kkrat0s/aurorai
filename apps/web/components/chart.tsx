'use client';
import { useState, useRef, type PointerEvent } from 'react';

type Point = { time: string; value: number | null };

export default function Chart({
  points,
  label,
  color = 'var(--mint)',
  unit = 'nT',
  height = 220,
  maxGapMs = 90_000,
}: {
  points: Point[];
  label: string;
  color?: string;
  unit?: string;
  height?: number;
  maxGapMs?: number;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const valid = points.filter((p): p is { time: string; value: number } => p.value !== null && Number.isFinite(p.value));
  if (!valid.length) return <div className="empty-chart">No verified samples available for this interval.</div>;

  const minTime = Date.parse(points[0].time), maxTime = Date.parse(points.at(-1)!.time);
  const low = Math.min(...valid.map(p => p.value)), high = Math.max(...valid.map(p => p.value));
  const spread = high - low || 1, min = low - spread * 0.12, max = high + spread * 0.12;
  const x = (t: string) => 56 + (Date.parse(t) - minTime) / Math.max(maxTime - minTime, 1) * 704;
  const y = (value: number) => 20 + (max - value) / (max - min) * (height - 60);

  let pen = false;
  const d = points.map((p, i) => {
    if (p.value === null || !Number.isFinite(p.value)) { pen = false; return ''; }
    if (i > 0 && (Date.parse(p.time) - Date.parse(points[i - 1].time) > maxGapMs || Date.parse(p.time) <= Date.parse(points[i - 1].time))) pen = false;
    const command = `${pen ? 'L' : 'M'}${x(p.time).toFixed(2)},${y(p.value).toFixed(2)}`;
    pen = true;
    return command;
  }).join(' ');

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * 800;
    if (svgX < 56 || svgX > 760) {
      setHoverIndex(null);
      return;
    }
    let closestIdx: number | null = null;
    let closestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.value === null || !Number.isFinite(p.value)) continue;
      const dist = Math.abs(x(p.time) - svgX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    setHoverIndex(closestIdx);
  };

  const handlePointerLeave = () => setHoverIndex(null);

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;
  const activeX = activePoint && activePoint.value !== null ? x(activePoint.time) : 0;
  const activeY = activePoint && activePoint.value !== null ? y(activePoint.value) : 0;

  return (
    <svg
      ref={svgRef}
      className="trace-chart"
      viewBox={`0 0 800 ${height}`}
      role="img"
      aria-label={label}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ touchAction: 'none', cursor: 'crosshair' }}
    >
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <g key={f}>
          <line x1="56" y1={20 + f * (height - 60)} x2="760" y2={20 + f * (height - 60)} stroke="var(--grid)" />
          <text x="46" y={24 + f * (height - 60)} textAnchor="end">
            {(max - f * (max - min)).toFixed(0)}
          </text>
        </g>
      ))}
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      <text x="56" y={height - 10}>{new Date(minTime).toISOString().slice(5, 16).replace('T', ' ')}</text>
      <text x="760" y={height - 10} textAnchor="end">{new Date(maxTime).toISOString().slice(5, 16).replace('T', ' ')} UTC</text>
      <text x="8" y="13">{unit}</text>

      {activePoint && activePoint.value !== null && (
        <g pointerEvents="none">
          <line x1={activeX} y1={20} x2={activeX} y2={height - 40} stroke="#68edc3" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx={activeX} cy={activeY} r="5" fill={color} stroke="#eff7ff" strokeWidth="1.5" />
          <g transform={`translate(${Math.min(640, Math.max(70, activeX - 65))}, ${Math.max(10, activeY - 32)})`}>
            <rect x="0" y="0" width="130" height="24" rx="4" ry="4" fill="#08151f" fillOpacity="0.92" stroke="#537184" strokeWidth="1" />
            <text x="65" y="16" textAnchor="middle" fill="#eff7ff" fontSize="10" fontFamily="system-ui" fontWeight="bold">
              {activePoint.value.toFixed(1)} {unit} · {activePoint.time.slice(11, 16)}Z
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}
