import{c as T}from"./home-3d-editor-chunk-LMQHWYMJ.js";import{c as d,f as p}from"./home-3d-editor-chunk-GGWVF3HT.js";var $=["nye","new_year","chinese_new_year","christmas_eve","christmas","boxing_day","twixmas","advent","bonfire","remembrance","valentines","pancake_day","mothers_day","easter","fathers_day","halloween"],h=["none","brief","long","always"];function x(e){return`rgba(${e>>16&255}, ${e>>8&255}, ${e&255}, ${((e>>>24&255)/255).toFixed(2)})`}var ee=x(1439174702),ne=x(1308608845),te=x(864332287);function H(e){let n=e%19,s=Math.floor(e/100),t=e%100,u=Math.floor(s/4),l=s%4,i=Math.floor((s+8)/25),o=Math.floor((s-i+1)/3),f=(19*n+s-u-o+15)%30,g=Math.floor(t/4),m=t%4,a=(32+2*l+2*g-f-m)%7,r=Math.floor((n+11*f+22*a)/451),c=f+a-7*r+114;return[Math.floor(c/31),c%31+1]}var v={2025:[1,29],2026:[2,17],2027:[2,6],2028:[1,26],2029:[2,13],2030:[2,3],2031:[1,23],2032:[2,11],2033:[1,31],2034:[2,19],2035:[2,8]};function Y(e){try{let n=new Intl.DateTimeFormat("en-u-ca-chinese",{month:"numeric",day:"numeric",timeZone:"Asia/Shanghai"});if(n.resolvedOptions().calendar!=="chinese")return null;for(let s=0;s<33;s++){let t=new Date(Date.UTC(e,0,19+s,4)),u=n.formatToParts(t);if(u.find(l=>l.type==="month")?.value==="1"&&u.find(l=>l.type==="day")?.value==="1")return[t.getUTCMonth()+1,t.getUTCDate()]}}catch{}return null}function W(e){return v[e]??Y(e)??v[2026]}var B=[31,29,31,30,31,30,31,31,30,31,30,31];function S(e){let n=/^(\d\d)-(\d\d)$/.exec(e??"");if(!n)return null;let s=Number(n[1]),t=Number(n[2]);return s>=1&&s<=12&&t>=1&&t<=B[s-1]?[s,t]:null}var C=864e5,_=(e,n,s)=>Math.floor(Date.UTC(e,n-1,s)/C),N=(e,n)=>{let s=/^(\d\d):(\d\d)$/.exec(e??"");return s?Number(s[1])*60+Number(s[2]):n};function P(e,n){let s=e.kind,t=e.month??1,u=e.nth??1,l;if(s==="once"){let i=g=>{let m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(g??"");return m?_(Number(m[1]),Number(m[2]),Number(m[3])):NaN},o=i(e.from),f=e.to?i(e.to):o;return o<=f?[o,f]:null}if(s==="easter"){let[i,o]=H(n);l=_(n,i,o)+(e.offset??0)}else if(s==="cny")l=_(n,...W(n));else if(s==="nth"&&u<0){let i=_(n,t+1,1)-1;l=i-((i+4)%7-(e.weekday??0)+7)%7}else{let i=_(n,t,1);if(l=s==="fixed"?_(n,t,e.day??1):i+((e.weekday??0)-(i+4)%7+7)%7+(u-1)*7,new Date(l*C).getUTCMonth()+1!==t)return null}return[l,l+(e.days??1)-1]}function O(e,n){let s=P(e,n);if(!s)return null;let t=s[0]*1440+N(e.start,0),u=s[1]*1440+N(e.end,1440);return[t,u>t?u:u+1440]}var b=(e,n,s=1)=>({kind:"fixed",month:e,day:n,days:s}),I=(e,n)=>({kind:"nth",nth:e,weekday:0,month:n,days:1}),w=(e,n=1)=>({kind:"easter",offset:e,days:n}),j={nye:b(12,31),new_year:b(1,1),chinese_new_year:{kind:"cny",days:1},christmas_eve:b(12,24),christmas:b(12,25),boxing_day:b(12,26),twixmas:b(12,27,5),advent:b(12,1,23),bonfire:b(11,5),remembrance:I(2,11),valentines:b(2,14),pancake_day:w(-47),mothers_day:w(-21),easter:w(-2,4),fathers_day:I(3,6),halloween:b(10,31)};function U(e,n,s){let t=s?.[e];if(t)return t;let u=n?.[e],l=S(u?.from);if(!u||!l)return[j[e]];let i=S(u.to)??l;return[b(l[0],l[1],(_(2023,i[0],i[1])-_(2023,l[0],l[1])+365)%365+1)]}var R=864e5,k=2024;function L(e,n,s,t){let u=new Map;for(let l of e)for(let i=t-1;i<=t+4;i++){let o=O(l,i);o&&o[1]>n&&u.set(`${o[0]}:${o[1]}`,{from:o[0],to:o[1]})}return[...u.values()].sort((l,i)=>l.from-i.from||l.to-i.to).slice(0,s)}var F=e=>Math.floor(Date.UTC(e.getFullYear(),e.getMonth(),e.getDate(),e.getHours(),e.getMinutes())/6e4);function E(e,n){let s=(r,c)=>new Date(r*R).toLocaleDateString(n.lang,{weekday:"short",day:"numeric",month:"short",...c?{year:"numeric"}:{},timeZone:"UTC"}),t=r=>T(new Date(r*6e4),{h12:n.h12,language:n.lang},{timeZone:"UTC"}),u=Math.floor(e.from/1440),l=Math.floor((e.to-1)/1440),i=e.from-u*1440,o=e.to-l*1440,f=new Date(u*R).getUTCFullYear(),g=new Date(l*R).getUTCFullYear(),m=`${s(u,f!==g)}${i?` ${t(e.from)}`:""}`,a=`${s(l,!0)}${o<1440?` ${t(e.to)}`:""}`;return u===l&&!i&&o===1440?a:`${m} \u2013 ${a}`}function V(e,n,s,t){let u=F(n),l=L(e,u,1,n.getFullYear())[0];return l?l.from<=u?t("season_now_until",{when:E({from:l.to-1,to:l.to},s).replace(/^.* – /,"")}):t("season_next",{when:E(l,s)}):t("season_never")}function A(e,n,s){let t={...e.days?{days:e.days}:{},...e.start?{start:e.start}:{},...e.end?{end:e.end}:{}},u=`${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,"0")}-${String(s.getDate()).padStart(2,"0")}`;return n==="fixed"?{kind:n,month:s.getMonth()+1,day:s.getDate(),days:1,...t}:n==="easter"?{kind:n,offset:0,days:1,...t}:n==="nth"?{kind:n,nth:1,weekday:1,month:s.getMonth()+1,days:1,...t}:n==="cny"?{kind:n,days:1,...t}:{kind:n,from:u,...t.start?{start:t.start}:{},...t.end?{end:t.end}:{}}}function Z(e,n){if(e?.kind==="once"&&e.from){let s=t=>`${Number(t.slice(0,4))+1}${t.slice(4)}`;return{...e,from:s(e.from),...e.to?{to:s(e.to)}:{}}}return A({kind:"once"},"once",n)}function K(e){let n={};for(let[s,t]of Object.entries(e))t!==void 0&&t!==""&&!(typeof t=="number"&&Number.isNaN(t))&&(n[s]=t);return n.kind==="once"&&delete n.days,n}function G(e,n,s,t){let u={};for(let[i,o]of Object.entries(e??{}))o&&i!==s&&(u[i]=[...o]);t&&(u[s]=t.map(K));let l={};for(let[i,o]of Object.entries(n??{}))o&&i!==s&&S(o.from)&&(l[i]=o);return{season_rules:Object.keys(u).length?u:void 0,season_dates:Object.keys(l).length?l:void 0}}var D=(e,n)=>`${k}-${String(e).padStart(2,"0")}-${String(n).padStart(2,"0")}`;function q(e,n,s){let t=a=>e.set(e.rules.map((r,c)=>c===s?{...r,...a}:r)),u=Array.from({length:12},(a,r)=>new Date(k,r,1).toLocaleDateString(e.lang,{month:"long"})),l=Array.from({length:7},(a,r)=>new Date(k,0,7+r).toLocaleDateString(e.lang,{weekday:"long"})),i=n.kind==="cny"?["cny","fixed","easter","nth","once"]:["fixed","easter","nth","once"],o=(a,r)=>d`<label class="fp3d-field"><span>${a}</span>${r}</label>`,f=(a,r,c)=>o(c,d`<input type="date" .value=${r??""} @change=${y=>t({[a]:y.target.value||void 0})} />`),g=(a,r)=>d`<div class="fp3d-field">
    <span>${r}</span>
    <fp3d-time-field
      .value=${n[a]??""}
      .hour12=${e.h12}
      .clearable=${!0}
      .label=${r}
      .hourLabel=${e.t("time_hour")}
      .minuteLabel=${e.t("time_minute")}
      @change=${c=>t({[a]:c.detail.value||void 0})}
    ></fp3d-time-field>
  </div>`,m=(a,r,c)=>o(a,d`<select aria-label=${a} @change=${r}>${c}</select>`);return d`<div class="fp3d-ext-rule">
    ${m(e.t("season_rule_kind"),a=>e.set(e.rules.map((r,c)=>c===s?A(r,a.target.value,new Date):r)),i.map(a=>d`<option value=${a} ?selected=${n.kind===a}>${e.t(`season_kind_${a}`)}</option>`))}
    ${n.kind==="fixed"?o(e.t("season_date"),d`<input
            type="date"
            min=${D(1,1)}
            max=${D(12,31)}
            .value=${D(n.month??1,n.day??1)}
            @change=${a=>{let r=/^\d{4}-(\d\d)-(\d\d)$/.exec(a.target.value);r&&t({month:Number(r[1]),day:Number(r[2])})}}
          />`):p}
    ${n.kind==="easter"?o(e.t("season_easter_offset"),d`<input type="number" min="-366" max="366" .value=${String(n.offset??0)} @change=${a=>t({offset:Math.round(Number(a.target.value)||0)})} />`):p}
    ${n.kind==="nth"?d`${m(e.t("season_nth"),a=>t({nth:Number(a.target.value)}),[1,2,3,4,5,-1].map(a=>d`<option value=${a} ?selected=${(n.nth??1)===a}>${e.t(a<0?"season_nth_last":`season_nth_${a}`)}</option>`))}
        ${m(e.t("season_weekday"),a=>t({weekday:Number(a.target.value)}),l.map((a,r)=>d`<option value=${r} ?selected=${(n.weekday??0)===r}>${a}</option>`))}
        ${m(e.t("season_dates_month"),a=>t({month:Number(a.target.value)}),u.map((a,r)=>d`<option value=${r+1} ?selected=${(n.month??1)===r+1}>${a}</option>`))}`:p}
    ${n.kind==="once"?d`${f("from",n.from,e.t("season_dates_from"))} ${f("to",n.to,e.t("season_dates_to"))}`:p}
    ${n.kind!=="once"?o(e.t("season_length"),d`<input type="number" min="1" max="366" .value=${String(n.days??1)} @change=${a=>t({days:Math.min(366,Math.max(1,Math.round(Number(a.target.value)||1)))})} />`):p}
    ${g("start",e.t("season_start_time"))} ${g("end",e.t("season_end_time"))}
    <button type="button" class="fp3d-btn fp3d-danger fp3d-ext-rule-remove" @click=${()=>e.remove(s)}>${e.t("season_remove")}</button>
  </div>`}function z(e){let n={lang:e.lang,h12:e.h12},s=L(e.rules,F(e.now),3,e.now.getFullYear());return d`<div class="fp3d-ext-dates" data-ext=${`season:${e.id}`}>
    <span class="fp3d-sub">${V(e.rules,e.now,n,e.t)}${e.custom?` \xB7 ${e.t("season_dates_changed")}`:""}</span>
    ${e.editable?d`<button type="button" class="fp3d-btn" aria-expanded=${e.open} @click=${e.toggle}>${e.t("season_dates")} ${e.open?"\u25B4":"\u25BE"}</button>
          ${e.on?d`<button type="button" class="fp3d-btn" @click=${()=>window.open(`${location.pathname}?fp3d_season=${e.id}`,"_blank","noopener")}>${e.t("season_show_now")}</button>`:p}`:p}
    ${e.open&&e.editable?d`<div class="fp3d-ext-dates-edit">
          ${e.rules.map((t,u)=>q(e,t,u))}
          <button type="button" class="fp3d-btn" @click=${()=>e.set([...e.rules,Z(e.rules[e.rules.length-1],new Date)])}>+ ${e.t("season_add")}</button>
          ${e.custom?d`<button type="button" class="fp3d-btn" @click=${()=>e.set(null)}>${e.t("season_dates_reset")}</button>`:p}
          <div class="fp3d-ext-upcoming">
            <b>${e.t("season_upcoming")}</b>
            ${s.length?d`<ul>${s.map(t=>d`<li>${E(t,n)}</li>`)}</ul>`:d`<span class="fp3d-sub">${e.t("season_never")}</span>`}
            <span class="fp3d-sub">${e.t("season_overlap_hint")}</span>
          </div>
        </div>`:p}
  </div>`}var J={nye:"\u{1F386}",new_year:"\u{1F389}",christmas_eve:"\u{1F385}",christmas:"\u{1F384}",boxing_day:"\u{1F381}",twixmas:"\u2744\uFE0F",advent:"\u{1F56F}\uFE0F",bonfire:"\u{1F525}",remembrance:"\u{1F33A}",valentines:"\u2764\uFE0F",pancake_day:"\u{1F95E}",mothers_day:"\u{1F338}",easter:"\u{1F423}",fathers_day:"\u2B50",halloween:"\u{1F383}",chinese_new_year:"\u{1F9E7}"};function M(e,n,s){let t=G(e.settings.season_rules,e.settings.season_dates,n,s);t.season_rules?e.settings.season_rules=t.season_rules:delete e.settings.season_rules,t.season_dates?e.settings.season_dates=t.season_dates:delete e.settings.season_dates}function ue(e){let n=e.building?.settings,s=n?.seasons??{},t=n?.easter_eggs!==!1,u=new Date,l=n?.halloween?.ghost!==!1,i=e.undo;return d`<div class="fp3d-ext-feature fp3d-ext-on" data-ext="holidays">
    <b>🎄 ${e.t("fun_name_seasons")}</b>
    <span class="fp3d-sub">${e.t("fun_feature_seasons")}</span>
    ${i&&e.editor?d`<div class="fp3d-ext-undo" role="status">
          ${e.t("season_removed",{name:e.t(`season_name_${i.id}`)})}
          <button
            type="button"
            class="fp3d-link"
            @click=${()=>{e.edit(o=>M(o,i.id,i.wasCustom?i.before:null)),e.setUndo(null)}}
          >
            ${e.t("season_undo")}
          </button>
        </div>`:p}
    ${e.editor?d`<div class="fp3d-ext-season" data-setting="season_effect">
            <span>${e.t("st_season_effect")}</span>
            <select
              aria-label=${e.t("st_season_effect")}
              ?disabled=${!t}
              @change=${o=>{let f=o.target.value;e.edit(g=>g.settings.season_effect=f==="brief"?null:f)}}
            >
              ${h.map(o=>d`<option value=${o} ?selected=${(n?.season_effect??"brief")===o}>${e.t(`season_fx_${o}`)}</option>`)}
            </select>
          </div>
          <span class="fp3d-sub">${e.t("st_season_effect_hint")}</span>`:p}
    ${e.editor?$.map(o=>{let f=U(o,n?.season_dates,n?.season_rules),g=!!n?.season_rules?.[o]||!!S(n?.season_dates?.[o]?.from),m=s[o]!==!1&&t;return d`${e.funSwitch(s[o]!==!1&&t,`${J[o]} ${e.t(`season_name_${o}`)}`,a=>e.edit(r=>{let c={...r.settings.seasons??{}};a?delete c[o]:c[o]=!1,r.settings.seasons=c}),!t)}
            ${z({id:o,now:u,lang:e.lang,h12:e.h12,rules:f,custom:g,open:e.open.has(`dates:${o}`),editable:!0,on:m,t:e.t,toggle:()=>e.toggle(`dates:${o}`),set:a=>e.edit(r=>M(r,o,a)),remove:a=>{e.setUndo({id:o,before:f.map(r=>({...r})),wasCustom:g}),e.edit(r=>M(r,o,f.filter((c,y)=>y!==a)))}})}
            ${o==="halloween"?d`<div class="fp3d-ext-sub">
                  <span class="fp3d-sub">${e.t("fun_feature_halloween")}</span>
                  ${e.funSwitch(l,e.t("halloween_ghost"),a=>e.edit(r=>r.settings.halloween={...r.settings.halloween??{},ghost:a}))}
                  <span class="fp3d-sub">${e.t("halloween_deco_hint")}</span>
                </div>`:p}`}):p}
  </div>`}export{Z as addedRule,A as asKind,K as cleanRule,F as clockMinutes,V as nextShowingText,L as nextWindows,z as seasonDates,ue as seasonsCard,M as storeRules,E as windowText,G as withSeasonRules};
