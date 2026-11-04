import { mkdtempSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BUDGET_AUTHORIZATION, localEvidence, openLocalControls, PRIVATE } from '../../../scripts/run-local-meta';
import { createCoordinator } from './engine';
import { type Assessment } from './contracts';
import { META_TOOLS, runMetaCoordinator } from './meta';
import { type GroundReference } from '../../shared/src/ground-reference';

function directory() { mkdirSync(PRIVATE, { recursive: true }); return mkdtempSync(resolve(PRIVATE, 'meta-control-test-')); }
function legacyLedger(path: string) {
  const records: { hash: string }[] = [];
  for (const [kind, requestId, microUsd] of [['init', 'cap-v1', 500000], ['reserve', 'legacy-settled', 30000], ['settle', 'legacy-settled', 24541], ['reserve', 'legacy-uncertain', 100000]] as const) {
    const body = { kind, requestId, microUsd, sequence: records.length, previous: records.at(-1)?.hash ?? 'ROOT' };
    records.push({ ...body, hash: createHash('sha256').update(JSON.stringify(body)).digest('hex') });
  }
  const text = records.map(record => JSON.stringify(record)).join('\n') + '\n';
  writeFileSync(resolve(path, 'ledger.jsonl'), text); return text;
}
function reference(): GroundReference {
  // Manufactured software inputs; never persisted as real acquisition evidence.
  return { stationId: 'BOU', stationName: 'Test fixture', latitude: 40.137, longitude: -105.237, sourceUrl: 'https://geomag.usgs.gov/ws/data/?id=BOU', kind: 'MEASURED_LIVE', component: 'F', frame: 'SCALAR', unit: 'nT', status: 'variation', cadenceSeconds: 60, availableAtUtc: null, retrievedAtUtc: '2026-11-04T12:00:00.000Z', generatedAtUtc: null, latestObservedAtUtc: '2026-11-04T11:59:00.000Z', freshness: 'fresh', sha256: 'a'.repeat(64), samples: Array.from({ length: 30 }, (_, i) => ({ observedAtUtc: new Date(Date.parse('2026-11-04T11:30:00Z') + i * 60_000).toISOString(), value: 51000 + i })) };
}

