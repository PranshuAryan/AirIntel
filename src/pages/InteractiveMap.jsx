import {useCallback,useEffect,useRef,useState} from 'react';import {MapContainer,TileLayer,Pane,CircleMarker,Popup,useMap,useMapEvents} from 'react-leaflet';import L from 'leaflet';
import {useApp} from '../AppContext.js';import {naqi,concFromUs} from '../services/standards.js';import {lv,NAMES} from '../lib.js';import {getAirQuality,stations,reverseGeocode,KEYS} from '../services/apiController.js';
const SI=[[25,[0,176,80]],[75,[139,195,74]],[150,[245,217,10]],[250,[245,130,32]],[350,[229,57,53]],[450,[139,26,26]]];
const S=[[25,[0,228,0]],[75,[255,235,0]],[125,[255,126,0]],[175,[255,0,0]],[250,[143,63,151]],[400,[126,0,35]]];
const col=(a,S)=>{if(a<=S[0][0])return S[0][1];for(let i=1;i<S.length;i++)if(a<=S[i][0]){const[a0,c0]=S[i-1],[a1,c1]=S[i],t=(a-a0)/(a1-a0);return c0.map((v,k)=>v+(c1[k]-v)*t)}return S[5][1]};
function Shade(){
  const map=useMap(),{std}=useApp(),ref=useRef(null),[st,setSt]=useState([]);
  const load=useCallback(()=>{const b=map.getBounds();stations(Math.max(-90,b.getSouth()),Math.max(-180,b.getWest()),Math.min(90,b.getNorth()),Math.min(180,b.getEast())).then(setSt).catch(()=>{})},[map]);
  const draw=useCallback(()=>{
    const c=ref.current;if(!c)return;const sz=map.getSize(),step=12,w=Math.ceil(sz.x/step),h=Math.ceil(sz.y/step);
    c.width=w;c.height=h;c.style.width=w*step+'px';c.style.height=h*step+'px';L.DomUtil.setPosition(c,map.containerPointToLayerPoint([0,0]));
    const ctx=c.getContext('2d'),img=ctx.createImageData(w,h),R=Math.max(150,0.0064*2**map.getZoom()*Math.cos(map.getCenter().lat*Math.PI/180)*80);
    const val=a=>std==='in'?(naqi('pm25',concFromUs('pm25',a))??a):a;
    const P=st.map(s=>{const q=map.latLngToContainerPoint([s.lat,s.lon]);return[q.x,q.y,val(s.aqi)]}).filter(q=>q[0]>-R&&q[0]<sz.x+R&&q[1]>-R&&q[1]<sz.y+R);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const px=x*step+step/2,py=y*step+step/2;let sw=0,sa=0,dm=1e12;
      for(const q of P){const d2=(q[0]-px)**2+(q[1]-py)**2;if(d2>R*R)continue;const k=1/(d2+400);sw+=k;sa+=k*q[2];if(d2<dm)dm=d2}
      if(!sw)continue;const[r,g,b]=col(sa/sw,std==='in'?SI:S);img.data.set([r,g,b,Math.pow(1-Math.sqrt(dm)/R,.6)*190],(y*w+x)*4);
    }
    ctx.putImageData(img,0,0);c.style.opacity=1;
  },[map,st,std]);
  useEffect(()=>{const pane=map.getPane('shade')||map.createPane('shade');pane.style.zIndex=250;pane.style.pointerEvents='none';
    const c=L.DomUtil.create('canvas','',pane);c.style.filter='blur(6px)';c.style.transition='opacity .4s';ref.current=c;return()=>c.remove()},[map]);
  useEffect(()=>{draw()},[draw]);useEffect(()=>{load()},[]);
  useMapEvents({moveend:()=>{draw();load()},zoomstart:()=>{if(ref.current)ref.current.style.opacity=0}});
  return null;
}
function Detail({lat,lng}){
  const{std}=useApp(),[a,setA]=useState(null),[name,setName]=useState(''),[e,setE]=useState('');
  useEffect(()=>{getAirQuality(lat,lng).then(setA).catch(x=>setE(x.message));
    reverseGeocode(lat,lng).then(r=>setName(r.label)).catch(()=>setName(`${lat.toFixed(2)}°, ${lng.toFixed(2)}°`))},[lat,lng,std]);
  if(e)return<p className="text-slate-900 w-56 text-sm">No live ground-station reading near this spot.</p>;
  if(!a)return<p className="text-slate-900 w-56 text-sm">Loading air quality…</p>;
  const l=lv(a.aqi);
  return<div className="text-slate-900 w-60 space-y-2">
    <p className="font-bold leading-tight">{name||'Selected location'}</p>
    <div><span className="text-4xl font-bold" style={{color:l.text}}>{a.aqi}</span> <span className="text-sm font-semibold" style={{color:l.text}}>{l.name}</span><p className="text-xs text-slate-600">{l.note}</p></div>
    <div className="grid grid-cols-3 gap-1 text-xs">{KEYS.map(k=>{const p=a.pollutants[k],c=p?.sub!=null?lv(p.sub):null;
      return<div key={k} className="bg-slate-50 rounded p-1.5" style={{borderTop:`3px solid ${c?c.color:'#cbd5e1'}`}}><b>{NAMES[k]}</b><br/>{p?(p.sub??p.value):'—'}</div>})}</div>
    <p className="text-[10px] text-slate-500">Updated {new Date(a.updated).toLocaleString()} · pollutant values are AQI sub-indices</p></div>;
}
function Layer(){
  const{place}=useApp(),map=useMap(),[sel,setSel]=useState(null),first=useRef(true);
  useEffect(()=>{if(first.current){first.current=false;return}map.flyTo([place.lat,place.lon],9,{duration:1.4});setSel({lat:place.lat,lng:place.lon})},[place,map]);
  useMapEvents({click:e=>{const p=e.latlng.wrap();if(map.getZoom()<5)map.flyTo(p,6,{duration:1});setSel({lat:p.lat,lng:p.lng})}});
  return<><Shade/>{sel&&<><CircleMarker key={'p'+sel.lat+sel.lng} className="pin-pulse" center={[sel.lat,sel.lng]} radius={6} interactive={false} pathOptions={{stroke:false,fillColor:'#10b981',fillOpacity:.5}}/><CircleMarker center={[sel.lat,sel.lng]} radius={6} interactive={false} pathOptions={{color:'#047857',weight:3,fillColor:'#fff',fillOpacity:1}}/>
    <Popup key={sel.lat+','+sel.lng} position={[sel.lat,sel.lng]} eventHandlers={{remove:()=>setSel(null)}}><Detail lat={sel.lat} lng={sel.lng}/></Popup></>}</>;
}
const ESRI='https://server.arcgisonline.com/ArcGIS/rest/services/';
export default function InteractiveMap(){
  const{std}=useApp();
  return<div className="relative" style={{height:'calc(100vh - 118px)'}}>
    <MapContainer center={[20,10]} zoom={3} minZoom={2} maxZoom={13} worldCopyJump className="h-full w-full">
      <TileLayer attribution="Tiles © Esri, HERE, Garmin, OpenStreetMap contributors · AQI shading: live station data (WAQI)" maxNativeZoom={13} url={ESRI+'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'}/>
      <Layer/>
      <Pane name="labels" style={{zIndex:350,pointerEvents:'none'}}><TileLayer maxNativeZoom={13} url={ESRI+'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'}/></Pane></MapContainer>
    <div className="glass fade absolute top-3 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 text-sm text-emerald-800 shadow">Click anywhere on the map to see its air quality</div>
    <div className="glass rise absolute bottom-6 left-4 z-[1000] p-3 text-xs w-64"><p className="font-bold mb-1">{std==='in'?'India NAQI (CPCB)':'US AQI'}</p>
      <div className="h-3 rounded-full" style={{background:std==='in'?'linear-gradient(to right,#00b050,#8bc34a,#f5d90a,#f58220,#e53935,#8b1a1a)':'linear-gradient(to right,#00e400,#ffeb00,#ff7e00,#ff0000,#8f3f97,#7e0023)'}}/>
      <div className="flex justify-between mt-1 text-slate-600">{(std==='in'?[0,50,100,200,300,'400+']:[0,50,100,150,200,'300+']).map(x=><span key={x}>{x}</span>)}</div>
      <p className="text-[10px] text-slate-500 mb-1">Shaded from live station readings{std==='in'?' (NAQI approximated)':''}. No colour = no station nearby.</p><div className="flex justify-between text-slate-500"><span>Good</span><span>{std==='in'?'Severe':'Hazardous'}</span></div></div></div>;
}
