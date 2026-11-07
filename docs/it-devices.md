# IT devices checklist (#118)

Everyday, non-rack IT devices in `amluto.it` (rack-mount gear is a separate ticket; UniFi's own devices moved to
the UniFi pack, see `docs/unifi/existing.md`). Sizes are W x D x H in mm,
checked against maker pages on 30 October 2026 where the Status column says `maker`. We model each device
ourselves from simple shapes; no maker pictures or 3D files are used.

Status: `maker` = a manufacturer page gives the figure; `retailer` = only shops or reviews give it; `unverified` =
no source found, the figure is our best estimate and should be checked against the real device. Notes say what is
estimated.

| Item id | Device | Size (mm) | Status | Source / note |
| --- | --- | --- | --- | --- |
| `esp32_devkitc` | ESP32-DevKitC V4 | 54.4 x 27.9 x 13 | unverified | Espressif's dimensions drawing (https://dl.espressif.com/dl/schematics/esp32_devkitc_v4_dimensions.pdf) is a compressed PDF that could not be read here; CNX Software and Cirkit list ~54 x 28. Height with the pins is our estimate. Checked 30 Oct 2026 (#133), still unverified. |
| `esp32_s3_devkitc` | ESP32-S3-DevKitC-1 | 70 x 25.4 x 13 | unverified | Espressif's PCB drawing (https://dl.espressif.com/dl/PCB_ESP32-S3-DevKitC-1_V1_20210312CB.pdf) is labelled 62.74 x 25.40 (Electrokit agrees), which may exclude the antenna overhang; nothing supports our 70 mm, so it stays unverified. Checked in #133. |
| `d1_mini` | LOLIN / WEMOS D1 mini | 34.2 x 25.6 x 12 | maker (footprint) | https://www.wemos.cc/en/latest/d1/d1_mini.html ; height with headers is our estimate |
| `esp32_project_box` | ESP32 in a project box | 100 x 60 x 25 | unverified (generic) | A generic ABS project box size, not one product, so there is no maker page to check against |
| `raspberry_pi_board` | Raspberry Pi 4 / 5 board | 85 x 56 x 17 | maker (footprint) | https://www.raspberrypi.com/documentation/computers/sbcs.html ; the Pi 5 drawing (RP-008347-DS) is marked approximate. Height over the USB stack is our estimate |
| `raspberry_pi_case_5` | Pi 5 official case | 98.5 x 70.3 x 33 | retailer | https://www.kiwi-electronics.com/en/brand-raspberry-pi/raspberry-pi-case-for-pi-5-black-11584 |
| `raspberry_pi_case_4` | Pi 4 official case | 97 x 70 x 25 | retailer (two agree on height 25) | 97 x 70 x 25 at https://uk.rs-online.com/web/p/products/1876750 and Pi Shop; other shops say 95-96 x 69-70 x 28-30, so treat the height as +-5 |
| `ha_green` | Home Assistant Green | 112 x 112 x 32 | maker | https://www.home-assistant.io/green/ |
| `ha_yellow` | Home Assistant Yellow (enclosure) | 123 x 123 x 36 | maker | https://www.home-assistant.io/yellow/ |
| `ha_blue` | Home Assistant Blue (ODROID-N2+, metal case) | 105 x 98 x 33 | unverified | Hardkernel wiki returned 403 and no listing for the metal case was found (a third-party plastic N2 case is 105 x 96 x 25). Product is discontinued. Checked in #133. |
| `zbt1_skyconnect` | Home Assistant Connect ZBT-1 (SkyConnect) | 38.5 x 18 x 10 | maker (L x W), height raised | https://connectzbt1.home-assistant.io/resources/Home-Assistant-Connect-ZBT-1_Datasheet_v2_0.pdf: "38.5 mm long, 18 mm wide, and 4.5 mm high" (Ameridroid agrees). The pack format's smallest size is 10 mm, so the height is raised to 10. |
| `zbt2_connect` | Home Assistant Connect ZBT-2 (Zigbee / Thread) | 83 x 83 x 179 | maker | https://www.home-assistant.io/connect/zbt-2/ ; overall size with the 164 mm antenna. The 83 x 83 footprint is the maker's figure; the body inside it is our drawing |
| `sonoff_zbdongle_e` | SONOFF ZBDongle-E | 75 x 25.5 x 13.5 | maker | https://sonoff.tech/de-eu/products/sonoff-zigbee-3-0-usb-dongle-plus-zbdongle-e (figure read from a search summary; the page itself would not load) |
| `sonoff_zbdongle_p` | SONOFF ZBDongle-P | 87 x 25.5 x 13.5 | retailer (two agree) | 87 x 25.5 x 13.5 at https://openelab.io/it/products/sonoff-zbdongle-p and a second listing (lesalexiens.fr); the antenna is not included. Beware: the ZBDongle-E is 75 long and some listings mix them up. |
| `slzb_06` | SMLIGHT SLZB-06 | 160 x 24 x 28 | maker (axes assumed) | https://smlight.tech/us/slzb-06 gives "160 x 24 x 28 mm" (via search result; page order assumed L x W x H); was 160 x 22 x 24. The antenna is separate (192 x 12 x 12). |
| `hue_bridge` | Philips Hue Bridge v2 | 90.9 x 90.6 x 26 | maker | https://hk.shop.lighting.philips.com/products/hue-bridge |
| `sure_petcare_hub` | Sure Petcare Hub | 90 x 90 x 69 | maker (W, H) | https://www.surepetcare.com/en-gb/support/hub gives 90 wide, 69 high; the depth (90) is our assumption. The newer Hub Connect is about 145 x 110 x 115 (Jeffers), which is not this model. Checked in #133. |
| `ikea_dirigera` | IKEA DIRIGERA hub | 112 x 112 x 27 | maker | https://www.ikea.com/sg/en/p/-50503409 (112 mm diameter) |
| `mini_pc_nuc_slim` | NUC slim (ASUS NUC 14 Pro slim) | 117 x 112 x 37 | maker | https://www.asus.com/displays-desktops/nucs/nuc-mini-pcs/asus-nuc-14-pro/techspec/ |
| `mini_pc_nuc_tall` | NUC tall (ASUS NUC 14 Pro tall) | 117 x 112 x 54 | maker | same page |
| `mini_pc_thinkcentre_tiny` | Lenovo ThinkCentre M720q Tiny | 179 x 183 x 34.5 | retailer (two agree) | 179 x 182.9 x 34.5 at SHI and BT Business Direct (psref.lenovo.com returned nothing); also https://www.refurbed.de/en-de/p/lenovo-thinkcentre-m720q-tiny/128048/ |
| `mini_pc_beelink` | Beelink Mini S12 Pro | 115 x 102 x 39 | maker | https://www.bee-link.com/catalog/product/buy?id=434 |
| `nas_4_bay` | Synology DS423+ / DS923+ (existing item, depth corrected from 232 to 223) | 199 x 223 x 166 | retailer (two agree) | 199 x 223 x 166: Synology spec order is H x W x D = 166 x 199 x 223 (DS923+, retailers); https://nascompares.com/news/synology-ds923-4-bay-10gbe-nas-now-officially-released/. DS423+ shares the chassis (not separately checked). |
| `nas_2_bay` | Synology DS224+ (existing item) | 108 x 232 x 165 | maker | https://global.download.synology.com/download/Document/Hardware/ProductSpec/DiskStation/24-year/DS224+/enu/Product_Spec_DS224+_enu.pdf: 165 x 108 x 232.2 (H x W x D), confirmed in #133 |
| `nas_5_bay` | Synology DS1522+ | 230 x 223 x 166 | retailer (two agree) | Micro Center and Bechtle agree: 230 W x 223 D x 166 H; https://www.microcenter.com/quickview/682049/synology-diskstation-ds1522-5-bay-diskless-desktop-nas |
| `wifi_access_point` | UniFi U6 Lite (existing item) | 160 x 160 x 33 | maker | https://techspecs.ui.com/unifi/wifi/u6-lite |
| `wifi_access_point_pro` | UniFi U6 Pro | 197 x 197 x 35 | maker | https://techspecs.ui.com/unifi/wifi/u6-pro |
| `wifi_access_point_u7_pro` | UniFi U7 Pro | 206 x 206 x 46 | maker | https://techspecs.ui.com/unifi/wifi/u7-pro |
| `wifi_access_point_u7_wall` | UniFi U7 Pro Wall | 103 x 36 x 150 | maker | https://techspecs.ui.com/unifi/wifi/u7-pro-wall lists 150 x 103 x 36; which side is up is our assumption |
| `wifi_access_point_in_wall` | UniFi U6 In-Wall | 96 x 31.2 x 139.7 | maker | https://techspecs.ui.com/unifi/wifi/u6-iw lists 139.7 x 96 x 31.2; which side is up is our assumption |

Colours of the UniFi gear are not on the maker pages; white is our assumption. The existing items (routers, mesh node,
switches, 6-bay NAS tower, UPS) are untouched. The existing large ceiling AP (210 x 45) is left as it is.

## Search words

`frontend/src/vocabulary.ts` makes these words equal: `pi` / `raspberry pi` / `rpi`; `zigbee stick` / `zigbee dongle` /
`zigbee usb stick` / `zigbee coordinator` / `coordinator` / `usb stick`; `mini pc` / `nuc`. Tags carry the model names
(`skyconnect`, `d1 mini`, `thread dongle`, `u7`, `dream router`, ...).
