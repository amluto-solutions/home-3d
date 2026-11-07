# Let an AI write your plan

> **Status:** Home 3D cannot load an AI-written plan yet. **⚙ Settings → Backup → Import …** in the editor accepts
> only a Home 3D plan file, the kind the editor exports. The converter for the simple format below is in the source
> (`frontend/src/import/simple.ts`, with tests) but is not yet in the editor. This page keeps the template ready
> for that work.

The template asks ChatGPT, Claude, Gemini or another AI to turn a floor plan into the simple
[import format](plan-format.md): floors with rooms as outlines, doors and windows by their middle, furniture by
kind and size. The converter then places doors and windows on their walls, joins the rooms and maps the
furniture to Home 3D's kinds.

Until the editor can import this format, draw the plan in the editor itself. A floor plan image can go under the
floor as a background to trace over.

## Template (copy it into the chat, then attach your plan)

```text
You convert floor plans into the "home3d-import" JSON format of Home 3D.

Output ONLY one JSON object, no explanation, in this structure:
{
  "format": "home3d-import",
  "units": "m",
  "rooms_at": "centre",
  "floors": [
    {
      "name": "<floor name>",
      "elevation": <metres above the ground floor, ground floor 0>,
      "height": <storey height in metres, usually 2.5>,
      "rooms": [ { "name": "<room>", "points": [[x, z], ...] } ],
      "doors": [ { "at": [x, z], "width": 0.9 } ],
      "windows": [ { "at": [x, z], "width": 1.2, "height": 1.3, "sill": 0.9 } ],
      "furniture": [ { "type": "<kind>", "at": [x, z], "width": w, "depth": d, "rotation": 0 } ]
    }
  ]
}

Rules:
- Metres. x runs to the right, z runs DOWN the plan (top of the drawing = small z). Put the top-left corner of the house at [0, 0].
- Room outlines follow the MIDDLE of the walls; neighbouring rooms use exactly the same corner coordinates where they meet. List the corners in order around the room, do not repeat the first one.
- Use the measurements written in the plan. If only inside dimensions are given, add half the wall thickness (inner walls 0.12 m, outer walls 0.3 m unless stated).
- Doors and windows: "at" is the middle of the opening ON the wall line (a point on a room edge). A door between two rooms is listed once.
- Furniture "type" is one of: sofa, sofa_l, armchair, coffee_table, tv_board, sideboard, shelf, plant, rug, table, table_round, chair, bench, kitchen, kitchen_wall, kitchen_tall, island, sink, stove, dishwasher, fridge, bed, bunk_bed, nightstand, wardrobe, dresser, bathtub, shower, wc, washbasin, washer, dryer, desk, office_chair, tall_cabinet, stairs, radiator. "rotation" in degrees clockwise; 0 = the front faces down the plan, 180 = up.
- One entry in "floors" per storey, lowest first (a cellar has a negative elevation).
- If something is unreadable, leave it out rather than guessing wildly.

Here is my floor plan:
```


Save the AI's answer as a `.json` file. If something is off, tell the AI what to change ("the kitchen is 4.2 m wide,
not 3.8") and ask again.
