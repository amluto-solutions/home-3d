# UniFi Access checklist (#145)

UniFi Access items in `amluto.unifi` (folder `tech/`; the tests require a folder named after a library section). Sizes are W x D x H in mm, checked on 30 October 2026. Where the Status column says `maker`, the figure comes from Ubiquiti's tech specs; `unverified` means our estimate. We model each device ourselves from simple shapes; no Ubiquiti pictures or 3D files are used.

| Item id | Device | Size (mm) | Status | Source / note |
| --- | --- | --- | --- | --- |
| `unifi_g3_reader_pro` | UniFi Access G3 Reader Pro | 40.4 x 40.55 x 160 | maker | https://techspecs.ui.com/unifi/door-access/ua-g3-pro  |
| `unifi_g2_reader_pro` | UniFi Access G2 Reader Pro | 40.4 x 40.55 x 160 | maker | https://techspecs.ui.com/unifi/door-access/ua-g2-pro Techspecs gives 160 x 40.4 x 40.55; a search snippet of the ui.com readers page said 31.1 deep, so the depth is uncertain. |
| `unifi_g3_reader` | UniFi Access G3 Reader | 40 x 36.5 x 93 | maker | https://techspecs.ui.com/unifi/door-access/ua-g3  |
| `unifi_g2_reader` | UniFi Access G2 Reader | 40 x 36.5 x 93 | maker | https://techspecs.ui.com/unifi/door-access/ua-g2  |
| `unifi_g3_reader_fingerprint` | UniFi Access G3 Reader Fingerprint | 45 x 56.9 x 126.2 | maker | https://techspecs.ui.com/unifi/door-access/ua-g3-fingerprint  |
| `unifi_g3_reader_flex` | UniFi Access Reader Flex | 88 x 36.5 x 88 | maker | https://techspecs.ui.com/unifi/door-access/ua-g3-flex  |
| `unifi_reader_lite` | UniFi Access Reader Lite | 40 x 31.1 x 94.9 | maker | https://techspecs.ui.com/unifi/door-access/ua-reader-lite  |
| `unifi_retrofit_reader` | UniFi Access Retrofit Reader | 45 x 13.3 x 117 | maker | https://techspecs.ui.com/unifi/door-access/ua-retrofit-reader  |
| `unifi_retrofit_reader_fingerprint` | UniFi Access Retrofit Reader Fingerprint | 45 x 49 x 126.2 | maker | https://techspecs.ui.com/unifi/door-access/ua-retrofit-reader-fingerprint  |
| `unifi_access_ultra` | UniFi Access Ultra | 45 x 37.45 x 126 | maker | https://techspecs.ui.com/unifi/door-access/ua-ultra Reader with a built-in door controller (stainless steel). |
| `unifi_g3_intercom` | UniFi Access G3 Intercom | 113.7 x 28.3 x 324.8 | maker | https://techspecs.ui.com/unifi/door-access/ua-g3-intercom  |
| `unifi_intercom` | UniFi Access Intercom | 113.7 x 28.3 x 324.8 | maker | https://techspecs.ui.com/unifi/door-access/ua-intercom  |
| `unifi_intercom_viewer` | UniFi Access Intercom Viewer | 135 x 32 x 185 | maker | https://ui.com/us/en/door-access/intercoms ui.com intercoms page: 135 x 185 x 32, read as W x H x D. A techspecs page showed 135 x 72 x 31.8, which looked like another product. |
| `unifi_door_hub` | UniFi Access Door Hub | 174.9 x 32.9 x 126 | maker | https://techspecs.ui.com/unifi/door-access/ua-hub-door DIN-rail enclosure, modelled on a wall. |
| `unifi_door_hub_mini` | UniFi Access Door Hub Mini | 113 x 27.6 x 66 | maker | https://techspecs.ui.com/unifi/door-access/ua-hub-door-mini DIN-rail enclosure. |
| `unifi_gate_hub` | UniFi Access Gate Hub | 175 x 26 x 126 | maker | https://techspecs.ui.com/unifi/door-access/ua-hub-gate DIN-rail enclosure. |
| `unifi_retrofit_hub` | UniFi Access Retrofit Hub | 140 x 45 x 120 | maker | https://techspecs.ui.com/unifi/door-access/ua-retrofit-hub-2 DIN-rail enclosure. |
| `unifi_enterprise_access_hub` | UniFi Enterprise Access Hub | 379 x 105 x 355 | maker | https://techspecs.ui.com/unifi/door-access/eah-8 Techspecs lists wall mount only, so not rack gear and no rack variant. |
| `unifi_access_button` | UniFi Access Button | 80 x 20 x 80 | unverified | https://uk.store.ui.com/uk/en/products/ua-button Neither techspecs nor the store gave a size; a square wall plate is our estimate. |
| `unifi_access_rescue` | UniFi Access Rescue KeySwitch | 60 x 74 x 60 | maker (axes assumed) | https://techspecs.ui.com/unifi/door-access/ua-rescue Techspecs: diameter 60 x 74; we take 74 as the depth, which is our reading. |
| `unifi_magnetic_lock_270` | UniFi Access Magnetic Lock 270 kg | 250 x 26 x 42.5 | maker | https://techspecs.ui.com/unifi/door-access/ua-lock-magnetic Lock body 250 x 42.5 x 26 (W x H x D); the armature plate is not modelled. |
| `unifi_magnetic_lock_540` | UniFi Access Magnetic Lock 540 kg | 266 x 40 x 67.5 | maker | https://techspecs.ui.com/unifi/door-access/ua-lock-magnetic Lock body 266 x 67.5 x 40 (W x H x D); the armature plate is not modelled. |
| `unifi_strike_lock` | UniFi Access Fail-Secure Strike Lock 15 mm | 32 x 35 x 124 | maker | https://techspecs.ui.com/unifi/door-access/uacc-lock-strike-secure-15mm Short front plate 124 x 32 x 3 over the lock body (80 x 40 x 35); combined size is our drawing of the door-frame recess. Fail-Safe and 8 mm strikes not measured, skipped. |
| `unifi_bolt_lock` | UniFi Access Fail-Secure Bolt Lock | 42 x 30 x 132 | maker | https://techspecs.ui.com/unifi/door-access/uacc-lock-bolt-secure Lock body 132 x 30 x 42; axes read as H x D x W, our assumption. Fail-Safe bolt not measured, skipped. |
| `unifi_panic_bar` | UniFi Access Panic Bar | 294 x 94 x 838 | maker (axes assumed) | https://techspecs.ui.com/unifi/door-access/uacc-panicbar Techspecs: 838 x 294 x 94; read as H x W x D. Fits doors 711-914 mm wide. |

Not modelled: cards, keyfobs, junction boxes, mounts, sunshield, table stand, PSU, PoE extender, relay cable, door closer, starter kits (not single devices), Fail-Safe and 8 mm strike locks and the Fail-Safe bolt (no size read). The Enterprise Access Hub is wall-mounted per its spec sheet, so it has no rack variant. The older Access Hub (UA-Hub) is no longer in the store.
