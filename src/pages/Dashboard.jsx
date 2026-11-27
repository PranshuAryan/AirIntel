import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {FlaskConical, MapPin, Clock, Footprints, ShieldCheck, DoorOpen, RefreshCw, Leaf} from 'lucide-react';
import {useApp} from '../AppContext.js';
import {lv, LV, NAMES, ago, fmt} from '../lib.js';
import {KEYS} from '../services/apiController.js';

export const TypeBadge = ({type}) =>
  type === 'MEASUREMENT' ? (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
      </span>
      LIVE GROUND MEASUREMENT
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 font-semibold">
      <FlaskConical size={12} />
      MODEL ESTIMATE (not a ground reading)
    </span>
  );

const CITIES = [
  ['New Delhi, India', 28.61, 77.21, 'in'],
  ['Mumbai, India', 19.08, 72.88, 'in'],
  ['Kolkata, India', 22.57, 88.36, 'in'],
  ['Beijing, China', 39.9, 116.41, 'cn'],
  ['London, UK', 51.51, -0.13, 'gb'],
  ['New York, USA', 40.71, -74.01, 'us'],
];

const OUTDOOR_ADVICE = [
  'Great day to be outside',
  'Fine for most; sensitive people go easy',
  'Limit long outdoor exertion',
  'Avoid strenuous outdoor activity',
  'Stay indoors',
  'Do not go outside',
];

const MASK_ADVICE = [
  'Not needed',
  'Not needed',
  'Optional for sensitive people',
  'N95 recommended',
  'N95 outdoors',
  'N95/FFP2 essential',
];

const WINDOW_ADVICE = [
  'Open freely',
  'Open, avoid rush hour',
  'Short airing only',
  'Keep closed, use purifier',
  'Keep sealed, HEPA purifier',
  'Seal room, HEPA purifier',
];

function useCount(targetValue) {
  const [currentCount, setCurrentCount] = useState(0);

  useEffect(() => {
    let raf;
    const startTime = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - startTime) / 1000);
      setCurrentCount(Math.round(targetValue * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetValue]);

  return currentCount;
}

