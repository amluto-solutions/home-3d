// Shared layout tokens (#246, the menus redesign #219): one 4 px spacing scale, corner radii, type sizes and the 44 px
// touch minimum. Colours are the scheme's (scheme.ts); size classes are phone.ts's. Plain data, so tests can hold it to
// the rules, and styles.ts turns it into `--fp3d-*` variables every Home 3D part inherits.

/** The spacing scale: every gap and padding is one of these (4 px steps). 8 between rows, 16 inside cards, 24 between cards. */
export const SPACE = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;

/** Corners: controls, cards and menus; pill only for switches and true chips. */
export const RADIUS = { control: 6, card: 8, pill: 999 } as const;

/** Type sizes (px): section heading, card heading, body, hint and group label. */
export const TYPE = { section: 18, card: 15, body: 14, hint: 12, label: 12 } as const;

/** The smallest tap target on a touch screen (px). */
export const TOUCH_MIN = 44;

/** The tokens as CSS variables: `--fp3d-space-2: 8px;` … */
export function layoutVars(): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(SPACE)) lines.push(`--fp3d-space-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(RADIUS)) lines.push(`--fp3d-radius-${k}: ${v}px;`);
  for (const [k, v] of Object.entries(TYPE)) lines.push(`--fp3d-type-${k}: ${v}px;`);
  lines.push(`--fp3d-touch: ${TOUCH_MIN}px;`);
  return lines.join("\n");
}
