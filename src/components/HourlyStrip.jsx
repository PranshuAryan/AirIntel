import SrTable from './SrTable.jsx';
import {fmtHour} from '../services/plan.js';

// US PM2.5 24 h bands (µg/m³) and their colours
const BANDS = [[12, '#00e400'], [35.4, '#ffeb00'], [55.4, '#ff7e00'], [150.4, '#ff0000'], [250.4, '#8f3f97'], [Infinity, '#7e0023']];
export const bandColor = pm => BANDS.find(b => pm <= b[0])[1];
const inWindow = (h, w) => w && (w.start < w.end ? h >= w.start && h < w.end : h >= w.start || h < w.end);

/** 24-hour PM2.5 forecast as a bar strip; the cleanest window is outlined. */
export default function HourlyStrip({rows, win}) {
  if (!rows?.length) return null;
  const max = Math.max(...rows.map(r => r.pm25), 1);
  return (
    <div className="mt-3">
      <div role="img" aria-label={`Hourly PM2.5 forecast for the next ${rows.length} hours.${win ? ` Cleanest window ${win.label}.` : ''}`} className="flex items-end gap-0.5 h-24">
        {rows.map(r => (
          <div key={r.ts} title={`${fmtHour(r.hour)}: ${Math.round(r.pm25)} µg/m³`} className="flex-1 rounded-t-sm"
            style={{height: `${Math.max(10, (r.pm25 / max) * 100)}%`, background: bandColor(r.pm25), outline: inWindow(r.hour, win) ? '2px solid #047857' : 'none', outlineOffset: 1}}/>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-slate-600 mt-1" aria-hidden="true">
        {rows.filter((_, i) => i % 6 === 0).map(r => <span key={r.ts}>{fmtHour(r.hour)}</span>)}
      </div>
      <p className="text-[11px] text-slate-600 mt-1">Bar colour follows US PM2.5 bands (green is cleanest, red/purple is unhealthy). Outlined bars are your cleanest window.</p>
      <SrTable caption="Hourly PM2.5 forecast" headers={['Hour', 'PM2.5 µg/m³']} rows={rows.map(r => [fmtHour(r.hour), Math.round(r.pm25)])}/>
    </div>
  );
}
