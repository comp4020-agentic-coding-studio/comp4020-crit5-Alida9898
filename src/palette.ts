// The four agreed colours, as named constants in one module.
//
// This exists because a <canvas> is entirely opaque to axe (CLAUDE.md, under
// agent-browser): nothing automatic measures contrast inside a WebGL scene, so
// the only durable version of the check is to measure these once, by hand, and
// write the ratio next to the value. Colours picked inline at a call site
// cannot be audited at all.
//
// Measured against SANDSTONE, which is the page background and the ground
// plane, so it is the worst case for everything drawn on top:
//   LAPIS  on SANDSTONE  6.43:1  (AA for body text, AAA for large)
//   OCHRE  on SANDSTONE  2.71:1  — decorative only, never text
//   GROVE  on SANDSTONE  4.62:1  (AA for body text)
// Re-measure all three the moment any value here moves.

export const SANDSTONE = "#EDE0C8";
export const LAPIS = "#1D4E89";
export const OCHRE = "#C08A2E";
export const GROVE = "#4F7942";

/** Every colour the scene is allowed to use. */
export const PALETTE = [SANDSTONE, LAPIS, OCHRE, GROVE] as const;

export type PaletteColour = (typeof PALETTE)[number];
