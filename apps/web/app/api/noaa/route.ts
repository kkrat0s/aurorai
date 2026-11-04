import { createNoaaLoader } from '../../../lib/noaa-acquisition';
export const runtime='nodejs';
const loadNoaa=createNoaaLoader();
export async function GET(){
  const data=await loadNoaa();
  if(!data.latestNoaa.ovation&&!data.latestNoaa.solarWind&&!data.latestNoaa.kp)return Response.json({error:'NOAA unavailable or invalid',...data},{status:503,headers:{'Cache-Control':'no-store'}});
  return Response.json(data,{headers:{'Cache-Control':'public, s-maxage=120'}});
}
