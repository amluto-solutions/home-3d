import{e as v,f as $}from"./home-3d-chunk-GXOX5JZ2.js";import{c as m,e as y,f as l,i as u,k as b}from"./home-3d-chunk-APG5VEKP.js";import"./home-3d-chunk-HCDNWXPN.js";function h(i,e,t){let n=[...i];if(e<0||e>=n.length)return n;let[r]=n.splice(e,1);return n.splice(Math.max(0,Math.min(t,n.length)),0,r),n}function c(i){let e={};return i.pinned?.length&&(e.pinned=i.pinned.slice(0,100)),i.order?.length&&(e.order=i.order.slice(0,2e3)),i.groups?.length&&(e.groups=i.groups),Object.keys(e).length?e:null}function _(i,e,t,n){let r=e.groups.flatMap(a=>a.group===t?n:a.ids),o=new Set(r),s=[...r,...(i?.order??[]).filter(a=>!o.has(a)&&!e.pinned.includes(a))];return c({...i,order:s})}function x(i,e,t){let n=t.filter(r=>!e.includes(r));return c({...i,groups:[...e,...n]})}function w(i,e){let t=(i?.pinned??[]).filter(n=>!e.includes(n));return c({...i,pinned:[...e,...t]})}function P(i,e){let t=i?.pinned??[];return c({...i,pinned:t.includes(e)?t.filter(n=>n!==e):[...t,e]})}function L(i,e){let t=i??[];return t.includes(e)?t.filter(n=>n!==e):[...t,e]}function M(i,e){return t=>{for(let n of t.floors){let r=n.rooms.find(o=>o.id===i)??n.outdoor?.find(o=>o.id===i);if(r){e.hidden&&(r.hidden=e.hidden),e.layout!==void 0&&(e.layout?r.panel_layout=e.layout:delete r.panel_layout);return}}}}var k={lights:"panel_lights",covers:"panel_covers",climate:"panel_climate",media:"panel_media",switches:"panel_switches",cameras:"panel_cameras",sensors:"panel_sensors",scenes:"panel_scenes"},d=i=>l`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${i} /></svg>`,p={grip:"M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",up:"M6 15l6-6 6 6",down:"M6 9l6 6 6-6",eye:"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z",eyeOff:"M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.1M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.6 9.6 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2",pin:"M12 17v5M8 3h8l-1 6 3 4H6l3-4z"},g=class extends b{static properties={hass:{attribute:!1},roomId:{attribute:!1},arranged:{attribute:!1},hiddenIds:{attribute:!1},layout:{attribute:!1},allGroups:{attribute:!1},nameOf:{attribute:!1},iconOf:{attribute:!1},t:{attribute:!1},_drag:{state:!0}};constructor(){super(),this.hiddenIds=[],this.layout=null,this._drag=null}store(e){this.dispatchEvent(new CustomEvent("plan-change",{detail:{change:M(this.roomId,e)},bubbles:!0,composed:!0,cancelable:!0}))}entries(e){let t=this.arranged;return e==="pinned"?t.pinned:e==="groups"?t.groups.map(n=>n.group):t.groups.find(n=>n.group===e)?.ids??[]}move(e,t,n){let r=this.entries(e);if(t===n||n<0||n>=r.length)return;let o=h(r,t,n);e==="pinned"?this.store({layout:w(this.layout,o)}):e==="groups"?this.store({layout:x(this.layout,o,this.allGroups)}):this.store({layout:_(this.layout,this.arranged,e,o)})}dragStart(e,t,n){if(e.button!==0)return;e.preventDefault(),e.currentTarget.setPointerCapture?.(e.pointerId);let r=[...this.renderRoot.querySelectorAll(`[data-list="${t}"]`)].map(o=>{let s=o.getBoundingClientRect();return s.top+s.height/2});this._drag={list:t,from:n,to:n,mids:r}}dragMove(e){let t=this._drag;if(!t)return;let n=t.mids.filter((r,o)=>o!==t.from&&r<e.clientY).length;n!==t.to&&(this._drag={...t,to:n})}dragEnd(){let e=this._drag;this._drag=null,e&&this.move(e.list,e.from,e.to)}shown(e,t){let n=this._drag;return n&&n.list===e?h(t,n.from,n.to):t}grip(e,t,n){return l`<button
      class="fp3d-le-grip"
      title=${this.t("panel_drag")}
      aria-label="${this.t("panel_drag")}: ${n}"
      @pointerdown=${r=>this.dragStart(r,e,t)}
      @pointermove=${r=>this.dragMove(r)}
      @pointerup=${()=>this.dragEnd()}
      @pointercancel=${()=>this._drag=null}
    >
      ${d(p.grip)}
    </button>`}upDown(e,t,n,r){return l`<button class="fp3d-le-btn" title=${this.t("move_up")} aria-label="${this.t("move_up")}: ${r}" ?disabled=${t===0} @click=${()=>this.move(e,t,t-1)}>
        ${d(p.up)}</button
      ><button class="fp3d-le-btn" title=${this.t("move_down")} aria-label="${this.t("move_down")}: ${r}" ?disabled=${t===n-1} @click=${()=>this.move(e,t,t+1)}>
        ${d(p.down)}
      </button>`}row(e,t,n){let r=this.nameOf(t),o=this.hiddenIds.includes(t),s=this.arranged.pinned.includes(t),a=this.iconOf(t),f=this.entries(e).indexOf(t),O=this._drag?.list===e&&this._drag.from===f;return l`<li class="fp3d-le-row ${o?"fp3d-le-hidden":""} ${O?"fp3d-le-dragged":""}" data-list=${e}>
      ${this.grip(e,f,r)}
      <span class="fp3d-le-icon">${a?d(a):u}</span>
      <span class="fp3d-le-name">${r}</span>
      <span class="fp3d-le-tools">
        ${this.upDown(e,f,n,r)}
        <button
          class="fp3d-le-btn"
          aria-pressed=${o?"false":"true"}
          title=${this.t(o?"panel_unhide":"panel_hide")}
          aria-label="${this.t(o?"panel_unhide":"panel_hide")}: ${r}"
          @click=${()=>this.store({hidden:L(this.hiddenIds,t)})}
        >
          ${d(o?p.eyeOff:p.eye)}
        </button>
        <button
          class="fp3d-le-btn ${s?"fp3d-le-on":""}"
          aria-pressed=${s?"true":"false"}
          title=${this.t(s?"panel_unpin_top":"panel_pin_top")}
          aria-label="${this.t(s?"panel_unpin_top":"panel_pin_top")}: ${r}"
          @click=${()=>this.store({layout:P(this.layout,t)})}
        >
          ${d(p.pin)}
        </button>
      </span>
    </li>`}rows(e,t){return l`<ul class="fp3d-le-list">
      ${this.shown(e,t).map((n,r,o)=>this.row(e,n,o.length))}
    </ul>`}render(){let e=this.arranged;if(!e)return u;let t=this.shown("groups",e.groups.map(n=>n.group));return l`<p class="fp3d-le-note">${this.t("panel_edit_note")}</p>
      ${e.pinned.length?l`<section class="fp3d-le-sec fp3d-le-pinned">
            <h3>${this.t("panel_pinned")}</h3>
            ${this.rows("pinned",e.pinned)}
          </section>`:u}
      ${t.map(n=>{let r=e.groups.findIndex(s=>s.group===n),o=this.t(k[n]);return l`<section class="fp3d-le-sec ${this._drag?.list==="groups"&&this._drag.from===r?"fp3d-le-dragged":""}" data-list="groups">
          <div class="fp3d-le-head">
            ${this.grip("groups",r,o)}
            <h3>${o}</h3>
            <span class="fp3d-le-tools">${this.upDown("groups",r,t.length,o)}</span>
          </div>
          ${this.rows(n,e.groups[r].ids)}
        </section>`})}`}static styles=[v,$,y`:host{display:grid;gap:12px}.fp3d-le-note{margin:4px 0 0;color:var(--fp3d-muted);font-size:12.5px}.fp3d-le-sec{border:1px solid var(--fp3d-line);border-radius:12px;padding:4px 6px;background:var(--fp3d-chrome-solid)}.fp3d-le-pinned{border-color:color-mix(in srgb,var(--fp3d-accent,#37e0ff) 50%,var(--fp3d-line))}.fp3d-le-pinned h3{padding:6px 4px}.fp3d-le-head,.fp3d-le-row{display:flex;align-items:center;gap:6px;min-height:40px}h3{flex:1;margin:0;font-size:11.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--fp3d-muted)}.fp3d-le-list{list-style:none;margin:0;padding:0}.fp3d-le-row{border-top:1px solid var(--fp3d-line)}.fp3d-le-icon{display:grid;place-items:center;width:26px;color:var(--fp3d-muted)}.fp3d-le-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fp3d-le-hidden .fp3d-le-name,.fp3d-le-hidden .fp3d-le-icon{opacity:0.45;text-decoration:line-through}.fp3d-le-dragged{outline:2px dashed var(--fp3d-accent,#37e0ff);outline-offset:-2px;border-radius:8px}.fp3d-le-tools{display:inline-flex;gap:2px}.fp3d-le-btn,.fp3d-le-grip{display:grid;place-items:center;width:34px;height:34px;padding:0;border:none;border-radius:8px;background:none;color:var(--fp3d-text);cursor:pointer}.fp3d-le-btn:hover:not(:disabled),.fp3d-le-grip:hover{background:rgba(255,255,255,0.08)}.fp3d-le-btn:disabled{opacity:0.3;cursor:default}.fp3d-le-on{color:var(--fp3d-accent,#37e0ff)}.fp3d-le-grip{touch-action:none;cursor:grab;color:var(--fp3d-muted)}button:focus-visible{outline:2px solid var(--fp3d-accent);outline-offset:2px}@media (pointer:coarse){.fp3d-le-btn,.fp3d-le-grip{width:44px;height:44px}}`]};m("fp3d-room-list-edit",g);export{g as Fp3dRoomListEdit};
