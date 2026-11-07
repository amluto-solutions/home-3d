# UniFi desktop and wall network gear checklist (#145)

Items in `amluto.unifi/network/`, hand-written like the IT pack's `network_switch_8`. Sizes are W x D x H in mm
from techspecs.ui.com (fetched 30 Oct 2026; no axis labels, order follows the form factor). `watts` is the maker's
maximum without PoE output where the page says so. Fronts are simplified (ports in a row, one LED).

| id | Device | W x D x H | Watts | Status / source |
|---|---|---|---|---|
| `unifi_express_7` | UniFi Express 7 | 117 x 117 x 42.5 | 22 | maker: https://techspecs.ui.com/unifi/cloud-gateways/ux7 |
| `unifi_dream_router_5g_max` | Dream Router 5G Max | 110 x 110 x 250 | 35 | maker: .../udr-5g-max (34.5 W excl. PoE); drawn as a rounded box |
| `unifi_dream_wall` | Dream Wall | 549 x 62 x 342 | 112 | maker: .../udw (549 x 342 x 62, wall mounted, 112 W excl. PoE); which of 549/342 is the width is unverified |
| `unifi_usw_flex_mini` | Flex Mini | 107 x 70 x 21 | 2.5 | maker: .../switching/usw-flex-mini |
| `unifi_usw_flex_mini_2_5g` | Flex Mini 2.5G | 117.1 x 90 x 21.2 | 6.4 | maker: .../usw-flex-2-5g-5 |
| `unifi_usw_flex` | Flex | 122.5 x 107.1 x 28 | 5 | maker: .../usw-flex (51 W with PoE) |
| `unifi_usw_flex_2_5g_8` | Flex 2.5G 8 | 212.9 x 76 x 33.5 | 14 | maker: .../usw-flex-2-5g-8 |
| `unifi_usw_flex_2_5g_8_poe` | Flex 2.5G 8 PoE | 212.9 x 99.4 x 33.5 | 17 | maker: .../usw-flex-2-5g-8-poe (excl. PoE output) |
| `unifi_usw_flex_xg` | Flex XG (10 GbE) | 135 x 185 x 32 | 25 | maker: .../usw-flex-xg (EU store only, not sold in the UK store) |
| `unifi_usw_lite_8_poe` | Lite 8 PoE | 99.6 x 163.7 x 31.7 | 8 | maker: .../usw-lite-8-poe (excl. PoE output) |
| `unifi_usw_lite_16_poe` | Lite 16 PoE | 192 x 185 x 44 | 15 | maker: .../usw-lite-16-poe (excl. PoE output) |
| `unifi_usw_ultra` | Ultra | 203 x 76 x 33 | 9 | maker: .../usw-ultra (excl. PoE output) |
| `unifi_usw_ultra_60w` | Ultra 60W | 203 x 76 x 33 | 9 | maker: .../usw-ultra-60w |
| `unifi_usw_ultra_210w` | Ultra 210W | 203 x 76 x 33 | 9 | maker: .../usw-ultra-210w |
| `unifi_usw_pro_xg_8_poe` | Pro XG 8 PoE | 210.4 x 173.8 x 43.7 | 61 | maker: .../usw-pro-xg-8-poe (excl. PoE output) |
| `unifi_usw_pro_8_poe` | Pro 8 PoE | 200 x 248 x 44 | 30 | maker: .../usw-pro-8-poe (excl. PoE output; briefly out of stock in the UK store) |

Skipped: Cloud Gateway Max (already covered by `unifi_cloud_gateway_ultra`, same 141.8 x 127.6 x 30 body), UniFi
Express (UX) and Dream Router (UDR), neither in the current UK store list (UDR is the same cylinder as the existing
`unifi_dream_router_7`), Cloud Key Gen2 Plus (not in the store, legacy), Gateway Lite (no current product).
