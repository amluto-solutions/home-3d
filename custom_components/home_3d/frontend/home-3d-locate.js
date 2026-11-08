var Ce=Symbol.for("home-3d.custom-elements"),le=Symbol.for("home-3d.build"),Ie=["home-3d-panel","home-3d-card"],W=typeof __FP3D_BUILD__=="string"?__FP3D_BUILD__:"dev",k;function U(){let i=globalThis;return i[Ce]??={defined:new Map,watching:!1}}function Fe(){if(k!==void 0)return k;if(W==="dev")return k=!0;let i=globalThis,e=i[le];if(e!==void 0)return k=e===W;let t=globalThis.customElements;return U().defined.size>0||Ie.some(r=>t?.get(r)||ce(r,void 0))?k=!1:(i[le]=W,k=!0)}function ue(){let i=globalThis.customElements;if(i){for(let[e,t]of U().defined)if(t.registry!==i&&(t.registry=i,!i.get(e)))try{i.define(e,t.cls)}catch(n){console.warn(`Home 3D: could not define ${e} in the page's element registry`,n)}}}function ce(i,e){if(typeof document>"u")return;let t;try{t=document.createElement(i)}catch{return}if(Object.getPrototypeOf(t)===HTMLElement.prototype||t instanceof HTMLUnknownElement||!(t instanceof HTMLElement))return;let r=t.constructor;return r===e?void 0:r}function de(i,e){if(!Fe())return!1;ue();let t=globalThis.customElements;if(t.get(i))return!1;let n=U(),r=ce(i,e);if(r){try{t.define(i,r),n.defined.set(i,{cls:r,registry:t})}catch(o){console.warn(`Home 3D: could not define ${i} in the page's element registry`,o)}return!1}return t.define(i,e),n.defined.set(i,{cls:e,registry:t}),n.watching||(n.watching=!0,t.whenDefined("home-assistant").then(ue)),!0}var I=globalThis,F=I.ShadowRoot&&(I.ShadyCSS===void 0||I.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,B=Symbol(),pe=new WeakMap,P=class{constructor(e,t,n){if(this._$cssResult$=!0,n!==B)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,t=this.t;if(F&&e===void 0){let n=t!==void 0&&t.length===1;n&&(e=pe.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),n&&pe.set(t,e))}return e}toString(){return this.cssText}},he=i=>new P(typeof i=="string"?i:i+"",void 0,B),j=(i,...e)=>{let t=i.length===1?i[0]:e.reduce((n,r,o)=>n+(s=>{if(s._$cssResult$===!0)return s.cssText;if(typeof s=="number")return s;throw Error("Value passed to 'css' function must be a 'css' function result: "+s+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(r)+i[o+1],i[0]);return new P(t,i,B)},me=(i,e)=>{if(F)i.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(let t of e){let n=document.createElement("style"),r=I.litNonce;r!==void 0&&n.setAttribute("nonce",r),n.textContent=t.cssText,i.appendChild(n)}},G=F?i=>i:i=>i instanceof CSSStyleSheet?(e=>{let t="";for(let n of e.cssRules)t+=n.cssText;return he(t)})(i):i;var{is:ze,defineProperty:Ne,getOwnPropertyDescriptor:He,getOwnPropertyNames:De,getOwnPropertySymbols:Ve,getPrototypeOf:We}=Object,z=globalThis,ge=z.trustedTypes,Ue=ge?ge.emptyScript:"",Be=z.reactiveElementPolyfillSupport,M=(i,e)=>i,K={toAttribute(i,e){switch(e){case Boolean:i=i?Ue:null;break;case Object:case Array:i=i==null?i:JSON.stringify(i)}return i},fromAttribute(i,e){let t=i;switch(e){case Boolean:t=i!==null;break;case Number:t=i===null?null:Number(i);break;case Object:case Array:try{t=JSON.parse(i)}catch{t=null}}return t}},be=(i,e)=>!ze(i,e),fe={attribute:!0,type:String,converter:K,reflect:!1,useDefault:!1,hasChanged:be};Symbol.metadata??=Symbol("metadata"),z.litPropertyMetadata??=new WeakMap;var b=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=fe){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){let n=Symbol(),r=this.getPropertyDescriptor(e,n,t);r!==void 0&&Ne(this.prototype,e,r)}}static getPropertyDescriptor(e,t,n){let{get:r,set:o}=He(this.prototype,e)??{get(){return this[t]},set(s){this[t]=s}};return{get:r,set(s){let l=r?.call(this);o?.call(this,s),this.requestUpdate(e,l,n)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??fe}static _$Ei(){if(this.hasOwnProperty(M("elementProperties")))return;let e=We(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(M("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(M("properties"))){let t=this.properties,n=[...De(t),...Ve(t)];for(let r of n)this.createProperty(r,t[r])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[n,r]of t)this.elementProperties.set(n,r)}this._$Eh=new Map;for(let[t,n]of this.elementProperties){let r=this._$Eu(t,n);r!==void 0&&this._$Eh.set(r,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let n=new Set(e.flat(1/0).reverse());for(let r of n)t.unshift(G(r))}else e!==void 0&&t.push(G(e));return t}static _$Eu(e,t){let n=t.attribute;return n===!1?void 0:typeof n=="string"?n:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,t=this.constructor.elementProperties;for(let n of t.keys())this.hasOwnProperty(n)&&(e.set(n,this[n]),delete this[n]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return me(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,n){this._$AK(e,n)}_$ET(e,t){let n=this.constructor.elementProperties.get(e),r=this.constructor._$Eu(e,n);if(r!==void 0&&n.reflect===!0){let o=(n.converter?.toAttribute!==void 0?n.converter:K).toAttribute(t,n.type);this._$Em=e,o==null?this.removeAttribute(r):this.setAttribute(r,o),this._$Em=null}}_$AK(e,t){let n=this.constructor,r=n._$Eh.get(e);if(r!==void 0&&this._$Em!==r){let o=n.getPropertyOptions(r),s=typeof o.converter=="function"?{fromAttribute:o.converter}:o.converter?.fromAttribute!==void 0?o.converter:K;this._$Em=r;let l=s.fromAttribute(t,o.type);this[r]=l??this._$Ej?.get(r)??l,this._$Em=null}}requestUpdate(e,t,n,r=!1,o){if(e!==void 0){let s=this.constructor;if(r===!1&&(o=this[e]),n??=s.getPropertyOptions(e),!((n.hasChanged??be)(o,t)||n.useDefault&&n.reflect&&o===this._$Ej?.get(e)&&!this.hasAttribute(s._$Eu(e,n))))return;this.C(e,t,n)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,t,{useDefault:n,reflect:r,wrapped:o},s){n&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,s??t??this[e]),o!==!0||s!==void 0)||(this._$AL.has(e)||(this.hasUpdated||n||(t=void 0),this._$AL.set(e,t)),r===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[r,o]of this._$Ep)this[r]=o;this._$Ep=void 0}let n=this.constructor.elementProperties;if(n.size>0)for(let[r,o]of n){let{wrapped:s}=o,l=this[r];s!==!0||this._$AL.has(r)||l===void 0||this.C(r,void 0,o,l)}}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(n=>n.hostUpdate?.()),this.update(t)):this._$EM()}catch(n){throw e=!1,this._$EM(),n}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(e){}firstUpdated(e){}};b.elementStyles=[],b.shadowRootOptions={mode:"open"},b[M("elementProperties")]=new Map,b[M("finalized")]=new Map,Be?.({ReactiveElement:b}),(z.reactiveElementVersions??=[]).push("2.1.2");var ee=globalThis,_e=i=>i,N=ee.trustedTypes,ye=N?N.createPolicy("lit-html",{createHTML:i=>i}):void 0,Se="$lit$",_=`lit$${Math.random().toFixed(9).slice(2)}$`,Ee="?"+_,je=`<${Ee}>`,w=document,T=()=>w.createComment(""),O=i=>i===null||typeof i!="object"&&typeof i!="function",te=Array.isArray,Ge=i=>te(i)||typeof i?.[Symbol.iterator]=="function",Y=`[ 	
\f\r]`,A=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,xe=/-->/g,ve=/>/g,x=RegExp(`>|${Y}(?:([^\\s"'>=/]+)(${Y}*=${Y}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),we=/'/g,$e=/"/g,Re=/^(?:script|style|textarea|title)$/i,ne=i=>(e,...t)=>({_$litType$:i,strings:e,values:t}),c=ne(1),mt=ne(2),gt=ne(3),$=Symbol.for("lit-noChange"),m=Symbol.for("lit-nothing"),ke=new WeakMap,v=w.createTreeWalker(w,129);function Pe(i,e){if(!te(i)||!i.hasOwnProperty("raw"))throw Error("invalid template strings array");return ye!==void 0?ye.createHTML(e):e}var Ke=(i,e)=>{let t=i.length-1,n=[],r,o=e===2?"<svg>":e===3?"<math>":"",s=A;for(let l=0;l<t;l++){let a=i[l],u,p,d=-1,g=0;for(;g<a.length&&(s.lastIndex=g,p=s.exec(a),p!==null);)g=s.lastIndex,s===A?p[1]==="!--"?s=xe:p[1]!==void 0?s=ve:p[2]!==void 0?(Re.test(p[2])&&(r=RegExp("</"+p[2],"g")),s=x):p[3]!==void 0&&(s=x):s===x?p[0]===">"?(s=r??A,d=-1):p[1]===void 0?d=-2:(d=s.lastIndex-p[2].length,u=p[1],s=p[3]===void 0?x:p[3]==='"'?$e:we):s===$e||s===we?s=x:s===xe||s===ve?s=A:(s=x,r=void 0);let f=s===x&&i[l+1].startsWith("/>")?" ":"";o+=s===A?a+je:d>=0?(n.push(u),a.slice(0,d)+Se+a.slice(d)+_+f):a+_+(d===-2?l:f)}return[Pe(i,o+(i[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),n]},L=class i{constructor({strings:e,_$litType$:t},n){let r;this.parts=[];let o=0,s=0,l=e.length-1,a=this.parts,[u,p]=Ke(e,t);if(this.el=i.createElement(u,n),v.currentNode=this.el.content,t===2||t===3){let d=this.el.content.firstChild;d.replaceWith(...d.childNodes)}for(;(r=v.nextNode())!==null&&a.length<l;){if(r.nodeType===1){if(r.hasAttributes())for(let d of r.getAttributeNames())if(d.endsWith(Se)){let g=p[s++],f=r.getAttribute(d).split(_),h=/([.?@])?(.*)/.exec(g);a.push({type:1,index:o,name:h[2],strings:f,ctor:h[1]==="."?Z:h[1]==="?"?J:h[1]==="@"?X:E}),r.removeAttribute(d)}else d.startsWith(_)&&(a.push({type:6,index:o}),r.removeAttribute(d));if(Re.test(r.tagName)){let d=r.textContent.split(_),g=d.length-1;if(g>0){r.textContent=N?N.emptyScript:"";for(let f=0;f<g;f++)r.append(d[f],T()),v.nextNode(),a.push({type:2,index:++o});r.append(d[g],T())}}}else if(r.nodeType===8)if(r.data===Ee)a.push({type:2,index:o});else{let d=-1;for(;(d=r.data.indexOf(_,d+1))!==-1;)a.push({type:7,index:o}),d+=_.length-1}o++}}static createElement(e,t){let n=w.createElement("template");return n.innerHTML=e,n}};function S(i,e,t=i,n){if(e===$)return e;let r=n!==void 0?t._$Co?.[n]:t._$Cl,o=O(e)?void 0:e._$litDirective$;return r?.constructor!==o&&(r?._$AO?.(!1),o===void 0?r=void 0:(r=new o(i),r._$AT(i,t,n)),n!==void 0?(t._$Co??=[])[n]=r:t._$Cl=r),r!==void 0&&(e=S(i,r._$AS(i,e.values),r,n)),e}var q=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:n}=this._$AD,r=(e?.creationScope??w).importNode(t,!0);v.currentNode=r;let o=v.nextNode(),s=0,l=0,a=n[0];for(;a!==void 0;){if(s===a.index){let u;a.type===2?u=new C(o,o.nextSibling,this,e):a.type===1?u=new a.ctor(o,a.name,a.strings,this,e):a.type===6&&(u=new Q(o,this,e)),this._$AV.push(u),a=n[++l]}s!==a?.index&&(o=v.nextNode(),s++)}return v.currentNode=w,r}p(e){let t=0;for(let n of this._$AV)n!==void 0&&(n.strings!==void 0?(n._$AI(e,n,t),t+=n.strings.length-2):n._$AI(e[t])),t++}},C=class i{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,n,r){this.type=2,this._$AH=m,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=n,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=S(this,e,t),O(e)?e===m||e==null||e===""?(this._$AH!==m&&this._$AR(),this._$AH=m):e!==this._$AH&&e!==$&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):Ge(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==m&&O(this._$AH)?this._$AA.nextSibling.data=e:this.T(w.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:n}=e,r=typeof n=="number"?this._$AC(e):(n.el===void 0&&(n.el=L.createElement(Pe(n.h,n.h[0]),this.options)),n);if(this._$AH?._$AD===r)this._$AH.p(t);else{let o=new q(r,this),s=o.u(this.options);o.p(t),this.T(s),this._$AH=o}}_$AC(e){let t=ke.get(e.strings);return t===void 0&&ke.set(e.strings,t=new L(e)),t}k(e){te(this._$AH)||(this._$AH=[],this._$AR());let t=this._$AH,n,r=0;for(let o of e)r===t.length?t.push(n=new i(this.O(T()),this.O(T()),this,this.options)):n=t[r],n._$AI(o),r++;r<t.length&&(this._$AR(n&&n._$AB.nextSibling,r),t.length=r)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){let n=_e(e).nextSibling;_e(e).remove(),e=n}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},E=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,n,r,o){this.type=1,this._$AH=m,this._$AN=void 0,this.element=e,this.name=t,this._$AM=r,this.options=o,n.length>2||n[0]!==""||n[1]!==""?(this._$AH=Array(n.length-1).fill(new String),this.strings=n):this._$AH=m}_$AI(e,t=this,n,r){let o=this.strings,s=!1;if(o===void 0)e=S(this,e,t,0),s=!O(e)||e!==this._$AH&&e!==$,s&&(this._$AH=e);else{let l=e,a,u;for(e=o[0],a=0;a<o.length-1;a++)u=S(this,l[n+a],t,a),u===$&&(u=this._$AH[a]),s||=!O(u)||u!==this._$AH[a],u===m?e=m:e!==m&&(e+=(u??"")+o[a+1]),this._$AH[a]=u}s&&!r&&this.j(e)}j(e){e===m?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},Z=class extends E{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===m?void 0:e}},J=class extends E{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==m)}},X=class extends E{constructor(e,t,n,r,o){super(e,t,n,r,o),this.type=5}_$AI(e,t=this){if((e=S(this,e,t,0)??m)===$)return;let n=this._$AH,r=e===m&&n!==m||e.capture!==n.capture||e.once!==n.once||e.passive!==n.passive,o=e!==m&&(n===m||r);r&&this.element.removeEventListener(this.name,this,n),o&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},Q=class{constructor(e,t,n){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=n}get _$AU(){return this._$AM._$AU}_$AI(e){S(this,e)}};var Ye=ee.litHtmlPolyfillSupport;Ye?.(L,C),(ee.litHtmlVersions??=[]).push("3.3.3");var Me=(i,e,t)=>{let n=t?.renderBefore??e,r=n._$litPart$;if(r===void 0){let o=t?.renderBefore??null;n._$litPart$=r=new C(e.insertBefore(T(),o),o,void 0,t??{})}return r._$AI(i),r};var re=globalThis,y=class extends b{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Me(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return $}};y._$litElement$=!0,y.finalized=!0,re.litElementHydrateSupport?.({LitElement:y});var qe=re.litElementPolyfillSupport;qe?.({LitElement:y});(re.litElementVersions??=[]).push("4.2.2");var R=globalThis.__fp3dLanguages??={extra:new Map,pending:new Map},{extra:Ze,pending:Pt}=R;var Je="home3d.language";function Xe(i){R.chosen=i&&i!=="auto"&&/^[a-z]{2,3}$/i.test(i)?i.toLowerCase():null}function Qe(){if(R.chosen===void 0)try{Xe(localStorage.getItem(Je))}catch{R.chosen=null}return R.chosen??null}function et(i){let e=(Qe()??i??navigator.language??"en").toLowerCase(),t=e.startsWith("no")?"nb":e.split(/[-_]/)[0];return t==="en"||!/^[a-z]{2,3}$/.test(t)?null:t}function Ae(i,e,t={}){let n=et(i?.language??navigator.language),o=(n?Ze.get(n):void 0)?.[e]??R.en?.[e]??e;for(let[s,l]of Object.entries(t))o=o.replace(`{${s}}`,String(l));return o}var Te=globalThis;function tt(i){let e=i??{};return String(e.message??e.error?.message??e.code??i)}var H,oe=160;function nt(i){if(i.length<=oe)return i;let e=i.slice(0,oe),t=e.lastIndexOf(" ");return`${(t>oe*.6?e.slice(0,t):e).trimEnd()} \u2026`}function rt(i){if(Te.__fp3dFailureSink)return Te.__fp3dFailureSink(i);if(typeof document>"u")return;let e=document.fullscreenElement;for(;e?.shadowRoot?.fullscreenElement;)e=e.shadowRoot.fullscreenElement;let t=e??document.body,n=t.querySelector(":scope > .fp3d-failure");n||(n=document.createElement("div"),n.className="fp3d-failure",n.setAttribute("role","alert"),n.style.cssText="position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top, 0px));transform:translateX(-50%);cursor:pointer;z-index:2147483000;max-width:min(92vw,520px);padding:12px 16px;border-radius:12px;background:#8a1f1f;color:#fff;font:14px/1.35 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.45);",t.appendChild(n));let r=n;r.textContent=nt(i),r.title=i,r.onclick=()=>{r.textContent=i,clearTimeout(H),H=setTimeout(()=>r.remove(),12e3)},clearTimeout(H),H=setTimeout(()=>r.remove(),6e3)}function ie(i,e,t,n,r){let o=s=>rt(r(tt(s)));try{Promise.resolve(i.callService(e,t,n,void 0,!1)).catch(o)}catch(s){o(s)}}var it={type:"none",pitch:35,overhang:.4},Kt={wall_exterior:.24,wall_interior:.12,grid:.05,north:0,roof:{...it}};var st=new Set(["lamp_ceiling","lamp_fan","lamp_downlight","lamp_spot","lamp_panel","lamp_pendant","lamp_floor","lamp_uplight","lamp_table","lamp_wall","led_strip","lamp_bollard","lamp_garden"]);var ot=new Set([...st,"radiator","ac_unit","awning","robot_vacuum","inverter","home_battery","wallbox","meter","pool_pump","pool_heat_pump","pool_dosing","tv_board","tv_wall","desk","fridge","fridge_smart","stove","kitchen_tall","dishwasher","washer","dryer","kitchen","island","sink"]);function D(i,e){let t=!1;for(let n=0,r=e.length-1;n<e.length;r=n++){let[o,s]=e[n],[l,a]=e[r];s>i[1]!=a>i[1]&&i[0]<(l-o)*(i[1]-s)/(a-s)+o&&(t=!t)}return t}function Oe(i){return i.floors.flatMap(e=>e.rooms.map(t=>({id:t.id,name:t.name,floor:e.name,area_id:t.area_id??null})))}function se(i,e,t,n){return i.floors.find(o=>o.id===e)?.rooms.find(o=>D([t,n],o.points))?.id??null}function Le(i){let e=i.trim().replace(/^irk:/i,""),t=e.replace(/[\s:-]/g,"");if(/^[0-9a-f]{32}$/i.test(t))return t.toLowerCase();try{let n=atob(e.replace(/\s/g,""));if(n.length===16)return[...n].map(r=>r.charCodeAt(0).toString(16).padStart(2,"0")).join("")}catch{}return null}var at=/^([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})_(\d{1,5})_(\d{1,5})$/i;function lt(i){let e=[],t=n=>n.toString(16).padStart(4,"0");for(let[n,r]of Object.entries(i.states)){if(!n.startsWith("sensor."))continue;let o=r.attributes??{};if(!("Transmitting power"in o))continue;let s=at.exec(String(o.id??""));if(!s)continue;let l=Number(s[6]),a=Number(s[7]);if(l>65535||a>65535)continue;let u=i.entities?.[n]?.device_id??null,p=u?i.devices?.[u]:void 0,d=String(o.friendly_name??n).replace(/\s*BLE[\s_-]*Transmitter\s*$/i,""),g=u&&Object.entries(i.states).find(([f,h])=>f.startsWith("person.")&&(h.attributes?.device_trackers??[]).some(V=>i.entities?.[V]?.device_id===u))?.[0]||null;e.push({entity:n,name:p?.name_by_user||p?.name||d,key:(s.slice(1,6).join("")+t(l)+t(a)).toLowerCase(),state:String(r.state),power:String(o["Transmitting power"]??""),mode:String(o["Advertise mode"]??""),person:g})}return e.sort((n,r)=>n.name.localeCompare(r.name))}var ae=class extends y{static properties={hass:{attribute:!1},building:{attribute:!1},_step:{state:!0},_cfg:{state:!0},_near:{state:!0},_live:{state:!0},_quality:{state:!0},_error:{state:!0}};constructor(){super(),this._step="scanners",this._cfg=null,this._near=[],this._live=null,this._quality=null,this._error=""}timer=0;hassSource=null;setLook=null;unsub=null;get t(){let e=this.hass;return new Proxy({},{get:(t,n)=>Ae(e,`loc_${String(n)}`)})}get voiceLanguage(){return/^en/.test(this.hass?.language??"en")}tr(e,t){return e.replace(/\{(\w+)\}/g,(n,r)=>String(t[r]??""))}get rooms(){return Oe(this.building)}connectedCallback(){super.connectedCallback(),this.closed=!1,this.load().catch(e=>this._error=`load: ${e?.stack??String(e)}`),this.timer=window.setInterval(()=>{this.tick()},1e3),this.hass.connection.subscribeMessage(e=>this._live=e,{type:"home_3d/locate/subscribe"}).then(e=>{this.closed?e():this.unsub=e}).catch(()=>{})}closed=!1;disconnectedCallback(){super.disconnectedCallback(),this.closed=!0,window.clearInterval(this.timer),this.unsub?.(),this.unsub=null}async call(e,t=!1){try{return t||(this._error=""),await this.hass.callWS(e)}catch(n){return this._error=n.message??String(n),null}}async load(){let e=await this.call({type:"home_3d/locate/config"});if(!e)return;let t={...e.scanner_rooms},n=!1;for(let r of e.scanners){if(t[r.source])continue;let o=this.guessRoom(r)??e.scanner_hints?.[r.source]??null;o&&(t[r.source]=o,n=!0)}this._cfg={...e,scanner_rooms:t},n&&await this.save({scanner_rooms:t})}guessRoom(e){let t=u=>typeof u=="string"&&!!e.device_id&&this.hass.entities?.[u]?.device_id===e.device_id;if(e.device_id)for(let u of this.building.floors){for(let p of u.placements){let d=t(p.entity_id)?se(this.building,u.id,p.x,p.z):null;if(d)return d}for(let p of u.furniture){if(!Object.values(p).some(t))continue;let d=se(this.building,u.id,p.x,p.z);if(d)return d}}let n=e.device_id??Object.values(this.hass.devices??{}).find(u=>[u.name_by_user,u.name].some(p=>p&&p.toLowerCase()===e.name.toLowerCase()))?.id??null,r=n?Object.values(this.hass.entities??{}).filter(u=>u.device_id===n&&u.area_id).map(u=>u.area_id):[],o=e.area_id??(n?this.hass.devices?.[n]?.area_id:null)??r[0]??null;if(o){let u=this.rooms.find(p=>p.area_id===o);if(u)return u.id}let s=u=>u.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g," "),l=` ${s(e.name)} `,a=this.rooms.filter(u=>s(u.name).trim().length>=3&&l.includes(s(u.name).trim()));return a.sort((u,p)=>s(p.name).length-s(u.name).length),a.length&&a.filter(u=>s(u.name)===s(a[0].name)).length===1?a[0].id:null}async save(e){let t=await this.call({type:"home_3d/locate/configure",...e});t&&(this._cfg={...t,scanner_rooms:{...t.scanner_rooms}})}async tick(){let e=this.hassSource?.();if(e&&e!==this.hass&&(this.hass=e),this._step==="devices"&&this.nearOpen){let t=await this.call({type:"home_3d/locate/nearby"},!0);t&&(this._near=t.devices)}if(this._step==="walk"){let t=await this.call({type:"home_3d/locate/calibrate",action:"status"},!0);t&&this._cfg&&(this._cfg={...this._cfg,samples:t.samples},this._live={...this._live??{running:!0,devices:[]},calibration:t.calibration})}}render(){let e=this.t,t=this._cfg,n=[["scanners",e.s_scanners],["devices",e.s_devices],["walk",e.s_walk],["live",e.s_live]];return c`<div class="box" role="dialog" aria-label=${e.title}>
      <header>
        <b>📡 ${e.title}</b>
        <button class="x" @click=${()=>this.remove()} aria-label=${e.close}>✕</button>
      </header>
      <nav>${n.map(([r,o])=>c`<button class=${this._step===r?"on":""} @click=${()=>this._step=r}>${o}</button>`)}</nav>
      ${this._error?c`<pre class="err">${this._error}</pre>`:m}
      ${t?t.bluetooth?this.renderStep(t):c`<p>${e.no_bt}</p>`:c`<p>…</p>`}
    </div>`}renderStep(e){switch(this._step){case"scanners":return this.renderScanners(e);case"devices":return this.renderDevices(e);case"walk":return this.renderWalk(e);default:return this.renderLive(e)}}roomSelect(e,t){let n=[...new Set(this.rooms.map(r=>r.floor))];return c`<select @change=${r=>t(r.target.value||null)}>
      <option value="" ?selected=${!e}>${this.t.not_placed}</option>
      ${n.map(r=>c`<optgroup label=${r}>${this.rooms.filter(o=>o.floor===r).map(o=>c`<option value=${o.id} ?selected=${o.id===e}>${o.name}</option>`)}</optgroup>`)}
    </select>`}renderScanners(e){let t=this.t,n=new Set(Object.values(e.scanner_rooms)),r=this.rooms.filter(o=>!n.has(o.id));return c`<p>${t.scanners_intro}</p>
      <ul class="list">
        ${e.scanners.map(o=>c`<li>
            <span><b>${o.name}</b><small>${o.offline?`\u26A0 ${t.offline}`:o.kind==="shelly"?"Shelly":o.kind==="esphome"?"ESPHome":"Bluetooth"}</small></span>
            ${this.roomSelect(e.scanner_rooms[o.source]??null,s=>{let l={...e.scanner_rooms};s?l[o.source]=s:delete l[o.source],this.save({scanner_rooms:l})})}
            ${e.scanner_hints?.[o.source]&&e.scanner_hints[o.source]!==e.scanner_rooms[o.source]?c`<button class="ghost" @click=${()=>{this.save({scanner_rooms:{...e.scanner_rooms,[o.source]:e.scanner_hints[o.source]}})}}>
                  ${this.tr(t.hint_room,{room:this.rooms.find(s=>s.id===e.scanner_hints[o.source])?.name??""})}
                </button>`:m}
          </li>`)}
      </ul>
      ${r.length?c`<p class="hint">${t.coverage} ${r.map(o=>o.name).join(", ")}</p>`:m}
      <p class="end"><button class="primary" @click=${()=>this._step="devices"}>${t.next} →</button></p>`}personSelect(e,t){let n=Object.keys(this.hass.states).filter(r=>r.startsWith("person."));return c`<select @change=${r=>t(r.target.value||null)}>
      <option value="" ?selected=${!e}>${this.t.person}: ${this.t.none}</option>
      ${n.map(r=>c`<option value=${r} ?selected=${r===e}>${this.hass.states[r].attributes.friendly_name??r}</option>`)}
    </select>`}keyHelpers(){let e=[];for(let[t,n]of Object.entries(this.hass.states)){let r=n.attributes.options;if(!t.startsWith("select.")||!Array.isArray(r)||!r.includes("Heart Sensor")||!r.includes("Keyboard"))continue;let o=this.hass.entities?.[t]?.device_id,s=Object.values(this.hass.entities??{}).find(d=>d.device_id===o&&/_irk$/.test(d.entity_id))?.entity_id,l=s?this.hass.states[s]?.state:void 0,a=o?this.hass.devices?.[o]:void 0,u=a?.name_by_user||a?.name||String(n.attributes.friendly_name??t),p=Object.values(this.hass.entities??{}).find(d=>d.device_id===o&&/_refresh_ble_identity$/.test(d.entity_id))?.entity_id??null;e.push({name:u,select:t,option:n.state,irk:l?Le(l):null,ours:a?.model==="home3d_key"||/home3d[ _]key/i.test(t),refresh:p})}return e.sort((t,n)=>Number(n.ours)-Number(t.ours))}notCarried=new Set;nearOpen=!1;helperId=null;helperName="";helperPerson=null;helperAdded=null;renderKeyHelper(e){let t=this.t,n=this.keyHelpers(),r=n.find(h=>h.select===this.helperId)??n[0],o=c`<div class="helper-head">
        <h4>${t.helper_title}</h4>
      </div>
      <p class="hint">${t.helper_pitch}</p>
      <p class="hint">${t.helper_android}</p>`;if(!r)return o;let s=r.option==="Heart Sensor",l=h=>ie(this.hass,"select","select_option",{entity_id:r.select,option:h},V=>V),a=h=>h.match(/../g).reverse().join(""),u=h=>!!r.irk&&!!h&&(h.toLowerCase()===r.irk||h.toLowerCase()===a(r.irk)),p=e.devices.find(h=>u(h.key))?.name??null,d=e.private_ble.find(h=>u(h.key))?.title??null,g=this.helperName||(s?"Apple Watch":"iPhone"),f=h=>`${h.slice(0,4)}\u2026${h.slice(-4)}`;return c`${o}
      ${n.length>1?c`<p class="hint">
            <select
              @change=${h=>{this.helperId=h.target.value,this.requestUpdate()}}
            >
              ${n.map(h=>c`<option value=${h.select} ?selected=${h.select===r.select}>${h.name}</option>`)}
            </select>
          </p>`:c`<p class="hint">${this.tr(t.helper_found,{name:r.name})}</p>`}
      <div class="row">
        <button class=${s?"on":""} @click=${()=>l("Heart Sensor")}>⌚ ${t.helper_watch}</button>
        <button class=${s?"":"on"} @click=${()=>l("Keyboard")}>📱 ${t.helper_phone}</button>
      </div>
      <div class="row">
        <input
          placeholder=${t.helper_name}
          title=${t.helper_name}
          .value=${this.helperName}
          @input=${h=>this.helperName=h.target.value}
        />
        ${this.personSelect(this.helperPerson,h=>{this.helperPerson=h,this.requestUpdate()})}
      </div>
      <p class="hint">${s?t.helper_watch_steps:t.helper_phone_steps}</p>
      <ul class="list">
        <li>
          <span>
            <b>${t.helper_irk}</b>
            <small>${r.irk?f(r.irk):t.helper_wait}</small>
            ${p||d?c`<small>${this.tr(t.helper_belongs,{name:p??d??""})}</small>`:m}
          </span>
          ${r.irk&&!p?c`<button
                class="primary"
                @click=${()=>{this.addDevice(e,{name:g,kind:"irk",key:r.irk},this.helperPerson),this.helperAdded=g,this.helperName=""}}
              >
                ${this.tr(t.helper_add_as,{name:g})}
              </button>`:m}
        </li>
      </ul>
      ${this.helperAdded?c`<p class="hint">${this.tr(t.helper_added,{name:this.helperAdded})}</p>`:m}
      <p class="hint">${t.helper_after}</p>
      ${r.refresh?c`<p class="end">
            <small>${t.helper_next_hint}</small>
            <button @click=${()=>ie(this.hass,"button","press",{entity_id:r.refresh},h=>h)}>${t.helper_next}</button>
          </p>`:m}`}notifySelect(e,t){let n=this.hass.services,r=Object.keys(n?.notify??{}).filter(o=>o.startsWith("mobile_app_"));return r.length?c`<select title=${this.t.ring_hint} @change=${o=>t(o.target.value||null)}>
      <option value="" ?selected=${!e}>🔔 ${this.t.ring}: ${this.t.none}</option>
      ${r.map(o=>c`<option value=${`notify.${o}`} ?selected=${e===`notify.${o}`}>🔔 ${o.replace(/^mobile_app_/,"").replace(/_/g," ")}</option>`)}
    </select>`:m}phoneGuide(e,t=!1,n){let r=this.t,o=e==="android",s=o?[r.guide_android_1,r.guide_android_2,r.guide_android_3,r.guide_android_4]:[r.guide_iphone_1,r.guide_iphone_2,r.guide_iphone_3,r.guide_iphone_4],l=o?"https://companion.home-assistant.io/docs/core/sensors/#bluetooth-sensors":"https://www.home-assistant.io/integrations/private_ble_device/";return c`<details class="guide" ?open=${t}>
      <summary>${o?r.guide_android_title:r.guide_iphone_title}</summary>
      <ol>
        ${s.map(a=>c`<li class=${n&&a!==n?"dim":""}>${a}</li>`)}
      </ol>
      <a href=${l} target="_blank" rel="noopener noreferrer">${o?r.guide_android_link:r.guide_iphone_link}</a>
    </details>`}unheardBadge(e,t){let n=this._live;if(!n?.running)return m;let r=n.devices.find(o=>o.id===e);return!r||r.room||r.last_seen&&Date.now()/1e3-r.last_seen<120?m:c`<small class="warn" title=${this.t.unheard_hint}>${this.t.unheard}</small>${this.phoneGuide(t==="irk"?"iphone":"android")}`}addDevice(e,t,n=null){let r=`${t.kind}_${t.key.replace(/[^a-z0-9]/gi,"").slice(-10).toLowerCase()}`;e.devices.some(o=>o.id===r)||this.save({devices:[...e.devices,{...t,id:r,person:n,icon:null}]})}renderDevices(e){let t=this.t,n=s=>e.devices.some(l=>l.key.toLowerCase()===s.toLowerCase()),r=(s,l)=>{this.save({devices:e.devices.map(a=>a.id===s?{...a,...l}:a)})},o=lt(this.hass);return c`<p>${t.devices_intro}</p>
      ${e.devices.length?c`<ul class="list">
            ${e.devices.map(s=>c`<li>
                <input .value=${s.name} @change=${l=>r(s.id,{name:l.target.value})} />
                ${this.personSelect(s.person,l=>r(s.id,{person:l}))}
                ${this.notifySelect(s.notify??null,l=>r(s.id,{notify:l}))}
                <label class="row" title=${t.worn_hint}
                  ><input type="checkbox" .checked=${!!s.wearable} @change=${l=>r(s.id,{wearable:l.target.checked})} />⌚
                  ${t.worn}</label
                >
                ${this.unheardBadge(s.id,s.kind)}
                <button @click=${()=>{this.save({devices:e.devices.filter(l=>l.id!==s.id)})}}>${t.remove}</button>
              </li>`)}
          </ul>`:m}
      ${o.length?c`<h4>📱 ${t.app_title}</h4>
            <ul class="list">
              ${o.map(s=>{let l=[s.state!=="Transmitting"?{text:t.app_off,step:t.guide_android_2}:null,s.power==="ultraLow"||s.power==="low"?{text:t.app_power,step:t.guide_android_3}:null,s.mode==="lowPower"?{text:t.app_mode,step:t.guide_android_4}:null].filter(a=>!!a);return c`<li>
                  <span
                    ><b>${s.name}</b>${l.map(a=>c`<small class="warn">⚠ ${a.text}</small>`)}${l.length?this.phoneGuide("android",!0,l[0].step):m}</span
                  >
                  ${n(s.key)?c`<small>${t.added}</small>`:c`<button @click=${()=>this.addDevice(e,{name:s.name,kind:"ibeacon",key:s.key},s.person)}>${t.add}</button>`}
                </li>`})}
            </ul>`:m}
      ${o.length?m:this.phoneGuide("android")}
      ${this.phoneGuide("iphone")}
      ${this.renderKeyHelper(e)}
      <details
        class="pbd"
        @toggle=${s=>{this.nearOpen=s.target.open}}
      >
        <summary>📱 ${t.near_summary}</summary>
        <p class="hint">${t.near_intro}</p>
        ${o.length?m:c`<p class="hint">${t.app_none}</p>`}
        <ul class="list">
          ${(()=>{let s=new Set,l=this._near.filter(a=>a.ibeacon?a.rssi>=-90:!a.random&&a.rssi>=-68).sort((a,u)=>+!!u.ibeacon-+!!a.ibeacon||u.rssi-a.rssi).filter(a=>!a.ibeacon||!s.has(a.ibeacon)&&!!s.add(a.ibeacon)).slice(0,5);return l.length?l.map(a=>c`<li>
                    <span><b>${a.ibeacon?`\u{1F4F1} ${t.android_label}`:a.name??a.address}</b><small>${a.rssi} dBm</small></span>
                    ${n(a.ibeacon??a.address)?c`<small>${t.added}</small>`:c`<button @click=${()=>this.addDevice(e,a.ibeacon?{name:t.android_label,kind:"ibeacon",key:a.ibeacon}:{name:a.name??a.address,kind:"mac",key:a.address})}>${t.add}</button>`}
                  </li>`):c`<li><small>${t.near_empty}</small></li>`})()}
        </ul>
      </details>
      <details class="pbd">
        <summary>🔑 ${t.paste_summary}</summary>
      <div class="row">
        <input id="keyname" placeholder=${t.key_name} />
        <input id="keyvalue" placeholder=${t.key_value} spellcheck="false" autocomplete="off" />
        <button
          @click=${()=>{let s=this.renderRoot.querySelector("#keyname").value.trim(),l=Le(this.renderRoot.querySelector("#keyvalue").value);if(!l){this._error=t.key_bad;return}this._error="",this.addDevice(e,{name:s||"iPhone",kind:"irk",key:l})}}
        >
          ${t.add}
        </button>
      </div>
      </details>
      <p class="hint">${t.irk_help}</p>
      <p class="end"><button class="primary" ?disabled=${!e.devices.length} @click=${()=>this._step="walk"}>${t.next} →</button></p>`}renderWalk(e){let t=this.t,n=this._live?.calibration??null;if(!e.devices.length)return c`<p>${t.need_device}</p>`;let r=l=>Math.max(0,...e.devices.map(a=>e.samples[a.id]?.[l]??0)),o=[...new Set(this.rooms.map(l=>l.floor))],s=this._quality;return c`<p>${t.walk_intro}</p>
      ${e.devices.length>1?c`<div class="row">
            <b>${t.carry}</b>
            ${e.devices.map(l=>c`<label class="row"
                ><input
                  type="checkbox"
                  .checked=${!this.notCarried.has(l.id)}
                  @change=${a=>{a.target.checked?this.notCarried.delete(l.id):this.notCarried.add(l.id),this.requestUpdate()}}
                />
                ${l.name} ${this.unheardBadge(l.id)}</label
              >`)}
          </div>`:m}
      ${n?c`<div class="learning">
            ${this.tr(t.learning,{room:this.rooms.find(l=>l.id===n.room)?.name??"",left:n.left})}
            <div class="bar"><i style="width:${Math.round((90-n.left)/90*100)}%"></i></div>
            <button @click=${()=>{this.call({type:"home_3d/locate/calibrate",action:"stop"})}}>${t.stop}</button>
          </div>`:m}
      ${o.map(l=>c`<h4>${l}</h4>
          <div class="rooms">
            ${this.rooms.filter(a=>a.floor===l).map(a=>{let u=r(a.id),p=s&&u>0?e.devices.map(g=>s[g.id]?.rooms[a.id]).filter(g=>typeof g=="number"):[],d=p.length?Math.min(...p):null;return c`<button
                  class=${n?.room===a.id?"on":u>=30?"done":""}
                  ?disabled=${!!n}
                  @click=${async()=>{let g=e.devices.filter(h=>!this.notCarried.has(h.id)).map(h=>h.id),f=await this.call({type:"home_3d/locate/calibrate",action:"start",room:a.id,seconds:90,devices:g});f&&(this._live={...this._live??{running:!0,devices:[]},calibration:f.calibration}),f&&!e.enabled&&await this.save({enabled:!0})}}
                >
                  ${u>=30?"\u2713 ":""}${a.name}<small>${this.tr(t.samples,{n:u})}${d!==null?` \xB7 ${Math.round(d*100)} %`:""}</small>
                </button>`})}
          </div>`)}
      <p class="end">
        <button @click=${async()=>this._quality=await this.call({type:"home_3d/locate/quality"})}>${t.quality}</button>
        ${s?c`<b>${this.tr(t.quality_result,{p:e.devices.map(l=>`${l.name} ${s[l.id]?.overall!=null?Math.round(s[l.id].overall*100):"\u2013"} %`).join(" \xB7 ")})}</b>`:m}
        <button class="primary" @click=${()=>this._step="live"}>${t.next} →</button>
      </p>
      <p class="end"><button class="ghost" @click=${()=>{this.call({type:"home_3d/locate/calibrate",action:"clear"}).then(()=>this.load())}}>${t.relearn_all}</button></p>`}renderLive(e){let t=this.t,n=this._live,r=o=>this.rooms.find(s=>s.id===o)?.name;return c`<p>${t.live_intro}</p>
      ${this.voiceLanguage?c`<p class="hint">${t.voice_hint}</p>`:m}
      <label class="row"><input type="checkbox" .checked=${e.enabled} @change=${o=>{this.save({enabled:o.target.checked})}} /> ${t.enabled}</label>
      <label class="row"><input type="checkbox" .checked=${e.admins_only} @change=${o=>{this.save({admins_only:o.target.checked})}} /> ${t.admins_only}</label>
      <label class="row" title=${t.person_sensors_hint}
        ><input type="checkbox" .checked=${e.person_sensors===!1} @change=${o=>{this.save({person_sensors:!o.target.checked})}} /> ${t.person_sensors}</label
      >
      <label class="row" title=${t.fly_hint}
        ><input type="checkbox" .checked=${e.fly!==!1} @change=${o=>{this.save({fly:o.target.checked})}} /> ${t.fly}</label
      >
      ${this.setLook?c`<div class="row">
            <b>${t.look_title}</b>
            ${["figure","pin","off"].map(o=>c`<button
                class=${(this.building.settings.person_look??"figure")===o?"on":""}
                @click=${()=>{this.setLook?.(o),this.building={...this.building,settings:{...this.building.settings,person_look:o==="figure"?null:o}}}}
              >
                ${o==="figure"?t.look_figure:o==="pin"?t.look_pin:t.look_off}
              </button>`)}
          </div>`:m}
      <ul class="list big">
        ${(n?.devices??[]).map(o=>c`<li>
            <span><b>${o.name}</b></span>
            <span>${o.room?c`<b class="room">${r(o.room)}</b> <small>${Math.round((o.probability??0)*100)} %</small>`:c`<small>${t.not_heard}</small>`}</span>
          </li>`)}
      </ul>`}static styles=j`
    :host {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      background: #02060fcc;
      font: 14px/1.4 system-ui, sans-serif;
      color: #e6f7ff;
    }
    .box {
      width: min(640px, calc(100vw - 16px));
      max-height: calc(100vh - 16px);
      overflow: auto;
      background: #0b1120;
      border: 1px solid #37e0ff66;
      border-radius: 14px;
      padding: 14px;
      box-shadow: 0 10px 40px #000a;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    header small {
      font-weight: 400;
      color: #ffb86b;
      margin-left: 6px;
    }
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 10px 0;
    }
    button,
    select,
    input {
      font: inherit;
      color: #e6f7ff;
      background: #16233d;
      border: 1px solid #37e0ff44;
      border-radius: 8px;
      padding: 7px 10px;
    }
    button {
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    button.on,
    button.primary {
      background: #37e0ff;
      color: #04121c;
      font-weight: 700;
    }
    button.done {
      border-color: #5dd39e;
    }
    button.ghost {
      background: transparent;
    }
    .x {
      background: transparent;
      border: none;
      font-size: 18px;
    }
    .list {
      list-style: none;
      padding: 0;
      margin: 8px 0;
      display: grid;
      gap: 6px;
    }
    .list li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      background: #101a2e;
      border-radius: 10px;
      padding: 8px 10px;
    }
    .list li span {
      display: flex;
      flex-direction: column;
    }
    .list.big li {
      font-size: 16px;
    }
    small {
      opacity: 0.75;
      font-size: 12px;
    }
    .rooms {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .rooms button {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      min-width: 120px;
    }
    .learning {
      background: #13233f;
      border: 1px solid #37e0ff;
      border-radius: 10px;
      padding: 10px;
      margin: 8px 0;
      font-weight: 700;
    }
    .bar {
      height: 8px;
      background: #0b1120;
      border-radius: 4px;
      margin: 8px 0;
      overflow: hidden;
    }
    .bar i {
      display: block;
      height: 100%;
      background: #37e0ff;
    }
    .hint {
      opacity: 0.8;
      font-size: 13px;
    }
    details.guide {
      font-size: 13px;
      margin: 4px 0;
    }
    details.guide summary {
      cursor: pointer;
      opacity: 0.9;
    }
    details.guide ol {
      margin: 4px 0;
      padding-left: 20px;
    }
    details.guide li.dim {
      opacity: 0.65;
    }
    details.guide a {
      color: #37e0ff;
    }
    .warn {
      display: block;
      color: #ffb74d;
      font-size: 12px;
    }
    .end {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
    }
    .row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 6px 0;
    }
    .room {
      color: #37e0ff;
    }
    a {
      color: #37e0ff;
    }
    .helper-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    .helper-head h4 {
      margin: 0;
    }
    a.install {
      background: #37e0ff;
      color: #04121c;
      font-weight: 700;
      text-decoration: none;
      border-radius: 10px;
      padding: 8px 14px;
    }
    details.pbd summary {
      cursor: pointer;
      opacity: 0.85;
      margin: 8px 0;
    }
    .err {
      color: #ff8fa3;
      white-space: pre-wrap;
      font-size: 12px;
    }
    h4 {
      margin: 12px 0 4px;
    }
  `};de("fp3d-locate-setup",ae);function hn(i,e,t,n){document.querySelector("fp3d-locate-setup")?.remove();let r=document.createElement("fp3d-locate-setup");r.hass=i,r.hassSource=t??null,r.setLook=n??null,r.building=e,document.body.append(r)}export{hn as openLocateSetup};
