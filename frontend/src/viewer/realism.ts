// The realistic look (#39) in the 3D view: the themed surfaces get a lit twin (Blinn-Phong, flat shaded, so the plan's
// geometry needs no normals; matt surfaces have no highlight and light like Lambert), the sun from sun.sun lights them and throws shadows, the sky lights them from above, and
// a lawn under the house catches the shadow. The neon materials stay untouched: leaving the look gives them back.
//
// Cheap on purpose: one directional light with one shadow map (none on phones, a small one that is only redrawn when
// something other than the camera moved on the tablet level), Blinn-Phong instead of physically based materials, and
// the twins are shared by every mesh of a neon material (a handful per floor).
//
// Materials per colour role (#40): every vertex of a placed item carries its role's material (geo.ts `fp3dMat`, the
// numbers of role-materials.ts) and the twins draw it procedurally, without images: gloss and metal catch the sun and
// reflect the sky, glass is see-through (every other pixel left out, so it needs no sorting), fabric has a soft weave
// and sheen, rattan a basket weave. Patterns finer than a pixel fade to their average, so nothing shimmers.

import {
  BasicShadowMap,
  BufferAttribute,
  type BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  NormalBlending,
  PCFShadowMap,
  SRGBColorSpace,
  type Material,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from "three";
import { realisticSky, sunLight, type ShadowPlan, type SkyWeather } from "../realistic.ts";
import { makeFoldable, type FoldMasks, type FoldRole } from "./fold.ts";

/** A material that becomes lit in the realistic look: a themed surface drawn normally (no glow, no lines). */
function litSurface(m: Material | Material[]): m is MeshBasicMaterial {
  return m instanceof MeshBasicMaterial && m.userData.fp3dThemed === "surface" && m.blending === NormalBlending;
}

/** The scene's frame for the light: the middle of the house on its lawn and a radius around it (metres). */
export interface RealismFrame {
  x: number;
  y: number;
  z: number;
  r: number;
}

export class Realism {
  /** Lights and lawn: in the scene only while the look is on. */
  readonly group = new Group();
  private readonly sunLight = new DirectionalLight(0xffffff, 0);
  private readonly skyLight = new HemisphereLight(0xc4d8ee, 0x58604a, 1);
  private readonly lawn: Mesh<CircleGeometry, MeshLambertMaterial>;
  private readonly twins = new Map<MeshBasicMaterial, MeshPhongMaterial>();
  private readonly depths = new WeakMap<FoldMasks, Map<FoldRole, MeshDepthMaterial>>();
  /** The depth materials made, to free them with the look (the WeakMap above cannot be walked, #200). */
  private readonly depthAll = new Set<MeshDepthMaterial>();
  private meshes = new Set<Mesh>();
  private on = false;
  private plan: ShadowPlan | null = null;
  /** The renderer smooths edges: glass (#40) is drawn as coverage of the pixel instead of every other pixel. */
  private smooth = false;
  /** The shadow map must be drawn again (the sun moved, the house changed). */
  private dirty = true;

  constructor() {
    // the lawn fades out towards its edge into the sky's ground colour behind the canvas
    const lawn = new MeshLambertMaterial({ color: 0x58704a, flatShading: true, transparent: true, depthWrite: false });
    lawn.alphaMap = fadeTexture();
    this.lawn = new Mesh(new CircleGeometry(1, 48), lawn);
    this.lawn.rotation.x = -Math.PI / 2;
    this.lawn.receiveShadow = true;
    this.lawn.renderOrder = -2;
    this.group.add(this.sunLight, this.sunLight.target, this.skyLight, this.lawn);
  }

  get active(): boolean {
    return this.on;
  }

  /** Turns the look on or off; off gives every mesh its neon material back. */
  enable(scene: Scene, on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    this.dirty = true;
    if (on) {
      scene.add(this.group);
      return;
    }
    scene.remove(this.group);
    for (const mesh of this.meshes) {
      const basic = (mesh.material as Material).userData.fp3dBasic as MeshBasicMaterial | undefined;
      if (basic) mesh.material = basic;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.customDepthMaterial = undefined;
    }
    this.meshes.clear();
  }

  /** How shadows are drawn on this device (null: none). */
  setPlan(renderer: WebGLRenderer, plan: ShadowPlan | null): void {
    const was = this.plan;
    this.plan = plan;
    this.smooth = !!renderer.getContextAttributes?.()?.antialias;
    const on = this.on && !!plan;
    const size = plan?.size ?? 0;
    if (renderer.shadowMap.enabled !== on) {
      renderer.shadowMap.enabled = on;
      // the lit twins are compiled again with or without shadows
      for (const twin of this.twins.values()) twin.needsUpdate = true;
      this.lawn.material.needsUpdate = true;
    }
    renderer.shadowMap.type = plan?.soft ? PCFShadowMap : BasicShadowMap;
    renderer.shadowMap.autoUpdate = !!plan?.live;
    this.sunLight.castShadow = on;
    if (size && (!was || was.size !== size)) {
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
      this.sunLight.shadow.mapSize.set(size, size);
    }
    this.sunLight.shadow.radius = plan?.soft ? 3 : 1;
    // the coarser hard-edged map needs a larger bias against shadow acne
    this.sunLight.shadow.bias = plan?.soft ? -0.0006 : -0.002;
    this.dirty = true;
  }

  /** Something other than the camera changed (the sun, a door, the house): the shadow map is drawn again. */
  touch(): void {
    this.dirty = true;
  }

  /**
   * The sun and the sky for sun.sun (null: none), the weather (null: none) and the plan's north (degrees), around the
   * house `frame`.
   */
  update(sun: { azimuth: number; elevation: number } | null, weather: SkyWeather | null, north: number, frame: RealismFrame): void {
    const light = sunLight(sun, weather?.cloud ?? 0, north);
    const sky = realisticSky(sun ? sun.elevation : null, weather);
    const srgb = (c: readonly number[]) => new Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, SRGBColorSpace);
    this.sunLight.intensity = light.sun;
    this.sunLight.color.setRGB(light.color[0], light.color[1], light.color[2], SRGBColorSpace);
    this.sunLight.shadow.intensity = light.shadow;
    // the light stands out along the sun's direction, far enough to see the whole plot
    const reach = frame.r * 2;
    this.sunLight.position.set(frame.x + light.dir[0] * reach, frame.y + light.dir[1] * reach, frame.z + light.dir[2] * reach);
    this.sunLight.target.position.set(frame.x, frame.y, frame.z);
    this.sunLight.target.updateMatrixWorld();
    const cam = this.sunLight.shadow.camera;
    cam.left = cam.bottom = -frame.r;
    cam.right = cam.top = frame.r;
    cam.near = 0.5;
    cam.far = reach * 2;
    cam.updateProjectionMatrix();
    // the sky lights from above in its own colour, the ground throws a little of its colour back
    this.skyLight.intensity = light.sky;
    // (mostly white: a blue sky light would turn every shadow blue)
    this.skyLight.color.copy(srgb(sky.horizon).lerp(srgb(sky.top), 0.4).lerp(new Color(1, 1, 1), 0.6));
    this.skyLight.groundColor.copy(srgb(sky.ground));
    // the lawn in daylight colours (the lights darken it at night), white under snow
    this.lawn.material.color.copy(srgb(realisticSky(null, weather).ground));
    this.lawn.position.set(frame.x, frame.y, frame.z);
    this.lawn.scale.setScalar(frame.r * 1.6);
    this.dirty = true;
  }

  /**
   * Gives every themed surface under `root` its lit twin and keeps the twins in step with their neon materials (a
   * floor fading, a colour changing). Call before every frame while the look is on; `shadows`: whether this device
   * draws them. `moving`: something other than the camera moves this frame.
   */
  realize(root: Object3D, shadows: boolean, renderer?: WebGLRenderer, moving = false): void {
    if (!this.on) return;
    const seen = new Set<Mesh>();
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const cur = mesh.material;
      const basic = Array.isArray(cur) ? null : ((cur.userData.fp3dBasic as MeshBasicMaterial | undefined) ?? (litSurface(cur) ? cur : null));
      if (!basic) return;
      seen.add(mesh);
      mesh.material = this.twin(basic);
      withMaterials(mesh.geometry);
      // a floor that fades out lets the light through
      const solid = basic.visible && basic.depthWrite && (!basic.transparent || basic.opacity > 0.85);
      mesh.castShadow = shadows && solid;
      mesh.receiveShadow = shadows;
      const fold = basic.userData.fp3dFold as { masks: FoldMasks; role: FoldRole } | undefined;
      mesh.customDepthMaterial = fold && fold.role !== "glass" ? this.depth(fold.masks, fold.role) : undefined;
    });
    this.meshes = seen;
    for (const [basic, twin] of this.twins) sync(basic, twin, this.smooth);
    if (renderer && this.plan && !this.plan.live && (this.dirty || moving)) renderer.shadowMap.needsUpdate = true;
    this.dirty = false;
  }

  dispose(): void {
    for (const twin of this.twins.values()) twin.dispose();
    this.twins.clear();
    for (const m of this.depthAll) m.dispose();
    this.depthAll.clear();
    this.lawn.geometry.dispose();
    this.lawn.material.alphaMap?.dispose();
    this.lawn.material.dispose();
    this.sunLight.shadow.map?.dispose();
    this.sunLight.dispose();
  }

  private twin(basic: MeshBasicMaterial): MeshPhongMaterial {
    let twin = this.twins.get(basic);
    if (twin) return twin;
    // no highlight of its own: matt surfaces light like Lambert, the materials per role (#40) bring theirs
    twin = new MeshPhongMaterial({ vertexColors: basic.vertexColors, map: basic.map, flatShading: true, specular: 0x000000 });
    twin.userData.fp3dBasic = basic;
    twin.userData.fp3dVersion = basic.version;
    sync(basic, twin, this.smooth);
    // the neon material's patches (look, cut walls), and bright signal colours light themselves (theme.ts: fp3dGlow)
    twin.onBeforeCompile = (shader, renderer) => {
      basic.onBeforeCompile(shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * fp3dGlow;",
      );
      withRoleMaterials(shader);
    };
    twin.customProgramCacheKey = () => `${basic.customProgramCacheKey()}-lit`;
    const owned = twin;
    basic.addEventListener("dispose", () => {
      owned.dispose();
      this.twins.delete(basic);
    });
    this.twins.set(basic, twin);
    return twin;
  }

  private depth(masks: FoldMasks, role: FoldRole): MeshDepthMaterial {
    let byRole = this.depths.get(masks);
    if (!byRole) this.depths.set(masks, (byRole = new Map()));
    let m = byRole.get(role);
    if (!m) {
      byRole.set(role, (m = makeFoldable(new MeshDepthMaterial(), masks, role)));
      this.depthAll.add(m);
    }
    return m;
  }
}

