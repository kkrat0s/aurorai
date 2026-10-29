import { describe,it,expect } from 'vitest';
import {visibleForecasts,dataFreshness,catalogSchema,type Cme} from './catalog';
import {parseOvation,parseSolarWind} from './noaa';
import {solarElevation,darkness} from './viewing';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const cme:Cme={id:'original',eventId:'may-2024',method:'example',issuedAtUtc:'2024-05-08T10:00:00Z',predictedArrivalUtc:'2024-05-10T20:00:00Z',observedArrivalUtc:'2024-05-10T16:36:00Z',sourceId:'fixture',sourceUrl:'https://example.invalid',kind:'ISSUED_FORECAST'};
describe('replay time and source integrity',()=>{
  it('hides future submissions and post-outcome aggregates',()=>{expect(visibleForecasts([cme,{...cme,id:'late',issuedAtUtc:'2025-01-01T00:00:00Z'}],'2024-05-08T09:00:00Z')).toEqual([]);expect(visibleForecasts([cme,{...cme,id:'late',issuedAtUtc:'2025-01-01T00:00:00Z'}],'2026-01-01T00:00:00Z')).toEqual([cme]);});
  it('distinguishes stale, absent and future data',()=>{expect(dataFreshness(null,'2026-10-28T10:00:00Z')).toBe('missing');expect(dataFreshness('2024-05-10T00:00:00Z','2026-10-28T10:00:00Z')).toBe('stale');expect(dataFreshness('2026-10-28T11:00:00Z','2026-10-28T10:00:00Z')).toBe('future');});
  it('validates acquired catalog and prevents retrospective original forecasts',()=>{const data=catalogSchema.parse(JSON.parse(readFileSync(path.resolve('demo/fixtures/verified-sources.json'),'utf8')));expect(data.cmeForecasts.length).toBeGreaterThanOrEqual(2);for(const f of data.cmeForecasts)expect(Date.parse(f.issuedAtUtc)).toBeLessThan(Date.parse(f.observedArrivalUtc!));expect(data.referenceSeries[0].samples.length).toBeGreaterThan(100);expect(data.latestNoaa.ovation?.observedAtUtc.startsWith('2024')).toBe(false);});
});
describe('NOAA schema and missing-data handling',()=>{
  it('retains observed and forecast validity separately',()=>{const data=parseOvation({'Data Format':'[Longitude, Latitude, Aurora]','Observation Time':'2026-10-28T10:00:00Z','Forecast Time':'2026-10-28T10:30:00Z',coordinates:[[0,60,40]]},'2026-10-28T10:05:00Z');expect(data.observedAtUtc).not.toBe(data.validAtUtc);expect(data.coordinates).toEqual([[0,60,40]]);});
  it('rejects bad model cells and schema changes',()=>{expect(()=>parseOvation({'Data Format':'[Latitude, Longitude, Aurora]'},'2026-10-28T10:00:00Z')).toThrow();expect(()=>parseOvation({'Data Format':'[Longitude, Latitude, Aurora]','Observation Time':'2026-10-28T10:00:00Z','Forecast Time':'2026-10-28T10:30:00Z',coordinates:[[0,95,40]]},'2026-10-28T10:05:00Z')).toThrow();});
  it('filters invalid sources and preserves sentinel gaps',()=>{const base={active:true,overall_quality:0,time_tag:'2026-10-28T10:00:00',source:'provider'};const data=parseSolarWind([{...base,bz_gsm:-9999},{...base,time_tag:'2026-10-28T10:01:00',active:false,bz_gsm:90}],[{...base,proton_speed:400,proton_density:4}],'2026-10-28T10:05:00Z');expect(data.samples).toEqual([{observedAtUtc:'2026-10-28T10:00:00.000Z',bzNt:null,speedKmS:400,densityCm3:4}]);});
  it('does not silently choose among ambiguous active sources',()=>{const row={active:true,overall_quality:0,time_tag:'2026-10-28T10:00:00Z',source:'provider',bz_gsm:1};expect(()=>parseSolarWind([row,row],[],'2026-10-28T10:05:00Z')).toThrow('Ambiguous');});
});
describe('local viewing context',()=>{
  it('uses UTC and longitude correctly at equinox',()=>{expect(solarElevation(0,0,'2024-03-20T12:00:00Z')).toBeGreaterThan(85);expect(solarElevation(0,0,'2024-03-20T00:00:00Z')).toBeLessThan(-85);expect(solarElevation(0,180,'2024-03-20T00:00:00Z')).toBeGreaterThan(85);});
  it('handles polar day and night without invented visibility probability',()=>{expect(darkness(solarElevation(90,0,'2024-06-21T00:00:00Z'))).toBe('Daylight');expect(darkness(solarElevation(90,0,'2024-12-21T12:00:00Z'))).toBe('Dark sky');});
});
