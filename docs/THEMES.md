# Home 3D site: motion themes and the shared base

The page at home3d.amluto.com (source: `options/event-display/`) runs one motion theme:

| Theme | Name | Idea |
|---|---|---|
| `c` (the only one) | HUD | Grid, scanlines, glass, wireframe |

On 13 Nov 2026 the owner locked in C. Theme A ("Live instrument", the event-display look with more animation) is kept, not shipped, in `options/event-display/themes-archive/a.css` and `a.js`. Theme B (cutaway scroll story) was dropped the same day. Any `?theme=` value, or none, shows C, so old `?theme=a` and `?theme=b` links still work. With one theme the review switcher does not render (`renderThemeSwitcher` returns `null`).

To bring A back: move its two files into `themes/`, add `a` to `THEMES` in `site-api.js` and `theme-boot.js`, and to the theme lists in `tools/build-site.py` and `tools/check-dist.mjs`. The switcher then shows again.

This file is the contract between the shared base and the themes. The base is `index.html`, `style.css`, `app.js`, `theme-boot.js`, `site-api.js` and `../_shared/live-embed.*`. If a theme needs something the base does not give, ask for a new hook in the base; do not work around it.

## Rules for a theme

1. A theme only adds files: `options/event-display/themes/<t>.css`, `themes/<t>.js`, and its own folder `themes/<t>/` for anything else (images, more modules, fonts). It does not edit `app.js`, `index.html`, `style.css`, `site-api.js`, `theme-boot.js`, `../_shared/*`, `demo/*` or `tools/*`.
2. Everything in `themes/<t>.css` is scoped with `html[data-theme="<t>"]`.
3. A theme gets the api only as the argument of its default export. It never imports `../site-api.js` or `../app.js`: in `dist/` those carry a `?v=` version, so an import from a theme would load a second, separate copy.
4. PRODUCT.md still binds: plain static files, ES modules, nothing loaded from other sites (no CDN, no web fonts from elsewhere), no cookies, no inline scripts (the CSP is `script-src 'self'`; inline `style` attributes are allowed), phone-friendly at 390 px, UK English, plain voice, no invented claims.
5. Respect reduced motion in the sources: `html[data-reduced-motion]` and `api.reducedMotion()`. With reduced motion the same states show without movement. The live site ignores it (owner's choice, 13 Nov 2026): `tools/build-site.py` swaps every `prefers-reduced-motion` media query in `dist/` (page, themes and the demo's panel bundles) for one that never matches (`reduce`) or always matches (`no-preference`), so the motion shows on every phone. Delete that block in the build to respect it again.
6. Decoration never takes pointer events from content, never adds sideways scroll, and stops when off-screen or when the tab is hidden.
7. The page copy stays as it is. A theme changes how the page looks and moves, not what it says.
8. Run the build and the check (below) before handing a theme over. Both must pass for both themes.

## How a theme loads

1. `theme-boot.js` (a classic script in `<head>`, after `style.css`) reads `?theme=`, sets `<html data-theme="<t>">`, sets `<html data-reduced-motion>` when the visitor prefers reduced motion, adds `<link rel="stylesheet" href="themes/<t>.css" blocking="render">` after `style.css` (so theme rules win at equal specificity, and the page does not paint before the theme CSS is there), and adds `<link rel="modulepreload" href="themes/<t>.js">`.
2. `app.js` builds the page as theme A has it: the live view, the tabs, the readouts, the stepper.
3. `app.js` imports `themes/<t>.js` and calls its default export with the api, synchronously and without awaiting it.
4. Only then does the ring figure get its first layout. So a theme that calls `api.disableRings()` in the first synchronous lines of its default export never shows a ring.

```js
// themes/x.js
export default function themeX(api) {
  // api.disableRings();               // theme C: before anything else
  const off = api.onTrack(({ name }) => { /* ... */ });
  return () => off();                  // optional dispose (called on pagehide)
}
```

The default export may return a dispose function (or a promise of one). It is called on `pagehide` when the page is not kept in the back-forward cache. An error thrown by a theme is caught and logged with `console.warn`; the base page keeps working.

## The api

All functions are safe to call at any time after the default export starts. `on…` functions return an unsubscribe function.

