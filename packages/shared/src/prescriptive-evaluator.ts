import { median, type SensorQcResult, type SensorSession } from './sensor';

export type PlacementQualityRating = 'EXCELLENT' | 'FAIR' | 'POOR' | 'UNKNOWN';
/** Display bins for local amplitude only; these are not NOAA G levels or detection thresholds. */
export type SpaceWeatherActivityTier = 'UNAVAILABLE' | 'LOCAL_SMALL' | 'LOCAL_MODERATE' | 'LOCAL_LARGE' | 'LOCAL_VERY_LARGE';
export interface PrescriptiveTimelineInterval { intervalLabel:string; startMinute:number; endMinute:number; medianDeltaNt:number; peakDeltaNt:number; description:string }
export interface PrescriptiveSessionReport {
  placementQuality:{rating:PlacementQualityRating;score:number|null;label:string;badgeText:string;color:string;noiseMadNt:number|null;explanation:string;actionAdvice:string};
  activityLevel:{tier:SpaceWeatherActivityTier;label:string;badgeText:string;color:string;kpEstimate:string;maxDeltaNt:number|null;p95DeltaNt:number|null;driftNt:number|null;explanation:string;scientificMeaning:string};
  timelineStory:PrescriptiveTimelineInterval[];prescriptiveGuidance:string[];
}
function finite(value:number|null|undefined):number|null { return typeof value==='number'&&Number.isFinite(value)?value:null; }
/** Interpret existing deterministic QC, never infer a physical cause or a storm from one phone. */
export function evaluateSessionPrescriptively(session:SensorSession,qc:SensorQcResult):PrescriptiveSessionReport {
  const noiseMadNt=finite(qc.noiseMadNt), highWater=qc.highWater[0];
  const maxDeltaNt=finite(highWater?.maximumAbsoluteDeltaNt),p95DeltaNt=finite(highWater?.p95AbsoluteDeltaNt),driftNt=finite(qc.driftNt);
  const baselineReady=finite(qc.baselineMicroT)!==null&&!qc.flags.includes('BASELINE_PENDING');
  let rating:PlacementQualityRating='UNKNOWN',label='Baseline not established',badgeText='QC INCOMPLETE',color='#aeb9c8';
  let explanation='A complete baseline and motion context are required before interpreting recording quality. Placement and interference sources have not been established.';
  const actionAdvice='Keep the phone stationary, record touch/charging context, and repeat controlled present/absent tests. A quiet trace does not establish sensor calibration.';
  if(baselineReady&&noiseMadNt!==null){
    if(!qc.accepted){rating='POOR';label='Recording flagged by QC';badgeText='QC FLAGGED';color='#ff6b6b';}
    else if(qc.flags.length||noiseMadNt>=100){rating='FAIR';label='Usable samples with quality limitations';badgeText='QC WITH LIMITATIONS';color='#ffd58c';}
    else {rating='EXCELLENT';label='Low local baseline variation';badgeText='QC ACCEPTED';color='#20c997';}
    explanation=`Baseline magnitude MAD is ${noiseMadNt.toFixed(1)} nT; ${qc.usableCount}/${qc.sampleCount} samples passed the current engineering screen. ${qc.flags.length?`Flags: ${qc.flags.join(', ')}.`:'No flags in this recording.'} This does not identify a noisy surface, thermal noise, or a geomagnetic source.`;
  }
  const score=qc.sampleCount>0?Math.round(100*Math.max(0,Math.min(1,qc.usableCount/qc.sampleCount))):null;
  let tier:SpaceWeatherActivityTier='UNAVAILABLE',activityLabel='Local variation unavailable',activityBadge='NO USABLE DELTA',activityColor='#aeb9c8';
  if(p95DeltaNt!==null){
    if(p95DeltaNt<60){tier='LOCAL_SMALL';activityLabel='Small local variation';activityColor='#20c997';}
    else if(p95DeltaNt<200){tier='LOCAL_MODERATE';activityLabel='Moderate local variation';activityColor='#ffd58c';}
    else if(p95DeltaNt<500){tier='LOCAL_LARGE';activityLabel='Large local variation';activityColor='#00e5ff';}
    else {tier='LOCAL_VERY_LARGE';activityLabel='Very large local variation';activityColor='#ff5252';}
    activityBadge=`LOCAL p95 ${p95DeltaNt.toFixed(0)} nT`;
  }
  const scientificMeaning='A phone magnitude deviation cannot determine Kp, NOAA G severity, solar-wind coupling, magnetic reconnection, or visible aurora. Regional origin remains INCONCLUSIVE without aligned independent measurements.';
  const activityExplanation=p95DeltaNt===null?'No QC-usable high-water statistic is available. No replacement value has been estimated.':`The 95th percentile of absolute baseline-relative deviations among QC-usable samples is ${p95DeltaNt.toFixed(0)} nT${maxDeltaNt===null?'':`, with peak ${maxDeltaNt.toFixed(0)} nT`}. These are local scalar |B| measurements in nT, not planetary storm severity. ${highWater?.completeWindow?'The requested high-water window is complete.':'The requested high-water window has incomplete time coverage.'}`;
  const timelineStory:PrescriptiveTimelineInterval[]=[];
  const t0=session.samples[0]?.sensorTimestampSeconds,tn=session.samples.at(-1)?.sensorTimestampSeconds;
  if(baselineReady&&t0!==undefined&&tn!==undefined&&Number.isFinite(t0)&&Number.isFinite(tn)&&tn>t0&&qc.sampleResults.length===session.samples.length){
    const duration=tn-t0;
    for(let phase=0;phase<3;phase++){
      const start=duration*phase/3,end=duration*(phase+1)/3;
      const deltas=session.samples.flatMap((s,i)=>{const t=s.sensorTimestampSeconds-t0,row=qc.sampleResults[i];return Number.isFinite(t)&&t>=start&&(phase===2?t<=end:t<end)&&row.usable&&finite(row.deltaNt)!==null?[row.deltaNt!]:[];});
      const medianDeltaNt=median(deltas);if(medianDeltaNt===null)continue;
      const peakDeltaNt=deltas.reduce((p,d)=>Math.max(p,Math.abs(d)),0);
      timelineStory.push({intervalLabel:`Interval ${phase+1}: QC-usable samples`,startMinute:start/60,endMinute:end/60,medianDeltaNt,peakDeltaNt,description:`${deltas.length} QC-usable samples: median signed deviation ${medianDeltaNt.toFixed(0)} nT, peak absolute deviation ${peakDeltaNt.toFixed(0)} nT. Cause is not determined.`});
    }
  }
  return {placementQuality:{rating,score,label,badgeText,color,noiseMadNt,explanation,actionAdvice},activityLevel:{tier,label:activityLabel,badgeText:activityBadge,color:activityColor,kpEstimate:'Not inferable from a phone',maxDeltaNt,p95DeltaNt,driftNt,explanation:activityExplanation,scientificMeaning},timelineStory,prescriptiveGuidance:[`Recording quality: ${badgeText}. ${actionAdvice}`,`Local variation: ${activityExplanation}`,`Next: compare timestamp-aligned scalar variations against a professional reference and independently located phones. A remote station or historical archive is context, not proof of a local cause. ${session.kind==='SYNTHETIC'?'SYNTHETIC recording: this is not measured phone evidence.':''}`]};
}
