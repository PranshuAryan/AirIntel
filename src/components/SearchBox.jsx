import {useEffect,useState} from 'react';import {Search} from 'lucide-react';import {geocode} from '../services/apiController.js';
export default function SearchBox({onSelect,placeholder='Search any city, address or place…'}){
  const[q,setQ]=useState(''),[res,setRes]=useState([]),[err,setErr]=useState('');
  useEffect(()=>{if(q.length<3){setRes([]);return}
    const t=setTimeout(()=>geocode(q).then(r=>{setRes(r);setErr('')}).catch(e=>setErr(e.message)),300);return()=>clearTimeout(t)},[q]);
  return<div className="relative w-full"><div className="glass flex items-center gap-2 px-3 py-2 focus-within:ring-2 ring-emerald-400"><Search size={16} className="opacity-60"/>
    <input aria-label="Search location" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&res[0]){onSelect(res[0]);setQ("");setRes([])}}} placeholder={placeholder} className="bg-transparent outline-none w-full text-sm"/></div>
    {(res.length>0||err)&&<ul className="absolute z-[2000] mt-1 w-full rounded-xl pop bg-white shadow-lg border border-emerald-100 overflow-hidden text-sm">
      {err&&<li className="p-3 text-red-600">{err}</li>}
      {res.map((r,i)=><li key={i}><button className="w-full text-left px-3 py-2 hover:bg-emerald-50" onClick={()=>{onSelect(r);setQ('');setRes([])}}>{r.label}</button></li>)}</ul>}</div>;
}
