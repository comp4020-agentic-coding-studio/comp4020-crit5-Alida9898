import { describe, expect, it } from "vitest";
import { CAMERA } from "../src/config/style.ts";
import type { Azimuth } from "../src/config/style.ts";
import { level1 } from "../src/levels/level1.ts";
import type { Level, PortId, State, Turn } from "../src/rules.ts";
import {
  begin,
  turn as turnPart,
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

/** level 1 with its one turnable brick set to a given quarter. */
const at = (spur: Turn): State => {
  const s = begin(level1);
  return { ...s, config: { ...s.config, turns: { spur } } };
};

describe("rule 1: what looks joined is joined, per configuration", () => {
  it("names only ports that exist", () => {
    for (const level of LEVELS) {
      const known = new Set<PortId>([
        ...level.pools.map((p) => p.id),
        ...level.channels.map((c) => c.id),
        ...level.platforms.map((p) => p.id),
        ...level.tapPoints.map((t) => t.id),
      ]);
      for (const link of [...level.waterLinks, ...level.walkLinks]) {
        for (const port of link.between) {
          expect(known, `${level.name} names ${port}`).toContain(port);
        }
      }
    }
  });

  it("conditions every link on parts the level actually has", () => {
    for (const level of LEVELS) {
      const parts = new Set(level.parts);
      for (const link of [...level.waterLinks, ...level.walkLinks]) {
        for (const part of Object.keys(link.when.turns ?? {})) {
          expect(parts, `${level.name}: no such part ${part}`).toContain(part);
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
  it("does nothing in the opening configuration", () => {
    expect(fillingNow(level1, at(3))).toEqual([]);
    expect(halfFilled(level1, at(3))).toEqual([]);
  });

  it("stops water in mid-channel when only one end is anchored", () => {
    // A legitimate visible state, not a bug — water standing in a channel
    // whose far end hangs over nothing. Level 1 has no angle that does this
    // (the geometry does not allow one end to meet the source at two
    // different angles), so it is pinned on a purpose-built board here. This
    // is the state level 3 is built around.
    const dangling: Level = {
      name: "dangling",
      pools: [
        { id: "src", isSource: true },
        { id: "dst", isFinal: true },
      ],
      channels: [{ id: "run", ends: ["src", "dst"] }],
      platforms: [],
      tapPoints: [],
      parts: ["gate"],
      waterLinks: [
        { between: ["src", "run"], when: {} },
        { between: ["run", "dst"], when: { turns: { gate: 0 } } },
      ],
      walkLinks: [],
      opens: { camera: 45, turns: { gate: 1 } },
    };
    const stalled = begin(dangling);  // gate at 1 → downstream end unanchored
    expect(fillingNow(dangling, stalled)).toEqual([]);
    expect(halfFilled(dangling, stalled)).toEqual(["run"]);
    // And it is not walkable while it hangs there — rule 4.
    expect(settle(dangling, stalled).filled.size).toBe(0);
  });

  it("does nothing at the turns level 1 leaves dead", () => {
    for (const spur of [1, 2, 3] as Turn[]) {
      expect(fillingNow(level1, at(spur))).toEqual([]);
      expect(halfFilled(level1, at(spur))).toEqual([]);
    }
  });

  it("fills when both ends are anchored", () => {
    expect(fillingNow(level1, at(0))).toEqual(["aqueduct"]);
    expect(halfFilled(level1, at(0))).toEqual([]);
  });
});

describe("rule 4: filling is irreversible", () => {
  it("keeps a filled channel filled after the camera turns away", () => {
    let state = settle(level1, at(0));
    expect(state.filled.has("aqueduct")).toBe(true);
    // Turn the spur to where nothing is joined at all.
    state = settle(level1, { ...state, config: { camera: 45, turns: { spur: 2 } } });
    expect(state.filled.has("aqueduct"), "a filled channel drained").toBe(true);
  });

  it("never removes a channel from the filled set", () => {
    let state = settle(level1, at(0));
    const size = state.filled.size;
    for (const spur of [0, 1, 2, 3] as Turn[]) {
      state = settle(level1, { ...state, config: { camera: 45, turns: { spur } } });
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
    parts: ["deck"],
    waterLinks: [
      { between: ["src", "span"], when: {} },
      { between: ["span", "dst"], when: {} },
    ],
    walkLinks: [
      // The span only LOOKS joined to both banks while the deck is square on.
      { between: ["near", "span"], when: { turns: { deck: 0 } } },
      { between: ["span", "far"], when: { turns: { deck: 0 } } },
    ],
    beastAt: "near",
    opens: { camera: 45, turns: { deck: 0 } },
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
    const swung: State = { ...full, config: { camera: 45, turns: { deck: 1 } } };
    expect(swung.filled.has("span"), "it should still be full").toBe(true);
    expect(canWalkTo(bridge, swung, "far"), "but not walkable from here").toBe(false);
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
    parts: [],
    waterLinks: [
      { between: ["src", "run"], when: {} },
      { between: ["run", "dst"], when: {} },
    ],
    walkLinks: [{ between: ["ledge", "tap"], when: {} }],
    beastAt: "ledge",
    opens: { camera: 45, turns: {} },
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

  it("is solvable by turning the bricks alone", () => {
    for (const level of LEVELS) {
      let state = begin(level);
      let won = false;
      // Cycle every part through its four turns; filling is irreversible, so
      // progress accumulates across the sweep.
      for (const part of level.parts) {
        for (let i = 0; i < 4 && !won; i++) {
          state = settle(level, turnPart(state, part));
          if (finalPoolFull(level, state)) won = true;
        }
      }
      expect(won, `${level.name} cannot be won`).toBe(true);
    }
  });

  it("is not won while the spur is turned away", () => {
    const state = settle(level1, at(2));
    expect(finalPoolFull(level1, state)).toBe(false);
  });
});
