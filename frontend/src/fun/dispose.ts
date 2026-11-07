// Frees the GPU side of an object tree: three.js keeps buffers, programs and textures until they are disposed (#200).

interface Disposable {
  dispose?: () => void;
  isTexture?: boolean;
}
interface Node3 {
  geometry?: Disposable;
  material?: Disposable | Disposable[];
  traverse?: (fn: (o: Node3) => void) => void;
}

/** Disposes the geometries, materials and the textures of those materials of `root` and everything below it. */
export function disposeTree(root: object): void {
  const free = (m: Disposable) => {
    for (const v of Object.values(m)) if (v && (v as Disposable).isTexture) (v as Disposable).dispose?.();
    m.dispose?.();
  };
  (root as Node3).traverse?.((o) => {
    o.geometry?.dispose?.();
    const m = o.material;
    if (Array.isArray(m)) m.forEach(free);
    else if (m) free(m);
  });
}
