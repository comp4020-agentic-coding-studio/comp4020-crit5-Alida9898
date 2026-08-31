// Game state as plain data, advanced by pure functions.
//
// Two things live here that would otherwise hide inside event handlers, where
// no test can reach them (CLAUDE.md): whether input is accepted right now, and
// whether the round is over. Both have edges in them, so both belong in a
// function a test can call directly.

import type { Grid } from "./connectivity.ts";
import { rotated } from "./connectivity.ts";
import { flow } from "./flow.ts";

export type Phase = "idle" | "flowing" | "won" | "lost";

export type State = {
  grid: Grid;
  /** Units left in the tank. Spilled water is deducted and never returns. */
  tank: number;
  /** Units delivered to the sink so far. */
  delivered: number;
  /** Delivering this much wins the level. */
  target: number;
  phase: Phase;
  /** Index of the module mid-turn, or null. Input is refused while set. */
  turning: number | null;
};

export function start(grid: Grid, tank: number, target: number): State {
  return { grid, tank, delivered: 0, target, phase: "idle", turning: null };
}

/**
 * Is a click on the board accepted right now?
 *
 * Refused while a rotation animation is running (an agreed constraint), once
 * the round is decided, and on scenery the player does not control.
 */
export function canAcceptInput(state: State, index: number): boolean {
  if (state.turning !== null) return false;
  if (state.phase === "won" || state.phase === "lost") return false;
  const cell = state.grid.cells[index];
  if (!cell || cell.locked) return false;
  return true;
}

/** Turn one module a quarter, if input is allowed. Returns state unchanged
 *  when it is not, so callers never have to branch on the lock themselves. */
export function rotate(state: State, index: number): State {
  if (!canAcceptInput(state, index)) return state;
  const cell = state.grid.cells[index];
  if (!cell) return state;
  const cells = [...state.grid.cells];
  cells[index] = { ...cell, rotation: rotated(cell.rotation) };
  return { ...state, grid: { ...state.grid, cells }, turning: index };
}

/** The rotation animation finished; accept input again. */
export function settle(state: State): State {
  return { ...state, turning: null };
}

/**
 * Pour one tick of water and account for where it went.
 *
 * `units` leaves the tank whatever happens — what the routing decides is how
 * much of it arrives. That is the whole stake: hesitation is measured in
 * water, not in seconds.
 */
export function pour(state: State, units: number): State {
  if (state.phase === "won" || state.phase === "lost") return state;
  const poured = Math.min(units, state.tank);
  if (poured <= 0) return decide({ ...state, phase: "flowing" });
  const { delivered } = flow(state.grid, poured);
  return decide({
    ...state,
    tank: state.tank - poured,
    delivered: state.delivered + delivered,
    phase: "flowing",
  });
}

/**
 * The ending. Enough delivered is a win; an empty tank that never got there is
 * a loss. Checked after every pour, so the loss arrives the moment it becomes
 * true rather than at some later timeout.
 */
export function decide(state: State): State {
  if (state.delivered >= state.target) return { ...state, phase: "won" };
  if (state.tank <= 0) return { ...state, phase: "lost" };
  return state;
}
