import {useEffect,useState} from 'react';import {BrowserRouter,NavLink,Route,Routes,useLocation} from 'react-router-dom';
import {Gauge,Map as MapIcon,GitCompare,History,HeartPulse,CloudSun,Bot,Wind,LocateFixed} from 'lucide-react';
import {Ctx} from './AppContext.js';import {setStandard} from './services/standards.js';import {getAirQuality,reverseGeocode} from './services/apiController.js';import SearchBox from './components/SearchBox.jsx';
import Dashboard from './pages/Dashboard.jsx';import InteractiveMap from './pages/InteractiveMap.jsx';import Compare from './pages/Compare.jsx';
import Historical from './pages/Historical.jsx';import Health from './pages/Health.jsx';import Forecast from './pages/Forecast.jsx';import AIAssistant from './pages/AIAssistant.jsx';
const NAV=[['/',Gauge,'Live AQI'],['/map',MapIcon,'Map'],['/compare',GitCompare,'Compare'],['/historical',History,'History'],['/health',HeartPulse,'Health'],['/forecast',CloudSun,'Forecast'],['/assistant',Bot,'Assistant']];
function Pages(){const{pathname}=useLocation();useEffect(()=>{window.scrollTo(0,0)},[pathname]);return<div key={pathname} className="page"><Routes><Route path="/" element={<Dashboard/>}/><Route path="/map" element={<InteractiveMap/>}/><Route path="/compare" element={<Compare/>}/>
      <Route path="/historical" element={<Historical/>}/><Route path="/health" element={<Health/>}/><Route path="/forecast" element={<Forecast/>}/><Route path="/assistant" element={<AIAssistant/>}/></Routes></div>}
export default function App(){
  const[place,setPlace]=useState({label:'New Delhi, India',lat:28.6139,lon:77.209,cc:'in'}),[air,setAir]=useState(null),[loading,setLoading]=useState(true),[err,setErr]=useState(''),[mode,setMode]=useState(()=>localStorage.getItem('aqmode')||'auto'),std=mode==='auto'?(place.cc==='in'?'in':'us'):mode;
  setStandard(std);
  const locate=()=>navigator.geolocation?.getCurrentPosition(async p=>{const{latitude:lat,longitude:lon}=p.coords;let label='Your location',cc;try{({label,cc}=await reverseGeocode(lat,lon))}catch{}setPlace({label,lat,lon,cc})},()=>alert('Location permission denied. Use the search bar instead.'));
  useEffect(()=>{locate()},[]);
  useEffect(()=>{setLoading(true);setErr('');getAirQuality(place.lat,place.lon).then(setAir).catch(e=>{setAir(null);setErr(e.message)}).finally(()=>setLoading(false))},[place,std]);
  return<Ctx.Provider value={{place,setPlace,air,loading,err,std}}><BrowserRouter>
    <header className="sticky top-0 z-[1500] bg-white/95 backdrop-blur border-b border-emerald-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="flex items-center gap-2 shrink-0"><span className="bg-emerald-600 text-white p-2 rounded-xl shadow-md shadow-emerald-600/30 transition-transform duration-300 hover:rotate-12 hover:scale-110"><Wind size={20}/></span>
          <div className="leading-tight"><p className="font-bold text-lg text-emerald-900">AirIntel</p><p className="text-[11px] text-slate-500">Real-time air quality</p></div></div>
        <div className="md:flex-1 flex gap-2"><SearchBox onSelect={setPlace}/><select value={mode} onChange={e=>{setMode(e.target.value);localStorage.setItem('aqmode',e.target.value)}} aria-label="AQI standard" className="glass px-2 text-sm text-emerald-800 bg-white"><option value="auto">Auto · {std==='in'?'NAQI':'US'}</option><option value="us">US AQI</option><option value="in">India NAQI</option></select><button onClick={locate} title="Use my location" aria-label="Use my location" className="glass px-3 text-emerald-700 hover:bg-emerald-50"><LocateFixed size={18}/></button></div></div>
      <nav className="max-w-6xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">{NAV.map(([to,I,t])=>
        <NavLink key={to} to={to} end className={({isActive})=>`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 ${isActive?'bg-emerald-600 text-white':'text-slate-600 hover:bg-emerald-50'}`}><I size={15}/>{t}</NavLink>)}</nav><div className="h-0.5 bg-gradient-to-r from-emerald-300 via-emerald-600 to-lime-400"/></header>
    <main><Pages/></main>
    <footer className="text-center text-xs text-slate-500 py-6">Data: WAQI · OpenAQ · Open-Meteo (CAMS) · Geoapify</footer>
  </BrowserRouter></Ctx.Provider>;
}
