// Parts of the panel and the card that are chunks of their own (#245, lazy-part.ts): Home Assistant loads the main bundle
// on every page, and these show only after a tap (the room panel) or only to editors (the home switcher).

import { once } from "./lazy-part.ts";

/** The room panel (<fp3d-room-panel>): it loads with the 3D view (loadView), so a tapped room rarely waits. */
export const loadRoomPanel = once(() => import("./components/room-panel.ts"));
/** The home switcher (<fp3d-home-switcher>) in the panel's header, for editors. */
export const loadHomeSwitcher = once(() => import("./components/home-switcher.ts"));
/** The View panel (<fp3d-view-panel>, #247) on the 3D view: loaded when the View button is first pointed at or pressed. */
export const loadViewPanel = once(() => import("./components/view-panel.ts"));
/** The device popup (<fp3d-device-popup>, #272 #271 #284): a light's, a robot vacuum's or a camera's card; loaded the first time one opens. */
export const loadDevicePopup = once(() => import("./components/device-popup.ts"));
/** The 3D view's zoom and pan buttons (<fp3d-view-nav>, #297): loaded when the stage first draws them. */
export const loadViewNav = once(() => import("./components/view-nav.ts"));
/** The Rooms picker (<fp3d-rooms-picker>, #249) on the floor bar: loaded when the Rooms button is first pointed at or pressed. */
export const loadRoomsPicker = once(() => import("./components/rooms-picker.ts"));
/** The search field and its results (<fp3d-find>, #305): loaded the first time the search opens. */
export const loadFind = once(() => import("./components/find.ts"));
/** The quick menu (<fp3d-quick-menu>): a device's controls; loaded the first time one opens. */
export const loadQuickMenu = once(() => import("./components/quick-menu.ts"));
/** The weather tile by the clock (<fp3d-weather-tile>, #333): loaded when the option is on and the clock shows. */
export const loadWeatherTile = once(() => import("./components/weather-tile.ts"));
/** Today's forecast under the weather tile (<fp3d-weather-forecast>, #333): loaded the first time the tile is tapped. */
export const loadWeatherForecast = once(() => import("./components/weather-forecast.ts"));
/** The shared colour field (<fp3d-colour-field>, #403): the View panel's accent and the card editor's; loaded with either. */
export const loadColourField = once(() => import("./components/colour-field.ts"));
