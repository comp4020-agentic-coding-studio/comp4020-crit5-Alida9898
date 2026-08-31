// Level data is hand-written literals. Nothing here is generated, and the
// difficulty curve is a decision rather than a parameter.
//
// Each level introduces exactly one idea and never writes it down. What makes
// that work is what is CLICKABLE: an unlocked module is an invitation, so
// locking everything else is how the board asks for the move it wants to teach.

import type { Cell, Grid, Kind, Rotation } from "./connectivity.ts";

export type Level = {
  name: string;
  grid: Grid;
  /** Units in the tank. */
  tank: number;
  /** Units that must reach the sink to win. `tank - target` is the whole
   *  tolerance, and shrinking it is the only difficulty knob used. */
  target: number;
};

/** Scenery: on the board, not the player's to turn. */
function fixed(kind: Kind, rotation: Rotation): Cell {
  return { kind, rotation, locked: true };
}

/** The player's to turn. */
function turnable(kind: Kind, rotation: Rotation): Cell {
  return { kind, rotation };
}

const _ = null;

function grid(width: number, height: number, cells: (Cell | null)[]): Grid {
  return { width, height, cells };
}

export const LEVELS: Level[] = [
  {
    // Teaches: click rotates. One break, and it is the only thing on the
    // board that can be clicked, so the first move cannot be got wrong.
    name: "one turn",
    tank: 10,
    target: 6,
    grid: grid(4, 4, [
      _, _, _, _,
      fixed("source", 1), fixed("straight", 1), turnable("straight", 0), fixed("sink", 0),
      _, _, _, _,
      _, _, _, _,
    ]),
  },
  {
    // Teaches: spilling costs you, and hesitation is measured in water.
    //
    // The tee is scenery and always splits. The lower arm already runs to the
    // sink; the upper one dead-ends at an elbow lying the wrong way, so half
    // the tank pours onto the sand from the first tick. The elbow needs TWO
    // turns to come good, and the board keeps spilling through both of them —
    // which is the lesson: turning costs, and standing still costs more.
    name: "the open arm",
    tank: 20,
    target: 14,
    grid: grid(4, 4, [
      _, turnable("elbow", 3), fixed("straight", 1), fixed("elbow", 2),
      fixed("source", 1), fixed("tee", 0), fixed("straight", 1), fixed("sink", 0),
      _, _, _, _,
      _, _, _, _,
    ]),
  },
  {
    // Teaches: order matters. The tee splits into a short branch that is one
    // turn from working and a long one that needs six, and every tick spent on
    // the long branch first is water the short one could have been delivering.
    // Both routings win; only one wins comfortably.
    name: "two ways round",
    tank: 24,
    target: 16,
    grid: grid(5, 5, [
      _, _, _, _, _,
      _, turnable("elbow", 2), fixed("straight", 1), fixed("straight", 1), turnable("elbow", 3),
      fixed("source", 1), fixed("tee", 0), turnable("straight", 0), fixed("straight", 1), fixed("sink", 0),
      _, _, _, _, _,
      _, _, _, _, _,
    ]),
  },
  {
    // Teaches: nothing new. One route, five modules, all of them wrong, and
    // nothing is delivered until the last one comes good — so the tank is the
    // clock and the only currency is how fast you read the board.
    name: "no slack",
    tank: 30,
    target: 21,
    grid: grid(5, 5, [
      _, _, _, _, _,
      fixed("source", 1), turnable("elbow", 0), _, turnable("elbow", 0), fixed("sink", 0),
      _, turnable("elbow", 2), turnable("straight", 0), turnable("elbow", 0), _,
      _, _, _, _, _,
      _, _, _, _, _,
    ]),
  },
];
