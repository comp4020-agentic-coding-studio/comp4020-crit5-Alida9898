// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import axe from "axe-core";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// The template's roster measures no accessibility, and CLAUDE.md says wiring that
// sensor is my work. This is that sensor, carried forward from A1 with the
// exhibit-specific assertions dropped.
//
// Read the green honestly. axe in jsdom sees the markup and the accessibility tree
// but there is no layout, so every rule that needs geometry or real computed
// colour is unavailable. In particular COLOUR CONTRAST IS NOT CHECKED HERE — that
// one needs a browser (`ab a11y`, see CLAUDE.md). A pass below means the structure
// is sound, not that the page is accessible.

const shipped = readFileSync(resolve("dist/index.html"), "utf8");
document.documentElement.setAttribute("lang", "en-AU");
document.body.innerHTML = new JSDOM(shipped).window.document.body.innerHTML;

/** Rules axe cannot evaluate without layout, listed so the gap is on the record. */
const NEEDS_A_BROWSER = ["color-contrast", "target-size"];

async function violations(): Promise<axe.Result[]> {
  const outcome = await axe.run(document.body, {
    resultTypes: ["violations"],
    rules: Object.fromEntries(NEEDS_A_BROWSER.map((id) => [id, { enabled: false }])),
  });
  return outcome.violations;
}

function describeAll(found: axe.Result[]): string {
  return found
    .map((issue) => {
      const where = issue.nodes.map((node) => node.html.slice(0, 90)).join("\n      ");
      return `\n  [${issue.impact}] ${issue.id}: ${issue.help}\n      ${where}`;
    })
    .join("");
}

describe("the shipped page is reachable without a mouse or a screen", () => {
  it("has no axe violations in its structure", async () => {
    const found = await violations();
    expect(found.length, `axe found ${found.length} violation(s):${describeAll(found)}`).toBe(0);
  }, 30000);

  it("names every control a keyboard user can land on", () => {
    const focusable = [
      // a[href], not [href]: an SVG <image href="..."> matches the broad form and
      // is not focusable, which made this fail on a decorative illustration.
      ...document.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ];
    expect(
      focusable.length,
      "nothing is focusable, so the page cannot be used without a mouse at all",
    ).toBeGreaterThan(0);

    for (const control of focusable) {
      const named =
        control.getAttribute("aria-label")?.trim() ||
        control.textContent?.trim() ||
        (control instanceof HTMLInputElement
          ? control.labels?.[0]?.textContent?.trim()
          : undefined) ||
        "";
      expect(
        named.length,
        `<${control.tagName.toLowerCase()}${control.id ? ` id="${control.id}"` : ""}> can be focused but has no accessible name, so a screen reader announces nothing`,
      ).toBeGreaterThan(0);
    }
  });
});
