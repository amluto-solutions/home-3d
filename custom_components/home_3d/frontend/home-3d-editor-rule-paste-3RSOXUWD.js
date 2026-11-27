import{a as b}from"./home-3d-editor-chunk-GURLW7HP.js";import"./home-3d-editor-chunk-47SWZPB3.js";import"./home-3d-editor-chunk-AQSZK3EU.js";import{c as $}from"./home-3d-editor-chunk-NAXLVOY6.js";import{n as h}from"./home-3d-editor-chunk-QY5WSWYM.js";import"./home-3d-editor-chunk-A74QUOUQ.js";import{ya as _}from"./home-3d-editor-chunk-CJKJVRX6.js";import{c as u,f as k}from"./home-3d-editor-chunk-GGWVF3HT.js";function w(e,s,p){let r=[];for(let l of e.floors){for(let n of l.furniture){let a=p(n);r.push({key:`${l.id}|f|${n.id}`,own:`f:${n.id}`,name:n.name||s.furniture(n.type),floor:l.name,self:a,light:_(n.type)||!!a?.startsWith("light.")})}for(let n of l.placements)r.push({key:`${l.id}|p|${n.entity_id}`,own:`p:${n.entity_id}`,name:n.name||s.entity(n.entity_id),floor:l.name,self:n.entity_id,light:n.entity_id.startsWith("light.")})}return r}function v(e,s){let p=s.toLowerCase().split(/\s+/).filter(Boolean);return p.length?e.filter(r=>p.every(l=>`${r.name} ${r.floor} ${r.self??""}`.toLowerCase().includes(l))):e}function I(e,s,p,r,l){let n=s.filter(i=>p.has(i.key)),a=$(r)?n.filter(i=>!i.self):[],d=n.filter(i=>!a.includes(i)),f=new Set(d.map(i=>i.key));for(let i of e.floors){for(let o of i.furniture)f.has(`${i.id}|f|${o.id}`)&&(o.show_rules={...o.show_rules??{},[l]:structuredClone(r)});for(let o of i.placements)f.has(`${i.id}|p|${o.entity_id}`)&&(o.show_rules={...o.show_rules??{},[l]:structuredClone(r)})}return{done:d,skipped:a}}var P=u`<style>
.fp3d-rp { margin-top: 8px; display: grid; gap: 8px; }
.fp3d-rp-tools { display: flex; flex-wrap: wrap; gap: 6px; }
.fp3d-rp-list { max-height: min(50vh, 340px); overflow: auto; border: 1px solid var(--fp3d-line); border-radius: 8px; padding: 4px 0; }
.fp3d-rp-list label { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 2px 10px; cursor: pointer; }
.fp3d-rp-list input { flex: none; width: 18px; height: 18px; margin: 0; }
.fp3d-rp-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.fp3d-rp-name small { display: block; color: var(--fp3d-muted); }
</style>`;function R(e,s,p,r,l,n){let a=e._doc,d=w(a,{furniture:t=>b(e.hass,t),entity:t=>h(e.hass,t)},t=>e.furnitureSelf(t)).filter(t=>t.own!==l),f=v(d,s.q),i=$(p),o=a.floors.length>1,g=(t,m)=>{for(let c of t)m?s.chosen.add(c.key):s.chosen.delete(c.key);e.requestUpdate()},x=()=>{let t={done:[],skipped:[]};e.change(c=>{t=I(c,d,s.chosen,p,r)});let m=t.skipped.map(c=>c.name).join(", ");n([e.t("rules_pasted",{n:t.done.length}),t.skipped.length?e.t("rules_pasted_skip",{list:m}):""].filter(Boolean).join(" "))},y=s.chosen.size;return u`${P}
    <div class="fp3d-rp" role="group" aria-label=${e.t("rules_pick_title")}>
      <b>${e.t("rules_pick_title")}</b>
      <label class="fp3d-field"
        >${e.t("rules_pick_search")}
        <input
          type="search"
          .value=${s.q}
          @input=${t=>{s.q=t.target.value,e.requestUpdate()}}
      /></label>
      <div class="fp3d-rp-tools">
        <button class="fp3d-btn" @click=${()=>g(d.filter(t=>t.light),!0)}>${e.t("rules_pick_lights")}</button>
        <button class="fp3d-btn" @click=${()=>g(f,!0)}>${e.t("rules_pick_shown")}</button>
        <button class="fp3d-btn" ?disabled=${!y} @click=${()=>g(d,!1)}>${e.t("rules_pick_clear")}</button>
      </div>
      <div class="fp3d-rp-list">
        ${f.length?f.map(t=>u`<label
                ><input type="checkbox" .checked=${s.chosen.has(t.key)} @change=${m=>g([t],m.target.checked)} /><span class="fp3d-rp-name"
                  >${t.name}${o||i&&!t.self?u`<small>${[o?t.floor:"",i&&!t.self?e.t("rules_pick_no_self"):""].filter(Boolean).join(" \xB7 ")}</small>`:k}</span
                ></label
              >`):u`<p class="fp3d-sub">${e.t("rules_pick_empty")}</p>`}
      </div>
      <div class="fp3d-actions">
        <button class="fp3d-btn fp3d-primary" ?disabled=${!y} @click=${x}>${e.t(r==="icon"?"rules_paste_icon_n":"rules_paste_card_n",{n:y})}</button>
        <button class="fp3d-btn" @click=${()=>n(null)}>${e.t("cancel")}</button>
      </div>
    </div>`}export{w as pasteItems,I as pasteOnto,R as renderPastePicker,v as searchItems};
