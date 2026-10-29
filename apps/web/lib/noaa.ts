import { z } from 'zod';
import { ovationSchema,windSchema,type Ovation,type Wind } from './catalog';
export const NOAA_URLS={ovation:'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json',mag:'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json',wind:'https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json'} as const;
function providerUtc(value:string):string {
  // NOAA explicitly defines time_tag in UTC; unzoned provider fields only.
  const normalized=/Z$|[+-]\d{2}:\d{2}$/.test(value)?value:`${value.replace(' ','T')}Z`;
  if(!Number.isFinite(Date.parse(normalized)))throw new Error('Invalid provider timestamp');
  return new Date(normalized).toISOString();
}
const gridSchema=z.object({'Data Format':z.literal('[Longitude, Latitude, Aurora]'),'Observation Time':z.string(),'Forecast Time':z.string(),coordinates:z.array(z.tuple([z.number().min(0).lt(360),z.number().min(-90).max(90),z.number().min(0).max(100)]))});
export function parseOvation(data:unknown,retrievedAtUtc:string):Ovation {
  const raw=gridSchema.parse(data);
  if(raw.coordinates.length===0)throw new Error('Empty OVATION grid');
  return ovationSchema.parse({sourceId:'NOAA_OVATION',sourceUrl:NOAA_URLS.ovation,kind:'ISSUED_FORECAST',observedAtUtc:providerUtc(raw['Observation Time']),validAtUtc:providerUtc(raw['Forecast Time']),retrievedAtUtc,coordinates:raw.coordinates.filter(([lon,lat])=>lon%2===0&&lat%2===0)});
}
const upstreamRow=z.object({active:z.boolean(),overall_quality:z.number(),time_tag:z.string(),source:z.string(),bz_gsm:z.number().nullable().optional(),proton_speed:z.number().nullable().optional(),proton_density:z.number().nullable().optional()});
const validNumber=(value:number|null|undefined)=>value===undefined||value===null||!Number.isFinite(value)||value===-9999?null:value;
export function parseSolarWind(mag:unknown,plasma:unknown,retrievedAtUtc:string):Wind {
  const rows=new Map<string,{observedAtUtc:string;bzNt:number|null;speedKmS:number|null;densityCm3:number|null}>();
  for(const [type,input] of [['mag',mag],['plasma',plasma]] as const){
    const seen=new Set<string>();
    for(const raw of z.array(upstreamRow).parse(input)){
      if(!raw.active||raw.overall_quality!==0)continue;
      const time=providerUtc(raw.time_tag);
      if(seen.has(time))throw new Error('Ambiguous active NOAA sources');seen.add(time);
      const row=rows.get(time)??{observedAtUtc:time,bzNt:null,speedKmS:null,densityCm3:null};
      if(type==='mag')row.bzNt=validNumber(raw.bz_gsm);
      else{row.speedKmS=validNumber(raw.proton_speed);row.densityCm3=validNumber(raw.proton_density);}
      rows.set(time,row);
    }
  }
  if(!rows.size)throw new Error('No valid active NOAA samples');
  return windSchema.parse({sourceId:'NOAA_RTSW',sourceUrl:'https://services.swpc.noaa.gov/json/rtsw/',retrievedAtUtc,samples:[...rows.values()].sort((a,b)=>a.observedAtUtc.localeCompare(b.observedAtUtc)).slice(-120)});
}
