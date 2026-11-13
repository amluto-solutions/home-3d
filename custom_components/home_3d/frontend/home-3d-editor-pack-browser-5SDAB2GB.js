import{E as A,F as z,i as E,j as S,k as C,l as F,q as L,w as b,y as O}from"./home-3d-editor-chunk-C3BEGVOM.js";import"./home-3d-editor-chunk-6F2XQ5BE.js";import{b as P,d as y,e as I}from"./home-3d-editor-chunk-XHXGJ2X3.js";import{f as $,g as w}from"./home-3d-editor-chunk-EJAOI7SH.js";import{b as h}from"./home-3d-editor-chunk-A74QUOUQ.js";import{a as v}from"./home-3d-editor-chunk-TAAEQO2A.js";import{b as x,c as a,f as l,h as k}from"./home-3d-editor-chunk-GGWVF3HT.js";var d="language",g=null;async function H(o,e=!1){if(g&&!e)return g;let t=await o.callWS({type:"home_3d/packs/index",...e?{refresh:e}:{}});return g=t,t}function u(o,e){let t=e.find(i=>i.id===o.id);if(!t)return{state:"available",installed:null,removable:!1};let s=t.release??1;return{state:s<o.release?"update":"installed",installed:s,removable:!t.bundled}}function m(o){return o.kind==="language"?[d]:Object.entries(o.categories).sort((e,t)=>t[1]-e[1]||e[0].localeCompare(t[0])).map(([e])=>e)}function T(o){let e=new Map;for(let t of o)if(t.kind==="language")e.set(d,(e.get(d)??0)+1);else for(let[s,i]of Object.entries(t.categories))e.set(s,(e.get(s)??0)+i);return[...e].sort((t,s)=>s[1]-t[1]||t[0].localeCompare(s[0])).map(([t])=>t)}function q(o){return[...new Set(o.map(e=>e.publisher))].sort((e,t)=>e.localeCompare(t))}function U(o,e,t,s=i=>i){let i=e.query.toLowerCase().split(/\s+/).filter(Boolean),n=o.filter(p=>{if(e.publisher&&p.publisher!==e.publisher)return!1;let c=m(p);if(e.category&&!c.includes(e.category))return!1;if(!i.length)return!0;let G=[p.name,p.description,p.publisher,p.id,...c.map(s)].join(" ").toLowerCase();return i.every(K=>G.includes(K))}),r=p=>u(p,t).state==="update"?0:1;return n.map((p,c)=>[p,c]).sort((p,c)=>r(p[0])-r(c[0])||p[1]-c[1]).map(([p])=>p)}var f=96,M=new Map,_=class extends k{static properties={hass:{attribute:!1},packs:{attribute:!1},picture:{attribute:!1},_index:{state:!0},_failed:{state:!0},_loading:{state:!0},_query:{state:!0},_category:{state:!0},_publisher:{state:!0},_open:{state:!0},_preview:{state:!0},_busy:{state:!0},_msg:{state:!0},_drawn:{state:!0},_source:{state:!0}};drawing=new Set;constructor(){super(),this.packs=[],this.picture=null,this._index=null,this._failed=!1,this._loading=!1,this._query="",this._category=null,this._publisher=null,this._open=null,this._preview=null,this._busy=!1,this._msg=null,this._drawn=0,this._source=null}asked=!1;willUpdate(){!this.asked&&this.hass&&(this.asked=!0,this.load(!1))}t(e,t){return I(this.hass,e,t)}async load(e){if(this.hass){this._loading=!0;try{this._index=await H(this.hass,e),this._failed=!1}catch{this._failed=!this._index}finally{this._loading=!1}}}label=e=>{if(e===d)return this.t("languages");let t=`lib_kind_${e}`,s=this.t(t);return s===t?e.replace(/[_-]+/g," ").replace(/^./,i=>i.toUpperCase()):s};installed(){return this.packs??[]}pictureOf(e,t){if(!t||!this.picture)return null;let s=`${e.id}|${e.release}|${t.id}`,i=M.get(s);if(i)return i;if(!this.drawing.has(s)){this.drawing.add(s);let n=this.picture;Promise.resolve().then(()=>n(t,f)).then(r=>{r&&M.set(s,r),this._drawn++}).catch(()=>{})}return null}thumbOf(e){return e.previews.find(t=>t.id===e.thumbnail)??e.previews[0]}render(){let e=this._index;if(!e)return this._failed?this.renderOffline():a`<p class="pb-note" role="status">${this.t("loading")}</p>`;let t=this._open?e.packs.find(s=>s.id===this._open):void 0;return a`${e.stale?a`<p class="pb-note">${this.t("pb_stale",{time:new Date(e.fetched_at*1e3).toLocaleString(this.hass?.language)})}</p>`:l}
      ${this._msg?a`<p class="pb-msg ${this._msg.ok?"":"pb-bad"}" role="status">${this._msg.text}</p>`:l} ${t?this.renderPack(t):this.renderList(e)}`}renderOffline(){return a`<div class="pb-offline" role="status">
      <p class="pb-note">${this.t("pb_offline")}</p>
      <button class="fp3d-btn" ?disabled=${this._loading} @click=${()=>{this.load(!0)}}>${this.t("pb_retry")}</button>
      ${this.renderSource()}
    </div>`}renderList(e){let t=this.installed(),s={query:this._query,category:this._category,publisher:this._publisher},i=U(e.packs,s,t,this.label),n=q(e.packs);return a`<div class="pb-top">
        <div class="pb-bar">
          <input class="pb-search" type="search" .value=${this._query} placeholder=${this.t("pb_search")} aria-label=${this.t("pb_search")} @input=${r=>this._query=r.target.value} />
          <button class="fp3d-btn pb-refresh" title=${this.t("pb_refresh")} aria-label=${this.t("pb_refresh")} ?disabled=${this._loading} @click=${()=>{this.load(!0)}}>↻</button>
        </div>
        <div class="pb-bar">
          <select aria-label=${this.t("pb_all_categories")} @change=${r=>this._category=r.target.value||null}>
            <option value="" ?selected=${!this._category}>${this.t("pb_all_categories")}</option>
            ${T(e.packs).map(r=>a`<option value=${r} ?selected=${this._category===r}>${this.label(r)}</option>`)}
          </select>
          ${n.length>1?a`<select aria-label=${this.t("pb_all_publishers")} @change=${r=>this._publisher=r.target.value||null}>
                <option value="" ?selected=${!this._publisher}>${this.t("pb_all_publishers")}</option>
                ${n.map(r=>a`<option value=${r} ?selected=${this._publisher===r}>${r}</option>`)}
              </select>`:l}
        </div>
      </div>
      ${i.length?a`<ul class="pb-list">
            ${i.map(r=>{let p=u(r,t),c=this.pictureOf(r,this.thumbOf(r));return a`<li>
                <button class="pb-card" @click=${()=>this.openPack(r.id)}>
                  <span class="pb-thumb">${c?a`<img src=${c} alt="" width="48" height="48" />`:l}</span>
                  <span class="pb-text">
                    <b>${r.name}</b>
                    <span class="pb-sub">${r.publisher} · ${this.meta(r)}</span>
                  </span>
                  ${this.badge(r,p.state)}
                </button>
              </li>`})}
          </ul>`:a`<p class="pb-note">${this.t("pb_none")}</p>`}
      ${this.renderSource()}`}renderSource(){return a`<details class="pb-source" @toggle=${e=>{this.openSource(e.target.open)}}>
      <summary class="pb-sub">${this.t("pb_index_url")}</summary>
      ${this._source===null?l:a`<p class="pb-sub">${this.t("pb_index_url_hint")}</p>
            <div class="pb-bar">
              <input class="pb-search" type="url" maxlength="500" .value=${this._source} aria-label=${this.t("pb_index_url")} @input=${e=>this._source=e.target.value} />
              <button class="fp3d-btn" ?disabled=${this._busy} @click=${()=>{this.saveSource()}}>${this.t("ask_ok")}</button>
            </div>`}
    </details>`}async openSource(e){if(!(!e||!this.hass))try{this._source=(await C(this.hass)).settings.index_url??""}catch{this._source=""}}async saveSource(){if(!(!this.hass||this._source===null)){this._busy=!0;try{await F(this.hass,{index_url:this._source.trim()}),this._msg=null,this._open=null,await this.load(!0)}catch(e){this._msg={ok:!1,text:h(e)}}finally{this._busy=!1}}}meta(e){return e.kind==="language"?this.t("pb_meta_texts",{n:e.texts??0,release:e.release,licence:e.licence}):this.t("pb_meta",{n:e.items,release:e.release,licence:e.licence})}badge(e,t){return t==="update"?a`<span class="pb-badge pb-upd">${this.t("pb_update",{release:e.release})}</span>`:t==="installed"?a`<span class="pb-badge">${this.t("pb_installed")}</span>`:e.source==="community"?a`<span class="pb-badge pb-comm">${this.t("pb_community")}</span>`:l}openPack(e){this._open=e,this._preview=null,this._msg=null}renderPack(e){let t=u(e,this.installed()),s=e.items-e.previews.length;return a`<div class="pb-page">
      <button class="fp3d-btn pb-back" @click=${()=>this.openPack(null)}>← ${this.t("back")}</button>
      <h4>${e.name}</h4>
      <p class="pb-sub">${e.publisher} · ${this.meta(e)} ${e.source==="community"?a`· ${this.t("pb_community")}`:l}</p>
      ${e.description?a`<p>${e.description}</p>`:l}
      ${e.release_note?a`<p class="pb-sub">v${e.release}: ${e.release_note}</p>`:l}
      <div class="pb-cats">${m(e).map(i=>a`<span class="pb-chip">${this.label(i)}${e.categories[i]?` ${e.categories[i]}`:""}</span>`)}</div>
      ${e.previews.length?a`<ul class="pb-previews">
            ${e.previews.map(i=>{let n=this.pictureOf(e,i),r=z(i,this.hass?.language??"en");return a`<li>
                <span class="pb-pic">${n?a`<img src=${n} alt=${r} width=${f} height=${f} />`:l}</span>
                <span class="pb-sub">${r}</span>
              </li>`})}
          </ul>
          ${s>0?a`<p class="pb-sub">${this.t("pb_more",{n:s})}</p>`:l}`:l}
      ${this._preview?this.renderPreview(e,this._preview):this.renderActions(e,t)}
      <p><a href=${e.url} target="_blank" rel="noreferrer noopener">${this.t("pb_on_github")}</a></p>
    </div>`}renderActions(e,t){return a`<div class="pb-actions">
      ${t.state==="available"?a`<button class="fp3d-btn fp3d-primary" ?disabled=${this._busy} @click=${()=>{this.previewInstall(e)}}>${this.t("pp_do_install")}</button>`:l}
      ${t.state==="update"?a`<button class="fp3d-btn fp3d-primary" ?disabled=${this._busy} @click=${()=>{this.previewInstall(e)}}>${this.t("pb_update",{release:e.release})}</button>`:l}
      ${t.state!=="available"&&!t.removable?a`<span class="pb-sub">${this.t("pb_bundled")}</span>`:l}
      ${t.state==="installed"&&t.removable?a`<span class="pb-badge">${this.t("pb_installed")}</span>`:l}
      ${t.removable?a`<button class="fp3d-btn fp3d-danger" ?disabled=${this._busy} @click=${()=>{this.removeEntry(e)}}>${this.t("pack_remove")}</button>`:l}
    </div>`}renderPreview(e,t){let s=t.changes,i=t.installed!==null;return a`<div class="pb-preview">
      <p>
        <b>${i?this.t("pp_update",{name:t.pack.name,from:t.installed.release,to:t.pack.release}):this.t("pp_install",{name:t.pack.name,release:t.pack.release})}</b>
      </p>
      <p class="pb-sub">${this.t("pp_from")} ${t.origin.owner}/${t.origin.repo}${t.origin.folder?`/${t.origin.folder}`:""} · ${this.t("pp_commit")} ${A(t.origin.commit)}</p>
      ${t.warnings.map(n=>a`<p class="pb-bad">${this.t(`pp_warn_${n}`)}</p>`)}
      <p class="pb-sub">
        ${[s.added.length?this.t("pp_added",{n:s.added.length}):"",s.changed.length?this.t("pp_changed",{n:s.changed.length}):"",s.removed.length?this.t("pp_removed",{n:s.removed.length}):""].filter(Boolean).join(" \xB7 ")}
      </p>
      ${i?a`<p class="pb-sub">${this.t("pp_placed_hint")}</p>`:l}
      <div class="pb-actions">
        <button class="fp3d-btn fp3d-primary" ?disabled=${this._busy} @click=${()=>{this.install(e,t.origin.commit,t.pack.release)}}>${this.t(i?"pp_do_update":"pp_do_install")}</button>
        <button class="fp3d-btn" ?disabled=${this._busy} @click=${()=>this._preview=null}>${this.t("cancel")}</button>
      </div>
    </div>`}async previewInstall(e){if(this.hass){this._busy=!0,this._msg=null;try{this._preview=await S(this.hass,e.url,e.id)}catch(t){this._msg={ok:!1,text:this.packError(t)}}finally{this._busy=!1}}}askFirst=(e,t)=>b(this.t(`pack_confirm_${e}`,{detail:t}),{ok:this.t("ask_ok"),cancel:this.t("cancel")});async install(e,t,s){if(!this.hass)return;let i=this.hass;this._busy=!0;try{let n=await O(r=>E(i,e.url,r,t,e.id),this.askFirst);if(!n)return;this._preview=null,this._msg={ok:!0,text:this.t("pb_done",{name:n.name,release:s})},n.language&&n.language===P(i.language)&&await y(i.language,i,!0),this.dispatchEvent(new CustomEvent("packs-changed",{bubbles:!0,composed:!0}))}catch(n){this._preview=null,this._msg={ok:!1,text:this.packError(n)}}finally{this._busy=!1}}async removeEntry(e){if(this.hass&&await b(this.t("pack_remove_confirm",{name:e.name}),{ok:this.t("pack_remove"),cancel:this.t("cancel"),danger:!0})){this._busy=!0;try{await L(this.hass,e.id),this._msg={ok:!0,text:this.t("pb_removed",{name:e.name})},this.dispatchEvent(new CustomEvent("packs-changed",{bubbles:!0,composed:!0}))}catch(t){this._msg={ok:!1,text:this.t("pack_remove_failed",{error:h(t)})}}finally{this._busy=!1}}}packError(e){let{code:t,message:s}=e??{},i=`pack_error_${t}`,n=this.t(i,{detail:s??String(e)});return n===i?this.t("pack_error_other",{detail:s??String(e)}):n}static styles=[$,w,x`
      :host {
        display: block;
      }
      .fp3d-btn {
        font: inherit;
        font-size: 13px;
        min-height: 34px;
        padding: 0 12px;
        color: var(--fp3d-text);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        cursor: pointer;
      }
      .fp3d-btn:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .fp3d-primary {
        background: var(--fp3d-primary);
        color: var(--fp3d-primary-text);
        border-color: transparent;
      }
      .fp3d-danger {
        color: var(--fp3d-danger, #ff6b6b);
      }
      .pb-top {
        position: sticky;
        top: 0;
        z-index: 2;
        padding: 6px 0 2px;
        background: var(--fp3d-chrome-solid, var(--fp3d-panel, #0d1424));
      }
      .pb-bar {
        display: flex;
        gap: 6px;
        margin-bottom: 6px;
      }
      .pb-search,
      select {
        flex: 1;
        min-width: 0;
        min-height: 36px;
        box-sizing: border-box;
        font: inherit;
        font-size: 14px;
        color: var(--fp3d-text);
        background: var(--fp3d-panel, #0d1424);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        padding: 6px 10px;
      }
      .pb-refresh {
        flex: none;
      }
      .pb-list,
      .pb-previews {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .pb-card {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 60px;
        margin-bottom: 6px;
        padding: 6px 8px;
        font: inherit;
        text-align: left;
        color: var(--fp3d-text);
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        cursor: pointer;
      }
      .pb-card:hover {
        border-color: var(--fp3d-accent);
      }
      .pb-thumb {
        flex: none;
        width: 48px;
        height: 48px;
      }
      .pb-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .pb-sub,
      .pb-note {
        color: var(--fp3d-muted);
        font-size: 12px;
      }
      .pb-badge {
        flex: none;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--fp3d-line);
        color: var(--fp3d-muted);
      }
      .pb-upd {
        background: var(--fp3d-primary);
        color: var(--fp3d-primary-text);
        border-color: transparent;
      }
      .pb-comm {
        color: var(--fp3d-accent);
      }
      .pb-page h4 {
        margin: 8px 0 2px;
        font-size: 16px;
      }
      .pb-back {
        margin-top: 6px;
      }
      .pb-cats {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin: 6px 0;
      }
      .pb-chip {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
      }
      .pb-previews {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
        gap: 6px;
      }
      .pb-previews li {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 2px;
      }
      .pb-pic {
        width: 96px;
        height: 96px;
        max-width: 100%;
      }
      .pb-pic img {
        max-width: 100%;
        height: auto;
      }
      .pb-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin: 8px 0;
      }
      .pb-preview {
        margin: 8px 0;
        padding: 8px;
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
      }
      .pb-preview p {
        margin: 4px 0;
      }
      .pb-msg {
        font-size: 13px;
      }
      .pb-bad {
        color: var(--fp3d-danger, #ff6b6b);
      }
      a {
        color: var(--fp3d-accent);
      }
    `]};v("fp3d-pack-browser",_);export{_ as PackBrowser};
