// Test fixture: a two-floor building with stair flights on the lower one (stair-links and walk tests).
import { emptyBuilding, newFloor, type Furniture, type Room } from "../model.ts";

const rect = (id: string, x0: number, z0: number, x1: number, z1: number): Room => ({ id, name: id, area_id: null, points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], floor_material: "wood" });

export const flight = (id: string, x: number, z: number, rotation: number, w: number, d: number, h: number, mount_y: number | null = null): Furniture =>
  ({ id, type: "stairs", x, z, rotation, w, d, h, variant: null, entity: null, power: null, mount_y }) as Furniture;

/** A building of two floors (2.75 m apart) with the given flights on the lower one. */
export function twoFloors(...flights: Furniture[]) {
  const lower = { ...newFloor("ground", "Ground", 2.75), rooms: [rect("a", 4, 7, 11, 15)], furniture: flights };
  const upper = { ...newFloor("upper", "Upper", 5.5), rooms: [rect("b", 4, 7, 11, 15)] };
  return { ...emptyBuilding(), floors: [lower, upper] };
}

// a quarter-turn stair drawn as two flights: a short one at the bottom, the second mounted on top of it at a right angle
export const flightA = () => flight("a", 7.553, 11.688, 90, 1, 1.294, 0.55);
export const flightB = () => flight("b", 7.7, 10.094, 0, 1, 2.188, 2.2, 0.55);
