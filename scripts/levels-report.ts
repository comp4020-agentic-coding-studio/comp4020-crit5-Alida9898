#!/usr/bin/env node
// What each level actually asks of a player, in numbers.
//
// Level data is hand-written literals, which is the agreed constraint and also
// the reason a board can look completely plausible while being unwinnable, or
// free. `spec/game.test.ts` catches both of those as red checks; this prints
// the shape in between — how much slack the tank leaves, and how many clicks
// the shortest winning routing costs — because those are design decisions and
// no test can tell you whether the number is the right one.
//
//   node scripts/levels-report.ts

import type { Rotation } from "../src/connectivity.ts";
import { flow } from "../src/flow.ts";
import { LEVELS } from "../src/levels.ts";

for (const level of LEVELS) {
  const turnable = level.grid.cells
    .map((cell, index) => (cell && !cell.locked ? index : -1))
    .filter((index) => index >= 0);

  const opening = flow(level.grid, level.tank).delivered;

  let best = 0;
  let clicksForBest = Infinity;
  for (let n = 0; n < 4 ** turnable.length; n++) {
    const cells = [...level.grid.cells];
    let k = n;
    let clicks = 0;
    for (const index of turnable) {
      const cell = cells[index];
      if (!cell) continue;
      const rotation = (k % 4) as Rotation;
      // A click advances one quarter, so the cost of a rotation is how far
      // round it is from where the board opens.
      clicks += (rotation - cell.rotation + 4) % 4;
      cells[index] = { ...cell, rotation };
      k = Math.floor(k / 4);
    }
    const { delivered } = flow({ ...level.grid, cells }, level.tank);
    if (delivered > best) {
      best = delivered;
      clicksForBest = clicks;
    } else if (delivered === best && clicks < clicksForBest) {
      clicksForBest = clicks;
    }
  }

  const slack = best - level.target;
  console.log(
    [
      `${level.name}`,
      `  tank ${level.tank}, target ${level.target}`,
      `  opens delivering ${opening} (must be under target)`,
      `  best routing delivers ${best} in ${clicksForBest} clicks`,
      `  slack ${slack} units — the water a player may waste and still win`,
    ].join("\n"),
  );
}
