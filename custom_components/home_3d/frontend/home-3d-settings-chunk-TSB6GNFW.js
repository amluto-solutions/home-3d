import{b as p,c as u,d as k,g as _}from"./home-3d-settings-chunk-7QJ3M3KF.js";var W="#48cdeb";function L(e,t){return(e??"").trim().toLowerCase()===(t??"").trim().toLowerCase()}function P(e,t){return!!e&&!L(e,t)}function J(e){return P(e.value,e.fallback)?k`<button
    type="button"
    class="fp3d-colour-reset"
    title=${e.label}
    aria-label=${e.label}
    ?disabled=${e.disabled}
    @click=${t=>{t.preventDefault(),t.stopPropagation(),e.onReset()}}
  >
    ↺
  </button>`:_}var T=u`
  .fp3d-colour-reset {
    flex: none;
    border: none;
    background: none;
    color: var(--fp3d-muted, #8aa0b8);
    cursor: pointer;
    font: inherit;
    font-size: 15px;
    line-height: 1;
    padding: 4px 5px;
    border-radius: 6px;
  }
  .fp3d-colour-reset:hover:not(:disabled),
  .fp3d-colour-reset:focus-visible {
    color: var(--fp3d-accent, #37e0ff);
  }
  .fp3d-colour-reset:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;var z={1:4,2:8,3:12,4:16,5:20,6:24,8:32},E={control:6,card:8,pill:999},j={section:18,card:15,body:14,hint:12,label:12},U=44;function $(){let e=[];for(let[t,n]of Object.entries(z))e.push(`--fp3d-space-${t}: ${n}px;`);for(let[t,n]of Object.entries(E))e.push(`--fp3d-radius-${t}: ${n}px;`);for(let[t,n]of Object.entries(j))e.push(`--fp3d-type-${t}: ${n}px;`);return e.push(`--fp3d-touch: ${U}px;`),e.join(`