/** A small radial alpha ramp: opaque in the middle, gone at the rim (the lawn's UVs map the circle onto it). */
function fadeTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.55, "#fff");
  g.addColorStop(1, "#000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

/** The neon material's state that changes while it is shown, copied to its twin. */
function sync(basic: MeshBasicMaterial, twin: MeshPhongMaterial, smooth: boolean): void {
  twin.opacity = basic.opacity;
  twin.transparent = basic.transparent;
  twin.visible = basic.visible;
  twin.side = basic.side;
  twin.depthWrite = basic.depthWrite;
  twin.depthTest = basic.depthTest;
  twin.alphaTest = basic.alphaTest;
  twin.polygonOffset = basic.polygonOffset;
  twin.polygonOffsetFactor = basic.polygonOffsetFactor;
  twin.polygonOffsetUnits = basic.polygonOffsetUnits;
  twin.color.copy(basic.color);
  // glass as coverage only where nothing is blended (a fading floor stays as it is)
  const coverage = smooth && !basic.transparent;
  if (twin.alphaToCoverage !== coverage) {
    twin.alphaToCoverage = coverage;
    twin.needsUpdate = true;
  }
  if (twin.map !== basic.map) {
    twin.map = basic.map;
    twin.needsUpdate = true;
  }
  if (twin.userData.fp3dVersion !== basic.version) {
    twin.userData.fp3dVersion = basic.version;
    twin.needsUpdate = true;
  }
}

/** A geometry drawn without materials (walls, floors) reads matt: material 0 for each of its vertices. */
function withMaterials(geo: BufferGeometry): void {
  const pos = geo.getAttribute("position");
  if (!pos) return;
  const mat = geo.getAttribute("fp3dMat");
  // an item's own materials are kept; the matt one is made again when the geometry grew
  if (mat && (mat.count === pos.count || !("name" in mat) || mat.name !== "fp3dMatt")) return;
  const matt = new BufferAttribute(new Float32Array(pos.count), 1);
  matt.name = "fp3dMatt";
  geo.setAttribute("fp3dMat", matt);
}

/**
 * The materials per colour role (#40, role-materials.ts) in a lit twin's shader: 0 matt, 1 gloss, 2 fabric, 3 glass,
 * 4 metal, 5 rattan weave. Patterns lie on the plane a face lies in most, in world metres.
 */
function withRoleMaterials(shader: { vertexShader: string; fragmentShader: string }): void {
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nattribute float fp3dMat;\nflat varying int vFp3dMat;\nvarying vec3 vFp3dWorld;")
    .replace("#include <project_vertex>", "#include <project_vertex>\n  vFp3dMat = int(fp3dMat + 0.5);\n  vFp3dWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${MATERIAL_GLSL}`)
    .replace("#include <specularmap_fragment>", `#include <specularmap_fragment>\n${MATERIAL_PATTERN}`)
    .replace("#include <lights_phong_fragment>", `#include <lights_phong_fragment>\n${MATERIAL_LIGHT}`)
    .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>\n${MATERIAL_SKY}`);
}

const MATERIAL_GLSL = `
flat varying int vFp3dMat;
varying vec3 vFp3dWorld;
float fp3dHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
// smooth value noise: the soft unevenness of a fabric
float fp3dNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fp3dHash(i), fp3dHash(i + vec2(1.0, 0.0)), f.x), mix(fp3dHash(i + vec2(0.0, 1.0)), fp3dHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// how much of a pattern (t in repeats) is still bigger than a pixel: 0 when finer, then only its average shows
float fp3dSharp(vec2 t) {
  return clamp(1.5 - max(fwidth(t.x), fwidth(t.y)) * 2.5, 0.0, 1.0);
}
`;

const MATERIAL_PATTERN = `
  int fp3dM = vFp3dMat;
  vec3 fp3dBase = diffuseColor.rgb;
  vec3 fp3dN = abs(normalize(cross(dFdx(vFp3dWorld), dFdy(vFp3dWorld))));
  vec2 fp3dUv = fp3dN.y > max(fp3dN.x, fp3dN.z) ? vFp3dWorld.xz : (fp3dN.x > fp3dN.z ? vFp3dWorld.zy : vFp3dWorld.xy);
  if (fp3dM == 3) {
    // glass: see-through without sorting: with antialiasing as coverage of the pixel, else every other pixel left out
    #ifdef ALPHA_TO_COVERAGE
      diffuseColor.a *= 0.45;
    #else
      if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 0.5) discard;
    #endif
    // a cool, pale tint
    diffuseColor.rgb = mix(fp3dBase, vec3(0.72, 0.84, 0.86), 0.5) * 0.6;
  } else if (fp3dM == 2) {
    // fabric: a soft unevenness and, close up, a plain weave of threads about 3 mm apart
    vec2 t = fp3dUv * 2000.0;
    float weave = (sin(t.x) * sin(t.y)) * fp3dSharp(t / 6.2832);
    float nap = fp3dNoise(fp3dUv * 18.0) - 0.5;
    diffuseColor.rgb *= 0.9 + 0.08 * weave + 0.12 * nap;
  } else if (fp3dM == 5) {
    // rattan: a basket weave of cells 5 cm across, two round strands each, turned a quarter in every other cell, dark
    // gaps between the cells; from afar the cells still show when the strands are finer than a pixel
    vec2 c = fp3dUv / 0.05;
    vec2 cell = floor(c);
    vec2 f = fract(c);
    bool across = mod(cell.x + cell.y, 2.0) < 0.5;
    float strand = fract((across ? f.y : f.x) * 2.0);
    float rounded = 1.0 - pow(abs(strand * 2.0 - 1.0), 2.0);
    float gap = smoothstep(0.0, 0.08, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    float strands = mix(0.9, 0.62 + 0.48 * rounded, fp3dSharp(c * 2.0));
    float cells = mix(0.9, (across ? 1.0 : 0.8) * (0.6 + 0.4 * gap), fp3dSharp(c));
    diffuseColor.rgb *= strands * cells;
  } else if (fp3dM == 4) {
    // metal: little diffuse light, its colour is in its highlight and reflection
    diffuseColor.rgb = fp3dBase * 0.3;
  }
`;

const MATERIAL_LIGHT = `
  if (fp3dM == 1) {
    material.specularColor = vec3(0.45);
    material.specularShininess = 90.0;
  } else if (fp3dM == 4) {
    material.specularColor = mix(fp3dBase, vec3(1.0), 0.3) * 1.3;
    material.specularShininess = 45.0;
  } else if (fp3dM == 3) {
    material.specularColor = vec3(0.9);
    material.specularShininess = 160.0;
  } else if (fp3dM == 5) {
    material.specularColor = vec3(0.12);
    material.specularShininess = 20.0;
  }
`;

const MATERIAL_SKY = `
  if (fp3dM != 0) {
    // the sky and the ground in shiny surfaces (a bright sky above the horizon, the dark ground below it), more at a
    // glancing angle (Schlick); a sheen on fabric
    float fp3dFresnel = pow(1.0 - clamp(dot(geometryNormal, geometryViewDir), 0.0, 1.0), 5.0);
    vec3 fp3dR = normalize((vec4(reflect(-geometryViewDir, geometryNormal), 0.0) * viewMatrix).xyz);
    #if NUM_HEMI_LIGHTS > 0
      vec3 fp3dSky = hemisphereLights[0].skyColor;
      vec3 fp3dGround = hemisphereLights[0].groundColor * 0.6;
    #else
      vec3 fp3dSky = vec3(0.4);
      vec3 fp3dGround = vec3(0.1);
    #endif
    vec3 fp3dEnv = mix(fp3dGround, fp3dSky, smoothstep(-0.15, 0.35, fp3dR.y));
    if (fp3dM == 1) reflectedLight.indirectSpecular += fp3dEnv * (0.05 + 0.35 * fp3dFresnel);
    else if (fp3dM == 4) reflectedLight.indirectSpecular += fp3dEnv * mix(fp3dBase, vec3(1.0), fp3dFresnel) * 0.7;
    else if (fp3dM == 3) reflectedLight.indirectSpecular += fp3dEnv * (0.12 + 0.6 * fp3dFresnel);
    else if (fp3dM == 2) reflectedLight.indirectDiffuse += fp3dSky * fp3dBase * fp3dFresnel * 0.6;
  }
`;
