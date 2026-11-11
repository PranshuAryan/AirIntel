import {useEffect,useState} from 'react';import {FlaskConical} from 'lucide-react';
import {BarChart,Bar,Cell,XAxis,YAxis,Tooltip,CartesianGrid,ResponsiveContainer} from 'recharts';
import {useApp} from '../AppContext.js';import {series} from '../services/apiController.js';import {lv} from '../lib.js';
export default function Forecast(){
  const{place,std}=useApp(),[d,setD]=useState([]),[err,setErr]=useState('');
  useEffect(()=>{setErr('');series(place.lat,place.lon,{future:5}).then(setD).catch(e=>setErr(e.message))},[place,std]);
  return<div className="max-w-6xl mx-auto p-4 space-y-4 stagger">
    <div className="flex flex-wrap gap-3 items-center"><h1 className="text-xl font-bold">{place.label} — 5-day outlook</h1>
      <span className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-sky-100 text-sky-700 font-bold"><FlaskConical size={13}/>MODEL FORECAST (Non-ground measurement)</span></div>
    {err&&<p className="text-red-600">{err}</p>}
    <div className="glass p-4 h-80"><ResponsiveContainer><BarChart data={d}><CartesianGrid stroke="#e2e8f0"/><XAxis dataKey="date" stroke="#475569"/><YAxis stroke="#475569"/><Tooltip/>
      <Bar dataKey="aqi" name={'Daily mean '+(std==='in'?'NAQI':'US AQI')} radius={[8,8,0,0]}>{d.map((x,i)=><Cell key={i} fill={lv(x.aqi).color}/>)}</Bar></BarChart></ResponsiveContainer></div>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 stagger">{d.map(x=><div key={x.date} className="glass p-3 text-center lift"><p className="text-sm font-semibold">{x.day}</p><p className="text-xs opacity-60">{x.date}</p>
      <p className="text-2xl font-bold" style={{color:lv(x.aqi).text}}>{Math.round(x.aqi)}</p><p className="text-xs">{lv(x.aqi).name}</p><p className="text-[10px] opacity-60">PM2.5 {x.pm25} · PM10 {x.pm10}</p></div>)}</div>
    <p className="text-xs opacity-50">Source: Open-Meteo Air Quality API (CAMS atmospheric model). Forecasts carry uncertainty and are not station readings.</p></div>;
}
