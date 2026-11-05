import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { comparePhoneWithReference, rankGroundStations, stationDistanceKm, groundFreshness, type CoarseLocation, type GroundReference, type GroundResponse } from '@aurorasense/shared/ground-reference';
import type { SensorQcResult, SensorSession } from '@aurorasense/shared/sensor';

import { captureLocation, useForegroundLocation } from '../foreground-location';
import { UpstreamContext, type NoaaContext } from './UpstreamContext';

export function LiveReferencePanel({ session, qc, apiBaseUrl, coarseLocation }: { session: SensorSession | null; qc: SensorQcResult | null; apiBaseUrl: string; coarseLocation?: CoarseLocation }) {
  const fix = useForegroundLocation();
  const nearby = fix.status === 'ready' ? fix.location : undefined;
  const location = coarseLocation ?? captureLocation(session?.id);
  const stations = rankGroundStations(location ?? nearby).join(',');
  const [reference, setReference] = useState<GroundReference | null>(null);
  const [latestNoaa, setLatestNoaa] = useState<NoaaContext | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [refresh, setRefresh] = useState(0);
  const [active, setActive] = useState(AppState.currentState === 'active'); const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => { const listener = AppState.addEventListener('change', state => setActive(state === 'active')); return () => listener.remove(); }, []);
  useEffect(() => {
    if (!active || !apiBaseUrl) return;
    let mounted = true; const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15_000); setBusy(true); setError('');
    fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/ground?stations=${stations}`, { signal: controller.signal }).then(async response => {
      const body = await response.json() as GroundResponse;
      if (!mounted) return; if (!response.ok || !body.reference) throw new Error('Source unavailable');
      setReference(body.reference); setError(body.errors.join(' ')); setNow(new Date().toISOString());
    }).catch(() => { if (mounted) setError('Ground reference refresh delayed. Retained readings keep their original times; upstream context is below.'); }).finally(() => { if (mounted) setBusy(false); });
    void fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/noaa`, { signal: controller.signal }).then(async response => { if (!response.ok) return; const body = await response.json(); if (mounted) setLatestNoaa(body.latestNoaa); }).catch(() => undefined);
    return () => { mounted = false; clearTimeout(timer); controller.abort(); };
  }, [active, apiBaseUrl, stations, refresh]);
  useEffect(() => { if (!active) return; const timer = setInterval(() => { setNow(new Date().toISOString()); setRefresh(n => n + 1); }, 60_000); return () => clearInterval(timer); }, [active]);
  const comparison = useMemo(() => comparePhoneWithReference(session, qc, reference, now, location), [session, qc, reference, now, location]);
  const aligned = comparison.aligned;
  const first = reference?.samples.find(s => s.value !== null)?.value ?? 0;
  const points = aligned.length > 1 ? aligned.map(p => ({ time: Date.parse(p.observedAtUtc), station: p.referenceDeltaNt, phone: p.phoneDeltaNt })) : reference?.samples.map(p => ({ time: Date.parse(p.observedAtUtc), station: p.value === null ? null : p.value - first, phone: null })) ?? [];
  const extent = Math.max(1, ...points.flatMap(p => [Math.abs(p.station ?? 0), Math.abs(p.phone ?? 0)]));
  const start = points[0]?.time ?? 0, end = points.at(-1)?.time ?? 0;
  function trace(key: 'station' | 'phone') { let previous = -Infinity; return points.map(p => { if (p[key] === null) { previous = -Infinity; return ''; } const command = p.time - previous > 90_000 ? 'M' : 'L'; previous = p.time; return `${command}${20 + (p.time - start) / Math.max(60_000, end - start) * 280},${80 - (p[key] ?? 0) / extent * 55}`; }).join(' '); }
  return <View style={styles.card}>
    <Text style={styles.title}>Live professional ground field</Text>
    <Text style={styles.muted}>USGS F · scalar nT · provisional variation · 1-minute cadence</Text>
    <Text style={styles.muted}>{fix.message} The nearest fresh supported station is selected automatically.</Text>
    {fix.status !== 'ready' && fix.status !== 'locating' && <Pressable accessibilityRole="button" style={styles.button} onPress={() => { void fix.refresh(); }}><Text style={styles.text}>Use my location</Text></Pressable>}
    <Pressable accessibilityRole="button" disabled={busy || !apiBaseUrl} style={styles.button} onPress={() => setRefresh(n => n + 1)}><Text style={styles.text}>{busy ? 'Checking USGS…' : 'Refresh ground reference'}</Text></Pressable>
    {!apiBaseUrl && <Text style={styles.warning}>Configure the web API address to load actual reference observations.</Text>}
    {!!error && <Text style={styles.warning}>{error}</Text>}
    {reference ? <>
      <Text style={styles.value}>{reference.samples.findLast(s => s.value !== null)?.value?.toFixed(1) ?? '—'} nT · {groundFreshness(reference, now).toUpperCase()}</Text>
      <Text style={styles.muted}>{reference.stationName} · observed {reference.latestObservedAtUtc ?? 'unavailable'}</Text>
      {nearby && <Text style={styles.muted}>About {Math.round(stationDistanceKm(nearby, reference) ?? 0)} km from your current coarse location. A remote station is regional context.</Text>}
      <Svg width="100%" height={180} viewBox="0 0 320 180" accessibilityLabel="Actual USGS scalar magnetic changes, with simultaneous phone readings when eligible">
        <Line x1="20" x2="300" y1="80" y2="80" stroke="#385069"/><Path d={trace('station')} stroke="#68edc3" strokeWidth="2" fill="none"/>{aligned.length > 1 && <Path d={trace('phone')} stroke="#b9a5ff" strokeWidth="2" fill="none"/>}
        <SvgText x="20" y="15" fill="#8ea8c4" fontSize="10">±{extent.toFixed(1)} nT · common scale</SvgText><SvgText x="20" y="170" fill="#8ea8c4" fontSize="10">{points.length ? `${new Date(start).toISOString().slice(11, 16)}–${new Date(end).toISOString().slice(11, 16)} UTC` : 'No valid samples'}</SvgText>
      </Svg>
      <Text style={styles.muted}>{aligned.length > 1 ? 'Violet: phone |B|; green: station F. Each offset by first two common minutes; no lag fitting or amplitude rescaling.' : 'Green: actual station ΔF from first available value in this three-hour window. Missing minutes remain gaps.'}</Text>
      <Text style={styles.muted}>Retrieved {reference.retrievedAtUtc}. Original availability unknown; provisional values may change.</Text>
      <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(reference.sourceUrl); }}><Text style={styles.link}>Open USGS source / station {reference.stationId}</Text></Pressable>
    </> : <Text style={styles.muted}>Searching the supported observatories for a verified reference.</Text>}
    <UpstreamContext data={latestNoaa} />
    <Text style={styles.title}>Phone comparison · {comparison.status.replaceAll('_', ' ')}</Text>
    <Text style={styles.muted}>{comparison.aligned.length} common minutes · {comparison.distanceKm === null ? 'recording location unverified' : `${Math.round(comparison.distanceKm)} km from recording region`}{comparison.correlation === null ? '' : ` · descriptive r=${comparison.correlation.toFixed(3)}`}</Text>
    {comparison.reasons.map(reason => <Text key={reason} style={styles.warning}>{reason}</Text>)}
    <Text style={styles.warning}>Regional evidence: INCONCLUSIVE. NOAA solar-wind GSM Bz is upstream context, not the local ground field measured by your phone.</Text>
  </View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: '#0a192b', borderColor: '#1c3b5c', borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 }, title: { color: '#eff7ff', fontWeight: '700', fontSize: 15 }, text: { color: '#eff7ff', fontSize: 12 }, muted: { color: '#8ea8c4', fontSize: 11, lineHeight: 17 }, warning: { color: '#ffd58c', fontSize: 11, lineHeight: 17 }, value: { color: '#68edc3', fontWeight: '700', fontSize: 18 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, button: { padding: 9, borderWidth: 1, borderColor: '#385069', borderRadius: 8, alignItems: 'center' }, selected: { borderColor: '#68edc3', backgroundColor: '#15382f' }, link: { color: '#00e5ff', fontSize: 12 } });
