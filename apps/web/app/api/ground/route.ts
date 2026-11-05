import { GROUND_STATIONS } from '@aurorasense/shared/ground-reference';
import { getBestLiveGroundReference, getLiveGroundReference, isGroundStation } from '../../../lib/ground-reference';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  if (query.has('stations')) {
    const order = (query.get('stations') ?? '').split(',');
    if ([...query.keys()].some(key => key !== 'stations') || query.getAll('stations').length !== 1 || !order.length || order.length > 5 || new Set(order).size !== order.length || !order.every(isGroundStation)) return Response.json({ reference: null, stations: GROUND_STATIONS, errors: ['Invalid ranked station request.'] }, { status: 400 });
    const result = await getBestLiveGroundReference(order);
    return Response.json(result, { status: result.reference ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const station = query.get('station') ?? 'BOU';
  if ([...query.keys()].some(key => key !== 'station') || query.getAll('station').length > 1 || !isGroundStation(station)) return Response.json({ reference: null, stations: GROUND_STATIONS, errors: ['Choose a supported USGS station.'] }, { status: 400 });
  try {
    const reference = await getLiveGroundReference(station);
    return Response.json({ reference, stations: GROUND_STATIONS, errors: reference.freshness === 'fresh' ? [] : [`Station data are ${reference.freshness}; latest valid sample time is shown.`] }, { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60' } });
  } catch {
    return Response.json({ reference: null, stations: GROUND_STATIONS, errors: ['USGS live ground reference is unavailable or failed validation. No simulated replacement was generated.'] }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
