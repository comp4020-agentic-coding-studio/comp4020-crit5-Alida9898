import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BACKGROUND, CAMERA, FORM, LIGHT, PALETTE, RENDER } from "../src/config/style.ts";

// The stylesheet carries fallback copies of the palette so the page is legible
// before the script runs. Two copies of a colour is one copy too many unless
// something checks they agree — and a canvas is opaque to axe, so these values
// are the only auditable record of what the screen actually shows.

const css = readFileSync(resolve("styles.css"), "utf8");

function declared(name: string): string | undefined {
  return css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1]?.toLowerCase();
}

describe("the stylesheet's palette matches the module", () => {
  it("agrees on the background", () => {
    expect(declared("background")).toBe(BACKGROUND.toLowerCase());
  });

  for (const [hue, tones] of Object.entries(PALETTE)) {
    for (const [tone, value] of Object.entries(tones)) {
      it(`agrees on ${hue} ${tone}`, () => {
        expect(declared(`${hue}-${tone}`), `styles.css --${hue}-${tone} has drifted`).toBe(
          value.toLowerCase(),
        );
      });
    }
  }

  it("uses no colour outside the palette", () => {
    const allowed = new Set(
      [BACKGROUND, ...Object.values(PALETTE).flatMap((t) => Object.values(t))].map((c) =>
        c.toLowerCase(),
      ),
    );
    const stray = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)]
      .map((m) => m[0].toLowerCase())
      .filter((c) => !allowed.has(c));
    expect([...new Set(stray)]).toEqual([]);
  });
});

// Relative luminance and contrast, per WCAG 2.1, written out so the figures
// can be re-derived from nothing.
function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("contrast, measured rather than remembered", () => {
  it("carries text on the background at AA", () => {
    // The darkest lapis is the only colour any writing uses.
    expect(contrast(PALETTE.lapis.dark, BACKGROUND)).toBeGreaterThanOrEqual(4.5);
  });

  it("separates water from the masonry it runs in", () => {
    // The single most important distinction on screen.
    expect(contrast(PALETTE.lapis.mid, PALETTE.sandstone.light)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps each hue's three tones distinguishable as faces of one solid", () => {
    // Volume comes from face brightness, so the tones must actually differ —
    // but not so much that one solid reads as three materials.
    for (const [hue, tones] of Object.entries(PALETTE)) {
      const lit = contrast(tones.light, tones.mid);
      const shade = contrast(tones.mid, tones.dark);
      expect(lit, `${hue}: lit and mid faces are the same`).toBeGreaterThan(1.15);
      expect(shade, `${hue}: mid and dark faces are the same`).toBeGreaterThan(1.15);
      expect(contrast(tones.light, tones.dark), `${hue} reads as three materials`).toBeLessThan(6);
    }
  });
});

describe("the render constraints hold", () => {
  it("sits at the one pitch where whole-number cells coincide exactly", () => {
    // The spec asks for 30–35 AND for pixel-exact coincidence. Only
    // atan(1/√2) = 35.264° delivers the second: the compensation ratio is
    // √2/tan(pitch), which is 2 there and irrational either side. Anything
    // else leaves the two edges a hair apart — the exact failure the spec
    // rules out perspective for.
    expect(CAMERA.pitchDeg).toBeGreaterThanOrEqual(30);
    expect(CAMERA.pitchDeg).toBeCloseTo((Math.atan(1 / Math.SQRT2) * 180) / Math.PI, 6);
    const ratio = Math.SQRT2 / Math.tan((CAMERA.pitchDeg * Math.PI) / 180);
    expect(ratio, "one storey up must be exactly two cells back").toBeCloseTo(2, 9);
  });

  it("enumerates the azimuths, evenly, with no duplicates", () => {
    const az = [...CAMERA.azimuthsDeg];
    expect(new Set(az).size).toBe(az.length);
    for (let i = 1; i < az.length; i++) {
      expect(az[i] - az[i - 1], "angles must be evenly spaced to cycle").toBe(90);
    }
  });

  it("gives the turn long enough to hide the broken in-between angles", () => {
    // Every intermediate angle breaks the illusion. The animation is where
    // that is hidden, so it cannot be instant.
    expect(CAMERA.turnMs).toBeGreaterThanOrEqual(300);
  });

  it("eases in and out, so no angle is read mid-flight", () => {
    expect(CAMERA.ease(0)).toBeCloseTo(0, 6);
    expect(CAMERA.ease(1)).toBeCloseTo(1, 6);
    expect(CAMERA.ease(0.5)).toBeCloseTo(0.5, 2);
  });

  it("lights the dark faces enough that they read as stone", () => {
    expect(LIGHT.ambientIntensity).toBeGreaterThanOrEqual(0.5);
    expect(RENDER.antialias).toBe(true);
  });

  it("builds a terrace out of more than one box", () => {
    // Body, top slab, cornice — a single box has no cornice line and reads
    // flat under a fixed light.
    expect(FORM.corniceOverhang).toBeGreaterThan(0);
    expect(FORM.terraceSlab).toBeGreaterThan(0);
    expect(FORM.columnSegments).toBeGreaterThan(1);
  });
});
