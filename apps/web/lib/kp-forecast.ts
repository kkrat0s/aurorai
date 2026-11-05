import { z } from 'zod';

export const NOAA_KP_FORECAST_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';
const rowSchema = z.object({
  time_tag: z.string(),
  kp: z.number().finite().min(0).max(9),
  observed: z.enum(['observed', 'estimated', 'predicted']),
  noaa_scale: z.string().nullable(),
});
export type KpForecastStatus = 'OBSERVED' | 'ESTIMATED' | 'PREDICTED';
export type KpForecastPoint = { validAtUtc: string; kp: number; status: KpForecastStatus; noaaScale: string | null };
export type KpForecastSnapshot = { sourceId: 'NOAA_KP_FORECAST'; sourceUrl: typeof NOAA_KP_FORECAST_URL; retrievedAtUtc: string; issuanceAtUtc: null; points: KpForecastPoint[] };

function strictTimestamp(value: string): string {
  const text = value.replace(' ', 'T');
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:?\d{2})?$/.exec(text);
  if (!match) throw new Error('Invalid forecast valid time');
  const [, year, month, day, hour, minute, second] = match;
  const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > daysInMonth || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) throw new Error('Invalid forecast valid time');
  const withZone = /Z$|[+-]\d{2}:?\d{2}$/.test(text) ? text : `${text}Z`;
  const epoch = Date.parse(withZone);
  if (!Number.isFinite(epoch)) throw new Error('Invalid forecast valid time');
  return new Date(epoch).toISOString();
}

/** Parse NOAA's three-hour nowcast/forecast while preserving their supplied status and valid time. */
export function parseKpForecast(input: unknown, retrievedAtUtc: string): KpForecastSnapshot {
  const retrieved = strictTimestamp(retrievedAtUtc);
  if (!Array.isArray(input) || input.length === 0 || input.length > 100) throw new Error('Invalid Kp forecast series');
  const points = input.map((value): KpForecastPoint => {
    const row = rowSchema.parse(value);
    return { validAtUtc: strictTimestamp(row.time_tag), kp: row.kp, status: row.observed.toUpperCase() as KpForecastStatus, noaaScale: row.noaa_scale };
  }).sort((a, b) => a.validAtUtc.localeCompare(b.validAtUtc));
  if (new Set(points.map(point => point.validAtUtc)).size !== points.length) throw new Error('Duplicate forecast valid time');
  return { sourceId: 'NOAA_KP_FORECAST', sourceUrl: NOAA_KP_FORECAST_URL, retrievedAtUtc: retrieved, issuanceAtUtc: null, points };
}
