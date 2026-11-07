# 3D printer models checklist

Shared by the printer tickets #102 (Bambu Lab), #103 (Prusa), #104 (other FDM makers) and #105 (resin, wash and cure, workshop kit).
Each ticket updates only its own rows: set `status` to `done` and fill `size` and `source`. Add rows rather than editing other batches' rows.

All items live in `custom_components/home_3d/bundled_packs/amluto.makers/tech/`. Every printer id contains `3d_printer`
(live progress ring, chamber light, camera tap); enclosed printers have a chamber light part (`glow`), open ones a nozzle or toolhead LED.
Items are modelled from simple shapes in this repo; no maker images or 3D files. Sizes are the maker's outer dimensions in mm (W x D x H, including spool holder where it is part of the frame).

Source for the Bambu rows: the maker's tech-spec pages (bambulab.com/en/<model>/tech-specs and store.bambulab.com), fetched with a browser user agent in ticket #133. The AMS add-on sizes below are the maker's "Product Size" / "Body Dimensions" figures.

Source for the #104 and #105 rows: checked in ticket #133 (30 Oct 2026). Maker spec pages mostly returned HTTP 429 or 403 to automated fetching, so most figures come from 3DJake / Micro Center / other retailer spec tables, reviews, or maker figures quoted in search results; each row says which, and how many sources agree. Rows marked unverified have no usable source; the reason is in the row. Multi-colour units (CFS, ACE Pro, CANVAS) sit on top and add their height as before; their own sizes found in #133 (CFS 379 x 314 x 276, ACE Pro 366 x 283 x 235, CANVAS 168 x 68 x 95) are not yet used for the variant offsets.

