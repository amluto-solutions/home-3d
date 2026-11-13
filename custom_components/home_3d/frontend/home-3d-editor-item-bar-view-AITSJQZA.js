import{d as $,g as S,i as R}from"./home-3d-editor-chunk-YNUPHTU4.js";import"./home-3d-editor-chunk-XHXGJ2X3.js";import{Ta as E}from"./home-3d-editor-chunk-O7KMRNB2.js";import{a as w}from"./home-3d-editor-chunk-TAAEQO2A.js";import{b as M,c as u,d as l,f as d,h as k}from"./home-3d-editor-chunk-GGWVF3HT.js";var f=new WeakMap,T=10,b=4;function _(t,e,n){if(t.x1<0||t.y1<0||t.x0>e.w||t.y0>e.h)return null;let i=Math.max(b,Math.min((t.x0+t.x1)/2-n.w/2,e.w-n.w-b)),c=t.y0-T-n.h,s=c<b,o=s?Math.min(t.y1+T,e.h-n.h-b):c;return{x:Math.round(i),y:Math.round(Math.max(b,o)),below:s}}function F(t,e){let n=e?44:32;return{w:t*n+(t+1)*2+10+10,h:n+10}}function H(t,e,n){return n?t==="ArrowRight"?(e+1)%n:t==="ArrowLeft"?(e-1+n)%n:t==="Home"?0:t==="End"?n-1:-1:-1}var P={rotate_left:l`<path d="M4 9a8 8 0 1 1 1.5 7"/><path d="M4 4v5h5"/>`,rotate:l`<path d="M20 9a8 8 0 1 0-1.5 7"/><path d="M20 4v5h-5"/>`,duplicate:l`<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>`,lock:l`<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,unlock:l`<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>`,delete:l`<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>`,more:l`<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>`},B=t=>l`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[t]}</svg>`;function z(t){return[...t?[]:["rotate_left"],"rotate","duplicate","lock","delete"]}function A(t){let e=t.furnitureItem;if(!e)return null;let n=t._view.scale,i=e.rotation*Math.PI/180,c=e.d/2+Math.max(.3,26/n)+16/n,s=e.d/2+26/n,o=[...E(e),[e.x-Math.sin(i)*c,e.z+Math.cos(i)*c],[e.x+Math.sin(i)*s,e.z-Math.cos(i)*s]].map(a=>t.toScreen([a[0],a[1]]));return{x0:Math.min(...o.map(a=>a[0])),y0:Math.min(...o.map(a=>a[1])),x1:Math.max(...o.map(a=>a[0])),y1:Math.max(...o.map(a=>a[1]))}}function V(t){let e=t.furnitureItem,n=t.narrow||t._phone,i=S(),c=z(n),s=t.itemActions("furniture",e.id),o=c.map(r=>s.find(p=>p.key===r)).filter(r=>!!r),a=F(o.length+1,i),x=A(t),m=x?_(x,t._size,a):null;if(!m)return d;let g=Math.min(f.get(t)??0,o.length),y=u`<span class="fp3d-itembar-sep" aria-hidden="true"></span>`,L=r=>{let p=r.currentTarget.getBoundingClientRect(),v=t.renderRoot.querySelector("svg.fp3d-plan")?.getBoundingClientRect();f.set(t,o.length),t._ctx={x:p.left-(v?.left??0),y:p.bottom-(v?.top??0)+4,kind:"furniture",id:e.id,bar:!0},t.updateComplete.then(()=>t.renderRoot.querySelector(".fp3d-ctx button:not(:disabled)")?.focus())};return u`<div
    class="fp3d-itembar ${i?"fp3d-itembar-touch":""} ${m.below?"fp3d-itembar-below":""}"
    role="toolbar"
    aria-label=${t.t("bar_label",{name:e.name||R(t.hass,e.type)})}
    style=${`transform:translate(${m.x}px,${m.y}px)`}
    @pointerdown=${r=>r.stopPropagation()}
    @contextmenu=${r=>r.preventDefault()}
    @keydown=${r=>C(t,r)}
  >
    ${o.map((r,p)=>u`${r.key==="duplicate"&&p?y:d}<button
          class="fp3d-itembar-btn ${r.danger?"fp3d-itembar-danger":""}"
          tabindex=${p===g?0:-1}
          aria-label=${r.label}
          title=${r.title??r.label}
          aria-pressed=${r.pressed??d}
          ?disabled=${r.disabled}
          @focus=${()=>f.set(t,p)}
          @click=${()=>r.run()}
        >
          ${B(r.key==="lock"&&r.pressed?"lock":r.key==="lock"?"unlock":r.key)}
        </button>`)}${y}<button
      class="fp3d-itembar-btn"
      tabindex=${g===o.length?0:-1}
      aria-label=${t.t("bar_more")}
      title=${t.t("bar_more")}
      aria-haspopup="menu"
      @focus=${()=>f.set(t,o.length)}
      @click=${L}
    >
      ${B("more")}
    </button>
  </div>`}function C(t,e){let n=e.currentTarget,i=[...n.querySelectorAll("button")],c=i.indexOf(n.getRootNode().activeElement),s=H(e.key,c,i.length);if(s>=0){e.preventDefault(),e.stopPropagation(),f.set(t,s),i[s]?.focus();return}if(e.key==="Escape"||e.key==="Tab"){e.preventDefault(),e.stopPropagation();let o=t.renderRoot.activeElement;o instanceof HTMLElement&&o.blur();let a=e.key==="Tab"&&!e.shiftKey?$(t.tabItems(),t._furnitureId,1):null;a&&t.selectFromList(a)}}var I=M`
  .fp3d-itembar {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    border: 1px solid var(--fp3d-line);
    border-radius: 12px;
    background: var(--fp3d-panel, #111a2e);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    pointer-events: none;
    will-change: transform;
  }
  .fp3d-itembar-btn {
    pointer-events: auto;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--fp3d-text);
    cursor: pointer;
    touch-action: manipulation;
  }
  .fp3d-itembar-touch .fp3d-itembar-btn {
    width: 44px;
    height: 44px;
  }
  .fp3d-itembar-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--fp3d-accent) 16%, transparent);
  }
  .fp3d-itembar-btn:focus-visible {
    outline: 2px solid var(--fp3d-accent);
    outline-offset: 1px;
  }
  .fp3d-itembar-btn[aria-pressed="true"] {
    color: var(--fp3d-accent);
  }
  .fp3d-itembar-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .fp3d-itembar-danger {
    color: var(--fp3d-danger, #ff6b7a);
  }
  .fp3d-itembar-sep {
    width: 1px;
    height: 20px;
    margin: 0 2px;
    background: var(--fp3d-line);
  }
`,h=class extends k{static properties={host:{attribute:!1},stamp:{attribute:!1}};createRenderRoot(){return this}render(){return this.host?u`<style>${I}</style>${V(this.host)}`:d}};w("fp3d-item-bar",h);export{h as ItemBar,z as barKeys,_ as barPlace,F as barSize,H as barStep};
