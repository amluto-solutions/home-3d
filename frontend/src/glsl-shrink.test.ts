import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { looksLikeGlsl, shrinkGlsl, shrinkGlslTemplates, shrinkThreeShaders } from "./glsl-shrink.ts";

test("shader code loses indentation, blank and comment lines and the spaces around brackets (#179)", () => {
  const code = "#ifdef USE_MAP\n\t// the map\n\tvec4 c = texture2D( map, vUv ); // sampled\n\n\tgl_FragColor = vec4( c.rgb * ( 1.0 - a ), 1.0 );\n#endif";
  assert.equal(shrinkGlsl(code), "#ifdef USE_MAP\nvec4 c = texture2D(map,vUv);\ngl_FragColor = vec4(c.rgb *(1.0 - a),1.0);\n#endif");
});

test("preprocessor lines keep their spaces: `#define A (x)` is not a macro taking x (#179)", () => {
  const code = "\t#define RECIPROCAL_PI ( 1.0 / PI )\n\t#define saturate( a ) clamp( a, 0.0, 1.0 )\n\t#include <common>";
  assert.equal(shrinkGlsl(code), "#define RECIPROCAL_PI ( 1.0 / PI )\n#define saturate( a ) clamp( a, 0.0, 1.0 )\n#include <common>");
});

test("a text with a line continuation or a block comment stays as it is (#179)", () => {
  const cont = "#define F( a ) \\\n\t( a * 2.0 )\nvoid main() {}";
  assert.equal(shrinkGlsl(cont), cont);
  const block = "/* a\n * b */\nvoid main() {\n\tgl_FragColor = vec4( 1.0 );\n}";
  assert.equal(shrinkGlsl(block), block);
});

test("only shader strings of a three.js build file change; other code stays byte for byte (#179)", () => {
  const src = [
    'var alphamap_fragment = "#ifdef USE_ALPHAMAP\\n\\tdiffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;\\n#endif";',
    'const message = "THREE.WebGLRenderer: Context Lost.";',
    "function f( a ) { return a; }",
  ].join("\n");
  const { code, saved } = shrinkThreeShaders(src);
  assert.equal(code.split("\n")[0], 'var alphamap_fragment = "#ifdef USE_ALPHAMAP\\ndiffuseColor.a *= texture2D(alphaMap,vAlphaMapUv).g;\\n#endif";');
  assert.deepEqual(code.split("\n").slice(1), src.split("\n").slice(1));
  assert.ok(saved > 0);
  assert.equal(looksLikeGlsl("THREE.WebGLRenderer: Context Lost."), false);
});

test("three.js as installed: its shaders shrink by several KB, and every chunk keeps its preprocessor lines (#179)", () => {
  const file = new URL("../node_modules/three/build/three.module.js", import.meta.url);
  const src = readFileSync(file, "utf8");
  const { code, saved } = shrinkThreeShaders(src);
  assert.ok(saved > 5000, `saved ${saved} bytes`);
  const directives = (s: string) => (s.match(/#(?:if|ifdef|ifndef|else|elif|endif|define|include|pragma)\b/g) ?? []).length;
  assert.equal(directives(code), directives(src));
});

test("our shader templates shrink between their interpolations; the edges next to one keep a space (#434)", () => {
  const src = "const G = `\nuniform int uTheme;\n// a note\nvec3 f(vec3 c) {\n  if (c.r > ${a}) return ${b};\n  return vec3( 1.0 );\n}\n${C}\n#define X ${d}\n`;";
  assert.equal(shrinkGlslTemplates(src), "const G = `\nuniform int uTheme;\nvec3 f(vec3 c){\nif(c.r > ${a})return ${b};\nreturn vec3(1.0);\n}\n${C}\n#define X ${d}\n`;");
});

test("templates inside interpolations, strings, comments and regular expressions are followed, not changed (#434)", () => {
  const src = [
    "const re = /`[a-z]`/g; // a `backtick` in a comment",
    'const s = "`" + \'`\';',
    "const G = `void main() {\n  ${xs.map((x) => `  float a${x} = 1.0;`).join(\"\\n\")}\n  gl_FragColor = vec4( 1.0 );\n}`;",
    "const d = a / b / c;",
  ].join("\n");
  const out = shrinkGlslTemplates(src);
  assert.equal(out, src.replace("void main() {\n  ${", "void main(){\n${").replace("\n  gl_FragColor = vec4( 1.0 );\n}`", "\ngl_FragColor = vec4(1.0);\n}`"));
});

test("a template that is no shader code, has an escape, or a comment running into an interpolation stays as it is (#434)", () => {
  for (const src of [
    "const h = `<div>\n  ${x}\n</div>`;",
    "const g = `vec3 a;\n  float b = 1.0; \\n`;",
    "const g = `vec3 a;\n  // the colour ${c} here\n  float b = 1.0;`;",
    "const g = `vec3 a;\n  /* block */\n  float b;`;",
  ])
    assert.equal(shrinkGlslTemplates(src), src);
  // a source the scanner can't follow comes back as it is
  assert.equal(shrinkGlslTemplates("const a = `vec3 x;\n"), "const a = `vec3 x;\n");
});

test("the 3D view's own shader files shrink and keep every interpolation and preprocessor line (#434)", () => {
  let saved = 0;
  for (const f of ["theme.ts", "realism.ts", "viewer3d.ts", "fold.ts", "projection.ts", "pool-water.ts", "solar-live.ts"]) {
    const src = readFileSync(new URL(`./viewer/${f}`, import.meta.url), "utf8");
    const out = shrinkGlslTemplates(src);
    saved += src.length - out.length;
    const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
    assert.equal(count(out, /\$\{/g), count(src, /\$\{/g), f);
    assert.equal(count(out, /`/g), count(src, /`/g), f);
    assert.equal(count(out, /#(?:if|ifdef|ifndef|else|elif|endif|define|include)\b/g), count(src, /#(?:if|ifdef|ifndef|else|elif|endif|define|include)\b/g), f);
  }
  assert.ok(saved > 3000, `saved ${saved} bytes`);
});
