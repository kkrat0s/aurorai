'use client';
import { useEffect, useMemo, useState } from 'react';
import { comparePhoneWithReference, GROUND_STATIONS, groundFreshness, type CoarseLocation, type GroundReference, type GroundResponse } from '@aurorasense/shared/ground-reference';
import type { SensorQcResult, SensorSession } from '@aurorasense/shared/sensor';
import Chart from './chart';

export function LiveReferencePanel({ session, qc, coarseLocation }: { session: SensorSession | null; qc: SensorQcResult | null; coarseLocation?: CoarseLocation }) {
  const [station, setStation] = useState('BOU');
  const [reference, setReference] = useState<GroundReference | null>(null);
  const [error, setError] = useState(''); const [refresh, setRefresh] = useState(0); const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    let active = true; const controller = new AbortController(); setBusy(true); setError('');
    const timeout = setTimeout(() => controller.abort(), 15_000);
    fetch(`/api/ground?station=${station}`, { signal: controller.signal }).then(async response => {
      const body = await response.json() as GroundResponse;
      if (!active) return; if (!response.ok || !body.reference) throw new Error(body.errors?.join(' ') || 'Live ground source unavailable');
      setReference(body.reference); setError(body.errors.join(' ')); setNow(new Date().toISOString());
    }).catch(() => { if (active) setError('Live station refresh failed. Any retained trace keeps its original observation and retrieval times.'); }).finally(() => { clearTimeout(timeout); if (active) setBusy(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [station, refresh]);
  useEffect(() => { const timer = setInterval(() => { setNow(new Date().toISOString()); if (document.visibilityState === 'visible') setRefresh(n => n + 1); }, 60_000); return () => clearInterval(timer); }, []);
  const comparison = useMemo(() => comparePhoneWithReference(session, qc, reference, now, coarseLocation), [session, qc, reference, now, coarseLocation]);
  const first = reference?.samples.find(s => s.value !== null)?.value ?? 0;
  const paired = comparison.aligned;
  const extent = Math.max(1, ...paired.flatMap(p => [Math.abs(p.phoneDeltaNt), Math.abs(p.referenceDeltaNt)]));
  const start = Date.parse(paired[0]?.observedAtUtc ?? ''); const end = Date.parse(paired.at(-1)?.observedAtUtc ?? '');
  function path(key: 'phoneDeltaNt' | 'referenceDeltaNt') { return paired.map((point, i) => `${i === 0 || Date.parse(point.observedAtUtc) - Date.parse(paired[i - 1].observedAtUtc) > 90_000 ? 'M' : 'L'}${30 + (Date.parse(point.observedAtUtc) - start) / Math.max(60_000, end - start) * 620},${100 - point[key] / extent * 70}`).join(' '); }
  return <section className="panel">
    <div className="panel-heading"><div><h3>Live professional ground reference</h3><p>USGS scalar F · provisional variation · 1-minute observations</p></div><span className="badge mint">{reference ? groundFreshness(reference, now).toUpperCase() : 'UNAVAILABLE'}</span></div>
    <label className="tiny-label">USGS station <select aria-label="Live USGS station" value={station} onChange={event => { setStation(event.target.value); setReference(null); }}>{GROUND_STATIONS.map(item => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></label>
    <button className="text-button" disabled={busy} onClick={() => setRefresh(n => n + 1)}>{busy ? 'Checking USGS…' : 'Refresh ground reference'}</button>
    {error && <p className="notice" role="status">{error}</p>}
    {reference ? <>
      <p><strong>{reference.samples.findLast(s => s.value !== null)?.value?.toFixed(1) ?? '—'} nT</strong> scalar F · {reference.stationName}</p>
      <Chart points={reference.samples.map(s => ({ time: s.observedAtUtc, value: s.value === null ? null : s.value - first }))} label={`USGS ${reference.stationId} scalar F change relative to first available sample in this three-hour window`} unit="nT" maxGapMs={90_000}/>
      <p className="fine">ΔF from first available station sample in this three-hour window; missing minutes remain gaps. Observed: {reference.latestObservedAtUtc ?? 'no valid sample'} · retrieved: {reference.retrievedAtUtc}. Original operational availability is unknown.</p>
      <div className="source-line"><a href={reference.sourceUrl} target="_blank" rel="noreferrer">USGS {reference.stationId} · source data</a><span>F · SCALAR · nT</span></div>
      <details className="details"><summary>Reference provenance</summary><p className="fine">SHA-256: {reference.sha256}<br/>Provider generated: {reference.generatedAtUtc ?? 'unknown'}<br/>Quality: provisional variation; revisions possible. This is a ground measurement; upstream NOAA GSM Bz is a different physical quantity.</p></details>
    </> : <p className="notice">{busy ? 'Loading actual observatory readings…' : 'No verified live station samples loaded.'}</p>}
    <h4>Simultaneous phone comparison</h4>
    <p className="fine">{comparison.status.replaceAll('_', ' ')} · {comparison.distanceKm === null ? 'Distance unknown' : `${Math.round(comparison.distanceKm)} km from selected coarse region`} · {paired.length} common minute bins</p>
    {paired.length > 1 && <><svg viewBox="0 0 680 210" role="img" aria-label="Phone and USGS scalar changes in nT on the same UTC minute scale"><line x1="30" x2="650" y1="100" y2="100" stroke="#385069"/><path d={path('phoneDeltaNt')} stroke="#b9a5ff" strokeWidth="2" fill="none"/><path d={path('referenceDeltaNt')} stroke="#68edc3" strokeWidth="2" fill="none"/><text x="30" y="20" fill="#8ea8c4" fontSize="12">±{extent.toFixed(1)} nT · common scale</text><text x="30" y="200" fill="#8ea8c4" fontSize="11">{paired[0].observedAtUtc.slice(11, 16)}–{paired.at(-1)!.observedAtUtc.slice(11, 16)} UTC</text></svg><p className="fine">Violet: phone |B| · green: USGS F. Each trace offset by its first two common minutes. No lag fitting or amplitude rescaling.</p></>}
    {comparison.correlation !== null && <p>Descriptive Pearson r: <strong>{comparison.correlation.toFixed(3)}</strong></p>}
    <div className="notice">{comparison.reasons.map(reason => <p key={reason}>{reason}</p>)}<strong>Regional verdict: INCONCLUSIVE</strong></div>
  </section>;
}
