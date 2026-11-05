import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

export type NoaaContext = {
  ovation?: { observedAtUtc?: string; validAtUtc?: string; retrievedAtUtc?: string; sourceUrl?: string; coordinates?: [number, number, number][] } | null;
  solarWind?: { sourceUrl?: string; retrievedAtUtc?: string; samples?: { observedAtUtc: string; bzNt: number | null; speedKmS: number | null; densityCm3: number | null }[] } | null;
  kp?: { sourceId?: string; sourceUrl?: string; retrievedAtUtc?: string; samples?: { observedAtUtc: string; kp: number }[] } | null;
};
export function UpstreamContext({ data }: { data: NoaaContext | null }) {
  const now = Date.now();
  const validTime = (time: string) => Number.isFinite(Date.parse(time)) && Date.parse(time) <= now + 60_000;
  const rows = data?.solarWind?.samples?.filter(row => validTime(row.observedAtUtc)) ?? [];
  const mag = rows.findLast(row => row.bzNt !== null && Number.isFinite(row.bzNt));
  const wind = rows.findLast(row => row.speedKmS !== null && Number.isFinite(row.speedKmS));
  const kp = data?.kp?.samples?.findLast(row => validTime(row.observedAtUtc) && Number.isFinite(row.kp));
  const age = (time: string, minutes: number) => now - Date.parse(time) > minutes * 60_000 ? 'STALE · ' : '';
  return <View style={styles.block}>
    <Text style={styles.title}>NOAA space-weather context</Text>
    {mag && <Text style={styles.text}>IMF Bz {mag.bzNt!.toFixed(1)} nT · GSM · {age(mag.observedAtUtc, 15)}{mag.observedAtUtc}</Text>}
    {wind && <Text style={styles.text}>Solar wind {wind.speedKmS!.toFixed(0)} km/s · {age(wind.observedAtUtc, 15)}{wind.observedAtUtc}</Text>}
    {kp && <Text style={styles.text}>Estimated Kp {kp.kp.toFixed(2)} · {age(kp.observedAtUtc, 240)}{kp.observedAtUtc}</Text>}
    {data?.ovation?.validAtUtc && <Text style={styles.text}>Aurora model valid {data.ovation.validAtUtc}</Text>}
    {!mag && !wind && !kp && <Text style={styles.text}>Checking upstream sources. Source gaps remain visible; they do not mean the magnetic field is absent.</Text>}
    <Text style={styles.muted}>Upstream solar wind is context, not a substitute for local ground measurements.</Text>
    <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL('https://www.swpc.noaa.gov/products/real-time-solar-wind'); }}><Text style={styles.link}>NOAA source ↗</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({ block: { gap: 5 }, title: { color: '#68edc3', fontSize: 13, fontWeight: '600' }, text: { color: '#eff7ff', fontSize: 11, lineHeight: 17 }, muted: { color: '#8ea8c4', fontSize: 11, lineHeight: 17 }, link: { color: '#00e5ff', fontSize: 11 } });
