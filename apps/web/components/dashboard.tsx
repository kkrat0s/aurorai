'use client';

import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {analyzeSensorSession,parseSensorSession,type SensorSession} from '@aurorasense/shared/sensor';
import {evaluateSessionPrescriptively} from '@aurorasense/shared/prescriptive-evaluator';
import {
  classifyMagneticDisturbance,
  magneticGuessCopy,
  SPACE_WEATHER_GROUND_SCALES,
  GRANITE_WINDOWSILL_PHYSICS,
  type DevicePhysicalContext,
} from '@aurorasense/shared/magnetic-classifier';
import {
  runDemoCoordinator,
  type DemoCoordinatorResult,
  evaluateSparkMeasurementInsight,
  evaluateWonderRedTeam,
  evaluateEvidenceFromNoaa,
  evaluateSamOpticalSegmentation,
} from '@aurorasense/coordinator';
import {type Catalog,type ClockMode,REPLAY_START,REPLAY_END,visibleForecasts,formatUtc,dataFreshness} from '../lib/catalog';
import {solarElevation,darkness} from '../lib/viewing';
import Icon,{type IconName} from './icons';
import Chart from './chart';
import Ensemble from './ensemble';
import PolarMap from './polar-map';
import EvaluationPanel from './evaluation-panel';
import RecordedMetaRun from './recorded-meta-run';
import { LiveReferencePanel } from './live-reference-panel';
import { useBrowserLocation } from './use-browser-location';
import { rankGroundStations, type GroundReference } from '@aurorasense/shared/ground-reference';
import { AuroraEvidencePanel } from './aurora-evidence-panel';
import { SolarMagnetosphere3DCanvas } from './solar-storm-3d';

type Tab='storm'|'map'|'ground';
type Drawer='why'|'research'|'capture'|null;
type Action={sequence:number;atUtc:string;action:string;detail:string};
const INITIAL_TIME='2024-05-11T03:00:00Z';
const NAV:{id:Tab;name:string;icon:IconName;description:string}[]=[{id:'storm',name:'Storm Track',icon:'storm',description:'See the storm.'},{id:'map',name:'Aurora Map',icon:'map',description:'Find the aurora.'},{id:'ground',name:'Ground Truth',icon:'sensor',description:'Measure Earth’s response.'}];
const WHY=[
  {title:'A disturbance leaves the Sun',tag:'OBSERVED + MODELED',text:'The solar wind carries plasma and magnetic fields outward. A coronal mass ejection can send a stronger disturbance toward Earth. Images reveal the eruption; propagation models estimate its arrival.',note:'Arrival timing and the eventual Earth-impacting magnetic orientation are different uncertainties.'},
  {title:'Magnetic fields reconnect',tag:'PHYSICAL INTERPRETATION',text:'When the interplanetary field has a favorable orientation, magnetic reconnection at Earth’s dayside boundary allows enhanced energy and magnetic-flux transfer into the magnetosphere.',note:'A phone does not directly measure reconnection at the magnetopause.'},
  {title:'Energy moves through the magnetosphere',tag:'PHYSICAL INTERPRETATION',text:'The magnetotail can store and release energy. Changing currents and particle acceleration contribute to the ionospheric and ground magnetic response.',note:'Ground traces alone do not identify a unique reconnection event or a single universal pathway.'},
  {title:'Particles meet the atmosphere',tag:'PHYSICAL INTERPRETATION',text:'Energetic electrons travel along magnetic fields and collide with oxygen and nitrogen in the upper atmosphere. These collisions excite the atmospheric particles.',note:'Professional and phone magnetometers measure fields. Optical instruments observe the emitted light.'},
  {title:'The upper atmosphere glows',tag:'OPTICAL EMISSION',text:'Excited oxygen and nitrogen release light as they return to lower energy states. Oxygen contributes green and red emissions; nitrogen contributes blue and purple. Darkness, clouds and viewing geometry determine what you can see.',note:'Modeled activity and magnetic disturbance do not guarantee visible aurora.'},
];

function Badge({children,tone='neutral'}:{children:ReactNode;tone?:'mint'|'violet'|'amber'|'neutral'}){return <span className={`badge ${tone}`}>{children}</span>;}
function Source({name,url,time}:{name:string;url:string;time?:string|null}){return <div className="source-line"><a href={url} target="_blank" rel="noreferrer">{name}<Icon name="external" size={12}/></a>{time&&<span>{formatUtc(time)}</span>}</div>;}
function Stat({label,value,detail,tone}:{label:string;value:string;detail:string;tone?:string}){return <div className="stat"><span className="tiny-label">{label}</span><strong className={tone??''}>{value}</strong><span>{detail}</span></div>;}
function download(name:string,data:unknown){const link=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));link.href=url;link.download=name;link.click();URL.revokeObjectURL(url);}

