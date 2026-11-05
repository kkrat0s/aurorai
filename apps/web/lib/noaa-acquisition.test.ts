import { describe,it,expect,vi } from 'vitest';
import { parseKp,parseSolarWind,NOAA_URLS } from './noaa';
import { createNoaaLoader,boundedNoaaText } from './noaa-acquisition';
const now='2026-11-04T05:00:00.000Z';
const mag=[{active:true,overall_quality:0,time_tag:'2026-11-04T04:59:00',source:'TEST',bz_gsm:0}];
const plasma=[{active:true,overall_quality:0,time_tag:'2026-11-04T04:59:00',source:'TEST',proton_speed:420,proton_density:0}];
const oval={'Data Format':'[Longitude, Latitude, Aurora]','Observation Time':'2026-11-04T04:45:00Z','Forecast Time':'2026-11-04T05:10:00Z',coordinates:[[254,40,0]]};
const makeFetch=(changes:Record<string,unknown>={})=>vi.fn(async(url:string|URL|Request)=>{
  const bodies:Record<string,unknown>={[NOAA_URLS.ovation]:oval,[NOAA_URLS.mag]:mag,[NOAA_URLS.wind]:plasma,[NOAA_URLS.kp]:[{time_tag:'2026-11-04T03:00:00',Kp:0}],...changes};
  const body=bodies[String(url)];return body===null?new Response('',{status:503}):Response.json(body);
});

describe('NOAA acquisition boundaries',()=>{
  it('parses current Kp object schema and legacy header schema without losing zero',()=>{
    const rows=parseKp([{time_tag:'2026-11-04T03:00:00',Kp:0},{time_tag:'2026-11-04T00:00:00',Kp:3.33}],now).samples;
    expect(rows[1]).toEqual({observedAtUtc:'2026-11-04T03:00:00.000Z',kp:0});
    expect(parseKp([['time_tag','Kp','a_running'],['2026-11-04 03:00:00','0','0']],now).samples[0].kp).toBe(0);
  });
  it.each([[],[{time_tag:now,Kp:10}],[{time_tag:now,Kp:''}],[{time_tag:now,Kp:1},{time_tag:now,Kp:2}]].map(input=>({input})))('rejects malformed or ambiguous Kp records',({input})=>{
    expect(()=>parseKp(input,now)).toThrow();
  });
  it('deduplicates in-flight calls, caches bounded output and preserves original retrieval times',async()=>{
    let clock=Date.parse(now);const f=makeFetch(),load=createNoaaLoader(f as typeof fetch,()=>clock);
    const [a,b]=await Promise.all([load(),load()]);expect(a).toBe(b);expect(f).toHaveBeenCalledTimes(4);
    clock+=30000;const hit=await load();expect(hit.retrievedAtUtc).toBe(now);expect(hit.manifests).toHaveLength(4);expect(f).toHaveBeenCalledTimes(4);
    clock+=120000;await load();expect(f).toHaveBeenCalledTimes(8);
  });
  it('retains real IMF if plasma upstream fails, with no substituted speed',async()=>{
    const data=await createNoaaLoader(makeFetch({[NOAA_URLS.wind]:null}) as typeof fetch,()=>Date.parse(now))();
    expect(data.latestNoaa.solarWind?.samples[0]).toMatchObject({bzNt:0,speedKmS:null,densityCm3:null});expect(data.errors.some(e=>e.includes('wind'))).toBe(true);
    expect(data.latestNoaa.kp?.samples[0].kp).toBe(0);
  });
  it('retains valid plasma when IMF schema is invalid',async()=>{
    const data=await createNoaaLoader(makeFetch({[NOAA_URLS.mag]:{bad:true}}) as typeof fetch,()=>Date.parse(now))();
    expect(data.latestNoaa.solarWind?.samples[0]).toMatchObject({bzNt:null,speedKmS:420,densityCm3:0});expect(data.errors).toContain('mag schema validation failed.');
  });
  it('keeps sentinel and negative physical plasma values null',()=>{
    const result=parseSolarWind(mag,[{...plasma[0],proton_speed:-9999,proton_density:-5}],now);
    expect(result.samples[0]).toMatchObject({bzNt:0,speedKmS:null,densityCm3:null});
  });
  it('collapses identical active records and quarantines only conflicting minutes',()=>{
    const next={...mag[0],time_tag:'2026-11-04T04:58:00',bz_gsm:-5};
    const exact=parseSolarWind([mag[0],mag[0],next],plasma,now);
    expect(exact.samples).toHaveLength(2);expect(exact.samples[1].bzNt).toBe(0);expect(exact.quality).toEqual({duplicateRowsCollapsed:1,ambiguousMinutes:0});
    const conflict=parseSolarWind([mag[0],{...mag[0],bz_gsm:-30},next],plasma,now);
    expect(conflict.samples[0].bzNt).toBe(-5);expect(conflict.samples[1]).toMatchObject({bzNt:null,speedKmS:420});expect(conflict.quality?.ambiguousMinutes).toBe(1);
  });
  it('caps streamed response bytes even without content-length',async()=>{
    let cancelled=false;
    const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(32));},cancel(){cancelled=true;}});
    await expect(boundedNoaaText(new Response(stream),10)).rejects.toThrow('size limit');expect(cancelled).toBe(true);
  });
  it('does not invent a fallback when the first request is a total outage',async()=>{
    const changes=Object.fromEntries(Object.values(NOAA_URLS).map(url=>[url,null]));const f=makeFetch(changes),load=createNoaaLoader(f as typeof fetch,()=>Date.parse(now));
    const data=await load();expect(Object.values(data.latestNoaa).every(v=>v===null)).toBe(true);await load();expect(f).toHaveBeenCalledTimes(8);
  });
  it('retains verified products across an outage without refreshing their scientific timestamps',async()=>{
    let clock=Date.parse(now),outage=false;
    const good=makeFetch();
    const f=vi.fn(async(url:string|URL|Request)=>outage?new Response('',{status:503}):good(url));
    const load=createNoaaLoader(f as typeof fetch,()=>clock);
    const initial=await load(); outage=true; clock+=180000;
    const retained=await load();
    expect(retained.latestNoaa).toEqual(initial.latestNoaa);
    expect(retained.latestNoaa.ovation?.retrievedAtUtc).toBe(now);
    expect(retained.retrievedAtUtc).not.toBe(now);
    expect(retained.errors.some(error=>error.includes('original timestamps'))).toBe(true);
    expect(f).toHaveBeenCalledTimes(8);
  });
});
