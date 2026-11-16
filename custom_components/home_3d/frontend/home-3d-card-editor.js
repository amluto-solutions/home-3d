var et=Symbol.for("home-3d.custom-elements"),be=Symbol.for("home-3d.build"),tt=["home-3d-panel","home-3d-card"],G=typeof __FP3D_BUILD__=="string"?__FP3D_BUILD__:"dev",k;function Y(){let n=globalThis;return n[et]??={defined:new Map,watching:!1}}function st(){if(k!==void 0)return k;if(G==="dev")return k=!0;let n=globalThis,e=n[be];if(e!==void 0)return k=e===G;let t=globalThis.customElements;return Y().defined.size>0||tt.some(o=>t?.get(o)||ve(o,void 0))?k=!1:(n[be]=G,k=!0)}function $e(){let n=globalThis.customElements;if(n){for(let[e,t]of Y().defined)if(t.registry!==n&&(t.registry=n,!n.get(e)))try{n.define(e,t.cls)}catch(s){console.warn(`Home 3D: could not define ${e} in the page's element registry`,s)}}}function ve(n,e){if(typeof document>"u")return;let t;try{t=document.createElement(n)}catch{return}if(Object.getPrototypeOf(t)===HTMLElement.prototype||t instanceof HTMLUnknownElement||!(t instanceof HTMLElement))return;let o=t.constructor;return o===e?void 0:o}function xe(n,e){if(!st())return!1;$e();let t=globalThis.customElements;if(t.get(n))return!1;let s=Y(),o=ve(n,e);if(o){try{t.define(n,o),s.defined.set(n,{cls:o,registry:t})}catch(i){console.warn(`Home 3D: could not define ${n} in the page's element registry`,i)}return!1}return t.define(n,e),s.defined.set(n,{cls:e,registry:t}),s.watching||(s.watching=!0,t.whenDefined("home-assistant").then($e)),!0}var W=globalThis,F=W.ShadowRoot&&(W.ShadyCSS===void 0||W.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,J=Symbol(),Se=new WeakMap,P=class{constructor(e,t,s){if(this._$cssResult$=!0,s!==J)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,t=this.t;if(F&&e===void 0){let s=t!==void 0&&t.length===1;s&&(e=Se.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),s&&Se.set(t,e))}return e}toString(){return this.cssText}},ke=n=>new P(typeof n=="string"?n:n+"",void 0,J),C=(n,...e)=>{let t=n.length===1?n[0]:e.reduce((s,o,i)=>s+(r=>{if(r._$cssResult$===!0)return r.cssText;if(typeof r=="number")return r;throw Error("Value passed to 'css' function must be a 'css' function result: "+r+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(o)+n[i+1],n[0]);return new P(t,n,J)},we=(n,e)=>{if(F)n.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(let t of e){let s=document.createElement("style"),o=W.litNonce;o!==void 0&&s.setAttribute("nonce",o),s.textContent=t.cssText,n.appendChild(s)}},Z=F?n=>n:n=>n instanceof CSSStyleSheet?(e=>{let t="";for(let s of e.cssRules)t+=s.cssText;return ke(t)})(n):n;var{is:nt,defineProperty:ot,getOwnPropertyDescriptor:it,getOwnPropertyNames:rt,getOwnPropertySymbols:at,getPrototypeOf:lt}=Object,B=globalThis,Ae=B.trustedTypes,ct=Ae?Ae.emptyScript:"",dt=B.reactiveElementPolyfillSupport,H=(n,e)=>n,Q={toAttribute(n,e){switch(e){case Boolean:n=n?ct:null;break;case Object:case Array:n=n==null?n:JSON.stringify(n)}return n},fromAttribute(n,e){let t=n;switch(e){case Boolean:t=n!==null;break;case Number:t=n===null?null:Number(n);break;case Object:case Array:try{t=JSON.parse(n)}catch{t=null}}return t}},Pe=(n,e)=>!nt(n,e),Ee={attribute:!0,type:String,converter:Q,reflect:!1,useDefault:!1,hasChanged:Pe};Symbol.metadata??=Symbol("metadata"),B.litPropertyMetadata??=new WeakMap;var g=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=Ee){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){let s=Symbol(),o=this.getPropertyDescriptor(e,s,t);o!==void 0&&ot(this.prototype,e,o)}}static getPropertyDescriptor(e,t,s){let{get:o,set:i}=it(this.prototype,e)??{get(){return this[t]},set(r){this[t]=r}};return{get:o,set(r){let a=o?.call(this);i?.call(this,r),this.requestUpdate(e,a,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??Ee}static _$Ei(){if(this.hasOwnProperty(H("elementProperties")))return;let e=lt(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(H("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(H("properties"))){let t=this.properties,s=[...rt(t),...at(t)];for(let o of s)this.createProperty(o,t[o])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[s,o]of t)this.elementProperties.set(s,o)}this._$Eh=new Map;for(let[t,s]of this.elementProperties){let o=this._$Eu(t,s);o!==void 0&&this._$Eh.set(o,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let s=new Set(e.flat(1/0).reverse());for(let o of s)t.unshift(Z(o))}else e!==void 0&&t.push(Z(e));return t}static _$Eu(e,t){let s=t.attribute;return s===!1?void 0:typeof s=="string"?s:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,t=this.constructor.elementProperties;for(let s of t.keys())this.hasOwnProperty(s)&&(e.set(s,this[s]),delete this[s]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return we(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,s){this._$AK(e,s)}_$ET(e,t){let s=this.constructor.elementProperties.get(e),o=this.constructor._$Eu(e,s);if(o!==void 0&&s.reflect===!0){let i=(s.converter?.toAttribute!==void 0?s.converter:Q).toAttribute(t,s.type);this._$Em=e,i==null?this.removeAttribute(o):this.setAttribute(o,i),this._$Em=null}}_$AK(e,t){let s=this.constructor,o=s._$Eh.get(e);if(o!==void 0&&this._$Em!==o){let i=s.getPropertyOptions(o),r=typeof i.converter=="function"?{fromAttribute:i.converter}:i.converter?.fromAttribute!==void 0?i.converter:Q;this._$Em=o;let a=r.fromAttribute(t,i.type);this[o]=a??this._$Ej?.get(o)??a,this._$Em=null}}requestUpdate(e,t,s,o=!1,i){if(e!==void 0){let r=this.constructor;if(o===!1&&(i=this[e]),s??=r.getPropertyOptions(e),!((s.hasChanged??Pe)(i,t)||s.useDefault&&s.reflect&&i===this._$Ej?.get(e)&&!this.hasAttribute(r._$Eu(e,s))))return;this.C(e,t,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,t,{useDefault:s,reflect:o,wrapped:i},r){s&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,r??t??this[e]),i!==!0||r!==void 0)||(this._$AL.has(e)||(this.hasUpdated||s||(t=void 0),this._$AL.set(e,t)),o===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[o,i]of this._$Ep)this[o]=i;this._$Ep=void 0}let s=this.constructor.elementProperties;if(s.size>0)for(let[o,i]of s){let{wrapped:r}=i,a=this[o];r!==!0||this._$AL.has(o)||a===void 0||this.C(o,void 0,i,a)}}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(s=>s.hostUpdate?.()),this.update(t)):this._$EM()}catch(s){throw e=!1,this._$EM(),s}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(e){}firstUpdated(e){}};g.elementStyles=[],g.shadowRootOptions={mode:"open"},g[H("elementProperties")]=new Map,g[H("finalized")]=new Map,dt?.({ReactiveElement:g}),(B.reactiveElementVersions??=[]).push("2.1.2");var ie=globalThis,Ce=n=>n,j=ie.trustedTypes,He=j?j.createPolicy("lit-html",{createHTML:n=>n}):void 0,Oe="$lit$",_=`lit$${Math.random().toFixed(9).slice(2)}$`,Ue="?"+_,ht=`<${Ue}>`,v=document,L=()=>v.createComment(""),M=n=>n===null||typeof n!="object"&&typeof n!="function",re=Array.isArray,ut=n=>re(n)||typeof n?.[Symbol.iterator]=="function",X=`[ 	
\f\r]`,T=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Te=/-->/g,Le=/>/g,b=RegExp(`>|${X}(?:([^\\s"'>=/]+)(${X}*=${X}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Me=/'/g,Ie=/"/g,ze=/^(?:script|style|textarea|title)$/i,ae=n=>(e,...t)=>({_$litType$:n,strings:e,values:t}),h=ae(1),Rt=ae(2),Ot=ae(3),x=Symbol.for("lit-noChange"),d=Symbol.for("lit-nothing"),Re=new WeakMap,$=v.createTreeWalker(v,129);function Ne(n,e){if(!re(n)||!n.hasOwnProperty("raw"))throw Error("invalid template strings array");return He!==void 0?He.createHTML(e):e}var pt=(n,e)=>{let t=n.length-1,s=[],o,i=e===2?"<svg>":e===3?"<math>":"",r=T;for(let a=0;a<t;a++){let c=n[a],l,p,u=-1,m=0;for(;m<c.length&&(r.lastIndex=m,p=r.exec(c),p!==null);)m=r.lastIndex,r===T?p[1]==="!--"?r=Te:p[1]!==void 0?r=Le:p[2]!==void 0?(ze.test(p[2])&&(o=RegExp("</"+p[2],"g")),r=b):p[3]!==void 0&&(r=b):r===b?p[0]===">"?(r=o??T,u=-1):p[1]===void 0?u=-2:(u=r.lastIndex-p[2].length,l=p[1],r=p[3]===void 0?b:p[3]==='"'?Ie:Me):r===Ie||r===Me?r=b:r===Te||r===Le?r=T:(r=b,o=void 0);let f=r===b&&n[a+1].startsWith("/>")?" ":"";i+=r===T?c+ht:u>=0?(s.push(l),c.slice(0,u)+Oe+c.slice(u)+_+f):c+_+(u===-2?a:f)}return[Ne(n,i+(n[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),s]},I=class n{constructor({strings:e,_$litType$:t},s){let o;this.parts=[];let i=0,r=0,a=e.length-1,c=this.parts,[l,p]=pt(e,t);if(this.el=n.createElement(l,s),$.currentNode=this.el.content,t===2||t===3){let u=this.el.content.firstChild;u.replaceWith(...u.childNodes)}for(;(o=$.nextNode())!==null&&c.length<a;){if(o.nodeType===1){if(o.hasAttributes())for(let u of o.getAttributeNames())if(u.endsWith(Oe)){let m=p[r++],f=o.getAttribute(u).split(_),D=/([.?@])?(.*)/.exec(m);c.push({type:1,index:i,name:D[2],strings:f,ctor:D[1]==="."?te:D[1]==="?"?se:D[1]==="@"?ne:A}),o.removeAttribute(u)}else u.startsWith(_)&&(c.push({type:6,index:i}),o.removeAttribute(u));if(ze.test(o.tagName)){let u=o.textContent.split(_),m=u.length-1;if(m>0){o.textContent=j?j.emptyScript:"";for(let f=0;f<m;f++)o.append(u[f],L()),$.nextNode(),c.push({type:2,index:++i});o.append(u[m],L())}}}else if(o.nodeType===8)if(o.data===Ue)c.push({type:2,index:i});else{let u=-1;for(;(u=o.data.indexOf(_,u+1))!==-1;)c.push({type:7,index:i}),u+=_.length-1}i++}}static createElement(e,t){let s=v.createElement("template");return s.innerHTML=e,s}};function w(n,e,t=n,s){if(e===x)return e;let o=s!==void 0?t._$Co?.[s]:t._$Cl,i=M(e)?void 0:e._$litDirective$;return o?.constructor!==i&&(o?._$AO?.(!1),i===void 0?o=void 0:(o=new i(n),o._$AT(n,t,s)),s!==void 0?(t._$Co??=[])[s]=o:t._$Cl=o),o!==void 0&&(e=w(n,o._$AS(n,e.values),o,s)),e}var ee=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:s}=this._$AD,o=(e?.creationScope??v).importNode(t,!0);$.currentNode=o;let i=$.nextNode(),r=0,a=0,c=s[0];for(;c!==void 0;){if(r===c.index){let l;c.type===2?l=new R(i,i.nextSibling,this,e):c.type===1?l=new c.ctor(i,c.name,c.strings,this,e):c.type===6&&(l=new oe(i,this,e)),this._$AV.push(l),c=s[++a]}r!==c?.index&&(i=$.nextNode(),r++)}return $.currentNode=v,o}p(e){let t=0;for(let s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(e,s,t),t+=s.strings.length-2):s._$AI(e[t])),t++}},R=class n{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,s,o){this.type=2,this._$AH=d,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=s,this.options=o,this._$Cv=o?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=w(this,e,t),M(e)?e===d||e==null||e===""?(this._$AH!==d&&this._$AR(),this._$AH=d):e!==this._$AH&&e!==x&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):ut(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==d&&M(this._$AH)?this._$AA.nextSibling.data=e:this.T(v.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:s}=e,o=typeof s=="number"?this._$AC(e):(s.el===void 0&&(s.el=I.createElement(Ne(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===o)this._$AH.p(t);else{let i=new ee(o,this),r=i.u(this.options);i.p(t),this.T(r),this._$AH=i}}_$AC(e){let t=Re.get(e.strings);return t===void 0&&Re.set(e.strings,t=new I(e)),t}k(e){re(this._$AH)||(this._$AH=[],this._$AR());let t=this._$AH,s,o=0;for(let i of e)o===t.length?t.push(s=new n(this.O(L()),this.O(L()),this,this.options)):s=t[o],s._$AI(i),o++;o<t.length&&(this._$AR(s&&s._$AB.nextSibling,o),t.length=o)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){let s=Ce(e).nextSibling;Ce(e).remove(),e=s}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},A=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,s,o,i){this.type=1,this._$AH=d,this._$AN=void 0,this.element=e,this.name=t,this._$AM=o,this.options=i,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=d}_$AI(e,t=this,s,o){let i=this.strings,r=!1;if(i===void 0)e=w(this,e,t,0),r=!M(e)||e!==this._$AH&&e!==x,r&&(this._$AH=e);else{let a=e,c,l;for(e=i[0],c=0;c<i.length-1;c++)l=w(this,a[s+c],t,c),l===x&&(l=this._$AH[c]),r||=!M(l)||l!==this._$AH[c],l===d?e=d:e!==d&&(e+=(l??"")+i[c+1]),this._$AH[c]=l}r&&!o&&this.j(e)}j(e){e===d?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},te=class extends A{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===d?void 0:e}},se=class extends A{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==d)}},ne=class extends A{constructor(e,t,s,o,i){super(e,t,s,o,i),this.type=5}_$AI(e,t=this){if((e=w(this,e,t,0)??d)===x)return;let s=this._$AH,o=e===d&&s!==d||e.capture!==s.capture||e.once!==s.once||e.passive!==s.passive,i=e!==d&&(s===d||o);o&&this.element.removeEventListener(this.name,this,s),i&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},oe=class{constructor(e,t,s){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(e){w(this,e)}};var mt=ie.litHtmlPolyfillSupport;mt?.(I,R),(ie.litHtmlVersions??=[]).push("3.3.3");var De=(n,e,t)=>{let s=t?.renderBefore??e,o=s._$litPart$;if(o===void 0){let i=t?.renderBefore??null;s._$litPart$=o=new R(e.insertBefore(L(),i),i,void 0,t??{})}return o._$AI(n),o};var le=globalThis,y=class extends g{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=De(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return x}};y._$litElement$=!0,y.finalized=!0,le.litElementHydrateSupport?.({LitElement:y});var gt=le.litElementPolyfillSupport;gt?.({LitElement:y});(le.litElementVersions??=[]).push("4.2.2");var ft=n=>n?{home_id:n}:{};async function We(n,e){return n.callWS({type:"home_3d/building/get",...ft(e)})}function Fe(n){return n.callWS({type:"home_3d/homes/list"})}var ce="#48cdeb";function _t(n,e){return(n??"").trim().toLowerCase()===(e??"").trim().toLowerCase()}function yt(n,e){return!!n&&!_t(n,e)}function Be(n){return yt(n.value,n.fallback)?h`<button
    type="button"
    class="fp3d-colour-reset"
    title=${n.label}
    aria-label=${n.label}
    ?disabled=${n.disabled}
    @click=${e=>{e.preventDefault(),e.stopPropagation(),n.onReset()}}
  >
    ↺
  </button>`:d}var je=C`
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
`;function Ke(n){let e=t=>n.onChange(t.detail.value);return h`<fp3d-colour-field .value=${n.value??null} .label=${n.label} .t=${n.t} .base=${n.base??null} ?clearable=${!!n.clearable} ?disabled=${!!n.disabled} @colour-change=${n.live?null:e} @colour-input=${n.live?e:null} ?menu=${!!n.onMenu} ?expanded=${!!n.expanded} @colour-menu=${n.onMenu??null}></fp3d-colour-field>`}var de=["pool"];function he(){try{let n=new URLSearchParams(location.search).get("fp3d_lab");return n==="1"?localStorage.setItem("home3d.lab","1"):n==="0"&&localStorage.removeItem("home3d.lab"),localStorage.getItem("home3d.lab")==="1"}catch{return!1}}var O=["view","walls","floors","temperature","humidity","co2"];var E=globalThis.__fp3dLanguages??={extra:new Map,pending:new Map},{extra:U,pending:ue}=E;var bt="home3d.language";function $t(n){E.chosen=n&&n!=="auto"&&/^[a-z]{2,3}$/i.test(n)?n.toLowerCase():null}function qe(){if(E.chosen===void 0)try{$t(localStorage.getItem(bt))}catch{E.chosen=null}return E.chosen??null}function K(n){let e=(qe()??n??navigator.language??"en").toLowerCase(),t=e.startsWith("no")?"nb":e.split(/[-_]/)[0];return t==="en"||!/^[a-z]{2,3}$/.test(t)?null:t}function me(n){let e=K(n);return!e||U.has(e)}var pe="home3d.lang.";function vt(n){try{let e=JSON.parse(localStorage.getItem(pe+n)??"null");return e&&typeof e.hash=="string"&&e.strings&&typeof e.strings=="object"?e:null}catch{return null}}function xt(n,e,t){try{Object.keys(t).length?localStorage.setItem(pe+n,JSON.stringify({hash:e,strings:t})):localStorage.removeItem(pe+n)}catch{}}async function St(n,e){if(!e?.callWS)return{};let t=vt(n);try{let s=await e.callWS({type:"home_3d/languages/get",language:n,...t?{hash:t.hash}:{}});return s.strings&&typeof s.strings=="object"?(xt(n,s.hash,s.strings),s.strings):t&&s.hash===t.hash?t.strings:{}}catch{return t?.strings??{}}}function Ve(n,e,t=!1){let s=K(n);if(!s||U.has(s)&&!t)return Promise.resolve();let o=ue.get(s);return o||(o=St(s,e).then(i=>{U.set(s,i)}).finally(()=>ue.delete(s)),ue.set(s,o)),o}function Ge(n){let e=qe()??n?.language??navigator.language??"en",t=K(e);if(!t)return/^en(?:-|$)/i.test(e)?e:"en";let s=U.get(t);for(let o in s)return e;return"en"}function Ye(n,e,t={}){let s=K(n?.language??navigator.language),i=(s?U.get(s):void 0)?.[e]??E.en?.[e]??e;for(let[r,a]of Object.entries(t))i=i.replace(`{${r}}`,String(a));return i}var ge={natural:!0,signal:!0,shadows:!0,floors:1,cutDark:!0,sun:.45,ao:.45},fe=[{id:"neon",base:"neon",group:"neon",aliases:["neon","standard"]},{id:"blueprint",base:"blueprint",group:"neon",aliases:["blueprint","high contrast","contrast"]},{id:"day",base:"day",group:"neon",aliases:["day","light"]},{id:"focus",base:"neon",group:"neon",palette:{line:"#394150",dark:"#07090d",light:"#2c313a",hue:0,lift:.05,contrast:2.5},signal:!0,sun:.2,bg:["#030407","#0b0e14"],aliases:["focus","night","dark"]},{id:"synthwave",base:"neon",group:"neon",palette:{line:"#ff3fd2",dark:"#12051f",light:"#3a1460",hue:.2,lift:.05,contrast:2.5},signal:!0,sun:.2,bg:["#08010f","#2a0838"],aliases:["synthwave","synth","retro","party"]},{id:"realistic",base:"realistic",group:"homely",aliases:["realistic","real","photo"]},{id:"cozy",base:"day",group:"homely",...ge,palette:null,bg:["#f1efeb","#d9d5ce"],aliases:["cozy","cosy","homely"]},{id:"evening",base:"neon",group:"homely",...ge,sun:.4,dim:.75,bg:["#14161c","#272630"],aliases:["evening","cozy evening","cosy evening","homely evening"]},{id:"winter",base:"neon",group:"homely",...ge,sun:.4,dim:.8,bg:["#0b1322","#1d2a40"],aliases:["winter","winter evening","christmas"]},{id:"model",base:"day",group:"designed",palette:{line:"#8a8f98",dark:"#cfcac2",light:"#fbfaf7",hue:.08,lift:.35,contrast:3.2},signal:!0,sun:.3,ao:.3,shadows:!0,bg:["#eeece8","#d6d2cb"],aliases:["model","architectural model","architect","white"]},{id:"pastel",base:"day",group:"designed",palette:{line:"#3b3f5c",dark:"#b7c4e6",light:"#fff4ea",hue:.55,lift:.3,contrast:3},signal:!0,sun:.25,ao:.2,shadows:!0,bg:["#f4efe8","#e3e7f2"],aliases:["pastel","colourful","colorful","kids"]},{id:"warm",base:"day",group:"designed",palette:{line:"#5a4632",dark:"#b0906c",light:"#f4ead9",hue:.15,lift:.3,contrast:3},signal:!0,sun:.3,ao:.3,shadows:!0,bg:["#f0e7d7","#d9cbb3"],aliases:["warm","wood","paper","wood and paper"]}];var kt=new Map(fe.map(n=>[n.id,n]));function Je(n){return typeof n=="string"&&/^my_[a-z0-9]{1,24}$/i.test(n)}var N=[],wt=40,At=/^#[0-9a-f]{6}$/i,S=(n,e,t,s)=>typeof n=="number"&&Number.isFinite(n)?Math.min(t,Math.max(e,n)):s,z=(n,e)=>typeof n=="string"&&At.test(n)?n:e;function Et(n){let e=n;if(!e||typeof e!="object"||!Je(e.id)||typeof e.name!="string"||!e.name.trim())return null;let t={id:e.id,name:e.name.trim().slice(0,40),base:e.base==="day"||e.base==="blueprint"||e.base==="realistic"?e.base:"neon"},s=e.palette;s&&typeof s=="object"&&!e.natural&&(t.palette={line:z(s.line,"#8a8f98"),dark:z(s.dark,"#202020"),light:z(s.light,"#f0f0f0"),hue:S(s.hue,0,1,0),lift:S(s.lift,0,.6,.2),contrast:S(s.contrast,.5,4,2.5)}),e.natural&&(t.natural=!0,t.floors=S(e.floors,0,1,1),t.cutDark=e.cutDark!==!1,t.dim=S(e.dim,0,.9,0)),t.signal=e.signal!==!1,t.shadows=e.shadows!==!1,t.sun=S(e.sun,0,.7,.3),t.ao=S(e.ao,0,.7,0);let o=e.bg;return Array.isArray(o)&&o.length===2&&(t.bg=[z(o[0],"#202020"),z(o[1],"#101010")]),t}function Ze(n){let e=new Set;N=[];for(let t of Array.isArray(n)?n.slice(0,wt):[]){let s=Et(t);!s||e.has(s.id)||(e.add(s.id),N.push({...s,group:"custom",aliases:[s.name]}))}}var Pt=["neon","homely","designed","custom"];function q(n={}){let e=[];n.none&&e.push({group:"none",values:[""]});let t=[...n.theme?["theme"]:[],...n.auto?["auto"]:[],...n.house?["house"]:[]];t.length&&e.push({group:"auto",values:t});for(let s of Pt){let o=Ct().filter(i=>i.group===s).map(i=>i.id);o.length&&e.push({group:s,values:o})}return e}function Ct(){return N.length?[...fe,...N]:fe}function V(n){return n?kt.get(n)??N.find(e=>e.id===n):void 0}var _e=70;function Qe(){return q({none:!0,house:!0}).map(n=>({...n,values:n.values.filter(e=>e!=="realistic")})).filter(n=>n.values.length)}var Xe={height:420,view:"3d",walls:"auto",explode:!0,roof_fade:!0,roof:!0,camera_wall:!1,quality:"auto",stats:!1,markers:"important",heatmap:"none",theme:"theme",energy:!0,room_panel:!0,fill:!1,controls:!1,fullscreen_button:!1,room_names:!0,floor_stack:"dim",alerts:!0,alert_jump:!1,director:!1,voice:!1,scenes:!0,motion_trail:!1,time_travel:!1,household_card:!0,rack_cards:!0,weather:!0,idle_return:0,controls_hidden:!1,controls_hide_after:0,marker_names:!1,central:!0,pets:!0,ghost:!0,night:"off",idle_orbit:!1},ye=class extends y{static properties={hass:{attribute:!1},_config:{state:!0},_floors:{state:!0},_styles:{state:!0}};floorsOf=void 0;homesAsked=!1;constructor(){super(),this._config={type:"custom:home-3d-card"},this._floors=[],this._styles=[],this._homes=[]}setConfig(e){this._config=e}willUpdate(){this.hass&&!me(this.hass.language)&&Ve(this.hass.language,this.hass).then(()=>this.requestUpdate());let e=Ge(this.hass);this.getAttribute("lang")!==e&&this.setAttribute("lang",e);let t=this._config.home??"";this.hass&&this.floorsOf!==t&&(this.floorsOf=t,We(this.hass,t||void 0).then(s=>{this.floorsOf===t&&(this._floors=s.building.floors.map(o=>({id:o.id,name:o.name})),this._styles=s.building.settings?.styles_custom??[])},()=>{})),this.hass&&!this.homesAsked&&(this.homesAsked=!0,Fe(this.hass).then(s=>this._homes=s.homes,()=>{}))}t(e,t){return Ye(this.hass,e,t)}get value(){return{...Xe,...this._config}}set(e,t){let s={...this._config};t===void 0||t===""||Xe[e]===t?delete s[e]:s[e]=t,this._config=s,this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:s},bubbles:!0,composed:!0}))}select(e,t,s,o){return h`<label class="field"
      >${this.t(t)}
      <select @change=${i=>this.set(e,i.target.value)}>
        ${s.map(([i,r])=>h`<option value=${i} ?selected=${i===o}>${this.t(r)}</option>`)}
      </select>
    </label>`}styleSelect(e,t,s,o){Ze(this._styles);let i={theme:"theme_theme",auto:"theme_auto",house:"style_house"},r=l=>{let p=V(l)?.group==="custom"?V(l):void 0,u=l===""?this.t(e==="zoom_style"?"zoom_style_off":"style_none"):i[l]?this.t(i[l]):p?p.name??l:this.t(`style_${l}`);return h`<option value=${l} ?selected=${l===s}>${u}</option>`},a=e==="zoom_style"?Qe():q(o),c=a.some(l=>l.values.includes(s));return h`<label class="field"
      >${this.t(t)}
      <select @change=${l=>this.set(e,l.target.value||void 0)}>
        ${a.map(l=>l.group==="none"||!l.group?l.values.map(r):h`<optgroup label=${this.t(`style_group_${l.group}`)}>${l.values.map(r)}</optgroup>`)}
        ${c?d:h`<option value=${s} selected>${s}</option>`}
      </select>
    </label>`}toggle(e,t,s){let o=this.value[e];return h`<label class="toggle">
      <input type="checkbox" .checked=${o} @change=${i=>this.set(e,i.target.checked)} />
      <span>${this.t(t)}${s?h`<small>${this.t(s)}</small>`:d}</span>
    </label>`}renderThumbsToggle(){let e=!this._config.floor,t=this._config.floor_thumbs??e;return h`<label class="toggle">
      <input
        type="checkbox"
        .checked=${t}
        @change=${s=>{let o=s.target.checked,i={...this._config};o===e?delete i.floor_thumbs:i.floor_thumbs=o,this._config=i,this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:i},bubbles:!0,composed:!0}))}}
      />
      <span>${this.t("card_floor_thumbs")}<small>${this.t(this._config.floor?"card_floor_thumbs_hint_start":"card_floor_thumbs_hint")}</small></span>
    </label>`}renderControls(){let e=this._config.controls,t=!!e&&(e===!0||e.length>0),s=e===!0?[...O]:Array.isArray(e)?e:[],o=a=>this.set("controls",a.length===O.length?!0:a.length?a:void 0),i=this.value,r=[0,10,30,60,120];return h`<label class="toggle">
        <input type="checkbox" .checked=${t} @change=${a=>this.set("controls",a.target.checked?!0:void 0)} />
        <span>${this.t("card_controls")}<small>${this.t("card_controls_hint")}</small></span>
      </label>
      <label class="toggle">
        <input type="checkbox" .checked=${i.central} @change=${a=>this.set("central",a.target.checked?void 0:!1)} />
        <span>${this.t("card_central")}<small>${this.t("card_central_hint")}</small></span>
      </label>
      ${!de.includes("fun_pets")||he()?h`<label class="toggle">
            <input type="checkbox" .checked=${i.pets} @change=${a=>this.set("pets",a.target.checked?void 0:!1)} />
            <span>${this.t("card_pets")}<small>${this.t("card_pets_hint")}</small></span>
          </label>`:d}
      ${!de.includes("fun_halloween")||he()?h`<label class="toggle">
            <input type="checkbox" .checked=${i.ghost} @change=${a=>this.set("ghost",a.target.checked?void 0:!1)} />
            <span>${this.t("card_ghost")}<small>${this.t("card_ghost_hint")}</small></span>
          </label>`:d}
      <label class="toggle">
        <input type="checkbox" .checked=${i.marker_names} @change=${a=>this.set("marker_names",a.target.checked?!0:void 0)} />
        <span>${this.t("card_marker_names")}<small>${this.t("card_marker_names_hint")}</small></span>
      </label>
      <label class="toggle">
        <input type="checkbox" .checked=${i.controls_hidden} @change=${a=>this.set("controls_hidden",a.target.checked?!0:void 0)} />
        <span>${this.t("card_controls_hidden")}<small>${this.t("card_controls_hidden_hint")}</small></span>
      </label>
      <label class="field"
        >${this.t("card_controls_hide_after")}
        <select @change=${a=>this.set("controls_hide_after",Number(a.target.value)||void 0)}>
          ${r.map(a=>h`<option value=${a} ?selected=${i.controls_hide_after===a}>${a?this.t("card_hide_after_s",{n:a}):this.t("card_idle_off")}</option>`)}
        </select>
      </label>
      ${t?h`<div class="sub">
            ${O.map(a=>h`<label class="chip">
                <input
                  type="checkbox"
                  .checked=${s.includes(a)}
                  @change=${c=>o(c.target.checked?O.filter(l=>l===a||s.includes(l)):s.filter(l=>l!==a))}
                />
                ${this.t(`card_control_${a}`)}
              </label>`)}
          </div>`:d}`}renderKiosk(){let e=this.value,t=e.night==="off"||e.night==="sun"?e.night:"time",s=[0,1,2,5,10];return h`<h3>${this.t("card_section_kiosk")}</h3>
      <div class="grid">
        <label class="field"
          >${this.t("card_idle_return")}
          <select @change=${o=>this.set("idle_return",Number(o.target.value)||void 0)}>
            ${s.map(o=>h`<option value=${o*60} ?selected=${e.idle_return===o*60}>${o?this.t("card_idle_min",{n:o}):this.t("card_idle_off")}</option>`)}
          </select>
        </label>
        <label class="field"
          >${this.t("card_night")}
          <select @change=${o=>this.set("night",{off:void 0,sun:"sun",time:"22:00-06:00"}[o.target.value])}>
            <option value="off" ?selected=${t==="off"}>${this.t("card_night_off")}</option>
            <option value="sun" ?selected=${t==="sun"}>${this.t("card_night_sun")}</option>
            <option value="time" ?selected=${t==="time"}>${this.t("card_night_time")}</option>
          </select>
        </label>
        ${t==="time"?h`<label class="field wide"
              >${this.t("card_night_range")}
              <input
                type="text"
                pattern="\\d{1,2}:\\d{2}-\\d{1,2}:\\d{2}"
                placeholder="22:00-06:00"
                .value=${e.night}
                @change=${o=>this.set("night",o.target.value.trim()||void 0)}
              />
            </label>`:d}
      </div>
      <p class="hint">${this.t("card_idle_hint")}</p>
      ${this.toggle("idle_orbit","card_idle_orbit","card_idle_orbit_hint")}
      <div class="grid">
        <label class="field wide"
          >${this.t("card_dashboard")}
          <input type="text" placeholder="/lovelace/home" .value=${e.dashboard??""} @change=${o=>this.set("dashboard",o.target.value.trim()||void 0)} />
        </label>
        <label class="field wide"
          >${this.t("card_dashboard_label")}
          <input type="text" .value=${e.dashboard_label??""} @change=${o=>this.set("dashboard_label",o.target.value.trim()||void 0)} />
        </label>
      </div>
      <p class="hint">${this.t("card_dashboard_hint")}</p>`}renderFeatures(){let e=this.value,t=Object.keys(this.hass?.states??{}).filter(s=>s.startsWith("weather.")).sort();return h`<h3>${this.t("card_section_features")}</h3>
      ${this.toggle("alerts","card_alerts","card_alerts_hint")} ${this.toggle("alert_jump","card_alert_jump","card_alert_jump_hint")}
      ${this.toggle("director","card_director","card_director_hint")}
      ${this.toggle("voice","card_voice","card_voice_hint")}
      <div class="grid">
        <label class="field wide"
          >${this.t("screen_name")}
          <input type="text" placeholder=${this.t("screen_name_placeholder")} .value=${e.screen??""} @change=${s=>this.set("screen",s.target.value.trim()||void 0)} />
        </label>
      </div>
      <p class="hint">${this.t("screen_name_hint")}</p>
      ${this.toggle("scenes","card_scenes","card_scenes_hint")}
      ${this.toggle("motion_trail","card_motion_trail","card_motion_trail_hint")} ${this.toggle("camera_wall","card_camera_wall","card_camera_wall_hint")}
      ${this.toggle("time_travel","card_time_travel","card_time_travel_hint")}
      ${this.toggle("household_card","card_household","card_household_hint")}
      ${this.toggle("rack_cards","card_rack_cards","card_rack_cards_hint")}
      ${this.toggle("weather","card_weather","card_weather_hint")}
      ${e.weather!==!1?h`<div class="grid">
            <label class="field wide"
              >${this.t("weather_entity")}
              <select @change=${s=>this.set("weather_entity",s.target.value||void 0)}>
                <option value="" ?selected=${!e.weather_entity}>${this.t("card_weather_plan")}</option>
                ${t.map(s=>h`<option value=${s} ?selected=${s===e.weather_entity}>${String(this.hass?.states[s]?.attributes.friendly_name??s)}</option>`)}
              </select>
            </label>
          </div>`:d}`}render(){if(this.hass&&!me(this.hass.language))return d;let e=this.value,t=e.flows===void 0?"switch":e.flows?"on":"off",s=e.holograms===void 0?"switch":e.holograms?"on":"off";return h`
      <h3>${this.t("card_section_view")}</h3>
      <div class="grid">
        ${this._homes.length>1||this._config.home?h`<label class="field wide"
              >${this.t("card_home")}
              <select
                @change=${o=>{this.set("floor",void 0),this.set("room",void 0),this.set("home",o.target.value||void 0)}}
              >
                <option value="" ?selected=${!e.home}>${this.t("card_home_active")}</option>
                ${this._homes.map(o=>h`<option value=${o.id} ?selected=${o.id===e.home}>${o.name}</option>`)}
                ${e.home&&!this._homes.some(o=>o.id===e.home)?h`<option value=${e.home} selected>${e.home}</option>`:d}
              </select>
            </label>`:d}
        <label class="field wide"
          >${this.t("card_floor")}
          <select @change=${o=>this.set("floor",o.target.value||void 0)}>
            <option value="" ?selected=${!e.floor}>${this.t("card_floor_house")}</option>
            ${this._floors.map(o=>h`<option value=${o.id} ?selected=${o.id===e.floor}>${o.name}</option>`)}
            ${e.floor&&!this._floors.some(o=>o.id===e.floor)?h`<option value=${e.floor} selected>${e.floor}</option>`:d}
          </select>
        </label>
        <label class="field"
          >${this.t("card_size")}
          <select @change=${o=>this.set("fill",o.target.value==="fill")}>
            <option value="fixed" ?selected=${!e.fill}>${this.t("card_size_fixed")}</option>
            <option value="fill" ?selected=${e.fill}>${this.t("card_size_fill")}</option>
          </select>
        </label>
        <label class="field" ?hidden=${e.fill}
          >${this.t("card_height")}
          <input
            type="number"
            min="150"
            max="2000"
            step="10"
            .value=${String(e.height)}
            @change=${o=>{let i=Math.round(Number(o.target.value));i>100&&this.set("height",i)}}
          />
        </label>
        ${this.styleSelect("theme","theme",e.theme,{theme:!0,auto:!0,house:!0})}
        ${this.styleSelect("theme_evening","card_theme_evening",this._config.theme_evening??"",{none:!0})}
        ${this.styleSelect("theme_night","card_theme_night",this._config.theme_night??"",{none:!0})}
        <label class="field"
          >${this.t("card_style_entity")}
          <input type="text" placeholder="input_select.style" .value=${this._config.style_entity??""} @change=${o=>this.set("style_entity",o.target.value.trim()||void 0)} />
        </label>
        ${this.styleSelect("zoom_style","zoom_style",this._config.zoom_style??"",{})}
        ${this._config.zoom_style?h`<label class="field" title=${this.t("zoom_late_hint")}
                >${this.t("zoom_late")} (${this.t("zoom_late_early")} … ${this.t("zoom_late_late")})
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  .value=${String(this._config.zoom_late??_e)}
                  @change=${o=>{let i=Math.round(Number(o.target.value));this.set("zoom_late",i===_e?void 0:i)}}
                />
              </label>
              <label class="toggle">
                <input type="checkbox" .checked=${this._config.zoom_scope==="room"} @change=${o=>this.set("zoom_scope",o.target.checked?"room":void 0)} />
                <span>${this.t("zoom_scope_room")}<small>${this.t("zoom_scope_hint")}</small></span>
              </label>
              <p class="hint">${this.t("zoom_style_hint")}</p>`:d}
        ${this.select("clock","clock",[["off","clock_off"],["tl","clock_tl"],["tr","clock_tr"],["bl","clock_bl"],["br","clock_br"]],e.clock??"off")}
        <label class="field"
          >${this.t("accent")}
          <span class="accent-pick"
            >${Ke({value:this._config.accent??null,base:ce,label:this.t("accent"),t:(o,i)=>this.t(o,i),live:!0,onChange:o=>o&&this.set("accent",o)})}
            ${Be({value:this._config.accent,fallback:ce,label:this.t("accent_reset"),onReset:()=>this.set("accent",void 0)})}</span
          >
        </label>
        ${this.select("view","card_view",[["3d","card_view_3d"],["2d","card_view_2d"]],e.view)}
        ${this.select("walls","card_walls",[["auto","walls_auto"],["cut","walls_cut"]],e.walls)}
        ${this.select("quality","quality",[["auto","quality_auto"],["low","quality_low"],["high","quality_high"]],e.quality)}
        ${this.select("floor_stack","card_floor_stack",[["dim","floor_stack_dim"],["stacked","floor_stack_stacked"],["single","floor_stack_single"]],e.floor_stack)}
      </div>
      ${e.fill?h`<p class="hint">${this.t("card_fill_hint")}</p>`:d}
      <p class="hint">${this.t("card_quality_hint")}</p>

      <h3>${this.t("card_section_show")}</h3>
      <div class="grid">
        ${this.select("markers","markers",[["none","markers_none"],["room","markers_room"],["important","markers_important"],["all","markers_all"]],e.markers)}
        ${this.select("marker_size","pin_size",[["small","pin_size_small"],["normal","pin_size_normal"],["large","pin_size_large"]],e.marker_size??"normal")}
        ${this.select("heatmap","heatmap",[["none","heat_off"],["temperature","heat_temperature"],["humidity","heat_humidity"],["co2","heat_co2"],["values","heat_values"]],e.heatmap)}
        <label class="field wide"
          >${this.t("flows")}
          <select @change=${o=>{let i=o.target.value;this.set("flows",i==="switch"?void 0:i==="on")}}>
            <option value="switch" ?selected=${t==="switch"}>${this.t("card_flows_switch")}</option>
            <option value="on" ?selected=${t==="on"}>${this.t("card_flows_on")}</option>
            <option value="off" ?selected=${t==="off"}>${this.t("card_flows_off")}</option>
          </select>
        </label>
        <label class="field wide"
          >${this.t("holos")}
          <select @change=${o=>{let i=o.target.value;this.set("holograms",i==="switch"?void 0:i==="on")}}>
            <option value="switch" ?selected=${s==="switch"}>${this.t("card_flows_switch")}</option>
            <option value="on" ?selected=${s==="on"}>${this.t("card_flows_on")}</option>
            <option value="off" ?selected=${s==="off"}>${this.t("card_flows_off")}</option>
          </select>
        </label>
      </div>
      ${this.renderControls()}
      ${this.renderThumbsToggle()} ${this.toggle("room_names","card_room_names")}
      ${this.toggle("energy","card_energy")} ${this.toggle("room_panel","card_room_panel","card_room_panel_hint")}
      ${this.toggle("fullscreen_button","card_fullscreen_button","card_fullscreen_button_hint")}
      ${this.toggle("explode","card_explode")} ${this.toggle("roof","card_roof","card_roof_hint")} ${this.toggle("roof_fade","card_roof_fade","card_roof_fade_hint")} ${this.toggle("stats","card_stats","card_stats_hint")}
      ${this.renderFeatures()}
      ${this.renderKiosk()}
    `}static styles=C`
    .accent-pick {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    ${je}
    :host {
      display: block;
      color: var(--primary-text-color);
    }
    h3 {
      margin: 18px 0 8px;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--secondary-text-color);
    }
    h3:first-child {
      margin-top: 0;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 12px;
    }
    [hidden] {
      display: none;
    }
    .wide {
      grid-column: 1 / -1;
    }
    .field {
      display: grid;
      gap: 4px;
      font-size: 13px;
      color: var(--secondary-text-color);
    }
    select,
    input[type="number"],
    input[type="text"] {
      box-sizing: border-box;
      width: 100%;
      min-height: 40px;
      padding: 8px 10px;
      border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.4));
      border-radius: 8px;
      background: var(--card-background-color, transparent);
      color: var(--primary-text-color);
      font: inherit;
      font-size: 14px;
    }
    .toggle {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 8px 0;
      font-size: 14px;
      cursor: pointer;
    }
    .toggle input {
      flex: none;
      width: 18px;
      height: 18px;
      margin: 1px 0 0;
      accent-color: var(--primary-color);
    }
    .sub {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 14px;
      margin: -2px 0 6px 28px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      cursor: pointer;
    }
    .chip input {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--primary-color);
    }
    .toggle small,
    .hint {
      display: block;
      margin: 2px 0 0;
      font-size: 12px;
      color: var(--secondary-text-color);
    }
    @media (max-width: 450px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `};xe("home-3d-card-editor",ye);export{ye as Floorplan3dCardEditor};
