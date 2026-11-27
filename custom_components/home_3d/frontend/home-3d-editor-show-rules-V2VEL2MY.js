import{a as N,c as C,d as U,e as q,f as K,g as A,h as z,i as V}from"./home-3d-editor-chunk-5G4D6D6S.js";import"./home-3d-editor-chunk-TX7BMDPN.js";import{a as Y}from"./home-3d-editor-chunk-UZNVA3O4.js";import{a as G,b as M,c as J}from"./home-3d-editor-chunk-NAXLVOY6.js";import{n as I}from"./home-3d-editor-chunk-QY5WSWYM.js";import"./home-3d-editor-chunk-A74QUOUQ.js";import{E as y,F as x}from"./home-3d-editor-chunk-CJKJVRX6.js";import{c as d,f as c}from"./home-3d-editor-chunk-GGWVF3HT.js";function pe(e,t){let n=e===y?t:e;return n&&n!=="none"?n:null}function fe(e){return(e.getDay()+6)%7}function me(e,t){let n=e.start??null,s=e.end??null;if(!!n!=!!s||n&&s&&!(C.test(n)&&C.test(s)))return!1;let l=U(t);if(n&&s&&!q(l,n,s))return!1;let i=e.days??[];if(!i.length)return!0;let a=!!n&&!!s&&n>s&&l<s?new Date(t.getFullYear(),t.getMonth(),t.getDate()-1):t;return i.includes(fe(a))}function he(e,t,n,s){if(e.type==="time")return me(e,s);if(e.type!=="state"||!x.includes(e.when))return null;let l=pe(e.entity,t);if(!l)return null;let i=e.when==="above"||e.when==="below";if(i&&(typeof e.value!="number"||!Number.isFinite(e.value)))return null;let r=n[l]?.state;if(A(r))return e.unavailable!=="hide";if(i){let a=r.trim(),f=a===""?NaN:Number(a);return Number.isFinite(f)?e.when==="above"?f>e.value:f<e.value:!1}return z(l,r,e.when,e.state)}function Q(e,t,n,s){if(!e?.conditions?.length)return!0;let l=e.match==="any",i=!1;for(let r of e.conditions){let a=he(r,t,n,s);if(a!==null){if(i=!0,l&&a)return!0;if(!l&&!a)return!1}}return!l||!i}var w="sun.sun",R="below_horizon",P="",v=e=>`${P}${e}${P}`;function X(e){if(!e?.conditions?.length)return"none";if(e.conditions.length!==1)return"custom";let t=e.conditions[0];return t.type==="time"?"times":t.type!=="state"||t.unavailable==="hide"?"custom":t.entity===y&&(t.when==="on"||t.when==="off")?t.when:t.entity===w&&t.when==="state"&&t.state===R?"dark":"custom"}function Z(e,t){let n=t?.conditions?.length?t:null,s=l=>({match:"all",conditions:[l]});return e==="none"?null:e==="on"||e==="off"?s({type:"state",entity:y,when:e}):e==="dark"?s({type:"state",entity:w,when:"state",state:R}):e==="times"?s(n?.conditions.find(l=>l.type==="time")??{type:"time"}):n}function T(e){return e&&/^nn\b/i.test(e)?[e,"nb"]:e||void 0}function $e(e,t){let n=[...new Set(e)].filter(l=>l>=0&&l<=6).sort((l,i)=>l-i),s=[];for(let l=0;l<n.length;){let i=l;for(;i+1<n.length&&n[i+1]===n[i]+1;)i++;if(i-l>=2)s.push(`${t.days[n[l]]}\u2013${t.days[n[i]]}`);else for(let r=l;r<=i;r++)s.push(t.days[n[r]]);l=i+1}return t.list(s,!1)}function _e(e,t){if(e.type==="time"){let l=e.start&&e.end?v(`${t.time(e.start)}\u2013${t.time(e.end)}`):"",i=e.days?.length?v($e(e.days,t)):"";return l&&i?t.t("rules_c_time_days",{time:l,days:i}):l||(i?t.t("rules_c_days",{days:i}):t.t("rules_c_always"))}if(e.type!=="state")return"\u2026";if(e.entity===w&&e.when==="state"&&e.state===R)return t.t("rules_c_dark");let n=e.entity===y,s=v(n?t.t("rules_c_self"):t.name(e.entity));return e.when==="on"||e.when==="off"?t.t(e.when==="on"?"rules_c_on":"rules_c_off",{name:s}):e.when==="above"||e.when==="below"?t.t(e.when==="above"?"rules_c_above":"rules_c_below",{name:s,value:v(String(e.value??0))}):t.t("rules_c_state",{name:s,state:v(e.state?.trim()||"\u2026")})}function ee(e,t,n){let s=e?.conditions??[];if(!s.length)return n;let l=s.slice(0,s.length>3?2:3).map(i=>_e(i,t));return l.length<s.length&&l.push(t.t("rules_c_more",{n:s.length-l.length})),t.t("rules_s_show",{list:t.list(l,e.match==="any")})}var H=e=>!!e.entity&&e.entity!=="none";function W(e){let t=e?.intervals??[];return!e||!H(e)&&!t.length?"none":H(e)?!t.length&&e.entity===w&&e.when==="state"&&e.state===R&&e.unavailable!=="hide"?"dark":"custom":t.length===1?"times":"custom"}function te(e,t){return e==="none"?null:e==="dark"?{entity:w,when:"state",state:R}:e==="times"?{intervals:[t?.intervals?.[0]??{}]}:W(t)==="none"?null:t}function ge(e,t){let n=t.date??(i=>i),s=e.start&&e.end?v(`${t.time(e.start)}\u2013${t.time(e.end)}`):"",l=e.from&&e.to?v(`${n(e.from)}\u2013${n(e.to)}`):"";return s&&l?t.t("rules_c_time_days",{time:s,days:l}):s||l||t.t("rules_c_always")}function ne(e,t,n){if(!e||W(e)==="none")return n;let s=[];if(H(e)){let i=e.entity,r=v(t.name(i));e.when?i===w&&e.when==="state"&&e.state===R?s.push(t.t("rules_c_dark")):e.when==="on"||e.when==="off"?s.push(t.t(e.when==="on"?"rules_c_on":"rules_c_off",{name:r})):s.push(t.t("rules_c_state",{name:r,state:v(e.state?.trim()||"\u2026")})):s.push(t.t("rules_c_available",{name:r}))}let l=e.intervals??[];if(l.length){let i=l.slice(0,l.length>3?2:3).map(r=>ge(r,t));i.length<l.length&&i.push(t.t("rules_c_more",{n:l.length-i.length})),s.push(t.list(i,!0))}return t.t("rules_s_show",{list:t.list(s,!1)})}var D=null,ye=N(()=>import("./home-3d-editor-rule-paste-3RSOXUWD.js").then(e=>{D=e})),S=null,F=new Map,se=null,k=new Set,B=new Map;function O(e,t){let n;try{n=new Intl.DateTimeFormat(T(e),{weekday:t})}catch{n=new Intl.DateTimeFormat(void 0,{weekday:t})}return[0,1,2,3,4,5,6].map(s=>n.format(new Date(2024,0,1+s)))}function le(e){let t=e.hass?.language||void 0,n=Y(e.hass?.locale,e.hass?.language),s=(i,r)=>{try{return new Intl.ListFormat(T(t),{type:r?"disjunction":"conjunction"}).format(i)}catch{return i.join(", ")}},l=i=>{let[r,a]=i.split("-").map(Number),f=new Date(2028,r-1,a);try{return new Intl.DateTimeFormat(T(t),{day:"numeric",month:"short"}).format(f)}catch{return i}};return{t:(i,r)=>e.t(i,r),name:i=>e.hass?I(e.hass,i):i,days:O(t,"short"),time:i=>{let[r,a]=i.split(":").map(Number);return n?`${r%12||12}:${String(a).padStart(2,"0")} ${r<12?"am":"pm"}`:i},list:s,date:l}}var ve=e=>e.split(P).map((t,n)=>n%2?d`<b>${t}</b>`:t);function j(e){return e?{type:"state",entity:y,when:"on"}:{type:"time"}}function re(e,t,n){let s=e.conditions.flatMap((l,i)=>i!==t?[l]:n?[n]:[]);return s.length?{...e,conditions:s}:null}function ie(e,t){let n=!e.isEditor,s=t.rule?.conditions?.length?t.rule:null,l=!!s&&!!e.hass&&!Q(s,t.self,e.hass.states,new Date),i=ee(s,le(e),t.none??e.t("rules_s_none"));return oe(e,t.id,t.tag,t.title,i,!!s,l,()=>we(e,t,s,n))}function oe(e,t,n,s,l,i,r,a){let f=!e.isEditor,u=se===t,o=()=>{se=u?null:t,S=null,e.requestUpdate()};return d`<div class="fp3d-rule ${u?"fp3d-rule-open":""}" data-rule=${t}>
    ${n?c:d`<div class="fp3d-rule-title">${s}</div>`}
    <button class="fp3d-rule-say" aria-expanded=${u?"true":"false"} @click=${o}>
      ${n?d`<span class="fp3d-rule-tag">${n}</span>`:c}
      <span class="fp3d-rule-text ${i?"":"fp3d-rule-plain"}">${ve(l)}${r?d` <span class="fp3d-rule-hidden">${e.t("rules_hidden_now")}</span>`:c}</span>
      ${i||u||f?d`<span class="fp3d-rule-chev" aria-hidden="true"></span>`:d`<span class="fp3d-rule-add">+ ${e.t("rules_add_rule")}</span>`}
    </button>
    ${u?a():c}
  </div>`}function we(e,t,n,s){let l=X(n),i=k.has(t.id)&&n?"custom":l,r=o=>{if(o==="custom"){k.add(t.id),n?e.requestUpdate():t.set({match:"all",conditions:[j(t.selfPick)]});return}k.delete(t.id),t.set(Z(o,n))},a=!!e.hass?.states?.[w],f=[["none",e.t("rules_p_none")],...t.self?[["on",e.t("rules_p_on")],["off",e.t("rules_p_off")]]:[],["times",e.t("rules_p_times")],...a||i==="dark"?[["dark",e.t("rules_p_dark")]]:[],["custom",e.t("rules_p_custom")]],u=M();return d`<div class="fp3d-rule-body">
    ${t.note?d`<p class="fp3d-sub">${t.note}</p>`:c}
    <div class="fp3d-rule-choices" role="group" aria-label=${t.tag??t.title}>
      ${f.map(([o,p])=>d`<button class="fp3d-rule-chip" aria-pressed=${i===o?"true":"false"} ?disabled=${s} @click=${()=>r(o)}>${p}</button>`)}
    </div>
    ${n&&i==="times"&&n.conditions[0].type==="time"?ae(e,t,n.conditions[0],0,o=>t.set(re(n,0,o))):c}
    ${n&&i==="custom"?be(e,t,n,s):c}
    ${n&&!t.self&&J(n)?d`<p class="fp3d-sub fp3d-warn">${e.t("rules_no_self")}</p>`:c}
    ${s?c:d`<div class="fp3d-rule-tools">
          ${n?d`<button class="fp3d-rule-link" @click=${()=>{G(n),e.requestUpdate()}}>${e.t("rules_copy")}</button>`:c}
          ${u?d`<button class="fp3d-rule-link" @click=${()=>(k.delete(t.id),t.set(M()))}>${e.t("rules_paste")}</button>
                <button
                  class="fp3d-rule-link"
                  aria-expanded=${S?.block===t.id?"true":"false"}
                  @click=${()=>{S=S?.block===t.id?null:{block:t.id,state:{q:"",chosen:new Set}},F.delete(t.id),ye().then(()=>e.requestUpdate(),o=>console.error("Home 3D: a part of the page failed to load",o)),e.requestUpdate()}}
                >
                  ${e.t("rules_paste_many")}
                </button>`:c}
        </div>`}
    ${u&&S?.block===t.id&&D&&!s?D.renderPastePicker(e,S.state,u,t.id.endsWith(":icon")?"icon":"card",t.id.replace(/:(icon|card)$/,""),o=>{S=null,o&&F.set(t.id,o),e.requestUpdate()}):c}
    ${F.get(t.id)?d`<p class="fp3d-sub" role="status">${F.get(t.id)}</p>`:c}
  </div>`}function be(e,t,n,s){let l=()=>t.set({...n,conditions:[...n.conditions,j(t.selfPick)]});return d`${n.conditions.length>1?d`<div class="fp3d-rule-match" role="group" aria-label=${e.t("rules_match")}>
          ${["all","any"].map(i=>d`<button class="fp3d-rule-chip" aria-pressed=${n.match==="any"==(i==="any")?"true":"false"} ?disabled=${s} @click=${()=>t.set({...n,match:i})}>
              ${e.t(i==="all"?"rules_match_all":"rules_match_any")}
            </button>`)}
        </div>`:c}
    ${n.conditions.map((i,r)=>Se(e,t,n,i,r))}
    ${s||n.conditions.length>=12?c:d`<button class="fp3d-rule-link fp3d-rule-addc" @click=${l}>+ ${e.t("rules_add")}</button>`}`}function Se(e,t,n,s,l){let i=!e.isEditor,r=a=>t.set(re(n,l,a));return d`<div class="fp3d-rule-cond fp3d-field">
    <div class="fp3d-rule-row">
      <select aria-label=${e.t("rules_kind")} ?disabled=${i} @change=${a=>r(a.target.value==="time"?{type:"time"}:j(!0))}>
        <option value="state" ?selected=${s.type==="state"}>${e.t("rules_kind_state")}</option>
        <option value="time" ?selected=${s.type==="time"}>${e.t("rules_kind_time")}</option>
      </select>
      <button class="fp3d-pin" aria-label=${e.t("delete")} title=${e.t("delete")} ?disabled=${i} @click=${()=>r(null)}>✕</button>
    </div>
    ${s.type==="time"?ae(e,t,s,l,r):s.type==="state"?ke(e,t,s,r):c}
  </div>`}function ke(e,t,n,s){let l=!e.isEditor,i=n.entity===y,r=t.self?e.t("rules_this_item",{name:I(e.hass,t.self)}):e.t("rules_this_item_none"),a=n.when==="above"||n.when==="below",f=u=>e.t(u==="on"?"rules_is_on":u==="off"?"rules_is_off":u==="state"?"rules_is_state":u==="above"?"rules_is_above":"rules_is_below");return d`<fp3d-entity-picker
      .options=${e.entityOptions(()=>!0)}
      .fixed=${t.selfPick||i?[{id:y,label:r}]:[]}
      .value=${n.entity}
      .placeholder=${e.t("entity_search")}
      .label=${e.t("rules_entity")}
      .live=${e.liveValue(i?t.self:n.entity)}
      ?disabled=${l}
      @change=${u=>{u.stopPropagation();let o=u.detail.value;o&&o!=="none"&&o!=="__auto"&&s({...n,entity:o})}}
    ></fp3d-entity-picker>
    <div class="fp3d-rule-row">
      <select
        aria-label=${e.t("rules_when")}
        ?disabled=${l}
        @change=${u=>{let o=u.target.value,p={...n,when:o};(o==="above"||o==="below")&&typeof p.value!="number"&&(p.value=0),o!=="above"&&o!=="below"&&delete p.value,o!=="state"&&delete p.state,s(p)}}
      >
        ${x.map(u=>d`<option value=${u} ?selected=${n.when===u}>${f(u)}</option>`)}
      </select>
      ${n.when==="state"?d`<input
            type="text"
            maxlength="255"
            aria-label=${e.t("show_when_typed_state")}
            placeholder=${e.t("show_when_typed_state")}
            ?disabled=${l}
            .value=${n.state??""}
            @change=${u=>s({...n,state:u.target.value.trim()||null})}
          />`:c}
      ${a?d`<input
            type="number"
            step="any"
            inputmode="decimal"
            aria-label=${e.t("rules_value")}
            ?disabled=${l}
            .value=${String(n.value??0)}
            @change=${u=>{let o=Number(u.target.value);Number.isFinite(o)&&Math.abs(o)<=1e12?s({...n,value:o}):u.target.value=String(n.value??0)}}
          />`:c}
    </div>
    <select aria-label=${e.t("show_when_unavailable")} ?disabled=${l} @change=${u=>s({...n,unavailable:u.target.value==="hide"?"hide":null})}>
      <option value="" ?selected=${n.unavailable!=="hide"}>${e.t("rules_unav_show")}</option>
      <option value="hide" ?selected=${n.unavailable==="hide"}>${e.t("rules_unav_hide")}</option>
    </select>`}function ae(e,t,n,s,l){let i=!e.isEditor,r=`${t.id}:${s}`,a=B.get(r)??{start:n.start??"",end:n.end??""},f=(g,_)=>{let $={...a,[g]:_};if(!!$.start!=!!$.end||$.start&&$.start===$.end){B.set(r,$),e.requestUpdate();return}B.delete(r);let b={...n,start:$.start||null,end:$.end||null};b.start||(delete b.start,delete b.end),l(b)},u=!!a.start!=!!a.end,o=!!a.start&&a.start===a.end,p=n.days??[],h=e.hass?.language,m=O(h,"short"),E=O(h,"long"),de=g=>{let _=p.includes(g)?p.filter(b=>b!==g):[...p,g].sort((b,ce)=>b-ce),$={...n,days:_};_.length||delete $.days,l($)},L=(g,_)=>d`<div class="fp3d-rule-time"><span>${_}</span>${e.timeField(_,a[g],i,$=>f(g,$))}</div>`;return d`<div class="fp3d-rule-times">${L("start",e.t("rules_from"))}${L("end",e.t("rules_to"))}</div>
    ${u||o?d`<p class="fp3d-sub fp3d-warn" role="alert">${e.t(o?"rules_time_same":"rules_time_both")}</p>`:c}
    <div class="fp3d-rule-days" role="group" aria-label=${e.t("pet_days")}>
      ${m.map((g,_)=>d`<button aria-pressed=${p.includes(_)?"true":"false"} aria-label=${E[_]} title=${E[_]} ?disabled=${i} @click=${()=>de(_)}>${g.replace(/\.$/,"")}</button>`)}
    </div>
    ${p.length?c:d`<p class="fp3d-rule-hint">${e.t("rules_days")}</p>`}`}function Re(e,t,n){let s=n.item,l=W(s.show_when)==="none"?null:s.show_when,i=!!l&&!!e.hass&&!V(s,e.hass.states,new Date),r=ne(l,le(e),e.t("rules_s_always")),a=e.t("rules_object");return oe(e,t,a,a,r,!!l,i,()=>Ee(e,t,n,l))}function Ee(e,t,n,s){let l=!e.isEditor,i=W(s),r=k.has(t)?"custom":i,a=h=>{let m={...s??{},...h};(!m.entity||m.entity==="none")&&(delete m.when,delete m.state,delete m.unavailable),n.set(m.entity&&m.entity!=="none"||m.intervals?.length?m:null)},f=h=>{if(h==="custom"){k.add(t),e.requestUpdate();return}k.delete(t),n.set(te(h,s))},u=!!e.hass?.states?.[w],o=[["none",e.t("rules_p_none")],["times",e.t("rules_p_dates")],...u||r==="dark"?[["dark",e.t("rules_p_dark")]]:[],["custom",e.t("rules_p_custom")]],p=s?.intervals??[];return d`<div class="fp3d-rule-body">
    <div class="fp3d-with-info"><p class="fp3d-sub">${e.t("rules_object_note")}</p>${e.infoButton("show_when_hint",e.t("rules_object"))}</div>
    <div class="fp3d-rule-choices" role="group" aria-label=${e.t("rules_object")}>
      ${o.map(([h,m])=>d`<button class="fp3d-rule-chip" aria-pressed=${r===h?"true":"false"} ?disabled=${l} @click=${()=>f(h)}>${m}</button>`)}
    </div>
    ${r==="times"&&p.length?ue(e,p,0,a,!1):c}
    ${r==="custom"?We(e,s??{},a):c}
  </div>`}function We(e,t,n){let s=!e.isEditor,l=t.intervals??[],i=t.entity&&t.entity!=="none"?t.entity:null;return d`<div class="fp3d-rule-cond fp3d-field">
      ${e.entitySelect(e.t("show_when_entity"),i,void 0,e.entityOptions(()=>!0),r=>n({entity:r==="none"?null:r}))}
      ${i?d`<label class="fp3d-field"
              >${e.t("show_when_state")}
              <select ?disabled=${s} @change=${r=>n({when:r.target.value||null})}>
                <option value="" ?selected=${!t.when}>${e.t("show_when_available")}</option>
                <option value="on" ?selected=${t.when==="on"}>${e.t("show_when_on")}</option>
                <option value="off" ?selected=${t.when==="off"}>${e.t("show_when_off")}</option>
                <option value="state" ?selected=${t.when==="state"}>${e.t("show_when_typed")}</option>
              </select></label
            >
            ${t.when==="state"?d`<label class="fp3d-field"
                  >${e.t("show_when_typed_state")}
                  <input type="text" maxlength="255" ?disabled=${s} .value=${t.state??""} @change=${r=>n({state:r.target.value.trim()||null})}
                /></label>`:c}
            ${t.when?d`<label class="fp3d-field"
                  >${e.t("show_when_unavailable")}
                  <select ?disabled=${s} @change=${r=>n({unavailable:r.target.value==="hide"?"hide":null})}>
                    <option value="" ?selected=${t.unavailable!=="hide"}>${e.t("show_when_keep")}</option>
                    <option value="hide" ?selected=${t.unavailable==="hide"}>${e.t("show_when_hide")}</option>
                  </select></label
                >`:c}`:c}
    </div>
    ${l.map((r,a)=>ue(e,l,a,n,!0))}
    ${s||l.length>=12?c:d`<button class="fp3d-rule-link fp3d-rule-addc" @click=${()=>n({intervals:[...l,{}]})}>+ ${e.t("show_add_interval")}</button>`}`}function ue(e,t,n,s,l){let i=!e.isEditor,r=t[n],a=o=>s({intervals:t.map((p,h)=>h===n?K(p,o):p)}),f=(o,p,h)=>d`<label class="fp3d-rule-time"
      >${o}
      <input type="date" ?disabled=${i} .value=${p?`2028-${p}`:""} @change=${m=>{let E=m.target.value;h(E?E.slice(5):null)}}
    /></label>`,u=(o,p,h)=>d`<div class="fp3d-rule-time"><span>${o}</span>${e.timeField(o,p??"",i,m=>h(m||null))}</div>`;return d`<div class="fp3d-rule-cond fp3d-field">
    ${l?d`<div class="fp3d-rule-row">
          <span class="fp3d-rule-ivl">${e.t("show_add_interval")} ${n+1}</span>
          <button class="fp3d-pin" aria-label=${e.t("delete")} title=${e.t("delete")} ?disabled=${i} @click=${()=>s({intervals:t.filter((o,p)=>p!==n)})}>✕</button>
        </div>`:c}
    <div class="fp3d-rule-times">
      ${f(e.t("show_from"),r.from,o=>a({from:o}))}${f(e.t("show_to"),r.to,o=>a({to:o}))}
      ${u(e.t("show_start"),r.start,o=>a({start:o}))}${u(e.t("show_end"),r.end,o=>a({end:o}))}
    </div>
  </div>`}function Ue(e,t,n,s,l,i){let r=a=>f=>{let u={...n??{},[a]:f};u.icon||delete u.icon,u.card||delete u.card,l(u.icon||u.card?u:null)};return d`<div class="fp3d-when-section fp3d-rules">
    <div class="fp3d-with-info"><h4>${e.t("rules_title")}</h4>${e.infoButton("rules_hint",e.t("rules_title"))}</div>
    ${i?Re(e,`${t}:object`,i):c}
    ${ie(e,{id:`${t}:icon`,title:e.t("rules_icon"),tag:e.t("rules_icon"),note:e.t("rules_icon_note"),rule:n?.icon,self:s,selfPick:!0,set:r("icon")})}
    ${ie(e,{id:`${t}:card`,title:e.t("rules_card"),tag:e.t("rules_card"),rule:n?.card,self:s,selfPick:!0,set:r("card")})}
  </div>`}export{ie as renderRuleBlock,Ue as renderShowRules};
