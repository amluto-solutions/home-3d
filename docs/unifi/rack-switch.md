# UniFi rack switches checklist (#145)

Rack-mountable UniFi switches in the UniFi pack (`amluto.unifi`, folder `network/`). Written by
`python tools/unifi_rack_switch.py` (a test fails while a file differs); edit the list in that script, not the JSON.
Sizes are W x D x H in mm from the maker's tech specs (techspecs.ui.com, fetched 30 Oct 2026). Some pages list the
three numbers without axis labels or with height last; the order here follows the 1U form factor. The drawn item is
the 482.6 mm panel with ears, 43.7 mm high (1U less 0.8 mm), at the maker's depth. Watts is the maker's maximum
without PoE output (what the switch itself draws). Models are drawn by us from boxes: touchscreen, RJ45 blocks and
SFP / QSFP cage bars; port speeds are not drawn differently, and management and console ports are left out.

| Item id | Device | Size (mm) | Status | Source / note |
| --- | --- | --- | --- | --- |
| `rack_unifi_usw_24` | UniFi USW 24 | 442 x 200 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-24 ; 25 W without PoE output |
| `rack_unifi_usw_24_poe` | UniFi USW 24 PoE | 442 x 200 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-24-poe ; 25 W without PoE output |
| `rack_unifi_usw_16_poe` | UniFi USW 16 PoE | 442 x 200 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-16-poe ; 18 W without PoE output |
| `rack_unifi_usw_48` | UniFi USW 48 | 442 x 285 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-48 ; 40 W without PoE output |
| `rack_unifi_usw_48_poe` | UniFi USW 48 PoE | 442 x 285 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-48-poe ; 45 W without PoE output |
| `rack_unifi_usw_pro_24` | UniFi USW Pro 24 | 442 x 285 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-pro-24 ; 30 W without PoE output |
| `rack_unifi_usw_pro_48` | UniFi USW Pro 48 | 442 x 285 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-pro-48 ; 60 W without PoE output |
| `rack_unifi_usw_pro_max_24` | UniFi USW Pro Max 24 | 442 x 325 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-pro-max-24 ; 50 W without PoE output |
| `rack_unifi_usw_pro_max_48` | UniFi USW Pro Max 48 | 442 x 325 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-pro-max-48 ; 100 W without PoE output |
| `rack_unifi_usw_pro_hd_24` | UniFi USW Pro HD 24 | 442 x 285 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-pro-hd-24 ; 60 W without PoE output |
| `rack_unifi_usw_pro_xg_10_poe` | UniFi USW Pro XG 10 PoE | 442.4 x 285 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-pro-xg-10-poe ; 65 W without PoE output |
| `rack_unifi_usw_pro_xg_24` | UniFi USW Pro XG 24 | 442 x 480 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-pro-xg-24 ; 150 W without PoE output |
| `rack_unifi_usw_pro_xg_48` | UniFi USW Pro XG 48 | 442 x 480 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-pro-xg-48 ; 250 W without PoE output |
| `rack_unifi_usw_pro_xg_48_poe` | UniFi USW Pro XG 48 PoE | 442 x 480 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-pro-xg-48-poe ; 200 W without PoE output |
| `rack_unifi_usw_aggregation` | UniFi USW Aggregation | 442 x 120 x 43.7 | maker | https://techspecs.ui.com/unifi/switching/usw-aggregation ; 36 W without PoE output |
| `rack_unifi_usw_pro_aggregation` | UniFi USW Pro Aggregation | 442 x 325 x 44 | maker | https://techspecs.ui.com/unifi/switching/usw-pro-aggregation ; 100 W without PoE output |
| `rack_unifi_usw_pro_xg_aggregation` | UniFi USW Pro XG Aggregation | 442.4 x 480 x 43.7 | maker | https://techspecs.ui.com/unifi/switching/usw-pro-xg-aggregation ; 200 W without PoE output |
| `rack_unifi_ecs_24_poe` | UniFi ECS 24 PoE | 442.4 x 496 x 43.7 | maker | https://techspecs.ui.com/unifi/switching/ecs-24-poe ; 150 W without PoE output |
| `rack_unifi_ecs_48_poe` | UniFi ECS 48 PoE | 442.4 x 496 x 43.7 | maker | https://techspecs.ui.com/unifi/switching/ecs-48-poe ; 250 W without PoE output |
| `rack_unifi_ecs_24s` | UniFi ECS 24S | 442.4 x 496 x 44 | maker | https://techspecs.ui.com/unifi/switching/ecs-24s ; 150 W without PoE output |
| `rack_unifi_ecs_48s` | UniFi ECS 48S | 442.4 x 496 x 44 | maker | https://techspecs.ui.com/unifi/switching/ecs-48s ; 250 W without PoE output |
| `rack_unifi_ecs_24s_poe` | UniFi ECS 24S PoE | 442.4 x 496 x 44 | maker | https://techspecs.ui.com/unifi/switching/ecs-24s-poe ; 150 W without PoE output |
| `rack_unifi_ecs_48s_poe` | UniFi ECS 48S PoE | 442.4 x 496 x 44 | maker | https://techspecs.ui.com/unifi/switching/ecs-48s-poe ; 250 W without PoE output |
| `rack_unifi_ecs_aggregation` | UniFi ECS Aggregation | 442.4 x 496 x 43.7 | maker | https://techspecs.ui.com/unifi/switching/ecs-aggregation ; 340 W without PoE output |
| `rack_unifi_ecs_core` | UniFi ECS Core | 442.4 x 480 x 43.7 | maker | https://techspecs.ui.com/unifi/switching/ecs-core ; 360 W without PoE output |
| `rack_unifi_eav_xg_24_poe` | UniFi EAV XG 24 PoE | 442.4 x 480 x 43.7 | maker | https://techspecs.ui.com/unifi/switching/eav-xg-24-poe ; 150 W without PoE output |
| `rack_unifi_eav_fiber` | UniFi EAV Fiber | 442.4 x 480 x 43.7 | maker | https://techspecs.ui.com/unifi/switching/eav-fiber ; 150 W without PoE output |

Already in the IT pack (`amluto.it/network`, not repeated): `rack_unifi_usw_pro_24_poe`, `_pro_48_poe`,
`_pro_hd_24_poe`, `_pro_max_24_poe`, `_pro_max_48_poe`, `_pro_xg_24_poe`. The Pro Max 48 page gives depth 325 while the
existing PoE item uses 400; left alone.

## Not modelled

- `USW-Pro-Max-16` and `-16-PoE`: 325 x 160 x 43.7, a "rack mount (1U), desktop, wall" unit that is not 19 inch wide.
- `USW-Pro-8-PoE`, `USW-Pro-XG-8-PoE`, `USW-Lite-16-PoE`, `USW-Lite-8-PoE`: desktop / wall units, the pages list no rack kit.
- `USW-Enterprise-8/24/48-PoE`: marked "Vintage" by the maker (superseded by ECS), so not current.
- `USW-WAN`, `USW-WAN-RJ45`, industrial DIN, Mission Critical, Flex, Ultra and all Gen1 (US-*) models: not 19 inch rack switches for this list, or superseded.
