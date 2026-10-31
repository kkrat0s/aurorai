import { NextResponse } from 'next/server';
import {
  evaluateAuroraAlertDecision,
  evaluateSamOpticalSegmentation,
  evaluateSparkMeasurementInsight,
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
    status: 'ACTIVE',
    provider: 'Meta AI / Meta Model API',
    apiKeyConfigured: isConfigured,
    models: {
      sparkCoordinator: {
        modelId: META_MODELS.SPARK,
        role: 'Primary Agentic Scientific Observation Coordinator & Insight Generator',
        toolCalling: 'Meta Model API Responses (Strict Function Calling)',
        status: 'OPERATIONAL',
      },
      wonderRedTeam: {
        modelId: META_MODELS.WONDER,
        role: 'Scientific Adversary & Skeptical Invariant Checker',
        status: 'OPERATIONAL',
      },
      museImage: {
        modelId: META_MODELS.IMAGE,
        role: 'Conceptual Educational Illustration & Reconnection Architecture',
        status: 'OPERATIONAL',
        stagesAvailable: [1, 2, 3, 4, 5],
      },
      samSegmentation: {
        modelId: META_MODELS.SAM,
        role: 'Segment Anything Model (SAM 3.1) Optical Aurora & Cloud Segmentation',
        status: 'OPERATIONAL',
      },
    },
    educationalConcepts: MUSE_IMAGE_CONCEPTS,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action;
    const metaKey = process.env.META_MODEL_API_KEY;

    switch (action) {
      case 'spark_insight': {
        const insight = evaluateSparkMeasurementInsight(body.payload, metaKey);
        return NextResponse.json({ success: true, insight });
      }

      case 'wonder_red_team': {
        const redTeam = evaluateWonderRedTeam(body.payload, metaKey);
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
      { status: 500 }
    );
  }
}
