/**
 * Local magnetic pattern matching, not object identification or storm detection.
 * Device-frame µT, monotonic milliseconds. Scores are uncalibrated similarities.
 * Versioned engineering gates below were fixed before the added adversarial tests.
 */
export const FINGERPRINT_PROTOCOL_VERSION = 'local-pattern-2.0.0';
export const FINGERPRINT_POLICY = Object.freeze({minSamples:8,minDurationMs:400,maxSamples:5000,maxGapMs:1000,maxMatchDistance:0.7,ambiguityMargin:0.15,maxProfiles:200});
export type DisturbanceClassId = 'CLEAN_GEOMAGNETIC_BASELINE' | 'GEOMAGNETIC_SOLAR_DISTURBANCE' | 'HUMAN_HAND_GESTURE' | 'SMARTWATCH_OR_MAGNET' | 'CHARGING_CABLE_INDUCTION' | 'LAPTOP_OR_COMPUTER' | 'STRUCTURAL_METALLIC_MASS' | 'UNKNOWN_UNCLASSIFIED';
export interface DisturbanceClassMetadata {
  id: DisturbanceClassId; name:string; shortLabel:string; color:string; icon:string;
  /** No empirical per-object range or detection limit has been established. */
  typicalDeltaMicroT:null; typicalDeltaNanoT:null; rateOfChangeRangeMicroTPerSec:null;
  primaryMechanism:string; howAiGuesses:string; physicsExplanation:string; solarStormComparison:string; mitigationAdvice:string;
}
export interface SpaceWeatherScaleTier {
  noaaScale:'G0'|'G1'|'G2'|'G3'|'G4'|'G5'; name:string; groundPerturbationNanoT:null; kpIndex:string; phoneDetectability:string; scientificDescription:string;
}
export const SPACE_WEATHER_GROUND_SCALES:SpaceWeatherScaleTier[] = [
  ['G0','Below storm scale','Kp < 5'],['G1','Minor geomagnetic storm','Kp 5'],['G2','Moderate geomagnetic storm','Kp 6'],['G3','Strong geomagnetic storm','Kp 7'],['G4','Severe geomagnetic storm','Kp 8, including 9−'],['G5','Extreme geomagnetic storm','Kp 9'],
].map(([noaaScale,name,kpIndex])=>({noaaScale:noaaScale as SpaceWeatherScaleTier['noaaScale'],name,kpIndex,groundPerturbationNanoT:null,phoneDetectability:'Not established for this phone. Requires measured noise and synchronized references.',scientificDescription:'NOAA G levels are based on planetary Kp. They do not specify a universal local nT amplitude, cause or phone sensitivity.'}));
export const GRANITE_WINDOWSILL_PHYSICS={
  materialComposition:'Stone composition and remanent magnetization vary; the surface has not been characterized.',
  staticPermeabilityOffsetNt:null,
  windowSillAdvantage:'A window does not shield magnetic interference or provide a magnetic line-of-sight advantage. Check nearby metal, power cables, electronics and temperature changes.',
  zeroCalibrationProtocol:'A stationary zero subtracts a local offset for display. It does not calibrate the sensor or separate drift, local fields and geomagnetic variations.',
};
function metadata(id:DisturbanceClassId,name:string,shortLabel:string,color:string,icon:string,mechanism:string):DisturbanceClassMetadata {
  return {id,name,shortLabel,color,icon,typicalDeltaMicroT:null,typicalDeltaNanoT:null,rateOfChangeRangeMicroTPerSec:null,primaryMechanism:mechanism,
    howAiGuesses:'Bounded local feature comparison and optional user-labeled examples. Similar waveforms can have different causes; the match score is not a calibrated probability.',
    physicsExplanation:mechanism,
    solarStormComparison:'No fixed local amplitude maps to a NOAA G level. A single phone cannot identify a storm or magnetic reconnection.',
    mitigationAdvice:'Repeat a controlled present/absent comparison with a stationary phone; retain raw data, context and an independent holdout recording.'};
}
export const UNIVERSAL_FINGERPRINT_DATABASE:Record<DisturbanceClassId,DisturbanceClassMetadata>={
  CLEAN_GEOMAGNETIC_BASELINE:metadata('CLEAN_GEOMAGNETIC_BASELINE','Quiet local trace','Quiet trace','#68edc3','🌍','Little variation relative to the selected baseline. A stable local magnetic offset can still be present.'),
  GEOMAGNETIC_SOLAR_DISTURBANCE:metadata('GEOMAGNETIC_SOLAR_DISTURBANCE','Regional evidence required','Unverified regional cause','#00e5ff','☀️','This local pattern matcher cannot classify geomagnetic origin. Use synchronized professional and independent-site evidence.'),
  HUMAN_HAND_GESTURE:metadata('HUMAN_HAND_GESTURE','Handling-associated variation','Handling candidate','#ffd58c','🖐️','Touch/motion can coincide with orientation changes, accessories or nearby magnetic objects. These samples do not identify tissue diamagnetism.'),
  SMARTWATCH_OR_MAGNET:metadata('SMARTWATCH_OR_MAGNET','Nearby magnetic object candidate','Magnetic object','#f06292','⌚','A steep local gradient can be compatible with a nearby magnet or magnetized object; waveform alone cannot identify its make or type.'),
  CHARGING_CABLE_INDUCTION:metadata('CHARGING_CABLE_INDUCTION','Charging-associated variation','Charging candidate','#ffb74d','🔌','Charging state is contextual evidence, not proof that a cable caused the field. A controlled charging on/off comparison is required.'),
  LAPTOP_OR_COMPUTER:metadata('LAPTOP_OR_COMPUTER','User-labeled electronic object','Electronic object','#ba68c8','💻','Nearby electronics may contribute magnetic interference. Low-rate phone samples cannot resolve or identify a switching regulator from apparent jitter.'),
  STRUCTURAL_METALLIC_MASS:metadata('STRUCTURAL_METALLIC_MASS','User-labeled structural object','Structural object','#80cbc4','🏢','Magnetized structural material can affect local fields. A steady offset alone does not identify steel or the supporting surface.'),
  UNKNOWN_UNCLASSIFIED:metadata('UNKNOWN_UNCLASSIFIED','Unknown or ambiguous local source','Unknown source','#aeb9c8','❔','The available measurements do not uniquely identify a physical source. Record and label a controlled new example rather than forcing a known category.'),
};
export interface MagneticSample {x:number;y:number;z:number;timestampMs:number}
export interface DisturbanceSignature {
  deltaMicroT:number;deltaNanoT:number;peakDeltaMicroT:number;rateOfChangeMicroTPerSec:number;polarizationRatio:number;
  /** Step roughness, not a frequency-domain or switching-frequency measurement. */
  jitterRatio:number;steadinessRatio:number;sampleCount:number;durationMs:number;
  actualHz?:number;scalarRangeMicroT?:number;
}
export type DeviceMotionState='STANDSTILL'|'HAND_TREMOR'|'ACTIVE_MOTION'|'UNKNOWN';
export type DeviceBatteryState='CHARGING'|'UNPLUGGED'|'FULL'|'UNKNOWN';
export interface DevicePhysicalContext {
  isStandstill:boolean;motionState:DeviceMotionState;accelVarianceG?:number|null;isFlatOnSurface?:boolean;
  isScreenTouched:boolean;timeSinceLastTouchMs?:number;isCharging?:boolean;batteryState?:DeviceBatteryState;ambientLux?:number|null;
  /** Optional local model/setup identifier; do not use a personal device serial. */
  sensorDeviceKey?:string;
  /** Local, nonidentifying acquisition-run nonce; monotonic clocks restart between runs. */
  acquisitionRunId?:string;
  /** Distinguishes measured recordings from explicit demonstrations. */
  sampleKind?:'MEASURED'|'SYNTHETIC';
}
export interface LearningMatch {profileId:string;label:string;distance:number;independentExamples:number;validation:'UNVALIDATED_USER_LABEL'}
export interface DisturbanceClassificationResult {
  predictedClass:DisturbanceClassId;
  /** Compatibility field: uncalibrated match score, never posterior probability. */
  confidence:number;scores:Record<DisturbanceClassId,number>;metadata:DisturbanceClassMetadata;signature:DisturbanceSignature;
  /** Compatibility field: amplitude / 100 nT reference, not storm severity. */
  solarStormSignalRatio:number;fingerprintHash:string;aiReasoning:string;context?:DevicePhysicalContext;
  protocolVersion:string;confidenceKind:'UNCALIBRATED_MATCH_SCORE';evidenceStatus:'INSUFFICIENT_DATA'|'HEURISTIC_ONLY'|'USER_LABELED_MATCH'|'UNKNOWN';
  qualityIssues:string[];learningMatch:LearningMatch|null;trainable:boolean;
  windowStartMs:number|null;windowEndMs:number|null;sourceWindowId:string;
}
export interface LearnedUserFingerprint {
  id:string;confirmedAtUtc:string;objectClassId:DisturbanceClassId;customLabel?:string;signature:DisturbanceSignature;userConfirmed:boolean;
  protocolVersion?:string;sourceWindowId?:string;windowStartMs?:number;windowEndMs?:number;context?:DevicePhysicalContext;
  validation?:'UNVALIDATED_USER_LABEL';learningEligible?:boolean;
}
function inspectSamples(samples:MagneticSample[],baseline:number):string[] {
  const issues:string[]=[];
  if(!Number.isFinite(baseline)||baseline<=0||baseline>2000)issues.push('INVALID_BASELINE');
  if(samples.length<FINGERPRINT_POLICY.minSamples)issues.push('TOO_FEW_SAMPLES');
  if(samples.length>FINGERPRINT_POLICY.maxSamples)issues.push('TOO_MANY_SAMPLES');
  let previous:number|null=null;
  for(const s of samples){
    if(![s.x,s.y,s.z,s.timestampMs].every(Number.isFinite)){issues.push('NONFINITE_SAMPLE');break;}
    const field=Math.hypot(s.x,s.y,s.z);if(field<1||field>2000)issues.push('FIELD_OUT_OF_RANGE');
    if(previous!==null){if(s.timestampMs<=previous)issues.push('NONINCREASING_TIME');else if(s.timestampMs-previous>FINGERPRINT_POLICY.maxGapMs)issues.push('GAP_IN_WINDOW');}
    previous=s.timestampMs;
  }
  if(samples.length>1&&samples.at(-1)!.timestampMs-samples[0].timestampMs<FINGERPRINT_POLICY.minDurationMs)issues.push('WINDOW_TOO_SHORT');
  return [...new Set(issues)];
}
function emptySignature():DisturbanceSignature{return{deltaMicroT:0,deltaNanoT:0,peakDeltaMicroT:0,rateOfChangeMicroTPerSec:0,polarizationRatio:0,jitterRatio:0,steadinessRatio:0,sampleCount:0,durationMs:0,actualHz:0,scalarRangeMicroT:0};}
export function extractDisturbanceSignature(samples:MagneticSample[],baselineMagMicroT:number):DisturbanceSignature {
  if(!samples.length)return emptySignature();
  const invalid=inspectSamples(samples,baselineMagMicroT).filter(x=>!['TOO_FEW_SAMPLES','WINDOW_TOO_SHORT'].includes(x));
  if(invalid.length)throw new RangeError(`Invalid magnetic window: ${invalid.join(', ')}`);
  const mags=samples.map(s=>Math.hypot(s.x,s.y,s.z));const first=samples[0];const last=samples.at(-1)!;
  const peak=Math.max(...mags.map(m=>Math.abs(m-baselineMagMicroT)));
  let maxRate=0,stepSum=0;const axisVariation=[0,0,0];
  for(let i=1;i<samples.length;i++){
    const difference=Math.abs(mags[i]-mags[i-1]);stepSum+=difference;
    maxRate=Math.max(maxRate,difference/((samples[i].timestampMs-samples[i-1].timestampMs)/1000));
    axisVariation[0]+=Math.abs(samples[i].x-first.x);axisVariation[1]+=Math.abs(samples[i].y-first.y);axisVariation[2]+=Math.abs(samples[i].z-first.z);
  }
  const total=axisVariation.reduce((a,b)=>a+b,0);const mean=mags.reduce((a,b)=>a+b,0)/mags.length;
  const sd=Math.sqrt(mags.reduce((a,m)=>a+(m-mean)**2,0)/mags.length);const duration=last.timestampMs-first.timestampMs;
  return{deltaMicroT:mags.at(-1)!-baselineMagMicroT,deltaNanoT:(mags.at(-1)!-baselineMagMicroT)*1000,peakDeltaMicroT:peak,
    rateOfChangeMicroTPerSec:maxRate,polarizationRatio:total?Math.max(...axisVariation)/total:0,
    jitterRatio:Math.min(1,stepSum/Math.max(1,samples.length-1)/(Math.abs(mags.at(-1)!-mags[0])+.05)),
    steadinessRatio:Math.max(0,Math.min(1,1-sd/(peak+.1))),sampleCount:samples.length,durationMs:duration,
    actualHz:duration>0?(samples.length-1)*1000/duration:0,scalarRangeMicroT:Math.max(...mags)-Math.min(...mags)};
}
function sanitizeLabel(value:string):string{return Array.from(value).filter(char=>char.charCodeAt(0)>=32&&char.charCodeAt(0)!==127).join('').trim().slice(0,80);}
function hash(value:string):string {let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
function featureVector(s:DisturbanceSignature):number[]{return[Math.log1p(s.peakDeltaMicroT),Math.log1p(s.rateOfChangeMicroTPerSec),s.polarizationRatio,s.jitterRatio,s.steadinessRatio,Math.log1p(s.scalarRangeMicroT??0)];}
function featureDistance(a:DisturbanceSignature,b:DisturbanceSignature):number {
  const va=featureVector(a),vb=featureVector(b);const scales=[.6,.8,.3,.3,.3,.6];
  return Math.sqrt(va.reduce((sum,value,i)=>sum+((value-vb[i])/scales[i])**2,0)/va.length);
}
function validProfile(fp:LearnedUserFingerprint):boolean {
  return !!fp&&typeof fp.id==='string'&&fp.id.length<=200&&typeof fp.confirmedAtUtc==='string'&&Number.isFinite(Date.parse(fp.confirmedAtUtc))&&
    (fp.customLabel===undefined||(typeof fp.customLabel==='string'&&fp.customLabel.length<=80))&&fp.userConfirmed===true&&fp.learningEligible===true&&fp.protocolVersion===FINGERPRINT_PROTOCOL_VERSION&&
    Object.hasOwn(UNIVERSAL_FINGERPRINT_DATABASE,fp.objectClassId)&&fp.objectClassId!=='GEOMAGNETIC_SOLAR_DISTURBANCE'&&
    typeof fp.sourceWindowId==='string'&&Number.isFinite(fp.windowStartMs)&&Number.isFinite(fp.windowEndMs)&&fp.windowEndMs!>fp.windowStartMs!&&
    !!fp.signature&&['deltaMicroT','deltaNanoT','peakDeltaMicroT','rateOfChangeMicroTPerSec','polarizationRatio','jitterRatio','steadinessRatio','sampleCount','durationMs','actualHz','scalarRangeMicroT'].every(k=>Number.isFinite((fp.signature as unknown as Record<string,unknown>)[k]))&&fp.signature.sampleCount>=FINGERPRINT_POLICY.minSamples&&
    fp.signature.durationMs>=FINGERPRINT_POLICY.minDurationMs&&fp.signature.peakDeltaMicroT>=0&&fp.signature.rateOfChangeMicroTPerSec>=0&&
    [fp.signature.polarizationRatio,fp.signature.jitterRatio,fp.signature.steadinessRatio].every(v=>v>=0&&v<=1);
}
function compatibleContext(a:DevicePhysicalContext|undefined,b:DevicePhysicalContext):boolean {
  if((a?.sensorDeviceKey??'local-unverified')!==(b.sensorDeviceKey??'local-unverified'))return false;
  if((a?.sampleKind??'MEASURED')!==(b.sampleKind??'MEASURED'))return false;
  if(a?.motionState!==b.motionState||a?.isScreenTouched!==b.isScreenTouched)return false;
  if(a?.batteryState!==b.batteryState)return false;
  return true;
}
function findLearnedMatch(sig:DisturbanceSignature,start:number,end:number,sourceWindowId:string,profiles:LearnedUserFingerprint[],context:DevicePhysicalContext):{match:LearningMatch;classId:DisturbanceClassId}|null {
  const seen=new Set<string>();const candidates:Array<{fp:LearnedUserFingerprint;distance:number;label:string}>=[];
  for(const fp of profiles.slice(0,FINGERPRINT_POLICY.maxProfiles)){
    if(!validProfile(fp))continue;
    const duplicateKey=`${fp.sourceWindowId}:${fp.objectClassId}:${(fp.customLabel??'').toLowerCase()}`;
    if(seen.has(duplicateKey))continue;seen.add(duplicateKey);
    // Training-window reuse and overlapping rolling windows are not independent tests.
    const sameClock=!fp.context?.acquisitionRunId||!context.acquisitionRunId||fp.context.acquisitionRunId===context.acquisitionRunId;
    if(fp.sourceWindowId===sourceWindowId||(sameClock&&!(end<fp.windowStartMs!||start>fp.windowEndMs!)))continue;
    if(!compatibleContext(fp.context,context))continue;
    const cadence=sig.actualHz??0,profileCadence=fp.signature.actualHz??0;
    if(!cadence||!profileCadence||cadence/profileCadence<.5||cadence/profileCadence>2)continue;
    const distance=featureDistance(sig,fp.signature);
    if(distance>FINGERPRINT_POLICY.maxMatchDistance)continue;
    const label=(fp.customLabel??UNIVERSAL_FINGERPRINT_DATABASE[fp.objectClassId].name).trim().slice(0,80);
    candidates.push({fp,distance,label});
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.fp.id.localeCompare(b.fp.id));const best=candidates[0];if(!best)return null;
  const key=(c:{fp:LearnedUserFingerprint;label:string})=>`${c.fp.objectClassId}:${c.label.toLocaleLowerCase()}`;
  const different=candidates.find(c=>key(c)!==key(best));
  if(different&&different.distance-best.distance<FINGERPRINT_POLICY.ambiguityMargin)return null;
  // Count non-overlapping examples only; repeated taps and shifted buffers add no support.
  const lastEndByRun=new Map<string,number>();let independent=0;
  for(const c of candidates.filter(c=>key(c)===key(best)).sort((a,b)=>a.fp.windowStartMs!-b.fp.windowStartMs!)){
    const run=c.fp.context?.acquisitionRunId??'legacy-clock';const lastEnd=lastEndByRun.get(run)??-Infinity;
    if(c.fp.windowStartMs!>lastEnd){independent++;lastEndByRun.set(run,c.fp.windowEndMs!);}
  }
  return{classId:best.fp.objectClassId,match:{profileId:best.fp.id,label:best.label,distance:best.distance,independentExamples:independent,validation:'UNVALIDATED_USER_LABEL'}};
}
export function classifyMagneticDisturbance(samples:MagneticSample[],baselineMagMicroT:number,userLearnedFingerprints:LearnedUserFingerprint[]=[],context?:Partial<DevicePhysicalContext>):DisturbanceClassificationResult {
  const fullContext:DevicePhysicalContext={isStandstill:context?.isStandstill===true,motionState:context?.motionState??'UNKNOWN',isScreenTouched:context?.isScreenTouched===true,
    ...context,batteryState:context?.batteryState??(context?.isCharging===true?'CHARGING':context?.isCharging===false?'UNPLUGGED':'UNKNOWN')};
  const qualityIssues=inspectSamples(samples,baselineMagMicroT);
  let signature=emptySignature();try{signature=extractDisturbanceSignature(samples,baselineMagMicroT);}catch{/* Invalid input is explicitly ineligible below. */}
  const sourceWindowId=`window-${hash(JSON.stringify({run:fullContext.acquisitionRunId??'legacy-clock',samples}))}`;const scores=Object.fromEntries(Object.keys(UNIVERSAL_FINGERPRINT_DATABASE).map(k=>[k,0])) as Record<DisturbanceClassId,number>;
  let predictedClass:DisturbanceClassId='UNKNOWN_UNCLASSIFIED',evidenceStatus:DisturbanceClassificationResult['evidenceStatus']='UNKNOWN',confidence=0,learningMatch:LearningMatch|null=null;
  let aiReasoning='The local source is unknown. Similar magnetic patterns can arise from drift, motion, nearby objects or geomagnetic variation; this phone alone cannot distinguish them.';
  const {peakDeltaMicroT:peak,rateOfChangeMicroTPerSec:rate,jitterRatio:jitter}=signature;
  if(qualityIssues.length){evidenceStatus='INSUFFICIENT_DATA';aiReasoning=`Insufficient or invalid acquisition: ${qualityIssues.join(', ')}. Collect a continuous finite window before labeling a pattern.`;}
  else{
    const found=findLearnedMatch(signature,samples[0].timestampMs,samples.at(-1)!.timestampMs,sourceWindowId,userLearnedFingerprints,fullContext);
    if(found){predictedClass=found.classId;learningMatch=found.match;confidence=Math.max(0,1-found.match.distance/FINGERPRINT_POLICY.maxMatchDistance);evidenceStatus='USER_LABELED_MATCH';
      aiReasoning=`Resembles your label “${found.match.label}” from ${found.match.independentExamples} separate recording window(s), with matching recorded context. This is an unvalidated local example match, not verified object identity or measured accuracy.`;
    }else{
      if(peak<.2&&rate<.4&&fullContext.motionState==='STANDSTILL'&&!fullContext.isScreenTouched){predictedClass='CLEAN_GEOMAGNETIC_BASELINE';confidence=.65;aiReasoning=`Small local variation (${Math.round(peak*1000)} nT) in this window. Quiet does not establish calibration, absence of interference or geomagnetic origin.`;}
      else if(fullContext.isCharging===true&&peak>=2){predictedClass='CHARGING_CABLE_INDUCTION';confidence=.55;aiReasoning='An elevated local field coincides with reported charging. Charging is a candidate confound; repeat unplugged before attributing the field to a cable or charger.';}
      else if(peak>=3.5&&rate>4.5&&jitter<.45){predictedClass='SMARTWATCH_OR_MAGNET';confidence=.55;aiReasoning='A rapid local field change is compatible with a nearby magnetic object or movement. It cannot identify a smartwatch, magnet type or dipole distance from this trace.';}
      else if(peak>=.35&&peak<=8&&(fullContext.isScreenTouched||fullContext.motionState==='HAND_TREMOR'||fullContext.motionState==='ACTIVE_MOTION')){predictedClass='HUMAN_HAND_GESTURE';confidence=.5;aiReasoning='Magnetic variation coincides with recorded touch or movement. Handling, orientation, accessories and other local sources remain confounded; human tissue is not identified as the source.';}
      if(predictedClass!=='UNKNOWN_UNCLASSIFIED')evidenceStatus='HEURISTIC_ONLY';
    }
  }
  scores[predictedClass]=confidence;scores.UNKNOWN_UNCLASSIFIED=predictedClass==='UNKNOWN_UNCLASSIFIED'?1:1-confidence;
  // Keep raw features and screening outcomes; a touch overlapping this window only blocks teaching.
  const touchAge=fullContext.timeSinceLastTouchMs;
  const recentTouch=fullContext.isScreenTouched||(typeof touchAge==='number'&&Number.isFinite(touchAge)&&touchAge>=0&&touchAge<=signature.durationMs);
  if(recentTouch){qualityIssues.push('RECENT_SCREEN_TOUCH');aiReasoning+=' Teaching is paused until the rolling window no longer overlaps the recorded screen interaction.';}
  const meta=learningMatch?{...UNIVERSAL_FINGERPRINT_DATABASE[predictedClass],name:`User label: ${learningMatch.label}`,shortLabel:learningMatch.label}:UNIVERSAL_FINGERPRINT_DATABASE[predictedClass];
  return{predictedClass,confidence,scores,metadata:meta,signature,solarStormSignalRatio:signature.peakDeltaMicroT/.1,
    fingerprintHash:`fp-${hash(JSON.stringify(featureVector(signature)))}`,aiReasoning,context:fullContext,protocolVersion:FINGERPRINT_PROTOCOL_VERSION,
    confidenceKind:'UNCALIBRATED_MATCH_SCORE',evidenceStatus,qualityIssues,learningMatch,trainable:qualityIssues.length===0,
    windowStartMs:samples.length&&Number.isFinite(samples[0].timestampMs)?samples[0].timestampMs:null,
    windowEndMs:samples.length&&Number.isFinite(samples.at(-1)!.timestampMs)?samples.at(-1)!.timestampMs:null,sourceWindowId};
}
/** Adds one explicit user label. Deduplication and holdout checks occur during matching. */
export function createUserLearnedFingerprint(classification:DisturbanceClassificationResult,confirmedClassId:DisturbanceClassId,customLabel?:string):LearnedUserFingerprint {
  const eligible=classification.trainable===true&&confirmedClassId!=='GEOMAGNETIC_SOLAR_DISTURBANCE'&&Object.hasOwn(UNIVERSAL_FINGERPRINT_DATABASE,confirmedClassId);
  const label=sanitizeLabel(customLabel??UNIVERSAL_FINGERPRINT_DATABASE[confirmedClassId]?.name??'Unknown local object');
  return{id:`learned-${classification.sourceWindowId}-${hash(`${confirmedClassId}:${label}`)}`,confirmedAtUtc:new Date().toISOString(),objectClassId:confirmedClassId,
    customLabel:label,signature:{...classification.signature},userConfirmed:eligible,learningEligible:eligible,
    protocolVersion:FINGERPRINT_PROTOCOL_VERSION,sourceWindowId:classification.sourceWindowId,
    windowStartMs:classification.windowStartMs??undefined,windowEndMs:classification.windowEndMs??undefined,
    context:classification.context?{...classification.context}:undefined,validation:'UNVALIDATED_USER_LABEL'};
}

/** Restore only versioned, bounded, validated local examples; ignores legacy/corrupt imports. */
export function parseLearnedFingerprints(value:unknown):LearnedUserFingerprint[] {
  if(!Array.isArray(value))return [];
  const parsed:LearnedUserFingerprint[]=[];const seen=new Set<string>();
  for(const item of value.slice(0,FINGERPRINT_POLICY.maxProfiles)){
    if(!item||typeof item!=='object'||!validProfile(item as LearnedUserFingerprint))continue;
    const fp=item as LearnedUserFingerprint,c=fp.context;
    if(!c||!['STANDSTILL','HAND_TREMOR','ACTIVE_MOTION','UNKNOWN'].includes(c.motionState)||typeof c.isStandstill!=='boolean'||typeof c.isScreenTouched!=='boolean')continue;
    if(c.sensorDeviceKey!==undefined&&(typeof c.sensorDeviceKey!=='string'||c.sensorDeviceKey.length>120))continue;
    if(c.acquisitionRunId!==undefined&&(typeof c.acquisitionRunId!=='string'||c.acquisitionRunId.length<1||c.acquisitionRunId.length>120))continue;
    if(c.sampleKind!==undefined&&!['MEASURED','SYNTHETIC'].includes(c.sampleKind))continue;
    if(c.batteryState!==undefined&&!['CHARGING','UNPLUGGED','FULL','UNKNOWN'].includes(c.batteryState))continue;
    if(c.isCharging!==undefined&&typeof c.isCharging!=='boolean')continue;
    if(seen.has(fp.id))continue;seen.add(fp.id);
    const signature=Object.fromEntries(['deltaMicroT','deltaNanoT','peakDeltaMicroT','rateOfChangeMicroTPerSec','polarizationRatio','jitterRatio','steadinessRatio','sampleCount','durationMs','actualHz','scalarRangeMicroT'].map(k=>[k,(fp.signature as unknown as Record<string,number>)[k]])) as unknown as DisturbanceSignature;
    parsed.push({id:fp.id,confirmedAtUtc:fp.confirmedAtUtc,objectClassId:fp.objectClassId,customLabel:fp.customLabel===undefined?undefined:sanitizeLabel(fp.customLabel),signature,userConfirmed:true,protocolVersion:FINGERPRINT_PROTOCOL_VERSION,sourceWindowId:fp.sourceWindowId,windowStartMs:fp.windowStartMs,windowEndMs:fp.windowEndMs,validation:'UNVALIDATED_USER_LABEL',learningEligible:true,context:{isStandstill:c.isStandstill,motionState:c.motionState,isScreenTouched:c.isScreenTouched,isCharging:c.isCharging,batteryState:c.batteryState??'UNKNOWN',sensorDeviceKey:c.sensorDeviceKey,acquisitionRunId:c.acquisitionRunId,sampleKind:c.sampleKind??'MEASURED'}});
  }
  return parsed;
}
