import { describe, expect, it } from "vitest";
import { CAMERA } from "../src/config/style.ts";
import type { Azimuth } from "../src/config/style.ts";
import { level1 } from "../src/levels/level1.ts";
import type { Level, PortId, State } from "../src/rules.ts";
import {
  begin,
  canWalkTo,
  fillingNow,
  finalPoolFull,
  halfFilled,
  settle,
  sourcesRunning,
  walkableFrom,
} from "../src/rules.ts";

// The five rules, as tests.
//
// Two of them are easy to lose to a well-meaning "fix", and both are pinned
// hard below: that a half-filled channel is NOT walkable, and that filling is
// irreversible while walkability is not. Anyone who later tries to tidy the
// two into one notion of "connected" will find out here.

const LEVELS: Level[] = [level1];

describe("rule 1: what looks joined is joined, per angle", () => {
  it("declares links for every camera angle the game can show", () => {
    for (const level of LEVELS) {
      for (const angle of CAMERA.azimuthsDeg) {
        expect(
          level.cameraAngles[angle],
          `${level.name} has nothing declared at ${angle}°`,
        ).toBeTruthy();
      }
    }
  });

  it("names only ports that exist", () => {
    for (const level of LEVELS) {
      const known = new Set<PortId>([
        ...level.pools.map((p) => p.id),
        ...level.channels.map((c) => c.id),
        ...level.platforms.map((p) => p.id),
        ...level.tapPoints.map((t) => t.id),
      ]);
      for (const [angle, links] of Object.entries(level.cameraAngles)) {
        for (const [a, b] of [...links.waterLinks, ...links.walkLinks]) {
          expect(known, `${level.name} @${angle}° names ${a}`).toContain(a);
          expect(known, `${level.name} @${angle}° names ${b}`).toContain(b);
        }
      }
    }
  });

  it("anchors every channel to two real pools", () => {
    for (const level of LEVELS) {
      const pools = new Set(level.pools.map((p) => p.id));
      for (const channel of level.channels) {
        expect(channel.ends).toHaveLength(2);
        for (const end of channel.ends) {
          expect(pools, `${channel.id} ends at ${end}, which is not a pool`).toContain(end);
        }
      }
    }
  });

  it("puts every tap point on a real platform", () => {
    for (const level of LEVELS) {
      const platforms = new Set(level.platforms.map((p) => p.id));
      for (const tap of level.tapPoints) {
        expect(platforms, `${tap.id} sits on ${tap.on}`).toContain(tap.on);
      }
    }
  });
});

describe("rule 2 and 4: a channel fills only when BOTH ends are anchored", () => {
  const at = (angle: Azimuth): State => ({ ...begin(level1), angle });

  it("does nothing at the opening angle", () => {
    expect(fillingNow(level1, at(45))).toEqual([]);
    expect(halfFilled(level1, at(45))).toEqual([]);
  });

  it("stops water in mid-channel when only one end is anchored", () => {
    // The decoy angle. This is a legitimate visible state, not a bug — water
    // standing in a channel whose far end hangs over nothing.
    expect(fillingNow(level1, at(135))).toEqual([]);
    expect(halfFilled(level1, at(135))).toEqual(["aqueduct"]);
  });

  it("fills when both ends are anchored", () => {
    expect(fillingNow(level1, at(225))).toEqual(["aqueduct"]);
    expect(halfFilled(level1, at(225))).toEqual([]);
  });
});

describe("rule 4: filling is irreversible", () => {
  it("keeps a filled channel filled after the camera turns away", () => {
    let state = settle(level1, { ...begin(level1), angle: 225 });
    expect(state.filled.has("aqueduct")).toBe(true);
    // Turn to an angle where nothing is joined at all.
    state = settle(level1, { ...state, angle: 45 });
    expect(state.filled.has("aqueduct"), "a filled channel drained").toBe(true);
  });

  it("never removes a channel from the filled set", () => {
    let state = settle(level1, { ...begin(level1), angle: 225 });
    const size = state.filled.size;
    for (const angle of CAMERA.azimuthsDeg) {
      state = settle(level1, { ...state, angle });
      expect(state.filled.size).toBeGreaterThanOrEqual(size);
    }
  });
});

