import { describe, expect, it } from "vitest";
import type { Kind, Port, Rotation } from "../src/connectivity.ts";
import { PORTS, ROTATIONS, accepts, sourceExit } from "../src/connectivity.ts";
import { BASE_PORTS, angleFor } from "../src/scene.ts";

// The art must agree with the tables.
//
// The renderer models each module ONCE, in rotation 0, and turns it by
// rotating its group a quarter about Y. That is only honest if turning the
// rotation-0 shape a quarter really does produce the rotation-1 shape, for
// every kind. If it does not, the board draws a pipe pointing one way while
// the game believes it points another — and nothing would ever fail, because
// the game would keep answering from its tables while the player argues with
// the picture. This is exactly the class of bug CLAUDE.md warns about: it
// looks completely finished while broken.

/** The port a quarter turn clockwise. */
function turned(port: Port): Port {
  return { N: "E", E: "S", S: "W", W: "N" }[port] as Port;
}

function turnedBy(ports: Port[], quarters: number): Port[] {
  let out = [...ports];
  for (let i = 0; i < quarters; i++) out = out.map(turned);
  return out.sort();
}

const PIPES: Kind[] = ["straight", "elbow", "tee"];

describe("the drawn shape matches the connectivity table", () => {
  it("draws rotation 0 exactly as the table declares it", () => {
    for (const kind of PIPES) {
      const open = PORTS.filter((port) => accepts(kind, 0, port)).sort();
      expect([...BASE_PORTS[kind]].sort(), `${kind} is drawn wrong at rest`).toEqual(open);
    }
  });

  it("turns into every other rotation a quarter at a time", () => {
    // The load-bearing claim: rotating the group is the SAME operation as
    // stepping the rotation state.
    for (const kind of PIPES) {
      for (const rotation of ROTATIONS) {
        const open = PORTS.filter((port) => accepts(kind, rotation, port)).sort();
        expect(
          turnedBy(BASE_PORTS[kind], rotation),
          `${kind} drawn at rotation ${rotation} does not match its table`,
        ).toEqual(open);
      }
    }
  });

  it("turns a source the same way", () => {
    for (const rotation of ROTATIONS) {
      expect(turnedBy(BASE_PORTS.source, rotation)).toEqual([sourceExit(rotation)]);
    }
  });

  it("draws a sink open on every side, as its table says", () => {
    for (const rotation of ROTATIONS) {
      for (const port of PORTS) expect(accepts("sink", rotation, port)).toBe(true);
    }
    expect([...BASE_PORTS.sink].sort()).toEqual([...PORTS].sort());
  });

  it("turns clockwise on screen, the direction a click means", () => {
    // A sign error here would turn every module the wrong way — smoothly,
    // silently, and only ever noticed by someone with their hand on the mouse.
    expect(angleFor(0)).toBeCloseTo(0, 6);
    expect(angleFor(1)).toBeCloseTo(-Math.PI / 2, 6);
    expect(angleFor(3)).toBeCloseTo((-3 * Math.PI) / 2, 6);
  });
});

describe("rotation is an enumeration, not an angle", () => {
  it("has exactly four states and returns to the start", () => {
    expect(ROTATIONS).toHaveLength(4);
    const full = ROTATIONS.map((r) => angleFor(r as Rotation));
    expect(new Set(full).size).toBe(4);
    // Four quarters is one whole turn: the enumeration closes.
    expect(Math.abs(angleFor(3) - angleFor(0)) + Math.PI / 2).toBeCloseTo(2 * Math.PI, 6);
  });
});
