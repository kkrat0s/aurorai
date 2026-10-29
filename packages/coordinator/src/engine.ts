import { contextSchema, fingerprint, seriesSchema, toolSchemas, type Assessment, type AuditAction, type Campaign, type CoordinatorState, type EvidenceReport, type EvidenceSeries, type ToolArguments, type ToolContext, type ToolName } from './contracts';
import { independentSites, usableAt, validateRegional } from './validator';

export class PolicyError extends Error {
  constructor(public readonly code: string) { super(code); this.name='PolicyError'; }
}

function canonicalSummary(assessment: Assessment): string {
  const prefix=assessment.synthetic?'SYNTHETIC WORKFLOW TEST. ':'';
  const meaning=assessment.verdict==='SUPPORTED'?'Evidence is consistent with a regional ground magnetic disturbance under the stated provisional criteria.':assessment.verdict==='REJECTED'?'The submitted evidence fails quality checks; a regional magnetic claim is rejected.':'Available evidence is insufficient to establish a regional ground magnetic disturbance.';
  return `${prefix}${assessment.verdict}: ${meaning} ${assessment.independentSites} independent usable real phone sites; ${assessment.referenceStations.length} aligned professional references. This does not establish visible aurora. ${assessment.reasons.join('; ')}.`;
}

export class Coordinator {
  private readonly state: CoordinatorState;
  private readonly context: ToolContext;
  private readonly completed = new Map<string,{signature:string;result:unknown}>();
  constructor(state: CoordinatorState, context: ToolContext) {
    this.context=contextSchema.parse(context);
    this.state=structuredClone(state);
    if(this.state.event.id!==this.context.eventId) throw new PolicyError('EVENT_SCOPE_MISMATCH');
  }
  snapshot(): CoordinatorState { return structuredClone(this.state); }
  private log(tool: AuditAction['tool'], status: AuditAction['status'], args: unknown, result: unknown): void {
    const sequence=this.state.audit.length+1;
    this.state.audit.push(Object.freeze({sequence,id:`${this.context.runId}-action-${sequence}`,previousId:this.state.audit.at(-1)?.id??null,atUtc:this.context.mode==='SCRIPTED_DEMO'?this.context.asOfUtc:new Date().toISOString(),actorId:this.context.actorId,tool,status,argumentsHash:fingerprint(args),result:structuredClone(result),mode:this.context.mode}));
  }
  private authorize(tool: ToolName, args: unknown): void {
    if(!this.context.adultConfirmed) throw new PolicyError('ADULT_CONSENT_REQUIRED');
    if(this.context.role!=='researcher') throw new PolicyError('RESEARCHER_REQUIRED');
    if(typeof args==='object'&&args!==null&&'regionCell' in args&&!this.context.permittedCells.includes(String(args.regionCell))) throw new PolicyError('REGION_SCOPE_DENIED');
    if(tool==='publish_evidence_report'&&this.context.role!=='researcher') throw new PolicyError('PUBLICATION_DENIED');
  }
  execute<K extends ToolName>(tool: K, argumentsValue: unknown, callId: string): unknown {
    const signature=fingerprint({tool,argumentsValue});
    try {
      if(!/^[A-Za-z0-9_-]{1,100}$/.test(callId)) throw new PolicyError('INVALID_CALL_ID');
      const previous=this.completed.get(callId);
      if(previous) {
        if(previous.signature!==signature) throw new PolicyError('IDEMPOTENCY_CONFLICT');
        return structuredClone(previous.result);
      }
      if(!Object.hasOwn(toolSchemas,tool)) throw new PolicyError('UNKNOWN_TOOL');
      const parsed=toolSchemas[tool].safeParse(argumentsValue);
      if(!parsed.success) throw new PolicyError('INVALID_TOOL_ARGUMENTS');
      this.authorize(tool,parsed.data);
      if('intervalUtc' in parsed.data && Array.isArray(parsed.data.intervalUtc) && Date.parse(parsed.data.intervalUtc[1])>Date.parse(this.context.asOfUtc)) throw new PolicyError('FUTURE_INTERVAL');
      const result=this.dispatch(tool,parsed.data);
      this.log(tool,'OK',parsed.data,result);
      this.completed.set(callId,{signature,result:structuredClone(result)});
      return structuredClone(result);
    } catch(error) {
      const code=error instanceof PolicyError?error.code:'TOOL_FAILED';
      this.log(tool,'BLOCKED',{callId,signature},{error:code});
      throw new PolicyError(code);
    }
  }
  private scoped(regionCell: string, intervalUtc: [string,string]): EvidenceSeries[] {
    return this.state.series.filter(s=>s.eventId===this.context.eventId&&s.regionCell===regionCell&&Date.parse(s.observedEndUtc)>=Date.parse(intervalUtc[0])&&Date.parse(s.observedStartUtc)<=Date.parse(intervalUtc[1]));
  }
  private dispatch(tool: ToolName, args: ToolArguments[ToolName]): unknown {
    switch(tool) {
      case 'get_event_context': return {...this.state.event,asOfUtc:this.context.asOfUtc,mode:this.context.mode,analysisMode:this.context.analysisMode,revision:this.state.revision,liveUpstreamStatus:'NOT_CONNECTED',regions:this.context.permittedCells.map(regionCell=>{
        const rows=this.state.series.filter(s=>s.eventId===this.context.eventId&&s.regionCell===regionCell&&Date.parse(s.observedEndUtc)<=Date.parse(this.context.asOfUtc));
        const starts=rows.map(s=>Date.parse(s.observedStartUtc));const ends=rows.map(s=>Date.parse(s.observedEndUtc));
        return {regionCell,intervalUtc:rows.length?[new Date(Math.min(...starts)).toISOString(),new Date(Math.max(...ends)).toISOString()]:[new Date(Date.parse(this.context.asOfUtc)-600000).toISOString(),this.context.asOfUtc],sourceIds:[...new Set(rows.map(s=>s.sourceId))]};
      })};
      case 'get_regional_coverage': {
        const a=args as ToolArguments['get_regional_coverage'];
        const selected=this.scoped(a.regionCell,a.intervalUtc);
        const phones=selected.filter(s=>s.instrument==='PHONE'&&seriesSchema.safeParse(s).success&&usableAt(s,this.context,a.intervalUtc));
        return {independentSites:independentSites(phones.filter(s=>s.kind!=='SYNTHETIC')).length,usableSessions:phones.filter(s=>s.kind!=='SYNTHETIC').length,syntheticSessions:phones.filter(s=>s.kind==='SYNTHETIC').length,cells:[a.regionCell],sessionIds:selected.filter(s=>s.instrument==='PHONE').map(s=>s.id),uncertainty:'Site count excludes synthetic data and merges co-located/shared-environment devices.'};
      }
      case 'get_reference_magnetometers': {
        const a=args as ToolArguments['get_reference_magnetometers'];
        const references=this.scoped(a.regionCell,a.intervalUtc).filter(s=>s.instrument==='OBSERVATORY'&&s.kind!=='SYNTHETIC'&&seriesSchema.safeParse(s).success&&usableAt(s,this.context,a.intervalUtc));
        return {stationIds:references.map(s=>s.siteId),sourceIds:references.map(s=>s.sourceId),evidenceIds:references.map(s=>s.id),status:references.length?'AVAILABLE':'MISSING_STALE_OR_UNAVAILABLE',processedSummary:references.map(s=>({id:s.id,component:s.component,frame:s.frame,unit:s.unit,observedStartUtc:s.observedStartUtc,observedEndUtc:s.observedEndUtc,availableAtUtc:s.availableAtUtc,sourceUrl:s.sourceUrl}))};
      }
      case 'run_local_qc': {
        const a=args as ToolArguments['run_local_qc'];
        const session=this.state.series.find(s=>s.id===a.sessionId&&s.instrument==='PHONE');
        if(!session || session.eventId!==this.context.eventId || !this.context.permittedCells.includes(session.regionCell)) throw new PolicyError('SESSION_SCOPE_DENIED');
        const schemaValid=seriesSchema.safeParse(session).success;
        const available=this.context.analysisMode!=='OPERATIONAL'||(session.availableAtUtc!==null&&Date.parse(session.availableAtUtc)<=Date.parse(this.context.asOfUtc));
        const accepted=schemaValid&&available&&session.qc.accepted&&session.qc.flags.length===0&&Date.parse(session.observedEndUtc)<=Date.parse(this.context.asOfUtc);
        return {sessionId:session.id,accepted,flags:[...session.qc.flags,...(!schemaValid?['INVALID_SERIES']:[]),...(!available?['OPERATIONAL_AVAILABILITY_UNVERIFIED']:[]),...(Date.parse(session.observedEndUtc)>Date.parse(this.context.asOfUtc)?['FUTURE_DATA']:[])],quality:{baselineNoiseNt:session.baselineNoiseNt,sampleCount:session.samples.length,kind:session.kind},algorithmVersion:session.qc.algorithmVersion,scope:'Stored acquisition QC plus independent schema/time validation; not an aurora detector.'};
      }
      case 'run_regional_coherence': {
        const a=args as ToolArguments['run_regional_coherence'];
        const selected=this.scoped(a.regionCell,a.intervalUtc);
        const unknown=a.sourceIds.filter(id=>!selected.some(s=>s.sourceId===id));
        if(unknown.length) throw new PolicyError('UNKNOWN_OR_OUT_OF_SCOPE_SOURCE');
        // Requested sources cannot suppress a contradictory in-scope measurement.
        const assessment=validateRegional({series:selected,context:this.context,regionCell:a.regionCell,intervalUtc:a.intervalUtc,evidenceRevision:this.state.revision});
        if(!this.state.assessments.some(s=>s.id===assessment.id)) this.state.assessments.push(assessment);
        return assessment;
      }
      case 'request_opt_in_session': {
        const a=args as ToolArguments['request_opt_in_session'];
        if(this.context.mode==='LIVE_AGENT'&&!this.context.syntheticParticipantsAllowed&&!this.context.invitationDeliveryEnabled)throw new PolicyError('INVITATION_DELIVERY_NOT_CONFIGURED');
        const latest=this.state.assessments.filter(s=>s.regionCell===a.regionCell&&s.evidenceRevision===this.state.revision).at(-1);
        if(!latest || latest.verdict==='SUPPORTED') throw new PolicyError('NO_CURRENT_EVIDENCE_GAP');
        const existing=this.state.campaigns.find(c=>c.regionCell===a.regionCell&&Date.parse(this.context.asOfUtc)-Date.parse(c.createdAtUtc)<86400000);
        if(existing) return existing;
        const simulate=this.context.mode==='SCRIPTED_DEMO'||this.context.syntheticParticipantsAllowed===true;
        const eligible=this.state.volunteers.filter(v=>v.regionCell===a.regionCell&&v.adultConfirmed&&v.optedIn&&!v.declined&&(simulate?v.simulated:!v.simulated)&&(!v.lastInvitedAtUtc || Date.parse(this.context.asOfUtc)-Date.parse(v.lastInvitedAtUtc)>=86400000));
        // At most one useful invitation per cell per 24 hours. No messaging or sensor activation occurs here.
        const volunteer=eligible[0];
        const campaign: Campaign={id:`campaign-${this.context.runId}-${this.state.campaigns.length+1}`,regionCell:a.regionCell,durationMinutes:10,reason:`Independent stationary evidence is missing in ${a.regionCell}; current verdict ${latest.verdict}.`,status:volunteer?'INVITED':'NO_ELIGIBLE_VOLUNTEERS',invitedCount:volunteer?1:0,createdAtUtc:this.context.asOfUtc,simulated:simulate};
        if(volunteer) volunteer.lastInvitedAtUtc=this.context.asOfUtc;
        this.state.campaigns.push(campaign);
        return campaign;
      }
      case 'publish_evidence_report': {
        const a=args as ToolArguments['publish_evidence_report'];
        const assessment=this.state.assessments.find(s=>s.id===a.assessmentId);
        if(!assessment) throw new PolicyError('ASSESSMENT_NOT_FOUND');
        const current=this.scoped(assessment.regionCell,assessment.intervalUtc);
        if(assessment.evidenceRevision!==this.state.revision || assessment.evidenceFingerprint!==fingerprint({series:current,regionCell:assessment.regionCell,intervalUtc:assessment.intervalUtc})) throw new PolicyError('STALE_ASSESSMENT');
        const existing=this.state.reports.find(r=>r.assessmentId===assessment.id&&r.audience===a.audience);
        if(existing) return existing;
        // Free-form LLM prose is NOT published. The deterministic statement is authoritative.
        const report: EvidenceReport={id:`report-${assessment.id}`,assessmentId:assessment.id,verdict:assessment.verdict,status:a.audience==='public'&&(assessment.synthetic||this.context.mode==='LIVE_AGENT')?'NEEDS_REVIEW':'PUBLISHED',summary:canonicalSummary(assessment),audience:a.audience,linkedEvidenceIds:assessment.evidenceIds,synthetic:assessment.synthetic,asOfUtc:this.context.asOfUtc,analysisVersion:assessment.analysisVersion,modelSummaryPublished:false};
        this.state.reports.push(report); return report;
      }
    }
  }
  // Called only by the authenticated ingestion boundary, never a model tool.
  acceptSessionFromIngest(series: EvidenceSeries): void {
    const parsed=seriesSchema.parse(series);
    if(parsed.eventId!==this.context.eventId||!this.context.permittedCells.includes(parsed.regionCell)) throw new PolicyError('SESSION_SCOPE_DENIED');
    const prior=this.state.series.find(s=>s.id===parsed.id);
    if(prior) {
      if(fingerprint(prior)===fingerprint(parsed)) return;
      throw new PolicyError('IMMUTABLE_SESSION_CONFLICT');
    }
    this.state.series.push(parsed); this.state.revision++;
    this.log('participant_session_completed','OK',{sessionId:parsed.id},{sessionId:parsed.id,kind:parsed.kind,revision:this.state.revision});
  }
}

export function createCoordinator(state: CoordinatorState, context: ToolContext) { return new Coordinator(state,context); }