| Model | Maker | Type | Size (mm) | Batch | Status | Notes / source |
| --- | --- | --- | --- | --- | --- | --- |
| Bambu Lab X1 Carbon | Bambu Lab | FDM | 389 x 389 x 457 (verified) | #102 | done | `bambu_x1_carbon_3d_printer` + variants. Discontinued 2026; AMS. Source: bambulab.com/en/x1 spec table |
| Bambu Lab X1E | Bambu Lab | FDM | 389 x 389 x 457 (unverified (not rechecked)) | #102 | done | `bambu_x1e_3d_printer` + variants. Discontinued; heated chamber; AMS. Source: same body as the X1 Carbon assumed |
| Bambu Lab P1S | Bambu Lab | FDM | 389 x 389 x 458 (verified) | #102 | done | `bambu_p1s_3d_printer` + variants. AMS. Source: store.bambulab.com/products/p1s |
| Bambu Lab P1P | Bambu Lab | FDM | 386 x 389 x 458 (verified) | #102 | done | `bambu_p1p_3d_printer` + variants. open frame; AMS; camera variant. Source: store.bambulab.com/products/p1s (P1P line) |
| Bambu Lab P2S | Bambu Lab | FDM | 392 x 406 x 478 (verified) | #102 | done | `bambu_p2s_3d_printer` + variants. AMS 2 Pro. Source: store.bambulab.com/products/p2s |
| Bambu Lab X2D | Bambu Lab | FDM | 392 x 406 x 478 (unverified (not rechecked)) | #102 | done | `bambu_x2d_3d_printer` + variants. AMS 2 Pro. Source: same as P2S assumed |
| Bambu Lab H2D | Bambu Lab | FDM | 492 x 514 x 626 (verified) | #102 | done | `bambu_h2d_3d_printer` + variants. AMS 2 Pro beside it. Source: bambulab.com/en/h2d/tech-specs |
| Bambu Lab H2D Pro | Bambu Lab | FDM | 492 x 514 x 626 (unverified (not rechecked)) | #102 | done | `bambu_h2d_pro_3d_printer` + variants. resellers only; AMS 2 Pro beside it. Source: same as H2D assumed |
| Bambu Lab H2S | Bambu Lab | FDM | 492 x 514 x 626 (verified) | #102 | done | `bambu_h2s_3d_printer` + variants. AMS 2 Pro beside it. Source: bambulab.com/en/h2s/tech-specs |
| Bambu Lab H2C | Bambu Lab | FDM | 492 x 514 x 626 (verified (two retailers)) | #102 | done | `bambu_h2c_3d_printer` + variants. AMS 2 Pro beside it. Source: Bambu store block shared with H2D/H2S; broadwaylifestyle.com and bnn.in.th agree on 492 x 514 x 626 |
| Bambu Lab A1 | Bambu Lab | FDM | 465 x 410 x 430 (verified) | #102 | done | `bambu_a1_3d_printer` + variants. AMS lite beside it; camera variant. Source: bambulab.com/en/a1/tech-specs and store.bambulab.com/products/a1 ("465*410*430"); old 385 wide retired |
| Bambu Lab A1 mini | Bambu Lab | FDM | 347 x 315 x 365 (verified) | #102 | done | `bambu_a1_mini_3d_printer` + variants. AMS lite beside it; camera variant. Source: bambulab.com/en/a1-mini/tech-specs (347*315*365) |
| Bambu Lab A2L | Bambu Lab | FDM | 544 x 529 x 505 (verified) | #102 | done | `bambu_a2l_3d_printer` + variants. AMS lite beside it; camera variant. Source: Bambu store page ("544*529*505") |
| Bambu Lab AMS | Bambu Lab | add-on | 360 x 260 x 255 (unverified (approx.)) | #102 | done | `bambu_ams`. Not a printer (no live state). Source: no Bambu page gives the original AMS size; only one third-party blog (368 x 283 x 224), not adopted |
| Bambu Lab AMS lite | Bambu Lab | add-on | 397 x 208 x 342 (verified) | #102 | done | `bambu_ams_lite`. Not a printer (no live state). Source: store.bambulab.com/products/ams-lite ("397*208*342"); was 290 x 230 x 300 |
| Bambu Lab AMS 2 Pro | Bambu Lab | add-on | 372 x 280 x 226 (verified) | #102 | done | `bambu_ams_2_pro`. Not a printer (no live state). Source: store.bambulab.com/products/ams-2-pro ("372*280*226"); was 360 x 270 x 260 |
| Bambu Lab AMS HT | Bambu Lab | add-on | 114 x 280 x 245 (verified) | #102 | done | `bambu_ams_ht`. Not a printer (no live state). single-spool dryer. Source: store.bambulab.com/products/ams-ht ("114*280*245"); was 170 x 300 x 240 |
| Prusa Core One | Prusa | FDM | 415 x 444 x 555 (verified) | #103 | done | `prusa_core_one_3d_printer` + camera variant. Enclosed CoreXY; 470 deep with the display. Prusa FAQ (help.prusa3d.com). Source: prusa3d.com/product/prusa-core-one ("415 x 444 x 555"); was 470 deep |
| Prusa Core One L | Prusa | FDM | 469 x 521 x 635 (verified) | #103 | done | `prusa_core_one_l_3d_printer` + camera variant. Enclosed CoreXY. From the Prusa FAQ page, whose table was jumbled; check. Source: prusa3d.com/product/prusa-core-one-l-2 ("469 x 521 x 635"), 3DJake agrees |
| Prusa MK4S | Prusa | FDM | 500 x 550 x 400 (verified) | #103 | done | `prusa_mk4s_3d_printer` + camera, MMU3 variants. Prusa FAQ. Source: prusa3d.com MK4S kit page (500 x 550 x 400, without spool) |
| Prusa MK4 | Prusa | FDM | 500 x 550 x 400 (verified (same frame as MK4S)) | #103 | done | `prusa_mk4_3d_printer` + camera, MMU3 variants. Same frame as MK4S (Prusa FAQ). Source: prusa3d.com MK4S page |
| Prusa MK3S+ | Prusa | FDM | 500 x 550 x 400 (unverified (assumed equal to MK4S)) | #103 | done | `prusa_mk3s_plus_3d_printer` + camera, MMU3 variants. Prusa lists the MK3.9/MK4 family only; MK3S+ size assumed equal. Source: no MK3S+ page checked |
| Prusa MINI+ | Prusa | FDM | 380 x 330 x 380 | #103 | done | `prusa_mini_3d_printer` + camera variant. Prusa FAQ |
| Prusa XL (1 toolhead) | Prusa | FDM | 700 x 720 x 900 (unverified axis order) | #103 | done | `prusa_xl_3d_printer` + camera variant. Open frame; Prusa FAQ. Source: prusa3d.com gives "~700 x 900 x 720" with no axis labels; retailers split on which is depth and height |
| Prusa XL (5 toolheads) | Prusa | FDM | 700 x 720 x 900 (unverified axis order) | #103 | done | `prusa_xl_5_3d_printer` + camera variant. Same outer size as the single head (Prusa FAQ). Source: as the single-toolhead XL |
| Prusa Enclosure | Prusa | FDM | 530 x 715 x 545 (verified) | #103 | done | `prusa_enclosure_3d_printer` (holds an MK4S) + camera, MMU3 variants. Prusa product page; 715 deep incl. outside LCD. Source: prusa3d.com/product/original-prusa-mk4-s-enclosure-6: 530 (w) x 545 (h) x 715 (d) with the LCD outside; 640 deep with it inside |
| Prusa MMU3 | Prusa | FDM | 330 x 220 x 150 (unverified (approx.)) | #103 | done | `prusa_mmu3` add-on, not a printer (no live state). Height from Prusa's +150 mm note; footprint estimated. Printer + MMU3 variants are under each printer. Source: neither prusa3d.com nor help.prusa3d.com gives MMU3 dimensions |
| Prusa SL1S Speed | Prusa | resin / wash+cure | 225 x 237 x 400 | #103 | done | `prusa_sl1s_speed_resin_3d_printer`. Prusa FAQ / Tom's Hardware |
| Prusa CW1S | Prusa | resin / wash+cure | 218 x 232 x 345 | #103 | done | `prusa_cw1s`. Not a printer (no `3d_printer` id). Prusa product page via retailer listings |
| Creality Ender-3 V2 | Creality | FDM | 475 x 470 x 620 (verified (retailers)) | #104 | done | `creality_ender_3_v2_3d_printer` + variants. camera variant. Source: getfpv, pmhobbycraft: "475 x 470 x 620" |
| Creality Ender-3 V3 | Creality | FDM | 358 x 374 x 498 (verified (3DJake + Creality via search)) | #104 | done | `creality_ender_3_v3_3d_printer` + variants. camera variant. Source: 3djake.com/creality-3d-printers-spare-parts/ender-3-v3 ("358x374x498"); was 495 x 478 x 620 |
| Creality Ender-3 V3 SE | Creality | FDM | 349 x 364 x 490 (verified (two retailers)) | #104 | done | `creality_ender_3_v3_se_3d_printer` + variants. camera variant. Source: 3djake.com .../ender-3-v3-se, 3dpros agree; was 440 x 440 x 620 |
| Creality Ender-3 V3 KE | Creality | FDM | 433 x 366 x 490 (verified (two+ retailers)) | #104 | done | `creality_ender_3_v3_ke_3d_printer` + variants. camera variant. Source: 3djake.com .../ender-3-v3-ke; was 440 x 440 x 620 |
| Creality Ender-5 | Creality | FDM | 500 x 500 x 650 (unverified (conflicting)) | #104 | done | `creality_ender_5_3d_printer` + variants. camera variant. Source: only Ender-5 Pro listings found (552 x 485 x 510), one other source 440 x 410 x 465; not adopted, current figure is an estimate |
| Creality K1 | Creality | FDM | 355 x 355 x 480 (verified (retailers)) | #104 | done | `creality_k1_3d_printer` + variants. camera variant. Source: 3djake.com .../k1c comparison table, Makerlab, IndiaMART agree |
| Creality K1C | Creality | FDM | 355 x 355 x 482 (verified) | #104 | done | `creality_k1c_3d_printer` + variants. built-in camera; CFS variant. Source: 3djake table; Creality K1C support page (via search) and Best Buy CA agree |
| Creality K1 Max | Creality | FDM | 435 x 462 x 526 (verified (retailers)) | #104 | done | `creality_k1_max_3d_printer` + variants. built-in camera; CFS variant. Source: 3djake table, Micro Center, PB Tech agree; was 495 high |
| Creality K2 Plus | Creality | FDM | 495 x 515 x 640 (verified (two retailers)) | #104 | done | `creality_k2_plus_3d_printer` + variants. built-in camera; CFS variant. Source: 3djake.com .../k2-plus, Micro Center (495.05 x 515.11 x 640); was 700 x 550 |
| Creality Hi | Creality | FDM | 409 x 392 x 477 (verified (retailers)) | #104 | done | `creality_hi_3d_printer` + variants. built-in camera; CFS variant. Source: 3djake.com .../hi-combo and others; was 450 x 430 x 520 |
| Snapmaker A350T | Snapmaker | FDM | 495 x 506 x 580 (verified (Snapmaker via search + Micro Center)) | #104 | done | `snapmaker_a350t_3d_printer` + variants. camera variant. Source: Micro Center 495.30 x 505.46 x 579.12; was 700 x 640 x 640 (enclosure is separate, 626 x 820 x 603) |
| Snapmaker J1S | Snapmaker | FDM | 539 x 401 x 464 (single retailer) | #104 | done | `snapmaker_j1s_3d_printer` + variants. camera variant. Source: matterhackers.com J1 listing (539 x 401 x 464); J1 family figure, S model not separately listed |
| Snapmaker U1 | Snapmaker | FDM | 584 x 499 x 730 (verified (retailers)) | #104 | done | `snapmaker_u1_3d_printer` + variants. built-in camera. Source: 3dprint.wiki/printers/snapmaker/u1, Micro Center, MakerLab agree; was 380 x 400 x 400 |
| Anycubic Kobra 3 | Anycubic | FDM | 453 x 505 x 483 (verified (maker store + 3DJake)) | #104 | done | `anycubic_kobra_3_3d_printer` + variants. camera variant; ACE Pro variant. Source: store.anycubic.com/products/anycubic-kobra-3 "452.9*504.7*483 (W*D*H)"; was 460 x 450 x 620 |
| Anycubic Kobra 3 Max | Anycubic | FDM | 706 x 640 x 753 (verified (maker + 3DJake)) | #104 | done | `anycubic_kobra_3_max_3d_printer` + variants. camera variant. Source: uk.anycubic.com/products/kobra-3-max "706*640*753"; axis order not labelled |
| Anycubic Kobra S1 | Anycubic | FDM | 400 x 410 x 490 (verified (maker)) | #104 | done | `anycubic_kobra_s1_3d_printer` + variants. built-in camera; ACE Pro variant. Source: store.anycubic.com/products/kobra-s1 "400*410*490"; axes unlabelled |
| Elegoo Neptune 4 | Elegoo | FDM | 475 x 445 x 515 (verified (shared body with the Pro; two+ retailers)) | #104 | done | `elegoo_neptune_4_3d_printer` + variants. camera variant. Source: 3djake.ch Neptune 4 Pro, TechRadar: 475 x 445 x 515 without spool holder; was 620 high |
| Elegoo Neptune 4 Pro | Elegoo | FDM | 475 x 445 x 515 (verified (two+ retailers)) | #104 | done | `elegoo_neptune_4_pro_3d_printer` + variants. camera variant. Source: 3djake.ch, TechRadar, Besomi: without spool holder |
| Elegoo Neptune 4 Plus | Elegoo | FDM | 578 x 533 x 640 (verified (two retailers)) | #104 | done | `elegoo_neptune_4_plus_3d_printer` + variants. camera variant. Source: Adorama, Marvle 3D; a review lists 533 x 517 x 638 |
| Elegoo Neptune 4 Max | Elegoo | FDM | 658 x 632 x 740 (single retailer) | #104 | done | `elegoo_neptune_4_max_3d_printer` + variants. camera variant. Source: st.robu.in product page |
| Elegoo Centauri Carbon | Elegoo | FDM | 398 x 404 x 490 (verified (review + retailer)) | #104 | done | `elegoo_centauri_carbon_3d_printer` + variants. built-in camera; CANVAS variant. Source: cnx-software review; was 430 high |
| Qidi Q1 Pro | Qidi | FDM | 477 x 467 x 489 (verified (maker + review)) | #104 | done | `qidi_q1_pro_3d_printer` + variants. built-in camera. Source: qidi3d.com/products/q1-pro "477*467*489"; discontinued, replaced by the Q2 |
| Qidi Plus 4 | Qidi | FDM | 505 x 487 x 550 (verified (maker techspecs)) | #104 | done | `qidi_plus_4_3d_printer` + variants. built-in camera. Source: eu.qidi3d.com/pages/qidi-plus-4-techspecs |
| Qidi X-Max 3 | Qidi | FDM | 553 x 553 x 601 (verified (maker)) | #104 | done | `qidi_x_max_3_3d_printer` + variants. built-in camera. Source: qidi3d.com X-Max 3 page (W x D x H) |
| Voron 2.4 (350) | Voron (kit) | FDM | 640 x 640 x 760 (unverified) | #104 | done | `voron_2_4_350_3d_printer` + variants. camera variant. Source: no official outer size; LDO cut list gives a bare frame of ~510 x 510 x 530 (no feet, panels, spool holder); our 640 x 640 x 760 is an estimate including those |
| Voron Trident (300) | Voron (kit) | FDM | 460 x 460 x 500 (verified (two retailers + cut list)) | #104 | done | `voron_trident_300_3d_printer` + variants. camera variant. Source: matterhackers LDO Trident kit, filament2print: "~460 x 460 x 500" |
| Voron 0.2 | Voron (kit) | FDM | 320 x 320 x 360 (unverified) | #104 | done | `voron_v0_2_3d_printer` + variants. camera variant. Source: only one listing (matterhackers, 250 x 360 x 365 with spool holder), implausible footprint; not adopted |
| Sovol SV06 | Sovol | FDM | 497 x 388 x 611 (single (review)) | #104 | done | `sovol_sv06_3d_printer` + variants. camera variant. Source: tomshardware.com/reviews/sovol-sv06-review |
| Sovol SV08 | Sovol | FDM | 550 x 537 x 575 (verified (two retailers)) | #104 | done | `sovol_sv08_3d_printer` + variants. camera variant. Source: 3djake.com/sovol/sv08, 3dpros, without spool holder |
| FlashForge Adventurer 5M | FlashForge | FDM | 363 x 402 x 448 (verified (two retailers)) | #104 | done | `flashforge_adventurer_5m_3d_printer` + variants. camera variant `flashforge_adv5m_3d_printer_camera` (id kept under 40 characters). Source: 3djake.com, Micro Center; without spool holder |
| FlashForge Adventurer 5M Pro | FlashForge | FDM | 380 x 400 x 453 (single retailer) | #104 | done | `flashforge_adventurer_5m_pro_3d_printer` + variants. built-in camera. Source: 3djake.com .../adventurer-5m-pro, without spool holder |
| FlashForge AD5X | FlashForge | FDM | 363 x 402 x 448 (verified (reviewers + retailer)) | #104 | done | `flashforge_ad5x_3d_printer` + variants. built-in camera. Source: protoolreviews.com: 363 x 402 x 448 including spool holder (363 x 376 x 413 without) |
| Elegoo Saturn 4 Ultra | Elegoo | resin | 327 x 329 x 548 (verified (two retailers + review quoting maker)) | #105 | done | `elegoo_saturn_4u_3d_printer` + camera variant. Source: 3djake.com/elegoo/saturn-4-ultra, Micro Center |
| Elegoo Mars 5 | Elegoo | resin | 230 x 230 x 434 (verified (two third-party tables)) | #105 | done | `elegoo_mars_5_3d_printer` + camera variant. Source: 3djake.com/elegoo/mars-5, Liqcreate |
| Anycubic Photon Mono M7 | Anycubic | resin | 312 x 315 x 520 (verified (two retailers)) | #105 | done | `anycubic_m7_3d_printer` + camera variant. Source: 3djake.com, printer-hub.ru |
| Anycubic Photon Mono M5s | Anycubic | resin | 270 x 290 x 460 (verified (maker + 3DJake)) | #105 | done | `anycubic_m5s_3d_printer` + camera variant. Source: ca.anycubic.com M5s "460*270*290 (HWD)" |
| Phrozen Sonic Mighty 8K | Phrozen | resin | 337 x 337 x 516 (verified (several retailers)) | #105 | done | `phrozen_mighty_8k_3d_printer` + camera variant. Source: 3djake.ch, Tom's Hardware, Jaycar |
| Formlabs Form 4 | Formlabs | resin | 398 x 367 x 554 (verified (maker)) | #105 | done | `formlabs_form_4_3d_printer` + camera variant. Source: formlabs.com/3d-printers/tech-specs "39.8 x 36.7 x 55.4 cm" (axes unlabelled) |
| Elegoo Mercury | Elegoo | wash+cure | 400 x 220 x 280 (unverified) | #105 | done | `elegoo_mercury_wash_cure`; Mercury Plus style, wash and cure side by side. Source: no listing matches a single 400 x 220 x 280 unit; Mercury Plus V2 is 200 x 200 x 352, V3 302.5 x 302.5 x 412.5, X/XS two separate units; left as is |
| Anycubic Wash & Cure | Anycubic | wash+cure | 290 x 270 x 479 (verified (maker, Plus model)) | #105 | done | `anycubic_wash_and_cure`; Plus style. Source: uk.anycubic3d.com/products/anycubic-wash-cure-plus-machine "290*270*479"; was 340 high |
| Formlabs Form Wash | Formlabs | wash+cure | 315 x 293 x 405 (verified (maker)) | #105 | done | `formlabs_form_wash`. Source: formlabs.com/eu/products/form-wash "31.5 x 29.3 x 40.5 cm" (71 cm with lid open) |
| Formlabs Form Cure | Formlabs | wash+cure | 337 x 404 x 372 (verified (maker)) | #105 | done | `formlabs_form_cure`. Source: formlabs.com/eu/products/form-cure "33.7 x 40.4 x 37.2 cm" (axes unlabelled) |
| Printer enclosure tent | generic | kit | 700 x 700 x 900 | #105 | done | `printer_enclosure_tent` |
| Fume extractor (desktop) | generic | kit | 280 x 200 x 260 | #105 | done | `fume_extractor_desktop` |
| Air purifier (workshop) | generic | kit | 260 x 260 x 520 | #105 | done | `air_purifier_workshop` |
| Printer workbench | generic | kit | 1200 x 600 x 900 | #105 | done | `printer_workbench` |
| Printer cabinet | generic | kit | 800 x 600 x 1100 | #105 | done | `printer_cabinet`. Filament dryers, dry boxes and spool racks already exist in `amluto.core/tech` (#36), not duplicated |

Bambu Lab enclosure: Bambu sells no separate enclosure; the H2/P2S/X-series are already enclosed and the A1 series stays open (an enclosure tent is part of #105).

Resin and wash and cure sizes (#105) were checked in #133; see each row.
