var je=Symbol.for("home-3d.custom-elements"),he=Symbol.for("home-3d.build"),Be=["home-3d-panel","home-3d-card"],j=typeof __FP3D_BUILD__=="string"?__FP3D_BUILD__:"dev",k;function B(){let o=globalThis;return o[je]??={defined:new Map,watching:!1}}function Ke(){if(k!==void 0)return k;if(j==="dev")return k=!0;let o=globalThis,e=o[he];if(e!==void 0)return k=e===j;let t=globalThis.customElements;return B().defined.size>0||Be.some(n=>t?.get(n)||pe(n,void 0))?k=!1:(o[he]=j,k=!0)}function ue(){let o=globalThis.customElements;if(o){for(let[e,t]of B().defined)if(t.registry!==o&&(t.registry=o,!o.get(e)))try{o.define(e,t.cls)}catch(s){console.warn(`Home 3D: could not define ${e} in the page's element registry`,s)}}}function pe(o,e){if(typeof document>"u")return;let t;try{t=document.createElement(o)}catch{return}if(Object.getPrototypeOf(t)===HTMLElement.prototype||t instanceof HTMLUnknownElement||!(t instanceof HTMLElement))return;let n=t.constructor;return n===e?void 0:n}function me(o,e){if(!Ke())return!1;ue();let t=globalThis.customElements;if(t.get(o))return!1;let s=B(),n=pe(o,e);if(n){try{t.define(o,n),s.defined.set(o,{cls:n,registry:t})}catch(i){console.warn(`Home 3D: could not define ${o} in the page's element registry`,i)}return!1}return t.define(o,e),s.defined.set(o,{cls:e,registry:t}),s.watching||(s.watching=!0,t.whenDefined("home-assistant").then(ue)),!0}var N=globalThis,W=N.ShadowRoot&&(N.ShadyCSS===void 0||N.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,K=Symbol(),ge=new WeakMap,E=class{constructor(e,t,s){if(this._$cssResult$=!0,s!==K)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,t=this.t;if(W&&e===void 0){let s=t!==void 0&&t.length===1;s&&(e=ge.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),s&&ge.set(t,e))}return e}toString(){return this.cssText}},fe=o=>new E(typeof o=="string"?o:o+"",void 0,K),P=(o,...e)=>{let t=o.length===1?o[0]:e.reduce((s,n,i)=>s+(r=>{if(r._$cssResult$===!0)return r.cssText;if(typeof r=="number")return r;throw Error("Value passed to 'css' function must be a 'css' function result: "+r+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(n)+o[i+1],o[0]);return new E(t,o,K)},_e=(o,e)=>{if(W)o.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(let t of e){let s=document.createElement("style"),n=N.litNonce;n!==void 0&&s.setAttribute("nonce",n),s.textContent=t.cssText,o.appendChild(s)}},q=W?o=>o:o=>o instanceof CSSStyleSheet?(e=>{let t="";for(let s of e.cssRules)t+=s.cssText;return fe(t)})(o):o;var{is:qe,defineProperty:Ve,getOwnPropertyDescriptor:Ge,getOwnPropertyNames:Je,getOwnPropertySymbols:Qe,getPrototypeOf:Ye}=Object,D=globalThis,be=D.trustedTypes,Ze=be?be.emptyScript:"",Xe=D.reactiveElementPolyfillSupport,C=(o,e)=>o,V={toAttribute(o,e){switch(e){case Boolean:o=o?Ze:null;break;case Object:case Array:o=o==null?o:JSON.stringify(o)}return o},fromAttribute(o,e){let t=o;switch(e){case Boolean:t=o!==null;break;case Number:t=o===null?null:Number(o);break;case Object:case Array:try{t=JSON.parse(o)}catch{t=null}}return t}},ye=(o,e)=>!qe(o,e),$e={attribute:!0,type:String,converter:V,reflect:!1,useDefault:!1,hasChanged:ye};Symbol.metadata??=Symbol("metadata"),D.litPropertyMetadata??=new WeakMap;var g=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=$e){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){let s=Symbol(),n=this.getPropertyDescriptor(e,s,t);n!==void 0&&Ve(this.prototype,e,n)}}static getPropertyDescriptor(e,t,s){let{get:n,set:i}=Ge(this.prototype,e)??{get(){return this[t]},set(r){this[t]=r}};return{get:n,set(r){let a=n?.call(this);i?.call(this,r),this.requestUpdate(e,a,s)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??$e}static _$Ei(){if(this.hasOwnProperty(C("elementProperties")))return;let e=Ye(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(C("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(C("properties"))){let t=this.properties,s=[...Je(t),...Qe(t)];for(let n of s)this.createProperty(n,t[n])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[s,n]of t)this.elementProperties.set(s,n)}this._$Eh=new Map;for(let[t,s]of this.elementProperties){let n=this._$Eu(t,s);n!==void 0&&this._$Eh.set(n,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let s=new Set(e.flat(1/0).reverse());for(let n of s)t.unshift(q(n))}else e!==void 0&&t.push(q(e));return t}static _$Eu(e,t){let s=t.attribute;return s===!1?void 0:typeof s=="string"?s:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,t=this.constructor.elementProperties;for(let s of t.keys())this.hasOwnProperty(s)&&(e.set(s,this[s]),delete this[s]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return _e(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,s){this._$AK(e,s)}_$ET(e,t){let s=this.constructor.elementProperties.get(e),n=this.constructor._$Eu(e,s);if(n!==void 0&&s.reflect===!0){let i=(s.converter?.toAttribute!==void 0?s.converter:V).toAttribute(t,s.type);this._$Em=e,i==null?this.removeAttribute(n):this.setAttribute(n,i),this._$Em=null}}_$AK(e,t){let s=this.constructor,n=s._$Eh.get(e);if(n!==void 0&&this._$Em!==n){let i=s.getPropertyOptions(n),r=typeof i.converter=="function"?{fromAttribute:i.converter}:i.converter?.fromAttribute!==void 0?i.converter:V;this._$Em=n;let a=r.fromAttribute(t,i.type);this[n]=a??this._$Ej?.get(n)??a,this._$Em=null}}requestUpdate(e,t,s,n=!1,i){if(e!==void 0){let r=this.constructor;if(n===!1&&(i=this[e]),s??=r.getPropertyOptions(e),!((s.hasChanged??ye)(i,t)||s.useDefault&&s.reflect&&i===this._$Ej?.get(e)&&!this.hasAttribute(r._$Eu(e,s))))return;this.C(e,t,s)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,t,{useDefault:s,reflect:n,wrapped:i},r){s&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,r??t??this[e]),i!==!0||r!==void 0)||(this._$AL.has(e)||(this.hasUpdated||s||(t=void 0),this._$AL.set(e,t)),n===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[n,i]of this._$Ep)this[n]=i;this._$Ep=void 0}let s=this.constructor.elementProperties;if(s.size>0)for(let[n,i]of s){let{wrapped:r}=i,a=this[n];r!==!0||this._$AL.has(n)||a===void 0||this.C(n,void 0,i,a)}}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(s=>s.hostUpdate?.()),this.update(t)):this._$EM()}catch(s){throw e=!1,this._$EM(),s}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(e){}firstUpdated(e){}};g.elementStyles=[],g.shadowRootOptions={mode:"open"},g[C("elementProperties")]=new Map,g[C("finalized")]=new Map,Xe?.({ReactiveElement:g}),(D.reactiveElementVersions??=[]).push("2.1.2");var ee=globalThis,ve=o=>o,F=ee.trustedTypes,xe=F?F.createPolicy("lit-html",{createHTML:o=>o}):void 0,Pe="$lit$",_=`lit$${Math.random().toFixed(9).slice(2)}$`,Ce="?"+_,et=`<${Ce}>`,v=document,T=()=>v.createComment(""),R=o=>o===null||typeof o!="object"&&typeof o!="function",te=Array.isArray,tt=o=>te(o)||typeof o?.[Symbol.iterator]=="function",G=`[ 	
\f\r]`,H=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,ke=/-->/g,Ae=/>/g,$=RegExp(`>|${G}(?:([^\\s"'>=/]+)(${G}*=${G}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Se=/'/g,we=/"/g,He=/^(?:script|style|textarea|title)$/i,se=o=>(e,...t)=>({_$litType$:o,strings:e,values:t}),d=se(1),bt=se(2),$t=se(3),x=Symbol.for("lit-noChange"),c=Symbol.for("lit-nothing"),Ee=new WeakMap,y=v.createTreeWalker(v,129);function Te(o,e){if(!te(o)||!o.hasOwnProperty("raw"))throw Error("invalid template strings array");return xe!==void 0?xe.createHTML(e):e}var st=(o,e)=>{let t=o.length-1,s=[],n,i=e===2?"<svg>":e===3?"<math>":"",r=H;for(let a=0;a<t;a++){let l=o[a],u,p,h=-1,m=0;for(;m<l.length&&(r.lastIndex=m,p=r.exec(l),p!==null);)m=r.lastIndex,r===H?p[1]==="!--"?r=ke:p[1]!==void 0?r=Ae:p[2]!==void 0?(He.test(p[2])&&(n=RegExp("</"+p[2],"g")),r=$):p[3]!==void 0&&(r=$):r===$?p[0]===">"?(r=n??H,h=-1):p[1]===void 0?h=-2:(h=r.lastIndex-p[2].length,u=p[1],r=p[3]===void 0?$:p[3]==='"'?we:Se):r===we||r===Se?r=$:r===ke||r===Ae?r=H:(r=$,n=void 0);let f=r===$&&o[a+1].startsWith("/>")?" ":"";i+=r===H?l+et:h>=0?(s.push(u),l.slice(0,h)+Pe+l.slice(h)+_+f):l+_+(h===-2?a:f)}return[Te(o,i+(o[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),s]},L=class o{constructor({strings:e,_$litType$:t},s){let n;this.parts=[];let i=0,r=0,a=e.length-1,l=this.parts,[u,p]=st(e,t);if(this.el=o.createElement(u,s),y.currentNode=this.el.content,t===2||t===3){let h=this.el.content.firstChild;h.replaceWith(...h.childNodes)}for(;(n=y.nextNode())!==null&&l.length<a;){if(n.nodeType===1){if(n.hasAttributes())for(let h of n.getAttributeNames())if(h.endsWith(Pe)){let m=p[r++],f=n.getAttribute(h).split(_),U=/([.?@])?(.*)/.exec(m);l.push({type:1,index:i,name:U[2],strings:f,ctor:U[1]==="."?Q:U[1]==="?"?Y:U[1]==="@"?Z:S}),n.removeAttribute(h)}else h.startsWith(_)&&(l.push({type:6,index:i}),n.removeAttribute(h));if(He.test(n.tagName)){let h=n.textContent.split(_),m=h.length-1;if(m>0){n.textContent=F?F.emptyScript:"";for(let f=0;f<m;f++)n.append(h[f],T()),y.nextNode(),l.push({type:2,index:++i});n.append(h[m],T())}}}else if(n.nodeType===8)if(n.data===Ce)l.push({type:2,index:i});else{let h=-1;for(;(h=n.data.indexOf(_,h+1))!==-1;)l.push({type:7,index:i}),h+=_.length-1}i++}}static createElement(e,t){let s=v.createElement("template");return s.innerHTML=e,s}};function A(o,e,t=o,s){if(e===x)return e;let n=s!==void 0?t._$Co?.[s]:t._$Cl,i=R(e)?void 0:e._$litDirective$;return n?.constructor!==i&&(n?._$AO?.(!1),i===void 0?n=void 0:(n=new i(o),n._$AT(o,t,s)),s!==void 0?(t._$Co??=[])[s]=n:t._$Cl=n),n!==void 0&&(e=A(o,n._$AS(o,e.values),n,s)),e}var J=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:s}=this._$AD,n=(e?.creationScope??v).importNode(t,!0);y.currentNode=n;let i=y.nextNode(),r=0,a=0,l=s[0];for(;l!==void 0;){if(r===l.index){let u;l.type===2?u=new M(i,i.nextSibling,this,e):l.type===1?u=new l.ctor(i,l.name,l.strings,this,e):l.type===6&&(u=new X(i,this,e)),this._$AV.push(u),l=s[++a]}r!==l?.index&&(i=y.nextNode(),r++)}return y.currentNode=v,n}p(e){let t=0;for(let s of this._$AV)s!==void 0&&(s.strings!==void 0?(s._$AI(e,s,t),t+=s.strings.length-2):s._$AI(e[t])),t++}},M=class o{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,s,n){this.type=2,this._$AH=c,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=s,this.options=n,this._$Cv=n?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=A(this,e,t),R(e)?e===c||e==null||e===""?(this._$AH!==c&&this._$AR(),this._$AH=c):e!==this._$AH&&e!==x&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):tt(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==c&&R(this._$AH)?this._$AA.nextSibling.data=e:this.T(v.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:s}=e,n=typeof s=="number"?this._$AC(e):(s.el===void 0&&(s.el=L.createElement(Te(s.h,s.h[0]),this.options)),s);if(this._$AH?._$AD===n)this._$AH.p(t);else{let i=new J(n,this),r=i.u(this.options);i.p(t),this.T(r),this._$AH=i}}_$AC(e){let t=Ee.get(e.strings);return t===void 0&&Ee.set(e.strings,t=new L(e)),t}k(e){te(this._$AH)||(this._$AH=[],this._$AR());let t=this._$AH,s,n=0;for(let i of e)n===t.length?t.push(s=new o(this.O(T()),this.O(T()),this,this.options)):s=t[n],s._$AI(i),n++;n<t.length&&(this._$AR(s&&s._$AB.nextSibling,n),t.length=n)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){let s=ve(e).nextSibling;ve(e).remove(),e=s}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},S=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,s,n,i){this.type=1,this._$AH=c,this._$AN=void 0,this.element=e,this.name=t,this._$AM=n,this.options=i,s.length>2||s[0]!==""||s[1]!==""?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=c}_$AI(e,t=this,s,n){let i=this.strings,r=!1;if(i===void 0)e=A(this,e,t,0),r=!R(e)||e!==this._$AH&&e!==x,r&&(this._$AH=e);else{let a=e,l,u;for(e=i[0],l=0;l<i.length-1;l++)u=A(this,a[s+l],t,l),u===x&&(u=this._$AH[l]),r||=!R(u)||u!==this._$AH[l],u===c?e=c:e!==c&&(e+=(u??"")+i[l+1]),this._$AH[l]=u}r&&!n&&this.j(e)}j(e){e===c?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},Q=class extends S{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===c?void 0:e}},Y=class extends S{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==c)}},Z=class extends S{constructor(e,t,s,n,i){super(e,t,s,n,i),this.type=5}_$AI(e,t=this){if((e=A(this,e,t,0)??c)===x)return;let s=this._$AH,n=e===c&&s!==c||e.capture!==s.capture||e.once!==s.once||e.passive!==s.passive,i=e!==c&&(s===c||n);n&&this.element.removeEventListener(this.name,this,s),i&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},X=class{constructor(e,t,s){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=s}get _$AU(){return this._$AM._$AU}_$AI(e){A(this,e)}};var nt=ee.litHtmlPolyfillSupport;nt?.(L,M),(ee.litHtmlVersions??=[]).push("3.3.3");var Re=(o,e,t)=>{let s=t?.renderBefore??e,n=s._$litPart$;if(n===void 0){let i=t?.renderBefore??null;s._$litPart$=n=new M(e.insertBefore(T(),i),i,void 0,t??{})}return n._$AI(o),n};var ne=globalThis,b=class extends g{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Re(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return x}};b._$litElement$=!0,b.finalized=!0,ne.litElementHydrateSupport?.({LitElement:b});var ot=ne.litElementPolyfillSupport;ot?.({LitElement:b});(ne.litElementVersions??=[]).push("4.2.2");var it=o=>o?{home_id:o}:{};async function Le(o,e){return o.callWS({type:"home_3d/building/get",...it(e)})}function Me(o){return o.callWS({type:"home_3d/homes/list"})}var oe="#48cdeb";function rt(o,e){return(o??"").trim().toLowerCase()===(e??"").trim().toLowerCase()}function at(o,e){return!!o&&!rt(o,e)}function Ie(o){return at(o.value,o.fallback)?d`<button
    type="button"
    class="fp3d-colour-reset"
    title=${o.label}
    aria-label=${o.label}
    ?disabled=${o.disabled}
    @click=${e=>{e.preventDefault(),e.stopPropagation(),o.onReset()}}
  >
    ↺
  </button>`:c}var Oe=P`
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
`;function Ue(o){let e=t=>o.onChange(t.detail.value);return d`<fp3d-colour-field .value=${o.value??null} .label=${o.label} .t=${o.t} .base=${o.base??null} ?clearable=${!!o.clearable} ?disabled=${!!o.disabled} @colour-change=${o.live?null:e} @colour-input=${o.live?e:null} ?menu=${!!o.onMenu} ?expanded=${!!o.expanded} @colour-menu=${o.onMenu??null}></fp3d-colour-field>`}var ie=["pool"];function re(){try{let o=new URLSearchParams(location.search).get("fp3d_lab");return o==="1"?localStorage.setItem("home3d.lab","1"):o==="0"&&localStorage.removeItem("home3d.lab"),localStorage.getItem("home3d.lab")==="1"}catch{return!1}}var I=["view","walls","floors","temperature","humidity","co2"];var w=globalThis.__fp3dLanguages??={extra:new Map,pending:new Map},{extra:O,pending:ae}=w;var lt="home3d.language";function ct(o){w.chosen=o&&o!=="auto"&&/^[a-z]{2,3}$/i.test(o)?o.toLowerCase():null}function Ne(){if(w.chosen===void 0)try{ct(localStorage.getItem(lt))}catch{w.chosen=null}return w.chosen??null}function z(o){let e=(Ne()??o??navigator.language??"en").toLowerCase(),t=e.startsWith("no")?"nb":e.split(/[-_]/)[0];return t==="en"||!/^[a-z]{2,3}$/.test(t)?null:t}function ce(o){let e=z(o);return!e||O.has(e)}var le="home3d.lang.";function dt(o){try{let e=JSON.parse(localStorage.getItem(le+o)??"null");return e&&typeof e.hash=="string"&&e.strings&&typeof e.strings=="object"?e:null}catch{return null}}function ht(o,e,t){try{Object.keys(t).length?localStorage.setItem(le+o,JSON.stringify({hash:e,strings:t})):localStorage.removeItem(le+o)}catch{}}async function ut(o,e){if(!e?.callWS)return{};let t=dt(o);try{let s=await e.callWS({type:"home_3d/languages/get",language:o,...t?{hash:t.hash}:{}});return s.strings&&typeof s.strings=="object"?(ht(o,s.hash,s.strings),s.strings):t&&s.hash===t.hash?t.strings:{}}catch{return t?.strings??{}}}function We(o,e,t=!1){let s=z(o);if(!s||O.has(s)&&!t)return Promise.resolve();let n=ae.get(s);return n||(n=ut(s,e).then(i=>{O.set(s,i)}).finally(()=>ae.delete(s)),ae.set(s,n)),n}function De(o){let e=Ne()??o?.language??navigator.language??"en",t=z(e);if(!t)return/^en(?:-|$)/i.test(e)?e:"en";let s=O.get(t);for(let n in s)return e;return"en"}function Fe(o,e,t={}){let s=z(o?.language??navigator.language),i=(s?O.get(s):void 0)?.[e]??w.en?.[e]??e;for(let[r,a]of Object.entries(t))i=i.replace(`{${r}}`,String(a));return i}var ze={height:420,view:"3d",walls:"auto",explode:!0,roof_fade:!0,roof:!0,camera_wall:!1,quality:"auto",stats:!1,markers:"important",heatmap:"none",theme:"theme",energy:!0,room_panel:!0,fill:!1,controls:!1,fullscreen_button:!1,room_names:!0,floor_stack:"dim",alerts:!0,alert_jump:!1,director:!1,voice:!1,scenes:!0,motion_trail:!1,time_travel:!1,household_card:!0,rack_cards:!0,weather:!0,idle_return:0,controls_hidden:!1,controls_hide_after:0,marker_names:!1,central:!0,pets:!0,ghost:!0,night:"off",idle_orbit:!1},de=class extends b{static properties={hass:{attribute:!1},_config:{state:!0},_floors:{state:!0}};floorsOf=void 0;homesAsked=!1;constructor(){super(),this._config={type:"custom:home-3d-card"},this._floors=[],this._homes=[]}setConfig(e){this._config=e}willUpdate(){this.hass&&!ce(this.hass.language)&&We(this.hass.language,this.hass).then(()=>this.requestUpdate());let e=De(this.hass);this.getAttribute("lang")!==e&&this.setAttribute("lang",e);let t=this._config.home??"";this.hass&&this.floorsOf!==t&&(this.floorsOf=t,Le(this.hass,t||void 0).then(s=>{this.floorsOf===t&&(this._floors=s.building.floors.map(n=>({id:n.id,name:n.name})))},()=>{})),this.hass&&!this.homesAsked&&(this.homesAsked=!0,Me(this.hass).then(s=>this._homes=s.homes,()=>{}))}t(e,t){return Fe(this.hass,e,t)}get value(){return{...ze,...this._config}}set(e,t){let s={...this._config};t===void 0||t===""||ze[e]===t?delete s[e]:s[e]=t,this._config=s,this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:s},bubbles:!0,composed:!0}))}select(e,t,s,n){return d`<label class="field"
      >${this.t(t)}
      <select @change=${i=>this.set(e,i.target.value)}>
        ${s.map(([i,r])=>d`<option value=${i} ?selected=${i===n}>${this.t(r)}</option>`)}
      </select>
    </label>`}toggle(e,t,s){let n=this.value[e];return d`<label class="toggle">
      <input type="checkbox" .checked=${n} @change=${i=>this.set(e,i.target.checked)} />
      <span>${this.t(t)}${s?d`<small>${this.t(s)}</small>`:c}</span>
    </label>`}renderThumbsToggle(){let e=!this._config.floor,t=this._config.floor_thumbs??e;return d`<label class="toggle">
      <input
        type="checkbox"
        .checked=${t}
        @change=${s=>{let n=s.target.checked,i={...this._config};n===e?delete i.floor_thumbs:i.floor_thumbs=n,this._config=i,this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:i},bubbles:!0,composed:!0}))}}
      />
      <span>${this.t("card_floor_thumbs")}<small>${this.t(this._config.floor?"card_floor_thumbs_hint_start":"card_floor_thumbs_hint")}</small></span>
    </label>`}renderControls(){let e=this._config.controls,t=!!e&&(e===!0||e.length>0),s=e===!0?[...I]:Array.isArray(e)?e:[],n=a=>this.set("controls",a.length===I.length?!0:a.length?a:void 0),i=this.value,r=[0,10,30,60,120];return d`<label class="toggle">
        <input type="checkbox" .checked=${t} @change=${a=>this.set("controls",a.target.checked?!0:void 0)} />
        <span>${this.t("card_controls")}<small>${this.t("card_controls_hint")}</small></span>
      </label>
      <label class="toggle">
        <input type="checkbox" .checked=${i.central} @change=${a=>this.set("central",a.target.checked?void 0:!1)} />
        <span>${this.t("card_central")}<small>${this.t("card_central_hint")}</small></span>
      </label>
      ${!ie.includes("fun_pets")||re()?d`<label class="toggle">
            <input type="checkbox" .checked=${i.pets} @change=${a=>this.set("pets",a.target.checked?void 0:!1)} />
            <span>${this.t("card_pets")}<small>${this.t("card_pets_hint")}</small></span>
          </label>`:c}
      ${!ie.includes("fun_halloween")||re()?d`<label class="toggle">
            <input type="checkbox" .checked=${i.ghost} @change=${a=>this.set("ghost",a.target.checked?void 0:!1)} />
            <span>${this.t("card_ghost")}<small>${this.t("card_ghost_hint")}</small></span>
          </label>`:c}
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
          ${r.map(a=>d`<option value=${a} ?selected=${i.controls_hide_after===a}>${a?this.t("card_hide_after_s",{n:a}):this.t("card_idle_off")}</option>`)}
        </select>
      </label>
      ${t?d`<div class="sub">
            ${I.map(a=>d`<label class="chip">
                <input
                  type="checkbox"
                  .checked=${s.includes(a)}
                  @change=${l=>n(l.target.checked?I.filter(u=>u===a||s.includes(u)):s.filter(u=>u!==a))}
                />
                ${this.t(`card_control_${a}`)}
              </label>`)}
          </div>`:c}`}renderKiosk(){let e=this.value,t=e.night==="off"||e.night==="sun"?e.night:"time",s=[0,1,2,5,10];return d`<h3>${this.t("card_section_kiosk")}</h3>
      <div class="grid">
        <label class="field"
          >${this.t("card_idle_return")}
          <select @change=${n=>this.set("idle_return",Number(n.target.value)||void 0)}>
            ${s.map(n=>d`<option value=${n*60} ?selected=${e.idle_return===n*60}>${n?this.t("card_idle_min",{n}):this.t("card_idle_off")}</option>`)}
          </select>
        </label>
        <label class="field"
          >${this.t("card_night")}
          <select @change=${n=>this.set("night",{off:void 0,sun:"sun",time:"22:00-06:00"}[n.target.value])}>
            <option value="off" ?selected=${t==="off"}>${this.t("card_night_off")}</option>
            <option value="sun" ?selected=${t==="sun"}>${this.t("card_night_sun")}</option>
            <option value="time" ?selected=${t==="time"}>${this.t("card_night_time")}</option>
          </select>
        </label>
        ${t==="time"?d`<label class="field wide"
              >${this.t("card_night_range")}
              <input
                type="text"
                pattern="\\d{1,2}:\\d{2}-\\d{1,2}:\\d{2}"
                placeholder="22:00-06:00"
                .value=${e.night}
                @change=${n=>this.set("night",n.target.value.trim()||void 0)}
              />
            </label>`:c}
      </div>
      <p class="hint">${this.t("card_idle_hint")}</p>
      ${this.toggle("idle_orbit","card_idle_orbit","card_idle_orbit_hint")}
      <div class="grid">
        <label class="field wide"
          >${this.t("card_dashboard")}
          <input type="text" placeholder="/lovelace/home" .value=${e.dashboard??""} @change=${n=>this.set("dashboard",n.target.value.trim()||void 0)} />
        </label>
        <label class="field wide"
          >${this.t("card_dashboard_label")}
          <input type="text" .value=${e.dashboard_label??""} @change=${n=>this.set("dashboard_label",n.target.value.trim()||void 0)} />
        </label>
      </div>
      <p class="hint">${this.t("card_dashboard_hint")}</p>`}renderFeatures(){let e=this.value,t=Object.keys(this.hass?.states??{}).filter(s=>s.startsWith("weather.")).sort();return d`<h3>${this.t("card_section_features")}</h3>
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
      ${e.weather!==!1?d`<div class="grid">
            <label class="field wide"
              >${this.t("weather_entity")}
              <select @change=${s=>this.set("weather_entity",s.target.value||void 0)}>
                <option value="" ?selected=${!e.weather_entity}>${this.t("card_weather_plan")}</option>
                ${t.map(s=>d`<option value=${s} ?selected=${s===e.weather_entity}>${String(this.hass?.states[s]?.attributes.friendly_name??s)}</option>`)}
              </select>
            </label>
          </div>`:c}`}render(){if(this.hass&&!ce(this.hass.language))return c;let e=this.value,t=e.flows===void 0?"switch":e.flows?"on":"off",s=e.holograms===void 0?"switch":e.holograms?"on":"off";return d`
      <h3>${this.t("card_section_view")}</h3>
      <div class="grid">
        ${this._homes.length>1||this._config.home?d`<label class="field wide"
              >${this.t("card_home")}
              <select
                @change=${n=>{this.set("floor",void 0),this.set("room",void 0),this.set("home",n.target.value||void 0)}}
              >
                <option value="" ?selected=${!e.home}>${this.t("card_home_active")}</option>
                ${this._homes.map(n=>d`<option value=${n.id} ?selected=${n.id===e.home}>${n.name}</option>`)}
                ${e.home&&!this._homes.some(n=>n.id===e.home)?d`<option value=${e.home} selected>${e.home}</option>`:c}
              </select>
            </label>`:c}
        <label class="field wide"
          >${this.t("card_floor")}
          <select @change=${n=>this.set("floor",n.target.value||void 0)}>
            <option value="" ?selected=${!e.floor}>${this.t("card_floor_house")}</option>
            ${this._floors.map(n=>d`<option value=${n.id} ?selected=${n.id===e.floor}>${n.name}</option>`)}
            ${e.floor&&!this._floors.some(n=>n.id===e.floor)?d`<option value=${e.floor} selected>${e.floor}</option>`:c}
          </select>
        </label>
        <label class="field"
          >${this.t("card_size")}
          <select @change=${n=>this.set("fill",n.target.value==="fill")}>
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
            @change=${n=>{let i=Math.round(Number(n.target.value));i>100&&this.set("height",i)}}
          />
        </label>
        ${this.select("theme","theme",[["theme","theme_theme"],["neon","theme_neon"],["blueprint","theme_blueprint"],["day","theme_day"],["realistic","theme_realistic"],["auto","theme_auto"]],e.theme)}
        ${this.select("clock","clock",[["off","clock_off"],["tl","clock_tl"],["tr","clock_tr"],["bl","clock_bl"],["br","clock_br"]],e.clock??"off")}
        <label class="field"
          >${this.t("accent")}
          <span class="accent-pick"
            >${Ue({value:this._config.accent??null,base:oe,label:this.t("accent"),t:(n,i)=>this.t(n,i),live:!0,onChange:n=>n&&this.set("accent",n)})}
            ${Ie({value:this._config.accent,fallback:oe,label:this.t("accent_reset"),onReset:()=>this.set("accent",void 0)})}</span
          >
        </label>
        ${this.select("view","card_view",[["3d","card_view_3d"],["2d","card_view_2d"]],e.view)}
        ${this.select("walls","card_walls",[["auto","walls_auto"],["cut","walls_cut"]],e.walls)}
        ${this.select("quality","quality",[["auto","quality_auto"],["low","quality_low"],["high","quality_high"]],e.quality)}
        ${this.select("floor_stack","card_floor_stack",[["dim","floor_stack_dim"],["stacked","floor_stack_stacked"],["single","floor_stack_single"]],e.floor_stack)}
      </div>
      ${e.fill?d`<p class="hint">${this.t("card_fill_hint")}</p>`:c}
      <p class="hint">${this.t("card_quality_hint")}</p>

      <h3>${this.t("card_section_show")}</h3>
      <div class="grid">
        ${this.select("markers","markers",[["none","markers_none"],["room","markers_room"],["important","markers_important"],["all","markers_all"]],e.markers)}
        ${this.select("marker_size","pin_size",[["small","pin_size_small"],["normal","pin_size_normal"],["large","pin_size_large"]],e.marker_size??"normal")}
        ${this.select("heatmap","heatmap",[["none","heat_off"],["temperature","heat_temperature"],["humidity","heat_humidity"],["co2","heat_co2"],["values","heat_values"]],e.heatmap)}
        <label class="field wide"
          >${this.t("flows")}
          <select @change=${n=>{let i=n.target.value;this.set("flows",i==="switch"?void 0:i==="on")}}>
            <option value="switch" ?selected=${t==="switch"}>${this.t("card_flows_switch")}</option>
            <option value="on" ?selected=${t==="on"}>${this.t("card_flows_on")}</option>
            <option value="off" ?selected=${t==="off"}>${this.t("card_flows_off")}</option>
          </select>
        </label>
        <label class="field wide"
          >${this.t("holos")}
          <select @change=${n=>{let i=n.target.value;this.set("holograms",i==="switch"?void 0:i==="on")}}>
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
    `}static styles=P`
    .accent-pick {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    ${Oe}
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
  `};me("home-3d-card-editor",de);export{de as Floorplan3dCardEditor};
