#!/usr/bin/env node
/**
 * AuroraSense Meta API Test & Multi-Round Coordinator Runner
 * 
 * Verifies your META_MODEL_API_KEY against Meta's Responses endpoint:
 * https://api.meta.ai/v1/responses with model `muse-spark-1.3`.
 *
 * Commands:
 *   npm run test:meta          # Quick smoke test (1 request, checks auth & tool schema)
 *   npm run test:meta -- --loop # Multi-round autonomous scientific coordinator loop
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const META_MODEL = 'muse-spark-1.3';
const META_RESPONSES_URL = 'https://api.meta.ai/v1/responses';
const isLoopMode = process.argv.includes('--loop') || process.argv.includes('-l');

// 1. Locate API key from process environment or .env.local files
let apiKey = process.env.META_MODEL_API_KEY?.trim();

if (!apiKey) {
  const candidatePaths = [
    resolve('apps/web/.env.local'),
    resolve('.env.local'),
    resolve('apps/web/.env'),
  ];
  for (const filePath of candidatePaths) {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf8');
      const match = content.match(/^META_MODEL_API_KEY\s*=\s*(.+)$/m);
      if (match && match[1].trim()) {
        apiKey = match[1].trim().replace(/^["']|["']$/g, '');
        console.log(`[Config] Loaded META_MODEL_API_KEY from ${filePath}`);
        break;
      }
    }
  }
}

if (!apiKey || apiKey === 'your-meta-model-api-key-here') {
  console.error('\n❌ ERROR: META_MODEL_API_KEY is missing or contains placeholder text.');
  console.error('\nTo configure your key:');
  console.error('  1. Open or create `apps/web/.env.local`');
  console.error('  2. Set: META_MODEL_API_KEY=your_actual_key_here');
  console.error('  3. Re-run: npm run test:meta\n');
  process.exit(1);
}

// Mask key for safe console output
const maskedKey = apiKey.length > 10 
  ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`
  : '***';

console.log('\n======================================================');
console.log(`   AuroraSense · Meta Muse Spark 1.3 ${isLoopMode ? 'Coordinator Loop' : 'Smoke Test'} `);
console.log('======================================================');
console.log(`Target URL:  ${META_RESPONSES_URL}`);
console.log(`Model:       ${META_MODEL}`);
console.log(`Key:         ${maskedKey} (${apiKey.length} characters)`);
console.log(`Mode:        ${isLoopMode ? 'Autonomous multi-round loop (max 5 rounds)' : 'Single-request smoke test'}`);
console.log('------------------------------------------------------\n');

// 2. All 7 strict tools defined in AuroraSense contracts
const string = { type: 'string' };
const regionProps = {
  regionCell: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$', maxLength: 100 },
  intervalUtc: { type: 'array', items: { type: 'string', format: 'date-time' }, minItems: 2, maxItems: 2 }
};

const ALL_TOOLS = [
  {
    type: 'function',
    name: 'get_event_context',
    description: 'Read source IDs, as-of time and constraints for this event.',
    strict: true,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }
  },
  {
    type: 'function',
    name: 'get_regional_coverage',
    description: 'Count usable independent sites; synthetic records never count as observed coverage.',
    strict: true,
    parameters: { type: 'object', properties: regionProps, required: Object.keys(regionProps), additionalProperties: false }
  },
  {
    type: 'function',
    name: 'get_reference_magnetometers',
    description: 'Get time-aligned professional reference metadata without private phone locations.',
    strict: true,
    parameters: { type: 'object', properties: regionProps, required: Object.keys(regionProps), additionalProperties: false }
  },
  {
    type: 'function',
    name: 'run_local_qc',
    description: 'Validate acquisition quality, field schema and timing of a sensor session.',
    strict: true,
    parameters: { type: 'object', properties: { sessionId: string }, required: ['sessionId'], additionalProperties: false }
  },
  {
    type: 'function',
    name: 'run_regional_coherence',
    description: 'Run the deterministic regional magnetic validator. Its verdict is authoritative.',
    strict: true,
    parameters: {
      type: 'object',
      properties: { ...regionProps, sourceIds: { type: 'array', items: string, maxItems: 30 } },
      required: [...Object.keys(regionProps), 'sourceIds'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'request_opt_in_session',
    description: 'Create one 10-minute invitation only for an eligible opted-in adult in an authorized cell with an evidence gap; never starts a sensor.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        regionCell: string,
        durationMinutes: { type: 'integer', enum: [10] },
        reason: { type: 'string', minLength: 10, maxLength: 400 }
      },
      required: ['regionCell', 'durationMinutes', 'reason'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'publish_evidence_report',
    description: 'Publish a canonical report bound to the current deterministic assessment; free-form summary remains unpublished.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        assessmentId: string,
        audience: { type: 'string', enum: ['public', 'research'] },
        summary: { type: 'string', maxLength: 1000 }
      },
      required: ['assessmentId', 'audience', 'summary'],
      additionalProperties: false
    }
  }
];

// Dispatch deterministic tool responses matching AuroraSense contracts
function dispatchTool(toolName, args) {
  switch (toolName) {
    case 'get_event_context':
      return {
        id: 'may-2024',
        title: 'May 2024 Gannon Storm — Real Meta AI Tool Run',
        sourceIds: ['NASA_CCMC_CME', 'NOAA_RTSW', 'USGS_BOU_F'],
        asOfUtc: '2024-05-10T22:10:00.000Z',
        mode: 'LIVE_AGENT',
        analysisMode: 'RETROSPECTIVE',
        revision: 1,
        liveUpstreamStatus: 'ARCHIVAL_REPLAY',
        regions: [{
          regionCell: 'colorado-front-range',
          intervalUtc: ['2024-05-10T22:00:00.000Z', '2024-05-10T22:10:00.000Z'],
          sourceIds: ['USGS_BOU_F', 'AURORASENSE_PHONE']
        }]
      };

    case 'get_regional_coverage':
      return {
        independentSites: 0,
        usableSessions: 0,
        syntheticSessions: 1,
        cells: [args.regionCell ?? 'colorado-front-range'],
        sessionIds: ['phone-session-1'],
        uncertainty: 'One phone cannot establish regional coverage. 3 independent sites required.'
      };

    case 'get_reference_magnetometers':
      return {
        stationIds: ['BOU'],
        sourceIds: ['USGS_BOU_F'],
        evidenceIds: ['bou-20240510'],
        status: 'AVAILABLE',
        processedSummary: [{
          id: 'bou-20240510',
          component: 'F',
          frame: 'SCALAR',
          unit: 'nT',
          observedStartUtc: '2024-05-10T22:00:00.000Z',
          observedEndUtc: '2024-05-10T22:10:00.000Z',
          availableAtUtc: '2024-05-10T22:10:00.000Z',
          sourceUrl: 'https://geomag.usgs.gov/'
        }]
      };

    case 'run_local_qc':
      return {
        sessionId: args.sessionId ?? 'phone-session-1',
        accepted: false,
        flags: ['LOCAL_INTERFERENCE'],
        quality: { baselineNoiseNt: 54.2, sampleCount: 1601, kind: 'MEASURED_LIVE' },
        algorithmVersion: 'regional-scalar-v1.0.1',
        scope: 'Flagged abrupt spike; isolated local disturbance cannot confirm regional storm.'
      };

    case 'run_regional_coherence':
      return {
        id: 'assessment-20240510-001',
        verdict: 'INCONCLUSIVE',
        independentSites: 0,
        referenceStations: ['BOU'],
        reasons: [
          'PHONE_QUALITY_FAILURE_OR_LOCAL_INTERFERENCE',
          'INSUFFICIENT_INDEPENDENT_SITES'
        ],
        correlations: [{ phoneId: 'phone-session-1', stationId: 'BOU', correlation: 0.12, alignedSamples: 10 }],
        synthetic: false,
        scope: 'REGIONAL_MAGNETIC_DISTURBANCE',
        limitations: ['No optical aurora claim.', 'Deterministic validator verdict is final.']
      };

    case 'request_opt_in_session':
      return {
        id: 'invitation-20240510-001',
        status: 'INVITED',
        regionCell: args.regionCell ?? 'colorado-front-range',
        durationMinutes: 10,
        reason: args.reason ?? 'Requesting stationary observation to resolve coverage gap.'
      };

    case 'publish_evidence_report':
      return {
        id: 'report-20240510-001',
        status: 'PUBLISHED',
        verdict: 'INCONCLUSIVE',
        audience: args.audience ?? 'research',
        summary: args.summary ?? 'Provisional assessment: evidence remains inconclusive.'
      };

    default:
      return { error: 'UNKNOWN_TOOL', tool: toolName };
  }
}

const instructions = `You are AuroraSense's adult opt-in scientific observation coordinator. Use the seven tools to inspect the event, reference evidence and site coverage. Check QC and deterministic regional coherence before publication. A phone spike is not regional confirmation. If an evidence gap exists, request at most one useful permitted 10-minute session; this invites and never activates a device. Publish only the current assessment. The validator owns SUPPORTED/INCONCLUSIVE/REJECTED; visible aurora is a separate optical claim.`;

async function callMetaResponses(conversationInput) {
  const requestPayload = {
    model: META_MODEL,
    instructions,
    input: conversationInput,
    tools: ALL_TOOLS,
    max_output_tokens: 500,
    parallel_tool_calls: true,
    store: false,
    include: ['reasoning.encrypted_content']
  };

  const response = await fetch(META_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestPayload),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorBody}`);
  }

  return await response.json();
}

// 3. Execution Loop
const maxRounds = isLoopMode ? 5 : 1;
const conversationHistory = [
  {
    role: 'user',
    content: isLoopMode 
      ? 'Inspect this event using get_event_context. Determine missing independent observations, request an eligible opt-in session only when useful, and publish the deterministic evidence conclusion or explain what remains blocked.'
      : 'Hello. Please inspect the current event context using the get_event_context tool.'
  }
];

const journal = [];
let totalInputTokens = 0;
let totalOutputTokens = 0;
let round = 1;

for (round = 1; round <= maxRounds; round++) {
  console.log(`\n▶ Round ${round} / ${maxRounds}: Calling Meta Muse Spark 1.3...`);
  const startTime = Date.now();
  let result;

  try {
    result = await callMetaResponses(conversationHistory);
  } catch (error) {
    console.error(`❌ Request failed: ${error.message}`);
    process.exit(1);
  }

  const durationMs = Date.now() - startTime;
  const inTok = result.usage?.input_tokens ?? 0;
  const outTok = result.usage?.output_tokens ?? 0;
  totalInputTokens += inTok;
  totalOutputTokens += outTok;

  console.log(`  ✓ Responded in ${durationMs}ms | Tokens: +${inTok} in, +${outTok} out | Status: ${result.status}`);

  journal.push({
    round,
    durationMs,
    responseId: result.id,
    model: result.model,
    usage: result.usage,
    output: result.output
  });

  conversationHistory.push(...result.output);

  // Parse outputs
  const functionCalls = (result.output ?? []).filter(item => item.type === 'function_call');
  const messages = (result.output ?? []).filter(item => item.role === 'assistant' || item.content);

  for (const msg of messages) {
    let text = '';
    if (typeof msg.content === 'string') text = msg.content;
    else if (Array.isArray(msg.content)) text = msg.content.map(c => c.text ?? JSON.stringify(c)).join(' ');
    else text = JSON.stringify(msg.content);
    if (text.trim()) console.log(`  💬 Muse Spark: "${text.trim()}"`);
  }

  if (functionCalls.length === 0) {
    console.log('\nModel completed its workflow (no more tool calls).');
    break;
  }

  for (const call of functionCalls) {
    let callArgs = {};
    try { callArgs = JSON.parse(call.arguments); } catch {}
    console.log(`  🔧 Tool Call:  ${call.name}(${JSON.stringify(callArgs)})`);
    
    // Execute tool
    const toolResult = dispatchTool(call.name, callArgs);
    console.log(`     ↳ Result:   ${JSON.stringify(toolResult).slice(0, 110)}...`);

    conversationHistory.push({
      type: 'function_call_output',
      call_id: call.call_id,
      output: JSON.stringify(toolResult)
    });
  }

  // If publish_evidence_report was called, we have completed the assessment
  if (functionCalls.some(c => c.name === 'publish_evidence_report')) {
    console.log('\n  🏁 publish_evidence_report executed. Coordinator workflow completed.');
    break;
  }
}

const totalCost = ((totalInputTokens * 1.25 + totalOutputTokens * 4.25) / 1_000_000).toFixed(6);

console.log('\n======================================================');
console.log('   Execution Summary                                  ');
console.log('======================================================');
console.log(`Total Rounds:   ${round > maxRounds ? maxRounds : round}`);
console.log(`Total Tokens:   ${totalInputTokens} input / ${totalOutputTokens} output`);
console.log(`Total Cost:     $${totalCost} USD`);

// Save audit journal to data/private/ if in loop mode
if (isLoopMode) {
  try {
    mkdirSync(resolve('data/private'), { recursive: true });
    const logPath = resolve('data/private/meta-spark-run.json');
    writeFileSync(logPath, JSON.stringify({
      atUtc: new Date().toISOString(),
      model: META_MODEL,
      totalInputTokens,
      totalOutputTokens,
      totalCostUsd: Number(totalCost),
      journal
    }, null, 2));
    console.log(`Audit Journal:  Saved to data/private/meta-spark-run.json (ignored by git)`);
  } catch (err) {
    console.warn(`Could not save journal: ${err.message}`);
  }
}

console.log('======================================================\n');
