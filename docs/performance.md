# Performance: editor and tablet lag (spike #97)

Measured 30 Oct 2026 on a live Home Assistant install. HA was running the issue-111 build (core pack split, about `63b3083`); this file sits on `integration` @ `0d8ac43`. It was a read-only run: no deploy, no restart, no building saved. No home was changed.

This is the first measured baseline. Earlier notes have no numbers, only the sample home review's "UI feedback lags about 2 s", which was never checked outside the automation browser. Later speed checks should be compared against the tables below.

## Method

- **Browser:** the built-in browser pane (Chromium 152) on the desktop: 24 cores, a 240 Hz display (one rAF is about 4.2 ms) and a desktop GPU. The tab was emulated at 1280 x 800 CSS px at DPR 1, which is the assumed wall-tablet size, and the pane was in front. Two homes were used: **Large home** (~500 items, ~1.1 MB building) and **Sample home** (~110 items, ~245 KB). HA has about 4,900 entities in `hass.states`.
- **Timing:** everything was timed from page JS with `performance.now()`. Each measure starts when the event is dispatched. It ends when the editor's Lit `updateComplete` resolves and a task is posted from the next `requestAnimationFrame` ("to paint"). The editor's own methods (`update`, `render`, `renderSide`, `entityOptions`, `updated`, `change` ...), the view3d methods and the `FloorplanViewer` methods were wrapped with timers to split the cost. The wrappers were removed for the headline selection run. Long Animation Frames (`long-animation-frame` observer) gave long tasks and their invokers.
- **Input:** plan presses, moves and typing were synthetic `PointerEvent`, `InputEvent` and `KeyboardEvent`s dispatched on the plan SVG or the field, so they ran through the editor's real handlers.
- **Safety:** during the editor runs, `home_3d/building/save` was blocked at the websocket, and `building-changed` was stopped at the panel. Edits stayed local, were undone, and the document was compared with the one before.
- **Repeats:** each measure ran at least 5 times; most ran 15 to 150 times. The tables show **median / worst**.
- **CPU throttling was not available.** The pane offers viewport size and colour scheme only, with no DevTools protocol, and signing a separate automation browser in to HA was not allowed. So the **4x and 6x columns are estimates**: the 1x time to paint multiplied by 4 or 6. That is roughly what DevTools CPU throttling does to main-thread work. It ignores GPU and network time and hides nothing.
- **A budget wall tablet (Fire HD 10 class)** is roughly a 4x to 6x slower CPU and a far weaker GPU. On it, Auto quality resolves to **low**, because `isLowEnd()` matches the `KF..`/Silk user agent, and sensor-only 3D syncs are paced to one every 2 s (`lowSyncDelay`).

## Budget

The budget is **under 100 ms from a selection press to the updated panel**.

## Results

### Selection: press an item, panel updated and painted

| Home | 1x median / worst | 4x est. | 6x est. |
|---|---|---|---|
| sample home (20 presses, no wrappers) | 62 / 87 ms | 250 / 347 ms | 374 / 520 ms |
| Home (20 presses, no wrappers) | 62 / 166 ms | 250 / 664 ms | 374 / 996 ms |
| sample home (15, instrumented) | 71 / 97 ms | 284 / 389 ms | 427 / 583 ms |
| Home (15, instrumented) | 103 / 227 ms | 410 / 908 ms | 615 / 1362 ms |

Within budget at 1x on median. **Over budget at 4x and 6x on both homes**, and over budget on Home's worst case even at 1x.

Where the time goes in one selection (sample home, median of 8):