describe("rule 5: full and connected are different states", () => {
  // A tiny level built for this rule alone: one channel, walkable only at one
  // angle, and only once filled.
  const bridge: Level = {
    name: "bridge",
    pools: [
      { id: "src", isSource: true },
      { id: "dst", isFinal: true },
    ],
    channels: [{ id: "span", ends: ["src", "dst"] }],
    platforms: [{ id: "near" }, { id: "far" }],
    tapPoints: [],
    cameraAngles: {
      45: {
        waterLinks: [
          ["src", "span"],
          ["span", "dst"],
        ],
        walkLinks: [
          ["near", "span"],
          ["span", "far"],
        ],
      },
      // Same building, turned. The span is full, and looks broken from here.
      135: { waterLinks: [], walkLinks: [] },
      225: { waterLinks: [], walkLinks: [] },
      315: { waterLinks: [], walkLinks: [] },
    },
    beastAt: "near",
    opensAt: 45,
  };

  it("refuses to walk a channel that has not filled yet", () => {
    const fresh = begin(bridge);
    expect(walkableFrom(bridge, fresh, "near").has("far")).toBe(false);
    expect(canWalkTo(bridge, fresh, "far")).toBe(false);
  });

  it("walks it once it has filled", () => {
    const full = settle(bridge, begin(bridge));
    expect(full.filled.has("span")).toBe(true);
    expect(canWalkTo(bridge, full, "far")).toBe(true);
  });

  it("refuses again at an angle where the filled span looks broken", () => {
    // The heart of rule 5. "Full" is a property of the water; "connected" is a
    // property of the picture; neither implies the other. Collapsing these two
    // into one flag is the tempting simplification, and it would delete the
    // game.
    const full = settle(bridge, begin(bridge));
    const turned = { ...full, angle: 135 as Azimuth };
    expect(turned.filled.has("span"), "it should still be full").toBe(true);
    expect(canWalkTo(bridge, turned, "far"), "but not walkable from here").toBe(false);
  });
});

describe("rule 3: water runs only while the beast stands on a tap", () => {
  const tapped: Level = {
    name: "tapped",
    pools: [
      { id: "src", isSource: true },
      { id: "dst", isFinal: true },
    ],
    channels: [{ id: "run", ends: ["src", "dst"] }],
    platforms: [{ id: "ledge" }],
    tapPoints: [{ id: "tap", on: "ledge" }],
    cameraAngles: {
      45: {
        waterLinks: [
          ["src", "run"],
          ["run", "dst"],
        ],
        walkLinks: [["ledge", "tap"]],
      },
      135: { waterLinks: [], walkLinks: [] },
      225: { waterLinks: [], walkLinks: [] },
      315: { waterLinks: [], walkLinks: [] },
    },
    beastAt: "ledge",
    opensAt: 45,
  };

  it("does not run while the beast is off the tap", () => {
    const state = begin(tapped);
    expect(sourcesRunning(tapped, state)).toBe(false);
    expect(fillingNow(tapped, state)).toEqual([]);
  });

  it("runs while the beast stands on it", () => {
    const state = { ...begin(tapped), beastAt: "tap" };
    expect(sourcesRunning(tapped, state)).toBe(true);
    expect(fillingNow(tapped, state)).toEqual(["run"]);
  });

  it("does not undo what already happened when the beast leaves", () => {
    // Rule 3, second sentence.
    const on = settle(tapped, { ...begin(tapped), beastAt: "tap" });
    const off = settle(tapped, { ...on, beastAt: "ledge" });
    expect(off.filled.has("run")).toBe(true);
  });

  it("runs from the first frame in a level with no taps at all", () => {
    // Level 1: the beast does not take part.
    expect(sourcesRunning(level1, begin(level1))).toBe(true);
  });
});

describe("the level is won when the final pool is FULL", () => {
  it("is not won on arrival", () => {
    for (const level of LEVELS) {
      expect(finalPoolFull(level, begin(level)), `${level.name} opens solved`).toBe(false);
    }
  });

  it("is solvable by turning the camera alone", () => {
    for (const level of LEVELS) {
      let state = begin(level);
      let won = false;
      // Walk the whole enumeration a couple of times round; filling is
      // irreversible, so progress accumulates.
      for (let pass = 0; pass < 2 && !won; pass++) {
        for (const angle of CAMERA.azimuthsDeg) {
          state = settle(level, { ...state, angle });
          if (finalPoolFull(level, state)) won = true;
        }
      }
      expect(won, `${level.name} cannot be won`).toBe(true);
    }
  });

  it("is not won merely by water arriving", () => {
    // The decoy angle reaches the channel but fills nothing.
    const state = settle(level1, { ...begin(level1), angle: 135 });
    expect(finalPoolFull(level1, state)).toBe(false);
  });
});
