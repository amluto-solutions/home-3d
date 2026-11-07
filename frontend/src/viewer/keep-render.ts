/**
 * The renderer's `render` stays a function (#213). three.js gives every WebGLRenderer its own `render` in the
 * constructor (there is none on the prototype), so a timing script that wraps it and "restores" it with
 * `delete renderer.render` leaves the renderer without one: every later frame and floor picture threw
 * "this.renderer.render is not a function" until the page was reloaded. Here `render` becomes a property that
 * cannot be deleted; wrapping it (assigning a function) still works, assigning anything else puts the renderer's
 * own one back.
 */
type Render = (...args: never[]) => unknown;

export function keepRender<T extends { render: Render }>(renderer: T): T {
  const own = renderer.render;
  let current: Render = own;
  Object.defineProperty(renderer, "render", {
    configurable: false,
    enumerable: true,
    get: () => current,
    set: (fn: unknown) => {
      current = typeof fn === "function" ? (fn as Render) : own;
    },
  });
  return renderer;
}
