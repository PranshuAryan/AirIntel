import {lazy, Suspense, useCallback, useEffect, useRef, useState} from 'react';
import {BrowserRouter, NavLink, Route, Routes, useLocation} from 'react-router-dom';
import {Gauge, Map as MapIcon, GitCompare, History, HeartPulse, CloudSun, Bot, Wind, LocateFixed, Leaf, X, Sun, Moon} from 'lucide-react';
import {Ctx} from './AppContext.js';
import {setStandard} from './services/standards.js';
import {getAirQuality, reverseGeocode} from './services/apiController.js';
import {loadProfile, saveProfile} from './services/plan.js';
import SearchBox from './components/SearchBox.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Dashboard from './pages/Dashboard.jsx';

// Everything except the landing page is code-split: charts and the map only download when visited.
const Plan = lazy(() => import('./pages/Plan.jsx'));
const InteractiveMap = lazy(() => import('./pages/InteractiveMap.jsx'));
const Compare = lazy(() => import('./pages/Compare.jsx'));
const Historical = lazy(() => import('./pages/Historical.jsx'));
const Health = lazy(() => import('./pages/Health.jsx'));
const Forecast = lazy(() => import('./pages/Forecast.jsx'));
const AIAssistant = lazy(() => import('./pages/AIAssistant.jsx'));

const NAV = [['/', Gauge, 'Live AQI'], ['/plan', Leaf, 'Clean-Air Plan'], ['/map', MapIcon, 'Map'], ['/compare', GitCompare, 'Compare'], ['/historical', History, 'History'], ['/health', HeartPulse, 'Health'], ['/forecast', CloudSun, 'Forecast'], ['/assistant', Bot, 'Assistant']];
const safeGet = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

function Pages({announce}) {
  const {pathname} = useLocation(), main = useRef(null), first = useRef(true);
  useEffect(() => {
    window.scrollTo(0, 0);
    const title = NAV.find(([to]) => to === pathname)?.[2] || 'AirIntel';
    document.title = `${title} · AirIntel`;
    if (first.current) { first.current = false; return; }
    announce(`${title} page`);
    main.current?.focus({preventScroll: true}); // move keyboard/screen-reader focus to the new page
  }, [pathname, announce]);
  return (
    <main id="main" ref={main} tabIndex={-1} className="outline-none">
      <ErrorBoundary resetKey={pathname}>
        <Suspense fallback={<div role="status" aria-label="Loading page" className="max-w-6xl mx-auto p-4"><div className="skeleton h-64"/></div>}>
          <div key={pathname} className="page">
            <Routes>
              <Route path="/" element={<Dashboard/>}/><Route path="/plan" element={<Plan/>}/><Route path="/map" element={<InteractiveMap/>}/>
              <Route path="/compare" element={<Compare/>}/><Route path="/historical" element={<Historical/>}/><Route path="/health" element={<Health/>}/>
              <Route path="/forecast" element={<Forecast/>}/><Route path="/assistant" element={<AIAssistant/>}/>
            </Routes>
          </div>
        </Suspense>
      </ErrorBoundary>
    </main>
  );
}

