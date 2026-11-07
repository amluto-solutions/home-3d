// Shrinks the GLSL shader code that three.js ships as string literals (#179): about 117 KB of the 3D bundle, written
// with indentation, blank lines and comments for people to read. The build (build.mjs) runs it over three.js as it
// bundles; the shaders compile the same.

/**
 * One shader text, smaller: every line trimmed, blank and comment lines gone, a comment at the end of a line gone,
 * and the spaces around brackets, commas and semicolons dropped in code lines. Preprocessor lines (#define, #include
 * …) only lose their indentation – a space after a macro's name decides whether it takes arguments. A text with a
 * line continuation (a backslash at the end of a line) or a block comment is left as it is.
 */
export function shrinkGlsl(code: string): string {
  if (/\\\r?\n/.test(code) || code.includes("/*")) return code;
  const out: string[] = [];
  for (const raw of code.split("\n")) {
    let line = raw.trim();
    if (!line.startsWith("#")) line = line.replace(/\/\/.*$/, "").trim();
    if (!line) continue;
    if (!line.startsWith("#")) line = line.replace(/\s+/g, " ").replace(/ ?([()[\]{},;]) ?/g, "$1");
    out.push(line);
  }
  return out.join("\n");
}

/** Whether a string literal of three.js is shader code (and not, say, an error message). */
export function looksLikeGlsl(text: string): boolean {
  return text.includes("\n") && /#(?:if|include|define|endif)\b|\bgl_\w+|\b(?:vec[234]|mat[234]|uniform|varying|void main)\b/.test(text);
}

/**
 * The source of a three.js build file with every top-level shader string (`var name = "…";`, which is how three.js
 * keeps its ShaderChunk and ShaderLib texts) shrunk. Everything else stays byte for byte.
 */
export function shrinkThreeShaders(source: string): { code: string; saved: number } {
  let saved = 0;
  const code = source.replace(/^((?:var|const|let) [\w$]+ = )("(?:[^"\\\n]|\\.)*")(;)$/gm, (all, head: string, literal: string, tail: string) => {
    const text = JSON.parse(literal) as string;
    if (!looksLikeGlsl(text)) return all;
    const shrunk = JSON.stringify(shrinkGlsl(text));
    saved += literal.length - shrunk.length;
    return head + shrunk + tail;
  });
  return { code, saved };
}
