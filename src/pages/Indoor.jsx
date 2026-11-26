import {useMemo, useState} from 'react';
import {House, Ruler, Wrench} from 'lucide-react';
import {useApp} from '../AppContext.js';
import {buildPlan, makeCtx} from '../services/plan.js';
import {requiredCadr, indoorEstimate, DIY_STEPS, ACH_TARGET} from '../services/indoor.js';

const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
export default function Indoor() {
  const {air, place, profile} = useApp();
  const [r, setR] = useState({length: 4, width: 3.5, height: 2.7});
  const need = requiredCadr(r), pm = air?.pollutants?.pm25?.conc, est = indoorEstimate(pm == null ? null : pm);
  const actions = useMemo(() => buildPlan(makeCtx({place, air, profile})).actions.filter(a => a.cat === 'indoor'), [place, air, profile]);
  const field = (k, label, max) => (
    <div><label htmlFor={`rm-${k}`} className="block text-sm font-medium mb-1">{label}</label>
      <input id={`rm-${k}`} type="number" min="1" max={max} step="0.1" inputMode="decimal" value={r[k]} onChange={e => setR({...r, [k]: e.target.value})} className={inputCls}/></div>
  );
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="rise">
        <h1 className="text-2xl md:text-3xl font-bold grad-text flex items-center gap-2"><House className="text-emerald-700" aria-hidden="true"/>Indoor air hub</h1>
        <p className="text-slate-700">Size an air cleaner for your room, build a low-cost one, and see the indoor hacks that matter most today in <b>{place.label}</b>.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="glass p-5 space-y-4" aria-labelledby="sz">
          <h2 id="sz" className="font-bold flex items-center gap-2"><Ruler size={16} className="text-emerald-700" aria-hidden="true"/>Purifier size calculator</h2>
          <div className="grid grid-cols-3 gap-3">{field('length', 'Length (m)', 30)}{field('width', 'Width (m)', 30)}{field('height', 'Ceiling (m)', 5)}</div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3" role="status">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-900">Look for a CADR of at least</p>
            <p className="text-2xl font-bold text-emerald-900">{need.m3h} m³/h <span className="text-sm font-normal text-slate-700">(≈ {need.cfm} cfm)</span></p>
            <p className="text-xs text-slate-700 mt-1">Room: {need.area} m², {need.volume} m³. Based on cleaning the room air about {ACH_TARGET} times an hour, the usual sizing rule for purifiers.</p>
          </div>
          {est && <p className="text-sm text-slate-700">At today’s outdoor PM2.5 of about <b>{Math.round(pm)} µg/m³</b>: windows shut ≈ <b>{est.closed}</b> µg/m³ indoors; with a purifier running ≈ <b>{est.purified}</b> µg/m³. These are estimates (see the Clean-Air Plan for assumptions).</p>}
        </section>
        <section className="glass p-5" aria-labelledby="diy">
          <h2 id="diy" className="font-bold flex items-center gap-2 mb-2"><Wrench size={16} className="text-emerald-700" aria-hidden="true"/>Build a low-cost cleaner (Corsi-Rosenthal box)</h2>
          <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-700">{DIY_STEPS.map(s => <li key={s}>{s}</li>)}</ol>
          <p className="text-xs text-slate-600 mt-3">Use a fan in good condition and don’t leave it unattended if it is old. Tests have shown this design can clean air about as fast as many small commercial purifiers.</p>
        </section>
      </div>
      <section aria-labelledby="hacks">
        <h2 id="hacks" className="font-bold text-lg mb-2">Today’s indoor hacks for your household</h2>
        <ul className="grid gap-3 md:grid-cols-2 stagger">{actions.map(a => (
          <li key={a.id} className="glass p-4"><h3 className="font-semibold text-slate-900">{a.title}</h3><p className="text-sm text-slate-700 mt-1">{a.why}</p>
            <p className="text-sm mt-2 font-semibold text-emerald-900">Direct impact: {a.impact}</p></li>))}</ul>
      </section>
    </div>
  );
}
