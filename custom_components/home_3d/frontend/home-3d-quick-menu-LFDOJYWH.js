import"./home-3d-chunk-NPWEJ4W3.js";import{h as T}from"./home-3d-chunk-7GMSEBV6.js";import{a as H,b as O}from"./home-3d-chunk-5MCQ5WN7.js";import{h as m,o as S}from"./home-3d-chunk-SRQS6QWG.js";import"./home-3d-chunk-ONMNY6HV.js";import{F as k,a as _,c as $,d as C,e as q,o as h,r as M}from"./home-3d-chunk-GTALZ6QT.js";import"./home-3d-chunk-COICRQXC.js";import"./home-3d-chunk-K3X4I6FU.js";import{h as I}from"./home-3d-chunk-J6KM7YHV.js";import{t as L}from"./home-3d-chunk-E2LI55HK.js";import{c as y,e as w,f as n,i as p,k as E}from"./home-3d-chunk-FEXDU3FT.js";import"./home-3d-chunk-WSBQCKVC.js";function z(d){return`url("${d.replace(/[\\"\n\r\f]/g,t=>`\\${t.charCodeAt(0).toString(16)} `)}")`}var j=[[255,181,71],[255,236,210],[55,224,255],[91,124,255],[190,90,255],[255,95,210],[255,70,70],[120,255,150]],N=[2200,2700,3200,4e3,5e3,6500],A=16,K=32,U=128;function V(d,t=!1){let e=q(d),s=(l=>typeof l=="number"?l:null)(d.attributes.current_position),o=k(d,t),r=d.state==="closed";if(e.open||e.close)return((s!==null?s<50:r)?e.open:!e.close)?{service:"open_cover",open:!0}:{service:"close_cover",open:!1};if(e.position)return s<50?{service:"set_cover_position",data:{position:100},open:!0}:{service:"set_cover_position",data:{position:0},open:!1};if(e.tiltOpen||e.tiltClose)return((o!==null?o<50:r)?e.tiltOpen:!e.tiltClose)?{service:"open_cover_tilt",open:!0}:{service:"close_cover_tilt",open:!1};let c=l=>t?100-l:l;return e.tiltPosition?o<50?{service:"set_cover_tilt_position",data:{tilt_position:c(100)},open:!0}:{service:"set_cover_tilt_position",data:{tilt_position:c(0)},open:!1}:null}var x=class extends E{static properties={hass:{attribute:!1},entity:{attribute:!1},car:{attribute:!1},presets:{attribute:!1},confirmSwitch:{type:Boolean},doorLock:{type:Boolean},noLook:{type:Boolean},slatInvert:{type:Boolean},low:{type:Boolean,reflect:!0},_tick:{state:!0}};tickTimer;connectedCallback(){super.connectedCallback(),this._tick=0,this.tickTimer=setInterval(()=>{$(this.entity)==="camera"&&!document.hidden&&this._tick++},3e3)}disconnectedCallback(){super.disconnectedCallback(),clearInterval(this.tickTimer)}renderCamera(t){let e=t.attributes.entity_picture,i=e?e.startsWith("data:")?e:`${e}${e.includes("?")?"&":"?"}fp3d=${this._tick}`:null;return n`<button class="qm-camera" title=${this.t("camera_live")} @click=${()=>this.details()}>
        ${i?n`<img src=${i} alt=${h(this.hass,this.entity)} />`:n`<span class="qm-note">${m(this.hass,t)}</span>`}
      </button>
      ${this.noLook?p:n`<button class="qm-details qm-look" @click=${()=>this.dispatchEvent(new CustomEvent("camera-look",{detail:{entity:this.entity},bubbles:!0,composed:!0}))}>
            ${this.t("through_camera")}
          </button>`}`}t(t,e){return I(this.hass,t,e)}async ask(){return!this.confirmSwitch||await this.question(this.t("confirm_switch",{name:h(this.hass,this.entity)}))}async guarded(t){await this.ask()&&t()}question(t){return T(t,{ok:this.t("action_confirm_ok"),cancel:this.t("cancel")})}call(t,e,i={}){_(this.hass,t,e,{entity_id:this.entity,...i},s=>this.t("service_failed",{error:s}))}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}details(){S(this,this.entity),this.close()}ring(t){let e=t.length;return t.map((i,s)=>{let o=s/e*Math.PI*2-Math.PI/2;return n`<div class="qm-at" style="left:${50+Math.cos(o)*39}%;top:${50+Math.sin(o)*39}%">${i}</div>`})}renderLight(t){let e=H(t),i=t.state==="on",s=i&&typeof t.attributes.brightness=="number"?Math.round(t.attributes.brightness/2.55):i?100:0,o=e.color?j.map(r=>n`<button class="qm-swatch" style="background:rgb(${r.join(",")})" aria-label=${`RGB ${r.join(", ")}`} @click=${()=>this.call("light","turn_on",{rgb_color:r})}></button>`):e.temp?N.map(r=>n`<button class="qm-swatch" style="background:${W(r)}" aria-label=${`${r} K`} @click=${()=>this.call("light","turn_on",{color_temp_kelvin:r})}></button>`):[];return n`<div class="qm-ring ${o.length?"":"qm-ring-small"}">
        ${this.ring(o)}
        <button class="qm-power ${i?"qm-on":""}" aria-pressed=${i} @click=${()=>{this.guarded(()=>this.call("light","toggle"))}}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0" /></svg>
          <b>${i?`${s} %`:this.t("qm_off")}</b>
        </button>
      </div>
      ${e.dim?n`<input
            class="qm-slider"
            type="range"
            min="1"
            max="100"
            .value=${String(Math.max(1,s))}
            aria-label=${this.t("brightness")}
            @change=${r=>this.call("light","turn_on",{brightness_pct:Number(r.target.value)})}
          />`:p}`}renderCover(t){let e=typeof t.attributes.current_position=="number"?t.attributes.current_position:null,i=t.state==="opening"||t.state==="closing",s=O(t),o=q(t),r=V(t,this.slatInvert),c=(a,v,b,f=!1)=>n`<button class="qm-swatch qm-slot ${f?"qm-slot-on":""}" aria-label=${v} @click=${b}>${a}</button>`,l=a=>e!==null&&Math.abs(e-a)<3,u=[...o.open?[c("\u25B2",this.t("cover_open"),()=>{this.guarded(()=>this.call("cover","open_cover"))},l(100))]:[],...s?[75,50].map(a=>c(`${a}`,`${a} %`,()=>{this.guarded(()=>this.call("cover","set_cover_position",{position:a}))},l(a))):[],...o.close?[c("\u25BC",this.t("cover_close"),()=>{this.guarded(()=>this.call("cover","close_cover"))},l(0))]:[],...s?[25].map(a=>c(`${a}`,`${a} %`,()=>{this.guarded(()=>this.call("cover","set_cover_position",{position:a}))},l(a))):[],...o.stop?[c("\u25A0",this.t("cover_stop"),()=>this.call("cover","stop_cover"),i)]:[]],g=e===null?t.state==="closed"?100:0:100-e;return n`<div class="qm-ring">
        ${this.ring(u)}
        ${r||i&&o.stop?n`<button
          class="qm-power qm-blind ${g<100?"qm-on":""}"
          style="--closed:${g}%"
          aria-label=${i&&o.stop?this.t("cover_stop"):r.service.includes("tilt")?this.t(r.open?"cover_tilt_open":"cover_tilt_close"):r.open?this.t("cover_open"):this.t("cover_close")}
          @click=${()=>i&&o.stop?this.call("cover","stop_cover"):void this.guarded(()=>this.call("cover",r.service,r.data))}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h16M5 4v15M19 4v15M7 8h10M7 12h10M7 16h10" /></svg>
          <b>${e!==null?`${e} %`:m(this.hass,t)}</b>
        </button>`:p}
      </div>
      ${s?n`<input
            class="qm-slider"
            type="range"
            min="0"
            max="100"
            .value=${String(e??0)}
            aria-label=${this.t("position")}
            @change=${a=>this.call("cover","set_cover_position",{position:Number(a.target.value)})}
          />`:p}
      ${this.renderTilt(t)}`}renderTilt(t){let e=(t.attributes.supported_features??0)|0,i=k(t,this.slatInvert),s=o=>this.slatInvert?100-o:o;return e&U&&i!==null?n`<label class="qm-tilt"
        ><span>${this.t("cover_tilt")} · ${i} %</span>
        <input
          class="qm-slider"
          type="range"
          min="0"
          max="100"
          .value=${String(i)}
          aria-label=${this.t("cover_tilt")}
          @change=${o=>this.call("cover","set_cover_tilt_position",{tilt_position:s(Number(o.target.value))})}
      /></label>`:C(t)?n`<div class="qm-tilt-buttons">
        ${e&A?n`<button class="qm-swatch qm-slot" @click=${()=>this.call("cover","open_cover_tilt")}>${this.t("cover_tilt_open")}</button>`:p}
        ${e&K?n`<button class="qm-swatch qm-slot" @click=${()=>this.call("cover","close_cover_tilt")}>${this.t("cover_tilt_close")}</button>`:p}
      </div>`:p}renderCar(t){let e=t.entities,i=(a,v,b,f={})=>_(this.hass,a,v,{entity_id:b,...f},B=>this.t("service_failed",{error:B})),s=e.lock,o=!!s&&s.startsWith("lock."),r=a=>/^(switch|input_boolean|fan|light)\./.test(a),c=e.climate,l=!!c&&c.startsWith("climate."),u=e.charging&&r(e.charging)?e.charging:null,g=[t.soc!==null?`${Math.round(t.soc)} %`:null,t.range!==null?`${Math.round(t.range)} ${t.rangeUnit}`:null,t.charging?`\u26A1 ${this.t("car_charging_short")}`:t.plugged?"\u{1F50C}":null].filter(Boolean).join(" \xB7 ");return n`<p class="qm-car-line">${g||m(this.hass,this.hass.states[this.entity])}</p>
      <div class="qm-car">
        ${o||s&&r(s)?n`<button
              class="qm-swatch qm-slot ${t.locked?"qm-slot-on":""}"
              @click=${()=>t.locked?void this.question(this.t("car_unlock_confirm")).then(a=>a&&(o?i("lock","unlock",s):i("homeassistant","turn_off",s))):o?i("lock","lock",s):i("homeassistant","turn_on",s)}
            >
              ${t.locked?`\u{1F513} ${this.t("car_unlock_btn")}`:`\u{1F512} ${this.t("car_lock_btn")}`}
            </button>`:p}
        ${c?n`<button class="qm-swatch qm-slot ${t.climateOn?"qm-slot-on":""}" @click=${()=>i(l?"climate":"homeassistant",t.climateOn?"turn_off":"turn_on",c)}>
              ${t.climateOn?`\u2744 ${this.t("car_climate_off")}`:`\u{1F321} ${this.t("car_climate_on")}`}
            </button>`:p}
        ${u?n`<button class="qm-swatch qm-slot ${t.charging?"qm-slot-on":""}" @click=${()=>i("homeassistant",t.charging?"turn_off":"turn_on",u)}>
              ${t.charging?`\u23F9 ${this.t("car_charge_stop")}`:`\u26A1 ${this.t("car_charge_start")}`}
            </button>`:p}
        ${!o&&!c&&!u?n`<p class="qm-note">${this.t("car_no_controls")}</p>`:p}
      </div>`}renderMedia(t){let e=t.attributes,i=t.state==="playing",s=t.state==="off"||t.state==="standby",o=typeof e.volume_level=="number"?Math.round(e.volume_level*100):null,r=[e.media_title,e.media_artist].filter(l=>typeof l=="string"&&l).join(" \xB7 "),c=typeof e.entity_picture=="string"?e.entity_picture:null;return n`<div class="qm-media">
        <button class="qm-swatch qm-slot" aria-label=${this.t("previous")} ?disabled=${s} @click=${()=>this.call("media_player","media_previous_track")}>⏮</button>
        <button class="qm-power qm-media-main ${i?"qm-on":""}" aria-label=${this.t("play_pause")} style=${c?`background-image:${z(c)}`:""} @click=${()=>this.call("media_player",s?"turn_on":i?"media_pause":"media_play")}>
          <span>${s?"\u23FB":i?"\u23F8":"\u25B6"}</span>
        </button>
        <button class="qm-swatch qm-slot" aria-label=${this.t("next")} ?disabled=${s} @click=${()=>this.call("media_player","media_next_track")}>⏭</button>
      </div>
      ${r?n`<p class="qm-media-title">${r}</p>`:p}
      ${o!==null?n`<input
            class="qm-slider"
            type="range"
            min="0"
            max="100"
            .value=${String(o)}
            aria-label=${this.t("volume")}
            @change=${l=>this.call("media_player","volume_set",{volume_level:Number(l.target.value)/100})}
          />`:p}
      ${this.renderPlay(t)}`}renderPlay(t){let e=Array.isArray(t.attributes.source_list)?t.attributes.source_list.slice(0,10):[],i=this.presets??[];if(!e.length&&!i.length)return p;let s=t.attributes.source;return n`<p class="qm-play-head">${this.t("media_play_head")}</p>
      <div class="qm-play">
        ${i.map(o=>n`<button class="qm-chip" @click=${()=>this.call("media_player","play_media",{media_content_type:o.type,media_content_id:o.content})}>
            ▶ ${o.label}
          </button>`)}
        ${e.map(o=>n`<button class="qm-chip ${o===s?"qm-chip-on":""}" @click=${()=>this.call("media_player","select_source",{source:o})}>${o}</button>`)}
      </div>`}renderDoorLock(t){let e=t.state==="locked"||t.state==="locking"||t.state==="jammed",i=h(this.hass,this.entity),s=async()=>{await this.question(this.t(e?"door_unlock_confirm":"door_lock_confirm",{name:i}))&&(this.call("lock",e?"unlock":"lock"),this.close())};return n`<p class="qm-car-line">${m(this.hass,t)}</p>
      <div class="qm-car">
        <button class="qm-swatch qm-slot ${e?"qm-slot-on":""}" @click=${s}>${e?`\u{1F513} ${this.t("door_unlock_btn")}`:`\u{1F512} ${this.t("door_lock_btn")}`}</button>
      </div>`}renderToggle(t){let e=t.state==="on"||t.state==="unlocked"||t.state==="playing",i=t.entity_id.split(".")[0];return n`<div class="qm-ring qm-ring-small">
      <button
        class="qm-power ${e?"qm-on":""}"
        aria-pressed=${e}
        @click=${()=>{this.guarded(()=>i==="lock"?this.call("lock",e?"lock":"unlock"):this.call("homeassistant","toggle"))}}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v8M6.3 6.8a8 8 0 1 0 11.4 0" /></svg>
        <b>${m(this.hass,t)}</b>
      </button>
    </div>`}render(){let t=this.hass?.states[this.entity];if(!t)return p;let e=$(this.entity),i=this.car?this.renderCar(this.car):M(t)?n`<p class="qm-note">${m(this.hass,t)}</p>`:this.doorLock&&e==="lock"?this.renderDoorLock(t):e==="light"?this.renderLight(t):e==="cover"?this.renderCover(t):e==="camera"?this.renderCamera(t):e==="media"?this.renderMedia(t):this.renderToggle(t);return n`<div class="qm" role="dialog" aria-label=${h(this.hass,this.entity)}>
      <div class="qm-title">${h(this.hass,this.entity)}</div>
      ${i}
      <button class="qm-details" @click=${()=>this.details()}>${this.t("details")} …</button>
    </div>`}static styles=[L,w`.qm-play-head{margin:10px 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.7}.qm-play{display:flex;flex-wrap:wrap;gap:6px;max-height:110px;overflow-y:auto}.qm-chip{border:1px solid rgba(160,240,255,0.35);border-radius:999px;padding:5px 10px;background:rgba(8,16,34,0.55);color:inherit;font:inherit;font-size:12.5px;cursor:pointer}.qm-chip-on{border-color:var(--fp3d-accent,#37e0ff);color:var(--fp3d-accent,#37e0ff)}.qm-camera{display:block;width:100%;padding:0;margin:6px 0 8px;border:0;border-radius:12px;overflow:hidden;background:#000;cursor:pointer}.qm-camera img{display:block;width:100%;aspect-ratio:16 / 9;object-fit:cover}.qm:has(.qm-camera){width:300px}.qm{width:232px;padding:12px 14px 10px;border-radius:22px;background:var(--fp3d-chrome);box-shadow:var(--fp3d-shadow),0 0 0 1px var(--fp3d-line);backdrop-filter:blur(10px)}:host([low]) .qm{backdrop-filter:none;box-shadow:0 0 0 1px var(--fp3d-line);animation:none;color:var(--fp3d-text);text-align:center;animation:qm-in 140ms ease-out}@keyframes qm-in{from{opacity:0;transform:scale(0.85)}}.qm-title{font:700 14.5px var(--fp3d-title-font);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qm-ring{position:relative;width:196px;height:196px;margin:6px auto 4px;display:grid;place-items:center}.qm-ring-small{height:110px}.qm-at{position:absolute;transform:translate(-50%,-50%)}.qm-swatch{width:34px;height:34px;border:2px solid rgba(255,255,255,0.25);border-radius:50%;cursor:pointer;box-shadow:0 0 12px rgba(0,0,0,0.35)}.qm-swatch:active{transform:scale(0.9)}.qm-power{display:grid;place-items:center;gap:2px;width:88px;height:88px;border:0;border-radius:50%;background:var(--fp3d-bg2,#16223a);color:var(--fp3d-muted);box-shadow:inset 0 0 0 2px var(--fp3d-line);cursor:pointer;font:inherit}.qm-power b{font:700 15px var(--fp3d-title-font);color:var(--fp3d-text)}.qm-power small{font-size:11px}.qm-on{color:#1a1204;background:var(--fp3d-warm);box-shadow:0 0 24px rgba(255,181,71,0.55)}.qm-on b{color:#1a1204}.qm-slot{display:grid;place-items:center;border-color:var(--fp3d-line);background:var(--fp3d-bg2,#16223a);color:var(--fp3d-text);font:700 12px var(--fp3d-title-font)}.qm-slot-on{background:var(--fp3d-accent);color:var(--fp3d-accent-text);border-color:transparent;box-shadow:0 0 14px rgba(55,224,255,0.45)}.qm-blind.qm-on{background:linear-gradient(to bottom,#1e2c4c var(--closed),#9fd9ff var(--closed));box-shadow:0 0 22px rgba(120,200,255,0.4);color:#06101f}.qm-blind b{text-shadow:0 0 6px rgba(0,0,0,0.6);color:#fff}.qm-round{width:46px;height:46px;border:0;border-radius:50%;background:var(--fp3d-accent);color:var(--fp3d-accent-text);font-size:17px;cursor:pointer}.qm-car-line{margin:2px 0 8px;text-align:center;font-weight:600;font-variant-numeric:tabular-nums}.qm-car{display:grid;gap:6px;justify-items:stretch}.qm-car .qm-slot{width:auto;padding:6px 10px;font-size:13px}.qm-media{display:flex;align-items:center;justify-content:center;gap:12px;margin:6px 0}.qm-media-main{width:64px;height:64px;border-radius:50%;background-size:cover;background-position:center;position:relative}.qm-media-main span{position:absolute;inset:0;display:grid;place-items:center;font-size:22px;text-shadow:0 0 6px rgba(0,0,0,0.8);color:#fff}.qm-media .qm-slot{width:auto;padding:0 10px}.qm-media-title{margin:2px 0 4px;text-align:center;font-size:12px;opacity:0.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qm-tilt{display:grid;gap:4px;margin-top:8px;font-size:12px;color:var(--fp3d-muted)}.qm-tilt-buttons{display:flex;gap:6px;justify-content:center;margin-top:8px}.qm-tilt-buttons .qm-slot{width:auto;padding:0 10px;font-size:12px}.qm-slider{width:100%;margin:4px 0 6px;accent-color:var(--fp3d-accent)}.qm-look{display:block;width:100%;margin-top:-4px}.qm-details{border:0;background:none;color:var(--fp3d-accent);font:inherit;font-size:13px;padding:6px;cursor:pointer}.qm-note{color:var(--fp3d-muted)}@media (pointer:coarse){.qm-swatch{min-width:44px;min-height:44px}}`]};function W(d){let t=Math.min(1,Math.max(0,(d-2200)/4300)),e=(i,s)=>Math.round(i+(s-i)*t);return`rgb(${e(255,200)},${e(170,225)},${e(80,255)})`}y("fp3d-quick-menu",x);export{x as Fp3dQuickMenu,O as coverPositionable,V as coverToggle,H as lightAbilities};
