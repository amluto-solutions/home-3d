# Rack frames checklist (#116)

Every empty rack in the IT & network pack (`amluto.it`, `network/rack_*.json`), with its external size
(W x D x H, mm), its U count and where the size comes from. The files are written by `node tools/rack-frames.ts` from
`frontend/src/rack-catalogue.ts`; edit the list there, not the JSON.

Status: **verified** = a maker page (lanberg.eu product pages open fine) or two or more retailer listings agree; **single** = one listing; **derived** = worked out from a sibling model (no listing found for
that exact size), check before relying on it; **generic** = a typical size, no specific product.
Retailer listings often disagree by 5-10 mm on height (castors, lids); the figure below is the one most listings give.
U space is 44.45 mm per U and sits inside the height with room for plinth or castors.

## 10-inch (254 mm panel)

| id | U | W x D x H | Source | Status |
|---|---|---|---|---|
| `rack_mini_10in_4u` | 4 | 280 x 200 x 274 | DeskPi RackMate T0, listed at Pi Hut and OZ Robotics (280x200x274 external) | verified |
| `rack_mini_10in_6u` | 6 | 280 x 200 x 320 | #112 starter, DeskPi-class footprint; no 6U DeskPi exists | generic |
| `rack_mini_10in_8u` | 8 | 280 x 200 x 406 | DeskPi RackMate T1: cnx-software, PLE, OZ Robotics (406 x 280 x 200) | verified |
| `rack_wall_frame_10in_4u` | 4 | 280 x 300 x 233 | Lanberg OR10-2304-B open rack 10" 4U (lanberg.eu/product/open-rack-10-4u-280x300-black-lanberg: external 280 / 300 / 233, "can be wall-mounted or placed on a countertop"); was 280 x 150 x 221, a derived figure | verified (maker) |
| `rack_wall_frame_10in_6u` | 6 | 280 x 300 x 322 | Lanberg OR10-2306-S (lanberg.eu/product/open-rack-10-6u-280x300-grey-lanberg: 280 / 300 / 322); was 280 x 150 x 310 | verified (maker) |
| `rack_wall_frame_10in_9u` | 9 | 280 x 300 x 455 | Lanberg OR10-2309-S (lanberg.eu/product/open-rack-10-9u-280x300-grey-lanberg: 280 / 300 / 455); was 280 x 150 x 443 | verified (maker) |
| `rack_wall_cabinet_10in_6u` | 6 | 280 x 310 x 336 | Lanberg WF10-2306 (Aspen, Proshop DK) | verified |
| `rack_wall_cabinet_10in_9u` | 9 | 280 x 310 x 469 | Lanberg WF10-2309 (Aspen, Skroutz) | verified |

Other 10" wall cabinets (LogiLink W66Z30, Roline) are 312-320 x 300 x 312-330: not used.

## 19-inch desktop and wall frames (open)

| id | U | W x D x H | Source | Status |
|---|---|---|---|---|
| `rack_desktop_frame_12u` | 12 | 504 x 292 x 584 | StarTech RK12OD, 2-post desktop (SHI, Brokerbin, IP Security Depot) | verified |
| `rack_desktop_frame_9u` | 9 | 504 x 292 x 451 | RK12OD less 3U (133 mm). StarTech makes no 9U desktop frame (only RK8OD and RK12OD); a CNAweb 9U exists but no size was found | derived, unverified |
| `rack_desktop_frame_6u` | 6 | 508 x 292 x 330 | L-com LC-2POST-6UDSK-10-32 6U desktop 2-post frame (l-com.com: 20 in wide, 11.5 in long, 13 in high, converted); was 504 x 292 x 317, derived. StarTech has no 6U | single (one maker page, inches) |
| `rack_wall_frame_9u` | 9 | 551 x 457 x 541 | StarTech RK919WALLO 9U (fleetnetwork.ca 21.70 x 18 x 21.30 in; RS lists 540 high); was 504 x 305 x 508, derived. StarTech has no 12"-deep 9U, so this is the 18" deep product | verified (two listings agree on height) |
| `rack_wall_frame_12u` | 12 | 504 x 305 x 641 | StarTech RK12WALLO, 12" deep (e-nitiative, Area9: 502.9 x 304.8 x 640.1) | verified |
| `rack_wall_frame_6u` | 6 | 555 x 457 x 407 | StarTech RK619WALLO 6U (fleetnetwork.ca 21.85 x 18 x 16.02 in; RS lists 407); was 504 x 305 x 374, derived. 18" deep, as the 9U | verified (two listings agree on height) |

## 19-inch wall cabinets (glass door)

Lanberg WF01 series (600 wide). The 450-deep range:

| id | U | W x D x H | Source | Status |
|---|---|---|---|---|
| `rack_wall_cabinet_4u` | 4 | 600 x 450 x 290 | WF01-6404: Galaxus and Inception UK say 290.1, BigBuy 285 | verified |
| `rack_wall_cabinet_6u` | 6 | 600 x 450 x 379 | WF01-6406: Skroutz, Inception UK (379) | verified |
| `rack_wall_cabinet_9u` | 9 | 600 x 450 x 500 | #112 starter. Lanberg WF01-6409 lists 501-512 (eBay 507, PC Box 512), so the starter is 7-12 mm short | verified (starter size kept) |
| `rack_wall_cabinet_12u` | 12 | 600 x 450 x 645 | WF01-6412: Lanberg 645.7 (grey), others 635-640 | verified |
| `rack_wall_cabinet_15u` | 15 | 600 x 450 x 774 | WF01-6415-10B (lanberg.eu/en/produkt/WF01-6415-10B: 600 x 450 x 774; Proshop SE agrees) | verified (maker) |

