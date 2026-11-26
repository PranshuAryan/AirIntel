import {useEffect, useMemo, useState} from 'react';
import {Leaf, Sparkles, Clock, Copy, Share2, Home, Users, Car, Wallet, FlaskConical, CircleHelp} from 'lucide-react';
import {useApp} from '../AppContext.js';
import {lv} from '../lib.js';
import {hourlyForecast} from '../services/apiController.js';
import {askJSON} from '../services/groq.js';
import {OPTIONS, CAT_ORDER, CAT_LABEL, bestWindow, buildPlan, generatePlan, makeCtx, planKey, planToText, WHO_PM25_24H, INFILTRATION, PURIFIER_CUT, CO2_PER_KM} from '../services/plan.js';

const WHEN = {morning: 'Morning', day: 'Daytime', evening: 'Evening', anytime: 'Anytime'};
const COST = {free: 'Free', low: 'Low cost', medium: 'Medium cost', high: 'Higher cost'};
const EFFORT = {easy: 'Easy', medium: 'Some effort', hard: 'Bigger change'};
const Chip = ({children}) => <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">{children}</span>;

function Field({label, children, id}) {
  return <div><label htmlFor={id} className="block text-sm font-medium text-slate-800 mb-1">{label}</label>{children}</div>;
}
const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600';

