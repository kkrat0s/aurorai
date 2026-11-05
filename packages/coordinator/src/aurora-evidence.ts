import { z } from 'zod';

/** Frozen engineering evidence screen, not a calibrated optical probability model. */
export const AURORA_EVIDENCE_VERSION = 'aurora-evidence-1.0.0';
const utc = z.string().datetime({offset:true});
const nullableNumber = z.number().finite().nullable();
const source = {sourceUrl:z.string().url(),retrievedAtUtc:utc};
export const auroraEvidenceRequestSchema = z.object({
  asOfUtc:utc.optional(), mode:z.enum(['LIVE','REPLAY']).default('LIVE'),
  userLocation:z.object({latitudeDeg:z.number().finite().min(-90).max(90).optional(),longitudeDeg:z.number().finite().min(-180).max(180).optional(),approximateCityOrRegion:z.string().max(100).optional(),cloudFraction:z.number().min(0).max(1).nullable().optional(),cloudObservedAtUtc:utc.optional()}).passthrough().default({}),
  ovation:z.object({...source,observedAtUtc:utc,validAtUtc:utc,coordinates:z.array(z.tuple([z.number().min(0).lt(360),z.number().min(-90).max(90),z.number().min(0).max(100)])).min(1).max(100000)}).nullable().optional(),
  solarWind:z.object({...source,samples:z.array(z.object({observedAtUtc:utc,bzNt:nullableNumber,speedKmS:nullableNumber,densityCm3:nullableNumber})).max(10000)}).nullable().optional(),
  kp:z.object({...source,samples:z.array(z.object({observedAtUtc:utc,kp:z.number().min(0).max(9)})).max(1000)}).nullable().optional(),
  groundReference:z.object({sourceUrl:z.string().url(),retrievedAtUtc:utc,stationId:z.string().max(20),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),component:z.literal('F'),unit:z.literal('nT'),samples:z.array(z.object({observedAtUtc:utc,value:nullableNumber})).max(20000)}).nullable().optional(),
}).passthrough();
export type AuroraAlertEvaluationRequest = z.input<typeof auroraEvidenceRequestSchema>;
export type SourceStatus = {source:string;status:'FRESH'|'STALE'|'MISSING'|'FUTURE'|'INVALID';observedAtUtc:string|null;sourceUrl:string|null;detail:string};
export interface AuroraAlertEvaluationResult {
  alertLevel:'ACTIVE_AURORA_ALERT'|'ELEVATED_WATCH'|'QUIET_MONITORING'|'INSUFFICIENT_DATA';
  alertColor:string;title:string;summary:string;optimalViewingWindow:string;viewingDirection:string;
  visibilityLikelihood:'HIGH'|'MODERATE'|'LOW'|'NEGLIGIBLE'|'UNKNOWN';
  numericalProbability:null;calibrated:false;algorithmVersion:string;asOfUtc:string|null;
  solarElevationDeg:number|null;forecastSolarElevationDeg:number|null;localOvationActivity:number|null;nearbyOvationActivity:number|null;
  ovationCellDistanceKm:number|null;southwardDurationMinutes:number|null;planetaryKp:number|null;
  evidence:string[];limitations:string[];sourceStatus:SourceStatus[];
  localMeasurementTrigger:{recommended:boolean;reason:string;measurementDurationMinutes:number};
  metaAudit:{sparkCoordinatorApproved:false;wonderRedTeamApproved:false;modelCalled:false;executionMode:'DETERMINISTIC_EVIDENCE_FUSION'};
}
const empty=(asOfUtc:string|null):AuroraAlertEvaluationResult=>({alertLevel:'INSUFFICIENT_DATA',alertColor:'#ffd58c',title:'Local aurora estimate unavailable',summary:'Current, location-matched evidence is required. Missing data is not evidence of quiet conditions.',optimalViewingWindow:'No supported forecast-valid time available',viewingDirection:'Poleward horizon; exact elevation is not established',visibilityLikelihood:'UNKNOWN',numericalProbability:null,calibrated:false,algorithmVersion:AURORA_EVIDENCE_VERSION,asOfUtc,solarElevationDeg:null,forecastSolarElevationDeg:null,localOvationActivity:null,nearbyOvationActivity:null,ovationCellDistanceKm:null,southwardDurationMinutes:null,planetaryKp:null,evidence:[],limitations:['Qualitative engineering assessment; local naked-eye probability is uncalibrated.','OVATION and solar wind are related inputs, not independent votes.','Magnetic disturbance does not establish optical aurora; phone readings do not increase a visibility estimate.','Clouds, terrain, moonlight, light pollution and optical sightings may be unavailable.'],sourceStatus:[],localMeasurementTrigger:{recommended:false,reason:'A voluntary recording can investigate local sensor quality; it cannot establish local optical visibility.',measurementDurationMinutes:10},metaAudit:{sparkCoordinatorApproved:false,wonderRedTeamApproved:false,modelCalled:false,executionMode:'DETERMINISTIC_EVIDENCE_FUSION'}});

