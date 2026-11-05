import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { rankGroundStations, type GroundReference, type GroundResponse } from '@aurorasense/shared/ground-reference';
import { apiBaseUrl } from '../api-base';
import { useForegroundLocation } from '../foreground-location';
import { readSourceJson, sourceErrorDetails, sourceRequestFailure } from '../source-response';

export type LivePhonePoint = {
  receivedAtUtc: string;
  sensorTimestampSeconds: number;
  magnitudeMicroT: number;
  deltaNt: number;
};
type SeriesPoint = { at: string; value: number | null; status?: string };
type WindSeries = {
  sourceUrl: string;
  retrievedAtUtc: string;
  samples: { observedAtUtc: string; bzNt: number | null; speedKmS: number | null; densityCm3: number | null }[];
};
type KpForecast = {
  sourceId: 'NOAA_KP_FORECAST';
  sourceUrl: string;
  retrievedAtUtc: string;
  issuanceAtUtc: null;
  points: { validAtUtc: string; kp: number; status: 'OBSERVED' | 'ESTIMATED' | 'PREDICTED'; noaaScale: string | null }[];
};
type NoaaResponse = { latestNoaa?: { solarWind?: WindSeries | null } } & { errors?: string[]; error?: string };
type GroundApiResponse = GroundResponse & { errors?: string[]; error?: string };
type KpForecastResponse = { forecast: KpForecast | null; errors?: string[]; error?: string };

function SourceStatus({ at, now, thresholdMinutes }: { at?: string | null; now: number; thresholdMinutes: number }) {
  const epoch = Date.parse(at ?? '');
  const age = now - epoch;
  const fresh = Number.isFinite(epoch) && age >= -60_000 && age <= thresholdMinutes * 60_000;
  return <Text style={[styles.fresh, !fresh && styles.stale]}>{fresh ? 'FRESH' : Number.isFinite(epoch) ? 'STALE' : 'WAITING'}</Text>;
}

function axisLabel(epoch: number) {
  return new Date(epoch).toISOString().slice(5, 16).replace('T', ' ') + 'Z';
}

function Trace({
  points,
  unit,
  mode = 'relative',
  maxGapMinutes = 2,
}: {
  points: SeriesPoint[];
  unit: string;
  mode?: 'relative' | 'kp';
  maxGapMinutes?: number;
}) {
  const timed = points.filter(point => Number.isFinite(Date.parse(point.at))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const measured = timed.filter(point => point.value !== null && Number.isFinite(point.value));
  if (!measured.length) return <View style={styles.emptyChart}><Text style={styles.muted}>Waiting for a valid source sample. Missing points are left blank.</Text></View>;
  const first = Date.parse(timed[0].at);
  const last = Date.parse(timed.at(-1)!.at);
  const xSpan = Math.max(1000, last - first);
  const minValue = mode === 'kp' ? 0 : Math.min(0, ...measured.map(point => point.value!));
  const maxValue = mode === 'kp' ? 9 : Math.max(0, ...measured.map(point => point.value!));
  const padding = mode === 'kp' ? 0 : Math.max(1, (maxValue - minValue) * 0.12);
  const low = mode === 'kp' ? 0 : minValue - padding;
  const high = mode === 'kp' ? 9 : maxValue + padding;
  const ySpan = Math.max(1e-6, high - low);
  const x = (at: string) => 25 + (Date.parse(at) - first) / xSpan * 269;
  const y = (value: number) => 56 - (value - low) / ySpan * 40;

  const segments: SeriesPoint[][] = [];
  let segment: SeriesPoint[] = [];
  for (const point of timed) {
    if (point.value === null || !Number.isFinite(point.value)) {
      if (segment.length) segments.push(segment);
      segment = [];
      continue;
    }
    if (segment.length && Date.parse(point.at) - Date.parse(segment.at(-1)!.at) > maxGapMinutes * 60_000) {
      segments.push(segment);
      segment = [];
    }
    segment.push(point);
  }
  if (segment.length) segments.push(segment);
  const lineColor = mode === 'kp' ? '#8296b0' : '#68edc3';
  const statusColor = (status?: string) => status === 'PREDICTED' ? '#b9a5ff' : status === 'ESTIMATED' ? '#ffd58c' : '#68edc3';

  return <Svg width="100%" height={88} viewBox="0 0 300 88" accessibilityLabel={`Time series ${unit}; independent time axis; source timestamps shown below`}>
    <Line x1="25" y1="56" x2="294" y2="56" stroke="#385069" strokeWidth="1" />
    {mode === 'kp' && [3, 5, 7].map(kp => <Line key={kp} x1="25" y1={y(kp)} x2="294" y2={y(kp)} stroke="#385069" strokeDasharray="2 4" />)}
    {segments.map((group, index) => {
      const d = group.map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'}${x(point.at).toFixed(2)},${y(point.value!).toFixed(2)}`).join(' ');
      return <Path key={index} d={d} stroke={lineColor} strokeWidth="2" fill="none" />;
    })}
    {mode === 'kp' && measured.map(point => <Circle key={point.at} cx={x(point.at)} cy={y(point.value!)} r="2.6" fill={statusColor(point.status)} />)}
    {mode !== 'kp' && segments.filter(group => group.length === 1).map(([point]) => <Circle key={`single-${point.at}`} cx={x(point.at)} cy={y(point.value!)} r="2.6" fill={lineColor} />)}
    <SvgText x="25" y="76" fill="#8ea8c4" fontSize="7">{axisLabel(first)} UTC</SvgText>
    <SvgText x="294" y="76" fill="#8ea8c4" fontSize="7" textAnchor="end">{axisLabel(last)} UTC</SvgText>
    <SvgText x="25" y="10" fill="#8ea8c4" fontSize="8">{unit}{mode === 'kp' ? ' · NOAA Kp 0–9' : ''}</SvgText>
  </Svg>;
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: 'no-store' });
  return readSourceJson<T>(response);
}

