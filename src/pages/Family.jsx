import {useState} from 'react';
import {Users, Plus, Trash2, Info} from 'lucide-react';
import {useApp} from '../AppContext.js';
import {GROUPS, CONDITIONS, CIG_UG, PLAN_OUTDOOR_SHARE, SAMPLE, assess, loadFamily, saveFamily, sanitizeMember} from '../services/family.js';
import {INFILTRATION, PURIFIER_CUT, WHO_PM25_24H} from '../services/plan.js';

const LEVEL = {Low: 'bg-emerald-100 text-emerald-900', Moderate: 'bg-amber-100 text-amber-900', High: 'bg-orange-200 text-orange-950', Severe: 'bg-red-200 text-red-950'};
const TIP = {
  Low: 'Normal routines are fine today. Keep windows open when the air is cleanest.',
  Moderate: 'Shorten outdoor time and prefer the cleanest window of the day.',
  High: 'Keep outdoor time short, wear a fitted N95 (teens and adults) outside and run a purifier indoors.',
  Severe: 'Stay indoors with windows shut and a purifier running. Avoid all outdoor exertion today.',
};
const inputCls = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

export default function Family() {
  const {air, profile, place} = useApp();
  const [list, setList] = useState(loadFamily);
  const [f, setF] = useState({name: '', group: 'adult', conditions: [], outdoorHours: 2});
  const pm = air?.pollutants?.pm25?.conc ?? null;
  const update = l => { setList(l); saveFamily(l); };
  const add = e => { e.preventDefault(); if (list.length < 8) update([...list, sanitizeMember(f)]); setF({name: '', group: 'adult', conditions: [], outdoorHours: 2}); };
  const toggleCond = c => setF(s => ({...s, conditions: s.conditions.includes(c) ? s.conditions.filter(x => x !== c) : [...s.conditions, c]}));
  const rows = list.map(m => ({m, a: assess(m, pm, profile.purifier)}));
  const top = rows.filter(r => r.a).sort((x, y) => y.a.vuln - x.a.vuln)[0];

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="rise">
        <h1 className="text-2xl md:text-3xl font-bold grad-text flex items-center gap-2"><Users className="text-emerald-700" aria-hidden="true"/>Family exposure</h1>
        <p className="text-slate-700">Estimated PM2.5 each family member breathes in today in <b>{place.label}</b>, and how much the clean-air plan would save.</p>
      </div>
      {pm == null && <div role="status" className="glass p-4 text-sm text-slate-800">No live PM2.5 reading for this place yet, so estimates can’t be calculated. Search a nearby city.</div>}
      <div className="grid gap-4 lg:grid-cols-[340px_1fr] items-start">
        <form onSubmit={add} className="glass p-5 space-y-4" aria-label="Add a family member">
          <h2 className="font-bold">Add a family member</h2>
          <div><label htmlFor="fm-name" className="block text-sm font-medium mb-1">Name</label><input id="fm-name" value={f.name} maxLength={24} onChange={e => setF({...f, name: e.target.value})} className={`${inputCls} w-full`} placeholder="e.g. Aarav"/></div>
          <div><label htmlFor="fm-group" className="block text-sm font-medium mb-1">Age group</label>
            <select id="fm-group" value={f.group} onChange={e => setF({...f, group: e.target.value, outdoorHours: GROUPS[e.target.value].out})} className={`${inputCls} w-full`}>{Object.entries(GROUPS).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}</select></div>
          <fieldset className="space-y-1.5"><legend className="text-sm font-medium mb-1">Health conditions</legend>
            {Object.entries(CONDITIONS).map(([k, [t]]) => <label key={k} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" className="h-4 w-4 accent-emerald-700" checked={f.conditions.includes(k)} onChange={() => toggleCond(k)}/>{t}</label>)}</fieldset>
          <div><label htmlFor="fm-out" className="block text-sm font-medium mb-1">Hours outdoors on a usual day</label><input id="fm-out" type="number" min="0" max="12" step="0.5" value={f.outdoorHours} onChange={e => setF({...f, outdoorHours: e.target.value})} className={`${inputCls} w-full`}/></div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={list.length >= 8} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-700 text-white text-sm hover:bg-emerald-800 disabled:opacity-50"><Plus size={14} aria-hidden="true"/>Add</button>
            <button type="button" onClick={() => update(SAMPLE)} className="px-4 py-2 rounded-full border border-emerald-700 text-emerald-900 text-sm hover:bg-emerald-50">Load sample family</button>
          </div>
          <p className="text-xs text-slate-600">Saved on this device only. Up to 8 members.</p>
        </form>

        <div className="space-y-4" aria-live="polite">
          {top && <section className="glass p-4 text-sm"><p className="font-semibold text-slate-900">Most vulnerable today: {top.m.name} ({GROUPS[top.m.group].label})</p><p className="text-slate-700 mt-1">{TIP[top.a.level]}</p></section>}
          {!rows.length && <div className="glass p-6 text-center text-slate-700">Add your family, or load the sample family, to see personal exposure estimates.</div>}
          <ul className="grid gap-3 sm:grid-cols-2 stagger">
            {rows.map(({m, a}) => (
              <li key={m.id} className="glass p-4">
                <div className="flex items-start justify-between gap-2">
                  <div><h3 className="font-semibold text-slate-900">{m.name}</h3><p className="text-xs text-slate-600">{GROUPS[m.group].label}{m.conditions.length ? ` · ${m.conditions.map(c => CONDITIONS[c][0]).join(', ')}` : ''}</p></div>
                  <button onClick={() => update(list.filter(x => x.id !== m.id))} aria-label={`Remove ${m.name}`} className="p-1.5 rounded-lg text-slate-600 hover:bg-emerald-50"><Trash2 size={15} aria-hidden="true"/></button>
                </div>
                {a ? <>
                  <span className={`inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-full ${LEVEL[a.level]}`}>{a.level} risk today</span>
                  <dl className="grid grid-cols-2 gap-2 mt-3 text-sm">
                    <div className="rounded-xl bg-slate-100 p-2"><dt className="text-[11px] text-slate-600">Usual day</dt><dd className="font-bold text-slate-900">{a.usual.ug} µg</dd><dd className="text-[11px] text-slate-600">≈ {a.usual.cigs} cigarettes</dd></div>
                    <div className="rounded-xl bg-emerald-50 p-2"><dt className="text-[11px] text-slate-600">Following the plan</dt><dd className="font-bold text-emerald-900">{a.plan.ug} µg</dd><dd className="text-[11px] text-slate-600">≈ {a.plan.cigs} cigarettes</dd></div>
                  </dl>
                  <p className="text-sm mt-2 text-emerald-900"><b>Saves ≈ {a.saved} µg ({a.savedPct}%)</b> of PM2.5 inhaled today.</p>
                  <p className="text-xs text-slate-700 mt-1">{TIP[a.level]}</p>
                </> : <p className="text-sm text-slate-600 mt-2">Waiting for a PM2.5 reading.</p>}
              </li>
            ))}
          </ul>
          <details className="glass p-4 text-sm">
            <summary className="font-semibold cursor-pointer flex items-center gap-2"><Info size={16} aria-hidden="true"/>How these estimates work</summary>
            <div className="mt-3 space-y-2 text-slate-700">
              <p><b>Dose</b> = breathing rate × PM2.5 × time, summed over outdoor and indoor hours. Breathing rates are rounded typical values per age group. Indoors, we assume {INFILTRATION * 100}% of outdoor PM2.5 gets in with windows shut{profile.purifier ? ' and your purifier removes about half of that' : ''}.</p>
              <p><b>Following the plan</b> assumes outdoor time cut to {PLAN_OUTDOOR_SHARE * 100}% of usual, windows shut and a purifier or DIY cleaner removing about {PURIFIER_CUT * 100}% indoors.</p>
              <p><b>Risk level</b> compares today’s PM2.5 with the WHO 24-hour guideline ({WHO_PM25_24H} µg/m³), weighted up for young children, older adults and people with asthma, heart disease or pregnancy.</p>
              <p><b>Cigarette equivalent</b> uses a rough rule of thumb (a 24-hour average of {CIG_UG} µg/m³ ≈ one cigarette a day). It makes numbers easier to picture but is not a medical measurement. This is a planning aid, not medical advice.</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
