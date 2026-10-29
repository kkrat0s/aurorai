'use client';
import { useEffect,useRef } from 'react';
import type { Ovation } from '../lib/catalog';
import { solarElevation } from '../lib/viewing';

export default function PolarMap({ovation,time,hemisphere,night}:{ovation:Ovation|null;time:string;hemisphere:'north'|'south';night:boolean}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const ctx=canvas.current?.getContext('2d');if(!ctx)return;
    ctx.clearRect(0,0,620,620);
    const sign=hemisphere==='north'?1:-1;
    const point=(lat:number,lon:number)=>{const r=(90-Math.abs(lat))/60*258;const a=lon*Math.PI/180;return [310+Math.sin(a)*r,310+sign*Math.cos(a)*r];};
    const bg=ctx.createRadialGradient(310,310,0,310,310,270);bg.addColorStop(0,'#0f2637');bg.addColorStop(1,'#08151f');
    ctx.fillStyle=bg;ctx.beginPath();ctx.arc(310,310,258,0,2*Math.PI);ctx.fill();
    ctx.save();ctx.beginPath();ctx.arc(310,310,258,0,2*Math.PI);ctx.clip();
    if(night)for(let lat=30;lat<90;lat+=2)for(let lon=-180;lon<180;lon+=2){if(solarElevation(sign*lat,lon,time)<-6){const [x,y]=point(sign*lat,lon);ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(x-5,y-5,10,10);}}
    if(ovation)for(const [lon,lat,value] of ovation.coordinates){if(lat*sign<30||value<=0)continue;const [x,y]=point(lat,lon);const hue=value>70?43:value>35?90:160;ctx.fillStyle=`hsla(${hue},92%,58%,${Math.min(.88,.2+value/100)})`;ctx.fillRect(x-2.3,y-2.3,4.6,4.6);}
    ctx.restore();ctx.strokeStyle='#53718466';ctx.lineWidth=1;
    for(const lat of [30,45,60,75]){const r=(90-lat)/60*258;ctx.beginPath();ctx.arc(310,310,r,0,2*Math.PI);ctx.stroke();ctx.fillStyle='#91aabb';ctx.font='11px system-ui';ctx.fillText(`${lat}°${sign>0?'N':'S'}`,315,310-r+14);}
    for(let lon=-180;lon<180;lon+=30){const[x,y]=point(sign*30,lon);ctx.beginPath();ctx.moveTo(310,310);ctx.lineTo(x,y);ctx.stroke();}
    ctx.fillStyle='#b9c9d3';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText(sign>0?'NORTH POLE':'SOUTH POLE',310,301);ctx.fillText(sign>0?'180°':'0°',310,31);ctx.fillText(sign>0?'0°':'180°',310,596);ctx.fillText('90°W',19,314);ctx.fillText('90°E',598,314);
    if(sign>0){const[x,y]=point(40.137,-105.237);ctx.fillStyle='#f7ce7d';ctx.beginPath();ctx.arc(x,y,5,0,2*Math.PI);ctx.fill();ctx.textAlign='left';ctx.fillText('BOU reference',x+10,y+4);}
  },[ovation,time,hemisphere,night]);
  return <div className="polar-wrap"><canvas ref={canvas} width="620" height="620" role="img" aria-label={`${hemisphere} geographic polar map. ${ovation?'NOAA modeled auroral activity':'No auroral forecast layer available'}. ${night?'Approximate twilight shading enabled.':''}`}/>{!ovation&&<div className="map-empty"><span className="tiny-label">MODEL LAYER UNAVAILABLE</span><p>No archived OVATION frame<br/>verified for May 2024.</p><small>Switch to Live for NOAA’s latest snapshot.</small></div>}</div>;
}
