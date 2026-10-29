import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeSensorSession, parseSensorSession } from './sensor';

describe('exported synthetic browser-import fixture', () => {
  it('parses the actual exported file and preserves explicit software-test provenance', () => {
    const session = parseSensorSession(JSON.parse(readFileSync(new URL('../../../demo/fixtures/synthetic-phone-local-interference.json', import.meta.url), 'utf8')));
    expect(session.kind).toBe('SYNTHETIC');
    expect(session.sourceId).toBe('AURORASENSE_TEST_GENERATOR');
    expect(session.device.model).toBe('Mathematical test fixture — not measured noise');
    expect(session.samples).toHaveLength(1601);
    const result = analyzeSensorSession(session);
    expect(result.durationSeconds).toBe(160);
    expect(result.actualHz).toBe(10);
    expect(result.baselineCoverageSeconds).toBeGreaterThan(108);
    expect(result.accepted).toBe(false);
    expect(result.sampleResults[1360].flags).toContain('LOCAL_INTERFERENCE');
    expect(result.sampleResults[1460].flags).toEqual(expect.arrayContaining(['MOTION', 'ORIENTATION_CHANGED']));
    expect(result.regionalVerdict).toBe('INCONCLUSIVE');
    expect(result.highWater.every((window) => !window.completeWindow && (window.maximumAbsoluteDeltaNt ?? Infinity) < 30)).toBe(true);
    expect(result).toEqual(analyzeSensorSession(session));
  });
});
