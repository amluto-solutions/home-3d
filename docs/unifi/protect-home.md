# UniFi Protect doorbells, chimes and sensors (#145)

Items in `amluto.unifi` (`tech/` and `network/` folders, which the library requires to be section names). Sizes are W x D x H in mm (D = how far it stands out), read from the maker's
tech specs (techspecs.ui.com) and the store.ui.com category pages on 30 October 2026. Status: `maker` = the maker page
gives the figures; `unverified` = the maker gives three numbers but not which axis is which, so we guessed, or the product
may be discontinued. Only the device body is drawn, not mounts or magnets. Modelled from simple shapes; no maker pictures
or 3D files.

| Item id | Device | Size (mm) | Status | Source / note |
| --- | --- | --- | --- | --- |
| `unifi_g4_doorbell_pro` | UniFi G4 Doorbell Pro | 51.7 x 28.7 x 160.6 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/uvc-g4-doorbell-pro  |
| `unifi_g4_doorbell_pro_poe` | UniFi G4 Doorbell Pro PoE | 51.7 x 35.1 x 160.6 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/uvc-g4-doorbell-pro-poe-kit Doorbell only (the kit's camera, 35.1 deep); the kit's chime is `unifi_chime_poe`. |
| `unifi_g5_doorbell_pro` | UniFi G5 Doorbell Pro | 51.7 x 28.7 x 160.6 | approximate | Ubiquiti publishes no size; shape and size taken from the G4 Doorbell Pro (#303) |
| `unifi_doorbell_lite` | UniFi Doorbell Lite | 40 x 26.4 x 137 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/uvc-doorbell-lite  |
| `unifi_chime_wifi` | UniFi WiFi Smart Chime | 62 x 50.6 x 62 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/up-chime-us Plug-in unit, 62 diameter x 50.6 deep without the prong. |
| `unifi_chime_poe` | UniFi PoE Smart Chime | 62 x 54 x 62 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/uacc-chime-poe 62 diameter x 54 deep (on-wall mount 20.2 deep). |
| `unifi_usl_entry` | UniFi Entry Sensor | 23.5 x 22.5 x 75.5 | maker | https://techspecs.ui.com/unifi/physical-security/usl-entry Spec 75.5 x 23.5 x 22.5, drawn standing on a door frame; the magnet (39 x 15.1 x 12.9) is not drawn. |
| `unifi_usl_entry_r` | UniFi Recessed Entry Sensor | 22 x 44 x 74.5 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/usl-entry-r Spec 44 x 22 x 74.5; which of 44/22 is depth is assumed. Magnet not drawn. |
| `unifi_usl_motion` | UniFi Motion Sensor | 22.5 x 24.7 x 93.5 | maker | https://techspecs.ui.com/unifi/physical-security/usl-motion 93.5 x 22.5 x 24.7 with wall mount, drawn upright. |
| `unifi_usl_glassbreak` | UniFi Glass Break Sensor | 22.5 x 24.8 x 134.5 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/usl-glassbreak 134.5 x 22.5 x 24.8 with wall mount, drawn upright. |
| `unifi_usl_environmental` | UniFi Environmental Sensor | 53 x 23.5 x 49 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/usl-environmental Device 53 x 49 x 23.5 (mount 41.3 x 36.6 x 3.1); W x H x D order assumed. |
| `unifi_up_sense` | UniFi All-In-One Sensor | 24 x 24 x 83.5 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/up-sense 24 diameter x 83.5, drawn standing. |
| `unifi_usl_smoke` | UniFi Smoke and CO Alarm | 120 x 48.5 x 120 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/usl-smoke 120 diameter x 48.5. |
| `unifi_up_airquality` | UniFi Vape Detection and Air Quality Sensor | 93 x 40.5 x 93 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/up-airquality 93 diameter x 40.5. |
| `unifi_usl_fob` | UniFi Remote Control KeyFob | 35 x 18.5 x 67 | unverified | https://techspecs.ui.com/unifi/cameras-nvrs/usl-fob Spec 67 x 35 x 18.5; axes guessed (67 long, 18.5 thick), drawn standing on its edge. |
| `unifi_usl_relay` | UniFi Relay | 50 x 28 x 47.6 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/usl-relay 50 x 47.6 x 28, W x H x D assumed. |
| `unifi_usl_siren` | UniFi Siren | 139.9 x 35 x 139.9 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/usl-siren  |
| `unifi_up_siren_poe` | UniFi Siren PoE | 139.9 x 35 x 139.9 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/up-siren-poe  |
| `unifi_up_floodlight` | UniFi Floodlight | 135 x 50 x 65 | unverified | https://techspecs.ui.com/unifi/cameras-nvrs/up-floodlight Spec reads 135 x 65 x 50; which of 65/50 is height and which depth is our guess. |
| `unifi_up_viewport` | UniFi Protect Viewport | 157 x 37 x 52 | unverified | https://techspecs.ui.com/unifi/cameras-nvrs/ufp-viewport Spec reads 157 x 52 x 37; axes (52 high, 37 deep) are our guess. |
| `unifi_up_ai_speaker` | UniFi AI Speaker | 268.5 x 83.5 x 192 | unverified | https://techspecs.ui.com/unifi/cameras-nvrs/up-ai-speaker 268.5 x 192 x 83.5; axes (192 high, 83.5 deep) are our guess. |
| `unifi_up_alarmhub_kit` | UniFi Alarm Hub Kit | 379 x 105 x 355 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/up-alarmhub-kit 379 x 355 x 105, W x H x D assumed. |
| `unifi_usl_gateway` | UniFi SuperLink Gateway | 159.3 x 26 x 81.9 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/usl-gateway 159.3 x 81.9 x 26 with antenna, W x H x D assumed. |
| `unifi_unvr_instant` | UniFi NVR Instant | 220 x 220 x 47 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/unvr-instant Desktop unit 220 x 220 x 47, drawn flat. |
| `unifi_cloud_key_plus` | UniFi Cloud Key Plus | 131.2 x 134.2 x 27.1 | unverified | https://techspecs.ui.com/unifi/cameras-nvrs/uck-g2-plus Spec reads 131.2 x 27.1 x 134.2; axes guessed (27.1 thick). May be discontinued. |

Skipped, already in the library: `unifi_g6_entry` (amluto.office). Generic doorbells in amluto.devices are not UniFi, so no clash.
Left out: cameras and rack NVRs (other agents), AI Horn Speaker, AI Theta Hub, AI Key, AI Port, SuperLink High-Gain Antenna, SuperLink Gateway HA, Keypad-type Access products.
