import {useEffect, useId, useRef, useState} from 'react';
import {Search} from 'lucide-react';
import {geocode} from '../services/apiController.js';

/** Place search following the ARIA 1.2 combobox pattern: arrow keys, Enter, Escape, live result count. */
export default function SearchBox({onSelect, placeholder = 'Search any city, address or place…'}) {
  const [q, setQ] = useState(''), [res, setRes] = useState([]), [err, setErr] = useState(''), [active, setActive] = useState(-1), [open, setOpen] = useState(false);
  const uid = useId(), listId = `${uid}-list`, optId = i => `${uid}-opt-${i}`, wrap = useRef(null);

  useEffect(() => {
    if (q.trim().length < 3) { setRes([]); setErr(''); return; }
    const ctl = new AbortController(); // cancel stale requests so slow answers can't overwrite newer ones
    const t = setTimeout(() => geocode(q.trim(), ctl.signal).then(r => { setRes(r); setErr(''); setActive(-1); setOpen(true); }).catch(e => { if (e.name !== 'AbortError') { setErr(e.message); setOpen(true); } }), 300);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => { // close when a click leaves the widget
    const out = e => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', out);
    return () => document.removeEventListener('pointerdown', out);
  }, []);

  const choose = r => { onSelect(r); setQ(''); setRes([]); setOpen(false); setActive(-1); };
  const onKey = e => {
    if (e.key === 'ArrowDown' && res.length) { e.preventDefault(); setOpen(true); setActive(a => (a + 1) % res.length); }
    else if (e.key === 'ArrowUp' && res.length) { e.preventDefault(); setActive(a => (a <= 0 ? res.length - 1 : a - 1)); }
    else if (e.key === 'Enter' && open && res.length) { e.preventDefault(); choose(res[active >= 0 ? active : 0]); }
    else if (e.key === 'Escape') setOpen(false);
  };
  const show = open && (res.length > 0 || err);

  return (
    <div className="relative w-full" ref={wrap}>
      <div className="glass flex items-center gap-2 px-3 py-2 focus-within:ring-2 ring-emerald-500">
        <Search size={16} className="opacity-60" aria-hidden="true"/>
        <input type="text" role="combobox" aria-label="Search location" aria-autocomplete="list" aria-expanded={!!show} aria-controls={listId}
          aria-activedescendant={active >= 0 ? optId(active) : undefined} autoComplete="off" value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey}
          onFocus={() => res.length && setOpen(true)} placeholder={placeholder} className="bg-transparent outline-none w-full text-sm"/>
      </div>
      <div role="status" aria-live="polite" className="sr-only">{show && !err ? `${res.length} places found. Use the up and down arrows to choose.` : ''}</div>
      {err && open && <p role="alert" className="absolute z-[2000] mt-1 w-full rounded-xl bg-white shadow-lg border border-red-100 p-3 text-sm text-red-700">{err}</p>}
      <ul id={listId} role="listbox" aria-label="Matching places" hidden={!(open && res.length > 0)} className="absolute z-[2000] mt-1 w-full rounded-xl pop bg-white shadow-lg border border-emerald-100 overflow-hidden text-sm">
        {res.map((r, i) => (
          // keyboard users operate options through the combobox input (aria-activedescendant, Enter), per the ARIA 1.2 pattern
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <li key={`${r.lat},${r.lon},${i}`} id={optId(i)} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => choose(r)}
            className={`cursor-pointer px-3 py-2 ${i === active ? 'bg-emerald-100 text-emerald-950' : 'hover:bg-emerald-50'}`}>{r.label}</li>
        ))}
      </ul>
    </div>
  );
}
