import { boundedNoaaText } from '../../../lib/noaa-acquisition';
import { NOAA_KP_FORECAST_URL, parseKpForecast } from '../../../lib/kp-forecast';

export const runtime = 'nodejs';
export async function GET() {
  try {
    const response = await fetch(NOAA_KP_FORECAST_URL, { cache: 'no-store', signal: AbortSignal.timeout(10_000), redirect: 'error', headers: { Accept: 'application/json' } });
    if (!response.ok) return Response.json({ forecast: null, error: `NOAA forecast returned HTTP ${response.status}.` }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    const body = JSON.parse(await boundedNoaaText(response, 250_000)) as unknown;
    const forecast = parseKpForecast(body, new Date().toISOString());
    return Response.json({ forecast }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ forecast: null, error: 'NOAA Kp forecast is temporarily unavailable or failed validation.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