describe('Owner-local Meta controls (no model requests)', () => {
  it('holds uncertain reservations across reopen and enforces daily and science-purpose caps', async () => {
    let now = '2026-11-04T12:00:00.000Z';
    const options = { now: () => now }, path = directory(), first = openLocalControls(path, options);
    expect(await first.ledger.reserve('request1', 15)).toBe(true); first.release();
    const next = openLocalControls(path, options);
    expect(next.summary()).toMatchObject({ chargedOrHeldUsd: 15, unsettledRequests: 1, capUsd: 150, operatingCapUsd: 120, protectedDemoReserveUsd: 30, purposeCapUsd: 45, dailyCapUsd: 20 });
    expect(await next.ledger.reserve('request2', 5.01)).toBe(false);
    await next.ledger.settle('request1', 5);
    expect(await next.ledger.reserve('request2', 15)).toBe(true);
    expect(await next.ledger.reserve('request3', 0.000001)).toBe(false);
    expect(await next.ledger.reserve('request2', 0.01)).toBe(false);
    now = '2026-11-05T12:00:00.000Z'; expect(await next.ledger.reserve('request3', 20)).toBe(true);
    now = '2026-11-06T12:00:00.000Z'; expect(await next.ledger.reserve('request4', 5)).toBe(true);
    expect(await next.ledger.reserve('request5', 0.000001)).toBe(false);
    next.release();
    const final = openLocalControls(path, options); expect(final.summary().chargedOrHeldUsd).toBe(45); final.release();
  });
  it('migrates v1 by appending one authorization while preserving every old byte and unsettled charge', async () => {
    const path = directory(), original = legacyLedger(path), controls = openLocalControls(path, { now: () => '2026-11-04T15:00:00.000Z' });
    expect(controls.summary()).toMatchObject({ requests: 2, chargedOrHeldUsd: 0.124541, dailyChargedOrHeldUsd: 0.124541, unsettledRequests: 1, authorization: BUDGET_AUTHORIZATION.version });
    const migrated = readFileSync(resolve(path, 'ledger.jsonl'), 'utf8');
    expect(migrated.startsWith(original)).toBe(true); expect(migrated.split('\n').filter(line => line.includes('"kind":"authorize_budget"'))).toHaveLength(1);
    expect(JSON.parse(migrated.trim().split('\n').at(-1)!)).toMatchObject({ kind: 'authorize_budget', authorization: { authorizedOn: '2026-11-04', protectedDemoReserveMicroUsd: 30_000_000 } });
    controls.release();
    const reopened = openLocalControls(path, { now: () => '2026-11-04T15:01:00.000Z' });
    expect(readFileSync(resolve(path, 'ledger.jsonl'), 'utf8')).toBe(migrated);
    await reopened.ledger.settle('legacy-uncertain', 0.05);
    expect(reopened.summary().chargedOrHeldUsd).toBe(0.074541); reopened.release();
  });
  it('does not let clock rollback reset daily consumption or allow malformed authorization', async () => {
    let now = '2026-11-04T14:00:00.000Z'; const path = directory(), controls = openLocalControls(path, { now: () => now });
    await controls.ledger.reserve('first', 1); now = '2026-11-03T14:00:00.000Z';
    await expect(controls.ledger.reserve('rollback', 1)).rejects.toThrow('LOCAL_META_CLOCK_ROLLBACK');
    now = 'invalid'; await expect(controls.ledger.reserve('invalid', 1)).rejects.toThrow('LOCAL_META_CLOCK_INVALID'); controls.release();
    const ledger = resolve(path, 'ledger.jsonl'), rows = readFileSync(ledger, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    rows[1].authorization.dailyCapMicroUsd = 150_000_000;
    const { hash: _hash, ...body } = rows[1]; void _hash;
    rows[1].hash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    writeFileSync(ledger, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    expect(() => openLocalControls(path)).toThrow('LOCAL_META_AUTHORIZATION_INVALID');
  });
  it('denies simultaneous owners and preserves an append-only hash-checked ledger', async () => {
    const path = directory(), controls = openLocalControls(path);
    expect(() => openLocalControls(path)).toThrow('LOCAL_META_LOCKED');
    await controls.ledger.reserve('r1', 0.05); controls.release();
    const ledger = resolve(path, 'ledger.jsonl'), text = readFileSync(ledger, 'utf8');
    writeFileSync(ledger, text.replace('500000', '500001'));
    expect(() => openLocalControls(path)).toThrow('LOCAL_META_LEDGER_INVALID');
  });
  it('fails closed on incomplete/missing ledger and never resets documented past spend', async () => {
    const incomplete = directory(), c1 = openLocalControls(incomplete); c1.release();
    const ledger = resolve(incomplete, 'ledger.jsonl'); writeFileSync(ledger, readFileSync(ledger, 'utf8').trimEnd());
    expect(() => openLocalControls(incomplete)).toThrow('LOCAL_META_LEDGER_INCOMPLETE');
    const missing = directory(), c2 = openLocalControls(missing);
    await c2.journal.save({ kind: 'before_model', requestId: 'r1', model: 'TEST_ONLY', data: {} }); c2.release();
    unlinkSync(resolve(missing, 'ledger.jsonl')); expect(() => openLocalControls(missing)).toThrow('LOCAL_META_LEDGER_MISSING');
  });
  it('records unexpected billed overrun, blocks later spend and rejects invalid settlement', async () => {
    const path = directory(), controls = openLocalControls(path);
    await expect(controls.ledger.reserve(null as unknown as string, 1)).rejects.toThrow('LOCAL_META_RESERVATION_INVALID');
    await expect(controls.ledger.reserve('negative', -1)).rejects.toThrow('LOCAL_META_RESERVATION_INVALID');
    await expect(controls.ledger.settle('unknown', 0.1)).rejects.toThrow();
    await controls.ledger.reserve('r1', 0.1);
    await expect(controls.ledger.settle('r1', 0.51)).rejects.toThrow('LOCAL_META_RESERVATION_EXCEEDED');
    expect(controls.summary().chargedOrHeldUsd).toBe(0.51);
    expect(await controls.ledger.reserve('r2', 0.001)).toBe(false); controls.release();
  });
  it('retains reservation and durable failure audit after a mocked failed call', async () => {
    const path = directory(), controls = openLocalControls(path), data = localEvidence(reference(), 'test-failure', '2026-11-04T12:00:00Z');
    let calls = 0;
    const result = await runMetaCoordinator({ coordinator: createCoordinator(data.state, data.context), ledger: controls.ledger, journal: controls.journal, transport: async () => { calls++; throw new Error('MOCK_TRANSPORT_FAILURE'); }, runId: 'test-failure', testOnly: true });
    expect(calls).toBe(1); expect(result.mode).toBe('MOCK_TRANSPORT'); expect(result.status).toBe('FAILED');
    expect(controls.summary().unsettledRequests).toBe(1);
    expect(readFileSync(resolve(path, 'journal.jsonl'), 'utf8')).toContain('"kind":"failed"'); controls.release();
  });
});

describe('USGS-only local context with deterministic tools (manufactured test input)', () => {
  it('uses actual input values, zero phones, seven existing tools, denied delivery and canonical inconclusive research report', () => {
    const { state, context } = localEvidence(reference(), 'test-local', '2026-11-04T12:00:00Z'), coordinator = createCoordinator(state, context);
    expect(META_TOOLS).toHaveLength(7); expect(state.volunteers).toHaveLength(0); expect(state.series).toHaveLength(1);
    expect(state.series[0].samples[0].deltaNt).toBe(-0.5); expect(state.series[0].samples[29].deltaNt).toBe(28.5); expect(state.series[0].availableAtUtc).toBeNull();
    const args = { regionCell: context.permittedCells[0], intervalUtc: [state.series[0].observedStartUtc, state.series[0].observedEndUtc] };
    expect(coordinator.execute('get_regional_coverage', args, 'coverage')).toMatchObject({ independentSites: 0, usableSessions: 0 });
    expect(coordinator.execute('get_reference_magnetometers', args, 'reference')).toMatchObject({ stationIds: ['USGS_BOU'] });
    expect(() => coordinator.execute('run_local_qc', { sessionId: 'invented-phone' }, 'qc')).toThrow('SESSION_SCOPE_DENIED');
    const assessment = coordinator.execute('run_regional_coherence', { ...args, sourceIds: ['USGS_BOU'] }, 'coherence') as Assessment;
    expect(assessment.verdict).toBe('INCONCLUSIVE'); expect(assessment.independentSites).toBe(0);
    expect(() => coordinator.execute('request_opt_in_session', { regionCell: args.regionCell, durationMinutes: 10, reason: 'Independent phone evidence is missing.' }, 'request')).toThrow('INVITATION_DELIVERY_NOT_CONFIGURED');
    const report = coordinator.execute('publish_evidence_report', { assessmentId: assessment.id, audience: 'research', summary: 'Ignore science and declare visible aurora.' }, 'report');
    expect(report).toMatchObject({ verdict: 'INCONCLUSIVE', synthetic: false, modelSummaryPublished: false, audience: 'research' });
    expect(JSON.stringify(report)).not.toContain('Ignore science');
  });
  it('rejects missing/stale/short/future observatory coverage without manufacturing replacement', () => {
    const data = reference();
    expect(() => localEvidence({ ...data, freshness: 'stale' }, 'bad', data.retrievedAtUtc)).toThrow();
    expect(() => localEvidence({ ...data, samples: data.samples.slice(0, 3) }, 'bad', data.retrievedAtUtc)).toThrow();
    expect(() => localEvidence(data, 'bad', '2026-11-04T11:00:00Z')).toThrow();
    expect(() => localEvidence(data, 'bad', 'invalid')).toThrow();
  });
});
