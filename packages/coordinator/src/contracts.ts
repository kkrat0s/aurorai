import { z } from 'zod';

export const utc = z.string().datetime({ offset: false });
export const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
export const interval = z.tuple([utc, utc]).refine(([a,b]) => Date.parse(a) < Date.parse(b), 'Interval must increase');
export const verdictSchema = z.enum(['SUPPORTED', 'INCONCLUSIVE', 'REJECTED']);
export type Verdict = z.infer<typeof verdictSchema>;
export const toolSchemas = {
  get_event_context: z.object({}).strict(),
  get_regional_coverage: z.object({ regionCell: id, intervalUtc: interval }).strict(),
  get_reference_magnetometers: z.object({ regionCell: id, intervalUtc: interval }).strict(),
  run_local_qc: z.object({ sessionId: id }).strict(),
  run_regional_coherence: z.object({ regionCell: id, intervalUtc: interval, sourceIds: z.array(id).max(30) }).strict(),
  request_opt_in_session: z.object({ regionCell: id, durationMinutes: z.literal(10), reason: z.string().min(10).max(400) }).strict(),
  publish_evidence_report: z.object({ assessmentId: id, audience: z.enum(['public', 'research']), summary: z.string().max(1000) }).strict(),
} as const;
export type ToolName = keyof typeof toolSchemas;
export type ToolArguments = { [K in ToolName]: z.infer<(typeof toolSchemas)[K]> };

// Auth context is supplied by the verified server session, never by model tool arguments.
export const contextSchema = z.object({
  actorId: id, role: z.enum(['researcher', 'volunteer', 'public']),
  eventId: id, asOfUtc: utc, runId: id,
  mode: z.enum(['SCRIPTED_DEMO', 'LIVE_AGENT']),
  analysisMode: z.enum(['OPERATIONAL', 'RETROSPECTIVE']),
  permittedCells: z.array(id).min(1).max(100), adultConfirmed: z.boolean(),
  syntheticParticipantsAllowed: z.boolean().optional(),
  invitationDeliveryEnabled: z.boolean().optional(),
}).strict();
export type ToolContext = z.infer<typeof contextSchema>;

export const seriesSchema = z.object({
  id, sourceId: id, eventId: id, regionCell: id,
  sourceUrl: z.string().url(),
  kind: z.enum(['MEASURED_LIVE', 'MEASURED_ARCHIVAL', 'SYNTHETIC']),
  instrument: z.enum(['PHONE', 'OBSERVATORY']),
  siteId: id, environmentalGroup: id,
  latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180),
  observedStartUtc: utc, observedEndUtc: utc, availableAtUtc: utc.nullable(),
  unit: z.literal('nT'), component: z.literal('F'), frame: z.literal('SCALAR'),
  processing: z.literal('scalar-baseline-v1'),
  baselineNoiseNt: z.number().finite().nonnegative(),
  qc: z.object({accepted: z.boolean(), flags: z.array(z.string().max(100)), algorithmVersion: z.string().max(100)}).strict(),
  samples: z.array(z.object({atUtc: utc, deltaNt: z.number().finite()}).strict()).max(10000),
}).strict().superRefine((value, ctx) => {
  if (Date.parse(value.observedStartUtc) >= Date.parse(value.observedEndUtc)) ctx.addIssue({code: z.ZodIssueCode.custom, message:'Invalid observation interval'});
  let previous = -Infinity;
  for (const sample of value.samples) {
    const time = Date.parse(sample.atUtc);
    if (time <= previous || time < Date.parse(value.observedStartUtc) || time > Date.parse(value.observedEndUtc)) ctx.addIssue({code:z.ZodIssueCode.custom, message:'Unordered, duplicate or out-of-window sample'});
    if (time % 60000 !== 0) ctx.addIssue({code:z.ZodIssueCode.custom,message:'Derived regional samples must use UTC minute bins'});
    previous = time;
  }
});
export type EvidenceSeries = z.infer<typeof seriesSchema>;

export type Assessment = {
  id: string; verdict: Verdict; reasons: string[]; independentSites: number;
  referenceStations: string[]; evidenceIds: string[]; analysisVersion: string;
  synthetic: boolean; scope: 'REGIONAL_MAGNETIC_DISTURBANCE';
  asOfUtc: string; intervalUtc: [string, string]; regionCell: string;
  correlations: { phoneId: string; stationId: string; correlation: number | null; alignedSamples: number }[];
  evidenceRevision: number; evidenceFingerprint: string;
  limitations: string[];
};
export type Campaign = {
  id: string; regionCell: string; durationMinutes: 10; reason: string;
  status: 'INVITED' | 'BLOCKED' | 'NO_ELIGIBLE_VOLUNTEERS'; invitedCount: number;
  createdAtUtc: string; simulated: boolean;
};
export type Volunteer = {
  id: string; regionCell: string; adultConfirmed: boolean; optedIn: boolean;
  declined: boolean; lastInvitedAtUtc: string | null; simulated: boolean;
};
export type EvidenceReport = {
  id: string; assessmentId: string; verdict: Verdict; status: 'PUBLISHED' | 'NEEDS_REVIEW';
  summary: string; audience: 'public' | 'research'; linkedEvidenceIds: string[];
  synthetic: boolean; asOfUtc: string; analysisVersion: string;
  modelSummaryPublished: false;
};
export type AuditAction = {
  sequence: number; id: string; previousId: string | null; atUtc: string;
  actorId: string; tool: ToolName | 'participant_session_completed';
  status: 'OK' | 'BLOCKED'; argumentsHash: string; result: unknown;
  mode: 'SCRIPTED_DEMO' | 'LIVE_AGENT';
};
export type CoordinatorState = {
  event: {id: string; title: string; sourceIds: string[]; constraints: string[]};
  series: EvidenceSeries[]; volunteers: Volunteer[]; campaigns: Campaign[];
  assessments: Assessment[]; reports: EvidenceReport[]; audit: AuditAction[];
  revision: number;
};

// A stable change-detection checksum, not a cryptographic signature or access control.
export function fingerprint(value: unknown): string {
  const stable = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
    if (v && typeof v === 'object') return `{${Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>`${JSON.stringify(k)}:${stable(x)}`).join(',')}}`;
    return JSON.stringify(v) ?? 'null';
  };
  let hash = 2166136261;
  for (const character of stable(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
