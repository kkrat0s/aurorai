import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { analyzeSessionEvidence, type KpSeries, type OvationModel, type UpstreamSeries } from '@aurorasense/shared/session-analysis';
import { rankGroundStations, type GroundComparison, type GroundReference, type GroundResponse } from '@aurorasense/shared/ground-reference';
import { type SensorQcResult, type SensorSession } from '@aurorasense/shared/sensor';
import { apiBaseUrl } from '../api-base';
import { captureLocation } from '../foreground-location';
import { type NoaaContext } from './UpstreamContext';

type Props = { session: SensorSession | null; qc: SensorQcResult | null; baseUrl?: string };
type SourceResult = { source: string; observedAt: string | null; retrievedAt: string | null; sourceUrl: string | null; detail: string };

function utcClock(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'time unavailable';
}

function PhoneTrace({ session, qc }: { session: SensorSession; qc: SensorQcResult }) {
  const width = 360, left = 48, right = 350, top = 10, laneHeight = 62;
  const t0 = session.samples[0]?.sensorTimestampSeconds ?? 0;
  const duration = Math.max(1, (session.samples.at(-1)?.sensorTimestampSeconds ?? t0) - t0);
  const baselineReady = qc.baselineMicroT !== null && !qc.flags.includes('BASELINE_PENDING');
  const baselines = useMemo(() => Object.fromEntries((['x', 'y', 'z'] as const).map(axis => {
    if (!baselineReady) return [axis, null];
    const values = session.samples.flatMap((sample, index) => {
      const row = qc.sampleResults[index];
      return sample.sensorTimestampSeconds - t0 < 120 && row?.usable && Number.isFinite(sample[axis]) ? [sample[axis]] : [];
    }).sort((a, b) => a - b);
    return [axis, values.length >= 30 ? values[Math.floor(values.length / 2)] : null];
  })) as Record<'x' | 'y' | 'z', number | null>, [baselineReady, qc.sampleResults, session.samples, t0]);
  const chart = useMemo(() => (['x', 'y', 'z'] as const).map((axis, lane) => {
    const values = session.samples.flatMap((sample, index) => {
      const value = sample[axis], row = qc.sampleResults[index];
      if (!Number.isFinite(value)) return [];
      return [{ index, elapsed: sample.sensorTimestampSeconds - t0, value: baselines[axis] === null ? value : (value - baselines[axis]!) * 1000, usable: row?.usable ?? false }];
    });
    const stride = Math.max(1, Math.ceil(values.length / 240));
    const indices = new Set<number>();
    values.forEach((point, index) => { if (index % stride === 0 || index === values.length - 1) indices.add(index); });
    values.forEach((point, index) => {
      if (!point.usable && (index === 0 || values[index-1]?.usable)) indices.add(index);
      if (!point.usable && (index === values.length-1 || values[index+1]?.usable)) indices.add(index);
    });
    const selected = [...indices].sort((a,b) => a-b).map(index => values[index]);
    const extent = Math.max(0.005, ...selected.map(point => Math.abs(point.value)));
    const center = top + lane * laneHeight + 26;
    const y = (value: number) => center - value / extent * 19;
    const pathFor = (usable: boolean) => {
      let previous: typeof selected[number] | null = null;
      return selected.flatMap(point => {
        if (point.usable !== usable) { if (previous && !usable) previous = null; return []; }
        const intervening = previous ? qc.sampleResults.slice(previous.index + 1, point.index).some(row => row.usable !== usable) : true;
        const command = !previous || point.elapsed - previous.elapsed > 0.6 || intervening ? 'M' : 'L';
        previous = point;
        return [`${command}${left + point.elapsed / duration * (right - left)},${y(point.value)}`];
      }).join(' ');
    };
    const usablePath = pathFor(true), flaggedPath = pathFor(false);
    const flagged = selected.filter(point => !point.usable).slice(0, 160);
    return { axis, lane, usablePath, flaggedPath, center, y, extent, flagged, unit: baselines[axis] === null ? 'µT' : 'nT' };
  }), [baselines, duration, qc.sampleResults, session.samples, t0]);
  const flagBands = qc.sampleResults.flatMap((row, index) => {
    if (!row.flags.some(flag => ['LOCAL_INTERFERENCE', 'ABRUPT_JUMP', 'MOTION', 'MOTION_UNKNOWN', 'ORIENTATION_CHANGED', 'SATURATION_SUSPECT'].includes(flag))) return [];
    const elapsed = session.samples[index].sensorTimestampSeconds - t0;
    return [{ x: left + elapsed / duration * (right - left), key: `${index}-${row.flags.join('-')}` }];
  }).filter((_, index) => index % Math.max(1, Math.ceil(qc.sampleResults.length / 180)) === 0);
  const recordedMarkers = session.markers.filter(marker => Number.isFinite(marker.elapsedSeconds));
  const touchMarkers = recordedMarkers.filter(marker => marker.kind === 'SCREEN_INTERACTION');
  const representativeTouches = touchMarkers.length > 8 ? [...touchMarkers.slice(0,4), ...touchMarkers.slice(-4)] : touchMarkers;
  const markers = [...recordedMarkers.filter(marker => marker.kind !== 'SCREEN_INTERACTION'), ...representativeTouches].sort((a,b) => a.elapsedSeconds-b.elapsedSeconds);
  return <View style={styles.chartCard}>
    <Text style={styles.sectionTitle}>Phone signal · three device axes</Text>
    <Text style={styles.muted}>{baselineReady ? 'X/Y/Z departures from the first 120-second component medians · nT' : 'Raw X/Y/Z component measurements · µT · protocol baseline not established'} · device coordinates, not north/east/down.</Text>
    <Svg width="100%" height={222} viewBox={`0 0 ${width} 222`} accessibilityLabel="Annotated phone magnetometer chart showing device-frame X, Y, Z traces, quality flags and recording event markers">
      {baselineReady && <Rect x={left} y={top} width={(right-left)*Math.min(120,duration)/duration} height={185} fill="#68edc3" opacity={0.06} />}
      {flagBands.map(band => <Line key={band.key} x1={band.x} x2={band.x} y1={top} y2={top + laneHeight*3 - 7} stroke="#ff6b6b" strokeWidth="1" opacity={0.5} />)}
      {markers.map((marker, index) => {
        const x = left + Math.max(0, Math.min(duration, marker.elapsedSeconds)) / duration * (right-left);
        const color = marker.kind.includes('INTERFERENCE') ? '#ff6b6b' : marker.kind.includes('MOTION') ? '#ffd166' : marker.kind.includes('BATTERY') ? '#53d5ff' : marker.kind === 'BASELINE' ? '#68edc3' : '#a882ff';
        return <Line key={`${marker.kind}-${index}`} x1={x} x2={x} y1={top} y2={top + laneHeight*3 - 7} stroke={color} strokeWidth="1.5" strokeDasharray="3 4" opacity={0.9} />;
      })}
      {chart.map(item => <React.Fragment key={item.axis}>
        <Line x1={left} x2={right} y1={item.center} y2={item.center} stroke="#385069" strokeWidth="1" />
        <Path d={item.usablePath} stroke={['#68edc3','#b9a5ff','#ffd166'][item.lane]} strokeWidth="1.7" fill="none" />
        <Path d={item.flaggedPath} stroke="#ff6b6b" strokeWidth="1.7" fill="none" />
        {item.flagged.map((point, index) => <Circle key={`${item.axis}-${index}`} cx={left + point.elapsed/duration*(right-left)} cy={item.y(point.value)} r="2.6" fill="#ff6b6b" />)}
        <SvgText x="5" y={item.center-4} fill={['#68edc3','#b9a5ff','#ffd166'][item.lane]} fontSize="12" fontWeight="700">{item.axis.toUpperCase()}</SvgText>
        <SvgText x="24" y={item.center+4} fill="#8ea8c4" fontSize="8">±{item.extent.toFixed(item.unit==='nT'?0:2)} {item.unit}</SvgText>
        <SvgText x={right-26} y={top+item.lane*laneHeight+9} fill="#8ea8c4" fontSize="8">{item.flagged.length ? 'QC marks red' : 'trace'}</SvgText>
      </React.Fragment>)}
      <SvgText x={left} y="216" fill="#8ea8c4" fontSize="9">0:00</SvgText><SvgText x={right} y="216" fill="#8ea8c4" fontSize="9" textAnchor="end">{Math.floor(duration/60)}:{String(Math.floor(duration%60)).padStart(2,'0')}</SvgText>
    </Svg>
    <View style={styles.legendRow}><Text style={[styles.legend,{color:'#68edc3'}]}>X</Text><Text style={[styles.legend,{color:'#b9a5ff'}]}>Y</Text><Text style={[styles.legend,{color:'#ffd166'}]}>Z</Text><Text style={[styles.legend,{color:'#ff6b6b'}]}>QC flag / interference</Text><Text style={[styles.legend,{color:'#a882ff'}]}>Touch</Text><Text style={[styles.legend,{color:'#53d5ff'}]}>Battery state</Text></View>
    <Text style={styles.muted}>Green shading: baseline window when established. Red marks: QC-flagged readings. Dashed event lines: recorded interference, motion or touch markers. Unusable samples remain visible as flagged; they are excluded from comparative estimates.</Text>
  </View>;
}

