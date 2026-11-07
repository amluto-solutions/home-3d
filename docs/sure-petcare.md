# Sure Petcare checklist (#141)

Sure Petcare products in `amluto.household` (group `pets`), checked against maker pages and retailer listings on
30 October 2026. Sizes are W x D x H in mm (the item's `size` x 1000). We model each device ourselves from simple
shapes; no maker pictures or 3D files are used. The Sure Petcare hub is not repeated here: it is `sure_petcare_hub` in
`amluto.it` (see [it-devices.md](it-devices.md)). Every item carries the tags `sure petcare` and `surepet`, so a
search for either shows the hub and these items together.

Status: `maker` = a manufacturer page gives the figure; `retailer` = only shops give it; `unverified` = our estimate.

Matching a Home Assistant device: the Sure Petcare integration names its devices after the product (flap, feeder,
Felaqua, hub, pet), so each item is tagged with its product words (`sureflap`, `surefeed`, `felaqua`, `animo`, `pet
door`, `cat flap`, `feeder`, `water bowl`, `connect`).

| Item id | Product | Size (mm) | Status | Source / note |
| --- | --- | --- | --- | --- |
| `sureflap_cat_flap` | SureFlap Microchip Cat Flap | 210 x 70 x 210 | maker (tunnel), retailer (frame) | Tunnel depth 70 and the 142 x 120 opening at https://www.surepetcare.com/support/microchip-cat-flap ; the 210 x 210 outer frame is from a retailer (https://ipet.ch/en/sure-petcare-sureflap-microchip-cat-flap-connect). Depth is the tunnel only, the frame sticks out a little more (estimated). |
| `sureflap_cat_flap_connect` | SureFlap Microchip Cat Flap Connect | 210 x 70 x 210 | retailer | Same body as the non-Connect flap (ipet.ch, petstock); listed with it as one `family` and a Connect variant |
| `sureflap_pet_door` | SureFlap Microchip Pet Door | 262 x 70 x 281 | maker | https://surepetcare.com/support/microchip-pet-door : frame 262 x 281, tunnel 70, opening 178 x 170, cut-out 207 x 234 |
| `sureflap_pet_door_connect` | SureFlap Microchip Pet Door Connect | 262 x 70 x 281 | retailer | Same frame as the Pet Door; cut-out 207 x 234 (zooplus, Currys listings) |
| `surefeed_pet_feeder` | SureFeed Microchip Pet Feeder | 230 x 320 x 200 | maker | https://surepetcare.com/pl-pl/support/microchip-pet-feeder-connect gives 200 H x 230 W x 320 D for the Connect; a used-unit ad (finn.no) matches. The non-Connect feeder is the same shape (assumed) |
| `surefeed_pet_feeder_connect` | SureFeed Microchip Pet Feeder Connect | 230 x 320 x 200 | maker | same page |
| `felaqua_connect` | Felaqua Connect water bowl | 220 x 283 x 266 | unverified (W) | https://www.surepetcare.com/en-gb/support/felaqua-connect gives height 266 (with reservoir and bowl) and depth 283; no width was found, 220 is our estimate |
| `animo_activity_monitor` | Animo activity monitor | 37 x 11.5 x 37 | maker | https://www.surepetcare.com/en-us/animo : 37 mm across, 11.5 mm deep, 22 g; fits collars 12-30 mm wide. Sits on a surface (a collar or a surface; there is no collar item) |

Unverified: the Felaqua Connect width, the non-Connect feeder's shape, the frame depth of the flaps and the looks of every
item (shapes are our drawing, not compared with photos).
