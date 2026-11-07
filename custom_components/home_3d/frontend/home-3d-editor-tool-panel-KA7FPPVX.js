function T(e){let h=l=>l.map(([p,u])=>e`<circle class="d" cx=${p} cy=${u} r="2.4" />`),o=(l,p,u)=>e`<path class="a" d=${`M${p} ${l}${"q3-3 6 0t6 0".repeat(Math.round((u-p)/12))}`} />`,g="M10 24C8 12 22 6 32 10S56 8 54 22 40 34 28 32 12 34 10 24Z",d={rect:()=>e`<rect class="w" x="12" y="8" width="40" height="24" />${h([[12,8],[52,8],[52,32],[12,32]])}`,polygon:()=>e`<path class="w" d="M12 8H36V18H52V32H12Z" />${h([[12,8],[36,8],[36,18],[52,18],[52,32],[12,32]])}`,measure:()=>e`<path class="w" d="M12 14H52V34H12Z" /><path class="a" d="M12 6H52M12 3V9M52 3V9" />`,wall:()=>e`<path class="w wide" d="M10 30L54 10" />${h([[10,30],[54,10]])}`,opening:()=>e`<path class="w wide" d="M4 30H22M42 30H60" /><path class="l" d="M22 30V12" /><path class="a dash" d="M22 12A18 18 0 0 1 40 30" />`,hole:()=>e`<rect class="x" x="14" y="7" width="36" height="26" /><path class="l" d="M18 13H46M18 19H46M18 25H46" />`,roof:()=>e`<path class="m" d="M14 19V35H50V19L32 8Z" /><path class="w" d="M8 22L32 6L56 22" />`,out_lawn:()=>e`<rect class="g" x="8" y="8" width="48" height="24" rx="4" /><path class="gl" d="M17 25l2-5 2 5M30 19l2-5 2 5M43 26l2-5 2 5" />`,out_terrace:()=>e`<rect class="s" x="8" y="8" width="48" height="24" /><path class="l" d="M8 16H56M8 24H56M20 8V32M32 8V32M44 8V32" />`,out_path:()=>e`<path class="band" d="M4 34C18 34 18 8 32 8S46 34 60 34" />`,out_driveway:()=>e`<path class="m" d="M14 36L22 4H42L50 36Z" /><path class="a dash" d="M32 8V34" />`,out_bed:()=>e`<ellipse class="k" cx="32" cy="20" rx="24" ry="12" /><circle class="d" cx="22" cy="18" r="2.4" /><circle class="d" cx="32" cy="23" r="2.4" /><circle class="d" cx="42" cy="17" r="2.4" />`,out_wild:()=>e`<path class="g x" d=${g} /><path class="gl" d="M22 24l2-6 2 6M36 20l2-6 2 6" />`,out_hedge:()=>e`${[14,25,36,47].map(l=>e`<circle class="g" cx=${l+1} cy="20" r="7.5" />`)}`,out_fence:()=>e`<path class="w" d="M12 9V33M24 9V33M36 9V33M48 9V33" /><path class="l" d="M7 16H53M7 26H53" />`,out_pergola:()=>e`<rect class="k" x="10" y="9" width="44" height="22" /><path class="l" d="M18 9V31M26 9V31M34 9V31M42 9V31" />`,out_balcony:()=>e`<path class="w wide" d="M4 9H60" /><rect class="s" x="14" y="9" width="36" height="20" /><path class="a" d="M14 29H50" />`,pool_rect:()=>e`<rect class="p" x="10" y="8" width="44" height="24" rx="2" />${o(20,16,48)}`,pool_round:()=>e`<circle class="p" cx="32" cy="20" r="15" />${o(20,20,44)}`,pool_oval:()=>e`<ellipse class="p" cx="32" cy="20" rx="25" ry="13" />${o(20,14,50)}`,pool_free:()=>e`<path class="p" d=${g} />${o(21,20,44)}`,pool_pipes:()=>e`<path class="a wide" d="M8 30H24V12H42V26H56" />${h([[24,12],[42,26]])}`};return{pic:l=>e`<svg class="fp3d-tc-svg" viewBox="0 0 64 40" aria-hidden="true" focusable="false">${d[l]?.()??e`<rect class="x" x="12" y="8" width="40" height="24" />`}</svg>`,ids:Object.keys(d)}}function R(e){let{LitElement:h,html:o,css:g,nothing:d,touchWording:b}=e,{fold:l,howKey:p,recentCards:u,RECENT_KEY:y,searchCards:H,useCard:E}=e.cards,L=T(e.svg).pic;function C(){try{let x=JSON.parse(localStorage.getItem(y)??"[]");return Array.isArray(x)?x.filter(t=>typeof t=="string"):[]}catch{return[]}}class v extends h{static properties={group:{attribute:!1},cards:{attribute:!1},active:{attribute:!1},free:{attribute:!1},touch:{attribute:!1},t:{attribute:!1},areas:{attribute:!1},_query:{state:!0},_hint:{state:!0},_recent:{state:!0}};constructor(){super(),this.group="build",this.cards=[],this.active=null,this.free=!1,this.touch=!1,this.t=t=>t,this.areas=[],this._query="",this._hint=null,this._recent=C()}send(t,a){this.dispatchEvent(new CustomEvent(t,{detail:a,bubbles:!0,composed:!0}))}focusStart(){let t=this.renderRoot;(this.touch?t.querySelector(".tc[aria-pressed='true']")??t.querySelector(".tc"):t.querySelector(".search"))?.focus()}pick(t){this._recent=E(this._recent,t.id);try{localStorage.setItem(y,JSON.stringify(this._recent))}catch{}this.send("tool-pick",{id:t.id})}how(t){return b(this.touch,p(t,this.free),this.t)}found(){return H(this.cards,this._query,t=>`${this.t(t.name)} ${this.t(p(t,!1))}`)}keys=t=>{t.stopPropagation();let a=this.renderRoot,r=a.activeElement,s=[...a.querySelectorAll(".tc")],n=r?.classList.contains("search");if(t.key==="Escape"){t.preventDefault(),n&&this._query?this._query="":this.send("tool-close",{refocus:!0});return}if(n){if(t.key==="ArrowDown"&&s.length)t.preventDefault(),s[0].focus();else if(t.key==="Enter"){let f=this.found()[0];f&&(t.preventDefault(),this.pick(f))}return}let i=r?s.indexOf(r):-1;if(i<0)return;let c=-1;if(t.key==="ArrowRight")c=Math.min(s.length-1,i+1);else if(t.key==="ArrowLeft")c=Math.max(0,i-1);else if(t.key==="Home")c=0;else if(t.key==="End")c=s.length-1;else if(t.key==="ArrowDown"||t.key==="ArrowUp"){let f=s[i].getBoundingClientRect(),w=t.key==="ArrowDown",$=1/0;if(s.forEach((V,k)=>{let m=V.getBoundingClientRect(),_=w?m.top-f.bottom:f.top-m.bottom;if(_<-1)return;let M=_*10+Math.abs(m.left-f.left);k!==i&&M<$&&([$,c]=[M,k])}),c<0&&!w){t.preventDefault(),a.querySelector(".search")?.focus();return}}c>=0&&(t.preventDefault(),s[c].focus())};card(t){let a=t.id===this.active,r=s=>()=>this._hint=s;return o`<button class="tc" aria-pressed=${a?"true":"false"} data-id=${t.id} title=${this.touch?d:this.how(t)} @click=${()=>this.pick(t)} @focus=${r(t.id)} @blur=${r(null)} @pointerenter=${r(t.id)} @pointerleave=${r(null)}>
        <span class="pic">${L(t.id)}</span>
        <span class="name">${this.t(t.name)}</span>
      </button>`}hintLine(){let t=this._hint??this.active,a=t?this.cards.find(r=>r.id===t):void 0;return a?o`<b>${this.t(a.name)}</b> · ${this.how(a)}`:o`${this.t("tp_pick")}`}render(){let t=this.t,a=this._query.trim(),r=this.found(),s=a?[]:u(this.cards,this._recent),n=t(this.group==="build"?"tool_group_build":"tool_group_outside");return o`<div class="box" role="dialog" aria-label=${n} @keydown=${this.keys}>
        <div class="top">
          <input class="search" type="search" .value=${this._query} placeholder=${t("tp_search")} aria-label=${t("tp_search")} @input=${i=>this._query=i.target.value} />
          ${this.group==="outside"?o`<div class="seg" role="radiogroup" aria-label=${t("tp_shape")}>
                <span class="seg-label" aria-hidden="true">${t("tp_shape")}</span>
                ${[!1,!0].map(i=>o`<button role="radio" aria-checked=${this.free===i?"true":"false"} @click=${()=>this.send("tool-free",{free:i})}>${t(i?"outdoor_shape_free":"outdoor_shape_rect")}</button>`)}
              </div>`:d}
        </div>
        <div class="body">
          ${s.length?o`<h4 class="head">${t("lib_recent")}</h4>
                <div class="grid recent">${s.map(i=>this.card(i))}</div>
                <h4 class="head">${t("tp_all")}</h4>`:d}
          ${r.length?this.grids(r,!a):o`<p class="none">${t("lib_no_match",{q:a})}</p>`}
          ${this.renderAreas()}
        </div>
        <p class="hint" aria-live="polite">${this.hintLine()}</p>
      </div>`}grids(t,a){let r=a&&this.group==="outside"?t.filter(n=>n.tool==="pool"):[],s=r.length?t.filter(n=>n.tool!=="pool"):t;return o`<div class="grid">${s.map(n=>this.card(n))}</div>
        ${r.length?o`<h4 class="head">${this.t("tool_pool")}</h4><div class="grid">${r.map(n=>this.card(n))}</div>`:d}`}renderAreas(){if(this.group!=="outside"||!this.areas.length)return d;let t=l(this._query).split(/\s+/).filter(Boolean),a=this.areas.filter(r=>t.every(s=>l(`${r.name} ${r.note}`).includes(s)));return a.length?o`<h4 class="head">${this.t("tp_on_plan",{n:a.length})}</h4>
        <div class="areas">
          ${a.map(r=>o`<button class="area" aria-pressed=${r.selected?"true":"false"} @click=${()=>this.send("area-go",{floor:r.floor,id:r.id})}>
              <span>${r.name}</span><small>${r.note}</small>
            </button>`)}
        </div>`:d}static styles=g`
      :host {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        z-index: 30;
        width: min(400px, calc(100vw - 24px));
        max-height: min(72vh, 600px);
        display: flex;
        color: var(--fp3d-text);
        font-family: var(--fp3d-font, inherit);
        font-size: 14px;
        background: var(--fp3d-chrome-solid, #0f172a);
        border: 1px solid var(--fp3d-line);
        border-radius: 14px;
        box-shadow: var(--fp3d-shadow);
      }
      /* a phone: a sheet above the bottom bar, as the old menus were */
      :host([sheet]) {
        top: auto;
        left: 0;
        right: 0;
        bottom: var(--fp3d-bar-h, 76px);
        width: auto;
        max-height: 72%;
        border-width: 1px 0 0;
        border-radius: 14px 14px 0 0;
        box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.5);
      }
      .box {
        display: flex;
        flex-direction: column;
        min-height: 0;
        width: 100%;
      }
      .top {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px 12px 8px;
        border-bottom: 1px solid var(--fp3d-line);
      }
      .search {
        min-height: 36px;
        box-sizing: border-box;
        font: inherit;
        color: var(--fp3d-text);
        background: var(--fp3d-panel, #1e293b);
        border: 1px solid var(--fp3d-line);
        border-radius: var(--fp3d-radius-control, 6px);
        padding: 6px 10px;
      }
      .seg {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
      }
      .seg-label {
        color: var(--fp3d-muted);
        margin-right: 4px;
      }
      .seg button {
        min-height: 32px;
        padding: 0 12px;
        font: inherit;
        color: var(--fp3d-text);
        background: none;
        border: 1px solid var(--fp3d-line);
        border-radius: 999px;
        cursor: pointer;
      }
      .seg button[aria-checked="true"] {
        color: var(--fp3d-primary-text, #fff);
        background: var(--fp3d-primary);
        border-color: var(--fp3d-primary);
        font-weight: 600;
      }
      .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 4px 12px 8px;
      }
      .head {
        margin: 10px 0 6px;
        font-size: 12px;
        font-weight: 600;
        color: var(--fp3d-muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
        gap: 8px;
        margin-top: 8px;
      }
      .head + .grid {
        margin-top: 0;
      }
      .tc {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 4px;
        padding: 6px 6px 8px;
        font: inherit;
        text-align: left;
        color: var(--fp3d-text);
        background: color-mix(in srgb, var(--fp3d-panel, #1e293b) 55%, transparent);
        border: 1px solid var(--fp3d-line);
        border-radius: var(--fp3d-radius-card, 8px);
        cursor: pointer;
      }
      .tc:hover {
        border-color: var(--fp3d-accent);
      }
      .tc:focus-visible,
      .seg button:focus-visible,
      .search:focus-visible,
      .area:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 1px;
      }
      .tc[aria-pressed="true"] {
        border-color: var(--fp3d-accent);
        background: color-mix(in srgb, var(--fp3d-accent) 14%, transparent);
      }
      .tc[aria-pressed="true"] .name {
        color: var(--fp3d-accent);
        font-weight: 700;
      }
      .pic {
        display: block;
        height: 52px;
        border-radius: 6px;
        background: color-mix(in srgb, var(--fp3d-bg, #070b14) 45%, transparent);
      }
      .fp3d-tc-svg {
        display: block;
        width: 100%;
        height: 100%;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .w {
        stroke: var(--fp3d-text);
        stroke-width: 2.2;
      }
      .wide {
        stroke-width: 4;
      }
      .l {
        stroke: var(--fp3d-muted);
        stroke-width: 1.2;
      }
      .a {
        stroke: var(--fp3d-accent);
        stroke-width: 1.8;
      }
      .dash {
        stroke-dasharray: 3 3;
      }
      .x {
        stroke: var(--fp3d-muted);
        stroke-width: 1.6;
        stroke-dasharray: 4 3;
      }
      .d {
        fill: var(--fp3d-accent);
      }
      .g,
      .s,
      .k,
      .m,
      .p {
        stroke-width: 1.5;
      }
      .g {
        fill: color-mix(in srgb, var(--fp3d-success) 28%, transparent);
        stroke: var(--fp3d-success);
      }
      .gl {
        stroke: var(--fp3d-success);
        stroke-width: 1.5;
      }
      .s {
        fill: color-mix(in srgb, var(--fp3d-soft) 24%, transparent);
        stroke: var(--fp3d-soft);
      }
      .k {
        fill: color-mix(in srgb, var(--fp3d-warm) 26%, transparent);
        stroke: var(--fp3d-warm);
      }
      .m {
        fill: color-mix(in srgb, var(--fp3d-muted) 22%, transparent);
        stroke: var(--fp3d-muted);
      }
      .p {
        fill: color-mix(in srgb, var(--fp3d-accent) 26%, transparent);
        stroke: var(--fp3d-accent);
      }
      .band {
        stroke: var(--fp3d-muted);
        stroke-width: 7;
        opacity: 0.8;
      }
      .name {
        font-size: 13px;
        font-weight: 500;
        line-height: 1.25;
      }
      .areas {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .area {
        display: flex;
        align-items: baseline;
        gap: 8px;
        min-height: 36px;
        padding: 6px 8px;
        font: inherit;
        text-align: left;
        color: var(--fp3d-text);
        background: none;
        border: 0;
        border-radius: var(--fp3d-radius-control, 6px);
        cursor: pointer;
      }
      .area:hover {
        background: color-mix(in srgb, var(--fp3d-accent) 14%, transparent);
      }
      .area[aria-pressed="true"] {
        color: var(--fp3d-accent);
        font-weight: 600;
      }
      .area span {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .area small {
        flex: none;
        font-size: 12px;
        color: var(--fp3d-muted);
      }
      .none {
        margin: 8px 0;
        font-size: 13px;
        color: var(--fp3d-muted);
      }
      .hint {
        margin: 0;
        padding: 8px 12px 10px;
        font-size: 12.5px;
        line-height: 1.35;
        color: var(--fp3d-muted);
        border-top: 1px solid var(--fp3d-line);
      }
      .hint b {
        color: var(--fp3d-text);
        font-weight: 600;
      }
      @media (pointer: coarse) {
        .search,
        .seg button {
          min-height: var(--fp3d-touch, 44px);
        }
      }
      @media (forced-colors: active) {
        .tc[aria-pressed="true"],
        .seg button[aria-checked="true"] {
          outline: 2px solid CanvasText;
        }
      }
    `}return e.defineElement("fp3d-tool-panel",v),v}export{R as defineToolPanel};
