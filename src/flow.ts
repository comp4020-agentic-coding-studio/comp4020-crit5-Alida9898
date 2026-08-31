// The leak rule, as a pure function over plain data.
//
// No DOM, no Three.js, no canvas — which is the whole point: this is the rule
// the spec asks to have under a focused automated test, and it is testable
// precisely because none of the rendering is anywhere near it. See CLAUDE.md,
// "A gesture's direction is untestable where it usually lives".

import type { Grid, Port } from "./connectivity.ts";
import { accepts, exitsFrom, opposite, sourceExit } from "./connectivity.ts";

export type FlowResult = {
  /** Units that reached a sink. */
  delivered: number;
  /** Units that went anywhere else. Gone for good — this is the cost that
   *  makes the game losable. */
  leaked: number;
};

/** Everything `flow` learned on the way, for the renderer to draw.
 *
 *  The game needs none of this — it is what lets a player SEE why the tank is
 *  dropping, which is the whole no-tutorial bet: water visibly pouring out of
 *  an open end explains the cost in a way no sentence would. */
export type Trace = FlowResult & {
  /** Cells water actually ran through, and how much. */
  wet: Map<number, number>;
  /** Where water left the board: the cell it left from, the port it left by,
   *  and how much went. */
  spills: { index: number; port: Port; amount: number }[];
};

/** The cell one step from `index` in direction `dir`, or null off the grid. */
export function neighbour(grid: Grid, index: number, dir: Port): number | null {
  const x = index % grid.width;
  const y = Math.floor(index / grid.width);
  const nx = x + (dir === "E" ? 1 : dir === "W" ? -1 : 0);
  // N is up, so it decreases y: the grid is indexed in screen order.
  const ny = y + (dir === "S" ? 1 : dir === "N" ? -1 : 0);
  if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) return null;
  return ny * grid.width + nx;
}

export function findSource(grid: Grid): number | null {
  const index = grid.cells.findIndex((cell) => cell?.kind === "source");
  return index === -1 ? null : index;
}

/**
 * Pour `units` into the grid's source and follow the connectivity tables.
 *
 * Water spills — counts as `leaked` — wherever it has nowhere declared to go:
 * off the edge of the grid, into an empty cell, into a neighbour whose table
 * has no entry for the facing port, or into a dead end. A tee splits its flow
 * evenly, so leaving one arm pointing at nothing loses half.
 *
 * Invariant: `delivered + leaked === units`. Water is never created or
 * quietly dropped, which is what makes the tank readable on screen.
 */
export function flow(grid: Grid, units: number): FlowResult {
  const { delivered, leaked } = trace(grid, units);
  return { delivered, leaked };
}

/** `flow`, plus the record of where the water went. Same walk, same rules. */
export function trace(grid: Grid, units: number): Trace {
  const wet = new Map<number, number>();
  const spills: { index: number; port: Port; amount: number }[] = [];
  const start = findSource(grid);
  if (start === null || units <= 0) {
    return { delivered: 0, leaked: Math.max(units, 0), wet, spills };
  }

  let delivered = 0;
  let leaked = 0;

  const soak = (index: number, amount: number): void => {
    wet.set(index, (wet.get(index) ?? 0) + amount);
  };
  const spill = (index: number, port: Port, amount: number): void => {
    leaked += amount;
    spills.push({ index, port, amount });
  };

  // A cell entered from the same port twice is a loop. Water going round
  // again is water we never see leave, so it counts as spilled rather than
  // vanishing — that keeps the invariant above true.
  const seen = new Set<string>();
  const queue: { index: number; entry: Port | null; amount: number }[] = [
    { index: start, entry: null, amount: units },
  ];

  while (queue.length > 0) {
    const step = queue.shift();
    if (!step || step.amount <= 0) continue;

    const cell = grid.cells[step.index];
    if (!cell) {
      leaked += step.amount;
      continue;
    }

    soak(step.index, step.amount);

    if (cell.kind === "sink") {
      delivered += step.amount;
      continue;
    }

    const key = `${step.index}:${step.entry ?? "source"}`;
    if (seen.has(key)) {
      leaked += step.amount;
      continue;
    }
    seen.add(key);

    // The source pushes from its declared exit; everything else looks up
    // where water entering at this port is declared to leave.
    const exits =
      step.entry === null
        ? [sourceExit(cell.rotation)]
        : exitsFrom(cell.kind, cell.rotation, step.entry);

    if (exits.length === 0) {
      // A dead end: water arrived and the table sends it nowhere, so it
      // pours back out the way it came.
      spill(step.index, step.entry ?? sourceExit(cell.rotation), step.amount);
      continue;
    }

    const share = step.amount / exits.length;
    for (const exit of exits) {
      const next = neighbour(grid, step.index, exit);
      if (next === null) {
        spill(step.index, exit, share); // off the edge
        continue;
      }
      const target = grid.cells[next];
      const facing = opposite(exit);
      if (!target || !accepts(target.kind, target.rotation, facing)) {
        // Empty ground, or a neighbour whose table has no entry facing us.
        // This is the entire leak rule: a lookup, not a tolerance.
        spill(step.index, exit, share);
        continue;
      }
      queue.push({ index: next, entry: facing, amount: share });
    }
  }

  return { delivered, leaked, wet, spills };
}
