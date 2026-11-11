import {useEffect,useRef,useState} from 'react';import {Send,Bot} from 'lucide-react';import {useApp} from '../AppContext.js';import {chat} from '../services/groq.js';
const SUG=["What's the AQI in London right now?","Is it safe to go for a run today?","Explain PM2.5 in simple words","Do I need a mask outside?"];
export default function AIAssistant(){
  const{air,place}=useApp(),[m,setM]=useState([{role:'assistant',content:"Hi! I'm your air-quality assistant. Ask me for the AQI of any place, what a pollutant means, or whether it's safe to go out."}]),[q,setQ]=useState(''),[busy,setBusy]=useState(false),end=useRef();
  useEffect(()=>{end.current?.scrollIntoView({behavior:'smooth'})},[m,busy]);
  const send=async t=>{t=(t??q).trim();if(!t||busy)return;const h=[...m,{role:'user',content:t}];setM(h);setQ('');setBusy(true);
    try{const a=await chat(h.slice(-10),place,air);setM([...h,{role:'assistant',content:a}])}catch(e){setM([...h,{role:'assistant',content:'Sorry, something went wrong: '+e.message}])}setBusy(false)};
  return<div className="max-w-3xl mx-auto p-4"><div className="glass flex flex-col h-[72vh]">
    <div className="p-3 border-b border-emerald-100 flex items-center gap-2 font-bold"><Bot className="text-emerald-600"/>Air quality assistant<span className="ml-auto text-xs font-normal text-slate-500">Powered by Groq · live AQI data</span></div>
    <div className="flex-1 overflow-y-auto p-4 space-y-3">{m.map((x,i)=><div key={i} className={`max-w-[85%] p-3 rounded-2xl text-sm whitespace-pre-wrap pop ${x.role==='user'?'ml-auto bg-emerald-600 text-white':'bg-emerald-50'}`}>{x.content}</div>)}
      {busy&&<div className="bg-emerald-50 rounded-2xl px-4 py-3 w-fit flex gap-1.5 items-center pop">{[0,1,2].map(i=><span key={i} className="w-2 h-2 rounded-full bg-emerald-500" style={{animation:'dots 1.2s infinite',animationDelay:i*.15+'s'}}/>)}<span className="ml-2 text-xs text-slate-500">Checking live data…</span></div>}
      {m.length===1&&<div className="flex flex-wrap gap-2">{SUG.map(s=><button key={s} onClick={()=>send(s)} className="text-xs px-3 py-1.5 rounded-full border border-emerald-300 text-emerald-800 hover:bg-emerald-50">{s}</button>)}</div>}<div ref={end}/></div>
    <div className="p-3 flex gap-2 border-t border-emerald-100"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Ask about any place, pollutant or safety…" className="flex-1 bg-emerald-50/60 rounded-xl px-3 py-2 outline-none text-sm focus:ring-2 ring-emerald-400"/>
      <button onClick={()=>send()} disabled={busy} aria-label="Send" className="p-2.5 rounded-xl bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700 hover:scale-105"><Send size={16}/></button></div></div></div>;
}
