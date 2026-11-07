# UniFi Protect AI and PTZ cameras checklist (#145)

Items in `amluto.unifi/tech (protect-ai items)`. Sizes are W x D x H in mm (the item's size x 1000). Status: `maker` = a ui.com
page gives the figure (techspecs.ui.com, read 30 Oct 2026); `retailer` = shops or datasheet mirrors; `unverified` = our
estimate. Shapes are our own simple models.

Already in other packs (not repeated): `unifi_ai_360`, `unifi_g5_ptz`, `unifi_g3_flex`, `unifi_g4_dome`,
`unifi_g4_instant`, `unifi_g4_pro`, `unifi_g5_turret`, `unifi_g6_entry`.
Not added: AI Bullet (no longer on store.ui.com) and Enterprise cameras (none listed on the store).

Camera matching: AI models without a number in their name ("ai pro", "ai dome", "ai dslr", "ai turret", "ai lpr",
"ai ptz") are tagged with the name, but `matchCameraModel` only counts tags that contain a digit, so those are not found
from Home Assistant until that rule changes. The Multi Sensor, Theta lens, G6 PTZ items carry a digit and match.

| Item id | Device | Size (mm) | Status | Source / note |
| --- | --- | --- | --- | --- |
| `unifi_ai_pro` | UniFi AI Pro camera | 86 x 113 x 175 | maker (diameter, body length, height with mount) | https://techspecs.ui.com/unifi/cameras-nvrs/uvc-ai-pro: dia 86, body 112.6, with mount 175.3. Depth 113 is the body length; the bracket depth is not given, so the bracket is our shape |
| `unifi_ai_turret` | UniFi AI Turret camera | 118 x 118 x 111 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/uvc-ai-turret: dia 118 x 111 |
| `unifi_ai_dome` | UniFi AI Dome camera | 118 x 118 x 90.8 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/uvc-ai-dome: dia 118 x 90.8 |
| `unifi_ai_multi_sensor_4` | UniFi AI Multi Sensor 4 camera | 255 x 255 x 105 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/uvc-ai-ms-4: dia 255 x 105 |
| `unifi_ai_multi_sensor_2` | UniFi AI Multi Sensor 2 camera | 218 x 132 x 93.5 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/uvc-ai-ms-2: 218 x 132 x 93.5 |
| `unifi_ai_lpr` | UniFi AI LPR camera | 130 x 151.4 x 302.9 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/uvc-ai-lpr: 130 x 151.4 x 302.9 |
| `unifi_ai_dslr` | UniFi AI DSLR camera (wide) | 80 x 176 x 153 | maker (body, height with mount); depth is body plus lens, our sum | https://techspecs.ui.com/unifi/physical-security/uvc-ai-dslr (via search summary): body dia 80 x 89, with mount 153, 17 mm lens dia 68.2 x 87 |
| `unifi_ai_dslr_long_distance` | UniFi AI DSLR camera (long distance) | 80 x 176 x 153 | maker (body, height with mount); depth is body plus lens, our sum | https://techspecs.ui.com/unifi/physical-security/uvc-ai-dslr (via search summary): body dia 80 x 89, with mount 153, 45 mm lens dia 70 x 84.9 |
| `unifi_ai_theta_lens_360` | UniFi AI Theta Pro 360 lens | 36.6 x 58.9 x 36.6 | maker (50) / retailer (360) | dia 36.6 x 58.9: techspecs.ui.com/unifi/other/uvc-ai-theta-prolens50; the ProLens360 listing (allnet.de) gives the same |
| `unifi_ai_theta_lens_50` | UniFi AI Theta Pro long-range lens | 36.6 x 58.9 x 36.6 | maker (50) / retailer (360) | dia 36.6 x 58.9: techspecs.ui.com/unifi/other/uvc-ai-theta-prolens50; the ProLens360 listing (allnet.de) gives the same |
| `unifi_ai_theta_hub` | UniFi AI Theta Pro hub | 140 x 70 x 38 | retailer (datasheet mirror) | 140 x 70 x 38 on the Ubiquiti datasheet mirror (netxl.com) and retailers; official page not read in full |
| `unifi_ai_ptz_industrial` | UniFi AI PTZ Industrial camera | 207 x 224 x 341 | maker | https://techspecs.ui.com/unifi/cameras-nvrs/uvc-ai-ptz: 207 x 223.7 x 341.3 |
| `unifi_ai_ptz_precision` | UniFi AI PTZ Precision camera | 241 x 372 x 349 | maker (axes mixed) | https://techspecs.ui.com/unifi/cameras-nvrs/uvc-ai-ptz-precision: without mount dia 241 x 349; with mount 372 x 241 x 299. We use width 241, depth 372 with the arm, height 349; the axes of the mounted figure are assumed |
| `unifi_g6_ptz` | UniFi G6 PTZ camera | 107.2 x 111 x 230.2 | maker (with arm mount; axes assumed) | https://techspecs.ui.com/unifi/cameras-nvrs/uvc-g6-ptz: with mount dia 107.2 x 111 x 230.2, read as W x D x H |
