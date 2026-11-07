import{$ as ie,A as Ut,J as Y,K as D,L as Xt,N as Jt,O as K,P as Qt,Q as Yt,S as Zt,W as te,X as ee,_ as Z,a as bt,aa as ne,c as kt,ja as le,l as xt,p as Ot,q as Rt,r as Ct,s as P,t as y,u as It,v as Ft,w as F,z as At}from"./home-3d-editor-chunk-M5HJLRXH.js";import{a as se,b as ae,d as re}from"./home-3d-editor-chunk-LMQHWYMJ.js";import{a as Wt}from"./home-3d-editor-chunk-IA3SIIPF.js";import{a as O,b as U,f as Dt,g as X,h as Kt,i as J,j as Q}from"./home-3d-editor-chunk-KIKI4EOC.js";import{B as qt,C as jt,D as Bt,E as N,F as Gt,G as Vt,g as _t,h as yt,i as wt,j as Et,k as V,m as St,n as Pt,o as Lt,p as Tt,q as Mt,w as zt,y as H}from"./home-3d-editor-chunk-J3BJX3WB.js";import"./home-3d-editor-chunk-6F2XQ5BE.js";import{b as B,d as vt,e as G}from"./home-3d-editor-chunk-XHXGJ2X3.js";import{b as _,c as I}from"./home-3d-editor-chunk-6BWZATOE.js";import{a as z,b as A,c as Ht,d as W,e as Nt}from"./home-3d-editor-chunk-TGCLCCRU.js";import{C as T,K as ft,M,N as gt,O as mt,a as dt,c as ct,e as ht,h as ut}from"./home-3d-editor-chunk-MSQAKZWT.js";import{b as $t}from"./home-3d-editor-chunk-A74QUOUQ.js";import{a as v}from"./home-3d-editor-chunk-TAAEQO2A.js";import{b as x,c as a,e as pt,f as c,h as $}from"./home-3d-editor-chunk-GGWVF3HT.js";var oe=(m,t,e)=>{let s=new Map;for(let i=t;i<=e;i++)s.set(m[i],i);return s},pe=Rt(class extends Ct{constructor(m){if(super(m),m.type!==Ot.CHILD)throw Error("repeat() can only be used in text expressions")}dt(m,t,e){let s;e===void 0?e=t:t!==void 0&&(s=t);let i=[],r=[],p=0;for(let h of m)i[p]=s?s(h,p):p,r[p]=e(h,p),p++;return{values:r,keys:i}}render(m,t,e){return this.dt(m,t,e).values}update(m,[t,e,s]){let i=Ft(m),{values:r,keys:p}=this.dt(t,e,s);if(!Array.isArray(i))return this.ut=p,r;let h=this.ut??=[],o=[],d,l,n=0,g=i.length-1,f=0,b=r.length-1;for(;n<=g&&f<=b;)if(i[n]===null)n++;else if(i[g]===null)g--;else if(h[n]===p[f])o[f]=y(i[n],r[f]),n++,f++;else if(h[g]===p[b])o[b]=y(i[g],r[b]),g--,b--;else if(h[n]===p[b])o[b]=y(i[n],r[b]),P(m,o[b+1],i[n]),n++,b--;else if(h[g]===p[f])o[f]=y(i[g],r[f]),P(m,i[n],i[g]),g--,f++;else if(d===void 0&&(d=oe(p,f,b),l=oe(h,n,g)),d.has(h[n]))if(d.has(h[g])){let k=l.get(p[f]),E=k!==void 0?i[k]:null;if(E===null){let S=P(m,i[n]);y(S,r[f]),o[f]=S}else o[f]=y(E,r[f]),P(m,i[n],E),i[k]=null;f++}else F(i[g]),g--;else F(i[n]),n++;for(;f<=b;){let k=P(m,o[b+1]);y(k,r[f]),o[f++]=k}for(;n<=g;){let k=i[n++];k!==null&&F(k)}return this.ut=p,It(m,o),pt}});var Ee=10,de=24,Se=96,ce="home3d.lib.open",he="home3d.lib.fav",ue="home3d.lib.recent",fe="home3d.lib.recent.shut",ge="home3d.lib.shut",me="home3d.lib.filters",be=new Set(["fav","other-rooms"]),Pe=["sofa","lamp"],w=m=>`${m.type}|${m.packRelease}`;function R(m,t){try{let e=localStorage.getItem(m);return e?JSON.parse(e):t}catch{return t}}function L(m,t){try{localStorage.setItem(m,JSON.stringify(t))}catch{}}function ke(m){let t=R(m,[]);return Array.isArray(t)?t.filter(e=>typeof e=="string").map(ct):[]}var tt=class extends ${static properties={entries:{attribute:!1},language:{attribute:!1},roomHint:{attribute:!1},admin:{type:Boolean},lite:{type:Boolean},t:{attribute:!1},thumb:{attribute:!1},updates:{attribute:!1},_query:{state:!0},_room:{state:!0},_electric:{state:!0},_light:{state:!0},_outdoor:{state:!0},_pack:{state:!0},_open:{state:!0},_shut:{state:!0},_searchShut:{state:!0},_fav:{state:!0},_recent:{state:!0},_recentShut:{state:!0},_thumbs:{state:!0},_shown:{state:!0},_limits:{state:!0},_filtersOpen:{state:!0},_status:{state:!0}};defaultOpen=new Set;resultText="";filterKey="";announcedKey=null;statusTimer;roomTouched=!1;observer=null;observed=new WeakSet;wanted=new Set;drawing=0;warmTimer;queue=[];constructor(){super(),this.entries=[],this.language="en",this.roomHint=null,this.admin=!0,this.lite=(navigator.hardwareConcurrency??4)<=2||(navigator.deviceMemory??4)<=2,this.t=e=>e,this.thumb=null,this.updates=new Set,this._query="",this._room=null,this._electric=!1,this._light=!1,this._outdoor=!1,this._pack=null;let t=R(ce,null);this._open=Array.isArray(t)?new Set(t):null,this._shut=new Set(R(ge,[])),this._searchShut=new Set,this._fav=ke(he),this._recent=ke(ue),this._recentShut=R(fe,!1)===!0,this._thumbs=new Map,this._shown=new Map,this._limits=new Map,this._filtersOpen=R(me,!1)===!0,this._status=""}willUpdate(t){if(t.has("roomHint")&&!this.roomTouched&&(this._room=this.roomHint),t.has("entries")){clearTimeout(this.warmTimer);let e=this.entries,s=r=>{let p=Math.min(e.length,r+200);Dt(e.slice(r,p)),p<e.length&&(this.warmTimer=setTimeout(()=>s(p),0))};this.warmTimer=setTimeout(()=>s(0),300),this._pack&&!this.entries.some(r=>r.pack===this._pack)&&(this._pack=null);let i=new Set(this.entries.map(r=>r.key));this._fav=this._fav.filter(r=>i.has(r)),this._recent=this._recent.filter(r=>i.has(r)),this.queue=[],this.resetPictures(this.entries)}}resetPictures(t){let e=new Set(t.map(w));this._thumbs=new Map([...this._thumbs].filter(([s])=>e.has(s))),this.wanted=new Set([...this.wanted].filter(s=>this._thumbs.has(s)))}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this.warmTimer),clearTimeout(this.statusTimer),this.observer?.disconnect(),this.observer=null}updated(){let t=`${this._query.trim()}|${this.filterKey}`;if(this.announcedKey===null?this.announcedKey=t:t!==this.announcedKey&&(this.announcedKey=t,clearTimeout(this.statusTimer),this.statusTimer=setTimeout(()=>this._status=this.resultText,500)),this.lite||!this.thumb)return;this.observer??=new IntersectionObserver(s=>{for(let i of s){if(!i.isIntersecting)continue;let r=this.byKey.get(i.target.dataset.key??"");r&&this.want(r)}},{root:null,rootMargin:"200px"});let e=this.byKey;for(let s of this.renderRoot.querySelectorAll(".fp3d-lc-pic[data-key]")){if(!this.observed.has(s)){this.observed.add(s),this.observer.observe(s);continue}let i=e.get(s.dataset.key??"");!i||this._thumbs.has(w(i))||this.wanted.has(w(i))||(this.observer.unobserve(s),this.observer.observe(s))}}get byKey(){return new Map(this.entries.map(t=>[t.key,t]))}showVariant(t,e,s){if(this.lite||!this.thumb){this.preview(e?.type??null,s);return}let i=new Map(this._shown);e?i.set(t,e.key):i.delete(t),this._shown=i,e&&this.want(e)}want(t){let e=w(t);this._thumbs.has(e)||this.wanted.has(e)||(this.wanted.add(e),this.queue.push(t),this.drain())}drain(){for(;this.drawing<2&&this.queue.length;){let t=this.queue.shift();this.drawing++;let e=w(t),s=`${e}|${Se}|1`;Wt(s,()=>this.thumb?this.thumb(t):Promise.resolve(null)).then(i=>{if(i){let r=new Map(this._thumbs);r.set(e,i),this._thumbs=r}else this.wanted.delete(e)}).catch(()=>this.wanted.delete(e)).finally(()=>{this.drawing--,this.drain()})}}pick(t){this.admin&&(this._recent=[t.key,...this._recent.filter(e=>e!==t.key)].slice(0,Ee),L(ue,this._recent),this.resetFilters(),this.dispatchEvent(new CustomEvent("library-add",{detail:{type:t.type,mirror:!!t.mirror},bubbles:!0,composed:!0})))}preview(t,e){this.lite&&this.dispatchEvent(new CustomEvent("library-preview",{detail:{type:t,element:e},bubbles:!0,composed:!0}))}toggleFav(t){this._fav=this._fav.includes(t)?this._fav.filter(e=>e!==t):[...this._fav,t],L(he,this._fav)}toggleRecent(){this._recentShut=!this._recentShut,L(fe,this._recentShut)}isOpen(t,e){return t==="recent"?!this._recentShut:e?!this._searchShut.has(t):be.has(t)?!this._shut.has(t):(this._open??this.defaultOpen).has(t)}toggleOpen(t,e){if(t==="recent")return this.toggleRecent();let s=i=>{let r=new Set(i);return r.has(t)?r.delete(t):r.add(t),r};e?this._searchShut=s(this._searchShut):be.has(t)?(this._shut=s(this._shut),L(ge,[...this._shut])):(this._open=s(this._open??this.defaultOpen),L(ce,[...this._open]))}setQuery(t){!!this._query.trim()!=!!t.trim()&&(this._searchShut=new Set),this._query=t}setFiltersOpen(t){this._filtersOpen=t,L(me,t)}setRoom(t){this.roomTouched=!0,this._room=t}get filter(){return{query:this._query,room:this._room,electric:this._electric,light:this._light,outdoor:this._outdoor,pack:this._pack}}get activeFilters(){return X(this.filter)}clearFilters(){this.roomTouched=!0,this._room=null,this._pack=null,this._electric=this._light=this._outdoor=!1}resetFilters(){this.roomTouched=!1,this._room=this.roomHint,this._pack=null,this._electric=this._light=this._outdoor=!1}render(){let t=this.t,e=this.filter,s=Kt(this.entries,e),i=s.hits,r=this._query.trim().length>0,p=this.byKey,h=new Set(i.map(u=>u.key)),o=u=>({key:u.key,label:u.label,kind:u.kind,rooms:u.rooms,entries:[u]}),d=this._recent.map(u=>p.get(u)).filter(u=>!!u&&h.has(u.key)),l=this._fav.map(u=>p.get(u)).filter(u=>!!u&&h.has(u.key)),n=O.map(u=>({kind:u,cards:J(s.inRoom,u)})).filter(u=>u.cards.length),g=s.otherRooms.length?O.flatMap(u=>J(s.otherRooms,u)):[],f=n.filter(u=>Pe.includes(u.kind)).map(u=>u.kind);this.defaultOpen=new Set(f.length?f:n.length?[n[0].kind]:[]);let b=X(e),k=u=>u==="room"?t(`lib_room_${this._room}`):u==="pack"?this.entries.find(j=>j.pack===this._pack)?.packLabel??this._pack??"":t(`lib_chip_${u}`),E=this.packList(),S=b.length,C=this._filtersOpen,ot=this._query.trim();return this.resultText=i.length===1?t("lib_results_one"):t("lib_results",{n:i.length}),this.filterKey=JSON.stringify(e),a`<div class="fp3d-lib-top">
        <div class="fp3d-lib-bar">
          <input
            class="fp3d-search"
            type="search"
            aria-label=${t("lib_search_label")}
            placeholder=${t("furniture_search")}
            .value=${this._query}
            @input=${u=>this.setQuery(u.target.value)}
            @keydown=${u=>{u.key==="Escape"&&this.setQuery("")}}
          />
          <button class="fp3d-lib-filterbtn ${C||S?"on":""}" aria-expanded=${C} aria-controls="fp3d-lib-filters" @click=${()=>this.setFiltersOpen(!C)}>
            ${t("lib_filters_btn")}${S?a` <span class="fp3d-lib-badge">${S}</span>`:c}
          </button>
        </div>
        <div id="fp3d-lib-filters" class="fp3d-lib-drawer" ?hidden=${!C}>
          <label class="fp3d-lib-sel"
            ><span>${t("lib_room_label")}</span>
            <select @change=${u=>this.setRoom(u.target.value||null)}>
              <option value="" ?selected=${this._room===null}>${t("lib_room_all")}</option>
              ${U.map(u=>a`<option value=${u} ?selected=${this._room===u}>${t(`lib_room_${u}`)}</option>`)}
            </select></label
          >
          ${E.size<2?c:a`<label class="fp3d-lib-sel"
                ><span>${t("lib_pack_label")}</span>
                <select @change=${u=>this._pack=u.target.value||null}>
                  <option value="" ?selected=${this._pack===null}>${t("lib_pack_all")}</option>
                  ${[...E].map(([u,j])=>a`<option value=${u} ?selected=${this._pack===u}>${j}</option>`)}
                </select></label
              >`}
          <div class="fp3d-lib-chips" role="group" aria-label=${t("lib_toggles_label")}>
            <button class="fp3d-chip fp3d-chip-f ${this._electric?"on":""}" aria-pressed=${this._electric} @click=${()=>this._electric=!this._electric}><span aria-hidden="true">⚡</span> ${t("lib_chip_electric")}</button>
            <button class="fp3d-chip fp3d-chip-f ${this._light?"on":""}" aria-pressed=${this._light} @click=${()=>this._light=!this._light}><span aria-hidden="true">💡</span> ${t("lib_chip_light")}</button>
            <button class="fp3d-chip fp3d-chip-f ${this._outdoor?"on":""}" aria-pressed=${this._outdoor} @click=${()=>this._outdoor=!this._outdoor}><span aria-hidden="true">🌳</span> ${t("lib_chip_outdoor")}</button>
          </div>
        </div>
        ${b.length?a`<div class="fp3d-lib-active">
              <span>${t("lib_filters")} ${b.map(k).join(" \xB7 ")}${s.hiddenByChips?a` <span class="fp3d-lib-hidden">(${t("lib_hidden_by_filters",{n:s.hiddenByChips})})</span>`:c}</span>
              <button class="fp3d-lib-clear" @click=${()=>this.clearFilters()}>${t("lib_clear_filters")}</button>
            </div>`:c}
      </div>
      <div class="fp3d-lib-sr" role="status" aria-live="polite">${this._status}</div>
      ${!r&&this.roomHint&&this._room===this.roomHint&&!this.roomTouched?a`<p class="fp3d-lib-hint">${t("lib_hint_room")}</p>`:c}
      ${i.length?c:a`<div class="fp3d-lib-empty">
            <p class="fp3d-lib-hint">${ot?t("lib_no_match",{q:ot}):t("furniture_search_none")}</p>
            ${s.hiddenByChips?a`<p class="fp3d-lib-hint">${t("lib_hidden_by_filters",{n:s.hiddenByChips})}</p>`:c}
            ${b.length?a`<button class="fp3d-lib-clear fp3d-lib-clear-big" @click=${()=>this.clearFilters()}>${t("lib_clear_filters")}</button>`:c}
          </div>`}
      ${s.cut?a`<p class="fp3d-lib-hint">${t("lib_keep_typing",{n:s.cut})}</p>`:c}
      ${d.length&&!r?this.section("recent",`\u{1F558} ${t("lib_recent")}`,d.map(o),r):c}
      ${l.length?this.section("fav",`\u2605 ${t("lib_favorites")}`,l.map(o),r):c}
      ${n.map(u=>this.section(u.kind,t(`lib_kind_${u.kind}`),u.cards,r))}
      ${g.length?this.section("other-rooms",t("lib_other_rooms",{n:s.otherRooms.length}),g,r):c}`}packList(){let t=new Map;for(let e of this.entries)e.pack&&e.packLabel&&t.set(e.pack,e.packLabel);return t}section(t,e,s,i){let r=t==="recent",p=this.isOpen(t,i),h=this._limits.get(t)??de,o=s.slice(0,h),d=s.reduce((l,n)=>l+n.entries.length,0);return a`<button class="fp3d-lib-head fp3d-lib-toggle ${r?"fp3d-lib-recent":""}" aria-expanded=${p} @click=${()=>this.toggleOpen(t,i)}>
        <span class="fp3d-lib-caret">${p?"\u25BE":"\u25B8"}</span>${e} <span class="fp3d-lib-count">${d}</span>
      </button>
      ${p?a`<div class="fp3d-lib-grid ${r?"fp3d-lib-recent-grid":""}">${pe(o,l=>l.key,l=>this.card(l))}</div>
            ${s.length>h?a`<button class="fp3d-lib-more" @click=${()=>{let l=new Map(this._limits);l.set(t,h+de*2),this._limits=l}}>${this.t("lib_more",{n:s.length-h})}</button>`:c}`:c}`}card(t){let e=this.t,s=t.entries[0],i=t.entries.length>1,r=this._fav.includes(s.key),p=this._shown.get(s.key),h=p&&t.entries.find(n=>n.key===p)||s,o=this._thumbs.get(w(h))??this._thumbs.get(w(s)),d=s.light?"\u{1F4A1}":s.electric?"\u26A1":"",l=qt(t.entries.map(n=>n.type),this.updates,this.admin);return a`<div class="fp3d-lc ${i?"fp3d-lc-family":""}" title=${h.ikea?`${h.label} (IKEA ${h.ikea})`:h.label} @mouseleave=${()=>i&&this.showVariant(s.key,null,null)}>
      <button
        class="fp3d-lc-main"
        ?disabled=${!this.admin}
        @click=${()=>this.pick(s)}
        @mouseenter=${n=>this.preview(s.type,n.currentTarget)}
        @focus=${n=>this.preview(s.type,n.currentTarget)}
        @mouseleave=${()=>this.preview(null,null)}
        @blur=${()=>this.preview(null,null)}
      >
        ${this.lite?c:a`<span class="fp3d-lc-pic" data-key=${s.key}>${o?a`<img src=${o} alt="" loading="lazy" class=${(this._thumbs.has(w(h))?h:s).mirror?"fp3d-lc-mirrored":""} />`:a`<span class="fp3d-lc-wait"></span>`}</span>`}
        <span class="fp3d-lc-label">${t.label}${d?a` <span class="fp3d-lc-badge">${d}</span>`:c}</span>
        <span class="fp3d-lc-sub">${i?e("lib_sizes",{n:t.entries.length}):Q(s.size,this.language)}${s.packLabel?a` · ${s.packLabel}`:a` · ${e("lib_basic")}`}</span>
      </button>
      ${i?a`<div class="fp3d-lc-chips">
            ${t.entries.map(n=>a`<button
                title="${n.label} · ${Q(n.size,this.language)}"
                ?disabled=${!this.admin}
                class="fp3d-lc-chip ${h.key===n.key&&i&&p?"on":""}"
                @click=${()=>this.pick(n)}
                @mouseenter=${g=>this.showVariant(s.key,n,g.currentTarget)}
                @focus=${g=>this.showVariant(s.key,n,g.currentTarget)}
                @mouseleave=${()=>this.preview(null,null)}
                @blur=${()=>this.preview(null,null)}
              >${n.variant??n.label}</button>`)}
          </div>`:c}
      ${l.length?a`<button
            class="fp3d-lc-update"
            title=${e("lib_update_title")}
            @click=${()=>this.dispatchEvent(new CustomEvent("library-update",{detail:{types:l},bubbles:!0,composed:!0}))}
          >
            ⟳ ${e("upd_update")}
          </button>`:c}
      <button class="fp3d-lc-fav ${r?"on":""}" title=${e(r?"lib_fav_remove":"lib_fav_add")} aria-label=${e(r?"lib_fav_remove":"lib_fav_add")} @click=${()=>this.toggleFav(s.key)}>${r?"\u2605":"\u2606"}</button>
    </div>`}static styles=[_,x`
      :host {
        display: block;
      }
      /* the search and the filter button stay in view above the results (sticky in the scrolling side panel, #300) */
      .fp3d-lib-top {
        position: sticky;
        top: 0;
        z-index: 3;
        margin: 0 -2px;
        padding: 6px 2px 2px;
        background: var(--fp3d-chrome-solid, var(--fp3d-panel, #0d1424));
        /* solid up to the panel's top edge too (#320): the side panel's top padding sits above a top:0 sticky box, and
           the rows scrolled up into it showed through */
        box-shadow: 0 -14px 0 var(--fp3d-chrome-solid, var(--fp3d-panel, #0d1424));
      }
      .fp3d-lib-bar {
        display: flex;
        gap: 6px;
        margin-bottom: 6px;
      }
      .fp3d-search {
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
      .fp3d-lib-filterbtn {
        flex: none;
        min-height: 36px;
        padding: 0 12px;
        font: inherit;
        font-size: 13px;
        color: var(--fp3d-text);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        cursor: pointer;
      }
      .fp3d-lib-filterbtn.on {
        border-color: var(--fp3d-accent);
      }
      .fp3d-lib-badge {
        display: inline-block;
        min-width: 16px;
        padding: 0 5px;
        font-size: 11px;
        font-weight: 700;
        line-height: 16px;
        text-align: center;
        color: var(--fp3d-primary-text);
        background: var(--fp3d-primary);
        border-radius: 999px;
      }
      .fp3d-lib-drawer {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        margin-bottom: 6px;
      }
      .fp3d-lib-drawer[hidden] {
        display: none;
      }
      .fp3d-lib-drawer .fp3d-lib-chips {
        grid-column: 1 / -1;
        margin-bottom: 0;
      }
      .fp3d-lib-sel {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        font-size: 11px;
        color: var(--fp3d-muted);
      }
      .fp3d-lib-sel select {
        min-height: 36px;
        min-width: 0;
        box-sizing: border-box;
        font: inherit;
        font-size: 13px;
        color: var(--fp3d-text);
        background: var(--fp3d-panel, #0d1424);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        padding: 0 6px;
      }
      .fp3d-lib-sr {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
        border: 0;
      }
      .fp3d-lib-empty {
        margin: 4px 0 8px;
      }
      .fp3d-lib-clear-big {
        padding: 6px 12px;
      }
      .fp3d-lib-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 6px;
      }
      /* fingers need 40-44 px; the shared coarse rules live in the editor's styles and do not reach this shadow root */
      @media (pointer: coarse) {
        .fp3d-search,
        .fp3d-lib-filterbtn,
        .fp3d-lib-sel select,
        .fp3d-chip,
        .fp3d-lib-clear,
        .fp3d-lib-more,
        .fp3d-lib-head {
          min-height: var(--fp3d-touch, 44px);
        }
        .fp3d-lib-filterbtn,
        .fp3d-chip {
          min-width: 40px;
        }
      }
      .fp3d-chip {
        font: inherit;
        font-size: 12px;
        color: var(--fp3d-text);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--fp3d-line);
        border-radius: 999px;
        padding: 3px 9px;
        cursor: pointer;
        white-space: nowrap;
      }
      .fp3d-chip.on {
        background: var(--fp3d-primary);
        color: var(--fp3d-primary-text);
        border-color: var(--fp3d-accent);
        font-weight: 600;
      }
      .fp3d-chip-f {
        font-size: 11px;
      }
      .fp3d-lib-hint {
        margin: 2px 0 8px;
        font-size: 12px;
        color: var(--fp3d-muted);
      }
      .fp3d-lib-active {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px 8px;
        margin: 0 0 8px;
        padding: 5px 8px;
        font-size: 12px;
        color: var(--fp3d-text);
        border: 1px solid var(--fp3d-accent);
        border-radius: 8px;
        background: rgba(80, 200, 255, 0.08);
      }
      .fp3d-lib-hidden {
        color: var(--fp3d-muted);
      }
      .fp3d-lib-clear {
        margin-left: auto;
        padding: 2px 8px;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        color: var(--fp3d-accent);
        background: none;
        border: 1px solid var(--fp3d-accent);
        border-radius: 999px;
        cursor: pointer;
      }
      .fp3d-lib-head {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        margin: 10px 0 4px;
        padding: 4px 0;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        color: var(--fp3d-text);
        background: none;
        border: 0;
        border-bottom: 1px solid var(--fp3d-line);
        text-align: left;
        cursor: pointer;
      }
      .fp3d-lib-recent {
        padding-left: 8px;
        border-left: 3px solid var(--fp3d-accent);
        background: color-mix(in srgb, var(--fp3d-accent) 10%, transparent);
      }
      .fp3d-lib-recent-grid {
        padding: 6px 0 6px 8px;
        border-left: 3px solid var(--fp3d-accent);
        background: color-mix(in srgb, var(--fp3d-accent) 5%, transparent);
      }
      .fp3d-lib-caret {
        width: 10px;
        color: var(--fp3d-muted);
      }
      .fp3d-lib-count {
        margin-left: auto;
        font-weight: 400;
        font-size: 12px;
        color: var(--fp3d-muted);
        font-variant-numeric: tabular-nums;
      }
      .fp3d-lib-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
        gap: 6px;
      }
      .fp3d-lc {
        position: relative;
        display: flex;
        flex-direction: column;
        /* cards out of view are not laid out or painted: a first letter typed shows hundreds of them (#131) */
        content-visibility: auto;
        contain-intrinsic-size: auto 220px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        overflow: hidden;
      }
      .fp3d-lc:hover {
        border-color: var(--fp3d-accent);
      }
      .fp3d-lc-main {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 2px;
        padding: 6px 6px 5px;
        font: inherit;
        color: var(--fp3d-text);
        background: none;
        border: 0;
        text-align: left;
        cursor: pointer;
      }
      .fp3d-lc-main:disabled {
        cursor: default;
        opacity: 0.6;
      }
      .fp3d-lc-pic {
        display: block;
        height: 64px;
        border-radius: 6px;
        background: radial-gradient(ellipse at 50% 70%, rgba(80, 200, 255, 0.12), transparent 70%);
      }
      .fp3d-lc-pic img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .fp3d-lc-pic img.fp3d-lc-mirrored {
        transform: scaleX(-1);
      }
      .fp3d-lc-wait {
        display: block;
        width: 100%;
        height: 100%;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.03);
      }
      .fp3d-lc-label {
        font-size: 12px;
        font-weight: 500;
        line-height: 1.25;
        padding-right: 16px;
      }
      .fp3d-lc-badge {
        font-size: 10px;
      }
      .fp3d-lc-sub {
        font-size: 10.5px;
        color: var(--fp3d-muted);
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .fp3d-lc-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        padding: 0 6px 6px;
      }
      .fp3d-lc-chip {
        font: inherit;
        font-size: 11px;
        color: var(--fp3d-text);
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid var(--fp3d-line);
        border-radius: 6px;
        padding: 2px 6px;
        cursor: pointer;
        white-space: nowrap;
      }
      .fp3d-lc-chip:hover,
      .fp3d-lc-chip.on {
        border-color: var(--fp3d-accent);
        color: var(--fp3d-accent);
      }
      .fp3d-lc-fav {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 22px;
        height: 22px;
        padding: 0;
        font-size: 14px;
        line-height: 22px;
        color: var(--fp3d-muted);
        background: rgba(4, 16, 24, 0.55);
        border: 0;
        border-radius: 50%;
        cursor: pointer;
      }
      .fp3d-lc-fav.on,
      .fp3d-lc-fav:hover {
        color: #ffd166;
      }
      .fp3d-lc-update {
        position: absolute;
        top: 4px;
        left: 4px;
        padding: 2px 7px;
        font: inherit;
        font-size: 10.5px;
        font-weight: 600;
        color: #04101a;
        background: #ffd166;
        border: 0;
        border-radius: 999px;
        cursor: pointer;
      }
      .fp3d-lib-more {
        display: block;
        width: 100%;
        margin: 6px 0 2px;
        padding: 6px;
        font: inherit;
        font-size: 12px;
        color: var(--fp3d-accent);
        background: none;
        border: 1px dashed var(--fp3d-line);
        border-radius: 8px;
        cursor: pointer;
      }
    `]};v("fp3d-library",tt);var Le=24,$e=6,_e=3,et=[2,_e+$e],Te=0;function ve(m){let t="";do t=`g${Date.now().toString(36)}${(Te++).toString(36)}`;while(m.some(e=>e.id===t));return t}function xe(m){let e=m.currentTarget?.clientWidth||1;return Math.min(.999,Math.max(0,m.offsetX/e))}var st=class extends ${static properties={heading:{},space:{attribute:!1},labels:{attribute:!1},slots:{attribute:!1},gear:{attribute:!1},loose:{attribute:!1},gearOf:{attribute:!1},looseOf:{attribute:!1},nameOf:{attribute:!1},editable:{type:Boolean},linker:{attribute:!1},t:{attribute:!1},selected:{state:!0},pick:{state:!0},ghost:{state:!0},refused:{state:!0},face:{state:!0}};constructor(){super(),this.heading="",this.labels=[],this.slots=[],this.gear=[],this.loose=[],this.gearOf=()=>null,this.looseOf=()=>null,this.nameOf=t=>t,this.editable=!1,this.linker=null,this.t=t=>t,this.selected=null,this.pick=null,this.ghost=null,this.refused=null,this.face="front"}get hasRear(){return this.space?.rear!==!1}get shownFace(){return this.hasRear?this.face:"front"}send(t){this.slots=t,this.dispatchEvent(new CustomEvent("rack-change",{detail:{slots:t},bubbles:!0,composed:!0}))}refuse(t){this.refused={units:t.units,clash:t.clash,why:t.why??"overlap"}}setFace(t){this.face=t,this.ghost=null,this.refused=null}pickGear(t){this.editable&&(this.refused=null,this.ghost=null,this.pick=this.pick&&"add"in this.pick&&this.pick.add===t?null:{add:t})}tapSlot(t){this.refused=null,this.ghost=null,this.pick=null,this.selected=this.selected===t?null:t}startMove(){let t=this.slots.find(e=>e.id===this.selected);!this.editable||!t||t.on||(this.refused=null,this.pick={move:t.id})}hoverUnit(t,e=0){if(t===null||!this.pick){this.ghost=null;return}let s=this.candidate(t,e,null);!s||this.isLane(s)||this.showGhost(s)}hoverLane(t,e){let s=this.pick?this.candidate(t,0,e):null;!s||!this.isLane(s)||this.showGhost(s)}showGhost(t){let e=Jt(this.space,this.slots,t,this.gearOf,this.looseOf);this.ghost={units:e.units,ok:e.ok,clash:e.clash,...t.col?{col:t.col}:{}}}tapUnit(t,e=0){let s=this.pick&&this.candidate(t,e,null);if(!s||this.isLane(s)){(!this.pick||!this.editable)&&(this.selected=null,this.refused=null);return}this.place(s)}tapLane(t,e){let s=this.pick&&this.candidate(t,0,e);s&&this.isLane(s)&&this.place(s)}place(t){if(!this.pick||!this.editable)return;let s=K(this.space,this.slots,t,this.gearOf,this.looseOf);if(!s.ok)return this.refuse(s);this.refused=null,this.ghost=null,this.pick=null,this.selected=t.id,this.send(s.slots)}nudge(t){let e=this.slots.find(i=>i.id===this.selected);if(!this.editable||!e||e.on)return;let s=Qt(this.space,this.slots,e.id,e.u+t,this.gearOf,this.looseOf);if(!s.ok)return this.refuse(s);this.refused=null,this.send(s.slots)}nudgeCol(t){let e=this.slots.find(s=>s.id===this.selected);!e||e.on||this.replace({...e,col:(e.col??0)+t})}flipFace(){let t=this.slots.find(i=>i.id===this.selected);if(!t||t.on)return;let{face:e,...s}=t;this.replace(t.face==="rear"?s:{...s,face:"rear"})}putOnShelf(t){let e=this.slots.find(r=>r.id===this.selected);if(!this.editable||!e||e.on||!this.gearOf(e.type)?.gear.shelf)return;let s={id:ve(this.slots),type:t,u:e.u,on:e.id},i=K(this.space,this.slots,s,this.gearOf,this.looseOf);if(!i.ok)return this.refuse(i);this.refused=null,this.send(i.slots)}replace(t){if(!this.editable)return;let e=K(this.space,this.slots,t,this.gearOf,this.looseOf);if(!e.ok)return this.refuse(e);this.refused=null,this.send(e.slots)}rename(t){if(!this.editable||!this.selected)return;let e=t.trim().slice(0,60);this.send(this.slots.map(s=>s.id===this.selected?{...s,name:e||null}:s))}relink(t){!this.editable||!this.selected||this.send(this.slots.map(e=>e.id===this.selected?{...e,...t(e)}:e))}linkDevice(t){if(!this.editable||!this.linker||!t)return;let e=this.linker.fromDevice(t);this.relink(s=>({entity:e.entity,links:e.links.slice(0,16),...!s.name&&e.name?{name:e.name.slice(0,60)}:{}}))}setStatusEntity(t){this.relink(e=>({entity:t||null,links:(e.links??[]).filter(s=>s!==t)}))}addLink(t){let e=this.slots.find(i=>i.id===this.selected),s=e?.links??[];!e||!t||t===e.entity||s.includes(t)||s.length>=16||this.relink(()=>({links:[...s,t]}))}removeLink(t){this.relink(e=>({links:(e.links??[]).filter(s=>s!==t)}))}deleteSelected(){if(!this.editable||!this.selected)return;let t=this.selected;this.selected=null,this.pick=null,this.refused=null,this.send(Yt(this.slots,t))}close(){this.dispatchEvent(new CustomEvent("rack-close",{bubbles:!0,composed:!0}))}isLane(t){let e=this.gearOf(t.type);return!!e&&e.gear.u<1}candidate(t,e,s){let i=this.pick;if(!i)return null;let r="add"in i?{id:ve(this.slots),type:i.add,u:t}:this.slots.find(f=>f.id===i.move);if(!r)return null;let p=this.gearOf(r.type),{col:h,face:o,...d}={...r,u:t},l=d,n=s??(p&&p.gear.u>=1?Math.floor(e*D[p.gear.width]):0);return n&&(l.col=n),("add"in i?this.shownFace:r.face??"front")==="rear"&&p?.gear.depth!=="full"&&(l.face="rear"),l}onKey=t=>{t.target?.tagName!=="INPUT"&&(t.key==="Escape"?(t.stopPropagation(),this.pick||this.refused?(this.pick=null,this.ghost=null,this.refused=null):this.close()):t.key==="ArrowUp"||t.key==="ArrowDown"?(t.preventDefault(),t.stopPropagation(),this.nudge(t.key==="ArrowUp"?1:-1)):t.key==="ArrowLeft"||t.key==="ArrowRight"?(t.preventDefault(),t.stopPropagation(),this.nudgeCol(t.key==="ArrowRight"?1:-1)):t.key==="Delete"&&(t.stopPropagation(),this.deleteSelected()))};row(t,e){return`${this.space.u-(t+e-1)+1} / span ${e}`}column(t,e){let s=this.gearOf(t);if(s&&s.gear.u<1)return`${et[e]??et[0]} / span 1`;let i=s?D[s.gear.width]:1,r=$e/i;return`${_e+Math.min(e,i-1)*r} / span ${r}`}onFace(t){let e=this.gearOf(t.type);return e?Xt(t,e.gear).includes(this.shownFace):this.shownFace==="front"}render(){let t=this.t,e=this.space?.u??0,s=Array.from({length:e},(n,g)=>e-g),i=this.space?te(this.space,this.slots,this.gearOf,this.looseOf):[],r=new Set(this.refused?.units??[]),p=new Set([...this.refused?.clash??[],...this.ghost&&!this.ghost.ok?this.ghost.clash:[],...i.map(n=>n.id)]),h=this.slots.find(n=>n.id===this.selected)??null,o=n=>this.labels[n-1]??n,d=this.slots.filter(n=>!n.on&&this.onFace(n)),l=this.pick?"add"in this.pick?this.pick.add:this.slots.find(n=>this.pick&&"move"in this.pick&&n.id===this.pick.move)?.type:void 0;return a`<div class="fp3d-rack-veil" @click=${n=>n.target===n.currentTarget&&this.close()} @keydown=${this.onKey}>
      <div class="fp3d-rack-sheet" role="dialog" aria-modal="true" aria-label=${t("rack_edit")} tabindex="-1" ${At()}>
        <div class="fp3d-rack-head">
          <h3>${this.heading||t("rack_edit")}</h3>
          ${this.renderTotals()}
          ${this.hasRear?a`<div class="fp3d-rack-faces" role="group">
                ${["front","rear"].map(n=>a`<button class="fp3d-btn" aria-pressed=${this.shownFace===n} @click=${()=>this.setFace(n)}>${t(`rack_face_${n}`)}</button>`)}
              </div>`:c}
          <button class="fp3d-btn" aria-label=${t("close")} @click=${()=>this.close()}>✕</button>
        </div>
        <div class="fp3d-rack-body">
          <div class="fp3d-rack-elev" style="grid-template-rows: repeat(${e}, ${Le}px)" @pointerleave=${()=>this.hoverUnit(null)}>
            ${s.map(n=>a`<span class="fp3d-rack-num fp3d-rack-left" style="grid-row: ${this.row(n,1)}">${o(n)}</span>
                ${et.map((g,f)=>a`<button
                      class="fp3d-rack-lane"
                      style="grid-row: ${this.row(n,1)}; grid-column: ${g}"
                      aria-label=${`${f?"\u25B6":"\u25C0"} ${t("rack_unit",{n:o(n)})}`}
                      @pointerenter=${()=>this.hoverLane(n,f)}
                      @click=${()=>this.tapLane(n,f)}
                    ></button>`)}
                <button
                  class="fp3d-rack-cell ${r.has(n)?"fp3d-rack-bad":""}"
                  style="grid-row: ${this.row(n,1)}"
                  data-u=${n}
                  aria-label=${t("rack_unit",{n:o(n)})}
                  @pointermove=${g=>this.hoverUnit(n,xe(g))}
                  @click=${g=>this.tapUnit(n,xe(g))}
                ></button>
                <span class="fp3d-rack-num fp3d-rack-right" style="grid-row: ${this.row(n,1)}">${o(n)}</span>`)}
            ${d.map(n=>this.renderSlot(n,p))}
            ${this.ghost?.units.length&&l?a`<div
                  class="fp3d-rack-ghost ${this.ghost.ok?"fp3d-rack-ok":"fp3d-rack-bad"}"
                  style="grid-row: ${this.row(Math.max(1,this.ghost.units[0]),Math.min(this.ghost.units.length,e-Math.max(1,this.ghost.units[0])+1))}; grid-column: ${this.column(l,this.ghost.col??0)}"
                ></div>`:c}
          </div>
          <div class="fp3d-rack-side">
            ${this.refused?a`<p class="fp3d-rack-why" role="alert">${t(`rack_${this.refused.why}`)}</p>`:c}
            ${i.length?a`<section class="fp3d-rack-misfits">
                  <p class="fp3d-rack-why" role="alert">${t("rack_misfits",{n:i.length})}</p>
                  <ul>
                    ${i.map(n=>{let g=this.slots.find(f=>f.id===n.id);return a`<li><button class="fp3d-link" @click=${()=>this.tapSlot(g.id)}>${g.name||this.nameOf(g.type)}: ${t(`rack_${n.why}`)}</button></li>`})}
                  </ul>
                </section>`:c}
            ${h?this.renderChosen(h):c}
            ${this.editable?this.renderGear():a`<p class="fp3d-sub">${t("rack_read_only")}</p>`}
          </div>
        </div>
      </div>
    </div>`}renderTotals(){if(!this.space)return c;let t=this.t,e=Zt(this.space,this.slots,this.gearOf,this.looseOf);return a`<p class="fp3d-rack-totals">
      <span>${t("rack_totals",{used:e.used,free:e.free})}</span>
      <span>${e.unknown?t("rack_watts_about",{w:e.watts}):`${e.watts} W`}</span>
    </p>`}renderSlot(t,e){let s=this.space.u,i=Y(t,this.gearOf).length;if(t.u<1||t.u+i-1>s)return c;let r=this.gearOf(t.type),p=f=>["fp3d-rack-gear",f===this.selected?"fp3d-rack-chosen":"",e.has(f)?"fp3d-rack-bad":"",this.pick&&"move"in this.pick&&this.pick.move===f?"fp3d-rack-moving":""].join(" "),h=`grid-row: ${this.row(t.u,i)}; grid-column: ${this.column(t.type,t.col??0)}`,o=t.name||this.nameOf(t.type);if(r&&r.gear.u<1)return a`<button class="${p(t.id)} fp3d-rack-pdu" style=${h} data-slot=${t.id} title=${o} aria-label=${o} aria-pressed=${t.id===this.selected} @click=${()=>this.tapSlot(t.id)}></button>`;let d=this.linker?.status(t)??null,l=d?a`<i class="fp3d-rack-led fp3d-rack-led-${d}" style="background:${ee[d]}"></i>`:c,n=a`<span>${o}</span>${i>1?a`<small>${i}U</small>`:c}${l}`;if(!r?.gear.shelf)return a`<button class=${p(t.id)} style=${h} data-slot=${t.id} aria-pressed=${t.id===this.selected} @click=${()=>this.tapSlot(t.id)}>${n}</button>`;let g=this.slots.filter(f=>f.on===t.id);return a`<div class="fp3d-rack-shelf" style=${h}>
      <button class="${p(t.id)} fp3d-rack-shelf-tray" data-slot=${t.id} aria-pressed=${t.id===this.selected} @click=${()=>this.tapSlot(t.id)}>${n}</button>
      ${g.map(f=>a`<button class="${p(f.id)} fp3d-rack-loose" data-slot=${f.id} aria-pressed=${f.id===this.selected} @click=${()=>this.tapSlot(f.id)}>${f.name||this.nameOf(f.type)}</button>`)}
    </div>`}renderChosen(t){let e=this.t,s=Y(t,this.gearOf),i=d=>this.labels[d-1]??d,r=s.length>1?`${i(s[0])}-${i(s.at(-1))}`:`${i(s[0])}`,p=t.on?null:this.gearOf(t.type),h=p?p.gear.u<1?2:D[p.gear.width]:1,o=t.on?this.slots.find(d=>d.id===t.on):null;return a`<section class="fp3d-rack-chosen-box">
      <h4>${t.name||this.nameOf(t.type)}</h4>
      <p class="fp3d-sub">${o?`\u2912 ${o.name||this.nameOf(o.type)}`:e("rack_at",{u:r})}${p&&p.gear.depth==="full"?a` · ${e("rack_full_depth")}`:t.face==="rear"&&this.hasRear?a` · ${e("rack_face_rear")}`:c}</p>
      ${this.editable?a`<label class="fp3d-field"
              >${e("furn_name")}
              <input type="text" maxlength="60" .value=${t.name??""} placeholder=${this.nameOf(t.type)} @change=${d=>this.rename(d.target.value)}
            /></label>
            <div class="fp3d-rack-actions">
              ${t.on?c:a`<button class="fp3d-btn" title=${e("rack_up")} @click=${()=>this.nudge(1)}>▲</button>
                    <button class="fp3d-btn" title=${e("rack_down")} @click=${()=>this.nudge(-1)}>▼</button>
                    ${h>1?a`<button class="fp3d-btn" ?disabled=${(t.col??0)<=0} @click=${()=>this.nudgeCol(-1)}>◀</button>
                          <button class="fp3d-btn" ?disabled=${(t.col??0)>=h-1} @click=${()=>this.nudgeCol(1)}>▶</button>`:c}
                    ${this.hasRear&&p&&p.gear.depth!=="full"?a`<button class="fp3d-btn" @click=${()=>this.flipFace()}>⇄ ${e(t.face==="rear"?"rack_face_front":"rack_face_rear")}</button>`:c}
                    <button class="fp3d-btn" aria-pressed=${!!this.pick&&"move"in this.pick} @click=${()=>this.startMove()}>${e("rack_move")}</button>`}
              <button class="fp3d-btn fp3d-danger" @click=${()=>this.deleteSelected()}>${e("delete")}</button>
            </div>
            ${this.pick&&"move"in this.pick?a`<p class="fp3d-sub">${e("rack_move_hint")}</p>`:c}
            ${p?.gear.shelf?this.renderShelf():c}`:c}
      ${this.renderLinks(t)}
    </section>`}renderLinks(t){let e=this.linker;if(!e)return c;let s=this.t,i=t.links??[],r=(o,d,l,n)=>a`<fp3d-entity-picker
        .options=${o}
        .fixed=${l}
        .value=${d}
        .placeholder=${s("entity_search")}
        @change=${g=>{g.stopPropagation(),n(g.detail.value)}}
      ></fp3d-entity-picker>`,p={id:"none",label:s("entity_none")};if(!this.editable)return t.entity||i.length?a`<h4>${s("rack_links")}</h4>
            <ul class="fp3d-rack-links">
              ${[t.entity,...i].filter(o=>!!o).map(o=>a`<li>${e.label(o)}</li>`)}
            </ul>`:c;let h=e.suggest(t).filter(o=>o!==t.entity&&!i.includes(o));return a`<h4>${s("rack_links")}</h4>
      <label class="fp3d-field">${s("rack_ha_device")} ${r(e.devices,null,[],o=>this.linkDevice(o))}</label>
      <label class="fp3d-field">${s("rack_status_from")} ${r(e.entities,t.entity??"none",[p],o=>this.setStatusEntity(o==="none"?null:o))}</label>
      ${i.length?a`<ul class="fp3d-rack-links">
            ${i.map(o=>a`<li><span>${e.label(o)}</span><button class="fp3d-btn" aria-label=${s("delete")} @click=${()=>this.removeLink(o)}>✕</button></li>`)}
          </ul>`:c}
      ${i.length<16?a`<label class="fp3d-field">${s("rack_link_add")} ${r(e.entities,null,[],o=>this.addLink(o))}</label>`:c}
      ${h.length&&i.length<16?a`<p class="fp3d-sub">${s("rack_suggested")}</p>
            <div class="fp3d-rack-list">${h.map(o=>a`<button class="fp3d-btn fp3d-rack-choice" @click=${()=>this.addLink(o)}>+ ${e.label(o)}</button>`)}</div>`:c}`}renderShelf(){let t=this.t;return a`<h4>${t("rack_on_shelf")}</h4>
      ${this.loose.length?a`<div class="fp3d-rack-list">${this.loose.map(e=>a`<button class="fp3d-btn fp3d-rack-choice" @click=${()=>this.putOnShelf(e.type)}>${e.name}</button>`)}</div>`:a`<p class="fp3d-sub">${t("rack_no_loose")}</p>`}`}renderGear(){let t=this.t,e=this.pick&&"add"in this.pick?this.pick.add:null,s=e?(this.gearOf(e)?.gear.u??1)<1:!1;return a`<section>
      <h4>${t("rack_add")}</h4>
      ${this.gear.length?a`<div class="fp3d-rack-list">
            ${this.gear.map(i=>{let r=this.gearOf(i.type)?.gear,h=`${r?.u??1}U${r&&r.width!=="full"?` ${t(`rack_width_${r.width}`)}`:""}`;return a`<button class="fp3d-btn fp3d-rack-choice" aria-pressed=${e===i.type} @click=${()=>this.pickGear(i.type)}>${i.name}<small>${h}</small></button>`})}
          </div>`:a`<p class="fp3d-sub">${t("rack_no_gear")}</p>`}
      ${e?a`<p class="fp3d-sub">${t(s?"rack_lane_hint":"rack_add_hint")}</p>`:c}
    </section>`}static styles=[_,I,x`
      .fp3d-rack-veil {
        position: fixed;
        inset: 0;
        z-index: 30;
        display: flex;
        align-items: center;
        /* at the left, so the editor's 3D pane on the right shows the rack as it changes */
        justify-content: flex-start;
        background: rgba(0, 0, 0, 0.25);
        padding: 16px;
      }
      .fp3d-rack-sheet {
        background: var(--fp3d-chrome-solid);
        color: var(--fp3d-text);
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
        box-shadow: var(--fp3d-shadow);
        width: min(720px, 100%);
        max-height: calc(100% - 16px);
        display: flex;
        flex-direction: column;
        outline: none;
      }
      .fp3d-rack-head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 14px;
        border-bottom: 1px solid var(--fp3d-line);
      }
      .fp3d-rack-head h3 {
        margin: 0;
        font-size: 16px;
      }
      .fp3d-rack-body {
        display: flex;
        gap: 16px;
        padding: 14px;
        overflow: auto;
      }
      .fp3d-rack-elev {
        display: grid;
        /* U numbers, the left 0U lane, the U space in 6 (halves take 3, thirds 2), the right lane, U numbers */
        grid-template-columns: 28px 14px repeat(6, minmax(30px, 47px)) 14px 28px;
        flex: none;
        align-self: flex-start;
        border-radius: 6px;
        background: var(--fp3d-bg);
        padding: 6px 0;
      }
      .fp3d-rack-num {
        font-size: 11px;
        color: var(--fp3d-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        font-variant-numeric: tabular-nums;
        border-bottom: 1px dotted var(--fp3d-line);
      }
      .fp3d-rack-left {
        grid-column: 1;
      }
      .fp3d-rack-right {
        grid-column: 10;
      }
      .fp3d-rack-cell,
      .fp3d-rack-gear,
      .fp3d-rack-ghost {
        grid-column: 3 / span 6;
      }
      .fp3d-rack-lane {
        border: 0;
        border-bottom: 1px dotted var(--fp3d-line);
        background: rgba(120, 170, 255, 0.04);
        padding: 0;
        cursor: pointer;
      }
      .fp3d-rack-lane:hover {
        background: rgba(120, 170, 255, 0.14);
      }
      .fp3d-rack-gear.fp3d-rack-pdu {
        margin: 1px 1px;
        padding: 0;
        background: repeating-linear-gradient(180deg, var(--fp3d-bg2) 0 6px, var(--fp3d-line) 6px 8px);
      }
      .fp3d-rack-shelf {
        z-index: 1;
        display: flex;
        align-items: stretch;
        gap: 2px;
        margin: 1px 2px;
        border-bottom: 3px solid var(--fp3d-muted);
        min-width: 0;
      }
      .fp3d-rack-shelf .fp3d-rack-gear {
        margin: 0;
      }
      .fp3d-rack-shelf-tray {
        flex: 0 0 auto;
        max-width: 45%;
        background: transparent;
        border-style: dashed;
      }
      .fp3d-rack-loose {
        flex: 1 1 0;
        min-width: 0;
        align-self: flex-end;
        height: 75%;
      }
      .fp3d-rack-totals {
        margin: 0 0 0 auto;
        display: flex;
        flex-wrap: wrap;
        gap: 4px 12px;
        font-size: 12px;
        color: var(--fp3d-muted);
        font-variant-numeric: tabular-nums;
      }
      .fp3d-rack-faces {
        display: flex;
        gap: 4px;
      }
      .fp3d-rack-faces [aria-pressed="true"] {
        border-color: var(--fp3d-accent);
        color: var(--fp3d-accent);
      }
      .fp3d-rack-misfits ul {
        margin: 6px 0 0;
        padding-left: 18px;
        font-size: 12px;
      }
      .fp3d-link {
        background: none;
        border: 0;
        padding: 0;
        color: inherit;
        font: inherit;
        text-decoration: underline;
        cursor: pointer;
        text-align: left;
      }
      .fp3d-rack-cell {
        border: 0;
        border-bottom: 1px dotted var(--fp3d-line);
        background: transparent;
        padding: 0;
        cursor: pointer;
        font: inherit;
      }
      .fp3d-rack-cell:hover {
        background: rgba(120, 170, 255, 0.08);
      }
      .fp3d-rack-gear {
        z-index: 1;
        margin: 1px 2px;
        border: 1px solid var(--fp3d-line);
        border-radius: 3px;
        background: var(--fp3d-bg2);
        color: var(--fp3d-text);
        font: inherit;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 0 8px;
        cursor: pointer;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .fp3d-rack-gear small {
        color: var(--fp3d-muted);
      }
      .fp3d-rack-led {
        display: inline-block;
        flex: none;
        width: 8px;
        height: 8px;
        margin-left: auto;
        border-radius: 2px;
      }
      .fp3d-rack-links {
        list-style: none;
        margin: 0 0 6px;
        padding: 0;
        display: grid;
        gap: 4px;
      }
      .fp3d-rack-links li {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      .fp3d-rack-gear.fp3d-rack-chosen {
        border-color: var(--fp3d-accent);
        box-shadow: inset 0 0 0 1px var(--fp3d-accent);
      }
      .fp3d-rack-gear.fp3d-rack-moving {
        opacity: 0.55;
      }
      .fp3d-rack-ghost {
        z-index: 2;
        pointer-events: none;
        margin: 1px 2px;
        border-radius: 3px;
        border: 2px dashed var(--fp3d-accent);
        background: rgba(55, 224, 255, 0.16);
      }
      .fp3d-rack-ghost.fp3d-rack-bad,
      .fp3d-rack-cell.fp3d-rack-bad,
      .fp3d-rack-gear.fp3d-rack-bad {
        border: 2px solid var(--fp3d-danger);
        background: rgba(255, 107, 139, 0.22);
      }
      .fp3d-rack-side {
        position: sticky;
        top: 0;
        align-self: flex-start;
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .fp3d-rack-side h4 {
        margin: 0 0 6px;
        font-size: 13px;
      }
      .fp3d-rack-why {
        margin: 0;
        padding: 8px 10px;
        border-radius: 6px;
        color: var(--fp3d-danger);
        border: 1px solid var(--fp3d-danger);
      }
      .fp3d-rack-list,
      .fp3d-rack-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .fp3d-rack-choice {
        display: flex;
        gap: 6px;
        align-items: baseline;
      }
      .fp3d-rack-choice small {
        color: var(--fp3d-muted);
      }
      .fp3d-rack-choice[aria-pressed="true"],
      .fp3d-rack-actions [aria-pressed="true"] {
        border-color: var(--fp3d-accent);
        color: var(--fp3d-accent);
      }
      .fp3d-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        color: var(--fp3d-muted);
        margin-bottom: 8px;
      }
      @media (max-width: 600px) {
        .fp3d-rack-veil {
          padding: 0;
          align-items: stretch;
        }
        .fp3d-rack-sheet {
          border-radius: 0;
          max-height: none;
        }
        .fp3d-rack-body {
          flex-direction: column;
        }
        .fp3d-rack-side {
          position: static;
          align-self: stretch;
        }
        .fp3d-rack-elev {
          align-self: stretch;
          grid-template-columns: 28px 14px repeat(6, 1fr) 14px 28px;
        }
      }
    `]};v("fp3d-rack-sheet",st);var it=class extends ${static properties={options:{attribute:!1},value:{attribute:!1},locked:{attribute:!1},disabled:{type:Boolean},label:{attribute:!1},placeholder:{attribute:!1},searchLabel:{attribute:!1},emptyText:{attribute:!1},secondaryLabel:{attribute:!1},removeLabel:{attribute:!1},summary:{attribute:!1},noSearch:{type:Boolean},_query:{state:!0},_open:{state:!0},_cursor:{state:!0},_more:{state:!0}};constructor(){super(),this.options=[],this.value=[],this.locked=[],this.disabled=!1,this.label="",this.placeholder="",this.searchLabel="",this.emptyText="\u2013",this.secondaryLabel="",this.removeLabel="Remove {name}",this.summary="",this.noSearch=!1,this._query="",this._open=!1,this._cursor=0,this._more=!1}get open(){return this._open}nameOf(t){return this.options.find(e=>e.id===t)?.label??t}get rows(){let t=this._query.trim().toLowerCase().split(/\s+/).filter(Boolean),e=this._more||!this.secondaryLabel;return this.options.filter(s=>(e||!s.secondary||this.value.includes(s.id))&&t.every(i=>`${s.label} ${s.note??""}`.toLowerCase().includes(i)))}get hiddenCount(){return this.secondaryLabel&&!this._more?this.options.filter(t=>t.secondary&&!this.value.includes(t.id)).length:0}emit(t){this.value=t,this.dispatchEvent(new CustomEvent("change",{detail:{value:t},bubbles:!0,composed:!0}))}toggle(t){this.disabled||(this.value.includes(t)?this.locked.includes(t)||this.emit(this.value.filter(e=>e!==t)):this.emit([...this.value,t]))}dropPick(t){!this.disabled&&!this.locked.includes(t)&&this.emit(this.value.filter(e=>e!==t))}openList(){this._open=!0}closeList(){this._open=!1,this._query=""}updated(t){this._open&&t.has("_cursor")&&this.renderRoot?.querySelector?.("li.cursor")?.scrollIntoView?.({block:"nearest"})}onKey(t){let e=this.rows;if(t.key==="ArrowDown"||t.key==="ArrowUp")this.openList(),this._cursor=Math.max(0,Math.min(e.length-1,this._cursor+(t.key==="ArrowDown"?1:-1))),t.preventDefault();else if(t.key==="Enter"||t.key===" "&&!this._query)this._open&&e[this._cursor]?this.toggle(e[this._cursor].id):this.openList(),t.preventDefault();else if(t.key==="Escape")this._open&&t.stopPropagation(),this.closeList();else if(t.key==="Backspace"&&!this._query){let s=[...this.value].reverse().find(i=>!this.locked.includes(i));s&&this.dropPick(s)}}onFocusOut(t){let e=t.relatedTarget;(!e||!this.renderRoot.contains(e))&&this.closeList()}render(){let t=this._open?this.rows:[],e=this.hiddenCount;return a`<div class="wrap" @focusout=${this.onFocusOut}>
      <div class="box" @click=${()=>this.renderRoot.querySelector("input, .pick")?.focus()}>
        ${this.summary?a`<span class="sum">${this.summary}</span>`:c}
        ${(this.summary?[]:this.value).map(s=>{let i=this.nameOf(s),r=this.locked.includes(s);return a`<span class="chip">${i}${r||this.disabled?c:a`<button type="button" aria-label=${this.removeLabel.replace("{name}",i)} @click=${p=>(p.stopPropagation(),this.dropPick(s))}>×</button>`}</span>`})}
        ${this.noSearch?a`<span class="pick" tabindex="0" role="combobox" aria-label=${this.label} aria-expanded=${this._open} aria-haspopup="listbox" aria-controls="list" @focus=${()=>this.openList()} @click=${()=>this.openList()} @keydown=${this.onKey}></span>`:a`<input
              type="text"
              role="combobox"
              autocomplete="off"
              aria-label=${this.label}
              aria-expanded=${this._open}
              aria-haspopup="listbox"
              aria-controls="list"
              placeholder=${this.value.length?this.searchLabel:this.placeholder||this.searchLabel}
              .value=${this._query}
              ?disabled=${this.disabled}
              @focus=${()=>this.openList()}
              @click=${()=>this.openList()}
              @input=${s=>{this._query=s.target.value,this._cursor=0,this.openList()}}
              @keydown=${this.onKey}
            />`}
      </div>
      ${this._open?a`<div class="pop">
            <ul id="list" class="list" role="listbox" aria-multiselectable="true" aria-label=${this.label}>
              ${t.length?c:a`<li class="empty" role="presentation">${this.emptyText}</li>`}
              ${t.map((s,i)=>{let r=this.value.includes(s.id);return a`<li
                  role="option"
                  aria-selected=${r}
                  class="${i===this._cursor?"cursor":""} ${r?"on":""}"
                  @mousedown=${p=>p.preventDefault()}
                  @click=${()=>this.toggle(s.id)}
                >
                  <span class="tick" aria-hidden="true">${r?"\u2713":""}</span><span>${s.label}</span>${s.note?a`<small>${s.note}</small>`:c}
                </li>`})}
            </ul>
            ${this.secondaryLabel?a`<label class="more"><input type="checkbox" .checked=${this._more} @change=${s=>this._more=s.target.checked} />${this.secondaryLabel}${e?a` <small>(${e})</small>`:c}</label>`:c}
          </div>`:c}
    </div>`}static styles=[_,x`
      :host {
        display: block;
        position: relative;
      }
      .box {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        box-sizing: border-box;
        min-height: 44px;
        padding: 4px 8px;
        color: var(--fp3d-text);
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        cursor: text;
      }
      .box:focus-within {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: -1px;
      }
      .sum {
        font-size: 13px;
      }
      .pick {
        flex: 1 1 4em;
        min-height: 32px;
        outline: none;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        box-sizing: border-box;
        min-height: 32px;
        padding: 0 2px 0 10px;
        font-size: 13px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--fp3d-accent) 20%, transparent);
      }
      .chip button {
        position: relative;
        width: 28px;
        height: 28px;
        padding: 0;
        font: inherit;
        line-height: 1;
        color: inherit;
        background: none;
        border: 0;
        border-radius: 50%;
        cursor: pointer;
      }
      .chip button::after {
        content: "";
        position: absolute;
        inset: -8px -4px;
      }
      .chip button:hover,
      .chip button:focus-visible {
        background: color-mix(in srgb, var(--fp3d-text) 20%, transparent);
        outline: none;
      }
      input[type="text"] {
        flex: 1 1 8em;
        min-width: 6em;
        box-sizing: border-box;
        padding: 8px 2px;
        font: inherit;
        color: var(--fp3d-text);
        background: none;
        border: 0;
        outline: none;
      }
      input::placeholder {
        color: var(--fp3d-muted);
      }
      .pop {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 4px);
        z-index: 20;
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        box-shadow: var(--fp3d-shadow);
      }
      .list {
        margin: 0;
        padding: 4px;
        list-style: none;
        max-height: 260px;
        overflow-y: auto;
      }
      li {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        padding: 4px 8px;
        box-sizing: border-box;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13.5px;
      }
      li small,
      .more small {
        color: var(--fp3d-muted);
        font-size: 11px;
      }
      li.cursor,
      li:hover {
        background: color-mix(in srgb, var(--fp3d-accent) 18%, transparent);
      }
      li.on {
        color: var(--fp3d-accent);
      }
      .tick {
        width: 1.2em;
        text-align: center;
      }
      li.empty {
        color: var(--fp3d-muted);
        cursor: default;
      }
      .more {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        padding: 4px 12px;
        font-size: 13px;
        border-top: 1px solid var(--fp3d-line);
        cursor: pointer;
      }
    `]};v("fp3d-multi-select",it);var at=class extends ${static properties={value:{attribute:!1},hour12:{type:Boolean},disabled:{type:Boolean},clearable:{type:Boolean},step:{type:Number},label:{attribute:!1},hourLabel:{attribute:!1},minuteLabel:{attribute:!1},periodLabel:{attribute:!1}};constructor(){super(),this.value="",this.hour12=!1,this.disabled=!1,this.clearable=!1,this.step=5,this.label="",this.hourLabel="Hour",this.minuteLabel="Minute",this.periodLabel="AM/PM"}set(t,e){let s=Z(this.value);if(t==="h"&&e==="")return this.send("");let i=s===null?0:Math.floor(s/60),r=s===null?0:s%60,p=i,h=r;t==="m"?h=Number(e):t==="h"?p=this.hour12?Number(e)%12+(i>=12?12:0):Number(e):p=i%12+(e==="pm"?12:0),this.send(ie(p*60+h))}send(t){this.value=t,this.dispatchEvent(new CustomEvent("change",{detail:{value:t},bubbles:!0,composed:!0}))}render(){let t=Z(this.value),e=t===null?null:Math.floor(t/60),s=t===null?null:t%60,i=Math.max(1,Math.round(this.step)||5),r=[...new Set([...Array.from({length:Math.ceil(60/i)},(l,n)=>n*i),...s===null?[]:[s]])].sort((l,n)=>l-n),p=this.hour12?[12,...Array.from({length:11},(l,n)=>n+1)]:Array.from({length:24},(l,n)=>n),h=e===null?"":String(this.hour12?e%12||12:e),o=l=>String(l).padStart(2,"0"),d=e===null;return a`<span class="t" role="group" aria-label=${this.label}>
      <select aria-label=${this.hourLabel} ?disabled=${this.disabled} @change=${l=>this.set("h",l.target.value)}>
        ${d?a`<option value="" selected>${this.clearable?"\u2013":o(0)}</option>`:c}
        ${this.clearable&&!d?a`<option value="">–</option>`:c}
        ${p.map(l=>a`<option value=${l} ?selected=${String(l)===h}>${this.hour12?l:o(l)}</option>`)}
      </select>
      <span aria-hidden="true">:</span>
      <select aria-label=${this.minuteLabel} ?disabled=${this.disabled||d&&this.clearable} @change=${l=>this.set("m",l.target.value)}>
        ${r.map(l=>a`<option value=${l} ?selected=${l===s||d&&l===0}>${o(l)}</option>`)}
      </select>
      ${this.hour12?a`<select aria-label=${this.periodLabel} ?disabled=${this.disabled||d&&this.clearable} @change=${l=>this.set("p",l.target.value)}>
            <option value="am" ?selected=${e===null||e<12}>AM</option>
            <option value="pm" ?selected=${e!==null&&e>=12}>PM</option>
          </select>`:c}
    </span>`}static styles=[_,x`
      :host {
        display: inline-block;
      }
      .t {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: var(--fp3d-text);
      }
      select {
        min-height: 36px;
        padding: 4px 6px;
        font: inherit;
        color: var(--fp3d-text);
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
      }
      select:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: -1px;
      }
    `]};v("fp3d-time-field",at);var Me="household.custom";function rt(m){return(m?.find(t=>t.id===Me)?.items??[]).filter(ht)}var ye=le("home-3d-items",()=>"970ce34f06d2");var nt="pack.json",Oe=/^(?:README|LICEN[CS]E|COPYING|CHANGELOG)(?:\.(?:md|txt))?$/i;function we(m){let t=m.filter(i=>!i.split("/").some(r=>r.startsWith("."))),e=t.filter(i=>i===nt||i.endsWith(`/${nt}`)).map(i=>i.slice(0,-nt.length).replace(/\/$/,"")),s=new Map(e.sort().map(i=>[i,{root:i,files:new Map,refused:[]}]));for(let i of t){let r=e.filter(o=>o===""||i.startsWith(`${o}/`)).sort((o,d)=>d.length-o.length)[0];if(r===void 0)continue;let p=r?i.slice(r.length+1):i,h=s.get(r);Oe.test(p)||(p.toLowerCase().endsWith(".json")?h.files.set(p,i):h.refused.push(p))}return[...s.values()]}var lt=class extends ${static properties={hass:{attribute:!1},canEdit:{attribute:!1},card:{attribute:!1},packs:{attribute:!1},building:{attribute:!1},_packMsg:{state:!0},_itemsError:{state:!0},_open:{state:!0},_undo:{state:!0},_packUrl:{state:!0},_installing:{state:!0},_preview:{state:!0},_updates:{state:!0},_checking:{state:!0},_updatesMsg:{state:!0}};undoTimer;seasonDatesPart;constructor(){super(),this._packMsg=null,this._itemsError=null,this._packUrl="",this._installing=!1,this._preview=null,this._updates=null,this._checking=!1,this._updatesMsg=null;let t=[];try{t=JSON.parse(localStorage.getItem("home3d.ext.open")??"[]")}catch{}this._open=new Set(t),this._undo=null}toggleOpen(t){let e=new Set(this._open);e.has(t)?e.delete(t):e.add(t),this._open=e;try{localStorage.setItem("home3d.ext.open",JSON.stringify([...e]))}catch{}}summaryBar(t,e){let s=e.reduce((r,p)=>r+p.n,0),i=this._open.has(t);return a`<button class="fp3d-sum" aria-expanded=${i} @click=${()=>this.toggleOpen(t)}>
      <span class="fp3d-sum-bar">
        ${e.filter(r=>r.n>0).map(r=>a`<i class="fp3d-sum-${r.tone}" style="flex:${r.n}"></i>`)}
      </span>
      <span class="fp3d-sum-text">
        ${e.filter(r=>r.n>0||r.tone==="ok").map(r=>a`<b class="fp3d-sum-${r.tone}-text">${r.n}</b> ${r.label}`)}
        ${s?c:a`<span class="fp3d-sub">–</span>`}
      </span>
      <span class="fp3d-sum-caret">${i?"\u25BE":"\u25B8"} ${this.t(i?"ext_hide_list":"ext_show_list")}</span>
    </button>`}updated(t){let e=t.has("hass")&&!this._updates&&!this.updatesLoading&&!this.updatesTried;this.hass&&(e||t.has("packs")||t.has("building"))&&this.loadUpdates();let s=this.card&&this.card!==this.shownCard?this.renderRoot.querySelector(`[data-ext="${CSS.escape(this.card)}"]`):null;s&&(this.shownCard=this.card,s.scrollIntoView?.({block:"center"}),s.classList.add("fp3d-ext-flash"),setTimeout(()=>s.classList.remove("fp3d-ext-flash"),2500))}shownCard=null;updatesLoading=!1;updatesTried=!1;updatesSeq=0;async loadUpdates(){if(!this.hass)return;this.updatesLoading=!0,this.updatesTried=!0;let t=++this.updatesSeq;try{let e=await V(this.hass);t===this.updatesSeq&&(this._updates=e)}catch{t===this.updatesSeq&&(this._updates=null)}finally{t===this.updatesSeq&&(this.updatesLoading=!1)}}async updatesCall(t,e=!1){if(this.hass)try{let s=await t(this.hass);s&&(this._updates=s),e&&this.dispatchEvent(new CustomEvent("packs-changed",{bubbles:!0,composed:!0}))}catch(s){this._updatesMsg={ok:!1,text:this.packError(s)}}}async checkNow(){if(!(!this.hass||this._checking)){this._checking=!0,this._updatesMsg=null;try{let t=await Pt(this.hass);this._updates=t;let e=t.packs.filter(s=>s.available).length;this._updatesMsg={ok:!0,text:this.t("upd_checked",{n:t.installed.length+e})},t.installed.length&&this.dispatchEvent(new CustomEvent("packs-changed",{bubbles:!0,composed:!0}))}catch(t){this._updatesMsg={ok:!1,text:this.packError(t)}}finally{this._checking=!1}}}updateItems(t){this.updatesCall(async e=>(await St(e,t),V(e)))}time(t){if(t==null)return"\u2013";let e=t instanceof Date?t:new Date(t*1e3);return re(e,ae(this.hass),"medium")}renderUpdates(){let t=this._updates;if(!t)return c;let e=this.isEditor,s=t.settings,i=jt(t),r=this.hass?.language??"en",p=t.items.filter(o=>!o.pinned),h=Bt(s);return a`<section class="fp3d-ext-card fp3d-updates" data-ext="updates">
      <h3>${this.t("upd_title")}</h3>
      <p class="fp3d-sub">${this.t("upd_intro")}</p>
      ${this.summaryBar("updates",[{n:i.updates,label:this.t("upd_sum_updates"),tone:"update"},{n:i.pinned,label:this.t("upd_sum_pinned"),tone:"missing"}])}
      ${this._open.has("updates")?a`${t.items.length?t.items.map(o=>a`<div class="fp3d-pack">
                  <div>
                    <b>${o.name[r.split("-")[0]]??o.name.en??Object.values(o.name)[0]??o.item}</b>
                    <span class="fp3d-sub">${o.release===o.new_release?this.t("upd_item_same",{to:o.new_release,n:o.placed}):this.t("upd_item",{from:o.release,to:o.new_release,n:o.placed})}${o.pinned?` \xB7 ${this.t("upd_pinned")}`:""}</span>
                    ${o.note?a`<span class="fp3d-sub fp3d-upd-note">${o.note}</span>`:c}
                  </div>
                  ${e?a`<button class="fp3d-btn" @click=${()=>this.updateItems([o.type])}>${this.t("upd_update")}</button>`:c}
                </div>`):a`<p class="fp3d-sub">${this.t("upd_none")}</p>`}
          ${e&&p.length>1?a`<button class="fp3d-btn fp3d-primary fp3d-pack-import" @click=${()=>this.updateItems(p.map(o=>o.type))}>${this.t("upd_update_all",{n:p.length})}</button>`:c}`:c}
      <div class="fp3d-upd-when">
        <button
          class="fp3d-link fp3d-ext-setting"
          @click=${()=>this.dispatchEvent(new CustomEvent("open-settings",{detail:{section:"packs",id:"pack_updates.frequency"},bubbles:!0,composed:!0}))}
        >
          ${this.t("upd_frequency")}: ${this.t(`upd_freq_${s.frequency}`)}${s.auto_update?` \xB7 ${this.t("upd_auto")}`:""} · ${this.t("settings")} ›
        </button>
        ${e?a`<button class="fp3d-btn" ?disabled=${this._checking} @click=${()=>this.checkNow()}>${this._checking?this.t("upd_checking"):this.t("upd_check_now")}</button>`:c}
      </div>
      <p class="fp3d-sub">
        ${this.t("upd_last_check",{time:this.time(t.last_check)})}${h?a` · ${this.t("upd_next_check",{time:this.time(h)})}`:c}
        ${t.backoff_until?a` · ${this.t("upd_backoff",{time:this.time(t.backoff_until)})}`:c}
      </p>
      ${this._updatesMsg?a`<p class="fp3d-sub ${this._updatesMsg.ok?"fp3d-notice":"fp3d-pack-error"}">${this._updatesMsg.text}</p>`:c}
    </section>`}renderPackUpdate(t){let e=this._updates?.packs.find(i=>i.id===t.id);if(!e||t.custom)return c;let s=T(t,this.hass?.language??"de");return a`${e.error?a`<span class="fp3d-sub fp3d-pack-error">${this.t("pack_check_error",{detail:e.error})}</span>`:e.available?a`<span class="fp3d-sub fp3d-pack-available">${this.t("pack_available",{release:e.available.release,commit:N(e.available.commit)})}</span>
              ${e.available.note?a`<span class="fp3d-sub fp3d-upd-note">${e.available.note}</span>`:c}
              ${e.held?a`<span class="fp3d-sub fp3d-pack-error">${this.t(`upd_held_${e.held.reason}`,{to:e.held.to??"",items:(e.held.items??[]).join(", ")})}</span>`:c}
              ${this.isEditor&&t.source?.origin?a`<button class="fp3d-btn" ?disabled=${this._installing} @click=${()=>{this.review(t.source.origin.url)}}>${this.t("pack_review_update")}</button>`:c}`:e.latest_release!=null?a`<span class="fp3d-sub">${this.t("pack_latest",{release:e.latest_release})}</span>`:c}
      ${this.isEditor?a`<span class="fp3d-pack-tools">
            <label class="fp3d-check">
              <input type="checkbox" .checked=${e.pinned} @change=${i=>{let r=i.target.checked;this.updatesCall(p=>Lt(p,t.id,r))}} />
              ${this.t("pack_pin")}
            </label>
            ${e.previous_release!=null?a`<button
                  class="fp3d-btn"
                  @click=${async()=>{await this.ask(this.t("pack_rollback_confirm",{name:s,release:e.previous_release}),this.t("ask_ok"))&&this.updatesCall(i=>Tt(i,t.id),!0)}}
                >
                  ${this.t("pack_rollback",{release:e.previous_release})}
                </button>`:c}
          </span>`:c}`}askConfirm=(t,e)=>this.ask(this.t(`pack_confirm_${t}`,{detail:e}),this.t("ask_ok"));ask(t,e,s=!1){return zt(t,{ok:e,cancel:this.t("cancel"),danger:s})}get isEditor(){return this.canEdit??this.hass?.user?.is_admin??!1}t(t,e){return G(this.hass,t,e)}render(){return a`<div class="fp3d-ext">
      <header class="fp3d-ext-head">
        <h2>${this.t("ext_title")}</h2>
        <p class="fp3d-sub">${this.t("ext_intro")}</p>
        <div class="fp3d-ext-actions">
          <a class="fp3d-btn" href=${Ut} target="_blank" rel="noopener">🐞 ${this.t("help_issue")}</a>
        </div>
      </header>
      ${this.renderFun()} ${this.renderModules()} ${this.renderItems()} ${this.renderUpdates()} ${this.renderPacks()} ${this.renderLanguages()}
    </div>`}editBuilding(t){if(!this.building)return;let e=structuredClone(this.building);t(e),this.dispatchEvent(new CustomEvent("building-edit",{detail:e,bubbles:!0,composed:!0}))}renderFun(){let t=bt.filter(o=>kt(o));if(!t.length)return c;let e=this.building?.settings.pets??null,s=e?.list??[],i=e?.on!==!1,r=(this.building?.floors??[]).filter(o=>o.rooms.length).sort((o,d)=>o.elevation-d.elevation),p=o=>this.editBuilding(d=>{let l={...d.settings.pets,on:d.settings.pets?.on!==!1,list:[...d.settings.pets?.list??[]]};o(l),d.settings.pets=l}),h=(o,d)=>p(l=>l.list=l.list.map(n=>n.id===o?{...n,...d}:n));return a`<section class="fp3d-ext-card" data-ext="fun">
      <h3>🎈 ${this.t("fun_title")}</h3>
      <p class="fp3d-sub">${this.t("fun_intro")}</p>
      ${this.isEditor&&this.building?this.funSwitch(this.building.settings.easter_eggs!==!1,this.t("st_easter_eggs"),o=>this.editBuilding(d=>d.settings.easter_eggs=o)):c}
      ${t.map(o=>o==="fun_seasons"?this.renderSeasons():a`<div class="fp3d-ext-feature fp3d-ext-on" data-ext="pets">
              <b>${this.t("fun_name_pets")}</b>
              <span class="fp3d-sub">${this.t("fun_feature_pets")}</span>
              ${this.isEditor&&this.building?a`${this.funSwitch(i,this.t("pets_show"),d=>p(l=>l.on=d))}
                    ${this.funSwitch(e?.roam!==!1,this.t("pets_roam"),d=>p(l=>l.roam=d))}
                    <span class="fp3d-sub">${this.t("pets_roam_hint")}</span>
                    ${s.map(d=>a`<div class="fp3d-pet-row">
                        <select
                          aria-label=${this.t("pet_kind")}
                          @change=${l=>{let n=l.target.value,g=M[n];h(d.id,{kind:n,fur:g.includes(d.fur)?d.fur:g[0],breed:n==="dog"?d.breed??"labrador":null})}}
                        >
                          ${["cat","dog","rabbit"].map(l=>a`<option value=${l} ?selected=${d.kind===l}>${this.t(`pet_kind_${l}`)}</option>`)}
                        </select>
                        ${d.kind==="dog"?a`<select aria-label=${this.t("pet_breed")} @change=${l=>h(d.id,{breed:l.target.value})}>
                              ${mt.map(l=>a`<option value=${l} ?selected=${(d.breed??"labrador")===l}>${this.t(`pet_breed_${l}`)}</option>`)}
                            </select>`:c}
                        <input type="text" maxlength="30" .value=${d.name} placeholder=${this.t("pet_name")} aria-label=${this.t("pet_name")} @change=${l=>h(d.id,{name:l.target.value.trim()})} />
                        <select aria-label=${this.t("pet_fur")} @change=${l=>h(d.id,{fur:l.target.value})}>
                          ${M[d.kind].map(l=>a`<option value=${l} ?selected=${d.fur===l}>${this.t(`pet_fur_${l}`)}</option>`)}
                        </select>
                        <select title=${this.t("pet_eyes")} aria-label=${this.t("pet_eyes")} @change=${l=>h(d.id,{eyes:l.target.value})}>
                          ${gt.map(l=>a`<option value=${l} ?selected=${(d.eyes??"dark")===l}>${this.t(`pet_eyes_${l}`)}</option>`)}
                        </select>
                        ${r.length>1?a`<select title=${this.t("pet_floor")} aria-label=${this.t("pet_floor")} @change=${l=>h(d.id,{floor_id:l.target.value||null})}>
                              ${r.map((l,n)=>a`<option value=${n===0?"":l.id} ?selected=${(d.floor_id??r[0].id)===l.id}>🏠 ${l.name}</option>`)}
                            </select>`:c}
                        <select
                          title=${this.t("pet_mode")}
                          aria-label=${this.t("pet_mode")}
                          @change=${l=>{let n=l.target.value==="static",g=this.building;p(f=>f.list=f.list.map(b=>b.id===d.id?Ht(b,n,Nt(g,b)):b))}}
                        >
                          <option value="roaming" ?selected=${!z(d)}>${this.t("pet_roaming")}</option>
                          <option value="static" ?selected=${z(d)}>${this.t("pet_static")}</option>
                        </select>
                        ${z(d)?a`<select title=${this.t("pet_pose")} aria-label=${this.t("pet_pose")} @change=${l=>h(d.id,W(d,{pose:l.target.value}))}>
                                ${ft.map(l=>a`<option value=${l} ?selected=${(A(d)[0]?.pose??"sit")===l}>${this.t(`pet_pose_${l}`)}</option>`)}
                              </select>
                              <select
                                title=${this.t("pet_turn")}
                                aria-label=${this.t("pet_turn")}
                                @change=${l=>{let n=l.target.value;h(d.id,W(d,{rotation:n===""?null:Number(n)}))}}
                              >
                                <option value="" ?selected=${A(d)[0]?.rotation==null}>${this.t("pet_turn_auto")}</option>
                                ${[0,45,90,135,180,225,270,315].map(l=>a`<option value=${l} ?selected=${A(d)[0]?.rotation===l}>${l}°</option>`)}
                              </select>
                              <span class="fp3d-sub">${this.t("pet_static_hint")}</span>`:c}
                        <button class="fp3d-btn" title=${this.t("delete")} @click=${()=>p(l=>l.list=l.list.filter(n=>n.id!==d.id))}>✕</button>
                      </div>`)}
                    ${s.length<8?a`<button class="fp3d-btn" @click=${()=>p(d=>d.list.push({id:`pet_${Date.now().toString(36)}`,kind:"cat",name:"",fur:M.cat[d.list.length%M.cat.length]}))}>+ ${this.t("pet_add")}</button>`:c}`:c}
            </div>`)}
    </section>`}funSwitch(t,e,s,i=!1){return a`<div class="fp3d-ext-season"><span>${e}</span><button type="button" class="fp3d-ext-sw" role="switch" aria-checked=${t} aria-label=${e} ?disabled=${i} @click=${()=>s(!t)}></button></div>`}renderSeasons(){let t=this.seasonDatesPart;return t||import("./home-3d-editor-season-dates-5QUG3TI3.js").then(e=>(this.seasonDatesPart=e,this.requestUpdate())),t?.seasonsCard({building:this.building,editor:this.isEditor&&!!this.building,lang:this.hass?.language,h12:se(this.hass?.locale,this.hass?.language),open:this._open,undo:this._undo,setUndo:e=>{clearTimeout(this.undoTimer),this._undo=e,e&&(this.undoTimer=setTimeout(()=>this._undo=null,8e3))},t:(e,s)=>this.t(e,s),toggle:e=>this.toggleOpen(e),funSwitch:(e,s,i,r)=>this.funSwitch(e,s,i,r),edit:e=>this.editBuilding(e)})}renderModules(){let t=this.hass,e=t&&this.building?xt():[];return!t||!e.length?c:e.map(s=>{let i=ut().find(o=>o.id===s),r=i?T(i,t.language??"en").replace(/^(Modul|Module):\s*/i,""):s,p=`mod:${s}`,h=this._open.has(p);return a`<section class="fp3d-ext-card fp3d-ext-module" id=${`ext-${s}`} data-ext="modules">
        <h3>${r}</h3>
        <button class="fp3d-link fp3d-ext-setting" aria-expanded=${h} @click=${()=>this.toggleOpen(p)}>${this.t("ext_module_settings")} ${h?"\u25B4":"\u25BE"}</button>
        ${h?a`<fp3d-editor
              class="fp3d-ext-fields"
              .topic=${`module:${s}`}
              .hass=${t}
              .building=${this.building}
              .canEdit=${this.canEdit}
              .packs=${this.packs}
              .narrow=${!0}
              @building-changed=${o=>{o.stopPropagation(),this.dispatchEvent(new CustomEvent("building-edit",{detail:o.detail.building,bubbles:!0,composed:!0}))}}
            ></fp3d-editor>`:c}
      </section>`})}renderItems(){if(!this.isEditor)return c;let t=rt(this.packs).length;return a`<section class="fp3d-ext-card" data-ext="items">
      <h3>${this.t("own_items_title")}</h3>
      <p class="fp3d-sub">${this.t("own_items_hint",{n:t})}</p>
      <button class="fp3d-btn fp3d-primary fp3d-pack-import" @click=${()=>this.openItemEditor()}>${this.t("own_items_open")}</button>
      ${this._itemsError?a`<p class="fp3d-sub fp3d-pack-error">${this._itemsError}</p>`:c}
    </section>`}async openItemEditor(){let t=this.hass;if(t)try{(await ye()).openItemEditor({hass:t,hassSource:()=>this.hass,t:(s,i)=>G(this.hass,s,i),items:rt(this.packs),kinds:O,rooms:U,roles:ne,changed:()=>this.dispatchEvent(new CustomEvent("packs-changed",{bubbles:!0,composed:!0})),from:this}),this._itemsError=null}catch(e){this._itemsError=String(e?.message??e)}}renderPacks(){let t=(this.packs??[]).filter(s=>!s.custom&&s.kind!=="language"),e=t.reduce((s,i)=>s+i.items.length,0);return a`<section class="fp3d-ext-card" data-ext="packs">
      <h3>${this.t("packs")}</h3>
      ${this.summaryBar("packs",[{n:t.length,label:this.t("ext_sum_packs",{items:e}),tone:"ok"}])}
      ${(this._open.has("packs")?t:[]).map(s=>a`<div class="fp3d-pack">
          <div>
            <b>${T(s,this.hass?.language??"de")}</b>
            <span class="fp3d-sub">${this.t("pack_by",{publisher:s.publisher,n:s.items.length})}</span>
            ${s.licence||s.release&&s.release>1?a`<span class="fp3d-sub">${[s.licence?this.t("pack_licence",{licence:s.licence}):"",s.release&&s.release>1?`v${s.release}`:""].filter(Boolean).join(" \xB7 ")}</span>`:c}
            ${this.renderOrigin(s)} ${this.renderPackUpdate(s)}
          </div>
          ${s.bundled?a`<span class="fp3d-sub">${this.t("pack_bundled")}</span>`:a`<button class="fp3d-btn fp3d-danger" @click=${()=>this.deletePack(s)}>${this.t("pack_remove")}</button>`}
        </div>`)}

      <label class="fp3d-btn fp3d-pack-import">
        ${this.t("pack_import")}
        <input type="file" accept=".fp3dpack,.json,application/json" multiple hidden @change=${s=>this.importPackFile(s)} />
      </label>
      <label class="fp3d-btn fp3d-pack-import">
        ${this.t("pack_import_folder")}
        <input type="file" webkitdirectory multiple hidden @change=${s=>this.importPackFolder(s)} />
      </label>
      ${this.isEditor?a`<form class="fp3d-pack-url" @submit=${s=>this.installFromUrl(s)}>
            <input
              type="url"
              inputmode="url"
              .value=${this._packUrl}
              placeholder="https://github.com/owner/repo/tree/main/publisher.pack"
              aria-label=${this.t("pack_install_url")}
              ?disabled=${this._installing}
              @input=${s=>this._packUrl=s.target.value}
            />
            <button class="fp3d-btn" type="submit" ?disabled=${this._installing||!this._packUrl.trim()}>
              ${this._installing?this.t("pack_installing"):this.t("pack_install_url")}
            </button>
          </form>`:c}
      ${this.renderPreview()}
      ${this._packMsg?a`<p class="fp3d-sub ${this._packMsg.ok?"fp3d-notice":"fp3d-pack-error"}">${this._packMsg.text}</p>`:c}
      <p class="fp3d-sub">${this.t("packs_hint")}</p>
    </section>`}renderLanguages(){let t=(this.packs??[]).filter(s=>s.kind==="language"),e=B(this.hass?.language);return a`<section class="fp3d-ext-card" data-ext="languages">
      <h3>${this.t("languages")}</h3>
      ${t.length?c:a`<p class="fp3d-sub">${this.t("lang_pack_none")}</p>`}
      ${t.map(s=>a`<div class="fp3d-pack">
          <div>
            <b lang=${s.language??c}>${s.name}</b>
            <span class="fp3d-sub">${this.t("lang_pack_texts",{language:s.language??"?",n:s.texts??0,publisher:s.publisher})}${s.language===e?` \xB7 ${this.t("lang_pack_shown")}`:""}</span>
            ${s.licence||s.release&&s.release>1?a`<span class="fp3d-sub">${[s.licence?this.t("pack_licence",{licence:s.licence}):"",s.release&&s.release>1?`v${s.release}`:""].filter(Boolean).join(" \xB7 ")}</span>`:c}
            ${this.renderOrigin(s)} ${this.renderPackUpdate(s)}
          </div>
          ${s.bundled?a`<span class="fp3d-sub">${this.t("pack_bundled")}</span>`:this.isEditor?a`<button class="fp3d-btn fp3d-danger" @click=${()=>this.deletePack(s)}>${this.t("pack_remove")}</button>`:c}
        </div>`)}
      <p class="fp3d-sub">${this.t("languages_hint")}</p>
    </section>`}importedText(t){return t.kind==="language"?this.t("lang_pack_imported",{name:t.name,language:t.language??"?",n:t.texts??0}):this.t("pack_imported",{name:t.name,publisher:t.publisher,n:t.items})}async languageChanged(t){this.hass&&t&&t===B(this.hass.language)&&await vt(this.hass.language,this.hass,!0)}renderOrigin(t){let e=dt(t);return e?a`<span class="fp3d-sub">${this.t("pack_from")} <a href=${e.url} target="_blank" rel="noreferrer noopener">${e.label}</a></span>`:c}async installFromUrl(t){t.preventDefault();let e=this._packUrl.trim();!e||!this.hass||await this.review(e)}async review(t){if(!(!this.hass||this._installing)){this._installing=!0,this._packMsg=null,this._preview=null;try{this._preview=await Et(this.hass,t)}catch(e){e?.code==="unknown_command"?(this._installing=!1,await this.install(t)):this._packMsg={ok:!1,text:this.packError(e)}}finally{this._installing=!1}}}async install(t,e){if(this.hass){this._installing=!0;try{let s=this.hass,i=await H(r=>wt(s,t,r,e),this.askConfirm);if(!i)return;this._preview=null,this._packUrl="",this._packMsg={ok:!0,text:this.importedText(i)},await this.languageChanged(i.language),this.dispatchEvent(new CustomEvent("packs-changed",{bubbles:!0,composed:!0}))}catch(s){this._preview=null,this._packMsg={ok:!1,text:this.packError(s)}}finally{this._installing=!1}}}renderPreview(){let t=this._preview;if(!t)return c;let e=this.hass?.language??"de",s=t.installed!==null,i=t.changes,r=t.pack.kind==="language",p=(h,o)=>o.length?a`<li><b>${this.t(h,{n:o.length})}</b>: ${o.slice(0,12).map(d=>Gt(d,e)).join(", ")}${o.length>12?" \u2026":""}</li>`:c;return a`<div class="fp3d-preview" role="group" aria-label=${this.t("pp_title")}>
      <b>${s?this.t("pp_update",{name:t.pack.name,from:t.installed.release,to:t.pack.release}):this.t("pp_install",{name:t.pack.name,release:t.pack.release})}</b>
      ${t.pack.note?a`<span class="fp3d-sub fp3d-upd-note">${t.pack.note}</span>`:c}
      <span class="fp3d-sub">${r?this.t("lang_pack_texts",{language:t.pack.language??"?",n:t.pack.texts??0,publisher:t.pack.publisher}):this.t("pack_by",{publisher:t.pack.publisher,n:t.pack.items})} · ${this.t("pack_licence",{licence:t.pack.licence})}</span>
      <span class="fp3d-sub">
        ${this.t("pp_from")}
        <a href=${t.origin.url} target="_blank" rel="noreferrer noopener">${t.origin.owner}/${t.origin.repo}${t.origin.folder?`/${t.origin.folder}`:""} @ ${t.origin.ref}</a>
        · ${this.t("pp_commit")} <code>${N(t.origin.commit)}</code>${t.installed?.commit?a` (${this.t("pp_now")} <code>${N(t.installed.commit)}</code>)`:c}
      </span>
      ${t.warnings.map(h=>a`<span class="fp3d-sub fp3d-pack-error">${this.t(`pp_warn_${h}`)}</span>`)}
      ${Vt(t)?a`<span class="fp3d-sub">${s?this.t(r?"pp_nothing_texts":"pp_nothing"):this.t("pp_empty")}</span>`:a`<ul>
            ${p("pp_added",i.added)} ${p("pp_changed",i.changed)} ${p("pp_removed",i.removed)}
          </ul>
          <span class="fp3d-sub">${this.t(r?"pp_unchanged_texts":"pp_unchanged",{n:i.unchanged})}</span>`}
      ${s&&!r&&(i.changed.length||i.removed.length)?a`<span class="fp3d-sub">${this.t("pp_placed_hint")}</span>`:c}
      <span class="fp3d-pack-tools">
        <button class="fp3d-btn fp3d-primary" ?disabled=${this._installing} @click=${()=>{this.install(t.origin.url,t.origin.commit)}}>
          ${s?this.t("pp_do_update"):this.t("pp_do_install")}
        </button>
        <button class="fp3d-btn" ?disabled=${this._installing} @click=${()=>this._preview=null}>${this.t("cancel")}</button>
      </span>
    </div>`}async importPackFile(t){let e=t.target,s=[...e.files??[]];if(e.value="",!s.length||!this.hass)return;let i=[],r=[];for(let h of s)try{let o=this.hass,d=await h.text(),l=await H(n=>_t(o,d,n),this.askConfirm);if(!l)continue;i.push(this.importedText(l))}catch(o){r.push(`${h.name}: ${this.packError(o)}`)}i.length&&this.dispatchEvent(new CustomEvent("packs-changed",{bubbles:!0,composed:!0}));let p=s.length>1?[this.t("packs_imported_n",{n:i.length,total:s.length})]:[];this._packMsg={ok:r.length===0,text:[...p,...i,...r].join(" \xB7 ")}}async importPackFolder(t){let e=t.target,s=[...e.files??[]];if(e.value="",!s.length||!this.hass)return;let i=new Map(s.map(d=>[d.webkitRelativePath||d.name,d])),r=we([...i.keys()]);if(!r.length){this._packMsg={ok:!1,text:this.t("pack_error_no_pack")};return}let p=[],h=[];for(let d of r){let l=d.root||s[0].webkitRelativePath.split("/")[0]||"pack";if(d.refused.length){h.push(`${l}: ${this.t("pack_error_not_data",{detail:d.refused.join(", ")})}`);continue}try{let n={};for(let[b,k]of d.files)n[b]=await i.get(k).text();let g=this.hass,f=await H(b=>yt(g,n,b),this.askConfirm);if(!f)continue;p.push(this.importedText(f)),await this.languageChanged(f.language)}catch(n){h.push(`${l}: ${this.packError(n)}`)}}p.length&&this.dispatchEvent(new CustomEvent("packs-changed",{bubbles:!0,composed:!0}));let o=r.length>1?[this.t("packs_imported_n",{n:p.length,total:r.length})]:[];this._packMsg={ok:h.length===0,text:[...o,...p,...h].join(" \xB7 ")}}packError(t){let{code:e,message:s}=t??{},i=`pack_error_${e}`,r=this.t(i,{detail:s??String(t)});return r===i?this.t("pack_error_other",{detail:s??String(t)}):r}async deletePack(t){if(!(!this.hass||!await this.ask(this.t("pack_remove_confirm",{name:T(t,this.hass?.language??"de")}),this.t("delete"),!0))){try{await Mt(this.hass,t.id)}catch(e){this._packMsg={ok:!1,text:this.t("pack_remove_failed",{error:$t(e)})};return}this._packMsg=null,await this.languageChanged(t.language),this.dispatchEvent(new CustomEvent("packs-changed",{bubbles:!0,composed:!0}))}}static styles=[_,I,x`
      .fp3d-sum {
        display: grid;
        gap: 6px;
        width: 100%;
        margin: 4px 0 8px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--fp3d-line, rgba(120, 190, 255, 0.22));
        background: rgba(4, 8, 18, 0.35);
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }
      .fp3d-sum-bar {
        display: flex;
        gap: 2px;
        height: 8px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(120, 190, 255, 0.12);
      }
      .fp3d-sum-bar i {
        display: block;
      }
      .fp3d-sum-ok {
        background: #34d399;
      }
      .fp3d-sum-update {
        background: #fbbf24;
      }
      .fp3d-sum-missing {
        background: #60a5fa;
      }
      .fp3d-sum-text {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 14px;
        font-size: 0.92em;
      }
      .fp3d-sum-ok-text {
        color: #34d399;
      }
      .fp3d-sum-update-text {
        color: #fbbf24;
      }
      .fp3d-sum-missing-text {
        color: #60a5fa;
      }
      .fp3d-preview {
        display: grid;
        gap: 6px;
        padding: 12px;
        border-radius: 12px;
        border: 1px solid var(--fp3d-line, rgba(120, 190, 255, 0.22));
        background: rgba(4, 8, 18, 0.35);
      }
      .fp3d-preview ul {
        margin: 0;
        padding-left: 18px;
      }
      .fp3d-preview code {
        font-family: ui-monospace, monospace;
      }
      .fp3d-sum-caret {
        color: var(--fp3d-muted, #8ea3c4);
        font-size: 0.85em;
      }
      :host {
        display: block;
        overflow: auto;
      }
      .fp3d-ext {
        max-width: 920px;
        margin: 0 auto;
        padding: 20px 16px 40px;
        display: grid;
        gap: 16px;
      }
      .fp3d-ext-head {
        display: grid;
        gap: 8px;
        justify-items: start;
      }
      .fp3d-ext-head a {
        text-decoration: none;
      }
      .fp3d-ext-actions,
      .fp3d-ext-links {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .fp3d-ext-head h2 {
        margin: 0;
        font-size: 22px;
      }
      .fp3d-ext-card {
        padding: 14px 16px;
        border: 1px solid var(--fp3d-line);
        border-radius: 14px;
        background: var(--fp3d-chrome);
      }
      /* headings and body copy in light, neutral tones: blue on navy read poorly (#88) */
      .fp3d-ext-card h3 {
        margin: 0 0 8px;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--fp3d-text);
      }
      .fp3d-ext-fields {
        display: block;
        height: auto;
      }
      .fp3d-ext-flash {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 3px;
      }
      .fp3d-ext-dates {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
        margin: -6px 0 6px;
      }
      .fp3d-ext-dates-edit {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        flex-basis: 100%;
      }
      /* one rule: a grid of labelled fields (the shared field look), Remove at the end (#343) */
      .fp3d-ext-rule {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        gap: 10px 12px;
        align-items: end;
        flex-basis: 100%;
        padding: 10px 0;
        border-top: 1px solid var(--fp3d-line);
      }
      .fp3d-ext-rule .fp3d-field input,
      .fp3d-ext-rule .fp3d-field select {
        width: 100%;
        box-sizing: border-box;
      }
      .fp3d-ext-rule-remove {
        justify-self: start;
      }
      .fp3d-ext-upcoming {
        flex-basis: 100%;
      }
      .fp3d-ext-upcoming ul {
        margin: 4px 0;
        padding-left: 18px;
      }
      .fp3d-ext-undo {
        margin: 6px 0;
        padding: 6px 10px;
        border-radius: 6px;
        background: var(--fp3d-surface-2, rgba(128, 128, 128, 0.15));
      }
      .fp3d-ext-sub {
        margin: 0 0 8px 12px;
        padding-left: 10px;
        border-left: 2px solid var(--fp3d-line);
      }
      .fp3d-ext-season {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        min-height: 44px;
      }
      .fp3d-ext-sw {
        position: relative;
        flex: none;
        width: 46px;
        height: 28px;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: var(--fp3d-line);
        cursor: pointer;
      }
      .fp3d-ext-sw::after {
        content: "";
        position: absolute;
        top: 4px;
        left: 4px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--fp3d-muted);
        transition: transform 0.15s;
      }
      .fp3d-ext-sw[aria-checked="true"] {
        background: var(--fp3d-primary);
      }
      .fp3d-ext-sw[aria-checked="true"]::after {
        transform: translateX(18px);
        background: var(--fp3d-primary-text);
      }
      .fp3d-ext-sw:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .fp3d-ext-setting {
        justify-self: start;
        min-height: 36px;
        padding: 0;
        border: 0;
        background: none;
        color: var(--fp3d-accent);
        font: inherit;
        cursor: pointer;
        text-align: left;
      }
      .fp3d-pet-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        margin-top: 6px;
      }
      .fp3d-pet-row input[type="text"],
      .fp3d-pet-row select,
      .fp3d-ext-season select {
        padding: 6px 10px;
        border-radius: 10px;
        border: 1px solid var(--fp3d-line, rgba(120, 190, 255, 0.25));
        background: rgba(4, 8, 18, 0.6);
        color: inherit;
        font: inherit;
      }
      .fp3d-pet-row input[type="text"] {
        flex: 1;
        min-width: 110px;
      }
      .fp3d-ext-feature {
        display: grid;
        gap: 6px;
        align-content: start;
        padding: 12px;
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
      }
      /* an active feature is marked by its tick and "active", not a cyan frame on every card (#88) */
      .fp3d-ext-on {
        border-color: var(--fp3d-line);
      }
      .fp3d-ext-state {
        color: var(--fp3d-accent);
        font-weight: 600;
        font-size: 13px;
      }
      .fp3d-ext-link {
        color: var(--fp3d-accent);
        font-weight: 600;
        font-size: 13px;
      }
      .fp3d-sub {
        color: var(--fp3d-muted);
        font-size: 13px;
        line-height: 1.45;
      }
      .fp3d-notice {
        color: var(--fp3d-accent);
      }
      .fp3d-pack {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid var(--fp3d-line);
      }
      .fp3d-pack div {
        display: grid;
        gap: 2px;
      }
      .fp3d-pack-tools,
      .fp3d-upd-when {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 14px;
        align-items: center;
      }
      .fp3d-upd-when {
        margin: 8px 0;
      }
      .fp3d-upd-when label {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .fp3d-upd-when select,
      .fp3d-upd-when input {
        padding: 6px 10px;
        border-radius: 10px;
        border: 1px solid var(--fp3d-line, rgba(120, 190, 255, 0.25));
        background: rgba(4, 8, 18, 0.6);
        color: inherit;
        font: inherit;
      }
      .fp3d-pack-url {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }
      .fp3d-pack-url input {
        flex: 1;
        min-width: 0;
      }
      .fp3d-pack-import {
        display: block;
        margin-top: 10px;
        text-align: center;
        cursor: pointer;
      }
      .fp3d-pack-error {
        color: var(--fp3d-danger);
      }
    `]};v("fp3d-extensions",lt);
