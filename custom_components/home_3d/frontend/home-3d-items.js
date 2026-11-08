var Zt=Symbol.for("home-3d.custom-elements"),Be=Symbol.for("home-3d.build"),Qt=["home-3d-panel","home-3d-card"],me=typeof __FP3D_BUILD__=="string"?__FP3D_BUILD__:"dev",M;function he(){let n=globalThis;return n[Zt]??={defined:new Map,watching:!1}}function en(){if(M!==void 0)return M;if(me==="dev")return M=!0;let n=globalThis,e=n[Be];if(e!==void 0)return M=e===me;let t=globalThis.customElements;return he().defined.size>0||Qt.some(i=>t?.get(i)||je(i,void 0))?M=!1:(n[Be]=me,M=!0)}function We(){let n=globalThis.customElements;if(n){for(let[e,t]of he().defined)if(t.registry!==n&&(t.registry=n,!n.get(e)))try{n.define(e,t.cls)}catch(r){console.warn(`Home 3D: could not define ${e} in the page's element registry`,r)}}}function je(n,e){if(typeof document>"u")return;let t;try{t=document.createElement(n)}catch{return}if(Object.getPrototypeOf(t)===HTMLElement.prototype||t instanceof HTMLUnknownElement||!(t instanceof HTMLElement))return;let i=t.constructor;return i===e?void 0:i}function K(n,e){if(!en())return!1;We();let t=globalThis.customElements;if(t.get(n))return!1;let r=he(),i=je(n,e);if(i){try{t.define(n,i),r.defined.set(n,{cls:i,registry:t})}catch(o){console.warn(`Home 3D: could not define ${n} in the page's element registry`,o)}return!1}return t.define(n,e),r.defined.set(n,{cls:e,registry:t}),r.watching||(r.watching=!0,t.whenDefined("home-assistant").then(We)),!0}var X=globalThis,J=X.ShadowRoot&&(X.ShadyCSS===void 0||X.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,fe=Symbol(),Ve=new WeakMap,H=class{constructor(e,t,r){if(this._$cssResult$=!0,r!==fe)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,t=this.t;if(J&&e===void 0){let r=t!==void 0&&t.length===1;r&&(e=Ve.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),r&&Ve.set(t,e))}return e}toString(){return this.cssText}},E=n=>new H(typeof n=="string"?n:n+"",void 0,fe),y=(n,...e)=>{let t=n.length===1?n[0]:e.reduce((r,i,o)=>r+(a=>{if(a._$cssResult$===!0)return a.cssText;if(typeof a=="number")return a;throw Error("Value passed to 'css' function must be a 'css' function result: "+a+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+n[o+1],n[0]);return new H(t,n,fe)},qe=(n,e)=>{if(J)n.adoptedStyleSheets=e.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(let t of e){let r=document.createElement("style"),i=X.litNonce;i!==void 0&&r.setAttribute("nonce",i),r.textContent=t.cssText,n.appendChild(r)}},ge=J?n=>n:n=>n instanceof CSSStyleSheet?(e=>{let t="";for(let r of e.cssRules)t+=r.cssText;return E(t)})(n):n;var{is:tn,defineProperty:nn,getOwnPropertyDescriptor:rn,getOwnPropertyNames:on,getOwnPropertySymbols:sn,getPrototypeOf:an}=Object,Z=globalThis,Ge=Z.trustedTypes,ln=Ge?Ge.emptyScript:"",un=Z.reactiveElementPolyfillSupport,F=(n,e)=>n,be={toAttribute(n,e){switch(e){case Boolean:n=n?ln:null;break;case Object:case Array:n=n==null?n:JSON.stringify(n)}return n},fromAttribute(n,e){let t=n;switch(e){case Boolean:t=n!==null;break;case Number:t=n===null?null:Number(n);break;case Object:case Array:try{t=JSON.parse(n)}catch{t=null}}return t}},Ke=(n,e)=>!tn(n,e),Ye={attribute:!0,type:String,converter:be,reflect:!1,useDefault:!1,hasChanged:Ke};Symbol.metadata??=Symbol("metadata"),Z.litPropertyMetadata??=new WeakMap;var k=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=Ye){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){let r=Symbol(),i=this.getPropertyDescriptor(e,r,t);i!==void 0&&nn(this.prototype,e,i)}}static getPropertyDescriptor(e,t,r){let{get:i,set:o}=rn(this.prototype,e)??{get(){return this[t]},set(a){this[t]=a}};return{get:i,set(a){let s=i?.call(this);o?.call(this,a),this.requestUpdate(e,s,r)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??Ye}static _$Ei(){if(this.hasOwnProperty(F("elementProperties")))return;let e=an(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(F("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(F("properties"))){let t=this.properties,r=[...on(t),...sn(t)];for(let i of r)this.createProperty(i,t[i])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[r,i]of t)this.elementProperties.set(r,i)}this._$Eh=new Map;for(let[t,r]of this.elementProperties){let i=this._$Eu(t,r);i!==void 0&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let r=new Set(e.flat(1/0).reverse());for(let i of r)t.unshift(ge(i))}else e!==void 0&&t.push(ge(e));return t}static _$Eu(e,t){let r=t.attribute;return r===!1?void 0:typeof r=="string"?r:typeof e=="string"?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,t=this.constructor.elementProperties;for(let r of t.keys())this.hasOwnProperty(r)&&(e.set(r,this[r]),delete this[r]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return qe(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,r){this._$AK(e,r)}_$ET(e,t){let r=this.constructor.elementProperties.get(e),i=this.constructor._$Eu(e,r);if(i!==void 0&&r.reflect===!0){let o=(r.converter?.toAttribute!==void 0?r.converter:be).toAttribute(t,r.type);this._$Em=e,o==null?this.removeAttribute(i):this.setAttribute(i,o),this._$Em=null}}_$AK(e,t){let r=this.constructor,i=r._$Eh.get(e);if(i!==void 0&&this._$Em!==i){let o=r.getPropertyOptions(i),a=typeof o.converter=="function"?{fromAttribute:o.converter}:o.converter?.fromAttribute!==void 0?o.converter:be;this._$Em=i;let s=a.fromAttribute(t,o.type);this[i]=s??this._$Ej?.get(i)??s,this._$Em=null}}requestUpdate(e,t,r,i=!1,o){if(e!==void 0){let a=this.constructor;if(i===!1&&(o=this[e]),r??=a.getPropertyOptions(e),!((r.hasChanged??Ke)(o,t)||r.useDefault&&r.reflect&&o===this._$Ej?.get(e)&&!this.hasAttribute(a._$Eu(e,r))))return;this.C(e,t,r)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(e,t,{useDefault:r,reflect:i,wrapped:o},a){r&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,a??t??this[e]),o!==!0||a!==void 0)||(this._$AL.has(e)||(this.hasUpdated||r||(t=void 0),this._$AL.set(e,t)),i===!0&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[i,o]of this._$Ep)this[i]=o;this._$Ep=void 0}let r=this.constructor.elementProperties;if(r.size>0)for(let[i,o]of r){let{wrapped:a}=o,s=this[i];a!==!0||this._$AL.has(i)||s===void 0||this.C(i,void 0,o,s)}}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(r=>r.hostUpdate?.()),this.update(t)):this._$EM()}catch(r){throw e=!1,this._$EM(),r}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(e){}firstUpdated(e){}};k.elementStyles=[],k.shadowRootOptions={mode:"open"},k[F("elementProperties")]=new Map,k[F("finalized")]=new Map,un?.({ReactiveElement:k}),(Z.reactiveElementVersions??=[]).push("2.1.2");var xe=globalThis,Xe=n=>n,Q=xe.trustedTypes,Je=Q?Q.createPolicy("lit-html",{createHTML:n=>n}):void 0,ye="$lit$",$=`lit$${Math.random().toFixed(9).slice(2)}$`,ve="?"+$,cn=`<${ve}>`,R=document,N=()=>R.createComment(""),U=n=>n===null||typeof n!="object"&&typeof n!="function",we=Array.isArray,rt=n=>we(n)||typeof n?.[Symbol.iterator]=="function",_e=`[ 	
\f\r]`,z=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Ze=/-->/g,Qe=/>/g,S=RegExp(`>|${_e}(?:([^\\s"'>=/]+)(${_e}*=${_e}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),et=/'/g,tt=/"/g,it=/^(?:script|style|textarea|title)$/i,ke=n=>(e,...t)=>({_$litType$:n,strings:e,values:t}),d=ke(1),dr=ke(2),mr=ke(3),f=Symbol.for("lit-noChange"),c=Symbol.for("lit-nothing"),nt=new WeakMap,A=R.createTreeWalker(R,129);function ot(n,e){if(!we(n)||!n.hasOwnProperty("raw"))throw Error("invalid template strings array");return Je!==void 0?Je.createHTML(e):e}var st=(n,e)=>{let t=n.length-1,r=[],i,o=e===2?"<svg>":e===3?"<math>":"",a=z;for(let s=0;s<t;s++){let u=n[s],l,p,m=-1,h=0;for(;h<u.length&&(a.lastIndex=h,p=a.exec(u),p!==null);)h=a.lastIndex,a===z?p[1]==="!--"?a=Ze:p[1]!==void 0?a=Qe:p[2]!==void 0?(it.test(p[2])&&(i=RegExp("</"+p[2],"g")),a=S):p[3]!==void 0&&(a=S):a===S?p[0]===">"?(a=i??z,m=-1):p[1]===void 0?m=-2:(m=a.lastIndex-p[2].length,l=p[1],a=p[3]===void 0?S:p[3]==='"'?tt:et):a===tt||a===et?a=S:a===Ze||a===Qe?a=z:(a=S,i=void 0);let _=a===S&&n[s+1].startsWith("/>")?" ":"";o+=a===z?u+cn:m>=0?(r.push(l),u.slice(0,m)+ye+u.slice(m)+$+_):u+$+(m===-2?s:_)}return[ot(n,o+(n[t]||"<?>")+(e===2?"</svg>":e===3?"</math>":"")),r]},D=class n{constructor({strings:e,_$litType$:t},r){let i;this.parts=[];let o=0,a=0,s=e.length-1,u=this.parts,[l,p]=st(e,t);if(this.el=n.createElement(l,r),A.currentNode=this.el.content,t===2||t===3){let m=this.el.content.firstChild;m.replaceWith(...m.childNodes)}for(;(i=A.nextNode())!==null&&u.length<s;){if(i.nodeType===1){if(i.hasAttributes())for(let m of i.getAttributeNames())if(m.endsWith(ye)){let h=p[a++],_=i.getAttribute(m).split($),Y=/([.?@])?(.*)/.exec(h);u.push({type:1,index:o,name:Y[2],strings:_,ctor:Y[1]==="."?te:Y[1]==="?"?ne:Y[1]==="@"?re:I}),i.removeAttribute(m)}else m.startsWith($)&&(u.push({type:6,index:o}),i.removeAttribute(m));if(it.test(i.tagName)){let m=i.textContent.split($),h=m.length-1;if(h>0){i.textContent=Q?Q.emptyScript:"";for(let _=0;_<h;_++)i.append(m[_],N()),A.nextNode(),u.push({type:2,index:++o});i.append(m[h],N())}}}else if(i.nodeType===8)if(i.data===ve)u.push({type:2,index:o});else{let m=-1;for(;(m=i.data.indexOf($,m+1))!==-1;)u.push({type:7,index:o}),m+=$.length-1}o++}}static createElement(e,t){let r=R.createElement("template");return r.innerHTML=e,r}};function T(n,e,t=n,r){if(e===f)return e;let i=r!==void 0?t._$Co?.[r]:t._$Cl,o=U(e)?void 0:e._$litDirective$;return i?.constructor!==o&&(i?._$AO?.(!1),o===void 0?i=void 0:(i=new o(n),i._$AT(n,t,r)),r!==void 0?(t._$Co??=[])[r]=i:t._$Cl=i),i!==void 0&&(e=T(n,i._$AS(n,e.values),i,r)),e}var ee=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:r}=this._$AD,i=(e?.creationScope??R).importNode(t,!0);A.currentNode=i;let o=A.nextNode(),a=0,s=0,u=r[0];for(;u!==void 0;){if(a===u.index){let l;u.type===2?l=new O(o,o.nextSibling,this,e):u.type===1?l=new u.ctor(o,u.name,u.strings,this,e):u.type===6&&(l=new ie(o,this,e)),this._$AV.push(l),u=r[++s]}a!==u?.index&&(o=A.nextNode(),a++)}return A.currentNode=R,i}p(e){let t=0;for(let r of this._$AV)r!==void 0&&(r.strings!==void 0?(r._$AI(e,r,t),t+=r.strings.length-2):r._$AI(e[t])),t++}},O=class n{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,r,i){this.type=2,this._$AH=c,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=r,this.options=i,this._$Cv=i?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=T(this,e,t),U(e)?e===c||e==null||e===""?(this._$AH!==c&&this._$AR(),this._$AH=c):e!==this._$AH&&e!==f&&this._(e):e._$litType$!==void 0?this.$(e):e.nodeType!==void 0?this.T(e):rt(e)?this.k(e):this._(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==c&&U(this._$AH)?this._$AA.nextSibling.data=e:this.T(R.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:r}=e,i=typeof r=="number"?this._$AC(e):(r.el===void 0&&(r.el=D.createElement(ot(r.h,r.h[0]),this.options)),r);if(this._$AH?._$AD===i)this._$AH.p(t);else{let o=new ee(i,this),a=o.u(this.options);o.p(t),this.T(a),this._$AH=o}}_$AC(e){let t=nt.get(e.strings);return t===void 0&&nt.set(e.strings,t=new D(e)),t}k(e){we(this._$AH)||(this._$AH=[],this._$AR());let t=this._$AH,r,i=0;for(let o of e)i===t.length?t.push(r=new n(this.O(N()),this.O(N()),this,this.options)):r=t[i],r._$AI(o),i++;i<t.length&&(this._$AR(r&&r._$AB.nextSibling,i),t.length=i)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){let r=Xe(e).nextSibling;Xe(e).remove(),e=r}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},I=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,r,i,o){this.type=1,this._$AH=c,this._$AN=void 0,this.element=e,this.name=t,this._$AM=i,this.options=o,r.length>2||r[0]!==""||r[1]!==""?(this._$AH=Array(r.length-1).fill(new String),this.strings=r):this._$AH=c}_$AI(e,t=this,r,i){let o=this.strings,a=!1;if(o===void 0)e=T(this,e,t,0),a=!U(e)||e!==this._$AH&&e!==f,a&&(this._$AH=e);else{let s=e,u,l;for(e=o[0],u=0;u<o.length-1;u++)l=T(this,s[r+u],t,u),l===f&&(l=this._$AH[u]),a||=!U(l)||l!==this._$AH[u],l===c?e=c:e!==c&&(e+=(l??"")+o[u+1]),this._$AH[u]=l}a&&!i&&this.j(e)}j(e){e===c?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??"")}},te=class extends I{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===c?void 0:e}},ne=class extends I{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==c)}},re=class extends I{constructor(e,t,r,i,o){super(e,t,r,i,o),this.type=5}_$AI(e,t=this){if((e=T(this,e,t,0)??c)===f)return;let r=this._$AH,i=e===c&&r!==c||e.capture!==r.capture||e.once!==r.once||e.passive!==r.passive,o=e!==c&&(r===c||i);i&&this.element.removeEventListener(this.name,this,r),o&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},ie=class{constructor(e,t,r){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=r}get _$AU(){return this._$AM._$AU}_$AI(e){T(this,e)}},at={M:ye,P:$,A:ve,C:1,L:st,R:ee,D:rt,V:T,I:O,H:I,N:ne,U:re,B:te,F:ie},pn=xe.litHtmlPolyfillSupport;pn?.(D,O),(xe.litHtmlVersions??=[]).push("3.3.3");var lt=(n,e,t)=>{let r=t?.renderBefore??e,i=r._$litPart$;if(i===void 0){let o=t?.renderBefore??null;r._$litPart$=i=new O(e.insertBefore(N(),o),o,void 0,t??{})}return i._$AI(n),i};var $e=globalThis,v=class extends k{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=lt(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return f}};v._$litElement$=!0,v.finalized=!0,$e.litElementHydrateSupport?.({LitElement:v});var dn=$e.litElementPolyfillSupport;dn?.({LitElement:v});($e.litElementVersions??=[]).push("4.2.2");async function Pe(n,e){return(await n.callWS({type:"home_3d/items/save",item:e})).item}async function ut(n,e){await n.callWS({type:"home_3d/items/remove",item_id:e})}var{I:Ir}=at;var oe=n=>n.strings===void 0;var mn={},ct=(n,e=mn)=>n._$AH=e;var x={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},B=n=>(...e)=>({_$litDirective$:n,values:e}),L=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,r){this._$Ct=e,this._$AM=t,this._$Ci=r}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}};var W=(n,e)=>{let t=n._$AN;if(t===void 0)return!1;for(let r of t)r._$AO?.(e,!1),W(r,e);return!0},se=n=>{let e,t;do{if((e=n._$AM)===void 0)break;t=e._$AN,t.delete(n),n=e}while(t?.size===0)},pt=n=>{for(let e;e=n._$AM;n=e){let t=e._$AN;if(t===void 0)e._$AN=t=new Set;else if(t.has(n))break;t.add(n),gn(e)}};function hn(n){this._$AN!==void 0?(se(this),this._$AM=n,pt(this)):this._$AM=n}function fn(n,e=!1,t=0){let r=this._$AH,i=this._$AN;if(i!==void 0&&i.size!==0)if(e)if(Array.isArray(r))for(let o=t;o<r.length;o++)W(r[o],!1),se(r[o]);else r!=null&&(W(r,!1),se(r));else W(this,n)}var gn=n=>{n.type==x.CHILD&&(n._$AP??=fn,n._$AQ??=hn)},ae=class extends L{constructor(){super(...arguments),this._$AN=void 0}_$AT(e,t,r){super._$AT(e,t,r),pt(this),this.isConnected=e._$AU}_$AO(e,t=!0){e!==this.isConnected&&(this.isConnected=e,e?this.reconnected?.():this.disconnected?.()),t&&(W(this,e),se(this))}setValue(e){if(oe(this._$Ct))this._$Ct._$AI(e,this);else{let t=[...this._$Ct._$AH];t[this._$Ci]=e,this._$Ct._$AI(t,this,0)}}disconnected(){}reconnected(){}};var bn='a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';function _n(n,e,t,r){if(!n.length)return null;let i=n[0],o=n[n.length-1],a=e===null?-1:n.indexOf(e);return a<0?r?null:t?o:i:t&&a===0?o:!t&&a===n.length-1?i:null}function dt(n){return[...n.querySelectorAll(bn)].filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length>0&&!e.closest("[inert]"))}function mt(n){return n.getRootNode().activeElement??null}function Se(n,e){if(n.key!=="Tab"||n.altKey||n.ctrlKey||n.metaKey)return;let t=dt(e),r=mt(e),i=!!r&&r!==e&&e.contains(r),o=t.length?_n(t,i?r:null,n.shiftKey,i):e;o&&(n.preventDefault(),o.focus())}function xn(n=document){let e=n.activeElement;for(;e?.shadowRoot?.activeElement;)e=e.shadowRoot.activeElement;return e}function yn(n){return n.hasAttribute("tabindex")?n:dt(n)[0]??null}var Ee=class extends ae{box=null;back=null;onKey=e=>{this.box&&Se(e,this.box)};constructor(e){if(super(e),e.type!==x.ELEMENT)throw new Error("modalFocus() goes on the dialog element")}render(){return c}update(e){let t=e.element;return t!==this.box&&(this.release(!1),this.box=t,this.back=xn(),t.addEventListener("keydown",this.onKey),requestAnimationFrame(()=>{if(this.box!==t||!t.isConnected)return;let r=mt(t);(!r||r===t||!t.contains(r))&&yn(t)?.focus()})),c}release(e){this.box?.removeEventListener("keydown",this.onKey);let t=this.back;this.box=null,this.back=null,e&&t?.isConnected&&t.focus()}disconnected(){this.release(!0)}reconnected(){}},ht=B(Ee);var j=["box","cyl","loft","sphere","lathe","rbox","shell"],vn=["body","fabric","cushion","wood","white","metal","dark","glass","plant","pot","accent","paint"],wn=["main","second","third","details","paint","trim","tyres","tyres_trim","wheels","windows","lights","frame","legs","seat","fabric","cushion","wood","metal","glass","plant","pot","case","panels","valves","grille","buttons","screen","top","base","fronts","handles","shade"],Ae=["floor","surface","wall","ceiling"],Re=["ceiling","downlight","spot","panel","pendant","floor","uplight","table","wall","strip","bollard","garden"];var P={shapes:j,colourRoles:vn,partNames:wn,mounts:Ae,lights:Re,maxParts:60,maxProfilePoints:12,maxShellPoints:16,maxNameLength:80,maxRooms:12,maxTags:12,maxTagLength:30,metres:[.01,10],centre:[-.5,.5],extent:[.001,1],level:[0,1],round:[.01,.5],taper:[.1,1.5],wallY:[0,3],rot:[-360,360]};var kn={type:"none",pitch:35,overhang:.4},Vr={wall_exterior:.24,wall_interior:.12,grid:.05,north:0,roof:{...kn}};var $n=new Set(["lamp_ceiling","lamp_fan","lamp_downlight","lamp_spot","lamp_panel","lamp_pendant","lamp_floor","lamp_uplight","lamp_table","lamp_wall","led_strip","lamp_bollard","lamp_garden"]);var Pn=new Set([...$n,"radiator","ac_unit","awning","robot_vacuum","inverter","home_battery","wallbox","meter","pool_pump","pool_heat_pump","pool_dosing","tv_board","tv_wall","desk","fridge","fridge_smart","stove","kitchen_tall","dishwasher","washer","dryer","kitchen","island","sink"]);var An=/^[a-z0-9][a-z0-9_.-]{0,39}$/;function Te(n){return n.normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,34).replace(/_+$/,"")||"item"}function V(n,e){let t=new Set(e),r=An.test(n)?n:Te(n);if(!t.has(r))return r;for(let i=2;;i++){let o=`${r.slice(0,40-String(i).length-1)}_${i}`;if(!t.has(o))return o}}function gt(n,e){return{id:V(Te(n),e),name:{en:n.trim()||"New item"},size:[.6,.6,.75],parts:[{shape:"box",x:0,z:0,w:1,d:1,y:0,h:.5,color:"body"}]}}var Rn=[[0,0],[.7,0],[1,.4],[.5,1],[0,1]],Tn=[[0,.1,.6],[.15,0,.9],[.5,0,1],[.85,0,.9],[1,.1,.6]],g=(n,e,t,r)=>Number.isFinite(n)?Math.min(t,Math.max(e,n)):r,b=n=>Math.round(n*1e3)/1e3;function bt(n){let e={...n,x:b(g(n.x,-.5,.5,0)),z:b(g(n.z,-.5,.5,0)),w:b(g(n.w,.001,1,1)),d:b(g(n.d,.001,1,1)),y:b(g(n.y,0,1,0)),h:b(g(n.h,.001,1,1))};if(e.shape==="lathe"?e.profile=e.profile?.length?e.profile:Rn.map(t=>[...t]):delete e.profile,e.shape==="rbox"?e.round=b(g(e.round??.2,.01,.5,.2)):e.shape==="shell"&&e.round!==void 0?e.round=b(g(e.round,.01,.5,.25)):delete e.round,e.shape==="shell"?(e.side=e.side?.length?e.side:Tn.map(t=>[...t]),e.taper!==void 0&&(e.taper=b(g(e.taper,.1,1.5,1)))):(delete e.side,delete e.plan,delete e.taper),e.shape!=="loft")for(let t of["tx","tz","tw","td"])delete e[t];return e.shape!=="cyl"&&delete e.axis,e}function q(n,e){return{...n,parts:e}}function _t(n,e){if(n.parts.length>=60)return n;let t=Math.min(.75,Math.max(0,...n.parts.map(o=>o.y+o.h))),r=Math.max(.25,Math.min(.5,1-t)),i=bt({shape:e,x:0,z:0,w:.5,d:.5,y:t,h:r,color:e==="lathe"||e==="sphere"?"accent":"body"});return q(n,[...n.parts,i])}function xt(n,e,t){return q(n,n.parts.map((r,i)=>i===e?bt({...r,...t}):r))}function yt(n,e,t){return q(n,n.parts.map((r,i)=>{if(i!==e)return r;let o=new Set(r.fix??"");o.has(t)?o.delete(t):o.add(t);let a=["w","d","h"].filter(l=>o.has(l)).join(""),{fix:s,...u}=r;return a?{...u,fix:a}:u}))}function vt(n,e){return n.parts.length<=1?n:q(n,n.parts.filter((t,r)=>r!==e))}function wt(n,e){if(n.parts.length>=60||!n.parts[e])return n;let t=structuredClone(n.parts[e]);return q(n,[...n.parts.slice(0,e+1),t,...n.parts.slice(e+1)])}function kt(n,e,t){let r={...n},i=e.name?.trim().slice(0,80);if(i&&(r.name={...n.name,en:i},t&&(r.id=V(Te(i),t))),e.group!==void 0&&(e.group?r.group=e.group:delete r.group),e.room!==void 0&&(e.room.length?r.room=[...new Set(e.room)].slice(0,12):delete r.room),e.tags!==void 0){let o=[...new Set(e.tags.split(",").map(a=>a.trim().slice(0,30)).filter(Boolean))].slice(0,12);o.length?r.tags=o:delete r.tags}if(e.ikea!==void 0){let o=e.ikea.trim().slice(0,40);o?r.ikea=o:delete r.ikea}return r}var In={electric:!1,mount:"floor",surface:!1,vehicle:!1,hole:!1},Mn={edges:!1,glow:!1,screen:!1};function ft(n,e){return Object.fromEntries(Object.entries(n).filter(([t,r])=>r!==void 0&&e[t]!==r))}function $t(n){let e=ft(n,In);return e.mount!=="wall"&&delete e.wall_y,e.parts=n.parts.map(t=>ft(t,Mn)),{name:`${n.id}.json`,text:`${JSON.stringify(e,null,2)}
`}}function On(n){let e=["{}","[]"].map(t=>[n.indexOf(t[0]),n.lastIndexOf(t[1])]).filter(([t,r])=>t>=0&&r>t);e.sort((t,r)=>t[0]-r[0]);for(let t of[n,...e.map(([r,i])=>n.slice(r,i+1))])try{return{data:JSON.parse(t)}}catch{}return null}function Pt(n,e){let t=On(n);if(!t)return[{error:"not_json"}];let r=t.data;if(r?.format==="home3d-pack"||r?.format==="fp3dpack")return[{error:"pack_file"}];let i=Array.isArray(r)?r:Array.isArray(r?.items)&&!r.parts?r.items:[r];if(!i.length)return[{error:"not_an_item"}];let o=[...e];return i.map(a=>{let s=a;return!s||typeof s!="object"||typeof s.id!="string"||!Array.isArray(s.parts)?{error:"not_an_item"}:(o.push(V(s.id,o)),{item:{...s,id:o[o.length-1]}})})}function Ie(n){return(n??[]).map(([e,t])=>`${e} ${t}`).join(", ")}function Et(n){let e=n.split(/[,;]/).map(t=>t.trim()).filter(Boolean).map(t=>t.split(/\s+/).map(Number));return e.length<2||e.length>12||e.some(t=>t.length!==2||t.some(r=>!Number.isFinite(r)))?null:e.map(([t,r])=>[b(g(t,0,1,0)),b(g(r,0,1,0))])}function Me(n){return(n??[]).map(e=>e.join(" ")).join(", ")}function Oe(n,e){let t=n.split(/[,;]/).map(i=>i.trim()).filter(Boolean).map(i=>i.split(/\s+/).map(Number));if(t.length<2||t.length>16||t.some(i=>i.length!==e||i.some(o=>!Number.isFinite(o))))return null;let r=t.map(i=>i.map(o=>b(g(o,0,1,0))));if(e===3)for(let i of r)i[2]<i[1]&&([i[1],i[2]]=[i[2],i[1]]);return r.sort((i,o)=>i[0]-o[0])}var Ln="__fp3dImportFailed";function St(n){return n.catch(e=>{throw globalThis[Ln]?.(e),e})}var Cn=new URL(import.meta.url),Hn=new URL("./home-3d-3d.js?v=08d975c28375",Cn).href,At;function Rt(){return At??=St(import(Hn)),At}var le=class{waiting=[];onChange=null;get current(){return this.waiting[0]?.req??null}ask(e){return new Promise(t=>{this.waiting.push({req:e,resolve:t}),this.waiting.length===1&&this.onChange?.()})}answer(e,t=""){let r=this.waiting.shift();r&&(r.resolve({ok:e,value:t}),this.onChange?.())}},ue=globalThis;function Tt(n){ue.__fp3dAskFactory||(ue.__fp3dAskFactory=n)}function Fn(){return ue.__fp3dAskHost??ue.__fp3dAskFactory?.()??null}var zn={ok:!1,value:""};function It(n){let e=Fn();return e?e.ask(n):Promise.resolve(zn)}async function Mt(n,e){return(await It({text:n,...e})).ok}async function Ot(n,e,t){return(await It({text:n,detail:e,...t})).ok}var Lt=B(class extends L{constructor(n){if(super(n),n.type!==x.PROPERTY&&n.type!==x.ATTRIBUTE&&n.type!==x.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!oe(n))throw Error("`live` bindings can only contain a single expression")}render(n){return n}update(n,[e]){if(e===f||e===c)return e;let t=n.element,r=n.name;if(n.type===x.PROPERTY){if(e===t[r])return f}else if(n.type===x.BOOLEAN_ATTRIBUTE){if(!!e===t.hasAttribute(r))return f}else if(n.type===x.ATTRIBUTE&&t.getAttribute(r)===e+"")return f;return ct(n),e}});function Nn(n,e){return(n??"").trim().toLowerCase()===(e??"").trim().toLowerCase()}function Un(n,e){return!!n&&!Nn(n,e)}function Ct(n){return Un(n.value,n.fallback)?d`<button
    type="button"
    class="fp3d-colour-reset"
    title=${n.label}
    aria-label=${n.label}
    ?disabled=${n.disabled}
    @click=${e=>{e.preventDefault(),e.stopPropagation(),n.onReset()}}
  >
    ↺
  </button>`:c}var Ht=y`
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
`;var Dn={1:4,2:8,3:12,4:16,5:20,6:24,8:32},Bn={control:6,card:8,pill:999},Wn={section:18,card:15,body:14,hint:12,label:12},jn=44;function Ft(){let n=[];for(let[e,t]of Object.entries(Dn))n.push(`--fp3d-space-${e}: ${t}px;`);for(let[e,t]of Object.entries(Bn))n.push(`--fp3d-radius-${e}: ${t}px;`);for(let[e,t]of Object.entries(Wn))n.push(`--fp3d-type-${e}: ${t}px;`);return n.push(`--fp3d-touch: ${jn}px;`),n.join(`
`)}var Le={bg:"#070b14",bg2:"#0d1424",chrome:"rgba(15, 23, 42, 0.88)",chromeSolid:"#0f172a",line:"rgba(148, 163, 184, 0.2)",text:"#e2e8f0",muted:"#94a3b8",accent:"#48cdeb",accentText:"#041018",panel:"#1e293b",primary:"#1e6ebc",primaryText:"#ffffff",link:"#5d97cf",soft:"#5b7cff",warm:"#ffb547",danger:"#ff6b8b",warning:"#fbbf24",success:"#4ade80",shadow:"0 8px 30px rgba(0, 0, 0, 0.5)",colorScheme:"dark"},zt={bg:"#eef2f8",bg2:"#e3e9f2",chrome:"rgba(255, 255, 255, 0.9)",chromeSolid:"#ffffff",line:"rgba(15, 23, 42, 0.16)",text:"#1a1a1a",muted:"#58667a",accent:"#1c67b1",accentText:"#ffffff",panel:"#e2e8f0",primary:"#1e6ebc",primaryText:"#ffffff",link:"#1c67b1",soft:"#3d5bd9",warm:"#a35f00",danger:"#c4224a",warning:"#92400e",success:"#166534",shadow:"0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 28px -10px rgba(14, 37, 66, 0.14)",colorScheme:"light"},Nt={bg:"#000000",bg2:"#050a14",chrome:"rgba(0, 0, 0, 0.94)",chromeSolid:"#000000",line:"rgba(255, 255, 255, 0.7)",text:"#ffffff",muted:"#dbe4f5",accent:"#ffe14d",accentText:"#000000",panel:"#111111",primary:"#ffe14d",primaryText:"#000000",link:"#9db4ff",soft:"#9db4ff",warm:"#ffc247",danger:"#ff8fa8",warning:"#ffc247",success:"#7ee8a6",shadow:"0 0 0 1px rgba(255, 255, 255, 0.5)",colorScheme:"dark"};function Ce(n){let e=t=>t.replace(/[A-Z]/g,r=>`-${r.toLowerCase()}`);return Object.entries(n).map(([t,r])=>`--fp3d-s-${e(t)}: ${r};`).join(`
`)}var Ut=n=>n.replace(/[A-Z]/g,e=>`-${e.toLowerCase()}`),Vn=Object.keys(Le).filter(n=>n!=="colorScheme").map(n=>`--fp3d-${Ut(n)}: var(--fp3d-s-${Ut(n)}, ${Le[n]});`).join(`
`),qn=Ft(),ce=y`
  :host {
    ${E(Vn)}
    ${E(qn)}
    --fp3d-font: "Figtree", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --fp3d-title-font: "Bricolage Grotesque", "Figtree", system-ui, sans-serif;
    color-scheme: var(--fp3d-s-color-scheme, dark);
    font-family: var(--fp3d-font);
    color: var(--fp3d-text);
  }
  :host([light]) {
    ${E(Ce(zt))}
  }
  :host([contrast]) {
    ${E(Ce(Nt))}
  }
`,pe=y`
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
  ${Ht}
`;var Dt="fp3d-ask-dialog";function Gn(){let n=document.activeElement;for(;n?.shadowRoot?.activeElement;)n=n.shadowRoot.activeElement;return n}function Fe(n=typeof document>"u"?null:document.activeElement){let e=null;for(let t=n;t;t=t.shadowRoot?.activeElement??null)t.hasAttribute("contrast")?e="contrast":t.hasAttribute("light")&&(e="light");return e}function Bt(n){for(let e=n??null;e;e=e.parentElement??e.getRootNode?.()?.host??null){if(e.hasAttribute?.("contrast"))return"contrast";if(e.hasAttribute?.("light"))return"light"}return null}function Yn(){let n=document.fullscreenElement;for(;n?.shadowRoot?.fullscreenElement;)n=n.shadowRoot.fullscreenElement;return n??document.body}var He=class extends v{queue=new le;typed="";wrong=!1;wrongTimer;pauseTimer;shown=null;returnFocus=null;constructor(){super(),this.queue.onChange=()=>this.requestUpdate()}ask(e){return this.queue.ask(e)}showWrong(e=!1){this.wrong=!0,clearTimeout(this.wrongTimer),e||(this.wrongTimer=setTimeout(()=>{this.wrong=!1,this.requestUpdate()},5e3)),this.requestUpdate()}answer(e){let t=this.queue.current;if(t){if(e&&t.matches&&!t.matches(this.typed)){this.showWrong();return}this.queue.answer(e||t.cancel===void 0,t.input!==void 0?this.typed:"")}}key(e){e.stopPropagation(),e.key==="Escape"?(e.preventDefault(),this.answer(!1)):e.key==="Enter"&&e.target.tagName==="INPUT"?(e.preventDefault(),this.answer(!0)):Se(e,e.currentTarget)}willUpdate(){let e=this.queue.current;if(e!==this.shown){if(e&&!this.shown){this.returnFocus=Gn();let t=Fe();this.toggleAttribute("light",t==="light"),this.toggleAttribute("contrast",t==="contrast")}this.typed=e?.input??"",this.wrong=!1,clearTimeout(this.wrongTimer),clearTimeout(this.pauseTimer),this.toggleAttribute("open",!!e)}}backRelease=null;updated(){let e=this.queue.current,t=globalThis.__fp3dNavOpen;if(e&&!this.backRelease&&t)this.backRelease=t(()=>(this.backRelease=null,this.answer(!1)),"ask:question");else if(!e&&this.backRelease){let i=this.backRelease;this.backRelease=null,i()}if(e===this.shown)return;if(this.shown=e,!e){this.returnFocus?.focus?.(),this.returnFocus=null;return}let r=this.renderRoot.querySelector("input");r?(r.focus(),r.select()):this.renderRoot.querySelector(e.danger&&e.cancel!==void 0?".ask-cancel":".ask-ok")?.focus()}render(){let e=this.queue.current;return e?d`<div class="backdrop" @click=${()=>this.answer(!1)}></div>
      <div class="box ${e.detail!==void 0?"wide":""}" role=${e.cancel===void 0?"dialog":"alertdialog"} aria-modal="true" aria-describedby="ask-text" @keydown=${t=>this.key(t)}>
        <p id="ask-text" class="text">${e.text}</p>
        ${e.detail!==void 0?d`<textarea class="detail" readonly rows="14" spellcheck="false" aria-labelledby="ask-text" .value=${e.detail}></textarea>`:c}
        ${e.input!==void 0?d`<label class="fp3d-field"><input type="text" aria-labelledby="ask-text" .value=${Lt(this.typed)} @input=${t=>{this.typed=t.target.value,e.matches&&((e.matches(this.typed)||!this.typed.trim())&&(this.wrong=!1),clearTimeout(this.pauseTimer),this.typed.trim()&&!e.matches(this.typed)&&(this.pauseTimer=setTimeout(()=>this.showWrong(!0),900)),this.requestUpdate())}} @blur=${()=>e.matches&&this.typed.trim()&&!e.matches(this.typed)&&this.showWrong()} aria-invalid=${this.wrong?"true":"false"} aria-describedby=${this.wrong?"ask-error":"ask-text"} /></label>
            ${this.wrong&&e.mismatch?d`<p id="ask-error" class="ask-error" role="alert">${e.mismatch}</p>`:c}`:c}
        <div class="buttons">
          ${e.cancel!==void 0?d`<button class="fp3d-btn ask-cancel" @click=${()=>this.answer(!1)}>${e.cancel}</button>`:c}
          <button class="fp3d-btn ask-ok ${e.danger?"ask-danger":"fp3d-primary"}" aria-disabled=${e.matches&&!e.matches(this.typed)?"true":"false"} @click=${()=>this.answer(!0)}>${e.ok}</button>
        </div>
      </div>`:c}static styles=[ce,pe,y`
      :host {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: none;
      }
      :host([open]) {
        display: block;
      }
      .backdrop {
        position: absolute;
        inset: 0;
        background: rgba(4, 8, 16, 0.55);
      }
      .box {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(400px, calc(100% - 32px));
        max-height: calc(100% - 40px);
        overflow-y: auto;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 18px 18px 16px;
        border: 1px solid var(--fp3d-line);
        border-radius: 18px;
        background: var(--fp3d-chrome-solid);
        box-shadow: var(--fp3d-shadow);
      }
      .box.wide {
        width: min(720px, calc(100% - 32px));
      }
      .detail {
        font: 12px/1.45 ui-monospace, monospace;
        color: var(--fp3d-text);
        background: rgba(127, 127, 127, 0.08);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        padding: 8px 10px;
        min-height: 160px;
        max-height: 55vh;
        resize: vertical;
      }
      .text {
        margin: 0;
        font-size: 1rem;
        line-height: 1.45;
        white-space: pre-line;
        overflow-wrap: anywhere;
      }
      .fp3d-field input {
        font-size: 16px; /* 16 px: phones do not zoom into the field */
        padding: 9px 10px;
      }
      .buttons {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 8px;
      }
      .buttons .fp3d-btn {
        min-height: 40px;
        min-width: 88px;
      }
      .ask-error {
        margin: -6px 0 0;
        font-size: 0.9rem;
        line-height: 1.4;
        color: var(--fp3d-danger);
      }
      .ask-ok[aria-disabled="true"] {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .ask-danger {
        background: var(--fp3d-danger);
        color: #1a0208;
        border-color: transparent;
      }
      button:focus-visible,
      textarea:focus-visible,
      input:focus-visible {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: 2px;
      }
    `]};K(Dt,He);var G=null;Tt(()=>typeof document>"u"?null:{ask(n){G??=document.createElement(Dt);let e=Yn();return G.parentNode!==e&&!G.queue?.current&&e.appendChild(G),G.ask(n)}});function Wt(n){let e=t=>n.onChange(t.detail.value);return d`<fp3d-colour-field .value=${n.value??null} .label=${n.label} .t=${n.t} .base=${n.base??null} ?clearable=${!!n.clearable} ?disabled=${!!n.disabled} @colour-change=${n.live?null:e} @colour-input=${n.live?e:null} ?menu=${!!n.onMenu} ?expanded=${!!n.expanded} @colour-menu=${n.onMenu??null}></fp3d-colour-field>`}var jt={id:"round_side_table_40",name:{en:"Round side table 40"},size:[.4,.4,.52],group:"table",room:["living","bedroom","conservatory"],tags:["side table","lamp table","end table","occasional table","round","tripod"],family:"round_side_table",variant:{en:"\xD840"},surface:!0,parts:[{shape:"cyl",x:0,z:0,w:1,d:1,y:.9519,h:.0481,color:"wood",fix:"h"},{shape:"cyl",x:0,z:0,w:.8,d:.8,y:.32,h:.0385,color:"wood",fix:"h"},{shape:"loft",x:0,z:-.425,w:.075,d:.075,y:0,h:.9519,color:"wood",tx:0,tz:-.3,tw:.075,td:.075,fix:"wd"},{shape:"loft",x:.3681,z:.2125,w:.075,d:.075,y:0,h:.9519,color:"wood",tx:.2598,tz:.15,tw:.075,td:.075,fix:"wd"},{shape:"loft",x:-.3681,z:.2125,w:.075,d:.075,y:0,h:.9519,color:"wood",tx:-.2598,tz:.15,tw:.075,td:.075,fix:"wd"}]};var Vt={id:"vase",name:{en:"Vase"},size:[.2,.2,.42],group:"vase",tags:["vase","ceramic","flower vase","ornament","tall","floor vase"],family:"vase",variant:{en:"Tall"},mount:"surface",parts:[{shape:"lathe",x:0,z:0,w:1,d:1,y:0,h:1,color:"pot",profile:[[0,0],[.55,0],[.9,.18],[1,.4],[.8,.68],[.42,.85],[.4,.95],[.5,1],[0,1]]}]};var qt=globalThis.__fp3dLanguages??={extra:new Map,pending:new Map},{extra:Ui,pending:Di}=qt;function Gt(){return qt.en??{}}var Yt=()=>Gt();var ze=Yt(),Jn=[["A round side table (cylinders for the top and shelf, splayed lofts for the legs, fixed measures)",jt],["A vase (one lathe)",Vt]],Kt="```";function Zn(n){let{family:e,variant:t,parts:r,...i}=n,o=JSON.stringify(i).slice(0,-1),a=r.map(s=>`  ${JSON.stringify(s)}`).join(`,
`);return`${o},"parts":[
${a}
]}`}var Qn={box:"a box filling the part's box.",cyl:'a cylinder, upright; its diameter is the smaller of w and d. With "axis": "x" or "z" it lies down along that axis (wheels, rollers, pipes, rails).',loft:`a box whose top face is another rectangle: "tx", "tz" give its centre and "tw", "td" its size (same ranges as x, z, w, d; default: the bottom's). For sloped or tapered things: lamp shades, splayed legs, bonnets.`,sphere:"a ball filling the part's box, squashed when w, d and h differ (knobs, globe lamps, pouffes).",lathe:`a "profile" turned around the part's upright axis (vases, bowls, lamp bases, planters). The profile is 2 to ${P.maxProfilePoints} points [radius, height], each ${w(P.level)}: radius 1 touches the part's box, 0 is the axis; height 0 is the part's bottom, 1 its top. Write them from the bottom up the outside, like the right half of the silhouette; for a bowl go up the outside, over the rim and down the inside. A lathe must have a profile, and only a lathe may have one.`,rbox:`a box with rounded edges (cushions, mattresses, appliances, soft seats); optional "round" ${w(P.round)} of its shortest side (default 0.2; 0.5 is fully round). Only an rbox or a shell may have "round".`,shell:`a curved body (car bodies, boats). "side" (required, shell only): 2 to ${P.maxShellPoints} stations [z, bottom, top], each ${w(P.level)}, z from the part's back (0) to its front (1), never going down. Optional "plan": [z, width] points (width of the part's, default 1), "round" (default 0.25) and "taper" ${w(P.taper)} (top width against the bottom). Smooth curves join the stations. Windows: a second shell in "glass".`},er={body:"the main painted or laminate body",fabric:"upholstery, rugs, curtains",cushion:"seat and back cushions, pillows",wood:"wood",white:"white ceramics, white goods, white plastic",metal:"steel, chrome, brass, handles",dark:"black parts, screens, rubber, shadows",glass:"glass (drawn see-through)",plant:"leaves",pot:"plant pots, ceramics, terracotta",accent:"a highlight colour: buttons, LEDs, a coloured detail",paint:"the paint of a vehicle body, which the owner can change to any car colour"};function w([n,e]){return`${n} to ${e}`}var de=n=>n.map(e=>`"${e}"`).join(", ");function Xt({kinds:n,rooms:e}){let t=P;return`You design one item (a piece of furniture or another thing in a home) for Home 3D, a 3D floor plan for Home Assistant. Ask me what the item is if I have not said, then answer with the item.

ANSWER
Answer with ONE JSON object and nothing else: no explanation, no comments, no trailing commas. If I ask for several items, answer with one JSON list of those objects instead ([{...}, {...}]). I paste it into Home 3D's item editor (${ze.ie_paste} \u2192 ${ze.ie_paste_import}), or save it as <id>.json for "${ze.ie_import}"; the editor checks it against the rules below, and it must import as it is.

THE ITEM
- "id" (required): 1 to 40 characters: lower-case letters, digits, "_", "." and "-", starting with a letter or a digit. Make it from the name ("Oak wall shelf" \u2192 "oak_wall_shelf").
- "name" (required): the name by language code, at least English: {"en": "Oak wall shelf"}. 1 to ${t.maxNameLength} characters, a readable name in UK English (Wardrobe, Hob, Worktop), not a product name.
- "size" (required): the real size in metres as [width, depth, height], each ${w(t.metres)}. Width runs left to right as you face the item's front, depth from back to front.
- "parts" (required): 1 to ${t.maxParts} parts (see PARTS). 5 to 30 is usually right; keep it low-poly.
- "group": what it is, its section in the library: ${de(n)}.
- "room": up to ${t.maxRooms} rooms it is made for: ${de(e)}. Leave it out for any room.
- "tags": up to ${t.maxTags} more search words, 1 to ${t.maxTagLength} characters each.
- "mount": where it sits: ${de(t.mounts)}. "floor" is the default; "surface" stands on the item below it (a lamp on a table); "wall" hangs on a wall with its bottom "wall_y" metres above the floor (${w(t.wallY)}, default 1); "ceiling" hangs from the ceiling.
- "surface": true when its top carries other items (tables, worktops, sideboards).
- "electric": true when it can be linked to a switch and a power sensor (appliances, lamps, TVs).
- "light": for a lamp, how its light spreads: ${de(t.lights)}.
- "ikea": the IKEA product name, only if it is one ("KALLAX").
No other fields are allowed, in the item or in a part. Leave out any optional field you do not need.

PARTS
Every measure of a part is a fraction of the item's size, so the item can be resized in the plan:
- "x", "z": the part's centre across and in depth, ${w(t.centre)}. x 0.5 is the right edge, z 0.5 is the FRONT edge, z -0.5 the back (against the wall).
- "w", "d", "h": the part's width, depth and height, ${w(t.extent)} (1 is the item's whole width, depth or height).
- "y": the part's bottom, ${w(t.level)} of the item's height (0 is the floor). Keep y + h at most 1 and every part inside the item's box: x \xB1 w/2 and z \xB1 d/2 within -0.5 to 0.5.
- "shape": one of:
${t.shapes.map(r=>`  - "${r}": ${Qn[r]}`).join(`
`)}
- "color": a colour role (preferred: the plan's theme colours it) or "#rrggbb" for a fixed colour. Roles:
${t.colourRoles.map(r=>`  - "${r}": ${er[r]}`).join(`
`)}
- "top": another colour (role or "#rrggbb") for the part's top face.
- "fix": the measures the part KEEPS when the item is resized: "w", "d", "h" or several ("wd", "wdh"). Legs keep "wd", table tops, shelves and plinths keep "h", handles keep "wdh". Parts without fix (the carcass, a seat) stretch between them.
- "rot": a turn of the part around its own upright axis in degrees (${w(t.rot)}), for diagonal struts or spiral steps.
- "glow": true for the part of a lamp that lights up (shade, bulb).
- "screen": true for a TV or monitor screen; its front (+z) shows the picture.
- "edges": true, "glow" or "faint" draws outlines; rarely needed.

GOOD ITEMS
- Parts touch or overlap; nothing floats. Legs stand on y 0, a top sits on its legs.
- Use the real proportions of the thing; fractions are of the item's own size, so a 2 cm top on a 75 cm table is h 0.027.
- Put the front (doors, drawers, the screen, the seat) towards +z.

EXAMPLES (items Home 3D ships with)
${Jn.map(([r,i])=>`${r}:
${Kt}json
${Zn(i)}
${Kt}`).join(`

`)}
`}var Ne="#888888",Ue={x:"ie_px",z:"ie_pz",w:"ie_pw",d:"ie_pd",y:"ie_py",h:"ie_ph"};function tr(n){return Math.round(n*1e3)/10}var nr=/^#[0-9a-f]{6}$/i,rr=[["ie_view_angle",35,25],["ie_view_front",0,0],["ie_view_side",90,0],["ie_view_top",0,80]];async function ir(n){try{await navigator.clipboard.writeText(n);return}catch(e){let t=document.createElement("textarea");t.value=n,t.style.position="fixed",t.style.opacity="0",document.body.append(t),t.select();let r=document.execCommand("copy");if(t.remove(),!r)throw e}}var Jt="home3d.items.light";function or(){try{return localStorage.getItem(Jt)==="1"}catch{return!1}}function sr(n,e){let t=URL.createObjectURL(new Blob([e],{type:"application/json"})),r=document.createElement("a");r.href=t,r.download=n,r.click(),setTimeout(()=>URL.revokeObjectURL(t),1e3)}var De=class extends v{static properties={options:{attribute:!1},_items:{state:!0},_draft:{state:!0},_savedId:{state:!0},_dirty:{state:!0},_picture:{state:!0},_msg:{state:!0},_busy:{state:!0},_yaw:{state:!0},_pitch:{state:!0},_zoom:{state:!0},_addShape:{state:!0},_paste:{state:!0},_note:{state:!0},_light:{state:!0}};picture=async(e,t,r,i,o,a)=>(await Rt()).itemPicture(e,t,r,i,o,a);drawn="";drawing=!1;drag=null;constructor(){super(),this._items=[],this._draft=null,this._savedId=null,this._dirty=!1,this._picture=null,this._msg=null,this._busy=!1,this._yaw=35,this._pitch=25,this._zoom=1,this._addShape="box",this._paste=null,this._note=null,this._light=or()}setLight(e){this._light=e;try{localStorage.setItem(Jt,e?"1":"0")}catch{}}connectedCallback(){super.connectedCallback(),this._items=[...this.options?.items??[]];let e=this.options?.open;e==="new"?this.startNew():e?this.pick(this._items.find(t=>t.id===e)??null):this._items.length&&this.pick(this._items[0])}get hass(){return this.options.hassSource?.()??this.options.hass}t(e,t){return this.options.t(e,t)}itemName(e){let t=(this.hass.language??"en").split("-")[0];return e.name[t]??e.name.en??Object.values(e.name)[0]??e.id}async leave(){return!this._dirty||!this._draft||await this.ask(this.t("ie_discard",{name:this.itemName(this._draft)}),this.t("ie_discard_ok"),!0)}ask(e,t,r,i=this.t("ie_cancel")){return Mt(e,{ok:t,cancel:i,danger:r})}pick(e){this._draft=e?structuredClone(e):null,this._savedId=e?.id??null,this._dirty=!1,this._msg=null}startNew(){this._draft=gt(this.t("ie_new_name"),this._items.map(e=>e.id)),this._savedId=null,this._dirty=!0,this._msg=null}edit(e){this._draft=e,this._dirty=!0,this._msg=null}async close(){await this.leave()&&this.remove()}updated(){let e=JSON.stringify([this._draft,Math.round(this._yaw),Math.round(this._pitch),this._light,Math.round(this._zoom*20)]);!this._draft||e===this.drawn||this.drawing||(this.drawing=!0,requestAnimationFrame(()=>{this.draw(e)}))}async draw(e){try{let t=this._draft;t&&(this._picture=await this.picture(t,420,this._yaw,this._pitch,this._light,this._zoom)),this.drawn=e}catch(t){this._msg={ok:!1,text:String(t?.message??t)},this.drawn=e}finally{this.drawing=!1}this.requestUpdate()}pointerDown(e){e.currentTarget.setPointerCapture(e.pointerId),this.drag={x:e.clientX,y:e.clientY,yaw:this._yaw,pitch:this._pitch}}wheel=e=>{e.preventDefault(),e.stopPropagation();let t=e.deltaMode===1?e.deltaY*16:e.deltaY;this._zoom=Math.max(.4,Math.min(5,this._zoom*Math.exp(-t*.0015)))};pointerMove(e){this.drag&&(this._yaw=this.drag.yaw-(e.clientX-this.drag.x)*.6,this._pitch=Math.max(-10,Math.min(80,this.drag.pitch+(e.clientY-this.drag.y)*.4)))}async save(){let e=this._draft;if(!(!e||this._busy)){this._busy=!0;try{let t=await Pe(this.hass,e),r=this._items.some(i=>i.id===t.id);this._items=r?this._items.map(i=>i.id===t.id?t:i):[...this._items,t],this._draft=structuredClone(t),this._savedId=t.id,this._dirty=!1,this._msg={ok:!0,text:this.t("ie_saved")},this.options.changed()}catch(t){let r=t??{};this._msg={ok:!1,text:this.t("ie_save_failed",{why:r.message??r.code??String(t)})}}finally{this._busy=!1}}}exportItem(){if(!this._draft)return;let e=$t(this._draft);sr(e.name,e.text)}async deleteItem(){let e=this._draft;if(e){if(this._savedId===null){this.pick(this._items[0]??null);return}if(await this.ask(this.t("ie_delete_confirm",{name:this.itemName(e)}),this.t("ie_delete"),!0))try{await ut(this.hass,this._savedId),this._items=this._items.filter(t=>t.id!==this._savedId),this.pick(this._items[0]??null),this.options.changed()}catch(t){this._msg={ok:!1,text:String(t?.message??t)}}}}async showBrief(){let e=Xt({kinds:this.options.kinds,rooms:this.options.rooms});if(await Ot(this.t("ie_brief_hint"),e,{ok:this.t("ie_brief_copy"),cancel:this.t("ie_close")}))try{await ir(e),this._note={ok:!0,text:this.t("ie_brief_copied")}}catch(t){this._note={ok:!1,text:this.t("ie_brief_failed",{why:String(t?.message??t)})}}}async importFiles(e){let t=e.target,r=[...t.files??[]];t.value="",!(!r.length||!await this.leave())&&await this.importTexts(await Promise.all(r.map(async i=>({name:i.name,text:await i.text()}))))}async importPasted(){let e=this._paste?.trim();if(!(!e||this._busy||!await this.leave())){this._busy=!0;try{await this.importTexts([{name:this.t("ie_paste"),text:e}])&&(this._paste="")}finally{this._busy=!1}}}async importTexts(e){let t=[],r=[];for(let[o,a]of e.flatMap(s=>Pt(s.text,[]).map(u=>[s,u]))){if("error"in a){r.push(this.t("ie_import_failed",{file:o.name,why:this.t(`ie_err_${a.error}`)}));continue}let s=a.item,u=this._items.find(l=>l.id===s.id);u&&!await this.ask(this.t("ie_import_replace",{name:this.itemName(u)}),this.t("ie_replace"),!0,this.t("ie_keep_both"))&&(s={...s,id:V(s.id,this._items.map(l=>l.id))});try{let l=await Pe(this.hass,s);this._items=this._items.some(p=>p.id===l.id)?this._items.map(p=>p.id===l.id?l:p):[...this._items,l],t.push(l)}catch(l){let p=l?.message??String(l);r.push(this.t("ie_import_failed",{file:o.name,why:p}))}}t.length&&(this.pick(t[t.length-1]),this.options.changed());let i=t.length?[this.t("ie_imported",{names:t.map(o=>this.itemName(o)).join(", ")})]:[];return this._msg={ok:r.length===0,text:[...i,...r].join(" \xB7 ")},this._note=this._draft?null:this._msg,r.length===0}render(){return d`<div class="ie-backdrop" @click=${e=>e.target===e.currentTarget&&this.close()}>
      <div class="ie" role="dialog" aria-modal="true" aria-label=${this.t("ie_title")} ${ht()}>
        <header class="ie-head">
          <h2>${this.t("ie_title")}</h2>
          ${this._draft?this.renderActions():c}
          <button class="fp3d-btn ie-close" @click=${()=>this.close()}>${this.t("ie_close")}</button>
        </header>
        ${this._draft&&this._msg?d`<p class="ie-msg ${this._msg.ok?"ok":"bad"}" role="status">${this._msg.text}</p>`:c}
        <div class="ie-body">
          ${this.renderList()}
          ${this._draft?this.renderDraft(this._draft):d`<p class="ie-sub ie-empty">${this.t("ie_intro")}</p>`}
        </div>
      </div>
    </div>`}renderActions(){return d`<div class="ie-actions" role="toolbar" aria-label=${this.t("ie_actions")}>
      ${this._dirty?d`<span class="ie-sub">${this.t("ie_unsaved")}</span>`:c}
      <button class="fp3d-btn fp3d-primary" ?disabled=${this._busy} @click=${()=>this.save()}>${this.t("ie_save")}</button>
      <button class="fp3d-btn" @click=${()=>this.exportItem()}>${this.t("ie_export")}</button>
      <button class="fp3d-btn fp3d-danger" @click=${()=>this.deleteItem()}>${this.t("ie_delete")}</button>
    </div>`}renderList(){return d`<nav class="ie-list">
      ${this._draft?d`<p class="ie-sub">${this.t("ie_intro")}</p>`:c}
      <button class="fp3d-btn fp3d-primary" @click=${async()=>await this.leave()&&this.startNew()}>+ ${this.t("ie_new")}</button>
      <label class="fp3d-btn ie-file">
        ${this.t("ie_import")}
        <input type="file" accept=".json,application/json" multiple hidden @change=${e=>this.importFiles(e)} />
      </label>
      <button class="fp3d-btn ie-paste-open" aria-expanded=${this._paste!==null} @click=${()=>this._paste=this._paste===null?"":null}>${this.t("ie_paste")}</button>
      ${this._paste!==null?d`<label class="fp3d-field ie-paste"
              >${this.t("ie_paste_label")}<textarea rows="6" spellcheck="false" .value=${this._paste} @input=${e=>this._paste=e.target.value}></textarea
            ></label>
            <button class="fp3d-btn fp3d-primary ie-paste-import" ?disabled=${!this._paste.trim()||this._busy} @click=${()=>this.importPasted()}>${this.t("ie_paste_import")}</button>`:c}
      <button class="fp3d-btn ie-brief" title=${this.t("ie_brief_hint")} @click=${()=>this.showBrief()}>${this.t("ie_brief")}</button>
      ${this._note?d`<p class="ie-msg ${this._note.ok?"ok":"bad"}" role="status">${this._note.text}</p>`:c}
      ${this._items.length?c:d`<p class="ie-sub">${this.t("ie_none")}</p>`}
      <ul>
        ${this._items.map(e=>d`<li>
            <button class="ie-pick ${e.id===this._savedId?"on":""}" @click=${async()=>e.id!==this._savedId&&await this.leave()&&this.pick(e)}>
              ${this.itemName(e)}
            </button>
          </li>`)}
      </ul>
    </nav>`}renderDraft(e){return d`<section class="ie-stage">
        <div class="ie-picture ${this._light?"light":""}" @pointerdown=${t=>this.pointerDown(t)} @pointermove=${t=>this.pointerMove(t)} @pointerup=${()=>this.drag=null} @pointercancel=${()=>this.drag=null} @wheel=${{handleEvent:this.wheel,passive:!1}} @dblclick=${()=>this._zoom=1}>
          ${this._picture?d`<img src=${this._picture} alt=${this.itemName(e)} draggable="false" />`:c}
        </div>
        <div class="ie-views">
          ${rr.map(([t,r,i])=>d`<button
              class="fp3d-btn"
              @click=${()=>{this._yaw=r,this._pitch=i}}
            >
              ${this.t(t)}
            </button>`)}
          <button class="fp3d-btn ie-look" aria-pressed=${this._light} title=${this.t("ie_light_hint")} @click=${()=>this.setLight(!this._light)}>${this.t("ie_light")}</button>
        </div>
        <p class="ie-sub">${this.t("ie_turn_hint")}</p>
      </section>
      <section class="ie-form">${this.renderDetails(e)} ${this.renderParts(e)}</section>`}renderDetails(e){let t=s=>this.edit(kt(e,s,this._savedId===null?this._items.map(u=>u.id):void 0)),r=s=>{let u={...e,...s};for(let[l,p]of Object.entries(s))(p===void 0||p===!1)&&delete u[l];this.edit(u)},i=s=>s.target.value,o=new Set(e.room??[]),a=e.mount??"floor";return d`<h3>${this.t("ie_details")}</h3>
      <label class="fp3d-field">${this.t("ie_name")}<input type="text" maxlength="80" .value=${e.name.en??this.itemName(e)} @change=${s=>t({name:i(s)})} /></label>
      <label class="fp3d-field"
        >${this.t("ie_section")}
        <select @change=${s=>t({group:i(s)})}>
          <option value="" ?selected=${!e.group}>${this.t("ie_section_none")}</option>
          ${this.options.kinds.map(s=>d`<option value=${s} ?selected=${e.group===s}>${this.t(`lib_kind_${s}`)}</option>`)}
        </select>
      </label>
      <div class="fp3d-field">
        ${this.t("ie_rooms")}
        <div class="ie-chips">
          ${this.options.rooms.map(s=>d`<button
              class="ie-chip ${o.has(s)?"on":""}"
              aria-pressed=${o.has(s)}
              @click=${()=>t({room:o.has(s)?[...o].filter(u=>u!==s):[...o,s]})}
            >
              ${this.t(`lib_room_${s}`)}
            </button>`)}
        </div>
      </div>
      <label class="fp3d-field">${this.t("ie_tags")}<input type="text" .value=${(e.tags??[]).join(", ")} @change=${s=>t({tags:i(s)})} /></label>
      <label class="fp3d-field">${this.t("ie_ikea")}<input type="text" maxlength="40" .value=${e.ikea??""} @change=${s=>t({ikea:i(s)})} /></label>
      <div class="fp3d-field" role="group" aria-label=${this.t("ie_size")}>
        ${this.t("ie_size")}
        <div class="ie-row3">
          ${["ie_pw","ie_pd","ie_ph"].map((s,u)=>d`<label class="ie-num"
              >${this.t(s)}<span class="ie-unit-box"
                ><input
                  type="number"
                  min="0.01"
                  max="10"
                  step="0.01"
                  aria-label=${`${this.t(s)} (m)`}
                  .value=${String(e.size[u])}
                  @change=${l=>{let p=[...e.size],m=Number(i(l));p[u]=Number.isFinite(m)?Math.min(10,Math.max(.01,Math.round(m*1e3)/1e3)):p[u],r({size:p})}}
                /><span class="ie-unit" aria-hidden="true">m</span></span
              ></label
            >`)}
        </div>
      </div>
      <label class="fp3d-field"
        >${this.t("ie_mount")}
        <select @change=${s=>r({mount:i(s)==="floor"?void 0:i(s)})}>
          ${Ae.map(s=>d`<option value=${s} ?selected=${a===s}>${this.t(`ie_mount_${s}`)}</option>`)}
        </select>
      </label>
      ${a==="wall"?d`<label class="fp3d-field"
            >${this.t("ie_wall_y")}<input
              type="number"
              min="0"
              max="3"
              step="0.05"
              .value=${String(e.wall_y??1)}
              @change=${s=>r({wall_y:Math.min(3,Math.max(0,Number(i(s))||0))})}
          /></label>`:c}
      <div class="ie-flags">
        <label class="fp3d-check"><input type="checkbox" .checked=${!!e.surface} @change=${s=>r({surface:s.target.checked})} /> ${this.t("ie_flag_surface")}</label>
        <label class="fp3d-check"><input type="checkbox" .checked=${!!e.electric} @change=${s=>r({electric:s.target.checked})} /> ${this.t("ie_flag_electric")}</label>
        <label class="fp3d-field"
          >${this.t("ie_flag_light")}
          <select @change=${s=>r({light:i(s)||void 0})}>
            <option value="" ?selected=${!e.light}>–</option>
            ${Re.map(s=>d`<option value=${s} ?selected=${e.light===s}>${s}</option>`)}
          </select>
        </label>
      </div>`}renderParts(e){return d`<h3>${this.t("ie_parts",{n:e.parts.length,max:60})}</h3>
      <p class="ie-sub">${this.t("ie_parts_hint")}</p>
      <div class="ie-add">
        <select aria-label=${this.t("ie_add")} @change=${t=>this._addShape=t.target.value}>
          ${j.map(t=>d`<option value=${t} ?selected=${this._addShape===t}>${this.t(`ie_shape_${t}`)}</option>`)}
        </select>
        <button class="fp3d-btn" ?disabled=${e.parts.length>=60} @click=${()=>this.edit(_t(e,this._addShape))}>+ ${this.t("ie_add")}</button>
      </div>
      ${e.parts.map((t,r)=>this.renderPart(e,t,r))}`}renderPart(e,t,r){let i=l=>this.edit(xt(e,r,l)),o=this.t("ie_pct"),a=(l,p,m)=>d`<label class="ie-num"
        >${this.t(Ue[l])}<span class="ie-unit-box"
          ><input
            type="number"
            min=${p*100}
            max=${m*100}
            step="0.1"
            aria-label=${`${this.t(Ue[l])} (${o})`}
            .value=${String(tr(t[l]))}
            @change=${h=>{let _=Number(h.target.value);Number.isFinite(_)&&i({[l]:Math.round(_*10)/1e3})}}
          /><span class="ie-unit" aria-hidden="true">${o}</span></span
        ></label
      >`,s=(l,p,m)=>d`<label class="ie-num"
        >${this.t(l==="round"?"ie_round":"ie_taper")}<input
          type="number"
          min=${p}
          max=${m}
          step="0.01"
          .value=${String(t[l]??(l==="taper"?1:t.shape==="shell"?.25:.2))}
          @change=${h=>i({[l]:Number(h.target.value)})}
      /></label>`,u=nr.test(t.color);return d`<fieldset class="ie-part">
      <legend>${this.t("ie_part",{n:r+1})}</legend>
      <div class="ie-part-top">
        <select aria-label=${this.t("ie_add")} @change=${l=>i({shape:l.target.value})}>
          ${j.map(l=>d`<option value=${l} ?selected=${t.shape===l}>${this.t(`ie_shape_${l}`)}</option>`)}
        </select>
        <select
          aria-label=${this.t("ie_colour")}
          @change=${l=>{let p=l.target.value;i({color:p==="own"?Ne:p})}}
        >
          ${this.options.roles.map(l=>d`<option value=${l} ?selected=${t.color===l}>${this.t(`colour_role_${l}`)}</option>`)}
          <option value="own" ?selected=${u}>${this.t("ie_colour_own")}</option>
        </select>
        ${u?d`${Wt({value:t.color,label:this.t("ie_colour_own"),t:(l,p)=>this.t(l,p),onChange:l=>l&&i({color:l})})}${Ct({value:t.color,fallback:Ne,label:this.t("colour_reset"),onReset:()=>i({color:Ne})})}`:c}
        <button class="fp3d-btn" ?disabled=${e.parts.length>=60} @click=${()=>this.edit(wt(e,r))}>${this.t("ie_duplicate")}</button>
        <button class="fp3d-btn fp3d-danger" title=${this.t("ie_remove_part")} aria-label=${this.t("ie_remove_part")} ?disabled=${e.parts.length<=1} @click=${()=>this.edit(vt(e,r))}>✕</button>
      </div>
      <div class="ie-nums">${a("x",-.5,.5)} ${a("z",-.5,.5)} ${a("w",.001,1)} ${a("d",.001,1)} ${a("y",0,1)} ${a("h",.001,1)} ${t.shape==="rbox"||t.shape==="shell"?s("round",.01,.5):c} ${t.shape==="shell"?s("taper",.1,1.5):c}</div>
      ${t.shape==="lathe"?d`<label class="fp3d-field"
            >profile<input
              type="text"
              .value=${Ie(t.profile)}
              @change=${l=>{let p=l.target,m=Et(p.value);m?i({profile:m}):p.value=Ie(t.profile)}}
          /></label>`:c}
      ${t.shape==="shell"?["side","plan"].map(l=>d`<label class="fp3d-field"
              >${l}<input
                type="text"
                .value=${Me(t[l])}
                @change=${p=>{let m=p.target;if(l==="plan"&&!m.value.trim())return i({plan:void 0});let h=l==="side"?Oe(m.value,3):Oe(m.value,2);h?i({[l]:h}):m.value=Me(t[l])}}
            /></label>`):c}
      <div class="ie-fix" title=${this.t("ie_fixed_hint")}>
        <span class="ie-sub">${this.t("ie_fixed")}</span>
        ${["w","d","h"].map(l=>d`<button class="ie-chip ${t.fix?.includes(l)?"on":""}" aria-pressed=${!!t.fix?.includes(l)} @click=${()=>this.edit(yt(e,r,l))}>${this.t(Ue[l])}</button>`)}
      </div>
    </fieldset>`}static styles=[ce,pe,y`
      :host {
        position: fixed;
        inset: 0;
        z-index: 20;
      }
      .ie-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(2, 4, 10, 0.6);
        display: grid;
        place-items: center;
        padding: 12px;
      }
      .ie {
        width: min(1240px, 100%);
        max-height: 100%;
        overflow: auto;
        background: var(--fp3d-chrome-solid, #0d1424);
        color: var(--fp3d-text);
        border: 1px solid var(--fp3d-line);
        border-radius: 16px;
        padding: 14px 16px;
        box-sizing: border-box;
      }
      /* the header bar: title, the item's actions, Close (#420, CONS-7) */
      .ie-head {
        position: sticky;
        top: -14px;
        z-index: 2;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 12px;
        margin: -14px -16px 0;
        padding: 12px 16px;
        background: var(--fp3d-chrome-solid, #0d1424);
        border-bottom: 1px solid var(--fp3d-line);
      }
      .ie-head .ie-actions {
        margin-left: auto;
      }
      .ie-close {
        margin-left: auto;
      }
      .ie-head .ie-actions + .ie-close {
        margin-left: 0;
      }
      .ie > .ie-msg {
        margin-top: 8px;
      }
      .ie-head h2 {
        margin: 0;
        font-size: 20px;
      }
      .ie-body {
        display: grid;
        grid-template-columns: 220px minmax(280px, 1fr) minmax(320px, 1.1fr);
        gap: 16px;
        margin-top: 12px;
      }
      @media (max-width: 960px) {
        .ie-body {
          grid-template-columns: 1fr;
        }
      }
      .ie-list {
        display: grid;
        gap: 8px;
        align-content: start;
      }
      .ie-list ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 4px;
      }
      .ie-pick {
        width: 100%;
        text-align: left;
        font: inherit;
        color: inherit;
        background: none;
        border: 1px solid transparent;
        border-radius: 8px;
        padding: 6px 8px;
        cursor: pointer;
      }
      .ie-pick.on,
      .ie-pick:hover {
        border-color: var(--fp3d-accent);
      }
      .ie-file {
        text-align: center;
        cursor: pointer;
      }
      /* hints in the muted text colour, not the link blue (#420, CONS-7) */
      .ie-sub {
        color: var(--fp3d-muted);
        font-size: 13px;
        margin: 0;
      }
      .ie-stage {
        display: grid;
        gap: 8px;
        align-content: start;
      }
      .ie-picture {
        aspect-ratio: 1;
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
        background: radial-gradient(circle at 50% 60%, rgba(55, 224, 255, 0.08), transparent 70%);
        display: grid;
        place-items: center;
        cursor: grab;
        touch-action: none;
        user-select: none;
      }
      .ie-picture.light {
        background: radial-gradient(circle at 50% 60%, #ffffff, #dfe5ec 75%);
        border-color: rgba(0, 0, 0, 0.12);
      }
      .ie-look {
        margin-left: auto;
      }
      .ie-look[aria-pressed="true"] {
        border-color: var(--fp3d-accent);
      }
      .ie-picture img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
      }
      .ie-views,
      .ie-actions,
      .ie-add,
      .ie-part-top,
      .ie-flags,
      .ie-fix,
      .ie-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .ie-msg {
        margin: 0;
        font-size: 13px;
      }
      .ie-msg.ok {
        color: var(--fp3d-accent);
      }
      .ie-msg.bad {
        color: var(--fp3d-danger);
      }
      .ie-form {
        display: grid;
        gap: 10px;
        align-content: start;
      }
      .ie-form h3 {
        margin: 6px 0 0;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--fp3d-muted);
      }
      .ie-row3 {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }
      .ie-chip {
        font: inherit;
        font-size: 13px;
        color: inherit;
        background: none;
        border: 1px solid var(--fp3d-line);
        border-radius: 999px;
        padding: 4px 10px;
        cursor: pointer;
      }
      .ie-chip.on {
        background: var(--fp3d-primary);
        color: var(--fp3d-primary-text);
        border-color: transparent;
      }
      .ie-part {
        border: 1px solid var(--fp3d-line);
        border-radius: 12px;
        padding: 8px 10px;
        display: grid;
        gap: 8px;
        margin: 0;
      }
      .ie-part legend {
        font-size: 12px;
        color: var(--fp3d-muted);
        padding: 0 4px;
      }
      .ie-nums {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(124px, 1fr));
        gap: 6px;
      }
      .ie-num {
        display: grid;
        gap: 2px;
        font-size: 12px;
        color: var(--fp3d-muted);
      }
      /* the unit inside the field, at its end ("m", "% of item") */
      .ie-unit-box {
        position: relative;
        display: grid;
      }
      .ie-unit-box > input {
        padding-right: 64px;
      }
      .ie-row3 .ie-unit-box > input {
        padding-right: 24px;
      }
      .ie-unit {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 11px;
        color: var(--fp3d-muted);
        pointer-events: none;
        white-space: nowrap;
      }
      input,
      select,
      textarea {
        font: inherit;
        font-size: 14px;
        color: var(--fp3d-text);
        background: color-mix(in srgb, var(--fp3d-panel) 40%, transparent);
        border: 1px solid var(--fp3d-line);
        border-radius: 8px;
        padding: 6px 8px;
        min-width: 0;
      }
      textarea {
        font-family: ui-monospace, monospace;
        font-size: 12px;
        resize: vertical;
      }
      input[type="checkbox"] {
        width: auto;
      }
      .fp3d-check {
        display: flex;
        gap: 6px;
        align-items: center;
        font-size: 13px;
      }
    `]};K("fp3d-item-editor",De);function fo(n){document.querySelector("fp3d-item-editor")?.remove();let e=document.createElement("fp3d-item-editor");e.options=n;let t=Bt(n.from)??Fe();e.toggleAttribute("light",t==="light"),e.toggleAttribute("contrast",t==="contrast"),document.body.append(e)}export{fo as openItemEditor};
