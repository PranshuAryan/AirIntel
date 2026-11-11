import {applyStandard,toConc,concFromUs,naqi,getStandard} from './standards.js';
const E=import.meta.env,WAQI=E.VITE_WAQI_TOKEN||'demo',GEO=E.VITE_GEOAPIFY_KEY,OAQ=E.VITE_OPENAQ_KEY;
const OM='https://air-quality-api.open-meteo.com/v1/air-quality';
export const KEYS=['pm25','pm10','no2','so2','co','o3'];
export const km=(a,b,c,d)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return +(12742*Math.asin(Math.sqrt(h))).toFixed(1)};
const j=async(u,o)=>{const r=await fetch(u,o);if(!r.ok)throw new Error('HTTP '+r.status);return r.json()};
const BP=[[0,12,0,50],[12.1,35.4,51,100],[35.5,55.4,101,150],[55.5,150.4,151,200],[150.5,250.4,201,300],[250.5,350.4,301,400],[350.5,500.4,401,500]];
export const pm25Aqi=c=>{const b=BP.find(b=>c<=b[1])||BP[5];return Math.round((b[3]-b[2])/(b[1]-b[0])*(c-b[0])+b[2])};
export async function geocode(q){
  if(!GEO)throw new Error('Set VITE_GEOAPIFY_KEY in .env');
  const d=await j(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&limit=6&apiKey=${GEO}`);
  return d.features.map(f=>({label:f.properties.formatted,lat:f.properties.lat,lon:f.properties.lon,cc:f.properties.country_code}));
}
async function waqi(lat,lon){
  const d=await j(`https://api.waqi.info/feed/geo:${lat};${lon}/?token=${WAQI}`);
  if(d.status!=='ok'||typeof d.data.aqi!=='number')throw new Error('no data');
  const x=d.data,i=x.iaqi||{},p={};KEYS.forEach(k=>{if(i[k])p[k]={value:i[k].v,unit:'AQI idx',sub:i[k].v,conc:concFromUs(k,i[k].v)}});
  const[sl,sn]=x.city.geo,dist=km(lat,lon,sl,sn);if(dist>100)throw new Error('nearest station >100 km');
  return{source:'WAQI Station',type:'MEASUREMENT',station:x.city.name,distanceKm:dist,updated:x.time.iso||x.time.s,aqi:x.aqi,pollutants:p,coords:[sl,sn]};
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
  return{source:'OpenAQ Station',type:'MEASUREMENT',station:L.name,distanceKm:km(lat,lon,...c),updated:la.results[0].datetime.utc,aqi:p.pm25.sub,pollutants:p,coords:c};
}
async function meteo(lat,lon){
  const M={pm25:['pm2_5','us_aqi_pm2_5'],pm10:['pm10','us_aqi_pm10'],no2:['nitrogen_dioxide','us_aqi_nitrogen_dioxide'],so2:['sulphur_dioxide','us_aqi_sulphur_dioxide'],co:['carbon_monoxide','us_aqi_carbon_monoxide'],o3:['ozone','us_aqi_ozone']};
  const f=['us_aqi',...Object.values(M).flat()].join(',');
  const c=(await j(`${OM}?latitude=${lat}&longitude=${lon}&current=${f}`)).current,p={};
  KEYS.forEach(k=>p[k]={value:c[M[k][0]],unit:'µg/m³',sub:c[M[k][1]],conc:c[M[k][0]]==null?null:(k==='co'?c[M[k][0]]/1000:c[M[k][0]])});
  return{source:'Open-Meteo CAMS Model',type:'MODEL',station:'Model grid cell (no ground station)',distanceKm:0,updated:new Date(c.time+'Z').toISOString(),aqi:c.us_aqi,pollutants:p,coords:[lat,lon]};
}
export async function getAirQuality(lat,lon){
  const errors=[];
  for(const[n,f]of[['WAQI',waqi],['OpenAQ',openaq],['Open-Meteo',meteo]]){
    try{return applyStandard({...await f(lat,lon),errors})}catch(e){errors.push(`${n}: ${e.message}`)}
  }
  throw new Error('All providers failed — '+errors.join('; '));
}
export async function stations(s,w,n,e){
  const d=await j(`https://api.waqi.info/v2/map/bounds?latlng=${Math.max(-90,s)},${Math.max(-180,w)},${Math.min(90,n)},${Math.min(180,e)}&networks=all&token=${WAQI}`);
  return(d.data||[]).filter(x=>!isNaN(+x.aqi)).map(x=>({lat:x.lat,lon:x.lon,aqi:+x.aqi,name:x.station.name,time:x.station.time}));
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
