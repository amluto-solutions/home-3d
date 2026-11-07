# UniFi items that moved in (#145)

These UniFi devices were modelled before the UniFi pack existed and lived in other packs. They moved into
`amluto.unifi` with their ids unchanged; `custom_components/home_3d/moved_items.json` sends every placed copy to the
new pack, so saved plans keep working.

Generic look-alikes stay where they were: the network cabinets, `network_switch_*`, `nvr_desktop`, `nvr_rack_1u` and the
`wifi_access_point*` items are plain shapes for any brand and remain in `amluto.it`.

## From the IT & network pack

Rack gear (`rack_unifi_udm_pro`, `rack_unifi_udm_pro_max`, `rack_unifi_udm_se`, `rack_unifi_unvr`,
`rack_unifi_unvr_pro`, `rack_unifi_usw_pro_24_poe`, `rack_unifi_usw_pro_48_poe`, `rack_unifi_usw_pro_hd_24_poe`,
`rack_unifi_usw_pro_max_24_poe`, `rack_unifi_usw_pro_max_48_poe`, `rack_unifi_usw_pro_xg_24_poe`) is still written by
`tools/rack_gear.py`, now into `amluto.unifi/network/`; its sizes and sources stay in `docs/rack-gear.md`.

Desktop gateways, now in `amluto.unifi/network/` (sizes W x D x H in mm; Status as in `docs/it-devices.md`):

| Item id | Device | Size (mm) | Status | Source / note |
| --- | --- | --- | --- | --- |
| `unifi_cloud_gateway_ultra` | UniFi Cloud Gateway Ultra / Max | 141.8 x 127.6 x 30 | maker | https://techspecs.ui.com/unifi/cloud-gateways/ucg-ultra ; the Max page gave the same figure |
| `unifi_cloud_gateway_fiber` | UniFi Cloud Gateway Fiber | 212.8 x 127.6 x 30 | maker | https://techspecs.ui.com/unifi/cloud-gateways/ucg-fiber |
| `unifi_dream_router_7` | UniFi Dream Router 7 | 110 x 110 x 184.1 | maker | https://techspecs.ui.com/unifi/cloud-gateways/udr7 |

## From the office pack

Cameras, now in `amluto.unifi/tech/`: `unifi_ai_360`, `unifi_g3_flex`, `unifi_g4_dome`, `unifi_g4_instant`,
`unifi_g4_pro`, `unifi_g5_ptz`, `unifi_g5_turret`, `unifi_g6_entry`. They came from the old core pack (#111) and have no
checklist rows of their own.
