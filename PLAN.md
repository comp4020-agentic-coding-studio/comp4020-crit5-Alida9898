# Crit 5 plan — the Hanging Gardens

A puzzle about impossible geometry, in Babylon. Supersedes the pipe-grid plan
that came before it; that mechanic is gone, not adapted. What carries over is
`CLAUDE.md`, the palette module, and the testing habits — not the game.

## What it is

A ziggurat of terraces, stairs and brick channels. Water starts at the
Euphrates at the foot of it and runs **only to where it looks lower on
screen**. Rotate parts of the building until two channels that are nowhere near
each other in space line up in the picture, and the water climbs somewhere it
had no business reaching. Water the top garden and the level is done.

Two mechanics, introduced one at a time:

1. **Rotate** a terrace and the seams change — things join and part.
2. **Place the mušḫuššu**, and the water starts wherever it stands.

## The one architectural decision everything rests on

Seams are **declared, never computed**. A seam is a hand-written statement that
*in this configuration, these two nodes look joined, and water runs this way
across them*.

```ts
type Seam = {
  from: NodeId;                    // water arrives here
  to: NodeId;                      // and runs to here, which LOOKS lower
  when: Partial<Record<PartId, Turn>>;  // only in this configuration
};
```

This is what Monument Valley does, and it is the only honest way: "looks
joined" is an art judgement, not a geometric fact. Deriving it from a
projection needs a tolerance nobody can defend, and it fails softly — a seam
that reads as joined and isn't looks like a broken puzzle, not a broken
epsilon. At runtime the game only ever looks up the table.

Which way is downhill is also declared, for the same reason: on screen it is
the picture that decides, and the picture is the art's job.

**The sensor that keeps art and table honest.** Nothing derives connectivity
from geometry — but a test may check the two agree. `spec/illusion.test.ts`
projects both ends of every declared seam through the same isometric map the
camera uses and asserts they land within a few pixels of each other. Move a
terrace in the model and every seam it carries goes red. That is the pairing
the constraints ask for: the art places, the table declares, and a check says
they still mean the same thing.

## Rules the levels teach, in order

| # | Teaches | How, without a word |
|---|---|---|
| 1 | rotating changes what connects | One turnable terrace, one obvious gap. Turn it, the channel meets, water runs. |
| 2 | water only goes where it looks lower | Two seams open at once; only the one that looks downhill carries water. The other just sits there. |
| 3 | both together | A route that needs a turn *and* the dragon moved to a platform that looks high enough. |
| 4 | the counter-intuitive one | The finish. A terrace must be turned so the route looks *worse* in space and better on screen. |

Difficulty stays low — this is a toy. Every level is winnable in a handful of
moves, and nothing is ever lost: a wrong configuration simply doesn't flow.

## The mušḫuššu

The Ishtar Gate dragon: serpent head, lion forelegs, eagle hind talons,
scorpion tail. Drawn as a flat side-on silhouette in glazed relief, keeping
the Mesopotamian convention of a profile body with a frontal eye. **That is
not an error to correct** — it is the visual grammar, and straightening it into
correct perspective would be the reskin this brief warns against.

It is not a walker. It is where water begins.

## Look

Orthographic, isometric. Flat colour, no textures, no gradients, no shadow
effects — the surface quality comes from glazed brick sitting flat next to
glazed brick. Lapis (the gate's cobalt), ochre, sandstone, date-palm green.
Stepped ziggurat terraces, brick channels, palms and vines. Not Egyptian gold,
not Persian carpet density: Babylon reads as austere.

Cameras are a few fixed angles with transitions between them. No orbit control.

## Winning is the garden, not a banner

Terraces open bare and the view is clear through the structure. Every level a
course of water reaches puts out date palms and vines; by the end the foliage
fills the frame and front leaves hang into the camera. Going from stone to
garden **is** the feedback. No UI is added for it.

## What no test can hold

Whether a seam actually reads as joined to a stranger's eye; whether the
dragon reads as Babylonian rather than as a generic monster; whether the
growth feels like a reward. Those are the crit.
