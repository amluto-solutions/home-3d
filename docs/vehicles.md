# Vehicles catalogue (#129)

Cars: the most popular current UK models of 20 brands (by UK and European registrations; pick the latest generation
sold), about 200 in all. Each is built by `tools/gen_vehicles.py` from curved shells (body, glasshouse and roof, #252;
the vans from boxes) and simple shapes, scaled to the outer size below (length x width without mirrors x height, in
mm). No logos, no maker pictures, no 3D files. The body is in the
`paint` colour role: ten base colours and a hex value in the item panel.

**Sizes were checked in #135.** The maker sites (ford.co.uk, bmw.co.uk and the rest) refuse automated fetches, so each
row was compared with two other sources: the Auto Express model page (UK figures) and the generation table on
auto-data.net. Width is without mirrors; where a source gave it with mirrors, the other source's figure was used.
Status: **verified** = the two sources agree (length within 20 mm, width within 8 mm, height within 35 mm; the Auto Express
figure is used and the Source column says where they differ); **single source** = only one source covered that car or
the other one was for a different body or market (the value shown is the one source's, the Source column says which and
what the other said); **unverified** = left as written from memory, with the reason. A few cars were swapped for a
model that is on sale now; the Source column starts the reason with "Swap".
Totals: 89 verified, 90 single source, 16 unverified, out of 195 cars.
Brands with fewer than ten rows (Tesla sells seven different shapes, MG eight) are listed as they are.

