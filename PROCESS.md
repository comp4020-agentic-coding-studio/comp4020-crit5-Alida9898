# Process overview

## What I built

*Hanging Gardens* — an optical-illusion puzzle set in Babylon. A young
mušḫuššu stands on a spring; you press Space and water runs. An aqueduct
crosses a gap but its far end hangs over nothing, so the water stops mid-
channel. Turn the camera and that dangling end lands exactly on the rim of the
grand basin — not because anything moved, but because from *this* angle it
looks joined, and in this world looking joined **is** joined. Water fills the
basin; the level is done.

Three verbs, one level: **walk, draw water, turn the camera.**

## How the work was actually directed

The direction changed four times, and every change came from the author, not
from me. That is the honest shape of this week and the citations below are
mostly a record of me being redirected.

| the brief was | until |
|---|---|
| a pipe-grid game with finite water | the author replaced it wholesale with the Babylon illusion spec |
| player turns the **camera** | "先固定相机,只转砖块" |
| player turns the **bricks** | two reference screenshots: "我说的不是画风,是视角转动" |
| both, camera first | current |

The one thing I got right in that churn was refusing to hard-code the choice.
When the camera was taken away I wrote the condition on every connection as
`when: { camera?, turns? }` — omit a field, don't care about it
([b981b8b](../../commit/b981b8b)). When the camera came back
([0b3af71](../../commit/0b3af71)), `rules.ts` and every sensor needed **zero**
changes. That abstraction cost about ten minutes and saved a full rewrite.

## The architectural decision everything rests on

Connectivity is **declared, never computed**. A hand-written table says *these
two ends look joined in this configuration*; the runtime only ever looks it up
([32bf914](../../commit/32bf914)). No raycasting, no projection, no bounding
boxes. "Looks joined" is an art judgement, and deriving it from geometry needs
a tolerance nobody can defend — and it fails *softly*: a seam that reads as
joined but isn't looks like a broken puzzle, not a broken epsilon.

The projection exists for exactly two jobs — drawing, and **checking**.
`spec/iso.test.ts` projects both ends of every declared link and insists they
land on the same pixel. Move a terrace and every claim it participates in goes
red. That is the automatic version of a check that would otherwise be someone
squinting at a screenshot and going stale the next time a coordinate moved.

## What the tests caught that looked completely fine

- **A terrace turned 180° has its own channel pointing up the screen.** So a
  part's internal links need the same angle condition as the joins across it.
  Correct physics, invisible until a test walked every configuration
  ([b981b8b](../../commit/b981b8b)).
- **The "hidden direction" is different at every camera angle** — 45° is
  `(1,1,1)`, 135° is `(-1,1,1)`. I wrote it as a constant and the test went
  red. That difference is *why* four angles produce four different illusions
  ([32bf914](../../commit/32bf914)).
- **Two hand-written levels had no solution at all**, and a third was already
  solved on load. Both boards looked perfectly plausible
  ([1c29671](../../commit/1c29671)).

## What only playing caught

The spec asks for one change that came from playing rather than reading. This
is it, and it is the thing I am least proud of:

I drove the finished game in a real browser and found the water arriving at a
basin that **wasn't visibly there**. The sensor said the two ends were 0.00
apart — and it was right. The bug was that *the hidden direction is the line of
sight*: two things that coincide on screen are necessarily one in front of the
other, and I had put the basin in **front**, so it covered the aqueduct
completely. Turn the camera and the channel vanished; the join the whole level
is built around was never seen. Flipping the offset to the far side put the
spout in front and the basin behind, so water pours *into* it
([74caa4e](../../commit/74caa4e)).

No sensor could hold this. Mine checks that two points coincide; the bug was
that they coincided *too well*. Front-to-back is eyes only.

## Things I got wrong, and what fixed them

- **I rendered a 3D scene as a floor plan.** Camera straight overhead, flat
  unlit material — a 2D picture drawn with a 3D engine. I chose it because it
  made the DOM pick overlay easy to align, which traded the entire look of the
  thing for my own convenience. The author caught it, not me
  ([da0919c](../../commit/da0919c)).
- **I drew a staircase and a water channel on the same span.** Asked for a
  stair, I *added* one to a trough instead of choosing between them. Stairs
  carry the beast, channels carry water; both on one span reads as a rendering
  fault ([af6631b](../../commit/af6631b)).
- **I put three different actions on the mouse** — walk, turn brick, turn
  camera. One gesture with three outcomes is no gesture at all.
- **Then I over-corrected**: moved the camera to arrow keys only, which
  replaced a *discoverable* action with an undiscoverable one. In a game with
  no words, whether an input can be stumbled into is part of the design. Now:
  click a thing to act on the building, click empty space to turn
  ([f16499e](../../commit/f16499e)).
- **I marked clickable spots with dashed circles** — a HUD that couldn't
  explain itself, in a game whose spec forbids HUD. Removed; the beast walking
  is the feedback.

## Where the harness grew

`CLAUDE.md` gained the author's full specification verbatim (the five rules,
the architectural constraints, the palette, the spatial laws), plus what I
learned the hard way: that the pitch must be `atan(1/√2) = 35.264°` because it
is the only angle in the permitted 30–35 range where whole-number cells
coincide *exactly*; and the carve-out that a spec test written before its
implementation is allowed to be red.

## What is not done

One level of four. No planting feedback on completion — the spec asks for
terraces flowering as water reaches them, and the basin filling is currently
the only signal. The mušḫuššu is a placeholder shape, not the Ishtar Gate
relief. Levels 2–4 have engine and sensors waiting but no data.
