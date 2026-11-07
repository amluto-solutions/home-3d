// Colours as text (#403): what the shared colour field (components/colour-field.ts) takes when a colour is typed or
// pasted. Pure, no DOM; it travels with the field (the hosts draw the field through colour-field-tag.ts).

/** A colour as the field keeps it: lower-case "#rrggbb". */
export type HexColour = `#${string}`;

const RGB = /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/;

/**
 * A typed or pasted colour as "#rrggbb", or null when it is none: "#rgb", "#rrggbb", "rgb", "rrggbb" (any case,
 * spaces round it) and "rgb(r, g, b)" with 0 to 255 each (spaces instead of commas, and an alpha, are accepted and the
 * alpha dropped).
 */
export function parseColour(text: string): HexColour | null {
  const t = text.trim().toLowerCase();
  const rgb = RGB.exec(t);
  if (rgb) {
    const parts = rgb.slice(1, 4).map(Number);
    if (parts.some((n) => n > 255)) return null;
    return `#${parts.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  }
  const hex = t.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/.test(hex)) return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : null;
}
