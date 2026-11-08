import{a as f}from"./home-3d-editor-chunk-IA3SIIPF.js";import{a as L,h as M,j as T}from"./home-3d-editor-chunk-5IFCH3XI.js";import{b as E}from"./home-3d-editor-chunk-6BWZATOE.js";import"./home-3d-editor-chunk-RBYOTREW.js";import{a as _}from"./home-3d-editor-chunk-TAAEQO2A.js";import{b as $,c as l,d as m,f as h,h as w}from"./home-3d-editor-chunk-GGWVF3HT.js";var o=48,H=4,C=96,q=220,z="~basic",d=g=>`${g.type}|${g.packRelease}`,b=class extends w{static properties={entries:{attribute:!1},current:{attribute:!1},heading:{attribute:!1},language:{attribute:!1},t:{attribute:!1},thumb:{attribute:!1},picture:{attribute:!1},_q:{state:!0},_pack:{state:!0},_kind:{state:!0},_sel:{state:!0},_top:{state:!0},_thumbs:{state:!0},_big:{state:!0}};memo=null;wanted=new Set;queue=[];drawing=0;bigFor=null;viewH=320;constructor(){super(),this.entries=[],this.current="",this.heading="",this.language="en",this.t=t=>t,this.thumb=null,this.picture=null,this._q="",this._pack="",this._kind="",this._sel=null,this._top=0,this._thumbs=new Map,this._big=null}connectedCallback(){super.connectedCallback(),this.addEventListener("keydown",this.onKey)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("keydown",this.onKey)}firstUpdated(){let t=this.hits.find(e=>e.type===this.current);this._sel=(t??this.hits[0])?.key??null,t&&this.reveal(t.key,!0),this.renderRoot.querySelector("input.ip-q")?.focus()}updated(){let t=this.renderRoot.querySelector(".ip-list");t&&t.clientHeight&&t.clientHeight!==this.viewH&&(this.viewH=t.clientHeight,this.requestUpdate());for(let s of this.visible().rows)this.want(s);let e=this.selected;e&&this.bigFor!==e.key&&this.drawBig(e)}get hits(){let t=[this.entries,this._q,this._pack,this._kind],e=this.memo;if(e&&e.key.every((i,p)=>i===t[p]))return e.hits;let s=this.entries.filter(i=>!i.mirror),r=i=>!this._pack||(this._pack===z?i.pack===null:i.pack===this._pack),n=M(s,{query:this._q,room:null,electric:!1,light:!1,outdoor:!1}).hits.filter(i=>r(i)&&(!this._kind||i.kind===this._kind));return this._q.trim()||(n=[...n.filter(i=>i.type===this.current),...n.filter(i=>i.type!==this.current)]),this.memo={key:t,hits:n},n}get selected(){return this.hits.find(t=>t.key===this._sel)??null}get packs(){let t=new Map;for(let e of this.entries)e.pack&&!t.has(e.pack)&&t.set(e.pack,e.packLabel??e.pack);return[...t].map(([e,s])=>({id:e,label:s})).sort((e,s)=>e.label.localeCompare(s.label))}visible(){let t=this.hits,e=Math.max(0,Math.floor(this._top/o)-H),s=Math.min(t.length,Math.ceil((this._top+this.viewH)/o)+H);return{rows:t.slice(e,s),before:e*o,after:(t.length-s)*o}}want(t){let e=d(t);!this.thumb||this._thumbs.has(e)||this.wanted.has(e)||(this.wanted.add(e),this.queue.push(t),this.drain())}drain(){for(;this.drawing<2&&this.queue.length;){let t=this.queue.shift();if(!this.visible().rows.includes(t)){this.wanted.delete(d(t));continue}this.drawing++;let e=d(t);f(`${e}|${C}|1`,()=>this.thumb?this.thumb(t):Promise.resolve(null)).then(s=>{if(s){let r=new Map(this._thumbs);r.set(e,s),this._thumbs=r}else this.wanted.delete(e)}).catch(()=>this.wanted.delete(e)).finally(()=>{this.drawing--,this.drain()})}}async drawBig(t){if(this.bigFor=t.key,!!this.picture)try{let e=await f(`${d(t)}|${q}|1`,()=>this.picture?this.picture(t,q):Promise.resolve(null));this.bigFor===t.key&&(this._big={key:t.key,url:e})}catch{this.bigFor===t.key&&(this._big={key:t.key,url:null})}}reveal(t,e=!1){let s=this.hits.findIndex(i=>i.key===t),r=this.renderRoot.querySelector(".ip-list");if(s<0||!r)return;let n=s*o;e?r.scrollTop=Math.max(0,n-r.clientHeight/2+o/2):n<r.scrollTop?r.scrollTop=n:n+o>r.scrollTop+r.clientHeight&&(r.scrollTop=n+o-r.clientHeight),this._top=r.scrollTop}move(t){let e=this.hits;if(!e.length)return;let s=Math.max(0,Math.min(e.length-1,e.findIndex(r=>r.key===this._sel)+t));this._sel=e[s].key,this.reveal(e[s].key)}use(t){t&&this.dispatchEvent(new CustomEvent("pick",{detail:{type:t.type},bubbles:!0,composed:!0}))}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}onKey=t=>{t.stopPropagation(),t.key==="Escape"?(t.preventDefault(),this.close()):t.key==="ArrowDown"?(t.preventDefault(),this.move(1)):t.key==="ArrowUp"?(t.preventDefault(),this.move(-1)):t.key==="PageDown"?(t.preventDefault(),this.move(Math.max(1,Math.floor(this.viewH/o)-1))):t.key==="PageUp"?(t.preventDefault(),this.move(-Math.max(1,Math.floor(this.viewH/o)-1))):t.key==="Enter"&&t.target.tagName!=="BUTTON"&&(t.preventDefault(),this.use(this.selected))};setQuery(t){this._q=t,this.afterFilter()}afterFilter(){let t=this.renderRoot.querySelector(".ip-list");t&&(t.scrollTop=0),this._top=0,this._sel=this.hits[0]?.key??null}renderPlans(t){let[e,s,r]=t.size,n=84,i=(c,k)=>{let x=n/Math.max(c,k,.01);return[c*x,k*x]},[p,a]=i(e,s),[v,y]=i(e,r),u=c=>c>=10?`${Math.round(c*10)/10} m`:`${Math.round(c*100)}`,P=m`<svg viewBox="0 0 100 100" role="img" aria-label=${this.t("item_picker_plan")}>
      <rect x=${(100-p)/2} y=${(100-a)/2} width=${p} height=${a} class="ip-shape" />
      <text x="50" y="97" class="ip-dim">${u(e)}</text>
      <text x="4" y="52" class="ip-dim" transform="rotate(-90 4 52)" text-anchor="middle">${u(s)}</text>
    </svg>`,R=m`<svg viewBox="0 0 100 100" role="img" aria-label=${this.t("item_picker_front")}>
      <rect x=${(100-v)/2} y=${88-y} width=${v} height=${y} class="ip-shape" />
      <text x="50" y="97" class="ip-dim">${u(e)}</text>
      <text x="4" y="48" class="ip-dim" transform="rotate(-90 4 48)" text-anchor="middle">${u(r)}</text>
    </svg>`;return l`<div class="ip-plans"><figure>${P}<figcaption>${this.t("item_picker_plan")}</figcaption></figure><figure>${R}<figcaption>${this.t("item_picker_front")}</figcaption></figure></div>`}renderRow(t){let e=this._thumbs.get(d(t)),s=t.key===this._sel;return l`<li
      class="ip-row ${s?"on":""}"
      role="option"
      aria-selected=${s}
      @click=${()=>this._sel=t.key}
      @dblclick=${()=>this.use(t)}
    >
      <span class="ip-pic">${e?l`<img src=${e} alt="" draggable="false" />`:h}</span>
      <span class="ip-name">${t.label}${t.type===this.current?l` <em>${this.t("item_picker_current")}</em>`:h}</span>
      <span class="ip-meta">${t.packLabel??this.t("item_picker_basic")} · ${this.t(`lib_kind_${t.kind}`)}</span>
    </li>`}render(){let t=this.t,e=this.hits,{rows:s,before:r,after:n}=this.visible(),i=this.selected,p=this.heading||t("item_picker_title");return l`<div class="ip-back" @click=${a=>a.target===a.currentTarget&&this.close()}>
      <div class="ip-dialog" role="dialog" aria-modal="true" aria-label=${p}>
        <header>
          <h3>${p}</h3>
          <button class="fp3d-btn" @click=${()=>this.close()}>${t("cancel")}</button>
        </header>
        <div class="ip-filters">
          <input class="ip-q" type="search" autocomplete="off" placeholder=${t("item_picker_search")} aria-label=${t("item_picker_search")} .value=${this._q} @input=${a=>this.setQuery(a.target.value)} />
          <select aria-label=${t("item_picker_pack")} .value=${this._pack} @change=${a=>(this._pack=a.target.value,this.afterFilter())}>
            <option value="">${t("item_picker_pack_all")}</option>
            <option value=${z}>${t("item_picker_basic")}</option>
            ${this.packs.map(a=>l`<option value=${a.id}>${a.label}</option>`)}
          </select>
          <select aria-label=${t("item_picker_kind")} .value=${this._kind} @change=${a=>(this._kind=a.target.value,this.afterFilter())}>
            <option value="">${t("item_picker_kind_all")}</option>
            ${L.map(a=>l`<option value=${a}>${t(`lib_kind_${a}`)}</option>`)}
          </select>
        </div>
        <div class="ip-body">
          <div class="ip-list" role="listbox" aria-label=${t("item_picker_title")} @scroll=${a=>this._top=a.target.scrollTop}>
            ${e.length?h:l`<p class="fp3d-sub ip-none">${t("furniture_search_none")}</p>`}
            <ul style="padding-top:${r}px;padding-bottom:${n}px">
              ${s.map(a=>this.renderRow(a))}
            </ul>
          </div>
          <aside class="ip-view" aria-live="polite">
            ${i?l`<div class="ip-big">${this._big?.key===i.key&&this._big.url?l`<img src=${this._big.url} alt=${i.label} draggable="false" />`:h}</div>
                  <b>${i.label}</b>
                  <span class="fp3d-sub">${T(i.size,this.language)} · ${i.packLabel??t("item_picker_basic")}</span>
                  ${this.renderPlans(i)}`:h}
          </aside>
        </div>
        <footer>
          <span class="fp3d-sub">${t("item_picker_count",{n:e.length})}</span>
          <button class="fp3d-btn fp3d-primary" ?disabled=${!i||i.type===this.current} @click=${()=>this.use(i)}>${t("item_picker_use")}</button>
        </footer>
      </div>
    </div>`}static styles=[E,$`
      :host {
        position: fixed;
        inset: 0;
        z-index: 60;
        color: var(--fp3d-text);
      }
      .ip-back {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: grid;
        place-items: center;
        padding: 12px;
      }
      .ip-dialog {
        background: var(--fp3d-panel, #0d1424);
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
        width: min(760px, 100%);
        max-height: 100%;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        box-sizing: border-box;
      }
      header,
      footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      h3 {
        margin: 0;
      }
      .ip-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .ip-filters input {
        flex: 1 1 200px;
      }
      .ip-filters input,
      .ip-filters select {
        min-height: 36px;
        box-sizing: border-box;
        color: var(--fp3d-text);
        background: transparent;
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        padding: 0 8px;
      }
      .ip-filters select {
        flex: 0 1 160px;
        min-width: 0;
      }
      .ip-body {
        display: flex;
        gap: 10px;
        min-height: 0;
        flex: 1;
      }
      .ip-list {
        flex: 1 1 55%;
        height: min(52vh, 384px);
        overflow-y: auto;
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        position: relative;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .ip-row {
        height: ${o}px;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: 40px 1fr;
        grid-template-areas: "pic name" "pic meta";
        column-gap: 8px;
        align-items: center;
        padding: 0 8px;
        cursor: pointer;
        border-bottom: 1px solid var(--fp3d-line);
      }
      .ip-row.on {
        background: rgba(55, 224, 255, 0.14);
        outline: 1px solid var(--fp3d-accent);
        outline-offset: -1px;
      }
      .ip-pic {
        grid-area: pic;
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
      }
      .ip-pic img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .ip-name {
        grid-area: name;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ip-name em {
        font-size: 11px;
        opacity: 0.7;
      }
      .ip-meta {
        grid-area: meta;
        font-size: 11px;
        opacity: 0.65;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ip-none {
        padding: 12px;
      }
      .ip-view {
        flex: 1 1 45%;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .ip-big {
        aspect-ratio: 1;
        max-height: 200px;
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        display: grid;
        place-items: center;
      }
      .ip-big img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .ip-plans {
        display: flex;
        gap: 8px;
      }
      .ip-plans figure {
        margin: 0;
        flex: 1;
        text-align: center;
        font-size: 11px;
      }
      .ip-plans svg {
        width: 100%;
        max-height: 100px;
      }
      .ip-shape {
        fill: rgba(55, 224, 255, 0.12);
        stroke: var(--fp3d-accent);
        stroke-width: 1.5;
      }
      .ip-dim {
        font-size: 8px;
        fill: currentColor;
        text-anchor: middle;
      }
      @media (max-width: 620px) {
        .ip-body {
          flex-direction: column;
          overflow-y: auto;
        }
        .ip-list {
          flex: none;
          height: 40vh;
        }
        .ip-big {
          max-height: 140px;
        }
      }
    `]};_("fp3d-item-picker",b);export{b as ItemPicker};