export function geographicDistanceKm(lat1:number,lon1:number,lat2:number,lon2:number):number {
  const r=Math.PI/180, dlat=(lat2-lat1)*r,dlon=(lon2-lon1)*r;
  const a=Math.sin(dlat/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dlon/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,a))));
}
/** NOAA fractional-year approximation; geometric, without terrain/refraction correction. */
export function auroraSolarElevation(latitude:number,longitude:number,time:string):number {
  const d=new Date(time),r=Math.PI/180,year=d.getUTCFullYear();
  if(![latitude,longitude,d.getTime()].every(Number.isFinite)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw new Error('Invalid location or UTC');
  const day=Math.floor((d.getTime()-Date.UTC(year,0,1))/86400000)+1;
  const h=d.getUTCHours()+d.getUTCMinutes()/60+d.getUTCSeconds()/3600;
  const days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
  const g=2*Math.PI/days*(day-1+(h-12)/24);
  const eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
  const dec=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
  const angle=((h*60+eq+4*longitude)/4-180)*r;
  return Math.asin(Math.min(1,Math.max(-1,Math.sin(latitude*r)*Math.sin(dec)+Math.cos(latitude*r)*Math.cos(dec)*Math.cos(angle))))/r;
}
function freshness(at:string|null|undefined,now:number,maxMinutes:number):SourceStatus['status'] {
  if(!at)return 'MISSING';const age=now-Date.parse(at);
  return !Number.isFinite(age)?'INVALID':age < -60000?'FUTURE':age>maxMinutes*60000?'STALE':'FRESH';
}
export function evaluateAuroraAlertDecision(input:unknown):AuroraAlertEvaluationResult {
  // One corrupt optional source must not suppress the remaining validated evidence.
  const normalized=input&&typeof input==='object'&&!Array.isArray(input)?{...input as Record<string,unknown>}:input;
  const invalidSources=new Set<string>();
  if(normalized&&typeof normalized==='object')for(const key of ['ovation','solarWind','kp','groundReference'] as const){
    const values=normalized as Record<string,unknown>;
    if(!auroraEvidenceRequestSchema.shape[key].safeParse(values[key]).success){invalidSources.add(key);values[key]=null;}
  }
  const parsed=auroraEvidenceRequestSchema.safeParse(normalized);
  const result=empty(parsed.success?parsed.data.asOfUtc??null:null);
  if(!parsed.success){result.limitations.unshift('Evidence payload failed schema validation.');return result;}
  for(const source of invalidSources)result.limitations.unshift(`${source}: invalid evidence was excluded.`);
  const p=parsed.data,now=Date.parse(p.asOfUtc??'');
  const lat=p.userLocation.latitudeDeg,lon=p.userLocation.longitudeDeg;
  if(!Number.isFinite(now)||lat===undefined||lon===undefined){result.limitations.unshift('UTC analysis time and geographic coordinates are required; legacy invented context is ignored.');return result;}
  result.solarElevationDeg=auroraSolarElevation(lat,lon,p.asOfUtc!);
  result.viewingDirection=lat>=0?'Northern (poleward) horizon; no fixed elevation claimed':'Southern (poleward) horizon; no fixed elevation claimed';
  if(p.mode==='REPLAY'){result.limitations.unshift('Current feeds cannot establish historical local viewing conditions. Use a verified historical issuance.');return result;}
  const status=(sourceName:string,at:string|null|undefined,url:string|null|undefined,minutes:number,detail:string)=>{const entry:SourceStatus={source:sourceName,status:freshness(at,now,minutes),observedAtUtc:at??null,sourceUrl:url??null,detail};result.sourceStatus.push(entry);return entry;};
  const o=p.ovation;
  const oval=status('NOAA OVATION',o?.observedAtUtc,o?.sourceUrl,120,'Nearest geographic model cell; modeled activity, not calibrated local visibility.');
  if(!o)oval.detail='No OVATION grid was returned by the NOAA source response.';
  else if(Date.parse(o.retrievedAtUtc)>now+60000){oval.status='FUTURE';oval.detail='The NOAA response retrieval time is in the future relative to analysis time.';}
  else if(oval.status==='FUTURE')oval.detail='The NOAA model observation time is in the future relative to analysis time.';
  else if(oval.status==='STALE')oval.detail='The latest NOAA model observation exceeds the 120-minute freshness window.';
  if(o&&oval.status==='FRESH'){
    const valid=Date.parse(o.validAtUtc),observed=Date.parse(o.observedAtUtc);
    if(valid<observed||valid-observed>120*60000||observed>Date.parse(o.retrievedAtUtc)+60000){oval.status='INVALID';oval.detail='Forecast times are inconsistent or outside the supported model horizon.';}
    else if(now-valid>15*60000){oval.status='STALE';oval.detail='The model valid time is no longer current.';}
    else {
      let nearest=Infinity,activity:number|null=null,nearby=0;
      for(const [longitude,latitude,value] of o.coordinates){const distance=geographicDistanceKm(lat,lon,latitude,longitude>180?longitude-360:longitude);if(distance<nearest){nearest=distance;activity=value;}if(distance<=500)nearby=Math.max(nearby,value);}
      if(nearest>250){oval.status='MISSING';oval.detail='No grid cell within 250 km of the selected location.';}
      else {result.forecastSolarElevationDeg=auroraSolarElevation(lat,lon,o.validAtUtc);result.localOvationActivity=activity;result.nearbyOvationActivity=nearby;result.ovationCellDistanceKm=nearest;result.evidence.push(`NOAA local modeled activity ${activity}/100 at the nearest cell (${nearest.toFixed(0)} km); maximum within 500 km ${nearby}/100.`);result.optimalViewingWindow=`NOAA model valid at ${o.validAtUtc}; no extrapolated multi-hour forecast`;}
    }
  }
  const windRows=[...(p.solarWind?.samples??[])].filter(row=>Date.parse(row.observedAtUtc)<=now+60000).sort((a,b)=>Date.parse(a.observedAtUtc)-Date.parse(b.observedAtUtc));
  const latestMag=[...windRows].reverse().find(row=>row.bzNt!==null),latestPlasma=[...windRows].reverse().find(row=>row.speedKmS!==null);
  const mag=status('NOAA IMF Bz',latestMag?.observedAtUtc,p.solarWind?.sourceUrl,15,'Upstream GSM field, not ground F.');
  const plasma=status('NOAA plasma',latestPlasma?.observedAtUtc,p.solarWind?.sourceUrl,15,'Solar wind speed/density condition driving; not an independent optical forecast.');
  if(p.solarWind&&Date.parse(p.solarWind.retrievedAtUtc)>now+60000){mag.status='FUTURE';plasma.status='FUTURE';}
  if(latestMag&&mag.status==='FRESH'){
    result.evidence.push(`Latest upstream IMF Bz ${latestMag.bzNt!.toFixed(1)} nT (GSM), observed ${latestMag.observedAtUtc}.`);
    let minutes=0;const recent=windRows.filter(row=>Date.parse(row.observedAtUtc)>=now-30*60000);const seen=new Set<string>();
    for(let i=1;i<recent.length;i++){const a=recent[i-1],b=recent[i],gap=Date.parse(b.observedAtUtc)-Date.parse(a.observedAtUtc);if(gap>0&&gap<=90000&&!seen.has(b.observedAtUtc)&&a.bzNt!==null&&b.bzNt!==null&&a.bzNt<0&&b.bzNt<0)minutes+=gap/60000;seen.add(b.observedAtUtc);}
    result.southwardDurationMinutes=minutes;result.evidence.push(`${minutes.toFixed(1)} minutes of sampled southward-Bz intervals in the last 30 minutes; data gaps are not bridged.`);
  }
  if(latestPlasma&&plasma.status==='FRESH')result.evidence.push(`Solar wind speed ${latestPlasma.speedKmS!.toFixed(0)} km/s${latestPlasma.densityCm3===null?'':`, density ${latestPlasma.densityCm3.toFixed(1)} cm⁻³`}, observed ${latestPlasma.observedAtUtc}.`);
  const kpRows=(p.kp?.samples??[]).filter(row=>Date.parse(row.observedAtUtc)<=now).sort((a,b)=>Date.parse(a.observedAtUtc)-Date.parse(b.observedAtUtc));
  const lastKp=kpRows.at(-1),kp=status('NOAA estimated Kp',lastKp?.observedAtUtc,p.kp?.sourceUrl,240,'Three-hour planetary index; not a local optical probability.');
  if(p.kp&&Date.parse(p.kp.retrievedAtUtc)>now+60000)kp.status='FUTURE';
  if(lastKp&&kp.status==='FRESH'){result.planetaryKp=lastKp.kp;result.evidence.push(`Latest estimated planetary Kp ${lastKp.kp.toFixed(2)} (three-hour product), time ${lastKp.observedAtUtc}.`);}
  const ground=p.groundReference,groundRows=(ground?.samples??[]).filter(row=>row.value!==null&&Date.parse(row.observedAtUtc)<=now+60000).sort((a,b)=>Date.parse(a.observedAtUtc)-Date.parse(b.observedAtUtc));
  const groundLast=groundRows.at(-1),groundStatus=status('Professional ground F',groundLast?.observedAtUtc,ground?.sourceUrl,15,'Reference context only; no phone coherence or optical detection inferred.');
  if(ground&&Date.parse(ground.retrievedAtUtc)>now+60000)groundStatus.status='FUTURE';
  if(ground&&groundLast&&groundStatus.status==='FRESH'){const distance=geographicDistanceKm(lat,lon,ground.latitude,ground.longitude);result.evidence.push(`${ground.stationId} scalar F ${groundLast.value!.toFixed(1)} nT, ${distance.toFixed(0)} km from selected location; this is a professional reference, not local optical confirmation.`);if(distance>750)result.limitations.push('The selected professional station is more than 750 km away and does not establish local ground conditions.');}
  const cloud=status('Cloud cover',p.userLocation.cloudObservedAtUtc,null,90,'Unverified cloud state is unknown, never assumed clear.');
  if(p.userLocation.cloudFraction==null)cloud.status='MISSING';
  const viewingElevation=result.forecastSolarElevationDeg??result.solarElevationDeg;
  const dark=viewingElevation<=-12,day=viewingElevation>=-6;
  result.evidence.push(`Current geometric solar elevation ${result.solarElevationDeg.toFixed(1)}°.${result.forecastSolarElevationDeg===null?'':` At the model valid time: ${result.forecastSolarElevationDeg.toFixed(1)}° (${day?'daylight/civil twilight':dark?'nautical darkness or darker':'twilight'}).`}`);
  if(cloud.status==='FRESH')result.evidence.push(`Provided cloud fraction ${(p.userLocation.cloudFraction!*100).toFixed(0)}%, time ${p.userLocation.cloudObservedAtUtc}; cloud-provider identity is not verified.`);
  const nearby=result.nearbyOvationActivity??0,local=result.localOvationActivity;
  const solarWatch=mag.status==='FRESH'&&plasma.status==='FRESH'&&(latestMag?.bzNt??0)<-5&&(latestPlasma?.speedKmS??0)>=500;
  const kpWatch=kp.status==='FRESH'&&(result.planetaryKp??0)>=5;
  if(local!==null){
    const modelWatch=local>=20||nearby>=40;
    result.alertLevel=modelWatch||solarWatch||kpWatch?'ELEVATED_WATCH':'QUIET_MONITORING';
    result.title=modelWatch?'Modeled activity near your region':'Low modeled activity near your region';
    result.visibilityLikelihood=day?'NEGLIGIBLE':cloud.status==='FRESH'&&p.userLocation.cloudFraction!>=.7?'LOW':!dark?'LOW':modelWatch?'MODERATE':'LOW';
    result.summary=`${result.title}. ${day?'Daylight or civil twilight at model valid time limits viewing.':dark?'The selected location is dark enough at model valid time to consider viewing.':'Twilight at model valid time reduces contrast.'} ${cloud.status==='FRESH'?'Recent cloud context was supplied; clouds may change before model valid time.':'Cloud cover is unknown.'} ${solarWatch||kpWatch?'Upstream/planetary context is elevated, but cannot independently confirm local visibility.':'Upstream and planetary conditions remain separate context.'} This is qualitative guidance, not a numerical viewing probability or confirmed aurora.`;
  }else if(solarWatch||kpWatch){result.alertLevel='ELEVATED_WATCH';result.title='Space-weather watch; local visibility unknown';result.summary='Upstream or planetary evidence is elevated, but a fresh local OVATION frame is missing. No local visibility probability can be inferred.';}
  const invalidStatusNames:Record<string,string[]>={ovation:['NOAA OVATION'],solarWind:['NOAA IMF Bz','NOAA plasma'],kp:['NOAA estimated Kp'],groundReference:['Professional ground F']};
  for(const key of invalidSources)for(const entry of result.sourceStatus)if(invalidStatusNames[key].includes(entry.source)){entry.status='INVALID';entry.detail='Source payload failed validation and was excluded.';}
  if(result.localOvationActivity===null&&result.alertLevel==='INSUFFICIENT_DATA'){
    const currentOvation=result.sourceStatus.find(item=>item.source==='NOAA OVATION');
    const freshContext=result.sourceStatus.filter(item=>item.source.startsWith('NOAA ')&&item.source!=='NOAA OVATION'&&item.status==='FRESH').map(item=>item.source);
    const modelDetail=currentOvation?.status==='MISSING'&&currentOvation.detail.includes('No grid cell within')
      ?'The nearest modeled grid cell is more than 250 km away; this location is outside the supported local-cell coverage.'
      :`NOAA OVATION is ${currentOvation?.status.toLowerCase()??'unavailable'}: ${currentOvation?.detail??'No current local model status was returned.'}`;
    const contextDetail=freshContext.length
      ?`Fresh global context remains available from ${freshContext.join(', ')}, but it cannot replace a location-matched aurora-model cell.`
      :'No upstream context product is currently fresh. Check the source rows and refresh/API connection.';
    result.summary=`A local model estimate cannot be supported. ${modelDetail} ${contextDetail} Missing or distant data do not mean geomagnetic activity is absent.`;
  }
  result.localMeasurementTrigger.recommended=result.alertLevel==='ELEVATED_WATCH';
  result.localMeasurementTrigger.reason=result.localMeasurementTrigger.recommended?'If already opted in, a stationary 10-minute record can investigate ground response; independent sites and a matching professional reference are still required.':result.localMeasurementTrigger.reason;
  result.sourceStatus.filter(s=>s.status!=='FRESH').forEach(s=>result.limitations.push(`${s.source}: ${s.status.toLowerCase()}.`));
  return result;
}

/** Pure adapter for both clients; source arrays are never replaced with illustrative values. */
export function evaluateEvidenceFromNoaa(input:{asOfUtc:string;mode?:'LIVE'|'REPLAY';latitudeDeg:number;longitudeDeg:number;latestNoaa?:{ovation?:unknown;solarWind?:unknown;kp?:unknown}|null;groundReference?:unknown;cloudFraction?:number|null;cloudObservedAtUtc?:string}):AuroraAlertEvaluationResult {
  return evaluateAuroraAlertDecision({asOfUtc:input.asOfUtc,mode:input.mode??'LIVE',userLocation:{latitudeDeg:input.latitudeDeg,longitudeDeg:input.longitudeDeg,cloudFraction:input.cloudFraction??null,cloudObservedAtUtc:input.cloudObservedAtUtc},ovation:input.latestNoaa?.ovation,solarWind:input.latestNoaa?.solarWind,kp:input.latestNoaa?.kp,groundReference:input.groundReference});
}
