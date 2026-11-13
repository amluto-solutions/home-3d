import{c as it,e as st}from"./home-3d-chunk-CZLQ7LOX.js";import"./home-3d-chunk-NPWEJ4W3.js";import{c as et,r as L}from"./home-3d-chunk-CDORITH3.js";import"./home-3d-chunk-ZFJT3TUE.js";import{h as H}from"./home-3d-chunk-7GMSEBV6.js";import{b as nt,c as rt}from"./home-3d-chunk-DYZMMTXU.js";import{h as C,o as M}from"./home-3d-chunk-SRQS6QWG.js";import{a as A}from"./home-3d-chunk-ONMNY6HV.js";import{F as J,G as Q,H as P,U as S,a as W,c as b,e as w,g as R,h as U,i as E,k as q,l as V,o as X,r as v}from"./home-3d-chunk-GTALZ6QT.js";import"./home-3d-chunk-COICRQXC.js";import"./home-3d-chunk-K3X4I6FU.js";import{h as Y,i as k}from"./home-3d-chunk-J6KM7YHV.js";import{t as Z,u as tt}from"./home-3d-chunk-E2LI55HK.js";import{c as N,e as D,f as r,i as l,k as F}from"./home-3d-chunk-FEXDU3FT.js";import"./home-3d-chunk-WSBQCKVC.js";async function pt(u,t,e,i){let n=t?u.filter(a=>t.has(a)):[];return n.length?i(n.map(e).join(", ")):!0}var lt=["lights","covers","climate","media","switches","cameras","sensors","scenes"],ut={light:"lights",cover:"covers",climate:"climate",media:"media",switch:"switches",fan:"switches",lock:"switches",camera:"cameras",sensor:"sensors",binary:"sensors",scene:"scenes",script:"scenes"};function dt(u){return u?ut[u]:null}function B(u){let t=(u?.groups??[]).filter(e=>lt.includes(e));return[...new Set([...t,...lt])]}function mt(u,t){if(!t?.length)return[...u];let e=new Map;return t.forEach((n,a)=>!e.has(n)&&e.set(n,a)),[...u.filter(n=>e.has(n)).sort((n,a)=>e.get(n)-e.get(a)),...u.filter(n=>!e.has(n))]}function T(u,t,e){let i=new Set(u.filter(s=>dt(t(s)))),n=[...new Set(e?.pinned??[])].filter(s=>i.has(s)),a=new Set(n),p=mt([...i].filter(s=>!a.has(s)),e?.order),d=B(e).map(s=>({group:s,ids:p.filter(c=>dt(t(c))===s)})).filter(s=>s.ids.length);return{pinned:n,groups:d}}var gt=3e3,bt=[[255,181,71],[255,236,210],[55,224,255],[91,124,255],[255,95,210],[120,255,150]],x=u=>r`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d=${A(u)} />
  </svg>`,z={previous:"M6 6h2v12H6zM20 6v12l-10-6z",play:"M8 5v14l11-7z",pause:"M7 5h4v14H7zM13 5h4v14h-4z",next:"M16 6h2v12h-2zM4 6v12l10-6z"},I=u=>r`<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d=${u} /></svg>`,K=class extends F{static properties={hass:{attribute:!1},room:{attribute:!1},floor:{attribute:!1},building:{attribute:!1},confirmEntities:{attribute:!1},sheets:{attribute:!1},readOnly:{type:Boolean},noLook:{type:Boolean},canEdit:{type:Boolean},_showAll:{state:!0},_editing:{state:!0},_tick:{state:!0}};cameraTimer;memo=null;hasCameras=!1;constructor(){super(),this.room=null,this.floor=null,this.building=null,this.sheets=null,this.readOnly=!1,this.canEdit=!1,this._editing=!1,this._showAll=!1,this._tick=0}resizer=new nt(this,"room_size");sheetSizer=new rt(this,"room_sheet");onWindow=()=>this.resizer.apply();connectedCallback(){super.connectedCallback(),this.resizer.load(),this.sheetSizer.load(),window.addEventListener("resize",this.onWindow),this.cameraTimer=setInterval(()=>{this.hasCameras&&!document.hidden&&this._tick++},gt)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onWindow),clearInterval(this.cameraTimer)}t(t,e){return Y(this.hass,t,e)}call(t,e,i){this.readOnly||W(this.hass,t,e,i,n=>this.t("service_failed",{error:n}))}get areaName(){return this.room?.area_id?this.hass.areas?.[this.room.area_id]?.name:void 0}name(t){return X(this.hass,t,this.areaName)}nameButton(t){return r`<button class="fp3d-rp-name" title=${this.readOnly?l:this.t("details")} @click=${()=>!this.readOnly&&M(this,t)}>${this.name(t)}</button>`}async askFor(t){return!this.confirmEntities?.has(t)||await H(this.t("confirm_switch",{name:this.name(t)}),{ok:this.t("action_confirm_ok"),cancel:this.t("cancel")})}async callAll(t,e,i){if(this.readOnly)return;await pt(i,this.confirmEntities,a=>this.name(a),a=>H(this.t("confirm_switch",{name:a}),{ok:this.t("action_confirm_ok"),cancel:this.t("cancel")}))&&this.call(t,e,{entity_id:i})}toggle(t,e,i){let n=async()=>{this.readOnly||await this.askFor(t.entity_id)&&i()};return r`<button
      class="fp3d-switch"
      role="switch"
      aria-checked=${e?"true":"false"}
      aria-label=${this.name(t.entity_id)}
      ?disabled=${v(t)}
      @click=${n}
    ></button>`}renderHere(t){if(!this.building||!et("locate")||!it(this.building))return l;let e=st(this.hass,this.building).filter(i=>i.roomId===t.id);return e.length?r`<p class="fp3d-rp-facts fp3d-rp-here">
      ${e.map((i,n)=>r`${n?", ":""}<span style="color:${i.color}">●</span> ${i.name}`)}
    </p>`:l}async focusHeading(){await this.updateComplete,this.renderRoot.querySelector(".fp3d-rp-head h2")?.focus()}render(){let t=this.room;if(!t||!this.hass)return l;let e=R(this.hass,t.area_id),i=this.memo,{shown:n,more:a}=i&&i.entities===this.hass.entities&&i.floor===this.floor&&i.building===this.building&&i.room===t?i:this.memo={entities:this.hass.entities,floor:this.floor,building:this.building,room:t,...this.floor?S(this.hass,this.floor,t,this.building?L(this.building,t.id):[]):{shown:e,more:[]}},p=P(this.hass,a).map(o=>o.primary),d=t.panel_layout,s=new Set(d?.pinned??[]),c=p.filter(o=>!s.has(o)).length,f=this._showAll?[...n,...p]:[...n,...p.filter(o=>s.has(o))],m=f.filter(o=>!!this.hass.states[o]),h=T(m,b,d),_=o=>m.filter($=>o.includes(b($))).map($=>this.hass.states[$]),y=_(["light"]),ct=_(["cover"]),ht=_(["climate"]);this.hasCameras=_(["camera"]).length>0;let G=this.facts(ht),ft=y.filter(o=>o.state==="on"),j=this.canEdit&&!this.readOnly&&!!t.area_id,O=j&&this._editing,g=this.sheetSizer;return r`<section class="fp3d-rp ${this.readOnly?"fp3d-rp-ro":""}" aria-label=${t.name}>
      <div
        class="fp3d-rp-grab"
        role="separator"
        aria-orientation="horizontal"
        tabindex="0"
        aria-label=${this.t("room_sheet_hint")}
        title=${this.t("room_sheet_hint")}
        @pointerdown=${o=>g.begin(o)}
        @pointermove=${o=>g.move(o)}
        @pointerup=${()=>g.end()}
        @pointercancel=${()=>g.end()}
        @keydown=${o=>g.key(o)}
        @dblclick=${()=>g.reset()}
      ><span aria-hidden="true"></span></div>
      <header
        class="fp3d-rp-head"
        @pointerdown=${o=>g.begin(o)}
        @pointermove=${o=>g.move(o)}
        @pointerup=${()=>g.end()}
        @pointercancel=${()=>g.end()}
      >
        <div>
          <h2 tabindex="-1">${t.name}</h2>
          ${G.length?r`<p class="fp3d-rp-facts">${G.join(" \xB7 ")}</p>`:l}
          ${this.renderHere(t)}
          ${this.readOnly?r`<p class="fp3d-rp-facts fp3d-rp-ro-note">⏪ ${this.t("tt_readonly")}</p>`:l}
          ${this.sheets?.length&&!this.readOnly?r`<div class="fp3d-rp-sheets">
                ${this.sheets.map(o=>r`<button class="fp3d-rp-sheet" @click=${()=>this.dispatchEvent(new CustomEvent("sheet-open",{detail:{id:o.id},bubbles:!0,composed:!0}))}>
                    <span aria-hidden="true">${o.icon}</span>${o.title}
                  </button>`)}
              </div>`:l}
        </div>
        ${j?r`<button class="fp3d-btn fp3d-rp-small fp3d-rp-edit" aria-pressed=${O?"true":"false"} @click=${()=>this.toggleEdit()}>
              ${this.t(O?"done":"panel_edit_list")}
            </button>`:l}
        <button class="fp3d-rp-close" aria-label=${this.t("close")} @click=${()=>this.fire("close")}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </header>
      <div class="fp3d-rp-body">
        <!-- time travel: one disabled fieldset greys out and disables every control inside it, with one tooltip (#210) -->
        <fieldset class="fp3d-rp-controls" ?disabled=${this.readOnly} title=${this.readOnly?this.t("tt_past_no"):l}>
        ${t.area_id?f.length?l:r`<p class="fp3d-rp-note">${this.t(this.canEdit?"panel_empty":"panel_empty_viewer")}</p>`:r`<p class="fp3d-rp-note">${this.t(this.canEdit?"panel_no_area":"panel_no_area_viewer")}</p>`}
        ${O?r`<fp3d-room-list-edit
              .hass=${this.hass}
              .roomId=${t.id}
              .arranged=${this.editList(t)}
              .hiddenIds=${t.hidden??[]}
              .layout=${d??null}
              .allGroups=${B(d)}
              .nameOf=${o=>this.name(o)}
              .iconOf=${o=>{let $=b(o);return $?A($):null}}
              .t=${o=>this.t(o)}
            ></fp3d-room-list-edit>`:r`${h.pinned.length?this.section("panel_pinned",h.pinned.map(o=>this.rowOf(this.hass.states[o]))):l}
            ${h.groups.map(o=>this.groupSection(o.group,o.ids,y,ft,ct))}`}
        </fieldset>
        ${c?r`<button class="fp3d-btn fp3d-rp-small fp3d-rp-more" @click=${()=>this._showAll=!this._showAll}>
              ${this._showAll?this.t("panel_less"):this.t("panel_more",{n:c})}
            </button>`:l}
      </div>
      ${["w","s","sw"].map(o=>this.renderEdge(o))}
    </section>`}renderEdge(t){return r`<div
      class="fp3d-rz fp3d-rz-${t}"
      role="separator"
      tabindex="0"
      aria-label=${this.t("room_resize_hint")}
      title=${this.t("room_resize_hint")}
      @pointerdown=${e=>this.resizer.begin(e,t)}
      @pointermove=${e=>this.resizer.move(e)}
      @pointerup=${()=>this.resizer.end()}
      @pointercancel=${()=>this.resizer.end()}
      @keydown=${e=>this.resizer.key(e,t)}
      @dblclick=${()=>this.resizer.reset()}
    ></div>`}toggleEdit(){if(this._editing){this._editing=!1;return}import("./home-3d-listedit-MUJUYILF.js").then(()=>this._editing=!0)}editList(t){let e={...t,hidden:[]},{shown:i,more:n}=this.floor?S(this.hass,this.floor,e,this.building?L(this.building,t.id):[]):{shown:R(this.hass,t.area_id),more:[]},a=new Set([...t.hidden??[],...t.panel_layout?.pinned??[]]),p=P(this.hass,n).map(d=>d.primary).filter(d=>this._showAll||a.has(d));return T([...new Set([...i,...p])].filter(d=>!!this.hass.states[d]),b,t.panel_layout)}rowOf(t){let e=b(t.entity_id);return e==="light"?this.lightRow(t):e==="cover"?this.coverRow(t):e==="climate"?this.climateRow(t):e==="media"?this.mediaRow(t):e==="camera"?this.cameraTile(t):e==="sensor"||e==="binary"?this.sensorRow(t):e==="scene"||e==="script"?r`<div class="fp3d-rp-scenes">${this.sceneButton(t)}</div>`:this.switchRow(t)}sceneButton(t){return r`<button class="fp3d-btn" ?disabled=${v(t)} @click=${()=>this.call(b(t.entity_id)==="scene"?"scene":"script","turn_on",{entity_id:t.entity_id})}>
      ${this.name(t.entity_id)}
    </button>`}groupSection(t,e,i,n,a){let p=e.map(s=>this.hass.states[s]);if(t==="lights")return this.section("panel_lights",p.map(s=>this.lightRow(s)),r`${n.length<i.length?r`<button class="fp3d-btn fp3d-rp-small" @click=${()=>this.callAll("light","turn_on",i.filter(s=>!v(s)).map(s=>s.entity_id))}>
              ${this.t("panel_all_on")}
            </button>`:l}${n.length?r`<button class="fp3d-btn fp3d-rp-small" @click=${()=>this.callAll("light","turn_off",n.map(s=>s.entity_id))}>
              ${this.t("panel_all_off")}
            </button>`:l}`);if(t==="covers")return this.section("panel_covers",p.map(s=>this.coverRow(s)),a.filter(s=>w(s).open||w(s).close).length>1?r`<button class="fp3d-btn fp3d-rp-small" @click=${()=>this.callAll("cover","open_cover",a.filter(s=>!v(s)&&w(s).open).map(s=>s.entity_id))}>
                ${this.t("panel_all_open")}</button
              ><button class="fp3d-btn fp3d-rp-small" @click=${()=>this.callAll("cover","close_cover",a.filter(s=>!v(s)&&w(s).close).map(s=>s.entity_id))}>
                ${this.t("panel_all_close")}
              </button>`:l);if(t==="scenes")return this.section("panel_scenes",[r`<div class="fp3d-rp-scenes">${p.map(s=>this.sceneButton(s))}</div>`]);let d={climate:"panel_climate",media:"panel_media",switches:"panel_switches",cameras:"panel_cameras",sensors:"panel_sensors"};return this.section(d[t],p.map(s=>this.rowOf(s)))}facts(t){let e=[],i=this.room,n=(s,c)=>{let f=V(this.hass,this.floor,i,s);if(f===null)return null;if(s==="temperature")return`${k(this.hass,q(this.hass,f),1)} ${E(this.hass)}`;let m=U(this.hass,this.floor,i,s)[0],h=this.hass.states[m]?.attributes.unit_of_measurement??c;return`${k(this.hass,f,1)} ${h}`},a=t.find(s=>typeof s.attributes.current_temperature=="number"),p=n("temperature","\xB0C");p?e.push(p):a&&i.climate?.temperature!=="none"&&e.push(`${k(this.hass,a.attributes.current_temperature,1)} ${E(this.hass)}`);let d=n("humidity","%");return d&&e.push(d),e}section(t,e,i=l){return r`<div class="fp3d-rp-sec">
      <div class="fp3d-rp-sec-head"><h3>${this.t(t)}</h3>${i}</div>
      ${e}
    </div>`}lightRow(t){let e=t.attributes,i=t.state==="on",n=e.supported_color_modes??[],a=n.some(h=>h!=="onoff"),p=n.includes("color_temp"),d=n.some(h=>["hs","rgb","rgbw","rgbww","xy"].includes(h)),s=typeof e.brightness=="number"?Math.round(e.brightness/255*100):100,c=e.min_color_temp_kelvin??2200,f=e.max_color_temp_kelvin??6500,m=t.entity_id;return r`<div class="fp3d-rp-row">
      <span class="fp3d-rp-icon ${i?"fp3d-rp-on":""}">${x("light")}</span>
      ${this.nameButton(m)}
      <span class="fp3d-rp-state">${this.stateOf(t)}</span>
      ${this.toggle(t,i,()=>this.call("light","toggle",{entity_id:m}))}
      ${i&&a?r`<label class="fp3d-rp-slider"
            ><span>${this.t("brightness")}</span>
            <input
              type="range"
              min="1"
              max="100"
              .value=${String(s)}
              @change=${h=>this.call("light","turn_on",{entity_id:m,brightness_pct:Number(h.target.value)})}
          /></label>`:l}
      ${i&&p?r`<label class="fp3d-rp-slider fp3d-rp-ct"
            ><span>${this.t("color_temp")}</span>
            <input
              type="range"
              min=${c}
              max=${f}
              step="50"
              .value=${String(e.color_temp_kelvin??c)}
              @change=${h=>this.call("light","turn_on",{entity_id:m,color_temp_kelvin:Number(h.target.value)})}
          /></label>`:l}
      ${i&&d?r`<div class="fp3d-rp-swatches" role="group" aria-label=${this.t("color")}>
            ${bt.map(h=>r`<button
                class="fp3d-rp-swatch"
                style="--c: rgb(${h.join(",")})"
                aria-label="rgb(${h.join(", ")})"
                @click=${()=>this.call("light","turn_on",{entity_id:m,rgb_color:h})}
              ></button>`)}
          </div>`:l}
    </div>`}coverRow(t){let e=t.attributes,i=w(t),n=t.entity_id,a=v(t),p=(c,f,m=!1)=>r`<button class="fp3d-btn fp3d-rp-small" ?disabled=${a} @click=${async()=>(!m||await this.askFor(n))&&this.call("cover",f,{entity_id:n})}>${this.t(c)}</button>`,d=Q(this.building,n),s=(c,f,m,h,_=y=>y)=>r`<label class="fp3d-rp-slider"
        ><span>${this.t(c)}</span>
        <input
          type="range"
          min="0"
          max="100"
          ?disabled=${a}
          .value=${String(f)}
          @change=${y=>this.call("cover",m,{entity_id:n,[h]:_(Number(y.target.value))})}
      /></label>`;return r`<div class="fp3d-rp-row">
      <span class="fp3d-rp-icon">${x("cover")}</span>
      ${this.nameButton(n)}
      <span class="fp3d-rp-state">${this.stateOf(t)}</span>
      <div class="fp3d-rp-buttons">
        ${i.open?p("cover_open","open_cover",!0):l}${i.stop?p("cover_stop","stop_cover"):l}${i.close?p("cover_close","close_cover",!0):l}
      </div>
      ${i.position?s("position",e.current_position,"set_cover_position","position"):l}
      ${i.tiltOpen||i.tiltStop||i.tiltClose?r`<div class="fp3d-rp-buttons fp3d-rp-wide">
            ${i.tiltOpen?p("cover_tilt_open","open_cover_tilt"):l}${i.tiltStop?p("cover_stop","stop_cover_tilt"):l}${i.tiltClose?p("cover_tilt_close","close_cover_tilt"):l}
          </div>`:l}
      ${i.tiltPosition?s("cover_tilt",J(t,d)??0,"set_cover_tilt_position","tilt_position",c=>d?100-c:c):l}
    </div>`}climateRow(t){let e=t.attributes,i=t.entity_id,n=typeof e.temperature=="number"?e.temperature:null,a=e.target_temp_step??.5,p=e.min_temp??5,d=e.max_temp??30,s=e.hvac_modes??[],c=f=>this.call("climate","set_temperature",{entity_id:i,temperature:Math.min(d,Math.max(p,Math.round(f/a)*a))});return r`<div class="fp3d-rp-row">
      <span class="fp3d-rp-icon ${e.hvac_action==="heating"?"fp3d-rp-on":""}">${x("climate")}</span>
      ${this.nameButton(i)}
      <span class="fp3d-rp-state">${this.stateOf(t)}</span>
      ${n!==null?r`<div class="fp3d-rp-stepper fp3d-rp-wide">
            <button class="fp3d-btn" aria-label=${this.t("temp_down")} @click=${()=>c(n-a)}>−</button>
            <span><small>${this.t("target_temp")}</small> ${k(this.hass,n,1)} ${E(this.hass)}</span>
            <button class="fp3d-btn" aria-label=${this.t("temp_up")} @click=${()=>c(n+a)}>+</button>
          </div>`:l}
      ${s.length>1?r`<div class="fp3d-rp-chips">
            ${s.map(f=>r`<button
                class="fp3d-chip"
                aria-pressed=${t.state===f}
                @click=${()=>this.call("climate","set_hvac_mode",{entity_id:i,hvac_mode:f})}
              >
                ${this.stateLabel(f)}
              </button>`)}
          </div>`:l}
    </div>`}stateOf(t,e=C(this.hass,t)){if(this.room?.no_state?.includes(t.entity_id))return"";let i=b(t.entity_id);return t.state==="unknown"&&i!=="sensor"&&i!=="binary"?"":e}stateLabel(t){let e=`state_${t}`,i=this.t(e);return i===e?t:i}mediaRow(t){let e=t.attributes,i=t.entity_id,n=v(t)||t.state==="off",a=[e.media_title,e.media_artist].filter(p=>typeof p=="string"&&p).join(" \xB7 ");return r`<div class="fp3d-rp-row">
      <span class="fp3d-rp-icon ${t.state==="playing"?"fp3d-rp-on":""}">${x("media")}</span>
      ${this.nameButton(i)}
      <span class="fp3d-rp-state">${this.stateOf(t,this.stateLabel(t.state))}</span>
      ${a?r`<p class="fp3d-rp-media fp3d-rp-wide">${a}</p>`:l}
      <div class="fp3d-rp-buttons fp3d-rp-wide">
        <button class="fp3d-btn fp3d-rp-small" aria-label=${this.t("previous")} ?disabled=${n} @click=${()=>this.call("media_player","media_previous_track",{entity_id:i})}>
          ${I(z.previous)}
        </button>
        <button class="fp3d-btn fp3d-rp-small" aria-label=${this.t("play_pause")} ?disabled=${v(t)} @click=${()=>this.call("media_player",t.state==="playing"?"media_pause":"media_play",{entity_id:i})}>
          ${I(t.state==="playing"?z.pause:z.play)}
        </button>
        <button class="fp3d-btn fp3d-rp-small" aria-label=${this.t("next")} ?disabled=${n} @click=${()=>this.call("media_player","media_next_track",{entity_id:i})}>
          ${I(z.next)}
        </button>
      </div>
      ${typeof e.volume_level=="number"?r`<label class="fp3d-rp-slider"
            ><span>${this.t("volume")}</span>
            <input
              type="range"
              min="0"
              max="100"
              .value=${String(Math.round(e.volume_level*100))}
              @change=${p=>this.call("media_player","volume_set",{entity_id:i,volume_level:Number(p.target.value)/100})}
          /></label>`:l}
    </div>`}switchRow(t){let e=t.entity_id,i=b(e),n=e.slice(0,e.indexOf(".")),a=i==="lock"?t.state==="unlocked"||t.state==="open":t.state==="on",p=()=>i==="lock"?this.call("lock",a?"lock":"unlock",{entity_id:e}):this.call(n,"toggle",{entity_id:e});return r`<div class="fp3d-rp-row">
      <span class="fp3d-rp-icon ${a?"fp3d-rp-on":""}">${x(i)}</span>
      ${this.nameButton(e)}
      <span class="fp3d-rp-state">${this.stateOf(t)}</span>
      ${this.toggle(t,a,p)}
    </div>`}cameraTile(t){let e=t.attributes.entity_picture,i=e&&!v(t)?e.startsWith("data:")?e:`${e}${e.includes("?")?"&":"?"}fp3d=${this._tick}`:null,n=this.floor?.placements.some(p=>p.entity_id===t.entity_id),a=r`${i?r`<img src=${i} alt=${this.name(t.entity_id)} loading="lazy" />`:r`<span class="fp3d-rp-note">${C(this.hass,t)}</span>`}
      <span class="fp3d-rp-camera-name">${this.name(t.entity_id)}</span>`;return r`<div class="fp3d-rp-camera-wrap">
      ${this.readOnly?r`<div class="fp3d-rp-camera fp3d-rp-camera-still">${a}</div>`:r`<button class="fp3d-rp-camera" title=${this.t("camera_live")} @click=${()=>M(this,t.entity_id)}>${a}</button>`}
      ${n&&!this.noLook&&!this.readOnly?r`<button
            class="fp3d-rp-look"
            title=${this.t("through_camera")}
            @click=${()=>this.dispatchEvent(new CustomEvent("camera-look",{detail:{entity:t.entity_id},bubbles:!0,composed:!0}))}
          >
            ${this.t("through_camera")}
          </button>`:l}
    </div>`}sensorRow(t){let e=b(t.entity_id),i=e==="binary"&&t.state==="on";return r`<div class="fp3d-rp-row">
      <span class="fp3d-rp-icon ${i?"fp3d-rp-on":""}">${x(e)}</span>
      ${this.nameButton(t.entity_id)}
      <span class="fp3d-rp-state">${this.stateOf(t)}</span>
    </div>`}fire(t){this.dispatchEvent(new CustomEvent(t,{bubbles:!0,composed:!0}))}static styles=[Z,tt,D`:host{display:block}:host([sized]) .fp3d-rp{height:100%}.fp3d-rz{position:absolute;z-index:2;touch-action:none}.fp3d-rz-w{left:0;top:18px;bottom:18px;width:8px;cursor:ew-resize}.fp3d-rz-s{left:18px;right:18px;bottom:0;height:8px;cursor:ns-resize}.fp3d-rz-sw{left:0;bottom:0;width:18px;height:18px;cursor:nesw-resize}.fp3d-rz:hover,.fp3d-rz:focus-visible{background:var(--fp3d-accent);opacity:0.45}.fp3d-rp-grab{display:none}@container fp3d ((max-width:700px) or ((orientation:portrait) and (max-width:1000px))){:host{--fp3d-sheet:1}.fp3d-rz{display:none}.fp3d-rp-grab{display:flex;justify-content:center;align-items:center;flex:none;height:22px;cursor:ns-resize;touch-action:none}.fp3d-rp-grab span{width:40px;height:5px;border-radius:3px;background:var(--fp3d-muted);opacity:0.6}.fp3d-rp-grab:focus-visible{outline:2px solid var(--fp3d-accent);outline-offset:-2px}.fp3d-rp-head{touch-action:none}}.fp3d-rp{position:relative;pointer-events:auto;display:flex;flex-direction:column;max-height:100%;background:var(--fp3d-chrome-solid);border:1px solid var(--fp3d-line);border-radius:18px;box-shadow:var(--fp3d-shadow);overflow:hidden}.fp3d-rp-controls{display:contents;border:0;margin:0;padding:0;min-width:0}.fp3d-rp-ro .fp3d-rp-body :is(button,input,select):disabled{opacity:0.45;cursor:not-allowed}.fp3d-rp-camera-still{cursor:default}.fp3d-rp-ro-note{color:#ffb020}.fp3d-rp-head{display:flex;align-items:flex-start;gap:10px;padding:14px 14px 10px 16px;border-bottom:1px solid var(--fp3d-line)}.fp3d-rp-head > div{flex:1;min-width:0}.fp3d-rp-sheets{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.fp3d-rp-sheet{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid var(--fp3d-line);background:color-mix(in srgb,var(--fp3d-accent,#37e0ff) 12%,transparent);color:inherit;font:inherit;font-size:13px;cursor:pointer}.fp3d-rp-sheet:hover{border-color:var(--fp3d-accent,#37e0ff)}h2:focus:not(:focus-visible){outline:none}h2{margin:0;font:700 21px var(--fp3d-title-font);letter-spacing:-0.01em}.fp3d-rp-facts{margin:2px 0 0;color:var(--fp3d-muted);font-size:13px;font-variant-numeric:tabular-nums}.fp3d-rp-close{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,0.06);color:var(--fp3d-text);cursor:pointer}.fp3d-rp-body{overflow-y:auto;padding:6px 14px 16px 16px;display:grid;gap:14px;overscroll-behavior:contain}.fp3d-rp-note{color:var(--fp3d-muted);font-size:13px;margin:8px 0 0}.fp3d-rp-sec-head{display:flex;align-items:center;justify-content:space-between;margin-top:6px}h3{margin:0;font-size:11.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--fp3d-muted)}.fp3d-rp-row{display:grid;grid-template-columns:28px 1fr auto auto;align-items:center;gap:6px 10px;padding:9px 0;border-bottom:1px solid var(--fp3d-line)}.fp3d-rp-row:last-child{border-bottom:none}.fp3d-rp-row > :nth-child(n + 5),.fp3d-rp-row > .fp3d-rp-wide{grid-column:2 / -1}.fp3d-rp-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;color:var(--fp3d-muted);background:rgba(91,124,255,0.12)}.fp3d-rp-on{color:#2a1a00;background:var(--fp3d-warm);box-shadow:0 0 14px rgba(255,181,71,0.55)}.fp3d-rp-name{font:inherit;font-weight:500;color:var(--fp3d-text);background:none;border:none;padding:0;text-align:left;cursor:pointer;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fp3d-rp-state{font-size:12.5px;color:var(--fp3d-muted);font-variant-numeric:tabular-nums;white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis}.fp3d-rp-row > .fp3d-rp-state:last-child{grid-column:3 / -1;justify-self:end}.fp3d-switch{position:relative;width:44px;height:26px;border-radius:999px;border:none;background:rgba(255,255,255,0.1);cursor:pointer}.fp3d-switch::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#e6eefc;transition:transform 0.2s ease}.fp3d-switch[aria-checked="true"]{background:var(--fp3d-warm)}.fp3d-switch[aria-checked="true"]::after{transform:translateX(18px)}.fp3d-switch:disabled{opacity:0.4;cursor:default}.fp3d-rp-slider{display:grid;grid-template-columns:110px 1fr;align-items:center;gap:10px;font-size:12px;color:var(--fp3d-muted)}.fp3d-rp-slider input{width:100%;accent-color:var(--fp3d-accent)}.fp3d-rp-ct input{accent-color:var(--fp3d-warm)}.fp3d-rp-swatches,.fp3d-rp-buttons,.fp3d-rp-chips,.fp3d-rp-scenes{display:flex;flex-wrap:wrap;gap:6px}.fp3d-rp-swatch{width:26px;height:26px;border-radius:50%;border:1px solid rgba(255,255,255,0.2);background:var(--c);box-shadow:0 0 10px var(--c);cursor:pointer}.fp3d-rp-camera{position:relative;display:block;width:100%;aspect-ratio:16 / 9;margin:6px 0;padding:0;border:1px solid var(--fp3d-line);border-radius:12px;overflow:hidden;background:#05080f;cursor:pointer}.fp3d-rp-camera img{width:100%;height:100%;object-fit:cover;display:block}.fp3d-rp-camera-wrap{position:relative}.fp3d-rp-look{position:absolute;right:8px;bottom:12px;padding:4px 10px;border:1px solid var(--fp3d-line);border-radius:999px;background:rgba(7,11,20,0.8);color:var(--fp3d-accent);font:inherit;font-size:12px;font-weight:600;cursor:pointer}.fp3d-rp-camera-name{position:absolute;left:8px;bottom:6px;padding:2px 8px;border-radius:8px;background:rgba(7,11,20,0.75);color:var(--fp3d-text);font-size:12px;font-weight:600}.fp3d-rp-more{justify-self:start}.fp3d-rp-small{display:inline-flex;align-items:center;justify-content:center;padding:5px 10px;min-height:30px;font-size:13px}.fp3d-rp-stepper{display:flex;align-items:center;gap:10px;font-variant-numeric:tabular-nums;font-weight:600}.fp3d-rp-stepper small{color:var(--fp3d-muted);font-weight:500;margin-right:4px}.fp3d-rp-stepper .fp3d-btn{width:36px;padding:4px 0;font-size:17px}.fp3d-rp-chips .fp3d-chip{box-shadow:none;border:1px solid var(--fp3d-line);min-height:30px;padding:4px 11px;font-size:13px}.fp3d-rp-media{margin:0;font-size:12.5px;color:var(--fp3d-muted)}button:focus-visible,input:focus-visible{outline:2px solid var(--fp3d-accent);outline-offset:2px}@media (pointer:coarse){.fp3d-rp-close,.fp3d-rp-icon,.fp3d-rp-swatch{width:44px;height:44px}.fp3d-rp-stepper .fp3d-btn{width:44px}.fp3d-rp-row{grid-template-columns:44px 1fr auto auto}.fp3d-rp-small,.fp3d-rp-sheet,.fp3d-rp-chips .fp3d-chip{min-height:44px}}`]};N("fp3d-room-panel",K);export{K as Fp3dRoomPanel};
