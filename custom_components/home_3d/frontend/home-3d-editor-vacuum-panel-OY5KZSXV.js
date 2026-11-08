import{Na as O}from"./home-3d-editor-chunk-RBYOTREW.js";import{a as F}from"./home-3d-editor-chunk-TAAEQO2A.js";import{b as U,c as v,d as w,f as g,h as C}from"./home-3d-editor-chunk-GGWVF3HT.js";function $(s,t){return[s[0]*t[0]+s[2]*t[1]+s[4],s[1]*t[0]+s[3]*t[1]+s[5]]}function x(s,t){let[e,i,n,r,o,a]=s,[c,l,u,p,d,h]=t;return[e*c+n*l,i*c+r*l,e*u+n*p,i*u+r*p,e*d+n*h+o,i*d+r*h+a]}var H=s=>s[0]*s[3]-s[1]*s[2];function L(s){let t=H(s);if(!Number.isFinite(t)||Math.abs(t)<1e-12)return null;let[e,i,n,r,o,a]=s;return[r/t,-i/t,-n/t,e/t,(n*a-r*o)/t,(i*o-e*a)/t]}function z(s,t){let[[e,i],[n,r],[o,a]]=s,c=e*(r-a)-i*(n-o)+(n*a-o*r),l=Math.max(Math.abs(e-n),Math.abs(e-o),Math.abs(i-r),Math.abs(i-a),1e-9);if(!Number.isFinite(c)||Math.abs(c)<l*l*1e-6)return null;let u=(y,b,f)=>[(y*(r-a)-i*(b-f)+(b*a-f*r))/c,(e*(b-f)-y*(n-o)+(n*f-o*b))/c,(e*(r*f-a*b)-i*(n*f-o*b)+y*(n*a-o*r))/c],[p,d,h]=u(t[0][0],t[1][0],t[2][0]),[P,m,_]=u(t[0][1],t[1][1],t[2][1]);return[p,P,d,m,h,_]}function q(s,t,e){let i=e?s.map(([d,h])=>[d,-h]):s,n=i[1][0]-i[0][0],r=i[1][1]-i[0][1],o=n*n+r*r;if(!(o>1e-12))return null;let a=t[1][0]-t[0][0],c=t[1][1]-t[0][1],l=(a*n+c*r)/o,u=(c*n-a*r)/o,p=[l,u,-u,l,t[0][0]-(l*i[0][0]-u*i[0][1]),t[0][1]-(u*i[0][0]+l*i[0][1])];return e?x(p,[1,0,0,-1,0,0]):p}function X(s){if(!Array.isArray(s)||s.length<3)return null;let t=n=>{let r=n,o=Number(r?.x),a=Number(r?.y);return r&&Number.isFinite(o)&&Number.isFinite(a)?[o,a]:null},e=[],i=[];for(let n of s){let r=t(n?.vacuum),o=t(n?.map);if(!r||!o)return null;e.push(r),i.push(o)}return z(e.slice(0,3),i.slice(0,3))}function j(s){let t=s;if(!t||typeof t!="object")return null;let e=Number(t.x),i=Number(t.y);if(!Number.isFinite(e)||!Number.isFinite(i))return null;let n=t.a==null?Number.NaN:Number(t.a);return{x:e,y:i,a:Number.isFinite(n)?n:null}}function M(s){let t=s??{};return{calibration:X(t.calibration_points),robot:j(t.vacuum_position),dock:j(t.charger_position??t.charger)}}function V(s,t){return s.startsWith("camera.")&&Array.isArray(t?.calibration_points)}function G(s,t,e,i,n=1){let r=e.slice(-3);if(r.length>=3){let c=z(r.map(l=>l.v),r.map(l=>l.p));if(c)return c}if(r.length>=2){let c=r.slice(-2),l=q(c.map(u=>u.v),c.map(u=>u.p),H(s)<0);if(l)return l}let o=n/1e3/Math.sqrt(Math.abs(H(s))||1),a=x([o,0,0,o,0,0],s);if(r.length){let c=$(a,r[r.length-1].v),l=r[r.length-1].p;return x([1,0,0,1,l[0]-c[0],l[1]-c[1]],a)}return x([o,0,0,o,i[0]-o*t[0]/2,i[1]-o*t[1]/2],s)}function B(s,t,e,i){let n=s&&L(s);return s&&n?x(G(s,t,e,i),n):null}function W(s){let t=s.flatMap(n=>n.points);if(!t.length)return[0,0];let e=t.map(n=>n[0]),i=t.map(n=>n[1]);return[(Math.min(...e)+Math.max(...e))/2,(Math.min(...i)+Math.max(...i))/2]}async function D(s,t,e){let i=`/api/camera_proxy/${t}`,n=s?.fetchWithAuth?await s.fetchWithAuth(i):await fetch(`${i}?token=${encodeURIComponent(String(e??""))}`);if(!n.ok)throw new Error(`map ${t}: ${n.status}`);return n.blob()}var I=.6,E=(s,t)=>Math.round(s*t)/t,Y=U`
fp3d-vacuum-panel {
  display: block;
}
.fp3d-vac-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 10px;
  align-items: end;
  padding: 10px 0;
  border-top: 1px solid var(--fp3d-line, rgba(127, 127, 127, 0.25));
}
.fp3d-vac-row > .fp3d-wide,
.fp3d-vac-title {
  grid-column: 1 / -1;
}
.fp3d-vac-row select,
.fp3d-vac-row input[type="range"] {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}
.fp3d-vac-title {
  font-weight: 600;
  overflow-wrap: anywhere;
}
fp3d-vacuum-plan {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
}
fp3d-vacuum-plan img {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  image-rendering: pixelated;
  outline: 2px dashed var(--fp3d-accent, #16b4d8);
}
fp3d-vacuum-plan svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.fp3d-vac-pair circle {
  fill: var(--fp3d-accent, #16b4d8);
  stroke: #fff;
  stroke-width: 2;
}
.fp3d-vac-pair line {
  stroke: var(--fp3d-accent, #16b4d8);
  stroke-width: 2;
  stroke-dasharray: 4 3;
}
.fp3d-vac-pair text {
  fill: #fff;
  font: 600 11px system-ui, sans-serif;
  text-anchor: middle;
  dominant-baseline: central;
}
.fp3d-vac-pending {
  fill: none;
  stroke: #ff9f1c;
  stroke-width: 3;
}
.fp3d-vac-robot {
  fill: #fff;
  stroke: #1d2733;
  stroke-width: 2;
}
.fp3d-vac-dock {
  fill: #3ddc84;
  stroke: #1d2733;
  stroke-width: 2;
}
.fp3d-vac-bar {
  position: absolute;
  left: 50%;
  top: 10px;
  transform: translateX(-50%);
  max-width: calc(100% - 24px);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px 10px;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--fp3d-panel, rgba(20, 26, 34, 0.92));
  color: var(--fp3d-text, #fff);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.3);
  pointer-events: auto;
  font-size: 13px;
}
`.cssText,A=s=>s.settings.vacuum_maps??[];function J(s){let t=s?.states??{};return Object.keys(t).filter(e=>V(e,t[e]?.attributes)).sort()}var N=(s,t)=>s?.states[t]?.attributes?.friendly_name||t;function K(s,t){let e=`vacuum.${t.slice(7).replace(/_map(_\d+)?$/,"")}`;return s?.states[e]?e:null}function k(s,t,e){s.change(i=>{let n=i.settings.vacuum_maps?.find(r=>r.id===t);n&&e(n)})}var S=class extends C{static properties={host:{attribute:!1},doc:{attribute:!1},floor:{attribute:!1},hass:{attribute:!1},align:{attribute:!1},_open:{state:!0}};constructor(){super(),this.align=null,this._open=!1}createRenderRoot(){return this}t(t,e){return this.host.t(t,e)}add(t){if(!t)return;let e=this.floor.id,i={id:O("vac"),camera:t,floor_id:e,vacuum:K(this.hass,t),points:[],opacity:I,show:!0};this.host.change(n=>{n.settings.vacuum_maps=[...A(n),i]}),this.host._vacAlign=i.id}dropMap(t){this.host._vacAlign===t&&(this.host._vacAlign=null),this.host.change(e=>{e.settings.vacuum_maps=A(e).filter(i=>i.id!==t)})}render(){let t=A(this.doc).filter(a=>a.floor_id===this.floor.id),e=J(this.hass),i=new Set(A(this.doc).map(a=>a.camera)),n=e.filter(a=>!i.has(a)),r=Object.keys(this.hass?.states??{}).filter(a=>a.startsWith("vacuum.")).sort(),o=this.host.isEditor;return v`<style>${Y}</style>
      <details class="fp3d-section" ?open=${this._open||t.length>0||!!this.align} @toggle=${a=>this._open=a.target.open}>
        <summary>${this.t("st_vacuum_maps")}</summary>
        <div class="fp3d-form">
          ${t.map(a=>{let c=M(this.hass?.states[a.camera]?.attributes),l=this.align===a.id,u=a.points?.length??0;return v`<div class="fp3d-vac-row">
              <div class="fp3d-vac-title">🧹 ${N(this.hass,a.camera)}</div>
              ${c.calibration?g:v`<p class="fp3d-sub fp3d-wide">${this.t("vac_no_map")}</p>`}
              <label class="fp3d-field"
                >${this.t("vac_vacuum")}
                <select ?disabled=${!o} @change=${p=>k(this.host,a.id,d=>d.vacuum=p.target.value||null)}>
                  <option value="" ?selected=${!a.vacuum}>${this.t("no_ha_floor")}</option>
                  ${[...new Set([...r,...a.vacuum?[a.vacuum]:[]])].map(p=>v`<option value=${p} ?selected=${a.vacuum===p}>${N(this.hass,p)}</option>`)}
                </select></label
              >
              <label class="fp3d-field"
                >${this.t("background_opacity")}
                <input type="range" min="0.1" max="1" step="0.05" .value=${String(a.opacity??I)} ?disabled=${!o} @change=${p=>k(this.host,a.id,d=>d.opacity=parseFloat(p.target.value))}
              /></label>
              <label class="fp3d-check fp3d-wide"
                ><input type="checkbox" .checked=${a.show!==!1} ?disabled=${!o} @change=${p=>k(this.host,a.id,d=>d.show=p.target.checked)} />
                ${this.t("vac_show")}</label
              >
              ${o?v`<button class="fp3d-btn fp3d-wide ${l?"fp3d-primary":""}" aria-pressed=${l} ?disabled=${!c.calibration} @click=${()=>this.host._vacAlign=l?null:a.id}>
                      📐 ${this.t(l?"done":"vac_align")}
                    </button>
                    <p class="fp3d-sub fp3d-wide">${this.t("vac_pairs",{n:u})}</p>
                    <button class="fp3d-btn" ?disabled=${!u} @click=${()=>k(this.host,a.id,p=>p.points=[])}>${this.t("vac_align_reset")}</button>
                    <button class="fp3d-btn fp3d-danger" @click=${()=>this.dropMap(a.id)}>${this.t("delete")}</button>`:g}
            </div>`})}
          ${o&&n.length?v`<label class="fp3d-field fp3d-wide"
                >${this.t("vac_add")}
                <select @change=${a=>{let c=a.target;this.add(c.value),c.value=""}}>
                  <option value="" selected>…</option>
                  ${n.map(a=>v`<option value=${a}>${N(this.hass,a)}</option>`)}
                </select></label
              >`:g}
        </div>
      </details>`}},T=class extends C{static properties={host:{attribute:!1},view:{attribute:!1},doc:{attribute:!1},hass:{attribute:!1},mapId:{attribute:!1},_url:{state:!0},_size:{state:!0},_pending:{state:!0},_error:{state:!0}};loadedFor="";constructor(){super(),this._url=null,this._size=null,this._pending=null,this._error=!1}createRenderRoot(){return this}get map(){return A(this.doc).find(t=>t.id===this.mapId)}connectedCallback(){super.connectedCallback(),this.host&&(this.host._vacPick=t=>this.pick(t))}disconnectedCallback(){super.disconnectedCallback(),this.host?._vacPick&&(this.host._vacPick=null),this._url&&URL.revokeObjectURL(this._url),this._url=null,this.loadedFor=""}willUpdate(){this.host&&(this.host._vacPick=e=>this.pick(e));let t=this.map?.camera??"";t&&t!==this.loadedFor&&(this.loadedFor=t,this.load(t))}async load(t){try{let e=await D(this.hass,t,this.hass?.states[t]?.attributes?.access_token),i=URL.createObjectURL(e),n=new Image;if(n.src=i,await n.decode(),this.loadedFor!==t)return URL.revokeObjectURL(i);this._url&&URL.revokeObjectURL(this._url),this._url=i,this._size=[n.naturalWidth,n.naturalHeight],this._error=!1}catch{this._error=!0}}t(t,e){return this.host.t(t,e)}transforms(){let t=this.map;if(!t||!this._size)return null;let e=M(this.hass?.states[t.camera]?.attributes).calibration,i=this.doc.floors.find(r=>r.id===t.floor_id),n=B(e,this._size,t.points??[],W(i?.rooms??[]));return n&&e?{ip:n,vp:x(n,e)}:null}pick(t){let e=this.transforms(),i=this.map;if(!e||!i)return;if(!this._pending){let r=L(e.vp);if(!r)return;let o=$(r,t);this._pending=[E(o[0],10),E(o[1],10)];return}let n={v:this._pending,p:[E(t[0],1e3),E(t[1],1e3)]};this._pending=null,k(this.host,i.id,r=>r.points=[...r.points??[],n].slice(-3))}undo(){if(this._pending){this._pending=null;return}let t=this.map;t?.points?.length&&k(this.host,t.id,e=>e.points=(e.points??[]).slice(0,-1))}render(){let t=this.map;if(!t)return g;let{scale:e,ox:i,oy:n}=this.view,r=[e,0,0,e,i,n],o=this.transforms(),a=h=>$(r,h),c=M(this.hass?.states[t.camera]?.attributes),l=t.points??[],u=o?this._pending?"vac_tap_plan":"vac_tap_map":this._error||!c.calibration?"vac_no_map":"",p=g,d=g;if(o&&this._url){let h=x(r,o.ip);p=v`<img src=${this._url} alt="" style=${`transform:matrix(${h.join(",")});opacity:${Math.max(.35,t.opacity??I)}`} />`;let P=(m,_,y)=>{if(!m)return g;let[b,f]=a($(o.vp,[m.x,m.y]));return w`<circle class=${_} cx=${b} cy=${f} r=${y} />`};d=w`${P(c.dock,"fp3d-vac-dock",6)}${P(c.robot,"fp3d-vac-robot",7)}
        ${l.map((m,_)=>{let[y,b]=a($(o.vp,m.v)),[f,R]=a(m.p);return w`<g class="fp3d-vac-pair"><line x1=${y} y1=${b} x2=${f} y2=${R} /><circle cx=${f} cy=${R} r="9" /><text x=${f} y=${R}>${_+1}</text></g>`})}
        ${this._pending?(()=>{let[m,_]=a($(o.vp,this._pending));return w`<circle class="fp3d-vac-pending" cx=${m} cy=${_} r="10" />`})():g}`}return v`<style>${Y}</style>${p}<svg aria-hidden="true">${d}</svg>
      <div class="fp3d-vac-bar" role="status">
        <span>${u?`${this.t(u)} \xB7 `:"\u2026 "}${this.t("vac_pairs",{n:l.length})}</span>
        <button class="fp3d-btn" ?disabled=${!this._pending&&!l.length} @click=${()=>this.undo()}>${this.t("undo")}</button>
        <button class="fp3d-btn fp3d-primary" @click=${()=>this.host._vacAlign=null}>${this.t("done")}</button>
      </div>`}};F("fp3d-vacuum-panel",S);F("fp3d-vacuum-plan",T);export{S as VacuumPanel,T as VacuumPlan,K as guessVacuum,J as mapCameras};
