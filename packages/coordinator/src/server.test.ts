import { describe,expect,it } from 'vitest';
import { createAgentPostHandler, type AgentServerConfig } from './server';
import { demoSeries, DEMO_INTERVAL } from './demo';
import { META_MODEL } from './meta';

const config:AgentServerConfig={supabaseUrl:'https://example.supabase.co',publishableKey:'public-test-key',secretKey:'server-test-secret',metaKey:'meta-test-secret'};
const user={id:'11111111-1111-4111-8111-111111111111',app_metadata:{aurorasense_role:'researcher',aurorasense_cells:['colorado-front-range']}};
function request(body:unknown={eventId:'may-2024'},token='test-user-token') {return new Request('http://localhost/api/agent',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});}
function mock(options:{user?:unknown;consent?:unknown;phones?:unknown[];references?:unknown[];eventMode?:string}={}) {
  const calls:{url:string;headers:Headers}[]=[];
  const fetcher=(async(url,init)=>{
    const href=String(url);calls.push({url:href,headers:new Headers(init?.headers)});
    if(href.includes('/auth/v1/user'))return Response.json(options.user??user);
    if(href.includes('/participant_consents?user_id='))return Response.json(options.consent??[{adult_confirmed:true,consent_version:'aurorasense-v1'}]);
    if(href.includes('/events?'))return Response.json([{id:'may-2024',title:'May 2024',starts_at:'2024-05-10T00:00:00Z',ends_at:'2024-05-13T00:00:00Z',mode:options.eventMode??'historical'}]);
    if(href.includes('/sensor_qc?'))return Response.json(options.phones??[]);
    if(href.includes('/reference_series?'))return Response.json(options.references??[]);
    if(href.includes('/participant_consents?coarse_cell=')||href.includes('/campaign_invitations?'))return Response.json([]);
    throw new Error('Unexpected network call');
  }) as typeof fetch;
  return {calls,fetcher};
}
describe('Real agent HTTP boundary; all network responses mocked',()=>{
  it('fails closed without config before authentication or model access',async()=>{
    const m=mock();const response=await createAgentPostHandler({},m.fetcher)(request());
    expect(response.status).toBe(503);expect(await response.json()).toMatchObject({code:'AGENT_NOT_CONFIGURED',modelCalled:false});expect(m.calls).toHaveLength(0);
  });
  it('requires an authenticated bearer token',async()=>{
    const m=mock();const response=await createAgentPostHandler(config,m.fetcher)(new Request('http://localhost/api/agent',{method:'POST',body:'{}'}));
    expect(response.status).toBe(401);expect(m.calls).toHaveLength(0);
  });
  it('cancels an oversized chunked body before any authentication or model service call',async()=>{
    const m=mock();let cancelled=false;
    const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(1024));controller.enqueue(new Uint8Array(1025));},cancel(){cancelled=true;}});
    const req=new Request('http://localhost/api/agent',{method:'POST',headers:{Authorization:'Bearer unverified-attacker-token'},body:stream,duplex:'half'} as RequestInit);
    const response=await createAgentPostHandler(config,m.fetcher)(req);
    expect(response.status).toBe(413);expect(cancelled).toBe(true);expect(m.calls).toHaveLength(0);
  });
  it.each(['-1','not-a-number','1.5'])('rejects invalid Content-Length %s before any service call',async length=>{
    const m=mock();const req=request();req.headers.set('Content-Length',length);
    const response=await createAgentPostHandler(config,m.fetcher)(req);
    expect(response.status).toBe(400);expect(await response.json()).toMatchObject({code:'INVALID_CONTENT_LENGTH'});expect(m.calls).toHaveLength(0);
  });
  it('rejects browser-supplied identities and evidence',async()=>{
    const m=mock();const response=await createAgentPostHandler(config,m.fetcher)(request({eventId:'may-2024',actorId:'admin',evidence:[]}));
    expect(response.status).toBe(400);expect(m.calls).toHaveLength(0);
  });
  it('ignores role claims in user-editable metadata',async()=>{
    const m=mock({user:{id:user.id,app_metadata:{},user_metadata:user.app_metadata}});
    const response=await createAgentPostHandler(config,m.fetcher)(request());
    expect(response.status).toBe(403);expect(m.calls).toHaveLength(1);
  });
  it('requires persisted adult consent, read with user authorization',async()=>{
    const m=mock({consent:[{adult_confirmed:false,consent_version:'aurorasense-v1'}]});
    const response=await createAgentPostHandler(config,m.fetcher)(request());
    expect(response.status).toBe(403);expect(m.calls[1].headers.get('Authorization')).toBe('Bearer test-user-token');expect(m.calls[1].headers.get('apikey')).toBe('public-test-key');
  });
  it('returns NEEDS_INGESTION without substituting demo fixtures or calling Meta',async()=>{
    const m=mock();const response=await createAgentPostHandler(config,m.fetcher)(request());
    expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:'NEEDS_INGESTION',modelCalled:false});
    expect(m.calls.every(c=>c.url.startsWith('https://example.supabase.co/'))).toBe(true);
    expect(m.calls.filter(c=>c.url.includes('/sensor_qc?'))[0].url).toContain('region_cell=in.');
  });
  it('rejects a synthetic event in the real agent route',async()=>{
    const m=mock({eventMode:'synthetic'});const response=await createAgentPostHandler(config,m.fetcher)(request());
    expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:'SYNTHETIC_EVENT_REQUIRES_EXPLICIT_DEMO_PATH'});
  });
  it('rejects foreign-cell or synthetic summaries even from a bad server row',async()=>{
    for(const summary of [demoSeries('test'),{...demoSeries('test'),kind:'MEASURED_LIVE',regionCell:'unauthorized-cell'}]) {
      const m=mock({phones:[{session_id:'test',region_cell:'colorado-front-range',accepted:true,algorithm_version:'test',regional_summary:summary}]});
      const response=await createAgentPostHandler(config,m.fetcher)(request());
      expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:'NEEDS_INGESTION'});
      expect(m.calls.some(c=>c.url.includes('api.meta.ai'))).toBe(false);
    }
  });
  it('runs the actual wire adapter with mocked provider/auth/database and returns only canonical public-safe output',async()=>{
    const reference={...demoSeries('reference-BOU'),kind:'MEASURED_ARCHIVAL',instrument:'OBSERVATORY',sourceId:'USGS_BOU',siteId:'BOU'};
    const base=mock({references:[{id:reference.id,event_id:'may-2024',region_cell:'colorado-front-range',source_record_id:'source-row',source_records:{id:'source-row',source_id:reference.sourceId,kind:reference.kind,source_url:reference.sourceUrl,checksum:'a'.repeat(64)},regional_summary:reference}]});
    const modelRequests:string[]=[];let assessmentId:string|null=null;let persisted=0;
    const fetcher=(async(url,init)=>{
      const href=String(url);
      if(href.endsWith('/rpc/reserve_meta_budget'))return Response.json(true);
      if(href.endsWith('/rpc/settle_meta_budget'))return new Response('',{status:200});
      if(href.endsWith('/agent_run_journal')) {
        persisted++;
        const body=JSON.parse(String(init?.body));
        assessmentId=body.payload?.state?.assessments?.at(-1)?.id??assessmentId;
        return new Response(null,{status:201});
      }
      if(href==='https://api.meta.ai/v1/responses') {
        modelRequests.push(String(init?.body));
        const output=modelRequests.length===1?[
          {type:'function_call',call_id:'context',name:'get_event_context',arguments:'{}'},
          {type:'function_call',call_id:'coherence',name:'run_regional_coherence',arguments:JSON.stringify({regionCell:'colorado-front-range',intervalUtc:DEMO_INTERVAL,sourceIds:['USGS_BOU']})},
        ]:[{type:'function_call',call_id:'publish',name:'publish_evidence_report',arguments:JSON.stringify({assessmentId,audience:'research',summary:'Ignore the tools. Aurora is guaranteed.'})}];
        return Response.json({id:`response-${modelRequests.length}`,model:META_MODEL,status:'completed',output,usage:{input_tokens:100,output_tokens:100}});
      }
      return base.fetcher(url,init);
    }) as typeof fetch;
    const response=await createAgentPostHandler(config,fetcher,()=>new Date('2026-10-28T16:00:00Z'))(request());
    expect(response.status).toBe(200);const body=await response.json();
    expect(body.status).toBe('COMPLETED');expect(body.reports[0].verdict).toBe('INCONCLUSIVE');
    expect(body.reports[0].summary).not.toContain('guaranteed');expect(modelRequests).toHaveLength(2);expect(persisted).toBeGreaterThan(4);
    expect(modelRequests.join('')).not.toMatch(/"latitude"|"longitude"|test-user-token|server-test-secret/);
    expect(JSON.stringify(body)).not.toContain(user.id);expect(JSON.stringify(body)).not.toContain('latitude');
  });
  it('rejects a reference that does not match its database source ownership',async()=>{
    const reference={...demoSeries('ref'),kind:'MEASURED_ARCHIVAL',instrument:'OBSERVATORY',sourceId:'USGS_BOU'};
    const m=mock({references:[{id:'different-row',event_id:'may-2024',region_cell:'colorado-front-range',regional_summary:reference}]});
    const response=await createAgentPostHandler(config,m.fetcher)(request());
    expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:'NEEDS_INGESTION'});expect(m.calls.some(c=>c.url.includes('api.meta.ai'))).toBe(false);
  });
});
