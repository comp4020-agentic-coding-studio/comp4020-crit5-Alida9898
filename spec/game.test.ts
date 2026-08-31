import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import type { Grid, Rotation } from "../src/connectivity.ts";
import { flow } from "../src/flow.ts";
import { canAcceptInput, pour, rotate, settle, start } from "../src/game.ts";
import { LEVELS } from "../src/levels.ts";

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

// "a wrong move is possible, and play ends somewhere — a win, a loss or a
// finish", and "one rule of the game has a focused automated test".
//
// The rule under test is the LEAK RULE: water entering a port that the
// neighbouring module's table does not declare goes on the sand and is gone.
// It is the core mechanic and the sole source of the failure state, and it is
// a pure function over plain data, so none of this needs a DOM.

/** source pushing E, a straight lying E–W, a sink. Joined end to end. */
function joined(): Grid {
  return {
    width: 3,
    height: 1,
    cells: [
      { kind: "source", rotation: 1 },
      { kind: "straight", rotation: 1 },
      { kind: "sink", rotation: 0 },
    ],
  };
}

describe("spec: the leak rule", () => {
  it("delivers everything when the ports face each other", () => {
    expect(flow(joined(), 10)).toEqual({ delivered: 10, leaked: 0 });
  });

  it("spills everything when one module is turned the wrong way", () => {
    // The same board with the straight lying N–S instead. Its table has no
    // entry for water arriving from the west, so the water has nowhere
    // declared to go.
    const grid = joined();
    grid.cells[1] = { kind: "straight", rotation: 0 };
    expect(flow(grid, 10)).toEqual({ delivered: 0, leaked: 10 });
  });

  it("splits a tee evenly, so an arm pointing at nothing loses half", () => {
    // The tee's north arm points off the edge of a one-row grid.
    const grid: Grid = {
      width: 3,
      height: 1,
      cells: [
        { kind: "source", rotation: 1 },
        { kind: "tee", rotation: 0 },
        { kind: "sink", rotation: 0 },
      ],
    };
    expect(flow(grid, 10)).toEqual({ delivered: 5, leaked: 5 });
  });

  it("never creates or quietly drops water", () => {
    // The invariant that makes the tank readable on screen: whatever leaves
    // the tank is either delivered or visibly spilled.
    for (const level of LEVELS) {
      const { delivered, leaked } = flow(level.grid, level.tank);
      expect(delivered + leaked).toBeCloseTo(level.tank, 6);
    }
  });
});

describe("spec: play ends somewhere", () => {
  it("a wrong routing drains the tank and loses", () => {
    // Level 1 ships broken on purpose. Pour without fixing it and the water
    // runs out having delivered nothing.
    const level = LEVELS[0];
    let state = start(level.grid, level.tank, level.target);
    while (state.phase !== "won" && state.phase !== "lost") {
      state = pour(state, 1);
    }
    expect(state.phase).toBe("lost");
    expect(state.delivered).toBe(0);
  });

  it("the right routing reaches the target and wins", () => {
    const level = LEVELS[0];
    let state = start(level.grid, level.tank, level.target);
    // The one turnable module on the board, turned until it lies E–W.
    const broken = level.grid.cells.findIndex((cell) => cell && !cell.locked);
    state = settle(rotate(state, broken));
    while (state.phase !== "won" && state.phase !== "lost") {
      state = pour(state, 1);
    }
    expect(state.phase).toBe("won");
  });

  it("gives no level away without a move", () => {
    // A board that already delivers its target on load teaches nothing and
    // cannot be lost. Every level must open short.
    for (const level of LEVELS) {
      const { delivered } = flow(level.grid, level.tank);
      expect(delivered, `level "${level.name}" is won on load`).toBeLessThan(level.target);
    }
  });

  it("every level can actually be won", () => {
    // Brute-force every rotation of every turnable module. A hand-written
    // level with no solution is a mistake only this catches — the board looks
    // perfectly plausible while being impossible.
    for (const level of LEVELS) {
      const turnable = level.grid.cells
        .map((cell, index) => (cell && !cell.locked ? index : -1))
        .filter((index) => index >= 0);
      let solved = false;
      for (let n = 0; n < 4 ** turnable.length && !solved; n++) {
        const cells = [...level.grid.cells];
        let k = n;
        for (const index of turnable) {
          cells[index] = { ...cells[index]!, rotation: (k % 4) as Rotation };
          k = Math.floor(k / 4);
        }
        const { delivered } = flow({ ...level.grid, cells }, level.tank);
        if (delivered >= level.target) solved = true;
      }
      expect(solved, `level "${level.name}" has no solution`).toBe(true);
    }
  });
});

