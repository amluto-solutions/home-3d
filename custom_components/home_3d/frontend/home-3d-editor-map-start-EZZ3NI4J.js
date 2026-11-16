import{G as f}from"./home-3d-editor-chunk-F4AHOL6K.js";import{b as _}from"./home-3d-editor-chunk-UZJWBUN4.js";import{a as h,c as g}from"./home-3d-editor-chunk-6F2XQ5BE.js";import"./home-3d-editor-chunk-AQSZK3EU.js";import"./home-3d-editor-chunk-RNL7IT4T.js";import{a as m}from"./home-3d-editor-chunk-TAAEQO2A.js";import{b as c,c as o,f as a,h as b}from"./home-3d-editor-chunk-GGWVF3HT.js";var y=_("home-3d-osm",()=>"fc26ed25ea56");function x(s,r){let t=s.settings.surroundings?.flat===!0;return{...s,settings:{...s.settings,north:r.north,surroundings:{...r.surroundings,...t?{flat:t}:{}}}}}function v(s){let r=s?.kind;return r==="busy"||r==="empty"?`surround_err_${r}`:"surround_err_offline"}function d(s){let r=s?.config?.latitude,t=s?.config?.longitude;return typeof r=="number"&&typeof t=="number"&&!(r===0&&t===0)?{lat:r,lon:t}:null}var w=c`
fp3d-map-start {
  display: block;
  position: absolute;
  top: 10px;
  left: 12px;
  z-index: 3;
  max-width: min(460px, calc(100% - 24px));
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid var(--fp3d-accent);
  border-radius: 12px;
  background: var(--fp3d-chrome-solid);
  box-shadow: var(--fp3d-shadow);
  color: var(--fp3d-text);
  font-size: 13.5px;
}
fp3d-map-start h3 {
  margin: 0 0 6px;
  font-size: 15px;
}
fp3d-map-start p {
  margin: 0 0 8px;
}
fp3d-map-start .fp3d-map-start-small {
  color: var(--fp3d-muted, #94a3b8);
  font-size: 12px;
}
fp3d-map-start .fp3d-map-start-warn {
  color: var(--fp3d-warn, #ffd166);
}
fp3d-map-start .fp3d-map-start-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 700px) {
  fp3d-map-start {
    top: 6px;
    left: 8px;
    right: 8px;
    max-width: none;
    max-height: 60%;
    overflow: auto;
  }
}
`.cssText,l=class extends b{static properties={hass:{attribute:!1},building:{attribute:!1},t:{attribute:!1},osm:{attribute:!1},_busy:{state:!0},_error:{state:!0}};_big="";abort=null;constructor(){super(),this.building=null,this.t=r=>r,this.osm=y,this._busy=!1,this._error=null}createRenderRoot(){return this}disconnectedCallback(){super.disconnectedCallback(),this.abort?.abort()}async load(){let r=this.building,t=d(this.hass);if(!(!r||!t||this._busy)){this._busy=!0,this._error=null,this.abort=new AbortController;try{let e=await(await this.osm()).loadSurroundings(t.lat,t.lon,r.settings.surroundings?.radius??150,r,this.abort.signal),i=x(this.building??r,e);try{g({type:"home_3d/building/save",building:i})}catch{this._big=(h({type:"home_3d/building/save",building:i})/1048576).toFixed(1),this._error="surround_err_big";return}this.dispatchEvent(new CustomEvent("map-start-loaded",{detail:{building:i},bubbles:!0,composed:!0}))}catch(n){this.abort?.signal.aborted||(this._error=v(n))}finally{this._busy=!1,this.abort=null}}}off(){this.dispatchEvent(new CustomEvent("map-start-off",{bubbles:!0,composed:!0}))}render(){let r=this.building;if(!r)return a;let t=this.t,n=r.settings.surroundings,e=!!f(r),i=!e&&!!n?.on&&n.buildings.length>0,u=d(this.hass),p=o`<style>
      ${w}
    </style>`;return e||i?o`${p}<div role="note">
        <h3>🗺 ${t("map_start_title")}</h3>
        <p>${t(e?"map_start_ready":"map_start_nohouse")}</p>
        <div class="fp3d-map-start-buttons"><button class="fp3d-btn fp3d-primary" @click=${()=>this.off()}>${t("map_start_ok")}</button></div>
      </div>`:o`${p}<div role="note">
      <h3>🗺 ${t("map_start_title")}</h3>
      <p>${t("map_start_text")}</p>
      <p class="fp3d-map-start-small">${t("surround_privacy")}</p>
      ${u?a:o`<p class="fp3d-map-start-warn" role="alert">${t("surround_no_location")}</p>`}
      ${this._error?o`<p class="fp3d-map-start-warn" role="alert">${t(this._error,{mb:this._big})}</p>`:a}
      <div class="fp3d-map-start-buttons">
        <button class="fp3d-btn fp3d-primary" ?disabled=${!u||this._busy} @click=${()=>{this.load()}}>${this._busy?t("surround_loading"):t("map_start_load")}</button>
        ${this._busy?o`<button class="fp3d-btn" @click=${()=>this.abort?.abort()}>${t("cancel")}</button>`:o`<button class="fp3d-btn" @click=${()=>this.off()}>${t("map_start_later")}</button>`}
      </div>
    </div>`}};m("fp3d-map-start",l);export{l as MapStart};
