import type { BudgetLedger, RunJournal } from './meta';

// Server-only REST adapter. No service key is read from browser environment or emitted in errors.
// Each budget reservation is an atomic PostgreSQL RPC. Journal entries are append-only.
export function createSupabaseControls(projectUrl:string, serviceKey:string, fetcher:typeof fetch=fetch):{ledger:BudgetLedger;journal:RunJournal} {
  if(typeof window!=='undefined') throw new Error('SERVER_ONLY_SUPABASE_CONTROLS');
  const url=new URL(projectUrl);
  if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.username||url.password||url.pathname!=='/'||url.search||url.hash) throw new Error('MANAGED_SUPABASE_URL_REQUIRED');
  if(serviceKey.length<10) throw new Error('SUPABASE_SERVER_CREDENTIAL_REQUIRED');
  const request=async(path:string,body:unknown)=>{
    const response=await fetcher(`${url.origin}/rest/v1/${path}`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json',...(path.startsWith('rpc/')?{}:{Prefer:'return=minimal'})},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw new Error(`SUPABASE_${response.status}`);
    const text=await response.text();return text?JSON.parse(text) as unknown:null;
  };
  return {
    ledger:{durable:true,reserve:async(id,maximumUsd)=>await request('rpc/reserve_meta_budget',{p_request_id:id,p_maximum_usd:maximumUsd})===true,settle:async(id,actualUsd)=>{await request('rpc/settle_meta_budget',{p_request_id:id,p_actual_usd:actualUsd});}},
    journal:{durable:true,save:async event=>{
      const payload=JSON.stringify(event.data);
      if(payload.length>2_000_000) throw new Error('AUDIT_PAYLOAD_TOO_LARGE');
      const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload));
      const hash=Array.from(new Uint8Array(digest)).map(n=>n.toString(16).padStart(2,'0')).join('');
      await request('agent_run_journal',{request_id:event.requestId,kind:event.kind,model:event.model,payload:event.data,payload_sha256:hash});
    }},
  };
}
