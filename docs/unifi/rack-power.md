# UniFi rack power and accessories checklist (#145)

Items in `amluto.unifi/network/`, written by `python tools/unifi_rack_power.py` (a test fails while a file
differs; edit the catalogue in the script, not the JSON). Sizes are W x D x H in mm from techspecs.ui.com (fetched
30 Oct 2026). Full-width gear is drawn on the 482.6 mm panel with a 442.4 mm body. Height is the U height less 0.8 mm.
techspecs gives no axis labels, so the order follows the physical form factor. `watts` is our estimate of the unit's
own draw (the maker gives no idle figure for these), so every row is marked unverified for watts.

| id | U | W x D x H | Watts | Status / source |
|---|---|---|---|---|
| `unifi_usp_pdu_pro` | 2 | 442.4 x 106 x 87.4 | 10 | maker size: https://techspecs.ui.com/unifi/integrations/usp-pdu-pro (16 outlets, 1875 W max, US 125 V; not in the UK store); watts unverified |
| `unifi_usp_pdu_hd` | 0 | 55 x 56 x 1485 | 10 | maker size: .../usp-pdu-hd (24 outlets, vertical, US only); axes assumed, watts unverified |
| `unifi_usp_rps` | 1 | 442.4 x 325.6 x 43.7 | 40 | maker size: .../usp-rps (995 W max incl. load); watts unverified |
| `unifi_ups_2u` | 2 | 442.4 x 300 x 87.4 | 30 | maker size: .../ups-2u-us (1000 W / 1440 VA); watts unverified |
| `unifi_ups_2u_pro` | 2 | 442.4 x 630 x 87.4 | 40 | maker size: .../ups-2u-pro-us (1920 W; UK store "coming soon"); watts unverified |
| `unifi_rack_patch_panel_24` | 1 | 442.4 x 63.5 x 43.7 | none | maker: .../accessories/uacc-rack-panel-patch-blank-24 (cable bar not drawn) |
| `unifi_rack_ocd_blank_1u` / `_2u` | 1 / 2 | 442.4 x 63.5 x 43.7 / 87.4 | none | maker: .../accessories/uacc-rack-panel-ocd |
| `unifi_rack_ocd_vented_1u` / `_2u` | 1 / 2 | 442.4 x 63.5 x 43.7 / 87.4 | none | maker: same page |
| `unifi_rack_ocd_brush_1u` | 1 | 442.4 x 63.5 x 43.7 | none | maker: same page (400 x 24 brush opening) |
| `unifi_rack_shelf_cantilever` | 1 | 481.4 x 250 x 44 | none | maker: .../accessories/uacc-rack-shelf-clv (drawn on the 482.6 panel; 20 kg) |

Not modelled: UPS Tower (desktop UPS, 288 x 99 x 280.5, axes unclear, not rack gear); UPS PoE Switch
(USW-Mission-Critical); Toolless Mini Rack and its shelves; rack ears, sliding rails, SnapMount kit, keystone packs
and the Cloud Key / Pro Max 16 / AI Port rack-mount kits (small fittings, no useful 3D shape).
