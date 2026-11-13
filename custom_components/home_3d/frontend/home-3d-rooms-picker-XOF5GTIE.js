import{c as u,e as h,f as s,i as a,k as m}from"./home-3d-chunk-FEXDU3FT.js";import"./home-3d-chunk-WSBQCKVC.js";function f(c,e,t=!0){let n=e.trim().toLocaleLowerCase();return!n&&t?[...c]:c.map(i=>({...i,rooms:i.rooms.filter(d=>(t||!d.hidden)&&(!n||d.name.toLocaleLowerCase().includes(n)))})).filter(i=>i.rooms.length)}var p=class extends m{static properties={groups:{attribute:!1},selected:{attribute:!1},t:{attribute:!1},editFloor:{attribute:!1},canHide:{attribute:!1},_showHidden:{state:!0},_query:{state:!0},_cursor:{state:!0}};constructor(){super(),this.groups=[],this.selected=null,this.t=e=>e,this.editFloor=null,this.canHide=!1,this._showHidden=!1,this._query="",this._cursor=0}listed(){return f(this.groups,this._query,this._showHidden).flatMap(e=>e.rooms.map(t=>({group:e,room:t})))}fire(e,t=null){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}firstUpdated(){let e=this.listed().findIndex(t=>t.room.id===this.selected);e>0&&(this._cursor=e),this.renderRoot.querySelector("input")?.focus({preventScroll:!0})}updated(e){e.has("_cursor")&&this.renderRoot.querySelector(".cursor")?.scrollIntoView?.({block:"nearest"})}onKey(e){let t=this.listed(),n=t.length-1,i=e.key==="ArrowDown"?Math.min(n,this._cursor+1):e.key==="ArrowUp"?Math.max(0,this._cursor-1):e.key==="Home"&&e.ctrlKey?0:e.key==="End"&&e.ctrlKey?n:null;if(i!==null)e.preventDefault(),this._cursor=Math.max(0,i);else if(e.key==="Enter"){e.preventDefault();let d=t[this._cursor];d&&this.fire("room-pick",{floorId:d.group.id,roomId:d.room.id})}else e.key==="Escape"&&(e.preventDefault(),e.stopPropagation(),this.fire("picker-close",{focus:!0}))}render(){let e=f(this.groups,this._query,this._showHidden),t=this.groups.reduce((o,r)=>o+r.rooms.filter(l=>l.hidden).length,0),n=this.groups.length>1,i=-1,d=this.listed().length?`room-${this._cursor}`:a;return s`<div class="veil" @click=${()=>this.fire("picker-close")}></div>
      <div class="box" role="dialog" aria-label=${this.t("rooms")}>
        <input
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls="rooms-list"
          aria-autocomplete="list"
          aria-activedescendant=${d}
          aria-label=${this.t("rooms_find")}
          placeholder=${this.t("rooms_find")}
          .value=${this._query}
          @input=${o=>(this._query=o.target.value,this._cursor=0)}
          @keydown=${o=>this.onKey(o)}
        />
        <div id="rooms-list" class="list" role="listbox" aria-label=${this.t("rooms")}>
          ${e.map(o=>s`<div role="group" aria-label=${o.name}>
              ${n?s`<div class="mh" aria-hidden="true">${o.name}</div>`:a}
              ${o.rooms.map(r=>{i++;let l=i;return s`<div
                  id="room-${l}"
                  role="option"
                  aria-selected=${r.id===this.selected}
                  class="mi ${l===this._cursor?"cursor":""} ${r.id===this.selected?"on":""} ${r.hidden?"dim":""}"
                  @mouseenter=${()=>this._cursor=l}
                  @click=${()=>this.fire("room-pick",{floorId:o.id,roomId:r.id})}
                >
                  ${r.name}${this.canHide?s`<button
                        type="button"
                        class="hide"
                        aria-label=${this.t(r.hidden?"room_unhide_named":"room_hide_named",{room:r.name})}
                        @click=${g=>(g.stopPropagation(),this.fire("room-hide",{roomId:r.id,hide:!r.hidden}))}
                      >
                        ${this.t(r.hidden?"room_unhide":"room_hide")}
                      </button>`:a}
                </div>`})}
            </div>`)}
          ${e.length?a:s`<p class="none" role="status">${this.t("rooms_none",{q:this._query.trim()})}</p>`}
        </div>
        ${t?s`<label class="more"><input type="checkbox" .checked=${this._showHidden} @change=${o=>(this._showHidden=o.target.checked,this._cursor=0)} />${this.t("rooms_show_hidden")} <small>(${t})</small></label>`:a}
        ${this.editFloor?s`<button class="edit" @click=${()=>this.fire("edit-floor",{floorId:this.editFloor})}>${this.t("edit_floor")} ›</button>`:a}
      </div>`}static styles=h`:host{position:absolute;top:calc(100% + 6px);left:0;z-index:40}.veil{position:fixed;inset:0}.box{position:relative;display:grid;gap:4px;width:min(280px,calc(100vw - 24px));padding:6px;border-radius:var(--fp3d-radius-card,8px);border:1px solid var(--fp3d-line,rgba(127,127,127,0.4));background:var(--fp3d-chrome-solid,#131c31);color:var(--fp3d-text,inherit);box-shadow:0 18px 40px rgba(0,0,0,0.55);font-size:13.5px}input{font:inherit;color:inherit;min-height:36px;padding:0 10px;border-radius:var(--fp3d-radius-control,6px);border:1px solid var(--fp3d-line,rgba(127,127,127,0.4));background:transparent}input:focus-visible,.edit:focus-visible{outline:2px solid var(--fp3d-accent,#48cdeb);outline-offset:1px}.list{max-height:min(50vh,360px);overflow-y:auto}.mh{padding:8px 10px 4px;font-size:11.5px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--fp3d-muted,#94a3b8)}.mi{display:flex;align-items:center;min-height:36px;padding:0 10px;border-radius:var(--fp3d-radius-control,6px);cursor:pointer}.mi.cursor{background:color-mix(in srgb,var(--fp3d-accent,#48cdeb) 12%,transparent)}.mi.on{color:var(--fp3d-accent,#48cdeb);font-weight:700}.mi.dim{color:var(--fp3d-muted,#94a3b8);font-style:italic}.hide{margin-left:auto;font:inherit;font-size:12px;font-style:normal;font-weight:400;color:var(--fp3d-muted,#94a3b8);background:none;border:none;min-height:28px;padding:0 6px;cursor:pointer;text-decoration:underline}.hide:hover,.hide:focus-visible{color:var(--fp3d-accent,#48cdeb)}.more{display:flex;align-items:center;gap:8px;min-height:36px;padding:0 10px;border-top:1px solid var(--fp3d-line,rgba(127,127,127,0.4));cursor:pointer}.more input{min-height:0}.more small{color:var(--fp3d-muted,#94a3b8)}.mi.on::after{content:"✓";margin-left:auto}.none{margin:6px 10px;color:var(--fp3d-muted,#94a3b8)}.edit{font:inherit;text-align:left;color:var(--fp3d-accent,#48cdeb);background:none;border:none;border-top:1px solid var(--fp3d-line,rgba(127,127,127,0.4));min-height:36px;padding:0 10px;cursor:pointer}@media (pointer:coarse){.mi,input,.edit{min-height:44px}}`};u("fp3d-rooms-picker",p);export{p as Fp3dRoomsPicker,f as filterRooms};