function MiniTrace({ title, unit, points, source, color = '#68edc3', empty, maxGapMs = 90_000 }: { title: string; unit: string; points: { at: string; value: number | null }[]; source: SourceResult; color?: string; empty: string; maxGapMs?: number }) {
  const valid = points.filter(point => Number.isFinite(Date.parse(point.at)) && point.value !== null && Number.isFinite(point.value));
  const min = Math.min(0, ...valid.map(point => point.value!)), max = Math.max(0, ...valid.map(point => point.value!));
  const span = Math.max(1, max-min), start = Date.parse(valid[0]?.at ?? ''), end = Date.parse(valid.at(-1)?.at ?? ''), width = Math.max(1, end-start);
  let previousAt: number | null = null;
  const path = points.flatMap(point => {
    const at = Date.parse(point.at);
    if (!Number.isFinite(at) || point.value === null || !Number.isFinite(point.value)) { previousAt = null; return []; }
    const command = previousAt === null || at - previousAt > maxGapMs ? 'M' : 'L';
    previousAt = at;
    return [`${command}${12+(at-start)/width*296},${75-(point.value-min)/span*55}`];
  }).join(' ');
  return <View style={styles.chartCard}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.muted}>{source.detail} · {unit}</Text>
    {valid.length ? <Svg width="100%" height={96} viewBox="0 0 320 96" accessibilityLabel={`${title} time series; source timestamps retained`}>
      <Line x1="12" x2="308" y1="75" y2="75" stroke="#385069"/><Path d={path} stroke={color} strokeWidth="2" fill="none"/>
      <SvgText x="12" y="92" fill="#8ea8c4" fontSize="8">{utcClock(valid[0]?.at).slice(11,19)}</SvgText><SvgText x="308" y="92" fill="#8ea8c4" fontSize="8" textAnchor="end">{utcClock(valid.at(-1)?.at).slice(11,19)}</SvgText>
    </Svg> : <Text style={styles.warning}>{empty}</Text>}
    <Text style={styles.sourceLine}>Observed {utcClock(source.observedAt)} · retrieved {utcClock(source.retrievedAt)}</Text>
    {source.sourceUrl ? <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(source.sourceUrl!); }}><Text style={styles.link}>Open source ↗</Text></Pressable> : null}
  </View>;
}

