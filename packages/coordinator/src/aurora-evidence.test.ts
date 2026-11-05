import { describe,it,expect } from 'vitest';
import { evaluateAuroraAlertDecision,evaluateEvidenceFromNoaa,auroraSolarElevation } from './aurora-evidence';
const now='2026-11-04T05:00:00.000Z';
const time=(minutes:number)=>new Date(Date.parse(now)+minutes*60000).toISOString();
const ovation=(activity=30)=>({sourceUrl:'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json',retrievedAtUtc:now,observedAtUtc:time(-10),validAtUtc:time(20),coordinates:[[255,40,activity],[255,66,95]]});
const wind=(samples=[{observedAtUtc:time(-2),bzNt:-8,speedKmS:600,densityCm3:5}])=>({sourceUrl:'https://services.swpc.noaa.gov/json/rtsw/',retrievedAtUtc:now,samples});
const base=()=>({asOfUtc:now,userLocation:{latitudeDeg:40,longitudeDeg:-105},ovation:ovation()});

describe('versioned local aurora evidence',()=>{
  it('selects geographic local data, never a far-away/global maximum',()=>{
    const result=evaluateAuroraAlertDecision({...base(),ovation:ovation(0)});
    expect(result.localOvationActivity).toBe(0);expect(result.nearbyOvationActivity).toBe(0);
    expect(result.alertLevel).toBe('QUIET_MONITORING');expect(result.visibilityLikelihood).toBe('LOW');
    expect(result.numericalProbability).toBeNull();expect(result.calibrated).toBe(false);
  });
  it('supports the dateline and Southern Hemisphere without inventing magnetic latitude',()=>{
    const result=evaluateAuroraAlertDecision({...base(),userLocation:{latitudeDeg:-65,longitudeDeg:-179},ovation:{...ovation(),coordinates:[[181,-65,55]]}});
    expect(result.ovationCellDistanceKm).toBe(0);expect(result.viewingDirection).toContain('Southern');
  });
  it('keeps modeled evidence and its actual valid time distinct from an optical probability',()=>{
    const result=evaluateAuroraAlertDecision(base());
    expect(result.alertLevel).toBe('ELEVATED_WATCH');expect(result.visibilityLikelihood).toBe('MODERATE');
    expect(result.optimalViewingWindow).toContain(time(20));expect(result.metaAudit.modelCalled).toBe(false);
    expect(result.sourceStatus.find(s=>s.source==='Cloud cover')?.status).toBe('MISSING');
  });
  it('calculates daylight from UTC/position and ignores a supplied nighttime claim',()=>{
    const date='2026-11-04T12:00:00Z';
    const result=evaluateAuroraAlertDecision({asOfUtc:date,userLocation:{latitudeDeg:0,longitudeDeg:0,isNighttime:true},ovation:{...ovation(),retrievedAtUtc:date,observedAtUtc:date,validAtUtc:date,coordinates:[[0,0,90]]}});
    expect(result.solarElevationDeg).toBeGreaterThan(60);expect(result.visibilityLikelihood).toBe('NEGLIGIBLE');
    expect(auroraSolarElevation(0,0,'2026-03-20T00:00:00Z')).toBeLessThan(-85);
  });
  it.each([
    {observedAtUtc:time(-150),validAtUtc:time(-120),expected:'STALE'},
    {observedAtUtc:time(10),validAtUtc:time(20),expected:'FUTURE'},
    {observedAtUtc:time(-50),validAtUtc:time(-20),expected:'STALE'},
    {observedAtUtc:time(-5),validAtUtc:time(180),expected:'INVALID'},
  ])('rejects stale/future/out-of-horizon model timing: $expected',({expected,...timestamps})=>{
    const result=evaluateAuroraAlertDecision({...base(),ovation:{...ovation(),...timestamps}});
    expect(result.localOvationActivity).toBeNull();expect(result.visibilityLikelihood).toBe('UNKNOWN');
    expect(result.sourceStatus[0].status).toBe(expected);expect(result.alertLevel).toBe('INSUFFICIENT_DATA');
  });
  it('evaluates forecast darkness at the source valid time, keeping current sun elevation separate',()=>{
    const at='2026-03-20T05:00:00Z',valid='2026-03-20T06:30:00Z';
    const result=evaluateAuroraAlertDecision({asOfUtc:at,userLocation:{latitudeDeg:0,longitudeDeg:0},ovation:{...ovation(),observedAtUtc:at,retrievedAtUtc:at,validAtUtc:valid,coordinates:[[0,0,90]]}});
    expect(result.solarElevationDeg).toBeLessThan(-12);expect(result.forecastSolarElevationDeg).toBeGreaterThan(0);expect(result.visibilityLikelihood).toBe('NEGLIGIBLE');
  });
  it('does not infer local activity when the nearest grid cell is too far away',()=>{
    const result=evaluateAuroraAlertDecision({...base(),ovation:{...ovation(),coordinates:[[10,70,100]]}});
    expect(result.localOvationActivity).toBeNull();expect(result.sourceStatus[0].status).toBe('MISSING');
    expect(result.sourceStatus[0].detail).toContain('No grid cell within 250 km');expect(result.summary).toContain('outside the supported local-cell coverage');
  });
  it('distinguishes missing local grid coverage from accessible fresh upstream NOAA context',()=>{
    const result=evaluateAuroraAlertDecision({...base(),ovation:null,solarWind:wind([{observedAtUtc:time(-2),bzNt:-2,speedKmS:400,densityCm3:4}])});
    expect(result.alertLevel).toBe('INSUFFICIENT_DATA');expect(result.localOvationActivity).toBeNull();
    expect(result.sourceStatus.find(source=>source.source==='NOAA IMF Bz')?.status).toBe('FRESH');
    expect(result.summary).toContain('Fresh global context remains available from NOAA IMF Bz, NOAA plasma');
    expect(result.summary).toContain('cannot replace a location-matched aurora-model cell');
  });
  it('does not treat stale cloud data as clear or use it to alter a current estimate',()=>{
    const old=evaluateAuroraAlertDecision({...base(),userLocation:{...base().userLocation,cloudFraction:1,cloudObservedAtUtc:time(-120)}});
    const current=evaluateAuroraAlertDecision({...base(),userLocation:{...base().userLocation,cloudFraction:1,cloudObservedAtUtc:time(-1)}});
    expect(old.visibilityLikelihood).toBe('MODERATE');expect(old.summary).toContain('unknown');expect(current.visibilityLikelihood).toBe('LOW');
  });
  it('phone amplitudes and unsupported coherence booleans never boost visibility',()=>{
    const a=evaluateAuroraAlertDecision(base());
    const b=evaluateAuroraAlertDecision({...base(),groundEvidence:{phoneAccepted:true,phoneDeltaNt:100000,boulderCoherence:true}});
    expect(b).toEqual(a);
  });
  it('preserves partial IMF context and does not bridge telemetry gaps',()=>{
    const rows=[-29,-28,-20,-19,-5].map(n=>({observedAtUtc:time(n),bzNt:-8,speedKmS:null,densityCm3:null}));
    const result=evaluateAuroraAlertDecision({...base(),solarWind:wind(rows as never)});
    expect(result.southwardDurationMinutes).toBe(2);expect(result.sourceStatus.find(s=>s.source==='NOAA plasma')?.status).toBe('MISSING');
    expect(result.evidence.some(e=>e.includes('IMF Bz -8.0'))).toBe(true);
  });
  it('invalid optional source is isolated and reported without hiding valid evidence',()=>{
    const result=evaluateAuroraAlertDecision({...base(),groundReference:{stationId:'BOU',samples:'bad'},solarWind:{...wind(),samples:[{observedAtUtc:now,bzNt:NaN,speedKmS:600,densityCm3:5}]}});
    expect(result.localOvationActivity).toBe(30);expect(result.sourceStatus.find(s=>s.source==='NOAA IMF Bz')?.status).toBe('INVALID');
    expect(result.sourceStatus.find(s=>s.source==='Professional ground F')?.status).toBe('INVALID');
  });
  it('uses fresh planetary Kp as context while keeping local visibility unknown without an oval',()=>{
    const result=evaluateAuroraAlertDecision({...base(),ovation:null,kp:{sourceUrl:'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',retrievedAtUtc:now,samples:[{observedAtUtc:time(-120),kp:7}]}});
    expect(result.planetaryKp).toBe(7);expect(result.alertLevel).toBe('ELEVATED_WATCH');expect(result.visibilityLikelihood).toBe('UNKNOWN');expect(result.numericalProbability).toBeNull();
  });
  it('reports distant ground context without inferring coherence or optical confirmation',()=>{
    const result=evaluateAuroraAlertDecision({...base(),groundReference:{sourceUrl:'https://geomag.usgs.gov/ws/data/',retrievedAtUtc:now,stationId:'TEST',latitude:0,longitude:0,component:'F',unit:'nT',samples:[{observedAtUtc:time(-1),value:50000}]}});
    expect(result.limitations.some(l=>l.includes('more than 750 km'))).toBe(true);expect(result.visibilityLikelihood).toBe('MODERATE');
  });
  it('current acquisition adapter refuses to relabel current feeds as historical replay',()=>{
    const result=evaluateEvidenceFromNoaa({asOfUtc:now,mode:'REPLAY',latitudeDeg:40,longitudeDeg:-105,latestNoaa:{ovation:ovation(),solarWind:wind()}});
    expect(result.localOvationActivity).toBeNull();expect(result.alertLevel).toBe('INSUFFICIENT_DATA');
  });
  it('missing or malformed coordinates fail closed',()=>{
    for(const value of [{},{...base(),userLocation:{latitudeDeg:120,longitudeDeg:0}}])expect(evaluateAuroraAlertDecision(value).visibilityLikelihood).toBe('UNKNOWN');
  });
});
