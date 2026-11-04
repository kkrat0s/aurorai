import { z } from 'zod';
import { ovationSchema,windSchema,kpSchema,type Ovation,type Wind,type Kp } from './catalog';
export const NOAA_URLS={ovation:'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json',mag:'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json',wind:'https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json',kp:'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'} as const;
function providerUtc(value:string):string {
  // NOAA explicitly defines time_tag in UTC; unzoned provider fields only.
  const normalized=/Z$|[+-]\d{2}:\d{2}$/.test(value)?value:`${value.replace(' ','T')}Z`;
  if(!Number.isFinite(Date.parse(normalized)))throw new Error('Invalid provider timestamp');
  return new Date(normalized).toISOString();
}
const gridSchema=z.object({'Data Format':z.literal('[Longitude, Latitude, Aurora]'),'Observation Time':z.string(),'Forecast Time':z.string(),coordinates:z.array(z.tuple([z.number().min(0).lt(360),z.number().min(-90).max(90),z.number().min(0).max(100)])).max(100000)});
export function parseOvation(data:unknown,retrievedAtUtc:string):Ovation {
  const raw=gridSchema.parse(data);
  if(raw.coordinates.length===0)throw new Error('Empty OVATION grid');
  return ovationSchema.parse({sourceId:'NOAA_OVATION',sourceUrl:NOAA_URLS.ovation,kind:'ISSUED_FORECAST',observedAtUtc:providerUtc(raw['Observation Time']),validAtUtc:providerUtc(raw['Forecast Time']),retrievedAtUtc,coordinates:raw.coordinates.filter(([lon,lat])=>lon%2===0&&lat%2===0)});
}
const upstreamRow=z.object({active:z.boolean(),overall_quality:z.number(),time_tag:z.string(),source:z.string(),bz_gsm:z.number().nullable().optional(),proton_speed:z.number().nullable().optional(),proton_density:z.number().nullable().optional()});
const validNumber=(value:number|null|undefined)=>value===undefined||value===null||!Number.isFinite(value)||value===-9999?null:value;
export function parseSolarWind(mag:unknown,plasma:unknown,retrievedAtUtc:string):Wind {
  const rows=new Map<string,{observedAtUtc:string;bzNt:number|null;speedKmS:number|null;densityCm3:number|null}>();
  let duplicateRowsCollapsed=0,ambiguousMinutes=0;
  for(const [type,input] of [['mag',mag],['plasma',plasma]] as const){
    const seen=new Map<string,string>(),ambiguous=new Set<string>();
    for(const raw of z.array(upstreamRow).max(100000).parse(input)){
      if(!raw.active||raw.overall_quality!==0)continue;
      const time=providerUtc(raw.time_tag);
      const bz=validNumber(raw.bz_gsm),speed=validNumber(raw.proton_speed),density=validNumber(raw.proton_density);
      const signature=JSON.stringify(type==='mag'?[raw.source,bz]:[raw.source,speed,density]);
      const row=rows.get(time)??{observedAtUtc:time,bzNt:null,speedKmS:null,densityCm3:null};
      if(ambiguous.has(time))continue;
      if(seen.has(time)){
        if(seen.get(time)===signature){duplicateRowsCollapsed++;continue;}
        // Conflicting values or competing active providers: discard only this feed's minute.
        ambiguous.add(time);ambiguousMinutes++;
        if(type==='mag')row.bzNt=null;else{row.speedKmS=null;row.densityCm3=null;}
        rows.set(time,row);continue;
      }
      seen.set(time,signature);
      if(type==='mag')row.bzNt=bz;
      else{row.speedKmS=speed!==null&&speed>=0?speed:null;row.densityCm3=density!==null&&density>=0?density:null;}
      rows.set(time,row);
    }
  }
  if(!rows.size)throw new Error('No valid active NOAA samples');
  return windSchema.parse({sourceId:'NOAA_RTSW',sourceUrl:'https://services.swpc.noaa.gov/json/rtsw/',retrievedAtUtc,quality:{duplicateRowsCollapsed,ambiguousMinutes},samples:[...rows.values()].sort((a,b)=>a.observedAtUtc.localeCompare(b.observedAtUtc)).slice(-120)});
}

/** NOAA has served both object records and a header/table representation. Zero is valid. */
export function parseKp(data:unknown,retrievedAtUtc:string):Kp {
  if(!Array.isArray(data)||!data.length||data.length>1000)throw new Error('Invalid Kp response');
  let records:unknown[]=data;
  if(Array.isArray(data[0])){
    const header=data[0] as unknown[];
    const timeColumn=header.indexOf('time_tag'),kpColumn=header.findIndex(v=>v==='Kp'||v==='kp');
    if(timeColumn<0||kpColumn<0)throw new Error('Unknown Kp header');
    records=data.slice(1).map(row=>{
      if(!Array.isArray(row))throw new Error('Malformed Kp row');
      return {time_tag:row[timeColumn],Kp:row[kpColumn]};
    });
  }
  const schema=z.object({time_tag:z.string(),Kp:z.union([z.number(),z.string().regex(/^\d+(?:\.\d+)?$/)]).transform(Number).pipe(z.number().finite().min(0).max(9))});
  const seen=new Set<string>();
  const samples=records.map(row=>{const r=schema.parse(row),time=providerUtc(r.time_tag);if(seen.has(time))throw new Error('Duplicate Kp timestamp');seen.add(time);return {observedAtUtc:time,kp:r.Kp};}).sort((a,b)=>a.observedAtUtc.localeCompare(b.observedAtUtc));
  if(!samples.length)throw new Error('Empty Kp series');
  return kpSchema.parse({sourceId:'NOAA_ESTIMATED_KP',sourceUrl:NOAA_URLS.kp,retrievedAtUtc,samples});
}
