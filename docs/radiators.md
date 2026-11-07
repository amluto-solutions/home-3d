# Radiators checklist (#140)

Radiators added to `amluto.devices/heating` for ticket #140, so most UK and EU homes can be modelled. Each is built
from simple shapes by us; no maker pictures or 3D files are used. All ids start with `radiator_`, so Home 3D treats them as
heaters and colours them from cold blue to hot red from a linked temperature sensor (`shadeKind` in `room-effects.ts`).

Size is W x D x H in mm (the item's `size` x 1000, to 0.1). The height includes a 40 mm valve and pipe zone under panel and
column radiators; the nominal height in the next column is the maker's body height. Wall-mounted items sit 110 mm off the
floor (towel rails 200 mm) and flush to the wall (the back of the item is the wall side).

Status: `maker` = a manufacturer page gives the figure; `retailer` = only shops give it; `unverified` = our best estimate
from typical UK catalogue sizes, to be checked against the real product. Nominal heights and lengths are the standard UK
catalogue steps, but none was checked against a live maker table in this pass (so every row is `unverified`).

Watts: a heating radiator's output is heat, not electric draw, so hydronic items carry no `watts` field (it is an electric
figure for racks). Nominal outputs at delta T 50 (EN 442) belong in a maker table; none was verified, so none is recorded.
Only the dual-fuel towel rail has `electric: true` and `watts: 300` (its element, a typical size).

Already in the library, not duplicated: type 11 600 x 800 and 600 x 1200 (`radiator_single_*`), type 22 600 x 600, 1000, 1400
(`radiator_trv_*`), 3-column 600 x 600 and 600 x 1000 (`radiator_column_*`), flat tube 600 x 600 / 1000, low-level 300 x 1400 / 1800,
vertical 1800 x 340 / 500, towel rails 800 / 1200 (`towel_rail_*`), cast iron 6 / 10 sections, electric 1000 / 1500 W, and the
kitchen-bath towel rails. New type 11 and 22 sizes join the existing families.

