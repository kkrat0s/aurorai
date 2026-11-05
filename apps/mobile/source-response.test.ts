import { describe, expect, it } from 'vitest';
import { readSourceJson, sourceErrorDetails, sourceRequestFailure } from './source-response';

describe('mobile live-source diagnostics', () => {
  it('preserves endpoint HTTP and upstream error details', async () => {
    const response = new Response(JSON.stringify({
      error: 'NOAA unavailable or invalid',
      errors: ['OVATION acquisition failed (HTTP 503).'],
    }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    await expect(readSourceJson(response)).rejects.toThrow('HTTP 503: NOAA unavailable or invalid OVATION acquisition failed (HTTP 503).');
  });

  it('does not invent details for malformed or non-object bodies', () => {
    expect(sourceErrorDetails(null)).toEqual([]);
    expect(sourceErrorDetails(['private', 2])).toEqual([]);
    expect(sourceErrorDetails({ error: 'temporary', errors: ['temporary', '', 1] })).toEqual(['temporary']);
  });

  it('retains a useful network failure reason', () => {
    expect(sourceRequestFailure(new TypeError('Network request failed'))).toBe('Network request failed');
    expect(sourceRequestFailure('rejected')).toBe('network request failed');
  });
});
