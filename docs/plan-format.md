# Home 3D import format

This page describes the **simple import format**: a plan that a person, a script or an AI can write easily. You
describe rooms, doors and windows by plain coordinates and furniture by kind and size, and a converter places
everything properly (doors and windows on their walls, rooms joined, furniture mapped to Home 3D's kinds).

> **Status:** the converters for this format and for other programs' files (Sweet Home 3D `.sh3d`, iPhone/iPad
> RoomPlan JSON, CAD `.dxf`, 3D models `.glb`/`.gltf`/`.obj`/`.stl`, Floorplanner exports, Valetudo maps) are in the
> source, in `frontend/src/import/`, with their tests. They are **not yet in the editor**: **⚙ Settings → Backup →
> Import …** accepts only a Home 3D plan file (an export from the editor). This page is the format reference for that
> work. See also [ai-import.md](ai-import.md).

## The file

```json
{
  "format": "home3d-import",
  "units": "m",
  "rooms_at": "centre",
  "floors": [
    {
      "name": "Ground floor",
      "elevation": 0,
      "height": 2.5,
      "rooms": [
        { "name": "Living room", "points": [[0, 0], [6, 0], [6, 4.5], [0, 4.5]] },
        { "name": "Kitchen", "points": [[6, 0], [10, 0], [10, 4.5], [6, 4.5]] }
      ],
      "walls": [{ "from": [3, 4.5], "to": [3, 2.5], "thickness": 0.1 }],
      "doors": [{ "at": [6, 2.25], "width": 0.9, "height": 2.01 }],
      "windows": [{ "at": [3, 0], "width": 1.5, "height": 1.3, "sill": 0.9 }],
      "furniture": [
        { "type": "sofa", "at": [3, 3.6], "rotation": 180 },
        { "name": "Dining table", "at": [8, 2], "width": 1.6, "depth": 0.9, "height": 0.75 }
      ]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `format` | `"home3d-import"`. A file without it is still read as this format when it has the shape (floors with rooms that have `points`, and no plan `version`). |
| `units` | `"m"` (default), `"cm"` or `"mm"` – for every length in the file |
| `rooms_at` | `"centre"` (default): room outlines run along the **middle of the walls**, so neighbouring rooms share their edge. `"inner"`: outlines along the **inner faces** (measured inside dimensions) – rooms a wall apart are joined. |
| `floors[]` | lowest first. `elevation` = height of the floor above the ground floor (the ground floor is 0, a cellar is negative), `height` = storey height (default 2.5 m) |
| `rooms[]` | `name` and `points` – the outline as `[x, z]` corners in order (at least 3). **x** runs to the right, **z** down the plan (from the top of the drawing to the bottom). Do not repeat the first corner at the end. |
| `walls[]` | optional, only walls that are **no room edge**: a partition through half a room, a half-height wall. `from`/`to`, `thickness`, `height` (optional) |
| `doors[]` | `at` = the **middle** of the door on its wall (a point on a room edge), `width`, `height` (optional) |
| `windows[]` | `at`, `width`, `height`, `sill` (bottom edge above the floor), optional `sill_board`: `"auto"` (default: board inside and sill outside from 0.3 m sill height, none for a window directly above another opening), `"none"`, `"inside"` or `"outside"`. Two windows above each other (a transom light) are listed as two windows with the same `at`. |
| `furniture[]` | `at` = the middle, `type` (a built-in kind, see below) or `name` (recognised by its words in several languages: "Sofa", "Fridge", "lit double" …), `width` (along its front), `depth`, `height` (optional: the kind's usual size), `rotation` in degrees clockwise (0 = its front faces down the plan, 180 = up), `elevation` (bottom above the floor, e.g. a wall cabinet) |

Built-in furniture kinds: `sofa`, `sofa_l`, `sofa_u`, `armchair`, `stool`, `coffee_table`, `tv_board`, `tv_wall`, `sideboard`, `shelf`, `plant`, `rug`, `table`, `table_round`, `chair`, `bench`, `corner_bench`, `bar_stool`, `kitchen` (base cabinet), `kitchen_wall`, `kitchen_tall`, `island`, `worktop`, `sink`, `stove`, `dishwasher`, `fridge`, `bed`, `bunk_bed`, `nightstand`, `wardrobe`, `dresser`, `bathtub`, `shower`, `wc`, `washbasin`, `washer`, `dryer`, `desk`, `office_chair`, `tall_cabinet`, `coat_rack`, `stairs`, `stairs_u`, `radiator`, `ac_unit`, `robot_vacuum`, lamps `lamp_ceiling`, `lamp_downlight`, `lamp_spot`, `lamp_panel`, `lamp_pendant`, `lamp_floor`, `lamp_table`, `lamp_wall`, `led_strip`.

## Tips

- Keep the corners exact: rooms that share a wall should share the same coordinates (with `rooms_at: "centre"`).
- A door between two rooms is listed once.
- The converter reports what it had to leave out (a door that lies on no room edge, a room with too few corners).
- The source also holds a check for complete Home 3D plans written by hand or by an AI (`repairPlan` in
  `frontend/src/import/simple.ts`): broken parts are repaired or left out, with a warning for each. Like the
  converters, it is not yet in the editor.

## Energy sensor signs (stored plan)

A stored plan's `energy` object names the power sensors of the energy balance. Two optional keys say which way the
grid and battery sensors count; the editor shows them as a choice next to each sensor (#423):

| Key | Meaning |
|---|---|
| `grid_invert` | `false` or absent (default): the grid sensor shows import as positive. `true`: it shows export as positive. |
| `battery_invert` | `false` or absent (default): the battery sensor shows discharging as positive. `true`: it shows charging as positive. |

Each entry of `energy.systems[]` (a further inverter or battery setup) has its own `grid_invert` and `battery_invert`
with the same meaning. The main keys also apply to the power sensors of the placed meter and home batteries, unless
the meter has a separate export sensor or the battery a separate charging sensor (then each sensor counts one way and
no sign is needed). The sign applies wherever the reading is used: the energy cables and their colours, the battery
chip with its power and charge, and time travel.

## The stored plan's version (for contributors)

A plan Home 3D stores carries a `version` (`PLAN_VERSION` in `custom_components/home_3d/const.py`). When Home Assistant starts, each plan is brought up to the current version by the steps in `custom_components/home_3d/migrations.py`, then checked against the schema in `schema.py`:

- A plan of a **newer** version is shown read-only and never written over, so rolling back to an older release loses nothing.
- A plan of the **same** version with a value the schema does not know (a new choice for a field, a new key in an object that allows no other keys) is repaired: that part is left out. The repaired plan is shown, the plan as stored stays on disk unchanged until an editor saves, and it is kept as a restore point that newer restore points never push out.

So **bump `PLAN_VERSION` whenever the stored plan can hold a value an older release would not read**, even when nothing needs migrating. Add a step to `MIGRATIONS` (it can return the plan unchanged), and add an entry for the new version to `tests/fixtures/plan-choices.json` (`tests/test_plan_choices.py` fails until you do). Never change an entry for a version that was released. New optional keys in objects that allow other keys (most of them) need no bump: an older release keeps them as they are.

### Plan versions

- **4**: the house's style plan (`settings.style_day`, `style_evening`, `style_night`, `style_switch` = `"sun"` or `"time"`, `style_morning_at`, `style_evening_at`, `style_night_at` as `HH:MM`, `style_entity`). `style_switch` is a new choice, so the version went up; the 3 -> 4 step changes nothing. A Home 3D that reads versions up to 3 shows a version-4 plan read-only.
- Own styles (`settings.styles_custom`, #441): a list of up to 40 dicts, each with `id` (`my_` and letters or digits), `name` and the settings of a style (`base`, `palette`, `natural`, `ao`, `dim`, `floors`, `cutDark`, `bg`, `signal`, `shadows`, `sun`). It is an optional list of loose dicts, so the version stays 4; the frontend clamps every value it reads and drops what it does not know.
- Wall and facade colours (#437): a room's optional `wall_color` (all its walls) and `wall_colors` (one per wall, `null` = `wall_color`), and the setting `facade_color`, all `"#rrggbb"`. Optional keys, so the version stays 4.
- Covers (#453): a window or door's optional `blind_side` (`"inside"` puts the cassette and cloth on the room's side; absent or `"outside"` is the default) and `slat_invert` (`true`: a venetian blind's slats count the other way round, 0 = open). Optional keys, so the version stays 4.
