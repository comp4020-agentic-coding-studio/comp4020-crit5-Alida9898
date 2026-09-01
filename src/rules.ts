// The five rules, as pure functions over hand-written tables.
//
// Everything here is a lookup. Nothing projects, raycasts, or compares boxes:
// "these two look joined at this angle" is a claim the level data makes, and
// this file only ever reads it. If a function in here ever needs a coordinate,
// something has gone wrong upstream.

import type { Azimuth } from "./config/style.ts";

export type PortId = string;

export type Pool = { id: PortId; isSource?: boolean; isFinal?: boolean };
export type Channel = { id: PortId; ends: [PortId, PortId] };
export type Platform = { id: PortId };
export type TapPoint = { id: PortId; on: PortId };

export type AngleLinks = {
  /** Port pairs that LOOK joined for water at this angle. */
  waterLinks: [PortId, PortId][];
  /** Port pairs that LOOK joined to walk on at this angle. A pair naming a
   *  channel is live only once that channel is filled — rule 5. */
  walkLinks: [PortId, PortId][];
};

export type Level = {
  name: string;
  pools: Pool[];
  channels: Channel[];
  platforms: Platform[];
  tapPoints: TapPoint[];
  cameraAngles: Record<number, AngleLinks>;
  /** Where the beast starts. Levels with no beast leave it out. */
  beastAt?: PortId;
  /** The angle the level opens on. */
  opensAt: Azimuth;
};

/** Everything that can change while playing. Two things, and only two. */
export type State = {
  angle: Azimuth;
  /** Channels that have filled. Rule 4: filling is irreversible, so this only
   *  ever grows. */
  filled: Set<PortId>;
  /** Where the beast stands, if there is one. */
  beastAt?: PortId;
};

export function begin(level: Level): State {
  return { angle: level.opensAt, filled: new Set(), beastAt: level.beastAt };
}

function linksAt(level: Level, angle: Azimuth, kind: "waterLinks" | "walkLinks"): [PortId, PortId][] {
  return level.cameraAngles[angle]?.[kind] ?? [];
}

/** Undirected neighbours of a port under one set of declared links. */
function neighbours(links: [PortId, PortId][], from: PortId): PortId[] {
  const out: PortId[] = [];
  for (const [a, b] of links) {
    if (a === from) out.push(b);
    else if (b === from) out.push(a);
  }
  return out;
}

/**
 * Rule 3: water runs only while the beast stands on a tap point.
 *
 * A level with no tap points at all runs from the start — that is level 1,
 * where the beast does not take part.
 */
export function sourcesRunning(level: Level, state: State): boolean {
  if (level.tapPoints.length === 0) return true;
  return level.tapPoints.some((tap) => tap.id === state.beastAt);
}

/**
 * Rules 1, 2 and 4 together: which channels are anchored at BOTH ends to pools
 * that the water can actually reach, at this angle.
 *
 * A channel joined at one end only is the half-filled state — visible, legal,
 * and deliberately not prevented. It is not walkable, and it is not returned
 * here; `halfFilled` reports it so the renderer can show water stopping in
 * mid-air.
 */
export function reachablePools(level: Level, state: State): Set<PortId> {
  const wet = new Set<PortId>();
  if (!sourcesRunning(level, state)) return wet;

  const links = linksAt(level, state.angle, "waterLinks");
  const queue = level.pools.filter((p) => p.isSource).map((p) => p.id);

  while (queue.length > 0) {
    const here = queue.shift();
    if (here === undefined || wet.has(here)) continue;
    wet.add(here);
    for (const next of neighbours(links, here)) {
      if (!wet.has(next)) queue.push(next);
    }
  }
  return wet;
}

/** Channels whose two ends are both reachable right now — these fill. */
export function fillingNow(level: Level, state: State): PortId[] {
  const wet = reachablePools(level, state);
  return level.channels
    .filter((c) => wet.has(c.id) && c.ends.every((end) => wet.has(end)))
    .map((c) => c.id);
}

/**
 * Channels the water has entered but which are anchored at one end only.
 *
 * This is a legitimate, important, visible state — water standing in a channel
 * whose far end hangs over nothing. Do not add logic to stop it happening.
 */
export function halfFilled(level: Level, state: State): PortId[] {
  const wet = reachablePools(level, state);
  return level.channels
    .filter((c) => !state.filled.has(c.id))
    .filter((c) => wet.has(c.id) && !c.ends.every((end) => wet.has(end)))
    .map((c) => c.id);
}

/** Rule 4: filling is irreversible, so this only ever adds. */
export function settle(level: Level, state: State): State {
  const filled = new Set(state.filled);
  for (const id of fillingNow(level, state)) filled.add(id);
  return { ...state, filled };
}

/**
 * Rule 5: where the beast can get to, at this angle, given what is filled.
 *
 * A filled channel is a floor — but it is still subject to rule 1, so it only
 * carries the beast at angles whose table says it looks joined. Full and
 * connected are different states and neither implies the other.
 */
export function walkableFrom(level: Level, state: State, from: PortId): Set<PortId> {
  const channelIds = new Set(level.channels.map((c) => c.id));
  const links = linksAt(level, state.angle, "walkLinks").filter(([a, b]) =>
    // A link naming a channel is dead until that channel has filled.
    [a, b].every((port) => !channelIds.has(port) || state.filled.has(port)),
  );

  const seen = new Set<PortId>();
  const queue = [from];
  while (queue.length > 0) {
    const here = queue.shift();
    if (here === undefined || seen.has(here)) continue;
    seen.add(here);
    for (const next of neighbours(links, here)) {
      if (!seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

/** Can the beast reach this port at this angle? */
export function canWalkTo(level: Level, state: State, to: PortId): boolean {
  if (state.beastAt === undefined) return false;
  return walkableFrom(level, state, state.beastAt).has(to);
}

/**
 * The level is won when the FINAL pool is full — not when water reaches it.
 * A pool counts as full once every channel that feeds it has filled.
 */
export function finalPoolFull(level: Level, state: State): boolean {
  const final = level.pools.find((p) => p.isFinal);
  if (!final) return false;
  const feeding = level.channels.filter((c) => c.ends.includes(final.id));
  return feeding.length > 0 && feeding.every((c) => state.filled.has(c.id));
}
