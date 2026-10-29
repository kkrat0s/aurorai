import type { Cme } from '../lib/catalog';
import { formatUtc } from '../lib/catalog';
export default function Ensemble({forecasts,asOf}:{forecasts:Cme[];asOf:string}){
  if(forecasts.length<2)return <div className="empty-chart">Fewer than two forecasts had been submitted by this replay time. Move the clock forward to reveal the ensemble.</div>;
  const start=Date.parse('2024-05-10T00:00:00Z'),end=Date.parse('2024-05-12T00:00:00Z');
  const x=(t:string)=>250+(Date.parse(t)-start)/(end-start)*490;
  const actual=forecasts.find(f=>f.observedArrivalUtc)?.observedArrivalUtc;
  const actualVisible=actual&&Date.parse(actual)<=Date.parse(asOf);
  const height=forecasts.length*32+82;
  return <div className="ensemble"><svg viewBox={`0 0 800 ${height}`} role="img" aria-label="NASA CCMC CME arrival predictions. Each row shows one original method submission. The x-axis is predicted arrival time, not a physical trajectory.">
    {[0,12,24,36,48].map(h=><g key={h}><line x1={250+h/48*490} x2={250+h/48*490} y1="25" y2={height-40} stroke="var(--grid)"/><text x={250+h/48*490} y={height-18} textAnchor="middle">{h%24===0?`May ${10+Math.floor(h/24)}`:'12:00'}</text></g>)}
    {actualVisible&&<><line x1={x(actual)} x2={x(actual)} y1="16" y2={height-40} stroke="var(--mint)" strokeDasharray="4 5"/><text x={x(actual)+6} y="15" fill="var(--mint)">Observed arrival¹</text></>}
    {forecasts.map((f,i)=>{const y=38+i*32;const short=f.method.replace('WSA-ENLIL + Cone','ENLIL').replace('EAM (Effective Acceleration Model)','EAM').replace('Cone + HAF (SEPC, NSSC, CAS)','Cone + HAF');return <g key={f.id}><title>{`${f.method} · Submitted ${formatUtc(f.issuedAtUtc)} · Arrival ${formatUtc(f.predictedArrivalUtc)}`}</title><text x="2" y={y+4}>{short.slice(0,31)}</text><line x1="250" x2={x(f.predictedArrivalUtc)} y1={y} y2={y} stroke={i%2?'#b7a0ff':'#7688dd'} strokeOpacity=".3"/><circle cx={x(f.predictedArrivalUtc)} cy={y} r="5" fill={i%2?'#b7a0ff':'#7ba8f5'}/></g>;})}
  </svg><p className="fine">UTC arrival estimates · each dot is an original submission, including method revisions. Spread is not a calibrated confidence interval. {actualVisible&&'¹Retrospective outcome; original publication time is unknown.'}</p></div>;
}
