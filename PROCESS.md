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

**And then the author reversed that fix, for a reason I had not seen.** Far side
means the channel is nearer the camera, so the channel draws *over* the basin —
the fountain ends up sitting under its own water. Near side is the one that
reads: the pool's rim and surface are in front, and the channel goes in beneath
them, like a conduit entering a wall. Level 1 moved back to the near side
([0b90413](../../commit/0b90413)) and level 2 had to follow, because I had built
it on the opposite convention and the two levels were contradicting each other
([cd7ee9f](../../commit/cd7ee9f)).

No sensor could hold any of this. Mine checks that two points coincide; the bug
was that they coincided *too well*. Front-to-back is eyes only — and which side
is right is a judgement about what the picture should say, not a fact geometry
can supply.

## The mistake I made three times in one week

An anchor is a **grid centre**. A join is an **edge**. `spec/iso.test.ts` asks
whether two anchors project to the same pixel, which is exactly right for water
and *necessary but not sufficient* for anything the player walks on. I did not
have that sentence, so I paid for it three times:

- The channel drew from pool **centre** to pool centre and speared through half
  the target pool. Fixed by insetting both ends to the rim.
- The staircase was built **centred on its bottom anchor** instead of running
  `from` → `to`, so it overshot behind the start tile and stopped half way up.
  Invisible at a one-tile run (0.5 off); I then lengthened the run to two tiles
  for unrelated reasons and doubled the error, which reads as "the last change
  broke it" when nothing about that change was wrong
  ([3b6c018](../../commit/3b6c018)).
- The staircase climbed **perpendicular** to the deck it was supposed to reach,
  so its top edge and the deck's edge never faced each other. No drawing fix
  rescues that; it is a layout constraint, and it is now one of the conditions
  the level-2 coordinate search has to satisfy.

Every one of those was green the whole time. The lesson went into `CLAUDE.md`
as its own section, along with its front-to-back twin: two things on the same
pixel are necessarily one in front of the other, and which one is decided by
the sign of the hidden direction — so "X should be on top" is always a
modelling change, never a draw-order one ([ab0e105](../../commit/ab0e105)).

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
  no words, whether an input can be stumbled into is part of the design
  ([f16499e](../../commit/f16499e)).
- **Splitting the two verbs across one gesture didn't work either.** "Click a
  thing to walk, click empty space to turn" reads as separable when you write
  it down and is not separable in the hand — both are press-and-release, so a
  first-time player cannot tell which one they just triggered. Turning is now a
  **drag**; a click means one thing only. The spec's "no drag interactions" ban
  came off the list for it, with the reasoning recorded
  ([d9a554c](../../commit/d9a554c)).
- **I marked clickable spots with dashed circles** — a HUD that couldn't
  explain itself, in a game whose spec forbids HUD. Removed; the beast walking
  is the feedback. What replaced it is smaller and only exists at the moment of
  the click: a ripple where the pointer actually landed
  ([1905601](../../commit/1905601)).
- **The hit target was the tile's top face**, which was fine until terraces
  became full-height towers and the top face became a small diamond on a tall
  block. Clicking the tower did nothing, so the game felt like it registered
  clicks *sometimes* — the hardest kind of fault to report, and the author hit
  it repeatedly before it got named. The hit area is now the piece's projected
  outline, still from the same camera projection, no raycast
  ([0833347](../../commit/0833347)).

## Where the harness grew

`CLAUDE.md` gained the author's full specification verbatim (the five rules,
the architectural constraints, the palette, the spatial laws), plus what I
learned the hard way: that the pitch must be `atan(1/√2) = 35.264°` because it
is the only angle in the permitted 30–35 range where whole-number cells
coincide *exactly*; and the carve-out that a spec test written before its
implementation is allowed to be red.

## What is not done

**Two levels of four.** Level 2 puts two joins in the level that cannot both
hold at the same azimuth — the stairs at one angle, the corner aqueduct at
another — so the shape is turn, climb, turn, pour, and rule 3 is what makes it
work: the beast has to already be standing on the cistern when the second turn
lands ([a53f5a7](../../commit/a53f5a7)). Its coordinates are not placed by
hand; they are enumerated against the sensors' own predicates and the first
solution that satisfies all of them is taken.

Completion feedback exists now, but not the one the spec asked for. The spec
wants every tier the water passed through to grow date palms and vines. What
shipped is the fountain starting to spray at the instant the cistern tops out —
the author's call, recorded in §6 along with what it costs: the foliage is the
game's own title made visible, and `date` green is now the one hue in the
palette with nothing using it ([37418a8](../../commit/37418a8)).

The mušḫuššu is still a placeholder shape, not the Ishtar Gate relief. Levels 3
and 4 have engine and sensors waiting but no data, and level 2 took on some of
what level 3 was going to teach, so those two need re-scoping before they are
built.
