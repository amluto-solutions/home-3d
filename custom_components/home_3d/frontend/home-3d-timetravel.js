var ve=new Map,Xn=new Map,Jn=new Map;var we=0;function to(o){return Xn.get(o)??o}function eo(o){return o.startsWith("pack:")}var no={meter:"meter",consumer_unit:"meter",energy_monitor:"meter",inverter:"inverter",home_battery:"home_battery",power_station:"home_battery",ev_charger:"wallbox",solar_panel:"solar"},Me=new Map;function ke(o){let t=Me.get(o);if(t&&t.v===we)return t.role;let e=oo(o);return Me.set(o,{v:we,role:e}),e}function oo(o){if(o==="meter"||o==="inverter"||o==="home_battery"||o==="wallbox")return o;let t=Tt(o),e=t?.family?no[t.family]??(/^ev_charger_/.test(t.family)?"wallbox":null):null;return e==="meter"&&(t.tags??[]).some(n=>/^(gas|water)$/i.test(n))?null:e}function Tt(o){if(eo(o))return Jn.get(o)??ve.get(o)??ve.get(to(o))}var so={type:"none",pitch:35,overhang:.4},Gr={wall_exterior:.24,wall_interior:.12,grid:.05,north:0,roof:{...so}};var ao=new Set(["lamp_ceiling","lamp_fan","lamp_downlight","lamp_spot","lamp_panel","lamp_pendant","lamp_floor","lamp_uplight","lamp_table","lamp_wall","led_strip","lamp_bollard","lamp_garden"]);var io=new Set([...ao,"radiator","ac_unit","awning","robot_vacuum","inverter","home_battery","wallbox","meter","pool_pump","pool_heat_pump","pool_dosing","tv_board","tv_wall","desk","fridge","fridge_smart","stove","kitchen_tall","dishwasher","washer","dryer","kitchen","island","sink"]);function $(o,t){let e=!1;for(let n=0,r=t.length-1;n<t.length;r=n++){let[i,s]=t[n],[a,l]=t[r];s>o[1]!=l>o[1]&&o[0]<(a-i)*(o[1]-s)/(l-s)+i&&(e=!e)}return e}var lo=Math.PI/180;var ti=Math.tan(30*lo);var ci=Math.PI/180;var co=/^(binary_sensor|schedule|input_boolean|switch)\./;function fo(o){return/off[\s_-]?peak|night|cheap|low|economy|e7/i.test(o)}function po(o,t,e){if(co.test(e))return t?.state==="on";let n=t?.state;if(!n||n==="unavailable"||n==="unknown")return!1;let r=o.cheap_states??[];return r.length?r.some(i=>i.toLowerCase()===n.toLowerCase()):fo(n)}function Ee(o,t,e){let n=`${e??""}/kWh`,r=i=>{if(typeof i=="number")return Number.isFinite(i)?{value:i,unit:n}:null;let s=i&&i!=="none"?t[i]:void 0,a=Number(s?.state);return s&&s.state!==""&&Number.isFinite(a)?{value:a,unit:String(s.attributes.unit_of_measurement||n)}:null};if(o.price_mode==="split"){let i=o.rate_entity,s=!!i&&i!=="none"&&po(o,t[i],i);return r(s?o.price_cheap:o.price_peak)}return o.tariff?r(o.tariff):r(o.price_fixed)}function Ft(o,t){return o===null?t:t===null?o:o+t}function mo(o,t){return(t.systems??[]).map(e=>{let n=e.battery_soc?Number(o.states[e.battery_soc]?.state):NaN,r=e.solar?E(o.states[e.solar]):null;return{id:e.id,name:e.name,inverter:e.inverter??null,grid:e.grid?E(o.states[e.grid],e.grid_invert):null,solar:r===null?null:Math.max(0,r),battery:e.battery?E(o.states[e.battery],e.battery_invert):null,soc:Number.isFinite(n)?n:null}})}function ho(o){let t=new Map,e=new Set(o.map(n=>n.powerEntity));for(let n of o)n.circuit&&n.circuit!==n.powerEntity&&e.has(n.circuit)&&t.set(n.circuit,(t.get(n.circuit)??0)+n.power);return o.map(n=>Math.max(0,n.power-(t.get(n.powerEntity)??0)))}var ut=o=>o&&o!=="none"?o:null;function Pt(o,t=e=>ut(e.power)){let e={grid:null,gridExport:null,solar:[],battery:[],charge:[],batteries:[],soc:[]};for(let n of o.floors)for(let r of n.furniture){let i=t(r),s=ke(r.type);if(s==="meter")e.grid??=i,e.gridExport??=ut(r.export);else if((s==="inverter"||s==="solar")&&i&&!e.solar.includes(i))e.solar.push(i);else if(s==="home_battery"){i&&!e.battery.includes(i)&&e.battery.push(i);let a=ut(r.charge);a&&!e.charge.includes(a)&&e.charge.push(a),(i||a)&&e.batteries.push({power:i,charge:a});let l=ut(r.soc);l&&!e.soc.includes(l)&&e.soc.push(l)}}return e}function E(o,t=!1){if(!o)return null;let e=Number(o.state);if(!Number.isFinite(e))return null;let n=e*go(o.attributes.unit_of_measurement);return t?-n:n}function go(o){switch(typeof o=="string"?o.trim():""){case"mW":return .001;case"kW":return 1e3;case"MW":return 1e6;case"GW":return 1e9;case"TW":return 1e12;default:return 1}}function $e(o,t,e,n=Pt(t)){let r=t.energy,i=r.grid??n.grid,s=i?E(o.states[i],r.grid_invert):null;if(!r.grid&&n.gridExport){let g=Math.max(0,E(o.states[n.gridExport])??0);s=Math.max(0,s??0)-g}let a=r.solar?E(o.states[r.solar]):null;if(!r.solar&&n.solar.length){let g=n.solar.map(_=>E(o.states[_])).filter(_=>_!==null);a=g.length?g.reduce((_,w)=>_+w,0):null}let l=r.battery?E(o.states[r.battery],r.battery_invert):null;if(!r.battery&&n.batteries.length){let g=n.batteries.map(_=>{if(_.charge){let w=_.power?Math.max(0,E(o.states[_.power])??0):0,b=Math.max(0,E(o.states[_.charge])??0);return w-b}return _.power?E(o.states[_.power],r.battery_invert):null}).filter(_=>_!==null);l=g.length?g.reduce((_,w)=>_+w,0):null}let c=(r.battery_soc?[r.battery_soc]:n.soc).map(g=>Number(o.states[g]?.state)).filter(g=>Number.isFinite(g)),f=mo(o,r);for(let g of f)s=Ft(s,g.grid),a=Ft(a,g.solar),l=Ft(l,g.battery),g.soc!==null&&c.push(g.soc);let d=c.length?c.reduce((g,_)=>g+_,0)/c.length:NaN,m=r.tariff?o.states[r.tariff]:void 0,h=Number(m?.state),p=r.consumption?E(o.states[r.consumption]):null;return p!==null?p=Math.max(0,p):s!==null||a!==null||l!==null?p=Math.max(0,(s??0)+Math.max(0,a??0)+(l??0)):e.length&&(p=ho(e).reduce((g,_)=>g+_,0)),{grid:s,solar:a===null?null:Math.max(0,a),battery:l,soc:Number.isFinite(d)?d:null,tariff:r.rates_from==="sensors"?Ee(r,o.states,o.config?.currency):m&&Number.isFinite(h)?{value:h,unit:String(m.attributes.unit_of_measurement??"")}:null,consumption:p,...f.length?{systems:f}:{}}}var bo=Symbol.for("home-3d.custom-elements"),Ae=Symbol.for("home-3d.build"),yo=["home-3d-panel","home-3d-card"],Ot=typeof __FP3D_BUILD__=="string"?__FP3D_BUILD__:"dev",W;function zt(){let o=globalThis;return o[bo]??={defined:new Map,watching:!1}}function _o(){if(W!==void 0)return W;if(Ot==="dev")return W=!0;let o=globalThis,t=o[Ae];if(t!==void 0)return W=t===Ot;let e=globalThis.customElements;return zt().defined.size>0||yo.some(r=>e?.get(r)||Fe(r,void 0))?W=!1:(o[Ae]=Ot,W=!0)}function Te(){let o=globalThis.customElements;if(o){for(let[t,e]of zt().defined)if(e.registry!==o&&(e.registry=o,!o.get(t)))try{o.define(t,e.cls)}catch(n){console.warn(`Home 3D: could not define ${t} in the page's element registry`,n)}}}function Fe(o,t){if(typeof document>"u")return;let e;try{e=document.createElement(o)}catch{return}if(Object.getPrototypeOf(e)===HTMLElement.prototype||e instanceof HTMLUnknownElement||!(e instanceof HTMLElement))return;let r=e.constructor;return r===t?void 0:r}function Pe(o,t){if(!_o())return!1;Te();let e=globalThis.customElements;if(e.get(o))return!1;let n=zt(),r=Fe(o,t);if(r){try{e.define(o,r),n.defined.set(o,{cls:r,registry:e})}catch(i){console.warn(`Home 3D: could not define ${o} in the page's element registry`,i)}return!1}return e.define(o,t),n.defined.set(o,{cls:t,registry:e}),n.watching||(n.watching=!0,e.whenDefined("home-assistant").then(Te)),!0}var ct=globalThis,dt=ct.ShadowRoot&&(ct.ShadyCSS===void 0||ct.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,It=Symbol(),Oe=new WeakMap,Y=class{constructor(t,e,n){if(this._$cssResult$=!0,n!==It)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o,e=this.t;if(dt&&t===void 0){let n=e!==void 0&&e.length===1;n&&(t=Oe.get(e)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),n&&Oe.set(e,t))}return t}toString(){return this.cssText}},ze=o=>new Y(typeof o=="string"?o:o+"",void 0,It),Nt=(o,...t)=>{let e=o.length===1?o[0]:t.reduce((n,r,i)=>n+(s=>{if(s._$cssResult$===!0)return s.cssText;if(typeof s=="number")return s;throw Error("Value passed to 'css' function must be a 'css' function result: "+s+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(r)+o[i+1],o[0]);return new Y(e,o,It)},Ie=(o,t)=>{if(dt)o.adoptedStyleSheets=t.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(let e of t){let n=document.createElement("style"),r=ct.litNonce;r!==void 0&&n.setAttribute("nonce",r),n.textContent=e.cssText,o.appendChild(n)}},Ct=dt?o=>o:o=>o instanceof CSSStyleSheet?(t=>{let e="";for(let n of t.cssRules)e+=n.cssText;return ze(e)})(o):o;var{is:xo,defineProperty:vo,getOwnPropertyDescriptor:wo,getOwnPropertyNames:Mo,getOwnPropertySymbols:ko,getPrototypeOf:So}=Object,ft=globalThis,Ne=ft.trustedTypes,Ro=Ne?Ne.emptyScript:"",Eo=ft.reactiveElementPolyfillSupport,Z=(o,t)=>o,Ht={toAttribute(o,t){switch(t){case Boolean:o=o?Ro:null;break;case Object:case Array:o=o==null?o:JSON.stringify(o)}return o},fromAttribute(o,t){let e=o;switch(t){case Boolean:e=o!==null;break;case Number:e=o===null?null:Number(o);break;case Object:case Array:try{e=JSON.parse(o)}catch{e=null}}return e}},He=(o,t)=>!xo(o,t),Ce={attribute:!0,type:String,converter:Ht,reflect:!1,useDefault:!1,hasChanged:He};Symbol.metadata??=Symbol("metadata"),ft.litPropertyMetadata??=new WeakMap;var T=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=Ce){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){let n=Symbol(),r=this.getPropertyDescriptor(t,n,e);r!==void 0&&vo(this.prototype,t,r)}}static getPropertyDescriptor(t,e,n){let{get:r,set:i}=wo(this.prototype,t)??{get(){return this[e]},set(s){this[e]=s}};return{get:r,set(s){let a=r?.call(this);i?.call(this,s),this.requestUpdate(t,a,n)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??Ce}static _$Ei(){if(this.hasOwnProperty(Z("elementProperties")))return;let t=So(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(Z("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Z("properties"))){let e=this.properties,n=[...Mo(e),...ko(e)];for(let r of n)this.createProperty(r,e[r])}let t=this[Symbol.metadata];if(t!==null){let e=litPropertyMetadata.get(t);if(e!==void 0)for(let[n,r]of e)this.elementProperties.set(n,r)}this._$Eh=new Map;for(let[e,n]of this.elementProperties){let r=this._$Eu(e,n);r!==void 0&&this._$Eh.set(r,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){let e=[];if(Array.isArray(t)){let n=new Set(t.flat(1/0).reverse());for(let r of n)e.unshift(Ct(r))}else t!==void 0&&e.push(Ct(t));return e}static _$Eu(t,e){let n=e.attribute;return n===!1?void 0:typeof n=="string"?n:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){let t=new Map,e=this.constructor.elementProperties;for(let n of e.keys())this.hasOwnProperty(n)&&(t.set(n,this[n]),delete this[n]);t.size>0&&(this._$Ep=t)}createRenderRoot(){let t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return Ie(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,n){this._$AK(t,n)}_$ET(t,e){let n=this.constructor.elementProperties.get(t),r=this.constructor._$Eu(t,n);if(r!==void 0&&n.reflect===!0){let i=(n.converter?.toAttribute!==void 0?n.converter:Ht).toAttribute(e,n.type);this._$Em=t,i==null?this.removeAttribute(r):this.setAttribute(r,i),this._$Em=null}}_$AK(t,e){let n=this.constructor,r=n._$Eh.get(t);if(r!==void 0&&this._$Em!==r){let i=n.getPropertyOptions(r),s=typeof i.converter=="function"?{fromAttribute:i.converter}:i.converter?.fromAttribute!==void 0?i.converter:Ht;this._$Em=r;let a=s.fromAttribute(e,i.type);this[r]=a??this._$Ej?.get(r)??a,this._$Em=null}}requestUpdate(t,e,n,r=!1,i){if(t!==void 0){let s=this.constructor;if(r===!1&&(i=this[t]),n??=s.getPropertyOptions(t),!((n.hasChanged??He)(i,e)||n.useDefault&&n.reflect&&i===this._$Ej?.get(t)&&!this.hasAttribute(s._$Eu(t,n))))return;this.C(t,e,n)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,e,{useDefault:n,reflect:r,wrapped:i},s){n&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,s??e??this[t]),i!==!0||s!==void 0)||(this._$AL.has(t)||(this.hasUpdated||n||(e=void 0),this._$AL.set(t,e)),r===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[r,i]of this._$Ep)this[r]=i;this._$Ep=void 0}let n=this.constructor.elementProperties;if(n.size>0)for(let[r,i]of n){let{wrapped:s}=i,a=this[r];s!==!0||this._$AL.has(r)||a===void 0||this.C(r,void 0,i,a)}}let t=!1,e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(n=>n.hostUpdate?.()),this.update(e)):this._$EM()}catch(n){throw t=!1,this._$EM(),n}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(t){}firstUpdated(t){}};T.elementStyles=[],T.shadowRootOptions={mode:"open"},T[Z("elementProperties")]=new Map,T[Z("finalized")]=new Map,Eo?.({ReactiveElement:T}),(ft.reactiveElementVersions??=[]).push("2.1.2");var Kt=globalThis,Ve=o=>o,pt=Kt.trustedTypes,De=pt?pt.createPolicy("lit-html",{createHTML:o=>o}):void 0,je="$lit$",P=`lit$${Math.random().toFixed(9).slice(2)}$`,Ge="?"+P,$o=`<${Ge}>`,C=document,J=()=>C.createComment(""),tt=o=>o===null||typeof o!="object"&&typeof o!="function",jt=Array.isArray,Ao=o=>jt(o)||typeof o?.[Symbol.iterator]=="function",Vt=`[ 	
\f\r]`,X=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,Le=/-->/g,We=/>/g,I=RegExp(`>|${Vt}(?:([^\\s"'>=/]+)(${Vt}*=${Vt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),Be=/'/g,Ue=/"/g,qe=/^(?:script|style|textarea|title)$/i,Gt=o=>(t,...e)=>({_$litType$:o,strings:t,values:e}),x=Gt(1),Qe=Gt(2),Zi=Gt(3),H=Symbol.for("lit-noChange"),v=Symbol.for("lit-nothing"),Ke=new WeakMap,N=C.createTreeWalker(C,129);function Ye(o,t){if(!jt(o)||!o.hasOwnProperty("raw"))throw Error("invalid template strings array");return De!==void 0?De.createHTML(t):t}var To=(o,t)=>{let e=o.length-1,n=[],r,i=t===2?"<svg>":t===3?"<math>":"",s=X;for(let a=0;a<e;a++){let l=o[a],u,c,f=-1,d=0;for(;d<l.length&&(s.lastIndex=d,c=s.exec(l),c!==null);)d=s.lastIndex,s===X?c[1]==="!--"?s=Le:c[1]!==void 0?s=We:c[2]!==void 0?(qe.test(c[2])&&(r=RegExp("</"+c[2],"g")),s=I):c[3]!==void 0&&(s=I):s===I?c[0]===">"?(s=r??X,f=-1):c[1]===void 0?f=-2:(f=s.lastIndex-c[2].length,u=c[1],s=c[3]===void 0?I:c[3]==='"'?Ue:Be):s===Ue||s===Be?s=I:s===Le||s===We?s=X:(s=I,r=void 0);let m=s===I&&o[a+1].startsWith("/>")?" ":"";i+=s===X?l+$o:f>=0?(n.push(u),l.slice(0,f)+je+l.slice(f)+P+m):l+P+(f===-2?a:m)}return[Ye(o,i+(o[e]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),n]},et=class o{constructor({strings:t,_$litType$:e},n){let r;this.parts=[];let i=0,s=0,a=t.length-1,l=this.parts,[u,c]=To(t,e);if(this.el=o.createElement(u,n),N.currentNode=this.el.content,e===2||e===3){let f=this.el.content.firstChild;f.replaceWith(...f.childNodes)}for(;(r=N.nextNode())!==null&&l.length<a;){if(r.nodeType===1){if(r.hasAttributes())for(let f of r.getAttributeNames())if(f.endsWith(je)){let d=c[s++],m=r.getAttribute(f).split(P),h=/([.?@])?(.*)/.exec(d);l.push({type:1,index:i,name:h[2],strings:m,ctor:h[1]==="."?Lt:h[1]==="?"?Wt:h[1]==="@"?Bt:U}),r.removeAttribute(f)}else f.startsWith(P)&&(l.push({type:6,index:i}),r.removeAttribute(f));if(qe.test(r.tagName)){let f=r.textContent.split(P),d=f.length-1;if(d>0){r.textContent=pt?pt.emptyScript:"";for(let m=0;m<d;m++)r.append(f[m],J()),N.nextNode(),l.push({type:2,index:++i});r.append(f[d],J())}}}else if(r.nodeType===8)if(r.data===Ge)l.push({type:2,index:i});else{let f=-1;for(;(f=r.data.indexOf(P,f+1))!==-1;)l.push({type:7,index:i}),f+=P.length-1}i++}}static createElement(t,e){let n=C.createElement("template");return n.innerHTML=t,n}};function B(o,t,e=o,n){if(t===H)return t;let r=n!==void 0?e._$Co?.[n]:e._$Cl,i=tt(t)?void 0:t._$litDirective$;return r?.constructor!==i&&(r?._$AO?.(!1),i===void 0?r=void 0:(r=new i(o),r._$AT(o,e,n)),n!==void 0?(e._$Co??=[])[n]=r:e._$Cl=r),r!==void 0&&(t=B(o,r._$AS(o,t.values),r,n)),t}var Dt=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){let{el:{content:e},parts:n}=this._$AD,r=(t?.creationScope??C).importNode(e,!0);N.currentNode=r;let i=N.nextNode(),s=0,a=0,l=n[0];for(;l!==void 0;){if(s===l.index){let u;l.type===2?u=new nt(i,i.nextSibling,this,t):l.type===1?u=new l.ctor(i,l.name,l.strings,this,t):l.type===6&&(u=new Ut(i,this,t)),this._$AV.push(u),l=n[++a]}s!==l?.index&&(i=N.nextNode(),s++)}return N.currentNode=C,r}p(t){let e=0;for(let n of this._$AV)n!==void 0&&(n.strings!==void 0?(n._$AI(t,n,e),e+=n.strings.length-2):n._$AI(t[e])),e++}},nt=class o{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,n,r){this.type=2,this._$AH=v,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=n,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode,e=this._$AM;return e!==void 0&&t?.nodeType===11&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=B(this,t,e),tt(t)?t===v||t==null||t===""?(this._$AH!==v&&this._$AR(),this._$AH=v):t!==this._$AH&&t!==H&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):Ao(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==v&&tt(this._$AH)?this._$AA.nextSibling.data=t:this.T(C.createTextNode(t)),this._$AH=t}$(t){let{values:e,_$litType$:n}=t,r=typeof n=="number"?this._$AC(t):(n.el===void 0&&(n.el=et.createElement(Ye(n.h,n.h[0]),this.options)),n);if(this._$AH?._$AD===r)this._$AH.p(e);else{let i=new Dt(r,this),s=i.u(this.options);i.p(e),this.T(s),this._$AH=i}}_$AC(t){let e=Ke.get(t.strings);return e===void 0&&Ke.set(t.strings,e=new et(t)),e}k(t){jt(this._$AH)||(this._$AH=[],this._$AR());let e=this._$AH,n,r=0;for(let i of t)r===e.length?e.push(n=new o(this.O(J()),this.O(J()),this,this.options)):n=e[r],n._$AI(i),r++;r<e.length&&(this._$AR(n&&n._$AB.nextSibling,r),e.length=r)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){let n=Ve(t).nextSibling;Ve(t).remove(),t=n}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}},U=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,n,r,i){this.type=1,this._$AH=v,this._$AN=void 0,this.element=t,this.name=e,this._$AM=r,this.options=i,n.length>2||n[0]!==""||n[1]!==""?(this._$AH=Array(n.length-1).fill(new String),this.strings=n):this._$AH=v}_$AI(t,e=this,n,r){let i=this.strings,s=!1;if(i===void 0)t=B(this,t,e,0),s=!tt(t)||t!==this._$AH&&t!==H,s&&(this._$AH=t);else{let a=t,l,u;for(t=i[0],l=0;l<i.length-1;l++)u=B(this,a[n+l],e,l),u===H&&(u=this._$AH[l]),s||=!tt(u)||u!==this._$AH[l],u===v?t=v:t!==v&&(t+=(u??"")+i[l+1]),this._$AH[l]=u}s&&!r&&this.j(t)}j(t){t===v?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}},Lt=class extends U{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===v?void 0:t}},Wt=class extends U{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==v)}},Bt=class extends U{constructor(t,e,n,r,i){super(t,e,n,r,i),this.type=5}_$AI(t,e=this){if((t=B(this,t,e,0)??v)===H)return;let n=this._$AH,r=t===v&&n!==v||t.capture!==n.capture||t.once!==n.once||t.passive!==n.passive,i=t!==v&&(n===v||r);r&&this.element.removeEventListener(this.name,this,n),i&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}},Ut=class{constructor(t,e,n){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=n}get _$AU(){return this._$AM._$AU}_$AI(t){B(this,t)}};var Fo=Kt.litHtmlPolyfillSupport;Fo?.(et,nt),(Kt.litHtmlVersions??=[]).push("3.3.3");var Ze=(o,t,e)=>{let n=e?.renderBefore??t,r=n._$litPart$;if(r===void 0){let i=e?.renderBefore??null;n._$litPart$=r=new nt(t.insertBefore(J(),i),i,void 0,e??{})}return r._$AI(o),r};var qt=globalThis,O=class extends T{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){let e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Ze(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return H}};O._$litElement$=!0,O.finalized=!0,qt.litElementHydrateSupport?.({LitElement:O});var Po=qt.litElementPolyfillSupport;Po?.({LitElement:O});(qt.litElementVersions??=[]).push("4.2.2");var Oo=new Set(["ob","on_battery","onbattery","on battery","battery","outage","power_outage","power outage","offline","off_grid","no_grid"]),zo=new Set(["power","plug","connectivity","running"]);function Xe(o){if(!o||o.state==="unavailable"||o.state==="unknown")return!1;let t=o.entity_id.split(".")[0];if(t==="binary_sensor")return zo.has(String(o.attributes.device_class))?o.state==="off":o.state==="on";if(t==="input_boolean"||t==="switch")return o.state==="on";let e=Number(o.state);if(o.state!==""&&Number.isFinite(e))return o.attributes.unit_of_measurement==="V"&&e<100;let n=String(o.state).toLowerCase().trim();return Oo.has(n)||n.startsWith("ob ")}function V(o,t,e=9e5){let n=o.mean.length;if(!n||t<o.start)return NaN;let r=(t-o.start)/o.step-.5,i=Math.floor(r);if(i<0)return o.mean[0];if(i>=n-1){let c=Je(o,n-1);return c>=0&&t-(o.start+(c+.5)*o.step)<=e?o.mean[c]:NaN}let s=o.mean[i],a=o.mean[i+1],l=r-i;if(!Number.isNaN(s)&&!Number.isNaN(a))return s+(a-s)*l;let u=Je(o,i);return u>=0&&t-(o.start+(u+.5)*o.step)<=e?o.mean[u]:NaN}function Je(o,t){for(let e=t;e>=0;e--)if(!Number.isNaN(o.mean[e]))return e;return-1}function tn(o,t,e=0){if(typeof t=="number"&&t>=0&&t<=6)return 10**-t;switch(typeof o=="string"?o:""){case"\xB0C":case"\xB0F":case"K":case"A":case"bar":case"km/h":case"m/s":return .1;case"%":case"V":case"hPa":case"mbar":case"dB":case"dBm":return 1;case"W":case"VA":case"var":case"ppm":case"lx":case"\xB5g/m\xB3":return Math.abs(e)>=1e3?10:1;case"kW":case"kWh":case"kVA":return .01;default:return Math.abs(e)>=100?1:Math.abs(e)>=10?.1:.01}}function en(o,t){if(!Number.isFinite(o))return"unknown";let e=t>=1?0:Math.min(6,Math.max(0,Math.round(-Math.log10(t)))),r=(Math.round(o/t)*t).toFixed(e);return/^-0(\.0*)?$/.test(r)?r.slice(1):r}var Io=o=>typeof o=="string"?{s:o,a:null}:{s:String(o[0]),a:o[1]&&typeof o[1]=="object"?o[1]:null},z=o=>`${o.s}\0${o.a?JSON.stringify(o.a):""}`;function on(o){let t=[...o].sort((d,m)=>d.day_start-m.day_start),e=new Map,n=new Map,r=new Set,i=1/0,s=-1/0,a=null,l=!1,u=null;for(let d of t){i=Math.min(i,d.day_start*1e3),s=Math.max(s,d.end*1e3),d.oldest===null?l=!0:a=a===null?d.oldest*1e3:Math.min(a,d.oldest*1e3),u??=d.keep_days;for(let[m,h]of Object.entries(d.entities??{})){let p=e.get(m)??[],g=d.day_start*1e3,_=Math.min(h.t.length,h.v.length);for(let w=0;w<_;w++){let b=h.tab[h.v[w]];if(b===void 0)continue;let y=Io(b),M=z(y),R=p[p.length-1],Q=g+h.t[w]*1e3;R&&(Q<R.t||R.k===M)||p.push({t:Q,v:y,k:M})}e.set(m,p)}for(let[m,h]of Object.entries(d.stats??{})){let p=n.get(m)??[];p.push({start:h.start*1e3,step:h.step*1e3,mean:h.mean}),n.set(m,p)}for(let m of d.missing??[])r.add(m)}let c=new Map;for(let[d,m]of e){if(!m.length)continue;let h=[],p=new Map,g=new Float64Array(m.length),_=new Uint32Array(m.length),w=new Float64Array(m.length);for(let b=0;b<m.length;b++){let y=p.get(m[b].k);y===void 0&&(y=h.length,h.push(m[b].v),p.set(m[b].k,y)),g[b]=m[b].t,_[b]=y,w[b]=b>0&&m[b-1].v.s===m[b].v.s?w[b-1]:m[b].t}c.set(d,{id:d,times:g,vals:_,values:h,since:w}),r.delete(d)}let f=new Map;for(let[d,m]of n){let h=m[0].step;if(!(h>0))continue;let p=Math.min(...m.map(b=>b.start)),g=Math.max(...m.map(b=>b.start+b.mean.length*b.step)),_=Math.max(0,Math.round((g-p)/h));if(!_)continue;let w=new Float32Array(_).fill(NaN);for(let b of m)b.mean.forEach((y,M)=>{let R=Math.round((b.start+M*b.step-p)/h);typeof y=="number"&&Number.isFinite(y)&&R>=0&&R<_&&(w[R]=y)});w.every(b=>Number.isNaN(b))||(f.set(d,{id:d,start:p,step:h,mean:w}),r.delete(d))}return{start:Number.isFinite(i)?i:0,end:Number.isFinite(s)?s:0,oldest:l?null:a,keepDays:u,tracks:c,series:f,missing:r}}function S(o,t){let e=0,n=o.length-1;if(n<0||o[0]>t)return-1;for(;e<n;){let r=e+n+1>>1;o[r]<=t?e=r:n=r-1}return e}var K=class{tracks;idx;t=-1/0;constructor(t){this.tracks=[...t.tracks.values()],this.idx=new Int32Array(this.tracks.length).fill(-1)}at(t){let e=t>=this.t;for(let n=0;n<this.tracks.length;n++){let r=this.tracks[n].times,i=this.idx[n];if(!e)i=S(r,t);else{let s=0;for(;i+1<r.length&&r[i+1]<=t&&s<8;)i++,s++;i+1<r.length&&r[i+1]<=t&&(i=S(r,t))}this.idx[n]=i}return this.t=t,this.idx}value(t){let e=this.idx[t];return e<0?null:this.tracks[t].values[this.tracks[t].vals[e]]}},No=new Set(["unavailable","unknown"]);function Qt(o,t=5*6e4,e=.6,n=10*6e4,r=-1/0){let i=new K(o);if(!i.tracks.length)return[];let s=Math.max(o.oldest??o.start,r),a=[],l=null;for(let u=s;u<=o.end;u+=t){i.at(u);let c=0;for(let d=0;d<i.tracks.length;d++){let m=i.value(d);(!m||No.has(m.s))&&c++}let f=c/i.tracks.length>=e;f&&l===null&&(l=u),!f&&l!==null&&(u-l>=n&&a.push([l,u]),l=null)}return l!==null&&o.end-l>=n&&a.push([l,o.end]),a}function rn(o){for(let t=0;t<o.times.length;t++)o.since[t]=t>0&&o.values[o.vals[t-1]].s===o.values[o.vals[t]].s?o.since[t-1]:o.times[t]}function Co(o,t){let e=[...o.values],n=new Map(e.map((u,c)=>[z(u),c])),r=t.values.map(u=>{let c=z(u),f=n.get(c);return f===void 0&&(f=e.length,e.push(u),n.set(c,f)),f}),i=t.times.length?t.times[0]:1/0,s=[],a=[];for(let u=0;u<o.times.length&&o.times[u]<i;u++)s.push(o.times[u]),a.push(o.vals[u]);for(let u=0;u<t.times.length;u++){let c=r[t.vals[u]];a.length&&a[a.length-1]===c||(s.push(t.times[u]),a.push(c))}let l={id:o.id,times:Float64Array.from(s),vals:Uint32Array.from(a),values:e,since:new Float64Array(s.length)};return(o.dropped||t.dropped)&&(l.dropped=Float64Array.from([...o.dropped??[],...t.dropped??[]]).sort()),rn(l),l}function Ho(o,t){let e=o.step,n=Math.min(o.start,t.start),r=Math.max(o.start+o.mean.length*o.step,t.start+t.mean.length*t.step),i=Math.max(0,Math.round((r-n)/e)),s=new Float32Array(i).fill(NaN);for(let a of[o,t])for(let l=0;l<a.mean.length;l++){let u=Math.round((a.start+l*a.step-n)/e);!Number.isNaN(a.mean[l])&&u>=0&&u<i&&(s[u]=a.mean[l])}return{id:o.id,start:n,step:e,mean:s}}function sn(o,t){let[e,n]=o.start<=t.start?[o,t]:[t,o],r=new Map;for(let l of new Set([...e.tracks.keys(),...n.tracks.keys()])){let u=e.tracks.get(l),c=n.tracks.get(l);r.set(l,u&&c?Co(u,c):u??c)}let i=new Map;for(let l of new Set([...e.series.keys(),...n.series.keys()])){let u=e.series.get(l),c=n.series.get(l);i.set(l,u&&c?Ho(u,c):u??c)}let s=new Set([...e.missing,...n.missing].filter(l=>!r.has(l)&&!i.has(l))),a=e.oldest===null?null:e.oldest<e.end?e.oldest:n.oldest??n.start;return{start:e.start,end:Math.max(e.end,n.end),oldest:a,keepDays:n.keepDays??e.keepDays,tracks:r,series:i,missing:s}}function an(o){let t=0;for(let e of o.tracks.values())t+=e.times.length;return t}function ln(o){let t=0;for(let e of o.tracks.values())t+=e.times.length*20+e.values.length*120;for(let e of o.series.values())t+=e.mean.length*4;return t}var un=3e5;function cn(o,t,e=6e4,n=5*6e4){let r=0;for(let i of t){let s=o.tracks.get(i);if(!s||s.times.length<3)continue;let a=s.times.length,l=h=>s.values[s.vals[h]].s,u=[],c=[],f=null;for(let h=0;h<a;h++){let p=u.length?u[u.length-1]:-1;if(p>=0&&f!==null&&l(p)==="off"&&l(h)==="on"&&h+1<a&&l(h+1)==="off"&&s.times[h+1]-s.times[h]<e&&s.times[h]-f<=n){c.push(s.times[h]),h++,r+=2;continue}if(p>=0&&s.vals[p]===s.vals[h]){r++;continue}p>=0&&l(p)==="on"&&l(h)!=="on"&&(f=s.times[h]),u.push(h)}if(u.length===a)continue;let d=Float64Array.from(u,h=>s.times[h]),m=Uint32Array.from(u,h=>s.vals[h]);s.times=d,s.vals=m,s.since=new Float64Array(u.length),c.length&&(s.dropped=Float64Array.from([...s.dropped??[],...c]).sort()),rn(s)}return r}var nn=new WeakMap;function Vo(o){let t=nn.get(o);return(!t||t.size!==o.values.length)&&(t=new Map(o.values.map((e,n)=>[z(e),n])),nn.set(o,t)),t}function Yt(o,t){let e=Vo(o),n=o.times.length,r=n?o.times[n-1]:-1/0,i=n?o.vals[n-1]:-1,s=[],a=[];for(let d of t){if(d.t<r)continue;let m=z(d.v),h=e.get(m);h!==i&&(h===void 0&&(h=o.values.length,o.values.push(d.v),e.set(m,h)),s.push(d.t),a.push(h),r=d.t,i=h)}if(!s.length)return 0;let l=n+s.length,u=new Float64Array(l);u.set(o.times),u.set(s,n);let c=new Uint32Array(l);c.set(o.vals),c.set(a,n);let f=new Float64Array(l);f.set(o.since);for(let d=n;d<l;d++)f[d]=d>0&&o.values[c[d-1]].s===o.values[c[d]].s?f[d-1]:u[d];return o.times=u,o.vals=c,o.since=f,s.length}function dn(o,t){let e=-1;for(let r of t)Number.isFinite(r.value)&&r.t>=o.start&&(e=Math.max(e,Math.floor((r.t-o.start)/o.step)));if(e<0)return 0;if(e>=o.mean.length){let r=new Float32Array(e+1).fill(NaN);r.set(o.mean),o.mean=r}let n=0;for(let r of t){if(!Number.isFinite(r.value)||r.t<o.start)continue;let i=Math.floor((r.t-o.start)/o.step);Number.isNaN(o.mean[i])&&(o.mean[i]=r.value,n++)}return n}function fn(o,t){let e={id:o,times:new Float64Array(0),vals:new Uint32Array(0),values:[],since:new Float64Array(0)};return Yt(e,t)?e:null}function pn(o,t){if(t<=o.start)return o;let e=new Map;for(let[i,s]of o.tracks){let a=Math.max(0,S(s.times,t));if(a===0){e.set(i,s);continue}let l={id:i,times:s.times.slice(a),vals:s.vals.slice(a),values:s.values,since:s.since.slice(a)};s.dropped&&(l.dropped=s.dropped.filter(u=>u>=t)),e.set(i,l)}let n=new Map;for(let[i,s]of o.series){let a=Math.max(0,Math.floor((t-s.start)/s.step));n.set(i,a?{id:i,start:s.start+a*s.step,step:s.step,mean:s.mean.slice(a)}:s)}let r=o.oldest!==null&&o.oldest>t?o.oldest:null;return{...o,start:t,oldest:r,tracks:e,series:n}}function mn(o,t,e,n){let r={};for(let s of t){let a=o.series.get(s),l=o.tracks.get(s);if(!a&&!l)continue;let u=[];for(let c=Math.floor(e/3e5)*3e5;c<n;c+=3e5){let f=NaN;if(a){let d=Math.floor((c+15e4-a.start)/a.step);f=d>=0&&d<a.mean.length?a.mean[d]:NaN}else if(l){let d=S(l.times,c+15e4);f=d<0?NaN:Number(l.values[l.vals[d]].s)}Number.isFinite(f)&&u.push({start:c,mean:f})}u.length&&(r[s]=u)}return r}var D=null;function Zt(o){let t=o?.locale?.time_zone,e=o?.config?.time_zone;if(t!=="server"||!e)return null;try{return new Intl.DateTimeFormat("en-US",{timeZone:e}),e}catch{return null}}function Xt(o){D=o}var hn=new Map;function Do(o){let t=hn.get(o);return t||(t=new Intl.DateTimeFormat("en-US",{timeZone:o,hourCycle:"h23",year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",second:"numeric"}),hn.set(o,t)),t}function ht(o,t){let e=[0,0,0,0,0,0];for(let n of Do(t).formatToParts(o)){let r=Number(n.value);n.type==="year"?e[0]=r:n.type==="month"?e[1]=r-1:n.type==="day"?e[2]=r:n.type==="hour"?e[3]=r%24:n.type==="minute"?e[4]=r:n.type==="second"&&(e[5]=r)}return e}function mt(o,t){let[e,n,r,i,s,a]=ht(o,t),l=o-(o%1e3+1e3)%1e3;return Date.UTC(e,n,r,i,s,a)-l}function j(o,t=D){return t?ht(o,t)[3]:new Date(o).getHours()}function F(o,t=D){if(!t)return new Date(o).setHours(0,0,0,0);let[e,n,r]=ht(o,t),i=Date.UTC(e,n,r)-mt(o,t);return i=Date.UTC(e,n,r)-mt(i,t),i}function gt(o,t=D){return F(F(o,t)+27*36e5,t)}function bt(o,t=D){if(!t)return new Date(o).setMinutes(0,0,0);let[,,,,e,n]=ht(o,t);return o-(o%1e3+1e3)%1e3-(e*60+n)*1e3}function Jt(o,t,e,n=D){if(!n){let s=new Date(o);return s.setHours(t,e,0,0),s.getTime()}let r=F(o,n),i=r+(t*60+e)*6e4;return i-(mt(i,n)-mt(r,n))}function ot(o=D){return o?{timeZone:o}:{}}var yt={alarm:100,smoke:95,gas:95,co:95,water:90,outage:88,rain:70,door:50,lock:45,garage:40,camera:38,motion:35,washer:25,robot_done:20,robot_start:15,window:12,battery_full:10,pv_peak:8},bn=new Set(["window","battery_full","pv_peak"]),_t=new Set(["alarm","smoke","gas","co","water","outage"]),te={alarm:"safety",smoke:"safety",gas:"safety",co:"safety",water:"safety",outage:"safety",motion:"safety",camera:"safety",door:"openings",lock:"openings",garage:"openings",rain:"openings",window:"openings",washer:"devices",robot_start:"devices",robot_done:"devices",battery_full:"energy",pv_peak:"energy"},Lo=new Set(["rainy","pouring","lightning-rainy","hail","snowy-rainy"]),rt=new Set(["unavailable","unknown"]),L=new Set(["on","open","opening","tilted"]);function Wo(o){let t=j(o);return t>=23||t<5}function*it(o){let t=null;for(let e=0;e<o.times.length;e++){let n=o.values[o.vals[e]].s;n!==t&&(yield{t:o.times[e],from:t,to:n}),t=n}}function G(o,t,e){let n=[],r=null;for(let i of it(o)){let s=t.has(i.to);s&&r===null&&(r=i.t),!s&&r!==null&&(n.push([r,i.t]),r=null)}return r!==null&&n.push([r,e]),n}function Bo(o,t){let e=o.tracks.get(t);if(e){let i=[];for(let s=0;s<e.times.length;s++){let a=Number(e.values[e.vals[s]].s);Number.isFinite(a)&&i.push({t:e.times[s],w:a})}return i}let n=o.series.get(t);if(!n)return[];let r=[];for(let i=0;i<n.mean.length;i++){let s=n.start+(i+.5)*n.step,a=V(n,s);Number.isFinite(a)&&r.push({t:s,w:a})}return r}function Uo(o,t=10,e=5,n=20*6e4){let r=[],i=null;for(let s of o)i===null&&s.w>t?i=s.t:i!==null&&s.w<e&&(s.t-i>=n&&r.push(s.t),i=null);return r}function gn(o,t,e,n,r=3e5){let i=Math.max(0,Math.ceil((n-e)/r)),s=new Float64Array(i).fill(NaN),a=o.series.get(t),l=o.tracks.get(t);for(let u=0;u<i;u++){let c=e+(u+.5)*r;if(a)s[u]=V(a,c);else if(l){let f=S(l.times,c);s[u]=f<0?NaN:Number(l.values[l.vals[f]].s)}}return s}function Ko(o,t){let e=[],r=Math.floor(o.start/3e5)*3e5;for(let i of t.soc){let s=gn(o,i,r,o.end),a=!1;s.forEach((l,u)=>{Number.isNaN(l)||(l<95?a=!0:l>=99&&a&&(a=!1,e.push({t:r+(u+.5)*3e5,kind:"battery_full",entity:i})))})}if(t.solar.length){let i=t.solar.map(c=>gn(o,c,r,o.end)),s=i[0].length,a=-1,l={t:0,w:0},u=()=>{l.w>100&&e.push({t:l.t,kind:"pv_peak",entity:t.solar[0]}),l={t:0,w:0}};for(let c=0;c<s;c++){let f=r+(c+.5)*3e5,d=F(f);d!==a&&(a>=0&&u(),a=d);let m=0;for(let h of i)Number.isNaN(h[c])||(m+=Math.max(0,h[c]));m>l.w&&(l={t:f,w:m})}a>=0&&(o.end>=gt(a)||t.sunDown?.(o.end))&&u()}return e}function yn({timeline:o,roles:t,weather:e,night:n=Wo,energy:r=null,outage:i=null}){let s=[],a=(d,m,h)=>{d>=o.start&&d<=o.end&&s.push({t:d,kind:m,entity:h})},l=e?o.tracks.get(e):void 0,u=l?G(l,Lo,o.end):[];for(let[d,m]of t){if(m==="washer"){for(let p of Uo(Bo(o,d)))a(p,"washer",d);continue}let h=o.tracks.get(d);if(h){if(m==="window"||m==="window_more"){for(let[p,g]of G(h,L,o.end)){m==="window"&&p>o.start&&p>h.times[0]&&a(p,"window",d);for(let[_,w]of u)p<w&&_<g&&a(Math.max(p,_),"rain",d)}continue}for(let p of it(h))if(p.from!==null)switch(m){case"door":L.has(p.to)&&!L.has(p.from)&&!rt.has(p.from)&&a(p.t,"door",d);break;case"garage":(p.to==="on"||p.to==="open"||p.to==="opening")&&(p.from==="off"||p.from==="closed"||p.from==="closing")&&a(p.t,"garage",d);break;case"lock":(p.to==="unlocked"||p.to==="open")&&(p.from==="locked"||p.from==="locking")&&a(p.t,"lock",d);break;case"alarm":p.to==="triggered"&&a(p.t,"alarm",d);break;case"smoke":case"gas":case"co":case"water":p.to==="on"&&p.from!=="on"&&!rt.has(p.from)&&a(p.t,m,d);break;case"motion":p.to==="on"&&p.from==="off"&&n(p.t)&&a(p.t,"motion",d);break;case"camera":p.to==="on"&&p.from!=="on"&&!rt.has(p.from)&&a(p.t,"camera",d);break;case"robot":p.to==="cleaning"&&p.from!=="cleaning"&&p.from!=="paused"?a(p.t,"robot_start",d):p.to==="docked"&&(p.from==="cleaning"||p.from==="returning"||p.from==="paused")&&a(p.t,"robot_done",d);break}}}if(r)for(let d of Ko(o,r))a(d.t,d.kind,d.entity);let c=i?o.tracks.get(i.id):void 0;if(i&&c){let d=m=>Xe({entity_id:i.id,state:m,attributes:i.attributes});for(let m of it(c))m.from!==null&&d(m.to)&&!d(m.from)&&a(m.t,"outage",i.id)}s.sort((d,m)=>d.t-m.t||yt[m.kind]-yt[d.kind]);let f=new Map;return s.filter(d=>{let m=`${d.kind}:${d.entity}`,h=f.get(m),p=d.kind==="motion"?30*6e4:5*6e4;return h!==void 0&&d.t-h<p?!1:(f.set(m,d.t),!0)})}function _n(o,t){let e=[];for(let n=o.length-1;n>=0;n--){let r=o[n];if(!t.has(te[r.kind]))continue;let i=bt(r.t),s=e[e.length-1];s&&s.hour===i?s.events.unshift(r):e.push({hour:i,events:[r]})}return e}function xn(o,t,e=14){let n=[];for(let r of o){let i=t(r.t),s=n[n.length-1];s&&i-s.x<e?(s.events.push(r),yt[r.kind]>yt[s.top.kind]&&(s.top=r,s.t=r.t)):n.push({x:i,t:r.t,top:r,events:[r]})}return n}var jo="home3d.time_format",xt={};function Go(o){xt.pref=o==="12"||o==="24"?o:"auto"}function qo(){if(xt.pref===void 0)try{Go(localStorage.getItem(jo))}catch{xt.pref="auto"}return xt.pref??"auto"}function vn(o,t){let e=qo();if(e!=="auto")return e==="12";let n=o?.time_format;if(n==="12"||n==="am_pm")return!0;if(n==="24"||n==="twenty_four")return!1;try{let r=n==="system"?void 0:(o?.language||t||void 0)?.replace("_","-");return new Intl.DateTimeFormat(r,{hour:"numeric"}).resolvedOptions().hourCycle?.startsWith("h12")??!1}catch{return!1}}function ee(o){return{h12:vn(o?.locale,o?.language),language:o?.language}}function Qo(o){return o?{hour12:!0}:{hourCycle:"h23"}}var wn=new Map;function Yo(o,t,e){let n=o?.replace("_","-"),r=`${n}|${e}|${JSON.stringify(t)}`,i=wn.get(r);if(!i){try{i=new Intl.DateTimeFormat(n,e?{...t,timeZone:e}:t)}catch{i=new Intl.DateTimeFormat(void 0,t)}wn.set(r,i)}return i}function Mn(o,t,e={}){if(!Number.isFinite(+o))return"\u2013";let n={hour:t.h12?"numeric":"2-digit",minute:"2-digit",...e.seconds?{second:"2-digit"}:{},...Qo(t.h12)};return Yo(t.language,n,e.timeZone).format(o)}var wt=[60,360,900,3600],ne=[60,360,900,3600,14400],kn=360;function Sn(o,t){return o==="low"||t?500:o==="high"?167:250}var vt=class{start;end;t;playing=!1;speed;speeds;constructor(t,e,n,r=kn,i=wt){this.start=t,this.end=e,this.speeds=i,this.t=Math.min(e,Math.max(t,n)),this.speed=i.includes(r)?r:kn}setRange(t,e,n=this.speeds){this.start=t,this.end=e,this.speeds=n,n.includes(this.speed)||(this.speed=n.includes(3600)?3600:n[n.length-1]),this.t=Math.min(e,Math.max(t,this.t))}play(){this.t>=this.end&&(this.t=this.start),this.playing=!0}pause(){this.playing=!1}toggle(){this.playing?this.pause():this.play()}seek(t){this.t=Math.min(this.end,Math.max(this.start,t))}advance(t){if(!this.playing||!(t>0))return!1;let e=Math.min(this.end,this.t+t*this.speed),n=e!==this.t;return this.t=e,this.t>=this.end&&(this.playing=!1),n}nextSpeed(){let t=this.speeds.indexOf(this.speed);return this.speed=this.speeds[(t+1)%this.speeds.length],this.speed}};function Rn(o,t,e,n=3e4){if(e>0)return o.find(r=>r.t>t+n)??null;for(let r=o.length-1;r>=0;r--)if(o[r].t<t-n)return o[r];return null}function En(o,t,e){let n=0,r=o.length;for(;n<r;){let s=n+r>>1;o[s].t<t?n=s+1:r=s}let i=n;for(;i<o.length&&o[i].t<=e;)i++;return n===0&&i===o.length?o:o.slice(n,i)}function oe(o,t,e,n){if(!(e>t))return null;let r=0,i=o.length;for(;r<i;){let s=r+i>>1;o[s].t<=t?r=s+1:i=s}for(let s=r;s<o.length&&o[s].t<=e;s++)if(n(o[s]))return o[s];return null}function Mt(o,t){let e=(o??"").trim(),n=/^-(\d+(?:[.,]\d+)?)\s*(h|m|min)$/i.exec(e);if(n)return t-Number(n[1].replace(",","."))*(n[2].toLowerCase()==="h"?36e5:6e4);let r=/^(\d{1,2}):(\d{2})$/.exec(e);if(!r||Number(r[1])>23||Number(r[2])>59)return null;let i=Jt(t,Number(r[1]),Number(r[2]));return i>t?Jt(i-864e5,Number(r[1]),Number(r[2])):i}var st={prev:"M6 6h2v12H6zM20 6v12l-10-6z",play:"M8 5v14l11-7z",pause:"M7 5h4v14H7zM13 5h4v14h-4z",next:"M16 6h2v12h-2zM4 6v12l10-6z",list:"M4 6h16v2H4zM4 11h16v2H4zM4 16h16v2H4z"},kt=o=>Qe`<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d=${o} /></svg>`,Zo=60,Xo=(o,t)=>o-t>=Zo,$n={alarm:"#ff3b4f",smoke:"#ff3b4f",outage:"#ffc83a",gas:"#ff3b4f",co:"#ff3b4f",water:"#3aa0ff",rain:"#6cc8ff",door:"#ffb020",lock:"#ffb020",garage:"#ffb020",window:"#ffd27a",motion:"#b48cff",camera:"#e07aff",washer:"#4dff9a",robot_start:"#4dff9a",robot_done:"#4dff9a",battery_full:"#ffe27a",pv_peak:"#ffe27a"},Jo={alarm:"#ff3b4f",door:"#ffb020",window:"#ffd27a",window_open:"#6cc8ff",light_on:"#ffe27a",motion:"#b48cff",appliance:"#4dff9a"},re=class extends O{static properties={session:{attribute:!1},demo:{type:Boolean},_w:{state:!0},_label:{state:!0},_toast:{state:!0},_sheet:{state:!0},_filters:{state:!0},_awayFrom:{state:!0},_compare:{state:!0}};unlisten=null;listened=null;resize=null;sig="";dragging=!1;scrubAt=0;scrubTimer;holdTimer;held=!1;labelTimer;toastTimer;clusters=[];clusterSig="";awayOffer=null;awayCache=null;constructor(){super(),this.session=null,this.demo=!1,this._w=0,this._label=null,this._toast=!1,this._sheet=null,this._filters=new Set(["safety","openings","devices","energy"]),this._awayFrom=null,this._compare=!1}onBlocked=()=>{this._toast=!0,clearTimeout(this.toastTimer),this.toastTimer=setTimeout(()=>this._toast=!1,2600)};onKey=t=>{let e=this.session,n=t.composedPath()[0];if(!(!e?.playback||t.ctrlKey||t.metaKey||t.altKey||n&&/^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName)||n?.isContentEditable))if(t.key===" "){if(n?.tagName==="BUTTON")return;t.preventDefault(),e.toggle()}else(t.key==="ArrowLeft"||t.key==="ArrowRight")&&(t.preventDefault(),e.seek(e.playback.t+(t.key==="ArrowLeft"?-1:1)*(t.shiftKey?36e5:3e5)))};onEscape=t=>{t.key!=="Escape"||!this._sheet||(t.stopImmediatePropagation(),this._sheet=null)};connectedCallback(){super.connectedCallback(),window.addEventListener("fp3d-replay-blocked",this.onBlocked),window.addEventListener("keydown",this.onKey),window.addEventListener("keydown",this.onEscape,!0)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("fp3d-replay-blocked",this.onBlocked),window.removeEventListener("keydown",this.onKey),window.removeEventListener("keydown",this.onEscape,!0),this.unlisten?.(),this.unlisten=null,this.listened=null,this.resize?.disconnect(),this.resize=null;for(let t of[this.scrubTimer,this.holdTimer,this.labelTimer,this.toastTimer])clearTimeout(t)}updated(){this.session!==this.listened&&(this.unlisten?.(),this.listened=this.session,this.unlisten=this.session?this.session.listen(()=>this.onTick()):null);let t=this.renderRoot.querySelector(".track");t&&!this.resize&&typeof ResizeObserver=="function"&&(this.resize=new ResizeObserver(e=>{let n=Math.round(e[0]?.contentRect.width??0);n!==this._w&&(this._w=n)}),this.resize.observe(t)),this.onTick()}signature(){let t=this.session,e=t?.playback,n=this._sheet==="day"&&e?F(e.t):0;return`${t?.state}|${t?.error}|${Math.round((t?.progress??0)*20)}|${e?.playing}|${e?.speed}|${t?.events.length}|${t?.allEvents.length}|${t?.range}|${t?.maxDays}|${t?.loadingDay}|${t?.full}|${t?.version}|${t?.atNow}|${t?.follow}|${t?.stopImportant}|${n}`}onTick(){let t=this.signature();t!==this.sig&&(this.sig=t,this.requestUpdate());let e=this.session,n=e?.playback;if(!e||!n)return;let r=this.renderRoot.querySelector(".clock-time"),i=this.renderRoot.querySelector(".clock-ago");r&&(r.textContent=this.clockText(n.t)),i&&(i.textContent=this.agoText(n.t)),this.dragging||this.placeHead(this.xOf(n.t))}placeHead(t){let e=this.renderRoot.querySelector(".head");e&&(e.style.transform=`translateX(${t.toFixed(1)}px)`)}get language(){return this.session?.opts.live.language??navigator.language}xOf(t){let e=this.session;return!e||!this._w?0:(t-e.start)/(e.end-e.start)*this._w}tOf(t){let e=this.session;return e.start+Math.min(this._w,Math.max(0,t))/Math.max(1,this._w)*(e.end-e.start)}weekday(t){return new Date(t).toLocaleDateString(this.language,{weekday:"short",...ot()}).replace(/\.$/,"")}clockText(t){return`${this.weekday(t)} ${this.time(t)}`}agoText(t){let e=this.session,n=Math.round((e.end-t)/6e4);return n<1?e.t("tt_now"):e.t("tt_ago",{d:this.duration(n*6e4)})}duration(t){let e=this.session,n=Math.round(t/6e4),r=Math.floor(n/1440),i=Math.floor(n%1440/60),s=n%60;return r?`${e.t("tt_days",{n:r})}${i?` ${i} h`:""}`:i?`${i} h${s?` ${s} min`:""}`:`${s} min`}name(t){let e=this.session;return e.names.get(t)??e.opts.live.states[t]?.attributes.friendly_name??t}eventText(t){return this.session.t(`tt_ev_${t.kind}`,{name:this.name(t.entity)})}time(t){return Mn(t,ee(this.session?.opts.live),ot())}onDown(t){let e=this.session;!e?.playback||t.target.closest(".mark")||(t.currentTarget.setPointerCapture?.(t.pointerId),this.dragging=!0,this._label=null,e.pause(),this.scrub(t,!0))}onMove(t){this.dragging&&this.scrub(t,!1)}onUp(t){this.dragging&&(this.scrub(t,!0),this.dragging=!1)}scrub(t,e){let n=this.session,r=this.renderRoot.querySelector(".track"),i=t.clientX-r.getBoundingClientRect().left,s=Math.max(n.playback?.start??n.start,this.tOf(i));this.placeHead(this.xOf(s));let a=this.renderRoot.querySelector(".clock-time");a&&(a.textContent=this.clockText(s)),clearTimeout(this.scrubTimer);let l=n.opts.spec.low||n.opts.quality==="low"?160:70,u=performance.now();e||u-this.scrubAt>=l?(this.scrubAt=u,n.seek(s)):this.scrubTimer=setTimeout(()=>{this.scrubAt=performance.now(),n.seek(s)},l)}markDown(t){this.held=!1,clearTimeout(this.holdTimer),this.holdTimer=setTimeout(()=>{this.held=!0,this.showLabel(t)},450)}markUp(){clearTimeout(this.holdTimer)}markClick(t){if(this.held){this.held=!1;return}this.session?.seek(t.t,!0),this.showLabel(t,2500)}showLabel(t,e=4500){this._label={x:t.x,lines:t.events.slice(0,4).map(n=>`${this.time(n.t)} \xB7 ${this.eventText(n)}`).concat(t.events.length>4?[`+${t.events.length-4}`]:[])},clearTimeout(this.labelTimer),this.labelTimer=setTimeout(()=>this._label=null,e)}renderTrack(){let t=this.session,e=this._w;if(!e)return v;let n=t.range==="7d",r=p=>`${((p-t.start)/(t.end-t.start)*100).toFixed(3)}%`,i=(p,g,_,w)=>g>p?x`<i class=${_} style="left:${r(Math.max(p,t.start))};width:calc(${r(Math.min(g,t.end))} - ${r(Math.max(p,t.start))})">${w?x`<span>${w}</span>`:v}</i>`:v,s=t.timeline?.oldest??null,a=t.playback?.start??t.start,l=t.recorderStart,u=v;a>t.start+6e4&&(t.loadingDay!==null?u=i(t.start,a,"loading",t.t("tt_loading_day",{day:this.weekday(t.loadingDay+12*36e5)})):l!==null&&l>t.start?u=i(t.start,a,"nodata",t.t("tt_recorder_days",{n:t.timeline?.keepDays??0})):u=i(t.start,a,"nodata",t.full?t.t("tt_memory_full"):""));let c=n?e/(t.end-t.start)*36e5*3>=12?3:6:1,f=e>=640?3:6,d=[],m=bt(t.start);for(m<t.start&&(m+=36e5);m<=t.end;m+=36e5){let p=j(m);if(p%c)continue;let g=p===0,_=g?n?`${this.weekday(m)} ${new Date(m).toLocaleDateString(this.language,{day:"numeric",...ot()}).replace(/\.$/,"")}.`:this.weekday(m):!n&&p%f===0?this.time(m):"",w=_&&Xo(e,this.xOf(m))?_:"";d.push(x`<b class="tick ${g?"tick-day":_?"tick-major":""}" style="left:${r(m)}">${w?x`<span>${w}</span>`:v}</b>`)}let h=`${e}|${t.events.length}|${t.start}|${t.end}|${t.version}|${a}`;return h!==this.clusterSig&&(this.clusterSig=h,this.clusters=xn(t.shownEvents(),p=>this.xOf(p),e<500?18:14)),x`${t.nights.map(([p,g])=>i(p,g,"night"))} ${u} ${s!==null&&s>a?i(a,s,"nodata"):v}
      ${t.gaps.map(([p,g])=>i(p,g,"gap"))} ${d}
      ${this.clusters.map(p=>x`<button
          class="mark ${p.events.length>1?"mark-many":""}"
          style="left:${p.x.toFixed(1)}px;--c:${$n[p.top.kind]}"
          title=${p.events.map(g=>`${this.time(g.t)} ${this.eventText(g)}`).join(`
`)}
          aria-label=${`${this.time(p.t)} ${this.eventText(p.top)}`}
          @pointerdown=${()=>this.markDown(p)}
          @pointerup=${()=>this.markUp()}
          @pointerleave=${()=>this.markUp()}
          @contextmenu=${g=>g.preventDefault()}
          @click=${()=>this.markClick(p)}
        >
          ${p.events.length>1?x`<span>${p.events.length}</span>`:v}
        </button>`)}
      <div class="head" style="transform:translateX(${this.xOf(t.playback?.t??t.end).toFixed(1)}px)"></div>
      ${this._label?x`<div class="label" style="--x:${this._label.x.toFixed(1)}px">${this._label.lines.map(p=>x`<span>${p}</span>`)}</div>`:v}`}toggleSheet(t="events"){this._sheet=this._sheet===t||this._sheet&&t==="events"?null:t}toggleFilter(t){let e=new Set(this._filters);e.has(t)?e.delete(t):e.add(t),this._filters=e}where(t){return this.session.roomOf.get(t)?.name??""}renderEvents(){let t=this.session,e=t.t,n=["safety","openings","devices",...t.energy?["energy"]:[]],r=_n(t.shownEvents(!0).filter(s=>t.energy||te[s.kind]!=="energy"),this._filters),i=0;return x`<div class="filters">
        ${n.map(s=>x`<button class="fchip" aria-pressed=${this._filters.has(s)} @click=${()=>this.toggleFilter(s)}>${e(`tt_f_${s}`)}</button>`)}
      </div>
      <label class="opt"><input type="checkbox" .checked=${t.follow} @change=${s=>t.setFollow(s.target.checked)} />${e("tt_follow")}</label>
      <label class="opt"><input type="checkbox" .checked=${t.stopImportant} @change=${s=>t.setStopImportant(s.target.checked)} />${e("tt_stop")}</label>
      ${r.length?r.map(s=>i>=300?v:(i+=s.events.length,x`<h4>${this.clockText(s.hour)}</h4>
              ${s.events.map(a=>this.row($n[a.kind],this.time(a.t),this.eventText(a),this.where(a.entity),()=>t.goTo(a)))}`)):x`<p class="none">${e("tt_no_events")}</p>`}`}row(t,e,n,r,i){return x`<button class="row" @click=${i}>
      <i style="background:${t}"></i><time>${e}</time><span>${n}${r?x`<small>${r}</small>`:v}</span>
    </button>`}awayText(t){let e=this.session.t,n=this.name(t.entity);switch(t.kind){case"alarm":case"appliance":return this.eventText({kind:t.event??"alarm",entity:t.entity});case"door":case"window":return e("tt_away_door",{name:n,n:t.count});case"motion":return e("tt_away_motion",{name:n,n:t.count});case"light_on":return e("tt_away_light",{name:n,d:this.duration(t.ms)});case"window_open":return e("tt_away_open",{name:n,d:this.duration(t.ms)})}}renderAway(){let t=this.session,e=t.t,n=t.playback;this.awayOffer?.version!==t.version&&(this.awayOffer={version:t.version,offer:t.awayOffer()});let r=this.awayOffer.offer,[i,s]=this._awayFrom??r??[t.lastClosed!==null&&t.lastClosed>=n.start?t.lastClosed:Math.max(n.start,t.end-3*36e5),t.end],a=`${t.version}|${i}|${s}`;this.awayCache?.key!==a&&(this.awayCache={key:a,rows:t.away(i,s)});let l=this.awayCache.rows,u=g=>this._awayFrom=g,c=(g,_)=>`${this.clockText(g)} \u2013 ${_>=t.end-6e4?e("tt_now"):this.clockText(_)}`,f=ee(t.opts.live).h12,d=g=>{let _=g.currentTarget.closest(".when"),w=M=>_.querySelector(`[data-p="${M}"]`)?.value??"";if(w("h")==="")return;let b=f?Number(w("h"))%12+(w("p")==="pm"?12:0):Number(w("h")),y=Mt(`${b}:${String(Number(w("m"))).padStart(2,"0")}`,t.end);y!==null&&u([Math.max(n.start,y),t.end])},m=g=>String(g).padStart(2,"0"),h=f?[12,...Array.from({length:11},(g,_)=>_+1)]:Array.from({length:24},(g,_)=>_),p=x`<span class="when" role="group" aria-label=${e("tt_away_since")}>
      <select data-p="h" aria-label=${e("time_hour")} @change=${d}>
        <option value="">–</option>${h.map(g=>x`<option value=${g}>${f?g:m(g)}</option>`)}
      </select
      >:<select data-p="m" aria-label=${e("time_minute")} @change=${d}>${Array.from({length:12},(g,_)=>x`<option value=${_*5}>${m(_*5)}</option>`)}</select>
      ${f?x`<select data-p="p" aria-label="AM/PM" @change=${d}><option value="am">AM</option><option value="pm">PM</option></select>`:v}
    </span>`;return x`<p class="since">${e("tt_away_since")}:</p>
      <div class="filters">
        ${t.lastClosed!==null&&t.lastClosed>=n.start?x`<button class="fchip" aria-pressed=${i===t.lastClosed} @click=${()=>u([t.lastClosed,t.end])}>${e("tt_away_last")}</button>`:v}
        ${r?x`<button class="fchip" aria-pressed=${i===r[0]&&s===r[1]} @click=${()=>u(r)}>${e("tt_away_quiet",{from:this.time(r[0]),to:this.time(r[1])})}</button>`:v}
        ${p}
      </div>
      <h4>${c(i,s)}</h4>
      ${l.length?l.slice(0,200).map(g=>this.row(Jo[g.kind],this.time(g.t),this.awayText(g),this.where(g.entity),()=>t.goTo(g))):x`<p class="none">${e("tt_away_none")}</p>`}`}renderDay(){let t=this.session,e=t.t,n=t.playback,r=F(n.t),i=t.daySummary(r),s=F(r-12*36e5),a=this._compare?t.daySummary(s):null;this._compare&&(!a||a.from>s+6e4)&&queueMicrotask(()=>t.ensureLoaded(s));let l=(y,M)=>y&&y.from>M+6e4?e("tt_day_partial",{time:this.time(y.from)}):"",u=(y,M=1)=>y.toLocaleString(this.language,{maximumFractionDigits:M,minimumFractionDigits:M}),c=y=>y>=6e4?`${u(y/36e5)} h`:"\u2013",f=y=>y&&y.tMin!==null&&y.tMax!==null?`${u(y.tMin)}\u2013${u(y.tMax)}\xB0`:"\u2013",d=y=>x`<td>${y?c(y.lightMs):"\u2013"}</td><td>${y?c(y.windowMs):"\u2013"}</td><td>${y?c(y.heatMs):"\u2013"}</td><td>${f(y)}</td>`,m=new Date(r).toLocaleDateString(this.language,{weekday:"short",day:"numeric",month:"numeric",...ot()}),h=y=>y?.energy??null,p=h(i),g=h(a),_=y=>y===void 0?"\u2013":`${u(y)} kWh`,w=y=>y==null?"\u2013":`${Math.round(y*100)} %`,b=this._compare?a?l(a,s):t.loadingDay!==null?e("tt_loading"):"":"";return x`<h4>${e("tt_day_title",{day:m})}</h4>
      ${l(i,r)?x`<p class="since">${l(i,r)}</p>`:v}
      ${b?x`<p class="since">${e("tt_day_before")}: ${b}</p>`:v}
      <div class="filters">
        <button class="fchip" @click=${()=>t.yesterday()}>⟲ ${e("tt_yesterday")}</button>
        <button class="fchip" aria-pressed=${this._compare} @click=${()=>this._compare=!this._compare}>${e("tt_day_compare")}</button>
      </div>
      ${i&&(i.rooms.length||p)?x`${i.rooms.length?x`<table>
                  <thead>
                    <tr><th></th><th>${e("tt_day_light")}</th><th>${e("tt_day_window")}</th><th>${e("tt_day_heat")}</th><th>${e("tt_day_temp")}</th></tr>
                  </thead>
                  <tbody>
                    ${i.rooms.map(y=>x`<tr><th>${y.name}</th>${d(y)}</tr>
                        ${a?x`<tr class="before"><th>${e("tt_day_before")}</th>${d(a.rooms.find(M=>M.roomId===y.roomId))}</tr>`:v}`)}
                  </tbody>
                </table>`:v}
            ${p?x`<div class="energy">
                  ${[["tt_day_pv",_(p.pv),_(g?.pv)],["tt_day_use",_(p.use),_(g?.use)],["tt_day_import",_(p.imp),_(g?.imp)],["tt_day_export",_(p.exp),_(g?.exp)],["tt_day_self",w(p.self),w(g?.self)]].map(([y,M,R])=>x`<span>${e(y)}</span><b>${M}</b>${a?x`<em>${R}</em>`:v}`)}
                </div>`:v}`:x`<p class="none">${e("tt_day_none")}</p>`}`}renderSheet(){let e=this.session.t,n=this._sheet,r=["events","away","day"];return x`<aside class="sheet" role="dialog" aria-label=${e("tt_sheet")}>
      <header>
        ${r.map(i=>x`<button class="tab" aria-pressed=${n===i} title=${i==="away"?e("tt_away_title"):v} @click=${()=>this._sheet=i}>${e(i==="events"?"tt_tab_events":i==="away"?"tt_tab_away":"tt_tab_day")}</button>`)}
        <button class="x" title=${e("tt_close")} aria-label=${e("tt_close")} @click=${()=>this._sheet=null}>×</button>
      </header>
      <div class="body">${n==="events"?this.renderEvents():n==="away"?this.renderAway():this.renderDay()}</div>
    </aside>`}render(){let t=this.session;if(!t)return v;let e=t.t,n=t.playback,r=t.state==="ready"&&!!n,i=t.state==="error"?t.error==="no_recorder"?e("tt_no_recorder"):t.error==="unknown_command"?e("tt_restart"):e("tt_error",{error:t.error??"?"}):null,s=n?3600/n.speed:10,a=Math.round((t.end-t.start)/6e4);return x`<div class="frame"></div>
      <div class="clock" role="status" aria-live="off">
        <span class="badge">⏪ ${e("tt_badge")}${this.demo?x`<em class="demo" title=${e("demo_hint")}>${e("demo_chip")}</em>`:v}</span>
        ${r?x`<b class="clock-time"></b><span class="clock-ago"></span>`:x`<span class="clock-msg">${i??`${e("tt_loading")} ${Math.round(t.progress*100)} %`}</span>`}
      </div>
      ${this._toast?x`<div class="toast" role="alert">${e("tt_readonly")}</div>`:v}
      ${r&&this._sheet?this.renderSheet():v}
      <div class="bar">
        <button class="btn prev" ?disabled=${!r} title=${e("tt_prev")} aria-label=${e("tt_prev")} @click=${()=>t.step(-1)}>${kt(st.prev)}</button>
        <button class="btn play" ?disabled=${!r} title=${e(n?.playing?"tt_pause":"tt_play")} aria-label=${e(n?.playing?"tt_pause":"tt_play")} @click=${()=>t.toggle()}>
          ${kt(n?.playing?st.pause:st.play)}
        </button>
        <button class="btn next" ?disabled=${!r} title=${e("tt_next")} aria-label=${e("tt_next")} @click=${()=>t.step(1)}>${kt(st.next)}</button>
        <div
          class="track ${r?"":"track-wait"}"
          role="slider"
          tabindex="0"
          aria-label=${e("tt_chip")}
          aria-valuemin="0"
          aria-valuemax=${a}
          aria-valuenow=${n?Math.round((n.t-t.start)/6e4):a}
          @pointerdown=${l=>this.onDown(l)}
          @pointermove=${l=>this.onMove(l)}
          @pointerup=${l=>this.onUp(l)}
          @pointercancel=${l=>this.onUp(l)}
        >
          ${r?this.renderTrack():i?x`<em class="msg">${i}</em>`:x`<i class="progress" style="width:${Math.round(t.progress*100)}%"></i>`}
        </div>
        ${i?x`<button class="chip" @click=${()=>{t.load()}}>${e("tt_retry")}</button>`:v}
        <button class="chip range" ?disabled=${!r} title=${e("tt_range_hint")} aria-label=${e("tt_range_hint")} @click=${()=>t.setRange(t.range==="7d"?"24h":"7d")}>
          ${t.range==="7d"?e("tt_days",{n:t.maxDays}):"24 h"}
        </button>
        <button class="btn sheet-btn" ?disabled=${!r} aria-pressed=${!!this._sheet} title=${e("tt_sheet")} aria-label=${e("tt_sheet")} @click=${()=>this.toggleSheet()}>${kt(st.list)}</button>
        <button class="chip speed" ?disabled=${!r} title=${e("tt_speed",{s:s>=60?"1 min":s>=1?`${Math.round(s)} s`:`${s.toFixed(2).replace(/0$/,"")} s`})} @click=${()=>t.nextSpeed()}>
          ${n?.speed??360}×
        </button>
        <button class="chip live ${t.atNow?"live-now":""}" title=${e("tt_live_hint")} @click=${()=>t.exit()}>
          <i></i>${t.atNow?`${e("tt_now_reached")} \xB7 ${e("tt_live")}`:e("tt_live")}
        </button>
      </div>`}static styles=Nt`
    :host {
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
      container-type: size;
      container-name: fp3dtt;
      font-family: var(--fp3d-font, system-ui, sans-serif);
      color: var(--fp3d-text, #e6eefc);
      --tt: #ffb020;
    }
    .frame {
      position: absolute;
      inset: 0;
      box-shadow: inset 0 0 0 3px var(--tt);
      border-radius: inherit;
    }
    .clock {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      display: grid;
      justify-items: center;
      gap: 1px;
      padding: 6px 16px 7px;
      border-radius: 14px;
      background: var(--fp3d-chrome-solid, #0f1729);
      border: 1px solid rgba(255, 176, 32, 0.55);
      box-shadow: var(--fp3d-shadow, none);
      white-space: nowrap;
      max-width: calc(100% - 260px);
    }
    .badge {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: var(--tt);
    }
    .demo {
      margin-left: 8px;
      padding: 1px 7px;
      border-radius: 999px;
      border: 1px solid var(--fp3d-line, rgba(120, 170, 255, 0.16));
      font-style: normal;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--fp3d-text, #e6eefc);
      cursor: help;
      pointer-events: auto;
    }
    .clock-time {
      font-family: var(--fp3d-title-font, inherit);
      font-size: 24px;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }
    .clock-ago,
    .clock-msg {
      font-size: 12px;
      color: var(--fp3d-muted, #8a9bb8);
      white-space: normal;
      text-align: center;
    }
    .toast,
    .label {
      position: absolute;
      bottom: calc(var(--fp3d-tt-h, 64px) + 4px);
      z-index: 3;
      padding: 7px 12px;
      border-radius: 10px;
      background: var(--fp3d-chrome-solid, #0f1729);
      border: 1px solid rgba(255, 176, 32, 0.55);
      box-shadow: var(--fp3d-shadow, none);
      font-size: 13px;
    }
    .toast {
      left: 50%;
      transform: translateX(-50%);
      color: var(--tt);
      font-weight: 600;
    }
    .label {
      /* above its marker on the track, kept within the track */
      bottom: calc(100% + 12px);
      left: clamp(0px, calc(var(--x) - 120px), calc(100% - 240px));
      width: 240px;
      box-sizing: border-box;
      display: grid;
      gap: 3px;
      pointer-events: none;
    }
    .bar {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 8px;
      height: calc(var(--fp3d-tt-h, 64px) - 16px);
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 8px;
      border-radius: 14px;
      background: var(--fp3d-chrome-solid, #0f1729);
      border: 1px solid rgba(255, 176, 32, 0.45);
      box-shadow: var(--fp3d-shadow, none);
      pointer-events: auto;
      touch-action: none;
    }
    button {
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .btn {
      flex: none;
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 10px;
      background: transparent;
    }
    .btn:hover:not(:disabled),
    .sheet-btn[aria-pressed="true"] {
      background: rgba(255, 255, 255, 0.07);
    }
    .sheet-btn[aria-pressed="true"] {
      color: var(--tt);
    }
    .play {
      background: var(--tt);
      color: #1a1200;
    }
    .play:hover:not(:disabled) {
      background: var(--tt);
      filter: brightness(1.1);
    }
    .chip {
      flex: none;
      height: 32px;
      padding: 0 11px;
      border-radius: 999px;
      border: 1px solid var(--fp3d-line, rgba(120, 170, 255, 0.16));
      background: transparent;
      font-size: 13px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .live {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-color: var(--fp3d-accent, #37e0ff);
    }
    .live i {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ff3b4f;
    }
    .live-now {
      background: var(--fp3d-accent, #37e0ff);
      color: #04121c;
    }
    .track {
      position: relative;
      flex: 1;
      min-width: 0;
      height: 34px;
      /* a gutter at the end: the handle and the last label stay clear of the chip beside the track (#257) */
      margin: 0 12px 0 4px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.05);
      cursor: pointer;
      outline-offset: 2px;
    }
    .track-wait {
      cursor: default;
      overflow: hidden;
    }
    .track i {
      position: absolute;
      top: 0;
      bottom: 0;
      overflow: hidden;
    }
    .track i span {
      position: absolute;
      left: 4px;
      bottom: 2px;
      font-size: 10px;
      font-style: normal;
      white-space: nowrap;
      color: var(--fp3d-muted, #8a9bb8);
    }
    .night {
      background: rgba(40, 60, 140, 0.35);
    }
    .nodata {
      background: rgba(140, 150, 170, 0.28);
    }
    .loading {
      background: repeating-linear-gradient(135deg, rgba(255, 176, 32, 0.22) 0 6px, transparent 6px 12px);
    }
    .loading span {
      color: var(--tt) !important;
    }
    .gap {
      background: repeating-linear-gradient(135deg, rgba(160, 170, 190, 0.32) 0 4px, transparent 4px 8px);
    }
    .progress {
      left: 0;
      background: rgba(255, 176, 32, 0.4);
      transition: width 0.2s;
    }
    .msg {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      padding: 0 10px;
      font-size: 12px;
      font-style: normal;
      color: var(--fp3d-muted, #8a9bb8);
      overflow: hidden;
    }
    .tick {
      position: absolute;
      top: 0;
      width: 1px;
      height: 5px;
      background: rgba(200, 215, 240, 0.28);
      pointer-events: none;
    }
    .tick-major {
      height: 9px;
      background: rgba(200, 215, 240, 0.5);
    }
    .tick-day {
      height: 100%;
      background: rgba(255, 176, 32, 0.45);
    }
    .tick span {
      position: absolute;
      left: 3px;
      top: 22px;
      font-size: 10px;
      line-height: 11px;
      font-weight: 500;
      color: var(--fp3d-muted, #8a9bb8);
      white-space: nowrap;
    }
    .tick-day span {
      color: var(--tt);
      font-weight: 700;
    }
    .mark {
      position: absolute;
      top: 6px;
      width: 14px;
      height: 14px;
      margin-left: -7px;
      padding: 0;
      border-radius: 50%;
      border: 2px solid var(--fp3d-chrome-solid, #0f1729);
      background: var(--c);
      box-shadow: 0 0 0 1px var(--c);
      z-index: 1;
    }
    .mark-many {
      width: 18px;
      height: 18px;
      margin-left: -9px;
      top: 4px;
    }
    .mark span {
      display: block;
      font-size: 9px;
      font-weight: 800;
      line-height: 14px;
      color: #0a0f1c;
    }
    .head {
      position: absolute;
      left: -1px;
      top: -5px;
      bottom: -5px;
      width: 3px;
      border-radius: 2px;
      background: var(--tt);
      box-shadow: 0 0 6px var(--tt);
      pointer-events: none;
      z-index: 2;
      will-change: transform;
    }
    .head::after {
      content: "";
      position: absolute;
      left: -5px;
      bottom: -6px;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: var(--tt);
    }
    .sheet {
      position: absolute;
      top: 78px;
      right: 8px;
      bottom: calc(var(--fp3d-tt-h, 64px) + 4px);
      width: min(380px, calc(100% - 16px));
      box-sizing: border-box;
      display: grid;
      grid-template-rows: auto 1fr;
      border-radius: 14px;
      background: var(--fp3d-chrome-solid, #0f1729);
      border: 1px solid rgba(255, 176, 32, 0.45);
      box-shadow: var(--fp3d-shadow, none);
      pointer-events: auto;
      z-index: 2;
      font-size: 13px;
      overflow: hidden;
    }
    .sheet header {
      display: flex;
      gap: 4px;
      padding: 8px 8px 6px;
      border-bottom: 1px solid var(--fp3d-line, rgba(120, 170, 255, 0.16));
    }
    .tab {
      flex: 1 1 auto;
      min-width: 0;
      padding: 6px 8px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tab[aria-pressed="true"] {
      background: rgba(255, 176, 32, 0.18);
      color: var(--tt);
    }
    .x {
      flex: none;
      width: 30px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      font-size: 18px;
    }
    .body {
      overflow-y: auto;
      padding: 8px 10px 12px;
      overscroll-behavior: contain;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 6px;
    }
    .fchip {
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid var(--fp3d-line, rgba(120, 170, 255, 0.16));
      background: transparent;
      font-size: 12px;
    }
    .fchip[aria-pressed="true"] {
      border-color: var(--tt);
      background: rgba(255, 176, 32, 0.14);
    }
    .when {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 12px;
      color-scheme: dark;
    }
    .when select {
      font: inherit;
      color: inherit;
      background: transparent;
      border: 1px solid var(--fp3d-line, rgba(120, 170, 255, 0.16));
      border-radius: 999px;
      padding: 3px 4px;
    }
    .opt {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--fp3d-muted, #8a9bb8);
      margin: 2px 0;
    }
    .since {
      margin: 0 0 4px;
      font-size: 12px;
      color: var(--fp3d-muted, #8a9bb8);
    }
    .sheet h4 {
      margin: 10px 0 4px;
      font-size: 12px;
      font-weight: 700;
      color: var(--tt);
    }
    .row {
      display: grid;
      grid-template-columns: 10px 44px 1fr;
      align-items: start;
      gap: 6px;
      width: 100%;
      padding: 5px 4px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      text-align: left;
      font-size: 13px;
    }
    .row:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    .row i {
      width: 8px;
      height: 8px;
      margin-top: 5px;
      border-radius: 50%;
    }
    .row time {
      font-variant-numeric: tabular-nums;
      color: var(--fp3d-muted, #8a9bb8);
    }
    .row small {
      display: block;
      font-size: 11px;
      color: var(--fp3d-muted, #8a9bb8);
    }
    .none {
      color: var(--fp3d-muted, #8a9bb8);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    th,
    td {
      padding: 4px 3px;
      text-align: right;
      white-space: nowrap;
    }
    th:first-child {
      text-align: left;
      max-width: 110px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    thead th {
      font-weight: 600;
      color: var(--fp3d-muted, #8a9bb8);
    }
    tbody tr:not(.before) {
      border-top: 1px solid var(--fp3d-line, rgba(120, 170, 255, 0.16));
    }
    .before {
      color: var(--fp3d-muted, #8a9bb8);
      font-size: 11px;
    }
    .before th {
      font-weight: 400;
      padding-left: 10px;
    }
    .energy {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 4px 12px;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid var(--fp3d-line, rgba(120, 170, 255, 0.16));
      font-variant-numeric: tabular-nums;
    }
    .energy b {
      text-align: right;
    }
    .energy em {
      font-style: normal;
      text-align: right;
      color: var(--fp3d-muted, #8a9bb8);
    }
    /* phones and narrow cards: two rows, the track and the way back to the present on top, the buttons below (#257);
       the bar grows upwards from the bottom edge (the safe area included), never past it */
    @container fp3dtt ((max-width: 700px) or ((orientation: portrait) and (max-width: 1000px))) {
      .bar {
        flex-wrap: wrap;
        align-content: center;
        justify-content: center;
        row-gap: 3px;
        height: auto;
        bottom: calc(8px + env(safe-area-inset-bottom, 0px));
        padding: 6px 8px;
      }
      /* the line break between the two rows */
      .bar::after {
        content: "";
        order: -1;
        flex: 1 0 100%;
        height: 0;
      }
      .track {
        order: -2;
        flex: 1 1 0;
        margin: 14px 4px 0 0;
      }
      .live {
        order: -1;
        margin-top: 14px;
      }
      .chip {
        padding: 0 9px;
      }
      .clock {
        top: 8px;
        padding: 4px 12px 5px;
        max-width: calc(100% - 120px);
      }
      .clock-time {
        font-size: 19px;
      }
      .sheet {
        top: 64px;
      }
    }
    @media (pointer: coarse) {
      .btn,
      .x {
        min-width: 44px;
        min-height: 44px;
      }
      .chip,
      .track {
        min-height: 44px;
      }
    }
  `};Pe("fp3d-time-bar",re);var tr=globalThis.__fp3dLanguages??={extra:new Map,pending:new Map},{extra:Cs,pending:Hs}=tr;var nr=new Map;function ie(o,t){return nr.get(t)??or(o,t)}function or(o,t){let e=o.entities?.[t]?.device_id;return e?(rr(o.entities??{}).get(e)??[]).filter(n=>["motion","occupancy","presence"].includes(String(o.states[n]?.attributes.device_class))):[]}var An=new WeakMap;function rr(o){let t=An.get(o);if(!t){t=new Map;for(let e of Object.values(o)){if(!e.device_id||!e.entity_id.startsWith("binary_sensor."))continue;let n=t.get(e.device_id);n||t.set(e.device_id,n=[]),n.push(e.entity_id)}An.set(o,t)}return t}var ir=new Set(["person","device_tracker","zone","camera","scene","script","button","input_button","update","event","image","tts","stt","notify","conversation","automation","calendar","todo"]),sr=new Set(["light","cover","switch","fan","lock","climate","media_player","binary_sensor","sensor","vacuum","alarm_control_panel","water_heater","input_boolean","humidifier","valve"]),ar=600,se=o=>o.slice(0,o.indexOf("."));function lr(o,t){let e=o.states[t];return!t.startsWith("sensor.")||!e||e.attributes.state_class!=="measurement"?!1:Number.isFinite(Number(e.state))||e.state==="unavailable"||e.state==="unknown"}var Tn=new Set(["geocoded_location","location"]),ur=/location|address|geocoded|ssid|bssid|standort|adresse/i;function cr(o,t){let e=o.states[t]?.attributes??{},n=o.entities?.[t]?.translation_key??"";return Tn.has(String(e.device_class??""))||Tn.has(n)||"latitude"in e||"longitude"in e?!0:ur.test(`${t} ${String(e.friendly_name??"")} ${n}`)}function dr(o){let t=new Set;for(let e of o.floors)for(let n of e.furniture){let r=n.show_when?.entity;r&&(r.startsWith("person.")||r.startsWith("device_tracker."))&&t.add(r)}return[...t]}function On(o){let t=new Set;for(let e of Object.values(o.states))if(e.entity_id.startsWith("person.")&&Array.isArray(e.attributes.device_trackers))for(let n of e.attributes.device_trackers)typeof n=="string"&&t.add(n);return t}function fr(o,t=On(o)){let e=new Set;for(let n of t){let r=o.entities?.[n]?.device_id;r&&e.add(r)}return e}function ae(o,t,e,n=ar){let r=new Set(t.presence.flatMap(b=>[b.person,b.sensor]).filter(b=>!!b)),i=On(o);for(let b of i)r.add(b);let s=fr(o,i),a=new Set(dr(t)),l=new Set([...e.cars??[],...a].filter(b=>(a.has(b)||b.startsWith("device_tracker.")&&!r.has(b))&&!!o.states[b])),u=new Set(t.floors.flatMap(b=>b.rooms.map(y=>y.area_id)).filter(b=>!!b)),c=[];for(let[b,y]of Object.entries(o.entities??{})){if(!y.area_id&&y.device_id){let M=o.devices?.[y.device_id];if(!M?.area_id||!u.has(M.area_id))continue}else if(!y.area_id||!u.has(y.area_id))continue;y.hidden||y.entity_category||!sr.has(se(b))||c.push(b)}let f=Object.keys(o.states).filter(b=>b.startsWith("weather.")),d=t.floors.flatMap(b=>b.placements.filter(y=>y.entity_id.startsWith("camera.")).flatMap(y=>ie(o,y.entity_id))),m=[...new Set([...l,...e.entities,...d,"sun.sun",...t.settings.weather_entity?[t.settings.weather_entity]:[],...t.settings.outage_entity?[t.settings.outage_entity]:[],...f.slice(0,1),...c])],h=[],p=m.filter(b=>{if(!b.includes(".")||!o.states[b])return!1;if(l.has(b))return!0;if(ir.has(se(b))||r.has(b))return!1;let y=o.entities?.[b]?.device_id;return y&&s.has(y)||cr(o,b)?(h.push(b),!1):!0}),g=p.slice(0,n),_=g.filter(b=>lr(o,b)),w=new Set(_);return{entities:g.filter(b=>!w.has(b)),stats:_,overflow:p.slice(n),cars:g.filter(b=>l.has(b)),hidden:h}}var Fn={smoke:"smoke",gas:"gas",carbon_monoxide:"co",moisture:"water"},pr=new Set(["front","front_glass","sidelight","sidelights"]),mr=new Set(["washer","dryer","dishwasher"]);function Pn(o,t){let e=!1;for(let n=0,r=t.length-1;n<t.length;r=n++){let[i,s]=t[n],[a,l]=t[r];s>o[1]!=l>o[1]&&o[0]<(a-i)*(o[1]-s)/(l-s)+i&&(e=!e)}return e}function hr(o,t){if(t.type!=="door"||t.wall)return!1;if(t.style&&pr.has(t.style))return!0;if(t.style)return!1;let e=o.rooms.find(f=>f.id===t.room_id);if(!e||e.points.length<3)return!1;let n=e.points[t.edge],r=e.points[(t.edge+1)%e.points.length];if(!n||!r)return!1;let i=Math.hypot(r[0]-n[0],r[1]-n[1]);if(i<1e-6)return!1;let s=(r[0]-n[0])/i,a=(r[1]-n[1])/i,l=[n[0]+s*t.offset,n[1]+a*t.offset],u=f=>[l[0]-a*f,l[1]+s*f],c=Pn(u(.3),e.points)?u(-.4):u(.4);return!o.rooms.some(f=>f.id!==e.id&&f.points.length>=3&&Pn(c,f.points))}function le(o,t,e){let n=new Map,r=new Map(e.furniture);for(let i of t.floors)for(let s of i.furniture){if(!mr.has(s.type))continue;let a=r.get(s.id)?.power,l=i.placements.find(c=>o.states[c.entity_id]?.attributes.device_class==="power"&&Math.hypot(c.x-s.x,c.z-s.z)<=1.2)?.entity_id,u=a??l;u&&!n.has(u)&&n.set(u,s)}return n}function zn(o,t,e,n){let r=new Map,i=(a,l)=>{a&&n.has(a)&&!r.has(a)&&r.set(a,l)},s=new Map(e.openings);for(let a of t.floors)for(let l of a.openings){let u=s.get(l.id);if(u)if(l.type==="garage")for(let c of[u.contact,u.cover])i(c,"garage");else if(l.type==="door"){if(hr(a,l))for(let c of[u.contact,u.contact2])i(c,"door")}else[u.contact,u.tilt,u.contact2,u.tilt2].filter(f=>!!f&&n.has(f)).forEach((f,d)=>i(f,d?"window_more":"window"))}for(let a of le(o,t,e).keys())i(a,"washer");for(let a of t.floors)for(let l of a.placements)if(l.entity_id.startsWith("camera."))for(let u of ie(o,l.entity_id))i(u,"camera");for(let a of n){if(r.has(a))continue;let l=se(a),u=String(o.states[a]?.attributes.device_class??"");l==="lock"?i(a,"lock"):l==="alarm_control_panel"?i(a,"alarm"):l==="vacuum"?i(a,"robot"):l==="weather"?i(a,"weather"):l==="cover"&&(u==="garage"||u==="gate")?i(a,"garage"):l==="binary_sensor"&&(Fn[u]?i(a,Fn[u]):u==="garage_door"?i(a,"garage"):u==="motion"&&i(a,"motion"))}return r}var gr={light:["brightness","color_mode","rgb_color","color_temp_kelvin"],cover:["current_position","current_tilt_position"],climate:["hvac_action","current_temperature","temperature"],media_player:["media_title","media_artist","app_name","source","volume_level"],weather:["cloud_coverage","wind_speed","wind_speed_unit"],vacuum:["current_room"],fan:[],alarm_control_panel:[],lock:[],water_heater:[]};function br(o,t){if(o==="rgb_color")return Array.isArray(t)&&t.every(e=>typeof e=="number")?t.map(e=>Math.round(e)):null;if(typeof t!="number"||!Number.isFinite(t))return t;switch(o){case"brightness":return Math.max(0,Math.min(255,Math.round(Math.round(t/255*50)*2*255/100)));case"color_temp_kelvin":return Math.round(t/50)*50;case"current_position":case"current_tilt_position":case"cloud_coverage":return Math.round(t);case"volume_level":return Math.round(Math.round(t*20)*5)/100;case"current_temperature":case"temperature":case"wind_speed":return Math.round(t*10)/10;default:return t}}function yr(o){return o==="home"||o==="unavailable"||o==="unknown"?o:"not_home"}function ue(o){let t=o.entity_id.slice(0,o.entity_id.indexOf("."));if(t==="device_tracker"||t==="person")return{s:yr(o.state),a:null};let e=gr[t];if(!e?.length)return{s:o.state,a:null};let n={};for(let r of e){let i=o.attributes[r];if(i==null)continue;let s=br(r,i);s!=null&&(n[r]=s)}return{s:o.state,a:Object.keys(n).length?n:null}}var ce=3e5,In=2e4,_r=[6e4,ce,15*6e4,36e5],xr=(o,t)=>o.startsWith("sensor.")&&t.state!==""&&Number.isFinite(Number(t.state));function vr(o,t){let e=[];for(let n of o){let r=e[e.length-1];r&&Math.floor(r.t/t)===Math.floor(n.t/t)?e[e.length-1]=n:e.push(n);let i=e[e.length-2];i&&i.k===e[e.length-1].k&&e.pop()}return e}var St=class{ids;seen=new Map;lastKey=new Map;startStates;startedAt;seeded=new Set;rows=new Map;count=0;constructor(t,e,n=Date.now()){this.ids=t,this.startStates=e,this.startedAt=n;for(let r of t)this.seen.set(r,e[r]),e[r]&&this.lastKey.set(r,z(ue(e[r])))}get pending(){return this.count}record(t,e){for(let n of this.ids){let r=t[n];if(r===this.seen.get(n)||(this.seen.set(n,r),!r))continue;let i=ue(r),s=z(i);if(this.lastKey.get(n)===s)continue;let a=this.rows.get(n),l=a?.[a.length-1],u=Date.parse(r.last_updated??r.last_changed??""),c=Math.max(Number.isFinite(u)?Math.min(e,u):e,l?.t??-1/0);if(l&&xr(n,r)&&Math.floor(l.t/ce)===Math.floor(c/ce)){a[a.length-1]={t:c,v:i,k:s},this.lastKey.set(n,s);continue}this.lastKey.set(n,s),a?a.push({t:c,v:i,k:s}):this.rows.set(n,[{t:c,v:i,k:s}]),this.count++}this.count>In&&this.compact()}compact(){for(let t of _r){let e=0;for(let[n,r]of this.rows){let i=vr(r,t);this.rows.set(n,i),e+=i.length}if(this.count=e,e<=In/2)return}}flush(t,e){let n=0,r=0;for(let i of this.ids){if(this.seeded.has(i)||t.tracks.has(i)||t.series.has(i))continue;this.seeded.add(i);let s=this.startStates[i],a=[...s?[{t:this.startedAt,v:ue(s)}]:[],...this.rows.get(i)??[]],l=fn(i,a);this.rows.delete(i),l&&(t.tracks.set(i,l),t.missing.delete(i),r++,n+=l.times.length)}for(let[i,s]of this.rows){let a=t.tracks.get(i);if(a){n+=Yt(a,s);continue}let l=t.series.get(i);l&&(n+=dn(l,s.map(u=>({t:u.t,value:Number(u.v.s)}))))}return this.rows=new Map,this.count=0,t.end=Math.max(t.end,e),{added:n,created:r}}};function Nn(o,t,e){if(!(t.state==="opening"||t.state==="closing")||t.pos===null||!e||e.pos===null)return t.pos;let r=e.t-t.t;return!(r>0)||r>18e4||o<=t.t?t.pos:o>=e.t?e.pos:Math.round(t.pos+(e.pos-t.pos)*(o-t.t)/r)}var k=Math.PI/180;function Rt(o,t,e){let n=(e/864e5+24405875e-1-2451545)/36525,r=(280.46646+n*(36000.76983+n*3032e-7))%360,i=357.52911+n*(35999.05029-1537e-7*n),s=.016708634-n*(42037e-9+1267e-10*n),a=Math.sin(i*k)*(1.914602-n*(.004817+14e-6*n))+Math.sin(2*i*k)*(.019993-101e-6*n)+Math.sin(3*i*k)*289e-6,l=125.04-1934.136*n,u=r+a-.00569-.00478*Math.sin(l*k),f=23+(26+(21.448-n*(46.815+n*(59e-5-n*.001813)))/60)/60+.00256*Math.cos(l*k),d=Math.asin(Math.sin(f*k)*Math.sin(u*k)),m=Math.tan(f/2*k)**2,h=4/k*(m*Math.sin(2*r*k)-2*s*Math.sin(i*k)+4*s*m*Math.sin(i*k)*Math.cos(2*r*k)-.5*m*m*Math.sin(4*r*k)-1.25*s*s*Math.sin(2*i*k)),g=(((e/6e4%1440+1440)%1440+h+4*t)%1440+1440)%1440,_=(g/4<0?g/4+180:g/4-180)*k,w=o*k,b=Math.min(1,Math.max(-1,Math.sin(w)*Math.sin(d)+Math.cos(w)*Math.cos(d)*Math.cos(_))),y=Math.acos(b),M=90-y/k;M+=wr(M);let R=Math.cos(w)*Math.sin(y),Q=180;if(Math.abs(R)>1e-9){let xe=Math.acos(Math.min(1,Math.max(-1,(Math.sin(w)*Math.cos(y)-Math.sin(d))/R)))/k;Q=_>0?(xe+180)%360:(540-xe)%360}return{elevation:M,azimuth:Q}}function wr(o){if(o>85)return 0;let t=Math.tan(o*k);return(o>5?58.1/t-.07/t**3+86e-6/t**5:o>-.575?1735+o*(-518.2+o*(103.4+o*(-12.79+o*.711))):-20.772/t)/3600}function de(o,t,e){return Rt(o,t,e).elevation<-.833}function Cn(o,t,e,n,r=5*6e4){let i=[],s=null;for(let a=e;a<=n;a+=r){let l=de(o,t,a);l&&s===null&&(s=a),!l&&s!==null&&(i.push([s,a]),s=null)}return s!==null&&i.push([s,n]),i}var me=class extends Error{constructor(t){super(`Time travel is read-only: ${t}`),this.name="ReplayReadOnly"}},Mr=new Set(["home_3d/building/get","home_3d/image/get","home_3d/packs/list","home_3d/timetravel/history","history/history_during_period","recorder/statistics_during_period"]),kr=new Set(["home_3d/building/subscribe"]),fe={light:["brightness","color_mode","rgb_color","color_temp_kelvin","color_temp","hs_color","xy_color","rgbw_color","rgbww_color","effect"],cover:["current_position","current_tilt_position"],climate:["hvac_action","current_temperature","temperature","target_temp_high","target_temp_low","current_humidity","preset_mode","fan_mode"],media_player:["media_title","media_artist","media_album_name","app_name","app_id","source","volume_level","is_volume_muted","entity_picture","media_content_id","media_duration","media_position","media_position_updated_at","media_series_title","media_season","media_episode","media_channel"],weather:["cloud_coverage","wind_speed","wind_speed_unit","temperature","humidity","pressure","wind_bearing","visibility","dew_point","uv_index","apparent_temperature","precipitation"],fan:["percentage","preset_mode","oscillating","direction"],vacuum:["battery_level","status","fan_speed"],water_heater:["current_temperature","temperature","operation_mode"],humidifier:["humidity","current_humidity","mode"],alarm_control_panel:["changed_by"],lock:["changed_by"],device_tracker:["latitude","longitude","gps_accuracy","altitude","course","speed","vertical_accuracy","battery_level","ip","host_name","mac","zone","in_zones"],sun:["elevation","azimuth","rising","next_rising","next_setting","next_dawn","next_dusk","next_noon","next_midnight"]},Hn=["person.","device_tracker."],pe=o=>o.slice(0,o.indexOf("."));function Et(o,t){if(!t?.some(n=>n in o))return o;let e={...o};for(let n of t)delete e[n];return e}function at(o){throw typeof window<"u"&&window.dispatchEvent(new CustomEvent("fp3d-replay-blocked",{detail:{what:o}})),new me(o)}function Sr(o,t){let e=o,n={...o,states:t};n.callService=(r,i)=>at(`${r}.${i}`),n.callWS=r=>Mr.has(String(r.type))?o.callWS(r):at(String(r.type)),n.connection={subscribeMessage:(r,i)=>kr.has(String(i.type))?o.connection.subscribeMessage(r,i):at(String(i.type))};for(let r of["callApi","callApiRaw"]){let i=e[r];typeof i=="function"&&(n[r]=(s,...a)=>String(s).toUpperCase()==="GET"?i.call(o,s,...a):at(`${s} ${String(a[0])}`))}for(let r of["sendWS","fetchWithAuth"])r in e&&(n[r]=()=>at(r));return n}var Rr=new Set(["light","switch","input_boolean","binary_sensor","fan"]),$t=class{timeline;cursor;requested;allowed;trackAt=new Map;location;slots=new Map;steps=new Map;live=null;frozen;base=null;states={};hass=null;pulses=[];constructor(t,e){this.timeline=t,this.cursor=new K(t),this.cursor.tracks.forEach((r,i)=>this.trackAt.set(r.id,i)),this.location=e.location??null,this.frozen=e.states??null;let n=new Set([...e.allowed??[]].filter(r=>r.startsWith("device_tracker.")||r.startsWith("person.")));this.allowed=n,this.requested=[...new Set([...e.requested,...t.tracks.keys(),...t.series.keys()])].filter(r=>n.has(r)||!Hn.some(i=>r.startsWith(i)))}refresh(){let t=this.cursor.t;this.cursor=new K(this.timeline),this.trackAt.clear(),this.cursor.tracks.forEach((e,n)=>this.trackAt.set(e.id,n)),Number.isFinite(t)&&this.cursor.at(t)}hassAt(t,e,n=!0){let r=this.frozen??=t.states,i=!1;if(!this.base){this.base={};for(let[l,u]of Object.entries(r))Hn.some(c=>l.startsWith(c))||(this.base[l]=l.startsWith("camera.")&&u.attributes.entity_picture?{...u,attributes:Et(u.attributes,["entity_picture","access_token"])}:u);i=!0}this.sameContext(t)||(this.live=t,i=!0);let s=!n&&e>this.cursor.t&&Number.isFinite(this.cursor.t)?this.cursor.idx.slice():null;this.cursor.at(e),this.pulses=s?this.findPulses(s):[];let a=[];for(let l of this.requested){let u=this.slots.get(l),c=this.slot(l,e,r[l],u);c!==u&&(this.slots.set(l,c),a.push(l))}if(!i&&!a.length&&this.hass)return this.hass;if(i){this.states={...this.base};for(let l of this.requested){let u=this.slots.get(l);u&&(this.states[l]=u.obj)}}else{this.states={...this.states};for(let l of a)this.states[l]=this.slots.get(l).obj}return this.hass=Sr(this.live,this.states),this.hass}findPulses(t){let e=[],n=this.cursor.idx;for(let r=0;r<n.length;r++){let i=t[r],s=n[r];if(i<0||s-i<2)continue;let a=this.cursor.tracks[r];if(!Rr.has(pe(a.id)))continue;let l=a.values[a.vals[i]].s;if(a.values[a.vals[s]].s===l){for(let u=i+1;u<s;u++)if(a.values[a.vals[u]].s!==l){e.push(a.id);break}}}return e}sameContext(t){let e=this.live;if(!e)return!1;if(e===t)return!0;let n=t;for(let r in n)if(r!=="states"&&n[r]!==e[r])return!1;for(let r in e)if(!(r in n))return!1;return!0}slot(t,e,n,r){let i=this.allowed.has(t)?void 0:n,s=this.trackAt.get(t),a=this.timeline.series.get(t),l,u;if(t==="sun.sun"&&this.location){let c=Rt(this.location.lat,this.location.lon,e),f=Math.round(c.elevation*2)/2,d=Math.round(c.azimuth*2)/2,m=Rt(this.location.lat,this.location.lon,e+6e5).elevation>c.elevation;l=`${f}|${d}|${m}`,u=()=>({entity_id:t,state:c.elevation>-.833?"above_horizon":"below_horizon",attributes:{...Et(i?.attributes??{},fe.sun),elevation:f,azimuth:d,rising:m}})}else if(s!==void 0&&this.cursor.idx[s]>=0){let c=this.cursor.tracks[s],f=this.cursor.idx[s],d=c.values[c.vals[f]],m=t.startsWith("cover.")?this.coverPos(c,f,e):null;l=m===null?`${f}`:`${f}:${m}`,u=()=>{let h={...Et(i?.attributes??{},fe[pe(t)]),...d.a??{}};m!==null&&(h.current_position=m),t==="sun.sun"&&h.elevation===void 0&&Object.assign(h,{elevation:d.s==="above_horizon"?25:-12,azimuth:180});let p=c.since[f];return p>this.timeline.start?{entity_id:t,state:d.s,attributes:h,last_changed:new Date(p).toISOString()}:{entity_id:t,state:d.s,attributes:h}}}else if(a){let c=V(a,e),f=this.stepOf(t,a,i),d=en(c,f);l=`n${d}`,u=()=>({entity_id:t,state:d,attributes:i?.attributes??{},last_changed:new Date(e).toISOString()})}else l="none",u=()=>({entity_id:t,state:"unknown",attributes:Et(i?.attributes??{},fe[pe(t)])});return r&&r.key===l&&r.attrs===i?.attributes?r:{key:l,attrs:i?.attributes,obj:u()}}coverPos(t,e,n){let r=t.values[t.vals[e]];if(r.s!=="opening"&&r.s!=="closing")return null;let i=a=>typeof a.a?.current_position=="number"?a.a.current_position:null,s=e+1<t.times.length?{t:t.times[e+1],pos:i(t.values[t.vals[e+1]])}:null;return Nn(n,{t:t.times[e],state:r.s,pos:i(r)},s)}stepOf(t,e,n){let r=this.steps.get(t);if(r===void 0){let i=e.mean.find(s=>!Number.isNaN(s))??0;r=tn(n?.attributes.unit_of_measurement,this.live?.entities?.[t]?.display_precision,i),this.steps.set(t,r)}return r}rows(t,e,n){let r={};for(let i of t){let s=this.timeline.tracks.get(i);if(!s)continue;let a=[];for(let l=Math.max(0,S(s.times,e));l<s.times.length&&s.times[l]<=n;l++)a.push({s:s.values[s.vals[l]].s,lu:s.times[l]/1e3});a.length&&(r[i]=a)}return r}};var Vn=new Set(["cleaning","paused","returning"]),Er=new Set(["","unknown","unavailable","none","null"]);function Dn(o,t,e){if(!o)return[];let n=u=>o.values[o.vals[u]].s,r=S(o.times,e);if(r<0||!Vn.has(n(r)))return[];let i=r;for(;i>0&&Vn.has(n(i-1));)i--;let s=o.times[i],a=[],l=u=>{let c=typeof u=="string"?u.trim():"";!Er.has(c.toLowerCase())&&a[a.length-1]!==c&&a.push(c)};if(t){let u=Math.max(0,S(t.times,s));for(t.times[u]<s-6e4&&u++;u<t.times.length&&t.times[u]<=e;u++)l(t.values[t.vals[u]].s)}else for(let u=i;u<=r;u++)l(o.values[o.vals[u]].a?.current_room);return a}var he=o=>o.slice(0,o.indexOf("."));function $r(o,t){let e=o.entities?.[t];return e?e.area_id??(e.device_id?o.devices?.[e.device_id]?.area_id??null:null):null}function Ln(o,t,e){let n=[],r=new Map;for(let a of Object.keys(o.entities??{})){let l=$r(o,a);l&&r.set(l,[...r.get(l)??[],a])}let i=new Map(e.openings),s=new Map(e.furniture);for(let a of t.floors)for(let l of a.rooms){if(l.points.length<3)continue;let u=new Set(l.area_id?r.get(l.area_id)??[]:[]);for(let m of a.placements)$([m.x,m.z],l.points)&&u.add(m.entity_id);for(let m of a.furniture){let h=s.get(m.id);h?.entity&&$([m.x,m.z],l.points)&&u.add(h.entity)}let c=[];for(let m of a.openings){if(m.room_id!==l.id)continue;let h=i.get(m.id),p=h?[h.contact,h.tilt,h.contact2,h.tilt2].filter(g=>!!g):[];for(let g of p)u.add(g);p.length&&m.type!=="door"&&m.type!=="garage"&&c.push(p)}let f=[...u].filter(m=>!!o.states[m]),d=m=>o.states[m]?.attributes.device_class;n.push({floorId:a.id,roomId:l.id,name:l.name,lights:f.filter(m=>he(m)==="light"),windows:c,climates:f.filter(m=>he(m)==="climate"),temps:f.filter(m=>he(m)==="sensor"&&d(m)==="temperature"),all:f})}return n}function Wn(o){let t=new Map;for(let e of o)for(let n of e.all)t.has(n)||t.set(n,e);return t}var ge=36e5;function lt(o,t,e){let n=o.map(([i,s])=>[Math.max(i,t),Math.min(s,e)]).filter(([i,s])=>s>i);n.sort((i,s)=>i[0]-s[0]);let r=[];for(let i of n){let s=r[r.length-1];s&&i[0]<=s[1]?s[1]=Math.max(s[1],i[1]):r.push([i[0],i[1]])}return r}var At=o=>o.reduce((t,[e,n])=>t+(n-e),0);function Ar(o,t,e){let n=[],r=null;for(let i=0;i<o.times.length;i++){let s=t(o.values[o.vals[i]]);s&&r===null&&(r=o.times[i]),!s&&r!==null&&(n.push([r,o.times[i]]),r=null)}return r!==null&&e>r&&n.push([r,e]),n}function Un(o,t,e,n,r=2*ge){let i=lt(t.flatMap(l=>{let u=o.tracks.get(l);return u?G(u,L,o.end):[]}),e,n);if(!t.some(l=>o.tracks.has(l)))return[];let s=[],a=e;for(let[l,u]of i)l-a>=r&&s.push([a,l]),a=Math.max(a,u);return n-a>=r&&s.push([a,n]),s}function Kn(o){for(let t=o.length-1;t>=0;t--){let[e,n]=o[t],r=0;for(let i=e;i<n;i+=6e5){let s=j(i);s>=7&&s<22&&(r+=Math.min(6e5,n-i))}if(r>=ge)return[e,n]}return null}var Bn=["alarm","door","window","window_open","light_on","motion","appliance"];function jn(o){let{timeline:t,roles:e,events:n,from:r,to:i}=o,s=[],a=new Map,l=(c,f,d)=>{let m=`${c}:${f}`,h=a.get(m);if(h)h.count++,h.t=Math.min(h.t,d);else{let p={kind:c,entity:f,t:d,count:1,ms:0};a.set(m,p),s.push(p)}};for(let c of n)c.t<r||c.t>i||(_t.has(c.kind)||c.kind==="rain"?s.push({kind:"alarm",entity:c.entity,t:c.t,count:1,ms:0,event:c.kind}):c.kind==="door"||c.kind==="garage"||c.kind==="lock"?l("door",c.entity,c.t):c.kind==="window"?l("window",c.entity,c.t):(c.kind==="washer"||c.kind==="robot_done")&&s.push({kind:"appliance",entity:c.entity,t:c.t,count:1,ms:0,event:c.kind}));for(let c of o.motion){let f=t.tracks.get(c);if(f){for(let d of it(f))d.from!==null&&d.t>=r&&d.t<=i&&d.to==="on"&&d.from!=="on"&&!rt.has(d.from)&&l("motion",c,d.t);if(f.dropped)for(let d of f.dropped)d>=r&&d<=i&&l("motion",c,d)}}let u=(c,f,d,m)=>{let h=lt(d,r,i),p=At(h);(p>=m||h.length&&h[h.length-1][1]>=i&&p>=6e4)&&s.push({kind:c,entity:f,t:h[0][0],count:h.length,ms:p})};for(let c of o.lights){let f=t.tracks.get(c);f&&u("light_on",c,G(f,Tr,t.end),15*6e4)}for(let[c,f]of e){if(f!=="window"&&f!=="window_more")continue;let d=t.tracks.get(c);d&&u("window_open",c,G(d,L,t.end),30*6e4)}return s.sort((c,f)=>Bn.indexOf(c.kind)-Bn.indexOf(f.kind)||(c.kind==="light_on"||c.kind==="window_open"?f.ms-c.ms:c.t-f.t))}var Tr=new Set(["on"]);function Fr(o,t,e,n){let r=1/0,i=-1/0,s=o.series.get(t);if(s)for(let a=0;a<s.mean.length;a++){let l=s.start+(a+.5)*s.step,u=s.mean[a];l<e||l>n||Number.isNaN(u)||(r=Math.min(r,u),i=Math.max(i,u))}else{let a=o.tracks.get(t);if(a)for(let l=Math.max(0,S(a.times,e));l<a.times.length&&a.times[l]<=n;l++){let u=Number(a.values[a.vals[l]].s);Number.isFinite(u)&&(r=Math.min(r,u),i=Math.max(i,u))}}return Number.isFinite(r)?[r,i]:null}function Gn(o,t,e,n,r=null){let i=Math.min(n,o.end),s=[],a=(l,u)=>l.flatMap(c=>{let f=o.tracks.get(c);return f?Ar(f,u,o.end):[]});for(let l of t){let u=At(lt(a(l.lights,h=>h.s==="on"),e,i)),c=At(lt(a(l.windows.flat(),h=>L.has(h.s)),e,i)),f=At(lt(a(l.climates,h=>h.a?.hvac_action==="heating"),e,i)),d=null,m=null;for(let h of l.temps){let p=Fr(o,h,e,i);p&&(d=d===null?p[0]:Math.min(d,p[0]),m=m===null?p[1]:Math.max(m,p[1]))}(u||c||f||d!==null)&&s.push({roomId:l.roomId,name:l.name,lightMs:u,windowMs:c,heatMs:f,tMin:d,tMax:m})}return{from:e,to:n,rooms:s,energy:r}}function Pr(o,t,e){let n=o.series.get(t);if(n){let s=V(n,e);return Number.isFinite(s)?String(s):null}let r=o.tracks.get(t);if(!r)return null;let i=S(r.times,e);return i<0?null:r.values[r.vals[i]].s}function qn(o,t,e,n,r,i){let s={};for(let a of r){let l=Pr(o,a,i);l!==null&&(s[a]={entity_id:a,state:l,attributes:t[a]?.attributes??{}})}return $e({states:s},e,[],n)}function Qn(o,t){let e=o.energy;return[...new Set([e.grid,e.solar,e.battery,e.battery_soc,e.consumption,...(e.systems??[]).flatMap(n=>[n.grid,n.solar,n.battery,n.battery_soc]),t.grid,t.gridExport,...t.solar,...t.battery,...t.charge,...t.soc].filter(n=>!!n))]}function Yn(o,t,e,n=3e5){let r=0,i=0,s=0,a=0,l=!1,u=n/ge/1e3;for(let c=t+n/2;c<e;c+=n){let f=o(c);f.solar===null&&f.grid===null&&f.consumption===null||(l=!0,r+=Math.max(0,f.solar??0)*u,i+=Math.max(0,f.grid??0)*u,s+=Math.max(0,-(f.grid??0))*u,a+=Math.max(0,f.consumption??0)*u)}return l?{pv:r,imp:i,exp:s,use:a,self:a>0?Math.min(1,Math.max(0,1-i/a)):null}:null}var A=24*36e5,be=150,ye=250,Or=10*1024*1024,zr=6e4,Ir=6e4,Zn=1e4;function q(o,t){try{return t!==void 0&&localStorage.setItem(`fp3d-tt-${o}`,t),localStorage.getItem(`fp3d-tt-${o}`)}catch{return null}}var _e=class{hass=null;replay;state="loading";error=null;progress=0;playback=null;timeline=null;events=[];allEvents=[];names=new Map;gaps=[];nights=[];rooms=[];roomOf=new Map;opts;end;range;loadingDay=null;full=!1;version=0;follow=q("follow")==="1";stopImportant=q("stop")!=="0";lastClosed;t;live;startStates;replayer=null;roles=new Map;weather=null;devices=null;energyIds=[];requested=[];cars=[];liveLog=null;quality;low;timer;last=0;followAt=0;eventsAt=0;flushedAt=0;derivePending=!1;gapsTo=0;wanted=null;needFrom=null;olderRunning=!1;disposed=!1;daySummaries=new Map;listeners=new Set;onVisible=()=>{document.hidden||!this.playback?.playing||(this.last=performance.now(),this.schedule())};constructor(t){this.opts=t,this.live=t.live,this.startStates=t.live.states,this.quality=t.quality,this.low=t.spec.low,this.t=t.t,Xt(Zt(t.live)),this.end=Date.now(),this.range=t.range==="7d"?"7d":"24h";let e=Number(q("closed"));this.lastClosed=Number.isFinite(e)&&e>0&&e<this.end?e:null;let n=this;this.replay={t:this.end,seek:0,pulses:[],focus:null,focusSeq:0,rows:(r,i,s)=>n.replayer?.rows(r,i,s)??{},listen:r=>n.listen(r),stats:(r,i,s)=>n.timeline?mn(n.timeline,r,i,s):{},robotRooms:(r,i)=>n.timeline?Dn(n.timeline.tracks.get(r),i?n.timeline.tracks.get(i):void 0,n.replay.t):[],setQuality:(r,i)=>n.setQuality(r,i)},document.addEventListener("visibilitychange",this.onVisible),this.load()}listen(t){return this.listeners.add(t),()=>this.listeners.delete(t)}notify(){for(let t of this.listeners)t()}get playing(){return!!this.playback?.playing}get maxDays(){return(this.quality==="low"||this.low)&&this.opts.range!=="7d"?2:7}get start(){return this.end-(this.range==="7d"?this.maxDays:1)*A}get recorderStart(){let t=this.timeline?.keepDays;return typeof t=="number"&&t>0?this.end-t*A:null}get atNow(){let t=this.playback;return!!t&&!t.playing&&t.t>=t.end-1e3&&Date.now()-t.end<12e4}get location(){let t=this.live.config;return typeof t?.latitude=="number"&&typeof t?.longitude=="number"?{lat:t.latitude,lon:t.longitude}:null}get energy(){return!!this.opts.spec.energy&&this.energyIds.length>0}async fetchWindow(t,e,n){let r=ae(this.live,this.opts.building,this.opts.spec),i=Math.max(1,Math.ceil(r.entities.length/be),Math.ceil(r.stats.length/ye)),s=[];for(let a=0;a<i;a++){let l=r.entities.slice(a*be,(a+1)*be),u=r.stats.slice(a*ye,(a+1)*ye),c={type:"home_3d/timetravel/history",start_time:t/1e3,end_time:e/1e3,entity_ids:l,statistic_ids:u},f=r.cars.filter(d=>l.includes(d));if(f.length&&(c.car_trackers=f),s.push(await this.live.callWS(c)),this.disposed)return null;n?.((a+1)/i)}return on(s)}async load(){this.state="loading",this.error=null,this.progress=0,this.notify();let{building:t,spec:e}=this.opts,n=this.live,r=ae(n,t,e),i;try{i=await this.fetchWindow(this.end-A,this.end,u=>{this.progress=u,this.notify()})}catch(u){if(this.disposed)return;let c=u;this.state="error",this.error=c?.code??c?.message??String(u),this.notify();return}if(!i)return;let s=t.presence.flatMap(u=>[u.sensor]).filter(u=>!!u);this.requested=[...r.entities,...r.stats,...r.overflow,...r.hidden,...s],this.cars=r.cars;let a=new Map(e.furniture);this.devices=e.energy?Pt(t,u=>a.get(u.id)?.power??null):null,this.energyIds=this.devices?Qn(t,this.devices):[],this.rooms=Ln(n,t,e),this.roomOf=Wn(this.rooms);for(let[u,c]of le(n,t,e))this.names.set(u,c.name||this.t(`furn_${c.type}`));this.setTimeline(i);let l=typeof this.opts.at=="number"?this.opts.at:Mt(this.opts.at??null,this.end);this.playback=new vt(i.start,this.end,l??this.end-36e5,this.opts.speed??void 0,this.range==="7d"?ne:wt),this.liveLog=new St([...r.entities,...r.stats,...r.overflow],this.startStates,this.end),this.liveLog.record(this.live.states,Date.now()),this.flushedAt=Date.now(),this.state="ready",this.apply(!0),this.range==="7d"&&this.loadOlder()}setTimeline(t){let{building:e,spec:n}=this.opts,r=this.live,i=new Set([...t.tracks.keys(),...t.series.keys()]);this.roles=zn(r,e,n,i),an(t)>un&&cn(t,this.motion()),this.timeline=t,this.version++,this.daySummaries.clear(),this.replayer=new $t(t,{requested:this.requested,location:this.location,states:this.startStates,allowed:this.cars}),this.weather??=[e.settings.weather_entity,...Object.keys(r.states).filter(s=>s.startsWith("weather."))].find(s=>!!s&&i.has(s))??null,this.findEvents(),this.gaps=Qt(t),this.gapsTo=t.end,this.updateNights()}findEvents(){let t=this.timeline;if(!t)return;let{building:e,spec:n}=this.opts,r=this.devices,i=r&&n.energy?{solar:e.energy.solar?[e.energy.solar]:r.solar,soc:e.energy.battery_soc?[e.energy.battery_soc]:r.soc,sunDown:l=>this.sunDown(l)}:null,s=e.settings.outage_entity,a=s&&this.live.states[s]?{id:s,attributes:this.live.states[s].attributes}:null;this.allEvents=yn({timeline:t,roles:this.roles,weather:this.weather,energy:i,outage:a}),this.events=this.allEvents.filter(l=>!bn.has(l.kind))}sunDown(t){let e=this.location;if(e)return de(e.lat,e.lon,t);let n=this.timeline?.tracks.get("sun.sun"),r=n?S(n.times,t):-1;return!!n&&r>=0&&n.values[n.vals[r]].s==="below_horizon"}shownEvents(t=!1){let e=this.playback,n=t?this.allEvents:this.events;return e?En(n,Math.max(e.start,this.start),this.end):n}motion(){return[...this.roles].filter(([,t])=>t==="motion"||t==="camera").map(([t])=>t)}updateNights(){let t=this.location;this.nights=t?Cn(t.lat,t.lon,this.start,this.end):this.sunNights()}async loadOlder(){if(!this.olderRunning){this.olderRunning=!0;try{for(;!this.disposed&&this.timeline&&!this.full;){let t=this.timeline.start,e=Math.min(this.range==="7d"?this.start:1/0,this.needFrom??1/0);if(t<=e+6e4)break;let n=this.recorderStart;if(n!==null&&t<=n||this.timeline.oldest!==null&&this.timeline.oldest>this.timeline.start)break;this.loadingDay=t-A,this.notify();let r;try{r=await this.fetchWindow(t-A,t)}catch(l){console.warn("Home 3D: time travel could not load an older day",l);break}if(!r||this.disposed||!this.timeline)return;let i=sn(r,this.timeline);this.setTimeline(i),ln(i)>Or&&(this.full=!0);let s=this.playback;if(!s)continue;s.setRange(Math.max(i.start,this.start),this.end);let a=!1;this.wanted!==null&&this.wanted>=s.start&&(s.seek(this.wanted),this.wanted=null,a=!0),this.apply(!0,a)}}finally{this.olderRunning=!1,this.disposed||(this.loadingDay=null,this.notify())}}}setRange(t){let e=this.playback;if(t===this.range||!e||!this.timeline)return;this.range=t;let n=e.t;e.setRange(Math.max(this.timeline.start,this.start),this.end,t==="7d"?ne:wt),this.updateNights(),e.t!==n?this.apply(!0):this.notify(),t==="7d"&&this.loadOlder()}sunNights(){let t=this.timeline?.tracks.get("sun.sun");if(!t)return[];let e=[],n=null;for(let r=0;r<t.times.length;r++){let i=t.values[t.vals[r]].s==="below_horizon";i&&n===null&&(n=t.times[r]),!i&&n!==null&&(e.push([n,t.times[r]]),n=null)}return n!==null&&e.push([n,this.end]),e}apply(t,e=t){let n=this.playback;if(!n||!this.replayer||this.disposed)return;this.replay.t=n.t,e&&this.replay.seek++;let r=this.replayer.hassAt(this.live,n.t,t);this.replay.pulses=this.replayer.pulses,(r!==this.hass||t)&&(this.hass=r,this.opts.onChange()),this.notify()}setLive(t){this.live=t,Xt(Zt(t));let e=Date.now();this.liveLog?.record(t.states,e);let n=this.playback,r=!1;if(this.state==="ready"&&n&&this.liveLog&&(this.liveLog.pending&&e-this.flushedAt>=Ir||this.derivePending&&e-this.eventsAt>Zn)){let i=!n.playing&&n.t>=n.end-1e3;this.edge(e),i&&n.seek(n.end),this.replay.t=n.t,r=!0}this.replayer&&n&&(this.hass=this.replayer.hassAt(t,n.t)),r&&this.notify()}setQuality(t,e){let n=this.maxDays;this.quality=t,this.low=e;let r=this.playback;if(n===this.maxDays||!r||!this.timeline)return;let i=this.end-this.maxDays*A,s=this.timeline.start<i-6e4;if(s)this.setTimeline(pn(this.timeline,i)),this.full=!1,this.needFrom!==null&&this.needFrom<i&&(this.needFrom=null),this.wanted!==null&&this.wanted<i&&(this.wanted=null);else if(this.range!=="7d")return;let a=r.t;r.setRange(Math.max(this.timeline.start,this.start),this.end),this.updateNights(),s||r.t!==a?this.apply(!0,r.t!==a):this.notify(),this.loadOlder()}play(){let t=this.playback;if(!t)return;let e=t.t>=t.end;t.play(),e&&this.apply(!0),this.last=performance.now(),this.schedule(),this.notify()}pause(){this.playback?.pause(),clearTimeout(this.timer),this.timer=void 0,this.derivePending&&this.derive(Date.now()),this.notify()}toggle(){this.playback?.playing?this.pause():this.play()}seek(t,e=!1){this.playback&&(e&&this.pause(),this.wanted=null,this.playback.seek(t),this.last=performance.now(),this.apply(!0))}step(t){let e=this.playback;if(!e)return;let n=Rn(this.shownEvents(),e.t,t);this.seek(n?n.t:t>0?e.end:e.start,!0)}goTo(t){this.seek(t.t,!0),this.focusOn(t.entity)}focusOn(t){this.replay.focus=t,this.replay.focusSeq++,this.notify()}yesterday(){let t=this.playback;if(!t)return;let e=t.t-A;e<t.start&&this.range==="24h"&&this.setRange("7d"),this.seek(Math.max(e,t.start),!0),e<t.start&&this.olderRunning&&(this.wanted=e)}setFollow(t){this.follow=t,q("follow",t?"1":"0"),this.notify()}setStopImportant(t){this.stopImportant=t,q("stop",t?"1":"0"),this.notify()}nextSpeed(){this.playback?.nextSpeed(),this.notify()}awayOffer(){let t=this.timeline;return t?Kn(Un(t,this.motion(),t.start,this.end)):null}away(t,e){let n=this.timeline;return n?jn({timeline:n,roles:this.roles,events:this.allEvents,lights:[...n.tracks.keys()].filter(r=>r.startsWith("light.")),motion:this.motion(),from:t,to:e}):[]}ensureLoaded(t){let e=this.timeline;!e||e.start<=t+6e4||this.needFrom!==null&&this.needFrom<=t||t<this.end-this.maxDays*A-A||(this.needFrom=t,this.loadOlder())}daySummary(t){let e=this.timeline;if(!e||t+A<=e.start||t>e.end)return null;let n=`${t}|${this.version}`,r=this.daySummaries.get(n);if(!r){let i=gt(t),s=Math.max(t,e.start),a=Math.min(i,e.end),l=this.devices,u=this.energy&&l?Yn(c=>qn(e,this.live.states,this.opts.building,l,this.energyIds,c),s,a):null;r=Gn(e,this.rooms,s,a,u),this.daySummaries.set(n,r)}return r}schedule(){clearTimeout(this.timer),this.timer=void 0;let t=this.playback;!t?.playing||this.disposed||document.hidden||(this.timer=setTimeout(()=>{this.timer=void 0;let e=performance.now(),n=Math.min(2e3,e-this.last);this.last=e;let r=t.t;if(t.end-t.t<=zr+n*t.speed&&this.edge(),t.advance(n)){let i=this.stopImportant&&t.speed>=900?oe(this.allEvents,r,t.t,s=>_t.has(s.kind)):null;if(i){t.seek(i.t),t.pause(),this.apply(!0),this.focusOn(i.entity);return}if(this.apply(!1),this.follow&&e-this.followAt>2500){let s=oe(this.events,r,t.t,()=>!0);s&&(this.followAt=e,this.focusOn(s.entity))}}t.playing?this.schedule():(this.derivePending&&this.derive(Date.now()),this.notify())},Sn(this.quality,this.low)))}edge(t=Date.now()){let e=this.playback,n=this.timeline;if(!e||!n||!this.liveLog||t-this.end<1e3&&!this.liveLog.pending&&!this.derivePending)return;let{added:r,created:i}=this.liveLog.flush(n,t);this.flushedAt=t,this.end=t,e.setRange(Math.max(n.start,this.start),t),i&&this.replayer?.refresh(),(r||i)&&(this.derivePending=!0),this.derivePending&&(!e.playing||t-this.eventsAt>Zn)&&this.derive(t)}derive(t){let e=this.timeline;if(!e)return;this.derivePending=!1,this.eventsAt=t,this.findEvents();let n=Math.max(e.start,this.gapsTo-30*6e4),r=this.gaps.filter(([a])=>a<n).map(([a,l])=>[a,Math.min(l,n)]),i=Qt(e,void 0,void 0,void 0,n),s=r[r.length-1];s&&i.length&&s[1]>=n&&i[0][0]<=n&&(s[1]=i.shift()[1]),this.gaps=[...r,...i],this.gapsTo=e.end,this.updateNights(),this.version++,this.daySummaries.clear()}exit(){this.opts.onExit()}dispose(){!this.disposed&&this.state==="ready"&&q("closed",String(Date.now())),this.disposed=!0,clearTimeout(this.timer),this.timer=void 0,this.listeners.clear(),this.liveLog=null,document.removeEventListener("visibilitychange",this.onVisible)}};function el(o){return new _e(o)}export{Or as MAX_BYTES,_e as Session,el as startTimeTravel};
