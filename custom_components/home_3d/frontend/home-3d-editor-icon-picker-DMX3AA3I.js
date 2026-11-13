import{f as g,g as f}from"./home-3d-editor-chunk-EJAOI7SH.js";import{a as h}from"./home-3d-editor-chunk-TAAEQO2A.js";import{b as u,c as i,f as l,h as m}from"./home-3d-editor-chunk-GGWVF3HT.js";var b=["lightbulb","lamp","ceiling-light","floor-lamp","led-strip","power","power-plug","power-socket-eu","toggle-switch","light-switch","thermometer","water-thermometer","radiator","fire","snowflake","fan","air-conditioner","air-filter","water-percent","water","water-alert","water-boiler","shower","toilet","faucet","pipe","gas-cylinder","flash","flash-alert","solar-power","battery","battery-charging","ev-station","car","car-electric","garage","garage-open","door","door-open","door-closed","window-closed","window-open","blinds","blinds-open","curtains","lock","lock-open","key","shield-home","bell","bell-ring","alarm-light","cctv","camera","doorbell","motion-sensor","smoke-detector","fire-alert","alert","information","television","speaker","music","play","pause","volume-high","remote","gamepad-variant","router-wireless","wifi","bluetooth","cellphone","tablet","laptop","desktop-tower","printer","server","nas","home","home-outline","sofa","bed","table-furniture","desk","fridge","stove","microwave","dishwasher","washing-machine","tumble-dryer","coffee-maker","kettle","robot-vacuum","broom","trash-can","flower","tree","pot-mix","sprinkler","weather-sunny","weather-night","weather-rainy","weather-windy","umbrella","paw","dog","cat","baby-carriage","account","human-greeting","clock-outline","calendar","cog","wrench","hammer","tools","chart-line","gauge","information-outline","help-circle"];function p(n){return(n??"").trim().replace(/^mdi:/i,"")||null}function w(n){if(!Array.isArray(n))return[];let e=[];for(let r of n)if(typeof r=="string")e.push({name:r,keywords:[]});else if(r&&typeof r=="object"&&typeof r.name=="string"){let a=r.keywords;e.push({name:r.name,keywords:Array.isArray(a)?a.filter(t=>typeof t=="string"):[]})}return e}function y(n,e,r=120){let a=e.toLowerCase().replace(/^mdi:/,"").split(/[\s-]+/).filter(Boolean);if(!a.length)return n.slice(0,r);let t=a.join("-"),c=[];for(let o of n){let s=o.name.toLowerCase(),$=`${s} ${o.keywords.join(" ").toLowerCase()}`;a.every(_=>$.includes(_))&&c.push({e:o,rank:s===t?0:s.startsWith(t)?1:s.includes(t)?2:3})}return c.sort((o,s)=>o.rank-s.rank),c.slice(0,r).map(o=>o.e)}var x=null,v=()=>b.map(n=>({name:n,keywords:[]}));function I(){return x??=fetch("/static/mdi/iconList.json").then(n=>n.ok?n.json():[]).then(n=>{let e=w(n);return e.length?e:v()}).catch(v),x}var k=n=>n.replace(/[^a-z0-9-]/gi,""),d=class extends m{static properties={value:{attribute:!1},hass:{attribute:!1},disabled:{type:Boolean},label:{type:String},placeholder:{type:String},searchText:{type:String},noneText:{type:String},_open:{state:!0},_q:{state:!0},_list:{state:!0}};constructor(){super(),this.disabled=!1,this.label="",this.placeholder="",this.searchText="Search icons",this.noneText="No icon of that name. You can still type it above.",this._open=!1,this._q="",this._list=null}emit(e){this.dispatchEvent(new CustomEvent("icon-change",{detail:{value:p(e)},bubbles:!0,composed:!0}))}toggle(){this._open=!this._open,this._open&&!this._list&&I().then(e=>this._list=e)}render(){let e=p(this.value);if(customElements.get("ha-icon-picker"))return i`<ha-icon-picker
        .hass=${this.hass}
        .label=${this.label}
        .value=${e?`mdi:${e}`:""}
        ?disabled=${this.disabled}
        @value-changed=${t=>{t.stopPropagation(),this.emit(t.detail.value||null)}}
      ></ha-icon-picker>`;let r=this._open&&this._list?y(this._list,this._q,120):[],a=!!customElements.get("ha-icon");return i`<span class="row">
        <span class="fp3d-field grow"
          ><input
            type="text"
            .value=${this.value??""}
            placeholder=${this.placeholder}
            aria-label=${this.label||this.placeholder}
            spellcheck="false"
            autocomplete="off"
            ?disabled=${this.disabled}
            @change=${t=>this.emit(t.target.value)}
        /></span>
        ${e&&a?i`<ha-icon .icon=${`mdi:${k(e)}`}></ha-icon>`:l}
        <button type="button" class="fp3d-btn pick" ?disabled=${this.disabled} aria-expanded=${this._open?"true":"false"} aria-label=${this.label||"Icons"} title=${this.label||"Icons"} @click=${()=>this.toggle()}>▦</button>
      </span>
      ${this._open?i`<div class="panel">
            <span class="fp3d-field"
              ><input
                type="search"
                .value=${this._q}
                placeholder=${this.searchText}
                aria-label=${this.searchText}
                spellcheck="false"
                autocomplete="off"
                @input=${t=>this._q=t.target.value}
            /></span>
            ${this._list?i`<div class=${a?"grid":"grid names"} role="listbox">
                  ${r.map(t=>i`<button
                      type="button"
                      role="option"
                      class=${t.name===e?"on":""}
                      title=${t.name}
                      aria-label=${t.name}
                      @click=${()=>{this._open=!1,this._q="",this.emit(t.name)}}
                    >
                      ${a?i`<ha-icon .icon=${`mdi:${k(t.name)}`}></ha-icon>`:i`<span>${t.name}</span>`}
                    </button>`)}
                </div>`:i`<small class="note" role="status">…</small>`}
            ${this._list&&!r.length?i`<small class="note" role="status">${this.noneText}</small>`:l}
          </div>`:l}`}static styles=[g,f,u`
      :host {
        display: block;
        min-width: 0;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .grow {
        flex: 1;
        min-width: 0;
      }
      .grow input {
        width: 100%;
        box-sizing: border-box;
      }
      ha-icon {
        --mdc-icon-size: 22px;
        color: var(--fp3d-accent);
      }
      .pick {
        min-width: 36px;
        padding: 4px 8px;
      }
      .panel {
        display: grid;
        gap: 8px;
        margin-top: 6px;
        padding: 8px;
        border-radius: 10px;
        border: 1px solid var(--fp3d-line);
        background: rgba(127, 127, 127, 0.08);
      }
      .panel input {
        width: 100%;
        box-sizing: border-box;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
        gap: 4px;
        max-height: 200px;
        overflow: auto;
      }
      .grid.names {
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      }
      .grid button {
        min-height: 40px;
        display: grid;
        place-items: center;
        border: 1px solid transparent;
        border-radius: 8px;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 12px;
        cursor: pointer;
      }
      .grid.names button span {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 0 6px;
      }
      .grid button:hover,
      .grid button:focus-visible,
      .grid button.on {
        border-color: var(--fp3d-accent);
      }
      .note {
        color: var(--fp3d-muted);
      }
    `]};h("fp3d-icon-picker",d);export{d as IconPicker};
