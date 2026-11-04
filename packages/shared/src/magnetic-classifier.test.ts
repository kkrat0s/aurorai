import { describe, expect, it } from 'vitest';
import { classifyMagneticDisturbance, createUserLearnedFingerprint, extractDisturbanceSignature, parseLearnedFingerprints, SPACE_WEATHER_GROUND_SCALES, GRANITE_WINDOWSILL_PHYSICS, type MagneticSample, type DevicePhysicalContext } from './magnetic-classifier';
const context:DevicePhysicalContext={isStandstill:true,motionState:'STANDSTILL',isScreenTouched:false,isCharging:false,batteryState:'UNPLUGGED',sensorDeviceKey:'test-phone-a',sampleKind:'SYNTHETIC'};
function trace(start=0,amplitude=.7):MagneticSample[]{return Array.from({length:25},(_,i)=>({x:0,y:0,z:50+amplitude*i/24,timestampMs:start+i*100}));}
function learn(label='Desk fan',start=0){return createUserLearnedFingerprint(classifyMagneticDisturbance(trace(start),50,[],context),'UNKNOWN_UNCLASSIFIED',label);}
describe('bounded local fingerprint learning',()=>{
 it('never labels smooth stationary drift as a solar event, irrespective of amplitude',()=>{
  for(const amplitude of [.1,.35,.7,3,12,100]){const r=classifyMagneticDisturbance(trace(0,amplitude),50,[],context);expect(r.predictedClass).not.toBe('GEOMAGNETIC_SOLAR_DISTURBANCE');expect(r.scores.GEOMAGNETIC_SOLAR_DISTURBANCE).toBe(0);}
 });
 it('abstains when motion and charging context are missing rather than assume a quiet stationary sensor',()=>{
  const r=classifyMagneticDisturbance(trace(0,.01),50);expect(r.predictedClass).toBe('UNKNOWN_UNCLASSIFIED');expect(r.context?.motionState).toBe('UNKNOWN');expect(r.context?.batteryState).toBe('UNKNOWN');expect(r.context?.isCharging).toBeUndefined();
 });
 it('learns a named unknown object on a separate window without claiming identity or calibrated accuracy',()=>{
  const fp=learn(),r=classifyMagneticDisturbance(trace(10000),50,[fp],context);
  expect(fp.learningEligible).toBe(true);expect(r.evidenceStatus).toBe('USER_LABELED_MATCH');expect(r.learningMatch?.label).toBe('Desk fan');expect(r.metadata.name).toBe('User label: Desk fan');expect(r.learningMatch?.validation).toBe('UNVALIDATED_USER_LABEL');expect(r.confidenceKind).toBe('UNCALIBRATED_MATCH_SCORE');
 });
 it('excludes identical training data and overlapping windows from learning evidence',()=>{
  const fp=learn();for(const start of [0,100,2400])expect(classifyMagneticDisturbance(trace(start),50,[fp],context).learningMatch).toBeNull();
 });
 it('rejects ambiguous and contradictory user labels, including labels for the same training window',()=>{
  for(const profiles of [[learn('Fan'),learn('Charger',5000)],[learn('Fan'),learn('Charger')]])expect(classifyMagneticDisturbance(trace(15000),50,profiles,context).learningMatch).toBeNull();
 });
 it('does not inflate support with repeated taps or shifted overlapping buffers',()=>{
  const fp=learn();const r=classifyMagneticDisturbance(trace(15000),50,[fp,fp,learn('Desk fan',100),learn('Desk fan',5000)],context);expect(r.learningMatch?.independentExamples).toBe(2);
 });
 it('does not transfer fingerprints across phones, measured/synthetic domains, motion or charging context',()=>{
  const fp=learn();for(const change of [{sensorDeviceKey:'other'},{sampleKind:'MEASURED' as const},{motionState:'ACTIVE_MOTION' as const},{batteryState:'CHARGING' as const}])expect(classifyMagneticDisturbance(trace(15000),50,[fp],{...context,...change}).learningMatch).toBeNull();
 });
 it('abstains from learned identity on a distant feature pattern or cadence mismatch',()=>{
  const fp=learn();expect(classifyMagneticDisturbance(trace(15000,20),50,[fp],context).learningMatch).toBeNull();
  const faster=trace(15000).map((s,i)=>({...s,timestampMs:15000+i*20}));expect(classifyMagneticDisturbance(faster,50,[fp],context).learningMatch).toBeNull();
 });
 it('ignores legacy, nonfinite, and false-confidence profiles; users cannot teach solar origin',()=>{
  const fp=learn();const profiles=[{...fp,protocolVersion:undefined},{...fp,userConfirmed:false},{...fp,signature:{...fp.signature,peakDeltaMicroT:Infinity}},{...fp,objectClassId:'GEOMAGNETIC_SOLAR_DISTURBANCE' as const}];
  expect(classifyMagneticDisturbance(trace(15000),50,profiles,context).learningMatch).toBeNull();
  expect(createUserLearnedFingerprint(classifyMagneticDisturbance(trace(),50,[],context),'GEOMAGNETIC_SOLAR_DISTURBANCE').learningEligible).toBe(false);
 });
 it.each(['empty','short','duplicate','reverse','gap','nan','range','baseline'] as const)('marks %s acquisition invalid and ineligible for teaching',kind=>{
  let s=trace(),baseline=50;
  if(kind==='empty')s=[];if(kind==='short')s=s.slice(0,4);if(kind==='duplicate')s[4].timestampMs=s[3].timestampMs;if(kind==='reverse')s=s.reverse();if(kind==='gap')s=s.map((v,i)=>({...v,timestampMs:v.timestampMs+(i>3?2000:0)}));if(kind==='nan')s[3].x=NaN;if(kind==='range')s[3].z=5000;if(kind==='baseline')baseline=NaN;
  const r=classifyMagneticDisturbance(s,baseline,[],context);expect(r.predictedClass).toBe('UNKNOWN_UNCLASSIFIED');expect(r.evidenceStatus).toBe('INSUFFICIENT_DATA');expect(r.trainable).toBe(false);expect(createUserLearnedFingerprint(r,'UNKNOWN_UNCLASSIFIED','new').learningEligible).toBe(false);
 });
 it('matches across app restarts with distinct acquisition runs while excluding overlaps within a run',()=>{
  const first=classifyMagneticDisturbance(trace(),50,[],{...context,acquisitionRunId:'run-one'});
  const fp=createUserLearnedFingerprint(first,'UNKNOWN_UNCLASSIFIED','Desk fan');
  expect(classifyMagneticDisturbance(trace(),50,[fp],{...context,acquisitionRunId:'run-one'}).learningMatch).toBeNull();
  const r=classifyMagneticDisturbance(trace(),50,[fp],{...context,acquisitionRunId:'run-two'});
  expect(r.learningMatch?.label).toBe('Desk fan');expect(r.sourceWindowId).not.toBe(fp.sourceWindowId);
  const fp2=createUserLearnedFingerprint(r,'UNKNOWN_UNCLASSIFIED','Desk fan');
  expect(classifyMagneticDisturbance(trace(),50,[fp,fp2],{...context,acquisitionRunId:'run-three'}).learningMatch?.independentExamples).toBe(2);
 });
 it('restores bounded validated profiles and strips unapproved imported fields',()=>{
  const fp=createUserLearnedFingerprint(classifyMagneticDisturbance(trace(),50,[],{...context,acquisitionRunId:'run-one'}),'UNKNOWN_UNCLASSIFIED','Fan');
  const saved=parseLearnedFingerprints(JSON.parse(JSON.stringify([{...fp,privateField:'discard',context:{...fp.context,preciseLocation:'discard'}},fp,{...fp,id:'invalid',customLabel:45},{...fp,id:'bad',signature:{}}])));
  expect(saved).toHaveLength(1);expect(saved[0].context?.acquisitionRunId).toBe('run-one');expect(JSON.stringify(saved)).not.toContain('discard');expect(parseLearnedFingerprints(null)).toEqual([]);expect(parseLearnedFingerprints({})).toEqual([]);
 });
 it('blocks teaching until a recent screen interaction has left the window while preserving raw features',()=>{
  const normal=classifyMagneticDisturbance(trace(),50,[],context);
  const recent=classifyMagneticDisturbance(trace(),50,[],{...context,timeSinceLastTouchMs:500});
  expect(recent.signature).toEqual(normal.signature);expect(recent.predictedClass).toBe(normal.predictedClass);
  expect(recent.qualityIssues).toContain('RECENT_SCREEN_TOUCH');expect(recent.trainable).toBe(false);
  expect(createUserLearnedFingerprint(recent,'UNKNOWN_UNCLASSIFIED','new').learningEligible).toBe(false);
  expect(classifyMagneticDisturbance(trace(),50,[],{...context,isScreenTouched:true}).trainable).toBe(false);
  expect(classifyMagneticDisturbance(trace(),50,[],{...context,timeSinceLastTouchMs:2401}).trainable).toBe(true);
 });
 it('includes the first sample in the peak and never hides invalid timestamps in dB/dt',()=>{
  const s=trace();s[0].z=55;expect(extractDisturbanceSignature(s,50).peakDeltaMicroT).toBe(5);s[1].timestampMs=0;expect(()=>extractDisturbanceSignature(s,50)).toThrow();
 });
 it('states G-level and local surface offsets cannot be mapped from phone amplitude',()=>{expect(SPACE_WEATHER_GROUND_SCALES.every(t=>t.groundPerturbationNanoT===null)).toBe(true);expect(GRANITE_WINDOWSILL_PHYSICS.staticPermeabilityOffsetNt).toBeNull();});
});
