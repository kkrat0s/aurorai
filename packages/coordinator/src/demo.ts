import { type Assessment, type Campaign, type CoordinatorState, type EvidenceReport, type EvidenceSeries, type ToolContext } from './contracts';
import { createCoordinator } from './engine';

export const DEMO_INTERVAL: [string,string]=['2024-05-10T22:00:00.000Z','2024-05-10T22:10:00.000Z'];
export const DEMO_CONTEXT: ToolContext={actorId:'demo-researcher',role:'researcher',eventId:'may-2024',asOfUtc:'2024-05-10T22:10:00.000Z',runId:'demo-seed-20241028',mode:'SCRIPTED_DEMO',analysisMode:'RETROSPECTIVE',permittedCells:['colorado-front-range'],adultConfirmed:true};

export function demoSeries(id: string, contaminated=false): EvidenceSeries {
  return {
    id,sourceId:'SYNTHETIC_WORKFLOW_FIXTURE',eventId:'may-2024',regionCell:'colorado-front-range',
    sourceUrl:'https://example.invalid/aurorasense-synthetic-workflow-fixture',kind:'SYNTHETIC',instrument:'PHONE',
    siteId:id,environmentalGroup:id,latitude:40,longitude:-105,
    observedStartUtc:DEMO_INTERVAL[0],observedEndUtc:DEMO_INTERVAL[1],availableAtUtc:DEMO_INTERVAL[1],
    unit:'nT',component:'F',frame:'SCALAR',processing:'scalar-baseline-v1',baselineNoiseNt:50,
    qc:{accepted:!contaminated,flags:contaminated?['LOCAL_INTERFERENCE']:[],algorithmVersion:'synthetic-fixture-qc-v1'},
    samples:Array.from({length:11},(_,i)=>({atUtc:new Date(Date.parse(DEMO_INTERVAL[0])+i*60000).toISOString(),deltaNt:contaminated&&i===5?5000:0})),
  };
}

export function createDemoState(): CoordinatorState {
  return {
    event:{id:'may-2024',title:'May 2024 — synthetic observation-workflow replay',sourceIds:['SYNTHETIC_WORKFLOW_FIXTURE'],constraints:['No physical phone was recorded by this replay.','No model API call is made.','No observed regional signal or optical sighting is asserted.','Test noise is not an empirical device-noise profile.']},
    series:[demoSeries('synthetic-local-spike',true)],
    volunteers:[{id:'synthetic-adult-observer',regionCell:'colorado-front-range',adultConfirmed:true,optedIn:true,declined:false,lastInvitedAtUtc:null,simulated:true}],
    campaigns:[],assessments:[],reports:[],audit:[],revision:1,
  };
}

export function runDemoCoordinator() {
  const coordinator=createCoordinator(createDemoState(),DEMO_CONTEXT);
  const region={regionCell:'colorado-front-range',intervalUtc:DEMO_INTERVAL};
  coordinator.execute('get_event_context',{},'call-1');
  coordinator.execute('get_regional_coverage',region,'call-2');
  coordinator.execute('get_reference_magnetometers',region,'call-3');
  coordinator.execute('run_local_qc',{sessionId:'synthetic-local-spike'},'call-4');
  coordinator.execute('run_regional_coherence',{...region,sourceIds:['SYNTHETIC_WORKFLOW_FIXTURE']},'call-5');
  const campaign=coordinator.execute('request_opt_in_session',{regionCell:region.regionCell,durationMinutes:10,reason:'One contaminated site cannot establish regional coherence; another independent stationary observation would help.'},'call-6') as Campaign;
  if(campaign.status==='INVITED') coordinator.acceptSessionFromIngest(demoSeries('synthetic-volunteer-response'));
  coordinator.execute('run_local_qc',{sessionId:'synthetic-volunteer-response'},'call-7');
  const assessment=coordinator.execute('run_regional_coherence',{...region,sourceIds:['SYNTHETIC_WORKFLOW_FIXTURE']},'call-8') as Assessment;
  const report=coordinator.execute('publish_evidence_report',{assessmentId:assessment.id,audience:'research',summary:'Workflow demonstration: evidence remains inconclusive.'},'call-9') as EvidenceReport;
  return {mode:'SCRIPTED_DEMO' as const,model:null,verdict:assessment.verdict,reasons:assessment.reasons,independentSites:assessment.independentSites,timeline:coordinator.snapshot().audit,campaign,report,assessment};
}
export type DemoCoordinatorResult=ReturnType<typeof runDemoCoordinator>;
