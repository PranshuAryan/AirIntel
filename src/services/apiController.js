import {applyStandard,toConc,concFromUs,naqi,usIndex,getStandard} from './standards.js';
const E=import.meta.env,WAQI=E.VITE_WAQI_TOKEN||'demo',GEO=E.VITE_GEOAPIFY_KEY,OAQ=E.VITE_OPENAQ_KEY;
const OM='https://air-quality-api.open-meteo.com/v1/air-quality';
export const KEYS=['pm25','pm10','no2','so2','co','o3'];
export const km=(a,b,c,d)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return +(12742*Math.asin(Math.sqrt(h))).toFixed(1)};
const j=async(u,o)=>{const r=await fetch(u,{cache:'no-store',...o});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()};
const BP=[[0,12,0,50],[12.1,35.4,51,100],[35.5,55.4,101,150],[55.5,150.4,151,200],[150.5,250.4,201,300],[250.5,350.4,301,400],[350.5,500.4,401,500]];
export const pm25Aqi=c=>{const b=BP.find(b=>c<=b[1])||BP[5];return Math.round((b[3]-b[2])/(b[1]-b[0])*(c-b[0])+b[2])};
export async function geocode(q){
  if(!GEO)throw new Error('Set VITE_GEOAPIFY_KEY in .env');
  const d=await j(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&limit=6&apiKey=${GEO}`);
  return d.features.map(f=>({label:f.properties.formatted,lat:f.properties.lat,lon:f.properties.lon,cc:f.properties.country_code}));
}
const when=x=>x.time?.v?new Date(x.time.v*1000).toISOString():(x.time?.iso||x.time?.s),okF=d=>d.status==='ok'&&typeof d.data.aqi==='number';
async function waqi(lat,lon){
  let x=null;try{const d=await j(`https://api.waqi.info/feed/geo:${lat};${lon}/?token=${WAQI}`);if(okF(d))x=d.data}catch{}
  if(!x||(Date.now()-new Date(when(x)))/36e5>3){ // nearest station is stale or missing: look for a fresher one nearby
    try{const m=await j(`https://api.waqi.info/v2/map/bounds?latlng=${lat-1},${lon-1},${lat+1},${lon+1}&networks=all&token=${WAQI}`);
      const c=(m.data||[]).filter(s=>!isNaN(+s.aqi)&&(Date.now()-new Date(s.station.time))/36e5<=3).map(s=>({...s,d:km(lat,lon,s.lat,s.lon)})).sort((a,b)=>a.d-b.d)[0];
      if(c){const f=await j(`https://api.waqi.info/feed/@${c.uid}/?token=${WAQI}`);if(okF(f))x=f.data}}catch{}
  }
  if(!x)throw new Error('no station data');
  const i=x.iaqi||{},p={};KEYS.forEach(k=>{if(i[k])p[k]={value:i[k].v,unit:'AQI idx',sub:i[k].v,conc:concFromUs(k,i[k].v)}});
  const[sl,sn]=x.city.geo,dist=km(lat,lon,sl,sn);if(dist>100)throw new Error('nearest station is '+dist+' km away');
  return{source:'WAQI Station',type:'MEASUREMENT',station:x.city.name,distanceKm:dist,updated:when(x),aqi:x.aqi,pollutants:p,coords:[sl,sn]};
}
async function openaq(lat,lon){
  if(!OAQ)throw new Error('key missing');const H={headers:{'X-API-Key':OAQ}};
  const L=(await j(`https://api.openaq.org/v3/locations?coordinates=${lat},${lon}&radius=25000&limit=1`,H)).results?.[0];
  if(!L)throw new Error('none within 25 km');
  const m={};L.sensors.forEach(s=>m[s.id]=s.parameter);
  const la=await j(`https://api.openaq.org/v3/locations/${L.id}/latest`,H),p={};
  la.results.forEach(r=>{const n=m[r.sensorsId];if(n&&KEYS.includes(n.name))p[n.name]={value:r.value,unit:n.units,sub:null,conc:toConc(n.name,r.value,n.units)}});
  if(!p.pm25)throw new Error('no PM2.5');p.pm25.sub=pm25Aqi(p.pm25.value);
  const c=[L.coordinates.latitude,L.coordinates.longitude];
  return{source:'OpenAQ Station',type:'MEASUREMENT',station:L.name,distanceKm:km(lat,lon,...c),updated:la.results.map(r=>r.datetime.utc).sort().at(-1),aqi:p.pm25.sub,pollutants:p,coords:c};
}
const ageH=a=>(Date.now()-new Date(a.updated))/36e5,fin=(r,errors)=>applyStandard({...r,errors,fetchedAt:new Date().toISOString()});
/* ground measurements only: a reading older than 3 h is stale, the freshest station is shown (flagged) up to 24 h; no model fallback */
export async function getAirQuality(lat,lon){
  const errors=[];let best=null;
  for(const[n,f]of[['WAQI',waqi],['OpenAQ',openaq]]){
    try{const r=await f(lat,lon),h=ageH(r);
      if(h<=3)return fin(r,errors);
      errors.push(`${n}: last report ${h.toFixed(1)} h ago`);
      if(!best||new Date(r.updated)>new Date(best.updated))best=r;
    }catch(e){errors.push(`${n}: ${e.message}`)}
  }
  if(best&&ageH(best)<=24)return fin({...best,stale:true},errors);
  throw new Error('No live ground-station reading within range of this location. '+errors.join(' · '));
}
export async function stations(s,w,n,e){
  const d=await j(`https://api.waqi.info/v2/map/bounds?latlng=${Math.max(-90,s)},${Math.max(-180,w)},${Math.min(90,n)},${Math.min(180,e)}&networks=all&token=${WAQI}`);
  return(d.data||[]).filter(x=>!isNaN(+x.aqi)&&(!x.station.time||Date.now()-new Date(x.station.time)<864e5)).map(x=>({lat:x.lat,lon:x.lon,aqi:+x.aqi,name:x.station.name,time:x.station.time}));
}
export const tileUrl=`https://tiles.waqi.info/tiles/usepa-aqi/{z}/{x}/{y}.png?token=${WAQI}`;
const avg=a=>{const v=a.filter(x=>x!=null);return v.length?Math.round(v.reduce((s,x)=>s+x,0)/v.length*10)/10:null};
const dayAqi=v=>{if(getStandard()!=='in')return avg(v.a);const p=avg(v.p),q=avg(v.q),a=[p!=null?naqi('pm25',p):null,q!=null?naqi('pm10',q):null].filter(x=>x!=null);return a.length?Math.max(...a):null};
const fmt=(d,o)=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',o);
export async function series(lat,lon,{past=0,future=1}){
  const d=await j(`${OM}?latitude=${lat}&longitude=${lon}&hourly=us_aqi,pm2_5,pm10&past_days=${past}&forecast_days=${future}`),by={};
  d.hourly.time.forEach((t,i)=>{const o=by[t.slice(0,10)]??={a:[],p:[],q:[]};o.a.push(d.hourly.us_aqi[i]);o.p.push(d.hourly.pm2_5[i]);o.q.push(d.hourly.pm10[i])});
  return Object.entries(by).map(([date,v])=>({date:fmt(date,{day:'numeric',month:'short'}),day:fmt(date,{weekday:'short'}),aqi:dayAqi(v),pm25:avg(v.p),pm10:avg(v.q)}));
}
export async function reverseGeocode(lat,lon){
  const p=(await j(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEO}`)).features[0].properties;
  return{label:[p.city||p.county||p.name,p.state,p.country].filter(Boolean).join(', ')||p.formatted,cc:p.country_code};
}
export async function measuredSeries(lat,lon,days){
  if(!OAQ)throw new Error('OpenAQ key missing');const H={headers:{'X-API-Key':OAQ}};
  const ls=(await j(`https://api.openaq.org/v3/locations?coordinates=${lat},${lon}&radius=25000&limit=20`,H)).results||[];
  const has=(l,n)=>l.sensors.some(s=>s.parameter.name===n);
  const L=ls.find(l=>has(l,'pm25')&&has(l,'pm10'))||ls.find(l=>has(l,'pm25'));
  if(!L)throw new Error('no OpenAQ station with PM data within 25 km');
  const from=new Date(Date.now()-(days+1)*864e5).toISOString(),to=new Date().toISOString();
  const get=async n=>{const s=L.sensors.find(s=>s.parameter.name===n);if(!s)return{};
    const d=await j(`https://api.openaq.org/v3/sensors/${s.id}/days?datetime_from=${from}&datetime_to=${to}&limit=100`,H);
    return Object.fromEntries((d.results||[]).filter(r=>r.value!=null&&r.period?.datetimeFrom).map(r=>[(r.period.datetimeFrom.local||r.period.datetimeFrom.utc).slice(0,10),r.value]))};
  const[a,b]=await Promise.all([get('pm25'),get('pm10')]),inn=getStandard()==='in';
  const rows=[...new Set([...Object.keys(a),...Object.keys(b)])].sort().map(k=>{const p=a[k]??null,q=b[k]??null,v=(inn?[naqi('pm25',p),naqi('pm10',q)]:[usIndex('pm25',p),usIndex('pm10',q)]).filter(x=>x!=null);
    return{date:fmt(k,{day:'numeric',month:'short'}),day:fmt(k,{weekday:'short'}),aqi:v.length?Math.max(...v):null,pm25:p!=null?+p.toFixed(1):null,pm10:q!=null?+q.toFixed(1):null}});
  if(!rows.length)throw new Error('the station has no recent daily data');
  return{rows,station:L.name,dist:km(lat,lon,L.coordinates.latitude,L.coordinates.longitude)};
}