export default function Dashboard({initialCatalog,evaluation}:{initialCatalog:Catalog;evaluation:Record<string,unknown>|null}) {
  const [catalog,setCatalog]=useState(initialCatalog);
  const [tab,setTab]=useState<Tab>('storm');
  const [mode,setMode]=useState<ClockMode>('replay');
  const [replayTime,setReplayTime]=useState(INITIAL_TIME);
  const [liveTime,setLiveTime]=useState(initialCatalog.generatedAtUtc);
  const [drawer,setDrawer]=useState<Drawer>(null);
  const [whyStep,setWhyStep]=useState(0);
  const [hemisphere,setHemisphere]=useState<'north'|'south'>('north');
  const [night,setNight]=useState(true);
  const browserLocation=useBrowserLocation(mode==='live'&&(tab==='map'||tab==='ground'));
  const chosen=useMemo(()=>browserLocation.position?{...browserLocation.position.location,name:'Your approximate area'}:undefined,[browserLocation.position]);
  const groundStationQuery=rankGroundStations(chosen).join(',');
  useEffect(()=>{if(chosen)setHemisphere(chosen.latitude<0?'south':'north');},[chosen]);
  const [session,setSession]=useState<SensorSession|null>(null);
  const [fileError,setFileError]=useState('');
  const [agent,setAgent]=useState<DemoCoordinatorResult|null>(null);
  const [refreshStatus,setRefreshStatus]=useState('');
  const [audit,setAudit]=useState<Action[]>([]);
  const [webAudioRunning,setWebAudioRunning]=useState(false);
  const [simDisturbance,setSimDisturbance]=useState(0);
  const [simTrial,setSimTrial]=useState(0);
  const [simStandstill, setSimStandstill] = useState(true);
  const [simTouched, setSimTouched] = useState(false);
  const [simCharging, setSimCharging] = useState(false);
  const [dbStatus, setDbStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [dbResult, setDbResult] = useState<{ submissionId?: string; sha256?: string; message?: string } | null>(null);
  const [journeyStep, setJourneyStep] = useState<number>(1);
  const [networkAggregate, setNetworkAggregate] = useState<{
    totalSubmissions: number;
    acceptedSubmissions: number;
    averageNoiseMadNt: number;
    byPlacementQuality: { EXCELLENT: number; FAIR: number; POOR: number };
    byActivityTier: { G0_QUIET: number; G1_G2_MODERATE: number; G3_G4_SEVERE: number; G5_EXTREME: number };
    regionalCoherence: { verifiedIndependentSites: number; referenceStation: string; status: string; coherenceScore: number | null };
  } | null>(null);
  const audioCtxRef=useRef<AudioContext|null>(null);
  const osc1Ref=useRef<OscillatorNode|null>(null);
  const osc2Ref=useRef<OscillatorNode|null>(null);
  const gainRef=useRef<GainNode|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);

  const webClassification = useMemo(() => {
    // Explicit synthetic trajectory for testing the label-free guess UI; not measured phone noise.
    const jitter=simDisturbance>=15?.8:.05;
    const samples=Array.from({length:24},(_,i)=>({x:18+simDisturbance*.52*i/23+jitter*Math.sin(i),y:-4+simDisturbance*.32*i/23-jitter*Math.sin(i),z:44.3+simDisturbance*.92*i/23,timestampMs:5000+simTrial*10000+i*100}));
    const physicalContext: DevicePhysicalContext = {
      isStandstill: simStandstill,
      motionState: simStandstill ? 'STANDSTILL' : 'ACTIVE_MOTION',
      isScreenTouched: simTouched,
      timeSinceLastTouchMs: simTouched ? 0 : 5000,
      isCharging: simCharging,
      batteryState: simCharging ? 'CHARGING' : 'UNPLUGGED',
      isFlatOnSurface: true,
      sampleKind: 'SYNTHETIC',
      sensorDeviceKey: 'synthetic-web-demo',
      acquisitionRunId: 'synthetic-web-demo',
    };
    return classifyMagneticDisturbance(samples, Math.hypot(18,-4,44.3), [], physicalContext);
  }, [simDisturbance, simTrial, simStandstill, simTouched, simCharging]);
  const webGuess = magneticGuessCopy(webClassification.predictedClass);

  function stopWebAudio(){
    if(audioCtxRef.current){
      try{
        gainRef.current?.gain.setValueAtTime(0,audioCtxRef.current.currentTime);
        osc1Ref.current?.stop();
        osc2Ref.current?.stop();
        void audioCtxRef.current.close();
      }catch(error){void error;}
      audioCtxRef.current=null;
      osc1Ref.current=null;
      osc2Ref.current=null;
      gainRef.current=null;
    }
    setWebAudioRunning(false);
  }
  function updateWebAudio(uT:number){
    setSimDisturbance(uT);
    if(audioCtxRef.current&&osc1Ref.current&&osc2Ref.current&&gainRef.current){
      const freq = 80 + Math.min(100, (uT / 25) * 100);
      const now = audioCtxRef.current.currentTime;
      osc1Ref.current.frequency.setTargetAtTime(freq, now, 0.08);
      osc2Ref.current.frequency.setTargetAtTime(freq * 1.5, now, 0.08);
      gainRef.current.gain.setTargetAtTime(0.07 + Math.min(0.08, (uT / 25) * 0.08), now, 0.08);
    }
  }
  function toggleWebAudio(){
    if(webAudioRunning){stopWebAudio();}
    else{
      try{
        const AudioCtx=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
        const ctx=new AudioCtx();
        audioCtxRef.current=ctx;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(80, ctx.currentTime);
        osc2.frequency.setValueAtTime(120, ctx.currentTime);
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.1);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start();
        osc1Ref.current = osc1;
        osc2Ref.current = osc2;
        gainRef.current = gain;
        setWebAudioRunning(true);
      }catch(error){void error;setWebAudioRunning(false);}
    }
  }
  const closeDrawer=()=>{stopWebAudio();setDrawer(null);};
  const time=mode==='replay'?replayTime:liveTime;
  const record=(action:string,detail:string)=>setAudit(items=>[...items,{sequence:items.length+1,atUtc:new Date().toISOString(),action,detail}]);
  useEffect(()=>{const update=()=>setLiveTime(new Date().toISOString());update();const id=setInterval(update,30_000);return()=>clearInterval(id);},[]);
  useEffect(()=>{if(drawer)dialog.current?.showModal();else dialog.current?.close();},[drawer]);
  const forecasts=useMemo(()=>visibleForecasts(catalog.cmeForecasts,replayTime),[catalog,replayTime]);
  const qc=useMemo(()=>session?analyzeSensorSession(session):null,[session]);
  const prescriptiveReport=useMemo(()=>session&&qc?evaluateSessionPrescriptively(session,qc):null,[session,qc]);

  const measuredSummary = useMemo(() => {
    const a=prescriptiveReport?.activityLevel;
    if(!session || !qc || qc.actualHz==null || qc.baselineMicroT==null || qc.noiseMadNt==null || qc.driftNt==null || a?.p95DeltaNt==null || a.maxDeltaNt==null) return null;
    return {durationSeconds:qc.durationSeconds,nominalHz:session.nominalHz,actualHz:qc.actualHz,baselineMedianMicroT:qc.baselineMicroT,noiseMadNt:qc.noiseMadNt,p95DeltaNt:a.p95DeltaNt,maxDeltaNt:a.maxDeltaNt,endpointDriftNt:qc.driftNt};
  }, [session,qc,prescriptiveReport]);
  const metaSparkInsight=useMemo(()=>measuredSummary&&qc?evaluateSparkMeasurementInsight({sessionSummary:measuredSummary,qcResult:{accepted:qc.accepted,flags:qc.flags}}):null,[measuredSummary,qc]);
  const metaWonderCritique=useMemo(()=>measuredSummary&&qc&&metaSparkInsight?evaluateWonderRedTeam({sparkVerdict:metaSparkInsight.scientificVerdict,sessionSummary:measuredSummary,qcResult:{accepted:qc.accepted,flags:qc.flags},independentSitesCount:1,professionalStationCoherence:false}):null,[measuredSummary,qc,metaSparkInsight]);
  const [liveGroundContext,setLiveGroundContext]=useState<GroundReference|null>(null);
  useEffect(()=>{
    if(mode!=='live')return;
    let active=true; const controller=new AbortController();
    const update=async()=>{
      const results=await Promise.allSettled([
        fetch('/api/noaa',{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('NOAA unavailable');return r.json();}),
        fetch(`/api/ground?stations=${groundStationQuery}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('USGS unavailable');return r.json();})
      ]);
      if(!active)return;
      if(results[0].status==='fulfilled'){const data=results[0].value;setCatalog(c=>({...c,latestNoaa:data.latestNoaa}));setRefreshStatus(data.errors?.join(' ')||'NOAA refreshed.');}else setRefreshStatus('NOAA unavailable; retained snapshot keeps original timestamps.');
      if(results[1].status==='fulfilled')setLiveGroundContext(results[1].value.reference);else setLiveGroundContext(null);
    };
    void update(); const interval=setInterval(()=>{void update();},120000);
    return()=>{active=false;controller.abort();clearInterval(interval);};
  },[mode,groundStationQuery]);
  const metaAuroraAlert=useMemo(()=>evaluateEvidenceFromNoaa({asOfUtc:time,mode:mode==='live'?'LIVE':'REPLAY',latitudeDeg:chosen?.latitude??NaN,longitudeDeg:chosen?.longitude??NaN,latestNoaa:catalog.latestNoaa,groundReference:liveGroundContext}),[time,mode,chosen,catalog.latestNoaa,liveGroundContext]);

  const metaSamResult = useMemo(() => {
    return evaluateSamOpticalSegmentation({
      imageWidth: 1920,
      imageHeight: 1080,
      nightSkyAreaRatio: 0.70,
    });
  }, []);

  useEffect(() => {
    fetch('/api/recordings')
      .then(r => r.json())
      .then(d => { if (d.success) setNetworkAggregate(d.aggregate); })
      .catch(() => {});
  }, [tab]);

  async function submitToCentralDatabase() {
    if (!session) return;
    setDbStatus('submitting');
    try {
      const res = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Submission error');
      setDbStatus('submitted');
      setDbResult(data);
      record('RECORDING_SUBMITTED_TO_CENTRAL_DB', `Submission ${data.submissionId}; SHA-256: ${data.sha256}`);
      const aggRes = await fetch('/api/recordings');
      const aggData = await aggRes.json();
      if (aggData.success) setNetworkAggregate(aggData.aggregate);
    } catch {
      setDbStatus('error');
    }
  }
  const reference=catalog.referenceSeries.find(s=>s.component==='F')??catalog.referenceSeries[0];
  const referencePoints=useMemo(()=>mode==='replay'?(reference?.samples??[]).filter(p=>Date.parse(p.observedAtUtc)<=Date.parse(replayTime)).map(p=>({time:p.observedAtUtc,value:p.value})):[],[mode,reference,replayTime]);
  const ovation=mode==='live'?catalog.latestNoaa.ovation:null;
  const wind=mode==='live'?catalog.latestNoaa.solarWind:null;
  const latestMag=wind?.samples.findLast(s=>s.bzNt!==null);
  const latestPlasma=wind?.samples.findLast(s=>s.speedKmS!==null);
  const elevation=chosen?solarElevation(chosen.latitude,chosen.longitude,time):null;
  const forecastTimes=forecasts.map(f=>Date.parse(f.predictedArrivalUtc));
  const spread=forecastTimes.length>1?((Math.max(...forecastTimes)-Math.min(...forecastTimes))/3_600_000).toFixed(1):null;
  const switchMode=(next:ClockMode)=>{setMode(next);record('CLOCK_MODE_CHANGED',next);};
  const reset=()=>{setTab('storm');setMode('replay');setReplayTime(INITIAL_TIME);setAgent(null);setDrawer(null);setHemisphere('north');setNight(true);record('DEMO_RESET','Replay fixtures and workflow reset; previous audit retained. Imported private phone session retained until explicit Forget.');};
  async function refresh(){setRefreshStatus('Checking NOAA…');try{const response=await fetch('/api/noaa');const body=await response.json();if(!response.ok)throw new Error(body.error??'NOAA unavailable');setCatalog(c=>({...c,latestNoaa:body.latestNoaa,manifests:[...c.manifests,...body.manifests]}));setRefreshStatus(body.errors?.length?'Partial NOAA refresh; unavailable products are blank.':'NOAA refreshed.');record('NOAA_REFRESH',body.retrievedAtUtc);}catch(error){setRefreshStatus(`${error instanceof Error?error.message:'Refresh failed'}. Saved snapshot retained with its original timestamps.`);}}
  async function importSession(file:File|undefined){if(!file)return;setFileError('');try{if(file.size>8_000_000)throw new Error('Session exceeds the 8 MB local import limit');const parsed=parseSensorSession(JSON.parse(await file.text()));setSession(parsed);record('PHONE_EXPORT_IMPORTED',`${parsed.kind}; ${parsed.samples.length} samples; file remains in this browser’s memory only.`);}catch(error){setFileError(error instanceof Error?error.message:'Invalid sensor export');}}
  const runAgent=()=>{const result=runDemoCoordinator();setAgent(result);record('SCRIPTED_COORDINATOR_RUN',`${result.verdict}; synthetic policy scenario; no Meta API call or external invitation.`);};

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#main"><span className="brand-icon"><Icon name="spark" size={23}/></span><span>Aurora<span>Sense</span></span><span className="prototype">RESEARCH PREVIEW</span></a><div className="header-actions"><button className="text-button" onClick={()=>setDrawer('research')}>Research <Icon name="external" size={14}/></button><button className="why-button" onClick={()=>{setDrawer('why');record('WHY_PANEL_OPENED',String(whyStep));}}><Icon name="book" size={16}/> Why?</button></div></header>
    <main id="main" className="main-content">
      <div className="intro"><div><div className="eyebrow"><span className="status-dot"/> EARTH’S RESPONSE, IN CONTEXT</div><h1>Follow the storm.<br className="mobile-break"/> <span>Trust the evidence.</span></h1><p>From solar wind to a sensor in your hand.</p></div><div className="clock-control"><div className="segmented" aria-label="Data clock"><button className={mode==='live'?'selected':''} onClick={()=>switchMode('live')}>Live</button><button className={mode==='replay'?'selected':''} onClick={()=>switchMode('replay')}><Icon name="clock" size={14}/> Historical replay</button></div><span className="clock-time">{formatUtc(time)}</span></div></div>
      <nav className="primary-tabs" aria-label="Primary screens">{NAV.map(item=><button key={item.id} aria-current={tab===item.id?'page':undefined} className={tab===item.id?'active':''} onClick={()=>{setTab(item.id);record('SCREEN_OPENED',item.name);}}><Icon name={item.icon} size={21}/><span>{item.name}<small>{item.description}</small></span><span className="tab-number">0{NAV.indexOf(item)+1}</span></button>)}</nav>
      {mode==='replay'?<section className="replay-bar" aria-label="Historical replay controls"><div><Badge tone="violet">HISTORICAL REPLAY</Badge><strong>May 2024 · Gannon storm</strong></div><label>Replay time<input aria-label="Replay time" type="range" min={Date.parse(REPLAY_START)} max={Date.parse(REPLAY_END)} step={3_600_000} value={Date.parse(replayTime)} onChange={e=>setReplayTime(new Date(Number(e.target.value)).toISOString())} onPointerUp={()=>record('REPLAY_TIME_CHANGED',replayTime)}/></label><button className="text-button" onClick={reset}><Icon name="reset" size={15}/>Reset demo</button></section>:<section className="replay-bar live-bar"><div><Badge tone="mint">LATEST SOURCE SNAPSHOTS</Badge><span>Freshness is measured from the product timestamp.</span></div><button className="text-button" onClick={refresh} disabled={refreshStatus==='Checking NOAA…'}><Icon name="reset" size={15}/>Refresh NOAA</button>{refreshStatus&&<small role="status">{refreshStatus}</small>}</section>}

      <div className="content-grid"><div className="primary-column">
        {tab==='storm'&&<>
          <section className="panel"><div className="panel-heading"><div><div className="eyebrow">01 / STORM TRACK</div><h2>{mode==='replay'?'One eruption. A range of arrivals.':'The solar wind, near Earth.'}</h2></div><Badge tone="violet">{mode==='replay'?'MODEL FORECAST':'NOAA UPSTREAM'}</Badge></div>
            <SolarMagnetosphere3DCanvas initialScenario={mode==='replay'?'MAY_2024_G5':'QUIET_WIND'} />
            {mode==='replay'?<><div className="sun-earth"><div className="sun-disc"/><div className="propagation"><span>May 8 · CME observed</span><div className="propagation-line"/><small>Heliospheric propagation · conceptual schematic</small></div><div className="earth-disc"/></div><div className="stat-row"><Stat label="ORIGINAL SUBMISSIONS" value={String(forecasts.length)} detail={`${new Set(forecasts.map(f=>f.method)).size} distinct methods · revisions retained`}/><Stat label="ARRIVAL ESTIMATE SPREAD" value={spread?`${spread} h`:'—'} detail="Range across visible submissions"/><Stat label="EARTH-IMPACTING Bz" value="Uncertain" detail="Arrival forecasts do not determine Bz" tone="amber-text"/></div><Ensemble forecasts={forecasts} asOf={replayTime}/><Source name="NASA CCMC · CME Scoreboard" url="https://ccmc.gsfc.nasa.gov/scoreboards/cme/earth/"/><details className="details"><summary>Inspect original submissions and revisions</summary><div className="table-scroll"><table><thead><tr><th>Method</th><th>Submitted UTC</th><th>Arrival estimate UTC</th></tr></thead><tbody>{forecasts.map(f=><tr key={f.id}><td>{f.method}</td><td>{formatUtc(f.issuedAtUtc)}</td><td>{formatUtc(f.predictedArrivalUtc)}</td></tr>)}</tbody></table></div><p className="fine">Submission time is used as an availability proxy. Later 2025 aggregate rows are excluded. Independent page vintages have not been verified.</p></details></>:<><div className="stat-row"><Stat label="IMF Bz · GSM" value={latestMag?.bzNt!==null&&latestMag?.bzNt!==undefined?`${latestMag.bzNt.toFixed(1)} nT`:'—'} detail={latestMag?formatUtc(latestMag.observedAtUtc):'Measurement unavailable'}/><Stat label="SOLAR-WIND SPEED" value={latestPlasma?.speedKmS?`${latestPlasma.speedKmS.toFixed(0)} km/s`:'—'} detail={latestPlasma?formatUtc(latestPlasma.observedAtUtc):'Measurement unavailable'}/><Stat label="MAGNETIC FEED" value={dataFreshness(latestMag?.observedAtUtc,time,15).toUpperCase()} detail="15-minute freshness threshold"/></div><Chart points={(wind?.samples??[]).map(s=>({time:s.observedAtUtc,value:s.bzNt}))} label="NOAA upstream IMF Bz in GSM coordinates" color="var(--violet)"/><Source name="NOAA SWPC · active RTSW product" url="https://services.swpc.noaa.gov/json/rtsw/" time={wind?.retrievedAtUtc}/><div className="notice">Near-Earth measurements condition short-term geoeffectiveness. They do not provide a multi-day CME arrival forecast.</div><button className="secondary-button" onClick={()=>switchMode('replay')}>Explore the verified May 2024 arrival ensemble <Icon name="arrow" size={16}/></button></>}
          </section>
          <section className="panel context-card"><div className="context-icon"><Icon name="sensor" size={28}/></div><div><div className="tiny-label">NEXT LINK IN THE EVIDENCE</div><h3>What happened on the ground?</h3><p>Compare this event with actual USGS Boulder measurements.</p></div><button className="circle-button" aria-label="Open Ground Truth" onClick={()=>setTab('ground')}><Icon name="arrow"/></button></section>
        </>}

        {tab==='map'&&<section className="panel map-panel"><div className="panel-heading"><div><div className="eyebrow">02 / AURORA MAP</div><h2>Activity is a clue. Visibility is local.</h2></div><Badge tone="violet">MODEL FORECAST</Badge></div><div className="map-toolbar"><div className="segmented compact"><button className={hemisphere==='north'?'selected':''} onClick={()=>setHemisphere('north')}>Northern</button><button className={hemisphere==='south'?'selected':''} onClick={()=>setHemisphere('south')}>Southern</button></div><label className="checkbox"><input type="checkbox" checked={night} onChange={e=>setNight(e.target.checked)}/>Twilight shading</label></div><PolarMap ovation={ovation} time={time} hemisphere={hemisphere} night={night} selectedLocation={chosen} referenceStation={mode==='replay'?{stationId:'BOU',latitude:40.137,longitude:-105.237}:liveGroundContext??undefined}/><div className="map-legend"><span>Lower activity</span><div/><span>Higher activity</span></div><p className="fine centered">NOAA modeled auroral activity · geographic polar graticule · no local visibility probability</p>{ovation?<><Source name="NOAA OVATION · model valid time" url={ovation.sourceUrl} time={ovation.validAtUtc}/><p className="fine">Input observed {formatUtc(ovation.observedAtUtc)} · {dataFreshness(ovation.observedAtUtc,time).toUpperCase()} · forecast horizon supplied by NOAA only.</p></>:<p className="notice">The historical model layer is unavailable. Current NOAA data is never relabeled as a May 2024 forecast.</p>}<div className="layer-list"><div><span className="layer-dot violet"/><span>Modeled auroral activity</span><Badge>{ovation?'NOAA SNAPSHOT':'UNAVAILABLE'}</Badge></div><div><span className="layer-dot mint"/><span>Ground magnetic evidence</span><Badge>{mode==='replay'?'BOU REFERENCE':'USGS · GROUND TAB'}</Badge></div><div><span className="layer-dot amber"/><span>Independently confirmed sightings</span><Badge>NONE LOADED</Badge></div></div>{chosen?<AuroraEvidencePanel result={metaAuroraAlert}/>:<div className="location-card"><h3>Global space-weather context</h3><p>NOAA activity and solar-wind observations remain available while local viewing conditions await location permission.</p><div className="stat-row"><Stat label="UPSTREAM IMF Bz" value={latestMag?.bzNt==null?'Awaiting source':`${latestMag.bzNt.toFixed(1)} nT`} detail={latestMag?`${formatUtc(latestMag.observedAtUtc)} · ${dataFreshness(latestMag.observedAtUtc,time).toUpperCase()}`:'Retrying NOAA'}/><Stat label="SOLAR WIND" value={latestPlasma?.speedKmS==null?'Awaiting source':`${latestPlasma.speedKmS.toFixed(0)} km/s`} detail={latestPlasma?`${formatUtc(latestPlasma.observedAtUtc)} · ${dataFreshness(latestPlasma.observedAtUtc,time).toUpperCase()}`:'Independent source refresh'}/></div></div>}<div className="location-card"><div className="eyebrow">{chosen?'LOCATION DETECTED · APPROXIMATE AREA':'AUTOMATIC LOCATION'}</div><p>{browserLocation.status==='locating'?'Finding your approximate area…':chosen?'Your location selects the local model cell and nearest reporting stations automatically.':browserLocation.status==='denied'?'Location permission is off. Global NOAA data remains available.':'Allow location to add local darkness and aurora context.'}</p>{mode==='live'&&<button className="text-button" onClick={browserLocation.refresh} disabled={browserLocation.status==='locating'}>{chosen?'Refresh location':'Use my location'}</button>}{elevation!==null&&<div className="stat-row"><Stat label="LOCAL LIGHT" value={darkness(elevation)} detail={`Solar elevation ≈ ${elevation.toFixed(0)}° · calculated`}/><Stat label="CLOUD COVER" value="Unknown" detail="No weather source connected"/></div>}<details><summary>Location privacy</summary><p className="fine">The browser requests permission. Only a half-degree approximate cell is kept in memory; precise coordinates are discarded. Station requests contain station IDs only. Location is never sent to Meta or added to imported recordings.</p></details></div></section>}

        {tab==='ground'&&<>
          <section className="panel" style={{borderColor:'#1b426b'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'8px',marginBottom:'10px'}}>
              <div>
                <div className="eyebrow" style={{color:'var(--mint)'}}>CITIZEN SCIENCE WORKFLOW · 7 SEQUENTIAL STEPS</div>
                <h3 style={{margin:'2px 0 0 0',fontSize:'16px'}}>From Local Field Discovery to Multi-Station Space Weather Verification</h3>
              </div>
              <Badge tone="mint">STEP {journeyStep} OF 7</Badge>
            </div>
            <div style={{display:'flex',gap:'6px',overflowX:'auto',paddingBottom:'6px',marginBottom:'10px'}}>
              {[
                {id:1,label:'1. Forcefield & Watch',icon:'🧲'},
                {id:2,label:'2. Quiet-Spot Radar',icon:'🎯'},
                {id:3,label:'3. Solar 3D & 1859',icon:'☀️'},
                {id:4,label:'4. 30s Scan & AI QC',icon:'⚡'},
                {id:5,label:'5. NOAA / NASA',icon:'🛰️'},
                {id:6,label:'6. Phone Network',icon:'🌐'},
                {id:7,label:'7. Aurora Alerts',icon:'🔔'},
              ].map(s=>(
                <button
                  key={s.id}
                  onClick={()=>setJourneyStep(s.id)}
                  style={{
                    padding:'7px 11px',
                    borderRadius:'999px',
                    border:`1px solid ${journeyStep===s.id?'#68edc3':'#1c3754'}`,
                    background:journeyStep===s.id?'#11334d':'#071525',
                    color:journeyStep===s.id?'#eff7ff':'#8ea8c4',
                    fontSize:'11.5px',
                    fontWeight:journeyStep===s.id?800:600,
                    cursor:'pointer',
                    whiteSpace:'nowrap',
                  }}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
            {journeyStep===3 && <SolarMagnetosphere3DCanvas initialScenario="CARRINGTON_1859" />}
            <div style={{background:'#061322',borderRadius:'10px',padding:'10px 12px',borderLeft:'3px solid #68edc3',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'10px'}}>
              <span style={{fontSize:'12px',color:'#dbe8f5',flex:1,minWidth:'220px'}}>
                {([
                  'Step 1 — Local magnetic patterns: hold the phone still and bring one known nearby object close. AuroraSense makes one tentative on-device guess; there is no label or identity confirmation. The animation is conceptual and object accuracy is unmeasured.',
                  'Step 2 — Placement checks: inspect motion, touch and charging context. These checks cannot establish an uncontaminated geomagnetic signal; record a full stationary baseline.',
                  'Step 3 — Solar physics: the conceptual animation illustrates CME propagation, compression and reconnection. It is not inferred from the phone signal.',
                  'Step 4 — Acquire: 30 seconds tests collection, two minutes establishes the QC baseline and ten minutes supports a professional-reference comparison. QC is deterministic.',
                  'Step 5 — Compare: NOAA upstream solar wind is context. Use actual simultaneous USGS scalar F for a ground-field comparison; inspect all timestamps and units.',
                  'Step 6 — Evidence gap: inspect the recorded real Spark tool run and separate scripted policy replay. No live participant network or invitation delivery is configured.',
                  'Step 7 — Local aurora evidence: use the Aurora Map with automatic location. Source-based guidance has no calibrated sighting probability; automatic push delivery is not configured.',
                ])[journeyStep-1]}
              </span>
              {journeyStep===1 && <button className="secondary-button" onClick={()=>setDrawer('why')} style={{padding:'6px 12px',fontSize:'11.5px'}}>Open 5-Step Science Story</button>}
              {journeyStep===2 && <button className="secondary-button" onClick={()=>setDrawer('capture')} style={{padding:'6px 12px',fontSize:'11.5px'}}>Open Spot Finder Simulator</button>}
              {journeyStep===6 && <button className="secondary-button" onClick={runAgent} style={{padding:'6px 12px',fontSize:'11.5px'}}>Run Coordinator Policy Demo</button>}
            </div>
          </section>
          <section className="panel"><div className="panel-heading"><div><div className="eyebrow">03 / GROUND TRUTH</div><h2>A reading is the start of a question.</h2></div><Badge tone={session?.kind==='SYNTHETIC'?'violet':'mint'}>{session?(session.kind==='SYNTHETIC'?'SYNTHETIC PHONE SIMULATION':'PHONE EXPORT · UNVERIFIED'):'PHONE NOT CONNECTED'}</Badge></div>
            {!session?<div className="sensor-empty"><div className="sensor-glyph"><Icon name="sensor" size={44}/></div><h3>Start with a real measurement.</h3><p>The Expo collector records three-axis magnetic field while your phone stays still. Export a session and inspect its quality here.</p><button className="primary-button" onClick={()=>setDrawer('capture')}>Prepare a 10-minute observation <Icon name="arrow" size={17}/></button><small>Explicit consent · foreground only · local export</small></div>:<><div className="notice">This imported file describes a {session.kind==='SYNTHETIC'?'synthetic test':'recorded phone'} session at {formatUtc(session.startedAtUtc)}. It is not synchronized with the historical storm. File declarations do not verify physical hardware provenance.</div><div className="stat-row">{(['x','y','z'] as const).map(axis=><Stat key={axis} label={`${axis.toUpperCase()} · DEVICE FRAME`} value={`${session.samples.at(-1)?.[axis].toFixed(2)??'—'} µT`} detail="Last imported sample"/>)}</div><Chart points={(qc?.sampleResults??[]).map((s,i)=>({time:s.observedAtUtc??session.samples[i].receivedAtUtc,value:s.deltaNt}))} label="Imported phone scalar magnetic perturbation; raw deviations include flagged artifacts" color="var(--violet)" maxGapMs={500}/><p className="fine">Δ|B| from the first 120-second median baseline · raw scalar deviations shown; flagged samples are excluded from usable statistics below.</p><div className={`notice ${qc?.flags.includes('LOCAL_INTERFERENCE')?'warning':''}`}><strong>{qc?.flags.includes('LOCAL_INTERFERENCE')?'Possible local interference — not regional confirmation':qc?.accepted?'Locally usable samples; regional evidence remains inconclusive':'Quality checks need attention'}</strong><p>{qc?.flags.join(' · ')||'No local screening flags'} · {qc?.algorithmVersion}</p></div><div className="stat-row"><Stat label="SCALAR |B|" value={qc?.sampleResults.at(-1)?.magnitudeMicroT!==null&&qc?.sampleResults.at(-1)?.magnitudeMicroT!==undefined?`${qc.sampleResults.at(-1)!.magnitudeMicroT!.toFixed(2)} µT`:'—'} detail="Magnitude · last imported sample"/><Stat label="ACTUAL CADENCE" value={qc?.actualHz?`${qc.actualHz.toFixed(1)} Hz`:'—'} detail={`${qc?.sampleCount} samples · ${qc?.usableCount} usable`}/><Stat label="BASELINE NOISE · MAD" value={qc?.noiseMadNt!==null&&qc?.noiseMadNt!==undefined?`${qc.noiseMadNt.toFixed(1)} nT`:'Pending'} detail="Engineering QC; uncalibrated sensitivity"/></div>            <div className="highwater">{qc?.highWater.map(h=><div key={h.requestedHours}><span>{h.requestedHours} h high-water</span><strong>{h.maximumAbsoluteDeltaNt===null?'—':`${h.maximumAbsoluteDeltaNt.toFixed(1)} nT`}</strong><small>{(h.observedCoverageSeconds/60).toFixed(1)} min usable coverage · {h.completeWindow?'complete':'partial'}</small></div>)}</div>

            {/* PRESCRIPTIVE SENSOR & SPACE WEATHER EVALUATION */}
            {prescriptiveReport && (
              <div style={{background:'#071729',borderRadius:'14px',padding:'16px',border:`1.5px solid ${prescriptiveReport.placementQuality.color}`,margin:'16px 0'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'10px',marginBottom:'14px'}}>
                  <div>
                    <span style={{fontSize:'10px',fontWeight:'800',color:'#8fa8c4',letterSpacing:'1px',display:'block',marginBottom:'2px'}}>
                      PRESCRIPTIVE DIAGNOSTIC EVALUATION
                    </span>
                    <h3 style={{margin:0,fontSize:'16px',fontWeight:'800',color:'#eff7ff'}}>
                      What Your Phone Recording Actually Means
                    </h3>
                  </div>
                  <div style={{display:'flex',gap:'8px'}}>
                    <span style={{fontSize:'11px',fontWeight:'800',padding:'4px 10px',borderRadius:'8px',background:`${prescriptiveReport.placementQuality.color}25`,color:prescriptiveReport.placementQuality.color,border:`1px solid ${prescriptiveReport.placementQuality.color}`}}>
                      {prescriptiveReport.placementQuality.badgeText}
                    </span>
                    <span style={{fontSize:'11px',fontWeight:'800',padding:'4px 10px',borderRadius:'8px',background:`${prescriptiveReport.activityLevel.color}25`,color:prescriptiveReport.activityLevel.color,border:`1px solid ${prescriptiveReport.activityLevel.color}`}}>
                      {prescriptiveReport.activityLevel.badgeText}
                    </span>
                  </div>
                </div>

                <div className="stat-row">
                  <Stat label="MEASURED BASELINE MAD" value={prescriptiveReport.placementQuality.noiseMadNt===null?'Unavailable':`${prescriptiveReport.placementQuality.noiseMadNt.toFixed(1)} nT`} detail="Local variation; not calibrated sensor accuracy"/>
                  <Stat label="LOCAL ABSOLUTE DEVIATION · p95" value={prescriptiveReport.activityLevel.p95DeltaNt===null?'Unavailable':`${prescriptiveReport.activityLevel.p95DeltaNt.toFixed(0)} nT`} detail="QC-usable samples; no Kp or NOAA G inference"/>
                  <Stat label="USABLE SAMPLE FRACTION" value={prescriptiveReport.placementQuality.score===null?'Unavailable':`${prescriptiveReport.placementQuality.score}%`} detail="Fraction passing deterministic sample screening"/>
                </div>
                <p className="fine">{prescriptiveReport.placementQuality.explanation}</p>
                <p className="fine">{prescriptiveReport.activityLevel.explanation} {prescriptiveReport.activityLevel.scientificMeaning}</p>

                {/* Section 3: Plain-English 10-Minute Timeline Story */}
                <div style={{background:'#05101d',borderRadius:'10px',padding:'12px',marginBottom:'14px',border:'1px solid #142a42'}}>
                  <span style={{fontSize:'11px',fontWeight:'800',color:'#ffd58c',display:'block',marginBottom:'8px'}}>
                    ⏱️ What the QC-usable intervals show:
                  </span>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))',gap:'8px'}}>
                    {prescriptiveReport.timelineStory.map((item, idx) => (
                      <div key={idx} style={{background:'#091a2b',padding:'8px 10px',borderRadius:'6px',borderLeft:`3px solid ${item.medianDeltaNt < -50 ? '#00e5ff' : item.medianDeltaNt > 50 ? '#ffd58c' : '#20c997'}`}}>
                        <strong style={{color:'#eff7ff',fontSize:'10.5px',display:'block',marginBottom:'3px'}}>{item.intervalLabel}</strong>
                        <span style={{color:'#b8d0e7',fontSize:'11px',lineHeight:'1.4'}}>{item.description}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 4: Central Database Submission & Aggregate Cross-Validation */}
                <div style={{background:'#081a2d',borderRadius:'10px',padding:'14px',border:'1px solid #1a3f66'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'10px'}}>
                    <div>
                      <strong style={{color:'#eff7ff',fontSize:'12.5px',display:'block'}}>
                        🌐 Central Citizen Magnetometer Database
                      </strong>
                      <span style={{color:'#9cbddc',fontSize:'11px'}}>
                        A single phone cannot confirm regional disturbance alone. Send your session to cross-validate against peer citizen phones and USGS Boulder.
                      </span>
                    </div>

                    {dbStatus === 'submitted' ? (
                      <div style={{background:'#0d382b',color:'#68edc3',padding:'8px 14px',borderRadius:'8px',border:'1px solid #20c997',fontSize:'12px',fontWeight:'bold',display:'flex',alignItems:'center',gap:'6px'}}>
                        <span>✅ Archived in Database (#{dbResult?.submissionId})</span>
                      </div>
                    ) : (
                      <button
                        onClick={submitToCentralDatabase}
                        disabled={dbStatus === 'submitting'}
                        style={{
                          background:'#1b4468',
                          border:'1px solid #00e5ff',
                          color:'#00e5ff',
                          padding:'8px 16px',
                          borderRadius:'8px',
                          fontSize:'12px',
                          fontWeight:'700',
                          cursor:'pointer',
                          display:'flex',
                          alignItems:'center',
                          gap:'6px',
                        }}
                      >
                        {dbStatus === 'submitting' ? '⏳ Archiving & Verifying SHA-256...' : '📤 Send Recording to Central Database'}
                      </button>
                    )}
                  </div>

                  {/* Aggregate Overview Box */}
                  {networkAggregate && (
                    <div style={{marginTop:'12px',paddingTop:'10px',borderTop:'1px solid #163654',display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))',gap:'8px',textAlign:'center'}}>
                      <div style={{background:'#05101a',padding:'6px',borderRadius:'6px'}}>
                        <div style={{fontSize:'8.5px',color:'#7e9cb8',fontWeight:'bold'}}>TOTAL SUBMISSIONS</div>
                        <div style={{fontSize:'13px',fontWeight:'800',color:'#eff7ff'}}>{networkAggregate.totalSubmissions}</div>
                      </div>
                      <div style={{background:'#05101a',padding:'6px',borderRadius:'6px'}}>
                        <div style={{fontSize:'8.5px',color:'#7e9cb8',fontWeight:'bold'}}>CLEAN BASELINES</div>
                        <div style={{fontSize:'13px',fontWeight:'800',color:'#20c997'}}>{networkAggregate.acceptedSubmissions}</div>
                      </div>
                      <div style={{background:'#05101a',padding:'6px',borderRadius:'6px'}}>
                        <div style={{fontSize:'8.5px',color:'#7e9cb8',fontWeight:'bold'}}>AVG NOISE FLOOR</div>
                        <div style={{fontSize:'13px',fontWeight:'800',color:'#ffd58c'}}>{networkAggregate.averageNoiseMadNt.toFixed(1)} nT</div>
                      </div>
                      <div style={{background:'#05101a',padding:'6px',borderRadius:'6px'}}>
                        <div style={{fontSize:'8.5px',color:'#7e9cb8',fontWeight:'bold'}}>REGIONAL VERDICT</div>
                        <div style={{fontSize:'11.5px',fontWeight:'800',color:'#ffd58c'}}>
                          {networkAggregate.regionalCoherence.coherenceScore !== null
                            ? `${(networkAggregate.regionalCoherence.coherenceScore * 100).toFixed(0)}% Coherent`
                            : 'INCONCLUSIVE (<3 sites)'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 5: Meta AI Multi-Model Intelligence Suite */}
                {metaSparkInsight && metaWonderCritique && metaAuroraAlert && (
                  <div style={{marginTop:'14px',display:'flex',flexDirection:'column',gap:'12px'}}>
                    <div style={{color:'#b9a5ff',fontSize:'10px',fontWeight:'800',letterSpacing:'1.2px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'6px'}}>
                      <span>SCIENTIFIC MEASUREMENT REVIEW</span>
                      <span style={{fontSize:'9.5px',color:'#ffd58c',fontWeight:'700',background:'#1b1408',padding:'2px 8px',borderRadius:'6px',border:'1px solid #594316'}}>
                        {metaSparkInsight.executionMode} · modelCalled: {String(metaSparkInsight.modelCalled)}
                      </span>
                    </div>

                    {/* Meta Muse Spark 1.3 Card */}
                    <div style={{background:'#081a2e',borderRadius:'10px',padding:'12px',border:'1px solid #1c426b'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px',flexWrap:'wrap',gap:'6px'}}>
                        <span style={{fontSize:'11.5px',fontWeight:'800',color:'#00e5ff'}}>{metaSparkInsight.modelCalled ? 'Muse Spark · Measurement review' : 'Local measurement analysis · no model call'}</span>
                        <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                          <span style={{fontSize:'10px',fontWeight:'800',padding:'2px 8px',borderRadius:'6px',background:'#ffd58c20',color:'#ffd58c',border:'1px solid #ffd58c'}}>
                            REGIONAL: {metaSparkInsight.regionalVerdict}
                          </span>
                          <span style={{fontSize:'10px',fontWeight:'800',padding:'2px 8px',borderRadius:'6px',background:'#00e5ff20',color:'#00e5ff',border:'1px solid #00e5ff'}}>
                            LOCAL: {metaSparkInsight.scientificVerdict}
                          </span>
                        </div>
                      </div>
                      <p style={{fontSize:'11.5px',color:'#eff7ff',lineHeight:'1.5',margin:'0 0 8px 0'}}>
                        {metaSparkInsight.narrative}
                      </p>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))',gap:'6px',fontSize:'10.5px',background:'#040d1a',padding:'8px',borderRadius:'6px',color:'#c3d9ed'}}>
                        <div>• Solar Cause: <strong style={{color:'#ffd58c'}}>Not established</strong></div>
                        <div>• Frequency Attribution: <strong style={{color:'#00e5ff'}}>Not evaluated</strong></div>
                        <div>• Baseline MAD: <strong style={{color:'#ffd58c'}}>{qc?.noiseMadNt?.toFixed(1) ?? 'Unknown'} nT (measured baseline variation)</strong></div>
                      </div>
                    </div>

                    {/* Meta Muse Wonder Red-Team Card */}
                    <div style={{background:'#161124',borderRadius:'10px',padding:'12px',border:'1px solid #362554'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px',flexWrap:'wrap',gap:'6px'}}>
                        <span style={{fontSize:'11.5px',fontWeight:'800',color:'#b9a5ff'}}>Local scientific critique · no model call</span>
                        <span style={{fontSize:'10px',fontWeight:'800',padding:'2px 8px',borderRadius:'6px',background:'#ffd58c20',color:'#ffd58c',border:'1px solid #ffd58c'}}>
                          {metaWonderCritique.critiqueStatus}
                        </span>
                      </div>
                      <div style={{fontSize:'11px',color:'#e4d8f5',lineHeight:'1.5'}}>
                        <strong style={{color:'#ffd58c'}}>Skeptical Invariant Challenges:</strong>
                        <ul style={{margin:'4px 0 6px 16px',padding:0}}>
                          {metaWonderCritique.skepticalChallenges.map((ch, i) => (
                            <li key={i} style={{marginBottom:'3px'}}>{ch}</li>
                          ))}
                        </ul>
                        <div style={{background:'#0c0816',padding:'6px 10px',borderRadius:'6px',marginTop:'4px',borderLeft:'3px solid #b9a5ff'}}>
                          <strong style={{color:'#b9a5ff'}}>Authoritative Validator Gate: </strong>
                          <span>{metaWonderCritique.verdictAdjustment}</span>
                        </div>
                      </div>
                    </div>

                    {/* Proactive Aurora Alert & SAM 3.1 Card */}
                    <div style={{background:'#1c0e1e',borderRadius:'10px',padding:'12px',border:`1px solid ${metaAuroraAlert.alertColor}`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px',flexWrap:'wrap',gap:'6px'}}>
                        <span style={{fontSize:'11.5px',fontWeight:'800',color:metaAuroraAlert.alertColor}}>🌟 Local Aurora Evidence &amp; Viewing Guidance</span>
                        <span style={{fontSize:'10px',fontWeight:'800',padding:'2px 8px',borderRadius:'6px',background:`${metaAuroraAlert.alertColor}25`,color:metaAuroraAlert.alertColor,border:`1px solid ${metaAuroraAlert.alertColor}`}}>
                          {metaAuroraAlert.alertLevel}
                        </span>
                      </div>
                      <p style={{fontSize:'11.5px',color:'#eff7ff',lineHeight:'1.5',margin:'0 0 8px 0'}}>
                        {metaAuroraAlert.summary}
                      </p>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',gap:'6px',fontSize:'10.5px',background:'#09040b',padding:'8px',borderRadius:'6px',marginBottom:'8px'}}>
                        <div>• Optimal Window: <strong style={{color:'#eff7ff'}}>{metaAuroraAlert.optimalViewingWindow}</strong></div>
                        <div>• Look Direction: <strong style={{color:'#eff7ff'}}>{metaAuroraAlert.viewingDirection}</strong></div>
                        <div>• Optical Claim: <strong style={{color:'#ffd58c'}}>Not Established (0 sightings)</strong></div>
                      </div>

                      {/* Meta SAM 3.1 Optical Segmentation */}
                      <div style={{background:'#0f0812',borderRadius:'6px',padding:'8px',border:'1px solid #36173b'}}>
                        <div style={{fontSize:'10px',fontWeight:'800',color:'#b9a5ff',marginBottom:'3px'}}>
                          Optical segmentation concept · no model call ({metaSamResult.executionMode})
                        </div>
                        <div style={{fontSize:'10px',color:'#9cbddc',marginBottom:'4px'}}>
                          {metaSamResult.provenanceNote}
                        </div>
                        <div style={{fontSize:'10.5px',color:'#cfa5d8',display:'flex',flexWrap:'wrap',gap:'10px'}}>
                          {metaSamResult.masks.map((m, i) => (
                            <span key={i}>
                              • {m.label.replace('AURORAL_EMISSION_', '').replace('_', ' ')}: <strong style={{color:'#eff7ff'}}>{m.areaPercentage}%</strong> ({m.spectralBand})
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button className="text-button" onClick={()=>{setSession(null);record('PHONE_SESSION_FORGOTTEN','Removed imported data from component memory');}}>Forget imported session</button></>}
            <div className="import-row"><label className="secondary-button">Import sensor JSON<input type="file" accept=".json,application/json" onChange={e=>{void importSession(e.target.files?.[0]);e.target.value='';}}/></label><small>Processed locally in this browser. No upload.</small></div>{fileError&&<p className="error" role="alert">{fileError}</p>}
          </section>
          <section className="panel"><div className="panel-heading"><div><h3>{mode==='replay'?'Professional reference · Boulder':'Professional ground reference'}</h3><p>Independent observatory measurements</p></div><Badge tone="mint">{mode==='replay'?'HISTORICAL OBSERVATORY':'LIVE USGS'}</Badge></div>{mode==='replay'?<><Chart points={referencePoints} label={`USGS Boulder ${reference?.component??'F'} absolute magnetic field in nanotesla`} unit="nT"/><Source name={`USGS BOU · ${reference?.component??'F'} · ${reference?.status??'unknown status'}`} url={reference?.sourceUrl??'https://geomag.usgs.gov/'} time={reference?.retrievedAtUtc}/><p className="fine">Absolute {reference?.component==='F'?'scalar field magnitude':'geographic component'} · 1-minute cadence · retrospective adjusted record. Original operational availability is unknown. Historical reference is not evidence of a current phone correlation.</p></>:<><LiveReferencePanel session={session} qc={qc} coarseLocation={chosen} upstream={wind}/><p className="fine">{chosen?'Reference selected for your approximate current area.':browserLocation.status==='locating'?'Finding your area; checking reporting stations in parallel.':'Checking available stations; location permission enables proximity ranking.'} Imported recordings do not inherit this device’s current location.</p>{!chosen&&<button className="text-button" onClick={browserLocation.refresh} disabled={browserLocation.status==='locating'}>Use my location</button>}</>}</section>
        </>}
      </div>

      <aside className="secondary-column"><RecordedMetaRun/><section className="panel coordinator-panel"><div className="coordinator-heading"><span className="spark-box"><Icon name="spark" size={22}/></span><div><h3>Observation coordinator</h3><span>Evidence before conclusions</span></div></div><Badge tone="amber">SCRIPTED POLICY DEMO · NO MODEL CALL</Badge><h3 className="agent-question">One phone.<br/>Enough evidence?</h3><p>A local spike needs quality checks and geographically independent observations before it can support a regional claim.</p><div className="coverage-summary"><span>Real independent phone sites</span><strong>0</strong></div><div className="coverage-summary"><span>Verified optical observations</span><strong>0</strong></div><div className="agent-steps"><span><Icon name="check" size={14}/> Inspect evidence</span><span><Icon name="check" size={14}/> Find a coverage gap</span><span><Icon name="check" size={14}/> Request an opted-in observation</span><span><Icon name="check" size={14}/> Run deterministic validation</span></div><button className="primary-button full" onClick={runAgent}><Icon name="spark" size={16}/>{agent?'Replay policy workflow':'Run policy workflow'}</button><p className="fine">Synthetic May 2024 scenario · simulated adult volunteer · local audit only. Genuine Muse Spark and persisted invitations require configured services.</p>{agent&&<div className="agent-result" aria-live="polite"><Badge tone="amber">{agent.verdict}</Badge><p>Regional evidence remains inconclusive. This synthetic workflow contains a contaminated phone and lacks independently verified real sites and a matching professional reference.</p><details><summary>{agent.timeline.length} audited tool actions</summary><ol className="audit-list">{agent.timeline.map(item=><li key={item.id}><strong>{item.tool}</strong><span>{item.status} · {formatUtc(item.atUtc)}</span></li>)}</ol></details><button className="text-button" onClick={()=>download('aurorasense-scripted-policy-audit.json',agent)}>Export workflow evidence <Icon name="external" size={13}/></button></div>}</section>
        <section className="panel evidence-key"><div className="eyebrow">READ THE LABELS</div><h3>Different evidence.<br/>Different meaning.</h3><p><span className="layer-dot violet"/><strong>Modeled</strong> tells us what may happen.</p><p><span className="layer-dot mint"/><strong>Measured</strong> tells us what an instrument recorded.</p><p><span className="layer-dot amber"/><strong>Confirmed optical</strong> tells us aurora was seen.</p><div className="notice">Magnetic disturbance ≠ guaranteed visible aurora.</div></section>
        <button className="why-card" onClick={()=>setDrawer('why')}><Icon name="book" size={24}/><span><strong>How does the sky glow?</strong><small>Follow the five-step science story.</small></span><Icon name="arrow" size={18}/></button>
      </aside></div>
      <footer><span><span className="status-dot"/> AuroraSense · Scientific prototype</span><button className="text-button" onClick={()=>setDrawer('research')}>Sources, methods & limitations <Icon name="arrow" size={14}/></button><span>Real data. Clear uncertainty.</span></footer>
    </main>

    <dialog ref={dialog} onCancel={closeDrawer} onClick={e=>{if(e.target===dialog.current)closeDrawer();}}><div className="drawer-content"><button className="close-button" aria-label="Close panel" onClick={closeDrawer}><Icon name="close"/></button>
      {drawer==='why'&&<><div className="eyebrow">WHY? / FROM SUN TO SKY</div><h2>{WHY[whyStep].title}</h2><div className="story-steps" aria-label="Explanation step">{WHY.map((step,i)=><button key={step.title} className={i===whyStep?'active':''} onClick={()=>setWhyStep(i)} aria-label={`Step ${i+1}: ${step.title}`}>{i+1}</button>)}</div><div className="story-art"><Icon name={(['storm','spark','map','sensor','spark'] as IconName[])[whyStep]} size={100}/><span>Conceptual diagram · not instrument imagery</span></div><Badge tone="violet">{WHY[whyStep].tag}</Badge><p className="story-text">{WHY[whyStep].text}</p><div className="notice">{WHY[whyStep].note}</div><Source name="NOAA · Aurora science" url="https://www.swpc.noaa.gov/phenomena/aurora"/><Source name="NASA · Heliophysics" url="https://science.nasa.gov/heliophysics/"/><div className="dialog-buttons"><button className="secondary-button" disabled={whyStep===0} onClick={()=>setWhyStep(s=>s-1)}>Previous</button><button className="primary-button" onClick={()=>whyStep===4?setDrawer(null):setWhyStep(s=>s+1)}>{whyStep===4?'Back to the evidence':'Next step'}<Icon name="arrow" size={15}/></button></div></>}
      {drawer==='capture'&&<><div className="eyebrow">PHYSICAL SENSOR EXPERIMENT</div><h2>Let your phone measure.</h2><p>The native Expo collector is required; this browser does not claim magnetometer access.</p><ol className="instructions"><li>Start the mobile app with <code>npm start</code> in <code>apps/mobile</code>, then open it on a physical phone using the matching Expo client.</li><li>Tap <strong>Explore Magnetic Bloom</strong>: wave your hand, watch, or jewelry near the phone to hear an ambient generative soundscape inspired by Brian Eno's Bloom and watch the magnetic field lines warp around your phone.</li><li>Read the adult participation and recording consent. Place the phone on a stable, nonmagnetic support.</li><li>Record a 10-minute session. Keep the first two minutes still for the baseline.</li><li>Mark a short local-interference interval and bring a small magnetic accessory nearby without contact. Record motion separately.</li><li>Stop, export the JSON, and import it here. Check raw axes, magnitude, cadence, flags and actual usable coverage.</li></ol>
      <div className="notice" style={{marginTop:'18px',padding:'18px',borderRadius:'16px',background:'#071526',border:'1px solid #1a334d'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'10px',marginBottom:'12px'}}>
          <div>
            <div style={{color:'var(--mint)',fontSize:'10px',fontWeight:'800',letterSpacing:'1.2px'}}>INTERACTIVE FIELD &amp; LOCAL GUESS SIMULATOR</div>
            <h3 style={{margin:'4px 0',color:'#eff7ff',fontSize:'16px'}}>A synthetic magnetic pattern challenge</h3>
            <p style={{margin:0,fontSize:'12px',color:'#b0c1d4'}}>This synthetic signal drives a label-free heuristic guess, not a Muse Spark call. Field lines are conceptual, not a reconstructed field.</p>
          </div>
          <button className="secondary-button" onClick={toggleWebAudio} style={{padding:'8px 14px',fontSize:'12px'}}>
            <Icon name="spark" size={14}/> {webAudioRunning?'Stop Humming':'Start Ambient Humming 🔊'}
          </button>
        </div>

        {/* Real-time Field Streamline Visualizer */}
        <div style={{display:'flex',justifyContent:'center',background:'#040e1a',borderRadius:'12px',padding:'12px 6px',border:'1px solid #14273d',marginBottom:'14px'}}>
          <svg width="320" height="150" viewBox="0 0 320 150">
            <defs>
              <linearGradient id="webFieldGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#4dd0e1" stopOpacity="0.3"/>
                <stop offset="50%" stopColor={webClassification.metadata.color} stopOpacity="0.8"/>
                <stop offset="100%" stopColor="#b9a5ff" stopOpacity="0.3"/>
              </linearGradient>
            </defs>
            {/* Ambient reference field lines */}
            {[-90,-45,0,45,90].map((xOff,i)=>(
              <line key={i} x1={160+xOff} y1={6} x2={160+xOff} y2={144} stroke="#17314d" strokeWidth="1" strokeDasharray="3 4"/>
            ))}
            {/* Warped flux streamlines */}
            {[-100,-70,-45,-20,20,45,70,100].map((offset,i)=>{
              const warp=(simDisturbance/15)*25;
              const cpX=160+offset+(offset>0?1:-1)*(30+Math.abs(offset)*0.2)+warp;
              return <path key={i} d={`M ${160+offset*0.8} 142 C ${cpX} 100, ${cpX} 50, ${160+offset*0.8} 8`} fill="none" stroke="url(#webFieldGrad)" strokeWidth={simDisturbance>2?2:1.4}/>;
            })}
            {/* Phone Body */}
            <rect x="135" y="38" width="50" height="84" rx="10" fill="#061220" stroke="#2d4866" strokeWidth="1.5"/>
            <rect x="138" y="42" width="44" height="76" rx="7" fill="#0a1a2b"/>
            <circle cx="160" cy="58" r="4" fill={webClassification.metadata.color}/>
            <circle cx="160" cy="58" r="8" fill="none" stroke={webClassification.metadata.color} strokeWidth="1" strokeDasharray="2 2"/>
            <text x="160" y="80" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">+{simDisturbance.toFixed(1)} µT</text>
            <text x="160" y="93" fill={webClassification.metadata.color} fontSize="7.5" fontWeight="bold" textAnchor="middle">{(simDisturbance*1000).toFixed(0)} nT</text>
          </svg>
        </div>

        {/* Multi-modal Physical Sensor Context Toggles */}
        <div style={{background:'#071626',borderRadius:'10px',padding:'10px 12px',border:'1px solid #1a3552',marginBottom:'12px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
            <span style={{fontSize:'9.5px',fontWeight:'800',color:'#7fa1c4',letterSpacing:'0.8px'}}>MULTI-MODAL PHYSICAL SENSORS</span>
            <span style={{fontSize:'10px',color:'#68edc3',fontWeight:'bold'}}>Synthetic inputs</span>
          </div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            <button
              onClick={() => setSimStandstill(!simStandstill)}
              style={{
                flex:1,
                padding:'6px 8px',
                borderRadius:'6px',
                border: `1px solid ${simStandstill ? '#68edc3' : '#ff7043'}`,
                background: simStandstill ? '#68edc320' : '#ff704320',
                color: simStandstill ? '#68edc3' : '#ff7043',
                fontSize:'10.5px',
                fontWeight:'bold',
                cursor:'pointer',
              }}
            >
              {simStandstill ? '🛑 Standstill (Still)' : '🏃 In Motion'}
            </button>

            <button
              onClick={() => setSimTouched(!simTouched)}
              style={{
                flex:1,
                padding:'6px 8px',
                borderRadius:'6px',
                border: `1px solid ${simTouched ? '#b9a5ff' : '#223c58'}`,
                background: simTouched ? '#b9a5ff25' : '#0a1727',
                color: simTouched ? '#b9a5ff' : '#8fa8c4',
                fontSize:'10.5px',
                fontWeight:'bold',
                cursor:'pointer',
              }}
            >
              {simTouched ? '👆 Screen Touched' : '✋ Hands Off'}
            </button>

            <button
              onClick={() => setSimCharging(!simCharging)}
              style={{
                flex:1,
                padding:'6px 8px',
                borderRadius:'6px',
                border: `1px solid ${simCharging ? '#ffb74d' : '#223c58'}`,
                background: simCharging ? '#ffb74d22' : '#0a1727',
                color: simCharging ? '#ffb74d' : '#8fa8c4',
                fontSize:'10.5px',
                fontWeight:'bold',
                cursor:'pointer',
              }}
            >
              {simCharging ? '⚡ Charging Active' : '🔋 On Battery'}
            </button>
          </div>
        </div>

        {/* Electromagnetic Disturbance Scale Bar */}
        <div style={{background:'#081626',borderRadius:'10px',padding:'12px',border:'1px solid #1a3552',marginBottom:'12px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
            <span style={{fontSize:'10px',fontWeight:'800',color:'#8fa8c4',letterSpacing:'0.8px'}}>ELECTROMAGNETIC DISTURBANCE SCALE</span>
            <span style={{fontSize:'11px',fontWeight:'bold',color:webClassification.metadata.color,background:'#05101a',padding:'2px 8px',borderRadius:'6px',border:`1px solid ${webClassification.metadata.color}`}}>
              📍 Signal: +{simDisturbance.toFixed(1)} µT ({(simDisturbance * 1000).toFixed(0)} nT)
            </span>
          </div>

          {/* Segmented Visual Scale Bar */}
          <div style={{position:'relative',height:'16px',borderRadius:'8px',overflow:'hidden',display:'flex',marginBottom:'6px'}}>
            <div style={{width:'20%',background:'#4dd0e1',opacity:simDisturbance <= 0.5 ? 1 : 0.6}} title="Local deviation ≤500 nT; cause unknown"/>
            <div style={{width:'22%',background:'#64b5f6',opacity:simDisturbance > 0.5 && simDisturbance <= 3.8 ? 1 : 0.6}} title="Local deviation 500–3,800 nT; cause unknown"/>
            <div style={{width:'22%',background:'#ffb74d',opacity:simDisturbance > 3.8 && simDisturbance <= 15 ? 1 : 0.6}} title="Local deviation 3,800–15,000 nT; cause unknown"/>
            <div style={{width:'18%',background:'#ba68c8',opacity:simDisturbance > 15 && simDisturbance <= 35 ? 1 : 0.6}} title="Local deviation 15,000–35,000 nT; cause unknown"/>
            <div style={{width:'18%',background:'#ff7043',opacity:simDisturbance > 35 ? 1 : 0.6}} title="Local deviation >35,000 nT; cause unknown"/>

            {/* Sliding Indicator Needle */}
            <div
              style={{
                position:'absolute',
                top:'0',
                bottom:'0',
                left:`${Math.min(98, Math.max(2, (simDisturbance / 50) * 100))}%`,
                width:'4px',
                background:'#ffffff',
                boxShadow:'0 0 6px #fff',
                borderRadius:'2px',
                transform:'translateX(-50%)',
                pointerEvents:'none',
              }}
            />
          </div>

          <div style={{display:'flex',justifyContent:'space-between',fontSize:'9px',color:'#7693b0',fontWeight:'600'}}>
            <span>0 nT (Quiet)</span>
            <span>500 nT</span>
            <span>3.8 µT</span>
            <span>15 µT</span>
            <span>35 µT</span>
            <span>50+ µT</span>
          </div>
        </div>

        <button className="secondary-button" onClick={()=>setSimTrial(value=>value+1)}>Replay synthetic sample</button>
        <p className="fine">SYNTHETIC PHONE SIMULATION · changing the trace does not teach, label or save an object identity.</p>
        {/* Local pattern guess & explainability */}
        <div style={{background:'#0c1b2c',borderRadius:'10px',padding:'14px',border:`1.5px solid ${webClassification.metadata.color}`,marginBottom:'12px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
            <span style={{fontSize:'13.5px',fontWeight:'700',color:webClassification.metadata.color}}>
              {webClassification.metadata.icon} AuroraSense guesses: {webGuess.headline}
            </span>
            <span style={{fontSize:'9px',fontWeight:'bold',color:webClassification.metadata.color,background:`${webClassification.metadata.color}22`,padding:'3px 8px',borderRadius:'6px'}}>LOCAL HEURISTIC · TENTATIVE</span>
          </div>
          <p style={{fontSize:'11.5px',color:'#dbe7f5',lineHeight:'1.4',margin:'0 0 8px'}}>{webGuess.playfulLine}</p>

          {/* Dynamic classifier reasoning */}
          <div style={{background:'#071422',borderRadius:'6px',padding:'8px 10px',marginBottom:'10px',borderLeft:`3px solid ${webClassification.metadata.color}`}}>
            <strong style={{fontSize:'10.5px',color:'#ffd58c',display:'block',marginBottom:'3px'}}>💡 Why this is the guess:</strong>
            <span style={{fontSize:'11.5px',color:'#dbe7f5',lineHeight:'1.4'}}>{webClassification.aiReasoning}</span>
          </div>

          {/* Electrodynamics Metrics Grid */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:'6px',background:'#06101c',padding:'8px',borderRadius:'6px',marginBottom:'10px',textAlign:'center'}}>
            <div>
              <div style={{fontSize:'8.5px',color:'#7e9cb8',fontWeight:'bold'}}>Rate of Change</div>
              <div style={{fontSize:'11px',fontWeight:'bold',color:'#eff7ff'}}>{webClassification.signature.rateOfChangeMicroTPerSec.toFixed(1)} µT/s</div>
            </div>
            <div>
              <div style={{fontSize:'8.5px',color:'#7e9cb8',fontWeight:'bold'}}>Polarization</div>
              <div style={{fontSize:'11px',fontWeight:'bold',color:'#eff7ff'}}>{(webClassification.signature.polarizationRatio * 100).toFixed(0)}%</div>
            </div>
            <div>
              <div style={{fontSize:'8.5px',color:'#7e9cb8',fontWeight:'bold'}}>Jitter Ripple</div>
              <div style={{fontSize:'11px',fontWeight:'bold',color:'#eff7ff'}}>{(webClassification.signature.jitterRatio * 100).toFixed(0)}%</div>
            </div>
            <div><div style={{fontSize:'8.5px',color:'#7e9cb8',fontWeight:'bold'}}>Sample window</div><div style={{fontSize:'11px',fontWeight:'bold',color:'#eff7ff'}}>{webClassification.signature.sampleCount} points</div></div>
          </div>
          <p className="fine" style={{margin:0}}>No numeric confidence is shown: this local rule-based pattern guess is uncalibrated and is not a Muse Spark response.</p>
        </div>

        {/* Interactive Hand Slider */}
        <label style={{display:'flex',alignItems:'center',gap:'10px',fontSize:'11.5px',flexWrap:'wrap',marginBottom:'12px'}}>
          <span style={{fontWeight:'bold',color:'#eff7ff'}}>Simulate Local Field Change:</span>
          <input type="range" min="0" max="50" step="0.2" value={simDisturbance} onChange={e=>updateWebAudio(Number(e.target.value))} style={{flex:1,minWidth:'180px'}}/>
          <strong style={{color:webClassification.metadata.color,fontVariantNumeric:'tabular-nums'}}>
            +{simDisturbance.toFixed(1)} µT ({(simDisturbance*1000).toFixed(0)} nT)
          </strong>
        </label>

        {/* Space Weather Detection Levels & Granite Window Sill Science Guide */}
        <details style={{background:'#06111d',padding:'10px 12px',borderRadius:'8px',border:'1px solid #16324f',fontSize:'11px',color:'#c2d4e7'}}>
          <summary style={{fontWeight:'bold',color:'#00e5ff',cursor:'pointer',fontSize:'11.5px'}}>
            ☀️ Space Weather Detection Levels &amp; Granite Window Sill Science Guide
          </summary>
          <div style={{marginTop:'8px',lineHeight:'1.5'}}>
            <p style={{margin:'4px 0 8px 0',color:'#eff7ff',fontWeight:'600'}}>
              What magnetic field levels can a smartphone actually detect from solar wind reconnection?
            </p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',gap:'8px',marginBottom:'10px'}}>
              {SPACE_WEATHER_GROUND_SCALES.map(tier => (
                <div key={tier.noaaScale} style={{background:'#091b2c',padding:'8px',borderRadius:'6px',border:'1px solid #1c3b5c'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'3px'}}>
                    <strong style={{color:'#00e5ff'}}>{tier.noaaScale} ({tier.kpIndex})</strong>
                    <span style={{color:'#ffd58c',fontWeight:'bold',fontSize:'10px'}}>No universal phone Δ|B| threshold</span>
                  </div>
                  <div style={{color:'#eff7ff',fontSize:'10.5px',fontWeight:'600'}}>{tier.name}</div>
                  <div style={{color:'#8fa8c4',fontSize:'9.5px',marginTop:'4px'}}>{tier.phoneDetectability}</div>
                </div>
              ))}
            </div>

            <div style={{background:'#0b1f33',padding:'8px 10px',borderRadius:'6px',borderLeft:'3px solid #ffd58c',marginBottom:'8px'}}>
              <strong style={{color:'#ffd58c',display:'block',marginBottom:'3px'}}>🪨 The Granite Window Sill Phenomenon:</strong>
              <span>{GRANITE_WINDOWSILL_PHYSICS.materialComposition} Surface magnetic offsets vary and have not been measured here. {GRANITE_WINDOWSILL_PHYSICS.windowSillAdvantage} Tap <strong>↺ ZERO</strong> while stationary to set a local baseline. This does not isolate solar disturbances.</span>
            </div>

            <div style={{background:'#0a1c2e',padding:'8px 10px',borderRadius:'6px',borderLeft:'3px solid #68edc3'}}>
              <strong style={{color:'#68edc3',display:'block',marginBottom:'3px'}}>How local patterns are screened:</strong>
              <span>Solar storm ionospheric deflections move over minutes (dB/dt &lt; 0.20 µT/s). Human hand gestures and permanent magnets shift fields in seconds (dB/dt &gt; 1.0–5.0 µT/s) — over 1,000x faster! Sensor fusion of verified accelerometer STANDSTILL, capacitive HANDS OFF, and battery power prevents false positives.</span>
            </div>
          </div>
        </details>
      </div>
      <div className="notice">A real recording is still required. Synthetic tests do not establish device accuracy or storm sensitivity. Do not share identifying locations; the collector does not request GPS.</div><p className="fine">Foreground only. Backgrounding or withdrawing consent stops recording. Export is an explicit local sharing action; hosted upload is not configured.</p></>}
      {drawer==='research'&&<><div className="eyebrow">RESEARCH / TRACE THE CLAIM</div><h2>The evidence is inspectable.</h2><h3>Learning experiment</h3><EvaluationPanel data={evaluation}/><h3>Source manifests</h3><p className="fine">Source checksums refer to the retrieved upstream bytes. Provider submissions are not independently archived page vintages.</p>{catalog.manifests.map((m,i)=><details className="details" key={i}><summary>{String(m.sourceId??`Source ${i+1}`)}</summary><pre className="json-output">{JSON.stringify(m,null,2)}</pre></details>)}<h3>Limitations</h3><ul className="limitations">{catalog.limitations.map(l=><li key={l}>{l}</li>)}</ul><h3>Demo audit · this browser session</h3><p className="fine">Append-only in memory. Reset retains the prior trail; export it before closing. Hosted persistence is not configured.</p><ol className="audit-list">{audit.map(a=><li key={a.sequence}><strong>{a.action}</strong><span>{formatUtc(a.atUtc)} · {a.detail}</span></li>)}</ol><div className="dialog-buttons"><button className="secondary-button" onClick={()=>download('aurorasense-source-manifest.json',{generatedAtUtc:catalog.generatedAtUtc,manifests:catalog.manifests,limitations:catalog.limitations})}>Export sources</button><button className="primary-button" onClick={()=>download('aurorasense-demo-audit.json',{actions:audit,coordinator:agent})}>Export audit</button></div></>}
    </div></dialog>
  </div>;
}
