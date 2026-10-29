import { z } from 'zod';
import { id, seriesSchema, type CoordinatorState, type EvidenceSeries, type Volunteer } from './contracts';
import { createCoordinator } from './engine';
import { createMetaTransport, runMetaCoordinator } from './meta';
import { createSupabaseControls } from './supabase';

export type AgentServerConfig={supabaseUrl?:string;publishableKey?:string;secretKey?:string;metaKey?:string};
const inputSchema=z.object({eventId:id}).strict();
const userSchema=z.object({id:z.string().uuid(),app_metadata:z.object({aurorasense_role:z.literal('researcher'),aurorasense_cells:z.array(id).min(1).max(100)}).passthrough()}).passthrough();
const eventSchema=z.object({id,title:z.string().max(500),starts_at:z.string().datetime({offset:true}),ends_at:z.string().datetime({offset:true}),mode:z.enum(['live','historical','synthetic'])}).passthrough();
type JsonRecord=Record<string,unknown>;
function object(value:unknown):JsonRecord {return value&&typeof value==='object'&&!Array.isArray(value)?value as JsonRecord:{};}
function rows(value:unknown):JsonRecord[] {if(!Array.isArray(value)) throw new Error('DATABASE_RESPONSE_INVALID');return value.map(object);}
function json(status:number,code:string,details:unknown={}) {return Response.json({code,...object(details)},{status,headers:{'Cache-Control':'no-store'}});}
class BodyError extends Error {constructor(readonly status:number,readonly code:string){super(code);}}
async function boundedRequestJson(request:Request):Promise<unknown> {
  const declared=request.headers.get('content-length');
  if(declared!==null&&!/^\d+$/.test(declared))throw new BodyError(400,'INVALID_CONTENT_LENGTH');
  if(declared!==null&&Number(declared)>2048)throw new BodyError(413,'REQUEST_TOO_LARGE');
  if(!request.body)throw new BodyError(400,'INVALID_REQUEST');
  const reader=request.body.getReader();let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    const consume=async()=>{
      const chunks:Uint8Array[]=[];let size=0;
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();throw new BodyError(413,'REQUEST_TOO_LARGE');}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as unknown;
    };
    return await Promise.race([consume(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel().catch(()=>undefined);reject(new BodyError(408,'REQUEST_BODY_TIMEOUT'));},5000);})]);
  } finally {if(timer)clearTimeout(timer);reader.releaseLock();}
}
function publicSafe(value:unknown,privateIds:string[]):unknown {
  if(Array.isArray(value))return value.map(v=>publicSafe(v,privateIds));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['latitude','longitude','lat','lon','user_id','userId','actorId','participantId','recipientId'].includes(key)).map(([key,v])=>[key,publicSafe(v,privateIds)]));
  if(typeof value==='string')return privateIds.reduce((text,privateId)=>text.replaceAll(privateId,'[REDACTED]'),value);
  return value;
}

/** Server HTTP boundary: only a stored event ID comes from the browser.
 * Identity/cells come from verified admin-owned app_metadata; evidence comes from server-owned rows.
 */
