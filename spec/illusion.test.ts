import { describe, expect, it } from "vitest";
import { LEVELS } from "../src/gardens.ts";
import type { Level } from "../src/gardens.ts";
import type { Turn, Turns } from "../src/illusion.ts";
import { flow, nodeAt, project, turnedAround } from "../src/illusion.ts";

// The art places, the table declares, and these check the two still mean the
// same thing.
//
// Nothing here derives connectivity from geometry — the game never does that,
// and must not. But a TEST may project a seam's two ends and insist they land
// on the same pixel, which is the automatic version of the check that would
// otherwise be somebody squinting at a screenshot and going stale the moment a
// terrace moves. This is the pairing CLAUDE.md asks for: keep the rule
// positional where the geometry allows it.

/** The configuration a seam is claimed to hold in. */
function configuration(level: Level, when: Partial<Record<string, Turn>>): Turns {
  return { ...level.turns, ...when } as Turns;
}

function screenOf(level: Level, id: string, turns: Turns): [number, number] {
  const node = level.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`no node ${id}`);
  return project(nodeAt(node, level.parts, turns));
}

describe("the isometric map is what the whole illusion rests on", () => {
  it("puts a storey up and a step back on exactly the same pixel", () => {
    // Raise y by 1, raise x and z by 1 each: the projection does not move.
    // Every level's coordinates are chosen against this.
    expect(project([1, 0, 1])).toEqual(project([2, 1, 2]));
    expect(project([0, 0, 0])).toEqual(project([1, 1, 1]));
    expect(project([2, 0, 2])).toEqual(project([4, 2, 4]));
  });

  it("still sends a plain step down the screen", () => {
    // Without the compensating climb, moving away from the camera reads as
    // lower — which is what makes the illusion legible rather than arbitrary.
    expect(project([1, 0, 1])[1]).toBeLessThan(project([0, 0, 0])[1]);
  });

  it("turns a quarter about a pivot, and back after four", () => {
    const p: [number, number, number] = [2, 1, 2];
    const pivot: [number, number, number] = [3, 1, 3];
    let at = p;
    for (let i = 0; i < 4; i++) at = turnedAround(at, pivot, 1);
    expect(at[0]).toBeCloseTo(p[0], 6);
    expect(at[2]).toBeCloseTo(p[2], 6);
  });
});

describe("every declared seam matches the model it claims to describe", () => {
  for (const level of LEVELS) {
    describe(level.name, () => {
      it("names only nodes that exist", () => {
        const ids = new Set(level.nodes.map((n) => n.id));
        for (const seam of level.seams) {
          expect(ids, `seam from ${seam.from}`).toContain(seam.from);
          expect(ids, `seam to ${seam.to}`).toContain(seam.to);
        }
        expect(ids).toContain(level.goal);
        expect(ids).toContain(level.stood);
        for (const stand of level.stands) expect(ids).toContain(stand);
      });

      it("lands both ends of every illusion seam on the same point", () => {
        for (const seam of level.seams.filter((s) => s.illusion)) {
          const turns = configuration(level, seam.when);
          const [ax, ay] = screenOf(level, seam.from, turns);
          const [bx, by] = screenOf(level, seam.to, turns);
          const gap = Math.hypot(ax - bx, ay - by);
          // Within a fraction of a cell. Two channel mouths that are further
          // apart than this do not read as joined, whatever the table says.
          expect(
            gap,
            `${seam.from} → ${seam.to} claims to look joined but is ${gap.toFixed(2)} apart on screen`,
          ).toBeLessThan(0.9);
        }
      });

      it("never runs water up the screen", () => {
        // The rule the player is being taught. A seam pointing uphill on
        // screen would be the game contradicting its own picture.
        for (const seam of level.seams) {
          const turns = configuration(level, seam.when);
          const from = screenOf(level, seam.from, turns)[1];
          const to = screenOf(level, seam.to, turns)[1];
          expect(
            to,
            `${seam.from} → ${seam.to} runs UP the screen`,
          ).toBeLessThanOrEqual(from + 1e-9);
        }
      });

      it("stacks no two terraces on one pixel except at a declared seam", () => {
        // Two ends landing on the same point is the whole trick — when a seam
        // says so. Anywhere else it is just two terraces drawn on top of each
        // other, which reads as a rendering fault rather than an illusion, and
        // there is nothing on screen to tell a player which it is.
        const joined = new Set(
          level.seams
            .filter((s) => s.illusion)
            .flatMap((s) => [`${s.from}|${s.to}`, `${s.to}|${s.from}`]),
        );
        const placed: { id: string; at: [number, number] }[] = [];
        for (const node of level.nodes) {
          const at = screenOf(level, node.id, level.turns);
          for (const other of placed) {
            const gap = Math.hypot(at[0] - other.at[0], at[1] - other.at[1]);
            if (gap >= 0.6) continue;
            expect(
              joined.has(`${node.id}|${other.id}`),
              `${node.id} and ${other.id} sit on the same point with no seam saying they should`,
            ).toBe(true);
          }
          placed.push({ id: node.id, at });
        }
      });

      it("actually climbs, or the illusion is not doing anything", () => {
        // The point of the trick: the route gains real height while losing
        // screen height. A level where the water only ever goes physically
        // downhill is a slope, not an illusion.
        const byId = new Map(level.nodes.map((n) => [n.id, n]));
        const start = byId.get(level.stood);
        const goal = byId.get(level.goal);
        expect(goal?.at[1], "the goal is no higher than the start").toBeGreaterThan(
          start?.at[1] ?? 0,
        );
      });
    });
  }
});

describe("every level can be solved, and none is solved on arrival", () => {
  for (const level of LEVELS) {
    it(`${level.name}`, () => {
      const ids = level.parts.map((p) => p.id);

      const solvedWith = (turns: Turns, stood: string): boolean =>
        flow(level.nodes, level.seams, turns, stood, level.goal).reached;

      expect(
        solvedWith(level.turns, level.stood),
        "the level is already won when it opens",
      ).toBe(false);

      let solvable = false;
      for (let n = 0; n < 4 ** ids.length && !solvable; n++) {
        const turns: Turns = { ...level.turns };
        let k = n;
        for (const id of ids) {
          turns[id] = (k % 4) as Turn;
          k = Math.floor(k / 4);
        }
        for (const stand of level.stands) {
          if (solvedWith(turns, stand)) solvable = true;
        }
      }
      expect(solvable, "no configuration wins this level").toBe(true);
    });
  }
});
