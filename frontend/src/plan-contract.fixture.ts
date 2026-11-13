// The plan contract (#166): one plan with every field the plan format has, filled in. It is the one source both sides
// check against: this file must satisfy `Complete<Building>` (every field of model.ts present, and no field the type
// does not know), and the copy in tests/fixtures/contract/plan.json (written from it, see contract.test.ts) must pass
// the backend's schema with no field schema.py does not know, and hold every field schema.py knows
// (tests/test_contract.py). A field added on one side only fails one of the two.
//
// The values are made to pass both sides' checks, not to look like a home. Generic placeholders only.
// After changing it: UPDATE_CONTRACT=1 node --test src/contract.test.ts

import type { Building } from "./model.ts";

/** Every field required, all the way down (also those that may be null: they hold a value here). */
export type Complete<T> = T extends readonly (infer U)[]
  ? Complete<U>[]
  : T extends object
    ? { [K in keyof T]-?: [NonNullable<T[K]>] extends [never] ? T[K] : Complete<NonNullable<T[K]>> }
    : T;

// the recipe copies are checked by the pack format's own tests (packs.md); here the plan only has the field
export const PLAN_CONTRACT = {
  "version": 4,
  "floors": [
    {
      "id": "text",
      "name": "text",
      "elevation": 50.0,
      "height": 5.75,
      "cut_height": 5.15,
      "rooms": [
        {
          "climate": {
            "temperature": "text",
            "humidity": "text",
            "co2": "text"
          },
          "live": {
            "leak": "text",
            "motion": "text"
          },
          "id": "text",
          "name": "text",
          "aliases": [
            "text"
          ],
          "area_id": "text",
          "points": [
            [
              -500.0,
              -500.0
            ],
            [
              -500.0,
              -500.0
            ],
            [
              -500.0,
              -500.0
            ]
          ],
          "floor_material": "text",
          "start_view": {
            "theta": 1.0,
            "phi": 0.8,
            "radius": 125.75,
            "target": {
              "x": -500.0,
              "y": -100.0,
              "z": -500.0
            }
          },
          "panel": [
            "text"
          ],
          "hidden": [
            "text"
          ],
          "no_state": [
            "text"
          ],
          "panel_layout": {
            "pinned": [
              "text"
            ],
            "order": [
              "text"
            ],
            "groups": [
              "text"
            ]
          },
          "wall_splits": [
            [
              50.037499999999994
            ]
          ],
          "ceiling_height": 8.25,
          "hide_in_picker": true,
          "wall_thickness": [
            0.39
          ],
          "wall_colors": [
            "#c0392b"
          ],
          "wall_color": "#d9c7a3",
          "wall_heights": [
            5.0,
            [
              5.0
            ]
          ],
          "wall_slopes": [
            [
              5.0375,
              5.0375
            ]
          ],
          "mods": {
            "key1": {}
          },
          "outdoor": false
        }
      ],
      "openings": [
        {
          "id": "text",
          "room_id": "text",
          "edge": 50,
          "offset": 25.0,
          "wall": "text",
          "width": 25.0,
          "type": "door",
          "sill": 25.0,
          "height": 25.0,
          "hinge": "left",
          "leaves": 1,
          "swing": "in",
          "style": "interior",
          "sidelight_hinge": true,
          "sidelight_width": 0.825,
          "sidelight_width2": 0.825,
          "contact2": "text",
          "sensor": "contact",
          "sensor2": "contact",
          "tilt2": "text",
          "position": "text",
          "position_inverted": true,
          "blind_side": "inside",
          "slat_invert": true,
          "tilt_angle": "text",
          "tilt_max": 23.25,
          "tilt_offset": -180.0,
          "tilt_invert": true,
          "shut": true,
          "open_angle": 45.0,
          "contact_invert": true,
          "rain_ignore": true,
          "well": true,
          "well_rim": 0.025000000000000022,
          "mark": "closed",
          "sill_board": "auto",
          "confirm": true,
          "cover": "text",
          "contact": "text",
          "tilt": "text",
          "lock": "lock.sample_front_door"
        }
      ],
      "furniture": [
        {
          "id": "text",
          "type": "text",
          "x": -500.0,
          "z": -500.0,
          "rotation": 1.0,
          "w": 25.0,
          "d": 25.0,
          "h": 25.0,
          "variant": "text",
          "name": "text",
          "aliases": [
            "text"
          ],
          "show_name": true,
          "glow_scale": 0.44999999999999996,
          "entity": "text",
          "power": "text",
          "door_left": "text",
          "door_right": "text",
          "soc": "text",
          "charge": "text",
          "export": "text",
          "holo": true,
          "circuit": "text",
          "energy": "text",
          "plant_card": true,
          "plant_right": -15.0,
          "plant_up": -15.0,
          "status": "text",
          "room_sensor": "text",
          "confirm": true,
          "actions": {
            "tap": {
              "action": "default",
              "target": "text",
              "data": {},
              "confirm": true,
              "confirm_text": "text"
            },
            "hold": {
              "action": "default",
              "target": "text",
              "data": {},
              "confirm": true,
              "confirm_text": "text"
            },
            "double_tap": {
              "action": "default",
              "target": "text",
              "data": {},
              "confirm": true,
              "confirm_text": "text"
            }
          },
          "marker": "always",
          "icon": "text",
          "mount_y": 2.5,
          "state_entity": "text",
          "state_entity2": "text",
          "state_split": "left_right",
          "color_entity": "text",
          "extra": "text",
          "temp_sensor": "text",
          "fan": "text",
          "mirror": true,
          "stair_open": true,
          "stair_turn": "left",
          "stair_landing": 15,
          "stair_top": 2.5,
          "awning_pitch": 20.0,
          "awning_valance": true,
          "awning_position": "text",
          "awning_time": 76.5,
          "awning_invert": true,
          "colors": {
            "accent": "#336699",
            "body": "#336699",
            "cushion": "#336699",
            "dark": "#336699",
            "fabric": "#336699",
            "glass": "#336699",
            "metal": "#336699",
            "paint": "#336699",
            "plant": "#336699",
            "pot": "#336699",
            "white": "#336699",
            "wood": "#336699"
          },
          "materials": {
            "accent": "matt",
            "body": "matt",
            "cushion": "matt",
            "dark": "matt",
            "fabric": "matt",
            "glass": "matt",
            "metal": "matt",
            "paint": "matt",
            "plant": "matt",
            "pot": "matt",
            "white": "matt",
            "wood": "matt"
          },
          "bin_kind": "rest",
          "bin_color": "#336699",
          "bin_lid": "#336699",
          "bin_source": "text",
          "bin_match": "text",
          "mailbox_door": "text",
          "bin_out": "text",
          "bin_kerb": {
            "x": -500.0,
            "z": -500.0
          },
          "moisture": "text",
          "moisture_min": 25.0,
          "remaining": "text",
          "service": "text",
          "service_min": 250.0,
          "service2": "text",
          "service2_min": 250.0,
          "door_alarm": 30.375,
          "tilt": -45.0,
          "upright": true,
          "clients": "text",
          "water_temp": "text",
          "gangs": [
            {
              "entity": "text",
              "power": "text"
            }
          ],
          "rise": -40.0,
          "pictures": [
            {
              "entity": "text",
              "attribute": "text",
              "state": "text",
              "image": "text"
            }
          ],
          "screen_bg": "black",
          "active_color": "#ff3b30",
          "vehicle": "text",
          "valve_position": "filter",
          "valve_open": true,
          "car": {
            "device": "text",
            "soc": "text",
            "range": "text",
            "charging": "text",
            "plugged": "text",
            "lock": "text",
            "climate": "text",
            "tracker": "text"
          },
          "scale": 0.65,
          "type_entity": "text",
          "types": [
            {
              "state": "text",
              "vehicle": "text"
            }
          ],
          "group": "text",
          "locked": true,
          "mods": {
            "key1": {}
          },
          "show_when": {
            "entity": "text",
            "when": "on",
            "state": "text",
            "unavailable": "hide",
            "intervals": [
              {
                "from": "06-01",
                "to": "06-01",
                "start": "07:30",
                "end": "07:30"
              }
            ]
          },
          "rack": {
            "slots": [
              {
                "id": "text",
                "type": "text",
                "u": 1,
                "name": "text",
                "col": 0,
                "face": "front",
                "on": "text",
                "entity": "light.sample_lounge",
                "links": [
                  "light.sample_lounge"
                ]
              }
            ],
            "card": {
              "metrics": [
                "light.sample_lounge",
                "@hottest"
              ]
            }
          },
          "heat_sensor": "binary_sensor.sample_radiator_heating",
          "only_color": "#ffcc00",
          "run_w": 10.0,
          "look_of": "camera.sample_drive"
        }
      ],
      "placements": [
        {
          "entity_id": "text",
          "x": -500.0,
          "z": -500.0,
          "y": 25.0,
          "mount": "ceiling",
          "pin": true,
          "rotation": 1.0,
          "fov": 97.5,
          "reach": 12.875,
          "tilt": 22.5,
          "confirm": true,
          "actions": {
            "tap": {
              "action": "default",
              "target": "text",
              "data": {},
              "confirm": true,
              "confirm_text": "text"
            },
            "hold": {
              "action": "default",
              "target": "text",
              "data": {},
              "confirm": true,
              "confirm_text": "text"
            },
            "double_tap": {
              "action": "default",
              "target": "text",
              "data": {},
              "confirm": true,
              "confirm_text": "text"
            }
          },
          "marker": "always",
          "icon": "text",
          "name": "text",
          "aliases": [
            "text"
          ],
          "show_name": true,
          "glow_scale": 0.44999999999999996,
          "holo": true,
          "circuit": "text",
          "energy": "text",
          "cone": true,
          "detect_pins": true,
          "locked": true,
          "detect_sensors": [
            "binary_sensor.sample_person"
          ]
        }
      ],
      "background": {
        "image_id": "text",
        "x": -500.0,
        "z": -500.0,
        "width": 250.075,
        "opacity": 0.25,
        "rotation": -180.0
      },
      "outdoor": [
        {
          "id": "text",
          "type": "lawn",
          "points": [
            [
              1.0,
              1.0
            ],
            [
              1.0,
              1.0
            ],
            [
              1.0,
              1.0
            ]
          ],
          "height": 1.5750000000000002,
          "outline": true,
          "offset": -5.0,
          "slope": 5.0,
          "slope_dir": "x",
          "open": true,
          "bracing": true,
          "cut": true,
          "pool_shape": "round",
          "above": true,
          "depth": 1.25,
          "rim": 0.125,
          "pool": {
            "temperature": "text",
            "heater": "text",
            "pump": "text",
            "light": "text",
            "ph": "text",
            "chlorine": "text",
            "salt": "text",
            "cover": "text",
            "ports": [
              {
                "id": "text",
                "kind": "skimmer",
                "x": 1.0,
                "z": 1.0,
                "depth": 1.25
              }
            ],
            "pipes": [
              {
                "id": "text",
                "from": "text",
                "to": "text",
                "floor_id": "text",
                "points": [
                  [
                    1.0,
                    1.0
                  ]
                ],
                "height": -1.25,
                "heights": [
                  -1.25
                ],
                "fittings": [
                  {
                    "id": "text",
                    "kind": "valve",
                    "at": 250.0,
                    "open": true
                  }
                ]
              }
            ],
            "joints": [
              {
                "id": "text",
                "x": 1.0,
                "z": 1.0,
                "y": -1.25,
                "kind": "tee",
                "name": "text",
                "nx": 1.0,
                "nz": 1.0,
                "depth": 0.5
              }
            ]
          },
          "name": "text",
          "area_id": "text",
          "panel": [
            "text"
          ],
          "hidden": [
            "text"
          ],
          "no_state": [
            "text"
          ],
          "panel_layout": {
            "pinned": [
              "text"
            ],
            "order": [
              "text"
            ],
            "groups": [
              "text"
            ]
          },
          "mods": {
            "key1": {}
          }
        }
      ],
      "walls": [
        {
          "id": "text",
          "a": [
            1.0,
            1.0
          ],
          "b": [
            1.0,
            1.0
          ],
          "thickness": 0.265,
          "height": 5.0375
        }
      ],
      "ha_floor": "text",
      "start_view": {
        "theta": 1.0,
        "phi": 0.8,
        "radius": 125.75,
        "target": {
          "x": -500.0,
          "y": -100.0,
          "z": -500.0
        }
      }
    }
  ],
  "settings": {
    "wall_exterior": 0.265,
    "wall_interior": 0.265,
    "grid": 0.2575,
    "north": -180.0,
    "units": "metric",
    "person_look": "figure",
    "lock_plan": true,
    "area_import": true,
    "demo": true,
    "unplaced_hidden": [
      "text"
    ],
    "tablet_users": [
      "text"
    ],
    "tablet_idle": 21600,
    "media_presets": [
      {
        "id": "text",
        "label": "text",
        "type": "text",
        "content": "text"
      }
    ],
    "buttons": [
      {
        "id": "text",
        "label": "text",
        "icon": "text",
        "action": "navigate",
        "target": "text",
        "data": {}
      }
    ],
    "favorites": [
      "text"
    ],
    "start_view": {
      "theta": 1.0,
      "phi": 0.8,
      "radius": 125.75,
      "target": {
        "x": -500.0,
        "y": -100.0,
        "z": -500.0
      }
    },
    "roof": {
      "type": "none",
      "sections": [
        {
          "id": "text",
          "x0": -500.0,
          "z0": -500.0,
          "x1": -500.0,
          "z1": -500.0,
          "shape": "gable",
          "axis": "x",
          "eave_a": 12.5,
          "eave_b": 12.5,
          "pitch_a": 20.0,
          "pitch_b": 20.0,
          "base": 12.5,
          "overhang": 0.5,
          "flip": true,
          "points": [
            [
              1.0,
              1.0
            ],
            [
              1.0,
              1.0
            ],
            [
              1.0,
              1.0
            ]
          ],
          "dormer": true,
          "locked": true,
          "open": true,
          "end_u0": "gable",
          "end_u1": "gable",
          "rotation": -180.0,
          "pivot": [
            1.0,
            1.0
          ]
        }
      ],
      "solar": [
        {
          "id": "text",
          "face": "text",
          "u": 12.5,
          "v": 12.5,
          "rows": 11,
          "cols": 16,
          "portrait": true,
          "tilt": 22.5,
          "flip": true,
          "entity": "text",
          "name": "text",
          "layout": [
            15
          ],
          "align": "left",
          "skip": [
            "text"
          ],
          "look": "black",
          "module_w": 0.9750000000000001,
          "module_h": 0.9750000000000001,
          "wp": 412.5,
          "string": "text",
          "rotation": -180.0,
          "base": 15.0,
          "locked": true
        }
      ],
      "strings": [
        {
          "id": "text",
          "name": "text",
          "entity": "text",
          "inverter": "text"
        }
      ],
      "windows": [
        {
          "id": "text",
          "face": "text",
          "u": 12.5,
          "v": 12.5,
          "w": 1.225,
          "h": 1.225,
          "cover": "text",
          "contact": "text",
          "tilt": "text",
          "window": "text",
          "name": "text",
          "locked": true,
          "float": true
        }
      ],
      "hologram": {
        "place": "field",
        "field": "text",
        "x": -250.0,
        "z": -250.0,
        "height": 15.0,
        "size": 0.9750000000000001,
        "right": -15.0,
        "up": -15.0,
        "mirror": true,
        "device_house": true,
        "device_room": true,
        "plant_floor": true,
        "device_min_w": 25000.0
      },
      "cables": [
        {
          "id": "text",
          "floor_id": "text",
          "points": [
            [
              1.0,
              1.0
            ]
          ],
          "height": 7.5,
          "locked": true
        }
      ],
      "pitch": 18.75,
      "overhang": 0.5,
      "ridge": "long"
    },
    "weather_entity": "text",
    "rain_warning": true,
    "rain_entity": "text",
    "alert_names": true,
    "alert_unavailable": true,
    "alert_snoozed": [
      {
        "kind": "text",
        "entity": "text",
        "at": 0
      }
    ],
    "alert_ignored": [
      {
        "kind": "text",
        "entity": "text"
      }
    ],
    "effects": {
      "motion_seconds": 900,
      "camera_seconds": 900,
      "radiator_cold": 10.0,
      "radiator_hot": 10.0,
      "tank_cold": 10.0,
      "tank_hot": 10.0
    },
    "outage_entity": "text",
    "sun_patches": true,
    "sun_shadow": true,
    "window_glow": true,
    "household": {
      "bin_from": 6.0,
      "bin_until": 6.0,
      "bin_next_only": true,
      "bin_days": 15,
      "notes": "todo.sample_notes"
    },
    "facade_color": "#d9c7a3",
    "style_day": "cozy",
    "style_evening": "evening",
    "style_night": "focus",
    "style_switch": "time",
    "style_morning_at": "07:30",
    "style_evening_at": "18:00",
    "style_night_at": "23:00",
    "style_entity": "input_select.sample_style",
    "styles_custom": [{id: "my_sample", "name": "text", "base": "day", "palette": {"line": "#445566", "dark": "#112233", "light": "#778899", "hue": 0.225, "lift": 0.225, "contrast": 0.225}, "natural": true, "signal": true, "sun": 0.225, "ao": 0.225, "shadows": true, "floors": 0.225, "cutDark": true, "dim": 0.225, "bg": ["#112233", "#445566"]}],
    "backdrop": {
      "kind": "color",
      "color": "text",
      "color2": "text",
      "image": "text",
      "dim": 0.225
    },
    "director": {
      "doorbell": true,
      "doorbell_entity": "text",
      "doorbell_camera": "text",
      "motion": "off",
      "appliances": true,
      "alerts": true,
      "live": true,
      "triggers": [
        {
          "entity": "text",
          "camera": "text"
        }
      ],
      "hold": 157.5
    },
    "easter_eggs": true,
    "season_effect": "long",
    "halloween": {
      "ghost": true
    },
    "seasons": {
      "twixmas": false
    },
    "season_dates": {
      "halloween": {
        "from": "10-29",
        "to": "11-01"
      }
    },
    "season_rules": {
      "easter": [
        {
          "kind": "fixed",
          "month": 4,
          "day": 3,
          "offset": -2,
          "nth": 1,
          "weekday": 5,
          "from": "2027-03-26",
          "to": "2027-03-29",
          "days": 4,
          "start": "08:00",
          "end": "22:00"
        }
      ]
    },
    "terrain": {
      "level": -10.0,
      "earth": true
    },
    "weather_effects": [
      "rain"
    ],
    "vacuum_maps": [
      {
        "id": "text",
        "camera": "camera.sample_vacuum_map",
        "floor_id": "text",
        "vacuum": "vacuum.sample_vacuum",
        "points": [
          {
            "v": [
              1200.0,
              -300.0
            ],
            "p": [
              2.5,
              1.5
            ]
          }
        ],
        "opacity": 0.6,
        "show": true
      }
    ],
    "pets": {
      "on": true,
      "roam": true,
      "list": [
        {
          "id": "text",
          "kind": "cat",
          "name": "text",
          "fur": "text",
          "eyes": "dark",
          "breed": "text",
          "floor_id": "text",
          "static": true,
          "pose": "sit",
          "x": -500.0,
          "z": -500.0,
          "rotation": -180.0,
          "spots": [
            {
              "id": "text",
              "floor_id": "text",
              "x": -500.0,
              "z": -500.0,
              "pose": "groom",
              "rotation": -180.0,
              "from": "22:00",
              "to": "07:00",
              "days": [0]
            }
          ],
          "triggers": [
            {
              "id": "text",
              "kind": "state",
              "entity": "text",
              "to": "text",
              "event": "text",
              "at": "07:30",
              "floor_id": "text",
              "x": -500.0,
              "z": -500.0,
              "pose": "stand",
              "rotation": -180.0,
              "minutes": 10.0
            }
          ]
        }
      ]
    },
    "mods": {
      "key1": {}
    },
    "editor_floor": "g"
  },
  "energy": {
    "meter": {
      "floor_id": "text",
      "x": -500.0,
      "z": -500.0
    },
    "grid": "text",
    "grid_invert": true,
    "solar": "text",
    "battery": "text",
    "battery_invert": true,
    "battery_soc": "text",
    "consumption": "text",
    "tariff": "text",
    "gas": "text",
    "water": "text",
    "cheap_rate": "text",
    "cheap_from": "07:30",
    "cheap_to": "07:30",
    "rates_from": "sensors",
    "rate_entity": "text",
    "cheap_states": ["text"],
    "price_fixed": 0.25,
    "cost_sensors": ["text"],
    "earning_sensors": ["text"],
    "price_mode": "split",
    "price_peak": "text",
    "price_cheap": "text",
    "systems": [
      {
        "id": "text",
        "name": "text",
        "inverter": "text",
        "grid": "text",
        "grid_invert": true,
        "solar": "text",
        "battery": "text",
        "battery_invert": true,
        "battery_soc": "text"
      }
    ]
  },
  "presence": [
    {
      "person": "text",
      "sensor": "text"
    }
  ],
  "recipes": {},
  "opening_links_saved": true
} satisfies Complete<Omit<Building, "recipes">> & Pick<Building, "recipes">;
