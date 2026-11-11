import {useEffect,useState} from 'react';import {Trophy} from 'lucide-react';
import {Radar,RadarChart,PolarGrid,PolarAngleAxis,BarChart,Bar,XAxis,YAxis,Tooltip,Legend,ResponsiveContainer} from 'recharts';
import SearchBox from '../components/SearchBox.jsx';import {useApp} from '../AppContext.js';import {KEYS,getAirQuality} from '../services/apiController.js';import {NAMES} from '../lib.js';
import {TypeBadge} from './Dashboard.jsx';
export default function Compare(){
  const{place,air,std}=useApp(),[A,setA]=useState(place),[B,setB]=useState(null),[ra,setRa]=useState(air),[rb,setRb]=useState(null),[err,setErr]=useState('');
  useEffect(()=>{getAirQuality(A.lat,A.lon).then(setRa).catch(e=>setErr(e.message))},[A,std]);
  useEffect(()=>{if(B)getAirQuality(B.lat,B.lon).then(setRb).catch(e=>setErr(e.message))},[B,std]);
  const data=KEYS.map(k=>({p:NAMES[k],A:ra?.pollutants[k]?.sub??0,B:rb?.pollutants[k]?.sub??0}));
  const pm=r=>(r.pollutants.pm25?.sub||0)+(r.pollutants.pm10?.sub||0);
  const win=ra&&rb?(pm(ra)===pm(rb)?null:pm(ra)<pm(rb)?A:B):null;
  return<div className="max-w-6xl mx-auto p-4 space-y-4 stagger">
    <div className="grid md:grid-cols-2 gap-4">{[['A',A,setA,ra],['B',B,setB,rb]].map(([n,p,s,r])=><div key={n} className="glass p-4 space-y-2">
      <SearchBox onSelect={s} placeholder={`Location ${n}…`}/><p className="font-bold">{p?.label||'Pick a location'}</p>
      {r&&<><p className="text-4xl font-bold">{r.aqi} <span className="text-sm font-normal opacity-60">{std==='in'?'NAQI':'US AQI'}</span></p><TypeBadge type={r.type}/><p className="text-xs opacity-60">{r.station} · {r.distanceKm} km · {r.source}</p></>}</div>)}</div>
    {err&&<p className="text-red-600 text-sm">{err}</p>}
    {win&&<div className="glass p-4 flex items-center gap-3 border-emerald-400/40"><Trophy className="text-emerald-600"/><p>Clean-air winner: <b>{win.label}</b> — lower combined PM2.5 + PM10 index ({pm(win===A?ra:rb)} vs {pm(win===A?rb:ra)}).</p></div>}
    {rb&&<div className="grid md:grid-cols-2 gap-4">
      <div className="glass p-4 h-80"><ResponsiveContainer><RadarChart data={data}><PolarGrid stroke="#cbd5e1"/><PolarAngleAxis dataKey="p" stroke="#475569"/>
        <Radar name="A" dataKey="A" stroke="#38bdf8" fill="#38bdf8" fillOpacity={.35}/><Radar name="B" dataKey="B" stroke="#f472b6" fill="#f472b6" fillOpacity={.35}/><Legend/><Tooltip/></RadarChart></ResponsiveContainer></div>
      <div className="glass p-4 h-80"><ResponsiveContainer><BarChart data={data}><XAxis dataKey="p" stroke="#475569"/><YAxis stroke="#475569"/><Tooltip/><Legend/>
        <Bar dataKey="A" fill="#38bdf8"/><Bar dataKey="B" fill="#f472b6"/></BarChart></ResponsiveContainer></div></div>}
    <p className="text-xs opacity-50">Values are per-pollutant AQI sub-indices so different units compare fairly.</p></div>;
}
