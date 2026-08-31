# Crit 5 plan — a game

Agreed before any prototype code. The architectural constraints live in
`CLAUDE.md` ("the constraints are the design"); this file is the *interaction*
plan those constraints were missing last week.

## What it is

A finite amount of water, a grid of rotating pipe modules, and somewhere for the
water to end up. You rotate modules to route the water. Every junction you leave
open spills, and spilled water is gone for good. Deliver enough before the tank
runs dry, or lose.

Theme, from the agreed palette (lapis blue, ochre gold, sandstone off-white,
date-palm green): a **qanat** — the Persian underground channel that moves
mountain water to a date grove. Lapis is water, ochre is the channel stone,
sandstone is the ground plane, green is the grove that fills as you deliver.
The theme is a skin over the mechanic and can change without touching the rules.

## The core loop

```
tank (N units) ──▶ source ──▶ [ modules, routed by rotation ] ──┬──▶ sink   +delivered
                                                                └──▶ open port   leaked, gone

  delivered >= target  →  win, the grove fills
  tank empty & short   →  loss
```

The loss is **gradual and visible**: the first time water spills, the tank level
drops a chunk in plain sight. That is the whole tutorial. No words.

## Why this can be lost

The spec requires a wrong move to be possible. Rotation alone is infinitely
retryable, so the irreversible cost is the water itself — hesitating spills, and
a spilled unit never comes back. `target < N` is the tolerance, and shrinking
that margin is the only difficulty knob the levels need.

## Data shape — connectivity is declared, never inferred

```ts
type Port = "N" | "E" | "S" | "W";
type Rotation = 0 | 1 | 2 | 3;
type Kind = "source" | "sink" | "straight" | "elbow" | "tee";

/** Water entering at `from` leaves at `to`. Directed, so flow is declared. */
type Link = { from: Port; to: Port };

/** Hand-written. One entry per kind per rotation state. No angle arithmetic. */
type Table = Record<Kind, Record<Rotation, Link[]>>;
```

Flow is a graph walk over this table and nothing else. From a cell's outgoing
port, look up the neighbour in that direction and ask its table whether it has a
`Link` entering from the facing port. **No** → the water spills there. Missing
neighbour (grid edge) → spills. That is the entire leak rule: a table lookup, no
geometry, no tolerance, no epsilon.

## The focused automated test

The spec asks for one rule under test. It is the leak rule, because it is both
the core mechanic and the source of the failure state:

```ts
flow(grid, tankUnits) → { delivered: number, leaked: number }
```

A pure function over plain data — no DOM, no Three.js, no canvas. Two known
grids: one routed end to end (`leaked === 0`), one with a facing port missing
(`leaked > 0`, `delivered` short of target). Rotation-lock (`canAcceptInput`)
gets the same treatment, per the pure-function rule in `CLAUDE.md`.

## How it teaches itself

Each level introduces exactly one idea, and nothing is ever written down.

| # | Board | What it teaches | How |
|---|---|---|---|
| 1 | One straight run, one module turned wrong | click = rotate | The break is the only thing on screen. Nothing else is clickable. |
| 2 | A tee with one open branch | spilling costs you | Water visibly pours out of the open arm; the tank drops. |
| 3 | Two routes, one shorter | order matters | Enough water to finish only if you close the branch before opening the path. |
| 4 | Tight margin | the skill sharpens | Same vocabulary, no slack left. |

**Water does not flow until the first click.** The opening screen is a still
board with one obviously-misaligned module — an invitation, not a countdown.
The first click both learns the verb and starts the game. A stranger who does
nothing loses nothing.

## Camera

`OrthographicCamera`, two enumerated positions, animated between: a straight
top-down for reading the grid, and a low three-quarter for watching water move.
Space toggles. No `OrbitControls`, no free rotation.

## Scope

Desktop only (click, arrows, Space). No audio, no timer, no score, no health, no
combat, no written tutorial. Mobile must open and render; it need not play.

## Open — needs your call before I build

1. **Grid size.** 4×4 reads instantly at 1920×1080 and stays legible at 390px.
   5×5 buys real routing depth. My call: 4×4 for levels 1–2, 5×5 for 3–4.
2. **Does the tank carry across levels?** Carrying it makes the whole run one
   escalating decision and gives the five minutes a spine, but one bad early
   level can doom a run a stranger doesn't understand yet. Per-level is safer
   and flatter. My call: **per-level**, with the delivered totals visibly
   accumulating in the grove so the run still has an arc.
3. **What ends the run?** Four levels then a filled grove is a *finish*. The
   spec accepts a win, a loss or a finish, so this is enough — but confirm you
   want a fixed four rather than an endless escalating ladder.
