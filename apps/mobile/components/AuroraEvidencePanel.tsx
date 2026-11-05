import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { evaluateEvidenceFromNoaa } from '@aurorasense/coordinator';
import { rankGroundStations, type GroundReference } from '@aurorasense/shared/ground-reference';
import { apiBaseUrl } from '../api-base';
import { useForegroundLocation } from '../foreground-location';
import { UpstreamContext, type NoaaContext } from './UpstreamContext';

export function AuroraEvidencePanel({ mode = 'live' }: { mode?: 'live' | 'replay' }) {
  const fix = useForegroundLocation(mode === 'live');
  const location = fix.status === 'ready' ? fix.location : undefined;
  const stations = rankGroundStations(location).join(',');
  const [revision, setRevision] = useState(0), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [latestNoaa, setLatestNoaa] = useState<NoaaContext | null>(null), [groundReference, setGroundReference] = useState<GroundReference | null>(null);
  const [now, setNow] = useState(() => new Date().toISOString());
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => { const listener = AppState.addEventListener('change', state => setActive(state === 'active')); return () => listener.remove(); }, []);
  useEffect(() => {
    if (!active || mode !== 'live') return;
    let mounted = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20_000);
    async function refresh() {
      setLoading(true); setError('');
      const base = apiBaseUrl();
      if (!base) { setError('Connect to the computer’s LAN web server to check public sources.'); setLoading(false); return; }
      const responses = await Promise.allSettled(['/api/noaa', `/api/ground?stations=${stations}`].map(async path => {
        const response = await fetch(`${base}${path}`, { signal: controller.signal });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          const detail = [
            typeof body?.error === 'string' ? body.error : '',
            Array.isArray(body?.errors) ? body.errors.filter((item: unknown): item is string => typeof item === 'string').join(' ') : '',
          ].filter(Boolean).join(' — ');
          throw new Error(detail || `HTTP ${response.status}`);
        }
        return body;
      }));
      if (!mounted) return;
      const messages: string[] = [];
      if (responses[0].status === 'fulfilled') { setLatestNoaa(responses[0].value.latestNoaa); messages.push(...(responses[0].value.errors ?? [])); }
      else messages.push(`NOAA refresh failed: ${responses[0].reason instanceof Error ? responses[0].reason.message : 'network request unavailable'}.`);
      if (responses[1].status === 'fulfilled') setGroundReference(responses[1].value.reference);
      else messages.push(`Ground reference refresh failed: ${responses[1].reason instanceof Error ? responses[1].reason.message : 'network request unavailable'}. Upstream context is shown separately.`);
      setError(messages.join(' ')); setNow(new Date().toISOString()); setLoading(false);
    }
    void refresh();
    const interval = setInterval(() => setRevision(value => value + 1), 60_000);
    return () => { mounted = false; clearTimeout(timeout); clearInterval(interval); controller.abort(); };
  }, [stations, revision, mode, active]);
  const result = useMemo(() => location ? evaluateEvidenceFromNoaa({ asOfUtc: now, mode: mode === 'live' ? 'LIVE' : 'REPLAY', latitudeDeg: location.latitude, longitudeDeg: location.longitude, latestNoaa, groundReference }) : null, [location, now, mode, latestNoaa, groundReference]);
  return <View style={styles.card}>
    <Text style={styles.heading}>Aurora near you</Text>
    <Text style={styles.muted}>{mode.toUpperCase()} · Source-based assessment</Text>
    <Text style={styles.muted}>{fix.message}</Text>
    {mode === 'live' && fix.status !== 'ready' && fix.status !== 'locating' && <Pressable style={styles.button} onPress={() => { void fix.refresh(); }}><Text style={styles.text}>Use my location</Text></Pressable>}
    {loading && <Text style={styles.text}>Finding the best available evidence…</Text>}
    {error ? <Text style={styles.warning}>{error}</Text> : null}
    {result ? <>
      <Text style={[styles.heading, { color: result.alertColor }]}>{result.title}</Text>
      <Text style={styles.text}>{result.summary}</Text>
      {result.evidence.map(item => <Text key={item} style={styles.text}>• {item}</Text>)}
      <Text style={styles.muted}>{result.optimalViewingWindow}</Text>
      <Text style={styles.muted}>Optical probability is uncalibrated; clouds and confirmed sightings are unknown.</Text>
      {result.sourceStatus.map(source => <Pressable key={source.source} disabled={!source.sourceUrl} onPress={() => { if (source.sourceUrl) void Linking.openURL(source.sourceUrl); }}><Text style={styles.muted}>{source.source}: {source.status} · {source.observedAtUtc ?? 'awaiting measurement time'}</Text><Text style={styles.sourceDetail}>{source.detail}</Text></Pressable>)}
      <Text style={styles.muted}>Analysis {result.asOfUtc} · {result.algorithmVersion} · deterministic evaluation, no model call.</Text>
    </> : mode === 'live' ? <><Text style={styles.warning}>A local estimate needs a current approximate location. NOAA global measurements remain available independently.</Text><UpstreamContext data={latestNoaa} /></> : <Text style={styles.muted}>Historical viewing conditions require an archived model issuance. Current feeds are not substituted.</Text>}
    <Pressable style={styles.button} disabled={loading} onPress={() => setRevision(value => value + 1)}><Text style={styles.text}>Refresh evidence</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({ card: { width: '100%', padding: 16, borderRadius: 18, backgroundColor: '#0a192b', gap: 12, borderWidth: 1, borderColor: '#163354' }, heading: { fontSize: 19, fontWeight: '700', color: '#68edc3' }, text: { color: '#eff7ff', fontSize: 13, lineHeight: 19 }, muted: { color: '#8ea8c4', fontSize: 11, lineHeight: 17 }, sourceDetail: { color: '#b7c6d8', fontSize: 10, lineHeight: 15, paddingLeft: 10 }, warning: { color: '#ffd58c', fontSize: 12 }, button: { padding: 9, borderRadius: 10, backgroundColor: '#163354' } });
