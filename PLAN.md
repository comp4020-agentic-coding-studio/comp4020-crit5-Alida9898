# PLAN.md

The current round's scope. Read this before starting; do only what it describes.

## Where the code stands against the spec

The specification in `CLAUDE.md` supersedes what is currently built. The gap is
not cosmetic — the central mechanic is different.

| | built now | the spec |
|---|---|---|
| what the player turns | **terraces**, camera fixed | **the camera**, building fixed |
| connectivity keyed on | which way each terrace is turned | which camera angle is showing |
| kinds of link | one (`Seam`) | **two** — `waterLinks` and `walkLinks`, judged separately |
| filled channels | no such state | become **walkable**, irreversibly |
| the mušḫuššu | a static marker | walks; **water only runs while it stands on a tap** |
| winning | water reaches the goal | the **final pool fills** |
| materials | `MeshBasicMaterial`, unlit | `MeshLambertMaterial`, two lights |
| palette | 4 flat colours | 4 hues × 3 tones + background |

So `illusion.ts`, `gardens.ts`, `ziggurat.ts` and `play.ts` are rewritten, not
adapted. `spec/illusion.test.ts` keeps its *method* — project both ends of a
declared link and check the model still says what the table says — but is
rewritten against the new shape.

What survives untouched: `CLAUDE.md`, the invariants, and the habit of turning
each constraint into a sensor.

## Round 1 — foundations (this round)

1. `src/config/style.ts`: every tunable named in one place — camera pitch and
   the azimuth enumeration, frustum size, transition duration and easing, both
   lights, tone mapping exposure, the full three-tone palette, and the terrace
   and step proportions.
2. `src/rules.ts`: the `Level` shape exactly as specified, plus the two pure
   judgements over it — which channels fill, and where the beast can walk —
   each a table lookup and nothing else.
3. `src/levels/level1.ts`: **data first, shown for confirmation before any
   rendering or logic is written against it** (spec §8).
4. `spec/rules.test.ts`: the five rules as tests. In particular the two that
   are easy to lose — that a half-filled channel is *not* walkable, and that
   filling is irreversible while walkability is not.

Not this round: rendering, the beast's movement, levels 2–4.

## The sensors this shape needs

Connectivity is declared, so nothing may derive it. But tests may still check
the declarations are coherent, and these are the ones worth having:

- every id named in a link exists among the pools, channels and platforms
- no channel claims an end that is not a pool
- a `walkLink` naming a channel is only ever live once that channel is filled
- every level is solvable from its opening state, by some sequence of camera
  angles and tap visits — and is **not** already solved on arrival
- water never runs to a port the tables call higher at that angle

## Open questions

1. **How does the beast move?** The spec says it walks and stands, and that the
   player is on desktop with click, arrows and Space. Click a reachable
   platform to walk there is the obvious reading, and arrows/Space then need a
   job — or they are the camera. Which pair is which?
2. **Are camera angles a ring or a list?** Four azimuths at 90° apart, cycled
   one way by one key, is the simplest thing that matches "finite enumeration"
   and a fixed transition. Confirm four, and whether they cycle both ways.
3. **§5 level 1 says the beast does not take part** — so level 1 has no tap
   point at all, and water runs from the start. Confirm: the first thing the
   player ever does is turn the camera, with nothing else on screen.