The Nissan Leaf (second generation, 2018 on) and its colourways come from `tools/gen_leaf.py` (#242); they and the first
bicycles, mopeds and scooters are not part of this table. Their bodies are in the `paint` role too (#404), with the
colourway's colour as the item's own paint (`"colors": {"paint": …}`); the two-tone Leaf keeps its black roof.

## Ford

Maker site: https://www.ford.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Ford Puma | suv | 4186 x 1805 x 1550 | no | `ford_puma` | verified | Auto Express + auto-data.net (4226 mm is the ST, which auto-data.net lists) |
| Ford Explorer | suv | 4468 x 1872 x 1639 | yes | `ford_explorer` | single source | auto-data.net only (Explorer EV). Swap: the Fiesta ended production in 2023 |
| Ford Focus | hatchback | 4378 x 1825 x 1471 | no | `ford_focus` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| Ford Focus Estate | estate | 4675 x 1825 x 1497 | no | `ford_focus_estate` | single source | auto-data.net only |
| Ford Kuga | suv | 4645 x 1882 x 1681 | no | `ford_kuga` | verified | Auto Express + auto-data.net |
| Ford Mustang Mach-E | suv | 4713 x 1881 x 1624 | yes | `ford_mustang_mach_e` | single source | Auto Express only; auto-data.net lists 4,750 x 1,882 x 1,648 for the 2024 update |
| Ford Ranger | pickup truck | 5370 x 1918 x 1884 | no | `ford_ranger` | unverified | auto-data.net lists 2,028 wide (flared) against 1,918 from memory; no UK page opened |
| Ford Transit Custom | van | 4973 x 2032 x 1976 | no | `ford_transit_custom` | unverified | no spec source found (new generation, only the Tourneo Custom is listed) |
| Ford Tourneo Custom | mpv | 5050 x 2032 x 1959 | no | `ford_tourneo_custom` | single source | auto-data.net only |
| Ford Mustang | coupe | 4810 x 1916 x 1414 | no | `ford_mustang` | verified | Auto Express + auto-data.net (height/length differ by up to 17 mm: auto-data.net 4811 x 1916 x 1397) |

## Vauxhall

Maker site: https://www.vauxhall.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Vauxhall Corsa | hatchback | 4060 x 1765 x 1435 | no | `vauxhall_corsa` | verified | Auto Express + auto-data.net (Corsa F; its 1,960 is the width with mirrors) |
| Vauxhall Corsa Electric | hatchback | 4060 x 1765 x 1433 | yes | `vauxhall_corsa_electric` | verified | Auto Express + auto-data.net (same body as the Corsa; Auto Express misprints the width as 1,745) |
| Vauxhall Mokka | suv | 4151 x 1787 x 1534 | no | `vauxhall_mokka` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| Vauxhall Astra | hatchback | 4374 x 1860 x 1441 | no | `vauxhall_astra` | verified | Auto Express + auto-data.net (Mk VIII hatchback) |
| Vauxhall Astra Sports Tourer | estate | 4642 x 1860 x 1443 | no | `vauxhall_astra_sports_tourer` | single source | auto-data.net only |
| Vauxhall Frontera Electric | suv | 4385 x 1795 x 1627 | yes | `vauxhall_frontera_electric` | single source | Auto Express only (Frontera, same body). Swap: the Crossland was replaced by the Frontera |
| Vauxhall Grandland | suv | 4650 x 1905 x 1657 | no | `vauxhall_grandland` | verified | Auto Express + auto-data.net |
| Vauxhall Frontera | suv | 4385 x 1795 x 1627 | no | `vauxhall_frontera` | single source | Auto Express only |
| Vauxhall Combo Life | mpv | 4403 x 1848 x 1841 | no | `vauxhall_combo_life` | single source | auto-data.net only for length and height; width is 1,848 as on the Rifter (same body), auto-data.net gives 1,921 with mirrors |
| Vauxhall Vivaro | van | 4956 x 1920 x 1935 | no | `vauxhall_vivaro` | single source | auto-data.net only |

## Volkswagen

Maker site: https://www.volkswagen.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Volkswagen Polo | hatchback | 4074 x 1751 x 1451 | no | `vw_polo` | verified | Auto Express + auto-data.net |
| Volkswagen Golf | hatchback | 4282 x 1789 x 1483 | no | `vw_golf` | verified | Auto Express + auto-data.net (height/length differ by up to 14 mm: auto-data.net 4296 x 1789 x 1483) |
| Volkswagen Golf Estate | estate | 4651 x 1789 x 1487 | no | `vw_golf_estate` | single source | auto-data.net only |
| Volkswagen Passat Estate | estate | 4917 x 1849 x 1521 | no | `vw_passat_estate` | single source | auto-data.net only |
| Volkswagen T-Roc | suv | 4372 x 1828 x 1573 | no | `vw_t_roc` | verified | Auto Express + auto-data.net |
| Volkswagen Tiguan | suv | 4539 x 1859 x 1660 | no | `vw_tiguan` | verified | Auto Express + auto-data.net (third generation; width from auto-data.net, Auto Express still shows the old 1,842) |
| Volkswagen Taigo | suv | 4266 x 1757 x 1518 | no | `vw_taigo` | verified | Auto Express + auto-data.net |
| Volkswagen ID.3 | hatchback | 4264 x 1809 x 1568 | yes | `vw_id_3` | single source | Auto Express only |
| Volkswagen ID.4 | suv | 4584 x 1852 x 1640 | yes | `vw_id_4` | single source | Auto Express only |
| Volkswagen Transporter | van | 4904 x 1904 x 1990 | no | `vw_transporter` | unverified | T7 replaced the T6.1 and is much bigger (auto-data.net lists only the 5,450 long wheelbase); short wheelbase not found |

## BMW

Maker site: https://www.bmw.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| BMW 1 Series | hatchback | 4361 x 1800 x 1459 | no | `bmw_1_series` | verified | Auto Express + auto-data.net |
| BMW 2 Series Active Tourer | mpv | 4386 x 1824 x 1576 | no | `bmw_2_series_active_tourer` | single source | auto-data.net only (Auto Express page is the Gran Coupe) |
| BMW 3 Series | saloon | 4714 x 1827 x 1446 | no | `bmw_3_series` | verified | Auto Express + auto-data.net |
| BMW 3 Series Touring | estate | 4714 x 1827 x 1448 | no | `bmw_3_series_touring` | single source | auto-data.net only |
| BMW 4 Series Coupe | coupe | 4773 x 1852 x 1393 | no | `bmw_4_series_coupe` | single source | auto-data.net only |
| BMW 5 Series | saloon | 5060 x 1900 x 1515 | no | `bmw_5_series` | verified | Auto Express + auto-data.net |
| BMW X1 | suv | 4500 x 1845 x 1642 | no | `bmw_x1` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| BMW X3 | suv | 4755 x 1920 x 1660 | no | `bmw_x3` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| BMW X5 | suv | 4922 x 2004 x 1745 | no | `bmw_x5` | verified | Auto Express + auto-data.net (height/length differ by up to 20 mm: auto-data.net 4935 x 2004 x 1765) |
| BMW i4 | saloon | 4783 x 1852 x 1448 | yes | `bmw_i4` | verified | Auto Express + auto-data.net |

## Mercedes-Benz

Maker site: https://www.mercedes-benz.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Mercedes-Benz A-Class | hatchback | 4419 x 1796 x 1440 | no | `mercedes_a_class` | unverified | sources disagree (Auto Express 4,428 long, auto-data.net 4,445 x 1,850) |
| Mercedes-Benz CLA | saloon | 4723 x 1855 x 1450 | yes | `mercedes_cla` | single source | auto-data.net only (CLA C178). Swap: the B-Class ended in 2025 |
| Mercedes-Benz C-Class | saloon | 4751 x 1820 x 1438 | no | `mercedes_c_class` | single source | Auto Express only; the auto-data.net 4,842 x 1,900 is the long-wheelbase China car |
| Mercedes-Benz C-Class Estate | estate | 4751 x 1820 x 1455 | no | `mercedes_c_class_estate` | unverified | no UK source; the auto-data.net 4,842 x 1,900 is the long-wheelbase China car |
| Mercedes-Benz E-Class | saloon | 4949 x 1880 x 1480 | no | `mercedes_e_class` | single source | Auto Express only; auto-data.net differs (4959 x 1902 x 1480) |
| Mercedes-Benz GLA | suv | 4412 x 1834 x 1616 | no | `mercedes_gla` | single source | Auto Express only; auto-data.net differs (4436 x 1849 x 1616) |
| Mercedes-Benz GLC | suv | 4716 x 1890 x 1640 | no | `mercedes_glc` | single source | Auto Express only; auto-data.net differs (4749 x 1920 x 1648) |
| Mercedes-Benz GLE | suv | 4924 x 1947 x 1772 | no | `mercedes_gle` | single source | Auto Express only; auto-data.net differs (4947 x 2018 x 1797) |
| Mercedes-Benz EQA | suv | 4463 x 1834 x 1612 | yes | `mercedes_eqa` | single source | auto-data.net only |
| Mercedes-Benz Vito | van | 4895 x 1928 x 1910 | no | `mercedes_vito` | unverified | auto-data.net only lists the long and extra-long vans for the current model |

## Audi

Maker site: https://www.audi.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Audi A1 | hatchback | 4029 x 1740 x 1433 | no | `audi_a1` | single source | auto-data.net only |
| Audi A3 Sportback | hatchback | 4352 x 1816 x 1425 | no | `audi_a3_sportback` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| Audi A5 Avant | estate | 4829 x 1860 x 1460 | no | `audi_a5_avant` | single source | auto-data.net only (B10). Swap: the A5 Avant replaced the A4 Avant |
| Audi A6 Avant | estate | 4999 x 1875 x 1472 | no | `audi_a6_avant` | single source | auto-data.net only |
| Audi Q2 | suv | 4208 x 1794 x 1508 | no | `audi_q2` | verified | Auto Express + auto-data.net (height/length differ by up to 29 mm: auto-data.net 4208 x 1794 x 1537) |
| Audi Q3 | suv | 4531 x 1859 x 1588 | no | `audi_q3` | single source | Auto Express only; auto-data.net differs (4531 x 1859 x 1628) |
| Audi Q5 | suv | 4717 x 1900 x 1662 | no | `audi_q5` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| Audi Q7 | suv | 5056 x 1970 x 1757 | no | `audi_q7` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| Audi Q4 e-tron | suv | 4588 x 1865 x 1639 | yes | `audi_q4_e_tron` | verified | Auto Express + auto-data.net (height/length differ by up to 15 mm: auto-data.net 4603 x 1865 x 1632) |
| Audi e-tron GT | coupe | 5004 x 1964 x 1402 | yes | `audi_e_tron_gt` | verified | Auto Express + auto-data.net (height/length differ by up to 33 mm: auto-data.net 5004 x 1964 x 1369) |

## Toyota

Maker site: https://www.toyota.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Toyota Yaris | hatchback | 3940 x 1745 x 1500 | no | `toyota_yaris` | single source | Auto Express only; auto-data.net differs (3995 x 1805 x 1500) |
| Toyota Aygo X | hatchback | 3776 x 1740 x 1525 | no | `toyota_aygo_x` | verified | Auto Express + auto-data.net |
| Toyota Corolla | hatchback | 4380 x 1790 x 1460 | no | `toyota_corolla` | single source | Auto Express only; auto-data.net differs (4409 x 1849 x 1478) |
| Toyota Corolla Touring Sports | estate | 4650 x 1790 x 1435 | no | `toyota_corolla_touring_sports` | single source | auto-data.net only |
| Toyota C-HR | suv | 4362 x 1832 x 1558 | no | `toyota_c_hr` | verified | Auto Express + auto-data.net (height/length differ by up to 12 mm: auto-data.net 4360 x 1830 x 1570) |
| Toyota Yaris Cross | suv | 4180 x 1765 x 1595 | no | `toyota_yaris_cross` | verified | Auto Express + auto-data.net (height/length differ by up to 13 mm: auto-data.net 4167 x 1765 x 1595) |
| Toyota RAV4 | suv | 4646 x 1880 x 1704 | no | `toyota_rav4` | single source | auto-data.net only (sixth generation; Auto Express still shows the fifth) |
| Toyota bZ4X | suv | 4690 x 1860 x 1650 | yes | `toyota_bz4x` | single source | auto-data.net only; Auto Express gives 1,600 high |
| Toyota Hilux | pickup truck | 5320 x 1885 x 1865 | no | `toyota_hilux` | single source | auto-data.net only |
| Toyota Proace Verso | mpv | 4959 x 1920 x 1890 | no | `toyota_proace_verso` | single source | auto-data.net only |

## Nissan

Maker site: https://www.nissan.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Nissan Micra | hatchback | 3974 x 1830 x 1499 | yes | `nissan_micra` | single source | auto-data.net only; the Micra is now the electric Renault 5 based K15 |
| Nissan Juke | suv | 4210 x 1800 x 1593 | no | `nissan_juke` | verified | Auto Express + auto-data.net |
| Nissan Qashqai | suv | 4425 x 1835 x 1625 | no | `nissan_qashqai` | verified | Auto Express + auto-data.net |
| Nissan X-Trail | suv | 4680 x 1840 x 1725 | no | `nissan_x_trail` | verified | Auto Express + auto-data.net |
| Nissan Ariya | suv | 4595 x 1850 x 1660 | yes | `nissan_ariya` | verified | Auto Express + auto-data.net |
| Nissan Navara | pickup truck | 5330 x 1850 x 1828 | no | `nissan_navara` | single source | auto-data.net only |
| Nissan Townstar | van | 4486 x 1921 x 1872 | no | `nissan_townstar` | unverified | auto-data.net says 1,860 wide, which does not fit the Kangoo it is built on (1,919) |
| Nissan Primastar | van | 5399 x 1956 x 1970 | no | `nissan_primastar` | unverified | no spec source found |
| Nissan Z | coupe | 4399 x 1869 x 1316 | no | `nissan_z` | single source | auto-data.net only |
| Nissan Leaf (2025) | hatchback | 4404 x 1811 x 1557 | yes | `nissan_leaf_2025` | single source | auto-data.net only (third generation). Swap: the GT-R left the UK line-up |

## Kia

Maker site: https://www.kia.com/uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Kia Picanto | hatchback | 3605 x 1595 x 1485 | no | `kia_picanto` | verified | Auto Express + auto-data.net |
| Kia Ceed | hatchback | 4310 x 1800 x 1447 | no | `kia_ceed` | verified | Auto Express + auto-data.net (height/length differ by up to 15 mm: auto-data.net 4325 x 1800 x 1447) |
| Kia Ceed Sportswagon | estate | 4605 x 1800 x 1465 | no | `kia_ceed_sportswagon` | single source | auto-data.net only |
| Kia Stonic | suv | 4140 x 1760 x 1505 | no | `kia_stonic` | single source | Auto Express only; auto-data.net differs (4165 x 1760 x 1520) |
| Kia Xceed | suv | 4395 x 1826 x 1495 | no | `kia_xceed` | verified | Auto Express + auto-data.net (height/length differ by up to 15 mm: auto-data.net 4380 x 1826 x 1495) |
| Kia Niro | suv | 4420 x 1825 x 1560 | no | `kia_niro` | verified | Auto Express + auto-data.net (height/length differ by up to 15 mm: auto-data.net 4430 x 1825 x 1545) |
| Kia Sportage | suv | 4540 x 1865 x 1645 | no | `kia_sportage` | single source | Auto Express only; auto-data.net differs (4685 x 1865 x 1699) |
| Kia Sorento | suv | 4815 x 1900 x 1695 | no | `kia_sorento` | verified | Auto Express + auto-data.net |
| Kia EV6 | suv | 4695 x 1890 x 1550 | yes | `kia_ev6` | verified | Auto Express + auto-data.net |
| Kia EV9 | suv | 5010 x 1980 x 1755 | yes | `kia_ev9` | verified | Auto Express + auto-data.net |

## Hyundai

Maker site: https://www.hyundai.com/uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Hyundai i10 | hatchback | 3670 x 1680 x 1480 | no | `hyundai_i10` | verified | Auto Express + auto-data.net |
| Hyundai i20 | hatchback | 4065 x 1775 x 1450 | no | `hyundai_i20` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| Hyundai i30 | hatchback | 4340 x 1795 x 1455 | no | `hyundai_i30` | verified | Auto Express + auto-data.net |
| Hyundai i30 Tourer | estate | 4585 x 1795 x 1475 | no | `hyundai_i30_tourer` | single source | auto-data.net only |
| Hyundai Bayon | suv | 4180 x 1775 x 1500 | no | `hyundai_bayon` | verified | Auto Express + auto-data.net |
| Hyundai Kona | suv | 4350 x 1825 x 1585 | no | `hyundai_kona` | single source | Auto Express only; auto-data.net differs (4384 x 1826 x 1610) |
| Hyundai Tucson | suv | 4525 x 1865 x 1653 | no | `hyundai_tucson` | single source | Auto Express only; auto-data.net differs (4641 x 1865 x 1684) |
| Hyundai Santa Fe | suv | 4830 x 1900 x 1780 | no | `hyundai_santa_fe` | verified | Auto Express + auto-data.net |
| Hyundai Ioniq 5 | suv | 4655 x 1890 x 1605 | yes | `hyundai_ioniq_5` | single source | Auto Express only; auto-data.net differs (4715 x 1940 x 1626) |
| Hyundai Ioniq 6 | saloon | 4855 x 1880 x 1495 | yes | `hyundai_ioniq_6` | single source | Auto Express only; auto-data.net differs (4935 x 1940 x 1495) |

## Tesla

Maker site: https://www.tesla.com/en_gb

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Tesla Model 3 | saloon | 4720 x 1850 x 1440 | yes | `tesla_model_3` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| Tesla Model 3 (2017-23) | saloon | 4694 x 1849 x 1443 | yes | `tesla_model_3_2017_23` | single source | auto-data.net only |
| Tesla Model Y | suv | 4797 x 1920 x 1624 | yes | `tesla_model_y` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| Tesla Model Y (2020-24) | suv | 4751 x 1921 x 1624 | yes | `tesla_model_y_2020_24` | single source | auto-data.net only (first generation) |
| Tesla Model S | saloon | 5021 x 1987 x 1431 | yes | `tesla_model_s` | single source | auto-data.net only |
| Tesla Model X | suv | 5057 x 1999 x 1680 | yes | `tesla_model_x` | single source | auto-data.net only |
| Tesla Cybertruck | pickup truck | 5683 x 2032 x 1741 | yes | `tesla_cybertruck` | single source | auto-data.net only |

## Volvo

Maker site: https://www.volvocars.com/uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Volvo XC40 | suv | 4440 x 1863 x 1657 | no | `volvo_xc40` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| Volvo EX30 | suv | 4233 x 1838 x 1555 | yes | `volvo_ex30` | verified | Auto Express + auto-data.net (width from auto-data.net, Auto Express gives 1,940 with mirrors) |
| Volvo EC40 | suv | 4440 x 1873 x 1591 | yes | `volvo_ec40` | single source | auto-data.net only (Auto Express page repeats the XC40 height) |
| Volvo XC60 | suv | 4708 x 1902 x 1658 | no | `volvo_xc60` | verified | Auto Express + auto-data.net |
| Volvo XC90 | suv | 4953 x 1931 x 1776 | no | `volvo_xc90` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| Volvo EX90 | suv | 5037 x 1964 x 1747 | yes | `volvo_ex90` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| Volvo S60 | saloon | 4778 x 1850 x 1431 | no | `volvo_s60` | single source | auto-data.net only |
| Volvo S90 | saloon | 4969 x 1879 x 1446 | no | `volvo_s90` | single source | auto-data.net only |
| Volvo V60 | estate | 4778 x 1850 x 1432 | no | `volvo_v60` | verified | Auto Express + auto-data.net |
| Volvo V90 | estate | 4945 x 1879 x 1478 | no | `volvo_v90` | single source | auto-data.net only |

## Peugeot

Maker site: https://www.peugeot.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Peugeot 208 | hatchback | 4055 x 1765 x 1430 | no | `peugeot_208` | single source | Auto Express only; auto-data.net differs (4100 x 1771 x 1430) |
| Peugeot e-208 | hatchback | 4055 x 1765 x 1430 | yes | `peugeot_e_208` | single source | Auto Express only; auto-data.net differs (4100 x 1771 x 1430) |
| Peugeot 308 | hatchback | 4367 x 1852 x 1454 | no | `peugeot_308` | verified | Auto Express + auto-data.net (height/length differ by up to 26 mm: auto-data.net 4367 x 1852 x 1480) |
| Peugeot 308 SW | estate | 4640 x 1852 x 1480 | no | `peugeot_308_sw` | single source | auto-data.net only |
| Peugeot 2008 | suv | 4304 x 1770 x 1550 | no | `peugeot_2008` | verified | Auto Express + auto-data.net |
| Peugeot 3008 | suv | 4542 x 1895 x 1641 | no | `peugeot_3008` | verified | Auto Express + auto-data.net |
| Peugeot 5008 | suv | 4791 x 1895 x 1694 | no | `peugeot_5008` | verified | Auto Express + auto-data.net |
| Peugeot 408 | suv | 4687 x 1848 x 1478 | no | `peugeot_408` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| Peugeot 508 | saloon | 4750 x 1859 x 1403 | no | `peugeot_508` | single source | auto-data.net only |
| Peugeot Rifter | mpv | 4405 x 1848 x 1818 | no | `peugeot_rifter` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |

## Renault

Maker site: https://www.renault.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Renault Clio | hatchback | 4116 x 1768 x 1451 | no | `renault_clio` | single source | auto-data.net only (Clio VI; Auto Express still shows the Clio V) |
| Renault Captur | suv | 4239 x 1797 x 1576 | no | `renault_captur` | verified | Auto Express + auto-data.net |
| Renault Megane E-Tech | hatchback | 4200 x 1768 x 1505 | yes | `renault_megane_e_tech` | single source | Auto Express only; auto-data.net differs (4200 x 1782 x 1522) |
| Renault Symbioz | suv | 4413 x 1797 x 1575 | no | `renault_symbioz` | single source | auto-data.net only. Swap: the Arkana ended; the Symbioz replaces it |
| Renault Austral | suv | 4532 x 1843 x 1649 | no | `renault_austral` | single source | Auto Express only; auto-data.net differs (4510 x 1825 x 1644) |
| Renault Scenic E-Tech | suv | 4470 x 1864 x 1572 | yes | `renault_scenic_e_tech` | verified | Auto Express + auto-data.net |
| Renault Renault 5 E-Tech | hatchback | 3922 x 1774 x 1498 | yes | `renault_renault_5_e_tech` | verified | Auto Express + auto-data.net |
| Renault 4 E-Tech | suv | 4140 x 1800 x 1570 | yes | `renault_4_e_tech` | single source | auto-data.net only. Swap: the Zoe ended in 2024 |
| Renault Kangoo | mpv | 4486 x 1919 x 1838 | no | `renault_kangoo` | single source | auto-data.net only |
| Renault Trafic | van | 4999 x 1956 x 1971 | no | `renault_trafic` | single source | auto-data.net only (Trafic III; matches the earlier figures) |

## Skoda

Maker site: https://www.skoda.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Skoda Fabia | hatchback | 4137 x 1780 x 1482 | no | `skoda_fabia` | verified | Auto Express + auto-data.net |
| Skoda Scala | hatchback | 4362 x 1793 x 1474 | no | `skoda_scala` | single source | Auto Express only; auto-data.net differs (4362 x 1793 x 1514) |
| Skoda Octavia | hatchback | 4698 x 1829 x 1477 | no | `skoda_octavia` | verified | Auto Express + auto-data.net (height/length differ by up to 11 mm: auto-data.net 4709 x 1829 x 1486) |
| Skoda Octavia Estate | estate | 4709 x 1829 x 1491 | no | `skoda_octavia_estate` | single source | auto-data.net only |
| Skoda Superb Estate | estate | 4902 x 1849 x 1521 | no | `skoda_superb_estate` | single source | auto-data.net only (Auto Express page is the liftback) |
| Skoda Kamiq | suv | 4241 x 1793 x 1531 | no | `skoda_kamiq` | verified | Auto Express + auto-data.net (height/length differ by up to 31 mm: auto-data.net 4241 x 1793 x 1562) |
| Skoda Karoq | suv | 4398 x 1841 x 1612 | no | `skoda_karoq` | verified | Auto Express + auto-data.net (height/length differ by up to 20 mm: auto-data.net 4390 x 1841 x 1632) |
| Skoda Kodiaq | suv | 4758 x 1864 x 1659 | no | `skoda_kodiaq` | verified | Auto Express + auto-data.net |
| Skoda Enyaq | suv | 4658 x 1879 x 1622 | yes | `skoda_enyaq` | verified | Auto Express + auto-data.net |
| Skoda Elroq | suv | 4488 x 1884 x 1625 | yes | `skoda_elroq` | verified | Auto Express + auto-data.net (height/length differ by up to 29 mm: auto-data.net 4488 x 1884 x 1654) |

## MG

Maker site: https://www.mg.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| MG MG3 | hatchback | 4113 x 1797 x 1502 | no | `mg_mg3` | verified | Auto Express + auto-data.net |
| MG MG4 | hatchback | 4287 x 1836 x 1516 | yes | `mg_mg4` | verified | Auto Express + auto-data.net (first generation) |
| MG MG5 EV | estate | 4544 x 1818 x 1543 | yes | `mg_mg5_ev` | single source | auto-data.net only |
| MG MG ZS | suv | 4430 x 1818 x 1635 | no | `mg_mg_zs` | verified | Auto Express + auto-data.net |
| MG MG HS | suv | 4655 x 1890 x 1664 | no | `mg_mg_hs` | verified | Auto Express + auto-data.net (height/length differ by up to 15 mm: auto-data.net 4670 x 1890 x 1664) |
| MG Marvel R | suv | 4674 x 1919 x 1618 | yes | `mg_marvel_r` | single source | auto-data.net only |
| MG Cyberster | coupe | 4535 x 1913 x 1329 | yes | `mg_cyberster` | verified | Auto Express + auto-data.net |
| MG S5 EV | suv | 4476 x 1849 x 1633 | yes | `mg_s5_ev` | single source | auto-data.net only (MGS5 EV). Swap: the ZS EV duplicated the ZS body and is being replaced |

## Land Rover

Maker site: https://www.landrover.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Land Rover Defender 90 | suv | 4510 x 1996 x 1974 | no | `landrover_defender_90` | unverified | auto-data.net adds the rear spare wheel (4,583 against 4,510); width and height agree |
| Land Rover Defender 110 | suv | 4758 x 1996 x 1967 | no | `landrover_defender_110` | unverified | auto-data.net adds the rear spare wheel (5,018 against 4,758); width agrees |
| Land Rover Defender 130 | suv | 5358 x 1996 x 1970 | no | `landrover_defender_130` | unverified | no spec source found |
| Land Rover Defender 110 Hard Top | van | 4758 x 1996 x 1967 | no | `landrover_defender_110_hard_top` | unverified | no spec source found (same body as the 110) |
| Land Rover Discovery Sport | suv | 4597 x 1904 x 1727 | no | `landrover_discovery_sport` | unverified | no spec source found |
| Land Rover Discovery | suv | 4956 x 2000 x 1888 | no | `landrover_discovery` | single source | auto-data.net only |
| Land Rover Range Rover Evoque | suv | 4371 x 1904 x 1649 | no | `landrover_range_rover_evoque` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| Land Rover Range Rover Velar | suv | 4803 x 1930 x 1665 | no | `landrover_range_rover_velar` | unverified | no spec source found |
| Land Rover Range Rover Sport | suv | 4970 x 2047 x 1822 | no | `landrover_range_rover_sport` | single source | Auto Express only |
| Land Rover Range Rover | suv | 5052 x 2003 x 1868 | no | `landrover_range_rover` | single source | Auto Express only |

## Mini

Maker site: https://www.mini.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Mini Cooper 3-door | hatchback | 3876 x 1744 x 1452 | no | `mini_cooper_3_door` | single source | auto-data.net only |
| Mini Cooper 5-door | hatchback | 4036 x 1744 x 1464 | no | `mini_cooper_5_door` | single source | auto-data.net only |
| Mini Cooper Convertible | coupe | 3879 x 1744 x 1431 | no | `mini_cooper_convertible` | single source | auto-data.net only (F67) |
| Mini Cooper Electric | hatchback | 3858 x 1756 x 1460 | yes | `mini_cooper_electric` | unverified | auto-data.net lists only the petrol car; electric figures from memory |
| Mini John Cooper Works | hatchback | 3876 x 1744 x 1452 | no | `mini_john_cooper_works` | single source | auto-data.net only |
| Mini Aceman | suv | 4079 x 1754 x 1514 | yes | `mini_aceman` | verified | Auto Express + auto-data.net |
| Mini Clubman | estate | 4266 x 1800 x 1441 | no | `mini_clubman` | single source | auto-data.net only |
| Mini Countryman | suv | 4447 x 1843 x 1661 | no | `mini_countryman` | single source | auto-data.net only |
| Mini Countryman Electric | suv | 4447 x 1843 x 1661 | yes | `mini_countryman_electric` | single source | auto-data.net only |
| Mini Cooper S 5-door | hatchback | 4036 x 1744 x 1464 | no | `mini_cooper_s_5_door` | single source | auto-data.net only |

## Honda

Maker site: https://www.honda.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Honda Jazz | hatchback | 4089 x 1694 x 1526 | no | `honda_jazz` | single source | Auto Express only; auto-data.net differs (4105 x 1725 x 1556) |
| Honda Jazz Crosstar | suv | 4105 x 1725 x 1556 | no | `honda_jazz_crosstar` | single source | auto-data.net only |
| Honda Civic | hatchback | 4560 x 1802 x 1408 | no | `honda_civic` | verified | Auto Express + auto-data.net |
| Honda Civic Type R | hatchback | 4595 x 1890 x 1407 | no | `honda_civic_type_r` | single source | auto-data.net only |
| Honda HR-V | suv | 4340 x 1790 x 1590 | no | `honda_hr_v` | unverified | sources disagree (Auto Express 4,355 long, auto-data.net lists the 4,567 US model) |
| Honda ZR-V | suv | 4568 x 1840 x 1620 | no | `honda_zr_v` | verified | Auto Express + auto-data.net |
| Honda CR-V | suv | 4706 x 1867 x 1684 | no | `honda_cr_v` | verified | Auto Express + auto-data.net (width from auto-data.net; Auto Express gives it with mirrors) |
| Honda e:Ny1 | suv | 4387 x 1790 x 1584 | yes | `honda_e_ny1` | single source | auto-data.net only |
| Honda Honda e | hatchback | 3895 x 1750 x 1495 | yes | `honda_honda_e` | verified | Auto Express + auto-data.net (height/length differ by up to 17 mm: auto-data.net 3894 x 1752 x 1512) |
| Honda Prelude | coupe | 4532 x 1880 x 1349 | no | `honda_prelude` | verified | Auto Express + auto-data.net |

## Mazda

Maker site: https://www.mazda.co.uk/

| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Mazda Mazda2 | hatchback | 3940 x 1745 x 1500 | no | `mazda_mazda2` | single source | auto-data.net only |
| Mazda Mazda3 | hatchback | 4460 x 1795 x 1435 | no | `mazda_mazda3` | verified | Auto Express + auto-data.net |
| Mazda Mazda3 Fastback | saloon | 4662 x 1797 x 1445 | no | `mazda_mazda3_fastback` | single source | auto-data.net only |
| Mazda 6e | saloon | 4921 x 1890 x 1491 | yes | `mazda_6e` | single source | auto-data.net only. Swap: the Mazda6 Tourer ended; the 6e is its successor |
| Mazda CX-30 | suv | 4395 x 1795 x 1540 | no | `mazda_cx_30` | verified | Auto Express + auto-data.net (height/length differ by up to 27 mm: auto-data.net 4395 x 1795 x 1567) |
| Mazda CX-5 | suv | 4690 x 1860 x 1690 | no | `mazda_cx_5` | verified | Auto Express + auto-data.net |
| Mazda CX-60 | suv | 4745 x 1890 x 1680 | no | `mazda_cx_60` | verified | Auto Express + auto-data.net |
| Mazda CX-80 | suv | 4995 x 1890 x 1710 | no | `mazda_cx_80` | verified | Auto Express + auto-data.net |
| Mazda MX-5 | coupe | 3915 x 1735 x 1225 | no | `mazda_mx_5` | verified | Auto Express + auto-data.net (height/length differ by up to 15 mm: auto-data.net 3915 x 1735 x 1240) |
| Mazda MX-30 | suv | 4395 x 1795 x 1555 | yes | `mazda_mx_30` | verified | Auto Express + auto-data.net |

## Other vehicles

Modelled from simple shapes at typical sizes (no single maker): road, gravel, mountain, e-mountain, folding, BMX,
cargo and kids' balance bikes; cruiser, adventure, touring, trail and maxi-scooter motorbikes; snowmobiles (sport,
touring, utility, mountain); golf carts (2 seat, 4 seat, utility); quad bike and side-by-side; mobility scooters;
kids' and stunt kick scooters; a compact tractor; a touring caravan and two trailers. Sizes are typical, not a
particular model's: none of them names a real product (the "style" words in some tags are only search hints), so there
is no maker page to check them against (#135). A ride-on mower, the electric and adult kick scooters, the moped and the first bicycles were
already in the pack.
