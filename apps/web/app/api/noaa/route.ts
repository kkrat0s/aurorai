import { createHash } from 'node:crypto';
import { NOAA_URLS,parseOvation,parseSolarWind } from '../../../lib/noaa';
export const runtime='nodejs';
export async function GET(){
  const retrievedAtUtc=new Date().toISOString();
  const entries=Object.entries(NOAA_URLS);
  const results=await Promise.allSettled(entries.map(async([sourceId,url])=>{
    const isLarge = sourceId === 'wind';
    const response=await fetch(url,{
      signal:AbortSignal.timeout(12_000),
      ...(isLarge ? { cache: 'no-store' } : { next: { revalidate: 300 } }),
      headers:{Accept:'application/json'}
    });
    if(!response.ok)throw new Error(`${sourceId}: upstream HTTP ${response.status}`);
    const raw=await response.text();
    if(raw.length>5_000_000)throw new Error(`${sourceId}: response exceeds limit`);
    return {sourceId,body:JSON.parse(raw),manifest:{sourceId,sourceUrl:url,retrievedAtUtc,sha256:createHash('sha256').update(raw).digest('hex')}};
  }));
  const errors:string[]=[];
  const acquired=new Map<string,unknown>();
  const manifests:Record<string,unknown>[]=[];
  results.forEach(result=>{if(result.status==='fulfilled'){acquired.set(result.value.sourceId,result.value.body);manifests.push(result.value.manifest);}else errors.push(result.reason instanceof Error?result.reason.message:'NOAA unavailable');});
  let ovation=null,solarWind=null;
  try{if(acquired.has('ovation'))ovation=parseOvation(acquired.get('ovation'),retrievedAtUtc);}catch{errors.push('OVATION schema validation failed');}
  try{if(acquired.has('mag')&&acquired.has('wind'))solarWind=parseSolarWind(acquired.get('mag'),acquired.get('wind'),retrievedAtUtc);}catch{errors.push('Solar-wind schema validation failed');}
  if(!ovation&&!solarWind)return Response.json({error:'NOAA unavailable or invalid',errors},{status:503});
  return Response.json({latestNoaa:{ovation,solarWind},retrievedAtUtc,manifests,errors},{headers:{'Cache-Control':'public, s-maxage=300'}});
}