| Item id | Kind | Nominal (H x L mm) | Size (mm, W x D x H) | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `radiator_k10_600_600` | Panel type 10 | 600 x 600 | 600 x 50 x 640 | unverified | Nominal height x length; depth is a typical UK maker figure (type 10 ~50, 11 ~65, 21 ~75, 22 ~100, 33 ~155 mm) |
| `radiator_k10_600_1000` | Panel type 10 | 600 x 1000 | 1000 x 50 x 640 | unverified | Nominal height x length; depth is a typical UK maker figure (type 10 ~50, 11 ~65, 21 ~75, 22 ~100, 33 ~155 mm) |
| `radiator_single_600_400` | Panel type 11 | 600 x 400 | 400 x 65 x 640 | unverified | Nominal height x length; depth is a typical UK maker figure (type 10 ~50, 11 ~65, 21 ~75, 22 ~100, 33 ~155 mm) |
| `radiator_single_600_1000` | Panel type 11 | 600 x 1000 | 1000 x 65 x 640 | unverified | Nominal height x length; depth is a typical UK maker figure (type 10 ~50, 11 ~65, 21 ~75, 22 ~100, 33 ~155 mm) |
| `radiator_single_450_1200` | Panel type 11 | 450 x 1200 | 1200 x 65 x 490 | unverified | Nominal height x length; depth is a typical UK maker figure (type 10 ~50, 11 ~65, 21 ~75, 22 ~100, 33 ~155 mm) |
| `radiator_k21_600_800` | Panel type 21 | 600 x 800 | 800 x 75 x 640 | unverified | Nominal height x length; depth is a typical UK maker figure (type 10 ~50, 11 ~65, 21 ~75, 22 ~100, 33 ~155 mm) |
| `radiator_k21_600_1200` | Panel type 21 | 600 x 1200 | 1200 x 75 x 640 | unverified | Nominal height x length; depth is a typical UK maker figure (type 10 ~50, 11 ~65, 21 ~75, 22 ~100, 33 ~155 mm) |
| `radiator_k21_500_1000` | Panel type 21 | 500 x 1000 | 1000 x 75 x 540 | unverified | Nominal height x length; depth is a typical UK maker figure (type 10 ~50, 11 ~65, 21 ~75, 22 ~100, 33 ~155 mm) |
| `radiator_trv_600_800` | Panel type 22 | 600 x 800 | 800 x 100 x 640 | unverified | Nominal height x length; depth is a typical UK maker figure (type 10 ~50, 11 ~65, 21 ~75, 22 ~100, 33 ~155 mm) |
| `radiator_trv_600_1200` | Panel type 22 | 600 x 1200 | 1200 x 100 x 640 | unverified | Nominal height x length; depth is a typical UK maker figure (type 10 ~50, 11 ~65, 21 ~75, 22 ~100, 33 ~155 mm) |
| `radiator_trv_700_1000` | Panel type 22 | 700 x 1000 | 1000 x 100 x 740 | unverified | Nominal height x length; depth is a typical UK maker figure (type 10 ~50, 11 ~65, 21 ~75, 22 ~100, 33 ~155 mm) |
| `radiator_trv_600_1800` | Panel type 22 | 600 x 1800 | 1800 x 100 x 640 | unverified | Nominal height x length; depth is a typical UK maker figure (type 10 ~50, 11 ~65, 21 ~75, 22 ~100, 33 ~155 mm) |
| `radiator_k33_600_800` | Panel type 33 | 600 x 800 | 800 x 155 x 640 | unverified | Nominal height x length; depth is a typical UK maker figure (type 10 ~50, 11 ~65, 21 ~75, 22 ~100, 33 ~155 mm) |
| `radiator_k33_700_1000` | Panel type 33 | 700 x 1000 | 1000 x 155 x 740 | unverified | Nominal height x length; depth is a typical UK maker figure (type 10 ~50, 11 ~65, 21 ~75, 22 ~100, 33 ~155 mm) |
| `radiator_column2_600_1000_white` | 2-column horizontal | 600 x 1000, white | 1000 x 100 x 640 | unverified | Common designer-column size; sections ~46 mm wide, depth 100/150/200 mm for 2/3/4 column |
| `radiator_column2_600_1000_anthr` | 2-column horizontal | 600 x 1000, anthracite | 1000 x 100 x 640 | unverified | Common designer-column size; sections ~46 mm wide, depth 100/150/200 mm for 2/3/4 column |
| `radiator_column4_600_1000_white` | 4-column horizontal | 600 x 1000, white | 1000 x 200 x 640 | unverified | Common designer-column size; sections ~46 mm wide, depth 100/150/200 mm for 2/3/4 column |
| `radiator_column4_600_1000_anthr` | 4-column horizontal | 600 x 1000, anthracite | 1000 x 200 x 640 | unverified | Common designer-column size; sections ~46 mm wide, depth 100/150/200 mm for 2/3/4 column |
| `radiator_column3_600_1400_anthr` | 3-column horizontal | 600 x 1400, anthracite | 1400 x 150 x 640 | unverified | Common designer-column size; sections ~46 mm wide, depth 100/150/200 mm for 2/3/4 column |
| `radiator_vcolumn2_1800_380_white` | 2-column vertical | 1800 x 380, white | 380 x 100 x 1840 | unverified | Common designer-column size; sections ~46 mm wide, depth 100/150/200 mm for 2/3/4 column |
| `radiator_vcolumn3_1800_470_anthr` | 3-column vertical | 1800 x 470, anthracite | 470 x 150 x 1840 | unverified | Common designer-column size; sections ~46 mm wide, depth 100/150/200 mm for 2/3/4 column |
| `radiator_vcolumn4_1800_380_white` | 4-column vertical | 1800 x 380, white | 380 x 200 x 1840 | unverified | Common designer-column size; sections ~46 mm wide, depth 100/150/200 mm for 2/3/4 column |
| `radiator_flatvert_1800_452_anthr` | Vertical designer flat panel | 1800 x 452, anthracite | 452 x 70 x 1840 | unverified | Typical designer vertical tube-width sizes; depth 70 mm |
| `radiator_flatvert_1600_590_white` | Vertical designer flat panel | 1600 x 590, white | 590 x 70 x 1640 | unverified | Typical designer vertical tube-width sizes; depth 70 mm |
| `radiator_towel_straight_1500_500_white` | Towel rail, straight | 1500 x 500, white | 500 x 45 x 1500 | unverified | Standard 500 mm wide ladder rail |
| `radiator_towel_straight_1000_600_anthr` | Towel rail, straight | 1000 x 600, #3a3d40 | 600 x 45 x 1000 | unverified | Standard 600 mm wide ladder rail |
| `radiator_towel_curved_1200_500_chrome` | Towel rail, curved | 1200 x 500, chrome | 500 x 95 x 1200 | unverified | Bowed bars; depth ~95 mm |
| `radiator_towel_curved_800_500_white` | Towel rail, curved | 800 x 500, white | 500 x 95 x 800 | unverified | Bowed bars; depth ~95 mm |
| `radiator_towel_dualfuel_1200_500_chrome` | Towel rail, dual-fuel | 1200 x 500, chrome | 500 x 45 x 1200 | unverified | Central heating plus an electric element; 300 W is a typical element size, set as the item's electric draw (not a maker table) |
| `radiator_school_cast_iron_8` | Cast-iron school-style | 660 high, 8 sections | 600 x 170 x 660 | unverified | 3-column on feet, ~70 mm per section, depth ~170 mm; typical of reclaimed / reproduction units |
| `radiator_lst_600_1000` | LST cover radiator | 600 x 1000 | 1000 x 115 x 640 | unverified | Closed casing with rounded corners and top grille; depth ~115 mm is a typical figure |
| `radiator_plinth_450` | Plinth (kickspace) fan heater | 110 high x 450 x 250 | 450 x 250 x 110 | unverified | Fits behind a kitchen plinth; sizes estimated |

Generated by a throwaway script, not committed; edit the JSON files directly from now on.
