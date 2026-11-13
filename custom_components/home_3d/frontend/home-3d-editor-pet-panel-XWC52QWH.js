import{J as b}from"./home-3d-editor-chunk-B3YWRA4X.js";import{b as d,j as v}from"./home-3d-editor-chunk-TGCLCCRU.js";import{J as f,K as m,Na as $}from"./home-3d-editor-chunk-O7KMRNB2.js";import"./home-3d-editor-chunk-A74QUOUQ.js";import{a as h}from"./home-3d-editor-chunk-TAAEQO2A.js";import{b as u,c as a,f as o,h as g}from"./home-3d-editor-chunk-GGWVF3HT.js";var w=u`
/* a spot or trigger: a two-column grid of labelled fields; the title, the days, the place and the buttons span both (#343) */
.fp3d-pet-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 10px;
  align-items: end;
  padding: 10px 0;
  border-top: 1px solid var(--fp3d-line, rgba(127, 127, 127, 0.25));
}
.fp3d-pet-wide {
  grid-column: 1 / -1;
}
.fp3d-pet-row select,
.fp3d-pet-row input {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}
.fp3d-pet-place,
.fp3d-pet-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.fp3d-pet-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}
.fp3d-pet-days button {
  min-width: 0;
  padding: 2px 0;
}
.fp3d-pet-days button[aria-pressed="false"] {
  opacity: 0.45;
}
.fp3d-pet-on {
  color: var(--fp3d-accent);
  font-weight: 600;
}
`.cssText,E=[0,45,90,135,180,225,270,315],c=class extends g{static properties={pet:{attribute:!1},floors:{attribute:!1},hass:{attribute:!1},home:{attribute:!1},readonly:{attribute:!1},roamOff:{attribute:!1},picking:{attribute:!1},t:{attribute:!1},_live:{state:!0},_refusedEvent:{state:!0}};entityCache=null;unsub=null;constructor(){super(),this.floors=[],this.readonly=!1,this.roamOff=!1,this.picking=null,this.t=t=>t,this._live=void 0}createRenderRoot(){return this}connectedCallback(){super.connectedCallback();let t=this.hass?.connection;!t||this.unsub||(this.unsub=v(t,this.home,s=>this._live=s[this.pet?.id]??null),this.unsub.catch(()=>this.unsub=null))}disconnectedCallback(){super.disconnectedCallback(),this.unsub?.then(t=>t()).catch(()=>{}),this.unsub=null}emit(t){this.dispatchEvent(new CustomEvent("pet-change",{detail:{pet:t},bubbles:!0,composed:!0}))}pick(t){this.dispatchEvent(new CustomEvent("pet-pick",{detail:{ref:t},bubbles:!0,composed:!0}))}setSpot(t,s){this.emit({...this.pet,spots:d(this.pet).map(n=>n.id===t?{...n,...s}:n)})}setTrigger(t,s){this.emit({...this.pet,triggers:(this.pet.triggers??[]).map(n=>n.id===t?{...n,...s}:n)})}time(t,s,n){return a`<label class="fp3d-field">${t}<input type="time" .value=${s??""} ?disabled=${this.readonly} @change=${l=>n(l.target.value||null)} /></label>`}place(t,s,n){let l=this.floors.find(i=>i.id===s.floor_id),r=s.x!=null&&s.z!=null;return a`<label class="fp3d-field"
        >${this.t("pet_pose")}
        <select ?disabled=${this.readonly} @change=${i=>n({pose:i.target.value})}>
          ${f.map(i=>a`<option value=${i} ?selected=${(s.pose??"sit")===i}>${this.t(`pet_pose_${i}`)}</option>`)}
        </select></label
      >
      <label class="fp3d-field"
        >${this.t("pet_turn")}
        <select ?disabled=${this.readonly} @change=${i=>n({rotation:i.target.value===""?null:Number(i.target.value)})}>
          <option value="" ?selected=${s.rotation==null}>${this.t("pet_turn_auto")}</option>
          ${E.map(i=>a`<option value=${i} ?selected=${s.rotation===i}>${i}°</option>`)}
        </select></label
      >
      <div class="fp3d-pet-wide fp3d-pet-place">
        ${this.readonly?o:a`<button class="fp3d-btn" aria-pressed=${this.picking===t} @click=${()=>this.pick(this.picking===t?null:t)}>
              📍 ${this.picking===t?this.t("pet_place_picking"):this.t("pet_place_pick")}
            </button>`}
        <span class="fp3d-sub">${r?l?.name??"":this.t("pet_place_none")}</span>
      </div>`}days(t){let s=this.hass?.language??"en",n=new Intl.DateTimeFormat(s,{weekday:"short"}),l=i=>!t.days?.length||t.days.includes(i),r=i=>{let e=[0,1,2,3,4,5,6].filter(p=>p===i?!l(p):l(p));this.setSpot(t.id,{days:e.length===7||!e.length?null:e})};return a`<div class="fp3d-pet-days fp3d-pet-wide" role="group" aria-label=${this.t("pet_days")}>
      ${[0,1,2,3,4,5,6].map(i=>a`<button class="fp3d-btn" aria-pressed=${l(i)} ?disabled=${this.readonly} @click=${()=>r(i)}>${n.format(new Date(2024,0,1+i))}</button>`)}
    </div>`}drop(t,s){let n=t==="spots"?d(this.pet):this.pet.triggers??[];this.emit({...this.pet,[t]:n.filter(l=>l.id!==s)})}spotRow(t,s,n){let l=this._live?.spot===t.id&&!this._live.trigger,r=i=>{let e=[...n];e.splice(s,1),e.splice(s+i,0,t),this.emit({...this.pet,spots:e})};return a`<div class="fp3d-pet-row">
      <b class="fp3d-pet-wide ${l?"fp3d-pet-on":""}">${this.t("pet_spot_n",{n:s+1})}${l?` \xB7 ${this.t("pet_active")}`:""}</b>
      ${this.place(`spot:${t.id}`,t,i=>this.setSpot(t.id,i))}
      ${this.time(this.t("pet_from"),t.from,i=>this.setSpot(t.id,{from:i}))} ${this.time(this.t("pet_to"),t.to,i=>this.setSpot(t.id,{to:i}))} ${this.days(t)}
      ${this.readonly?o:a`<div class="fp3d-pet-wide fp3d-pet-actions"><button class="fp3d-pin" title=${this.t("move_up")} ?disabled=${!s} @click=${()=>r(-1)}>↑</button>
            <button class="fp3d-pin" title=${this.t("move_down")} ?disabled=${s===n.length-1} @click=${()=>r(1)}>↓</button>
            <button class="fp3d-btn fp3d-danger" @click=${()=>this.drop("spots",t.id)}>${this.t("delete")}</button></div>`}
    </div>`}entities(){let t=this.hass?.states??{},s=Object.keys(t).length;return(!this.entityCache||this.entityCache.count!==s||this.entityCache.registry!==this.hass?.entities)&&(this.entityCache={count:s,registry:this.hass?.entities,list:b(this.hass,()=>!0)}),this.entityCache.list}entity(t,s,n){return a`<label class="fp3d-field fp3d-pet-wide"
      >${t}
      <fp3d-entity-picker
        .options=${this.entities()}
        .fixed=${[{id:"none",label:this.t("entity_none")}]}
        .value=${s||"none"}
        .placeholder=${this.t("entity_search")}
        ?disabled=${this.readonly}
        @change=${l=>{l.stopPropagation(),n(l.detail.value==="none"?null:l.detail.value)}}
      ></fp3d-entity-picker
    ></label>`}triggerRow(t,s){let n=t.kind??"state",l=this._live?.trigger===t.id,r=l&&this._live?.until?new Date(this._live.until).toLocaleTimeString(this.hass?.language,{hour:"2-digit",minute:"2-digit"}):"",i=(e,p,_)=>a`<label class="fp3d-field fp3d-pet-wide">${e}<input type="text" .value=${p??""} ?disabled=${this.readonly} @change=${y=>_(y.target.value.trim()||null)} /></label>`;return a`<div class="fp3d-pet-row">
      <b class="fp3d-pet-wide ${l?"fp3d-pet-on":""}">⚡ ${s+1}${l?` \xB7 ${this.t("pet_active_until",{time:r})}`:""}</b>
      <label class="fp3d-field fp3d-pet-wide"
        >${this.t("pet_trigger_kind")}
        <select ?disabled=${this.readonly} @change=${e=>this.setTrigger(t.id,{kind:e.target.value})}>
          ${["state","event","time"].map(e=>a`<option value=${e} ?selected=${n===e}>${this.t(`pet_trigger_${e}`)}</option>`)}
        </select></label
      >
      ${n==="time"?this.time(this.t("pet_trigger_at"),t.at,e=>this.setTrigger(t.id,{at:e})):n==="event"?a`${i(this.t("pet_trigger_event_type"),t.event,e=>{if(e&&m.includes(e)){this._refusedEvent=t.id;return}this._refusedEvent=null,this.setTrigger(t.id,{event:e})})}
            ${this._refusedEvent===t.id?a`<p class="fp3d-sub fp3d-pet-wide" role="alert">${this.t("pet_trigger_event_refused")}</p>`:o}
            ${this.entity(this.t("pet_trigger_event_entity"),t.entity,e=>this.setTrigger(t.id,{entity:e}))}`:a`${this.entity(this.t("pet_trigger_entity"),t.entity,e=>this.setTrigger(t.id,{entity:e}))}
            ${i(this.t("pet_trigger_to"),t.to,e=>this.setTrigger(t.id,{to:e}))}`}
      ${this.place(`trigger:${t.id}`,t,e=>this.setTrigger(t.id,e))}
      <label class="fp3d-field"
        >${this.t("pet_trigger_minutes")}
        <input type="number" min="0.5" max="1440" step="1" .value=${String(t.minutes??10)} ?disabled=${this.readonly} @change=${e=>this.setTrigger(t.id,{minutes:Math.min(1440,Math.max(.5,Number(e.target.value)||10))})}
      /></label>
      ${this.readonly?o:a`<div class="fp3d-pet-wide fp3d-pet-actions"><button class="fp3d-btn fp3d-danger" @click=${()=>this.drop("triggers",t.id)}>${this.t("delete")}</button></div>`}
    </div>`}render(){let t=this.pet;if(!t)return o;let s=d(t),n=t.triggers??[],l=this._live,r=l?.trigger?n.findIndex(e=>e.id===l.trigger):s.findIndex(e=>e.id===l?.spot),i=l===void 0?"":l?l.trigger?this.t("pet_now_trigger",{n:r+1}):this.t("pet_now_spot",{n:r+1}):this.t("pet_now_free");return a`<style>${w}</style>
      ${this.roamOff?a`<p class="fp3d-note">${this.t("pet_roam_off")}</p>`:i?a`<p class="fp3d-sub" role="status">${i}</p>`:o}
      <section>
        <h3>${this.t("pet_routine")}</h3>
        <p class="fp3d-sub">${this.t("pet_routine_hint")}</p>
        ${s.map((e,p)=>this.spotRow(e,p,s))}
        ${this.readonly?o:a`<button class="fp3d-btn" aria-pressed=${this.picking==="spot:new"} @click=${()=>this.pick(this.picking==="spot:new"?null:"spot:new")}>${this.picking==="spot:new"?`\u{1F4CD} ${this.t("pet_place_picking")}`:`+ ${this.t("pet_spot_add")}`}</button>`}
      </section>
      <section>
        <h3>${this.t("pet_triggers")}</h3>
        <p class="fp3d-sub">${this.t("pet_triggers_hint")}</p>
        ${n.map((e,p)=>this.triggerRow(e,p))}
        ${this.readonly?o:a`<button class="fp3d-btn" @click=${()=>this.emit({...t,triggers:[...n,{id:$("trigger"),kind:"state",entity:null,to:null,event:null,at:null,floor_id:null,x:null,z:null,pose:"sit",rotation:null,minutes:10}]})}>+ ${this.t("pet_trigger_add")}</button>`}
      </section>`}};h("fp3d-pet-panel",c);export{c as PetPanel};