describe("the difficulty curve goes one way", () => {
  /** The cheapest winning routing, in clicks, and what it delivers. */
  function best(level: (typeof LEVELS)[number]): { clicks: number; delivered: number } {
    const turnable = level.grid.cells
      .map((cell, index) => (cell && !cell.locked ? index : -1))
      .filter((index) => index >= 0);
    let top = { clicks: Infinity, delivered: 0 };
    for (let n = 0; n < 4 ** turnable.length; n++) {
      const cells = [...level.grid.cells];
      let k = n;
      let clicks = 0;
      for (const index of turnable) {
        const cell = cells[index];
        if (!cell) continue;
        const rotation = (k % 4) as Rotation;
        clicks += (rotation - cell.rotation + 4) % 4;
        cells[index] = { ...cell, rotation };
        k = Math.floor(k / 4);
      }
      const { delivered } = flow({ ...level.grid, cells }, level.tank);
      if (delivered > top.delivered || (delivered === top.delivered && clicks < top.clicks)) {
        top = { clicks, delivered };
      }
    }
    return top;
  }

  const curve = LEVELS.map(best);

  it("never asks for fewer moves than the level before", () => {
    for (let i = 1; i < curve.length; i++) {
      expect(
        curve[i].clicks,
        `"${LEVELS[i].name}" is easier than "${LEVELS[i - 1].name}"`,
      ).toBeGreaterThanOrEqual(curve[i - 1].clicks);
    }
  });

  it("leaves every level somewhere between generous and mean", () => {
    // Slack is the water a player may waste and still win. Too little and a
    // stranger never reaches an ending; too much and the loss is theoretical.
    LEVELS.forEach((level, i) => {
      const slack = (curve[i].delivered - level.target) / level.tank;
      expect(slack, `"${level.name}" is unwinnable in practice`).toBeGreaterThanOrEqual(0.2);
      expect(slack, `"${level.name}" cannot really be lost`).toBeLessThanOrEqual(0.45);
    });
  });
});

describe("input is refused while a module is turning", () => {
  // An agreed constraint, and state with an edge in it — so it lives in a
  // function a test can call rather than inside the click handler.
  const level = LEVELS[0];
  const broken = level.grid.cells.findIndex((cell) => cell && !cell.locked);

  it("accepts a click on a turnable module when idle", () => {
    const state = start(level.grid, level.tank, level.target);
    expect(canAcceptInput(state, broken)).toBe(true);
  });

  it("refuses every click while one is mid-turn", () => {
    const state = rotate(start(level.grid, level.tank, level.target), broken);
    expect(state.turning).toBe(broken);
    expect(canAcceptInput(state, broken)).toBe(false);
  });

  it("accepts again once the turn settles", () => {
    const state = settle(rotate(start(level.grid, level.tank, level.target), broken));
    expect(canAcceptInput(state, broken)).toBe(true);
  });

  it("refuses clicks on scenery the player does not control", () => {
    const state = start(level.grid, level.tank, level.target);
    const locked = level.grid.cells.findIndex((cell) => cell?.locked);
    expect(canAcceptInput(state, locked)).toBe(false);
    expect(rotate(state, locked)).toBe(state);
  });
});