function GroundComparisonTrace({ comparison, source }: { comparison: GroundComparison; source: SourceResult }) {
  const points = comparison.status === 'DESCRIPTIVE_COMPARISON' ? comparison.aligned : [];
  const extent = Math.max(1, ...points.flatMap(point => [Math.abs(point.phoneDeltaNt), Math.abs(point.referenceDeltaNt)]));
  const start = Date.parse(points[0]?.observedAtUtc ?? ''), end = Date.parse(points.at(-1)?.observedAtUtc ?? '');
  const width = Math.max(60_000, end-start);
  const path = (key: 'phoneDeltaNt' | 'referenceDeltaNt') => points.map((point,index) => `${index?'L':'M'}${12+(Date.parse(point.observedAtUtc)-start)/width*296},${48-point[key]/extent*34}`).join(' ');
  return <View style={styles.chartCard}>
    <Text style={styles.sectionTitle}>Phone · USGS ground comparison</Text>
    <Text style={styles.muted}>{source.detail} · scalar variation · nT · only simultaneous qualifying UTC minute bins are compared.</Text>
    {points.length ? <>
      <Svg width="100%" height={72} viewBox="0 0 320 72" accessibilityLabel="Time-aligned phone scalar magnitude changes compared with USGS scalar ground measurements, each baseline-offset in nanotesla">
        <Line x1="12" x2="308" y1="48" y2="48" stroke="#385069"/><Path d={path('phoneDeltaNt')} stroke="#b9a5ff" strokeWidth="2" fill="none"/><Path d={path('referenceDeltaNt')} stroke="#68edc3" strokeWidth="2" fill="none"/>
        <SvgText x="12" y="68" fill="#8ea8c4" fontSize="8">{utcClock(points[0]?.observedAtUtc).slice(11,19)}</SvgText><SvgText x="308" y="68" fill="#8ea8c4" fontSize="8" textAnchor="end">{utcClock(points.at(-1)?.observedAtUtc).slice(11,19)}</SvgText>
      </Svg>
      <View style={styles.legendRow}><Text style={[styles.legend,{color:'#b9a5ff'}]}>Phone Δ|B|</Text><Text style={[styles.legend,{color:'#68edc3'}]}>USGS ΔF</Text></View>
      <Text style={styles.body}>{points.length} common minutes · descriptive r={comparison.correlation?.toFixed(3) ?? 'unavailable'} · ±{extent.toFixed(1)} nT shared scale. Each series is offset by its first two common minutes; no lag fitting or amplitude rescaling. A remote station or correlation alone does not confirm regional causality.</Text>
    </> : <Text style={styles.warning}>Comparison not eligible: {comparison.status.replaceAll('_',' ').toLowerCase()}. {comparison.reasons[0] ?? 'Need sufficient valid overlap, QC, time precision and a capture-linked region.'} No joint trace or correlation is manufactured.</Text>}
    <Text style={styles.sourceLine}>USGS observed {utcClock(source.observedAt)} · retrieved {utcClock(source.retrievedAt)}</Text>
    {source.sourceUrl ? <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(source.sourceUrl!); }}><Text style={styles.link}>Open USGS station source ↗</Text></Pressable> : null}
  </View>;
}

