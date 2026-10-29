import { describe,expect,it } from 'vitest';
import { createSupabaseControls } from './supabase';
import { META_MODEL } from './meta';

describe('Managed persistence adapter (mock HTTP, not hosted RLS)',()=>{
  it('rejects arbitrary hosts and missing server credentials',()=>{
    expect(()=>createSupabaseControls('http://localhost:54321','server-secret')).toThrow('MANAGED_SUPABASE_URL_REQUIRED');
    expect(()=>createSupabaseControls('https://example.com','server-secret')).toThrow('MANAGED_SUPABASE_URL_REQUIRED');
    expect(()=>createSupabaseControls('https://example.supabase.co','')).toThrow('SUPABASE_SERVER_CREDENTIAL_REQUIRED');
  });
  it('uses an atomic budget RPC and append-only hashed journal',async()=>{
    const calls:{url:string;init:RequestInit}[]=[];
    const fetcher=(async (url,init)=>{
      calls.push({url:String(url),init:init!});
      return new Response(String(url).includes('reserve_meta_budget')?'true':'',{status:200});
    }) as typeof fetch;
    const controls=createSupabaseControls('https://example.supabase.co','server-secret',fetcher);
    expect(await controls.ledger.reserve('run-1',0.02)).toBe(true);
    await controls.ledger.settle('run-1',0.01);
    await controls.journal.save({kind:'after_model',requestId:'run-1',model:META_MODEL,data:{responseId:'model-response',status:'completed'}});
    expect(calls[0].url).toBe('https://example.supabase.co/rest/v1/rpc/reserve_meta_budget');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({p_request_id:'run-1',p_maximum_usd:0.02});
    expect(JSON.parse(String(calls[2].init.body))).toMatchObject({payload_sha256:expect.stringMatching(/^[0-9a-f]{64}$/)});
    expect(calls.every(c=>c.init.method==='POST'&&!c.url.includes('server-secret'))).toBe(true);
  });
  it('does not expose response bodies or credentials on a database failure',async()=>{
    const fetcher=(async()=>new Response('sensitive failure detail',{status:401})) as typeof fetch;
    const controls=createSupabaseControls('https://example.supabase.co','server-secret',fetcher);
    await expect(controls.ledger.reserve('run-1',0.02)).rejects.toThrow('SUPABASE_401');
  });
});