| Cost | Time |
|---|---|
| `render()` | 25 ms |
| `renderSide` -> `renderFurnitureForm` | 24 ms |
| `entityOptions` (the entity lists of the item's link pickers) | **21 ms** |
| `updated()`: forced layout from the `.fp3d-side` scrollTop reset (#71) and the `select option[selected]` loop | 20 ms |
| Plan SVG (`renderFurniture`, `renderOpenings`, walls, rooms) | under 2 ms together |
| `pointerDown`, `pickItem` (#72), `selectItem` (#56) | under 0.3 ms |

The plan SVG is cheap. The item form, mostly its entity option lists, and the forced layout make up the cost.

### Background load while nothing happens (10 s, editor open, 3D beside on)

| State | Editor renders | Editor render time | `entityOptions` | 3D `syncDevices` | Long frames |
|---|---|---|---|---|---|
| Home, item selected | 4.9 /s | **168 ms/s** | 106 ms/s | 96 ms/s | 258 ms/s, worst 275 ms |
| Home, nothing selected | 1.8 /s | 8 ms/s | 0 | 30 ms/s | 46 ms/s, worst 101 ms |
| Sample, item selected | 4.2 /s | 81 ms/s | 64 ms/s | 5 ms/s | 5 ms/s |
| Sample, nothing selected | 2.2 /s | 5 ms/s | 0 | 2 ms/s | 0 |

Every `hass` update (several a second) re-renders the whole editor. With an item open, each render rebuilds and sorts the entity option lists over all ~4,900 states. The `_optionsMemo` WeakMap is keyed on the filter closure, and that closure is new on every render, so it never hits. On the large home with an item selected, **about 26% of the main thread is busy at 1x with no input at all**. At 4x that is about 100%, so input queues behind it. This is the best candidate for the "about 2 s lag" in the review.

View mode (no editor), Home: `syncDevices` ran 20 times in 10 s, 16 ms on average and 83 ms at worst, plus `trailNow` and `detectionPins` at about 20 ms each. That gave 3 frames over 100 ms in 10 s. Desktop syncs on every sensor tick; only the low tier paces them.

### Typing in a number field (X of an item)

| Home | Keystroke to paint | Commit (Enter) to paint | Longest frame in the 700 ms after the commit |
|---|---|---|---|
| sample home | 4.5 / 5.9 ms | 36 / 47 ms | 124 / 137 ms (3D-beside rebuild 79 ms) |
| Home | 5.8 / 6.9 ms | 52 / 897 ms | **581 / 643 ms** |

Keystrokes are cheap: `TypedCommit.input` doesn't re-render. Each commit sets a new document. After the 150 ms `queue3d` debounce, the 3D-beside view runs a full `FloorplanViewer.rebuild` (410 to 545 ms on Home) plus `syncDevices` (about 150 ms). The page freezes for about 0.6 s after every typed value, every nudge and every drop. At 4x to 6x that is 2.3 to 3.9 s.

### Drag an item (30 moves x 5 drags)

| Home | Move to paint | About | Longest frame after the drop |
|---|---|---|---|
| sample home | 38 / 561 ms (one outlier) | 26 fps | 134 / 165 ms |
| Home | 53 / 172 ms | 19 fps | **632 / 711 ms** |

Per move on Home: 26 ms of editor render, 22 ms of it the item form (16 ms `entityOptions`), and 8 ms of `change()`, which `structuredClone`s the whole 1 MB building on every pointermove. At 4x a drag runs at about 5 fps. The 3D view isn't rebuilt during the drag (debounced), only after the drop.

### Doors & windows tool hover (#62), 40 moves across the house

| Home | Select tool, move to paint | Doors & windows tool, move to paint | Handler only |
|---|---|---|---|
| sample home | 4.2 / 4.4 ms | 5.9 / 7.4 ms | under 1 ms |
| Home | 11 / 33 ms | **36 / 125 ms** | 3.3 / 6.6 ms (`hoverOpening` 0.5 ms) |

The nearest-wall and `generateWalls` work per mousemove is cheap (0.5 ms). The cost comes from the whole editor re-rendering whenever the hover hint text changes.

### Library search per keystroke (#78)

1,535 entries; 43 keystrokes over "sofa", "double bed", "smoke alarm", "radiatr", "bambu x1c" and "tv".

| Run | Keystroke to paint | Library `render` |
|---|---|---|
| Editor on the large home | 30 / 180 ms | 4.2 / 17.9 ms |
| Editor on sample home | 14 / 203 ms | not measured |

Ranking and fuzzy matching are cheap. The worst cases are the first letters (many cards to lay out) and keystrokes that land on a `hass` re-render.

### Editor open (View -> Editor tab, 3D beside on)

| Home | Ready (plan painted) | Settled (no long frames) |
|---|---|---|
| Home, first open (editor bundle from cache) | 895 ms | 1,676 ms |
| Home, again x5 | 946 / 1,213 ms | 1,956 / 2,308 ms |
| sample home x5 | 279 / 412 ms | 279 / 412 ms |

On the large home the first frame is one ~650 ms task. The new 3D-beside viewer's `rebuild` takes 390 ms and two `syncDevices` calls take 96 ms each. The editor's own first render is about 30 ms.

### Panel load (/home_3d, View tab, Home, 1280 x 800)

| Load | Building arrived | First 3D frame | Settled | Total blocking |
|---|---|---|---|---|
| Warm (service worker active) x5 | 1.0 to 2.1 s | 2,106 / 2,132 ms | 2,108 / 2,635 ms | 1.1 to 1.5 s |
| Cold (service worker unregistered, Cache Storage cleared) x5 | 1.8 to 2.0 s | 1,922 / 2,021 ms | 1,919 / 2,018 ms | 1.06 to 1.14 s |

- **The cold row isn't network-cold.** The browser's HTTP disk cache can't be cleared from the page, so all bundles came from it (transferSize 0), and cold and warm load alike.
- **Network on top.** Fetching a bundle with `cache: "no-store"` took `home-3d.js` (769 KB, 250 KB gzip) 59 / 212 ms and `home-3d-3d.js` (867 KB, 268 KB gzip) 58 / 206 ms. `packs/list` is 525 KB in 48 ms (#111). `building/get` takes 74 ms for the large home (~1.1 MB) and 36 ms for sample home (245 KB).
- **One long task.** Every load had a single ~1.0 s task (websocket message -> building -> 3D build -> device sync) before the first 3D frame.

Switching homes in the same page:

| Switch | Data | Longest task | Settled |
|---|---|---|---|
| To Home x5 | 1,629 / 1,690 ms | 1,363 / 1,458 ms | 3,827 / 4,185 ms |
| To sample home x5 | 625 / 663 ms | 566 / 591 ms | 1,683 / 3,051 ms |

A switch to Home runs `viewer.rebuild` 3 times (896 ms: `setBuilding` plus a `setPacks` rebuild) and `syncDevices` 8 times (1,037 ms).

### 3D frame cost per look and quality

One forced `render()` plus a 1-pixel `readPixels`, so CPU and GPU together, 40 frames each, 1224 x 680 canvas at DPR 1. The columns are frame median / worst and theme switch + first frame (shader compile).

Home (~374k triangles):

| Quality | Neon | Day | High contrast | Realistic |
|---|---|---|---|---|
| Auto (desktop = normal) | 2.8 / 5.9 ms, switch 112 ms | 4.2 / 10.1 ms, switch 506 ms | 2.7 / 4.2 ms, switch 502 ms | 6.6 / 10.4 ms, switch **1,346 ms** |
| Low | 1.3 / 2.0 ms, switch 472 ms | 1.2 / 2.4 ms, switch 356 ms | 1.2 / 3.3 ms, switch 413 ms | 3.2 / 4.8 ms, switch 1,292 ms |
| High | 2.9 / 5.8 ms, switch 579 ms | 3.0 / 4.6 ms, switch 416 ms | 2.6 / 3.9 ms, switch 498 ms | 4.2 / 7.6 ms, switch 531 ms |

sample home (~86k triangles):

| Quality | Neon | Day | High contrast | Realistic |
|---|---|---|---|---|
| Auto | 2.2 / 6.8 ms, switch 85 ms | 2.1 / 2.6 ms, switch 80 ms | 2.2 / 4.7 ms, switch 82 ms | 3.6 / 6.2 ms, switch 177 ms |
| Low | 1.2 / 3.4 ms, switch 163 ms | 1.2 / 2.0 ms, switch 76 ms | 1.2 / 2.4 ms, switch 66 ms | 1.7 / 2.8 ms, switch 175 ms |
| High | 1.9 / 5.3 ms, switch 166 ms | 1.7 / 3.1 ms, switch 88 ms | 1.8 / 6.6 ms, switch 82 ms | 3.3 / 5.7 ms, switch 172 ms |

- **Frames.** Steady frames are cheap on a desktop GPU, and the new theme shaders (#85 to #88) add no measurable per-frame cost here. Realistic is the most expensive look, at 1.5x to 2.5x Neon and with extra geometry on Auto/High.
- **Switches.** A look or quality switch compiles shaders (up to 1.3 s for Realistic on Home), and `setQuality` builds a new WebGL context (80 to 136 ms).
- **On the tablet**, Auto = Low, so expect Low-row costs times a big GPU factor. That can't be estimated from here.
- **Per-frame CPU in View mode on Home:** `viewer.render` takes 3.4 ms per frame, 1.5 ms of it `stepOpenings`.

## Over budget (proven)

1. **Selection:** at 4x and 6x on both homes (250 to 1,000 ms against 100 ms), and on Home's worst case at 1x (166 to 227 ms).
2. **Idle background re-renders:** with an item open on Home, about 26% of the main thread at 1x, which saturates it at 4x.
3. **3D-beside full rebuild after every edit or drop:** 0.6 s freeze on the large home at 1x, about 2.4 to 3.6 s at 4x to 6x.
4. **Drag on Home:** about 19 fps at 1x, about 5 fps at 4x.
5. **Panel load and home switch:** a single 1.0 to 1.45 s main-thread task on Home, about 4 to 6 s at tablet speed.
6. **Doors & windows hover on Home:** 125 ms worst at 1x.
7. **Library first keystrokes:** 180 to 200 ms worst at 1x.

## Proven lag -> proposed fix tickets

1. **Cache the entity option lists across editor renders.** `entityOptions` memoises on the filter closure, which is new on every render, so all ~4,900 states are filtered and sorted again on every render (21 of 25 ms per selection, 106 ms/s idle on Home). Key the memo on a stable filter id plus the `hass.entities` and states-count snapshot, or build the lists once per registry change.
2. **Stop re-rendering the whole editor on every `hass` update.** Each state change re-renders plan and panel together (168 ms/s on the large home with an item open). Split the item form into child components (`shouldUpdate` on their own watched entity ids), and keep `hass` out of the plan's render path.
3. **Update the 3D-beside view incrementally instead of a full rebuild per edit.** Every committed edit, nudge or drop calls `FloorplanViewer.setBuilding` -> `rebuild`: 410 to 545 ms on the large home plus `syncDevices` about 150 ms. Diff the plan and rebuild only the changed item, opening or room, or rebuild in idle slices.
4. **Pace and narrow view3d `syncDevices` on every tier.** On desktop each sensor tick runs a full sync (16 ms average, 83 to 130 ms worst on Home, 2 to 5 times a second). Use the 2 s sensor-only pacing for all tiers, or update only the changed entities' markers, labels and cards (`detectionPins`, `trailNow` about 20 ms each).
5. **Split the building load and home switch into frames, and drop the duplicate rebuilds.** Load is one ~1.0 s task and a switch to Home one 1.36 s task. A switch rebuilds the scene 3 times (`setBuilding` plus a `setPacks` rebuild). Build once, per floor across frames, current floor first.
6. **Remove the forced layout in the editor's `updated()` on selection.** The `.fp3d-side` scrollTop reset (#71) and the `select option[selected]` pass force a synchronous layout of 20 to 30 ms per selection. Run the reset only when scrollTop > 0, and run the option fix only for the selects that changed.
7. **Make drag moves cheap.** Each pointermove `structuredClone`s the whole building (8 ms on Home) and re-renders the item form (22 ms). Clone only the affected floor or item while dragging, and freeze the side panel until the drop.
8. **Doors & windows hover hint without a full editor render.** The hint text change on mousemove (#62) re-renders the editor (36 ms median, 125 ms worst on Home). Keep `_openingHover` out of reactive state and write the hint into a small child element.
9. **Precompile look shaders and ease look and quality switches.** A look switch compiles shaders for up to 1.3 s (Realistic on Home), and a quality switch makes a new WebGL context. Use `renderer.compileAsync` before the swap, show a short "Switching look" state, and keep the old frame until the new one is ready.
10. **Smooth the library's first keystrokes.** The median keystroke is fine (14 to 30 ms), but one- and two-letter queries reach 180 to 200 ms laying out many cards. Debounce about 80 ms, or cap or virtualise the result cards until 3 letters are typed.

## Not measured (limits)

- **A real wall tablet.** All 4x and 6x figures are scaled estimates; real numbers need the device. The tablet's GPU can't be estimated from a desktop GPU at all.
- **Real CPU throttling:** not available in the built-in browser pane.
- **Network-cold load:** the HTTP disk cache can't be cleared from the page. The bundle fetch times above are the network part.
- **Trusted input via the Event Timing API:** the pane was 229 px wide, so coordinate clicks on the scaled 1280 x 800 page weren't reliable. All input was synthetic events through the real handlers.
- **Phone (#93 and #94) and touch long-press paths.**

## Racks (#121)

Measured 30 Oct 2026, before (integration @ `29a6b81`) and after the #121 change, on the same local plan. No Home Assistant was involved.

### What changed

- **One geometry per rack, not part of the floor's.** A rack's gear used to be drawn into the floor's walls geometry, so it was built with every floor rebuild and drawn twice (the wall pass and the glass-wall pass). Now the floor build leaves it out (`build.ts` `FloorGeometry.racks`), and the viewer gives each rack its gear as one mesh plus one set of edges (`buildRackGear`).
- **Full detail only near the camera.** Further away, each piece of gear is one plain box in its biggest front part's colour, about 12 triangles a piece ("slab", `furniture.ts gearSlab`). The full detail is built the first time the camera comes within 6 m (3.6 m on the tablet level) and kept until the next rebuild. It turns back into slabs past 7 m (4.2 m on the tablet level). The distances are constants in `viewer/rack-lod.ts`. The status LEDs (#119) are unchanged and show on both.
- **Taps** hit the gear mesh as part of the rack, so the gear under the tap still opens (`pick`, `furnitureAt`).
- **Part limits** are unchanged. Gear stays as separate pack items, each under the 60-part cap. A rack holds at most 60 slots. In slab form a full rack costs about 12 triangles per slot, however detailed its gear's recipes are.

### Method

- **Browser:** headless Edge (Chromium) through puppeteer on the same desktop: RTX 3080 over D3D11, a 1280 x 800 page at DPR 1 and a 1224 x 680 canvas. This time **real CPU throttling** was used (DevTools `Emulation.setCPUThrottlingRate` 4x), not the 1x times multiplied by 4.
- **Plan:** a local harness plan with 5 rooms, 60 ordinary items, a **42U floor cabinet holding 40 devices** and a **9U wall cabinet holding 6**. The devices are real `amluto.it/network` ids (#117): UDM Pro Max, USW Pro 48 / Max 48 / HD 24 / XG 24, UNVR (Pro), servers, NAS units, UPSs, PDUs (two 0U lanes), patch, brush and blanking panels, cable managers, two half-width units side by side, and one rear-face panel. Half of the slots are linked, so they get LEDs. `rackMisfits` was empty for both racks.
- **Measures**, as in #97: floor build (`buildFloorGeometry`, 15 times), the whole `setBuilding` rebuild (8 times), and frame time as one `render()` plus a 1-pixel `readPixels`, 40 frames after 15 warm-up frames. Frames were taken near the rack (1.6 m), mid-room (5.7 m) and from across the house (20 m). Draw calls and triangles come from `renderer.info`. Also measured: a 3D tap on the rack (`pick` + `rackHit`, 30 times), a 3D selection plus a frame (20 times), and the editor selection with 3D beside on (a press on the rack in the plan, timed to the updated panel painted, 20 presses alternating with a sofa). Each run was repeated 3 times at 1x and 2 times at 4x. The tables show **median / worst**.
- An "empty racks" plan (the same racks with no gear) gives the floor's own cost.

### Results at 1x

| Measure | Empty racks | Before | After |
|---|---|---|---|
| Floor build | 6.0 / 23 ms | 12.7 / 32 ms | **6.4 / 23 ms** |
| `setBuilding` (whole rebuild) | 10.9 / 19 ms | 15.5 / 28 ms | **11.6 / 22 ms** |
| First approach (detail built once) | - | - | 7.3 ms |
| Triangles drawn, near / far | 13,546 | 27,974 / 27,974 | **20,898 / 14,390** |
| Draw calls, near / far | 8 / 10 | 9 / 11 | 13 / 15 |
| Frame near the rack | 0.5 / 1.0 ms | 0.5 / 2.4 ms | 0.7 / 1.9 ms |
| Frame from across the house | 0.5 / 0.8 ms | 0.5 / 3.6 ms | 0.5 / 1.6 ms |
| 3D tap on the rack | 0.2 / 2.5 ms | 0.5 / 2.5 ms | 0.3 / 2.9 ms |
| 3D selection + frame | 2.4 / 7.0 ms | 2.5 / 7.7 ms | 2.3 / 8.6 ms |
| Editor: select the rack | 6.6 / 12 ms | 13.3 / 30 ms | 13.6 / 27 ms |
| Editor: select another item | 6.5 / 54 ms | 6.8 / 43 ms | 6.8 / 39 ms |

### Results at 4x CPU throttling

| Measure | Before | After |
|---|---|---|
| Floor build | 60 / 170 ms | **32 / 124 ms** |
| `setBuilding` (whole rebuild) | 78 / 127 ms | **58 / 122 ms** |
| First approach (detail built once) | - | 29 ms |
| Frame near the rack | 2.2 to 4.2 / 8.3 ms | 1.4 to 2.4 / 3.8 ms |
| Frame from across the house | 1.9 to 2.2 / 4.7 ms | 1.3 to 2.1 / 3.0 ms |
| 3D tap on the rack | 2.5 / 13 ms | 1.5 / 12 ms |
| 3D selection + frame | 7.0 / 14 ms | 5.6 / 11 ms |
| Editor: select the rack | 76 / 150 ms | 77 / 163 ms |
| Editor: select another item | 37 / 275 ms | 38 / 240 ms |

### Findings

- **Build:** the 46 devices now add about 0.4 ms at 1x to the floor build and to every rebuild (before: 6.7 ms at 1x; at 4x a floor build went from 60 to 32 ms). That cost is paid on every 3D-beside rebuild after an edit (#97 over-budget item 3). The detail costs about 7 ms at 1x (29 ms at 4x) once, when the camera first comes near.
- **GPU:** from across the house the full rack draws 844 triangles instead of 14,428, about 6% of before. Near it, the detail is 7,350 triangles, about half of before, because the walls' glass pass no longer draws it a second time. Each rack adds 2 draw calls (its gear and its edges). On a desktop GPU the frame time doesn't change in a way that can be measured (well under 1 ms either way). The tablet's GPU can't be measured from here.
- **Selection:** the 3D tap and 3D selection are unchanged. Selecting the rack in the editor stays about 2x an ordinary item (13 ms against 7 ms at 1x, 77 ms against 38 ms at 4x), before and after. That cost is the item panel: the rack's form and its front elevation SVG (#115/#119). It is not the 3D, and it is a candidate for its own ticket.
- **Hot path:** the floor build (`buildFloorGeometry`) and the 3D frame (`updateRackDetail` runs before every frame, a few distance checks per rack).

### Not measured (still to measure)

- A real wall tablet and its GPU, and the live Home with a real rack:.
- How the slab looks against the detail at the switch distance: checked by eye in the harness on the desktop only.

## Editor renders and selection (#130)

Measured 30 Oct 2026, before (integration @ `b650ade`) and after the #130 change, on the same local plan. No Home Assistant was involved and nothing was saved.

### What changed

- **Entity lists are kept.** The link pickers' entity lists (`entity-options.ts`) are made once per list and kept until an entity comes or goes or the entity, device or area registry changes. A list is named by its filter's source plus whatever the filter captures, so a filter closure made anew on every render still finds its list. What "automatic" would link (it clones the plan's floors and searches every entity) is kept per plan and registry the same way.
- **A state change renders only what it touches.** While the editor renders, it notes which states it reads (`hass-watch.ts`). A new `hass` that changes only states the last render did not read skips the render; a 3D view inside the editor still gets the new `hass`. The plan still renders again when, say, a lamp on it switches, and a registry, language or user change always renders.
- **Drags copy one floor.** A drag (item, block, resize, rotate, door or window, wall, device pin) copies only the floor being edited on each pointer move. The other floors, the settings and the plan's recipe copies are shared.
- **Doors & windows hover.** The hint text is written straight into the hint bar, the tool no longer keeps a cursor point it never draws, and a snap guide that comes out the same doesn't render the plan again.
- **Rack front view.** The rack's front view in the item panel is one picture of the drawing, with an empty box over each piece of gear that carries its name as a tooltip. Drawn inline, it was hundreds of SVG elements to style and lay out on every rack selection.

### Method

- **Browser:** headless Edge (Chromium) through puppeteer, a 1280 x 800 page at DPR 1, with **real CPU throttling** (DevTools `Emulation.setCPUThrottlingRate` 4x) as in #121. The "4x est." column is the 1x time multiplied by 4, as in #97.
- **Plan:** a local harness with a synthetic plan: 2 floors of 16 rooms, 501 items (a third linked to entities, every lamp linked to a light), 64 doors and windows, 120 placed device pins, a **42U floor cabinet holding 40 devices** (half linked), and recipe copies, about 0.9 MB in all. The fake `hass` has 5,037 entities across 16 domains, a device and area registry and 30 areas. The 3D pane beside the plan was off, so the numbers are the editor alone.
- **Measures**, timed from page JS as in #97 (event dispatched to `updateComplete` plus a task after the next `requestAnimationFrame`): selection by a plan press, 30 presses each alternating a linked item, the rack and a plain item without links; background load as 5 `hass` updates a second for 5 s with an item selected and with nothing selected (one random state changes in each); 5 drags of 30 moves; 40 mouse moves in the select tool and in Doors & windows. The machine was busy with other work, so before and after ran alternately, twice each. The tables show **median / worst**, the two runs as a range.

### Results

| Measure | Before 1x | After 1x | Before 4x | After 4x | After 4x est. |
|---|---|---|---|---|---|
| Select a linked item | 36 to 41 / 88 ms | **18 to 19** / 128 ms | 241 to 263 / 707 ms | **116 to 140** / 949 ms | 72 to 77 ms |
| Select a plain item | 20 to 21 / 35 ms | **14 to 15** / 25 ms | 127 to 132 / 196 ms | **94 to 112** / 162 ms | 54 to 59 ms |
| Select the rack | 30 to 34 / 55 ms | **18 to 20** / 67 ms | 189 to 224 / 373 ms | **137 to 162** / 380 ms | 74 to 81 ms |
| Editor renders, item selected, 5 updates/s | 5 /s, 118 to 129 ms/s | **0.8 /s, 5 to 6 ms/s** | 4.6 /s, 621 to 647 ms/s | **0.8 /s, 25 to 26 ms/s** | |
| Editor renders, nothing selected | 5 /s, 15 to 19 ms/s | **0.8 /s, 3 to 4 ms/s** | 2.8 /s, 58 to 61 ms/s | **0.8 /s, 17 to 18 ms/s** | |
| Drag, move to paint | 46 to 47 / 69 ms | **30 to 31** / 47 ms | 256 to 266 / 995 ms | **149 to 160** / 264 ms | |
| Doors & windows hover, move to paint | 8.5 to 8.6 / 26 ms | 7.7 to 8.3 / 24 ms | 34 to 54 / 90 ms | **21 to 25** / 78 ms | |
| Select-tool hover (no change expected) | 6.1 / 12 ms | 6.0 / 16 ms | 6.0 to 6.3 / 14 ms | 6.0 to 6.1 / 11 ms | |

At 4x with an item selected, before, long tasks took 662 to 688 ms of every second with no input at all. After, they take 11 ms/s. The renders left (0.8 a second) are the ones whose states are on the plan, such as a lamp that switched or a device pin's state.

The worst linked selection (128 ms at 1x, 949 ms at 4x) is the first selection after the lists were dropped: it builds every entity list of that item's form once. The next selections of any item reuse them.

Where a selection's time goes now, at 4x (median of 12):

| Item | `update()` (render) | `updated()` (layout forced by the scroll reset) | Frame (style, layout, paint) | Total |
|---|---|---|---|---|
| Linked, before | 153 to 159 ms | 35 to 37 ms | 40 to 49 ms | 241 to 245 ms |
| Linked, after | 49 to 53 ms | 40 to 44 ms | 51 to 52 ms | 148 to 152 ms |
| Plain, after | 25 to 29 ms | 24 to 28 ms | 44 to 46 ms | 102 to 105 ms |
| Rack, before | 82 to 90 ms | 51 ms | 55 to 58 ms | 188 to 208 ms |
| Rack, after | 36 to 45 ms | 31 to 41 ms | 47 to 53 ms | 121 to 146 ms |

### Findings per point

1. **Entity lists: fixed.** The lists took most of a linked item's render (`entityOptions` 14 of 31 ms at 1x). After, a selection takes 3 ms for the lists, and 0 when they are already kept.
2. **Re-render on every `hass` update: fixed.** It now renders 0.8 times a second instead of 5, and with an item selected it spends 5 ms/s on renders instead of 120 ms/s at 1x. The item form wasn't split into child components: noting the states each render reads covers the plan and the panel together and changes no markup.
3. **Forced layout on selection (#71 scroll reset, `select option[selected]` pass): not worth it.** Without the scroll reset, `updated()` drops to 1 to 2 ms, but the frame's own layout grows by the same amount, and the total stayed the same (165 against 162 ms linked, 124 against 105 ms plain, at 4x). The layout is the new panel's, and it has to happen once anyway. The option pass costs about 2 ms at 4x. Both are unchanged.
4. **Drag clones the whole plan: fixed.** A move now copies one floor and takes 30 ms at 1x instead of 47. At 4x the median is 149 to 160 ms (was 256 to 266) and the worst is 264 ms (was 995). The side panel still follows the drag, so X and Z update live.
5. **Doors & windows hover hint: fixed.** At 4x a hover takes 21 to 25 ms (was 34 to 54). At 1x it was already cheap on this plan (8 ms). A snap guide that really moves still renders the plan, as before.
6. **Rack selection: fixed.** Before, the rack cost 1.5 to 1.7x a plain item. It now costs the same as a linked item (18 to 20 ms against 18 to 19 at 1x) and about 1.3x a plain item that has no links. The rest is the rack form's own fields, such as the frame choice and the gear list.

**Budget:** by #97's 4x estimate, every selection is now under 100 ms (54 to 81 ms). With real 4x throttling on a busy desktop, a plain item is at about 100 ms, and linked items and the rack are at 116 to 162 ms. What's left is mostly the browser's style, layout and paint of the new panel (about 70 to 90 ms of it at 4x). `contain` on the side panel and the plan made no difference to that.

### Not measured (still to measure)

- A real wall tablet, and the live large home with its real entities and rack.
- The 3D pane beside the plan (#131 changes how it updates).

## 3D: incremental updates, paced syncs, faster loads (#131)

Measured 30 Oct 2026, before (integration @ `b650ade`) and after the #131 change, on the same local plans. No Home Assistant was involved.

### What changed

- **3D beside after an edit (#97 item 3).** An edit no longer rebuilds the whole scene. A floor whose drawing inputs are unchanged keeps its meshes, labels and lights (`viewer/floor-keys.ts`). On a floor that is rebuilt, every item drawn exactly as in the last build is copied from that build instead of being modelled again (`build.ts` furniture cache, copied as typed-array chunks by `GeoBuffer.append`). The light surface is kept while rooms, walls and openings stay the same. Packs, parked cars, a new look and a new quality still rebuild every floor.
- **Sensor syncs (#97 item 4).** If only measured values changed, the 3D view syncs at most once a second on every device. The tablet level keeps its 2 s (`pace.ts sensorSyncDelay`). A switch, door or alarm still shows at once. With this pacing, the rest of a sync costs a few ms, so narrowing it further was not worth it.
- **Load and home switch (#97 item 5).** New packs, parked cars and the plan, when handed over in one view update, rebuild the scene once (`Viewer.batch`, `viewer/rebuild-batch.ts`). Before, a home switch built the scene three times and synced devices three times. A new home is built one floor per frame, starting with the open floor or the ground floor (`viewer/floor-order.ts`). Its shaders compile with `compileAsync` before the first frame. The view refits once the last floor of the first plan is in, unless it has been moved.
- **Look and quality switches (#97 item 9).** A look switch rebuilds only between neon and the light looks, and only floors with items in colours of their own. The cache keeps both looks' copies of those items. The realistic look compiles its lit shaders in the background and keeps the last frame meanwhile. A new quality's renderer compiles before it takes over the canvas. Floor pictures wait until the viewer is no longer busy.
- **Library (#97 item 10).** Cards out of view are not laid out or painted (`content-visibility: auto`). A card without a picture is asked for again through the IntersectionObserver, instead of measuring every card on each render (a forced layout). The search index is warmed in slices before the first keystroke (`warmIndex`).
- **Racks.** A tap on a glass or mesh door's rim or bars goes on along the ray to the first gear behind it (`rack.ts rackTapSlot`). A solid door, the side panels and the roof still keep the tap.

### Method

- Headless Edge (Chromium) through puppeteer, as in #121: desktop GPU over D3D11, a 1280 x 800 page at DPR 1, a 1224 x 680 canvas. Real CPU throttling (DevTools `Emulation.setCPUThrottlingRate` 4x).
- A local harness mounts `<fp3d-view3d>` with a fake `hass` (4,900 states) and generated plans. The **large plan** has 2 floors, 32 rooms and 514 items (about 660 KB): pack items from the bundled packs, a ceiling light and a radiator per room, 15% of the items linked, a 42U mesh-door cabinet with 20 devices and a 9U glass-door cabinet with 4. The **small plan** has 2 floors, 18 rooms and 126 items. The floor ids differ between the two plans, as between real homes.
- **Edit:** 12 edits, each a new document (structured clone) with one item moved, as the editor hands it to 3D beside. Timed to the view updated and to the next paint, plus the longest frame in the 400 ms after. **Ticks:** 10 s of HA updates every 250 ms, each changing 5 unrelated sensors and one linked power sensor. **Switch:** large to small and back, 3 times. **Look:** neon, realistic, day, blueprint, neon, realistic, neon, then quality high and auto. **Library:** `<fp3d-library>` with all 1,751 bundled pack entries; "sofa", "double bed", "smoke alarm", "radiatr", "bambu x1c" and "tv" typed letter by letter, 3 times.
- The before and after runs were made back to back on the same machine. Other work was running on it, so absolute numbers drift by about 20% between sessions. Compare within a table. Times are **median / worst**, and "longest" is a single long animation frame.

### Results at 1x

| Measure | Before | After |
|---|---|---|
| Edit in 3D beside: to painted | 286 / 363 ms | **65 / 80 ms** |
| Edit: scene rebuild | 259 / 323 ms | **43 / 55 ms** |
| Edit: longest frame after it | 293 / 370 ms | **72 / 87 ms** |
| Sensor ticks, 10 s: `syncDevices` total | 379 ms (39 syncs) | **105 ms** (paced) |
| Load (large plan): longest task / total blocking | 1,217 / 1,726 ms | **540 / 585 ms** |
| Switch to the large plan: longest task | 637 to 685 ms | **165 to 205 ms** |
| Switch: scene rebuilds / device syncs | 3 / 3 | **1 (+1 floor) / 2** |
| Look switch to realistic, first time: longest task | 1,129 ms | **249 ms** |
| Look switch day / blueprint / neon: longest task | 319 / 281 / 252 ms | **68 / 0 / 125 ms** |
| Quality high / auto: longest task | 182 / 164 ms | 134 / 115 ms |
| Library, 1st and 2nd letter: to painted | 42 / 99 ms | **21 / 58 ms** |
| Library, later letters | 4.4 / 13 ms | 4.7 / 12 ms |

### Results at 4x CPU throttling

| Measure | Before | After |
|---|---|---|
| Edit in 3D beside: to painted | 1,259 / 1,385 ms | **292 / 340 ms** |
| Edit: longest frame after it | 1,292 / 1,421 ms | **327 / 375 ms** |
| Sensor ticks, 10 s: `syncDevices` total / long frames | 1,036 ms / 19 | **459 ms / 8** |
| Load (large plan): longest task | 3,018 ms | **1,728 ms** |
| Switch to the large plan: longest task | 3,226 to 3,336 ms | **792 to 906 ms** |
| Switch to the small plan: longest task | 1,269 to 1,621 ms | **298 to 416 ms** |
| Look switch to realistic, first time: longest task | 2,440 ms | **1,089 ms** |
| Look switch day / blueprint / neon: longest task | 1,506 / 1,321 / 1,394 ms | **194 / 136 / 472 ms** |
| Library, 1st and 2nd letter: to painted (2 runs) | 260 / 608 to 648 ms | **160 to 170 / 491 to 918 ms** |

### Findings

- **3D beside** shows an edit in about a fifth of the time it took before. What is left is the edited floor (its walls, rooms, lamps and light, plus copying the cached items) and one `syncDevices`. The editor's 150 ms hand-off debounce (`queue3d`) is unchanged.
- **Load** now runs as one task per floor. The longest one is the first floor plus the first device sync. The shader compile, about 1 s on its own on the first frame before, no longer blocks the page where the browser compiles in parallel (`KHR_parallel_shader_compile`). Total load time to the first frame is about the same.
- **Look switches** within the light looks cost almost nothing now. Neon to a light look still rebuilds the floors with own-coloured items. On these plans that is every floor, because most pack items carry `#rrggbb` parts. The first switch to realistic still pays the first frame's shadow pass and the floor pictures.
- **Library:** the first letters are about 40% faster at the median. The worst case stays noisy at 4x (one run better than before, one worse). What is left is Lit rendering the cards of every open section. Capping the cards for one- and two-letter queries would cut it further, but it changes what the library shows, so it was left for a decision.
- **Memory:** the furniture cache keeps one typed-array copy of each floor's items, plus a second copy of the own-coloured items for the other look. On the large plan that is a few MB.
- **Hot paths touched:** the floor build (`buildFloorGeometry`, a JSON key per item), the 3D frame (`render` returns early while shaders compile) and `syncDevices` pacing. Selection is unchanged.

### Not measured

- A real wall tablet and its GPU, and a live Home Assistant home.
- The editor itself with 3D beside open: the harness drives the 3D view directly with the documents the editor would hand over.

## View mode: no render for a state the view does not show (#177)

Measured 31 Oct 2026, before (integration @ `08ad7c1`) and after the #177 change, on the same local plans. No Home Assistant was involved.

### What changed

- **The panel, the card and the 3D view note the states they read** while they render (`hass-watch.ts`, as the editor does since #130). A new `hass` that changes none of them skips the update. Before, each of the several updates a second ran the panel's and the view's whole Lit update: `render()`, `updated()`, the device sync's change check and the director.
- **The 3D view also checks what its scene shows**: the entities it already watches (`watched`, the list the device sync compares) and the items shown only while a state holds (#15). The device sync itself notes no reads, because it goes through every state for the locating. Whether it runs is still decided by `watched`, as before.
- **A skipped render still hands the new `hass` on** to every element it draws with one: the 3D view, the room panel, the editor, the quick menu and so on (`HASS_CHILDREN`, which a test checks against the sources). The plan's loader and the night dimming still get it too. Children decide for themselves, so the room panel still follows its own lights.
- **Always renders:** a change to the registry, language, theme or user; anything while travelling in time; and a demo home whose demo devices turned real.
- **The check is cheap.** It compares the plain objects under the proxies, and the panel, card and view skip the "did an entity come or go" pass over all ~5,000 states, which costs about 0.35 ms each time. The editor keeps that pass, because its entity lists depend on it.

### Method

- The browser check committed with #178 (`npm run speed`, `frontend/scripts/browser-check.mjs`): headless Edge (Chromium) through puppeteer with the desktop GPU, a 1280 x 800 page at DPR 1, and real CPU throttling (`Emulation.setCPUThrottlingRate`) at 1x and 4x. It mounts the shipped `home-3d-panel` from the built bundles with a fake `hass` of about 5,000 states: the plan's own entities plus 4,900 filler sensors.
- **Plans:** the shipped sample home (110 items, 2 floors, 71 watched entities), and the #131 harness's large plan (514 items, 2 floors). The large plan stays local and is not in the repository.
- **Background load:** 6 s at 5 `hass` updates a second, in the View tab. Each update changes one filler sensor that no plan links. In the "1 in 5 watched" run, every fifth update changes a sensor or light the plan shows instead. Each run counts the panel's and the view's renders and the time spent in their Lit updates (`performUpdate`, which also runs for a skipped update), plus long animation frames.
- **Selection:** 15 presses each on a linked and a plain item in the editor's plan, timed to the updated panel painted, as in #130.
- Before and after alternated, 2 rounds. The tables show the range over both rounds.

### Results

| Measure | Before 1x | After 1x | Before 4x | After 4x |
|---|---|---|---|---|
| Unwatched states: panel renders | 4.9 /s | **0** | 2.3 to 4.1 /s | **0** |
| Unwatched states: 3D view renders | 4.9 /s | **0** | 2.3 to 4.1 /s | **0** |
| Unwatched states: panel + view update time | 2.2 to 2.6 ms/s | **0.9 to 1.3 ms/s** | 6.5 to 13.0 ms/s | **2.5 to 4.0 ms/s** |
| 1 in 5 watched: panel renders | 4.8 to 4.9 /s | **0** | 3.9 to 4.7 /s | **0** |
| 1 in 5 watched: 3D view renders | 5.8 to 6.0 /s | **1.9 to 2.1 /s** | 4.8 to 5.7 /s | **1.7 to 1.9 /s** |
| 1 in 5 watched: 3D view update time | 13.6 to 14.6 ms/s | 14.2 to 15.4 ms/s | 60 to 86 ms/s | 65 to 90 ms/s |
| Editor selection, linked item | 14.9 to 15.9 ms | 15.2 to 17.4 ms | 94 to 124 ms | 97 to 104 ms |
| Editor selection, plain item | 9.8 to 12.2 ms | 10.2 to 11.3 ms | 60 to 77 ms | 59 to 76 ms |
| Load, sample home: ready | 1,023 to 1,634 ms | 1,046 to 1,611 ms | 3,341 to 3,399 ms | 3,057 to 3,604 ms |

### Findings

- **Idle view mode no longer renders.** At 4x, the panel and the view spend a third to a fifth of the time they did before. What is left is the check itself and the hand-on to their children: about 0.2 ms per update for the panel and the view together at 1x.
- **The cost was smaller than the review expected.** Before, the panel's and the view's renders cost about 2.5 ms/s at 1x and 6 to 13 ms/s at 4x on these plans. PERF-2 estimated "a few tens of ms/s". The view's `render()` turned out to be cheap, because its heavy work (`syncDevices`) already ran only when a watched entity changed. The saving grows with what the panel draws (room panel, energy cards, time bar) and with slower tablets.
- **A watched sensor still costs the same.** When a light or sensor on the plan changes, the view updates, and the paced device sync (#131) does the real work. With one watched change a second, the view now renders about twice a second instead of 5 to 6 times.
- **Selection and load are unchanged** within the noise between runs. The 4x linked-selection worst case was 612 ms in one "before" run and at most 150 ms after, but that is a single outlier.
- **Hot path:** every `hass` update now runs `shouldUpdate` in the panel, the card and the 3D view: one pass over the hass keys, the watched ids (about 270 on the large plan) and the plan's show-when items. Selection and the 3D frame are not touched.

### Not measured

- A real wall tablet, and a live Home Assistant with its real update rate.
- The card on a dashboard. It uses the same code as the panel; the unit tests cover it.

## Bundle sizes: what every page and a wall tablet load (#179)

Measured 31 Oct 2026 with `npm run build` (the budgets it checks) on integration @ `08ad7c1` plus #177, before and after the #179 change. Gzip is level 9, which is about what Home Assistant sends.

### What changed

- **The 3D view is a lazy chunk of the main bundle.** Home Assistant loads `home-3d.js` on every page for every user, so that the card is known on any dashboard. The 3D view element (`components/view3d.ts` and the modules only it uses, such as the quick menu, the household and the alerts) used to be about 300 KB of it. It now loads when the panel or a card connects (`load-view.ts`), and both draw `<fp3d-view3d>` at once: the element takes its properties when its code arrives. The main build uses esbuild's code splitting. Modules that the main bundle and its chunks share sit in shared chunks (`home-3d-chunk-<hash>.js`), so there is still one pack registry and one language table. Chunk names carry their content hash.
- **Only the main bundle carries the English table (#196).** The editor, the card editor and every other bundle load from the main bundle, which has already registered the table on the page by then. The build swaps their imports of `i18n.ts` for `i18n-borrowed.ts`: the same functions (`i18n-core.ts`) without the texts. The editor went from 971 to 847 KB and the card editor from 157 to 33 KB; their budgets are now 860 and 40 KB, and the build fails when one of them holds the English table again. Other languages come from language packs (see `languages.md`) and are fetched only by pages in that language.
- **Walking through the house is a lazy chunk too** (`viewer/walk.ts`, about 10 KB). It needs no three.js and used to sit in the 3D bundle. It loads when someone starts walking or when the pets start.
- **three.js's shaders are shrunk at build time** (`glsl-shrink.ts`): indentation, blank lines and comments go. Preprocessor lines keep their spaces, and any text with a line continuation or a block comment is left alone.
- **Budgets:** each file has a raw budget and the files a wall tablet waits for also have a gzip budget. Two paths are budgeted as wholes, each file with everything it imports: "every page" (the main bundle and its shared chunks) and "wall tablet" (plus the 3D view chunk and the 3D bundle). A module moved from one bundle to another therefore still counts. A lazy chunk without a budget fails the build. `npm run build -- --report` lists the 15 biggest inputs of each bundle, and CI runs it, so a raise can name what grew. No budget went up.

### Results

| | Before | After | Budget now |
|---|---|---|---|
| `home-3d.js` | 693.4 KB (216.2 KB gzip) | **130.2 KB** (34.9 KB gzip) | 145 KB / 45 KB gzip (was 695 KB) |
| Every page: main bundle with its imports | 693.4 KB (216.2 KB gzip) | **385.9 KB** (128.2 KB gzip) | 410 KB / 140 KB gzip |
| 3D view chunk | (in `home-3d.js`) | 312.3 KB (91.5 KB gzip) | 335 KB / 100 KB gzip |
| Walking chunk | (in `home-3d-3d.js`) | 9.7 KB | 16 KB |
| `home-3d-3d.js` | 895.2 KB (262.9 KB gzip) | **875.6 KB** (258.0 KB gzip) | 900 KB / 280 KB gzip (unchanged raw) |
| Wall tablet: main + view + 3D with their imports | 1,588.6 KB (479.1 KB gzip) | 1,573.7 KB (477.8 KB gzip) | 1,630 KB / 500 KB gzip |

- **Every Home Assistant page** now loads 386 KB of Home 3D instead of 693 KB, 44% less, and parses that much less JavaScript. This counts on every dashboard and phone, not only where the house shows.
- **The 3D bundle** gained 24 KB of headroom: 10 KB from the shaders and 10 KB from walking. three.js itself is 538 KB of it, and a bare `WebGLRenderer` alone is about 517 KB, so tree-shaking three.js has little left to win.
- **A wall tablet** loads about the same as before (15 KB less), in two more files: the shared chunks and the view chunk. They come from the same server as the main bundle, and the 3D bundle was already a request of its own.

### Not measured

- How long a real wall tablet takes to parse the main bundle before and after. On the desktop the headless check (`npm run speed`, sample home, 2 runs each) showed no change in panel load: ready after 973 to 1,028 ms before and 933 to 1,042 ms after. Editor selection was also unchanged, at 14 to 16 ms for a linked item.

## The browser check: smoke test in CI and a repeatable speed check (#178)

`frontend/scripts/browser-check.mjs` loads the shipped bundles (`custom_components/home_3d/frontend`, as `npm run build` left them) in headless Chrome, Chromium or Edge through puppeteer-core. It mounts `home-3d-panel` with a fake Home Assistant (`scripts/browser-check/fake-hass.js`). That fake has the plan's entities plus 4,900 filler sensors, answers the `home_3d/*` websocket calls from one plan, and keeps nothing. The plan is the shipped sample home unless `--plan` names another.

- **`npm run smoke`** (CI, after the build) shows the house and sends 2 s of `hass` updates. It walks through the house, switches every look (each compiles its shaders), opens the 2D plan, the Extensions tab and the item editor, the Settings tab and the editor, and presses items in the plan. It also times the renderer's `render` with a wrapper and then deletes the wrapper, on the first renderer and on the one a quality change swaps in (#213). It loads the way Home Assistant's page does (#218): the main bundle first, then Home Assistant's scoped custom element registry polyfill, with the panel created by name through a fake panel host. The panel host loads the bundle from a second URL, so two copies run, as on a page Home Assistant's service worker kept from before an update. It checks that the polyfill's registry knows the panel and the card, and at the end it leaves the panel and comes back twice without a reload, each time with a new panel element. It then loads, leaves and re-enters two more pages: one with a single copy, and one whose first copy keeps no record of its elements (like a build before #218). It fails on any console error, page error, failed request or HTTP error, and when the panel or the 3D view renders for a state they do not show (#177). WebGL is drawn with SwiftShader, so no GPU is needed. Its times are printed but not gated: SwiftShader draws every frame on the CPU.
- **`npm run speed`** (and `npm run speed -- --throttle 4`) uses the machine's GPU and measures what earlier rounds measured by hand: load, 6 s of background load in view mode (unwatched states, and 1 change in 5 watched), and 15 editor selections each of a linked and a plain item. It fails past its limits, which are about 3x today's numbers on the sample home. Other options: `--json` (one line, for scripts), `--bundles <dir>` (another build, for before/after runs), `--browser <path>` (or `HOME3D_BROWSER`) and `--swiftshader`.

Today's numbers (31 Oct 2026, this desktop, sample home, integration @ `08ad7c1` plus #177 and #179):

| Measure | 1x | 4x | Limit 1x / 4x |
|---|---|---|---|
| Load: ready (plan built, shaders compiled) | 0.9 to 1.6 s | 3.1 to 3.6 s | 5 / 15 s |
| View mode, unwatched states: panel / 3D view renders | 0 / 0 | 0 / 0 | 0.5 /s |
| View mode, unwatched states: panel / 3D view update time | 0.5 to 0.7 / 0.3 to 0.4 ms/s | 2.1 to 2.5 / 1.4 to 1.6 ms/s | 5 / 20 ms/s each |
| Editor selection, linked item (median) | 14 to 17 ms | 95 to 103 ms | 50 / 300 ms |
| Editor selection, plain item (median) | 9 to 11 ms | 59 to 66 ms | 35 / 200 ms |

**Headless against live.** A live speed run in the built-in browser pane on the real install measured an editor selection at about 60 ms, against 15 to 18 ms here. Most of the difference is the forced layout in the editor's `updated()`: the `.fp3d-side` scroll reset (#71) costs 35 to 45 ms there, inside Home Assistant's own page with its sidebar, header and theme styles, against a few ms on this bare page. #130 found that removing the reset only moves that layout into the next frame. Compare runs of the same kind only: headless with headless, live with live. The headless check catches regressions in Home 3D's own code. It does not stand in for the live speed check.

**Timing `render` by hand (#213).** three.js gives every `WebGLRenderer` its own `render`, set in the constructor; there is none on the prototype. A live speed check once wrapped it and then "restored" it with `delete renderer.render`, which left the renderer with no `render` at all. Every later frame and floor picture then threw `this.renderer.render is not a function` until the page was reloaded, while the canvas kept its last frame. Since #213 the viewer's renderers (and the library preview's) keep `render` as a property that cannot be deleted: a wrapper can still be assigned, and assigning anything that is not a function puts the renderer's own `render` back. To time it by hand, keep the original and assign it back (`const orig = r.render; r.render = wrapper; ...; r.render = orig;`), or use the `3D: renderer.render` row of `npm run speed`.

Not covered: a real wall tablet, a live Home Assistant, the time travel, the phone layouts and touch.

## First load: short slices, open floor first, kept geometry (run 6 speed)

Measured 3 Nov 2026 with `npm run speed -- --throttle 4` (headless Edge, desktop GPU, 4x CPU throttling, sample home: 110 items, 2 floors), before (run 6 integration @ `0066f90`) and after this change. Before and after alternated on the same machine, 3 runs each; other work was running on it, so compare within a table.

### What the first load spent its time on

A DevTools performance trace of the load (`npm run speed -- --throttle 4 --trace load.json`, then summed per function) showed one task of 1.3 to 1.6 s and a few more of 0.5 s:

- the whole first floor built in one go: walls and rooms, every item modelled (about 40% of a floor), the light surface on floors and walls, the roof;
- the shaders set up in one go (`compileAsync` does the CPU part of every program at once), then each program's uniforms read back by the first frame;
- the second floor in a task of its own, before the first frame;
- two full device syncs in the 3D view's start task, and the first `Intl` number format built in it (`toLocaleString` built a new format on every call);
- the hologram cards measured one by one between writes, and the floor bar's edges read in the middle of the panel's first update (each a forced layout);
- the 3D bundle asked for only once the 3D view's own chunk had arrived and started, one round trip later.

### What changed

- **Slices.** A new home's floors are modelled a few milliseconds at a time (`viewer/slices.ts`: `scheduler.yield()` where the browser has it, else a message to the page), with the page free in between. `buildFloorGeometry` and `buildLightSurface` are generators that stop after each part, wall, room and item (`floorGeometrySteps`, `lightSurfaceSteps`); run to the end they give the same result, and edits after the load still use them at once. A floor is built from what was modelled for it, keyed by its floor key, so a plan or pack change in between models it again.
- **Open floor first.** The open floor (or the ground floor) is modelled and built first, with the roof. Its lamps, doors and windows and their light follow in the next task, and its shaders compile a material at a time with each program's uniforms read ahead (`viewer/warm.ts`). Then the first picture is drawn, and only then is the next floor modelled. No frame is drawn while a new home has no floor yet. Each later floor compiles what it needs before it is drawn.
- **Kept between loads.** Each floor's modelled items and light surface are kept in the browser (IndexedDB, `viewer/piece-store.ts`). The next load of the same home takes them instead of modelling again. A record belongs to one build of Home 3D, and every piece carries the key it was drawn from (the item, its mount height, the look, the cut height, the curve detail and a hash of its pack item), so a moved item or a changed pack item is modelled anew. Records of other builds go once a session; a missing or slow store (over 1.5 s) is left out.
- **Device sync once**, in a task of its own. Number formats are kept per language and digits, and set up in an idle moment of the load. Hologram cards and the stage are measured in one go before a frame writes any card; the floor bar's edges are read in the next frame.
- **Network.** The panel and the card preload the 3D bundle (`modulepreload`) as they start, unless they show the plan flat. The integration now serves files whose URL names their content (the chunks, `home-3d-chunk-<hash>.js`, and the bundles asked for with `?v=<content hash>`) with `Cache-Control: public, max-age=31536000, immutable`; the main bundle and the card loader are `no-cache` when asked for without a version, and immutable under `?v=<build id>` (#340: the panel, the extra module and the card loader are registered with the build id, so an update is a new URL and a proxy that rewrites cache headers cannot keep the old entry); languages and fonts stay `no-cache`, so an update still shows after a reload. A failed dynamic import (an old entry asking for a chunk an update removed) reloads the page once, guarded by `sessionStorage` (`chunk-reload.ts`). Before, every load asked again for each of the thirty-odd files.
- **The speed check** reports the first picture of the house (the first frame after a floor is built and its shaders compiled) next to "ready" (everything built), takes `--trace <file>`, and with `--cache` serves the bundles with the integration's cache headers and reports the second page's load as "load again".

### Results at 4x CPU throttling

Before and after alternated, 3 runs each (ranges). "Ready" is what the check always measured: every floor built and its shaders compiled. "First picture" is the first frame that shows the house; before, it came with "ready", since the house appeared all at once.

| Measure | Before | After |
|---|---|---|
| First picture of the house | 2.12 to 2.26 s | **1.87 to 1.91 s** |
| Ready (every floor built) | 2.12 to 2.26 s | 2.23 to 2.31 s |
| Longest task | 988 to 1,020 ms | **264 to 328 ms** |
| Total blocking | 1,383 to 1,741 ms | **679 to 713 ms** |
| Load again (same browser): first picture | 1.97 to 2.02 s | **1.47 to 1.52 s** |
| Load again: ready | 1.97 to 2.02 s | **1.72 to 1.81 s** |
| Load again: longest task / total blocking | 942 to 968 / 1,606 to 1,671 ms | **272 to 307 / 675 to 687 ms** |
| Editor first open | 460 to 500 ms | 458 to 533 ms |

With 50 ms added to every request (`--latency 50`, as through a proxy; after with `--cache`), 2 runs each:

| Measure | Before | After |
|---|---|---|
| First picture | 2.59 to 3.02 s | **2.11 to 2.30 s** |
| Load again: first picture | 2.09 to 2.66 s | **1.75 to 1.89 s** |

Each step on its own, measured as it went in (3 runs each). The machine was busier early in the session, so these absolute numbers are higher than in the table above; compare down the column.

| Step | Ready | First picture | Longest task | Total blocking |
|---|---|---|---|---|
| Start | 2.85 to 3.39 s | (= ready) | 1,304 to 1,566 ms | 1,905 to 2,373 ms |
| Number formats kept, cards measured in one go, floor bar read in the next frame | 2.70 to 2.81 s | (= ready) | 1,226 to 1,245 ms | 1,764 to 1,845 ms |
| Floors modelled in slices, shaders compiled in slices | 2.69 to 3.01 s | (= ready) | 883 to 980 ms | 1,378 to 1,612 ms |
| No frame before the first floor, roof once, devices in their own task | 2.43 to 2.50 s | (= ready) | 417 to 456 ms | 773 to 865 ms |
| First picture before the next floor | 2.48 to 2.54 s | 2.19 to 2.23 s | 414 to 419 ms | 1,019 to 1,058 ms |
| One device sync (it ran twice), lamp light in its own task | 2.36 to 2.42 s | 2.09 to 2.13 s | 266 to 292 ms | 858 to 863 ms |
| 3D bundle preloaded, number formats set up early | 2.29 to 2.35 s | 2.01 to 2.08 s | 288 to 357 ms | 806 to 842 ms |
| Geometry kept between loads, floor built in its own task, roof in the slices | 2.38 to 2.66 s | 1.92 to 2.16 s (again: 1.45 to 1.59 s) | 261 to 307 ms | 808 to 975 ms |
| Later floors compile before they are drawn | 2.30 to 2.32 s | 1.90 to 1.96 s | 232 to 363 ms | 675 to 737 ms |

### Findings

- **The page stays usable while the house loads.** The longest task is a quarter of what it was and the page is blocked half as long. What used to be one task of a second is now slices of 15 to 40 ms.
- **The house shows sooner**: about 0.3 s on a first load and 0.5 s on a second one (the kept items and light surfaces), more through a proxy, where the kept files save a round trip each. "Ready" stays where it was, because the second floor is now modelled after the first picture instead of before it.
- **The targets are not all met.** Ready under 1.5 s and total blocking under 500 ms are not reached at 4x; a second load's first picture comes close at about 1.5 s. Three tasks stay over 200 ms: the 3D view's device sync (about 200 ms at 4x: markers, cards and the viewer's devices for 110 items), the first frame (the hologram cards' first layout as they show, about 130 ms, plus the draw), and the panel's first layout in a fresh browser (about 170 ms; the trace puts it in layout itself, and it stayed when the web fonts or glyph fallbacks were warmed up first). What remains is mostly real work: modelling the items the first time, walls and rooms, the device sync and the first layout. Splitting the device sync and caching whole floors (not only their items) between loads are the next candidates.
- **Hot paths touched:** a new home's load (the viewer's `rebuild` while floors are pending), `formatNumber` (every number shown) and the hologram cards' placement after each frame. Edits, look switches and selection rebuild as before.

### Not measured

- A real wall tablet and its GPU, and a live Home Assistant. The network side (preload, cache headers) shows little on a local server; on a remote screen each request saved is a round trip.
- A home much larger than the sample home: slices keep each task short whatever the size, but the total work grows with it.
