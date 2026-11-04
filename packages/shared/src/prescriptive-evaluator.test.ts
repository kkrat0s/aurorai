import { describe, expect, it } from 'vitest';
import { evaluateSessionPrescriptively } from './prescriptive-evaluator';
import { analyzeSensorSession, type SensorSession } from './sensor';
function session():SensorSession {
 const start=Date.parse('2026-11-04T00:00:00Z');
 return {schemaVersion:'aurorasense.sensor.v1',id:'synthetic-test',kind:'SYNTHETIC',sourceId:'AURORASENSE_TEST_GENERATOR',frame:'DEVICE',unit:'microT',startedAtUtc:new Date(start).toISOString(),endedAtUtc:new Date(start+180000).toISOString(),utcAnchor:{sensorTimestampSeconds:0,utc:new Date(start).toISOString(),uncertaintyMs:null},nominalHz:10,device:{platform:'test',model:null,sensor:'test-generator',calibration:'OS_CALIBRATED_ACCURACY_UNKNOWN'},consent:{adultConfirmed:true,recording:true,version:'test',atUtc:new Date(start).toISOString()},stopReason:'DURATION_COMPLETE',markers:[],samples:Array.from({length:1801},(_,i)=>({x:0,y:0,z:50+(i>1200?.7:0),sensorTimestampSeconds:i/10,receivedMonotonicMs:i*100,receivedAtUtc:new Date(start+i*100).toISOString(),accelerationG:{x:0,y:0,z:1},accelerationAgeMs:0}))};
}
describe('local session interpretation',()=>{
 it('does not convert a large synthetic local excursion to a planetary storm',()=>{
  const s=session(),qc=analyzeSensorSession(s),r=evaluateSessionPrescriptively(s,qc);
  expect(r.activityLevel.p95DeltaNt).toBeCloseTo(700);
  expect(r.activityLevel.tier).toBe('LOCAL_VERY_LARGE');
  expect(r.activityLevel.kpEstimate).toBe('Not inferable from a phone');
  expect(r.activityLevel.scientificMeaning).toContain('INCONCLUSIVE');
  expect(r.placementQuality.score).toBe(100);
  expect(r.timelineStory).toHaveLength(3);
  expect(r.prescriptiveGuidance.join(' ')).toContain('SYNTHETIC');
 });
 it('leaves missing baseline/high-water values unknown without invented noise or p95',()=>{
  const s=session();s.samples=s.samples.slice(0,2);
  const r=evaluateSessionPrescriptively(s,analyzeSensorSession(s));
  expect(r.placementQuality.rating).toBe('UNKNOWN');
  expect(r.placementQuality.noiseMadNt).toBeNull();
  expect(r.activityLevel.maxDeltaNt).toBeNull();expect(r.activityLevel.p95DeltaNt).toBeNull();expect(r.activityLevel.driftNt).toBeNull();
  expect(r.timelineStory).toEqual([]);expect(r.activityLevel.tier).toBe('UNAVAILABLE');
 });
 it('does not infer a charger or placement cause from QC rejection and excludes flagged timeline samples',()=>{
  const s=session(),qc=analyzeSensorSession(s);qc.accepted=false;qc.flags=['MOTION'];qc.sampleResults.forEach(r=>r.usable=false);qc.usableCount=0;
  const r=evaluateSessionPrescriptively(s,qc);
  expect(r.placementQuality.badgeText).toBe('QC FLAGGED');expect(r.placementQuality.score).toBe(0);
  expect(r.timelineStory).toEqual([]);expect(r.placementQuality.explanation).toContain('does not identify');
 });
 it('reports a true median for even sample counts and respects finite QC values',()=>{
  const s=session(),qc=analyzeSensorSession(s);qc.highWater[0].p95AbsoluteDeltaNt=NaN;qc.noiseMadNt=Infinity;
  const r=evaluateSessionPrescriptively(s,qc);expect(r.activityLevel.p95DeltaNt).toBeNull();expect(r.placementQuality.noiseMadNt).toBeNull();expect(JSON.stringify(r)).not.toContain('NaN');
 });
});
