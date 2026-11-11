import {useEffect,useState} from 'react';import {FlaskConical,MapPin,Clock,Footprints,ShieldCheck,DoorOpen,RefreshCw} from 'lucide-react';
import {useApp} from '../AppContext.js';import {lv,LV,NAMES,ago,fmt} from '../lib.js';import {KEYS} from '../services/apiController.js';
export const TypeBadge=({type})=>type==='MEASUREMENT'
  ?<span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"/><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"/></span>LIVE GROUND MEASUREMENT</span>
  :<span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 font-semibold"><FlaskConical size={12}/>MODEL ESTIMATE (not a ground reading)</span>;
const CITIES=[["New Delhi, India",28.61,77.21,"in"],["Mumbai, India",19.08,72.88,"in"],["Kolkata, India",22.57,88.36,"in"],["Beijing, China",39.9,116.41,"cn"],["London, UK",51.51,-0.13,"gb"],["New York, USA",40.71,-74.01,"us"]];
const OUT=['Great day to be outside','Fine for most; sensitive people go easy','Limit long outdoor exertion','Avoid strenuous outdoor activity','Stay indoors','Do not go outside'];
const MASK=['Not needed','Not needed','Optional for sensitive people','N95 recommended','N95 outdoors','N95/FFP2 essential'];
const WIN=['Open freely','Open, avoid rush hour','Short airing only','Keep closed, use purifier','Keep sealed, HEPA purifier','Seal room, HEPA purifier'];
function useCount(t){const[n,setN]=useState(0);
  useEffect(()=>{let raf;const s=performance.now(),tick=now=>{const p=Math.min(1,(now-s)/1000);setN(Math.round(t*(1-Math.pow(1-p,3))));if(p<1)raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)},[t]);return n}
