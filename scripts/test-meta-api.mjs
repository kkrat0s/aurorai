#!/usr/bin/env node
/** One bounded, explicitly invoked connectivity smoke test. Not a scientific coordinator run. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args=new Set(process.argv.slice(2));
if(args.has('--help')){
  console.log('npm run test:meta -- --dry-run  (configuration check; no network)\nnpm run test:meta               (one real Muse Spark request; incurs provider usage)\nFor a real scientific workflow, use the authenticated /api/agent route with durable budget, audit, role and consent checks.');
  process.exit(0);
}
if(args.has('--loop')||args.has('-l')){
  console.error('Standalone fabricated-tool loop removed. Use authenticated POST /api/agent for the actual seven-tool coordinator with persisted audit, consent and budget enforcement. No model request was made.');
  process.exit(1);
}
if([...args].some(arg=>arg!=='--dry-run')){console.error('Unknown flag. Run with --help. No request made.');process.exit(1);}
let apiKey=process.env.META_MODEL_API_KEY?.trim();
if(!apiKey)for(const path of ['apps/web/.env.local','.env.local','apps/web/.env']){
  const file=resolve(path);if(!existsSync(file))continue;
  const match=readFileSync(file,'utf8').match(/^META_MODEL_API_KEY\s*=\s*(.+)$/m);
  if(match?.[1]?.trim()){apiKey=match[1].trim().replace(/^["']|["']$/g,'');break;}
}
const configured=Boolean(apiKey&&apiKey.length>=10&&apiKey!=='your-meta-model-api-key-here');
if(args.has('--dry-run')){
  console.log(JSON.stringify({mode:'CONFIGURATION_CHECK_ONLY',credentialConfigured:configured,networkRequests:0,scientificValidation:false}));process.exit(configured?0:1);
}
if(!configured){console.error('META_MODEL_API_KEY is missing. Configure it privately in apps/web/.env.local. No request made.');process.exit(1);}
const model='muse-spark-1.3';
try{
  console.log('CONNECTIVITY_SMOKE_ONLY: one model request; no scientific evidence, tools, invitations or publication.');
  const response=await fetch('https://api.meta.ai/v1/responses',{
    method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({model,instructions:'This is a connectivity test only. Reply with READY. Do not infer scientific observations.',input:'Reply READY.',max_output_tokens:128,store:false}),
    redirect:'error',signal:AbortSignal.timeout(25000),
  });
  if(!response.ok)throw new Error(`META_HTTP_${response.status}`);
  const text=await response.text();if(text.length>200000)throw new Error('META_RESPONSE_TOO_LARGE');
  const result=JSON.parse(text);
  if(result.model!==model||result.status!=='completed'||!Array.isArray(result.output))throw new Error('META_RESPONSE_INVALID_OR_INCOMPLETE');
  const ready=result.output.flatMap(item=>Array.isArray(item.content)?item.content:[]).some(item=>typeof item.text==='string'&&/\bREADY\b/.test(item.text));
  if(!ready)throw new Error('META_SMOKE_REPLY_MISSING');
  console.log(JSON.stringify({mode:'CONNECTIVITY_SMOKE_ONLY',model,status:result.status,modelCalled:true,scientificValidation:false,inputTokens:result.usage?.input_tokens??null,outputTokens:result.usage?.output_tokens??null}));
}catch(error){
  // Do not print provider bodies, prompts, token values or credential fragments.
  const code=error instanceof Error&&/^META_[A-Z_0-9]+$/.test(error.message)?error.message:'META_CONNECTIVITY_FAILURE';
  console.error(code);process.exitCode=1;
}
