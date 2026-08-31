import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GROVE, LAPIS, OCHRE, PALETTE, SANDSTONE } from "../src/palette.ts";

// A canvas is entirely opaque to axe, in jsdom and in Chrome alike (CLAUDE.md).
// So every contrast figure in this prototype is a hand-measurement, and a
// hand-measurement expires silently the moment a value moves. These tests are
// the only thing standing between "measured once" and "measured once, in
// August".

const css = readFileSync(resolve("styles.css"), "utf8");

/** The stylesheet carries fallback values so the page is legible before the
 *  script injects the real ones. Two copies of a colour is one copy too many
 *  unless something checks they agree. */
function fallback(name: string): string | undefined {
  return css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1]?.toLowerCase();
}

describe("the stylesheet's fallbacks match the palette module", () => {
  const pairs: [string, string][] = [
    ["sandstone", SANDSTONE],
    ["lapis", LAPIS],
    ["ochre", OCHRE],
    ["grove", GROVE],
  ];

  for (const [name, value] of pairs) {
    it(`--${name} agrees with the module`, () => {
      expect(
        fallback(name),
        `styles.css --${name} has drifted from src/palette.ts`,
      ).toBe(value.toLowerCase());
    });
  }

  it("defines no colour the palette does not have", () => {
    const declared = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    const allowed = new Set(PALETTE.map((c) => c.toLowerCase()));
    expect([...new Set(declared)].filter((c) => !allowed.has(c))).toEqual([]);
  });
});

// Relative luminance and contrast, per WCAG 2.1. Written out rather than
// pulled in so the numbers in palette.ts can be re-derived from nothing.
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("contrast against the ground, measured rather than remembered", () => {
  it("keeps body text on sandstone at AA", () => {
    // LAPIS is the only colour used for text anywhere.
    expect(contrast(LAPIS, SANDSTONE)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps water distinguishable from the channel it runs in", () => {
    // The single most important distinction in the game: a player has to see
    // water in a channel. Sandstone masonry on ochre sand, lapis water in the
    // masonry — which is why the ground is ochre and the pipes are sandstone
    // and not the other way round. Reversed, this pair manages 2.76:1.
    expect(contrast(LAPIS, SANDSTONE)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the channel visible against the sand", () => {
    expect(contrast(SANDSTONE, OCHRE)).toBeGreaterThanOrEqual(2);
  });

  it("admits the grove leans on shape, not contrast", () => {
    // Three colours cannot all be 3:1 from each other — that needs more
    // luminance range than any three points on one scale have. The grove is
    // the pair that gives: it is a large solid block with a pool at its centre
    // and four channels into it, so it is found by shape. Pinned so that
    // nobody later mistakes it for a measured pass.
    expect(contrast(GROVE, OCHRE)).toBeLessThan(3);
    expect(contrast(GROVE, SANDSTONE)).toBeGreaterThanOrEqual(3);
  });
});
