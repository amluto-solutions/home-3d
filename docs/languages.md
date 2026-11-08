# Languages

Home 3D is written in English, and English is built into every page. Any other language comes from a **language
pack**: a small folder with the texts of that language, which installs like a [furniture pack](packs.md). Anyone can
make one and publish it, and a text the pack lacks shows in English, so a pack that covers only part of the screens
is still useful.

Seventeen languages ship with Home 3D as language packs (see [What ships](#what-ships)). Home 3D shows the language Home Assistant runs in (the user's
language in their profile).

## A language pack is a folder

```
community.lang-fr/
├── pack.json        the pack: id, name, publisher, licence, and the language
├── strings.json     the texts
├── LICENSE          optional, not read
└── README.md        optional, not read
```

Nothing else may be in the folder: no item files, no pictures, no code.

### pack.json

```json
{
  "format": "home3d-pack",
  "version": 2,
  "kind": "language",
  "language": "fr",
  "id": "community.lang-fr",
  "name": "Français",
  "publisher": "Community",
  "licence": "CC-BY-4.0",
  "release": 1,
  "description": "French texts for Home 3D."
}
```

It is the `pack.json` of a furniture pack (see [pack.json](packs.md#packjson): `format`, `version`, `id`, `name`,
`publisher`, `licence`, `release`, `description`) with two more fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `kind` | yes | `"language"`. (A furniture pack leaves it out, or says `"furniture"`.) |
| `language` | yes | The base language code, lower case: `"fr"`, `"de"`, `"pt"`, `"nb"`. A page in a regional variant (`fr-CA`, `de-AT`, `pt-BR`) uses the pack of its base language. Norwegian `no` reads as `nb`. |

Write `name` in the language itself ("Français", "Español"), so people find it on the list.

### strings.json

One object of text keys and texts:

```json
{
  "view": "3D",
  "editor": "Éditeur",
  "all_floors": "Tous les étages",
  "floor_lights": "{n} lumières allumées"
}
```

- The keys are the keys of Home 3D's English table, `frontend/src/i18n.ts`. The bundled packs
  (`custom_components/home_3d/bundled_languages/amluto.lang-*/strings.json`) show the format; the ones with
  every key (see [What ships](#what-ships)) make a good starting point.
- Keep the placeholders in braces (`{n}`, `{name}`) as the English text has them; they are filled in on the screen.
- A key the pack leaves out shows in English. A key this version of Home 3D does not know is ignored, so a pack made
  for a newer version still works with an older one.
- Texts are shown as plain text: markup is not interpreted.

## What is checked

A language pack goes through the same checks as a furniture pack ([What the loader checks](packs.md#what-the-loader-checks)),
with these rules for its texts:

| Check | Limit | Error code |
| --- | --- | --- |
| `pack.json` has no `language`, or a furniture pack names one | | `invalid_content` |
| The folder holds a file other than `pack.json`, `strings.json` and the readme or licence text | | `not_data` |
| `strings.json` is missing, is not an object, or is empty | | `invalid_content` |
| A key is not lower-case letters, digits and `_` (starting with a letter, up to 80 characters) | | `invalid_content` |
| A text is not a string, is empty or too long | 2,000 characters | `invalid_content` |
| A text holds a web address (`https://…` alone, as a hint for a field, is fine) | | `not_data` |
| Too many texts | 10,000 | `too_many_items` |
| `strings.json` is too large | 400,000 characters | `too_large` |
| A `kind` this version does not know yet | | `needs_update` |

Check a pack before publishing it: `python tools/fp3dpack.py validate path/to/community.lang-fr`.

## Installing, updating and removing

Language packs use the furniture packs' buttons on the **Extensions** page:

- **Import a pack folder …** with the pack folder (or a repository folder that holds several packs);
- **Install from GitHub** with the URL of the pack folder, for example
  `https://github.com/<owner>/<repo>/tree/main/community.lang-fr`.

They are listed under **Languages** with their language and how many texts they have, and an editor can remove an
installed one there. Packs installed from GitHub are checked for new releases, pinned and rolled back like furniture
packs ([Updates](packs.md#updates)). A backup carries the installed language packs.

- The bundled packs come with Home 3D (`custom_components/home_3d/bundled_languages/`) and cannot be removed. An
  installed pack with the same id and at least the same `release` takes its place; removing that copy brings the
  bundled one back.
- Several packs for the same language add up: a key in a pack installed later wins over the same key in the bundled
  pack. A small pack can so correct a few texts of a larger one.
- An installed or removed pack for the language shown takes effect on that page at once; other open pages pick it up
  when they load again.

## How a page gets its texts

- Every page carries the English texts. When Home Assistant runs in another language, the page asks Home Assistant
  for that language's texts once (`home_3d/languages/get`, open to everyone who can see Home 3D, such as a wall
  tablet's user) and draws once they are there. The browser keeps them with their hash and sends the hash next time:
  while the texts are the same, Home Assistant answers with the hash alone.
- Every text of the page is in the English table or in a language pack: the item editor, the Settings page, time travel, the locating setup and the microphone probe included (#217). There is no other file of texts next to the bundles.
- The panel, the cards and the card editor set their `lang` attribute to the language their texts are in: Home
  Assistant's language when there are texts for it, otherwise `en`. Screen readers pick their voice by it.

## What ships

The bundled packs are `amluto.lang-cs`, `-da`, `-de`, `-es`, `-fi`, `-fr`, `-hu`, `-it`, `-nb`, `-nl`, `-nn`,
`-pl`, `-pt`, `-ro`, `-sl`, `-sv` and `-zh`. `amluto.lang-de` has every text; the others have nearly every text, and a text they lack
shows in English, and a pack installed later (or a newer release of a bundled one) can add the missing ones.
The language a device chose is kept by its code (`de`), not by pack id, so it stays.

The names of furniture come from their packs (`name` by language), not from a language pack.
