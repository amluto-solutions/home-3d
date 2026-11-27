# Show and hide rules

A rule says when the icon or the floating card of an item shows. Examples: the TV card only while the TV plays, a
lamp's icon only while the lamp is on, a solar card only while the panels make power. Rules came with Home 3D 1.9.0.
A rule is stored in the plan, so it counts on every screen. The editor shows every item and card, whatever the rules
say.

## Where to set a rule

| For | Where |
|---|---|
| A furniture item | Select it in the editor and open **Taps and visibility**. Rules are under **Show and hide**. |
| A placed device | Select it in the editor. **Show and hide** is at the end of its panel. |
| The solar card | **Settings → Energy → Hologram**: "When the solar card shows". |
| "Today in the household" | **Settings → Household → Pinboard**: "When "Today in the household" shows". |

A furniture item has three rows. A placed device has only Icon and Card.

- **Object** says when the whole item shows, not only its icon or card. See [Object](#object).
- **Icon** says when its icon shows in the 3D view and the 2D plan. It replaces the choice **Automatic** of **Device
  icon in 3D**. The choice **Hide** there still hides the icon. A hidden icon does not stop a tap, hold or double tap
  on the item in 3D.
- **Card** says when its floating card shows: a device's power card, a TV's or speaker's card, an inverter's plant
  card, a parked car's card, a rack's card, a bin's tag or a module card on the item. The line from the card to the
  item hides with it.

Each rule shows as one sentence, such as "Show when this item is on". When the rule hides the thing at this moment, the
sentence says **hidden now**. Tap the sentence to change the rule.

## Ready choices

| Choice | The rule |
|---|---|
| **No rule** | The item behaves as usual. |
| **When on** | Shows while the item's own entity is on. |
| **When off** | Shows while the item's own entity is off. |
| **At set times** | Shows from one time to another, on the weekdays you choose. |
| **When dark** | Shows while the sun is below the horizon (Home Assistant's `sun.sun`; offered only when it exists). |
| **Custom** | Any set of conditions. See below. |

**When on** and **When off** are offered only for an item with an entity of its own.

## Custom rules

A rule holds up to 12 conditions. With two or more, choose **All must be true** or **Any one is enough**. There are two
kinds of condition.

### State of an entity

Choose the entity first:

- **This item** is the item's own entity. Home 3D looks it up each time, so the rule still fits after you copy it to
  another item.
- **Any other entity** is fixed. For example, show a lamp's icon only while `input_boolean.sample_guests` is on.

Then choose what it must be:

| Choice | Meaning |
|---|---|
| **is on** | The state is `on`, `true`, `home`, `open` or `opening`. |
| **is off** | The state is `off`, `false`, `not_home`, `away`, `closed` or `closing`. A person or device tracker anywhere but home is off. |
| **has the state** | The state is one of the states you type, separated by commas. Letter case does not matter. |
| **is above** | The state is a number higher than yours. |
| **is below** | The state is a number lower than yours. |

When the entity is unavailable, unknown or missing, the condition counts as true (**If unavailable: show**, the
default) or false (**If unavailable: hide**).

### Time and days

Set **From** and **To**, or neither (the whole day). The two times must differ. A window that starts after it ends runs
over midnight, and the night belongs to the day it started. Then tap the weekdays. With no day chosen, the condition
counts every day. Rules with times are checked every minute.

A condition that cannot be checked is left out of its rule, for example "This item" on an item without an entity. A rule
with nothing left to check shows the item.

## Copy a rule to other items

1. Open a rule and choose **Copy rule**.
2. Use one of these:
   - **One rule:** open the other rule and choose **Paste rule**.
   - **Many items:** choose **Paste onto other items…**. Tick the items, use the search, **All lights**, **All shown**
     or **None**, then choose **Paste as icon rule** or **Paste as card rule**. The list holds furniture and placed
     devices of every floor. It pastes into the same kind of rule as the one you opened it from.
   - **A selection:** select several furniture items on one floor (**Shift + click**) and choose **Paste as icon rule**
     or **Paste as card rule** in their panel.

Each item gets its own copy. "This item" then means the item it was pasted onto, and a fixed entity stays the same. An
item without an entity of its own cannot use a rule that asks "This item": it is left out and named. One undo takes the
paste back. The copied rule stays only on this page, so a reload forgets it.

## The solar card and "Today in the household"

These two cards belong to no item, so their rules are in Settings.

- **Solar card:** "This item" is the plant's main sensor. That is the solar sensor of the plant, else the power sensor
  of an inverter or solar panel in the plan, else the grid meter.
- **Today in the household:** it has no sensor of its own, so use other entities, times or both. With no rule the card
  shows when something is due.

## A card you touch

A card that you are using does not vanish under your finger. A touched card stays while its rule would hide it. It
follows its rule again when you touch something else, or after 30 seconds without a touch on it. A card that is
[shown larger](card-zoom.md) stays until it closes; its time starts again then.

To change the time, open **Settings → 3D view** and set **A touched card follows its rule again after** (in seconds, up
to 3600). Empty means 30 seconds, and 0 means no wait. The setting belongs to the device, so a wall tablet can differ
from your phone.

## Object

**Object** hides or shows the whole item, not only its icon or card. Use it for a Christmas tree outside December, or
a car that shows only while it is home. Only furniture has it. Before 1.9.0 this rule had a section of its own, "When it
shows". Saved rules stay as they are and work as before: the plan keeps them in the item's `show_when` key.

With no rule the row says **Always shows**. The ready choices:

| Choice | The rule |
|---|---|
| **No rule** | The item always shows. |
| **Dates and times** | One interval: a first and last day of the year, a start and end time of day, or both. |
| **When dark** | Shows while the sun is below the horizon (offered only when `sun.sun` exists). |
| **Custom** | An entity and up to 12 intervals. |

In **Custom**, choose an entity, then what it must be:

- **While the entity is available** (the default): the item hides while the entity is unavailable.
- **When it is on**, **When it is off**, or **When it has this state** (one of the states you type, separated by
  commas). With one of these, **While unavailable or unknown** says whether an unavailable entity keeps the item
  (**Keep showing**, the default) or hides it (**Hide**).

Add intervals with **+ Interval**. The item shows inside any one of them. With an entity and intervals, both must pass.
Days count every year: 1 December to 6 January runs over the new year. Times count every day: 22:00 to 06:00 runs over
midnight. When you set one end of a pair, the other end is filled in; when you clear one, both go.

The Object row has no weekdays, no "This item" and no copy and paste, because `show_when` cannot hold them. The editor
shows a hidden item dimmed. The plan keys of the icon and card rules are in [plan-format.md](plan-format.md#show-rules).

A Home 3D older than 1.9.0 opens a plan saved by 1.9.0 read-only.
