import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { looksLikeGlsl, shrinkGlsl, shrinkThreeShaders } from "./glsl-shrink.ts";

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