export default function Dashboard(){
  const{air,loading,err,place,setPlace,refresh}=useApp(),[v,setV]=useState(0),[go,setGo]=useState(false),[,tick]=useState(0),[spin,setSpin]=useState(false),n=useCount(air?.aqi||0);
  useEffect(()=>{const i=setInterval(()=>tick(x=>x+1),30000);return()=>clearInterval(i)},[]);
  useEffect(()=>{setV(0);setGo(false);const t=setTimeout(()=>{setV(air?.aqi||0);setGo(true)},80);return()=>clearTimeout(t)},[air]);
  const chips=<div className="lg:col-span-2 flex flex-wrap gap-2 items-center text-sm"><span className="text-slate-500">Try:</span>{CITIES.map(([c,lat,lon,cc])=>
    <button key={c} onClick={()=>setPlace({label:c,lat,lon,cc})} className="px-3 py-1 rounded-full bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 hover:-translate-y-0.5">{c}</button>)}</div>;
  if(loading)return<div className="max-w-6xl mx-auto p-4 grid gap-4 lg:grid-cols-[380px_1fr]">{chips}<div className="skeleton h-[470px]"/><div className="grid grid-cols-2 md:grid-cols-3 gap-4 content-start">{KEYS.map(k=><div key={k} className="skeleton h-36"/>)}<div className="skeleton h-28 col-span-full"/></div></div>;
  if(!air)return<div className="max-w-6xl mx-auto p-4 grid gap-4">{chips}<p className="p-10 text-center text-red-600 max-w-xl mx-auto">{err}</p></div>;
  const L=lv(air.aqi),R=90,C=2*Math.PI*R,cur=LV.findIndex(l=>air.aqi<=l[0]);
  return<div className="max-w-6xl mx-auto p-4 grid gap-4 lg:grid-cols-[380px_1fr]">
    <div className="lg:col-span-2 rise"><h1 className="text-2xl md:text-3xl font-bold text-emerald-900">{place.label}</h1><p className="text-sm text-slate-500 flex flex-wrap items-center gap-2">Reported {fmt(air.updated)} ({ago(air.updated)}) · checked {ago(air.fetchedAt)}<button onClick={()=>{setSpin(true);refresh().finally(()=>setSpin(false))}} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs"><RefreshCw size={12} className={spin?'animate-spin':''}/>Refresh</button></p></div>
    {chips}
    <section className="glass p-6 text-center rise" style={{background:`linear-gradient(180deg,${L.color}30,#fff 58%)`}}>
      <svg viewBox="0 0 220 220" className="mx-auto w-64" style={{filter:`drop-shadow(0 8px 16px ${L.color}66)`}} role="img" aria-label={`AQI ${air.aqi}, ${L.name}`}>
        <circle cx="110" cy="110" r={R} fill="none" stroke="#e2e8f0" strokeWidth="16"/>
        <circle cx="110" cy="110" r={R} fill="none" stroke={L.color} strokeWidth="16" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C*(1-Math.min(v,500)/500)} transform="rotate(-90 110 110)" style={{transition:'stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1), stroke .6s'}}/>
        <text x="110" y="118" textAnchor="middle" fontSize="56" fontWeight="700" fill={L.text}>{n}</text>
        <text x="110" y="146" textAnchor="middle" fontSize="13" fill="#64748b">{air.std==='in'?'India NAQI':'US AQI'}</text></svg>
      <p className="text-xl font-bold" style={{color:L.text}}>{L.name}</p><p className="text-sm opacity-70 mt-1">{L.note}</p>
      <div className="mt-4 text-left text-sm space-y-2 border-t border-emerald-100 pt-4">
        <TypeBadge type={air.type}/>
        <p><b>Source:</b> {air.source}</p><p className="flex gap-1"><MapPin size={15} className="mt-0.5 shrink-0 text-emerald-600"/>{air.station}</p>
        {air.type==='MEASUREMENT'&&<p><b>Distance:</b> {air.distanceKm} km {air.distanceKm>1?'(nearest station used)':'(at location)'}</p>}
        <p className="flex gap-1 items-center"><Clock size={15} className="text-emerald-600"/>{fmt(air.updated)} · {ago(air.updated)}</p><p className="text-[11px] text-slate-400 font-mono break-all">{air.updated}</p>{(air.stale||(air.type==='MEASUREMENT'&&Date.now()-new Date(air.updated)>108e5))&&<p className="text-xs text-amber-700">This station last reported {ago(air.updated)}. The freshest source available is shown.</p>}
        {air.converted&&<p className="text-xs text-amber-700">NAQI estimated by converting this station's US-scale readings.</p>}{air.dominant&&<p className="text-xs opacity-70">Dominant pollutant: {NAMES[air.dominant]}</p>}
        {air.errors.length>0&&<p className="text-xs opacity-50">Fallback used — {air.errors.join(' • ')}</p>}</div></section>
    <div className="space-y-4">
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4 stagger">{KEYS.map(k=>{const p=air.pollutants[k],l=p?.sub!=null?lv(p.sub):null;
        return<div key={k} className="glass p-4 lift"><div className="flex justify-between items-center gap-2"><span className="font-bold">{NAMES[k]}</span>
          <span className="text-[10px] leading-tight text-right px-2 py-0.5 rounded-full font-semibold max-w-[110px]" style={{background:(l?.color||'#94a3b8')+'33',color:l?.text||'#64748b'}}>{l?.name||'n/a'}</span></div>
          <p className="text-3xl font-bold mt-3">{p?p.value:'—'}</p><p className="text-xs opacity-60">{p?.unit||'not reported'}</p>
          <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{width:go&&p?.sub!=null?Math.min(100,p.sub/3)+'%':'0%',background:l?.color||'#94a3b8',transition:'width 1.2s cubic-bezier(.2,.7,.2,1)'}}/></div></div>})}</section>
      <section className="glass p-5 rise" style={{animationDelay:'.35s'}}><h2 className="font-bold mb-3">What this means right now</h2>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">{[[Footprints,'Outdoor activity',OUT],[ShieldCheck,'Mask',MASK],[DoorOpen,'Windows',WIN]].map(([I,t,A])=>
          <div key={t} className="rounded-xl bg-emerald-50 p-3 lift"><I size={18} className="text-emerald-600 mb-1"/><p className="text-xs text-slate-500">{t}</p><p className="font-semibold">{A[cur]}</p></div>)}</div></section></div></div>;
}
