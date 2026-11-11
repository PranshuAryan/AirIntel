import {setScale} from '../lib.js';
/* India NAQI (CPCB 2014): concentration in µg/m³ (CO in mg/m³) -> sub-index; overall = worst sub-index */
const IN_BP={pm25:[[0,30,0,50],[31,60,51,100],[61,90,101,200],[91,120,201,300],[121,250,301,400],[251,500,401,500]],
pm10:[[0,50,0,50],[51,100,51,100],[101,250,101,200],[251,350,201,300],[351,430,301,400],[431,600,401,500]],
no2:[[0,40,0,50],[41,80,51,100],[81,180,101,200],[181,280,201,300],[281,400,301,400],[401,500,401,500]],
so2:[[0,40,0,50],[41,80,51,100],[81,380,101,200],[381,800,201,300],[801,1600,301,400],[1601,2000,401,500]],
o3:[[0,50,0,50],[51,100,51,100],[101,168,101,200],[169,208,201,300],[209,748,301,400],[749,900,401,500]],
co:[[0,1,0,50],[1.1,2,51,100],[2.1,10,101,200],[10.1,17,201,300],[17.1,34,301,400],[34.1,50,401,500]]};
/* US EPA breakpoints (units: µg/m³ PM, ppb NO2/SO2, ppm O3/CO) used to invert WAQI's US-scale sub-indices */
const US_BP={pm25:[[0,12,0,50],[12.1,35.4,51,100],[35.5,55.4,101,150],[55.5,150.4,151,200],[150.5,250.4,201,300],[250.5,350.4,301,400],[350.5,500.4,401,500]],
pm10:[[0,54,0,50],[55,154,51,100],[155,254,101,150],[255,354,151,200],[355,424,201,300],[425,504,301,400],[505,604,401,500]],
no2:[[0,53,0,50],[54,100,51,100],[101,360,101,150],[361,649,151,200],[650,1249,201,300],[1250,1649,301,400],[1650,2049,401,500]],
so2:[[0,35,0,50],[36,75,51,100],[76,185,101,150],[186,304,151,200],[305,604,201,300],[605,804,301,400],[805,1004,401,500]],
o3:[[0,.054,0,50],[.055,.07,51,100],[.071,.085,101,150],[.086,.105,151,200],[.106,.2,201,300],[.201,.404,301,400],[.405,.604,401,500]],
co:[[0,4.4,0,50],[4.5,9.4,51,100],[9.5,12.4,101,150],[12.5,15.4,151,200],[15.5,30.4,201,300],[30.5,40.4,301,400],[40.5,50.4,401,500]]};
const MULT={pm25:1,pm10:1,no2:1.88,so2:2.62,o3:1960,co:1.145},FACT={no2:1.88,so2:2.62,o3:1.96,co:1.145},KEYS=['pm25','pm10','no2','so2','co','o3'];
export const naqi=(k,x)=>{if(x==null||isNaN(x))return null;const bp=IN_BP[k],b=bp.find(b=>x<=b[1])||bp.at(-1);return Math.round(Math.min(500,(b[3]-b[2])/(b[1]-b[0])*(x-b[0])+b[2]))};
export function concFromUs(k,idx){const bp=US_BP[k];if(!bp||idx==null)return null;const b=bp.find(b=>idx<=b[3])||bp.at(-1);return +(((idx-b[2])/(b[3]-b[2])*(b[1]-b[0])+b[0])*MULT[k]).toFixed(2)}
export function toConc(k,v,unit){const u=(unit||'').toLowerCase();if(k==='pm25'||k==='pm10')return v;
  if(k==='co')return u.includes('ppm')?v*1.145:u.includes('ppb')?v*.001145:v/1000;
  return u.includes('ppm')?v*1000*FACT[k]:u.includes('ppb')?v*FACT[k]:v}
let STD='us';export const getStandard=()=>STD;export const setStandard=s=>{STD=s==='in'?'in':'us';setScale(STD)};
export function applyStandard(a){
  if(STD!=='in')return{...a,std:'us'};
  const p={};let best=null;
  KEYS.forEach(k=>{const o=a.pollutants[k];if(!o||o.conc==null)return;const sub=naqi(k,o.conc);
    p[k]={value:+o.conc.toFixed(k==='co'?2:1),unit:k==='co'?'mg/m³':'µg/m³',sub,conc:o.conc};if(sub!=null&&(!best||sub>best.sub))best={k,sub}});
  if(!best)return{...a,std:'us'};
  return{...a,std:'in',pollutants:p,aqi:best.sub,dominant:best.k,converted:a.source.startsWith('WAQI')};
}
