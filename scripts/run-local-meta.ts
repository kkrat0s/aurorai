/** Owner-operated local scientific coordinator. No public endpoint, cloud identity or invitations. */
import { appendFileSync, closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireGroundReference } from '../apps/web/lib/ground-reference';
import { type GroundReference } from '../packages/shared/src/ground-reference';
import { createCoordinator } from '../packages/coordinator/src/engine';
import { seriesSchema, type CoordinatorState, type ToolContext } from '../packages/coordinator/src/contracts';
import { createMetaTransport, META_MODEL, runMetaCoordinator, type BudgetLedger, type RunJournal } from '../packages/coordinator/src/meta';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PRIVATE = resolve(ROOT, 'data/private');
export const LOCAL_META_DIRECTORY = resolve(PRIVATE, 'meta');
export const LOCAL_META_CAP_MICRO_USD = 150_000_000;
const LEGACY_CAP_MICRO_USD = 500_000, MAX_FILE_BYTES = 10_000_000;
export const BUDGET_AUTHORIZATION = Object.freeze({
  version: 'owner-budget-2026-11-04-v2', authorizedBy: 'PROJECT_OWNER', authorizedOn: '2026-11-04', source: 'plan.md section 10 and owner confirmation on 2026-11-04',
  totalCapMicroUsd: LOCAL_META_CAP_MICRO_USD, operatingCapMicroUsd: 120_000_000, protectedDemoReserveMicroUsd: 30_000_000, dailyCapMicroUsd: 20_000_000,
  purposeCapsMicroUsd: Object.freeze({ SCIENCE_ORCHESTRATION: 45_000_000, IMAGE_UNDERSTANDING: 20_000_000, FIXTURE_EVALUATION: 30_000_000, WONDER_COMPARISON: 15_000_000, OPTIONAL_IMAGE_SAM: 10_000_000 }),
  maximumRequests: 2000, maximumDailyRequests: 200,
  legacyAttribution: 'All v1 reservations retain their amounts and are conservatively charged to science and the UTC migration date; original timing remains in the journal.',
});
type BudgetPurpose = keyof typeof BUDGET_AUTHORIZATION.purposeCapsMicroUsd;
const PURPOSE: BudgetPurpose = 'SCIENCE_ORCHESTRATION';
type Reservation = { maximum: number; actual: number | null; dayUtc: string; purpose: BudgetPurpose };
type LedgerRecord = { kind: 'init' | 'authorize_budget' | 'reserve' | 'settle'; requestId: string; microUsd: number; sequence: number; previous: string; hash: string; atUtc?: string; purpose?: BudgetPurpose; authorization?: typeof BUDGET_AUTHORIZATION };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fail(code: string): never { throw new Error(code); }
const validId = (id: string) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id);
function validUtc(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }
function safeDirectory(directory: string) {
  const path = resolve(directory), suffix = relative(PRIVATE, path);
  if (!suffix || suffix.startsWith('..') || isAbsolute(suffix)) fail('LOCAL_META_DIRECTORY_DENIED');
  mkdirSync(PRIVATE, { recursive: true }); mkdirSync(path, { recursive: true });
  const physicalPrivate = realpathSync(PRIVATE), physical = realpathSync(path), physicalSuffix = relative(physicalPrivate, physical);
  if (lstatSync(path).isSymbolicLink() || !physicalSuffix || physicalSuffix.startsWith('..') || isAbsolute(physicalSuffix)) fail('LOCAL_META_DIRECTORY_DENIED');
  return path;
}
function writeNew(path: string, value: unknown) {
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, `${JSON.stringify(value)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
}
function appendDurable(path: string, value: unknown) {
  if (existsSync(path) && (lstatSync(path).isSymbolicLink() || statSync(path).size > MAX_FILE_BYTES)) fail('LOCAL_META_STORAGE_INVALID');
  const fd = openSync(path, 'a', 0o600);
  try { appendFileSync(fd, `${JSON.stringify(value)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
}
function readLedger(path: string): LedgerRecord[] {
  if (!existsSync(path)) return [];
  if (lstatSync(path).isSymbolicLink() || statSync(path).size > MAX_FILE_BYTES) fail('LOCAL_META_LEDGER_INVALID');
  const text = readFileSync(path, 'utf8');
  if (!text.endsWith('\n')) fail('LOCAL_META_LEDGER_INCOMPLETE');
  let records: LedgerRecord[];
  try { records = text.trimEnd().split('\n').map(line => JSON.parse(line) as LedgerRecord); } catch { return fail('LOCAL_META_LEDGER_INVALID'); }
  if (!records.length || records[0]?.kind !== 'init' || records[0].microUsd !== LEGACY_CAP_MICRO_USD) fail('LOCAL_META_LEDGER_INVALID');
  const reservations = new Map<string, Reservation>();
  let authorized = false, lastAtUtc = '';
  records.forEach((record, index) => {
    const expectedKeys = ['hash', 'kind', 'microUsd', 'previous', 'requestId', 'sequence', ...(record?.kind === 'authorize_budget' ? ['atUtc', 'authorization'] : authorized ? ['atUtc', 'purpose'] : [])].sort().join(',');
    if (!record || Object.keys(record).sort().join(',') !== expectedKeys || record.sequence !== index || record.previous !== (index ? records[index - 1].hash : 'ROOT') || !validId(record.requestId) || !Number.isSafeInteger(record.microUsd) || record.microUsd < 0) fail('LOCAL_META_LEDGER_INVALID');
    const { hash, ...body } = record;
    if (hash !== digest(body)) fail('LOCAL_META_LEDGER_INVALID');
    if (index === 0) { if (record.requestId !== 'cap-v1') fail('LOCAL_META_LEDGER_INVALID'); return; }
    if (record.kind === 'authorize_budget' || authorized) {
      if (!validUtc(record.atUtc) || record.atUtc < lastAtUtc) fail('LOCAL_META_LEDGER_INVALID');
      lastAtUtc = record.atUtc;
    }
    if (record.kind === 'authorize_budget') {
      if (authorized || record.requestId !== BUDGET_AUTHORIZATION.version || record.microUsd !== LOCAL_META_CAP_MICRO_USD || JSON.stringify(record.authorization) !== JSON.stringify(BUDGET_AUTHORIZATION)) fail('LOCAL_META_AUTHORIZATION_INVALID');
      authorized = true; return;
    }
    if (authorized && (!record.purpose || !Object.hasOwn(BUDGET_AUTHORIZATION.purposeCapsMicroUsd, record.purpose))) fail('LOCAL_META_LEDGER_INVALID');
    const existing = reservations.get(record.requestId);
    if (record.kind === 'reserve') {
      if (existing || record.microUsd <= 0 || record.microUsd > (authorized ? LOCAL_META_CAP_MICRO_USD : LEGACY_CAP_MICRO_USD)) fail('LOCAL_META_LEDGER_INVALID');
      reservations.set(record.requestId, { maximum: record.microUsd, actual: null, dayUtc: record.atUtc?.slice(0, 10) ?? '', purpose: record.purpose ?? PURPOSE });
    } else if (record.kind === 'settle') {
      if (!existing || existing.actual !== null || (record.purpose && record.purpose !== existing.purpose)) fail('LOCAL_META_LEDGER_INVALID');
      existing.actual = record.microUsd;
    } else fail('LOCAL_META_LEDGER_INVALID');
  });
  return records;
}

/** The caller holds one exclusive lock for the whole run, including every network call. */
export function openLocalControls(directory = LOCAL_META_DIRECTORY, options: { now?: () => string } = {}) {
  const path = safeDirectory(directory), lockPath = resolve(path, 'run.lock'), ledgerPath = resolve(path, 'ledger.jsonl');
  const lockToken = randomUUID();
  try { writeNew(lockPath, { token: lockToken, pid: process.pid, createdAtUtc: new Date().toISOString(), purpose: 'Exclusive local Meta budget lock; crashes require operator inspection.' }); } catch { return fail('LOCAL_META_LOCKED_OR_UNWRITABLE'); }
  let closed = false;
  const release = () => {
    if (closed) return; closed = true;
    const contents = JSON.parse(readFileSync(lockPath, 'utf8')) as { token?: string };
    if (contents.token !== lockToken || lstatSync(lockPath).isSymbolicLink()) fail('LOCAL_META_LOCK_CHANGED');
    unlinkSync(lockPath);
  };
  try {
    let records = readLedger(ledgerPath);
    // Missing ledger alongside prior journals is never silently reset to a fresh spend allowance.
    if (!records.length && existsSync(resolve(path, 'journal.jsonl'))) fail('LOCAL_META_LEDGER_MISSING');
    const nowUtc = () => {
      const value = options.now?.() ?? new Date().toISOString(), lastAtUtc = [...records].reverse().find(record => record.atUtc)?.atUtc;
      if (!validUtc(value)) fail('LOCAL_META_CLOCK_INVALID');
      if (lastAtUtc && value < lastAtUtc) fail('LOCAL_META_CLOCK_ROLLBACK');
      return value;
    };
    const append = (kind: LedgerRecord['kind'], requestId: string, microUsd: number, extra: Pick<LedgerRecord, 'atUtc' | 'purpose' | 'authorization'> = {}) => {
      const body = { kind, requestId, microUsd, sequence: records.length, previous: records.at(-1)?.hash ?? 'ROOT', ...extra };
      const record: LedgerRecord = { ...body, hash: digest(body) };
      appendDurable(ledgerPath, record); records = [...records, record];
    };
    if (!records.length) append('init', 'cap-v1', LEGACY_CAP_MICRO_USD);
    // This one-time appended authorization preserves every old byte, hash and usage amount.
    if (!records.some(record => record.kind === 'authorize_budget')) append('authorize_budget', BUDGET_AUTHORIZATION.version, LOCAL_META_CAP_MICRO_USD, { atUtc: nowUtc(), authorization: BUDGET_AUTHORIZATION });
    const migrationDay = records.find(record => record.kind === 'authorize_budget')!.atUtc!.slice(0, 10);
    const reservations = new Map<string, Reservation>();
    for (const record of records.slice(1)) {
      if (record.kind === 'reserve') reservations.set(record.requestId, { maximum: record.microUsd, actual: null, dayUtc: record.atUtc?.slice(0, 10) ?? migrationDay, purpose: record.purpose ?? PURPOSE });
      else if (record.kind === 'settle') reservations.get(record.requestId)!.actual = record.microUsd;
    }
    const summary = () => {
      const today = nowUtc().slice(0, 10), values = [...reservations.values()], charge = (items: Reservation[]) => items.reduce((total, item) => total + (item.actual ?? item.maximum), 0);
      const total = charge(values), daily = charge(values.filter(item => item.dayUtc === today)), purpose = charge(values.filter(item => item.purpose === PURPOSE));
      return { authorization: BUDGET_AUTHORIZATION.version, capUsd: LOCAL_META_CAP_MICRO_USD / 1_000_000, operatingCapUsd: BUDGET_AUTHORIZATION.operatingCapMicroUsd / 1_000_000, protectedDemoReserveUsd: BUDGET_AUTHORIZATION.protectedDemoReserveMicroUsd / 1_000_000, purpose: PURPOSE, purposeCapUsd: BUDGET_AUTHORIZATION.purposeCapsMicroUsd[PURPOSE] / 1_000_000, dailyCapUsd: BUDGET_AUTHORIZATION.dailyCapMicroUsd / 1_000_000, dayUtc: today, chargedOrHeldUsd: total / 1_000_000, purposeChargedOrHeldUsd: purpose / 1_000_000, dailyChargedOrHeldUsd: daily / 1_000_000, requests: reservations.size, dailyRequests: values.filter(item => item.dayUtc === today).length, unsettledRequests: values.filter(item => item.actual === null).length, unexpectedChargeDetected: values.some(item => item.actual !== null && item.actual > item.maximum), remainingPurposeUsd: Math.max(0, BUDGET_AUTHORIZATION.purposeCapsMicroUsd[PURPOSE] - purpose) / 1_000_000 };
    };
    const ledger: BudgetLedger = {
      durable: true,
      reserve: async (requestId, maximumUsd) => {
        if (closed || !validId(requestId) || !Number.isFinite(maximumUsd) || maximumUsd <= 0) fail('LOCAL_META_RESERVATION_INVALID');
        const maximum = Math.ceil(maximumUsd * 1_000_000), budget = summary(), atUtc = nowUtc(), asMicroUsd = (usd: number) => Math.round(usd * 1_000_000);
        if (reservations.has(requestId) || reservations.size >= BUDGET_AUTHORIZATION.maximumRequests || budget.dailyRequests >= BUDGET_AUTHORIZATION.maximumDailyRequests || budget.unexpectedChargeDetected || asMicroUsd(budget.chargedOrHeldUsd) + maximum > LOCAL_META_CAP_MICRO_USD || asMicroUsd(budget.chargedOrHeldUsd) + maximum > BUDGET_AUTHORIZATION.operatingCapMicroUsd || asMicroUsd(budget.purposeChargedOrHeldUsd) + maximum > BUDGET_AUTHORIZATION.purposeCapsMicroUsd[PURPOSE] || asMicroUsd(budget.dailyChargedOrHeldUsd) + maximum > BUDGET_AUTHORIZATION.dailyCapMicroUsd) return false;
        append('reserve', requestId, maximum, { atUtc, purpose: PURPOSE }); reservations.set(requestId, { maximum, actual: null, dayUtc: atUtc.slice(0, 10), purpose: PURPOSE }); return true;
      },
      settle: async (requestId, actualUsd) => {
        const reservation = reservations.get(requestId);
        if (closed || !reservation || reservation.actual !== null || !Number.isFinite(actualUsd) || actualUsd < 0 || !Number.isSafeInteger(Math.ceil(actualUsd * 1_000_000))) fail('LOCAL_META_SETTLEMENT_INVALID');
        const actual = Math.ceil(actualUsd * 1_000_000);
        append('settle', requestId, actual, { atUtc: nowUtc(), purpose: reservation.purpose }); reservation.actual = actual;
        // Persist an unexpectedly large bill before failing closed; never hide an overrun.
        const budget = summary();
        if (actual > reservation.maximum || budget.chargedOrHeldUsd > budget.operatingCapUsd || budget.purposeChargedOrHeldUsd > budget.purposeCapUsd || budget.dailyChargedOrHeldUsd > budget.dailyCapUsd) fail('LOCAL_META_RESERVATION_EXCEEDED');
      },
    };
    const journal: RunJournal = { durable: true, save: async event => { if (closed) fail('LOCAL_META_CONTROLS_CLOSED'); appendDurable(resolve(path, 'journal.jsonl'), { atUtc: new Date().toISOString(), ...event }); } };
    return { ledger, journal, summary, release, saveResult: (runId: string, result: unknown) => { if (closed || !validId(runId)) fail('LOCAL_META_RESULT_INVALID'); writeNew(resolve(path, `${runId}.json`), result); } };
  } catch (error) { release(); throw error; }
}

export function localEvidence(reference: GroundReference, runId: string, asOfUtc = new Date().toISOString()) {
  if (!validId(runId) || !Number.isFinite(Date.parse(asOfUtc))) fail('LOCAL_META_CONTEXT_INVALID');
  if (reference.stationId !== 'BOU' || reference.kind !== 'MEASURED_LIVE' || reference.unit !== 'nT' || reference.component !== 'F' || reference.frame !== 'SCALAR' || reference.freshness !== 'fresh') fail('LOCAL_META_REFERENCE_INVALID');
  // Most recent contiguous observations, up to 30 minutes. A gap ends the usable interval.
  const rows: { observedAtUtc: string; value: number }[] = [];
  for (let i = reference.samples.length - 1; i >= 0; i--) {
    const sample = reference.samples[i];
    if (sample.value === null) { if (rows.length) break; continue; }
    if (!Number.isFinite(sample.value)) fail('LOCAL_META_REFERENCE_INVALID');
    if (rows.length && Date.parse(rows[0].observedAtUtc) - Date.parse(sample.observedAtUtc) !== 60_000) break;
    rows.unshift({ observedAtUtc: sample.observedAtUtc, value: sample.value });
    if (rows.length === 30) break;
  }
  if (rows.length < 8 || Date.parse(rows.at(-1)!.observedAtUtc) > Date.parse(asOfUtc) || Date.parse(asOfUtc) - Date.parse(rows.at(-1)!.observedAtUtc) > 10 * 60_000) fail('LOCAL_META_REFERENCE_COVERAGE');
  const baseline = (rows[0].value + rows[1].value) / 2, regionCell = 'colorado-front-range', eventId = `${runId}-event`;
  const evidence = seriesSchema.parse({ id: `${runId}-bou`, sourceId: 'USGS_BOU', eventId, regionCell, sourceUrl: reference.sourceUrl, kind: 'MEASURED_LIVE', instrument: 'OBSERVATORY', siteId: 'USGS_BOU', environmentalGroup: 'USGS_BOU_OBSERVATORY', latitude: reference.latitude, longitude: reference.longitude, observedStartUtc: rows[0].observedAtUtc, observedEndUtc: rows.at(-1)!.observedAtUtc, availableAtUtc: null, unit: 'nT', component: 'F', frame: 'SCALAR', processing: 'scalar-baseline-v1', baselineNoiseNt: Math.abs(rows[0].value - baseline), qc: { accepted: true, flags: [], algorithmVersion: 'usgs-scalar-source-validation-v1' }, samples: rows.map(row => ({ atUtc: row.observedAtUtc, deltaNt: row.value - baseline })) });
  const state: CoordinatorState = { event: { id: eventId, title: 'Local research review of current USGS BOU observations; independent phone evidence missing', sourceIds: ['USGS_BOU'], constraints: ['LOCAL OWNER-OPERATED CLI, not a verified Supabase cloud identity or deployment.', 'Only actual public USGS scalar F is loaded; zero phone sessions and zero volunteers exist. Never invent sessions or people. run_local_qc has no eligible phone input.', 'Analysis is RETROSPECTIVE because original operational availability is unknown. USGS variation records are provisional.', `Source SHA-256 ${reference.sha256}; retrieved ${reference.retrievedAtUtc}. Delta F subtracts the median of the first two selected minute readings; baselineNoiseNt is their descriptive MAD, not intrinsic instrument noise.`, 'Use the seven approved tools to inspect coverage and references, run the deterministic validator, evaluate the evidence gap and publish a RESEARCH audience report only. A request tool call is blocked because invitation delivery is not configured; no sensor or message will be activated.', 'The deterministic conclusion must remain INCONCLUSIVE with zero independent phone sites. No visible aurora, forecasting improvement or actual phone observation is established.'] }, series: [evidence], volunteers: [], campaigns: [], assessments: [], reports: [], audit: [], revision: 1 };
  const context: ToolContext = { actorId: 'local-owner-operator', role: 'researcher', eventId, asOfUtc, runId, mode: 'LIVE_AGENT', analysisMode: 'RETROSPECTIVE', permittedCells: [regionCell], adultConfirmed: true, syntheticParticipantsAllowed: false, invitationDeliveryEnabled: false };
  return { state, context };
}

function loadKey(): string | null {
  let key = process.env.META_MODEL_API_KEY?.trim();
  if (!key) for (const path of ['apps/web/.env.local', '.env.local', 'apps/web/.env']) {
    const file = resolve(ROOT, path); if (!existsSync(file)) continue;
    const match = readFileSync(file, 'utf8').match(/^META_MODEL_API_KEY\s*=\s*(.+)$/m);
    if (match?.[1]?.trim()) { key = match[1].trim().replace(/^["']|["']$/g, ''); break; }
  }
  return key && key.length >= 10 && key !== 'your-meta-model-api-key-here' ? key : null;
}
export async function main(args: string[]) {
  if (args.length === 1 && args[0] === '--help') { console.log('Local only: vite-node --script scripts/run-local-meta.ts --dry-run (zero network, append-only authorized budget migration) or --run --operator-adult (five rounds; $45 science purpose / $20 per UTC day; $150 total with $30 demo reserve protected). Never deletes the ledger, delivers invitations or changes cloud authorization.'); return; }
  const dry = args.length === 1 && args[0] === '--dry-run';
  if (!dry && !(args.length === 2 && new Set(args).size === 2 && args.includes('--run') && args.includes('--operator-adult'))) fail('LOCAL_META_EXPLICIT_OPERATOR_FLAGS_REQUIRED');
  const key = loadKey();
  const controls = openLocalControls();
  try {
    if (dry) { console.log(JSON.stringify({ mode: 'LOCAL_CONFIGURATION_ONLY', model: META_MODEL, credentialConfigured: key !== null, networkRequests: 0, modelCalled: false, budget: controls.summary(), lockAndDurableLedgerVerified: true, cloudAuthorizationVerified: false, invitationsEnabled: false })); return; }
    if (!key) fail('LOCAL_META_CREDENTIAL_MISSING');
    const budget = controls.summary();
    if (budget.unexpectedChargeDetected || budget.chargedOrHeldUsd >= budget.operatingCapUsd || budget.remainingPurposeUsd <= 0 || budget.dailyChargedOrHeldUsd >= budget.dailyCapUsd) fail('LOCAL_META_BUDGET_EXHAUSTED');
    const runId = `local-${randomUUID()}`, reference = await acquireGroundReference('BOU');
    const { state, context } = localEvidence(reference, runId), coordinator = createCoordinator(state, context);
    // Capture source provenance and local authorization before the first possible paid request.
    controls.saveResult(`${runId}-input`, { mode: 'LOCAL_OWNER_OPERATED_LIVE_AGENT', cloudAuthorizationVerified: false, operatorAdultDeclared: true, reference, state, context });
    let modelRequestAttempts = 0; const transport = createMetaTransport(key);
    const result = await runMetaCoordinator({ coordinator, transport: request => { modelRequestAttempts++; return transport(request); }, ledger: controls.ledger, journal: controls.journal, runId, maxRounds: 5 });
    controls.saveResult(runId, { ...result, localOperatorOnly: true, cloudAuthorizationVerified: false, invitationsDelivered: 0, modelRequestAttempts, budget: controls.summary() });
    console.log(JSON.stringify({ mode: 'LOCAL_OWNER_OPERATED_LIVE_AGENT', runId, model: result.model, status: result.status, modelCalled: modelRequestAttempts > 0, modelRequestAttempts, usage: result.usage, budget: controls.summary(), independentPhoneSites: 0, invitationsDelivered: 0, reports: result.state.reports, audit: result.state.audit.map(action => ({ tool: action.tool, status: action.status })), privateResult: `data/private/meta/${runId}.json`, cloudAuthorizationVerified: false }));
    if (result.status !== 'COMPLETED' || !result.state.reports.some(report => report.audience === 'research' && report.verdict === 'INCONCLUSIVE' && report.synthetic === false)) process.exitCode = 1;
  } finally { controls.release(); }
}

const normalizePath = (path: string) => resolve(path).replace(/\\/g, '/').toLowerCase();
if (process.argv[1] && normalizePath(process.argv[1]) === normalizePath(fileURLToPath(import.meta.url))) main(process.argv.slice(2)).catch(error => { const code = error instanceof Error && /^LOCAL_META_[A-Z_]+$/.test(error.message) ? error.message : 'LOCAL_META_SOURCE_OR_PERSISTENCE_FAILURE'; console.error(code); process.exitCode = 1; });