export function createAgentPostHandler(config:AgentServerConfig, fetcher:typeof fetch=fetch, now:()=>Date=()=>new Date()) {
  return async(request:Request):Promise<Response>=>{
    const missing=(['supabaseUrl','publishableKey','secretKey','metaKey'] as const).filter(name=>!config[name]);
    if(missing.length) return json(503,'AGENT_NOT_CONFIGURED',{missing,mode:'UNAVAILABLE',modelCalled:false});
    let origin:string;
    try {
      const url=new URL(config.supabaseUrl!);
      if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.username||url.password||url.pathname!=='/'||url.search||url.hash) return json(503,'INVALID_SERVER_CONFIGURATION');
      origin=url.origin;
    } catch {return json(503,'INVALID_SERVER_CONFIGURATION');}
    const auth=request.headers.get('authorization');
    if(!auth||!/^Bearer [^\s]+$/.test(auth)||auth.length>8192) return json(401,'AUTHENTICATION_REQUIRED');
    let input:z.infer<typeof inputSchema>;
    try {input=inputSchema.parse(await boundedRequestJson(request));}
    catch(error){return error instanceof BodyError?json(error.status,error.code):json(400,'INVALID_REQUEST');}
    const get=async(path:string,key:string,authorization:string)=>{
      const response=await fetcher(`${origin}${path}`,{headers:{apikey:key,Authorization:authorization},redirect:'error',signal:AbortSignal.timeout(10000)});
      if(!response.ok) throw new Error(`DATABASE_HTTP_${response.status}`);
      return await response.json() as unknown;
    };
    let user:z.infer<typeof userSchema>;
    try {
      // This contacts Supabase Auth; decoding a JWT payload alone is not authentication.
      const response=await fetcher(`${origin}/auth/v1/user`,{headers:{apikey:config.publishableKey!,Authorization:auth},redirect:'error',signal:AbortSignal.timeout(10000)});
      if(!response.ok)return json(401,'INVALID_AUTHENTICATION');
      const parsed=userSchema.safeParse(await response.json());
      if(!parsed.success)return json(403,'RESEARCHER_ROLE_REQUIRED');
      user=parsed.data;
      const consents=rows(await get(`/rest/v1/participant_consents?user_id=eq.${encodeURIComponent(user.id)}&select=adult_confirmed,consent_version`,config.publishableKey!,auth));
      if(consents.length!==1||consents[0].adult_confirmed!==true||consents[0].consent_version!=='aurorasense-v1')return json(403,'ADULT_CONSENT_REQUIRED');
    } catch{return json(503,'AUTHORIZATION_SERVICE_UNAVAILABLE');}
    const cellQuery=encodeURIComponent(`in.(${user.app_metadata.aurorasense_cells.join(',')})`);
    const eventQuery=encodeURIComponent(input.eventId);
    const serviceAuth=`Bearer ${config.secretKey!}`;
    let modelAttempted=false;
    try {
      const [events,phoneRows,referenceRows,volunteerRows,invitationRows]=await Promise.all([
        get(`/rest/v1/events?id=eq.${eventQuery}&select=id,title,starts_at,ends_at,mode`,config.secretKey!,serviceAuth),
        get(`/rest/v1/sensor_qc?event_id=eq.${eventQuery}&region_cell=${cellQuery}&select=session_id,event_id,region_cell,accepted,algorithm_version,regional_summary&limit=31`,config.secretKey!,serviceAuth),
        get(`/rest/v1/reference_series?event_id=eq.${eventQuery}&region_cell=${cellQuery}&select=id,event_id,region_cell,source_record_id,source_records!inner(id,source_id,kind,source_url,checksum),regional_summary&limit=31`,config.secretKey!,serviceAuth),
        get(`/rest/v1/participant_consents?coarse_cell=${cellQuery}&adult_confirmed=eq.true&invitation_opt_in=eq.true&select=user_id,coarse_cell,adult_confirmed,invitation_opt_in&limit=101`,config.secretKey!,serviceAuth),
        get(`/rest/v1/campaign_invitations?created_at=gte.${encodeURIComponent(new Date(now().getTime()-86400000).toISOString())}&select=user_id,status,created_at&limit=1001`,config.secretKey!,serviceAuth),
      ]);
      const eventList=rows(events);
      if(eventList.length!==1)return json(404,'EVENT_NOT_FOUND');
      const event=eventSchema.safeParse(eventList[0]);
      if(!event.success)return json(409,'NEEDS_INGESTION',{reason:'Stored event does not meet the canonical schema.'});
      if(event.data.mode==='synthetic')return json(409,'SYNTHETIC_EVENT_REQUIRES_EXPLICIT_DEMO_PATH');
      const phones=rows(phoneRows),references=rows(referenceRows),volunteers=rows(volunteerRows),invitations=rows(invitationRows);
      if(phones.length>30||references.length>30||volunteers.length>100||invitations.length>1000)return json(409,'INPUT_SUMMARY_LIMIT_EXCEEDED');
      const evidence:EvidenceSeries[]=[];
      for(const [records,instrument] of [[phones,'PHONE'],[references,'OBSERVATORY']] as const) {
        for(const row of records) {
          if(row.regional_summary===null||row.regional_summary===undefined)continue;
          const parsed=seriesSchema.safeParse(row.regional_summary);
          if(!parsed.success||parsed.data.kind==='SYNTHETIC'||parsed.data.instrument!==instrument||parsed.data.eventId!==input.eventId||parsed.data.regionCell!==row.region_cell||!user.app_metadata.aurorasense_cells.includes(parsed.data.regionCell))return json(409,'NEEDS_INGESTION',{reason:'An evidence summary failed provenance, scope or numerical schema validation.'});
          if(instrument==='PHONE'&&(parsed.data.id!==row.session_id||parsed.data.sourceId!=='AURORASENSE_PHONE'||parsed.data.qc.accepted!==row.accepted||parsed.data.qc.algorithmVersion!==row.algorithm_version))return json(409,'NEEDS_INGESTION',{reason:'Phone summary does not match server-owned acquisition QC.'});
          if(instrument==='OBSERVATORY') {
            const source=object(row.source_records);
            if(parsed.data.id!==row.id||row.source_record_id!==source.id||parsed.data.sourceId!==source.source_id||parsed.data.kind!==source.kind||parsed.data.sourceUrl!==source.source_url||typeof source.checksum!=='string'||!/^[0-9a-f]{64}$/.test(source.checksum))return json(409,'NEEDS_INGESTION',{reason:'Reference summary does not match its immutable source record and checksum.'});
          }
          evidence.push(parsed.data);
        }
      }
      if(!evidence.length)return json(409,'NEEDS_INGESTION',{reason:'No trusted per-event minute scalar summaries exist. Raw browser evidence and demo fixtures are not used.',modelCalled:false});
      if(new Set(evidence.map(s=>s.id)).size!==evidence.length)return json(409,'NEEDS_INGESTION',{reason:'Duplicate evidence identifiers.'});
      const participants:Volunteer[]=volunteers.map(v=>{
        const recent=invitations.filter(i=>i.user_id===v.user_id).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))).at(-1);
        return {id:String(v.user_id),regionCell:String(v.coarse_cell),adultConfirmed:v.adult_confirmed===true,optedIn:v.invitation_opt_in===true,declined:recent?.status==='DECLINED',lastInvitedAtUtc:recent?String(recent.created_at):null,simulated:false};
      });
      const state:CoordinatorState={event:{id:event.data.id,title:event.data.title,sourceIds:[...new Set(evidence.map(s=>s.sourceId))],constraints:['Only trusted server-owned derived evidence is loaded.','No optical confirmation is inferred from magnetic evidence.','Real invitations are blocked until participant delivery/acceptance integration is configured.']},series:evidence,volunteers:participants,campaigns:[],assessments:[],reports:[],audit:[],revision:1};
      const runId=globalThis.crypto.randomUUID();
      const coordinator=createCoordinator(state,{actorId:user.id,role:'researcher',adultConfirmed:true,eventId:event.data.id,asOfUtc:now().toISOString(),runId,mode:'LIVE_AGENT',analysisMode:event.data.mode==='historical'?'RETROSPECTIVE':'OPERATIONAL',permittedCells:user.app_metadata.aurorasense_cells});
      const controls=createSupabaseControls(config.supabaseUrl!,config.secretKey!,fetcher);
      const transport=createMetaTransport(config.metaKey!,fetcher);
      const result=await runMetaCoordinator({coordinator,transport:async value=>{modelAttempted=true;return transport(value);},...controls,runId});
      // Never return participant identities, private coordinates or the complete private journal.
      return json(result.status==='FAILED'?502:200,'AGENT_RUN_RESULT',publicSafe({runId,mode:result.mode,model:result.model,status:result.status,errorCode:result.errorCode,usage:result.usage,reports:result.state.reports,campaigns:result.state.campaigns,timeline:result.state.audit},[user.id,...participants.map(v=>v.id)]));
    } catch{return json(modelAttempted?502:409,modelAttempted?'AGENT_SERVICE_FAILURE':'NEEDS_INGESTION',{reason:modelAttempted?'The model or private persistence service failed.':'Authorized event storage, migrations, or derived evidence are unavailable.',modelCalled:modelAttempted});}
  };
}
