import { describe, expect, it, vi } from 'vitest';
import { NOAA_KP_FORECAST_URL, parseKpForecast } from './kp-forecast';
import { GET } from '../app/api/kp-forecast/route';

const retrievedAtUtc = '2026-11-04T12:00:00.000Z';

describe('NOAA planetary K forecast parser', () => {
  it('preserves valid time and observed/estimated/predicted status in chronological order', () => {
    const result = parseKpForecast([
      { time_tag: '2026-11-04 18:00:00', kp: 5.67, observed: 'predicted', noaa_scale: 'G1' },
      { time_tag: '2026-11-04 12:00:00', kp: 0, observed: 'observed', noaa_scale: null },
      { time_tag: '2026-11-04 15:00:00', kp: 2.33, observed: 'estimated', noaa_scale: '' },
    ], retrievedAtUtc);
    expect(result).toMatchObject({ sourceId: 'NOAA_KP_FORECAST', sourceUrl: NOAA_KP_FORECAST_URL, retrievedAtUtc, issuanceAtUtc: null });
    expect(result.points.map(point => [point.validAtUtc, point.kp, point.status])).toEqual([
      ['2026-11-04T12:00:00.000Z', 0, 'OBSERVED'],
      ['2026-11-04T15:00:00.000Z', 2.33, 'ESTIMATED'],
      ['2026-11-04T18:00:00.000Z', 5.67, 'PREDICTED'],
    ]);
  });

  const invalidInputs: unknown[] = [
    [],
    [{ time_tag: '2026-02-30 12:00:00', kp: 2, observed: 'predicted', noaa_scale: null }],
    [{ time_tag: '2026-11-04 12:00:00', kp: 10, observed: 'predicted', noaa_scale: null }],
    [{ time_tag: '2026-11-04 12:00:00', kp: 2, observed: 'unknown', noaa_scale: null }],
    [
      { time_tag: '2026-11-04 12:00:00', kp: 2, observed: 'observed', noaa_scale: null },
      { time_tag: '2026-11-04T12:00:00Z', kp: 3, observed: 'predicted', noaa_scale: null },
    ],
  ];
  it.each(invalidInputs.map(input => ({ input })))('rejects invalid, empty, out-of-range or ambiguous forecast rows', ({ input }) => {
    expect(() => parseKpForecast(input, retrievedAtUtc)).toThrow();
  });

  it('serves a validated forecast snapshot and fails closed when NOAA data are invalid', async () => {
    const validRows = [
      { time_tag: '2026-11-04 12:00:00', kp: 0, observed: 'observed', noaa_scale: null },
      { time_tag: '2026-11-04 15:00:00', kp: 3, observed: 'predicted', noaa_scale: 'G1' },
    ];
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(validRows)));
    try {
      const response = await GET();
      expect(response.status).toBe(200);
      expect((await response.json()).forecast.points).toHaveLength(2);
    } finally {
      vi.unstubAllGlobals();
    }

    vi.stubGlobal('fetch', vi.fn(async () => Response.json([{ time_tag: 'invalid', kp: 4, observed: 'predicted', noaa_scale: null }])));
    try {
      const response = await GET();
      expect(response.status).toBe(503);
      expect((await response.json()).forecast).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
