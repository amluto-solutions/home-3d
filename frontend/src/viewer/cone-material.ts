// The material of light cones, window light, the sun's patches and trails (#1114, #1115).

import { CustomBlending, DoubleSide, MeshBasicMaterial, OneFactor, OneMinusDstColorFactor } from "three";

/**
 * Light cones, window light, the sun's patches and trails: light added to what lies below. They write premultiplied
 * colour and an alpha as strong as the brightest channel, so where they lie on nothing (the homely styles hide the
 * ground) the canvas shows light in every browser, not a black wedge or, as in desktop Chrome with alpha 0, nothing
 * (#1114). On natural materials they brighten like a screen instead of adding, so a light floor or terrace is not
 * burnt out to white (#1115). Ported from NeonPlan 3D 3.4.1 (MIT, Mastershort).
 */
export function coneMaterial(natural: boolean): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ vertexColors: true, transparent: true, blending: CustomBlending, blendSrc: natural ? OneMinusDstColorFactor : OneFactor, blendDst: OneFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneFactor, depthWrite: false, side: DoubleSide, forceSinglePass: true });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace("#include <dithering_fragment>", "#include <dithering_fragment>\n  gl_FragColor = vec4(gl_FragColor.rgb * gl_FragColor.a, max(max(gl_FragColor.r, gl_FragColor.g), gl_FragColor.b) * gl_FragColor.a);");
  };
  m.customProgramCacheKey = () => "fp3d-cone";
  return m;
}

/** The cones' blending follows the style: added on neon and the drawn looks, "screen" on natural materials. */
export function coneLook(m: MeshBasicMaterial, natural: boolean): void {
  m.blendSrc = natural ? OneMinusDstColorFactor : OneFactor;
}
