import"./home-3d-settings-chunk-3QFBCXPE.js";import"./home-3d-settings-chunk-QB3XXOMN.js";import{i as y,j as C}from"./home-3d-settings-chunk-TSB6GNFW.js";import{a as _,c as b,d as a,g as l,i as w}from"./home-3d-settings-chunk-7QJ3M3KF.js";import{c as x}from"./home-3d-settings-chunk-U7UGOYSG.js";var R=["type","template","home"];function c(r){let e={...r};for(let i of R)delete e[i];return e}function h(r,e){let i=r.toLowerCase().replace(/ß/g,"ss").normalize("NFD").replace(new RegExp("\\p{M}","gu"),"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,40)||"template",t=i;for(let s=2;e.includes(t);s++)t=`${i}_${s}`;return t}function u(r){return[r.id,...r.aliases??[]]}function $(r,e,i){let t=r.find(o=>o.id===e);if(!t)return;t.name=i;let s=r.filter(o=>o!==t).flatMap(u),n=h(i,s);if(n!==t.id){let o=new Set([...t.aliases??[],t.id]);o.delete(n),t.id=n,o.size?t.aliases=[...o].slice(-10):delete t.aliases}return t}var H=/^(call_service|execute_script|fire_event)$|\/(save|set|create|delete|remove|restore|snapshot|import|install_url|rename|duplicate|set_active|rollback|pin|update_items|answer|reload|record|send)(\/|$)/;function N(r){let e=r?.type;return typeof e=="string"&&H.test(e)}function T(r){return{...r,callService:async()=>{},callWS:e=>N(e)?Promise.resolve(void 0):r.callWS(e)}}var g="custom:home-3d-card",k="home3d.template_preview",S="home3d.template_screen",E=56,P=30,p={tablet:{w:1280,h:800,label:"tpl_screen_tablet"},small:{w:1024,h:600,label:"tpl_screen_small"},upright:{w:800,h:1280,label:"tpl_screen_upright"},phone:{w:390,h:844,label:"tpl_screen_phone"}};function m(r,e){return r.config.phone?"phone":e}function A(r,e){let i=p[e],t=r.config;return t.fill||t.phone?i.h-E:Math.min(i.h-E,Math.max(150,t.height??420))}function L(r,e,i){return{...c(r.config),type:g,...i?{home:i}:{},height:A(r,e),fill:!1,fullscreen_button:!1,voice:!1,idle_return:0}}function I(r,e){return`type: ${g}
${e?`home: ${e}
`:""}template: ${r.id}`}function K(r,e,i,t=!1){return{id:h(e,r.flatMap(u)),name:e,config:i?structuredClone(i.config):t?{phone:!0,fill:!0}:{}}}function O(r,e,i){try{let t=localStorage.getItem(r);return t!==null&&e(t)?t:i}catch{return i}}function z(r,e){try{localStorage.setItem(r,e)}catch{}}var f=class extends w{static properties={hass:{attribute:!1},building:{attribute:!1},home:{attribute:!1},canEdit:{attribute:!1},t:{attribute:!1},initial:{attribute:!1},_selected:{state:!0},_ready:{state:!0},_note:{state:!0},_preview:{state:!0},_scale:{state:!0},_screen:{state:!0}};stageObserver=null;previewCard=null;previewKey="";shown="";noteTimer;constructor(){super(),this.building=null,this.home=null,this.canEdit=!1,this.t=e=>e,this.initial=null,this._selected=null,this._ready=!!customElements.get("home-3d-card-editor"),this._note=null,this._preview=O(k,()=>!0,"1")!=="0",this._scale=.5,this._screen=O(S,e=>e in p,"tablet")}connectedCallback(){if(super.connectedCallback(),this._ready)return;let e=customElements.get("home-3d-card");if(!e?.getConfigElement){this._note=this.t("tpl_no_editor");return}e.getConfigElement().then(()=>this._ready=!0,()=>this._note=this.t("tpl_no_editor"))}disconnectedCallback(){super.disconnectedCallback(),this.stageObserver?.disconnect(),this.stageObserver=null,clearTimeout(this.noteTimer)}get templates(){return this.building?.card_templates??[]}get current(){let e=this.templates,i=this._selected??this.initial;return e.find(t=>t.id===i)??e.find(t=>!!i&&t.aliases?.includes(i))??e[0]}editTemplates(e,i=null){if(!this.building||!this.canEdit)return;let t=structuredClone(this.building),s=t.card_templates??[];e(s),s.length?t.card_templates=s:delete t.card_templates,this.dispatchEvent(new CustomEvent("settings-edit",{detail:{building:t,key:i},bubbles:!0,composed:!0}))}add(e,i=!1){if(this.templates.length>=P){this.note(this.t("tpl_full",{n:P}));return}let t=e?this.t("tpl_copy_name",{name:e.name}):this.t(i?"tpl_new_name_phone":"tpl_new_name"),s=K(this.templates,t,e,i);this.editTemplates(n=>n.push(s)),this._selected=s.id,this.shown=""}async deleteTemplate(e){await x(this.t("tpl_delete_ask",{name:e.name}),{ok:this.t("delete"),cancel:this.t("cancel"),danger:!0})&&(this.editTemplates(i=>i.splice(i.findIndex(t=>t.id===e.id),1)),this._selected=null,this.shown="")}rename(e,i){if(!i||i===e.name)return;let t=e.id;this.editTemplates(s=>t=$(s,e.id,i)?.id??t),this._selected=t,this.shown=""}note(e){this._note=e,clearTimeout(this.noteTimer),this.noteTimer=setTimeout(()=>this._note=null,5e3)}setScreen(e){this._screen=e,this.previewKey="",z(S,e)}togglePreview(){this._preview=!this._preview,this._preview||(this.previewCard=null),this.previewKey="",z(k,this._preview?"1":"0")}changed(e,i){i.stopPropagation();let t=c(i.detail.config);this.shown=JSON.stringify([e.id,t]),this.editTemplates(s=>{let n=s.find(o=>o.id===e.id);n&&(n.config=t)},`card_templates:${e.id}`)}updated(e){super.updated(e);let i=this.renderRoot.querySelector(".tpl-preview"),t=this.current;i&&!this.stageObserver&&typeof ResizeObserver=="function"?(this.stageObserver=new ResizeObserver(([o])=>{let v=this.current,M=p[v?m(v,this._screen):this._screen].w,d=Math.min(1,(o?.contentRect.width??0)/M);d>0&&Math.abs(d-this._scale)>.005&&(this._scale=d)}),this.stageObserver.observe(i)):!i&&this.stageObserver&&(this.stageObserver.disconnect(),this.stageObserver=null),e.has("_screen")&&this.stageObserver&&i&&(this.stageObserver.unobserve(i),this.stageObserver.observe(i));let s=this.renderRoot.querySelector("home-3d-card-editor");if(!t||!s?.setConfig)return;let n=JSON.stringify([t.id,t.config]);n!==this.shown&&(this.shown=n,s.setConfig({...t.config,type:g}))}renderPreview(e){if(!this._preview)return l;if(!customElements.get("home-3d-card"))return a`<p class="fp3d-sub">${this.t("tpl_no_preview")}</p>`;this.previewCard||(this.previewCard=document.createElement("home-3d-card"),this.previewCard.preview=!0);let i=m(e,this._screen),t=JSON.stringify([e.config,i,this.home]);if(t!==this.previewKey){this.previewKey=t;try{this.previewCard.setConfig(L(e,i,this.home))}catch{}}this.hass&&(this.previewCard.hass=T(this.hass));let s=A(e,i),n=p[i].w;return a`<div class="tpl-stage" style="height:${Math.round(s*this._scale)}px;max-width:${Math.round(n*this._scale)}px">
        <div class="tpl-screen" style="width:${n}px;height:${s}px;transform:scale(${this._scale})">${this.previewCard}</div>
      </div>
      <span class="fp3d-sub">${this.t("tpl_preview_look")}</span>`}renderSide(e,i){return a`<nav class="tpl-side" aria-label=${this.t("tpl_title")}>
      ${[!1,!0].map(t=>{let s=e.filter(n=>!!n.config.phone===t);return a`<div class="tpl-group">
          <h4>${this.t(t?"tpl_phones":"tpl_screens")}</h4>
          ${s.map(n=>a`<button class="tpl-item" aria-current=${n.id===i?.id?"true":"false"} @click=${()=>this._selected=n.id}>${n.name||n.id}</button>`)}
          ${s.length?l:a`<span class="fp3d-sub">${this.t("tpl_none")}</span>`}
          ${this.canEdit?a`<button class="tpl-item tpl-add" @click=${()=>this.add(void 0,t)}>+ ${this.t("tpl_new")}</button>`:l}
        </div>`})}
    </nav>`}renderTemplate(e){let i=I(e,this.home),t=this.canEdit,s=m(e,this._screen);return a`<div class="tpl-card">
      <div class="tpl-head">
        <label class="fp3d-field tpl-name"
          >${this.t("tpl_name")}
          <input type="text" maxlength="80" .value=${e.name} ?disabled=${!t} @change=${n=>this.rename(e,n.target.value.trim())} />
        </label>
        ${t?a`<button class="fp3d-btn" @click=${()=>this.add(e)}>${this.t("duplicate")}</button>
              <button class="fp3d-btn fp3d-danger" @click=${()=>{this.deleteTemplate(e)}}>${this.t("delete")}</button>`:l}
      </div>
      <details class="tpl-use">
        <summary>${this.t("tpl_use_title")}</summary>
        <span class="fp3d-sub">${this.t("tpl_use")}</span>
        <pre>${i}</pre>
        <div class="tpl-row">
          <button class="fp3d-btn" @click=${()=>{navigator.clipboard?.writeText(i).then(()=>this.note(this.t("tpl_copied")),()=>{})}}>${this.t("tpl_copy")}</button>
        </div>
      </details>
      <div class="tpl-split ${this._preview?"":"tpl-nopreview"}">
        ${this._ready?a`<home-3d-card-editor
              class="tpl-form"
              embedded
              ?inert=${!t}
              .hass=${this.hass}
              .building=${this.building}
              @config-changed=${n=>this.changed(e,n)}
            ></home-3d-card-editor>`:a`<p class="fp3d-sub">${this._note??this.t("loading")}</p>`}
        <div class="tpl-preview">
          <div class="tpl-row">
            <b>${this.t("tpl_preview")}</b>
            ${this._preview&&!e.config.phone?a`<select class="tpl-size" aria-label=${this.t("tpl_screen")} @change=${n=>this.setScreen(n.target.value)}>
                  ${Object.keys(p).map(n=>a`<option value=${n} ?selected=${n===s}>${this.t(p[n].label)}</option>`)}
                </select>`:l}
            <button class="fp3d-btn" @click=${()=>this.togglePreview()}>${this.t(this._preview?"tpl_preview_off":"tpl_preview_on")}</button>
          </div>
          ${this.renderPreview(e)}
        </div>
      </div>
    </div>`}render(){let e=this.templates,i=this.current;return a`<div class="tpl">
      <p class="fp3d-sub">${this.t("tpl_intro")}</p>
      <div class="tpl-layout">
        ${this.renderSide(e,i)}
        <div class="tpl-main">
          ${e.length?l:a`<p class="fp3d-sub">${this.t("tpl_empty")}</p>`}
          ${i?this.renderTemplate(i):l}
        </div>
      </div>
      ${this._note&&this._ready?a`<p class="tpl-note" role="status">${this._note}</p>`:l}
    </div>`}static styles=[y,C,b`
      :host {
        display: block;
      }
      .tpl {
        display: grid;
        gap: 12px;
      }
      .tpl-layout {
        display: grid;
        grid-template-columns: 200px minmax(0, 1fr);
        gap: 16px;
        align-items: start;
      }
      .tpl-side {
        position: sticky;
        top: 0;
        display: grid;
        gap: 16px;
        padding: 10px;
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
      }
      .tpl-group {
        display: grid;
        gap: 4px;
      }
      .tpl-group h4 {
        margin: 0 0 4px;
        font-size: 12px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--fp3d-muted);
      }
      .tpl-item {
        min-height: 40px;
        padding: 8px 10px;
        border: 1px solid transparent;
        border-radius: 8px;
        background: none;
        color: var(--fp3d-text);
        font: inherit;
        font-size: 14px;
        text-align: left;
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tpl-item:hover {
        background: color-mix(in srgb, var(--fp3d-accent) 8%, transparent);
      }
      .tpl-item[aria-current="true"] {
        background: color-mix(in srgb, var(--fp3d-accent) 14%, transparent);
        border-color: var(--fp3d-accent);
        font-weight: 600;
      }
      .tpl-add {
        color: var(--fp3d-accent);
      }
      .tpl-main {
        min-width: 0;
        display: grid;
        gap: 12px;
      }
      .tpl-card {
        display: grid;
        gap: 12px;
      }
      .tpl-head,
      .tpl-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: end;
      }
      .tpl-row {
        align-items: center;
      }
      .tpl-name {
        flex: 1;
        min-width: 160px;
      }
      .tpl-use {
        display: grid;
        gap: 6px;
      }
      .tpl-use > summary {
        cursor: pointer;
        font-weight: 600;
        margin-bottom: 4px;
      }
      pre {
        margin: 0;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid var(--fp3d-line);
        font-size: 13px;
        white-space: pre-wrap;
        user-select: all;
      }
      /* the form on the left, the preview on the right (it stays in sight while the form scrolls) */
      .tpl-split {
        display: grid;
        grid-template-columns: minmax(320px, 1fr) minmax(0, 1.3fr);
        gap: 16px;
        align-items: start;
      }
      .tpl-split.tpl-nopreview {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .tpl-form {
        min-width: 0;
      }
      .tpl-preview {
        position: sticky;
        top: 0;
        display: grid;
        gap: 8px;
        min-width: 0;
      }
      .tpl-size {
        margin-left: auto;
      }
      .tpl-stage {
        position: relative;
        overflow: hidden;
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
      }
      .tpl-screen {
        position: absolute;
        top: 0;
        left: 0;
        transform-origin: 0 0;
      }
      .tpl-screen > * {
        display: block;
        height: 100%;
      }
      .tpl-note {
        margin: 0;
        color: var(--fp3d-accent);
      }
      @media (max-width: 1000px) {
        .tpl-layout,
        .tpl-split {
          grid-template-columns: minmax(0, 1fr);
        }
        .tpl-side,
        .tpl-preview {
          position: static;
        }
        .tpl-side {
          grid-template-columns: 1fr 1fr;
        }
      }
    `]};_("fp3d-card-templates",f);export{f as Fp3dCardTemplates,P as MAX_TEMPLATES,p as SCREENS,K as newTemplate,L as previewConfig,A as previewHeight,m as screenOf,I as templateYaml};
