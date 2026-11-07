# UniFi Protect G-series cameras checklist (#145)

Cameras in `amluto.unifi/tech`. Sizes are W x D x H in mm (the item size x 1000). Bullets are sized with the
wall mount (length = the "with mount" figure); domes, turrets and the 360 are ceiling items. Figures come from
the maker tech specs (techspecs.ui.com, read 30 October 2026). Status: `maker` = the maker page gives it;
`unverified` = our estimate. Watts are the maker maximum power figure. We model each camera ourselves from simple
shapes; no maker pictures or 3D files are used. The model name tag (for example `g6 pro bullet`) is what Home Assistant
device registry reports, so the camera is matched by it.

Not duplicated, already in the library (kept where they are): `unifi_g3_flex`, `unifi_g4_dome`, `unifi_g4_instant`,
`unifi_g4_pro`, `unifi_g5_turret`, `unifi_g6_entry` (office pack). `unifi_ai_360` and `unifi_g5_ptz` belong to the AI and PTZ areas.

| Item id | Camera | Size (mm) | Status | Source / note |
| --- | --- | --- | --- | --- |
| `unifi_g6_pro_bullet` | UniFi G6 Pro Bullet | 85.8 x 210 x 85.8 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g6-pro-bullet: diameter 85.8, length 210 with wall mount (106.2 without); max 15 W |
| `unifi_g6_bullet` | UniFi G6 Bullet | 82 x 153 x 82 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g6-bullet: diameter 82, length 153 with wall mount (88.8 without); max 9.9 W |
| `unifi_g6_edge_bullet` | UniFi G6 Edge Bullet | 107 x 212 x 107 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g6-edge-bullet: diameter 107, length 212 with wall mount (113 without); max 25 W |
| `unifi_g5_pro` | UniFi G5 Pro | 86 x 154.3 x 86 | maker (body length assumed) | techspecs.ui.com/unifi/cameras-nvrs/uvc-g5-pro: diameter 86 x 154.3, the page does not say if the mount is included; the body length in the model is our estimate; max 10 W |
| `unifi_g5_bullet` | UniFi G5 Bullet | 75.5 x 150 x 75.5 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g5-bullet: diameter 75.5, length 150 with wall mount (74.4 without); max 4 W |
| `unifi_g6_turret` | UniFi G6 Turret | 100 x 100 x 95 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g6-turret; max 12.5 W |
| `unifi_g6_pro_turret` | UniFi G6 Pro Turret | 117.2 x 117.2 x 116.5 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g6-pro-turret (the G6 Edge Turret page gives the same size); max 15 W |
| `unifi_g6_edge_turret` | UniFi G6 Edge Turret | 117.2 x 117.2 x 116.5 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g6-edge-turret (the G6 Pro Turret page gives the same size); max 25 W |
| `unifi_g5_turret_ultra` | UniFi G5 Turret Ultra | 90 x 90 x 71.2 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g5-turret-ultra; max 4 W |
| `unifi_g6_dome` | UniFi G6 Dome | 144.7 x 144.7 x 96.3 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g6-dome; max 9.25 W |
| `unifi_g6_pro_dome` | UniFi G6 Pro Dome | 163.8 x 163.8 x 108.8 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g6-pro-dome (the G6 Edge Dome page gives the same size); max 15 W |
| `unifi_g6_edge_dome` | UniFi G6 Edge Dome | 163.8 x 163.8 x 108.8 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g6-edge-dome (the G6 Pro Dome page gives the same size); max 15 W |
| `unifi_g6_mini_dome` | UniFi G6 Mini Dome | 100.8 x 100.8 x 56 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g6-mini-dome; max 9 W |
| `unifi_g5_dome` | UniFi G5 Dome | 109.2 x 109.2 x 64.5 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g5-dome; max 5 W |
| `unifi_g5_dome_ultra` | UniFi G5 Dome Ultra | 63.6 x 63.6 x 68.2 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g5-dome-ultra; max 4.2 W |
| `unifi_g6_pro_360` | UniFi G6 Pro 360 | 147 x 147 x 65.5 | maker | techspecs.ui.com/unifi/cameras-nvrs/uvc-g6-pro-360; max 13.5 W |
| `unifi_g6_180` | UniFi G6 180 | 136 x 64 x 92 | maker (axes assumed) | techspecs.ui.com/unifi/cameras-nvrs/uvc-g6-180: 136 x 64 x 92, read as W x D x H; max 15 W |
| `unifi_g6_instant` | UniFi G6 Instant | 81.7 x 57.2 x 50.1 | maker (axes assumed) | techspecs.ui.com/unifi/cameras-nvrs/uvc-g6-ins: 81.7 x 50.1 x 57.2; which of the last two is the depth is our reading; max 7 W |
| `unifi_g5_instant` | UniFi G5 Instant | 81.7 x 57.2 x 50.1 | approximate | Ubiquiti publishes no size; shape and size taken from the G6 Instant (#303) |
| `unifi_g5_flex` | UniFi G5 Flex | 48 x 48 x 107.5 | maker (depth assumed) | techspecs.ui.com/unifi/cameras-nvrs/uvc-g5-flex: diameter 48, height 107.5; max 4 W |
