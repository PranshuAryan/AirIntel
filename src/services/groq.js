import {geocode,getAirQuality} from './apiController.js';import {lv} from '../lib.js';
const KEY=import.meta.env.VITE_GROQ_KEY; // local dev only; in production the key stays server-side (api/groq.js)
/* llama-3.3-70b-versatile was retired by Groq (Aug 2026). Replacement: openai/gpt-oss-120b; others are automatic fallbacks. */
const MODELS=[import.meta.env.VITE_GROQ_MODEL,'openai/gpt-oss-120b','openai/gpt-oss-20b','qwen/qwen3.8-27b'].filter(Boolean);let okModel=null;
async function call(messages,extra={}){
  let last='';
  for(const model of okModel?[okModel]:MODELS){
    const r=await fetch(KEY?'https://api.groq.com/openai/v1/chat/completions':'/api/groq',{method:'POST',headers:{'Content-Type':'application/json',...(KEY?{Authorization:`Bearer ${KEY}`}:{})},
      body:JSON.stringify({model,messages,temperature:.3,max_tokens:2000,...(model.startsWith('openai/')?{reasoning_effort:'low'}:{}),...extra})});
    if(r.status===404){last=await r.text();continue}
    if(!r.ok)throw new Error(`Groq error ${r.status}: ${(await r.text()).slice(0,160)}`);
    okModel=model;return(await r.json()).choices[0].message;
  }
  throw new Error('No Groq model available: '+last.slice(0,160));
}
const summarize=(place,a)=>({place:place.label,aqi:a.aqi,aqi_standard:a.std==='in'?'India NAQI (CPCB, 0-500)':'US AQI (EPA, 0-500)',category:lv(a.aqi).name,data_type:a.type==='MEASUREMENT'?'live ground measurement':'model estimate',source:a.source,updated:a.updated,
  pollutants:Object.fromEntries(Object.entries(a.pollutants).map(([k,v])=>[k,{value:v.value,unit:v.unit,aqi_subindex:v.sub}]))});
const TOOLS=[{type:'function',function:{name:'get_air_quality',description:'Get the live AQI and pollutant readings for any city, address or place name.',parameters:{type:'object',properties:{place:{type:'string',description:'e.g. "Tokyo" or "Connaught Place, Delhi"'}},required:['place']}}}];
async function lookup(name){const g=(await geocode(name))[0];if(!g)return{error:'Place not found'};return summarize({label:g.label},await getAirQuality(g.lat,g.lon))}
export async function chat(history,place,air){
  const sys=`You are AirIntel's air-quality assistant inside a web app. Be accurate, friendly and concise (under 150 words unless asked for more). Plain text only: no markdown symbols like ** or #; use "-" for bullets.
User's selected location right now: ${air?JSON.stringify(summarize(place,air)):'air data unavailable'}.
For the AQI or air quality of ANY other place, call get_air_quality; never guess numbers. When quoting readings, name the place, the AQI and its category, say whether it is a live ground measurement or a model estimate, and give the update time and the AQI standard (India NAQI and US AQI differ). Scale safety advice to the AQI. You are not a doctor. Politely decline topics unrelated to air quality, pollution or health.`;
  const msgs=[{role:'system',content:sys},...history.map(({role,content})=>({role,content}))];
  for(let i=0;i<3;i++){
    const m=await call(msgs,{tools:TOOLS,tool_choice:'auto'});
    if(!m.tool_calls?.length)return m.content;
    msgs.push({role:'assistant',content:m.content||'',tool_calls:m.tool_calls});
    for(const t of m.tool_calls){let out;try{out=await lookup(JSON.parse(t.function.arguments).place)}catch(e){out={error:e.message}}
      msgs.push({role:'tool',tool_call_id:t.id,content:JSON.stringify(out)})}
  }
  return(await call(msgs)).content;
}
export async function advise(place,air){
  const sys='You are an air-quality health advisor. Reply ONLY with a JSON object: {"summary":string (2 sentences on the current situation),"do_now":[3-5 short actions],"groups":{"asthma":string,"elderly":string,"children":string,"athletes":string},"outdoor":{"ventilation":string,"mask":string,"workout":string}}. Base everything strictly on the readings given (mention the dominant pollutant). Practical, concise, no diagnosis.';
  const m=await call([{role:'system',content:sys},{role:'user',content:JSON.stringify(summarize(place,air))}],{response_format:{type:'json_object'}});
  return JSON.parse(m.content);
}
