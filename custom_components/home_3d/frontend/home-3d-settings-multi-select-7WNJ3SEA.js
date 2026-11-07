import{c as h}from"./home-3d-settings-chunk-JAZYM3FX.js";import{a as p,c,d as s,g as o,i as d}from"./home-3d-settings-chunk-7QJ3M3KF.js";var n=class extends d{static properties={options:{attribute:!1},value:{attribute:!1},locked:{attribute:!1},disabled:{type:Boolean},label:{attribute:!1},placeholder:{attribute:!1},searchLabel:{attribute:!1},emptyText:{attribute:!1},secondaryLabel:{attribute:!1},removeLabel:{attribute:!1},summary:{attribute:!1},noSearch:{type:Boolean},_query:{state:!0},_open:{state:!0},_cursor:{state:!0},_more:{state:!0}};constructor(){super(),this.options=[],this.value=[],this.locked=[],this.disabled=!1,this.label="",this.placeholder="",this.searchLabel="",this.emptyText="\u2013",this.secondaryLabel="",this.removeLabel="Remove {name}",this.summary="",this.noSearch=!1,this._query="",this._open=!1,this._cursor=0,this._more=!1}get open(){return this._open}nameOf(e){return this.options.find(i=>i.id===e)?.label??e}get rows(){let e=this._query.trim().toLowerCase().split(/\s+/).filter(Boolean),i=this._more||!this.secondaryLabel;return this.options.filter(t=>(i||!t.secondary||this.value.includes(t.id))&&e.every(r=>`${t.label} ${t.note??""}`.toLowerCase().includes(r)))}get hiddenCount(){return this.secondaryLabel&&!this._more?this.options.filter(e=>e.secondary&&!this.value.includes(e.id)).length:0}emit(e){this.value=e,this.dispatchEvent(new CustomEvent("change",{detail:{value:e},bubbles:!0,composed:!0}))}toggle(e){this.disabled||(this.value.includes(e)?this.locked.includes(e)||this.emit(this.value.filter(i=>i!==e)):this.emit([...this.value,e]))}dropPick(e){!this.disabled&&!this.locked.includes(e)&&this.emit(this.value.filter(i=>i!==e))}openList(){this._open=!0}closeList(){this._open=!1,this._query=""}updated(e){this._open&&e.has("_cursor")&&this.renderRoot?.querySelector?.("li.cursor")?.scrollIntoView?.({block:"nearest"})}onKey(e){let i=this.rows;if(e.key==="ArrowDown"||e.key==="ArrowUp")this.openList(),this._cursor=Math.max(0,Math.min(i.length-1,this._cursor+(e.key==="ArrowDown"?1:-1))),e.preventDefault();else if(e.key==="Enter"||e.key===" "&&!this._query)this._open&&i[this._cursor]?this.toggle(i[this._cursor].id):this.openList(),e.preventDefault();else if(e.key==="Escape")this._open&&e.stopPropagation(),this.closeList();else if(e.key==="Backspace"&&!this._query){let t=[...this.value].reverse().find(r=>!this.locked.includes(r));t&&this.dropPick(t)}}onFocusOut(e){let i=e.relatedTarget;(!i||!this.renderRoot.contains(i))&&this.closeList()}render(){let e=this._open?this.rows:[],i=this.hiddenCount;return s`<div class="wrap" @focusout=${this.onFocusOut}>
      <div class="box" @click=${()=>this.renderRoot.querySelector("input, .pick")?.focus()}>
        ${this.summary?s`<span class="sum">${this.summary}</span>`:o}
        ${(this.summary?[]:this.value).map(t=>{let r=this.nameOf(t),a=this.locked.includes(t);return s`<span class="chip">${r}${a||this.disabled?o:s`<button type="button" aria-label=${this.removeLabel.replace("{name}",r)} @click=${l=>(l.stopPropagation(),this.dropPick(t))}>×</button>`}</span>`})}
        ${this.noSearch?s`<span class="pick" tabindex="0" role="combobox" aria-label=${this.label} aria-expanded=${this._open} aria-haspopup="listbox" aria-controls="list" @focus=${()=>this.openList()} @click=${()=>this.openList()} @keydown=${this.onKey}></span>`:s`<input
              type="text"
              role="combobox"
              autocomplete="off"
              aria-label=${this.label}
              aria-expanded=${this._open}
              aria-haspopup="listbox"
              aria-controls="list"
              placeholder=${this.value.length?this.searchLabel:this.placeholder||this.searchLabel}
              .value=${this._query}
              ?disabled=${this.disabled}
              @focus=${()=>this.openList()}
              @click=${()=>this.openList()}
              @input=${t=>{this._query=t.target.value,this._cursor=0,this.openList()}}
              @keydown=${this.onKey}
            />`}
      </div>
      ${this._open?s`<div class="pop">
            <ul id="list" class="list" role="listbox" aria-multiselectable="true" aria-label=${this.label}>
              ${e.length?o:s`<li class="empty" role="presentation">${this.emptyText}</li>`}
              ${e.map((t,r)=>{let a=this.value.includes(t.id);return s`<li
                  role="option"
                  aria-selected=${a}
                  class="${r===this._cursor?"cursor":""} ${a?"on":""}"
                  @mousedown=${l=>l.preventDefault()}
                  @click=${()=>this.toggle(t.id)}
                >
                  <span class="tick" aria-hidden="true">${a?"\u2713":""}</span><span>${t.label}</span>${t.note?s`<small>${t.note}</small>`:o}
                </li>`})}
            </ul>
            ${this.secondaryLabel?s`<label class="more"><input type="checkbox" .checked=${this._more} @change=${t=>this._more=t.target.checked} />${this.secondaryLabel}${i?s` <small>(${i})</small>`:o}</label>`:o}
          </div>`:o}
    </div>`}static styles=[h,c`
      :host {
        display: block;
        position: relative;
      }
      .box {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        box-sizing: border-box;
        min-height: 44px;
        padding: 4px 8px;
        color: var(--fp3d-text);
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        cursor: text;
      }
      .box:focus-within {
        outline: 2px solid var(--fp3d-accent);
        outline-offset: -1px;
      }
      .sum {
        font-size: 13px;
      }
      .pick {
        flex: 1 1 4em;
        min-height: 32px;
        outline: none;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        box-sizing: border-box;
        min-height: 32px;
        padding: 0 2px 0 10px;
        font-size: 13px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--fp3d-accent) 20%, transparent);
      }
      .chip button {
        position: relative;
        width: 28px;
        height: 28px;
        padding: 0;
        font: inherit;
        line-height: 1;
        color: inherit;
        background: none;
        border: 0;
        border-radius: 50%;
        cursor: pointer;
      }
      .chip button::after {
        content: "";
        position: absolute;
        inset: -8px -4px;
      }
      .chip button:hover,
      .chip button:focus-visible {
        background: color-mix(in srgb, var(--fp3d-text) 20%, transparent);
        outline: none;
      }
      input[type="text"] {
        flex: 1 1 8em;
        min-width: 6em;
        box-sizing: border-box;
        padding: 8px 2px;
        font: inherit;
        color: var(--fp3d-text);
        background: none;
        border: 0;
        outline: none;
      }
      input::placeholder {
        color: var(--fp3d-muted);
      }
      .pop {
        position: absolute;
        left: 0;
        right: 0;
        top: calc(100% + 4px);
        z-index: 20;
        background: var(--fp3d-chrome-solid);
        border: 1px solid var(--fp3d-line);
        border-radius: 10px;
        box-shadow: var(--fp3d-shadow);
      }
      .list {
        margin: 0;
        padding: 4px;
        list-style: none;
        max-height: 260px;
        overflow-y: auto;
      }
      li {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        padding: 4px 8px;
        box-sizing: border-box;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13.5px;
      }
      li small,
      .more small {
        color: var(--fp3d-muted);
        font-size: 11px;
      }
      li.cursor,
      li:hover {
        background: color-mix(in srgb, var(--fp3d-accent) 18%, transparent);
      }
      li.on {
        color: var(--fp3d-accent);
      }
      .tick {
        width: 1.2em;
        text-align: center;
      }
      li.empty {
        color: var(--fp3d-muted);
        cursor: default;
      }
      .more {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        padding: 4px 12px;
        font-size: 13px;
        border-top: 1px solid var(--fp3d-line);
        cursor: pointer;
      }
    `]};p("fp3d-multi-select",n);export{n as MultiSelect};
