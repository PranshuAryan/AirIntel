const US=[[50,'Good','#00e400','Air quality is satisfactory.','#15803d'],[100,'Moderate','#ffff00','Unusually sensitive people should limit prolonged exertion.','#a16207'],[150,'Unhealthy for Sensitive Groups','#ff7e00','Sensitive groups may feel effects.','#c2410c'],[200,'Unhealthy','#ff0000','Everyone may begin to feel effects.','#b91c1c'],[300,'Very Unhealthy','#8f3f97','Health alert: serious effects for everyone.','#7e22ce'],[Infinity,'Hazardous','#7e0023','Emergency conditions: avoid all outdoor exertion.','#7e0023']];
const IN=[[50,'Good','#00b050','Minimal impact.','#166534'],[100,'Satisfactory','#8bc34a','Minor breathing discomfort to sensitive people.','#4d7c0f'],[200,'Moderate','#f5d90a','Breathing discomfort to people with lung or heart disease, children and older adults.','#a16207'],[300,'Poor','#f58220','Breathing discomfort to most people on prolonged exposure.','#c2410c'],[400,'Very Poor','#e53935','Respiratory illness on prolonged exposure.','#b91c1c'],[Infinity,'Severe','#8b1a1a','Affects healthy people and seriously impacts those with existing illness.','#7f1d1d']];
export let LV=US,SCALE='us';
export const setScale=s=>{SCALE=s==='in'?'in':'us';LV=SCALE==='in'?IN:US};
export const getScale=()=>SCALE;
export const lv=a=>{const l=LV.find(l=>a<=l[0])||LV[5];return{name:l[1],color:l[2],note:l[3],text:l[4]}};
export const NAMES={pm25:'PM2.5',pm10:'PM10',no2:'NO₂',so2:'SO₂',co:'CO',o3:'O₃'};
export const ago=iso=>{const m=Math.max(0,Math.round((Date.now()-new Date(iso))/6e4));return isNaN(m)?'':m<1?'just now':m<60?`${m} min ago`:m<1440?`${Math.floor(m/60)} h ${m%60} min ago`:`${Math.floor(m/1440)} d ago`};
export const fmt=iso=>isNaN(new Date(iso))?String(iso):new Date(iso).toLocaleString([],{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
