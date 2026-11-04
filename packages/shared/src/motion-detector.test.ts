import { describe, expect, it } from 'vitest';
import { RealtimeMotionDetector } from '../../../apps/mobile/motion-detector';
describe('motion acquisition validity',()=>{
 it('does not fabricate stillness or flatness for missing, insufficient or stale samples',()=>{
  const d=new RealtimeMotionDetector();expect(d.analyze(0).motionState).toBe('UNKNOWN');
  d.pushSample(0,0,1,0);d.pushSample(0,0,1,100);expect(d.analyze(100).isStandstill).toBe(false);
  d.pushSample(0,0,1,200);expect(d.analyze(200).motionState).toBe('STANDSTILL');
  const stale=d.analyze(701);expect(stale.motionState).toBe('UNKNOWN');expect(stale.accelVarianceG).toBeNull();expect(stale.tiltDegrees).toBeNull();expect(stale.isFlatOnSurface).toBe(false);
 });
 it('resets after a gap, invalid samples, and nonmonotonic acquisition time',()=>{
  const d=new RealtimeMotionDetector();for(const t of [0,100,200])d.pushSample(0,0,1,t);
  d.pushSample(0,0,1,1000);expect(d.analyze(1000).motionState).toBe('UNKNOWN');
  for(const t of [1100,1200])d.pushSample(0,0,1,t);d.pushSample(NaN,0,1,1300);expect(d.analyze(1300).motionState).toBe('UNKNOWN');
  for(const t of [1400,1500,1600])d.pushSample(0,0,1,t);d.pushSample(0,0,1,1500);expect(d.analyze(1600).motionState).toBe('UNKNOWN');
 });
 it('detects pitch/roll change even when acceleration magnitude remains exactly one g',()=>{
  const d=new RealtimeMotionDetector();for(let i=0;i<20;i++)d.pushSample(Math.sin(i*.08),0,Math.cos(i*.08),i*100);
  expect(d.analyze(1900).isStandstill).toBe(false);
 });
});