export default function Dashboard() {
  const {air, loading, err, place, setPlace, refresh} = useApp();
  const [gaugeProgress, setGaugeProgress] = useState(0);
  const [animateBars, setAnimateBars] = useState(false);
  const [, setTimerTick] = useState(0);
  const [refreshSpinning, setRefreshSpinning] = useState(false);
  const animatedAqi = useCount(air?.aqi || 0);

  useEffect(() => {
    const interval = setInterval(() => setTimerTick(x => x + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setGaugeProgress(0);
    setAnimateBars(false);
    const timer = setTimeout(() => {
      setGaugeProgress(air?.aqi || 0);
      setAnimateBars(true);
    }, 80);
    return () => clearTimeout(timer);
  }, [air]);

  const chips = (
    <nav aria-label="Quick city selection" className="lg:col-span-2 flex flex-wrap gap-2 items-center text-sm">
      <span className="text-slate-600" aria-hidden="true">
        Try:
      </span>
      {CITIES.map(([cityName, lat, lon, cc]) => (
        <button
          key={cityName}
          onClick={() => setPlace({label: cityName, lat, lon, cc})}
          className="px-3 py-1 rounded-full bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-700 hover:text-white hover:border-emerald-700 hover:-translate-y-0.5 transition-all"
        >
          {cityName}
        </button>
      ))}
    </nav>
  );

  if (loading) {
    return (
      <div
        className="max-w-6xl mx-auto p-4 grid gap-4 lg:grid-cols-[380px_1fr]"
        role="status"
        aria-label="Fetching live air quality"
        aria-busy="true"
      >
        {chips}
        <div className="skeleton h-[470px]" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 content-start">
          {KEYS.map(k => (
            <div key={k} className="skeleton h-36" />
          ))}
          <div className="skeleton h-28 col-span-full" />
        </div>
      </div>
    );
  }

  if (!air) {
    return (
      <div className="max-w-6xl mx-auto p-4 grid gap-4">
        {chips}
        <div className="glass p-8 text-center max-w-xl mx-auto" role="alert">
          <p className="font-bold text-emerald-900 mb-1">No live station reading here</p>
          <p className="text-sm text-slate-600">{err}</p>
          <p className="text-xs text-slate-600 mt-3">Try a nearby city or search another place.</p>
        </div>
      </div>
    );
  }

  const levelInfo = lv(air.aqi);
  const gaugeRadius = 90;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const severityIndex = LV.findIndex(l => air.aqi <= l[0]);

  return (
    <div className="max-w-6xl mx-auto p-4 grid gap-4 lg:grid-cols-[380px_1fr]">
      <div className="lg:col-span-2 rise">
        <h1 className="text-2xl md:text-3xl font-bold text-emerald-900">{place.label}</h1>
        <p className="text-sm text-slate-600 flex flex-wrap items-center gap-2">
          Reported {fmt(air.updated)} ({ago(air.updated)}) · checked {ago(air.fetchedAt)}
          <button
            onClick={() => {
              setRefreshSpinning(true);
              refresh().finally(() => setRefreshSpinning(false));
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs"
          >
            <RefreshCw size={12} className={refreshSpinning ? 'animate-spin' : ''} />
            Refresh
          </button>
        </p>
      </div>

      {chips}

      <section
        className="glass p-6 text-center rise"
        style={{background: `linear-gradient(180deg, ${levelInfo.color}30, var(--surface) 58%)`}}
      >
        <svg
          viewBox="0 0 220 220"
          className="mx-auto w-64"
          style={{filter: `drop-shadow(0 8px 16px ${levelInfo.color}66)`}}
          role="img"
          aria-label={`${air.std === 'in' ? 'India NAQI' : 'US AQI'} ${air.aqi}, ${levelInfo.name}`}
        >
          <circle cx="110" cy="110" r={gaugeRadius} fill="none" stroke="#e2e8f0" strokeWidth="16" />
          <circle
            cx="110"
            cy="110"
            r={gaugeRadius}
            fill="none"
            stroke={levelInfo.color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={gaugeCircumference}
            strokeDashoffset={gaugeCircumference * (1 - Math.min(gaugeProgress, 500) / 500)}
            transform="rotate(-90 110 110)"
            style={{transition: 'stroke-dashoffset 1.4s cubic-bezier(.2,.7,.2,1), stroke .6s'}}
          />
          <text x="110" y="118" textAnchor="middle" fontSize="56" fontWeight="700" fill={levelInfo.text}>
            {animatedAqi}
          </text>
          <text x="110" y="146" textAnchor="middle" fontSize="13" fill="#64748b">
            {air.std === 'in' ? 'India NAQI' : 'US AQI'}
          </text>
        </svg>

        <p className="text-xl font-bold" style={{color: levelInfo.text}}>
          {levelInfo.name}
        </p>
        <p className="text-sm text-slate-700 mt-1">{levelInfo.note}</p>

        <div className="mt-4 text-left text-sm space-y-2 border-t border-emerald-100 pt-4">
          <TypeBadge type={air.type} />
          {air.usAqi != null && air.naqiAqi != null && (
            <p className="text-xs rounded-lg bg-emerald-50 p-2 text-slate-700">
              <b>Same air, two scales:</b> India NAQI {air.naqiAqi} · US AQI {air.usAqi}. Apps differ because the two
              standards use different pollutant limits and category cut-offs.
            </p>
          )}
          <p>
            <b>Source:</b> {air.source}
          </p>
          <p className="flex gap-1">
            <MapPin size={15} className="mt-0.5 shrink-0 text-emerald-600" />
            {air.station}
          </p>
          {air.type === 'MEASUREMENT' && (
            <p>
              <b>Distance:</b> {air.distanceKm} km {air.distanceKm > 1 ? '(nearest station used)' : '(at location)'}
            </p>
          )}
          <p className="flex gap-1 items-center">
            <Clock size={15} className="text-emerald-600" />
            {fmt(air.updated)} · {ago(air.updated)}
          </p>
          <p className="text-[11px] text-slate-600 font-mono break-all">{air.updated}</p>
          {(air.stale || (air.type === 'MEASUREMENT' && Date.now() - new Date(air.updated) > 108e5)) && (
            <p className="text-xs text-amber-700">
              This station last reported {ago(air.updated)}. The freshest source available is shown.
            </p>
          )}
          {air.converted && (
            <p className="text-xs text-amber-700">NAQI estimated by converting this station&apos;s US-scale readings.</p>
          )}
          {air.dominant && (
            <p className="text-xs text-slate-700">Dominant pollutant: {NAMES[air.dominant]}</p>
          )}
          {air.errors.length > 0 && (
            <p className="text-xs text-slate-600">Fallback used — {air.errors.join(' • ')}</p>
          )}
        </div>
      </section>

      <div className="space-y-4">
        <section aria-label="Pollutant breakdown" className="grid grid-cols-2 md:grid-cols-3 gap-4 stagger">
          {KEYS.map(k => {
            const pollutant = air.pollutants[k];
            const level = pollutant?.sub != null ? lv(pollutant.sub) : null;
            return (
              <div key={k} className="glass p-4 lift">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-bold">{NAMES[k]}</span>
                  <span
                    className="text-[10px] leading-tight text-right px-2 py-0.5 rounded-full font-semibold max-w-[110px]"
                    style={{
                      background: (level?.color || '#94a3b8') + '33',
                      color: level?.text || '#64748b',
                    }}
                  >
                    {level?.name || 'n/a'}
                  </span>
                </div>
                <p className="text-3xl font-bold mt-3">{pollutant ? pollutant.value : '—'}</p>
                <p className="text-xs text-slate-600">{pollutant?.unit || 'not reported'}</p>
                <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: animateBars && pollutant?.sub != null ? Math.min(100, pollutant.sub / 3) + '%' : '0%',
                      background: level?.color || '#94a3b8',
                      transition: 'width 1.2s cubic-bezier(.2,.7,.2,1)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </section>

        <section className="glass p-5 rise" style={{animationDelay: '.35s'}}>
          <h2 className="font-bold mb-3">What this means right now</h2>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            {[
              [Footprints, 'Outdoor activity', OUTDOOR_ADVICE],
              [ShieldCheck, 'Mask', MASK_ADVICE],
              [DoorOpen, 'Windows', WINDOW_ADVICE],
            ].map(([Icon, title, adviceList]) => (
              <div key={title} className="rounded-xl bg-emerald-50 p-3 lift">
                <Icon size={18} className="text-emerald-700 mb-1" aria-hidden="true" />
                <p className="text-xs text-slate-600">{title}</p>
                <p className="font-semibold">{adviceList[severityIndex]}</p>
              </div>
            ))}
          </div>
          <Link
            to="/plan"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800"
          >
            <Leaf size={15} aria-hidden="true" />
            Get my family’s clean-air plan
          </Link>
        </section>
      </div>
    </div>
  );
}