export function CurrentMeasurementsPage({
  phonePoints,
  phoneCurrentMicroT,
  phoneDeltaNt,
  isRecording,
  onEnter,
}: {
  phonePoints: LivePhonePoint[];
  phoneCurrentMicroT: number | null;
  phoneDeltaNt: number | null;
  isRecording: boolean;
  onEnter: () => void;
}) {
  const fix = useForegroundLocation(true);
  const stationOrder = useMemo(() => rankGroundStations(fix.location).join(','), [fix.location]);
  const [ground, setGround] = useState<GroundReference | null>(null);
  const [satellite, setSatellite] = useState<WindSeries | null>(null);
  const [forecast, setForecast] = useState<KpForecast | null>(null);
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [sourceRefresh, setSourceRefresh] = useState(0);
  const [loadMessage, setLoadMessage] = useState('Checking NOAA and observatories…');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    const origin = apiBaseUrl();
    if (!origin) {
      setLoadMessage('Data service address is not configured.');
      setSourceErrors(['Connect to the AuroraSense web data service on the same network, then restart Expo after configuring EXPO_PUBLIC_API_URL.']);
      return;
    }
    let live = true;
    let activeController: AbortController | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      if (!live || AppState.currentState !== 'active') return;
      activeController?.abort();
      if (timeout) clearTimeout(timeout);
      const controller = new AbortController();
      activeController = controller;
      timeout = setTimeout(() => controller.abort(), 15_000);
      const [noaaResult, groundResult, forecastResult] = await Promise.allSettled([
        getJson<NoaaResponse>(`${origin}/api/noaa`, controller.signal),
        getJson<GroundApiResponse>(`${origin}/api/ground?stations=${stationOrder}`, controller.signal),
        getJson<KpForecastResponse>(`${origin}/api/kp-forecast`, controller.signal),
      ]);
      if (!live || controller.signal.aborted) return;
      const errors: string[] = [];
      if (noaaResult.status === 'fulfilled') {
        const data = noaaResult.value;
        if (data.latestNoaa?.solarWind) setSatellite(data.latestNoaa.solarWind);
        else if (!satellite) errors.push(...(sourceErrorDetails(data).length ? sourceErrorDetails(data) : ['NOAA endpoint responded without a valid upstream series.']).map(message => `NOAA: ${message}`));
        errors.push(...(data.errors ?? []).map(message => `NOAA source: ${message}`));
      } else errors.push(`NOAA service request failed: ${sourceRequestFailure(noaaResult.reason)}. Check that the web data service is running and reachable from the phone.`);
      if (groundResult.status === 'fulfilled') {
        const data = groundResult.value;
        if (data.reference) setGround(data.reference);
        else if (!ground) errors.push(...(sourceErrorDetails(data).length ? sourceErrorDetails(data) : ['No valid USGS station response.']).map(message => `USGS: ${message}`));
        errors.push(...(data.errors ?? []).map(message => `USGS source: ${message}`));
      } else errors.push(`USGS service request failed: ${sourceRequestFailure(groundResult.reason)}. Check the web data service and network.`);
      if (forecastResult.status === 'fulfilled') {
        const data = forecastResult.value;
        if (data.forecast) setForecast(data.forecast);
        else if (!forecast) errors.push(...(sourceErrorDetails(data).length ? sourceErrorDetails(data) : ['No valid NOAA forecast response.']).map(message => `Kp forecast: ${message}`));
        errors.push(...(data.errors ?? []).map(message => `Kp forecast: ${message}`));
      } else errors.push(`Kp forecast request failed: ${sourceRequestFailure(forecastResult.reason)}. Check the web data service and network.`);
      const loaded = [
        noaaResult.status === 'fulfilled' && !!noaaResult.value.latestNoaa?.solarWind,
        groundResult.status === 'fulfilled' && !!groundResult.value.reference,
        forecastResult.status === 'fulfilled' && !!forecastResult.value.forecast,
      ].filter(Boolean).length;
      setLoadMessage(loaded === 3 ? `${fix.location ? 'Nearest station ranked from coarse on-device region' : 'Global station order'} · source clocks retained` : `${loaded} of 3 sources refreshed · prior values keep their original timestamps`);
      setSourceErrors([...new Set(errors)]);
      if (timeout) clearTimeout(timeout);
      timeout = null;
    };
    void load();
    const refresh = setInterval(() => void load(), 60_000);
    const lifecycle = AppState.addEventListener('change', state => {
      if (state === 'active') void load();
      else activeController?.abort();
    });
    return () => {
      live = false;
      clearInterval(refresh);
      lifecycle.remove();
      activeController?.abort();
      if (timeout) clearTimeout(timeout);
    };
  }, [stationOrder, fix.location, sourceRefresh]);

  const satellitePoint = satellite?.samples.filter(point => point.bzNt !== null).at(-1);
  const groundPoint = ground?.samples.filter(point => point.value !== null).at(-1);
  const visibleGroundSamples = ground?.samples.slice(-30) ?? [];
  const groundStart = visibleGroundSamples.find(point => point.value !== null)?.value ?? null;
  const groundPoints = visibleGroundSamples.map(point => ({
    at: point.observedAtUtc,
    value: point.value === null || groundStart === null ? null : point.value - groundStart,
  })) ?? [];
  const forecastPoints = forecast?.points
    .filter(point => Date.parse(point.validAtUtc) >= now - 6 * 60 * 60_000 && Date.parse(point.validAtUtc) <= now + 36 * 60 * 60_000)
    .map(point => ({ at: point.validAtUtc, value: point.kp, status: point.status })) ?? [];
  const phoneSeries: SeriesPoint[] = phonePoints.map(point => ({ at: point.receivedAtUtc, value: point.deltaNt }));
  const latestPhone = phonePoints.at(-1);

  return <View style={styles.page}>
    <View style={styles.header}>
      <Text style={styles.kicker}>EARTH RESPONSE · CURRENT MEASUREMENTS</Text>
      <Text style={styles.title}>Four evidence streams, four clocks.</Text>
      <Text style={styles.muted}>{new Date(now).toISOString().replace('T', ' ').slice(0, 16)} UTC · {loadMessage}</Text>
      <Pressable accessibilityRole="button" style={styles.refreshButton} onPress={() => setSourceRefresh(value => value + 1)}><Text style={styles.link}>Refresh NOAA and ground sources</Text></Pressable>
      {sourceErrors.length > 0 && <View style={styles.diagnostics} accessibilityLiveRegion="polite">
        <Text style={styles.diagnosticTitle}>SOURCE REFRESH DETAILS</Text>
        {sourceErrors.map((message, index) => <Text key={`${index}-${message}`} style={styles.diagnosticText}>• {message}</Text>)}
      </View>}
    </View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.stack}>
      <View style={styles.card}>
        <View style={styles.row}><Text style={styles.cardTitle}>PHONE · LOCAL MAGNETOMETER</Text><SourceStatus at={latestPhone?.receivedAtUtc} now={now} thresholdMinutes={1} /></View>
        <Text style={styles.value}>{phoneCurrentMicroT === null ? 'Waiting for sample' : `${phoneCurrentMicroT.toFixed(2)} µT`}<Text style={styles.secondary}>{phoneDeltaNt === null ? '' : `  ${phoneDeltaNt >= 0 ? '+' : ''}${phoneDeltaNt.toFixed(0)} nT`}</Text></Text>
        <Text style={styles.muted}>{isRecording ? 'Recording · QC is assessed after Stop' : 'Foreground preview · not saved or QC evaluated'} · device-frame |B|; Δ|B| from the local 2 s baseline</Text>
        <Trace points={phoneSeries} unit="Δ|B| · nT" maxGapMinutes={0.04} />
        <Text style={styles.sourceNote}>{latestPhone ? `App receipt ${latestPhone.receivedAtUtc} · native monotonic sensor time ${latestPhone.sensorTimestampSeconds.toFixed(2)} s` : 'Waiting for real phone sensor samples'}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}><Text style={styles.cardTitle}>UPSTREAM · NOAA IMF Bz</Text><SourceStatus at={satellitePoint?.observedAtUtc} now={now} thresholdMinutes={15} /></View>
        <Text style={styles.value}>{satellitePoint?.bzNt === null || satellitePoint?.bzNt === undefined ? 'Waiting for sample' : `${satellitePoint.bzNt.toFixed(1)} nT`}<Text style={styles.secondary}>  GSM</Text></Text>
        <Text style={styles.muted}>{satellitePoint?.observedAtUtc ?? 'Waiting for NOAA observation time'} · upstream magnetic field, not a ground measurement</Text>
        <Trace points={(satellite?.samples ?? []).slice(-30).map(point => ({ at: point.observedAtUtc, value: point.bzNt }))} unit="IMF Bz · nT" maxGapMinutes={3} />
        <Text style={styles.sourceNote}>{satellite ? `NOAA retrieval ${satellite.retrievedAtUtc}` : 'Source retrieval time unavailable'} · <Text onPress={() => { void Linking.openURL(satellite?.sourceUrl ?? 'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json'); }} style={styles.link}>NOAA source ↗</Text></Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}><Text style={styles.cardTitle}>PROFESSIONAL GROUND · USGS {ground?.stationId ?? '—'} F</Text><SourceStatus at={groundPoint?.observedAtUtc} now={now} thresholdMinutes={10} /></View>
        <Text style={styles.value}>{groundPoint?.value === null || groundPoint?.value === undefined ? 'Waiting for sample' : `${groundPoint.value.toFixed(1)} nT`}</Text>
        <Text style={styles.muted}>Latest sample {groundPoint?.observedAtUtc ?? 'waiting'} · {ground?.stationName ?? 'nearest available supported observatory'} · scalar F; graph is ΔF from the first shown sample</Text>
        <Trace points={groundPoints} unit="ΔF · nT" maxGapMinutes={3} />
        <Text style={styles.sourceNote}>{ground ? `USGS provisional variation · retrieval ${ground.retrievedAtUtc} · ${ground.component} · ${ground.frame} · ${ground.unit}` : 'USGS station data unavailable'} · <Text onPress={() => { if (ground?.sourceUrl) void Linking.openURL(ground.sourceUrl); }} style={styles.link}>USGS source ↗</Text></Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}><Text style={styles.cardTitle}>FORECAST · NOAA PLANETARY Kp</Text><SourceStatus at={forecast?.retrievedAtUtc} now={now} thresholdMinutes={120} /></View>
        <Text style={styles.value}>{forecastPoints.filter(point => point.status === 'PREDICTED').length ? `${forecastPoints.filter(point => point.status === 'PREDICTED').length} forecast intervals` : 'Waiting for forecast'}</Text>
        <Text style={styles.muted}>Three-hour global index · NOAA status retained · valid time shown on this independent axis</Text>
        <Trace points={forecastPoints} unit="Kp · index" mode="kp" maxGapMinutes={240} />
        <View style={styles.legend}><Text style={styles.observed}>● Observed</Text><Text style={styles.estimated}>● Estimated</Text><Text style={styles.predicted}>● Predicted</Text></View>
        <Text style={styles.sourceNote}>{forecast ? `Retrieved ${forecast.retrievedAtUtc} · issue time not provided by this feed` : 'NOAA forecast unavailable'} · <Text onPress={() => { void Linking.openURL(forecast?.sourceUrl ?? 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json'); }} style={styles.link}>NOAA source ↗</Text></Text>
      </View>
      <Text style={styles.caveat}>The phone plots device-frame field magnitude, NOAA reports upstream GSM Bz, USGS reports ground scalar F, and Kp is a global index. These use separate scales and source clocks. Agreement alone does not prove a regional phone detection or visible aurora.</Text>
    </ScrollView>
    <Pressable accessibilityRole="button" style={styles.enter} onPress={onEnter}><Text style={styles.enterText}>Enter AuroraSense →</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%', backgroundColor: '#040d1a', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  header: { paddingHorizontal: 4, gap: 4 },
  kicker: { fontSize: 9, letterSpacing: 1.2, color: '#68edc3', fontWeight: '800' },
  title: { fontSize: 19, lineHeight: 23, fontWeight: '800', color: '#eff7ff' },
  muted: { fontSize: 9, lineHeight: 13, color: '#8ea8c4' },
  sourceNote: { fontSize: 8, lineHeight: 11, color: '#7189a2' },
  scroll: { flex: 1, marginTop: 6 },
  stack: { gap: 7, paddingBottom: 8 },
  card: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10, borderColor: '#1c3b5c', borderWidth: 1, backgroundColor: '#0a192b', gap: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 5 },
  cardTitle: { color: '#b9a5ff', fontWeight: '800', fontSize: 9, letterSpacing: 0.5, flexShrink: 1 },
  fresh: { fontSize: 8, color: '#68edc3', fontWeight: '800' },
  stale: { color: '#ffd58c' },
  value: { fontSize: 17, lineHeight: 21, color: '#eff7ff', fontWeight: '800' },
  secondary: { fontSize: 11, color: '#8ea8c4', fontWeight: '600' },
  emptyChart: { height: 45, justifyContent: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'space-around' },
  observed: { color: '#68edc3', fontSize: 8 },
  estimated: { color: '#ffd58c', fontSize: 8 },
  predicted: { color: '#b9a5ff', fontSize: 8 },
  link: { color: '#00e5ff', fontSize: 8 },
  refreshButton: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 2 },
  diagnostics: { borderRadius: 8, padding: 8, backgroundColor: 'rgba(255, 213, 140, 0.08)', borderWidth: 1, borderColor: 'rgba(255, 213, 140, 0.3)', gap: 3 },
  diagnosticTitle: { color: '#ffd58c', fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  diagnosticText: { color: '#c8d7e6', fontSize: 9, lineHeight: 13 },
  caveat: { color: '#8ea8c4', fontSize: 9, lineHeight: 13, paddingHorizontal: 3 },
  enter: { paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#583caa' },
  enterText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
