var it=Symbol.for("home-3d.custom-elements"),$e=Symbol.for("home-3d.build"),rt=["home-3d-panel","home-3d-card"],G=typeof __FP3D_BUILD__=="string"?__FP3D_BUILD__:"dev",S;function Y(){let s=globalThis;return s[it]??={defined:new Map,watching:!1}}function at(){if(S!==void 0)return S;if(G==="dev")return S=!0;let s=globalThis,e=s[$e];if(e!==void 0)return S=e===G;let n=globalThis.customElements;return Y().defined.size>0||rt.some(o=>n?.get(o)||xe(o,void 0))?S=!1:(s[$e]=G,S=!0)}function ve(){let s=globalThis.customElements;if(s){for(let[e,n]of Y().defined)if(n.registry!==s&&(n.registry=s,!s.get(e)))try{s.define(e,n.cls)}catch(t){console.warn(`Home 3D: could not define ${e} in the page's element registry`,t)}}}function xe(s,e){if(typeof document>"u")return;let n;try{n=document.createElement(s)}catch{return}if(Object.getPrototypeOf(n)===HTMLElement.prototype||n instanceof HTMLUnknownElement||!(n instanceof HTMLElement))return;let o=n.constructor;return o===e?void 0:o}function ke(s,e){if(!at())return!1;ve();let n=globalThis.customElements;if(n.get(s))return!1;let t=Y(),o=xe(s,e);if(o){try{n.define(s,o),t.defined.set(s,{cls:o,registry:n})}catch(i){console.warn(`Home 3D: could not define ${s} in the page's element registry`,i)}return!1}return n.define(s,e),t.defined.set(s,{cls:e,registry:n}),t.watching||(t.watching=!0,n.whenDefined("home-assistant").then(ve)),!0}var W=globalThis,B=W.ShadowRoot&&(W.ShadyCSS===void 0||W.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,J=Symbol(),Se=new WeakMap,E=class{constructor(e,n,t){if(this._$cssResult$=!0,t!==J)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=n}get styleSheet(){let e=this.o,n=this.t;if(B&&e===void 0){let t=n!==void 0&&n.length===1;t&&(e=Se.get(n)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),t&&Se.set(n,e))}return e}toString(){return this.cssText}},we=s=>new E(typeof s=="string"?s:s+"",void 0,J),C=(s,...e)=>{let n=s.length===1?s[0]:e.reduce((t,o,i)=>t+(l=>{if(l._$cssResult$===!0)return l.cssText;if(typeof l=="number")return l;throw Error("Value passed to 'css' function must be a 'css' function result: "+l+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(o)+s[i+1],s[0]);return new E(n,s,J)},Pe=(s,e)=>{if(B)s.adoptedStyleSheets=e.map(n=>n instanceof CSSStyleSheet?n:n.styleSheet);else for(let n of e){let t=document.createElement("style"),o=W.litNonce;o!==void 0&&t.setAttribute("nonce",o),t.textContent=n.cssText,s.appendChild(t)}},X=B?s=>s:s=>s instanceof CSSStyleSheet?(e=>{let n="";for(let t of e.cssRules)n+=t.cssText;return we(n)})(s):s;var{is:lt,defineProperty:ct,getOwnPropertyDescriptor:dt,getOwnPropertyNames:ht,getOwnPropertySymbols:ut,getPrototypeOf:pt}=Object,F=globalThis,Ae=F.trustedTypes,mt=Ae?Ae.emptyScript:"",gt=F.reactiveElementPolyfillSupport,H=(s,e)=>s,Z={toAttribute(s,e){switch(e){case Boolean:s=s?mt:null;break;case Object:case Array:s=s==null?s:JSON.stringify(s)}return s},fromAttribute(s,e){let n=s;switch(e){case Boolean:n=s!==null;break;case Number:n=s===null?null:Number(s);break;case Object:case Array:try{n=JSON.parse(s)}catch{n=null}}return n}},Ce=(s,e)=>!lt(s,e),Ee={attribute:!0,type:String,converter:Z,reflect:!1,useDefault:!1,hasChanged:Ce};Symbol.metadata??=Symbol("metadata"),F.litPropertyMetadata??=new WeakMap;var g=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,n=Ee){if(n.state&&(n.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((n=Object.create(n)).wrapped=!0),this.elementProperties.set(e,n),!n.noAccessor){let t=Symbol(),o=this.getPropertyDescriptor(e,t,n);o!==void 0&&ct(this.prototype,e,o)}}static getPropertyDescriptor(e,n,t){let{get:o,set:i}=dt(this.prototype,e)??{get(){return this[n]},set(l){this[n]=l}};return{get:o,set(l){let r=o?.call(this);i?.call(this,l),this.requestUpdate(e,r,t)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??Ee}static _$Ei(){if(this.hasOwnProperty(H("elementProperties")))return;let e=pt(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(H("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(H("properties"))){let n=this.properties,t=[...ht(n),...ut(n)];for(let o of t)this.createProperty(o,n[o])}let e=this[Symbol.metadata];if(e!==null){let n=litPropertyMetadata.get(e);if(n!==void 0)for(let[t,o]of n)this.elementProperties.set(t,o)}this._$Eh=new Map;for(let[n,t]of this.elementProperties){let o=this._$Eu(n,t);o!==void 0&&this._$Eh.set(o,n)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let n=[];if(Array.isArray(e)){let t=new Set(e.flat(1/0).reverse());for(let o of t)n.unshift(X(o))}else e!==void 0&&n.push(X(e));return n}static _$Eu(e,n){let t=n.attribute;return t===!1?void 0:typeof t=="string"?t:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,n=this.constructor.elementProperties;for(let t of n.keys())this.hasOwnProperty(t)&&(e.set(t,this[t]),delete this[t]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Pe(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,n,t){this._$AK(e,t)}_$ET(e,n){let t=this.constructor.elementProperties.get(e),o=this.constructor._$Eu(e,t);if(o!==void 0&&t.reflect===!0){let i=(t.converter?.toAttribute!==void 0?t.converter:Z).toAttribute(n,t.type);this._$Em=e,i==null?this.removeAttribute(o):this.setAttribute(o,i),this._$Em=null}}_$AK(e,n){let t=this.constructor,o=t._$Eh.get(e);if(o!==void 0&&this._$Em!==o){let i=t.getPropertyOptions(o),l=typeof i.converter=="function"?{fromAttribute:i.converter}:i.converter?.fromAttribute!==void 0?i.converter:Z;this._$Em=o;let r=l.fromAttribute(n,i.type);this[o]=r??this._$Ej?.get(o)??r,this._$Em=null}}requestUpdate(e,n,t,o=!1,i){if(e!==void 0){let l=this.constructor;if(o===!1&&(i=this[e]),t??=l.getPropertyOptions(e),!((t.hasChanged??Ce)(i,n)||t.useDefault&&t.reflect&&i===this._$Ej?.get(e)&&!this.hasAttribute(l._$Eu(e,t))))return;this.C(e,n,t)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,n,{useDefault:t,reflect:o,wrapped:i},l){t&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,l??n??this[e]),i!==!0||l!==void 0)||(this._$AL.has(e)||(this.hasUpdated||t||(n=void 0),this._$AL.set(e,n)),o===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(n){Promise.reject(n)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[o,i]of this._$Ep)this[o]=i;this._$Ep=void 0}let t=this.constructor.elementProperties;if(t.size>0)for(let[o,i]of t){let{wrapped:l}=i,r=this[o];l!==!0||this._$AL.has(o)||r===void 0||this.C(o,void 0,i,r)}}let e=!1,n=this._$AL;try{e=this.shouldUpdate(n),e?(this.willUpdate(n),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(n)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(n)}willUpdate(e){}_$AE(e){this._$EO?.forEach(n=>n.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(n=>this._$ET(n,this[n])),this._$EM()}updated(e){}firstUpdated(e){}};g.elementStyles=[],g.shadowRootOptions={mode:"open"},g[H("elementProperties")]=new Map,g[H("finalized")]=new Map,gt?.({ReactiveElement:g}),(F.reactiveElementVersions??=[]).push("2.1.2");var ie=globalThis,He=s=>s,j=ie.trustedTypes,Te=j?j.createPolicy("lit-html",{createHTML:s=>s}):void 0,Ue="$lit$",_=`lit$${Math.random().toFixed(9).slice(2)}$`,Ne="?"+_,ft=`<${Ne}>`,v=document,M=()=>v.createComment(""),L=s=>s===null||typeof s!="object"&&typeof s!="function",re=Array.isArray,_t=s=>re(s)||typeof s?.[Symbol.iterator]=="function",Q=`[ 	
\f\r]`,T=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Me=/-->/g,Le=/>/g,y=RegExp(`>|${Q}(?:([^\\s"'>=/]+)(${Q}*=${Q}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Ie=/'/g,Oe=/"/g,ze=/^(?:script|style|textarea|title)$/i,ae=s=>(e,...n)=>({_$litType$:s,strings:e,values:n}),c=ae(1),Wt=ae(2),Bt=ae(3),x=Symbol.for("lit-noChange"),h=Symbol.for("lit-nothing"),Re=new WeakMap,$=v.createTreeWalker(v,129);function De(s,e){if(!re(s)||!s.hasOwnProperty("raw"))throw Error("invalid template strings array");return Te!==void 0?Te.createHTML(e):e}var bt=(s,e)=>{let n=s.length-1,t=[],o,i=e===2?"<svg>":e===3?"<math>":"",l=T;for(let r=0;r<n;r++){let d=s[r],a,u,p=-1,m=0;for(;m<d.length&&(l.lastIndex=m,u=l.exec(d),u!==null);)m=l.lastIndex,l===T?u[1]==="!--"?l=Me:u[1]!==void 0?l=Le:u[2]!==void 0?(ze.test(u[2])&&(o=RegExp("</"+u[2],"g")),l=y):u[3]!==void 0&&(l=y):l===y?u[0]===">"?(l=o??T,p=-1):u[1]===void 0?p=-2:(p=l.lastIndex-u[2].length,a=u[1],l=u[3]===void 0?y:u[3]==='"'?Oe:Ie):l===Oe||l===Ie?l=y:l===Me||l===Le?l=T:(l=y,o=void 0);let f=l===y&&s[r+1].startsWith("/>")?" ":"";i+=l===T?d+ft:p>=0?(t.push(a),d.slice(0,p)+Ue+d.slice(p)+_+f):d+_+(p===-2?r:f)}return[De(s,i+(s[n]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),t]},I=class s{constructor({strings:e,_$litType$:n},t){let o;this.parts=[];let i=0,l=0,r=e.length-1,d=this.parts,[a,u]=bt(e,n);if(this.el=s.createElement(a,t),$.currentNode=this.el.content,n===2||n===3){let p=this.el.content.firstChild;p.replaceWith(...p.childNodes)}for(;(o=$.nextNode())!==null&&d.length<r;){if(o.nodeType===1){if(o.hasAttributes())for(let p of o.getAttributeNames())if(p.endsWith(Ue)){let m=u[l++],f=o.getAttribute(p).split(_),D=/([.?@])?(.*)/.exec(m);d.push({type:1,index:i,name:D[2],strings:f,ctor:D[1]==="."?te:D[1]==="?"?ne:D[1]==="@"?se:P}),o.removeAttribute(p)}else p.startsWith(_)&&(d.push({type:6,index:i}),o.removeAttribute(p));if(ze.test(o.tagName)){let p=o.textContent.split(_),m=p.length-1;if(m>0){o.textContent=j?j.emptyScript:"";for(let f=0;f<m;f++)o.append(p[f],M()),$.nextNode(),d.push({type:2,index:++i});o.append(p[m],M())}}}else if(o.nodeType===8)if(o.data===Ne)d.push({type:2,index:i});else{let p=-1;for(;(p=o.data.indexOf(_,p+1))!==-1;)d.push({type:7,index:i}),p+=_.length-1}i++}}static createElement(e,n){let t=v.createElement("template");return t.innerHTML=e,t}};function w(s,e,n=s,t){if(e===x)return e;let o=t!==void 0?n._$Co?.[t]:n._$Cl,i=L(e)?void 0:e._$litDirective$;return o?.constructor!==i&&(o?._$AO?.(!1),i===void 0?o=void 0:(o=new i(s),o._$AT(s,n,t)),t!==void 0?(n._$Co??=[])[t]=o:n._$Cl=o),o!==void 0&&(e=w(s,o._$AS(s,e.values),o,t)),e}var ee=class{constructor(e,n){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=n}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:n},parts:t}=this._$AD,o=(e?.creationScope??v).importNode(n,!0);$.currentNode=o;let i=$.nextNode(),l=0,r=0,d=t[0];for(;d!==void 0;){if(l===d.index){let a;d.type===2?a=new O(i,i.nextSibling,this,e):d.type===1?a=new d.ctor(i,d.name,d.strings,this,e):d.type===6&&(a=new oe(i,this,e)),this._$AV.push(a),d=t[++r]}l!==d?.index&&(i=$.nextNode(),l++)}return $.currentNode=v,o}p(e){let n=0;for(let t of this._$AV)t!==void 0&&(t.strings!==void 0?(t._$AI(e,t,n),n+=t.strings.length-2):t._$AI(e[n])),n++}},O=class s{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,n,t,o){this.type=2,this._$AH=h,this._$AN=void 0,this._$AA=e,this._$AB=n,this._$AM=t,this.options=o,this._$Cv=o?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,n=this._$AM;return n!==void 0&&e?.nodeType===11&&(e=n.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,n=this){e=w(this,e,n),L(e)?e===h||e==null||e===""?(this._$AH!==h&&this._$AR(),this._$AH=h):e!==this._$AH&&e!==x&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):_t(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==h&&L(this._$AH)?this._$AA.nextSibling.data=e:this.T(v.createTextNode(e)),this._$AH=e}$(e){let{values:n,_$litType$:t}=e,o=typeof t=="number"?this._$AC(e):(t.el===void 0&&(t.el=I.createElement(De(t.h,t.h[0]),this.options)),t);if(this._$AH?._$AD===o)this._$AH.p(n);else{let i=new ee(o,this),l=i.u(this.options);i.p(n),this.T(l),this._$AH=i}}_$AC(e){let n=Re.get(e.strings);return n===void 0&&Re.set(e.strings,n=new I(e)),n}k(e){re(this._$AH)||(this._$AH=[],this._$AR());let n=this._$AH,t,o=0;for(let i of e)o===n.length?n.push(t=new s(this.O(M()),this.O(M()),this,this.options)):t=n[o],t._$AI(i),o++;o<n.length&&(this._$AR(t&&t._$AB.nextSibling,o),n.length=o)}_$AR(e=this._$AA.nextSibling,n){for(this._$AP?.(!1,!0,n);e!==this._$AB;){let t=He(e).nextSibling;He(e).remove(),e=t}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},P=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,n,t,o,i){this.type=1,this._$AH=h,this._$AN=void 0,this.element=e,this.name=n,this._$AM=o,this.options=i,t.length>2||t[0]!==""||t[1]!==""?(this._$AH=Array(t.length-1).fill(new String),this.strings=t):this._$AH=h}_$AI(e,n=this,t,o){let i=this.strings,l=!1;if(i===void 0)e=w(this,e,n,0),l=!L(e)||e!==this._$AH&&e!==x,l&&(this._$AH=e);else{let r=e,d,a;for(e=i[0],d=0;d<i.length-1;d++)a=w(this,r[t+d],n,d),a===x&&(a=this._$AH[d]),l||=!L(a)||a!==this._$AH[d],a===h?e=h:e!==h&&(e+=(a??"")+i[d+1]),this._$AH[d]=a}l&&!o&&this.j(e)}j(e){e===h?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},te=class extends P{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===h?void 0:e}},ne=class extends P{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==h)}},se=class extends P{constructor(e,n,t,o,i){super(e,n,t,o,i),this.type=5}_$AI(e,n=this){if((e=w(this,e,n,0)??h)===x)return;let t=this._$AH,o=e===h&&t!==h||e.capture!==t.capture||e.once!==t.once||e.passive!==t.passive,i=e!==h&&(t===h||o);o&&this.element.removeEventListener(this.name,this,t),i&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},oe=class{constructor(e,n,t){this.element=e,this.type=6,this._$AN=void 0,this._$AM=n,this.options=t}get _$AU(){return this._$AM._$AU}_$AI(e){w(this,e)}};var yt=ie.litHtmlPolyfillSupport;yt?.(I,O),(ie.litHtmlVersions??=[]).push("3.3.3");var We=(s,e,n)=>{let t=n?.renderBefore??e,o=t._$litPart$;if(o===void 0){let i=n?.renderBefore??null;t._$litPart$=o=new O(e.insertBefore(M(),i),i,void 0,n??{})}return o._$AI(s),o};var le=globalThis,b=class extends g{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let n=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=We(n,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return x}};b._$litElement$=!0,b.finalized=!0,le.litElementHydrateSupport?.({LitElement:b});var $t=le.litElementPolyfillSupport;$t?.({LitElement:b});(le.litElementVersions??=[]).push("4.2.2");var vt=s=>s?{home_id:s}:{};async function Be(s,e){return s.callWS({type:"home_3d/building/get",...vt(e)})}function Fe(s){return s.callWS({type:"home_3d/homes/list"})}var ce="#48cdeb";function xt(s,e){return(s??"").trim().toLowerCase()===(e??"").trim().toLowerCase()}function kt(s,e){return!!s&&!xt(s,e)}function je(s){return kt(s.value,s.fallback)?c`<button
    type="button"
    class="fp3d-colour-reset"
    title=${s.label}
    aria-label=${s.label}
    ?disabled=${s.disabled}
    @click=${e=>{e.preventDefault(),e.stopPropagation(),s.onReset()}}
  >
    ↺
  </button>`:h}var Ke=C`
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
`;function qe(s){let e=n=>s.onChange(n.detail.value);return c`<fp3d-colour-field .value=${s.value??null} .label=${s.label} .t=${s.t} .base=${s.base??null} ?clearable=${!!s.clearable} ?disabled=${!!s.disabled} @colour-change=${s.live?null:e} @colour-input=${s.live?e:null} ?menu=${!!s.onMenu} ?expanded=${!!s.expanded} @colour-menu=${s.onMenu??null}></fp3d-colour-field>`}var de=["pool"];function he(){try{let s=new URLSearchParams(location.search).get("fp3d_lab");return s==="1"?localStorage.setItem("home3d.lab","1"):s==="0"&&localStorage.removeItem("home3d.lab"),localStorage.getItem("home3d.lab")==="1"}catch{return!1}}var ue=["rooms","covers","favorites"],Ve=["lights","climate","action","link"];function Ge(s){return typeof s=="string"&&/^\/[^/\\]/.test(s)}var R=["view","walls","floors","temperature","humidity","co2"];function Ye(s,e){let n=e?.trim();if(!n)return;let t=s?.card_templates??[];return t.find(o=>o.id===n)??t.find(o=>o.aliases?.includes(n))}var A=globalThis.__fp3dLanguages??={extra:new Map,pending:new Map},{extra:U,pending:pe}=A;var St="home3d.language";function wt(s){A.chosen=s&&s!=="auto"&&/^[a-z]{2,3}$/i.test(s)?s.toLowerCase():null}function Je(){if(A.chosen===void 0)try{wt(localStorage.getItem(St))}catch{A.chosen=null}return A.chosen??null}function K(s){let e=(Je()??s??navigator.language??"en").toLowerCase(),n=e.startsWith("no")?"nb":e.split(/[-_]/)[0];return n==="en"||!/^[a-z]{2,3}$/.test(n)?null:n}function ge(s){let e=K(s);return!e||U.has(e)}var me="home3d.lang.";function Pt(s){try{let e=JSON.parse(localStorage.getItem(me+s)??"null");return e&&typeof e.hash=="string"&&e.strings&&typeof e.strings=="object"?e:null}catch{return null}}function At(s,e,n){try{Object.keys(n).length?localStorage.setItem(me+s,JSON.stringify({hash:e,strings:n})):localStorage.removeItem(me+s)}catch{}}async function Et(s,e){if(!e?.callWS)return{};let n=Pt(s);try{let t=await e.callWS({type:"home_3d/languages/get",language:s,...n?{hash:n.hash}:{}});return t.strings&&typeof t.strings=="object"?(At(s,t.hash,t.strings),t.strings):n&&t.hash===n.hash?n.strings:{}}catch{return n?.strings??{}}}function Xe(s,e,n=!1){let t=K(s);if(!t||U.has(t)&&!n)return Promise.resolve();let o=pe.get(t);return o||(o=Et(t,e).then(i=>{U.set(t,i)}).finally(()=>pe.delete(t)),pe.set(t,o)),o}function Ze(s){let e=Je()??s?.language??navigator.language??"en",n=K(e);if(!n)return/^en(?:-|$)/i.test(e)?e:"en";let t=U.get(n);for(let o in t)return e;return"en"}function Qe(s,e,n={}){let t=K(s?.language??navigator.language),i=(t?U.get(t):void 0)?.[e]??A.en?.[e]??e;for(let[l,r]of Object.entries(n))i=i.replace(`{${l}}`,String(r));return i}var fe={natural:!0,signal:!0,shadows:!0,floors:1,cutDark:!0,sun:.45,ao:.45},_e=[{id:"neon",base:"neon",group:"neon",aliases:["neon","standard"]},{id:"blueprint",base:"blueprint",group:"neon",aliases:["blueprint","high contrast","contrast"]},{id:"day",base:"day",group:"neon",aliases:["day","light"]},{id:"focus",base:"neon",group:"neon",palette:{line:"#394150",dark:"#07090d",light:"#2c313a",hue:0,lift:.05,contrast:2.5},signal:!0,sun:.2,bg:["#030407","#0b0e14"],aliases:["focus","night","dark"]},{id:"synthwave",base:"neon",group:"neon",palette:{line:"#ff3fd2",dark:"#12051f",light:"#3a1460",hue:.2,lift:.05,contrast:2.5},signal:!0,sun:.2,bg:["#08010f","#2a0838"],aliases:["synthwave","synth","retro","party"]},{id:"realistic",base:"realistic",group:"homely",aliases:["realistic","real","photo"]},{id:"cozy",base:"day",group:"homely",...fe,palette:null,bg:["#f1efeb","#d9d5ce"],aliases:["cozy","cosy","homely"]},{id:"evening",base:"neon",group:"homely",...fe,sun:.4,dim:.75,bg:["#14161c","#272630"],aliases:["evening","cozy evening","cosy evening","homely evening"]},{id:"winter",base:"neon",group:"homely",...fe,sun:.4,dim:.8,bg:["#0b1322","#1d2a40"],aliases:["winter","winter evening","christmas"]},{id:"model",base:"day",group:"designed",palette:{line:"#8a8f98",dark:"#cfcac2",light:"#fbfaf7",hue:.08,lift:.35,contrast:3.2},signal:!0,sun:.3,ao:.3,shadows:!0,bg:["#eeece8","#d6d2cb"],aliases:["model","architectural model","architect","white"]},{id:"pastel",base:"day",group:"designed",palette:{line:"#3b3f5c",dark:"#b7c4e6",light:"#fff4ea",hue:.55,lift:.3,contrast:3},signal:!0,sun:.25,ao:.2,shadows:!0,bg:["#f4efe8","#e3e7f2"],aliases:["pastel","colourful","colorful","kids"]},{id:"warm",base:"day",group:"designed",palette:{line:"#5a4632",dark:"#b0906c",light:"#f4ead9",hue:.15,lift:.3,contrast:3},signal:!0,sun:.3,ao:.3,shadows:!0,bg:["#f0e7d7","#d9cbb3"],aliases:["warm","wood","paper","wood and paper"]}];var Ct=new Map(_e.map(s=>[s.id,s]));function et(s){return typeof s=="string"&&/^my_[a-z0-9]{1,24}$/i.test(s)}var z=[],Ht=40,Tt=/^#[0-9a-f]{6}$/i,k=(s,e,n,t)=>typeof s=="number"&&Number.isFinite(s)?Math.min(n,Math.max(e,s)):t,N=(s,e)=>typeof s=="string"&&Tt.test(s)?s:e;function Mt(s){let e=s;if(!e||typeof e!="object"||!et(e.id)||typeof e.name!="string"||!e.name.trim())return null;let n={id:e.id,name:e.name.trim().slice(0,40),base:e.base==="day"||e.base==="blueprint"||e.base==="realistic"?e.base:"neon"},t=e.palette;t&&typeof t=="object"&&!e.natural&&(n.palette={line:N(t.line,"#8a8f98"),dark:N(t.dark,"#202020"),light:N(t.light,"#f0f0f0"),hue:k(t.hue,0,1,0),lift:k(t.lift,0,.6,.2),contrast:k(t.contrast,.5,4,2.5)}),e.natural&&(n.natural=!0,n.floors=k(e.floors,0,1,1),n.cutDark=e.cutDark!==!1,n.dim=k(e.dim,0,.9,0)),n.signal=e.signal!==!1,n.shadows=e.shadows!==!1,n.sun=k(e.sun,0,.7,.3),n.ao=k(e.ao,0,.7,0);let o=e.bg;return Array.isArray(o)&&o.length===2&&(n.bg=[N(o[0],"#202020"),N(o[1],"#101010")]),n}function tt(s){let e=new Set;z=[];for(let n of Array.isArray(s)?s.slice(0,Ht):[]){let t=Mt(n);!t||e.has(t.id)||(e.add(t.id),z.push({...t,group:"custom",aliases:[t.name]}))}}var Lt=["neon","homely","designed","custom"];function q(s={}){let e=[];s.none&&e.push({group:"none",values:[""]});let n=[...s.theme?["theme"]:[],...s.auto?["auto"]:[],...s.house?["house"]:[]];n.length&&e.push({group:"auto",values:n});for(let t of Lt){let o=It().filter(i=>i.group===t).map(i=>i.id);o.length&&e.push({group:t,values:o})}return e}function It(){return z.length?[..._e,...z]:_e}function V(s){return s?Ct.get(s)??z.find(e=>e.id===s):void 0}var be=70;function nt(){return q({none:!0,house:!0}).map(s=>({...s,values:s.values.filter(e=>e!=="realistic")})).filter(s=>s.values.length)}var st={height:420,view:"3d",walls:"auto",explode:!0,roof_fade:!0,roof:!0,camera_wall:!1,quality:"auto",stats:!1,markers:"important",heatmap:"none",theme:"theme",energy:!0,room_panel:!0,fill:!1,phone:!1,controls:!1,fullscreen_button:!1,room_names:!0,surroundings:!0,floor_stack:"dim",alerts:!0,alert_jump:!1,director:!1,voice:!1,scenes:!0,motion_trail:!1,time_travel:!1,household_card:!0,rack_cards:!0,weather:!0,idle_return:0,controls_hidden:!1,controls_hide_after:0,marker_names:!1,central:!0,pets:!0,ghost:!0,night:"off",idle_orbit:!1},ot=["home"],Ot=[["for","card_tab_for"],["view","card_section_view"],["show","card_section_show"],["features","card_section_features"],["kiosk","card_section_kiosk"]],ye=class extends b{static properties={hass:{attribute:!1},building:{attribute:!1},embedded:{type:Boolean,reflect:!0},_tab:{state:!0},_templates:{state:!0},_config:{state:!0},_floors:{state:!0},_styles:{state:!0},_hasMap:{state:!0}};seenPlan=null;floorsOf=void 0;homesAsked=!1;constructor(){super(),this._config={type:"custom:home-3d-card"},this.building=null,this.embedded=!1,this._tab="for",this._templates=[],this._floors=[],this._styles=[],this._hasMap=!1,this._homes=[]}setConfig(e){this._config=e}willUpdate(){this.hass&&!ge(this.hass.language)&&Xe(this.hass.language,this.hass).then(()=>this.requestUpdate());let e=Ze(this.hass);if(this.getAttribute("lang")!==e&&this.setAttribute("lang",e),this.embedded){this.building!==this.seenPlan&&(this.seenPlan=this.building,this.building&&this.takePlan(this.building));return}let n=this._config.home??"";this.hass&&this.floorsOf!==n&&(this.floorsOf=n,Be(this.hass,n||void 0).then(t=>{this.floorsOf===n&&this.takePlan(t.building)},()=>{})),this.hass&&!this.homesAsked&&(this.homesAsked=!0,Fe(this.hass).then(t=>this._homes=t.homes,()=>{}))}takePlan(e){this._floors=e.floors.map(n=>({id:n.id,name:n.name})),this._styles=e.settings?.styles_custom??[],this._hasMap=!!e.settings?.surroundings,this._templates=e.card_templates??[]}t(e,n){return Qe(this.hass,e,n)}get value(){return{...st,...this._config}}set(e,n){let t={...this._config};n===void 0||n===""||st[e]===n?delete t[e]:t[e]=n,this.emit(t)}emit(e){this._config=e,this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:e},bubbles:!0,composed:!0}))}ownOptions(){return Object.keys(this._config).filter(e=>e!=="type"&&e!=="template"&&!ot.includes(e))}pickTemplate(e){let n=Object.fromEntries(ot.filter(t=>this._config[t]!==void 0).map(t=>[t,this._config[t]]));this.emit({type:this._config.type,...n,...e?{template:e}:{}})}renderHome(){let e=this.value;return this._homes.length>1||this._config.home?c`<div class="grid home">
      <label class="field wide"
        >${this.t("card_home")}
        <select
          @change=${n=>{let t={...this._config};delete t.floor,delete t.room,delete t.template;let o=n.target.value;o?t.home=o:delete t.home,this.emit(t)}}
        >
          <option value="" ?selected=${!e.home}>${this.t("card_home_active")}</option>
          ${this._homes.map(n=>c`<option value=${n.id} ?selected=${n.id===e.home}>${n.name}</option>`)}
          ${e.home&&!this._homes.some(n=>n.id===e.home)?c`<option value=${e.home} selected>${e.home}</option>`:h}
        </select>
      </label>
    </div>`:h}renderTemplate(){let e=this._config.template;if(!e&&!this._templates.length)return h;let n=Ye({card_templates:this._templates},e),t=n?.id??e,o=e?this.ownOptions():[];return c`<h3>${this.t("card_template")}</h3>
      <label class="field wide">
        <select aria-label=${this.t("card_template")} @change=${i=>this.pickTemplate(i.target.value||void 0)}>
          <option value="" ?selected=${!e}>${this.t("card_template_none")}</option>
          ${this._templates.map(i=>c`<option value=${i.id} ?selected=${i.id===t}>${i.name||i.id}</option>`)}
          ${e&&!n?c`<option value=${e} selected>${e}</option>`:h}
        </select>
      </label>
      <p class="hint">${this.t(e?"card_template_on":"card_template_hint")}</p>
      ${o.length?c`<p class="hint own">
            ${this.t("card_template_own",{list:o.join(", ")})}
            <button type="button" class="link" @click=${()=>this.pickTemplate(e)}>${this.t("card_template_own_clear")}</button>
          </p>`:h}`}renderPurpose(){let e=this.value.phone===!0;return c`<h3>${this.t("card_for")}</h3>
      <div class="purpose">
        <button type="button" aria-pressed=${!e} @click=${()=>this.set("phone",void 0)}>${this.t("card_for_large")}</button>
        <button type="button" aria-pressed=${e} @click=${()=>this.emit({...this._config,phone:!0,fill:!0})}>${this.t("card_for_phone")}</button>
      </div>
      <p class="hint">${this.t(e?"card_for_phone_hint":"card_for_large_hint")}</p>
      ${e?this.renderPhoneBar():h}`}select(e,n,t,o){return c`<label class="field"
      >${this.t(n)}
      <select @change=${i=>this.set(e,i.target.value)}>
        ${t.map(([i,l])=>c`<option value=${i} ?selected=${i===o}>${this.t(l)}</option>`)}
      </select>
    </label>`}styleSelect(e,n,t,o){tt(this._styles);let i={theme:"theme_theme",auto:"theme_auto",house:"style_house"},l=a=>{let u=V(a)?.group==="custom"?V(a):void 0,p=a===""?this.t(e==="zoom_style"?"zoom_style_off":"style_none"):i[a]?this.t(i[a]):u?u.name??a:this.t(`style_${a}`);return c`<option value=${a} ?selected=${a===t}>${p}</option>`},r=e==="zoom_style"?nt():q(o),d=r.some(a=>a.values.includes(t));return c`<label class="field"
      >${this.t(n)}
      <select @change=${a=>this.set(e,a.target.value||void 0)}>
        ${r.map(a=>a.group==="none"||!a.group?a.values.map(l):c`<optgroup label=${this.t(`style_group_${a.group}`)}>${a.values.map(l)}</optgroup>`)}
        ${d?h:c`<option value=${t} selected>${t}</option>`}
      </select>
    </label>`}toggle(e,n,t){let o=this.value[e];return c`<label class="toggle">
      <input type="checkbox" .checked=${o} @change=${i=>this.set(e,i.target.checked)} />
      <span>${this.t(n)}${t?c`<small>${this.t(t)}</small>`:h}</span>
    </label>`}renderPhoneBar(){let e=new Set(this._config.phone_hide??[]),n=t=>c`<label class="toggle">
        <input
          type="checkbox"
          .checked=${!e.has(t)}
          @change=${o=>{let i=new Set(e);o.target.checked?i.delete(t):i.add(t),this.set("phone_hide",i.size?ue.filter(l=>i.has(l)):void 0)}}
        />
        <span>${this.t(`card_phone_${t}`)}<small>${this.t(`card_phone_${t}_hint`)}</small></span>
      </label>`;return c`<h3>${this.t("card_section_phone")}</h3>
      ${ue.map(n)} ${[0,1].map(t=>this.renderPlace(t))}
      <p class="hint">${this.t("card_phone_place_hint")}</p>
      <label class="toggle">
        <input type="checkbox" .checked=${this._config.phone_start==="now"} @change=${t=>this.set("phone_start",t.target.checked?"now":void 0)} />
        <span>${this.t("card_phone_start_now")}<small>${this.t("card_phone_start_now_hint")}</small></span>
      </label>
      <label class="toggle">
        <input type="checkbox" .checked=${this._config.phone_solo===!0} @change=${t=>this.set("phone_solo",t.target.checked||void 0)} />
        <span>${this.t("nav_solo")}<small>${this.t("card_phone_solo_hint")}</small></span>
      </label>`}renderPlace(e){let n=[...this._config.phone_places??[]],t=n[e];if(e>0&&!n[e-1])return h;let o=r=>{r?n[e]=r:n.splice(e,1),this.set("phone_places",n.length?n:void 0)},i=Object.keys(this.hass?.states??{}).filter(r=>/^(scene|script)\./.test(r)).sort(),l=(r,d,a,u,p)=>c`<label class="field"
        >${this.t(r)}
        <input type="text" maxlength=${a} placeholder=${u} .value=${d??""} @change=${m=>p(m.target.value.trim())} />
      </label>`;return c`<div class="grid place">
      <label class="field"
        >${this.t("card_phone_place",{n:e+1})}
        <select
          @change=${r=>{let d=r.target.value;o(d?{kind:d,name:t?.name,icon:t?.icon,...d==="action"?{entity:i[0]}:d==="link"?{path:"/lovelace/0"}:{}}:null)}}
        >
          <option value="" ?selected=${!t}>${this.t("card_phone_place_none")}</option>
          ${Ve.map(r=>c`<option value=${r} ?selected=${t?.kind===r}>${this.t(`card_phone_place_${r}`)}</option>`)}
        </select>
      </label>
      ${t?c`${l("card_phone_place_name",t.name,24,"",r=>o({...t,name:r||void 0}))}
          ${l("card_phone_place_icon",t.icon,4,"\u{1F4A1}",r=>o({...t,icon:r||void 0}))}
          ${t.kind==="action"?c`<label class="field"
                >${this.t("card_phone_place_entity")}
                <select @change=${r=>o({...t,entity:r.target.value})}>
                  ${t.entity&&!i.includes(t.entity)?c`<option value=${t.entity} selected>${t.entity}</option>`:h}
                  ${i.map(r=>c`<option value=${r} ?selected=${r===t.entity}>${this.hass?.states[r]?.attributes.friendly_name??r}</option>`)}
                </select>
              </label>`:t.kind==="link"?l("card_phone_place_path",t.path,200,"/lovelace/energy",r=>Ge(r)&&o({...t,path:r})):h}`:h}
    </div>`}renderThumbsToggle(){let e=!this._config.floor,n=this._config.floor_thumbs??e;return c`<label class="toggle">
      <input
        type="checkbox"
        .checked=${n}
        @change=${t=>{let o=t.target.checked,i={...this._config};o===e?delete i.floor_thumbs:i.floor_thumbs=o,this._config=i,this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:i},bubbles:!0,composed:!0}))}}
      />
      <span>${this.t("card_floor_thumbs")}<small>${this.t(this._config.floor?"card_floor_thumbs_hint_start":"card_floor_thumbs_hint")}</small></span>
    </label>`}renderControls(){let e=this._config.controls,n=!!e&&(e===!0||e.length>0),t=e===!0?[...R]:Array.isArray(e)?e:[],o=r=>this.set("controls",r.length===R.length?!0:r.length?r:void 0),i=this.value,l=[0,10,30,60,120];return c`<label class="toggle">
        <input type="checkbox" .checked=${n} @change=${r=>this.set("controls",r.target.checked?!0:void 0)} />
        <span>${this.t("card_controls")}<small>${this.t("card_controls_hint")}</small></span>
      </label>
      <label class="toggle">
        <input type="checkbox" .checked=${i.central} @change=${r=>this.set("central",r.target.checked?void 0:!1)} />
        <span>${this.t("card_central")}<small>${this.t("card_central_hint")}</small></span>
      </label>
      ${!de.includes("fun_pets")||he()?c`<label class="toggle">
            <input type="checkbox" .checked=${i.pets} @change=${r=>this.set("pets",r.target.checked?void 0:!1)} />
            <span>${this.t("card_pets")}<small>${this.t("card_pets_hint")}</small></span>
          </label>`:h}
      ${!de.includes("fun_halloween")||he()?c`<label class="toggle">
            <input type="checkbox" .checked=${i.ghost} @change=${r=>this.set("ghost",r.target.checked?void 0:!1)} />
            <span>${this.t("card_ghost")}<small>${this.t("card_ghost_hint")}</small></span>
          </label>`:h}
      <label class="toggle">
        <input type="checkbox" .checked=${i.marker_names} @change=${r=>this.set("marker_names",r.target.checked?!0:void 0)} />
        <span>${this.t("card_marker_names")}<small>${this.t("card_marker_names_hint")}</small></span>
      </label>
      <label class="toggle">
        <input type="checkbox" .checked=${i.controls_hidden} @change=${r=>this.set("controls_hidden",r.target.checked?!0:void 0)} />
        <span>${this.t("card_controls_hidden")}<small>${this.t("card_controls_hidden_hint")}</small></span>
      </label>
      <label class="field"
        >${this.t("card_controls_hide_after")}
        <select @change=${r=>this.set("controls_hide_after",Number(r.target.value)||void 0)}>
          ${l.map(r=>c`<option value=${r} ?selected=${i.controls_hide_after===r}>${r?this.t("card_hide_after_s",{n:r}):this.t("card_idle_off")}</option>`)}
        </select>
      </label>
      ${n?c`<div class="sub">
            ${R.map(r=>c`<label class="chip">
                <input
                  type="checkbox"
                  .checked=${t.includes(r)}
                  @change=${d=>o(d.target.checked?R.filter(a=>a===r||t.includes(a)):t.filter(a=>a!==r))}
                />
                ${this.t(`card_control_${r}`)}
              </label>`)}
          </div>`:h}`}renderKiosk(){let e=this.value,n=e.night==="off"||e.night==="sun"?e.night:"time",t=[0,1,2,5,10];return c`<h3>${this.t("card_section_kiosk")}</h3>
      <div class="grid">
        <label class="field"
          >${this.t("card_idle_return")}
          <select @change=${o=>this.set("idle_return",Number(o.target.value)||void 0)}>
            ${t.map(o=>c`<option value=${o*60} ?selected=${e.idle_return===o*60}>${o?this.t("card_idle_min",{n:o}):this.t("card_idle_off")}</option>`)}
          </select>
        </label>
        <label class="field"
          >${this.t("card_night")}
          <select @change=${o=>this.set("night",{off:void 0,sun:"sun",time:"22:00-06:00"}[o.target.value])}>
            <option value="off" ?selected=${n==="off"}>${this.t("card_night_off")}</option>
            <option value="sun" ?selected=${n==="sun"}>${this.t("card_night_sun")}</option>
            <option value="time" ?selected=${n==="time"}>${this.t("card_night_time")}</option>
          </select>
        </label>
        ${n==="time"?c`<label class="field wide"
              >${this.t("card_night_range")}
              <input
                type="text"
                pattern="\\d{1,2}:\\d{2}-\\d{1,2}:\\d{2}"
                placeholder="22:00-06:00"
                .value=${e.night}
                @change=${o=>this.set("night",o.target.value.trim()||void 0)}
              />
            </label>`:h}
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
      <p class="hint">${this.t("card_dashboard_hint")}</p>`}renderFeatures(){let e=this.value,n=Object.keys(this.hass?.states??{}).filter(t=>t.startsWith("weather.")).sort();return c`<h3>${this.t("card_section_features")}</h3>
      ${this.toggle("alerts","card_alerts","card_alerts_hint")} ${this.toggle("alert_jump","card_alert_jump","card_alert_jump_hint")}
      ${this.toggle("director","card_director","card_director_hint")}
      ${this.toggle("voice","card_voice","card_voice_hint")}
      <div class="grid">
        <label class="field wide"
          >${this.t("screen_name")}
          <input type="text" placeholder=${this.t("screen_name_placeholder")} .value=${e.screen??""} @change=${t=>this.set("screen",t.target.value.trim()||void 0)} />
        </label>
      </div>
      <p class="hint">${this.t("screen_name_hint")}</p>
      ${this.toggle("scenes","card_scenes","card_scenes_hint")}
      ${this.toggle("motion_trail","card_motion_trail","card_motion_trail_hint")} ${this.toggle("camera_wall","card_camera_wall","card_camera_wall_hint")}
      ${this.toggle("time_travel","card_time_travel","card_time_travel_hint")}
      ${this.toggle("household_card","card_household","card_household_hint")}
      ${this.toggle("rack_cards","card_rack_cards","card_rack_cards_hint")}
      ${this.toggle("weather","card_weather","card_weather_hint")}
      ${e.weather!==!1?c`<div class="grid">
            <label class="field wide"
              >${this.t("weather_entity")}
              <select @change=${t=>this.set("weather_entity",t.target.value||void 0)}>
                <option value="" ?selected=${!e.weather_entity}>${this.t("card_weather_plan")}</option>
                ${n.map(t=>c`<option value=${t} ?selected=${t===e.weather_entity}>${String(this.hass?.states[t]?.attributes.friendly_name??t)}</option>`)}
              </select>
            </label>
          </div>`:h}`}render(){if(this.hass&&!ge(this.hass.language))return h;let e=this.value,n=e.flows===void 0?"switch":e.flows?"on":"off",t=e.holograms===void 0?"switch":e.holograms?"on":"off",o=this.embedded?h:c`${this.renderHome()}${this.renderTemplate()}`;if(!this.embedded&&e.template)return o;let i=e.phone===!0,l=Ot.filter(([a])=>a!=="kiosk"||!i),r=l.some(([a])=>a===this._tab)?this._tab:"for",d=a=>!this.embedded||r===a;return c`
      ${o}
      ${this.embedded?c`<div class="tabs" role="tablist">
            ${l.map(([a,u])=>c`<button type="button" role="tab" aria-selected=${r===a} @click=${()=>this._tab=a}>${this.t(u)}</button>`)}
          </div>`:h}
      <section ?hidden=${!d("for")}>${this.renderPurpose()}</section>
      <section ?hidden=${!d("view")}>
      <h3>${this.t("card_section_view")}</h3>
      <div class="grid">
        <label class="field wide"
          >${this.t("card_floor")}
          <select @change=${a=>this.set("floor",a.target.value||void 0)}>
            <option value="" ?selected=${!e.floor}>${this.t("card_floor_house")}</option>
            ${this._floors.map(a=>c`<option value=${a.id} ?selected=${a.id===e.floor}>${a.name}</option>`)}
            ${e.floor&&!this._floors.some(a=>a.id===e.floor)?c`<option value=${e.floor} selected>${e.floor}</option>`:h}
          </select>
        </label>
        <label class="field"
          >${this.t("card_size")}
          <select @change=${a=>this.set("fill",a.target.value==="fill")}>
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
            @change=${a=>{let u=Math.round(Number(a.target.value));u>100&&this.set("height",u)}}
          />
        </label>
        ${this.styleSelect("theme","theme",e.theme,{theme:!0,auto:!0,house:!0})}
        ${this.styleSelect("theme_evening","card_theme_evening",this._config.theme_evening??"",{none:!0})}
        ${this.styleSelect("theme_night","card_theme_night",this._config.theme_night??"",{none:!0})}
        <label class="field"
          >${this.t("card_style_entity")}
          <input type="text" placeholder="input_select.style" .value=${this._config.style_entity??""} @change=${a=>this.set("style_entity",a.target.value.trim()||void 0)} />
        </label>
        ${this.styleSelect("zoom_style","zoom_style",this._config.zoom_style??"",{})}
        ${this._config.zoom_style?c`<label class="field" title=${this.t("zoom_late_hint")}
                >${this.t("zoom_late")} (${this.t("zoom_late_early")} … ${this.t("zoom_late_late")})
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  .value=${String(this._config.zoom_late??be)}
                  @change=${a=>{let u=Math.round(Number(a.target.value));this.set("zoom_late",u===be?void 0:u)}}
                />
              </label>
              <label class="toggle">
                <input type="checkbox" .checked=${this._config.zoom_scope==="room"} @change=${a=>this.set("zoom_scope",a.target.checked?"room":void 0)} />
                <span>${this.t("zoom_scope_room")}<small>${this.t("zoom_scope_hint")}</small></span>
              </label>
              <p class="hint">${this.t("zoom_style_hint")}</p>`:h}
        ${this.select("clock","clock",[["off","clock_off"],["tl","clock_tl"],["tr","clock_tr"],["bl","clock_bl"],["br","clock_br"]],e.clock??"off")}
        <label class="field"
          >${this.t("accent")}
          <span class="accent-pick"
            >${qe({value:this._config.accent??null,base:ce,label:this.t("accent"),t:(a,u)=>this.t(a,u),live:!0,onChange:a=>a&&this.set("accent",a)})}
            ${je({value:this._config.accent,fallback:ce,label:this.t("accent_reset"),onReset:()=>this.set("accent",void 0)})}</span
          >
        </label>
        ${this.select("view","card_view",[["3d","card_view_3d"],["2d","card_view_2d"]],e.view)}
        ${this.select("walls","card_walls",[["auto","walls_auto"],["cut","walls_cut"]],e.walls)}
        ${this.select("quality","quality",[["auto","quality_auto"],["low","quality_low"],["high","quality_high"]],e.quality)}
        ${this.select("floor_stack","card_floor_stack",[["dim","floor_stack_dim"],["stacked","floor_stack_stacked"],["single","floor_stack_single"]],e.floor_stack)}
      </div>
      ${e.fill?c`<p class="hint">${this.t("card_fill_hint")}</p>`:h}
      <p class="hint">${this.t("card_quality_hint")}</p>
      </section>
      <section ?hidden=${!d("show")}>
      <h3>${this.t("card_section_show")}</h3>
      <div class="grid">
        ${this.select("markers","markers",[["none","markers_none"],["room","markers_room"],["important","markers_important"],["all","markers_all"]],e.markers)}
        ${this.select("marker_size","pin_size",[["small","pin_size_small"],["normal","pin_size_normal"],["large","pin_size_large"]],e.marker_size??"normal")}
        ${this.select("heatmap","heatmap",[["none","heat_off"],["temperature","heat_temperature"],["humidity","heat_humidity"],["co2","heat_co2"],["values","heat_values"]],e.heatmap)}
        <label class="field wide"
          >${this.t("flows")}
          <select @change=${a=>{let u=a.target.value;this.set("flows",u==="switch"?void 0:u==="on")}}>
            <option value="switch" ?selected=${n==="switch"}>${this.t("card_flows_switch")}</option>
            <option value="on" ?selected=${n==="on"}>${this.t("card_flows_on")}</option>
            <option value="off" ?selected=${n==="off"}>${this.t("card_flows_off")}</option>
          </select>
        </label>
        <label class="field wide"
          >${this.t("holos")}
          <select @change=${a=>{let u=a.target.value;this.set("holograms",u==="switch"?void 0:u==="on")}}>
            <option value="switch" ?selected=${t==="switch"}>${this.t("card_flows_switch")}</option>
            <option value="on" ?selected=${t==="on"}>${this.t("card_flows_on")}</option>
            <option value="off" ?selected=${t==="off"}>${this.t("card_flows_off")}</option>
          </select>
        </label>
      </div>
      ${i?h:this.renderControls()}
      ${i?h:this.renderThumbsToggle()} ${this.toggle("room_names","card_room_names")}
      ${this._hasMap?this.toggle("surroundings","card_surroundings","card_surroundings_hint"):h}
      ${this.toggle("energy","card_energy")} ${this.toggle("room_panel","card_room_panel","card_room_panel_hint")}
      ${this.toggle("fullscreen_button","card_fullscreen_button","card_fullscreen_button_hint")}
      ${this.toggle("explode","card_explode")} ${this.toggle("roof","card_roof","card_roof_hint")} ${this.toggle("roof_fade","card_roof_fade","card_roof_fade_hint")} ${this.toggle("stats","card_stats","card_stats_hint")}
      </section>
      <section ?hidden=${!d("features")}>${this.renderFeatures()}</section>
      ${i?h:c`<section ?hidden=${!d("kiosk")}>${this.renderKiosk()}</section>`}
    `}static styles=C`
    .accent-pick {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    ${Ke}
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
    .place {
      margin: 6px 0 12px;
    }
    .home {
      margin-bottom: 12px;
    }
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 14px;
      border-bottom: 1px solid var(--divider-color, #8884);
    }
    .tabs button {
      padding: 10px 14px;
      border: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      background: none;
      color: var(--secondary-text-color);
      font: inherit;
      font-size: 14px;
      cursor: pointer;
    }
    .tabs button[aria-selected="true"] {
      color: var(--primary-text-color);
      border-bottom-color: var(--primary-color);
      font-weight: 600;
    }
    :host([embedded]) section > h3:first-child {
      display: none;
    }
    .purpose {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .purpose button {
      flex: 1 1 160px;
      min-height: 44px;
      padding: 12px 10px;
      border: 1px solid var(--divider-color, #8884);
      border-radius: 10px;
      background: none;
      color: inherit;
      font: inherit;
      font-size: 14px;
      cursor: pointer;
    }
    .purpose button[aria-pressed="true"] {
      border-color: var(--primary-color);
      box-shadow: inset 0 0 0 1px var(--primary-color);
      font-weight: 600;
    }
    .link {
      padding: 0;
      border: none;
      background: none;
      color: var(--primary-color);
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
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
  `};ke("home-3d-card-editor",ye);export{ye as Floorplan3dCardEditor};
