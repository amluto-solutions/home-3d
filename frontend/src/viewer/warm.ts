// A scene's shaders compiled ahead of its first frame, in slices (run 6 speed). three.js's compileAsync waits for the
// GPU without blocking, but it sets up every material's program in one go (a sixth of a second for a new home on a
// slow tablet), and the first frame then reads every program's uniforms (as long again). Here both happen a few
// materials at a time, each slice a task of its own.

import type { Material, Object3D } from "three";
import { pageClock, runSliced, type SliceClock, type SliceJob } from "./slices.ts";

/** What this needs of three.js's renderer (a test passes a stand-in). */
export interface Compiler {
  compileAsync(scene: Object3D, camera: Object3D, targetScene?: Object3D | null): Promise<unknown>;
  info: { programs: { getUniforms(): unknown; getAttributes(): unknown }[] | null };
}

type Drawn = { isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean; isInstancedMesh?: boolean; isSkinnedMesh?: boolean; isBatchedMesh?: boolean };

/**
 * Objects three.js draws, one for each material (and each way of drawing it: an instanced or skinned mesh gets a
 * program of its own), in scene order.
 */
export function firstUsers(scene: Object3D): Object3D[] {
  const seen = new Set<string>();
  const out: Object3D[] = [];
  scene.traverse((o) => {
    const m = (o as { material?: Material | Material[] }).material;
    const kind = o as Drawn;
    if (!m || !(kind.isMesh || kind.isPoints || kind.isLine || kind.isSprite)) return;
    const how = `${kind.isInstancedMesh ? "i" : ""}${kind.isSkinnedMesh ? "s" : ""}${kind.isBatchedMesh ? "b" : ""}`;
    const keys = (Array.isArray(m) ? m : [m]).map((x) => `${x.uuid}${how}`);
    if (keys.every((k) => seen.has(k))) return;
    for (const k of keys) seen.add(k);
    out.push(o);
  });
  return out;
}

/**
 * Compiles the materials of `scene` (each one through the first object that uses it, lit as in the scene), then reads
 * each program's uniforms and attributes once, in slices. Resolves when the GPU has them ready (or `maxWait` ms went
 * by: a frame is drawn after it anyway); a cancelled or failed compile resolves too (the first frame compiles the rest).
 */
export function compileInSlices(renderer: Compiler, scene: Object3D, camera: Object3D, opts: { clock?: SliceClock; maxWait?: number } = {}): { done: Promise<void>; cancel(): void } {
  const clock = opts.clock ?? pageClock;
  let job: SliceJob<unknown> | null = null;
  let stopped = false;
  const run = async () => {
    const waits: Promise<unknown>[] = [];
    job = runSliced(
      (function* () {
        for (const o of firstUsers(scene)) {
          // compileAsync sets up the object's programs now and resolves once the GPU has finished them
          waits.push(renderer.compileAsync(o, camera, scene).catch(() => undefined));
          yield;
        }
      })(),
      clock,
    );
    await job.done;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([Promise.all(waits), new Promise<void>((ok) => (timer = setTimeout(ok, opts.maxWait ?? 4000)))]).finally(() => clearTimeout(timer));
    if (stopped) return;
    // the programs' first use (their uniforms and attributes read back from the GPU) happens now, not in the first frame
    const programs = [...(renderer.info.programs ?? [])];
    job = runSliced(
      (function* () {
        for (const p of programs) {
          p.getUniforms();
          p.getAttributes();
          yield;
        }
      })(),
      clock,
    );
    await job.done;
  };
  const done = run().catch(() => undefined);
  return {
    done,
    cancel() {
      stopped = true;
      (job as SliceJob<unknown> | null)?.cancel();
    },
  };
}
