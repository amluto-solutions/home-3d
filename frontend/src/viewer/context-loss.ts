/**
 * WebGL context loss (#163): a tablet that drops its graphics context (screen off, GPU reset, memory pressure) must
 * not be left with a black or frozen canvas. `watchContext` wires the two events; the viewer decides what to redraw.
 */
export interface ContextHandlers {
  /** The context is gone: stop drawing and tell the person. */
  lost: () => void;
  /** The context is back: everything drawn only once has to be drawn again. */
  restored: () => void;
}

/** Listens on a canvas; returns a function that removes the listeners again. */
export function watchContext(canvas: HTMLCanvasElement, handlers: ContextHandlers): () => void {
  const onLost = (e: Event) => {
    // without this the browser never restores the context
    e.preventDefault();
    handlers.lost();
  };
  const onRestored = () => handlers.restored();
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  return () => {
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
  };
}