`)}var h={natural:!0,signal:!0,shadows:!0,floors:1,cutDark:!0,sun:.45,ao:.45},b=[{id:"neon",base:"neon",group:"neon",aliases:["neon","standard"]},{id:"blueprint",base:"blueprint",group:"neon",aliases:["blueprint","high contrast","contrast"]},{id:"day",base:"day",group:"neon",aliases:["day","light"]},{id:"focus",base:"neon",group:"neon",palette:{line:"#394150",dark:"#07090d",light:"#2c313a",hue:0,lift:.05,contrast:2.5},signal:!0,sun:.2,bg:["#030407","#0b0e14"],aliases:["focus","night","dark"]},{id:"synthwave",base:"neon",group:"neon",palette:{line:"#ff3fd2",dark:"#12051f",light:"#3a1460",hue:.2,lift:.05,contrast:2.5},signal:!0,sun:.2,bg:["#08010f","#2a0838"],aliases:["synthwave","synth","retro","party"]},{id:"realistic",base:"realistic",group:"homely",aliases:["realistic","real","photo"]},{id:"cozy",base:"day",group:"homely",...h,palette:null,bg:["#f1efeb","#d9d5ce"],aliases:["cozy","cosy","homely"]},{id:"evening",base:"neon",group:"homely",...h,sun:.4,dim:.75,bg:["#14161c","#272630"],aliases:["evening","cozy evening","cosy evening","homely evening"]},{id:"winter",base:"neon",group:"homely",...h,sun:.4,dim:.8,bg:["#0b1322","#1d2a40"],aliases:["winter","winter evening","christmas"]},{id:"model",base:"day",group:"designed",palette:{line:"#8a8f98",dark:"#cfcac2",light:"#fbfaf7",hue:.08,lift:.35,contrast:3.2},signal:!0,sun:.3,ao:.3,shadows:!0,bg:["#eeece8","#d6d2cb"],aliases:["model","architectural model","architect","white"]},{id:"pastel",base:"day",group:"designed",palette:{line:"#3b3f5c",dark:"#b7c4e6",light:"#fff4ea",hue:.55,lift:.3,contrast:3},signal:!0,sun:.25,ao:.2,shadows:!0,bg:["#f4efe8","#e3e7f2"],aliases:["pastel","colourful","colorful","kids"]},{id:"warm",base:"day",group:"designed",palette:{line:"#5a4632",dark:"#b0906c",light:"#f4ead9",hue:.15,lift:.3,contrast:3},signal:!0,sun:.3,ao:.3,shadows:!0,bg:["#f0e7d7","#d9cbb3"],aliases:["warm","wood","paper","wood and paper"]}],te=b.map(e=>e.id),H=new Map(b.map(e=>[e.id,e]));function M(e){return typeof e=="string"&&/^my_[a-z0-9]{1,24}$/i.test(e)}var c=[],N=40,Y=/^#[0-9a-f]{6}$/i,l=(e,t,n,r)=>typeof e=="number"&&Number.isFinite(e)?Math.min(n,Math.max(t,e)):r,f=(e,t)=>typeof e=="string"&&Y.test(e)?e:t;function G(e){let t=e;if(!t||typeof t!="object"||!M(t.id)||typeof t.name!="string"||!t.name.trim())return null;let n={id:t.id,name:t.name.trim().slice(0,40),base:t.base==="day"||t.base==="blueprint"||t.base==="realistic"?t.base:"neon"},r=t.palette;r&&typeof r=="object"&&!t.natural&&(n.palette={line:f(r.line,"#8a8f98"),dark:f(r.dark,"#202020"),light:f(r.light,"#f0f0f0"),hue:l(r.hue,0,1,0),lift:l(r.lift,0,.6,.2),contrast:l(r.contrast,.5,4,2.5)}),t.natural&&(n.natural=!0,n.floors=l(t.floors,0,1,1),n.cutDark=t.cutDark!==!1,n.dim=l(t.dim,0,.9,0)),n.signal=t.signal!==!1,n.shadows=t.shadows!==!1,n.sun=l(t.sun,0,.7,.3),n.ao=l(t.ao,0,.7,0);let o=t.bg;return Array.isArray(o)&&o.length===2&&(n.bg=[f(o[0],"#202020"),f(o[1],"#101010")]),n}function ne(e){let t=new Set;c=[];for(let n of Array.isArray(e)?e.slice(0,N):[]){let r=G(n);!r||t.has(r.id)||(t.add(r.id),c.push({...r,group:"custom",aliases:[r.name]}))}}var F=["neon","homely","designed","custom"];function re(e={}){let t=[];e.none&&t.push({group:"none",values:[""]});let n=[...e.theme?["theme"]:[],...e.auto?["auto"]:[],...e.house?["house"]:[]];n.length&&t.push({group:"auto",values:n});for(let r of F){let o=C().filter(i=>i.group===r).map(i=>i.id);o.length&&t.push({group:r,values:o})}return t}function C(){return c.length?[...b,...c]:b}function V(e){return e?H.get(e)??c.find(t=>t.id===e):void 0}function m(e){let t=/^(\d{1,2}):(\d{2})$/.exec(e?.trim()??"");if(!t)return null;let n=Number(t[1]),r=Number(t[2]);return n<24&&r<60?n*60+r:null}function B(e,t,n){let r=t.getHours()*60+t.getMinutes(),o=m(e?.style_morning_at)??420,i=m(e?.style_evening_at)??1080,a=m(e?.style_night_at)??1380,d=a>o?r>=a||r<o:r>=a&&r<o;return(e?.style_switch??"sun")==="sun"&&n!==null?n?"day":t.getHours()<12||d?"night":"evening":d?"night":r>=i||a<o&&r<a?"evening":"day"}function g(e){return e.toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g,"")}function K(e,t={}){if(!e)return null;let n=g(e);if(!n)return null;for(let r of C())if(g(r.id)===n||r.aliases.some(o=>g(o)===n)||(t[r.id]??[]).some(o=>g(o)===n))return r.id;return null}function oe(e){let t=s=>V(s)?s:null,n=t(e.override);if(n)return n;let r=K(e.entityState,e.names);if(r)return r;let o=e.choice||"theme";if(o==="auto")return e.sunUp===!0?"day":"neon";let i=(s,v,I,A)=>{let S=B(A,e.now,e.sunUp);return S==="night"?I??v??s??"neon":S==="evening"?v??s??"neon":s??"neon"};if(o==="house"){let s=e.plan;return i(t(s?.style_day),t(s?.style_evening),t(s?.style_night),s)}let a=t(o)??(e.darkMode===!1?"day":"neon"),d=t(e.evening),w=t(e.night);return d||w?i(a,d,w,e.plan):a}var y={bg:"#070b14",bg2:"#0d1424",chrome:"rgba(15, 23, 42, 0.88)",chromeSolid:"#0f172a",line:"rgba(148, 163, 184, 0.2)",text:"#e2e8f0",muted:"#94a3b8",accent:"#48cdeb",accentText:"#041018",panel:"#1e293b",primary:"#1e6ebc",primaryText:"#ffffff",link:"#5d97cf",soft:"#5b7cff",warm:"#ffb547",danger:"#ff6b8b",warning:"#fbbf24",success:"#4ade80",shadow:"0 8px 30px rgba(0, 0, 0, 0.5)",colorScheme:"dark"},D={bg:"#eef2f8",bg2:"#e3e9f2",chrome:"rgba(255, 255, 255, 0.9)",chromeSolid:"#ffffff",line:"rgba(15, 23, 42, 0.16)",text:"#1a1a1a",muted:"#58667a",accent:"#1c67b1",accentText:"#ffffff",panel:"#e2e8f0",primary:"#1e6ebc",primaryText:"#ffffff",link:"#1c67b1",soft:"#3d5bd9",warm:"#a35f00",danger:"#c4224a",warning:"#92400e",success:"#166534",shadow:"0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 28px -10px rgba(14, 37, 66, 0.14)",colorScheme:"light"},O={bg:"#000000",bg2:"#050a14",chrome:"rgba(0, 0, 0, 0.94)",chromeSolid:"#000000",line:"rgba(255, 255, 255, 0.7)",text:"#ffffff",muted:"#dbe4f5",accent:"#ffe14d",accentText:"#000000",panel:"#111111",primary:"#ffe14d",primaryText:"#000000",link:"#9db4ff",soft:"#9db4ff",warm:"#ffc247",danger:"#ff8fa8",warning:"#ffc247",success:"#7ee8a6",shadow:"0 0 0 1px rgba(255, 255, 255, 0.5)",colorScheme:"dark"};function x(e){let t=n=>n.replace(/[A-Z]/g,r=>`-${r.toLowerCase()}`);return Object.entries(e).map(([n,r])=>`--fp3d-s-${t(n)}: ${r};`).join(`
`)}var R=e=>e.replace(/[A-Z]/g,t=>`-${t.toLowerCase()}`),X=Object.keys(y).filter(e=>e!=="colorScheme").map(e=>`--fp3d-${R(e)}: var(--fp3d-s-${R(e)}, ${y[e]});`).join(`
`),Z=$(),ce=u`
  :host {
    ${p(X)}
    ${p(Z)}
    --fp3d-font: "Figtree", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --fp3d-title-font: "Bricolage Grotesque", "Figtree", system-ui, sans-serif;
    color-scheme: var(--fp3d-s-color-scheme, dark);
    font-family: var(--fp3d-font);
    color: var(--fp3d-text);
  }
  :host([light]) {
    ${p(x(D))}
  }
  :host([contrast]) {
    ${p(x(O))}
  }
