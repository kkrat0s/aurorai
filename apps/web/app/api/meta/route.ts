import { NextResponse } from 'next/server';
import {
  evaluateAuroraAlertDecision,
  evaluateSamOpticalSegmentation,
  evaluateWonderRedTeam,
  MUSE_IMAGE_CONCEPTS,
  META_MODELS,
  runDemoCoordinator,

} from '@aurorasense/coordinator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const metaKey = process.env.META_MODEL_API_KEY;
  const isConfigured = Boolean(metaKey && metaKey.trim().length >= 10);

  return NextResponse.json({
    status: isConfigured ? 'CONFIGURED_UNVERIFIED' : 'LOCAL_ONLY',
    provider: 'Meta AI / Meta Model API',
    apiKeyConfigured: isConfigured,
    executionNote: isConfigured
      ? 'Server credential present; authenticated /api/agent requires verified access, trusted evidence and a durable budget. Presence does not verify a successful model run.'
      : 'No META_MODEL_API_KEY configured; deterministic local evaluators and scripted policy demo active (modelCalled: false).',
    models: {
      sparkCoordinator: {
        modelId: META_MODELS.SPARK,
        role: 'Primary Agentic Scientific Observation Coordinator & Insight Generator',
        toolCalling: 'Meta Model API Responses (Strict Function Calling)',
        status: isConfigured ? 'CONFIGURED_UNVERIFIED' : 'LOCAL_DETERMINISTIC_FALLBACK',
      },
      wonderRedTeam: {
        modelId: META_MODELS.WONDER,
        role: 'Scientific Adversary & Skeptical Invariant Checker',
        status: 'LOCAL_DETERMINISTIC_EVALUATOR',
      },
      museImage: {
        modelId: META_MODELS.IMAGE,
        role: 'Conceptual Educational Illustration & Reconnection Architecture',
        status: 'CONCEPTUAL_SPECIFICATION',
        stagesAvailable: [1, 2, 3, 4, 5],
      },
      samSegmentation: {
        modelId: META_MODELS.SAM,
        role: 'Segment Anything Model (SAM 3.1) Optical Aurora & Cloud Segmentation Schema',
        status: 'CONCEPTUAL_SPECIFICATION_DEMO',
      },
    },
    educationalConcepts: MUSE_IMAGE_CONCEPTS,
  });
}

export async function POST(request: Request) {
  try {
    const reader=request.body?.getReader();
    let raw=''; const decoder=new TextDecoder(); let bytes=0;
    let deadline:ReturnType<typeof setTimeout>|undefined;
    const timedOut=new Promise<never>((_,reject)=>{deadline=setTimeout(()=>reject(new Error('Request body timed out')),4000);});
    if(reader){try{while(true){
      const part=await Promise.race([reader.read(),timedOut]); if(part.done)break;
      bytes+=part.value.byteLength;
      if(bytes>20_000){void reader.cancel();return NextResponse.json({error:'Request too large'},{status:413});}
      raw+=decoder.decode(part.value,{stream:true});
    }raw+=decoder.decode();}finally{if(deadline)clearTimeout(deadline);void reader.cancel().catch(()=>undefined);reader.releaseLock();}}
    else if(deadline)clearTimeout(deadline);
    const body = JSON.parse(raw); if(!body || typeof body!=='object' || Array.isArray(body)) return NextResponse.json({error:'Invalid request'},{status:400});
    const action = body.action;


    switch (action) {
      case 'spark_insight': {
        return NextResponse.json({success:false,code:'AUTHENTICATED_AGENT_REQUIRED',modelCalled:false,error:'Use /api/agent with verified researcher authentication, trusted evidence and durable budget. This public endpoint cannot spend model credits.'},{status:403});
      }

      case 'wonder_red_team': {
        const redTeam = evaluateWonderRedTeam(body.payload);
        return NextResponse.json({ success: true, redTeam });
      }

      case 'aurora_alert': {
        const alert = evaluateAuroraAlertDecision(body.payload);
        return NextResponse.json({ success: true, alert });
      }

      case 'sam_segmentation': {
        const segmentation = evaluateSamOpticalSegmentation(body.payload);
        return NextResponse.json({ success: true, segmentation });
      }

      case 'muse_image': {
        const stage = body.payload?.stage as 1 | 2 | 3 | 4 | 5;
        const concept = MUSE_IMAGE_CONCEPTS[stage] ?? MUSE_IMAGE_CONCEPTS[1];
        return NextResponse.json({ success: true, concept });
      }

      case 'coordinator_loop': {
        const coordinatorResult = runDemoCoordinator();
        return NextResponse.json({ success: true, coordinatorResult });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Meta API processing failed' },
      { status: 400 }
    );
  }
}
