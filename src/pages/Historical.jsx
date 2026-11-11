import {useEffect,useState} from 'react';import {AlertTriangle,CheckCircle2,TrendingUp,TrendingDown} from 'lucide-react';
import {AreaChart,Area,XAxis,YAxis,Tooltip,Legend,CartesianGrid,ResponsiveContainer} from 'recharts';
import {useApp} from '../AppContext.js';import {series} from '../services/apiController.js';
export default function Historical(){
  const{place,std}=useApp(),[days,setDays]=useState(7),[d,setD]=useState([]),[err,setErr]=useState('');
  useEffect(()=>{setErr('');series(place.lat,place.lon,{past:days,future:1}).then(setD).catch(e=>setErr(e.message))},[place,days,std]);
  const a=d.filter(x=>x.aqi!=null),today=a.at(-1),past=a[0];
  const delta=today&&past?(today.aqi-past.aqi)/past.aqi*100:null;
  const flags=a.map((x,i)=>{const w=a.slice(Math.max(0,i-7),i).map(y=>y.pm25);if(w.length<4)return false;
    const m=w.reduce((s,v)=>s+v,0)/w.length,sd=Math.sqrt(w.reduce((s,v)=>s+(v-m)**2,0)/w.length);return x.pm25>m+3*Math.max(sd,1)});
  const anomaly=flags.at(-1);
  return<div className="max-w-6xl mx-auto p-4 space-y-4 stagger">
    <div className="flex flex-wrap gap-2 items-center"><h1 className="text-xl font-bold mr-auto">{place.label} — trend</h1>
      {[7,30].map(n=><button key={n} onClick={()=>setDays(n)} className={`px-4 py-1.5 rounded-full text-sm ${days===n?'bg-emerald-600 text-white':'glass'}`}>{n} days</button>)}</div>
    {err&&<p className="text-red-600">{err}</p>}
    <div className="grid md:grid-cols-2 gap-4">
      <div className="glass p-4"><p className="text-sm opacity-70">Δ% AQI, today vs {days} days ago</p>
        <p className="text-4xl font-bold flex items-center gap-2">{delta==null?'—':`${delta>0?'+':''}${delta.toFixed(1)}%`}{delta!=null&&(delta>0?<TrendingUp className="text-red-500"/>:<TrendingDown className="text-emerald-600"/>)}</p>
        <p className="text-xs opacity-60">(AQI today − AQI past) ÷ AQI past × 100 · {today?.aqi} vs {past?.aqi}</p></div>
      <div className={`glass p-4 ${anomaly?'border-red-500/60':''}`}><p className="text-sm opacity-70">Anomaly detector (PM2.5 &gt; 3σ above 7-day moving mean)</p>
        <p className="text-xl font-bold flex items-center gap-2 mt-2">{anomaly?<><AlertTriangle className="text-red-500"/>ANOMALY: spike detected today</>:<><CheckCircle2 className="text-emerald-600"/>No anomaly today</>}</p>
        <p className="text-xs opacity-60 mt-1">Flagged days in window: {a.filter((_,i)=>flags[i]).map(x=>x.date).join(', ')||'none'}</p></div></div>
    <div className="glass p-4 h-96"><ResponsiveContainer><AreaChart data={d}><CartesianGrid stroke="#e2e8f0"/><XAxis dataKey="date" stroke="#475569" minTickGap={24}/><YAxis stroke="#475569" unit=" µg"/><Tooltip/><Legend/>
      <Area dataKey="pm10" name="PM10" stroke="#f59e0b" fill="#f59e0b" fillOpacity={.25}/><Area dataKey="pm25" name="PM2.5" stroke="#f43f5e" fill="#f43f5e" fillOpacity={.35}/></AreaChart></ResponsiveContainer></div>
    <p className="text-xs opacity-50">Daily means from Open-Meteo CAMS reanalysis/model series (history is modelled, not station data). A widening PM10–PM2.5 gap suggests coarse dust; a narrow gap suggests combustion smoke.</p></div>;
}