function Finding({ label, state, body, color = '#ffd58c' }: { label: string; state: string; body: string; color?: string }) {
  return <View style={styles.finding}>
    <View style={styles.findingHeading}><Text style={styles.sectionTitle}>{label}</Text><Text style={[styles.findingState,{color}]}>{state}</Text></View>
    <Text style={styles.body}>{body}</Text>
  </View>;
}

export function CaptureEvidenceAnalysis({ session, qc, baseUrl = apiBaseUrl() }: Props) {
  const [refresh, setRefresh] = useState(0);
  const [reference, setReference] = useState<GroundReference | null>(null);
  const [noaa, setNoaa] = useState<NoaaContext | null>(null);
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [loadedAt, setLoadedAt] = useState(new Date().toISOString());
  const [showModelBoundary, setShowModelBoundary] = useState(false);
  const captureRegion = session ? captureLocation(session.id) : undefined;
  const stationIds = useMemo(() => rankGroundStations(captureRegion).join(','), [captureRegion?.latitude, captureRegion?.longitude]);

  useEffect(() => {
    if (!session || !baseUrl) { setSourceErrors(baseUrl ? [] : ['Computer web API is not configured. Phone-only analysis is still available.']); return; }
    let live = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    async function loadSources() {
      const outcomes = await Promise.allSettled([
        fetch(`${baseUrl.replace(/\/$/, '')}/api/noaa`, { signal: controller.signal }).then(async response => {
          const body = await response.json().catch(() => null);
          if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : `NOAA HTTP ${response.status}`);
          return body;
        }),
        fetch(`${baseUrl.replace(/\/$/, '')}/api/ground?stations=${stationIds}`, { signal: controller.signal }).then(async response => {
          const body = await response.json().catch(() => null) as GroundResponse | null;
          if (!response.ok || !body?.reference) throw new Error(body?.errors?.join(' ') || `USGS HTTP ${response.status}`);
          return body;
        }),
      ]);
      if (!live) return;
      const errors: string[] = [];
      if (outcomes[0].status === 'fulfilled') {
        const body = outcomes[0].value;
        setNoaa({ ...body.latestNoaa, solarWind: body.latestNoaa?.solarWind, kp: body.latestNoaa?.kp });
        errors.push(...(Array.isArray(body.errors) ? body.errors.filter((error: unknown): error is string => typeof error === 'string') : []));
      } else errors.push(`NOAA: ${outcomes[0].reason instanceof Error ? outcomes[0].reason.message : 'source unavailable'}`);
      if (outcomes[1].status === 'fulfilled') setReference(outcomes[1].value.reference);
      else errors.push(`USGS: ${outcomes[1].reason instanceof Error ? outcomes[1].reason.message : 'source unavailable'}`);
      setSourceErrors(errors); setLoadedAt(new Date().toISOString());
    }
    void loadSources();
    return () => { live = false; clearTimeout(timeout); controller.abort(); };
  }, [baseUrl, session?.id, stationIds, refresh]);

  const report = useMemo(() => session && qc ? analyzeSessionEvidence(session, qc, {
    reference, coarseLocation: captureRegion,
    upstream: noaa?.solarWind ? { ...noaa.solarWind } as UpstreamSeries : null,
    kp: noaa?.kp ? { ...noaa.kp } as KpSeries : null,
    ovation: noaa?.ovation?.coordinates ? { ...noaa.ovation, coordinates: noaa.ovation.coordinates } as OvationModel : null,
    asOfUtc: loadedAt,
  }) : null, [session, qc, reference, captureRegion, noaa, loadedAt]);

  if (!session || !qc || !report) return <View style={styles.panel}><Text style={styles.title}>Session evidence analysis</Text><Text style={styles.warning}>Record a phone session first. A live 46.8 µT preview is not a saved measurement and cannot be aligned to independent sources.</Text></View>;
  const comparison = report.groundComparison;
  const solarPoints = (noaa?.solarWind?.samples ?? []).filter(point => {
    const at = Date.parse(point.observedAtUtc);
    return at >= Date.parse(report.upstreamContext.windowStartUtc) && at <= Date.parse(report.upstreamContext.windowEndUtc);
  }).map(point => ({ at: point.observedAtUtc, value: point.bzNt }));
  const groundSource: SourceResult = { source: 'USGS', observedAt: reference?.latestObservedAtUtc ?? null, retrievedAt: reference?.retrievedAtUtc ?? null, sourceUrl: reference?.sourceUrl ?? null, detail: reference ? `${reference.stationName} · ${reference.stationId} · measured scalar F · station variation` : 'Professional ground data unavailable' };
  const windSource: SourceResult = { source: 'NOAA', observedAt: report.upstreamContext.lastSampleUtc, retrievedAt: report.upstreamContext.retrievedAtUtc, sourceUrl: report.upstreamContext.sourceUrl, detail: 'Upstream IMF Bz · GSM frame · spacecraft observation times; propagation delay not applied' };
  const isSynthetic = session.kind === 'SYNTHETIC';

  return <View style={styles.panel}>
    <View style={styles.hero}>
      <Text style={styles.kicker}>GROUND TRUTH · CAPTURE-BOUND REPORT</Text>
      <Text style={styles.title}>Evidence, with the alternatives tested.</Text>
      <Text style={styles.body}>{isSynthetic ? 'SYNTHETIC PHONE SIMULATION — this report is a software test, not a physical phone observation.' : 'MEASURED PHONE SESSION · raw recording remains local to this device.'}</Text>
      <Text style={[styles.verdict,{color:report.measurement.qcAccepted?'#68edc3':'#ff9a9a'}]}>{report.measurement.qcAccepted ? 'PHONE QC: PASS FOR COMPARISON' : 'PHONE QC: FLAGGED / INCOMPLETE'}</Text>
      <Text style={styles.modelStatus}>ANALYSIS MODE · LOCAL DETERMINISTIC · MUSE SPARK NOT CALLED ON THIS SESSION</Text>
      <Text style={styles.muted}>Device {report.measurement.device.model ?? 'model unknown'} · {report.measurement.device.platform} · {report.measurement.device.sensor} · absolute calibration unknown.</Text>
      <Text style={styles.muted}>{report.measurement.sampleCount.toLocaleString()} samples · {report.measurement.durationSeconds.toFixed(1)} s · {report.measurement.actualHz?.toFixed(2) ?? 'unknown'} Hz actual · {utcClock(report.measurement.startAtUtc)}–{utcClock(report.measurement.endAtUtc)}</Text>
      <Text style={styles.muted}>Baseline {report.measurement.baselineMagnitudeMicroT?.toFixed(2) ?? 'not established'} µT · baseline MAD {report.measurement.baselineNoiseMadNt?.toFixed(1) ?? 'unavailable'} nT · {report.measurement.usableSamples.toLocaleString()} / {report.measurement.sampleCount.toLocaleString()} usable samples · QC {qc.algorithmVersion}</Text>
      {!!report.measurement.qcFlags.length && <Text style={styles.warning}>QC flags: {report.measurement.qcFlags.join(' · ')}</Text>}
    </View>

    <PhoneTrace session={session} qc={qc} />
    <View style={styles.axisGrid}>{report.axes.map(axis => <View key={axis.axis} style={styles.axisTile}>
      <Text style={styles.axisTitle}>DEVICE {axis.axis.toUpperCase()}</Text>
      <Text style={styles.axisValue}>{axis.p95AbsoluteDepartureNt === null ? 'Baseline unavailable' : `p95 ±${axis.p95AbsoluteDepartureNt.toFixed(1)} nT`}</Text>
      <Text style={styles.muted}>{axis.usableSamples.toLocaleString()} usable · {axis.flaggedSamples.toLocaleString()} flagged</Text>
    </View>)}</View>
    <View style={styles.chartCard}>
      <Text style={styles.sectionTitle}>Motion, touch and power context</Text>
      <Text style={styles.body}>Accelerometer attached to {report.capturedContext.accelerometerSamples.toLocaleString()} / {report.measurement.sampleCount.toLocaleString()} magnetic samples. Screen touches: {report.capturedContext.screenTouchMarkers}; QC-flagged near/away from touch: {report.capturedContext.qcFlaggedNearTouch}/{report.capturedContext.qcFlaggedAwayFromTouch}. Battery state: {report.capturedContext.latestBatteryState} ({report.capturedContext.batteryStateEvents} recorded state observations).</Text>
      <Text style={styles.warning}>Not captured for this session: {report.capturedContext.contextNotCaptured.join('; ')}.</Text>
      <Text style={styles.muted}>Touch windows are fixed annotations (1 s before, 3 s after). Association does not prove a touch caused a field change; QC is unchanged.</Text>
    </View>

    <View style={styles.findingsBlock}>
      <Text style={styles.blockTitle}>What the evidence says</Text>
      <Finding label="1 · The recorded field" state="MEASURED · DEVICE FRAME" body={report.interpretation.measuredField} color="#68edc3" />
      <Finding label="2 · Local interference" state={report.measurement.qcFlags.some(flag => ['LOCAL_INTERFERENCE','ABRUPT_JUMP','MOTION','ORIENTATION_CHANGED'].includes(flag)) ? 'QC PATTERN PRESENT' : 'NOT EXCLUDED'} body={report.interpretation.interference} color="#ffd166" />
      <Finding label="3 · Earth / regional response" state={comparison.status.replaceAll('_',' ')} body={report.interpretation.geomagneticResponse} color={comparison.status==='DESCRIPTIVE_COMPARISON'?'#68edc3':'#ffd166'} />
      <Finding label="4 · Solar-wind context" state={report.upstreamContext.status.replaceAll('_',' ')} body={report.interpretation.solarDriver} color="#b9a5ff" />
      <Finding label="5 · Reconnection" state="NOT DIRECTLY OBSERVED" body={report.interpretation.reconnection} />
      <Finding label="6 · Visible aurora" state="NO OPTICAL CLAIM" body={report.interpretation.aurora} />
    </View>

    <MiniTrace title="NOAA upstream IMF Bz · context window" unit="nT · GSM" points={solarPoints} source={windSource} color="#b9a5ff" empty={report.upstreamContext.status === 'NO_OVERLAP' ? 'No NOAA Bz sample in the displayed two-hour pre-capture window. It is shown as missing, not zero.' : 'No valid Bz points were returned for this capture window.'} />
    <GroundComparisonTrace comparison={comparison} source={groundSource} />
    <View style={styles.chartCard}>
      <Text style={styles.sectionTitle}>NOAA OVATION · modeled auroral activity</Text>
      <Text style={styles.kpValue}>{report.auroraModel.activityPercent === null ? 'No local cell' : `${report.auroraModel.activityPercent.toFixed(0)}%`}</Text>
      <Text style={styles.muted}>
        {report.auroraModel.status === 'VALID_DURING_CAPTURE'
          ? `Nearest model cell is ${report.auroraModel.nearestDistanceKm?.toFixed(0)} km from the coarse capture region and its valid time falls within the recording. This is modeled activity, not a calibrated probability that aurora was visible.`
          : report.auroraModel.status === 'NEAREST_CELL_CONTEXT'
            ? `Nearest cell ${report.auroraModel.nearestDistanceKm === null ? 'is outside the local comparison radius or unavailable' : `${report.auroraModel.nearestDistanceKm.toFixed(0)} km from the coarse capture region`}. Model valid ${utcClock(report.auroraModel.validAtUtc)}; it is context only and not time-aligned to this recording.`
            : report.auroraModel.status === 'CAPTURE_LOCATION_UNAVAILABLE'
              ? `Model valid ${utcClock(report.auroraModel.validAtUtc)}, but no capture-time coarse location is stored for this session; no local grid cell was selected.`
              : 'NOAA OVATION data unavailable. No model value has been filled in.'}
      </Text>
      <Text style={styles.sourceLine}>Observed {utcClock(report.auroraModel.observedAtUtc)} · retrieved {utcClock(report.auroraModel.retrievedAtUtc)}</Text>
      {report.auroraModel.sourceUrl ? <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(report.auroraModel.sourceUrl!); }}><Text style={styles.link}>Open NOAA OVATION source ↗</Text></Pressable> : null}
    </View>
    <View style={styles.chartCard}>
      <Text style={styles.sectionTitle}>Global index · {noaa?.kp?.sourceId === 'NOAA_ESTIMATED_KP' ? 'NOAA estimated Kp' : 'NOAA Kp'}</Text>
      <Text style={styles.kpValue}>{report.planetaryKp.value?.toFixed(2) ?? 'Unavailable'}</Text>
      <Text style={styles.muted}>Observed {utcClock(report.planetaryKp.observedAtUtc)} · retrieved {utcClock(report.planetaryKp.retrievedAtUtc)} · planetary context only; not a local aurora probability or phone-derived score.</Text>
      {report.planetaryKp.sourceUrl ? <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(report.planetaryKp.sourceUrl!); }}><Text style={styles.link}>Open NOAA Kp source ↗</Text></Pressable> : null}
    </View>

    <View style={styles.findingsBlock}>
      <Text style={styles.blockTitle}>Next measurement that would reduce uncertainty</Text>
      {report.nextMeasurements.map((action,index) => <Text key={`${index}-${action}`} style={styles.action}>• {action}</Text>)}
    </View>

    <View style={styles.modelNote}>
      <Text style={styles.sectionTitle}>Analysis provenance</Text>
      <Text style={styles.muted}>This report runs reproducible local QC, time alignment, source checks and physical-limit rules. Model call: none for this private on-device session. Regional verdict: INCONCLUSIVE. A registered Muse Spark coordinator run is shown separately in the Evidence drawer; it has not inspected this raw recording.</Text>
      <Pressable accessibilityRole="button" onPress={() => setShowModelBoundary(value => !value)}><Text style={styles.link}>{showModelBoundary ? 'Hide' : 'Why isn’t Spark analyzing this file?'} </Text></Pressable>
      {showModelBoundary && <Text style={styles.muted}>The recording is stored locally and the authenticated private upload path is not configured. Sending derived measurements to a model also needs verified adult authorization, explicit analysis consent and a durable audit/budget record. No raw samples or personal location are uploaded from this screen.</Text>}
      <Text style={styles.sourceLine}>Analysis version {report.version} · source refresh {utcClock(loadedAt)} · capture ID {session.id.slice(0,12)}</Text>
      {sourceErrors.map((error,index) => <Text key={`${index}-${error}`} style={styles.warning}>{error}</Text>)}
      <Pressable accessibilityRole="button" style={styles.refreshButton} onPress={() => setRefresh(value => value + 1)} disabled={!baseUrl}><Text style={styles.link}>{baseUrl ? 'Refresh comparison sources' : 'Configure local API to load external sources'}</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  panel:{width:'100%',gap:12}, hero:{padding:16,borderRadius:18,backgroundColor:'#0a192b',borderWidth:1,borderColor:'#1c3b5c',gap:8},
  kicker:{color:'#68edc3',fontSize:10,fontWeight:'800',letterSpacing:1.3},title:{color:'#eff7ff',fontSize:20,fontWeight:'800'},
  verdict:{fontSize:12,fontWeight:'900',letterSpacing:0.6},modelStatus:{color:'#c9b7ff',fontSize:9,fontWeight:'900',letterSpacing:0.4},body:{color:'#d9e6f2',fontSize:12,lineHeight:18},muted:{color:'#8ea8c4',fontSize:10,lineHeight:15},warning:{color:'#ffd58c',fontSize:11,lineHeight:16},
  chartCard:{padding:12,borderRadius:14,backgroundColor:'#071525',borderWidth:1,borderColor:'#1c3b5c',gap:6},sectionTitle:{color:'#eff7ff',fontSize:12,fontWeight:'800'},legendRow:{flexDirection:'row',gap:12,flexWrap:'wrap'},legend:{fontSize:10,fontWeight:'800'},
  axisGrid:{flexDirection:'row',gap:6},axisTile:{flex:1,minWidth:90,padding:9,borderRadius:11,backgroundColor:'#0a192b',borderWidth:1,borderColor:'#1c3b5c',gap:3},axisTitle:{color:'#b9a5ff',fontSize:10,fontWeight:'900'},axisValue:{color:'#eff7ff',fontSize:11,fontWeight:'700'},
  findingsBlock:{padding:14,borderRadius:16,backgroundColor:'#0a192b',borderWidth:1,borderColor:'#1c3b5c',gap:8},blockTitle:{color:'#68edc3',fontSize:14,fontWeight:'900'},finding:{paddingVertical:8,borderTopWidth:1,borderTopColor:'#19314b',gap:5},findingHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},findingState:{fontSize:9,fontWeight:'900',textAlign:'right'},
  action:{color:'#d9e6f2',fontSize:11,lineHeight:17},kpValue:{color:'#ffd166',fontSize:24,fontWeight:'900'},sourceLine:{color:'#7288a2',fontSize:9,lineHeight:14},link:{color:'#53d5ff',fontSize:11,fontWeight:'700'},modelNote:{padding:12,borderRadius:12,borderWidth:1,borderColor:'#433772',backgroundColor:'#100f24',gap:7},refreshButton:{alignSelf:'flex-start',paddingHorizontal:9,paddingVertical:6,borderRadius:8,borderWidth:1,borderColor:'#385069'},
});