function ProfileForm({profile, onChange}) {
  const set = patch => onChange({...profile, ...patch});
  // plain functions (not components) so the inputs keep focus while the profile re-renders
  const check = (k, label) => (
    <label key={k} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={profile[k]} onChange={e => set({[k]: e.target.checked})} className="h-4 w-4 accent-emerald-700"/>{label}</label>
  );
  const select = (k, id, label) => (
    <Field id={id} label={label}><select id={id} value={profile[k]} onChange={e => set({[k]: e.target.value})} className={inputCls}>{OPTIONS[k].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Field>
  );
  return (
    <form onSubmit={e => e.preventDefault()} className="glass p-5 space-y-5" aria-label="Your household and lifestyle">
      <fieldset className="space-y-2"><legend className="font-bold flex items-center gap-2 mb-1"><Users size={16} className="text-emerald-700" aria-hidden="true"/>Who is at home?</legend>
        {check('kids', 'Children under 12')}{check('elderly', 'Adults 65 or older')}{check('resp', 'Asthma, COPD or heart condition')}{check('exercise', 'I exercise or walk outdoors')}</fieldset>
      <fieldset className="space-y-3"><legend className="font-bold flex items-center gap-2 mb-1"><Car size={16} className="text-emerald-700" aria-hidden="true"/>Getting around</legend>
        {select('commute', 'p-commute', 'Main way you travel')}
        <Field id="p-km" label="One-way distance (km)"><input id="p-km" type="number" min="0" max="150" step="0.5" inputMode="decimal" value={profile.commuteKm} onChange={e => set({commuteKm: e.target.value})} className={inputCls}/></Field></fieldset>
      <fieldset className="space-y-3"><legend className="font-bold flex items-center gap-2 mb-1"><Home size={16} className="text-emerald-700" aria-hidden="true"/>At home</legend>
        {select('cooking', 'p-cook', 'Cooking fuel')}{select('heating', 'p-heat', 'Winter heating')}{check('purifier', 'We already own an air purifier')}</fieldset>
      <fieldset><legend className="font-bold flex items-center gap-2 mb-2"><Wallet size={16} className="text-emerald-700" aria-hidden="true"/>Budget for air-quality fixes</legend>
        <div className="flex gap-2" role="radiogroup">{OPTIONS.budget.map(([v, t]) => (
          <label key={v} className={`flex-1 text-center text-sm py-2 rounded-lg border cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-emerald-600 ${profile.budget === v ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white border-slate-300 text-slate-800 hover:bg-emerald-50'}`}>
            <input type="radio" name="budget" value={v} checked={profile.budget === v} onChange={() => set({budget: v})} className="sr-only"/>{t}</label>))}</div></fieldset>
      <p className="text-xs text-slate-600">Saved on this device only. Your answers shape the plan and are sent to the AI as a short list of choices, never as free text.</p>
    </form>
  );
}

function ActionCard({a, done, toggle}) {
  const id = `act-${a.id}`;
  return (
    <li className={`glass p-4 ${done ? 'bg-emerald-50/60' : ''}`}>
      <div className="flex items-start gap-3">
        <input id={id} type="checkbox" checked={done} onChange={() => toggle(a.id)} className="mt-1 h-5 w-5 accent-emerald-700 shrink-0" aria-describedby={`${id}-why`}/>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900"><label htmlFor={id} className={`cursor-pointer ${done ? 'line-through text-slate-600' : ''}`}>{a.title}</label></h3>
          <div className="flex flex-wrap gap-1.5 mt-1.5"><Chip>{WHEN[a.when]}</Chip><Chip>{EFFORT[a.effort]}</Chip><Chip>{COST[a.cost]}</Chip></div>
          <p id={`${id}-why`} className="text-sm text-slate-700 mt-2">{a.why}</p>
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm">
            <p className="text-[11px] font-bold tracking-wide text-emerald-900 uppercase">Direct impact</p>
            <p className="font-semibold text-emerald-900">{a.impact}</p>
            <p className="text-xs text-slate-700 mt-1">{a.detail}</p>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function Plan() {
  const {place, air, loading, err, profile, setProfile} = useApp();
  const [win, setWin] = useState(null), [aiState, setAiState] = useState(null), [busy, setBusy] = useState(false);
  const [done, setDone] = useState({}), [msg, setMsg] = useState('');

  useEffect(() => {
    let live = true; setWin(null);
    hourlyForecast(place.lat, place.lon, 24).then(r => live && setWin(bestWindow(r))).catch(() => {});
    return () => { live = false; };
  }, [place]);

  const input = useMemo(() => ({place, air, profile, window: win}), [place, air, profile, win]);
  const ctx = useMemo(() => makeCtx(input), [input]);
  const key = useMemo(() => planKey(ctx), [ctx]);
  const rules = useMemo(() => buildPlan(ctx), [ctx]); // instant, works offline

  // upgrade to the AI-personalised plan in the background (debounced so editing the form doesn't spam the API)
  useEffect(() => {
    if (!air) { setAiState(null); return; }
    let live = true; setBusy(true);
    const t = setTimeout(() => generatePlan(input, askJSON).then(p => live && setAiState({key, plan: p})).finally(() => live && setBusy(false)), 700);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` already encodes everything in `input` that matters
  }, [key]);

  const ai = aiState?.key === key ? aiState.plan : null;
  const plan = ai || rules, aiFailed = ai && ai.source !== 'ai';
  const L = air ? lv(air.aqi) : null;
  const total = plan.actions.length, nDone = plan.actions.filter(a => done[a.id]).length;
  const co2Saved = Math.max(0, ...plan.actions.filter(a => done[a.id] && a.co2).map(a => a.co2));
  const toggle = id => setDone(d => ({...d, [id]: !d[id]}));

  const copy = async () => {
    try { await navigator.clipboard.writeText(planToText(plan, place.label)); setMsg('Plan copied. Paste it into your family or neighbourhood group.'); }
    catch { setMsg('Copy is not available in this browser.'); }
  };
  const share = async () => {
    try { await navigator.share({title: `Clean-air plan for ${place.label}`, text: planToText(plan, place.label)}); }
    catch (e) { if (e.name !== 'AbortError') copy(); }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="rise">
        <h1 className="text-2xl md:text-3xl font-bold grad-text flex items-center gap-2"><Leaf className="text-emerald-700" aria-hidden="true"/>Your clean-air plan</h1>
        <p className="text-slate-700">Low-emission routines, indoor air hacks and sustainable swaps for <b>{place.label}</b>, with the direct effect of each choice explained.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr] items-start">
        <ProfileForm profile={profile} onChange={setProfile}/>
        <div className="space-y-4" aria-live="polite" aria-busy={busy}>
          {!air && !loading && <div className="glass p-4 text-sm text-slate-800" role="status"><b>No live reading for this place.</b> {err} The plan below uses general winter-smog precautions; search a nearby city for a tailored one.</div>}
          <section className="glass p-5" style={L ? {background: `linear-gradient(180deg,${L.color}26,var(--surface) 70%)`} : undefined} aria-labelledby="plan-head">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {L && <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{background: L.text}}>{air.std === 'in' ? 'NAQI' : 'US AQI'} {air.aqi} · {L.name}</span>}
              {plan.source === 'ai' ? <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-violet-100 text-violet-900 font-semibold"><Sparkles size={12} aria-hidden="true"/>Personalised by AI</span>
                : <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-semibold">Rule-based plan</span>}
              {busy && <span className="text-xs text-slate-600" role="status">Personalising with AI…</span>}
            </div>
            <h2 id="plan-head" className="text-xl font-bold text-slate-900">{plan.headline}</h2>
            <p className="text-sm text-slate-700 mt-1">{plan.summary}</p>
            {aiFailed && <p className="text-xs text-slate-600 mt-2">AI personalisation unavailable ({ai.note}), so this plan uses built-in rules. Every impact figure is the same either way.</p>}
          </section>

          {win && (
            <section className="glass p-4 flex items-start gap-3" aria-label="Cleanest time to go out">
              <Clock className="text-emerald-700 mt-0.5 shrink-0" aria-hidden="true"/>
              <div className="text-sm"><p className="font-semibold text-slate-900">Cleanest window in the next 24 h: {win.label}</p>
                <p className="text-slate-700">Forecast PM2.5 about {win.avg} µg/m³, versus about {win.peak} µg/m³ around {win.peakLabel} (~{win.cutPct}% lower). Good time for walks, school runs and airing rooms.</p>
                <span className="inline-flex items-center gap-1 mt-1 text-[11px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 font-semibold"><FlaskConical size={11} aria-hidden="true"/>MODEL FORECAST, not a ground reading</span></div>
            </section>
          )}

          <div className="glass p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[180px]"><p className="text-sm font-medium text-slate-800" id="prog-l">{nDone} of {total} actions done today</p>
              <div role="progressbar" aria-labelledby="prog-l" aria-valuemin={0} aria-valuemax={total} aria-valuenow={nDone} className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-600 transition-all" style={{width: total ? `${nDone / total * 100}%` : 0}}/></div>
              {co2Saved > 0 && <p className="text-xs text-emerald-900 mt-1">Your commute change avoids about {co2Saved} kg CO₂ per working day.</p>}</div>
            <button onClick={copy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-emerald-700 text-emerald-900 text-sm hover:bg-emerald-50"><Copy size={14} aria-hidden="true"/>Copy plan</button>
            {typeof navigator !== 'undefined' && navigator.share && <button onClick={share} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-emerald-700 text-white text-sm hover:bg-emerald-800"><Share2 size={14} aria-hidden="true"/>Share with household</button>}
            <p role="status" className="w-full text-xs text-slate-700 min-h-[1rem]">{msg}</p>
          </div>

          {CAT_ORDER.map(cat => {
            const items = plan.actions.filter(a => a.cat === cat);
            if (!items.length) return null;
            return (
              <section key={cat} aria-labelledby={`cat-${cat}`}>
                <h2 id={`cat-${cat}`} className="font-bold text-lg text-slate-900 mb-2">{CAT_LABEL[cat]}</h2>
                <ul className="space-y-3 stagger">{items.map(a => <ActionCard key={a.id} a={a} done={!!done[a.id]} toggle={toggle}/>)}</ul>
              </section>
            );
          })}

          <details className="glass p-4 text-sm">
            <summary className="font-semibold cursor-pointer flex items-center gap-2 text-slate-900"><CircleHelp size={16} aria-hidden="true"/>Why is winter smog worse, and how are impacts estimated?</summary>
            <div className="mt-3 space-y-2 text-slate-700">
              <p><b>Why winter?</b> Cold, still air near the ground (a temperature inversion) traps pollution close to where we breathe. At the same time, more people burn fuel, waste or crop residue for heat and cooking, and traffic emissions pile up. That is why levels are often highest at night and in the early morning.</p>
              <p><b>How impacts are estimated.</b> The AI only chooses and words the actions. The numbers come from fixed, transparent assumptions: windows shut keeps about {INFILTRATION * 100}% of outdoor PM2.5 out (homes vary, 30–70%); a correctly sized HEPA purifier removes about {PURIFIER_CUT * 100}% more (typically 30–70%); N95 respirators are rated to filter at least 95% of fine particles; the WHO 24-hour PM2.5 guideline is {WHO_PM25_24H} µg/m³; CO₂ per passenger-km is about {CO2_PER_KM.car} for a car, {CO2_PER_KM.two_wheeler} for a two-wheeler, {CO2_PER_KM.bus} for a bus and {CO2_PER_KM.metro} for a metro. Treat them as typical estimates, not guarantees.</p>
              <p>This is general guidance, not medical advice. If you or a family member has symptoms, follow your doctor’s advice.</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