| Member | What it is |
|---|---|
| `version` | `1`. Raised when the contract changes in a way that breaks a theme. |
| `theme` | `"a"` or `"c"`. |
| `themes` | `[{ id, name }]` for the two themes. |
| `live` | The `mountLive` handle of the hero viewer (see "The live view" below). |
| `tracks` | `[{ index, name, label, tab, panel }]`: the eight tracks in ring order. `name` is `draw`, `furnish`, `control`, `sense`, `energy`, `cameras`, `ask`, `time`. `tab` is the `[role=tab]` button, `panel` its `.panel`. |
| `els` | `{ root, main, event, liveHost, tabList, rings, hitLayer, readout, steps }`: the main elements. |
| `sections` | `[{ name, el }]` for every `[data-section]`, in page order: `hero`, `chain`, `packs`, `install`, `footer`. |
| `slot(name)` | The decorative container `[data-theme-slot=name]`: `"hero"`, `"main-end"` or `"page"`. |
| `selected()` | Index of the selected track. |
| `select(i, { focus })` | Select a track by index or name, as a click would: the panel shows, the live view runs that track, `onTrack` fires (with `source: "script"`). `focus: true` moves focus to its tab. |
| `onTrack(fn)` | `fn({ index, name, tab, panel, source, changed })` after every selection by the visitor (`source: "user"`, click or keyboard) or by `select()` (`"script"`). `changed` is false when the same track was chosen again. |
| `hit(i, { amp, off, delay })` | The comet-and-burst "hit" travelling track `i` (index or name) to its label. `amp` 0..1 sets brightness, `off: true` draws it in steel (a lamp going off), `delay` in ms. Works in ring and phone layouts; does nothing with rings off, with reduced motion, off-screen or with the tab hidden. The base already fires hits for real state changes (lamps, power, temperature, the minute for Time travel). |
| `onState(fn)` | Live readings from the demo: `fn({ lights: {id: "on"|"off"}, power: { house, grid, solar, battery, soc }, temp: { n, avg } })`, now (if known) and on every change. Lamps at once; power and temperature drift every two seconds. |
| `state()` | The last reading, or `null`. |
| `trackActions()` | Resolves to the track actions module (`../_shared/track-actions.js`: `runTrack`, `trackNote`, `TRACK_NOTES`, `EDITOR_NOTES`), or `null` when it is not there. Use `trackNote(name, { reducedMotion })` for a caption of what the view shows; do not call `runTrack` yourself unless you replace the tabs (the base already runs it on every selection). |
| `reducedMotion()` | `true` when the visitor prefers reduced motion. |
| `onReducedMotion(fn)` | `fn(boolean)` when that changes. |
| `isRing()` | `true` while the ring figure is drawn as a ring (rings on and the viewport at least 760 px wide). |
| `ringsEnabled()` | `false` after `disableRings()`. |
| `disableRings()` | No ring figure: the SVG rings, the tracks, the hit layer and the label placement stop for good, `#rings` and `#hit-layer` get `hidden`, `#event` gets `data-rings="off"`, and the tab list is laid out as a plain list under the live view (style.css). The tabs keep working: click, arrow keys, Home and End, panels, live view actions. Call it first thing in the default export. |
| `relayout()` | Measure and draw the figure again (after a theme moves the live view, say). Does nothing with rings off or while fullscreen. |
| `onLayout(fn)` | `fn(geometry)` after every layout (and once after `disableRings`). |
| `geometry()` | `{ ring, rings, cx, cy, R, W, H, top, bottom, left, right }` in px, relative to `#event`: the centre of the live view, the label-ring radius, the figure size and the live view edges. |
| `enterFullscreen({ returnFocus })` | Open the live view full screen with the full demo and its editor. Focus returns to `returnFocus` (default: the Fullscreen button) on exit. Must run inside a click or tap. |
| `exitFullscreen()`, `isFullscreen()` | Close it; ask. |
| `onFullscreen(fn)` | `fn(true|false)` on open and close. |
| `scroll()`, `onScroll(fn)` | Page scroll progress 0..1; `fn(progress, scrollY)`. |
| `pointer()`, `onPointer(fn)` | Pointer position `{ x, y }`, each -1..1 across the viewport (0, 0 is the centre); `fn(x, y)`. |

For debugging only, the same object is on `window.home3dSite`. Themes use the argument.

## The DOM contract

Themes may rely on these. They will not change without a new api `version`.

