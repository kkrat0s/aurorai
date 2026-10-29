import { contextSchema, interval, seriesSchema, type Assessment, type EvidenceSeries, type ToolContext, fingerprint } from './contracts';

export const VALIDATOR = Object.freeze({
  version: 'regional-scalar-v1.0.1', minimumSites: 3, minimumSeparationKm: 20,
  maximumReferenceDistanceKm: 500, minimumAlignedSamples: 8,
  minimumCorrelation: 0.7, minimumExcursionNt: 100, noiseMultiplier: 5,
  maximumSampleGapSeconds: 90, maximumEndAgeSeconds: 120, minimumWindowSeconds: 420,
});

export function distanceKm(a: Pick<EvidenceSeries, 'latitude'|'longitude'>, b: Pick<EvidenceSeries, 'latitude'|'longitude'>): number {
  const radians = Math.PI / 180;
  const s = Math.sin((b.latitude-a.latitude)*radians/2)**2 + Math.cos(a.latitude*radians)*Math.cos(b.latitude*radians)*Math.sin((b.longitude-a.longitude)*radians/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(Math.max(0,1-s)));
}

export function independentSites(series: EvidenceSeries[]): EvidenceSeries[][] {
  // Connected components conservatively merge co-location OR a shared interference environment.
  const remaining = [...series]; const groups: EvidenceSeries[][] = [];
  while (remaining.length) {
    const group = [remaining.shift()!];
    let changed = true;
    while (changed) {
      changed = false;
      for (let i=remaining.length-1; i>=0; i--) {
        const candidate = remaining[i];
        if (group.some(s=>s.siteId===candidate.siteId || s.environmentalGroup===candidate.environmentalGroup || distanceKm(s,candidate)<VALIDATOR.minimumSeparationKm)) {
          group.push(...remaining.splice(i,1)); changed=true;
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

export function alignedCorrelation(phone: EvidenceSeries, reference: EvidenceSeries, intervalUtc: [string,string]) {
  // Match exact UTC minute bins. No post-hoc lag maximization or interpolation across gaps.
  const ref = new Map(reference.samples.map(s=>[Date.parse(s.atUtc),s.deltaNt]));
  const pairs = phone.samples.filter(s=>Date.parse(s.atUtc)>=Date.parse(intervalUtc[0]) && Date.parse(s.atUtc)<=Date.parse(intervalUtc[1]) && ref.has(Date.parse(s.atUtc))).map(s=>[s.deltaNt, ref.get(Date.parse(s.atUtc))!]);
  if (pairs.length<VALIDATOR.minimumAlignedSamples) return {correlation:null, alignedSamples:pairs.length};
  const mx=pairs.reduce((a,p)=>a+p[0],0)/pairs.length, my=pairs.reduce((a,p)=>a+p[1],0)/pairs.length;
  const xx=pairs.reduce((a,p)=>a+(p[0]-mx)**2,0), yy=pairs.reduce((a,p)=>a+(p[1]-my)**2,0);
  const xy=pairs.reduce((a,p)=>a+(p[0]-mx)*(p[1]-my),0);
  return {correlation:xx===0||yy===0?null:xy/Math.sqrt(xx*yy), alignedSamples:pairs.length};
}

export function usableAt(series: EvidenceSeries, context: ToolContext, intervalUtc: [string,string]): boolean {
  if (!series.qc.accepted || series.qc.flags.length>0 || Date.parse(series.observedEndUtc)>Date.parse(context.asOfUtc)) return false;
  if (context.analysisMode==='OPERATIONAL' && (!series.availableAtUtc || Date.parse(series.availableAtUtc)>Date.parse(context.asOfUtc))) return false;
  const inWindow=series.samples.filter(s=>Date.parse(s.atUtc)>=Date.parse(intervalUtc[0]) && Date.parse(s.atUtc)<=Date.parse(intervalUtc[1]));
  if(inWindow.length<VALIDATOR.minimumAlignedSamples) return false;
  if(inWindow.some(s=>Date.parse(s.atUtc)%60000!==0)) return false;
  if(Date.parse(inWindow[inWindow.length-1].atUtc)-Date.parse(inWindow[0].atUtc)<VALIDATOR.minimumWindowSeconds*1000) return false;
  if (Date.parse(intervalUtc[1])-Date.parse(inWindow[inWindow.length-1].atUtc)>VALIDATOR.maximumEndAgeSeconds*1000) return false;
  if (Date.parse(inWindow[0].atUtc)-Date.parse(intervalUtc[0])>VALIDATOR.maximumEndAgeSeconds*1000) return false;
  return inWindow.every((s,i)=>i===0 || Date.parse(s.atUtc)-Date.parse(inWindow[i-1].atUtc)<=VALIDATOR.maximumSampleGapSeconds*1000);
}

export function validateRegional(input: {
  series: EvidenceSeries[]; context: ToolContext; regionCell: string;
  intervalUtc: [string,string]; evidenceRevision: number;
}): Assessment {
  const reasons: string[] = [];
  const validContext=contextSchema.safeParse(input.context);
  const validInterval=interval.safeParse(input.intervalUtc);
  const invalidScope=!validContext.success || !validInterval.success || !input.context.permittedCells.includes(input.regionCell) || Date.parse(input.intervalUtc[1])>Date.parse(input.context.asOfUtc) || Date.parse(input.intervalUtc[1])-Date.parse(input.intervalUtc[0])<VALIDATOR.minimumWindowSeconds*1000;
  if(invalidScope) reasons.push('INVALID_CONTEXT_OR_INTERVAL');
  const valid: EvidenceSeries[] = [];
  for(const candidate of input.series) {
    const result=seriesSchema.safeParse(candidate);
    if(result.success) valid.push(result.data); else reasons.push('INVALID_SERIES');
  }
  const selected=valid.filter(s=>s.regionCell===input.regionCell && s.eventId===input.context.eventId);
  const synthetic=selected.some(s=>s.kind==='SYNTHETIC');
  const usable=invalidScope?[]:selected.filter(s=>usableAt(s,input.context,input.intervalUtc));
  const phones=usable.filter(s=>s.instrument==='PHONE' && s.kind!=='SYNTHETIC');
  const references=usable.filter(s=>s.instrument==='OBSERVATORY' && s.kind!=='SYNTHETIC');
  const sites=independentSites(phones);
  const correlations: Assessment['correlations']=[];
  let matchingSites=0;
  for(const site of sites) {
    // One representative per site, sorted before looking at reference correlation.
    const phone=[...site].sort((a,b)=>a.baselineNoiseNt-b.baselineNoiseNt || a.id.localeCompare(b.id))[0];
    const nearby=references.filter(r=>distanceKm(phone,r)<=VALIDATOR.maximumReferenceDistanceKm && phone.environmentalGroup!==r.environmentalGroup && phone.siteId!==r.siteId);
    const ref=nearby.sort((a,b)=>distanceKm(phone,a)-distanceKm(phone,b)||a.id.localeCompare(b.id))[0];
    if(!ref) continue;
    const correlation=alignedCorrelation(phone,ref,input.intervalUtc);
    correlations.push({phoneId:phone.id,stationId:ref.siteId,...correlation});
    const excursion=(series:EvidenceSeries)=>{
      const values=series.samples.filter(s=>Date.parse(s.atUtc)>=Date.parse(input.intervalUtc[0])&&Date.parse(s.atUtc)<=Date.parse(input.intervalUtc[1])).map(s=>s.deltaNt).sort((a,b)=>a-b);
      return values[Math.floor((values.length-1)*0.9)]-values[Math.floor((values.length-1)*0.1)];
    };
    // Central 80% within-window range prevents a constant baseline offset from
    // satisfying the disturbance amplitude rule with only a tiny variation.
    const amplitude=excursion(phone), referenceAmplitude=excursion(ref);
    if(correlation.correlation!==null && correlation.correlation>=VALIDATOR.minimumCorrelation && amplitude>=Math.max(VALIDATOR.minimumExcursionNt,VALIDATOR.noiseMultiplier*phone.baselineNoiseNt) && referenceAmplitude>=VALIDATOR.minimumExcursionNt) matchingSites++;
  }
  let verdict: Assessment['verdict']='INCONCLUSIVE';
  if(selected.some(s=>s.instrument==='PHONE'&&(!s.qc.accepted||s.qc.flags.includes('LOCAL_INTERFERENCE')))) reasons.push('PHONE_QUALITY_FAILURE_OR_LOCAL_INTERFERENCE');
  if(synthetic) reasons.push('SYNTHETIC_DATA_CANNOT_ESTABLISH_REAL_REGIONAL_EVIDENCE');
  if(sites.length<VALIDATOR.minimumSites) reasons.push('INSUFFICIENT_INDEPENDENT_SITES');
  if(references.length===0) reasons.push('MISSING_STALE_OR_UNAVAILABLE_REFERENCE');
  if(selected.length>usable.length) reasons.push('QUALITY_TIME_OR_AVAILABILITY_EXCLUSIONS');
  if(phones.length>0&&matchingSites<sites.length) reasons.push('INSUFFICIENT_COHERENCE_OR_SIGNAL_AMPLITUDE');
  const allPhones=selected.filter(s=>s.instrument==='PHONE');
  if(allPhones.length>0 && allPhones.every(s=>!s.qc.accepted || s.qc.flags.includes('LOCAL_INTERFERENCE'))) verdict='REJECTED';
  if(reasons.includes('INVALID_SERIES')||invalidScope) verdict='REJECTED';
  if(!synthetic && !invalidScope && !reasons.includes('INVALID_SERIES') && sites.length>=VALIDATOR.minimumSites && matchingSites===sites.length && references.length>0) verdict='SUPPORTED';
  if(verdict==='SUPPORTED') reasons.push('INDEPENDENT_SCALAR_SIGNALS_MATCH_PROFESSIONAL_REFERENCE');
  const signature=fingerprint({series:input.series,regionCell:input.regionCell,intervalUtc:input.intervalUtc});
  return {
    id:`assessment-${input.evidenceRevision}-${signature}`, verdict,reasons,independentSites:sites.length,
    referenceStations:[...new Set(correlations.map(c=>c.stationId))], evidenceIds:selected.map(s=>s.id),
    analysisVersion:VALIDATOR.version, synthetic, scope:'REGIONAL_MAGNETIC_DISTURBANCE',
    asOfUtc:input.context.asOfUtc,intervalUtc:input.intervalUtc,regionCell:input.regionCell,
    correlations,evidenceRevision:input.evidenceRevision,evidenceFingerprint:signature,
    limitations:['No optical aurora claim.','Conservative provisional thresholds; real-phone sensitivity and false alarm calibration remain unverified.','Scalar F comparisons only; device axes are not geographic components.', ...(input.context.analysisMode==='RETROSPECTIVE'?['Retrospective analysis; historical operational availability is not established.']:[])],
  };
}
