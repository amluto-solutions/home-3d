// Shrinks the CSS of `css` template literals as the Settings bundle is built (#296): the page's styles are written with
// indentation and comments for people to read, about 12 KB of a bundle that is at its budget. Whitespace is collapsed
// and comments dropped; quoted strings and `${…}` interpolations stay as they are, so the CSS means the same.

const QUOTES = new Set(['"', "'"]);

/** One stylesheet's text, smaller. */
export function shrinkCss(css: string): string {
  // split into pieces to leave alone (strings, interpolations) and pieces to shrink
  const parts: { keep: boolean; text: string }[] = [];
  let cur = "";
  const flush = (keep: boolean, text: string) => {
    if (cur) parts.push({ keep: false, text: cur });
    cur = "";
    parts.push({ keep, text });
  };
  for (let i = 0; i < css.length; i++) {
    const c = css[i]!;
    if (c === "/" && css[i + 1] === "*") {
      // a comment goes first: an apostrophe in one is not the start of a string
      const end = css.indexOf("*/", i + 2);
      if (end < 0) return css;
      cur += " ";
      i = end + 1;
    } else if (QUOTES.has(c)) {
      const end = css.indexOf(c, i + 1);
      if (end < 0) return css;
      flush(true, css.slice(i, end + 1));
      i = end;
    } else if (c === "$" && css[i + 1] === "{") {
      const end = css.indexOf("}", i);
      if (end < 0) return css;
      flush(true, css.slice(i, end + 1));
      i = end;
    } else cur += c;
  }
  if (cur) parts.push({ keep: false, text: cur });
  let out = parts
    .map((p) =>
      p.keep
        ? p.text
        : p.text
            .replace(/\/\*[\s\S]*?\*\//g, " ")
            .replace(/\s+/g, " ")
            .replace(/ ?([{};,]) ?/g, "$1")
            .replace(/: /g, ":")
            .replace(/;}/g, "}"),
    )
    .join("");
  out = out.trim();
  return out;
}

/** The source with the text of every `css` template shrunk (one with a backslash is left alone). */
export function shrinkCssTemplates(source: string): string {
  const slash = String.fromCharCode(92);
  return source.replace(/(?<![\w$])css`([^`]*)`/g, (all, body: string) => (body.includes(slash) ? all : `css\`${shrinkCss(body)}\``));
}