Deep range, 600 x 600 (the ticket says 550 deep; Lanberg's deep wall range is 600):

| id | U | W x D x H | Source | Status |
|---|---|---|---|---|
| `rack_wall_cabinet_deep_9u` | 9 | 600 x 600 x 512 | WF01-6609: Inception UK 512.4, others 501-507 | verified |
| `rack_wall_cabinet_deep_15u` | 15 | 600 x 600 x 774 | Lanberg WF01-6615-10B (lanberg.eu/en/produkt/WF01-6615-10B: 600 x 600 x 774, working depth 529.5); the 450-deep WF01-6415-10B is also 774 | verified (maker) |

## 19-inch floor cabinets

Door types follow the common retail option (glass or mesh); heights include castors. All rails sit on a 100 mm plinth in the model.

| id | U | W x D x H | Source | Status |
|---|---|---|---|---|
| `rack_floor_cabinet_18u` | 18 | 600 x 600 x 973 | Lanberg FF01-6618-12B (lanberg.eu: 973.2 with castors, 900.2 without) | verified (maker) |
| `rack_floor_cabinet_22u` | 22 | 600 x 600 x 1159 | Lanberg FF01-6622-12B (lanberg.eu: 600 x 600 x 1159, 1080 without castors); was 1160 from a CPC listing | verified (maker) |
| `rack_floor_cabinet_27u` | 27 | 600 x 600 x 1381 | Lanberg FF01-6627-12B (lanberg.eu: 600 x 600 x 1381, 1302 without castors); was 600 x 1000 x 1370 from a Broadberry note. Other 27U Lanberg variants are ~1461 high | verified (maker) |
| `rack_floor_cabinet_32u` | 32 | 600 x 800 x 1603 | Lanberg FF01-6832-12B (lanberg.eu: 600 x 800 x 1603, 1524 without castors); the 1610 and 1676 listings are retailer or glass-door variants | verified (maker) |
| `rack_floor_cabinet_42u` | 42 | 600 x 1000 x 2050 | #112 starter; Lanberg FF01-6042 is 2047.5 (Polycomp, BigBuy); APC NetShelter SX AR3100 is 600 x 1070 x 1991 | verified (retailers; starter size kept) |
| `rack_floor_cabinet_wide_42u` | 42 | 800 x 1000 x 2047.5 | Lanberg FF01-8042-12B (lanberg.eu: 800 x 1000 x 2047.5, 1968.5 without castors); glass/LCD V2 variants are ~2121-2127 | verified (maker) |
| `rack_floor_cabinet_deep_47u` | 47 | 800 x 1200 x 2350 | Lanberg FF01-8247-12BL (lanberg.eu: 800 x 1200 x 2350) | verified (maker) |

No 48U model is in the list (Lanberg's range is 47U).

## Open frames, relay racks and AV

| id | U | W x D x H | Source | Status |
|---|---|---|---|---|
| `rack_open_frame_22u` | 22 | 600 x 800 x 1229 | Lanberg OR01-6822-B (German retailer; Proshop DK 60 x 80 x 122.9) | verified |
| `rack_open_frame_42u` | 42 | 604 x 1048 x 2040 | StarTech 4POSTRACK42: fleetnetwork.ca 23.80 x 41.30 (overall length) x 80.30 in, Icecat 604 x 1048 x 2040; RS lists 1970 high (likely the frame without feet) and mounting depth max 1016. Was 600 x 1120 x 1970 | verified (two listings; RS height conflicts) |
| `rack_relay_42u` | 42 | 597 x 600 x 2008 | StarTech 2POSTRACK42: RS and Convergent 2008; fleetnetwork.ca says 2080 (23.50 x 23.60 x 81.90 in), probably with feet | conflicting, 2008 used |
| `rack_relay_25u` | 25 | 597 x 600 x 1252 | no 2-post 25U listing found (StarTech 2POSTRACK25 does not exist; the 25U is 4-post); 2POSTRACK42 less 17U (756 mm) | derived, unverified |
| `rack_av_console_12u` | 12 | 543 x 600 x 785 | Penn Elcom R12C600 12U contractor rack: older note says 785 high, search snippets of Penn Elcom say about 634 high; the page was blocked. A true AV console with sloped front and castors was not found | conflicting, single |

Checked in ticket #133 (30 Oct 2026).

## Things to check by hand

- Every `derived`, `generic` and `unverified` row above (left: the 9U desktop frame, the 25U relay rack, the 6U generic mini rack, the AV rack).
- Wall racks hang with their centre 0.9-1.3 m above the floor (`wall_y`); adjust in the editor.
- Mount depths (`mount_depth`) are left to the item's depth minus the cabinet insets, not taken from the makers' "usable depth".
