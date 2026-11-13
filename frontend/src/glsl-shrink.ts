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

const KEEP_OPEN = new Set([..."(,=:[!&|?{};+-*%<>~^"]);
const REGEX_AFTER = /(?:^|[^\w$])(?:return|typeof|case|in|of|delete|void|throw|new|else|do|yield|await)$/;

/** One template literal of a TypeScript source, from its opening backtick: its static texts and its interpolations. */
interface Template {
  /** Static texts, raw as in the source (one more than `exprs`). */
  texts: string[];
  /** The interpolations' source, already with their own templates shrunk. */
  exprs: string[];
  /** Index just past the closing backtick. */
  end: number;
}

/**
 * Shrinks one template's static texts if, together, they are shader code with real line breaks: lines trimmed, blank
 * and comment lines gone, spaces around brackets dropped (as `shrinkGlsl`). The edges next to an interpolation keep a
 * space where they had one (`return ${x}` stays apart). Null when it is not shader code or not safe to touch: a
 * backslash (an escape), a block comment, or a `//` comment running into an interpolation.
 */
function shrinkTemplateTexts(texts: string[]): string[] | null {
  const joined = texts.join("");
  if (!joined.includes("\n") || !looksLikeGlsl(joined) || joined.includes("\\") || joined.includes("/*")) return null;
  const out: string[] = [];
  for (let s = 0; s < texts.length; s++) {
    const lines = texts[s]!.split("\n");
    const kept: string[] = [];
    for (let j = 0; j < lines.length; j++) {
      const partialLeft = j === 0 && s > 0;
      const partialRight = j === lines.length - 1 && s < texts.length - 1;
      let line = lines[j]!;
      const directive = !partialLeft && line.trimStart().startsWith("#");
      if (line.includes("//") && !directive) {
        // a comment that runs on into an interpolation can't be cut here
        if (partialRight) return null;
        line = line.replace(/\/\/.*$/, "");
      }
      if (directive) line = line.trimStart();
      else {
        line = line.replace(/\s+/g, " ").replace(/ ?([()[\]{},;]) ?/g, "$1");
        if (!partialLeft) line = line.replace(/^ /, "");
        if (!partialRight) line = line.replace(/ $/, "");
      }
      // blank lines inside a text go; its first and last line stay, so the line breaks at its ends (after an
      // interpolation, at the template's start and end) are kept: a directive must stay on a line of its own
      if (!line && j > 0 && j < lines.length - 1) continue;
      kept.push(line);
    }
    out.push(kept.join("\n"));
  }
  return out;
}

/**
 * The template literal starting at `start` (its backtick), with templates inside its interpolations handled too.
 * Null when the source ends before it closes.
 */
function readTemplate(src: string, start: number): Template | null {
  const texts: string[] = [];
  const exprs: string[] = [];
  let text = "";
  let i = start + 1;
  while (i < src.length) {
    const c = src[i]!;
    if (c === "\\") {
      text += src.slice(i, i + 2);
      i += 2;
    } else if (c === "`") {
      texts.push(text);
      return { texts, exprs, end: i + 1 };
    } else if (c === "$" && src[i + 1] === "{") {
      texts.push(text);
      text = "";
      const code = readCode(src, i + 2, true);
      if (!code) return null;
      exprs.push(code.out);
      i = code.end + 1;
    } else {
      text += c;
      i++;
    }
  }
  return null;
}

/**
 * Source code from `start` with every shader template shrunk; stops at the brace that closes an interpolation when
 * `inner` (returning the index of that brace), else at the end. Strings, comments and regular expressions are copied as
 * they are. Null when the source does not close.
 */
function readCode(src: string, start: number, inner: boolean): { out: string; end: number } | null {
  let out = "";
  let depth = 0;
  let i = start;
  // the last character that is not a space or a comment, to tell a regular expression from a division
  let prev = "";
  while (i < src.length) {
    const c = src[i]!;
    if (c === "/" && src[i + 1] === "/") {
      const end = src.indexOf("\n", i);
      const stop = end < 0 ? src.length : end;
      out += src.slice(i, stop);
      i = stop;
    } else if (c === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      if (end < 0) return null;
      out += src.slice(i, end + 2);
      i = end + 2;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      if (j >= src.length) return null;
      out += src.slice(i, j + 1);
      i = j + 1;
      prev = c;
    } else if (c === "/" && (prev === "" || KEEP_OPEN.has(prev) || REGEX_AFTER.test(out.trimEnd()))) {
      // a regular expression literal (a class may hold a slash)
      let j = i + 1;
      let cls = false;
      while (j < src.length && (cls || src[j] !== "/")) {
        if (src[j] === "\n") return null;
        if (src[j] === "\\") j++;
        else if (src[j] === "[") cls = true;
        else if (src[j] === "]") cls = false;
        j++;
      }
      if (j >= src.length) return null;
      out += src.slice(i, j + 1);
      i = j + 1;
      prev = "/";
    } else if (c === "`") {
      const t = readTemplate(src, i);
      if (!t) return null;
      const texts = shrinkTemplateTexts(t.texts) ?? t.texts;
      out += "`" + texts.map((s, k) => (k < t.exprs.length ? `${s}\${${t.exprs[k]}}` : s)).join("") + "`";
      i = t.end;
      prev = "`";
    } else {
      if (c === "{") depth++;
      else if (c === "}") {
        if (inner && depth === 0) return { out, end: i };
        depth--;
      }
      out += c;
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  }
  return inner ? null : { out, end: i };
}

/**
 * A TypeScript source with the shader code in its template literals shrunk (#434): the 3D view's own shader patches
 * are written with indentation and comments for people to read. Only templates whose text is shader code with real line
 * breaks change, and only between their interpolations; everything else stays byte for byte. A source the scanner can't
 * follow is returned as it is.
 */
export function shrinkGlslTemplates(source: string): string {
  return readCode(source, 0, false)?.out ?? source;
}