export default function App() {
  const [place, setPlace] = useState({label: 'New Delhi, India', lat: 28.6139, lon: 77.209, cc: 'in'});
  const [air, setAir] = useState(null), [loading, setLoading] = useState(true), [err, setErr] = useState('');
  const [mode, setMode] = useState(() => safeGet('aqmode', 'auto'));
  const [profile, setProfileState] = useState(loadProfile);
  const [theme, setTheme] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#09100d' : '#047857');
    safeSet('aqtheme', theme);
  }, [theme]);
  const [notice, setNotice] = useState(''), [announcement, announce] = useState('');
  const std = mode === 'auto' ? (place.cc === 'in' ? 'in' : 'us') : mode;
  setStandard(std); // idempotent module-level setting read by the AQI helpers

  const setProfile = p => { setProfileState(p); saveProfile(p); };
  const locate = () => {
    if (!navigator.geolocation) return setNotice('Your browser cannot share its location. Use the search box instead.');
    navigator.geolocation.getCurrentPosition(async p => {
      const {latitude: lat, longitude: lon} = p.coords;
      let label = 'Your location', cc;
      try { ({label, cc} = await reverseGeocode(lat, lon)); } catch { /* keep generic label */ }
      setNotice(''); setPlace({label, lat, lon, cc});
    }, () => setNotice('Location permission was denied, so showing New Delhi. Use the search box to pick your place.'));
  };
  useEffect(() => { locate(); }, []);
  useEffect(() => {
    setLoading(true); setErr('');
    getAirQuality(place.lat, place.lon).then(setAir).catch(e => { setAir(null); setErr(e.message); }).finally(() => setLoading(false));
  }, [place, std]);
  const refresh = useCallback(() => getAirQuality(place.lat, place.lon, {force: true}).then(setAir).catch(() => {}), [place]);
  useEffect(() => {
    const id = setInterval(refresh, 6e5);
    const vis = () => { if (document.visibilityState === 'visible' && air && Date.now() - new Date(air.fetchedAt) > 3e5) refresh(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [refresh, air]);

  return (
    <Ctx.Provider value={{place, setPlace, air, loading, err, std, refresh, profile, setProfile}}>
      <BrowserRouter future={{v7_startTransition: true, v7_relativeSplatPath: true}}>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[3000] focus:bg-white focus:text-emerald-900 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg">Skip to main content</a>
        <header className="sticky top-0 z-[1500] bg-white/95 backdrop-blur border-b border-emerald-100 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col md:flex-row gap-3 md:items-center">
            <div className="flex items-center gap-2 shrink-0">
              <span className="bg-emerald-700 text-white p-2 rounded-xl shadow-md shadow-emerald-700/30 transition-transform duration-300 hover:rotate-12 hover:scale-110" aria-hidden="true"><Wind size={20}/></span>
              <div className="leading-tight"><p className="font-bold text-lg grad-text">AirIntel</p><p className="text-[11px] text-slate-600">Real-time air quality</p></div>
            </div>
            <div className="md:flex-1 flex gap-2">
              <SearchBox onSelect={setPlace}/>
              <select value={mode} onChange={e => { setMode(e.target.value); safeSet('aqmode', e.target.value); }} aria-label="AQI standard" className="glass px-2 text-sm text-emerald-900 bg-white">
                <option value="auto">Auto · {std === 'in' ? 'NAQI' : 'US'}</option><option value="us">US AQI</option><option value="in">India NAQI</option>
              </select>
              <button onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))} aria-pressed={theme === 'dark'} title="Toggle dark mode" aria-label="Dark mode" className="glass px-3 text-emerald-800 hover:bg-emerald-50">{theme === 'dark' ? <Sun size={18} aria-hidden="true"/> : <Moon size={18} aria-hidden="true"/>}</button>
              <button onClick={locate} title="Use my location" aria-label="Use my location" className="glass px-3 text-emerald-800 hover:bg-emerald-50"><LocateFixed size={18} aria-hidden="true"/></button>
            </div>
          </div>
          <nav aria-label="Primary" className="max-w-6xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
            {NAV.map(([to, I, t]) => (
              <NavLink key={to} to={to} end className={({isActive}) => `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 ${isActive ? 'bg-emerald-700 text-white' : 'text-slate-700 hover:bg-emerald-50'}`}><I size={15} aria-hidden="true"/>{t}</NavLink>
            ))}
          </nav>
          <div className="h-0.5 bg-gradient-to-r from-emerald-300 via-emerald-600 to-lime-400" aria-hidden="true"/>
        </header>
        {notice && (
          <div className="max-w-6xl mx-auto px-4 mt-3">
            <div role="status" className="px-4 py-2 rounded-xl bg-amber-50 text-amber-900 text-sm flex items-start gap-2">
              <span className="flex-1">{notice}</span>
              <button onClick={() => setNotice('')} aria-label="Dismiss message" className="p-0.5 hover:bg-amber-100 rounded"><X size={14}/></button>
            </div>
          </div>
        )}
        <div role="status" aria-live="polite" className="sr-only">{announcement}</div>
        <Pages announce={announce}/>
        <footer className="text-center text-xs text-slate-600 py-6">Data: WAQI · OpenAQ · Open-Meteo (CAMS) · Geoapify</footer>
      </BrowserRouter>
    </Ctx.Provider>
  );
}