- `<html data-theme="a|c">`; `<html data-reduced-motion>` (present when reduced motion is preferred; mirrors the media query, kept up to date).
- CSS variables on `<html>`, set by the base with one passive, rAF-throttled listener each: `--scroll` (0..1, page scroll progress), `--pointer-x` and `--pointer-y` (-1..1, 0 at the centre). They change only when the value changes. Changing a variable on `<html>` restyles the page, so use them for a few transforms, not for layout.
- `#main` (the `<main>`), `header.bar` (the sticky top bar), `footer.foot`.
- `#event` (`section.event`, `data-section="hero"`): the hero grid with areas `intro`, `stage`, `readout`, `event`. It gets `.is-ring` while the ring layout is on, `data-rings="off"` after `disableRings()`, and the variables `--ox`, `--oy` (centre of the live view, px) and `--tick-gap`.
- `#event > [data-theme-slot="hero"]`: an empty, `aria-hidden` container behind everything in the hero (absolute, `inset: 0`, `z-index: -2`, no pointer events). Put decorative layers here.
- `#rings` (`svg.rings`) with `.ring.r-1`…`.r-6`, `.ticks`, `.spokes`, `.frame`, `.track` (`.on` for the selected one), `.deposit`. Redrawn on every layout: style it, do not keep references to its children.
- `#hit-layer` (`.hit-layer`) with `.comet` (`.off`) and `.burst` (`.off`) elements, animated by the base.
- `.intro`, `.intro h1`, `.hero-highlight`, `.lede`, `.actions`, `.caption`; `.stage`; `#live-hero` (`.live-host.live`, the live view).
- `#tracks` (`.tracks[role=tablist]`) with eight `button[role=tab][data-track=<name>]` (`#t-<name>`), each with `.blip`, `.nm` (name) and `.ro` (live reading, `data-ro=<name>`). `aria-selected="true"` marks the selected one; in ring mode each tab has `--x`, `--y`, `--tx`, `--ty`.
- `.readout` with eight `.panel[role=tabpanel]` (`#p-<name>`, `hidden` unless selected). Inside: `.facts`, `.needs`, `.view-note`, `.flow` (energy, with `[data-flow]` rows and `.flow-dots`), `[data-all-lamps]` (Control).
- `.event-line` (the mono event header line), with `[data-lamps-short]` and `[data-house]` readouts.
- Bands: `section.band` with `data-section` = `chain`, `packs`, `install` (ids `#chain`, `#packs`, `#install`), each with a first child `i.layer` (the sweep line) and `.wrap`. `.band::before` and `::after` are the base's rule and ring quadrant.
- The install stepper: `ol.steps.is-stepper` with `li` (`.is-current`, `.is-done`), `.step-btn` (`aria-expanded`), `.step-body`, `.step-next`, and `--progress` (0..1) on the list.
- `[data-fullscreen]`: any button with it opens the live view full screen (the hero's "Open the demo full screen", Draw's "Draw in the full-screen demo", the install section's link button). `.link-button` is a button styled as a link.
- `main > [data-theme-slot="main-end"]`: an empty, `aria-hidden` container at the end of `<main>` (static, takes no space while empty).
- `body > [data-theme-slot="page"]`: an empty, `aria-hidden` container for full-page overlays such as scanlines (`position: fixed; inset: 0; z-index: 30`, no pointer events). The top bar is `z-index: 20`, the theme switcher 40, the fullscreen view far above both.
- Theme slots are `display: none` while empty (`.theme-slot:empty`). Anything a theme puts in them must be decorative.

### The theme switcher

`nav.theme-switcher > ul > li > a[data-theme-link]` (one link per theme to `?theme=x` in the same tab, `aria-current="page"` on the current one; `.ts-k` is the letter, `.ts-n` the name). Fixed bottom-right on a computer, so it never moves the page; on a phone (under 760 px) it is static at the end of the page, because a fixed bar covered the live view. Restyle it with these variables: `--switcher-bg`, `--switcher-fg`, `--switcher-border`, `--switcher-current-bg`, `--switcher-current-fg`, `--switcher-font`, `--switcher-radius`, `--switcher-shadow`, `--switcher-z`.

## The live view (`../_shared/live-embed.js`)

`api.live` is the `mountLive` handle: `frame` (the iframe showing now), `compactFrame`, `host`, `fullscreenButton`, `lights`, `state`, `setLights(ids?, on)`, `onLights(fn)`, `onState(fn)`, `click(label)` (press the panel's own button with that text), `activate()`, `deactivate()`, `enterFullscreen()`, `exitFullscreen()`, `isFullscreen()`, `onFullscreen(fn)`.

- On a computer the view takes clicks at once; on a touch screen it waits for "Try demo" (`.live-gate`), and "Back to the page" (`.live-release`) or Escape hands control back.
- **Fullscreen** (ticket 430): `.live-fs`, a "Fullscreen" button with an icon, sits in the view's top-right corner: a transparent 44 px tap area with the visible pill (`.live-fs-face`, 32 px) inside it, 6 px clear of the edges, so it stays inside the panel's own top bar and covers no panel control. `.live-exit` has the same shape. It opens the full demo with the editor (`demo/index.html?edit=1`, not compact) in a second iframe (`.live-frame-full`) created on demand. The compact view stays visible and usable until the full demo reports in (`data-fs-ready="1"`), then the lamps are copied across; on exit they are copied back and the second iframe is removed, so a phone does not keep two 3D views. Both iframes load the same versioned bundles, so the second load comes from the browser cache. The host gets `data-fs="1"` and `data-fs-mode="native"` (Fullscreen API on the host) or `"overlay"` (a fixed full-viewport layer with `100dvh` and safe-area padding, for iPhone Safari). The overlay is put in the top layer as a manual popover where the browser supports it (so no stacking context or transform of the page can trap it); in older browsers its ancestors are raised while it is open. While open, the host is a modal dialog (`role="dialog"`, `aria-modal`) and the rest of the page is `inert`. `html.live-fs-lock` stops the page scrolling. A theme must not rely on the hero's own stacking while fullscreen. "Back to the page" (`.live-exit`) is always visible; Escape also closes it (from the page and from inside the full demo); focus returns to the button that opened it. While it is open, the ring figure is not measured; it is measured again on close.
- Custom properties: `--live-radius`, `--live-bg`, `--live-gate-bg`, `--live-gate-fg`, `--live-gate-ring`, `--live-focus`, `--live-fs-bg`, `--live-fs-fg`, `--live-fs-ring`, `--live-fs-z`.

## Track actions

When the visitor selects a track (click, arrow keys, Home, End) or a theme calls `api.select()`, the base calls (at once for a click or a script; after 200 ms for the keyboard, so arrowing across the tabs runs only the track the visitor stops on) `runTrack(name, live, { reducedMotion })` from `options/_shared/track-actions.js` (another workstream owns that file and the demo's side of it). `live` there always points at the compact view on the page. Errors are caught; the first one is logged with `console.warn`. When the file is missing, the base's own fallback runs (Draw shows the 2D plan, Time travel opens the timeline, the rest show the whole house in 3D). The build includes the file when it exists and otherwise compiles the import out, so `dist/` never asks for a missing file.

## Build and check

```
python -I tools/build-site.py [path to a Home 3D checkout, default C:\git\h3d-wt\run13]
python -I -m http.server <free port> --bind 127.0.0.1 --directory dist
node tools/check-dist.mjs http://127.0.0.1:<port>/
```

(`node tools/check-dist.mjs` with no URL serves `dist/` itself.) Deploying is a separate step (`tools/deploy.mjs`), not part of this.

- The build copies `theme-boot.js`, `site-api.js`, the whole `themes/` folder and, when present, `_shared/track-actions.js` into `dist/`, and adds every file under `themes/` to the version hash. `index.html` loads `theme-boot.js?v=…`; `theme-boot.js` adds `themes/<t>.css?v=…` and the modulepreload `themes/<t>.js?v=…`; `site-api.js` imports the same URL, so the preload is used. Files a theme loads itself (from `themes/<t>/`) keep their plain names: they change the version hash, but the browser may serve an older cached copy, so give a changed file a new name or load it with the theme's own `import.meta.url` plus a query.
- The check runs Chrome Beta headless on `?theme=a` and `c` at 1440 × 900 and 390 × 844 (touch), plus a phone without the Fullscreen API (overlay) and the demo alone. It fails on: a script or console error, a failed request or HTTP 4xx/5xx, sideways scroll (also a page wider than the phone), no canvas in the live view, `#try` on the page, a dead in-page anchor, a link that leaves the page without `target="_blank"` and `rel="noopener noreferrer"`, a theme switcher without two links or with the wrong current one, a Fullscreen button under 44 px or without its label, Fullscreen not opening the editor build full screen, Escape or "Back to the page" not closing it, focus not returning, the page scroll not locked or the page moving, the site api not behaving (select, onTrack, slots, sections, page variables). Screenshots go to `.impeccable/review/dist/`.

## Changes (12 Nov 2026, shared base)

- `options/event-display/theme-boot.js` (new): reads `?theme=`, sets `data-theme` and `data-reduced-motion`, adds the theme stylesheet (render-blocking) and the theme module preload.
- `options/event-display/site-api.js` (new): the api object (`createSiteApi`), the theme loader (`loadTheme`), the page variables (`--scroll`, `--pointer-x`, `--pointer-y`), the theme switcher.
- `options/event-display/themes/a|b|c.css`, `a|b|c.js` (new): stubs. `b.js` calls `api.disableRings()`.
- `options/event-display/index.html`: `theme-boot.js` in `<head>`; "Try it" removed from the top nav (the live view is the first thing on the page, and the hero buttons open it full screen); the "Try the live view" band (`#try`) removed with its lamp ring, "Switch every lamp off" and "Light the garden" (Control keeps "Switch every lamp off"); "Open the full demo" in the hero is now "Open the demo full screen" (a fullscreen trigger); Draw's view note (which linked to the full demo) is now a "Draw in the full-screen demo" button; the install section's "Want to look first?" link is now a fullscreen trigger; every link that leaves the page has `target="_blank" rel="noopener noreferrer"` and `aria-describedby="new-tab"` ("Opens in a new tab", hidden text); `data-section` on the hero, the three bands and the footer; theme slots `hero`, `main-end`, `page`.
- `options/event-display/app.js`: lamp ring and garden code removed; `[data-fullscreen]` triggers; the ring figure waits for the theme, skips layout while fullscreen and lays out again on exit; `disableRings`, `geometry`, layout and track events for the api; `runTrack` from `../_shared/track-actions.js` (optional, debounced, errors warned once) with the old `showTrackInView` as the fallback; builds the api, renders the switcher, loads the theme; `window.home3dSite` for debugging.
- `options/event-display/style.css`: Try band and lamp meter styles removed; the hero caption shows on phones again (it was hidden only because the Try band repeated it); at under 400 px the word "by" in the brand is hidden, because the top bar was 13 px too wide at 390 px and cut off the Install button (this was on the live site too); new: `.link-button`, theme slots, the rings-off list layout, the theme switcher.
- `options/_shared/live-embed.js` and `.css`: the Fullscreen button and "Back to the page" button, the full demo with the editor in a second iframe, the Fullscreen API with the overlay fallback (top-layer popover, else raised ancestors), modal while open (page `inert`), scroll lock, focus return, Escape from inside the frame, lamp sync both ways, `onFullscreen`, `compactFrame`, `host`, `state`; `frame` is now the iframe showing.
- `options/event-display/app.js` also: the ring layout now sets `.is-ring` before it measures (the first layout measured the live view with the labels still in the flow, so on a computer the labels sat about 110 px too high; an early resize callback used to hide this), and lays out again when the web fonts are ready.
- `tools/build-site.py`: copies and versions `theme-boot.js`, `site-api.js`, `themes/` and (when present) `track-actions.js`; rewrites the import paths; the full demo URL; `dist/` may stay open in a local server while it rebuilds.
- `tools/check-dist.mjs`: all three themes at both widths, the overlay run, links, anchors, `#try`, the switcher, fullscreen (enter, editor build, Escape, "Back to the page", focus, scroll lock), the site api, a page wider than the phone.
- `docs/THEMES.md` (this file, new).

## Changes (13 Nov 2026)

- Theme B removed (`themes/b.css`, `themes/b.js`, the build, the check, the switcher). `?theme=b` now shows A.
- Live view: a click on a track runs it at once (the keyboard keeps a 200 ms wait). The demo no longer takes focus while the visitor is not using it (`demo/demo.js`: `focus()` and `scrollIntoView()` do nothing while the frame does not have focus), so the page no longer jumps to the view during a track. The reset between tracks keeps the camera where it is (`reset` with `whole: false`), except before Draw and Time travel, so the view does not fly out to the whole house and back. The View panel opens and closes unseen when a track changes its settings. `track-actions.js` polls every 100 ms (was 250), has shorter pauses, and a newer track stops an older one's wait at once. The hero view loads at once (`mountLive(..., { lazy: false })`). The demo's `click` also finds a control whose name carries its state ("Rooms: Utility room is open").
- Fullscreen: the visible button is a pill inside its 44 px tap area, clear of the corner. "Back to the page" (`.live-release`) shows only on touch screens, after "Try demo"; with a mouse it covered the view and did nothing useful. Escape no longer locks the view on a computer.
- Phone (under 760 px), both themes: the intro's children are hero grid items (`.intro { display: contents }`), in this order: heading, lede, the live view with its tracks, the caption of the view (theme A, `.a-note`), the buttons, the longer caption, the panel, the event line. The view is shorter (`--lh: clamp(300px, 42svh, 380px)`), so the view and its tracks fit on the first screen.
- Theme A on a phone: the caption under the figure shows (it was hidden), in a row kept for three lines.
- Theme C: the eight track chips are above the viewer on a computer and a tablet, beside the heading; on a phone they are right under the viewer, with the note and the tiles after them. The glass frame shares the viewer's grid cell (no absolute offset).
