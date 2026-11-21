import{a as Ae,c as Lt,d as Oe,e as Pt,f as At}from"./home-3d-chunk-UWZMBGIZ.js";import{$ as Ke,F as ze,H as _t,I as Ne,J as Ve,K as We,L as Bt,M as Ue,N as Dt,O as zt,Q as Nt,R as Vt,T as qe,U as Wt,a as L,aa as bt,ba as je,c as st,d as M,da as Ge,z as Ft}from"./home-3d-chunk-LETLVEJK.js";import{b as Pe}from"./home-3d-chunk-FTEMRB7C.js";import{a as Se,e as ht,f as pt,g as ct}from"./home-3d-chunk-2NTUZXVD.js";import"./home-3d-chunk-2ECSHW7B.js";import"./home-3d-chunk-HQTVWK2Z.js";import{b as se,c as ne,e as re,i as ke}from"./home-3d-chunk-JLXVF5PN.js";import{j as pe}from"./home-3d-chunk-QYLM2ZL2.js";import{a as et,c as ae,g as le,h as de,i as he,j as Ie,k as ut,l as ft,m as mt,n as P,q as Ee,u as He,v as Te,w as Re,x as Ct}from"./home-3d-chunk-TV64ZD4V.js";import{a as we,b as ye,d as k,e as D,f as Fe,g as G,j as gt,k as Ot,o as Be,p as De,q as vt}from"./home-3d-chunk-W4ACDYSB.js";import{a as Me,c as Ce,f as Le}from"./home-3d-chunk-J6PKV2EX.js";import{C as ge,P as ot,c as it,ca as ve,o as me}from"./home-3d-chunk-5HTZDN6X.js";import{H as fe,n as K,s as ce,v as ue,z as R}from"./home-3d-chunk-4RAXCN33.js";import"./home-3d-chunk-MO75OTGM.js";import{d as $e,e as F,f as j,g as nt,h as E,i as xe}from"./home-3d-chunk-J6KM7YHV.js";import{i as _e,j as be,r as rt,s as at,t as lt,u as dt}from"./home-3d-chunk-VHLKQHQG.js";import{a as Mt,b as oe,c as Q,d as q,e as Z,f as l,i as u,k as tt}from"./home-3d-chunk-OGUPXY2P.js";import{a as b,b as w}from"./home-3d-chunk-Z6PTQOYF.js";Array.prototype.at||Object.defineProperty(Array.prototype,"at",{configurable:!0,writable:!0,value:function(t){let e=Math.trunc(t)||0;return this[e<0?this.length+e:e]}});typeof globalThis.structuredClone!="function"&&(globalThis.structuredClone=o=>o===void 0?o:JSON.parse(JSON.stringify(o)));var Qe=new URL(import.meta.url),Ye=Qe.searchParams.get("v"),Je=o=>new URL(`./fonts/${o}${Ye?`?v=${Ye}`:""}`,Qe).href,Xe="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";function Ze(){if(typeof document>"u"||document.getElementById("fp3d-fonts"))return;let o=document.createElement("style");o.id="fp3d-fonts",o.textContent=`
@font-face{font-family:"Figtree";font-style:normal;font-display:swap;font-weight:300 900;src:url(${Je("figtree.woff2")}) format("woff2");unicode-range:${Xe}}
@font-face{font-family:"Bricolage Grotesque";font-style:normal;font-display:swap;font-weight:200 800;src:url(${Je("bricolage-grotesque.woff2")}) format("woff2");unicode-range:${Xe}}`,document.head.append(o)}function wt(o,t){return t==="metric"||t==="imperial"?t:o?.config?.unit_system?.length==="mi"?"imperial":"metric"}function Ii(o,t){return String(Number(o.toFixed(t)))}function Ut(o,t=2){let e=o<0?"-":"",i=Math.round(Math.abs(o)/.0254*(t>=2?10:1))/(t>=2?10:1),s=Math.floor(i/12+1e-9),n=i-s*12,r=Ii(n,t>=2?1:0);return s?n<.05?`${e}${s}'`:`${e}${s}' ${r}"`:`${e}${r}"`}function qt(o,t){let e=o.trim().toLowerCase().replace(/,/g,".").replace(/[′’]/g,"'").replace(/[″”“]/g,'"').replace(/''/g,'"');if(!e)return null;let i=/(-?\d+(?:\.\d+)?|-?\.\d+)\s*(feet|foot|ft|'|inches|inch|in|"|mm|cm|m)?/g,s=0,n=!1,r=!1,a=e;for(let d of e.matchAll(i)){let h=Number(d[1]);if(!Number.isFinite(h))return null;let c=d[2];n=!0,a=a.replace(d[0],""),c==="feet"||c==="foot"||c==="ft"||c==="'"?(s+=h*.3048,r=!0):c==="inches"||c==="inch"||c==="in"||c==='"'?s+=h*.0254:c==="mm"?s+=h/1e3:c==="cm"?s+=h/100:c==="m"?s+=h:s+=t==="imperial"?h*(r?.0254:.3048):h}return!n||/[^\s+]/.test(a)?null:s}function Y(o,t){return t==="imperial"?o.replace(/\s*\((?:m|cm)\)/g,"").replace(/\((?:m|cm), /g,"(").replace(/\s(?:m|cm)$/,""):o}var ti=se(class extends ne{constructor(){super(...arguments),this.key=u}render(o,t){return this.key=o,t}update(o,[t,e]){return t!==this.key&&(re(o),this.key=t),e}});var z=M("home-3d-editor",()=>"05618521aa3b",()=>b),ei=()=>z().then(o=>o.loadExtensions());var ii=M("home-3d-settings",()=>"4cf62797aa46",()=>w);function oi(o){return o?o.startsWith("seasons.")?`season:${o.slice(8)}`:o==="halloween.ghost"?"season:halloween":o.startsWith("pets.")?"pets":o==="easter_eggs"?"fun":null:null}var yt=M("home-3d-locate",()=>"145687541e18");function Ei(){let o=()=>k(D);typeof requestIdleCallback=="function"?requestIdleCallback(o,{timeout:3e3}):setTimeout(o,1e3)}var Kt;function $t(){return Kt??=ye(import("./home-3d-view3d-TGEGCSIL.js")).then(()=>Ei(),o=>{throw Kt=void 0,o}),Kt}function xt(o){return customElements.get("fp3d-view3d")?o?.querySelector("fp3d-view3d")??null:null}var Hi=`
.fp3d-loclab{position:fixed;right:8px;bottom:8px;z-index:9999;max-width:min(360px,calc(100vw - 16px));max-height:70vh;overflow:auto;
background:#0b1120f2;color:#e6f7ff;border:1px solid #37e0ff66;border-radius:12px;padding:10px;font:13px system-ui,sans-serif;box-shadow:0 6px 30px #0008}
.fp3d-loclab h4{margin:0 0 6px;font-size:13px;display:flex;justify-content:space-between;gap:8px;cursor:pointer}
.fp3d-loclab button{font:inherit;color:#e6f7ff;background:#16233d;border:1px solid #37e0ff55;border-radius:8px;padding:7px 9px;margin:2px;cursor:pointer}
.fp3d-loclab button.on{background:#37e0ff;color:#04121c;font-weight:700}
.fp3d-loclab .rec{background:#d6336c;border-color:#d6336c}
.fp3d-loclab small{opacity:.75}
.fp3d-loclab .fl{margin:6px 0 2px;opacity:.7;font-size:11px;text-transform:uppercase}`;function si(o){let t=document.createElement("style");t.textContent=Hi;let e=document.createElement("div");e.className="fp3d-loclab",document.body.append(t,e);let i=null,s="",n=!0,r=async(h,c={})=>{let p=o().hass;if(p){try{i=await p.callWS({type:"home_3d/locate/rec",action:h,...c}),s=""}catch(_){s=_.message??String(_)}a()}},a=()=>{let h=o().building,c=i,p=c?.mark?.room??null,_=`<h4 data-a="toggle"><span>\u{1F4E1} Locating \xB7 recording (lab)</span><span>${n?"\u25BE":"\u25B8"}</span></h4>`;if(!n){e.innerHTML=_;return}let I=(c?.devices??[]).map(m=>{let v=m.t?Math.round(Date.now()/1e3-m.t):null;return`<div>\u231A ${A(m.title)}: ${v===null?"<small>not heard yet</small>":`${m.rssi} dBm \xB7 ${A(m.scanner??"")} <small>${v} s ago</small>`}</div>`}).join(""),$=(h?.floors??[]).map(m=>`<div class="fl">${A(m.name)}</div>`+m.rooms.map(v=>`<button data-room="${A(v.id)}" data-name="${A(v.name)}" class="${p===v.id?"on":""}">${A(v.name)}</button>`).join("")).join("");e.innerHTML=`${_}
      <div><button data-a="setup">\u2699 Set up locating</button></div>
      <div>${c?.running?`<button class="rec" data-a="stop">\u25A0 Stop</button> <small>${Math.floor(c.seconds/60)}:${String(c.seconds%60).padStart(2,"0")} \xB7 ${c.lines} lines</small>`:'<button data-a="start">\u25CF Start recording</button>'}</div>
      ${s?`<div style="color:#ff8fa3">${A(s)}</div>`:""}
      ${I||(c?"<div><small>No iPhone/Watch keys (Private BLE Device) in HA \u2013 everything is recorded anyway.</small></div>":"")}
      ${c?.mark?`<div style="margin-top:6px">\u23F1 for <b>${Ti(Date.now()/1e3-c.mark.t)}</b> in <b>${A(c.mark.name)}</b> ${Date.now()/1e3-c.mark.t>=120?"\u2713 2 min done":""}</div>`:""}
      <div class="fl">I am now in \u2026</div>
      <button data-room="" class="${p?"":"on"}">\u{1F6B6} on the way / nowhere</button>
      ${$}`};e.addEventListener("click",h=>{let c=h.target.closest("button,h4");if(!c)return;let p=c.dataset.a;if(p==="toggle")n=!n,a();else if(p==="start")r("start",{note:"lab walk"});else if(p==="stop")r("stop");else if(p==="setup"){let{hass:_,building:I}=o();_&&I&&yt().then($=>$.openLocateSetup(_,I,()=>o().hass))}else c.dataset.room!==void 0&&r("mark",c.dataset.room?{room:c.dataset.room,name:c.dataset.name}:{room:null})}),r("status");let d=window.setInterval(()=>{r("status")},1e3);return()=>{window.clearInterval(d),e.remove(),t.remove()}}function Ti(o){let t=Math.max(0,Math.round(o));return`${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`}function A(o){return o.replace(/[&<>"]/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[t])}var Ri=M("home-3d-timetravel",()=>"e76cf7f012fa"),N=class{session=null;starting=!1;host;constructor(t){this.host=t}get active(){return this.starting||!!this.session}start(t){this.active||(this.starting=!0,this.host.requestUpdate(),Ri().then(e=>{this.starting&&(this.starting=!1,this.session=e.startTimeTravel({...t,onChange:()=>this.host.requestUpdate(),onExit:()=>this.stop()}),this.host.requestUpdate())},e=>{this.starting=!1,console.error("Home 3D: time travel failed to load",e),this.host.requestUpdate()}))}stop(){this.active&&(this.starting=!1,this.session?.dispose(),this.session=null,this.host.requestUpdate())}hass(t){return this.session?.hass??t}};function J(o,t,e=new Date){if(!o||o==="off")return!1;if(o==="sun")return t?.states["sun.sun"]?.state==="below_horizon";let i=/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(o.trim());if(!i)return!1;let s=Number(i[1])*60+Number(i[2]),n=Number(i[3])*60+Number(i[4]),r=e.getHours()*60+e.getMinutes();return s<=n?r>=s&&r<n:r>=s||r<n}var Mi=new Set(["0","off","false","no"]);function jt(o,t,e){let i=new URLSearchParams(o).get("tablet");return i!==null?!Mi.has(i.trim().toLowerCase()):!!t&&!!e?.includes(t)}var Ci=120;function ni(o,t){let e=n=>typeof n=="number"&&Number.isFinite(n)&&n>=0,i=new URLSearchParams(o).get("idle"),s=i!==null&&i.trim()!==""?Number(i):null;return e(s)?s:e(t)?t:Ci}var kt=class{timer;seconds=0;onIdle;constructor(t){this.onIdle=t}arm(t){this.seconds=t>0?t:0,this.touch()}touch(){clearTimeout(this.timer),this.timer=this.seconds>0?setTimeout(this.onIdle,this.seconds*1e3):void 0}stop(){clearTimeout(this.timer),this.timer=void 0}};var St=class{past=[];future=[];pool=new Map;chars=0;home=void 0;doc=null;run=null;now;maxSteps;maxChars;constructor(t={}){this.now=t.now??Date.now,this.maxSteps=t.maxSteps??100,this.maxChars=t.maxChars??25e6}get size(){return this.chars}get steps(){return this.past.length}get canUndo(){return this.past.length>0}get canRedo(){return this.future.length>0}adopt(t,e){let i=e===this.home&&t===this.doc;return i||this.clear(),this.home=e,this.doc=t,i}record(t,e,i,s=null){this.adopt(t,i),this.push(t,s),this.track(e)}track(t){this.doc=t}push(t,e=null,i=500){let s=this.now(),n=e!==null&&this.run?.key===e&&s-this.run.at<=i&&this.past.length>0;this.run=e===null?null:{key:e,at:s};for(let r of this.future)this.release(r);this.future=[],!n&&(this.past.push(this.store(t)),this.trim())}undo(t){let e=this.past.pop();return e?(this.run=null,this.future.push(this.store(t)),this.release(e),this.doc=this.load(e)):null}redo(t){let e=this.future.pop();return e?(this.run=null,this.past.push(this.store(t)),this.release(e),this.trim(),this.doc=this.load(e)):null}clear(){this.past=[],this.future=[],this.pool.clear(),this.chars=0,this.run=null}trim(){for(;this.past.length>this.maxSteps||this.chars>this.maxChars&&this.past.length>1;)this.release(this.past.shift())}store(t){let e=[];for(let[i,s]of Object.entries(t))if(i==="floors"&&Array.isArray(s))e.push([i,s.map(n=>this.keep(JSON.stringify(n)))]);else{let n=JSON.stringify(s);n!==void 0&&e.push([i,this.keep(n)])}return e}load(t){let e={};for(let[i,s]of t)e[i]=Array.isArray(s)?s.map(n=>JSON.parse(n)):JSON.parse(s);return e}keep(t){let e=this.pool.get(t);return e?(e.n++,e.s):(this.pool.set(t,{s:t,n:1}),this.chars+=t.length,t)}release(t){for(let[,e]of t)for(let i of Array.isArray(e)?e:[e]){let s=this.pool.get(i);s&&--s.n===0&&(this.pool.delete(i),this.chars-=i.length)}}};var B={solar:3600,batteryCharge:1200,house:2e3},O={soc:72,room:20.5,target:21,tariff:.245,car:78},y=o=>!!o&&o!=="none"&&o.includes("."),Li=o=>o.slice(0,o.indexOf(".")),Pi=[[/hob|oven|cooker|kettle/,1500],[/wallbox|charger|zappi/,1400],[/washing|washer|dishwasher/,450],[/fridge|freezer|kitchen_tall/,110],[/tv|monitor|screen/,95],[/pc|computer|desk/,120],[/boiler|heat_pump/,90],[/router|network/,15]],li=o=>Pi.find(([t])=>t.test(o))?.[1]??60,Ai={device_class:"power",unit_of_measurement:"W",state_class:"measurement"},Gt={device_class:"battery",unit_of_measurement:"%"},di={device_class:"temperature",unit_of_measurement:"\xB0C"};function Oi(o){let t=o.slice(o.indexOf(".")+1).replace(/_/g," ");return t.charAt(0).toUpperCase()+t.slice(1)}var Yt=class{out=new Map;lights=0;media=0;put(t,e,i={}){this.out.has(t)||this.out.set(t,{entity_id:t,state:String(e),attributes:{friendly_name:Oi(t),...i}})}watts(t,e){this.put(t,Math.round(e),Ai)}main(t,e){let i=e??"";switch(Li(t)){case"light":{let s=this.lights++%3!==2;this.put(t,s?"on":"off",{supported_color_modes:["color_temp"],...s?{brightness:200,color_mode:"color_temp",color_temp_kelvin:2700}:{}});return}case"climate":case"water_heater":this.put(t,"heat",{hvac_modes:["off","heat"],hvac_action:"heating",current_temperature:O.room,temperature:O.target,min_temp:5,max_temp:30});return;case"media_player":{let s=/tv/.test(i),n=s||this.media++===0;this.put(t,n?"playing":"idle",{device_class:s?"tv":"speaker",...n?{media_title:"Demo",volume_level:.3}:{}});return}case"switch":case"input_boolean":case"fan":this.put(t,"on");return;case"binary_sensor":this.put(t,"off",/smoke/.test(i)?{device_class:"smoke"}:/water|leak/.test(i)?{device_class:"moisture"}:{});return;case"cover":this.put(t,"open",{current_position:100});return;case"lock":this.put(t,"locked");return;case"camera":this.put(t,"idle");return;case"vacuum":this.put(t,"docked");return;case"sensor":this.sensor(t,i);return}}sensor(t,e){/power|_w$/.test(t)?this.watts(t,li(e||t)):/temp/.test(t)||e&&ce(e)?this.put(t,O.room,di):/humid/.test(t)?this.put(t,50,{device_class:"humidity",unit_of_measurement:"%"}):/battery|soc|level/.test(t)||/car|leaf|vehicle/.test(e)?this.put(t,O.car,Gt):this.put(t,"ok")}energy(t,e,i){let s=K(t.type);s==="meter"?y(t.export)?(this.watts(t.export,Math.max(0,-e.grid)),y(t.power)&&this.watts(t.power,Math.max(0,e.grid))):y(t.power)&&this.watts(t.power,i.energy.grid_invert?-e.grid:e.grid):s==="inverter"||s==="solar"?y(t.power)&&this.watts(t.power,e.solar):s==="home_battery"&&(y(t.charge)?(this.watts(t.charge,-e.battery),y(t.power)&&this.watts(t.power,0)):y(t.power)&&this.watts(t.power,i.energy.battery_invert?-e.battery:e.battery))}},ri=new WeakMap;function Fi(o){let t=ri.get(o);if(t)return t;let e=new Yt,i=o.energy,s=o.floors.flatMap(p=>p.furniture),r=y(i.battery)||s.some(p=>K(p.type)==="home_battery"&&(y(p.power)||y(p.charge)))?-B.batteryCharge:0,a=B.house-B.solar-r;y(i.grid)&&e.watts(i.grid,i.grid_invert?-a:a),y(i.solar)&&e.watts(i.solar,B.solar),y(i.battery)&&e.watts(i.battery,i.battery_invert?-r:r),y(i.battery_soc)&&e.put(i.battery_soc,O.soc,Gt),y(i.consumption)&&e.watts(i.consumption,B.house),y(i.tariff)&&e.put(i.tariff,O.tariff,{unit_of_measurement:"GBP/kWh"});let d=s.filter(p=>(K(p.type)==="inverter"||K(p.type)==="solar")&&y(p.power)).length;for(let p of s)e.energy(p,{grid:a,battery:r,solar:B.solar/Math.max(1,d)},o);let h=(o.settings.roof?.solar??[]).filter(p=>y(p.entity)),c=h.reduce((p,_)=>p+Ft(_),0)||1;for(let p of h)e.watts(p.entity,B.solar*Ft(p)/c);for(let p of s){y(p.entity)&&e.main(p.entity,p.type),y(p.power)&&e.watts(p.power,li(p.type));for(let _ of[p.state_entity,p.state_entity2,p.extra])y(_)&&e.main(_,p.type);y(p.heat_sensor)&&e.put(p.heat_sensor,"on",{device_class:"heat"}),y(p.soc)&&e.put(p.soc,O.soc,Gt),y(p.room_sensor)&&e.put(p.room_sensor,O.room,di)}for(let p of o.floors)for(let _ of p.placements)y(_.entity_id)&&e.main(_.entity_id,null);return ri.set(o,e.out),e.out}var ai=new WeakMap,Jt=new WeakMap;function Bi(o,t){let e=Jt.get(o);return!!e&&o.states[t]===e.get(t)}function X(o){return!!o&&Jt.has(o)}function It(o,t){if(!t?.settings?.demo)return o;let e=ai.get(o);if(e?.building===t)return e.out;let i=Fi(t),s=o.states;for(let[r,a]of i){let d=o.states[r];d&&d.state!=="unavailable"&&d.state!=="unknown"||(s===o.states&&(s={...o.states}),s[r]=a)}let n=o;return s!==o.states&&(n={...o,states:s},n.callService=(r,a,d)=>Di(n,d)?Promise.resolve(void 0):o.callService(r,a,d),Jt.set(n,i)),ai.set(o,{building:t,out:n}),n}function Di(o,t){let e=t?.entity_id,i=typeof e=="string"?[e]:Array.isArray(e)?e.filter(s=>typeof s=="string"):[];return i.length>0&&i.every(s=>Bi(o,s))}var zi="fp3d-announce",Ni="position:fixed;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;",V=globalThis.__fp3dAnnounce??={region:null,timer:null};function Vi(o){let t=o.fullscreenElement??null;for(;t?.shadowRoot?.fullscreenElement;)t=t.shadowRoot.fullscreenElement;return t??o.body}function Et(o,t=typeof document>"u"?void 0:document){if(!t||!o)return;let e=Vi(t);if(!e)return;let i=V.region;i||(i=t.createElement("div"),i.id=zi,i.setAttribute("role","status"),i.setAttribute("aria-live","polite"),i.setAttribute("aria-atomic","true"),i.setAttribute("style",Ni),V.region=i),i.parentNode!==e&&e.appendChild(i),i.textContent="",V.timer&&clearTimeout(V.timer),V.timer=setTimeout(()=>{V.timer=null,i.textContent=o},60)}function hi(o,t){return o?o.home!==t.home?"home":o.floor!==t.floor?"floor":null:null}function pi(o,t,e){let i=t==="theme"||t==="auto"?e(`theme_${t}`):t==="house"?e("style_house"):be(t)?.name??e(`style_${t}`),s=[e("announce_look",{look:i})];return o!==t&&o==="theme"&&s.push(e("announce_follow_ha_off")),o!==t&&o==="auto"&&s.push(e("announce_follow_sun_off")),s.join(". ")}var ci="home3d.phone_solo";function Ht(){try{let o=localStorage.getItem(ci);return o===null?null:o==="1"}catch{return null}}function Tt(o){try{localStorage.setItem(ci,o?"1":"0")}catch{}}function ui(o,t){return o??t===!0}function Rt(o){return o.phone&&o.solo&&o.roomId?[o.roomId]:o.rooms?.length?[...o.rooms]:null}function Qt(o){let t=/^#settings(?:\/([a-z0-9_]+))?(?:\/([^/?#]+))?\/?$/.exec(o);return t?{section:t[1]??null,id:t[2]?decodeURIComponent(t[2]):null}:null}function Xt(o){return o===""||o==="#"?"":o==="#editor"||o==="#extensions"||Qt(o)?o:null}function fi(o){return o==="#editor"?"editor":o==="#extensions"?"extensions":o.startsWith("#settings")?"settings":"view"}var Wi=(o,t,e)=>({start:o>1,end:o+e<t-1}),Ui=800,qi=(o,t)=>t-o<Ui,Ki=["pointerdown","keydown","wheel"],g={get(o){try{return localStorage.getItem(`home3d.${o}`)}catch{return null}},set(o,t){try{localStorage.setItem(`home3d.${o}`,t)}catch{}}},Zt=class extends tt{static properties={hass:{attribute:!1},narrow:{type:Boolean},route:{attribute:!1},panel:{attribute:!1},_mode:{state:!0},_viewOpen:{state:!0},_stylesOpen:{state:!0},_extFocus:{state:!0},_editorReady:{state:!0},_editorError:{state:!0},_floorId:{state:!0},_roomId:{state:!0},_shutRoom:{state:!0},_wallMode:{state:!0},_explode:{state:!0},_plan2d:{state:!0},_keepRoof:{state:!0},_quality:{state:!0},_stats:{state:!0},_markers:{state:!0},_pinSize:{state:!0},_heat:{state:!0},_theme:{state:!0},_zoomStyle:{state:!0},_zoomLate:{state:!0},_zoomScope:{state:!0},_clock:{state:!0},_clockLook:{state:!0},_furnish:{state:!0},_selFurniture:{state:!0},_selDevice:{state:!0},_floorStack:{state:!0},_roomNames:{state:!0},_hidden:{state:!0},_furnitureOn:{state:!0},_pulse:{state:!0},_controlsRight:{state:!0},_keepView:{state:!0},_floorPics:{state:!0},_angleLock:{state:!0},_windowSpill:{state:!0},_sunHeight:{state:!0},_clockWeather:{state:!0},_navButtons:{state:!0},_trail:{state:!0},_cameraWall:{state:!0},_clean:{state:!0},_roomsOpen:{state:!0},_phone:{state:!0},_solo:{state:!0},_phoneAsk:{state:!0},_nowMode:{state:!0},_findOpen:{state:!0},_noticesHidden:{state:!0},_accent:{state:!0},_weather:{state:!0},_flows:{state:!0},_holos:{state:!0},_doorPins:{state:!0},_vacuumMaps:{state:!0},_director:{state:!0},_micProbe:{state:!0},_voiceHere:{state:!0},_screen:{state:!0},_tablet:{state:!0},_settingsReady:{state:!0},_settingsError:{state:!0},_settingsAt:{state:!0}};rawHass;hassWatch=new ht({entityLists:!1});shownHass;get hass(){let t=this.rawHass;return t&&this.hassWatch.recording?this.hassWatch.wrap(t):t}set hass(t){this.rawHass=t}link=de(typeof location>"u"?"":location.search);nowLinked=!!this.link?.now;nowLinkOpen=!!this.link?.now;linkFollowed=!this.link?.room&&!this.link?.show;settingsFrom="view";lastView=null;data=new st(this);undoHistory=new St;locateLab=null;tt=new N(this);ttLinked=!1;idle=new kt(()=>this.returnHome());onTouch=()=>this.idle.touch();idleSeconds=0;touchesHeard=!1;constructor(){super(),this.narrow=!1,this._mode="view",this._viewOpen=!1,this._stylesOpen=!1,this._extFocus=null,this._editorReady=!!customElements.get("fp3d-editor"),this._editorError=null,this._floorId=null,this._roomId=null,this._shutRoom=null,this._nowMode="bar",this.readPrefs(),this._phoneAsk=g.get("phone_view")===null&&typeof screen<"u"&&ae(screen.width,screen.height,navigator.maxTouchPoints??0),this._furnish=!1,this._selFurniture=null,this._selDevice=null,this._cameraWall=!1,this._micProbe=!1,this._tablet=!1,this._roomsOpen=!1,this._findOpen=!1,this._noticesHidden="",this._settingsReady=!!customElements.get("fp3d-settings-page"),this._settingsError=null;let t=Qt(location.hash);this._settingsAt=t??{section:null,id:null},this._mode=fi(Xt(location.hash)??"")}readPrefs(){this._wallMode=g.get("walls")==="cut"?"cut":"auto",this._explode=g.get("explode")!=="0";let t=new URLSearchParams(location.search).get("view");this._plan2d=t==="2d"||t!=="3d"&&g.get("plan2d")==="1",this._keepRoof=g.get("roof")==="1";let e=g.get("quality");this._quality=e==="low"||e==="high"?e:"auto",this._stats=g.get("stats")==="1"||new URLSearchParams(location.search).has("fp3d_stats");let i=g.get("markers");this._markers=i==="none"||i==="all"||i==="room"?i:"important";let s=g.get("pinSize");this._pinSize=s==="small"||s==="large"?s:"normal";let n=g.get("heat");this._heat=n==="temperature"||n==="humidity"||n==="co2"||n==="values"?n:"none",this._theme=P(g.get("theme")),this._zoomStyle=g.get("zoom_style")??"",this._zoomLate=Math.round(Ee(g.get("zoom_late"))*100),this._zoomScope=g.get("zoom_scope")==="room"?"room":"all";let r=g.get("clock");this._clockLook=Pe(p=>g.get(p)),this._clock=r==="tl"||r==="tr"||r==="bl"||r==="br"?r:"off";let a=g.get("accent");this._accent=a&&/^#[0-9a-f]{6}$/i.test(a)?a:null;let d=g.get("floor_stack");this._floorStack=d==="stacked"||d==="single"?d:"dim";let h=Re(g.get(He),g.get("room_names"),g.get(Te));(!this._hidden||Ct(h)!==Ct(this._hidden))&&(this._hidden=h),this._roomNames=!this._hidden.has("room_names"),this._furnitureOn=!0,this._pulse=g.get("pulse")!=="0",this._controlsRight=g.get("controls")==="right",this._keepView=g.get("keep_view")==="1",this._floorPics=g.get("floor_pictures")==="1",this._phone=g.get("phone_view")==="1",this._solo=Ht()===!0,this._angleLock=g.get("angle_lock")==="1",this._windowSpill=g.get("window_spill")==="1",this._clockWeather=g.get("clock_weather")!=="0";let c=g.get("sun_height");this._sunHeight=c==="high"||c==="real"?c:"auto",this._navButtons=g.get("nav")==="1",this._trail=g.get("trail")==="1",this._clean=g.get("clean")==="1",this._weather=g.get("weather")!=="0",this._flows=g.get("flows")==="1",this._holos=g.get("holos")!=="0",this._doorPins=g.get("door_pins")==="1",this._vacuumMaps=g.get("vacuum_maps")!=="0",this._director=Wt(),this._voiceHere=Dt(),this._screen=zt(),$e(g.get("language")),Me(g.get("time_format")),this.hass&&!F(this.hass.language)&&j(this.hass.language,this.hass).then(()=>this.requestUpdate())}t(t,e){return E(this.hass,t,e)}shouldUpdate(t){let e=t.get("hass"),i=this.rawHass;if(t.size!==1||!t.has("hass")||!e||!i||this.tt.active||this.hassWatch.matters(e,i))return!0;this.takeHass(i);let s=this.shownHass,n=s&&this.viewHass(i,this.data.building);return s&&n&&X(s)!==X(n)?!0:(ct(this.renderRoot,pt["panel.ts"],[[e,i],[s,n]]),this.shownHass=n,!1)}update(t){this.hassWatch.begin();try{super.update(t)}finally{this.hassWatch.end()}}takeHass(t){this.homeRestored||this.restoreHome(),this.data.setHass(t),this.tt.session?.setLive(t)}viewHass(t,e){return It(this.tt.hass(t),e)}willUpdate(t){t.has("_roomId")&&this._shutRoom!==this._roomId&&(this._shutRoom=null),t.has("hass")&&this.rawHass&&this.takeHass(this.rawHass),t.has("hass")&&this.hass&&!F(this.hass.language)&&j(this.hass.language,this.hass).then(()=>this.requestUpdate());let e=this.data.building;this.followTablet(e),e&&!this.data.canEdit&&this.data.home!==void 0&&this.openHome(void 0),e!==this.seenBuilding&&this.dropStaleSelection(e)}homeRestored=!1;get homeKey(){return`home.${this.hass?.user?.id??""}`}restoreHome(){this.homeRestored=!0;let t=g.get(this.homeKey);!t||jt(location.search,this.hass?.user?.id,void 0)||(this.data.onHomeGone=()=>g.set(this.homeKey,""),this.data.openRemembered(t))}openHome(t){g.set(this.homeKey,t??""),this.data.setHome(t)}seenBuilding=null;seenHome=null;dropStaleSelection(t){if(this.seenBuilding=t,!t)return;let e=this.data.homeId;this.seenHome!==null&&e!==this.seenHome&&(this._floorId=null,this._roomId=null,this._selFurniture=null,this._selDevice=null),this.seenHome=e,this._floorId&&!t.floors.some(i=>i.id===this._floorId)&&(this._floorId=null,this._roomId=null),this._roomId&&!t.floors.some(i=>R(i).some(s=>s.id===this._roomId))&&(this._roomId=null),this._selFurniture&&!t.floors.some(i=>i.furniture.some(s=>s.id===this._selFurniture))&&(this._selFurniture=null)}followTablet(t){let e=location.search,i=jt(e,this.hass?.user?.id,t?.settings.tablet_users);i&&this._mode!=="view"&&this.setMode("view","replace"),i&&this.data.home!==void 0&&this.data.setHome(void 0),i!==this._tablet&&(this._tablet=i,this._viewOpen=!1);let s=i?ni(e,t?.settings.tablet_idle):0;(s!==this.idleSeconds||i!==this.touchesHeard)&&(this.listenTouches(i),this.idleSeconds=s,this.idle.arm(s))}listenTouches(t){if(t!==this.touchesHeard){this.touchesHeard=t;for(let e of Ki)t?window.addEventListener(e,this.onTouch,{capture:!0,passive:!0}):window.removeEventListener(e,this.onTouch,{capture:!0});t||(this.idle.stop(),this.idleSeconds=0)}}returnHome(){this.tt.stop(),this._roomId=null,this._floorId=null,this._viewOpen=!1,this._cameraWall=!1,this.view3d()?.resetView()}get canEdit(){return this.data.canEdit}async loadSample(){try{let t=await pe(this.hass);this.openHome(t.home.id)}catch(t){await ke(this.t("home_failed",{error:String(t?.message??t)}),{ok:this.t("ask_ok")})}}setMode(t,e="push"){t===this._mode||this._tablet&&t!=="view"||(this._mode==="view"&&(this.lastView=this.view3d()?.currentView()??this.lastView),this.tt.stop(),this._editorError=null,e!=="none"&&bt(this.pageNow(t),e==="push"),this._viewOpen=!1,this.setStylesOpen(!1),this._roomsOpen=!1,this._findOpen=!1,t==="view"&&this.data.flush(),t==="settings"&&(this.settingsFrom=this._mode),t!=="extensions"&&(this._extFocus=null),this._mode=t)}settingsLink(t,e){return`#settings${t?`/${t}${e?`/${encodeURIComponent(e)}`:""}`:""}`}pageNow(t=this._mode){return t==="view"?"":t==="settings"?this.settingsLink(this._settingsAt.section,this._settingsAt.id):`#${t}`}showPage=t=>{let e=fi(t);e==="settings"&&(this._settingsAt=Qt(t)??{section:null,id:null},!this._settingsAt.section&&!this._settingsAt.id&&this.settingsKey++),this.setMode(e,"none")};navRelease=null;settingsKey=0;openSettings(t=null,e=null){this._tablet||(this._settingsAt={section:t,id:e},this._mode==="settings"?bt(this.pageNow()):this.setMode("settings"))}onOpenSettings=t=>{let e=t.detail??{};t.stopPropagation(),t.preventDefault(),this.openSettings(e.section??null,e.id??null)};onOpenExtensions=t=>{t.stopPropagation(),t.preventDefault(),this.canEdit&&this.setMode("extensions")};onHash=()=>je();settingsAction(t){let{action:e}=t.detail;if(e==="extensions")this._extFocus=t.detail.focus??oi(t.detail.id),this.setMode("extensions");else if(e==="editor")this.setMode("editor");else if(e==="kerb")this.openBinKerb();else if(e==="mic_probe")Bt().then(()=>this._micProbe=!0).catch(()=>{});else if(e==="locate"&&this.hass&&this.data.building){let i=this.data.building;yt().then(s=>s.openLocateSetup(this.hass,i,()=>this.hass,n=>{let r=this.data.building;r&&this.editPlan({...r,settings:{...r.settings,person_look:n==="figure"?null:n}})}))}}openBinKerb(){let t=this.data.building?.floors.flatMap(e=>e.furniture).find(e=>e.type==="waste_bin");this.setMode("editor"),t&&z().then(async()=>{this._editorReady=!0,await this.updateComplete;let e=this.renderRoot.querySelector("fp3d-editor");await e?.updateComplete,e?.goToFurniture(t.id)},()=>{})}onPlanChange(t){t.preventDefault(),this.updatePlan(t.detail.change)}updatePlan(t){let e=this.data.building;if(!e)return;let i=structuredClone(e);t(i),this.undoHistory.record(e,i,this.data.homeId),this.data.update(t),this.data.building&&this.undoHistory.track(this.data.building)}onRoomTap(t){let{floorId:e,roomId:i}=t.detail;if((this.data.building?.floors.length??0)>1&&e&&this._floorId!==e){this._floorId=e,this._roomId=null;return}if(i){if(i===this._roomId&&this._shutRoom===i){this._shutRoom=null;return}this._roomId=i===this._roomId?null:i}}get phoneOn(){return(this._phone||this.nowLinked)&&!this._tablet&&this.pageBehind==="view"}get pageBehind(){return this._mode!=="settings"||this._tablet?this._mode:this.settingsFrom==="settings"?"view":this.settingsFrom}followLink(){let t=this.link,e=this.data.building;if(this.linkFollowed||!t||!e||this._mode!=="view"||!this.view3d())return;this.linkFollowed=!0;let i=t.room?he(e.floors.map(n=>({id:n.id,rooms:R(n)})),t.room):null;i&&(this._floorId=i.floorId,this._roomId=i.roomId,this._shutRoom=null);let s=t.show;s&&setTimeout(()=>this.view3d()?.showNow({entity:s}),1200)}phoneShell(){return this.renderRoot?.querySelector("fp3d-phone-shell")??null}setPhone(t){this._phone=t,this._phoneAsk=!1,this._nowMode="bar",t||(this.nowLinked=!1),g.set("phone_view",t?"1":"0")}phoneExtras(t){return[{id:"view",icon:"\u25D0",label:this.t("view_btn")},...this.hasCameras(t)?[{id:"cameras",icon:"\u{1F4F7}",label:this.t("cameras_short")}]:[],{id:"tt",icon:"\u23EA",label:this.t("tt_chip")},{id:"settings",icon:"\u2699",label:this.t("settings")},{id:"menu",icon:"\u2630",label:"Home Assistant"},{id:"off",icon:"\u{1F4F1}",label:this.t("nav_off")}]}phoneMore(t){t==="view"?(k(G),this.setViewOpen(!0)):t==="cameras"?this._cameraWall=!0:t==="tt"?this.toggleTimeTravel():t==="settings"?this.openSettings():t==="menu"?this.dispatchEvent(new CustomEvent("hass-toggle-menu",{bubbles:!0,composed:!0})):t==="off"&&this.setPhone(!1)}get roomPanelShown(){return!!this._roomId&&this._shutRoom!==this._roomId}setPlan2d(t){this._plan2d=t,g.set("plan2d",t?"1":"0")}onViewChange(t){let e=this._theme;this.readPrefs(),t.detail?.id==="theme"&&e!==this._theme&&Et(pi(e,this._theme,(i,s)=>this.t(i,s)))}setViewOpen(t,e=!1){this._viewOpen=t,!t&&e&&this.updateComplete.then(()=>this.renderRoot?.querySelector(".fp3d-view-btn")?.focus())}setStylesOpen(t){t!==this._stylesOpen&&(this._stylesOpen=t,t||this.renderRoot?.querySelector("fp3d-view3d")?.previewStyle?.(null))}hasCameras(t){return t.floors.some(e=>e.placements.some(i=>it(i.entity_id)==="camera"))}viewContext(t){return{floors:t.floors.length,floorOpen:!!this._floorId,roof:t.settings.roof.type!=="none",plan2d:this._plan2d,kiosk:this._tablet,vacuums:!!t.settings.vacuum_maps?.length}}editPlan(t,e=null){let i=this.data.building;i&&this.undoHistory.record(i,t,this.data.homeId,e),this.data.edit(t)}editFurniture(t,e,i=null){let s=this.data.building;if(!s)return;let n=structuredClone(s);for(let r of n.floors){let a=r.furniture.find(d=>d.id===t);a&&e(a,r)}this.editPlan(n,i)}editDevice(t,e,i=null){let s=this.data.building;if(!s)return;let n=structuredClone(s);for(let r of n.floors){let a=r.placements.find(d=>d.entity_id===t);a&&e(a,r)}this.editPlan(n,i)}moveDevice(t){let{id:e,x:i,z:s}=t.detail;this.editDevice(e,(n,r)=>{let[a,d]=Vt(r,n.x,n.z,i,s);Object.assign(n,{x:a,z:d})},`move:${e}`)}turnStep(){return it(this._selDevice??"")==="camera"?15:45}turnDevice(t){this._selDevice&&this.editDevice(this._selDevice,e=>e.rotation=(((e.rotation??0)+t)%360+360)%360)}deleteDevice(){let t=this._selDevice,e=this.data.building;if(!t||!e)return;let i=structuredClone(e);for(let s of i.floors)s.placements=s.placements.filter(n=>n.entity_id!==t);this.editPlan(i),this._selDevice=null}renderDeviceFields(t){let i=this.data.building?.floors.find(m=>m.placements.some(v=>v.entity_id===t)),s=i?.placements.find(m=>m.entity_id===t);if(!i||!s)return u;let n=it(t),r=n==="light",a=n==="camera",d=s.mount==="ceiling",h=n?ge(n,i.height,r||a?s.mount??(a?"wall":"ceiling"):null):1,c=wt(this.hass,this.data.building?.settings.units),p=c==="imperial",_=m=>p?Ut(m):String(Math.round(m*100)/100),I=m=>p?qt(m,"imperial"):parseFloat(m.replace(",",".")),$=(m,v,H,x,T,S,C=!1)=>l`<label class="fp3d-size" title=${C?Y(m,c):m}
        >${C?Y(m,c):m}
        <input
          type=${C&&p?"text":"number"}
          inputmode="decimal"
          step=${H}
          min=${x}
          max=${T}
          .value=${C?_(v):String(Math.round(v*100)/100)}
          @change=${W=>{let f=C?I(W.target.value):parseFloat(W.target.value.replace(",","."));f!==null&&Number.isFinite(f)&&S(Math.min(T,Math.max(x,f)))}}
        />
      </label>`;return l`${r?l`<select class="fp3d-size-select" title=${this.t("lamp_mount")} @change=${m=>this.editDevice(t,v=>Object.assign(v,{mount:m.target.value,y:null}))}>
            ${["ceiling","floor","table","wall"].map(m=>l`<option value=${m} ?selected=${m===(s.mount??"ceiling")}>${this.t(`lamp_${m}`)}</option>`)}
          </select>`:u}
      ${a?l`<select class="fp3d-size-select" title=${this.t("camera_mount")} @change=${m=>this.editDevice(t,v=>Object.assign(v,{mount:m.target.value,y:null}))}>
              <option value="wall" ?selected=${!d}>${this.t("camera_mount_wall")}</option>
              <option value="ceiling" ?selected=${d}>${this.t("camera_mount_ceiling")}</option>
            </select>
            ${$(this.t("camera_fov_short"),s.fov??(d?360:90),5,10,360,m=>this.editDevice(t,v=>v.fov=m))}
            ${$(this.t("camera_reach_short"),s.reach??(d?3:4.5),.5,.5,50,m=>this.editDevice(t,v=>v.reach=m),!0)}
            ${$(this.t("camera_tilt_short"),s.tilt??(d?65:20),5,0,90,m=>this.editDevice(t,v=>v.tilt=m))}`:u}
      <label class="fp3d-size" title=${Y(this.t("marker_height"),c)}
        >${this.t("size_short_h")}
        <input
          type=${p?"text":"number"}
          inputmode="decimal"
          step="0.05"
          min="0"
          .value=${_(s.y??h)}
          @change=${m=>{let v=I(m.target.value);v!==null&&Number.isFinite(v)&&v>=0&&this.editDevice(t,H=>H.y=Math.round(v*1e3)/1e3)}}
        />
      </label>
      ${s.y!==null?l`<button class="fp3d-chip" @click=${()=>this.editDevice(t,m=>m.y=null)}>${this.t("height_auto")}</button>`:u}`}furnitureName(t){let e=this.data.building?.floors.flatMap(i=>i.furniture).find(i=>i.id===t);return e?ze(this.hass,e.type):""}moveFurniture(t){let{id:e,x:i,z:s}=t.detail,n=this.data.building?.settings.wall_interior??.12;this.editFurniture(e,(r,a)=>{let[d,h]=Vt(a,r.x,r.z,i,s);Object.assign(r,{x:d,z:h});let c=qe(a,r,n);c&&Object.assign(r,c)},`move:${e}`)}renderSizeFields(t){let e=this.data.building?.floors.flatMap(d=>d.furniture).find(d=>d.id===t);if(!e)return u;let i=wt(this.hass,this.data.building?.settings.units)==="imperial",s=d=>i?Ut(d):String(Math.round(d*100)/100),n=d=>i?qt(d,"imperial"):parseFloat(d.replace(",",".")),r=(d,h)=>l`<label class="fp3d-size" title=${this.t(`size_${d}`)}
      >${h}
      <input
        type=${i?"text":"number"}
        inputmode="decimal"
        step="0.05"
        min="0.05"
        .value=${s(e[d])}
        @change=${c=>{let p=n(c.target.value)??NaN;Number.isFinite(p)&&p>0&&this.editFurniture(t,_=>_[d]=Math.round(p*1e3)/1e3)}}
    /></label>`,a=this.data.building?.floors.find(d=>d.furniture.some(h=>h.id===t));return l`${r("w",this.t("size_short_w"))}${r("d",this.t("size_short_d"))}${r("h",this.t("size_short_h"))}
    ${a&&fe(e)?l`<label class="fp3d-size" title=${Y(this.t("mount_height"),wt(this.hass,this.data.building?.settings.units))}
            >↕
            <input
              type=${i?"text":"number"}
              inputmode="decimal"
              step="0.05"
              min="0"
              .value=${s(e.mount_y??ue(a,e))}
              @change=${d=>{let h=n(d.target.value)??NaN;Number.isFinite(h)&&h>=0&&this.editFurniture(t,c=>c.mount_y=Math.round(h*1e3)/1e3)}}
          /></label>
          ${e.mount_y!=null?l`<button class="fp3d-chip" @click=${()=>this.editFurniture(t,d=>d.mount_y=null)}>${this.t("height_auto")}</button>`:u}`:u}`}turnFurniture(t){this._selFurniture&&this.editFurniture(this._selFurniture,e=>e.rotation=((e.rotation+t)%360+360)%360)}deleteFurniture(){let t=this._selFurniture,e=this.data.building;if(!t||!e)return;let i=structuredClone(e);for(let s of i.floors)s.furniture=s.furniture.filter(n=>n.id!==t);this.editPlan(i),this._selFurniture=null}view3d(){return xt(this.renderRoot)}toggleTimeTravel(t=null){if(this.tt.active){this.tt.stop();return}let e=this.view3d(),i=this.data.building;!e||!i||!this.hass||(this._furnish=!1,this._cameraWall=!1,this.tt.start({live:this.hass,building:i,spec:e.historyEntities(),quality:this._quality,at:t,t:(s,n)=>E(this.hass,s,n)}))}announcedView=null;announceView(){let t=this.data.building;if(!t)return;let e={home:this.data.homeId,floor:this._floorId},i=hi(this.announcedView,e);this.announcedView=e,i==="home"?Et(this.t("announce_home",{name:this.data.homeName??"Home 3D"})):i==="floor"&&Et(e.floor?this.t("announce_floor",{name:t.floors.find(s=>s.id===e.floor)?.name??""}):this.t("all_floors"))}backLayers=new Ge("panel");syncBack(t){let e=[],i=(r,...a)=>t.has(r)&&e.push(a);i("_viewOpen","view",this._viewOpen&&this._mode==="view",()=>this.setViewOpen(!1,!0),()=>this.setViewOpen(!0)),i("_roomsOpen","rooms",this._roomsOpen,()=>this._roomsOpen=!1,()=>this._roomsOpen=!0),i("_findOpen","find",this._findOpen,()=>this._findOpen=!1,()=>this._findOpen=!0),i("_cameraWall","cameras",this._cameraWall&&this._mode==="view",()=>this._cameraWall=!1,()=>this._cameraWall=!0),i("_micProbe","mic",this._micProbe,()=>(this._micProbe=!1,Nt()));let s=this._floorId,n=this._roomId;i("_floorId","floor",!!s&&(this.data.building?.floors.length??0)>1,()=>(this._roomId=null,this._floorId=null),s?()=>this._floorId=s:void 0),i("_roomId","room",!!n,()=>this._roomId=null,n?()=>this._roomId=n:void 0),this.backLayers.syncAll(e)}updated(t){this.announceView(),this.syncBack(t),(t.has("_floorId")||t.has("_roomId"))&&(this.navScroll=!0),this.navFrame||(this.navFrame=requestAnimationFrame(()=>{if(this.navFrame=0,this.navScroll){this.navScroll=!1;let n=this.renderRoot.querySelector(".fp3d-floors [aria-pressed='true']"),r=n?.parentElement;n&&r&&r.scrollWidth>r.clientWidth&&n.scrollIntoView?.({block:"nearest",inline:"nearest"})}this.markNavEdges()}));let e=nt(this.hass);this.getAttribute("lang")!==e&&this.setAttribute("lang",e);let i=ut(this._theme,this.hass,this.data.building?.settings);if(this.toggleAttribute("light",rt(i)),this.toggleAttribute("contrast",at(i)),!this.locateLab&&this.hass?.user?.is_admin&&this.data.building&&Se()&&(this.locateLab=si(()=>({hass:this.hass,building:this.data.building}))),this.followLink(),this.ttLinked||!this.data.building||this._mode!=="view"||!this.view3d())return;this.ttLinked=!0;let s=new URLSearchParams(location.search).get("tt");s!==null&&this.toggleTimeTravel(s)}back(){this.view3d()?.endWalk()||(this._roomId?this._roomId=null:this._floorId&&(this.data.building?.floors.length??0)>1?this._floorId=null:this.view3d()?.resetView())}onKey=t=>{if(!(t.key!=="Escape"||this._mode!=="view"))if(this._stylesOpen)this.setStylesOpen(!1);else if(this._viewOpen)this.setViewOpen(!1,!0);else{if(this.phoneOn&&this.phoneShell()?.close())return;this.tt.active?this.tt.stop():this.back()}};connectedCallback(){super.connectedCallback(),this._plan2d||_t(),typeof requestIdleCallback=="function"&&requestIdleCallback(()=>[0,1,2].forEach(e=>xe(this.hass,.5,e)),{timeout:2e3}),$t().then(()=>this.requestUpdate(),e=>console.error("Home 3D: the 3D view failed to load",e)),window.addEventListener("keydown",this.onKey);let t=Xt(location.hash);t&&this.showPage(t),this.navRelease=Ke(this.pageNow(),Xt,this.showPage),window.addEventListener("hashchange",this.onHash),window.addEventListener("location-changed",this.onHash),this.addEventListener("open-settings",this.onOpenSettings),this.addEventListener("open-extensions",this.onOpenExtensions)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey),window.removeEventListener("hashchange",this.onHash),window.removeEventListener("location-changed",this.onHash),this.removeEventListener("open-settings",this.onOpenSettings),this.removeEventListener("open-extensions",this.onOpenExtensions),this.listenTouches(!1),this.backLayers.closeAll(),this.navRelease?.(),this.navRelease=null,this.tt.stop(),this.locateLab?.(),this.locateLab=null}render(){if(this.hass&&!F(this.hass.language))return u;let t=this.data.building;this.canEdit&&this.hass&&k(Fe);let e=this.noticeList(this._clean&&this._mode==="view");return this.noticeKey=e.map(i=>i.key).join("|"),l`
      <div class="fp3d-app ${this._clean&&this._mode==="view"?"fp3d-clean":""}" style=${this.accentStyle()}>
        ${this._micProbe&&this.hass?l`<fp3d-mic-probe .hass=${this.rawHass} .building=${t} @close=${()=>(this._micProbe=!1,Nt())}></fp3d-mic-probe>`:u}
        ${(this._clean||this.phoneOn)&&this._mode==="view"?u:this._tablet?this.renderTabletHeader():this.renderHeader(e.length)}
        ${this.renderNotices(e)}
        ${this.data.error&&!t?l`<p class="fp3d-message">${this.t("load_error")}: ${this.data.error}</p>`:u}
        ${!t&&!this.data.error?l`<p class="fp3d-message">${this.t("loading")}</p>`:u}
        ${t?this.pageBehind==="editor"&&this.canEdit?this.renderEditor(t):this.pageBehind==="extensions"&&this.canEdit?this.renderExtensions():this.renderView(t):u}
        ${t&&this._mode==="settings"&&!this._tablet?this.renderSettings(t):u}
      </div>
    `}renderTabletHeader(){return l`<header class="fp3d-header fp3d-tablet-head"><h1>${this.data.homeName||"Home 3D"}</h1></header>`}shownAccent(){return ft(this._theme,this._accent,this.hass,t=>getComputedStyle(this).getPropertyValue(t))}accentStyle(){return mt(this.shownAccent())}renderHeader(t){let e=(i,s,n,r,a,d)=>l`<button class="fp3d-tab ${s}" aria-current=${this._mode===i?"page":u} aria-label=${r} title=${a===null?r:u} @click=${d}>
        ${L(n)}<span class="fp3d-tab-word">${r}</span>${a?l`<span class="fp3d-tab-short" aria-hidden="true">${a}</span>`:u}
      </button>`;return l`<header class="fp3d-header">
      <ha-menu-button .hass=${this.rawHass} .narrow=${this.narrow}></ha-menu-button>
      <h1>Home 3D</h1>
      ${this.canEdit&&this.hass?l`<fp3d-home-switcher
            .hass=${this.rawHass}
            .home=${this.data.homeId}
            @home-settings=${()=>this.openSettings("homes","homes")}
            @home-open=${i=>this.openHome(i.detail.home??void 0)}
          ></fp3d-home-switcher>`:u}
      <nav class="fp3d-tabs" aria-label=${this.t("modes")}>
        ${e("view","fp3d-tab-view","cube",this.t("view"),"",()=>this.setMode("view"))}
        ${this.canEdit?l`${e("editor","fp3d-tab-editor","pencil",this.t("editor"),this.t("editor_short"),()=>this.setMode("editor"))}
            ${e("extensions","fp3d-tab-ext","puzzle",this.t("ext_tab"),null,()=>this.setMode("extensions"))}`:u}
        ${e("settings","fp3d-tab-settings","gear",this.t("settings"),null,()=>this.openSettings())}
      </nav>
      <span class="fp3d-grow"></span>
      ${this.renderSaveLine(t)}
    </header>`}renderSaveLine(t){let e=this.data.saveState,i=e==="idle"||this._mode==="settings"?"":this.t(e==="saving"?"saving":e==="saved"?"st_saved_home":"save_error"),s=t>0&&this._noticesHidden!==this.noticeKey;return l`<span class="fp3d-save fp3d-save-${i?e:"idle"}" role="status" aria-live="polite">
        ${i?l`<span class="fp3d-save-dot" aria-hidden="true"></span><span class="fp3d-save-text">${i}</span>`:u}
      </span>
      ${t?l`<button
            class="fp3d-note-badge"
            aria-expanded=${s?"true":"false"}
            aria-label=${this.t("notices_badge",{n:t})}
            title=${this.t("notices_badge",{n:t})}
            @click=${()=>this._noticesHidden=s?this.noticeKey:""}
          >
            <span>${t}</span>
          </button>`:u}`}noticeKey="";noticeList(t){let e=this.data,i=[],s=this.renderUpdateNotice();if(s&&i.push({key:`update:${e.updateNotice}`,body:s}),t)return i;e.needsRestart&&e.versionGap!=="frontend"&&i.push({key:"restart",body:l`<div class="fp3d-notice fp3d-notice-warn"><span>${e.backendVersion?this.t("needs_restart",{version:e.backendVersion,frontend:e.frontendVersion}):this.t("needs_restart_old")}</span></div>`});let n=e.planProblem;if(n&&!this._tablet){let r=n.code==="plan_repaired"?this.t("plan_repaired",{parts:(n.dropped??[]).length}):n.code==="plan_too_new"?this.t("plan_too_new"):this.t("plan_invalid",{error:n.message});i.push({key:`plan:${n.code}`,body:l`<div class="fp3d-notice fp3d-notice-${n.code==="plan_repaired"?"warn":"error"}" role="status"><span>${r}</span></div>`})}if(e.saveState==="error"&&e.saveError&&i.push({key:"save",body:l`<div class="fp3d-notice fp3d-notice-error"><span>${this.t("save_failed_detail",{error:e.saveError})}</span></div>`}),e.draft&&this.canEdit&&!this._tablet){let r=Le(e.draft.savedAt,Ce(this.hass)),a=e.draftNewer,d=e.draft.home?a?"draft_found_newer":"draft_found":"draft_found_old";i.push({key:`draft:${e.draft.savedAt}`,body:l`<div class="fp3d-notice">
          <span>${e.conflict?this.t("save_conflict"):this.t(d,{time:r})}</span>
          <button class="fp3d-btn fp3d-primary" @click=${()=>{e.restoreDraft()}}>${this.t(e.conflict?"draft_restore_conflict":a?"draft_restore_newer":"draft_restore")}</button>
          <button class="fp3d-btn" @click=${()=>e.discardDraft()}>${this.t("draft_discard")}</button>
        </div>`})}return i}noticeShownAt=0;noticeShownKey="";renderNotices(t){return!t.length||this._noticesHidden===this.noticeKey?(this.noticeShownKey="",u):(this.noticeShownKey!==this.noticeKey&&(this.noticeShownKey=this.noticeKey,this.noticeShownAt=performance.now()),l`<div class="fp3d-notices" role="region" aria-label=${this.t("notices")} @click=${{handleEvent:e=>this.guardNoticeTap(e),capture:!0}}>
      <div class="fp3d-notices-list">${t.map(e=>e.body)}</div>
      <button class="fp3d-btn fp3d-notices-hide" @click=${()=>this._noticesHidden=this.noticeKey}>${this.t("notices_hide")}</button>
    </div>`)}guardNoticeTap(t){qi(this.noticeShownAt,performance.now())&&(t.stopPropagation(),t.preventDefault())}renderUpdateNotice(){let t=this.data,e=t.updateNotice;if(!e)return null;let i=t.backendVersion!==t.frontendVersion?this.t("needs_reload",{frontend:t.frontendVersion,backend:t.backendVersion??"?"}):this.t("update_ready");return l`<div class="fp3d-notice fp3d-notice-warn fp3d-notice-update" role="status">
      <span>${i}${e==="ready"?u:l` ${this.t(e==="saving"?"update_saving":"update_unsaved")}`}</span>
      <button class="fp3d-btn" ?disabled=${e==="unsaved"} @click=${()=>{t.reloadWhenSaved()}}>${this.t("reload_page")}</button>
    </div>`}editorPending(){return this._editorReady?null:this._editorError?l`<div class="fp3d-empty"><p>${this.t("load_error")}: ${this._editorError}</p></div>`:(z().then(()=>this._editorReady=!0,t=>this._editorError=String(t)),l`<div class="fp3d-empty"><p>${this.t("loading")}</p></div>`)}renderExtensions(){this.data.loadLibrary();let t=this.editorPending();return t||(customElements.get("fp3d-extensions")?l`<fp3d-extensions
      class="fp3d-body"
      .hass=${this.rawHass}
      .canEdit=${this.data.canEdit}
      .packs=${this.data.packs}
      .building=${this.data.building}
      .card=${this._extFocus}
      @building-edit=${e=>this.editPlan(e.detail)}
      @packs-changed=${()=>{this.data.reloadPacks()}}
    ></fp3d-extensions>`:(ei().then(()=>this.requestUpdate(),e=>console.error("Home 3D: the Extensions page failed to load",e)),l`<div class="fp3d-empty"><p>${this.t("loading")}</p></div>`))}renderSettings(t){return this._settingsReady?ti(this.settingsKey,l`<fp3d-settings-page
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
      .loadEditor=${z}
      .backTo=${this.settingsFrom==="settings"?"view":this.settingsFrom}
      .version=${this.versions()}
      @settings-back=${()=>this.setMode(this.settingsFrom==="settings"?"view":this.settingsFrom)}
      @settings-edit=${e=>this.editPlan(e.detail.building,e.detail.key)}
      @device-change=${()=>(this.readPrefs(),this.requestUpdate())}
      @settings-action=${this.settingsAction}
      @home-reload=${()=>{this.data.reopen()}}
      @home-open=${e=>this.openHome(e.detail.home??void 0)}
      @settings-nav=${e=>{this._settingsAt={section:e.detail.section,id:e.detail.id},bt(this.pageNow())}}
    ></fp3d-settings-page>`):this._settingsError?l`<div class="fp3d-empty fp3d-settings-wait"><p>${this.t("load_error")}: ${this._settingsError}</p></div>`:(ii().then(()=>this._settingsReady=!0,e=>this._settingsError=String(e)),l`<div class="fp3d-empty fp3d-settings-wait"><p>${this.t("loading")}</p></div>`)}versionsMemo;versions(){let t=String(this.data.frontendVersion),e=this.data.backendVersion??null;return(this.versionsMemo?.frontend!==t||this.versionsMemo.backend!==e)&&(this.versionsMemo={frontend:t,backend:e}),this.versionsMemo}translator=(t,e)=>E(this.hass,t,e);renderEditor(t){this.data.loadLibrary();let e=this.editorPending();return e||l`<fp3d-editor
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
      @director-here=${()=>this._director=Wt()}
      @voice-here=${()=>{this._voiceHere=Dt(),this._screen=zt()}}
      @mic-probe=${()=>Bt().then(()=>this._micProbe=!0).catch(()=>{})}
      @open-extensions=${()=>this.setMode("extensions")}
      @load-sample=${()=>{this.loadSample()}}
      @building-changed=${i=>this.data.edit(i.detail.building)}
    ></fp3d-editor>`}async focusRoomPanel(){await this.updateComplete,await customElements.whenDefined("fp3d-room-panel"),await this.renderRoot.querySelector("fp3d-room-panel")?.focusHeading?.()}navFrame=0;navScroll=!1;markNavEdges=()=>{let t=this.renderRoot?.querySelector(".fp3d-floors");if(!t)return;let e=Wi(t.scrollLeft,t.scrollWidth,t.clientWidth);t.toggleAttribute("data-more-start",e.start),t.toggleAttribute("data-more-end",e.end)};onNavWheel=t=>{if(!t.deltaY||t.deltaX)return;let e=t.currentTarget;e.scrollWidth<=e.clientWidth||(e.scrollLeft+=t.deltaY,t.preventDefault())};renderFloorBar(t,e){let i=t.floors.length>1,s=r=>{this._floorId=r,this._roomId=null,this._roomsOpen=!1},n=this._roomId?t.floors.flatMap(r=>R(r)).find(r=>r.id===this._roomId):void 0;return l`<nav class="fp3d-nav" aria-label=${this.t("floors")}>
      ${i?l`<div class="fp3d-seg fp3d-floors" role="group" aria-label=${this.t("floors")} @wheel=${this.onNavWheel} @scroll=${this.markNavEdges}>
            <button aria-pressed=${this._floorId===null} @click=${()=>s(null)}>${this.t("all_floors")}</button>
            ${[...t.floors].reverse().map(r=>l`<button aria-pressed=${r.id===this._floorId} @click=${()=>s(r.id)}>${r.name}</button>`)}
          </div>
          <label class="fp3d-floor-pick ${this._floorId?"fp3d-floor-on":""}">
            <select aria-label=${this.t("floors")} @change=${r=>s(r.target.value||null)}>
              <option value="" ?selected=${this._floorId===null}>${this.t("all_floors")}</option>
              ${[...t.floors].reverse().map(r=>l`<option value=${r.id} ?selected=${r.id===this._floorId}>${r.name}</option>`)}
            </select>
            ${L("down")}
          </label>`:u}
      ${this._tablet?u:l`${i?l`<span class="fp3d-sep"></span>`:u}
            <div class="fp3d-rooms">
              <button
                class="fp3d-chip fp3d-rooms-btn ${n?"fp3d-rooms-on":""}"
                aria-haspopup="dialog"
                aria-expanded=${this._roomsOpen}
                aria-label=${n?this.t("rooms_open",{room:n.name}):this.t("rooms")}
                @pointerenter=${()=>k(gt)}
                @focus=${()=>k(gt)}
                @click=${()=>this._roomsOpen=!this._roomsOpen}
              >
                ${n?.name??this.t("rooms")} ${L("down")}
              </button>
              ${this._roomsOpen?(k(gt),l`<fp3d-rooms-picker
                    .groups=${this.roomGroups(t,e)}
                    .selected=${this._roomId}
                    .t=${this.translator}
                    .editFloor=${e&&this.canEdit?e.id:null}
                    .canHide=${this.canEdit}
                    @room-hide=${r=>this.hideRoom(r.detail.roomId,r.detail.hide)}
                    @room-pick=${r=>{i&&(this._floorId=r.detail.floorId),this._roomId=r.detail.roomId,this._shutRoom=null,this._roomsOpen=!1,this.focusRoomPanel()}}
                    @edit-floor=${r=>this.openInEditor(r.detail.floorId,null)}
                    @picker-close=${r=>this.closeRooms(!!r.detail?.focus)}
                  ></fp3d-rooms-picker>`):u}
            </div>`}
      ${this.renderFindBar(t)}
    </nav>`}renderFindBar(t){let e=this._findOpen,i=()=>{this._findOpen=!1,this.updateComplete.then(()=>this.renderRoot.querySelector(".fp3d-find-toggle")?.focus())};return l`<button
        class="fp3d-chip fp3d-find-toggle ${e?"fp3d-rooms-on":""}"
        title=${this.t("find")}
        aria-label=${this.t("find")}
        aria-expanded=${e}
        @pointerenter=${()=>k(Ot)}
        @click=${()=>e?i():this._findOpen=!0}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
      </button>
      ${e?(k(Ot),l`<fp3d-find
            variant="bar"
            .hass=${this.shownHass}
            .building=${t}
            @find-close=${i}
            @find-pick=${s=>{this._findOpen=!1,this.renderRoot.querySelector("fp3d-view3d")?.goTo(s.detail)}}
          ></fp3d-find>`):u}`}hideRoom(t,e){this.updatePlan(i=>{for(let s of i.floors)for(let n of s.rooms)n.id===t&&(e?n.hide_in_picker=!0:delete n.hide_in_picker)})}roomGroupsMemo=null;roomGroups(t,e){let i=this.roomGroupsMemo;if(i&&i.b===t&&i.floor===e)return i.groups;let n=(e?[e]:[...t.floors].reverse()).map(r=>({id:r.id,name:r.name,rooms:R(r).filter((a,d,h)=>a.name.trim()&&!(a.outdoor&&h.findIndex(c=>c.outdoor&&c.area_id===a.area_id&&c.name===a.name)<d)).map(a=>({id:a.id,name:a.name,hidden:a.hide_in_picker===!0}))})).filter(r=>r.rooms.length);return this.roomGroupsMemo={b:t,floor:e,groups:n},n}closeRooms(t){this._roomsOpen=!1,t&&this.updateComplete.then(()=>this.renderRoot.querySelector(".fp3d-rooms-btn")?.focus())}openInEditor(t,e){!this.canEdit||this._tablet||(this._roomsOpen=!1,this.setMode("editor"),z().then(async()=>{this._editorReady=!0,await this.updateComplete;let i=this.renderRoot.querySelector("fp3d-editor");await i?.updateComplete,i?.goToRoom(t,e)},()=>{}))}renderView(t){if(!t.floors.length||!t.floors.some(a=>a.rooms.length))return l`<div class="fp3d-empty">
        <p>${this.t(this.canEdit?"no_building_admin":"no_building")}</p>
        ${this.canEdit?l`<button class="fp3d-btn fp3d-primary" @click=${()=>this.setMode("editor")}>${this.t("open_editor")}</button>
              <button class="fp3d-btn" @click=${()=>{this.loadSample()}}>${this.t("home_sample")}</button>
              <p class="fp3d-phone-only">${this.t("phone_hint")}</p>`:u}
      </div>`;let e=t.floors.find(a=>a.id===this._floorId),i=this.tt.active,s=this.viewHass(this.rawHass,t);this.shownHass=s;let n=l`<div class="fp3d-seg" role="group" aria-label=${this.t("plan_view")}>
      <button aria-pressed=${!this._plan2d} @click=${()=>this.setPlan2d(!1)}>${this.t("view_3d")}</button>
      <button aria-pressed=${this._plan2d} @click=${()=>this.setPlan2d(!0)}>${this.t("view_2d")}</button>
    </div>`,r=this.phoneOn&&!i;return r&&k(vt),l`
      ${this._clean||r||this._tablet&&t.floors.length<2?u:this.renderFloorBar(t,e)}
      <div class="fp3d-stage-wrap ${r?`fp3d-phone fp3d-now-${this._nowMode}`:""} ${this.roomPanelShown?"fp3d-room-open":""} ${this._controlsRight?"fp3d-side-right":""} ${i?"fp3d-tt":""} ${this._cameraWall&&!i?"fp3d-cams-open":""}">
        <!-- the floor bar picks the floor: the floor pictures beside the 3D view are a second picker, shown when Settings
             › Screen and controls says so (#249, #250; the card keeps its own switch) -->
        <fp3d-view3d
          class="fp3d-body"
          .findInBar=${!(this._clean||r||this._tablet&&t.floors.length<2)}
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
          .clean=${this._clean||r}
          .cleanButton=${!r}
          .phoneView=${r}
          @status-change=${()=>r&&setTimeout(()=>this.phoneShell()?.requestUpdate(),0)}
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
          .rooms=${Rt({phone:r,solo:this._solo,roomId:this._roomId})}
          .wallMode=${this._wallMode}
          .explode=${this._explode}
          .keepRoof=${this._keepRoof}
          .markerMode=${this._markers}
          .pinSize=${this._pinSize}
          .heatMode=${this._heat}
          .theme=${this._theme}
          .zoomStyle=${this._zoomStyle||null}
          .zoomLate=${this._zoomLate}
          .zoomScope=${this._zoomScope}
          .clock=${this._clock}
          .clockLook=${this._clockLook}
          .clockWeather=${this._clockWeather}
          .accent=${this.shownAccent()}
          ?furnish=${this._furnish&&!i}
          .selectedFurniture=${this._selFurniture}
          @furniture-select=${a=>this._selFurniture=a.detail.id}
          @furniture-move=${this.moveFurniture}
          @device-select=${a=>this._selDevice=a.detail.id}
          @device-move=${this.moveDevice}
          .quality=${this._quality}
          ?showStats=${this._stats}
          @room-tap=${this.onRoomTap}
          @open-extensions=${()=>this.setMode("extensions")}
          @floor-tap=${a=>{this._floorId=a.detail.floorId,this._roomId=null}}
          @back=${()=>this.back()}
          @plan-change=${this.onPlanChange}
        ></fp3d-view3d>
        ${this.roomPanelShown&&!(r&&this._nowMode==="check")?(k(D),l`<fp3d-room-panel
              class="fp3d-room-panel"
              ?collapsible=${r}
              @camera-look=${a=>this.view3d()?.lookThrough(a.detail.entity)}
              .hass=${s}
              ?readOnly=${i}
              ?noLook=${this._plan2d}
              ?canEdit=${this.canEdit&&!this._tablet}
              @plan-change=${this.onPlanChange}
              .room=${t.floors.flatMap(a=>R(a)).find(a=>a.id===this._roomId)??null}
              .floor=${t.floors.find(a=>R(a).some(d=>d.id===this._roomId))??null}
              .building=${t}
              .confirmEntities=${ot(this.hass,t.floors)}
              .sheets=${this._roomId?this.view3d()?.roomSheets(this._roomId)??null:null}
              @sheet-open=${a=>this._roomId&&this.view3d()?.openRoomSheet(this._roomId,a.detail.id)}
              @close=${()=>this._shutRoom=this._roomId}
            ></fp3d-room-panel>`):u}
        ${r?l`<fp3d-phone-shell
              .hass=${s}
              .building=${t}
              .view=${()=>this.view3d()}
              .floorId=${this._floorId}
              .roomId=${this._roomId}
              .solo=${this._solo}
              @phone-solo=${a=>Tt(this._solo=a.detail)}
              .extras=${this.phoneExtras(t)}
              .start=${this.nowLinkOpen?"now":void 0}
              @phone-mode=${a=>{this._nowMode=a.detail,this.nowLinkOpen=!1}}
              @phone-room=${a=>{this._floorId=t.floors.length>1||a.detail.roomId?a.detail.floorId:null,this._roomId=a.detail.roomId,this._shutRoom=null}}
              @phone-more=${a=>this.phoneMore(a.detail)}
            ></fp3d-phone-shell>`:u}
        ${this._phoneAsk&&!i&&!this._tablet&&this._mode==="view"?l`<div class="fp3d-now-ask" role="dialog" aria-label=${this.t("st_phone_view")}>
              <span>${this.t("now_try")}</span>
              <button class="fp3d-chip" @click=${()=>this.setPhone(!0)}>${this.t("now_try_yes")}</button>
              <button class="fp3d-chip" @click=${()=>this.setPhone(!1)}>${this.t("now_try_no")}</button>
            </div>`:u}
        ${this.tt.session?l`<fp3d-time-bar .session=${this.tt.session} ?demo=${X(s)}></fp3d-time-bar>`:u}
        ${X(s)&&!this.tt.session?l`<div class="fp3d-demo-chip" title=${this.t("demo_hint")}>${this.t("demo_chip")}</div>`:u}
        ${this._clean||r?u:l`<div class="fp3d-overlay">
          ${this._tablet?u:n}
          ${this._tablet?u:l`<button class="fp3d-chip fp3d-plan-toggle" title=${this.t("plan_view")} aria-label=${`${this.t("plan_view")}: ${this.t(this._plan2d?"view_3d":"view_2d")}`} @click=${()=>this.setPlan2d(!this._plan2d)}>
                ${this.t(this._plan2d?"view_3d":"view_2d")}
              </button>`}
          <button
            class="fp3d-chip fp3d-view-btn"
            aria-haspopup="dialog"
            aria-expanded=${this._viewOpen}
            aria-controls="fp3d-view-panel"
            aria-label=${this.t("view_btn")}
            @pointerenter=${()=>k(G)}
            @focus=${()=>k(G)}
            @click=${()=>this.setViewOpen(!this._viewOpen)}
          >
            <span class="fp3d-bar-icon">${L("sliders")}</span><span class="fp3d-bar-word">${this.t("view_btn")}</span> <span class="fp3d-caret" aria-hidden="true">${this._viewOpen?"\u25B4":"\u25BE"}</span>
          </button>
          ${!i&&this.hasCameras(t)?l`<button class="fp3d-chip fp3d-cam-btn" aria-pressed=${this._cameraWall} aria-label=${this.t("cameras_short")} title=${this.t("camera_wall_hint")} @click=${()=>this._cameraWall=!this._cameraWall}>
                <span class="fp3d-bar-icon">${L("camera")}</span><span class="fp3d-bar-word">${this.t("cameras_short")}</span>
              </button>`:u}
          ${this._tablet?u:l`<button class="fp3d-chip fp3d-tt-chip" aria-pressed=${i} title=${this.t("tt_hint")} aria-label=${this.t("tt_chip")} @click=${()=>this.toggleTimeTravel()}>
            ⏪ <span class="fp3d-tt-label">${this.t("tt_chip")}</span>
          </button>`}
          ${this._roomId||this._floorId&&t.floors.length>1?l`<button class="fp3d-chip fp3d-back-btn" aria-label=${this.t("back")} @click=${()=>this.back()}><span class="fp3d-bar-icon">${L("back")}</span><span class="fp3d-bar-word">${this.t("back")}</span></button>`:u}
        </div>`}
        ${this._viewOpen&&!this._clean?(k(G),l`<fp3d-view-panel
              id="fp3d-view-panel"
              .hass=${this.rawHass}
              .context=${this.viewContext(t)}
              @view-change=${this.onViewChange}
              @styles-open=${()=>(this.setViewOpen(!1),this._stylesOpen=!0)}
              @view-close=${a=>this.setViewOpen(!1,!a.detail?.outside)}
              >${this._tablet?n:u}</fp3d-view-panel
            >`):u}
        ${this._stylesOpen&&!this._clean&&this._mode==="view"?(k(De),l`<fp3d-styles-dialog
              .hass=${this.rawHass}
              .styles=${t.settings.styles_custom}
              .canEdit=${this.canEdit}
              .current=${Ie(this._theme,this.hass,t.settings)}
              @view-change=${this.onViewChange}
              @styles-preview=${a=>this.view3d()?.previewStyle?.(a.detail.style)}
              @styles-change=${a=>this.editPlan({...t,settings:{...t.settings,styles_custom:a.detail.styles.length?a.detail.styles:null}},"styles_custom")}
              @styles-close=${()=>this.setStylesOpen(!1)}
            ></fp3d-styles-dialog>`):u}
        ${this._furnish?l`<div class="fp3d-furnish-bar">
              ${this._selFurniture?l`<span>${this.furnitureName(this._selFurniture)}</span>
                    ${this.renderSizeFields(this._selFurniture)}
                    <button class="fp3d-chip" @click=${()=>this.turnFurniture(-45)}>↺ 45°</button>
                    <button class="fp3d-chip" @click=${()=>this.turnFurniture(45)}>↻ 45°</button>
                    <button class="fp3d-chip" title=${this.t("furn_mirror_hint")} @click=${()=>this.editFurniture(this._selFurniture,a=>a.mirror=!a.mirror)}>⇋ ${this.t("furn_mirror")}</button>
                    <button class="fp3d-chip fp3d-danger-chip" @click=${()=>this.deleteFurniture()}>${this.t("delete")}</button>`:this._selDevice?l`<span>${me(this.hass,this._selDevice)}</span>
                      ${this.renderDeviceFields(this._selDevice)}
                      <button class="fp3d-chip" @click=${()=>this.turnDevice(-this.turnStep())}>↺ ${this.turnStep()}°</button>
                      <button class="fp3d-chip" @click=${()=>this.turnDevice(this.turnStep())}>↻ ${this.turnStep()}°</button>
                      <button class="fp3d-chip fp3d-danger-chip" @click=${()=>this.deleteDevice()}>${this.t("delete")}</button>`:l`<span>${this.t("furnish_hint")}</span>`}
              <button class="fp3d-chip fp3d-chip-on" @click=${()=>(this._furnish=!1,this._selFurniture=null,this._selDevice=null)}>${this.t("done")}</button>
            </div>`:u}
      </div>
    `}static styles=[lt,dt,Z`.fp3d-badge{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:#ffb547;color:#1a1204;font-size:0.78em;font-weight:700;line-height:1.5;box-shadow:0 0 10px rgba(255,181,71,0.7);vertical-align:middle;white-space:nowrap;animation:fp3d-badge-in 1.6s ease-out 2}@keyframes fp3d-badge-in{0%{box-shadow:0 0 0 0 rgba(255,181,71,0.9)}100%{box-shadow:0 0 0 10px rgba(255,181,71,0)}}:host{display:block;height:calc(100vh - var(--safe-area-inset-top,0px) - var(--safe-area-inset-bottom,0px));background:var(--fp3d-bg)}@supports (height:100dvh){:host{height:calc(100dvh - var(--safe-area-inset-top,0px) - var(--safe-area-inset-bottom,0px))}}.fp3d-app{position:relative;display:flex;flex-direction:column;height:100%;min-height:0}.fp3d-header{display:flex;align-items:center;gap:12px;padding:0 12px 0 4px;height:56px;box-sizing:border-box;border-bottom:1px solid var(--fp3d-line);background:var(--fp3d-chrome-solid);flex:none;min-width:0}.fp3d-tablet-head{padding-left:14px}fp3d-home-switcher{flex:0 1 auto;min-width:0}.fp3d-tabs{display:flex;align-self:stretch;gap:2px;flex:none}.fp3d-tab{font:inherit;display:inline-flex;align-items:center;gap:7px;padding:3px 12px 0;min-width:44px;justify-content:center;border:none;border-bottom:3px solid transparent;background:none;color:var(--fp3d-muted);font-weight:600;white-space:nowrap;cursor:pointer}.fp3d-tab:hover{color:var(--fp3d-text)}.fp3d-tab[aria-current="page"]{color:var(--fp3d-text);border-bottom-color:var(--fp3d-accent)}.fp3d-tab[aria-current="page"] .fp3d-ui-icon{color:var(--fp3d-accent)}.fp3d-tab:focus-visible{outline-offset:-2px}.fp3d-tab-short{display:none}.fp3d-save{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;min-width:0}.fp3d-save-dot{width:8px;height:8px;border-radius:50%;background:var(--fp3d-ok,#4ade80);flex:none}.fp3d-save-saving .fp3d-save-dot{background:var(--fp3d-muted)}.fp3d-save-error .fp3d-save-dot{background:var(--fp3d-danger)}.fp3d-note-badge{font:inherit;flex:none;display:inline-grid;place-items:center;min-width:32px;height:32px;padding:0;border:none;background:none;cursor:pointer}.fp3d-note-badge span{min-width:22px;height:22px;padding:0 6px;box-sizing:border-box;border-radius:999px;background:#ffb547;color:#1a1204;font-size:12px;font-weight:800;line-height:22px;text-align:center}ha-menu-button{color:var(--fp3d-text)}h1{font-family:var(--fp3d-title-font);font-weight:700;font-size:19px;letter-spacing:-0.01em;margin:0 4px 0 8px;white-space:nowrap}.fp3d-notices{flex:none;display:flex;align-items:flex-start;gap:8px;padding:6px 12px;border-bottom:1px solid var(--fp3d-line);background:var(--fp3d-chrome-solid)}.fp3d-notices-list{flex:1;min-width:0;display:grid;gap:6px}.fp3d-notices-hide{flex:none}.fp3d-notices .fp3d-notice{flex-wrap:nowrap;padding:0 0 0 10px;border:0;border-left:3px solid var(--fp3d-line);border-radius:0;background:none}.fp3d-notices .fp3d-notice span{min-width:0}.fp3d-notices .fp3d-notice-warn{border-left-color:rgba(255,181,71,0.8)}.fp3d-notices .fp3d-notice-error{border-left-color:rgba(255,107,139,0.8)}.fp3d-notice{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:9px 12px;border-radius:10px;border:1px solid var(--fp3d-line);background:var(--fp3d-chrome-solid);font-size:13.5px}.fp3d-notice span{flex:1;min-width:200px}.fp3d-notice-warn{border-color:rgba(255,181,71,0.6);color:var(--fp3d-warm)}.fp3d-notice-error{border-color:rgba(255,107,139,0.6);color:var(--fp3d-danger);word-break:break-word}.fp3d-chip-on{background:var(--fp3d-primary);color:var(--fp3d-primary-text)}.fp3d-furnish-bar{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;max-width:calc(100% - 24px);padding:8px 10px 8px 16px;border-radius:999px;background:var(--fp3d-chrome);box-shadow:var(--fp3d-shadow);font-size:13.5px}.fp3d-size-select{font:inherit;color:var(--fp3d-text);background:var(--fp3d-chrome-solid);border:1px solid var(--fp3d-line);border-radius:999px;padding:4px 10px}.fp3d-size{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--fp3d-muted)}.fp3d-size input{width:58px;padding:5px 6px;border:1px solid rgba(127,127,127,0.35);border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px}.fp3d-danger-chip{color:var(--fp3d-danger)}.fp3d-grow{flex:1}.fp3d-save{font-size:12.5px;color:var(--fp3d-muted)}@media (max-width:${q(String(le))}px){.fp3d-header{gap:8px;padding-right:8px}.fp3d-header h1{display:none}.fp3d-tab{padding-left:9px;padding-right:9px}.fp3d-tab .fp3d-ui-icon{display:none}.fp3d-save-text{overflow:hidden;text-overflow:ellipsis}}@media ${q(et)}{.fp3d-header{height:52px;gap:2px;padding:0 4px 0 0}.fp3d-tab{padding-left:8px;padding-right:8px;gap:5px}.fp3d-tab .fp3d-ui-icon{display:inline}.fp3d-tab-view .fp3d-ui-icon,.fp3d-tab-editor .fp3d-ui-icon,.fp3d-tab-editor .fp3d-tab-word,.fp3d-tab-ext:not([aria-current]) .fp3d-tab-word,.fp3d-tab-settings:not([aria-current]) .fp3d-tab-word{display:none}.fp3d-tab-editor .fp3d-tab-short{display:inline}.fp3d-save-text{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.fp3d-notices{padding:6px 8px}}.fp3d-save-error{color:var(--fp3d-danger)}.fp3d-body{flex:1;min-height:0}.fp3d-settings-wait{position:absolute;inset:0;z-index:50;display:grid;place-items:center;background:rgba(2,6,14,0.55)}.fp3d-nav{position:relative;display:flex;align-items:center;gap:8px;padding:6px 12px;min-height:50px;box-sizing:border-box;flex:none;min-width:0;border-bottom:1px solid var(--fp3d-line);background:var(--fp3d-chrome-solid)}.fp3d-floors{flex:0 1 auto;min-width:0;overflow-x:auto;scrollbar-width:none;box-shadow:none}@media (hover:hover) and (pointer:fine){.fp3d-floors{scrollbar-width:thin;scrollbar-color:transparent transparent;padding-bottom:3px}.fp3d-floors:hover{scrollbar-color:color-mix(in srgb,var(--fp3d-text) 35%,transparent) transparent}}@media not all and (hover:hover) and (pointer:fine){.fp3d-floors:hover{scrollbar-width:thin}}.fp3d-floors{scroll-padding-inline:28px}.fp3d-floors[data-more-end]{mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent)}.fp3d-floors[data-more-start]{mask-image:linear-gradient(to left,#000 calc(100% - 28px),transparent)}.fp3d-floors[data-more-start][data-more-end]{mask-image:linear-gradient(to right,transparent,#000 28px,#000 calc(100% - 28px),transparent)}.fp3d-floors > button{flex:none}.fp3d-floor-pick{display:none;position:relative;flex:0 1 auto;min-width:0}.fp3d-floor-pick select{appearance:none;width:100%;max-width:14em;min-height:44px;padding:0 34px 0 14px;border:1px solid var(--fp3d-line);border-radius:999px;background:var(--fp3d-chrome);color:var(--fp3d-text);font:inherit;font-weight:500;text-overflow:ellipsis;cursor:pointer}.fp3d-floor-pick option{background:var(--fp3d-chrome-solid);color:var(--fp3d-text)}.fp3d-floor-on select{color:var(--fp3d-accent);border-color:var(--fp3d-accent)}.fp3d-floor-pick svg{position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--fp3d-muted)}.fp3d-rooms{position:relative;flex:none}.fp3d-nav .fp3d-chip{box-shadow:none;border:1px solid var(--fp3d-line)}.fp3d-rooms-btn{display:inline-flex;align-items:center;gap:6px;max-width:14em;overflow:hidden;text-overflow:ellipsis}.fp3d-rooms-on,.fp3d-rooms-btn[aria-expanded="true"]{color:var(--fp3d-accent);border-color:var(--fp3d-accent) !important}.fp3d-find-toggle{flex:none;margin-left:auto;display:inline-grid;place-items:center;min-width:36px}.fp3d-find-toggle[aria-expanded="true"]{border-color:var(--fp3d-accent) !important}.fp3d-sep{flex:none;width:1px;margin:4px 4px;background:var(--fp3d-line)}.fp3d-demo-chip{position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:3;padding:2px 10px;border-radius:999px;font-size:11px;letter-spacing:0.04em;color:var(--fp3d-s-text,#e8f4ff);background:var(--fp3d-s-chrome,rgba(10,20,35,0.72));border:1px solid var(--fp3d-s-line,rgba(120,200,255,0.35));pointer-events:auto;cursor:help}.fp3d-stage-wrap{position:relative;flex:1;min-height:0;display:flex;container-type:size;container-name:fp3d}.fp3d-stage-wrap fp3d-view3d{flex:1}.fp3d-room-panel{position:absolute;top:58px;right:14px;bottom:14px;width:min(360px,calc(100% - 28px));display:flex;flex-direction:column;justify-content:flex-start;pointer-events:none;z-index:2}fp3d-view3d{--fp3d-bottom-inset:52px}.fp3d-clean fp3d-view3d{--fp3d-bottom-inset:0px}.fp3d-clean .fp3d-nav{display:none}.fp3d-furnish-bar{bottom:68px}.fp3d-tt > *{--fp3d-tt-h:64px}.fp3d-tt fp3d-view3d{--fp3d-bottom-inset:calc(52px + var(--fp3d-tt-h))}.fp3d-tt .fp3d-overlay{bottom:calc(var(--fp3d-tt-h) + 4px)}.fp3d-tt .fp3d-room-panel{bottom:calc(var(--fp3d-tt-h) + 6px)}.fp3d-phone fp3d-view3d{--fp3d-bottom-inset:calc(72px + env(safe-area-inset-bottom,0px))}.fp3d-phone.fp3d-now-check fp3d-view3d{--fp3d-bottom-inset:calc(190px + env(safe-area-inset-bottom,0px))}.fp3d-phone .fp3d-room-panel{bottom:calc(70px + env(safe-area-inset-bottom,0px));height:auto;max-height:calc(62% - 62px)}.fp3d-now-ask{position:absolute;left:8px;right:8px;top:calc(8px + env(safe-area-inset-top,0px));z-index:10;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;border-radius:14px;background:var(--fp3d-chrome-solid);border:1px solid var(--fp3d-line);color:var(--fp3d-text)}.fp3d-now-ask span{flex:1 1 180px}.fp3d-tt-chip[aria-pressed="true"]{background:#ffb020;color:#1a1200}@container fp3d ((max-width:700px) or ((orientation:portrait) and (max-width:1000px))){.fp3d-room-panel{top:auto;left:8px;right:8px;bottom:8px;width:auto;height:var(--fp3d-sheet-h,55%);justify-content:flex-end}.fp3d-room-open .fp3d-overlay,.fp3d-room-open fp3d-view-panel{display:none}.fp3d-room-open fp3d-view3d{--fp3d-bottom-inset:calc(var(--fp3d-sheet-h,55%) + 8px)}.fp3d-tt > *{--fp3d-tt-h:calc(120px + env(safe-area-inset-bottom,0px))}@media (pointer:coarse){.fp3d-tt > *{--fp3d-tt-h:calc(138px + env(safe-area-inset-bottom,0px))}}}.fp3d-side-right .fp3d-overlay{left:12px;right:100px}@container fp3d (max-width:1180px){.fp3d-room-open fp3d-view-panel{left:12px;transform:none}}.fp3d-room-open .fp3d-overlay{right:calc(min(360px,100% - 28px) + 26px)}.fp3d-overlay{position:absolute;right:12px;bottom:12px;left:100px;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;align-items:center;pointer-events:none}.fp3d-overlay > *{pointer-events:auto}.fp3d-cam-btn[aria-pressed="true"]{background:var(--fp3d-primary);color:var(--fp3d-primary-text)}.fp3d-view-btn[aria-expanded="true"]{color:var(--fp3d-accent);box-shadow:inset 0 0 0 1px var(--fp3d-accent),var(--fp3d-shadow)}.fp3d-tt fp3d-view-panel{bottom:calc(var(--fp3d-tt-h) + 64px)}.fp3d-caret{font-size:0.8em;opacity:0.7}.fp3d-bar-icon,.fp3d-plan-toggle{display:none}.fp3d-message,.fp3d-empty{padding:32px 20px;color:var(--fp3d-muted);text-align:center}.fp3d-phone-only{display:none}@media (max-width:600px){.fp3d-phone-only{display:block}}.fp3d-empty{display:grid;justify-items:center;gap:12px;margin:auto}@media ${q(et)}{.fp3d-header{position:relative}.fp3d-tt-label{display:none}.fp3d-nav{position:relative;padding:4px 8px}.fp3d-nav .fp3d-floors{display:none}.fp3d-floor-pick{display:block}.fp3d-rooms{position:static}fp3d-rooms-picker{left:8px}.fp3d-tab,.fp3d-overlay .fp3d-chip,.fp3d-overlay .fp3d-seg button,fp3d-view-panel .fp3d-seg button,.fp3d-nav .fp3d-chip{min-height:44px}.fp3d-overlay .fp3d-tt-chip{min-width:44px;justify-content:center}.fp3d-tt fp3d-view-panel{bottom:0}.fp3d-cams-open .fp3d-overlay{display:none}.fp3d-overlay{left:108px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));flex-wrap:nowrap;justify-content:flex-start;gap:6px}.fp3d-side-right .fp3d-overlay{left:8px;right:108px;justify-content:flex-end}.fp3d-overlay > .fp3d-seg{display:none}.fp3d-overlay .fp3d-chip{flex:none;display:inline-grid;place-items:center;width:44px;min-width:44px;height:44px;padding:0;border-radius:14px}.fp3d-overlay .fp3d-bar-icon{display:contents}.fp3d-overlay :is(.fp3d-bar-word,.fp3d-caret){display:none}.fp3d-overlay .fp3d-bar-icon svg{width:22px;height:22px}fp3d-view3d{--fp3d-dock-left:8px;--fp3d-dock-bottom:calc(8px + env(safe-area-inset-bottom,0px));--fp3d-dock-menu:calc(60px + env(safe-area-inset-bottom,0px))}.fp3d-tt fp3d-view3d{--fp3d-dock-left:-42px;--fp3d-dock-bottom:calc(var(--fp3d-tt-h) + 4px);--fp3d-dock-menu:calc(var(--fp3d-tt-h) + 56px)}.fp3d-tt .fp3d-overlay{left:58px}.fp3d-side-right.fp3d-tt .fp3d-overlay{left:8px;right:58px}.fp3d-room-open fp3d-view3d{--fp3d-dock-bottom:calc(var(--fp3d-sheet-h,55%) + 18px);--fp3d-dock-menu:calc(var(--fp3d-sheet-h,55%) + 70px)}.fp3d-clean fp3d-view3d{--fp3d-dock-left:initial;--fp3d-dock-bottom:initial;--fp3d-dock-menu:initial}}@media (pointer:coarse),${q(et)}{.fp3d-view-btn,.fp3d-rooms-btn,.fp3d-find-toggle,.fp3d-note-badge{min-width:44px}.fp3d-note-badge{height:44px}.fp3d-tab,.fp3d-floors button,.fp3d-overlay .fp3d-chip,.fp3d-overlay .fp3d-seg button,fp3d-view-panel .fp3d-seg button,.fp3d-nav .fp3d-chip{min-height:44px}}`]};Q("home-3d-panel",Zt);function mi(o){let t=o.texts.reduce((e,i)=>e+[...i].length*7.6+26,0);return Math.ceil(t+(o.texts.length>1?6+2*(o.texts.length-1):0))}function gi(o,t){if((r=>r.reduce((a,d,h)=>a+mi(d)+(h?8:0),0))(o)<=t)return{bar:o.map(r=>r.id),menu:[]};let i=[],s=[],n=44;for(let r of o){let a=mi(r)+8;r.keep||s.length===0&&n+a<=t?(i.push(r.id),n+=a):s.push(r.id)}return{bar:i,menu:s}}var vi=M("home-3d-card-editor",()=>"614764c165ba");function _i(){try{let o=localStorage.getItem("home3d.card_walls");return o==="auto"||o==="cut"?o:null}catch{return null}}var te=class extends tt{static properties={hass:{attribute:!1},_config:{state:!0},_roomId:{state:!0},_shutRoom:{state:!0},_phoneMode:{state:!0},_solo:{state:!0},_floorId:{state:!0},_walls:{state:!0},_heat:{state:!0},_explode:{state:!0},_plan2d:{state:!0},_fullscreen:{state:!0},_pseudoFull:{state:!0},_vh:{state:!0},_top:{state:!0},_cameraWall:{state:!0},_clean:{state:!0},_night:{state:!0},_orbit:{state:!0},_barW:{state:!0},_barMenu:{state:!0}};rawHass;hassWatch=new ht({entityLists:!1});shownHass;get hass(){let t=this.rawHass;return t&&this.hassWatch.recording?this.hassWatch.wrap(t):t}set hass(t){this.rawHass=t}yaml=null;appliedTemplate="";roomApplied=!1;cleanTimer;barSizer=null;idleTimer;nightTimer;data=new st(this);tt=new N(this);constructor(){super(),this.preview=!1,this._roomId=null,this._shutRoom=null,this._phoneMode="bar",this._solo=Ht(),this._floorId=void 0,this._walls=_i(),this._heat=null,this._explode=null,this._plan2d=null,this._fullscreen=!1,this._pseudoFull=!1,this._vh=window.innerHeight,this._top=null,this._cameraWall=!1,this._clean=!1,this._night=!1,this._orbit=!1,this._barW=0,this._barMenu=!1}touch=()=>{this._orbit&&(this._orbit=!1),this.armIdle(),this.armClean(!0)};armClean(t=!1){clearTimeout(this.cleanTimer);let e=this._config?.controls_hide_after??0;e>0&&(t&&this._clean&&(this._clean=!1),this.cleanTimer=setTimeout(()=>this._clean=!0,e*1e3))}armIdle(){clearTimeout(this.idleTimer);let t=this._config?.idle_return??0;t>0&&(this.idleTimer=setTimeout(()=>this.returnHome(),t*1e3))}view3d(){return xt(this.shadowRoot)}toggleTimeTravel(){if(this.tt.active){this.tt.stop();return}let t=this.view3d(),e=this.data.building;if(!t||!e||!this.hass)return;this._cameraWall=!1;let i=this._config;this.tt.start({live:this.hass,building:e,spec:t.historyEntities(),quality:i?.quality??"auto",speed:i?.time_travel_speed??null,range:i?.time_travel_range??null,t:(s,n)=>E(this.hass,s,n)})}onKey=t=>{t.key==="Escape"&&this.tt.stop(),this.touch()};returnHome(){if(this.tt.session?.playing){this.armIdle();return}this.tt.stop(),this._roomId=this.startRoom,this._floorId=void 0,this._plan2d=null,this.view3d()?.resetView(),this._config?.idle_orbit&&(this._orbit=!0)}openDashboard(t){ve(t)}onFullscreen=()=>{this._fullscreen=!!document.fullscreenElement&&this.shadowRoot?.contains(document.fullscreenElement)===!0,requestAnimationFrame(this.onViewport)};onViewport=()=>{let t=Math.round(window.visualViewport?.height??window.innerHeight);if(Math.abs(t-this._vh)>1&&(this._vh=t),this._config?.fill&&!this._fullscreen){let e=Math.round(this.getBoundingClientRect().top+window.scrollY);(this._top===null||Math.abs(e-this._top)>1)&&(this._top=e)}};viewportTimer;connectedCallback(){super.connectedCallback(),this._config&&!Lt(this._config,this._plan2d)&&_t(),$t().then(()=>this.requestUpdate(),t=>console.error("Home 3D: the 3D view failed to load",t)),document.addEventListener("fullscreenchange",this.onFullscreen),window.addEventListener("resize",this.onViewport),window.visualViewport?.addEventListener("resize",this.onViewport),requestAnimationFrame(this.onViewport),this.viewportTimer=setTimeout(this.onViewport,600),this.armIdle(),this.armClean(),this.nightTimer=setInterval(()=>this._night=J(this._config?.night,this.hass),6e4)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("fullscreenchange",this.onFullscreen),window.removeEventListener("resize",this.onViewport),window.visualViewport?.removeEventListener("resize",this.onViewport),this.tt.stop(),clearTimeout(this.viewportTimer),clearTimeout(this.cleanTimer),clearTimeout(this.idleTimer),clearInterval(this.nightTimer),this.barSizer?.disconnect(),this.barSizer=null}toggleFullscreen(){if(this._pseudoFull){this._pseudoFull=!1,this._fullscreen=!1,requestAnimationFrame(this.onViewport);return}if(document.fullscreenElement){document.exitFullscreen();return}let t=this.shadowRoot?.querySelector("ha-card"),e=()=>{this._pseudoFull=!0,this._fullscreen=!0,requestAnimationFrame(this.onViewport)};t?.requestFullscreen?t.requestFullscreen().catch(e):e()}static async getConfigElement(){return await Promise.all([vi(),Be()]),document.createElement("home-3d-card-editor")}static getStubConfig(){return{type:"custom:home-3d-card"}}setWalls(t){this._walls=t;try{localStorage.setItem("home3d.card_walls",t)}catch{}}setConfig(t){if(t.height!==void 0&&!(t.height>100))throw new Error("height must be a number of pixels above 100");this.yaml=t,this.appliedTemplate=this.templateKey(),this.applyConfig(At(t,this.data.building))}templateKey(){let t=Pt(this.data.building,this.yaml?.template);return t?JSON.stringify([t.name,t.config]):""}applyConfig(t){this._config&&((this._config.home||void 0)!==(t.home||void 0)||this._config.room!==t.room||String(this._config.rooms)!==String(t.rooms))&&(this._roomId=null,this.roomApplied=!1),this._config=t,this.data.setHome(t.home||void 0),this._floorId=void 0,this._walls=_i(),this._heat=null,this._explode=null,this._plan2d=null,this._orbit=!1,this._night=J(t.night,this.hass),this._clean=t.controls_hidden===!0,this.armClean(),this.armIdle()}getCardSize(){return Math.ceil((this._config?.height??420)/50)}getGridOptions(){return{columns:"full",rows:this._config?.fill?12:Math.ceil((this._config?.height??420)/56),min_rows:4}}shouldUpdate(t){let e=t.get("hass"),i=this.rawHass;if(t.size!==1||!t.has("hass")||!e||!i||this.tt.active||this.hassWatch.matters(e,i)||J(this._config?.night,i)!==this._night)return!0;this.takeHass(i);let s=this.shownHass,n=s&&this.viewHass(i,this.data.building);return ct(this.renderRoot,pt["card.ts"],[[e,i],[s,n]]),this.shownHass=n,!1}update(t){this.hassWatch.begin();try{super.update(t)}finally{this.hassWatch.end()}}takeHass(t){this.data.setHass(t),this.tt.session?.setLive(t);let e=J(this._config?.night,t);e!==this._night&&(this._night=e)}viewHass(t,e){return It(this.tt.hass(t),e)}willUpdate(t){if(this.yaml?.template){let i=this.templateKey();i!==this.appliedTemplate&&(this.appliedTemplate=i,this.applyConfig(At(this.yaml,this.data.building)))}t.has("_roomId")&&this._shutRoom!==this._roomId&&(this._shutRoom=null),t.has("hass")&&this.rawHass&&(this.takeHass(this.rawHass),F(this.rawHass.language)||j(this.rawHass.language,this.rawHass).then(()=>this.requestUpdate()));let e=this.data.building;e!==this.seenBuilding&&(this.seenBuilding=e,e&&this._roomId&&!e.floors.some(i=>R(i).some(s=>s.id===this._roomId))&&(this._roomId=null))}seenBuilding=null;cardStyle(){let t=this._config,e=s=>s&&P(s)!=="theme"?s:null,i={};if(t?.style_entity)for(let s of _e())i[s.id]=[s.name??E(this.hass,`style_${s.id}`)];return{evening:e(t?.theme_evening),night:e(t?.theme_night),entity:t?.style_entity||null,names:i}}updated(){let t=ut(P(this._config?.theme),this.hass,this.data.building?.settings,this.cardStyle());this.toggleAttribute("light",rt(t)),this.toggleAttribute("contrast",at(t));let e=nt(this.hass);this.getAttribute("lang")!==e&&this.setAttribute("lang",e);let i=this.renderRoot.querySelector(".fp3d-card-body");i&&!this.barSizer&&typeof ResizeObserver=="function"&&(this.barSizer=new ResizeObserver(([n])=>{let r=Math.round(n?.contentRect.width??0);Math.abs(r-this._barW)>1&&(this._barW=r)}),this.barSizer.observe(i));let s=this.shadowRoot?.querySelector("fp3d-view3d");if(s){let n=Oe([...this.shadowRoot?.querySelectorAll(".fp3d-card-full")??[]].map(r=>r.offsetLeft),s.clientWidth);s.style.getPropertyValue("--fp3d-walk-right")!==`${n}px`&&s.style.setProperty("--fp3d-walk-right",`${n}px`)}}closeBarMenu=t=>{if(!this._barMenu)return;t.composedPath().some(i=>i.classList?.contains("fp3d-card-menu")||i.classList?.contains("fp3d-card-more"))||(this._barMenu=!1)};get canSwitch(){return!this._config?.floor||this.thumbs}get thumbs(){return this._config?.floor_thumbs??!this._config?.floor}get shownRooms(){return Ne(this.data.building,this._config?.rooms)}get startRoom(){let t=this.shownRooms;return this._config?.room??(t.length===1?t[0]:null)}roomsPlan(t,e){if(!e.length)return t;let i=e.join(",");return(this.roomsOf?.from!==t||this.roomsOf.key!==i)&&(this.roomsOf={from:t,key:i,to:We(t,e)}),this.roomsOf.to}roomsOf=null;currentFloor(){let t=this.data.building,e=t&&!this._config?.floor?Ve(t,this.shownRooms):[],i=this._floorId===void 0?this._config?.floor??(e.length===1?e[0]:null):this._floorId;return t&&t.floors.length===1?t.floors[0].id:t?.floors.some(s=>s.id===i)?i:null}onPlanChange(t){t.preventDefault(),!this.preview&&this.data.update(t.detail.change)}back(){this._roomId?this._roomId=null:this.canSwitch&&(this._floorId=null)}render(){if(this.hass&&!F(this.hass.language))return u;let t=this.data.building,e=this._config?.height??420,i=this._config,s=this.startRoom;!this.roomApplied&&t&&s&&(this.roomApplied=!0,t.floors.some(f=>R(f).some(U=>U.id===s))&&(this._roomId=s));let n=this.shownRooms,r=ui(this._solo,i?.phone_solo),a=this.currentFloor(),d=!!this._roomId&&i?.room_panel===!1||!this.thumbs&&this.canSwitch&&!this._roomId&&!!a&&(t?.floors.length??0)>1,h=f=>i?.controls===!0||Array.isArray(i?.controls)&&i.controls.includes(f),c=["temperature","humidity","co2"].filter(f=>h(f)),p=this._walls??i?.walls??"auto",_=this._heat??i?.heatmap??"none",I=this._explode??i?.explode??!0,$=Lt(i,this._plan2d),m=this._fullscreen?"100%":i?.fill?this._top!==null?`${Math.max(240,this._vh-this._top-2)}px`:"calc(100vh - var(--header-height, 56px) - 2px)":`${e}px`,v=!!t&&!this._clean&&i?.phone!==!0&&(d||(!!i?.controls||!!i?.time_travel)&&!(this._roomId&&this._shutRoom!==this._roomId&&i.room_panel!==!1)),H=this.tt.active,x=this.viewHass(this.rawHass,t);this.shownHass=x;let T=i?.controls_hidden!==void 0||(i?.controls_hide_after??0)>0,S=i?.phone===!0&&!!t&&!H;S&&k(vt);let C=f=>E(this.hass,f),W=ft(P(i?.theme),i?.accent,this.hass,f=>getComputedStyle(this).getPropertyValue(f));return l`<ha-card class="${this._night?"fp3d-night":""} ${this._pseudoFull?"fp3d-pseudo-full":""}" style=${mt(W)} @pointerdown=${f=>(this.closeBarMenu(f),this.touch())} @keydown=${this.onKey} @wheel=${this.touch}>
      <div class="fp3d-card-body ${H?"fp3d-tt":""} ${S?`fp3d-phone fp3d-now-${this._phoneMode}`:""}" style="height:${m}">
        ${t&&t.floors.some(f=>f.rooms.length)?l`<fp3d-view3d
              .hass=${x}
              .canEdit=${this.data.canEdit}
              .home=${this.data.homeId}
              .replay=${this.tt.session?.replay??null}
              .building=${t}
              .packs=${this.data.packs}
              .plan2d=${$}
              .floorId=${a}
              .roomId=${this._roomId}
              .rooms=${Rt({phone:S,solo:r,roomId:this._roomId,rooms:n})}
              .wallMode=${p}
              .explode=${I}
              .keepRoof=${i?.roof_fade===!1}
              .hideRoof=${i?.roof===!1||n.length>0}
              .quality=${this._config?.quality??"auto"}
              ?showStats=${this._config?.stats??!1}
              .markerMode=${this._config?.markers??"important"}
              .pinSize=${this._config?.marker_size??"normal"}
              .markerNames=${this._config?.marker_names===!0}
              .central=${this._config?.central!==!1}
              .walkable=${this._config?.walk!==!1}
              .petsOn=${this._config?.pets!==!1}
              .ghostOn=${this._config?.ghost!==!1}
              .buttons=${this._config?.buttons?.map((f,U)=>({id:`card_${U}`,...f}))??null}
              .heatMode=${_}
              .theme=${P(this._config?.theme)}
              .themeEvening=${P(this._config?.theme_evening)==="theme"?null:this._config?.theme_evening??null}
              .themeNight=${P(this._config?.theme_night)==="theme"?null:this._config?.theme_night??null}
              .styleEntity=${this._config?.style_entity||null}
              .zoomStyle=${this._config?.zoom_style||null}
              .zoomLate=${this._config?.zoom_late??null}
              .zoomScope=${this._config?.zoom_scope??null}
              .clock=${this._config?.clock??null}
              .accent=${W}
              .showEnergy=${this._config?.energy??!0}
              .flows=${this._config?.flows??null}
              .holograms=${this._config?.holograms??null}
              .floorThumbs=${this.thumbs&&!n.length}
              .roomLabels=${i?.room_names!==!1}
              .roomCard=${!!i?.room||n.length>0}
              .surroundings=${i?.surroundings!==!1}
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
              .cameraWall=${this._cameraWall&&!H}
              @camera-wall-close=${()=>this._cameraWall=!1}
              @camera-wall-open=${()=>this._cameraWall=!0}
              .clean=${this._clean||S}
              .cleanButton=${T&&!S}
              .phoneView=${S}
              @status-change=${()=>S&&setTimeout(()=>this.renderRoot.querySelector("fp3d-phone-shell")?.requestUpdate(),0)}
              @clean-toggle=${()=>{this._clean=!this._clean,this._clean?clearTimeout(this.cleanTimer):this.armClean()}}
              .weather=${i?.weather!==!1}
              .weatherEntityId=${i?.weather_entity??null}
              .dimmed=${this._night}
              .autoOrbit=${this._orbit}
              .startView=${i?.start_view??null}
              style=${H?`--fp3d-bottom-inset: ${v?"calc(52px + var(--fp3d-tt-h))":"var(--fp3d-tt-h)"}`:v?"--fp3d-bottom-inset: 52px":""}
              @room-tap=${f=>{if(this.canSwitch&&(t?.floors.length??0)>1&&f.detail.floorId&&this.currentFloor()!==f.detail.floorId){this._floorId=f.detail.floorId,this._roomId=null;return}if(f.detail.roomId){if(f.detail.roomId===this._roomId&&this._shutRoom===this._roomId){this._shutRoom=null;return}this._roomId=f.detail.roomId===this._roomId?null:f.detail.roomId}}}
              @floor-tap=${f=>{this._floorId=f.detail.floorId,this._roomId=null}}
              @back=${()=>this.back()}
              @plan-change=${this.onPlanChange}
            ></fp3d-view3d>`:l`<p class="fp3d-card-msg">${this.data.error??(t?E(this.hass,"no_building"):E(this.hass,"loading"))}</p>`}
        ${t&&i?.template&&!Pt(t,i.template)?l`<div class="fp3d-card-tpl-missing" role="status">${E(this.hass,"card_template_missing",{name:i.template})}</div>`:u}
        ${this._roomId&&this._shutRoom!==this._roomId&&t&&this._config?.room_panel!==!1&&!(S&&this._phoneMode==="check")?(k(D),l`<fp3d-room-panel
              @camera-look=${f=>this.view3d()?.lookThrough(f.detail.entity)}
              class="fp3d-card-panel"
              ?collapsible=${S}
              .hass=${x}
              ?readOnly=${H}
              ?noLook=${$}
              ?canEdit=${this.data.canEdit}
              @plan-change=${this.onPlanChange}
              .room=${t.floors.flatMap(f=>R(f)).find(f=>f.id===this._roomId)??null}
              .floor=${t.floors.find(f=>R(f).some(U=>U.id===this._roomId))??null}
              .building=${t}
              .confirmEntities=${ot(this.hass,t.floors)}
              .sheets=${this._roomId?this.view3d()?.roomSheets(this._roomId)??null:null}
              @sheet-open=${f=>this._roomId&&this.view3d()?.openRoomSheet(this._roomId,f.detail.id)}
              @close=${()=>this._shutRoom=this._roomId}
            ></fp3d-room-panel>`):u}
        ${S&&t?l`<fp3d-phone-shell
              .hass=${x}
              .building=${this.roomsPlan(t,n)}
              .view=${()=>this.view3d()}
              .floorId=${a}
              .roomId=${this._roomId}
              .solo=${r}
              @phone-solo=${f=>Tt(this._solo=f.detail)}
              .extras=${i?.dashboard?[{id:"dash",icon:"\u2302",label:i.dashboard_label||i.dashboard}]:[]}
              .hide=${i?.phone_hide??[]}
              .start=${i?.phone_start}
              .places=${i?.phone_places}
              @phone-link=${f=>Ae(f.detail)&&this.openDashboard(f.detail)}
              @phone-mode=${f=>this._phoneMode=f.detail}
              @phone-room=${f=>{this.canSwitch&&(this._floorId=t.floors.length>1||f.detail.roomId?f.detail.floorId:null),this._roomId=f.detail.roomId,this._shutRoom=null}}
              @phone-more=${f=>f.detail==="dash"&&i?.dashboard&&this.openDashboard(i.dashboard)}
            ></fp3d-phone-shell>`:u}
        ${v&&t?this.renderBar(t,d,$,p,I,a,c,_,C):u}
        ${this.tt.session?l`<fp3d-time-bar .session=${this.tt.session}></fp3d-time-bar>`:u}
        ${i?.fullscreen_button&&!this._clean&&!S&&!(this._roomId&&this._shutRoom!==this._roomId&&i.room_panel!==!1)?l`<button class="fp3d-card-full" title=${C(this._fullscreen?"fullscreen_exit":"fullscreen")} aria-label=${C(this._fullscreen?"fullscreen_exit":"fullscreen")} @click=${()=>this.toggleFullscreen()}>
              ${this._fullscreen?"\u2715":L("expand")}
            </button>`:u}
        ${i?.dashboard&&!this._clean&&!S&&!(this._roomId&&this._shutRoom!==this._roomId&&i.room_panel!==!1)?l`<button class="fp3d-card-full fp3d-card-dash ${i.fullscreen_button?"fp3d-card-dash-2":""}" title=${i.dashboard_label||i.dashboard} aria-label=${i.dashboard_label||i.dashboard} @click=${()=>this.openDashboard(i.dashboard)}>
              ${i.dashboard_label?l`<span>${i.dashboard_label}</span>`:"\u2302"}
            </button>`:u}
      </div>
    </ha-card>`}renderBar(t,e,i,s,n,r,a,d,h){let c=this._config,p=this.tt.active,_=x=>c?.controls===!0||Array.isArray(c?.controls)&&c.controls.includes(x),I=x=>x==="none"?"heat_off":`heat_short_${x}`,$=[];if(e&&$.push({id:"back",keep:!0,texts:[h("back")],tpl:l`<button class="fp3d-chip" @click=${()=>this.back()}>${h("back")}</button>`}),c?.time_travel&&$.push({id:"tt",texts:["\u23EA "+h("tt_chip")],tpl:l`<button class="fp3d-chip fp3d-tt-chip" aria-pressed=${p} title=${h("tt_hint")} @click=${()=>this.toggleTimeTravel()}>⏪ ${h("tt_chip")}</button>`}),c?.camera_wall&&$.push({id:"cameras",texts:[h("cameras_short")],tpl:l`<button class="fp3d-chip" aria-pressed=${this._cameraWall} title=${h("camera_wall_hint")} @click=${()=>this._cameraWall=!this._cameraWall}>${h("cameras_short")}</button>`}),_("view")&&$.push({id:"view",texts:[h("view_3d"),h("view_2d")],tpl:l`<div class="fp3d-seg" role="group" aria-label=${h("plan_view")}>
          <button aria-pressed=${!i} @click=${()=>this._plan2d=!1}>${h("view_3d")}</button>
          <button aria-pressed=${i} @click=${()=>this._plan2d=!0}>${h("view_2d")}</button>
        </div>`}),_("walls")&&!i&&$.push({id:"walls",texts:[h("walls_auto"),h("walls_cut")],tpl:l`<div class="fp3d-seg">
          <button aria-pressed=${s==="auto"} @click=${()=>this.setWalls("auto")}>${h("walls_auto")}</button>
          <button aria-pressed=${s==="cut"} @click=${()=>this.setWalls("cut")}>${h("walls_cut")}</button>
        </div>`}),_("floors")&&!i&&t.floors.length>1&&!r&&$.push({id:"floors",texts:[h("floors_apart"),h("floors_stacked")],tpl:l`<div class="fp3d-seg">
          <button aria-pressed=${n} @click=${()=>this._explode=!0}>${h("floors_apart")}</button>
          <button aria-pressed=${!n} @click=${()=>this._explode=!1}>${h("floors_stacked")}</button>
        </div>`}),a.length){let x=["none",...a];$.push({id:"heat",texts:x.map(T=>h(I(T))),tpl:l`<div class="fp3d-seg" role="group" aria-label=${h("heatmap")}>
          ${x.map(T=>l`<button aria-pressed=${d===T} @click=${()=>this._heat=T}>${h(I(T))}</button>`)}
        </div>`})}let m=this._barW?gi($,this._barW-70):{bar:$.map(x=>x.id),menu:[]},v=x=>$.find(T=>T.id===x).tpl,H=this._barMenu&&m.menu.length>0;return l`<div class="fp3d-card-controls">
      ${m.bar.map(v)}
      ${m.menu.length?l`<button class="fp3d-chip fp3d-card-more" aria-haspopup="true" aria-expanded=${H?"true":"false"} title=${h("more")} aria-label=${h("more")} @click=${()=>this._barMenu=!this._barMenu}>⋯</button>`:u}
      ${H?l`<div class="fp3d-card-menu" role="group" aria-label=${h("more")} @keydown=${x=>x.key==="Escape"&&(this._barMenu=!1)}>${m.menu.map(v)}</div>`:u}
    </div>`}static styles=[lt,dt,Z`.fp3d-card-controls{position:absolute;left:60px;right:10px;bottom:10px;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;pointer-events:none}.fp3d-card-controls > *{pointer-events:auto}.fp3d-card-more{min-width:44px;font-size:18px;line-height:1}.fp3d-card-menu{position:absolute;right:0;bottom:calc(100% + 8px);display:grid;justify-items:end;gap:8px;padding:8px;border-radius:14px;background:var(--fp3d-chrome-solid);border:1px solid var(--fp3d-line);box-shadow:var(--fp3d-shadow);max-width:calc(100% - 16px)}.fp3d-card-menu .fp3d-seg{box-shadow:none;flex-wrap:wrap}.fp3d-tt > *{--fp3d-tt-h:64px}.fp3d-tt .fp3d-card-controls{bottom:calc(var(--fp3d-tt-h) + 2px)}.fp3d-tt .fp3d-card-panel{bottom:calc(var(--fp3d-tt-h) + 4px)}.fp3d-phone fp3d-view3d{--fp3d-bottom-inset:calc(72px + env(safe-area-inset-bottom,0px))}.fp3d-phone.fp3d-now-check fp3d-view3d{--fp3d-bottom-inset:calc(190px + env(safe-area-inset-bottom,0px))}.fp3d-phone .fp3d-card-panel{bottom:calc(70px + env(safe-area-inset-bottom,0px));height:auto;max-height:calc(62% - 62px)}.fp3d-tt-chip[aria-pressed="true"]{background:#ffb020;color:#1a1200}.fp3d-card-dash{width:auto;min-width:38px;padding:0 12px;font-size:14px;font-weight:600}.fp3d-card-dash-2{right:56px}fp3d-view3d{--fp3d-walk-right:104px}.fp3d-card-full{position:absolute;right:10px;top:10px;width:38px;height:38px;border:0;border-radius:12px;background:var(--fp3d-chrome);color:var(--fp3d-text);box-shadow:var(--fp3d-shadow);font-size:18px;cursor:pointer}ha-card.fp3d-pseudo-full{position:fixed;inset:0;z-index:9999;height:100vh !important;max-height:none !important;border-radius:0}@supports (height:100dvh){ha-card.fp3d-pseudo-full{height:100dvh !important}}ha-card{overflow:hidden;background:var(--fp3d-bg);height:100%}ha-card:fullscreen{display:flex;flex-direction:column;width:100vw;height:100vh;border-radius:0;border:0}ha-card:fullscreen .fp3d-card-body{flex:1 1 auto;min-height:0}ha-card.fp3d-night .fp3d-card-body{filter:brightness(0.55)}.fp3d-card-body{position:relative;display:flex;height:100%;container-type:size;container-name:fp3d}fp3d-view3d{flex:1}.fp3d-card-tpl-missing{position:absolute;top:10px;left:50%;transform:translateX(-50%);max-width:calc(100% - 40px);padding:6px 12px;border-radius:10px;background:var(--fp3d-chrome-solid,rgba(10,16,30,0.92));border:1px solid rgba(255,170,60,0.6);color:var(--fp3d-text,#fff);font-size:13px;z-index:5}.fp3d-card-msg{margin:auto;color:var(--fp3d-muted);padding:16px;text-align:center}.fp3d-card-panel{position:absolute;top:10px;right:10px;bottom:10px;width:min(340px,calc(100% - 20px));display:flex;flex-direction:column;pointer-events:none;z-index:2}@container fp3d ((max-width:700px) or ((orientation:portrait) and (max-width:1000px))){.fp3d-card-panel{top:auto;left:8px;right:8px;bottom:8px;width:auto;height:var(--fp3d-sheet-h,55%);justify-content:flex-end}.fp3d-tt > *{--fp3d-tt-h:calc(120px + env(safe-area-inset-bottom,0px))}@media (pointer:coarse){.fp3d-tt > *{--fp3d-tt-h:calc(138px + env(safe-area-inset-bottom,0px))}}}`]};if(Q("home-3d-card",te)){let o=window;o.customCards=o.customCards??[],o.customCards.push({type:"home-3d-card",name:E(void 0,"card_name"),description:E(void 0,"card_description"),preview:!1})}var ji="/api/home_3d/static/",bi="/home_3d_static/";function wi(o){let t=new URL(".",o);return t.pathname.endsWith(bi)&&(t.pathname=`${t.pathname.slice(0,-bi.length)}${ji}`),t.href}async function yi(o,t=(s,n)=>fetch(s,n),e=Date.now(),i=4e3){let s,n=(async()=>{let a=await t(new URL(`build.json?t=${e}`,o).href,{cache:"no-store",credentials:"same-origin"});if(!a.ok)return null;let d=(await a.json())?.build;return typeof d=="string"&&/^[\w-]{1,64}$/.test(d)?d:null})().catch(()=>null),r=new Promise(a=>s=setTimeout(()=>a(null),i));try{return await Promise.race([n,r])}finally{clearTimeout(s)}}var ee="fp3d_chunk_reload",Gi=3e4,Yi=/dynamically imported module|importing a module script failed|ChunkLoadError|Loading chunk .* failed/i;function Ji(o){if(!o||typeof o!="object")return!1;let{name:t,message:e}=o;return t==="ChunkLoadError"||typeof e=="string"&&Yi.test(e)}function ie(){let o=null;try{o=globalThis.sessionStorage??null}catch{o=null}return{storage:o,reload:()=>globalThis.location?.reload(),later:(t,e)=>{setTimeout(t,e).unref?.()}}}function $i(o,t={}){if(!Ji(o))return!1;let{storage:e,reload:i}={...ie(),...t};if(!e)return!1;try{if(e.getItem(ee))return!1;e.setItem(ee,String(Date.now()))}catch{return!1}return i(),!0}function Xi(o={}){let{storage:t,later:e}={...ie(),...o};e(()=>{try{t?.removeItem(ee)}catch{}},Gi)}function ki(){globalThis[we]=o=>{$i(o)},typeof addEventListener=="function"&&(addEventListener("unhandledrejection",o=>{$i(o.reason)}),Xi())}var xi="fp3d_build_reload",Qi=6e4;async function Si(o,t={}){let{storage:e,reload:i}={...ie(),...t},s=t.age??globalThis.performance?.now()??0;if(!e||s>Qi||await(t.current??(()=>yi(wi(import.meta.url))))().catch(()=>null)!==o)return!1;try{if(e.getItem(xi)===o)return!1;e.setItem(xi,o)}catch{return!1}return i(),!0}oe()?(ki(),Ze(),Ue()):(console.info(`Home 3D: this page runs another build; build ${Mt} stays out of it`),Si(Mt));