`,ge=u`
  .fp3d-seg {
    display: inline-flex;
    padding: 3px;
    gap: 2px;
    border-radius: 999px;
    background: var(--fp3d-chrome);
    box-shadow: var(--fp3d-shadow);
  }
  .fp3d-seg button,
  .fp3d-chip {
    font: inherit;
    font-weight: 500;
    border: none;
    background: none;
    color: var(--fp3d-muted);
    padding: 7px 13px;
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
    min-height: 34px;
  }
  /* a chosen choice is a fill: the primary blue with its own text (#246); cyan stays for text, icons and outlines */
  .fp3d-seg button[aria-pressed="true"],
  .fp3d-chip[aria-pressed="true"] {
    background: var(--fp3d-primary);
    color: var(--fp3d-primary-text);
  }
  .fp3d-seg button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .fp3d-chip {
    background: var(--fp3d-chrome);
    color: var(--fp3d-text);
    box-shadow: var(--fp3d-shadow);
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--fp3d-accent);
    outline-offset: 2px;
  }
  .fp3d-btn {
    font: inherit;
    font-weight: 600;
    border: 1px solid var(--fp3d-line);
    background: rgba(55, 224, 255, 0.06);
    color: var(--fp3d-text);
    border-radius: 10px;
    padding: 7px 12px;
    cursor: pointer;
    min-height: 34px;
  }
  .fp3d-btn:hover {
    border-color: var(--fp3d-accent);
  }
  /* a link or a file label drawn as a button centres its text like a real button does (#236) */
  a.fp3d-btn,
  label.fp3d-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    text-decoration: none;
    line-height: 1.2;
  }
  /* buttons under a hint line or a form get room above them (#236) */
  .fp3d-sub + .fp3d-actions,
  .fp3d-sub + .fp3d-ext-actions {
    margin-top: 12px;
  }
  .fp3d-form + .fp3d-actions {
    margin-top: 12px;
  }
  .fp3d-help .fp3d-btn,
  .fp3d-ext-actions .fp3d-btn {
    padding: 8px 16px;
  }
  .fp3d-btn.fp3d-danger {
    color: var(--fp3d-danger);
  }
  .fp3d-btn.fp3d-primary {
    background: var(--fp3d-primary);
    color: var(--fp3d-primary-text);
    border-color: transparent;
  }
  .fp3d-field {
    display: grid;
    gap: 4px;
    font-size: 12px;
    color: var(--fp3d-muted);
  }
  .fp3d-field input,
  .fp3d-field select {
    font: inherit;
    font-size: 14px;
    color: var(--fp3d-text);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--fp3d-line);
    border-radius: 8px;
    padding: 7px 9px;
    min-width: 0;
  }
  .fp3d-field input[type="range"] {
    padding: 0;
    accent-color: var(--fp3d-primary);
  }
  input[type="checkbox"],
  input[type="radio"] {
    accent-color: var(--fp3d-primary);
  }
  /* a round colour swatch to pick (#12) */
  .fp3d-swatch {
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.35);
    cursor: pointer;
  }
  .fp3d-swatch[aria-pressed="true"] {
    border-color: var(--fp3d-accent, #37e0ff);
    box-shadow: 0 0 0 2px var(--fp3d-accent, #37e0ff);
  }
  /* a picker with its reset (#230) on a line of its own: the swatch takes the width */
  .fp3d-colour-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .fp3d-field select option,
  select option {
    /* the opened list keeps the dark look (else light text on the browser's white list) */
    background: var(--fp3d-chrome-solid);
    color: var(--fp3d-text);
  }
  /* a list to edit line by line (a module's sentences): ✕ per line, a field to add one */
  .fp3d-lines {
    display: grid;
    gap: 4px;
    font-size: 12px;
    color: var(--fp3d-muted);
  }
  .fp3d-lines-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 4px 4px 9px;
    border: 1px solid var(--fp3d-line);
    border-radius: 8px;
    font-size: 14px;
    color: var(--fp3d-text);
  }
  .fp3d-lines-row span {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .fp3d-lines-row button {
    border: 0;
    background: none;
    color: var(--fp3d-muted);
    font: inherit;
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 6px;
  }
  .fp3d-lines-row button:hover:not(:disabled) {
    color: var(--fp3d-danger);
  }
  .fp3d-lines-add {
    display: flex;
    gap: 6px;
  }
  .fp3d-lines-add input {
    flex: 1;
    min-width: 0;
    font: inherit;
    font-size: 14px;
    color: var(--fp3d-text);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--fp3d-line);
    border-radius: 8px;
    padding: 7px 9px;
  }
  /* fingers need 44 px (#181, the --fp3d-touch token #246): buttons, chips, fields and swatches */
  @media (pointer: coarse) {
    .fp3d-seg button,
    .fp3d-chip,
    .fp3d-btn,
    .fp3d-field select,
    .fp3d-field input:not([type="checkbox"]):not([type="radio"]):not([type="range"]) {
      min-height: var(--fp3d-touch, 44px);
    }
    .fp3d-seg button,
    .fp3d-btn {
      min-width: var(--fp3d-touch, 44px);
    }
    .fp3d-swatch {
      width: var(--fp3d-touch, 44px);
      height: var(--fp3d-touch, 44px);
    }
  }
  ${T}
`;export{te as a,M as b,ne as c,re as d,V as e,oe as f,W as g,J as h,ce as i,ge as j};
