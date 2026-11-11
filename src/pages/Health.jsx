import {LV,lv,getScale} from '../lib.js';import {useEffect,useState} from 'react';import {Sparkles} from 'lucide-react';import {useApp} from '../AppContext.js';import {advise} from '../services/groq.js';import {Wind,Baby,HeartPulse,Dumbbell,Users} from 'lucide-react';
const RU=['0–50','51–100','101–150','151–200','201–300','301–500'],RI=['0–50','51–100','101–200','201–300','301–400','401–500'];
const ACT=[['Open windows freely','None','Normal workout'],['Ventilate; avoid rush hour','None','Normal; sensitive people go easy'],['Short airing only','N95 if sensitive','Reduce intensity, shorten'],['Keep closed, use purifier','N95 recommended','Move indoors'],['Sealed room + HEPA','N95/FFP2 outdoors','Avoid outdoor exercise'],['Sealed room + HEPA','N95/FFP2 if you must go out','No outdoor activity']];
const G=[[HeartPulse,'Asthma / respiratory','Keep reliever inhaler close, follow your action plan, and stay indoors above AQI 100. Early wheeze or cough means go inside and seek care.'],
[Users,'Elderly','Reduced lung and heart reserve: limit outings above AQI 100, avoid midday traffic, and report chest tightness promptly.'],
[Baby,'Children','Smaller airways, higher breathing rate: move play indoors above AQI 100; masks fit poorly on young children, so prioritize clean indoor air.'],
[Dumbbell,'Athletes','Heavy breathing multiplies intake. Train indoors above AQI 100, shift workouts to low-traffic early hours, and drop intensity as AQI rises.']];
const T=v=>typeof v==='string'?v:JSON.stringify(v);
export default function Health(){
  const{place,air}=useApp(),R=getScale()==='in'?RI:RU,[ai,setAi]=useState(null),[busy,setBusy]=useState(false),[err,setErr]=useState(''),cur=air?LV.findIndex(l=>air.aqi<=l[0]):-1;
  const run=()=>{if(!air)return;setBusy(true);setErr('');advise(place,air).then(setAi).catch(e=>setErr(e.message)).finally(()=>setBusy(false))};
  useEffect(()=>{run()},[air]);
  return<div className="max-w-6xl mx-auto p-4 space-y-6 stagger">
    <section className="glass p-5 border-emerald-300">
      <div className="flex flex-wrap items-center gap-2 mb-3"><Sparkles size={18} className="text-emerald-600"/><h2 className="font-bold">AI health advisory — {place.label}</h2>
        {air&&<span className="text-xs font-semibold px-2 py-1 rounded-full text-white" style={{background:lv(air.aqi).text}}>AQI {air.aqi} · {lv(air.aqi).name}</span>}
        <button onClick={run} disabled={busy} className="ml-auto text-xs px-3 py-1.5 rounded-full border border-emerald-300 text-emerald-700 hover:bg-emerald-50">{busy?'Thinking…':'Refresh'}</button></div>
      {!air&&<p className="text-sm text-slate-500">Waiting for live air-quality data…</p>}{err&&<p className="text-sm text-red-600">{err}</p>}
      {busy&&!ai&&<div className="space-y-2"><div className="skeleton h-4 w-3/4"/><div className="grid md:grid-cols-3 gap-3"><div className="skeleton h-28"/><div className="skeleton h-28"/><div className="skeleton h-28"/></div></div>}
      {ai&&<div className="space-y-3"><p className="text-sm">{T(ai.summary)}</p><div className="grid md:grid-cols-3 gap-3 text-sm">
        <div className="bg-emerald-50 rounded-xl p-3"><p className="font-bold mb-1">Do now</p><ul className="list-disc pl-4 space-y-1">{(Array.isArray(ai.do_now)?ai.do_now:[]).map((x,i)=><li key={i}>{T(x)}</li>)}</ul></div>
        <div className="bg-emerald-50 rounded-xl p-3"><p className="font-bold mb-1">Sensitive groups</p>{Object.entries(ai.groups||{}).map(([k,v])=><p key={k} className="mb-1"><b className="capitalize">{k}:</b> {T(v)}</p>)}</div>
        <div className="bg-emerald-50 rounded-xl p-3"><p className="font-bold mb-1">Outdoor plan</p>{Object.entries(ai.outdoor||{}).map(([k,v])=><p key={k} className="mb-1"><b className="capitalize">{k}:</b> {T(v)}</p>)}</div></div></div>}
      <p className="text-[11px] text-slate-400 mt-2">AI-generated from live readings (Groq). General guidance, not medical advice.</p></section>
    <section><h1 className="text-xl font-bold mb-3">AQI scale (0–500)</h1><div className="grid md:grid-cols-6 gap-2 stagger">{LV.map((l,i)=>
      <div key={l[1]} className={`rounded-xl p-3 text-slate-900 ${i===cur?'ring-4 ring-slate-800':''}`} style={{background:l[2],color:i>=4?'#fff':'#111'}}><p className="font-bold">{R[i]}</p><p className="text-sm font-semibold">{l[1]}</p><p className="text-xs mt-1">{l[3]}</p></div>)}</div></section>
    <section><h2 className="font-bold mb-3">Common precautions by group</h2><div className="grid md:grid-cols-2 gap-4 stagger">{G.map(([I,t,x])=><div key={t} className="glass p-4 lift"><p className="font-bold flex items-center gap-2 mb-1"><I size={18} className="text-emerald-600"/>{t}</p><p className="text-sm opacity-80">{x}</p></div>)}</div></section>
    <section className="glass p-4 overflow-x-auto"><h2 className="font-bold flex items-center gap-2 mb-2"><Wind size={18}/>Outdoor activity matrix</h2>
      <table className="w-full text-sm min-w-[600px]"><thead className="text-left opacity-60"><tr><th className="p-2">AQI</th><th>Ventilation</th><th>Mask</th><th>Outdoor workout</th></tr></thead>
        <tbody>{ACT.map((r,i)=><tr key={i} className={`border-t border-emerald-100 ${i===cur?'bg-emerald-50 font-semibold':''}`}><td className="p-2"><i className="inline-block w-3 h-3 rounded-full mr-2" style={{background:LV[i][2]}}/>{R[i]}</td>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></section>
    <p className="text-xs opacity-50">General guidance based on US EPA AQI categories; not medical advice.</p></div>;
}
