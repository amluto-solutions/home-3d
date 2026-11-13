import{D as Se,F as ft,G as Tt,H as Ie,I as Ct,J as Rt,L as Mt,M as Lt,O as He,P as Pt,W as Te,X as mt,Y as Ce,_ as Re,a as C,c as tt,d as T,x as Ht}from"./home-3d-chunk-LX2UVHU7.js";import{b as $e}from"./home-3d-chunk-EG36DINC.js";import{a as fe,e as rt,f as at,g as lt}from"./home-3d-chunk-CDORITH3.js";import"./home-3d-chunk-ZFJT3TUE.js";import{b as Qt,c as Xt,e as Zt,i as ue}from"./home-3d-chunk-7GMSEBV6.js";import{j as ee}from"./home-3d-chunk-SYUW2Q23.js";import{a as Q,f as te,g as me,h as dt,i as ht,j as pt,k as R,n as ge,o as _e,p as ve,q as St}from"./home-3d-chunk-ZWQZ3257.js";import{a as de,b as he,d as k,e as F,f as xe,g as ct,j as ut,k as It,o as ke,p as Ee}from"./home-3d-chunk-CKCWICTB.js";import{a as be,c as we,f as ye}from"./home-3d-chunk-J6PKV2EX.js";import{A as re,N as Z,c as X,o as ne}from"./home-3d-chunk-GTALZ6QT.js";import{H as oe,n as z,s as ie,v as se,z as I}from"./home-3d-chunk-COICRQXC.js";import"./home-3d-chunk-K3X4I6FU.js";import{d as pe,e as A,f as U,g as et,h as S,i as ce}from"./home-3d-chunk-J6KM7YHV.js";import{i as ae,j as le,r as it,s as st,t as ot,u as nt}from"./home-3d-chunk-E2LI55HK.js";import{a as Et,b as Jt,c as G,d as N,e as Y,f as a,i as u,k as J}from"./home-3d-chunk-FEXDU3FT.js";import{a as b,b as w}from"./home-3d-chunk-WSBQCKVC.js";Array.prototype.at||Object.defineProperty(Array.prototype,"at",{configurable:!0,writable:!0,value:function(t){let e=Math.trunc(t)||0;return this[e<0?this.length+e:e]}});typeof globalThis.structuredClone!="function"&&(globalThis.structuredClone=o=>o===void 0?o:JSON.parse(JSON.stringify(o)));var Ae=new URL(import.meta.url),Me=Ae.searchParams.get("v"),Le=o=>new URL(`./fonts/${o}${Me?`?v=${Me}`:""}`,Ae).href,Pe="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";function Oe(){if(typeof document>"u"||document.getElementById("fp3d-fonts"))return;let o=document.createElement("style");o.id="fp3d-fonts",o.textContent=`
@font-face{font-family:"Figtree";font-style:normal;font-display:swap;font-weight:300 900;src:url(${Le("figtree.woff2")}) format("woff2");unicode-range:${Pe}}
@font-face{font-family:"Bricolage Grotesque";font-style:normal;font-display:swap;font-weight:200 800;src:url(${Le("bricolage-grotesque.woff2")}) format("woff2");unicode-range:${Pe}}`,document.head.append(o)}function gt(o,t){return t==="metric"||t==="imperial"?t:o?.config?.unit_system?.length==="mi"?"imperial":"metric"}function ai(o,t){return String(Number(o.toFixed(t)))}function At(o,t=2){let e=o<0?"-":"",i=Math.round(Math.abs(o)/.0254*(t>=2?10:1))/(t>=2?10:1),s=Math.floor(i/12+1e-9),r=i-s*12,n=ai(r,t>=2?1:0);return s?r<.05?`${e}${s}'`:`${e}${s}' ${n}"`:`${e}${n}"`}function Ot(o,t){let e=o.trim().toLowerCase().replace(/,/g,".").replace(/[′’]/g,"'").replace(/[″”“]/g,'"').replace(/''/g,'"');if(!e)return null;let i=/(-?\d+(?:\.\d+)?|-?\.\d+)\s*(feet|foot|ft|'|inches|inch|in|"|mm|cm|m)?/g,s=0,r=!1,n=!1,l=e;for(let d of e.matchAll(i)){let h=Number(d[1]);if(!Number.isFinite(h))return null;let c=d[2];r=!0,l=l.replace(d[0],""),c==="feet"||c==="foot"||c==="ft"||c==="'"?(s+=h*.3048,n=!0):c==="inches"||c==="inch"||c==="in"||c==='"'?s+=h*.0254:c==="mm"?s+=h/1e3:c==="cm"?s+=h/100:c==="m"?s+=h:s+=t==="imperial"?h*(n?.0254:.3048):h}return!r||/[^\s+]/.test(l)?null:s}function q(o,t){return t==="imperial"?o.replace(/\s*\((?:m|cm)\)/g,"").replace(/\((?:m|cm), /g,"(").replace(/\s(?:m|cm)$/,""):o}var Fe=Qt(class extends Xt{constructor(){super(...arguments),this.key=u}render(o,t){return this.key=o,t}update(o,[t,e]){return t!==this.key&&(Zt(o),this.key=t),e}});var B=T("home-3d-editor",()=>"0638d61403e1",()=>b),Be=()=>B().then(o=>o.loadExtensions());var De=T("home-3d-settings",()=>"07a4d5dc2a57",()=>w);function We(o){return o?o.startsWith("seasons.")?`season:${o.slice(8)}`:o==="halloween.ghost"?"season:halloween":o.startsWith("pets.")?"pets":o==="easter_eggs"?"fun":null:null}var _t=T("home-3d-locate",()=>"6737949786ef");function li(){let o=()=>k(F);typeof requestIdleCallback=="function"?requestIdleCallback(o,{timeout:3e3}):setTimeout(o,1e3)}var Ft;function vt(){return Ft??=he(import("./home-3d-view3d-XYG3WSDY.js")).then(()=>li(),o=>{throw Ft=void 0,o}),Ft}function bt(o){return customElements.get("fp3d-view3d")?o?.querySelector("fp3d-view3d")??null:null}var di=`
.fp3d-loclab{position:fixed;right:8px;bottom:8px;z-index:9999;max-width:min(360px,calc(100vw - 16px));max-height:70vh;overflow:auto;
background:#0b1120f2;color:#e6f7ff;border:1px solid #37e0ff66;border-radius:12px;padding:10px;font:13px system-ui,sans-serif;box-shadow:0 6px 30px #0008}
.fp3d-loclab h4{margin:0 0 6px;font-size:13px;display:flex;justify-content:space-between;gap:8px;cursor:pointer}
.fp3d-loclab button{font:inherit;color:#e6f7ff;background:#16233d;border:1px solid #37e0ff55;border-radius:8px;padding:7px 9px;margin:2px;cursor:pointer}
.fp3d-loclab button.on{background:#37e0ff;color:#04121c;font-weight:700}
.fp3d-loclab .rec{background:#d6336c;border-color:#d6336c}
.fp3d-loclab small{opacity:.75}
.fp3d-loclab .fl{margin:6px 0 2px;opacity:.7;font-size:11px;text-transform:uppercase}`;function Ve(o){let t=document.createElement("style");t.textContent=di;let e=document.createElement("div");e.className="fp3d-loclab",document.body.append(t,e);let i=null,s="",r=!0,n=async(h,c={})=>{let p=o().hass;if(p){try{i=await p.callWS({type:"home_3d/locate/rec",action:h,...c}),s=""}catch(v){s=v.message??String(v)}l()}},l=()=>{let h=o().building,c=i,p=c?.mark?.room??null,v=`<h4 data-a="toggle"><span>\u{1F4E1} Locating \xB7 recording (lab)</span><span>${r?"\u25BE":"\u25B8"}</span></h4>`;if(!r){e.innerHTML=v;return}let E=(c?.devices??[]).map(f=>{let _=f.t?Math.round(Date.now()/1e3-f.t):null;return`<div>\u231A ${M(f.title)}: ${_===null?"<small>not heard yet</small>":`${f.rssi} dBm \xB7 ${M(f.scanner??"")} <small>${_} s ago</small>`}</div>`}).join(""),$=(h?.floors??[]).map(f=>`<div class="fl">${M(f.name)}</div>`+f.rooms.map(_=>`<button data-room="${M(_.id)}" data-name="${M(_.name)}" class="${p===_.id?"on":""}">${M(_.name)}</button>`).join("")).join("");e.innerHTML=`${v}
      <div><button data-a="setup">\u2699 Set up locating</button></div>
      <div>${c?.running?`<button class="rec" data-a="stop">\u25A0 Stop</button> <small>${Math.floor(c.seconds/60)}:${String(c.seconds%60).padStart(2,"0")} \xB7 ${c.lines} lines</small>`:'<button data-a="start">\u25CF Start recording</button>'}</div>
      ${s?`<div style="color:#ff8fa3">${M(s)}</div>`:""}
      ${E||(c?"<div><small>No iPhone/Watch keys (Private BLE Device) in HA \u2013 everything is recorded anyway.</small></div>":"")}
      ${c?.mark?`<div style="margin-top:6px">\u23F1 for <b>${hi(Date.now()/1e3-c.mark.t)}</b> in <b>${M(c.mark.name)}</b> ${Date.now()/1e3-c.mark.t>=120?"\u2713 2 min done":""}</div>`:""}
      <div class="fl">I am now in \u2026</div>
      <button data-room="" class="${p?"":"on"}">\u{1F6B6} on the way / nowhere</button>
      ${$}`};e.addEventListener("click",h=>{let c=h.target.closest("button,h4");if(!c)return;let p=c.dataset.a;if(p==="toggle")r=!r,l();else if(p==="start")n("start",{note:"lab walk"});else if(p==="stop")n("stop");else if(p==="setup"){let{hass:v,building:E}=o();v&&E&&_t().then($=>$.openLocateSetup(v,E,()=>o().hass))}else c.dataset.room!==void 0&&n("mark",c.dataset.room?{room:c.dataset.room,name:c.dataset.name}:{room:null})}),n("status");let d=window.setInterval(()=>{n("status")},1e3);return()=>{window.clearInterval(d),e.remove(),t.remove()}}function hi(o){let t=Math.max(0,Math.round(o));return`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`}function M(o){return o.replace(/[&<>"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[t])}var pi=T("home-3d-timetravel",()=>"f408fd15aa3d"),D=class{session=null;starting=!1;host;constructor(t){this.host=t}get active(){return this.starting||!!this.session}start(t){this.active||(this.starting=!0,this.host.requestUpdate(),pi().then(e=>{this.starting&&(this.starting=!1,this.session=e.startTimeTravel({...t,onChange:()=>this.host.requestUpdate(),onExit:()=>this.stop()}),this.host.requestUpdate())},e=>{this.starting=!1,console.error("Home 3D: time travel failed to load",e),this.host.requestUpdate()}))}stop(){this.active&&(this.starting=!1,this.session?.dispose(),this.session=null,this.host.requestUpdate())}hass(t){return this.session?.hass??t}};function K(o,t,e=new Date){if(!o||o==="off")return!1;if(o==="sun")return t?.states["sun.sun"]?.state==="below_horizon";let i=/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(o.trim());if(!i)return!1;let s=Number(i[1])*60+Number(i[2]),r=Number(i[3])*60+Number(i[4]),n=e.getHours()*60+e.getMinutes();return s<=r?n>=s&&n<r:n>=s||n<r}var ci=new Set(["0","off","false","no"]);function Bt(o,t,e){let i=new URLSearchParams(o).get("tablet");return i!==null?!ci.has(i.trim().toLowerCase()):!!t&&!!e?.includes(t)}var ui=120;function Ne(o,t){let e=r=>typeof r=="number"&&Number.isFinite(r)&&r>=0,i=new URLSearchParams(o).get("idle"),s=i!==null&&i.trim()!==""?Number(i):null;return e(s)?s:e(t)?t:ui}var wt=class{timer;seconds=0;onIdle;constructor(t){this.onIdle=t}arm(t){this.seconds=t>0?t:0,this.touch()}touch(){clearTimeout(this.timer),this.timer=this.seconds>0?setTimeout(this.onIdle,this.seconds*1e3):void 0}stop(){clearTimeout(this.timer),this.timer=void 0}};var yt=class{past=[];future=[];pool=new Map;chars=0;home=void 0;doc=null;run=null;now;maxSteps;maxChars;constructor(t={}){this.now=t.now??Date.now,this.maxSteps=t.maxSteps??100,this.maxChars=t.maxChars??25e6}get size(){return this.chars}get steps(){return this.past.length}get canUndo(){return this.past.length>0}get canRedo(){return this.future.length>0}adopt(t,e){let i=e===this.home&&t===this.doc;return i||this.clear(),this.home=e,this.doc=t,i}record(t,e,i,s=null){this.adopt(t,i),this.push(t,s),this.track(e)}track(t){this.doc=t}push(t,e=null,i=500){let s=this.now(),r=e!==null&&this.run?.key===e&&s-this.run.at<=i&&this.past.length>0;this.run=e===null?null:{key:e,at:s};for(let n of this.future)this.release(n);this.future=[],!r&&(this.past.push(this.store(t)),this.trim())}undo(t){let e=this.past.pop();return e?(this.run=null,this.future.push(this.store(t)),this.release(e),this.doc=this.load(e)):null}redo(t){let e=this.future.pop();return e?(this.run=null,this.past.push(this.store(t)),this.release(e),this.trim(),this.doc=this.load(e)):null}clear(){this.past=[],this.future=[],this.pool.clear(),this.chars=0,this.run=null}trim(){for(;this.past.length>this.maxSteps||this.chars>this.maxChars&&this.past.length>1;)this.release(this.past.shift())}store(t){let e=[];for(let[i,s]of Object.entries(t))if(i==="floors"&&Array.isArray(s))e.push([i,s.map(r=>this.keep(JSON.stringify(r)))]);else{let r=JSON.stringify(s);r!==void 0&&e.push([i,this.keep(r)])}return e}load(t){let e={};for(let[i,s]of t)e[i]=Array.isArray(s)?s.map(r=>JSON.parse(r)):JSON.parse(s);return e}keep(t){let e=this.pool.get(t);return e?(e.n++,e.s):(this.pool.set(t,{s:t,n:1}),this.chars+=t.length,t)}release(t){for(let[,e]of t)for(let i of Array.isArray(e)?e:[e]){let s=this.pool.get(i);s&&--s.n===0&&(this.pool.delete(i),this.chars-=i.length)}}};var O={solar:3600,batteryCharge:1200,house:2e3},L={soc:72,room:20.5,target:21,tariff:.245,car:78},y=o=>!!o&&o!=="none"&&o.includes("."),fi=o=>o.slice(0,o.indexOf(".")),mi=[[/hob|oven|cooker|kettle/,1500],[/wallbox|charger|zappi/,1400],[/washing|washer|dishwasher/,450],[/fridge|freezer|kitchen_tall/,110],[/tv|monitor|screen/,95],[/pc|computer|desk/,120],[/boiler|heat_pump/,90],[/router|network/,15]],qe=o=>mi.find(([t])=>t.test(o))?.[1]??60,gi={device_class:"power",unit_of_measurement:"W",state_class:"measurement"},Dt={device_class:"battery",unit_of_measurement:"%"},Ke={device_class:"temperature",unit_of_measurement:"\xB0C"};function _i(o){let t=o.slice(o.indexOf(".")+1).replace(/_/g," ");return t.charAt(0).toUpperCase()+t.slice(1)}var Wt=class{out=new Map;lights=0;media=0;put(t,e,i={}){this.out.has(t)||this.out.set(t,{entity_id:t,state:String(e),attributes:{friendly_name:_i(t),...i}})}watts(t,e){this.put(t,Math.round(e),gi)}main(t,e){let i=e??"";switch(fi(t)){case"light":{let s=this.lights++%3!==2;this.put(t,s?"on":"off",{supported_color_modes:["color_temp"],...s?{brightness:200,color_mode:"color_temp",color_temp_kelvin:2700}:{}});return}case"climate":case"water_heater":this.put(t,"heat",{hvac_modes:["off","heat"],hvac_action:"heating",current_temperature:L.room,temperature:L.target,min_temp:5,max_temp:30});return;case"media_player":{let s=/tv/.test(i),r=s||this.media++===0;this.put(t,r?"playing":"idle",{device_class:s?"tv":"speaker",...r?{media_title:"Demo",volume_level:.3}:{}});return}case"switch":case"input_boolean":case"fan":this.put(t,"on");return;case"binary_sensor":this.put(t,"off",/smoke/.test(i)?{device_class:"smoke"}:/water|leak/.test(i)?{device_class:"moisture"}:{});return;case"cover":this.put(t,"open",{current_position:100});return;case"lock":this.put(t,"locked");return;case"camera":this.put(t,"idle");return;case"vacuum":this.put(t,"docked");return;case"sensor":this.sensor(t,i);return}}sensor(t,e){/power|_w$/.test(t)?this.watts(t,qe(e||t)):/temp/.test(t)||e&&ie(e)?this.put(t,L.room,Ke):/humid/.test(t)?this.put(t,50,{device_class:"humidity",unit_of_measurement:"%"}):/battery|soc|level/.test(t)||/car|leaf|vehicle/.test(e)?this.put(t,L.car,Dt):this.put(t,"ok")}energy(t,e,i){let s=z(t.type);s==="meter"?y(t.export)?(this.watts(t.export,Math.max(0,-e.grid)),y(t.power)&&this.watts(t.power,Math.max(0,e.grid))):y(t.power)&&this.watts(t.power,i.energy.grid_invert?-e.grid:e.grid):s==="inverter"||s==="solar"?y(t.power)&&this.watts(t.power,e.solar):s==="home_battery"&&(y(t.charge)?(this.watts(t.charge,-e.battery),y(t.power)&&this.watts(t.power,0)):y(t.power)&&this.watts(t.power,i.energy.battery_invert?-e.battery:e.battery))}},ze=new WeakMap;function vi(o){let t=ze.get(o);if(t)return t;let e=new Wt,i=o.energy,s=o.floors.flatMap(p=>p.furniture),n=y(i.battery)||s.some(p=>z(p.type)==="home_battery"&&(y(p.power)||y(p.charge)))?-O.batteryCharge:0,l=O.house-O.solar-n;y(i.grid)&&e.watts(i.grid,i.grid_invert?-l:l),y(i.solar)&&e.watts(i.solar,O.solar),y(i.battery)&&e.watts(i.battery,i.battery_invert?-n:n),y(i.battery_soc)&&e.put(i.battery_soc,L.soc,Dt),y(i.consumption)&&e.watts(i.consumption,O.house),y(i.tariff)&&e.put(i.tariff,L.tariff,{unit_of_measurement:"GBP/kWh"});let d=s.filter(p=>(z(p.type)==="inverter"||z(p.type)==="solar")&&y(p.power)).length;for(let p of s)e.energy(p,{grid:l,battery:n,solar:O.solar/Math.max(1,d)},o);let h=(o.settings.roof?.solar??[]).filter(p=>y(p.entity)),c=h.reduce((p,v)=>p+Ht(v),0)||1;for(let p of h)e.watts(p.entity,O.solar*Ht(p)/c);for(let p of s){y(p.entity)&&e.main(p.entity,p.type),y(p.power)&&e.watts(p.power,qe(p.type));for(let v of[p.state_entity,p.state_entity2,p.extra])y(v)&&e.main(v,p.type);y(p.heat_sensor)&&e.put(p.heat_sensor,"on",{device_class:"heat"}),y(p.soc)&&e.put(p.soc,L.soc,Dt),y(p.room_sensor)&&e.put(p.room_sensor,L.room,Ke)}for(let p of o.floors)for(let v of p.placements)y(v.entity_id)&&e.main(v.entity_id,null);return ze.set(o,e.out),e.out}var Ue=new WeakMap,Vt=new WeakMap;function bi(o,t){let e=Vt.get(o);return!!e&&o.states[t]===e.get(t)}function j(o){return!!o&&Vt.has(o)}function $t(o,t){if(!t?.settings?.demo)return o;let e=Ue.get(o);if(e?.building===t)return e.out;let i=vi(t),s=o.states;for(let[n,l]of i){let d=o.states[n];d&&d.state!=="unavailable"&&d.state!=="unknown"||(s===o.states&&(s={...o.states}),s[n]=l)}let r=o;return s!==o.states&&(r={...o,states:s},r.callService=(n,l,d)=>wi(r,d)?Promise.resolve(void 0):o.callService(n,l,d),Vt.set(r,i)),Ue.set(o,{building:t,out:r}),r}function wi(o,t){let e=t?.entity_id,i=typeof e=="string"?[e]:Array.isArray(e)?e.filter(s=>typeof s=="string"):[];return i.length>0&&i.every(s=>bi(o,s))}var yi="fp3d-announce",$i="position:fixed;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;",W=globalThis.__fp3dAnnounce??={region:null,timer:null};function xi(o){let t=o.fullscreenElement??null;for(;t?.shadowRoot?.fullscreenElement;)t=t.shadowRoot.fullscreenElement;return t??o.body}function xt(o,t=typeof document>"u"?void 0:document){if(!t||!o)return;let e=xi(t);if(!e)return;let i=W.region;i||(i=t.createElement("div"),i.id=yi,i.setAttribute("role","status"),i.setAttribute("aria-live","polite"),i.setAttribute("aria-atomic","true"),i.setAttribute("style",$i),W.region=i),i.parentNode!==e&&e.appendChild(i),i.textContent="",W.timer&&clearTimeout(W.timer),W.timer=setTimeout(()=>{W.timer=null,i.textContent=o},60)}function je(o,t){return o?o.home!==t.home?"home":o.floor!==t.floor?"floor":null:null}function Ge(o,t,e){let i=t==="theme"||t==="auto"?e(`theme_${t}`):t==="house"?e("style_house"):le(t)?.name??e(`style_${t}`),s=[e("announce_look",{look:i})];return o!==t&&o==="theme"&&s.push(e("announce_follow_ha_off")),o!==t&&o==="auto"&&s.push(e("announce_follow_sun_off")),s.join(". ")}function zt(o){let t=/^#settings(?:\/([a-z0-9_]+))?(?:\/([^/?#]+))?\/?$/.exec(o);return t?{section:t[1]??null,id:t[2]?decodeURIComponent(t[2]):null}:null}function Nt(o){return o===""||o==="#"?"":o==="#editor"||o==="#extensions"||zt(o)?o:null}function Ye(o){return o==="#editor"?"editor":o==="#extensions"?"extensions":o.startsWith("#settings")?"settings":"view"}var ki=(o,t,e)=>({start:o>1,end:o+e<t-1}),Ei=800,Si=(o,t)=>t-o<Ei,Ii=["pointerdown","keydown","wheel"],g={get(o){try{return localStorage.getItem(`home3d.${o}`)}catch{return null}},set(o,t){try{localStorage.setItem(`home3d.${o}`,t)}catch{}}},Ut=class extends J{static properties={hass:{attribute:!1},narrow:{type:Boolean},route:{attribute:!1},panel:{attribute:!1},_mode:{state:!0},_viewOpen:{state:!0},_stylesOpen:{state:!0},_extFocus:{state:!0},_editorReady:{state:!0},_editorError:{state:!0},_floorId:{state:!0},_roomId:{state:!0},_shutRoom:{state:!0},_wallMode:{state:!0},_explode:{state:!0},_plan2d:{state:!0},_keepRoof:{state:!0},_quality:{state:!0},_stats:{state:!0},_markers:{state:!0},_pinSize:{state:!0},_heat:{state:!0},_theme:{state:!0},_clock:{state:!0},_clockLook:{state:!0},_furnish:{state:!0},_selFurniture:{state:!0},_selDevice:{state:!0},_floorStack:{state:!0},_roomNames:{state:!0},_hidden:{state:!0},_furnitureOn:{state:!0},_pulse:{state:!0},_controlsRight:{state:!0},_keepView:{state:!0},_floorPics:{state:!0},_angleLock:{state:!0},_windowSpill:{state:!0},_sunHeight:{state:!0},_clockWeather:{state:!0},_navButtons:{state:!0},_trail:{state:!0},_cameraWall:{state:!0},_clean:{state:!0},_roomsOpen:{state:!0},_findOpen:{state:!0},_noticesHidden:{state:!0},_accent:{state:!0},_weather:{state:!0},_flows:{state:!0},_holos:{state:!0},_doorPins:{state:!0},_vacuumMaps:{state:!0},_director:{state:!0},_micProbe:{state:!0},_voiceHere:{state:!0},_screen:{state:!0},_tablet:{state:!0},_settingsReady:{state:!0},_settingsError:{state:!0},_settingsAt:{state:!0}};rawHass;hassWatch=new rt({entityLists:!1});shownHass;get hass(){let t=this.rawHass;return t&&this.hassWatch.recording?this.hassWatch.wrap(t):t}set hass(t){this.rawHass=t}settingsFrom="view";lastView=null;data=new tt(this);undoHistory=new yt;locateLab=null;tt=new D(this);ttLinked=!1;idle=new wt(()=>this.returnHome());onTouch=()=>this.idle.touch();idleSeconds=0;touchesHeard=!1;constructor(){super(),this.narrow=!1,this._mode="view",this._viewOpen=!1,this._stylesOpen=!1,this._extFocus=null,this._editorReady=!!customElements.get("fp3d-editor"),this._editorError=null,this._floorId=null,this._roomId=null,this._shutRoom=null,this.readPrefs(),this._furnish=!1,this._selFurniture=null,this._selDevice=null,this._cameraWall=!1,this._micProbe=!1,this._tablet=!1,this._roomsOpen=!1,this._findOpen=!1,this._noticesHidden="",this._settingsReady=!!customElements.get("fp3d-settings-page"),this._settingsError=null;let t=zt(location.hash);this._settingsAt=t??{section:null,id:null},this._mode=Ye(Nt(location.hash)??"")}readPrefs(){this._wallMode=g.get("walls")==="cut"?"cut":"auto",this._explode=g.get("explode")!=="0";let t=new URLSearchParams(location.search).get("view");this._plan2d=t==="2d"||t!=="3d"&&g.get("plan2d")==="1",this._keepRoof=g.get("roof")==="1";let e=g.get("quality");this._quality=e==="low"||e==="high"?e:"auto",this._stats=g.get("stats")==="1"||new URLSearchParams(location.search).has("fp3d_stats");let i=g.get("markers");this._markers=i==="none"||i==="all"||i==="room"?i:"important";let s=g.get("pinSize");this._pinSize=s==="small"||s==="large"?s:"normal";let r=g.get("heat");this._heat=r==="temperature"||r==="humidity"||r==="co2"||r==="values"?r:"none",this._theme=R(g.get("theme"));let n=g.get("clock");this._clockLook=$e(p=>g.get(p)),this._clock=n==="tl"||n==="tr"||n==="bl"||n==="br"?n:"off";let l=g.get("accent");this._accent=l&&/^#[0-9a-f]{6}$/i.test(l)?l:null;let d=g.get("floor_stack");this._floorStack=d==="stacked"||d==="single"?d:"dim";let h=ve(g.get(ge),g.get("room_names"),g.get(_e));(!this._hidden||St(h)!==St(this._hidden))&&(this._hidden=h),this._roomNames=!this._hidden.has("room_names"),this._furnitureOn=!0,this._pulse=g.get("pulse")!=="0",this._controlsRight=g.get("controls")==="right",this._keepView=g.get("keep_view")==="1",this._floorPics=g.get("floor_pictures")==="1",this._angleLock=g.get("angle_lock")==="1",this._windowSpill=g.get("window_spill")==="1",this._clockWeather=g.get("clock_weather")!=="0";let c=g.get("sun_height");this._sunHeight=c==="high"||c==="real"?c:"auto",this._navButtons=g.get("nav")==="1",this._trail=g.get("trail")==="1",this._clean=g.get("clean")==="1",this._weather=g.get("weather")!=="0",this._flows=g.get("flows")==="1",this._holos=g.get("holos")!=="0",this._doorPins=g.get("door_pins")==="1",this._vacuumMaps=g.get("vacuum_maps")!=="0",this._director=Pt(),this._voiceHere=Ct(),this._screen=Rt(),pe(g.get("language")),be(g.get("time_format")),this.hass&&!A(this.hass.language)&&U(this.hass.language,this.hass).then(()=>this.requestUpdate())}t(t,e){return S(this.hass,t,e)}shouldUpdate(t){let e=t.get("hass"),i=this.rawHass;if(t.size!==1||!t.has("hass")||!e||!i||this.tt.active||this.hassWatch.matters(e,i))return!0;this.takeHass(i);let s=this.shownHass,r=s&&this.viewHass(i,this.data.building);return s&&r&&j(s)!==j(r)?!0:(lt(this.renderRoot,at["panel.ts"],[[e,i],[s,r]]),this.shownHass=r,!1)}update(t){this.hassWatch.begin();try{super.update(t)}finally{this.hassWatch.end()}}takeHass(t){this.homeRestored||this.restoreHome(),this.data.setHass(t),this.tt.session?.setLive(t)}viewHass(t,e){return $t(this.tt.hass(t),e)}willUpdate(t){t.has("_roomId")&&this._shutRoom!==this._roomId&&(this._shutRoom=null),t.has("hass")&&this.rawHass&&this.takeHass(this.rawHass),t.has("hass")&&this.hass&&!A(this.hass.language)&&U(this.hass.language,this.hass).then(()=>this.requestUpdate());let e=this.data.building;this.followTablet(e),e&&!this.data.canEdit&&this.data.home!==void 0&&this.openHome(void 0),e!==this.seenBuilding&&this.dropStaleSelection(e)}homeRestored=!1;get homeKey(){return`home.${this.hass?.user?.id??""}`}restoreHome(){this.homeRestored=!0;let t=g.get(this.homeKey);!t||Bt(location.search,this.hass?.user?.id,void 0)||(this.data.onHomeGone=()=>g.set(this.homeKey,""),this.data.openRemembered(t))}openHome(t){g.set(this.homeKey,t??""),this.data.setHome(t)}seenBuilding=null;seenHome=null;dropStaleSelection(t){if(this.seenBuilding=t,!t)return;let e=this.data.homeId;this.seenHome!==null&&e!==this.seenHome&&(this._floorId=null,this._roomId=null,this._selFurniture=null,this._selDevice=null),this.seenHome=e,this._floorId&&!t.floors.some(i=>i.id===this._floorId)&&(this._floorId=null,this._roomId=null),this._roomId&&!t.floors.some(i=>I(i).some(s=>s.id===this._roomId))&&(this._roomId=null),this._selFurniture&&!t.floors.some(i=>i.furniture.some(s=>s.id===this._selFurniture))&&(this._selFurniture=null)}followTablet(t){let e=location.search,i=Bt(e,this.hass?.user?.id,t?.settings.tablet_users);i&&this._mode!=="view"&&this.setMode("view","replace"),i&&this.data.home!==void 0&&this.data.setHome(void 0),i!==this._tablet&&(this._tablet=i,this._viewOpen=!1);let s=i?Ne(e,t?.settings.tablet_idle):0;(s!==this.idleSeconds||i!==this.touchesHeard)&&(this.listenTouches(i),this.idleSeconds=s,this.idle.arm(s))}listenTouches(t){if(t!==this.touchesHeard){this.touchesHeard=t;for(let e of Ii)t?window.addEventListener(e,this.onTouch,{capture:!0,passive:!0}):window.removeEventListener(e,this.onTouch,{capture:!0});t||(this.idle.stop(),this.idleSeconds=0)}}returnHome(){this.tt.stop(),this._roomId=null,this._floorId=null,this._viewOpen=!1,this._cameraWall=!1,this.view3d()?.resetView()}get canEdit(){return this.data.canEdit}async loadSample(){try{let t=await ee(this.hass);this.openHome(t.home.id)}catch(t){await ue(this.t("home_failed",{error:String(t?.message??t)}),{ok:this.t("ask_ok")})}}setMode(t,e="push"){t===this._mode||this._tablet&&t!=="view"||(this._mode==="view"&&(this.lastView=this.view3d()?.currentView()??this.lastView),this.tt.stop(),this._editorError=null,e!=="none"&&mt(this.pageNow(t),e==="push"),this._viewOpen=!1,this.setStylesOpen(!1),this._roomsOpen=!1,this._findOpen=!1,t==="view"&&this.data.flush(),t==="settings"&&(this.settingsFrom=this._mode),t!=="extensions"&&(this._extFocus=null),this._mode=t)}settingsLink(t,e){return`#settings${t?`/${t}${e?`/${encodeURIComponent(e)}`:""}`:""}`}pageNow(t=this._mode){return t==="view"?"":t==="settings"?this.settingsLink(this._settingsAt.section,this._settingsAt.id):`#${t}`}showPage=t=>{let e=Ye(t);e==="settings"&&(this._settingsAt=zt(t)??{section:null,id:null},!this._settingsAt.section&&!this._settingsAt.id&&this.settingsKey++),this.setMode(e,"none")};navRelease=null;settingsKey=0;openSettings(t=null,e=null){this._tablet||(this._settingsAt={section:t,id:e},this._mode==="settings"?mt(this.pageNow()):this.setMode("settings"))}onOpenSettings=t=>{let e=t.detail??{};t.stopPropagation(),t.preventDefault(),this.openSettings(e.section??null,e.id??null)};onOpenExtensions=t=>{t.stopPropagation(),t.preventDefault(),this.canEdit&&this.setMode("extensions")};onHash=()=>Ce();settingsAction(t){let{action:e}=t.detail;if(e==="extensions")this._extFocus=t.detail.focus??We(t.detail.id),this.setMode("extensions");else if(e==="editor")this.setMode("editor");else if(e==="kerb")this.openBinKerb();else if(e==="mic_probe")Tt().then(()=>this._micProbe=!0).catch(()=>{});else if(e==="locate"&&this.hass&&this.data.building){let i=this.data.building;_t().then(s=>s.openLocateSetup(this.hass,i,()=>this.hass,r=>{let n=this.data.building;n&&this.editPlan({...n,settings:{...n.settings,person_look:r==="figure"?null:r}})}))}}openBinKerb(){let t=this.data.building?.floors.flatMap(e=>e.furniture).find(e=>e.type==="waste_bin");this.setMode("editor"),t&&B().then(async()=>{this._editorReady=!0,await this.updateComplete;let e=this.renderRoot.querySelector("fp3d-editor");await e?.updateComplete,e?.goToFurniture(t.id)},()=>{})}onPlanChange(t){t.preventDefault(),this.updatePlan(t.detail.change)}updatePlan(t){let e=this.data.building;if(!e)return;let i=structuredClone(e);t(i),this.undoHistory.record(e,i,this.data.homeId),this.data.update(t),this.data.building&&this.undoHistory.track(this.data.building)}onRoomTap(t){let{floorId:e,roomId:i}=t.detail;if((this.data.building?.floors.length??0)>1&&e&&this._floorId!==e){this._floorId=e,this._roomId=null;return}if(i){if(i===this._roomId&&this._shutRoom===i){this._shutRoom=null;return}this._roomId=i===this._roomId?null:i}}get roomPanelShown(){return!!this._roomId&&this._shutRoom!==this._roomId}setPlan2d(t){this._plan2d=t,g.set("plan2d",t?"1":"0")}onViewChange(t){let e=this._theme;this.readPrefs(),t.detail?.id==="theme"&&e!==this._theme&&xt(Ge(e,this._theme,(i,s)=>this.t(i,s)))}setViewOpen(t,e=!1){this._viewOpen=t,!t&&e&&this.updateComplete.then(()=>this.renderRoot?.querySelector(".fp3d-view-btn")?.focus())}setStylesOpen(t){t!==this._stylesOpen&&(this._stylesOpen=t,t||this.renderRoot?.querySelector("fp3d-view3d")?.previewStyle?.(null))}hasCameras(t){return t.floors.some(e=>e.placements.some(i=>X(i.entity_id)==="camera"))}viewContext(t){return{floors:t.floors.length,floorOpen:!!this._floorId,roof:t.settings.roof.type!=="none",plan2d:this._plan2d,kiosk:this._tablet,vacuums:!!t.settings.vacuum_maps?.length}}editPlan(t,e=null){let i=this.data.building;i&&this.undoHistory.record(i,t,this.data.homeId,e),this.data.edit(t)}editFurniture(t,e,i=null){let s=this.data.building;if(!s)return;let r=structuredClone(s);for(let n of r.floors){let l=n.furniture.find(d=>d.id===t);l&&e(l,n)}this.editPlan(r,i)}editDevice(t,e,i=null){let s=this.data.building;if(!s)return;let r=structuredClone(s);for(let n of r.floors){let l=n.placements.find(d=>d.entity_id===t);l&&e(l,n)}this.editPlan(r,i)}moveDevice(t){let{id:e,x:i,z:s}=t.detail;this.editDevice(e,(r,n)=>{let[l,d]=Lt(n,r.x,r.z,i,s);Object.assign(r,{x:l,z:d})},`move:${e}`)}turnStep(){return X(this._selDevice??"")==="camera"?15:45}turnDevice(t){this._selDevice&&this.editDevice(this._selDevice,e=>e.rotation=(((e.rotation??0)+t)%360+360)%360)}deleteDevice(){let t=this._selDevice,e=this.data.building;if(!t||!e)return;let i=structuredClone(e);for(let s of i.floors)s.placements=s.placements.filter(r=>r.entity_id!==t);this.editPlan(i),this._selDevice=null}renderDeviceFields(t){let i=this.data.building?.floors.find(f=>f.placements.some(_=>_.entity_id===t)),s=i?.placements.find(f=>f.entity_id===t);if(!i||!s)return u;let r=X(t),n=r==="light",l=r==="camera",d=s.mount==="ceiling",h=r?re(r,i.height,n||l?s.mount??(l?"wall":"ceiling"):null):1,c=gt(this.hass,this.data.building?.settings.units),p=c==="imperial",v=f=>p?At(f):String(Math.round(f*100)/100),E=f=>p?Ot(f,"imperial"):parseFloat(f.replace(",",".")),$=(f,_,H,x,m,P,V=!1)=>a`<label class="fp3d-size" title=${V?q(f,c):f}
        >${V?q(f,c):f}
        <input
          type=${V&&p?"text":"number"}
          inputmode="decimal"
          step=${H}
          min=${x}
          max=${m}
          .value=${V?v(_):String(Math.round(_*100)/100)}
          @change=${Yt=>{let kt=V?E(Yt.target.value):parseFloat(Yt.target.value.replace(",","."));kt!==null&&Number.isFinite(kt)&&P(Math.min(m,Math.max(x,kt)))}}
        />
      </label>`;return a`${n?a`<select class="fp3d-size-select" title=${this.t("lamp_mount")} @change=${f=>this.editDevice(t,_=>Object.assign(_,{mount:f.target.value,y:null}))}>
            ${["ceiling","floor","table","wall"].map(f=>a`<option value=${f} ?selected=${f===(s.mount??"ceiling")}>${this.t(`lamp_${f}`)}</option>`)}
          </select>`:u}
      ${l?a`<select class="fp3d-size-select" title=${this.t("camera_mount")} @change=${f=>this.editDevice(t,_=>Object.assign(_,{mount:f.target.value,y:null}))}>
              <option value="wall" ?selected=${!d}>${this.t("camera_mount_wall")}</option>
              <option value="ceiling" ?selected=${d}>${this.t("camera_mount_ceiling")}</option>
            </select>
            ${$(this.t("camera_fov_short"),s.fov??(d?360:90),5,10,360,f=>this.editDevice(t,_=>_.fov=f))}
            ${$(this.t("camera_reach_short"),s.reach??(d?3:4.5),.5,.5,50,f=>this.editDevice(t,_=>_.reach=f),!0)}
            ${$(this.t("camera_tilt_short"),s.tilt??(d?65:20),5,0,90,f=>this.editDevice(t,_=>_.tilt=f))}`:u}
      <label class="fp3d-size" title=${q(this.t("marker_height"),c)}
        >${this.t("size_short_h")}
        <input
          type=${p?"text":"number"}
          inputmode="decimal"
          step="0.05"
          min="0"
          .value=${v(s.y??h)}
          @change=${f=>{let _=E(f.target.value);_!==null&&Number.isFinite(_)&&_>=0&&this.editDevice(t,H=>H.y=Math.round(_*1e3)/1e3)}}
        />
      </label>
      ${s.y!==null?a`<button class="fp3d-chip" @click=${()=>this.editDevice(t,f=>f.y=null)}>${this.t("height_auto")}</button>`:u}`}furnitureName(t){let e=this.data.building?.floors.flatMap(i=>i.furniture).find(i=>i.id===t);return e?Se(this.hass,e.type):""}moveFurniture(t){let{id:e,x:i,z:s}=t.detail,r=this.data.building?.settings.wall_interior??.12;this.editFurniture(e,(n,l)=>{let[d,h]=Lt(l,n.x,n.z,i,s);Object.assign(n,{x:d,z:h});let c=He(l,n,r);c&&Object.assign(n,c)},`move:${e}`)}renderSizeFields(t){let e=this.data.building?.floors.flatMap(d=>d.furniture).find(d=>d.id===t);if(!e)return u;let i=gt(this.hass,this.data.building?.settings.units)==="imperial",s=d=>i?At(d):String(Math.round(d*100)/100),r=d=>i?Ot(d,"imperial"):parseFloat(d.replace(",",".")),n=(d,h)=>a`<label class="fp3d-size" title=${this.t(`size_${d}`)}
      >${h}
      <input
        type=${i?"text":"number"}
        inputmode="decimal"
        step="0.05"
        min="0.05"
        .value=${s(e[d])}
        @change=${c=>{let p=r(c.target.value)??NaN;Number.isFinite(p)&&p>0&&this.editFurniture(t,v=>v[d]=Math.round(p*1e3)/1e3)}}
    /></label>`,l=this.data.building?.floors.find(d=>d.furniture.some(h=>h.id===t));return a`${n("w",this.t("size_short_w"))}${n("d",this.t("size_short_d"))}${n("h",this.t("size_short_h"))}
    ${l&&oe(e)?a`<label class="fp3d-size" title=${q(this.t("mount_height"),gt(this.hass,this.data.building?.settings.units))}
            >↕
            <input
              type=${i?"text":"number"}
              inputmode="decimal"
              step="0.05"
              min="0"
              .value=${s(e.mount_y??se(l,e))}
              @change=${d=>{let h=r(d.target.value)??NaN;Number.isFinite(h)&&h>=0&&this.editFurniture(t,c=>c.mount_y=Math.round(h*1e3)/1e3)}}
          /></label>
          ${e.mount_y!=null?a`<button class="fp3d-chip" @click=${()=>this.editFurniture(t,d=>d.mount_y=null)}>${this.t("height_auto")}</button>`:u}`:u}`}turnFurniture(t){this._selFurniture&&this.editFurniture(this._selFurniture,e=>e.rotation=((e.rotation+t)%360+360)%360)}deleteFurniture(){let t=this._selFurniture,e=this.data.building;if(!t||!e)return;let i=structuredClone(e);for(let s of i.floors)s.furniture=s.furniture.filter(r=>r.id!==t);this.editPlan(i),this._selFurniture=null}view3d(){return bt(this.renderRoot)}toggleTimeTravel(t=null){if(this.tt.active){this.tt.stop();return}let e=this.view3d(),i=this.data.building;!e||!i||!this.hass||(this._furnish=!1,this._cameraWall=!1,this.tt.start({live:this.hass,building:i,spec:e.historyEntities(),quality:this._quality,at:t,t:(s,r)=>S(this.hass,s,r)}))}announcedView=null;announceView(){let t=this.data.building;if(!t)return;let e={home:this.data.homeId,floor:this._floorId},i=je(this.announcedView,e);this.announcedView=e,i==="home"?xt(this.t("announce_home",{name:this.data.homeName??"Home 3D"})):i==="floor"&&xt(e.floor?this.t("announce_floor",{name:t.floors.find(s=>s.id===e.floor)?.name??""}):this.t("all_floors"))}backLayers=new Re("panel");syncBack(t){let e=[],i=(n,...l)=>t.has(n)&&e.push(l);i("_viewOpen","view",this._viewOpen&&this._mode==="view",()=>this.setViewOpen(!1,!0),()=>this.setViewOpen(!0)),i("_roomsOpen","rooms",this._roomsOpen,()=>this._roomsOpen=!1,()=>this._roomsOpen=!0),i("_findOpen","find",this._findOpen,()=>this._findOpen=!1,()=>this._findOpen=!0),i("_cameraWall","cameras",this._cameraWall&&this._mode==="view",()=>this._cameraWall=!1,()=>this._cameraWall=!0),i("_micProbe","mic",this._micProbe,()=>(this._micProbe=!1,Mt()));let s=this._floorId,r=this._roomId;i("_floorId","floor",!!s&&(this.data.building?.floors.length??0)>1,()=>(this._roomId=null,this._floorId=null),s?()=>this._floorId=s:void 0),i("_roomId","room",!!r,()=>this._roomId=null,r?()=>this._roomId=r:void 0),this.backLayers.syncAll(e)}updated(t){this.announceView(),this.syncBack(t),(t.has("_floorId")||t.has("_roomId"))&&(this.navScroll=!0),this.navFrame||(this.navFrame=requestAnimationFrame(()=>{if(this.navFrame=0,this.navScroll){this.navScroll=!1;let r=this.renderRoot.querySelector(".fp3d-floors [aria-pressed='true']"),n=r?.parentElement;r&&n&&n.scrollWidth>n.clientWidth&&r.scrollIntoView?.({block:"nearest",inline:"nearest"})}this.markNavEdges()}));let e=et(this.hass);this.getAttribute("lang")!==e&&this.setAttribute("lang",e);let i=dt(this._theme,this.hass,this.data.building?.settings);if(this.toggleAttribute("light",it(i)),this.toggleAttribute("contrast",st(i)),!this.locateLab&&this.hass?.user?.is_admin&&this.data.building&&fe()&&(this.locateLab=Ve(()=>({hass:this.hass,building:this.data.building}))),this.ttLinked||!this.data.building||this._mode!=="view"||!this.view3d())return;this.ttLinked=!0;let s=new URLSearchParams(location.search).get("tt");s!==null&&this.toggleTimeTravel(s)}back(){this.view3d()?.endWalk()||(this._roomId?this._roomId=null:this._floorId&&(this.data.building?.floors.length??0)>1?this._floorId=null:this.view3d()?.resetView())}onKey=t=>{t.key!=="Escape"||this._mode!=="view"||(this._stylesOpen?this.setStylesOpen(!1):this._viewOpen?this.setViewOpen(!1,!0):this.tt.active?this.tt.stop():this.back())};connectedCallback(){super.connectedCallback(),this._plan2d||ft(),typeof requestIdleCallback=="function"&&requestIdleCallback(()=>[0,1,2].forEach(e=>ce(this.hass,.5,e)),{timeout:2e3}),vt().then(()=>this.requestUpdate(),e=>console.error("Home 3D: the 3D view failed to load",e)),window.addEventListener("keydown",this.onKey);let t=Nt(location.hash);t&&this.showPage(t),this.navRelease=Te(this.pageNow(),Nt,this.showPage),window.addEventListener("hashchange",this.onHash),window.addEventListener("location-changed",this.onHash),this.addEventListener("open-settings",this.onOpenSettings),this.addEventListener("open-extensions",this.onOpenExtensions)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey),window.removeEventListener("hashchange",this.onHash),window.removeEventListener("location-changed",this.onHash),this.removeEventListener("open-settings",this.onOpenSettings),this.removeEventListener("open-extensions",this.onOpenExtensions),this.listenTouches(!1),this.backLayers.closeAll(),this.navRelease?.(),this.navRelease=null,this.tt.stop(),this.locateLab?.(),this.locateLab=null}render(){if(this.hass&&!A(this.hass.language))return u;let t=this.data.building;this.canEdit&&this.hass&&k(xe);let e=this.noticeList(this._clean&&this._mode==="view");return this.noticeKey=e.map(i=>i.key).join("|"),a`
      <div class="fp3d-app ${this._clean&&this._mode==="view"?"fp3d-clean":""}" style=${this.accentStyle()}>
        ${this._micProbe&&this.hass?a`<fp3d-mic-probe .hass=${this.rawHass} .building=${t} @close=${()=>(this._micProbe=!1,Mt())}></fp3d-mic-probe>`:u}
        ${this._clean&&this._mode==="view"?u:this._tablet?this.renderTabletHeader():this.renderHeader(e.length)}
        ${this.renderNotices(e)}
        ${this.data.error&&!t?a`<p class="fp3d-message">${this.t("load_error")}: ${this.data.error}</p>`:u}
        ${!t&&!this.data.error?a`<p class="fp3d-message">${this.t("loading")}</p>`:u}
        ${t?this._mode==="editor"&&this.canEdit?this.renderEditor(t):this._mode==="extensions"&&this.canEdit?this.renderExtensions():this._mode==="settings"&&!this._tablet?this.renderSettings(t):this.renderView(t):u}
      </div>
    `}renderTabletHeader(){return a`<header class="fp3d-header fp3d-tablet-head"><h1>${this.data.homeName||"Home 3D"}</h1></header>`}shownAccent(){return ht(this._theme,this._accent,this.hass,t=>getComputedStyle(this).getPropertyValue(t))}accentStyle(){return pt(this.shownAccent())}renderHeader(t){let e=(i,s,r,n,l,d)=>a`<button class="fp3d-tab ${s}" aria-current=${this._mode===i?"page":u} aria-label=${n} title=${l===null?n:u} @click=${d}>
        ${C(r)}<span class="fp3d-tab-word">${n}</span>${l?a`<span class="fp3d-tab-short" aria-hidden="true">${l}</span>`:u}
      </button>`;return a`<header class="fp3d-header">
      <ha-menu-button .hass=${this.rawHass} .narrow=${this.narrow}></ha-menu-button>
      <h1>Home 3D</h1>
      ${this.canEdit&&this.hass?a`<fp3d-home-switcher
            .hass=${this.rawHass}
            .home=${this.data.homeId}
            @home-settings=${()=>this.openSettings("homes","homes")}
            @home-open=${i=>this.openHome(i.detail.home??void 0)}
          ></fp3d-home-switcher>`:u}
      <nav class="fp3d-tabs" aria-label=${this.t("modes")}>
        ${e("view","fp3d-tab-view","cube",this.t("view"),"",()=>this.setMode("view"))}
        ${this.canEdit?a`${e("editor","fp3d-tab-editor","pencil",this.t("editor"),this.t("editor_short"),()=>this.setMode("editor"))}
            ${e("extensions","fp3d-tab-ext","puzzle",this.t("ext_tab"),null,()=>this.setMode("extensions"))}`:u}
        ${e("settings","fp3d-tab-settings","gear",this.t("settings"),null,()=>this.openSettings())}
      </nav>
      <span class="fp3d-grow"></span>
      ${this.renderSaveLine(t)}
    </header>`}renderSaveLine(t){let e=this.data.saveState,i=e==="idle"||this._mode==="settings"?"":this.t(e==="saving"?"saving":e==="saved"?"st_saved_home":"save_error"),s=t>0&&this._noticesHidden!==this.noticeKey;return a`<span class="fp3d-save fp3d-save-${i?e:"idle"}" role="status" aria-live="polite">
        ${i?a`<span class="fp3d-save-dot" aria-hidden="true"></span><span class="fp3d-save-text">${i}</span>`:u}
      </span>
      ${t?a`<button
            class="fp3d-note-badge"
            aria-expanded=${s?"true":"false"}
            aria-label=${this.t("notices_badge",{n:t})}
            title=${this.t("notices_badge",{n:t})}
            @click=${()=>this._noticesHidden=s?this.noticeKey:""}
          >
            <span>${t}</span>
          </button>`:u}`}noticeKey="";noticeList(t){let e=this.data,i=[],s=this.renderUpdateNotice();if(s&&i.push({key:`update:${e.updateNotice}`,body:s}),t)return i;e.needsRestart&&e.versionGap!=="frontend"&&i.push({key:"restart",body:a`<div class="fp3d-notice fp3d-notice-warn"><span>${e.backendVersion?this.t("needs_restart",{version:e.backendVersion,frontend:e.frontendVersion}):this.t("needs_restart_old")}</span></div>`});let r=e.planProblem;if(r&&!this._tablet){let n=r.code==="plan_repaired"?this.t("plan_repaired",{parts:(r.dropped??[]).length}):r.code==="plan_too_new"?this.t("plan_too_new"):this.t("plan_invalid",{error:r.message});i.push({key:`plan:${r.code}`,body:a`<div class="fp3d-notice fp3d-notice-${r.code==="plan_repaired"?"warn":"error"}" role="status"><span>${n}</span></div>`})}if(e.saveState==="error"&&e.saveError&&i.push({key:"save",body:a`<div class="fp3d-notice fp3d-notice-error"><span>${this.t("save_failed_detail",{error:e.saveError})}</span></div>`}),e.draft&&this.canEdit&&!this._tablet){let n=ye(e.draft.savedAt,we(this.hass)),l=e.draftNewer,d=e.draft.home?l?"draft_found_newer":"draft_found":"draft_found_old";i.push({key:`draft:${e.draft.savedAt}`,body:a`<div class="fp3d-notice">
          <span>${e.conflict?this.t("save_conflict"):this.t(d,{time:n})}</span>
          <button class="fp3d-btn fp3d-primary" @click=${()=>{e.restoreDraft()}}>${this.t(e.conflict?"draft_restore_conflict":l?"draft_restore_newer":"draft_restore")}</button>
          <button class="fp3d-btn" @click=${()=>e.discardDraft()}>${this.t("draft_discard")}</button>
        </div>`})}return i}noticeShownAt=0;noticeShownKey="";renderNotices(t){return!t.length||this._noticesHidden===this.noticeKey?(this.noticeShownKey="",u):(this.noticeShownKey!==this.noticeKey&&(this.noticeShownKey=this.noticeKey,this.noticeShownAt=performance.now()),a`<div class="fp3d-notices" role="region" aria-label=${this.t("notices")} @click=${{handleEvent:e=>this.guardNoticeTap(e),capture:!0}}>
      <div class="fp3d-notices-list">${t.map(e=>e.body)}</div>
      <button class="fp3d-btn fp3d-notices-hide" @click=${()=>this._noticesHidden=this.noticeKey}>${this.t("notices_hide")}</button>
    </div>`)}guardNoticeTap(t){Si(this.noticeShownAt,performance.now())&&(t.stopPropagation(),t.preventDefault())}renderUpdateNotice(){let t=this.data,e=t.updateNotice;if(!e)return null;let i=t.backendVersion!==t.frontendVersion?this.t("needs_reload",{frontend:t.frontendVersion,backend:t.backendVersion??"?"}):this.t("update_ready");return a`<div class="fp3d-notice fp3d-notice-warn fp3d-notice-update" role="status">
      <span>${i}${e==="ready"?u:a` ${this.t(e==="saving"?"update_saving":"update_unsaved")}`}</span>
      <button class="fp3d-btn" ?disabled=${e==="unsaved"} @click=${()=>{t.reloadWhenSaved()}}>${this.t("reload_page")}</button>
    </div>`}editorPending(){return this._editorReady?null:this._editorError?a`<div class="fp3d-empty"><p>${this.t("load_error")}: ${this._editorError}</p></div>`:(B().then(()=>this._editorReady=!0,t=>this._editorError=String(t)),a`<div class="fp3d-empty"><p>${this.t("loading")}</p></div>`)}renderExtensions(){this.data.loadLibrary();let t=this.editorPending();return t||(customElements.get("fp3d-extensions")?a`<fp3d-extensions
      class="fp3d-body"
      .hass=${this.rawHass}
      .canEdit=${this.data.canEdit}
      .packs=${this.data.packs}
      .building=${this.data.building}
      .card=${this._extFocus}
      @building-edit=${e=>this.editPlan(e.detail)}
      @packs-changed=${()=>{this.data.reloadPacks()}}
    ></fp3d-extensions>`:(Be().then(()=>this.requestUpdate(),e=>console.error("Home 3D: the Extensions page failed to load",e)),a`<div class="fp3d-empty"><p>${this.t("loading")}</p></div>`))}renderSettings(t){return this._settingsReady?Fe(this.settingsKey,a`<fp3d-settings-page
      class="fp3d-body"
      .hass=${this.rawHass}
      .building=${t}
      .canEdit=${this.data.canEdit}
      .packs=${this.data.packs}
      .t=${this.translator}
      .section=${this._settingsAt.section}
      .focusId=${this._settingsAt.id}
      .saveState=${this.data.saveState}
      .homeName=${this.data.homeName??""}
      .homeId=${this.data.homeId}
      .lastView=${this.lastView}
      .loadEditor=${B}
      .backTo=${this.settingsFrom==="settings"?"view":this.settingsFrom}
      .version=${this.versions()}
      @settings-back=${()=>this.setMode(this.settingsFrom==="settings"?"view":this.settingsFrom)}
      @settings-edit=${e=>this.editPlan(e.detail.building,e.detail.key)}
      @device-change=${()=>(this.readPrefs(),this.requestUpdate())}
      @settings-action=${this.settingsAction}
      @home-reload=${()=>{this.data.reopen()}}
      @home-open=${e=>this.openHome(e.detail.home??void 0)}
      @settings-nav=${e=>{this._settingsAt={section:e.detail.section,id:e.detail.id},mt(this.pageNow())}}
    ></fp3d-settings-page>`):this._settingsError?a`<div class="fp3d-empty"><p>${this.t("load_error")}: ${this._settingsError}</p></div>`:(De().then(()=>this._settingsReady=!0,e=>this._settingsError=String(e)),a`<div class="fp3d-empty"><p>${this.t("loading")}</p></div>`)}versionsMemo;versions(){let t=String(this.data.frontendVersion),e=this.data.backendVersion??null;return(this.versionsMemo?.frontend!==t||this.versionsMemo.backend!==e)&&(this.versionsMemo={frontend:t,backend:e}),this.versionsMemo}translator=(t,e)=>S(this.hass,t,e);renderEditor(t){this.data.loadLibrary();let e=this.editorPending();return e||a`<fp3d-editor
      class="fp3d-body"
      .hass=${this.rawHass}
      .canEdit=${this.data.canEdit}
      .home=${this.data.homeId}
      .homeName=${this.data.homeName}
      .history=${this.undoHistory}
      .building=${t}
      .narrow=${this.narrow}
      .packs=${this.data.packs}
      @packs-changed=${()=>{this.data.reloadPacks()}}
      @director-here=${()=>this._director=Pt()}
      @voice-here=${()=>{this._voiceHere=Ct(),this._screen=Rt()}}
      @mic-probe=${()=>Tt().then(()=>this._micProbe=!0).catch(()=>{})}
      @open-extensions=${()=>this.setMode("extensions")}
      @load-sample=${()=>{this.loadSample()}}
      @building-changed=${i=>this.data.edit(i.detail.building)}
    ></fp3d-editor>`}async focusRoomPanel(){await this.updateComplete,await customElements.whenDefined("fp3d-room-panel"),await this.renderRoot.querySelector("fp3d-room-panel")?.focusHeading?.()}navFrame=0;navScroll=!1;markNavEdges=()=>{let t=this.renderRoot?.querySelector(".fp3d-floors");if(!t)return;let e=ki(t.scrollLeft,t.scrollWidth,t.clientWidth);t.toggleAttribute("data-more-start",e.start),t.toggleAttribute("data-more-end",e.end)};onNavWheel=t=>{if(!t.deltaY||t.deltaX)return;let e=t.currentTarget;e.scrollWidth<=e.clientWidth||(e.scrollLeft+=t.deltaY,t.preventDefault())};renderFloorBar(t,e){let i=t.floors.length>1,s=n=>{this._floorId=n,this._roomId=null,this._roomsOpen=!1},r=this._roomId?t.floors.flatMap(n=>I(n)).find(n=>n.id===this._roomId):void 0;return a`<nav class="fp3d-nav" aria-label=${this.t("floors")}>
      ${i?a`<div class="fp3d-seg fp3d-floors" role="group" aria-label=${this.t("floors")} @wheel=${this.onNavWheel} @scroll=${this.markNavEdges}>
            <button aria-pressed=${this._floorId===null} @click=${()=>s(null)}>${this.t("all_floors")}</button>
            ${[...t.floors].reverse().map(n=>a`<button aria-pressed=${n.id===this._floorId} @click=${()=>s(n.id)}>${n.name}</button>`)}
          </div>
          <label class="fp3d-floor-pick ${this._floorId?"fp3d-floor-on":""}">
            <select aria-label=${this.t("floors")} @change=${n=>s(n.target.value||null)}>
              <option value="" ?selected=${this._floorId===null}>${this.t("all_floors")}</option>
              ${[...t.floors].reverse().map(n=>a`<option value=${n.id} ?selected=${n.id===this._floorId}>${n.name}</option>`)}
            </select>
            ${C("down")}
          </label>`:u}
      ${this._tablet?u:a`${i?a`<span class="fp3d-sep"></span>`:u}
            <div class="fp3d-rooms">
              <button
                class="fp3d-chip fp3d-rooms-btn ${r?"fp3d-rooms-on":""}"
                aria-haspopup="dialog"
                aria-expanded=${this._roomsOpen}
                aria-label=${r?this.t("rooms_open",{room:r.name}):this.t("rooms")}
                @pointerenter=${()=>k(ut)}
                @focus=${()=>k(ut)}
                @click=${()=>this._roomsOpen=!this._roomsOpen}
              >
                ${r?.name??this.t("rooms")} ${C("down")}
              </button>
              ${this._roomsOpen?(k(ut),a`<fp3d-rooms-picker
                    .groups=${this.roomGroups(t,e)}
                    .selected=${this._roomId}
                    .t=${this.translator}
                    .editFloor=${e&&this.canEdit?e.id:null}
                    .canHide=${this.canEdit}
                    @room-hide=${n=>this.hideRoom(n.detail.roomId,n.detail.hide)}
                    @room-pick=${n=>{i&&(this._floorId=n.detail.floorId),this._roomId=n.detail.roomId,this._shutRoom=null,this._roomsOpen=!1,this.focusRoomPanel()}}
                    @edit-floor=${n=>this.openInEditor(n.detail.floorId,null)}
                    @picker-close=${n=>this.closeRooms(!!n.detail?.focus)}
                  ></fp3d-rooms-picker>`):u}
            </div>`}
      ${this.renderFindBar(t)}
    </nav>`}renderFindBar(t){let e=this._findOpen,i=()=>{this._findOpen=!1,this.updateComplete.then(()=>this.renderRoot.querySelector(".fp3d-find-toggle")?.focus())};return a`<button
        class="fp3d-chip fp3d-find-toggle ${e?"fp3d-rooms-on":""}"
        title=${this.t("find")}
        aria-label=${this.t("find")}
        aria-expanded=${e}
        @pointerenter=${()=>k(It)}
        @click=${()=>e?i():this._findOpen=!0}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
      </button>
      ${e?(k(It),a`<fp3d-find
            variant="bar"
            .hass=${this.shownHass}
            .building=${t}
            @find-close=${i}
            @find-pick=${s=>{this._findOpen=!1,this.renderRoot.querySelector("fp3d-view3d")?.goTo(s.detail)}}
          ></fp3d-find>`):u}`}hideRoom(t,e){this.updatePlan(i=>{for(let s of i.floors)for(let r of s.rooms)r.id===t&&(e?r.hide_in_picker=!0:delete r.hide_in_picker)})}roomGroupsMemo=null;roomGroups(t,e){let i=this.roomGroupsMemo;if(i&&i.b===t&&i.floor===e)return i.groups;let r=(e?[e]:[...t.floors].reverse()).map(n=>({id:n.id,name:n.name,rooms:I(n).filter((l,d,h)=>l.name.trim()&&!(l.outdoor&&h.findIndex(c=>c.outdoor&&c.area_id===l.area_id&&c.name===l.name)<d)).map(l=>({id:l.id,name:l.name,hidden:l.hide_in_picker===!0}))})).filter(n=>n.rooms.length);return this.roomGroupsMemo={b:t,floor:e,groups:r},r}closeRooms(t){this._roomsOpen=!1,t&&this.updateComplete.then(()=>this.renderRoot.querySelector(".fp3d-rooms-btn")?.focus())}openInEditor(t,e){!this.canEdit||this._tablet||(this._roomsOpen=!1,this.setMode("editor"),B().then(async()=>{this._editorReady=!0,await this.updateComplete;let i=this.renderRoot.querySelector("fp3d-editor");await i?.updateComplete,i?.goToRoom(t,e)},()=>{}))}renderView(t){if(!t.floors.length||!t.floors.some(n=>n.rooms.length))return a`<div class="fp3d-empty">
        <p>${this.t(this.canEdit?"no_building_admin":"no_building")}</p>
        ${this.canEdit?a`<button class="fp3d-btn fp3d-primary" @click=${()=>this.setMode("editor")}>${this.t("open_editor")}</button>
              <button class="fp3d-btn" @click=${()=>{this.loadSample()}}>${this.t("home_sample")}</button>
              <p class="fp3d-phone-only">${this.t("phone_hint")}</p>`:u}
      </div>`;let e=t.floors.find(n=>n.id===this._floorId),i=this.tt.active,s=this.viewHass(this.rawHass,t);this.shownHass=s;let r=a`<div class="fp3d-seg" role="group" aria-label=${this.t("plan_view")}>
      <button aria-pressed=${!this._plan2d} @click=${()=>this.setPlan2d(!1)}>${this.t("view_3d")}</button>
      <button aria-pressed=${this._plan2d} @click=${()=>this.setPlan2d(!0)}>${this.t("view_2d")}</button>
    </div>`;return a`
      ${this._clean||this._tablet&&t.floors.length<2?u:this.renderFloorBar(t,e)}
      <div class="fp3d-stage-wrap ${this.roomPanelShown?"fp3d-room-open":""} ${this._controlsRight?"fp3d-side-right":""} ${i?"fp3d-tt":""} ${this._cameraWall&&!i?"fp3d-cams-open":""}">
        <!-- the floor bar picks the floor: the floor pictures beside the 3D view are a second picker, shown when Settings
             › Screen and controls says so (#249, #250; the card keeps its own switch) -->
        <fp3d-view3d
          class="fp3d-body"
          .findInBar=${!(this._clean||this._tablet&&t.floors.length<2)}
          .canEdit=${this.data.canEdit&&!this._tablet}
          .noSettings=${this._tablet}
          .home=${this.data.homeId}
          .hass=${s}
          .replay=${this.tt.session?.replay??null}
          .building=${t}
          .packs=${this.data.packs}
          .plan2d=${this._plan2d}
          .floorThumbs=${this._floorPics}
          .floorStack=${this._floorStack}
          .roomLabels=${this._roomNames}
          .hiddenTypes=${this._hidden}
          .furnitureOn=${this._furnitureOn}
          .pulse=${this._pulse}
          .controlsRight=${this._controlsRight}
          .keepView=${this._keepView}
          .angleLock=${this._angleLock}
          .windowSpill=${this._windowSpill}
          .sunHeight=${this._sunHeight}
          .navButtons=${this._navButtons}
          ?trail=${this._trail}
          .cameraWall=${this._cameraWall&&!i}
          @camera-wall-close=${()=>this._cameraWall=!1}
          @camera-wall-open=${()=>this._cameraWall=!0}
          .clean=${this._clean}
          .cleanButton=${!0}
          @clean-toggle=${()=>{this._clean=!this._clean,g.set("clean",this._clean?"1":"0"),this._clean&&(this._roomsOpen=this._findOpen=!1)}}
          .weather=${this._weather}
          .flows=${this._flows}
          .holograms=${this._holos}
          .doorPins=${this._doorPins}
          .vacuumMaps=${this._vacuumMaps}
          .director=${this._director}
          .voice=${this._voiceHere}
          .screen=${this._screen||null}
          .panelOpen=${this.roomPanelShown}
          .floorId=${t.floors.length>1?this._floorId:t.floors[0]?.id??null}
          .roomId=${this._roomId}
          .wallMode=${this._wallMode}
          .explode=${this._explode}
          .keepRoof=${this._keepRoof}
          .markerMode=${this._markers}
          .pinSize=${this._pinSize}
          .heatMode=${this._heat}
          .theme=${this._theme}
          .clock=${this._clock}
          .clockLook=${this._clockLook}
          .clockWeather=${this._clockWeather}
          .accent=${this.shownAccent()}
          ?furnish=${this._furnish&&!i}
          .selectedFurniture=${this._selFurniture}
          @furniture-select=${n=>this._selFurniture=n.detail.id}
          @furniture-move=${this.moveFurniture}
          @device-select=${n=>this._selDevice=n.detail.id}
          @device-move=${this.moveDevice}
          .quality=${this._quality}
          ?showStats=${this._stats}
          @room-tap=${this.onRoomTap}
          @open-extensions=${()=>this.setMode("extensions")}
          @floor-tap=${n=>{this._floorId=n.detail.floorId,this._roomId=null}}
          @back=${()=>this.back()}
          @plan-change=${this.onPlanChange}
        ></fp3d-view3d>
        ${this.roomPanelShown?(k(F),a`<fp3d-room-panel
              class="fp3d-room-panel"
              @camera-look=${n=>this.view3d()?.lookThrough(n.detail.entity)}
              .hass=${s}
              ?readOnly=${i}
              ?noLook=${this._plan2d}
              ?canEdit=${this.canEdit&&!this._tablet}
              @plan-change=${this.onPlanChange}
              .room=${t.floors.flatMap(n=>I(n)).find(n=>n.id===this._roomId)??null}
              .floor=${t.floors.find(n=>I(n).some(l=>l.id===this._roomId))??null}
              .building=${t}
              .confirmEntities=${Z(this.hass,t.floors)}
              .sheets=${this._roomId?this.view3d()?.roomSheets(this._roomId)??null:null}
              @sheet-open=${n=>this._roomId&&this.view3d()?.openRoomSheet(this._roomId,n.detail.id)}
              @close=${()=>this._shutRoom=this._roomId}
            ></fp3d-room-panel>`):u}
        ${this.tt.session?a`<fp3d-time-bar .session=${this.tt.session} ?demo=${j(s)}></fp3d-time-bar>`:u}
        ${j(s)&&!this.tt.session?a`<div class="fp3d-demo-chip" title=${this.t("demo_hint")}>${this.t("demo_chip")}</div>`:u}
        ${this._clean?u:a`<div class="fp3d-overlay">
          ${this._tablet?u:r}
          ${this._tablet?u:a`<button class="fp3d-chip fp3d-plan-toggle" title=${this.t("plan_view")} aria-label=${`${this.t("plan_view")}: ${this.t(this._plan2d?"view_3d":"view_2d")}`} @click=${()=>this.setPlan2d(!this._plan2d)}>
                ${this.t(this._plan2d?"view_3d":"view_2d")}
              </button>`}
          <button
            class="fp3d-chip fp3d-view-btn"
            aria-haspopup="dialog"
            aria-expanded=${this._viewOpen}
            aria-controls="fp3d-view-panel"
            aria-label=${this.t("view_btn")}
            @pointerenter=${()=>k(ct)}
            @focus=${()=>k(ct)}
            @click=${()=>this.setViewOpen(!this._viewOpen)}
          >
            <span class="fp3d-bar-icon">${C("sliders")}</span><span class="fp3d-bar-word">${this.t("view_btn")}</span> <span class="fp3d-caret" aria-hidden="true">${this._viewOpen?"\u25B4":"\u25BE"}</span>
          </button>
          ${!i&&this.hasCameras(t)?a`<button class="fp3d-chip fp3d-cam-btn" aria-pressed=${this._cameraWall} aria-label=${this.t("cameras_short")} title=${this.t("camera_wall_hint")} @click=${()=>this._cameraWall=!this._cameraWall}>
                <span class="fp3d-bar-icon">${C("camera")}</span><span class="fp3d-bar-word">${this.t("cameras_short")}</span>
              </button>`:u}
          ${this._tablet?u:a`<button class="fp3d-chip fp3d-tt-chip" aria-pressed=${i} title=${this.t("tt_hint")} aria-label=${this.t("tt_chip")} @click=${()=>this.toggleTimeTravel()}>
            ⏪ <span class="fp3d-tt-label">${this.t("tt_chip")}</span>
          </button>`}
          ${this._roomId||this._floorId&&t.floors.length>1?a`<button class="fp3d-chip fp3d-back-btn" aria-label=${this.t("back")} @click=${()=>this.back()}><span class="fp3d-bar-icon">${C("back")}</span><span class="fp3d-bar-word">${this.t("back")}</span></button>`:u}
        </div>`}
        ${this._viewOpen&&!this._clean?(k(ct),a`<fp3d-view-panel
              id="fp3d-view-panel"
              .hass=${this.rawHass}
              .context=${this.viewContext(t)}
              @view-change=${this.onViewChange}
              @styles-open=${()=>(this.setViewOpen(!1),this._stylesOpen=!0)}
              @view-close=${n=>this.setViewOpen(!1,!n.detail?.outside)}
              >${this._tablet?r:u}</fp3d-view-panel
            >`):u}
        ${this._stylesOpen&&!this._clean&&this._mode==="view"?(k(Ee),a`<fp3d-styles-dialog
              .hass=${this.rawHass}
              .styles=${t.settings.styles_custom}
              .canEdit=${this.canEdit}
              .current=${me(this._theme,this.hass,t.settings)}
              @view-change=${this.onViewChange}
              @styles-preview=${n=>this.view3d()?.previewStyle?.(n.detail.style)}
              @styles-change=${n=>this.editPlan({...t,settings:{...t.settings,styles_custom:n.detail.styles.length?n.detail.styles:null}},"styles_custom")}
              @styles-close=${()=>this.setStylesOpen(!1)}
            ></fp3d-styles-dialog>`):u}
        ${this._furnish?a`<div class="fp3d-furnish-bar">
              ${this._selFurniture?a`<span>${this.furnitureName(this._selFurniture)}</span>
                    ${this.renderSizeFields(this._selFurniture)}
                    <button class="fp3d-chip" @click=${()=>this.turnFurniture(-45)}>↺ 45°</button>
                    <button class="fp3d-chip" @click=${()=>this.turnFurniture(45)}>↻ 45°</button>
                    <button class="fp3d-chip" title=${this.t("furn_mirror_hint")} @click=${()=>this.editFurniture(this._selFurniture,n=>n.mirror=!n.mirror)}>⇋ ${this.t("furn_mirror")}</button>
                    <button class="fp3d-chip fp3d-danger-chip" @click=${()=>this.deleteFurniture()}>${this.t("delete")}</button>`:this._selDevice?a`<span>${ne(this.hass,this._selDevice)}</span>
                      ${this.renderDeviceFields(this._selDevice)}
                      <button class="fp3d-chip" @click=${()=>this.turnDevice(-this.turnStep())}>↺ ${this.turnStep()}°</button>
                      <button class="fp3d-chip" @click=${()=>this.turnDevice(this.turnStep())}>↻ ${this.turnStep()}°</button>
                      <button class="fp3d-chip fp3d-danger-chip" @click=${()=>this.deleteDevice()}>${this.t("delete")}</button>`:a`<span>${this.t("furnish_hint")}</span>`}
              <button class="fp3d-chip fp3d-chip-on" @click=${()=>(this._furnish=!1,this._selFurniture=null,this._selDevice=null)}>${this.t("done")}</button>
            </div>`:u}
      </div>
    `}static styles=[ot,nt,Y`.fp3d-badge{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:#ffb547;color:#1a1204;font-size:0.78em;font-weight:700;line-height:1.5;box-shadow:0 0 10px rgba(255,181,71,0.7);vertical-align:middle;white-space:nowrap;animation:fp3d-badge-in 1.6s ease-out 2}@keyframes fp3d-badge-in{0%{box-shadow:0 0 0 0 rgba(255,181,71,0.9)}100%{box-shadow:0 0 0 10px rgba(255,181,71,0)}}:host{display:block;height:calc(100vh - var(--safe-area-inset-top,0px) - var(--safe-area-inset-bottom,0px));background:var(--fp3d-bg)}@supports (height:100dvh){:host{height:calc(100dvh - var(--safe-area-inset-top,0px) - var(--safe-area-inset-bottom,0px))}}.fp3d-app{position:relative;display:flex;flex-direction:column;height:100%;min-height:0}.fp3d-header{display:flex;align-items:center;gap:12px;padding:0 12px 0 4px;height:56px;box-sizing:border-box;border-bottom:1px solid var(--fp3d-line);background:var(--fp3d-chrome-solid);flex:none;min-width:0}.fp3d-tablet-head{padding-left:14px}fp3d-home-switcher{flex:0 1 auto;min-width:0}.fp3d-tabs{display:flex;align-self:stretch;gap:2px;flex:none}.fp3d-tab{font:inherit;display:inline-flex;align-items:center;gap:7px;padding:3px 12px 0;min-width:44px;justify-content:center;border:none;border-bottom:3px solid transparent;background:none;color:var(--fp3d-muted);font-weight:600;white-space:nowrap;cursor:pointer}.fp3d-tab:hover{color:var(--fp3d-text)}.fp3d-tab[aria-current="page"]{color:var(--fp3d-text);border-bottom-color:var(--fp3d-accent)}.fp3d-tab[aria-current="page"] .fp3d-ui-icon{color:var(--fp3d-accent)}.fp3d-tab:focus-visible{outline-offset:-2px}.fp3d-tab-short{display:none}.fp3d-save{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;min-width:0}.fp3d-save-dot{width:8px;height:8px;border-radius:50%;background:var(--fp3d-ok,#4ade80);flex:none}.fp3d-save-saving .fp3d-save-dot{background:var(--fp3d-muted)}.fp3d-save-error .fp3d-save-dot{background:var(--fp3d-danger)}.fp3d-note-badge{font:inherit;flex:none;display:inline-grid;place-items:center;min-width:32px;height:32px;padding:0;border:none;background:none;cursor:pointer}.fp3d-note-badge span{min-width:22px;height:22px;padding:0 6px;box-sizing:border-box;border-radius:999px;background:#ffb547;color:#1a1204;font-size:12px;font-weight:800;line-height:22px;text-align:center}ha-menu-button{color:var(--fp3d-text)}h1{font-family:var(--fp3d-title-font);font-weight:700;font-size:19px;letter-spacing:-0.01em;margin:0 4px 0 8px;white-space:nowrap}.fp3d-notices{flex:none;display:flex;align-items:flex-start;gap:8px;padding:6px 12px;border-bottom:1px solid var(--fp3d-line);background:var(--fp3d-chrome-solid)}.fp3d-notices-list{flex:1;min-width:0;display:grid;gap:6px}.fp3d-notices-hide{flex:none}.fp3d-notices .fp3d-notice{flex-wrap:nowrap;padding:0 0 0 10px;border:0;border-left:3px solid var(--fp3d-line);border-radius:0;background:none}.fp3d-notices .fp3d-notice span{min-width:0}.fp3d-notices .fp3d-notice-warn{border-left-color:rgba(255,181,71,0.8)}.fp3d-notices .fp3d-notice-error{border-left-color:rgba(255,107,139,0.8)}.fp3d-notice{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:9px 12px;border-radius:10px;border:1px solid var(--fp3d-line);background:var(--fp3d-chrome-solid);font-size:13.5px}.fp3d-notice span{flex:1;min-width:200px}.fp3d-notice-warn{border-color:rgba(255,181,71,0.6);color:var(--fp3d-warm)}.fp3d-notice-error{border-color:rgba(255,107,139,0.6);color:var(--fp3d-danger);word-break:break-word}.fp3d-chip-on{background:var(--fp3d-primary);color:var(--fp3d-primary-text)}.fp3d-furnish-bar{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;max-width:calc(100% - 24px);padding:8px 10px 8px 16px;border-radius:999px;background:var(--fp3d-chrome);box-shadow:var(--fp3d-shadow);font-size:13.5px}.fp3d-size-select{font:inherit;color:var(--fp3d-text);background:var(--fp3d-chrome-solid);border:1px solid var(--fp3d-line);border-radius:999px;padding:4px 10px}.fp3d-size{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--fp3d-muted)}.fp3d-size input{width:58px;padding:5px 6px;border:1px solid rgba(127,127,127,0.35);border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px}.fp3d-danger-chip{color:var(--fp3d-danger)}.fp3d-grow{flex:1}.fp3d-save{font-size:12.5px;color:var(--fp3d-muted)}@media (max-width:${N(String(te))}px){.fp3d-header{gap:8px;padding-right:8px}.fp3d-header h1{display:none}.fp3d-tab{padding-left:9px;padding-right:9px}.fp3d-tab .fp3d-ui-icon{display:none}.fp3d-save-text{overflow:hidden;text-overflow:ellipsis}}@media ${N(Q)}{.fp3d-header{height:52px;gap:2px;padding:0 4px 0 0}.fp3d-tab{padding-left:8px;padding-right:8px;gap:5px}.fp3d-tab .fp3d-ui-icon{display:inline}.fp3d-tab-view .fp3d-ui-icon,.fp3d-tab-editor .fp3d-ui-icon,.fp3d-tab-editor .fp3d-tab-word,.fp3d-tab-ext:not([aria-current]) .fp3d-tab-word,.fp3d-tab-settings:not([aria-current]) .fp3d-tab-word{display:none}.fp3d-tab-editor .fp3d-tab-short{display:inline}.fp3d-save-text{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.fp3d-notices{padding:6px 8px}}.fp3d-save-error{color:var(--fp3d-danger)}.fp3d-body{flex:1;min-height:0}.fp3d-nav{position:relative;display:flex;align-items:center;gap:8px;padding:6px 12px;min-height:50px;box-sizing:border-box;flex:none;min-width:0;border-bottom:1px solid var(--fp3d-line);background:var(--fp3d-chrome-solid)}.fp3d-floors{flex:0 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none;box-shadow:none}@media (hover:hover) and (pointer:fine){.fp3d-floors{scrollbar-width:thin;scrollbar-color:transparent transparent;padding-bottom:3px}.fp3d-floors:hover{scrollbar-color:color-mix(in srgb,var(--fp3d-text) 35%,transparent) transparent}}@media not all and (hover:hover) and (pointer:fine){.fp3d-floors:hover{scrollbar-width:thin}}.fp3d-floors{scroll-padding-inline:28px}.fp3d-floors[data-more-end]{mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent)}.fp3d-floors[data-more-start]{mask-image:linear-gradient(to left,#000 calc(100% - 28px),transparent)}.fp3d-floors[data-more-start][data-more-end]{mask-image:linear-gradient(to right,transparent,#000 28px,#000 calc(100% - 28px),transparent)}.fp3d-floors > button{flex:none}.fp3d-floor-pick{display:none;position:relative;flex:0 1 auto;min-width:0}.fp3d-floor-pick select{appearance:none;width:100%;max-width:14em;min-height:44px;padding:0 34px 0 14px;border:1px solid var(--fp3d-line);border-radius:999px;background:var(--fp3d-chrome);color:var(--fp3d-text);font:inherit;font-weight:500;text-overflow:ellipsis;cursor:pointer}.fp3d-floor-pick option{background:var(--fp3d-chrome-solid);color:var(--fp3d-text)}.fp3d-floor-on select{color:var(--fp3d-accent);border-color:var(--fp3d-accent)}.fp3d-floor-pick svg{position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--fp3d-muted)}.fp3d-rooms{position:relative;flex:none}.fp3d-nav .fp3d-chip{box-shadow:none;border:1px solid var(--fp3d-line)}.fp3d-rooms-btn{display:inline-flex;align-items:center;gap:6px;max-width:14em;overflow:hidden;text-overflow:ellipsis}.fp3d-rooms-on,.fp3d-rooms-btn[aria-expanded="true"]{color:var(--fp3d-accent);border-color:var(--fp3d-accent) !important}.fp3d-find-toggle{flex:none;margin-left:auto;display:inline-grid;place-items:center;min-width:36px}.fp3d-find-toggle[aria-expanded="true"]{border-color:var(--fp3d-accent) !important}.fp3d-sep{flex:none;width:1px;margin:4px 4px;background:var(--fp3d-line)}.fp3d-demo-chip{position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:3;padding:2px 10px;border-radius:999px;font-size:11px;letter-spacing:0.04em;color:var(--fp3d-s-text,#e8f4ff);background:var(--fp3d-s-chrome,rgba(10,20,35,0.72));border:1px solid var(--fp3d-s-line,rgba(120,200,255,0.35));pointer-events:auto;cursor:help}.fp3d-stage-wrap{position:relative;flex:1;min-height:0;display:flex;container-type:size;container-name:fp3d}.fp3d-stage-wrap fp3d-view3d{flex:1}.fp3d-room-panel{position:absolute;top:58px;right:14px;bottom:14px;width:min(360px,calc(100% - 28px));display:flex;flex-direction:column;justify-content:flex-start;pointer-events:none;z-index:2}fp3d-view3d{--fp3d-bottom-inset:52px}.fp3d-clean fp3d-view3d{--fp3d-bottom-inset:0px}.fp3d-clean .fp3d-nav{display:none}.fp3d-furnish-bar{bottom:68px}.fp3d-tt > *{--fp3d-tt-h:64px}.fp3d-tt fp3d-view3d{--fp3d-bottom-inset:calc(52px + var(--fp3d-tt-h))}.fp3d-tt .fp3d-overlay{bottom:calc(var(--fp3d-tt-h) + 4px)}.fp3d-tt .fp3d-room-panel{bottom:calc(var(--fp3d-tt-h) + 6px)}.fp3d-tt-chip[aria-pressed="true"]{background:#ffb020;color:#1a1200}@container fp3d ((max-width:700px) or ((orientation:portrait) and (max-width:1000px))){.fp3d-room-panel{top:auto;left:8px;right:8px;bottom:8px;width:auto;height:var(--fp3d-sheet-h,55%);justify-content:flex-end}.fp3d-room-open .fp3d-overlay,.fp3d-room-open fp3d-view-panel{display:none}.fp3d-room-open fp3d-view3d{--fp3d-bottom-inset:calc(var(--fp3d-sheet-h,55%) + 8px)}.fp3d-tt > *{--fp3d-tt-h:calc(120px + env(safe-area-inset-bottom,0px))}@media (pointer:coarse){.fp3d-tt > *{--fp3d-tt-h:calc(138px + env(safe-area-inset-bottom,0px))}}}.fp3d-side-right .fp3d-overlay{left:12px;right:100px}@container fp3d (max-width:1180px){.fp3d-room-open fp3d-view-panel{left:12px;transform:none}}.fp3d-room-open .fp3d-overlay{right:calc(min(360px,100% - 28px) + 26px)}.fp3d-overlay{position:absolute;right:12px;bottom:12px;left:100px;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;align-items:center;pointer-events:none}.fp3d-overlay > *{pointer-events:auto}.fp3d-cam-btn[aria-pressed="true"]{background:var(--fp3d-primary);color:var(--fp3d-primary-text)}.fp3d-view-btn[aria-expanded="true"]{color:var(--fp3d-accent);box-shadow:inset 0 0 0 1px var(--fp3d-accent),var(--fp3d-shadow)}.fp3d-tt fp3d-view-panel{bottom:calc(var(--fp3d-tt-h) + 64px)}.fp3d-caret{font-size:0.8em;opacity:0.7}.fp3d-bar-icon,.fp3d-plan-toggle{display:none}.fp3d-message,.fp3d-empty{padding:32px 20px;color:var(--fp3d-muted);text-align:center}.fp3d-phone-only{display:none}@media (max-width:600px){.fp3d-phone-only{display:block}}.fp3d-empty{display:grid;justify-items:center;gap:12px;margin:auto}@media ${N(Q)}{.fp3d-header{position:relative}.fp3d-tt-label{display:none}.fp3d-nav{position:relative;padding:4px 8px}.fp3d-nav .fp3d-floors{display:none}.fp3d-floor-pick{display:block}.fp3d-rooms{position:static}fp3d-rooms-picker{left:8px}.fp3d-tab,.fp3d-overlay .fp3d-chip,.fp3d-overlay .fp3d-seg button,fp3d-view-panel .fp3d-seg button,.fp3d-nav .fp3d-chip{min-height:44px}.fp3d-overlay .fp3d-tt-chip{min-width:44px;justify-content:center}.fp3d-tt fp3d-view-panel{bottom:0}.fp3d-cams-open .fp3d-overlay{display:none}.fp3d-overlay{left:108px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));flex-wrap:nowrap;justify-content:flex-start;gap:6px}.fp3d-side-right .fp3d-overlay{left:8px;right:108px;justify-content:flex-end}.fp3d-overlay > .fp3d-seg{display:none}.fp3d-overlay .fp3d-chip{flex:none;display:inline-grid;place-items:center;width:44px;min-width:44px;height:44px;padding:0;border-radius:14px}.fp3d-overlay .fp3d-bar-icon{display:contents}.fp3d-overlay :is(.fp3d-bar-word,.fp3d-caret){display:none}.fp3d-overlay .fp3d-bar-icon svg{width:22px;height:22px}fp3d-view3d{--fp3d-dock-left:8px;--fp3d-dock-bottom:calc(8px + env(safe-area-inset-bottom,0px));--fp3d-dock-menu:calc(60px + env(safe-area-inset-bottom,0px))}.fp3d-tt fp3d-view3d{--fp3d-dock-left:-42px;--fp3d-dock-bottom:calc(var(--fp3d-tt-h) + 4px);--fp3d-dock-menu:calc(var(--fp3d-tt-h) + 56px)}.fp3d-tt .fp3d-overlay{left:58px}.fp3d-side-right.fp3d-tt .fp3d-overlay{left:8px;right:58px}.fp3d-room-open fp3d-view3d{--fp3d-dock-bottom:calc(var(--fp3d-sheet-h,55%) + 18px);--fp3d-dock-menu:calc(var(--fp3d-sheet-h,55%) + 70px)}.fp3d-clean fp3d-view3d{--fp3d-dock-left:initial;--fp3d-dock-bottom:initial;--fp3d-dock-menu:initial}}@media (pointer:coarse),${N(Q)}{.fp3d-view-btn,.fp3d-rooms-btn,.fp3d-find-toggle,.fp3d-note-badge{min-width:44px}.fp3d-note-badge{height:44px}.fp3d-tab,.fp3d-floors button,.fp3d-overlay .fp3d-chip,.fp3d-overlay .fp3d-seg button,fp3d-view-panel .fp3d-seg button,.fp3d-nav .fp3d-chip{min-height:44px}}`]};G("home-3d-panel",Ut);function qt(o,t){return t??o?.view==="2d"}function Je(o){let t=o.texts.reduce((e,i)=>e+[...i].length*7.6+26,0);return Math.ceil(t+(o.texts.length>1?6+2*(o.texts.length-1):0))}function Qe(o,t){if((n=>n.reduce((l,d,h)=>l+Je(d)+(h?8:0),0))(o)<=t)return{bar:o.map(n=>n.id),menu:[]};let i=[],s=[],r=44;for(let n of o){let l=Je(n)+8;n.keep||s.length===0&&r+l<=t?(i.push(n.id),r+=l):s.push(n.id)}return{bar:i,menu:s}}var Xe=T("home-3d-card-editor",()=>"3bcc76fc9f94");function Ze(){try{let o=localStorage.getItem("home3d.card_walls");return o==="auto"||o==="cut"?o:null}catch{return null}}var Kt=class extends J{static properties={hass:{attribute:!1},_config:{state:!0},_roomId:{state:!0},_shutRoom:{state:!0},_floorId:{state:!0},_walls:{state:!0},_heat:{state:!0},_explode:{state:!0},_plan2d:{state:!0},_fullscreen:{state:!0},_pseudoFull:{state:!0},_vh:{state:!0},_top:{state:!0},_cameraWall:{state:!0},_clean:{state:!0},_night:{state:!0},_orbit:{state:!0},_barW:{state:!0},_barMenu:{state:!0}};rawHass;hassWatch=new rt({entityLists:!1});shownHass;get hass(){let t=this.rawHass;return t&&this.hassWatch.recording?this.hassWatch.wrap(t):t}set hass(t){this.rawHass=t}roomApplied=!1;cleanTimer;barSizer=null;idleTimer;nightTimer;data=new tt(this);tt=new D(this);constructor(){super(),this._roomId=null,this._shutRoom=null,this._floorId=void 0,this._walls=Ze(),this._heat=null,this._explode=null,this._plan2d=null,this._fullscreen=!1,this._pseudoFull=!1,this._vh=window.innerHeight,this._top=null,this._cameraWall=!1,this._clean=!1,this._night=!1,this._orbit=!1,this._barW=0,this._barMenu=!1}touch=()=>{this._orbit&&(this._orbit=!1),this.armIdle(),this.armClean(!0)};armClean(t=!1){clearTimeout(this.cleanTimer);let e=this._config?.controls_hide_after??0;e>0&&(t&&this._clean&&(this._clean=!1),this.cleanTimer=setTimeout(()=>this._clean=!0,e*1e3))}armIdle(){clearTimeout(this.idleTimer);let t=this._config?.idle_return??0;t>0&&(this.idleTimer=setTimeout(()=>this.returnHome(),t*1e3))}view3d(){return bt(this.shadowRoot)}toggleTimeTravel(){if(this.tt.active){this.tt.stop();return}let t=this.view3d(),e=this.data.building;if(!t||!e||!this.hass)return;this._cameraWall=!1;let i=this._config;this.tt.start({live:this.hass,building:e,spec:t.historyEntities(),quality:i?.quality??"auto",speed:i?.time_travel_speed??null,range:i?.time_travel_range??null,t:(s,r)=>S(this.hass,s,r)})}onKey=t=>{t.key==="Escape"&&this.tt.stop(),this.touch()};returnHome(){if(this.tt.session?.playing){this.armIdle();return}this.tt.stop(),this._roomId=this._config?.room??null,this._floorId=void 0,this._plan2d=null,this.view3d()?.resetView(),this._config?.idle_orbit&&(this._orbit=!0)}openDashboard(t){history.pushState(null,"",t),window.dispatchEvent(new CustomEvent("location-changed",{bubbles:!0,composed:!0,detail:{replace:!1}}))}onFullscreen=()=>{this._fullscreen=!!document.fullscreenElement&&this.shadowRoot?.contains(document.fullscreenElement)===!0,requestAnimationFrame(this.onViewport)};onViewport=()=>{let t=Math.round(window.visualViewport?.height??window.innerHeight);if(Math.abs(t-this._vh)>1&&(this._vh=t),this._config?.fill&&!this._fullscreen){let e=Math.round(this.getBoundingClientRect().top+window.scrollY);(this._top===null||Math.abs(e-this._top)>1)&&(this._top=e)}};viewportTimer;connectedCallback(){super.connectedCallback(),this._config&&!qt(this._config,this._plan2d)&&ft(),vt().then(()=>this.requestUpdate(),t=>console.error("Home 3D: the 3D view failed to load",t)),document.addEventListener("fullscreenchange",this.onFullscreen),window.addEventListener("resize",this.onViewport),window.visualViewport?.addEventListener("resize",this.onViewport),requestAnimationFrame(this.onViewport),this.viewportTimer=setTimeout(this.onViewport,600),this.armIdle(),this.armClean(),this.nightTimer=setInterval(()=>this._night=K(this._config?.night,this.hass),6e4)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("fullscreenchange",this.onFullscreen),window.removeEventListener("resize",this.onViewport),window.visualViewport?.removeEventListener("resize",this.onViewport),this.tt.stop(),clearTimeout(this.viewportTimer),clearTimeout(this.cleanTimer),clearTimeout(this.idleTimer),clearInterval(this.nightTimer),this.barSizer?.disconnect(),this.barSizer=null}toggleFullscreen(){if(this._pseudoFull){this._pseudoFull=!1,this._fullscreen=!1,requestAnimationFrame(this.onViewport);return}if(document.fullscreenElement){document.exitFullscreen();return}let t=this.shadowRoot?.querySelector("ha-card"),e=()=>{this._pseudoFull=!0,this._fullscreen=!0,requestAnimationFrame(this.onViewport)};t?.requestFullscreen?t.requestFullscreen().catch(e):e()}static async getConfigElement(){return await Promise.all([Xe(),ke()]),document.createElement("home-3d-card-editor")}static getStubConfig(){return{type:"custom:home-3d-card"}}setWalls(t){this._walls=t;try{localStorage.setItem("home3d.card_walls",t)}catch{}}setConfig(t){if(t.height!==void 0&&!(t.height>100))throw new Error("height must be a number of pixels above 100");this._config&&((this._config.home||void 0)!==(t.home||void 0)||this._config.room!==t.room)&&(this._roomId=null,this.roomApplied=!1),this._config=t,this.data.setHome(t.home||void 0),this._floorId=void 0,this._walls=Ze(),this._heat=null,this._explode=null,this._plan2d=null,this._orbit=!1,this._night=K(t.night,this.hass),this._clean=t.controls_hidden===!0,this.armClean(),this.armIdle()}getCardSize(){return Math.ceil((this._config?.height??420)/50)}getGridOptions(){return{columns:"full",rows:this._config?.fill?12:Math.ceil((this._config?.height??420)/56),min_rows:4}}shouldUpdate(t){let e=t.get("hass"),i=this.rawHass;if(t.size!==1||!t.has("hass")||!e||!i||this.tt.active||this.hassWatch.matters(e,i)||K(this._config?.night,i)!==this._night)return!0;this.takeHass(i);let s=this.shownHass,r=s&&this.viewHass(i,this.data.building);return lt(this.renderRoot,at["card.ts"],[[e,i],[s,r]]),this.shownHass=r,!1}update(t){this.hassWatch.begin();try{super.update(t)}finally{this.hassWatch.end()}}takeHass(t){this.data.setHass(t),this.tt.session?.setLive(t);let e=K(this._config?.night,t);e!==this._night&&(this._night=e)}viewHass(t,e){return $t(this.tt.hass(t),e)}willUpdate(t){t.has("_roomId")&&this._shutRoom!==this._roomId&&(this._shutRoom=null),t.has("hass")&&this.rawHass&&(this.takeHass(this.rawHass),A(this.rawHass.language)||U(this.rawHass.language,this.rawHass).then(()=>this.requestUpdate()));let e=this.data.building;e!==this.seenBuilding&&(this.seenBuilding=e,e&&this._roomId&&!e.floors.some(i=>I(i).some(s=>s.id===this._roomId))&&(this._roomId=null))}seenBuilding=null;cardStyle(){let t=this._config,e=s=>s&&R(s)!=="theme"?s:null,i={};if(t?.style_entity)for(let s of ae())i[s.id]=[s.name??S(this.hass,`style_${s.id}`)];return{evening:e(t?.theme_evening),night:e(t?.theme_night),entity:t?.style_entity||null,names:i}}updated(){let t=dt(R(this._config?.theme),this.hass,this.data.building?.settings,this.cardStyle());this.toggleAttribute("light",it(t)),this.toggleAttribute("contrast",st(t));let e=et(this.hass);this.getAttribute("lang")!==e&&this.setAttribute("lang",e);let i=this.renderRoot.querySelector(".fp3d-card-body");i&&!this.barSizer&&typeof ResizeObserver=="function"&&(this.barSizer=new ResizeObserver(([s])=>{let r=Math.round(s?.contentRect.width??0);Math.abs(r-this._barW)>1&&(this._barW=r)}),this.barSizer.observe(i))}closeBarMenu=t=>{if(!this._barMenu)return;t.composedPath().some(i=>i.classList?.contains("fp3d-card-menu")||i.classList?.contains("fp3d-card-more"))||(this._barMenu=!1)};get canSwitch(){return!this._config?.floor||this.thumbs}get thumbs(){return this._config?.floor_thumbs??!this._config?.floor}currentFloor(){let t=this.data.building,e=this._floorId===void 0?this._config?.floor??null:this._floorId;return t&&t.floors.length===1?t.floors[0].id:t?.floors.some(i=>i.id===e)?e:null}onPlanChange(t){t.preventDefault(),this.data.update(t.detail.change)}back(){this._roomId?this._roomId=null:this.canSwitch&&(this._floorId=null)}render(){if(this.hass&&!A(this.hass.language))return u;let t=this.data.building,e=this._config?.height??420,i=this._config;!this.roomApplied&&t&&i?.room&&(this.roomApplied=!0,t.floors.some(m=>I(m).some(P=>P.id===i.room))&&(this._roomId=i.room));let s=this.currentFloor(),r=!!this._roomId&&i?.room_panel===!1||!this.thumbs&&this.canSwitch&&!this._roomId&&!!s&&(t?.floors.length??0)>1,n=m=>i?.controls===!0||Array.isArray(i?.controls)&&i.controls.includes(m),l=["temperature","humidity","co2"].filter(m=>n(m)),d=this._walls??i?.walls??"auto",h=this._heat??i?.heatmap??"none",c=this._explode??i?.explode??!0,p=qt(i,this._plan2d),v=this._fullscreen?"100%":i?.fill?this._top!==null?`${Math.max(240,this._vh-this._top-2)}px`:"calc(100vh - var(--header-height, 56px) - 2px)":`${e}px`,E=!!t&&!this._clean&&(r||(!!i?.controls||!!i?.time_travel)&&!(this._roomId&&this._shutRoom!==this._roomId&&i.room_panel!==!1)),$=this.tt.active,f=this.viewHass(this.rawHass,t);this.shownHass=f;let _=i?.controls_hidden!==void 0||(i?.controls_hide_after??0)>0,H=m=>S(this.hass,m),x=ht(R(i?.theme),i?.accent,this.hass,m=>getComputedStyle(this).getPropertyValue(m));return a`<ha-card class="${this._night?"fp3d-night":""} ${this._pseudoFull?"fp3d-pseudo-full":""}" style=${pt(x)} @pointerdown=${m=>(this.closeBarMenu(m),this.touch())} @keydown=${this.onKey} @wheel=${this.touch}>
      <div class="fp3d-card-body ${$?"fp3d-tt":""}" style="height:${v}">
        ${t&&t.floors.some(m=>m.rooms.length)?a`<fp3d-view3d
              .hass=${f}
              .canEdit=${this.data.canEdit}
              .home=${this.data.homeId}
              .replay=${this.tt.session?.replay??null}
              .building=${t}
              .packs=${this.data.packs}
              .plan2d=${p}
              .floorId=${s}
              .roomId=${this._roomId}
              .wallMode=${d}
              .explode=${c}
              .keepRoof=${i?.roof_fade===!1}
              .hideRoof=${i?.roof===!1}
              .quality=${this._config?.quality??"auto"}
              ?showStats=${this._config?.stats??!1}
              .markerMode=${this._config?.markers??"important"}
              .pinSize=${this._config?.marker_size??"normal"}
              .markerNames=${this._config?.marker_names===!0}
              .central=${this._config?.central!==!1}
              .walkable=${this._config?.walk!==!1}
              .petsOn=${this._config?.pets!==!1}
              .ghostOn=${this._config?.ghost!==!1}
              .buttons=${this._config?.buttons?.map((m,P)=>({id:`card_${P}`,...m}))??null}
              .heatMode=${h}
              .theme=${R(this._config?.theme)}
              .themeEvening=${R(this._config?.theme_evening)==="theme"?null:this._config?.theme_evening??null}
              .themeNight=${R(this._config?.theme_night)==="theme"?null:this._config?.theme_night??null}
              .styleEntity=${this._config?.style_entity||null}
              .clock=${this._config?.clock??null}
              .accent=${x}
              .showEnergy=${this._config?.energy??!0}
              .flows=${this._config?.flows??null}
              .holograms=${this._config?.holograms??null}
              .floorThumbs=${this.thumbs}
              .roomLabels=${i?.room_names!==!1}
              .controlsRight=${i?.controls_side==="right"}
              .keepView=${i?.keep_view===!0}
              .angleLock=${i?.angle_lock===!0}
              .floorStack=${i?.floor_stack??"dim"}
              .panelOpen=${!!this._roomId&&this._shutRoom!==this._roomId&&i?.room_panel!==!1}
              .alerts=${i?.alerts!==!1}
              .householdCard=${i?.household_card!==!1}
              .rackCards=${i?.rack_cards!==!1}
              .alertJump=${!!i?.alert_jump}
              .director=${!!i?.director}
              .voice=${!!i?.voice}
              .screen=${i?.screen?.trim()||null}
              .scenes=${i?.scenes!==!1}
              ?trail=${!!i?.motion_trail}
              .cameraWall=${this._cameraWall&&!$}
              @camera-wall-close=${()=>this._cameraWall=!1}
              @camera-wall-open=${()=>this._cameraWall=!0}
              .clean=${this._clean}
              .cleanButton=${_}
              @clean-toggle=${()=>{this._clean=!this._clean,this._clean?clearTimeout(this.cleanTimer):this.armClean()}}
              .weather=${i?.weather!==!1}
              .weatherEntityId=${i?.weather_entity??null}
              .dimmed=${this._night}
              .autoOrbit=${this._orbit}
              .startView=${i?.start_view??null}
              style=${$?`--fp3d-bottom-inset: ${E?"calc(52px + var(--fp3d-tt-h))":"var(--fp3d-tt-h)"}`:E?"--fp3d-bottom-inset: 52px":""}
              @room-tap=${m=>{if(this.canSwitch&&(t?.floors.length??0)>1&&m.detail.floorId&&this.currentFloor()!==m.detail.floorId){this._floorId=m.detail.floorId,this._roomId=null;return}if(m.detail.roomId){if(m.detail.roomId===this._roomId&&this._shutRoom===this._roomId){this._shutRoom=null;return}this._roomId=m.detail.roomId===this._roomId?null:m.detail.roomId}}}
              @floor-tap=${m=>{this._floorId=m.detail.floorId,this._roomId=null}}
              @back=${()=>this.back()}
              @plan-change=${this.onPlanChange}
            ></fp3d-view3d>`:a`<p class="fp3d-card-msg">${this.data.error??(t?S(this.hass,"no_building"):S(this.hass,"loading"))}</p>`}
        ${this._roomId&&this._shutRoom!==this._roomId&&t&&this._config?.room_panel!==!1?(k(F),a`<fp3d-room-panel
              @camera-look=${m=>this.view3d()?.lookThrough(m.detail.entity)}
              class="fp3d-card-panel"
              .hass=${f}
              ?readOnly=${$}
              ?noLook=${p}
              ?canEdit=${this.data.canEdit}
              @plan-change=${this.onPlanChange}
              .room=${t.floors.flatMap(m=>I(m)).find(m=>m.id===this._roomId)??null}
              .floor=${t.floors.find(m=>I(m).some(P=>P.id===this._roomId))??null}
              .building=${t}
              .confirmEntities=${Z(this.hass,t.floors)}
              .sheets=${this._roomId?this.view3d()?.roomSheets(this._roomId)??null:null}
              @sheet-open=${m=>this._roomId&&this.view3d()?.openRoomSheet(this._roomId,m.detail.id)}
              @close=${()=>this._shutRoom=this._roomId}
            ></fp3d-room-panel>`):u}
        ${E&&t?this.renderBar(t,r,p,d,c,s,l,h,H):u}
        ${this.tt.session?a`<fp3d-time-bar .session=${this.tt.session}></fp3d-time-bar>`:u}
        ${i?.fullscreen_button&&!this._clean&&!(this._roomId&&this._shutRoom!==this._roomId&&i.room_panel!==!1)?a`<button class="fp3d-card-full" title=${H(this._fullscreen?"fullscreen_exit":"fullscreen")} aria-label=${H(this._fullscreen?"fullscreen_exit":"fullscreen")} @click=${()=>this.toggleFullscreen()}>
              ${this._fullscreen?"\u2715":C("expand")}
            </button>`:u}
        ${i?.dashboard&&!this._clean&&!(this._roomId&&this._shutRoom!==this._roomId&&i.room_panel!==!1)?a`<button class="fp3d-card-full fp3d-card-dash ${i.fullscreen_button?"fp3d-card-dash-2":""}" title=${i.dashboard_label||i.dashboard} aria-label=${i.dashboard_label||i.dashboard} @click=${()=>this.openDashboard(i.dashboard)}>
              ${i.dashboard_label?a`<span>${i.dashboard_label}</span>`:"\u2302"}
            </button>`:u}
      </div>
    </ha-card>`}renderBar(t,e,i,s,r,n,l,d,h){let c=this._config,p=this.tt.active,v=x=>c?.controls===!0||Array.isArray(c?.controls)&&c.controls.includes(x),E=x=>x==="none"?"heat_off":`heat_short_${x}`,$=[];if(e&&$.push({id:"back",keep:!0,texts:[h("back")],tpl:a`<button class="fp3d-chip" @click=${()=>this.back()}>${h("back")}</button>`}),c?.time_travel&&$.push({id:"tt",texts:["\u23EA "+h("tt_chip")],tpl:a`<button class="fp3d-chip fp3d-tt-chip" aria-pressed=${p} title=${h("tt_hint")} @click=${()=>this.toggleTimeTravel()}>⏪ ${h("tt_chip")}</button>`}),c?.camera_wall&&$.push({id:"cameras",texts:[h("cameras_short")],tpl:a`<button class="fp3d-chip" aria-pressed=${this._cameraWall} title=${h("camera_wall_hint")} @click=${()=>this._cameraWall=!this._cameraWall}>${h("cameras_short")}</button>`}),v("view")&&$.push({id:"view",texts:[h("view_3d"),h("view_2d")],tpl:a`<div class="fp3d-seg" role="group" aria-label=${h("plan_view")}>
          <button aria-pressed=${!i} @click=${()=>this._plan2d=!1}>${h("view_3d")}</button>
          <button aria-pressed=${i} @click=${()=>this._plan2d=!0}>${h("view_2d")}</button>
        </div>`}),v("walls")&&!i&&$.push({id:"walls",texts:[h("walls_auto"),h("walls_cut")],tpl:a`<div class="fp3d-seg">
          <button aria-pressed=${s==="auto"} @click=${()=>this.setWalls("auto")}>${h("walls_auto")}</button>
          <button aria-pressed=${s==="cut"} @click=${()=>this.setWalls("cut")}>${h("walls_cut")}</button>
        </div>`}),v("floors")&&!i&&t.floors.length>1&&!n&&$.push({id:"floors",texts:[h("floors_apart"),h("floors_stacked")],tpl:a`<div class="fp3d-seg">
          <button aria-pressed=${r} @click=${()=>this._explode=!0}>${h("floors_apart")}</button>
          <button aria-pressed=${!r} @click=${()=>this._explode=!1}>${h("floors_stacked")}</button>
        </div>`}),l.length){let x=["none",...l];$.push({id:"heat",texts:x.map(m=>h(E(m))),tpl:a`<div class="fp3d-seg" role="group" aria-label=${h("heatmap")}>
          ${x.map(m=>a`<button aria-pressed=${d===m} @click=${()=>this._heat=m}>${h(E(m))}</button>`)}
        </div>`})}let f=this._barW?Qe($,this._barW-70):{bar:$.map(x=>x.id),menu:[]},_=x=>$.find(m=>m.id===x).tpl,H=this._barMenu&&f.menu.length>0;return a`<div class="fp3d-card-controls">
      ${f.bar.map(_)}
      ${f.menu.length?a`<button class="fp3d-chip fp3d-card-more" aria-haspopup="true" aria-expanded=${H?"true":"false"} title=${h("more")} aria-label=${h("more")} @click=${()=>this._barMenu=!this._barMenu}>⋯</button>`:u}
      ${H?a`<div class="fp3d-card-menu" role="group" aria-label=${h("more")} @keydown=${x=>x.key==="Escape"&&(this._barMenu=!1)}>${f.menu.map(_)}</div>`:u}
    </div>`}static styles=[ot,nt,Y`.fp3d-card-controls{position:absolute;left:60px;right:10px;bottom:10px;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;pointer-events:none}.fp3d-card-controls > *{pointer-events:auto}.fp3d-card-more{min-width:44px;font-size:18px;line-height:1}.fp3d-card-menu{position:absolute;right:0;bottom:calc(100% + 8px);display:grid;justify-items:end;gap:8px;padding:8px;border-radius:14px;background:var(--fp3d-chrome-solid);border:1px solid var(--fp3d-line);box-shadow:var(--fp3d-shadow);max-width:calc(100% - 16px)}.fp3d-card-menu .fp3d-seg{box-shadow:none;flex-wrap:wrap}.fp3d-tt > *{--fp3d-tt-h:64px}.fp3d-tt .fp3d-card-controls{bottom:calc(var(--fp3d-tt-h) + 2px)}.fp3d-tt .fp3d-card-panel{bottom:calc(var(--fp3d-tt-h) + 4px)}.fp3d-tt-chip[aria-pressed="true"]{background:#ffb020;color:#1a1200}.fp3d-card-dash{width:auto;min-width:38px;padding:0 12px;font-size:14px;font-weight:600}.fp3d-card-dash-2{right:56px}fp3d-view3d{--fp3d-walk-right:104px}.fp3d-card-full{position:absolute;right:10px;top:10px;width:38px;height:38px;border:0;border-radius:12px;background:var(--fp3d-chrome);color:var(--fp3d-text);box-shadow:var(--fp3d-shadow);font-size:18px;cursor:pointer}ha-card.fp3d-pseudo-full{position:fixed;inset:0;z-index:9999;height:100vh !important;max-height:none !important;border-radius:0}@supports (height:100dvh){ha-card.fp3d-pseudo-full{height:100dvh !important}}ha-card{overflow:hidden;background:var(--fp3d-bg);height:100%}ha-card:fullscreen{display:flex;flex-direction:column;width:100vw;height:100vh;border-radius:0;border:0}ha-card:fullscreen .fp3d-card-body{flex:1 1 auto;min-height:0}ha-card.fp3d-night .fp3d-card-body{filter:brightness(0.55)}.fp3d-card-body{position:relative;display:flex;height:100%;container-type:size;container-name:fp3d}fp3d-view3d{flex:1}.fp3d-card-msg{margin:auto;color:var(--fp3d-muted);padding:16px;text-align:center}.fp3d-card-panel{position:absolute;top:10px;right:10px;bottom:10px;width:min(340px,calc(100% - 20px));display:flex;flex-direction:column;pointer-events:none;z-index:2}@container fp3d ((max-width:700px) or ((orientation:portrait) and (max-width:1000px))){.fp3d-card-panel{top:auto;left:8px;right:8px;bottom:8px;width:auto;height:var(--fp3d-sheet-h,55%);justify-content:flex-end}.fp3d-tt > *{--fp3d-tt-h:calc(120px + env(safe-area-inset-bottom,0px))}@media (pointer:coarse){.fp3d-tt > *{--fp3d-tt-h:calc(138px + env(safe-area-inset-bottom,0px))}}}`]};if(G("home-3d-card",Kt)){let o=window;o.customCards=o.customCards??[],o.customCards.push({type:"home-3d-card",name:S(void 0,"card_name"),description:S(void 0,"card_description"),preview:!1})}var Hi="/api/home_3d/static/",ti="/home_3d_static/";function ei(o){let t=new URL(".",o);return t.pathname.endsWith(ti)&&(t.pathname=`${t.pathname.slice(0,-ti.length)}${Hi}`),t.href}async function ii(o,t=(s,r)=>fetch(s,r),e=Date.now(),i=4e3){let s,r=(async()=>{let l=await t(new URL(`build.json?t=${e}`,o).href,{cache:"no-store",credentials:"same-origin"});if(!l.ok)return null;let d=(await l.json())?.build;return typeof d=="string"&&/^[\w-]{1,64}$/.test(d)?d:null})().catch(()=>null),n=new Promise(l=>s=setTimeout(()=>l(null),i));try{return await Promise.race([r,n])}finally{clearTimeout(s)}}var jt="fp3d_chunk_reload",Ti=3e4,Ci=/dynamically imported module|importing a module script failed|ChunkLoadError|Loading chunk .* failed/i;function Ri(o){if(!o||typeof o!="object")return!1;let{name:t,message:e}=o;return t==="ChunkLoadError"||typeof e=="string"&&Ci.test(e)}function Gt(){let o=null;try{o=globalThis.sessionStorage??null}catch{o=null}return{storage:o,reload:()=>globalThis.location?.reload(),later:(t,e)=>{setTimeout(t,e).unref?.()}}}function si(o,t={}){if(!Ri(o))return!1;let{storage:e,reload:i}={...Gt(),...t};if(!e)return!1;try{if(e.getItem(jt))return!1;e.setItem(jt,String(Date.now()))}catch{return!1}return i(),!0}function Mi(o={}){let{storage:t,later:e}={...Gt(),...o};e(()=>{try{t?.removeItem(jt)}catch{}},Ti)}function ni(){globalThis[de]=o=>{si(o)},typeof addEventListener=="function"&&(addEventListener("unhandledrejection",o=>{si(o.reason)}),Mi())}var oi="fp3d_build_reload",Li=6e4;async function ri(o,t={}){let{storage:e,reload:i}={...Gt(),...t},s=t.age??globalThis.performance?.now()??0;if(!e||s>Li||await(t.current??(()=>ii(ei(import.meta.url))))().catch(()=>null)!==o)return!1;try{if(e.getItem(oi)===o)return!1;e.setItem(oi,o)}catch{return!1}return i(),!0}Jt()?(ni(),Oe(),Ie()):(console.info(`Home 3D: this page runs another build; build ${Et} stays out of it`),ri(Et));
