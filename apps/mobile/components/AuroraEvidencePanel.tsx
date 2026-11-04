import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { evaluateEvidenceFromNoaa, type AuroraAlertEvaluationResult } from '@aurorasense/coordinator';
import { apiBaseUrl } from '../api-base';

const regions = [
  { name: 'Boulder', lat: 40, lon: -105 }, { name: 'Fairbanks', lat: 65, lon: -148 },
  { name: 'Tromsø', lat: 70, lon: 19 }, { name: 'Florida', lat: 28, lon: -82 },
  { name: 'Hobart', lat: -43, lon: 147 },
];

export function AuroraEvidencePanel({ mode = 'live' }: { mode?: 'live' | 'replay' }) {
  const [regionIndex, setRegionIndex] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<AuroraAlertEvaluationResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const region = regions[regionIndex];
    async function refresh() {
      setLoading(true); setError(''); setResult(null);
      let latestNoaa = null; let groundReference = null;
      const errors: string[] = [];
      if (mode === 'live') {
        const base = apiBaseUrl();
        if (!base) errors.push('Set EXPO_PUBLIC_API_URL to your running web server.');
        else {
          const responses = await Promise.allSettled(['/api/noaa', '/api/ground?station=BOU'].map(async path => {
            const response = await fetch(`${base}${path}`, { signal: controller.signal });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error ?? `${path}: unavailable (${response.status})`);
            if (Array.isArray(body.errors)) errors.push(...body.errors);
            return body;
          }));
          if (responses[0].status === 'fulfilled') latestNoaa = responses[0].value.latestNoaa;
          else errors.push('NOAA feed unavailable.');
          if (responses[1].status === 'fulfilled') groundReference = responses[1].value.reference;
          else errors.push('Professional ground feed unavailable.');
        }
      }
      if (!active) return;
      setResult(evaluateEvidenceFromNoaa({ asOfUtc: new Date().toISOString(), mode: mode === 'live' ? 'LIVE' : 'REPLAY', latitudeDeg: region.lat, longitudeDeg: region.lon, latestNoaa, groundReference }));
      setError(errors.join(' ')); setLoading(false);
    }
    void refresh();
    const interval = setInterval(() => setRevision(value => value + 1), 60000);
    return () => { active = false; clearTimeout(timeout); clearInterval(interval); controller.abort(); };
  }, [regionIndex, revision, mode]);
  return <View style={styles.card}>
    <Text style={styles.heading}>Local aurora evidence</Text>
    <Text style={styles.muted}>{mode.toUpperCase()} · Deterministic evidence analysis · no model call</Text>
    <View style={styles.regions}>{regions.map((region, index) => <Pressable key={region.name} onPress={() => setRegionIndex(index)} style={[styles.button, index === regionIndex && styles.selected]}><Text style={styles.text}>{region.name}</Text></Pressable>)}</View>
    <Text style={styles.muted}>Coarse geographic region; no GPS requested. Choose your region before interpreting the result.</Text>
    {loading && <Text style={styles.text}>Checking current source timestamps…</Text>}
    {error ? <Text style={styles.warning}>{error}</Text> : null}
    {result && <>
      <Text style={[styles.heading, { color: result.alertColor }]}>{result.title}</Text>
      <Text style={styles.text}>{result.summary}</Text>
      <Text style={styles.muted}>Viewing probability: uncalibrated / unavailable. Clouds and confirmed optical sightings: unknown.</Text>
      {result.evidence.map(item => <Text key={item} style={styles.text}>• {item}</Text>)}
      {result.sourceStatus.map(source => <Pressable key={source.source} disabled={!source.sourceUrl} onPress={() => { if (source.sourceUrl) void Linking.openURL(source.sourceUrl); }}><Text style={styles.muted}>{source.source}: {source.status} · {source.observedAtUtc ?? 'no measurement time'}</Text></Pressable>)}
      <Text style={styles.muted}>{result.optimalViewingWindow}</Text>
      <Text style={styles.muted}>{result.localMeasurementTrigger.reason}</Text>
      <Text style={styles.muted}>Analysis {result.asOfUtc} · {result.algorithmVersion}. A phone reading cannot confirm visible aurora.</Text>
    </>}
    <Pressable style={styles.button} disabled={loading} onPress={() => setRevision(value => value + 1)}><Text style={styles.text}>Refresh evidence</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({ card: { width: '100%', padding: 16, borderRadius: 18, backgroundColor: '#0a192b', gap: 12, borderWidth: 1, borderColor: '#163354' }, heading: { fontSize: 19, fontWeight: '700', color: '#68edc3' }, text: { color: '#eff7ff', fontSize: 13, lineHeight: 19 }, muted: { color: '#8ea8c4', fontSize: 11, lineHeight: 17 }, warning: { color: '#ffd58c', fontSize: 12 }, regions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { padding: 9, borderRadius: 10, backgroundColor: '#163354' }, selected: { borderWidth: 1, borderColor: '#68edc3' } });
