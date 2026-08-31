import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Contract tests for crit 5, "A game". These answer this week's published
// spec, so they retire with it — they don't carry into next week's repo.
//
//   https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/05-game/
//
// The spec lines a person judges at the crit, not testable here: whether a
// stranger reaches an ending inside five minutes, and whether one change came
// from playing the finished game rather than reading its code.

const DIST = resolve("dist");

function files(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const pages = files()
  .map((path) => relative(DIST, path).split(sep).join("/"))
  .filter((name) => name.endsWith(".html"))
  .map((name) => ({
    name,
    doc: new JSDOM(readFileSync(join(DIST, name), "utf8")).window.document,
  }));

// Tutorial-shaped phrasings: prose that explains the game instead of letting
// the game explain itself. A bare control label ("Start", "Play again") is a
// verb the player acts on, not an instruction about how to play, so the
// patterns below all need more than one word.
const INSTRUCTIONAL = [
  /how\s+to\s+play/i,
  /instructions?\b/i,
  /\btutorial\b/i,
  /how\s+it\s+works/i,
  /\bthe\s+rules?\b/i,
  /your\s+(goal|objective|aim)\s+is/i,
  /the\s+(goal|objective|aim)\s+is/i,
  /\byou\s+(must|need\s+to|should|have\s+to)\b/i,
  /(press|click|tap|drag|use)\s+(the|a|an|your|arrow|space|wasd|\w+\s+key)/i,
  /(click|tap|press)\s+to\s+\w+/i,
  /to\s+(begin|start|play)\s*[,:]/i,
];

describe("spec: it teaches itself", () => {
  // "no instructions anywhere, on screen or off — the opening screen invites
  // the first move, and play teaches whatever comes next"
  for (const { name, doc } of pages) {
    it(`${name} carries no instructional prose`, () => {
      const text = doc.body.textContent ?? "";
      for (const pattern of INSTRUCTIONAL) {
        expect(
          text,
          `${name} explains itself in words; the opening screen has to do that work`,
        ).not.toMatch(pattern);
      }
    });

    it(`${name} hides no instructions in a title or aria-label`, () => {
      // Off-screen text counts: a tooltip or a screen-reader label is still
      // the page telling the player how to play.
      const hidden = [...doc.querySelectorAll("[title], [aria-label], [alt]")]
        .flatMap((el) => [
          el.getAttribute("title"),
          el.getAttribute("aria-label"),
          el.getAttribute("alt"),
        ])
        .filter((value): value is string => Boolean(value))
        .join("\n");
      for (const pattern of INSTRUCTIONAL) {
        expect(hidden, `${name} hides a how-to-play in an attribute`).not.toMatch(pattern);
      }
    });
  }
});

describe("spec: it can be lost, and play ends", () => {
  // "a wrong move is possible, and play ends somewhere — a win, a loss or a
  // finish", and "one rule of the game has a focused automated test".
  //
  // Red on purpose until the mechanic exists. Replace this with the real
  // thing: pull the rule's arithmetic into a pure function (CLAUDE.md, "A
  // gesture's direction is untestable where it usually lives") and assert
  // both halves — that a wrong move reaches a losing state, and that play
  // reaches an ending at all.
  it.todo("a wrong move loses");
  it.todo("play reaches an ending");

  it("has its losing rule under test", () => {
    expect.fail(
      "no rule is under test yet — replace this and the two todos above " +
        "with a focused test of the mechanic once it exists",
    );
  });
});
