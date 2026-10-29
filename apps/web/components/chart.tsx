type Point = {time:string;value:number|null};
export default function Chart({points,label,color='var(--mint)',unit='nT',height=220,maxGapMs=90_000}:{points:Point[];label:string;color?:string;unit?:string;height?:number;maxGapMs?:number}) {
  const valid = points.filter((p):p is {time:string;value:number}=>p.value!==null && Number.isFinite(p.value));
  if (!valid.length) return <div className="empty-chart">No verified samples available for this interval.</div>;
  const minTime = Date.parse(points[0].time), maxTime = Date.parse(points.at(-1)!.time);
  const low = Math.min(...valid.map(p=>p.value)), high = Math.max(...valid.map(p=>p.value));
  const spread = high-low || 1, min=low-spread*.12,max=high+spread*.12;
  const x=(t:string)=>56+(Date.parse(t)-minTime)/Math.max(maxTime-minTime,1)*704;
  const y=(value:number)=>20+(max-value)/(max-min)*(height-60);
  let pen=false;
  const d=points.map((p,i)=>{if(p.value===null || !Number.isFinite(p.value)){pen=false;return '';}
    if(i>0 && (Date.parse(p.time)-Date.parse(points[i-1].time)>maxGapMs || Date.parse(p.time)<=Date.parse(points[i-1].time)))pen=false;
    const command=`${pen?'L':'M'}${x(p.time).toFixed(2)},${y(p.value).toFixed(2)}`;pen=true;return command;}).join(' ');
  return <svg className="trace-chart" viewBox={`0 0 800 ${height}`} role="img" aria-label={label}>
    {[0,.25,.5,.75,1].map(f=><g key={f}><line x1="56" y1={20+f*(height-60)} x2="760" y2={20+f*(height-60)} stroke="var(--grid)"/><text x="46" y={24+f*(height-60)} textAnchor="end">{(max-f*(max-min)).toFixed(0)}</text></g>)}
    <path d={d} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke"/>
    <text x="56" y={height-10}>{new Date(minTime).toISOString().slice(5,16).replace('T',' ')}</text><text x="760" y={height-10} textAnchor="end">{new Date(maxTime).toISOString().slice(5,16).replace('T',' ')} UTC</text><text x="8" y="13">{unit}</text>
  </svg>;
}
