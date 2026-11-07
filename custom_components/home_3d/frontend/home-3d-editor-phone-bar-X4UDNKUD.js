var f=["rect","polygon","measure","wall","opening","hole","roof"];function m(d){let{LitElement:p,html:r,css:c,nothing:n,uiIcon:l}=d;class u extends p{static properties={ed:{attribute:!1},tool:{attribute:!1},menu:{attribute:!1},canUndo:{attribute:!1},canRedo:{attribute:!1},split:{attribute:!1},wallPick:{attribute:!1},hasFloor:{attribute:!1},editable:{attribute:!1},outside:{attribute:!1},multi:{attribute:!1},lang:{attribute:!1},_focus:{state:!0}};constructor(){super(),this._focus=0,this.menu=null}t(e){return this.ed.t(e)}buttons(){let e=this.ed,o=!this.hasFloor||!this.editable,t=this.menu;return[{id:"select",icon:"pointer",label:this.t("tool_select"),pressed:this.tool==="select",disabled:!this.hasFloor,run:()=>e.phoneTool("select")},{id:"build",icon:"wall",label:this.t("tool_group_build"),pressed:f.includes(this.tool),menu:!0,open:t==="build",disabled:o,run:()=>e.openToolMenu(t==="build"?null:"build")},{id:"furniture",icon:"sofa",label:this.t("tool_furniture"),pressed:this.tool==="furniture",disabled:o,run:()=>e.phoneTool("furniture")},{id:"undo",icon:"undo",label:this.t("undo"),disabled:!this.canUndo,run:()=>e.undo()},{id:"redo",icon:"redo",label:this.t("redo"),disabled:!this.canRedo,run:()=>e.redo()},{id:"more",icon:"more",label:this.t("more"),menu:!0,open:t==="phone-more",disabled:!1,run:()=>e.openToolMenu(t==="phone-more"?null:"phone-more")}]}moreRows(){let e=this.ed,o=!this.hasFloor||!this.editable,t=()=>e.openToolMenu(null),i=[{id:"multi",icon:"pointer",label:this.t("multi_more"),sub:this.t("multi_more_sub"),checked:this.multi,disabled:o,run:()=>(t(),e.toggleMultiMode())},{id:"outside",icon:"tree",label:this.t("tool_group_outside"),sub:this.t("outside_sub"),onward:!0,disabled:o,run:()=>e.openToolMenu("outside")},{id:"energy",icon:"bolt",label:this.t("tool_energy"),disabled:o,run:()=>e.phoneTool("energy")},{id:"wall-view",icon:"wall",label:this.t("wall_view"),sub:this.t("wall_view_sub"),checked:this.wallPick,run:()=>(t(),e.toggleWallPick(this))},{id:"split",icon:this.split?"split-on":"split-off",label:this.t("split_3d"),checked:this.split,run:()=>(t(),e.toggleSplit())},{id:"fit",icon:"expand",label:this.t("fit"),run:()=>(t(),e.fit())}];return this.outside&&i.push({id:"fit-all",icon:"tree",label:this.t("fit_all"),run:()=>(t(),e.fit(!0))}),i.push({id:"help",icon:"help",label:this.t("help_and_shortcuts"),run:()=>(t(),e.setHintOff(!1),e._help=!0)},{id:"settings",icon:"gear",label:this.t("settings_home"),onward:!0,run:()=>(t(),e.openSettings("general"))}),i}stop(e){return e[this._focus]?.disabled?Math.max(0,e.findIndex(o=>!o.disabled)):this._focus}keys=e=>{let o=this.buttons(),t=o.map((a,h)=>a.disabled?-1:h).filter(a=>a>=0);if(!t.length)return;let i=t.indexOf(this.stop(o)),s=e.key==="ArrowRight"?t[(i+1)%t.length]:e.key==="ArrowLeft"?t[(i-1+t.length)%t.length]:e.key==="Home"?t[0]:e.key==="End"?t[t.length-1]:void 0;s!==void 0&&(e.preventDefault(),this._focus=s,this.updateComplete.then(()=>this.renderRoot.querySelectorAll(".bar > button")[s]?.focus()))};menuKeys=e=>{let o=[...this.renderRoot.querySelectorAll(".more [role^='menuitem']:not([disabled])")],t=o.indexOf(this.renderRoot.activeElement),i=e.key==="ArrowDown"?(t+1)%o.length:e.key==="ArrowUp"?(t-1+o.length)%o.length:e.key==="Home"?0:e.key==="End"?o.length-1:-1;i>=0&&o.length?(e.preventDefault(),o[i].focus()):e.key==="Escape"&&(e.preventDefault(),e.stopPropagation(),this.ed.openToolMenu(null),this.renderRoot.querySelector(".bar > button:last-child")?.focus())};updated(e){e.has("menu")&&this.menu==="phone-more"&&this.renderRoot.querySelector(".more [role^='menuitem']")?.focus()}renderMore(){return r`<div class="veil" @click=${()=>this.ed.openToolMenu(null)}></div>
        <div class="more" role="menu" aria-label=${this.t("more")} @keydown=${this.menuKeys}>
          <div class="grab" aria-hidden="true"></div>
          <div class="title" aria-hidden="true">${this.t("more")}</div>
          ${this.moreRows().map(e=>r`${e.id==="settings"?r`<div class="sep" role="separator"></div>`:n}
              <button
                role=${e.checked===void 0?"menuitem":"menuitemcheckbox"}
                aria-checked=${e.checked===void 0?n:e.checked?"true":"false"}
                class="row row-${e.id}"
                ?disabled=${!!e.disabled}
                @click=${e.run}
              >
                ${l(e.icon)}
                <span class="l">${e.label}${e.sub?r`<small>${e.sub}</small>`:n}</span>
                ${e.checked!==void 0?r`<span class="sw ${e.checked?"sw-on":""}" aria-hidden="true"></span>`:e.onward?l("right"):n}
              </button>`)}
        </div>`}render(){let e=this.buttons(),o=this.stop(e);return r`${this.menu==="phone-more"?this.renderMore():n}
        <div class="bar" role="toolbar" aria-label=${this.t("tools")} @keydown=${this.keys}>
          ${e.map((t,i)=>r`<button
              class="btn-${t.id} ${t.pressed||t.open?"on":""}"
              tabindex=${i===o?0:-1}
              aria-pressed=${t.menu||t.pressed===void 0?n:t.pressed?"true":"false"}
              aria-haspopup=${t.menu?"menu":n}
              aria-expanded=${t.menu?t.open?"true":"false":n}
              ?disabled=${t.disabled}
              @focus=${()=>this._focus=i}
              @click=${t.run}
            >
              ${l(t.icon)}<span>${t.label}</span>
            </button>`)}
        </div>`}static styles=c`
      :host {
        display: block;
        position: relative;
        z-index: 26;
        color: var(--fp3d-text);
        font-family: var(--fp3d-font, inherit);
      }
      .bar {
        position: relative;
        z-index: 2;
        display: flex;
        height: 60px;
        /* the safe area under the bar (the editor works it out: --fp3d-bar-h is 60 px plus it, at least 16 px) */
        padding-bottom: calc(var(--fp3d-bar-h, 76px) - 60px);
        background: var(--fp3d-chrome-solid, #0d1628);
        border-top: 1px solid var(--fp3d-line, rgba(120, 190, 255, 0.22));
      }
      .bar > button {
        flex: 1 1 0;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        padding: 0 2px;
        border: 0;
        background: none;
        color: var(--fp3d-muted, #94a3b8);
        font: inherit;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .bar > button > span {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bar > button .fp3d-ui-icon {
        width: 22px;
        height: 22px;
      }
      .bar > button.on {
        color: var(--fp3d-accent, #48cdeb);
      }
      .bar > button:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .bar > button:focus-visible,
      .row:focus-visible {
        outline: 2px solid var(--fp3d-accent, #48cdeb);
        outline-offset: -3px;
      }
      .veil {
        position: fixed;
        inset: 0;
        z-index: 0;
        background: rgba(2, 6, 14, 0.45);
      }
      .more {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 100%;
        z-index: 1;
        max-height: 72vh;
        overflow-y: auto;
        padding-bottom: 6px;
        background: var(--fp3d-chrome-solid, #0d1628);
        border-top: 1px solid var(--fp3d-line, rgba(120, 190, 255, 0.22));
        border-radius: 14px 14px 0 0;
        box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.5);
      }
      .grab {
        width: 40px;
        height: 4px;
        border-radius: 2px;
        background: #475569;
        margin: 8px auto 4px;
      }
      .title {
        padding: 2px 16px 4px;
        font-size: 11.5px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--fp3d-muted, #94a3b8);
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        min-height: 48px;
        padding: 10px 16px;
        border: 0;
        border-bottom: 1px solid var(--fp3d-line, rgba(120, 190, 255, 0.22));
        background: none;
        color: inherit;
        font: inherit;
        font-size: 14px;
        text-align: left;
        cursor: pointer;
      }
      .row:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .row .fp3d-ui-icon {
        flex: none;
        width: 20px;
        height: 20px;
      }
      .l {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      small {
        color: var(--fp3d-muted, #94a3b8);
        font-size: 12px;
      }
      .sep {
        height: 6px;
      }
      .sw {
        flex: none;
        position: relative;
        width: 36px;
        height: 20px;
        border-radius: 999px;
        background: #334155;
      }
      .sw::after {
        content: "";
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #e2e8f0;
        transition: left 0.15s;
      }
      .sw-on {
        background: var(--fp3d-accent, #48cdeb);
      }
      .sw-on::after {
        left: 18px;
      }
      @media (prefers-reduced-motion: reduce) {
        .sw::after {
          transition: none;
        }
      }
      @media (forced-colors: active) {
        .bar > button.on,
        .sw-on {
          outline: 2px solid CanvasText;
        }
      }
    `}return d.defineElement("fp3d-phone-bar",u),u}export{f as BUILD_TOOLS,m as definePhoneBar};
