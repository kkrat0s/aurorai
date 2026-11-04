import { createHash } from 'node:crypto';
import { NOAA_URLS,parseOvation,parseSolarWind,parseKp } from './noaa';
import type { Ovation,Wind,Kp } from './catalog';
export type NoaaSnapshot={latestNoaa:{ovation:Ovation|null;solarWind:Wind|null;kp:Kp|null};retrievedAtUtc:string;manifests:Record<string,unknown>[];errors:string[]};
/** Cap raw bytes while streaming, before JSON allocation. NOAA plasma exceeds Next's 2 MB cache limit. */
export async function boundedNoaaText(response:Response,limit=5_000_000):Promise<string>{
  const advertised=Number(response.headers.get('content-length'));
  if(advertised>limit){await response.body?.cancel();throw new Error('Response exceeds size limit');}
  if(!response.body)throw new Error('Empty NOAA response');
  const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let size=0,raw='';
  try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>limit){await reader.cancel();throw new Error('Response exceeds size limit');}raw+=decoder.decode(next.value,{stream:true});}return raw+decoder.decode();}
  finally{reader.releaseLock();}
}
/** Instance-local, bounded cache and in-flight deduplication; retrieval times never change on a cache hit. */
export function createNoaaLoader(fetcher:typeof fetch=fetch,clock:()=>number=Date.now,cacheMs=120_000){
  let cached:{at:number;value:NoaaSnapshot}|null=null;
  let pending:Promise<NoaaSnapshot>|null=null;
  async function acquire():Promise<NoaaSnapshot>{
    const entries=Object.entries(NOAA_URLS);
    const acquired=new Map<string,{body:unknown;retrievedAtUtc:string}>();
    const errors:string[]=[],manifests:Record<string,unknown>[]=[];
    const results=await Promise.allSettled(entries.map(async([sourceId,url])=>{
      const response=await fetcher(url,{signal:AbortSignal.timeout(12_000),cache:'no-store',redirect:'error',headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error(`${sourceId}: upstream HTTP ${response.status}`);
      const raw=await boundedNoaaText(response),retrievedAtUtc=new Date(clock()).toISOString();
      return {sourceId,body:JSON.parse(raw) as unknown,retrievedAtUtc,manifest:{sourceId,sourceUrl:url,retrievedAtUtc,sha256:createHash('sha256').update(raw).digest('hex')}};
    }));
    results.forEach((r,i)=>{if(r.status==='fulfilled'){acquired.set(r.value.sourceId,r.value);manifests.push(r.value.manifest);}else errors.push(`${entries[i][0]} acquisition failed (${r.reason instanceof Error?r.reason.message:'unavailable'}).`);});
    let ovation:Ovation|null=null,solarWind:Wind|null=null,kp:Kp|null=null;
    const oval=acquired.get('ovation');
    try{if(oval)ovation=parseOvation(oval.body,oval.retrievedAtUtc);}catch{errors.push('OVATION schema validation failed.');}
    // Validate IMF/plasma separately so one malformed feed cannot hide the other genuine measurement.
    const windParts:Wind[]=[];
    for(const id of ['mag','wind'] as const){const raw=acquired.get(id);if(!raw)continue;try{windParts.push(parseSolarWind(id==='mag'?raw.body:[],id==='wind'?raw.body:[],raw.retrievedAtUtc));}catch{errors.push(`${id} schema validation failed.`);}}
    if(windParts.length){
      const samples=new Map<string,Wind['samples'][number]>();
      for(const part of windParts)for(const sample of part.samples){const previous=samples.get(sample.observedAtUtc);samples.set(sample.observedAtUtc,{observedAtUtc:sample.observedAtUtc,bzNt:sample.bzNt??previous?.bzNt??null,speedKmS:sample.speedKmS??previous?.speedKmS??null,densityCm3:sample.densityCm3??previous?.densityCm3??null});}
      solarWind={...windParts[0],quality:{duplicateRowsCollapsed:windParts.reduce((n,p)=>n+(p.quality?.duplicateRowsCollapsed??0),0),ambiguousMinutes:windParts.reduce((n,p)=>n+(p.quality?.ambiguousMinutes??0),0)},retrievedAtUtc:windParts.map(p=>p.retrievedAtUtc).sort().at(-1)!,samples:[...samples.values()].sort((a,b)=>a.observedAtUtc.localeCompare(b.observedAtUtc)).slice(-120)};
    }
    if(solarWind?.quality?.ambiguousMinutes)errors.push(`${solarWind.quality.ambiguousMinutes} ambiguous IMF/plasma minutes excluded across the provider window.`);
    const k=acquired.get('kp');try{if(k)kp=parseKp(k.body,k.retrievedAtUtc);}catch{errors.push('Kp schema validation failed.');}
    return {latestNoaa:{ovation,solarWind,kp},retrievedAtUtc:new Date(clock()).toISOString(),manifests,errors};
  }
  return async():Promise<NoaaSnapshot>=>{
    if(cached&&clock()-cached.at>=0&&clock()-cached.at<cacheMs)return cached.value;
    if(pending)return pending;
    pending=acquire();
    try{const value=await pending;if(value.latestNoaa.ovation||value.latestNoaa.solarWind||value.latestNoaa.kp)cached={at:clock(),value};return value;}
    finally{pending=null;}
  };
}
