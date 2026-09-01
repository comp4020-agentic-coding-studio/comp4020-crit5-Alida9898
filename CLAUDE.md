# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.
- Never commit a red state --- with one exception, and only one: a spec test
  written before the thing it tests, which is red *because the work hasn't
  happened yet*. Those are the week's contract, they land in the first commit,
  and turning each one green is the process evidence `PROCESS.md` cites. A test
  that went red because something broke is never in this category. If you can't
  say in one sentence why a red test is the planned starting state, it isn't.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so the deployed head is the only place a broken one shows up.

## The checks

`pnpm check` runs them, and `pnpm check:evidence` is the extra gate before you
ship. CI runs the same plus links, secrets and the deploy. Read the failure.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

Two sensors carried forward from A1, because the template roster has neither:
`check` also runs `oxlint` and `stylelint`, and `spec/accessibility.test.ts` runs
axe-core in jsdom. Read the sections below for what each of them cannot see.

## This file is yours

A starting point, not a rulebook: what you add to it is the harness, and the
harness is assessed. This file and the sensors you wire into `check` carry
across the course --- both come with you into next week's repo. The prototype
doesn't: source, and the tests answering this week's published spec, stay
behind. `spec/README.md` draws the line.

So as you learn what your prototype needs --- a convention the work has to hold
to, a sensor that keeps catching you out (a linter, say), a fact about the stack
that is easy to get wrong --- write it down here and wire it into `check`.
Growing this file is the work.

## Plan before building, when the ask is more than one thing

Phase 1 of the hunt was built as a complete, working mechanic --- you moved your
aim until two readings cancelled out --- reviewed, and then thrown away whole.
The scoping plan existed and was good (`PLAN.md`, cut the explainer down to ear
asymmetry alone). What was missing was a plan for the *interaction*, so the first
design that got imagined was the first design that got built, and the question
underneath it --- how does the page show that the owl works the height out in
advance? --- never got asked until there was working code to argue with.

So: when a request is more than one task, or when the shape of the thing is not
obvious yet, write the plan first and get it agreed before building. `PLAN.md`
for anything that outlives the session; a short numbered list in the conversation
for anything smaller. A plan is cheap to disagree with. A finished mechanic is
expensive, because disagreeing with it means someone has to accept the work was
wasted --- which is pressure to keep a bad design rather than admit it.

## Commit as each piece of work finishes, not at the end of a session

Crit 1 nearly shipped with nothing real behind it: a whole Windows 98 re-skin
was built, checked with `pnpm check`, and confirmed in the browser across many
turns of back-and-forth --- but never once committed. Because the last real
commit predated all of it, `git status -sb` showed the local branch level with
`origin/main`, which reads as "everything's pushed" even though what was
pushed was a bare stub. A tutor's automated nudge is what caught it, not a
local check.

So: after any turn that leaves the working tree passing `pnpm check` with a
real, reviewed change in it, commit before moving to the next request --- don't
wait for a natural stopping point, because "the session's about to end" isn't
a signal available until the deadline is already close. Before treating a
session as wrapped, run `git status -sb` and `git log --oneline @{upstream}..HEAD`
and confirm there's nothing sitting uncommitted, not just that the working
tree is clean.

## Looking at the page: agent-browser

The rendered page is the ground truth, and this project has no browser on the
PATH. `agent-browser` is not installed globally --- run it through pnpm:

```sh
ab() { pnpm dlx agent-browser@0.34.0 "$@"; }   # zsh: a function, NOT a variable
ab open http://localhost:5173/                # 5173, not the 5177 of an older
                                              # repo: no `server` block here
ab set viewport 1920 1080     # `viewport` lives under `set`, not at top level
ab reload && ab screenshot /tmp/desktop.png
ab set viewport 390 844 && ab reload && ab screenshot /tmp/phone.png
ab a11y                       # axe-core in real Chrome
ab errors                     # page errors
ab close --all
```

Three things that cost time the first run:

- **zsh does not word-split unquoted parameters.** `AB="pnpm dlx ..."` then
  `$AB open` fails with `command not found` because the whole string is treated
  as one command name. Use a shell function.
- **`viewport` is a subcommand of `set`**, so bare `agent-browser viewport ...`
  answers `Unknown command`. Same for `device` and `media`.
- **`set viewport` needs a `reload`** before the screenshot, or you photograph
  the old layout.
- **`ab errors` keeps a buffer across navigations, and a stale entry is
  indistinguishable from a live bug.** An error thrown by the module you saved
  thirty seconds ago is still listed after `ab open` on a fresh URL, with the
  old `?t=` timestamp still in the stack trace --- so it reads as "the page is
  broken right now". Two ways to tell: `ab errors --json` shows the `?t=`
  timestamp (an old one is stale), and `ab close --all` before reopening
  clears it for real. `--clear` alone did not. Check what the page actually
  *does* before believing the buffer.
- **`ab click <selector>` has silently done nothing** where
  `ab eval "document.querySelector('…').click()"` worked. A no-op click looks
  exactly like a page that ignored the click, so it is worth reaching for `eval`
  before concluding the page is broken --- prefer it when a click is load-bearing
  evidence.

Two checks only a real browser can do, so they do not belong in `pnpm check`:

- **Colour contrast, and the widening list of things axe cannot see.**
  `spec/accessibility.test.ts` runs axe in jsdom, which has no layout, so every
  geometric rule is skipped --- contrast included. `ab a11y` runs the same axe
  in Chrome and does evaluate it, but only for what it can resolve, and three
  things in a row have fallen outside that:
  - **SVG `<text>`** axe cannot measure at all, reporting *incomplete*. A
    hand-check goes stale the moment the background moves, which is how amber
    labels ended up on a cream plate at 1.77:1 after being measured at 8.6:1 on
    the dark. Where the geometry allows it, make the rule positional instead ---
    in A1, `spec/pages.test.ts` forbade a label inside a plate's rect.
  - **A gradient background** returns *incomplete* for every text node over it,
    because axe cannot resolve one background colour behind them. Measure by
    hand against the *lightest* point (worst case for pale text) and write the
    ratio into the CSS beside the value.
  - **A `<canvas>` is opaque to axe** --- there are no nodes inside it, so a
    WebGL or 2D scene is not partially covered, it is entirely uncovered. Nothing
    automatic says anything about it, in jsdom or in Chrome. If the prototype's
    whole point lives on a canvas, then *all* of its contrast is a hand-check,
    and the only durable version of that is to drive the palette from named
    constants in one module and measure those once. Colours picked inline at
    each call site cannot be audited at all. **This project adds one wrinkle:
    tone mapping (see Rendering) shifts what reaches the screen away from the
    hex constants, so measure contrast from screenshots of the rendered canvas,
    not from the constants themselves.**

  Every one of these expires silently when the palette moves, so write the
  measured ratio next to the constant, not in a commit message.
- **Both marking viewports.** 1920x1080 and 390x844 each count in full. Check
  that the core interaction is reachable without a scroll at 1080 --- a page
  whose interaction is below the fold has buried its own point.

## Navigation: collapse it on a phone, and make the collapse survive no JS

More than two or three destinations in a horizontal nav, collapse them behind a
button below the phone breakpoint. In A1 a three-link nav fitted on one line at
390px --- 358px of 390 --- so nothing *looked* broken; it was still spending a
whole row of vertical space on the viewport with the least of it, directly above
the fold, on the page whose interaction has to be reachable without scrolling.
Two traps, both of which look completely finished while broken:

- **Ship the button with `hidden` and let the script remove it.** A hamburger
  that assumes its script ran leaves a button that opens nothing when it did
  not --- and that failure is invisible, because a dead button looks like a live
  one. The plain list is the correct no-script state.
- **Restore the list unconditionally above the breakpoint.** A phone left closed
  and then rotated past the breakpoint otherwise has no nav at all: the collapsed
  state is stale and nothing on screen says so. This is found by users, not by
  you, because you never rotate your own test device mid-session.

In A1 both were pinned in `spec/nav.test.ts` and `spec/pages.test.ts`.
`spec/invariants.test.ts` requires a `<nav>` landmark on every page, so even a
single-screen prototype carries one --- while it stays a single link this
section costs nothing, and the moment it grows past that, pin them again rather
than trusting the memory.

## A gesture's direction is untestable where it usually lives

C4's pour gesture sent the water *up* when the hand went *down*. Both directions
animate smoothly, neither errors, and the suite was green through the whole
thing --- it was found by a person dragging a glass and saying "why does this go
the wrong way". The sum was one line inside a `pointermove` handler, which is a
place a unit test cannot reach: importing the module needs a DOM, an
`AudioContext` and synthetic `PointerEvent`s before it can assert anything.

So: when a gesture maps input to state, put the arithmetic in a pure function
and call it from the handler. `pouredLevel(startLevel, dy, travel)` in
`tuning.ts` exists for no reason except that its direction can then be two lines
in `spec/tuning.test.ts`. Applies to anything with a sign in it --- scroll,
drag, zoom, scrub.

## The game: Hanging Gardens (this brief only --- retires with it)

The specification below is the contract. It was authored in Chinese and
translated to English at the author's direction on 2026-09-01; the Chinese
original stays in git history and wins if a translation dispute ever matters.
The same commit resolved four contradictions that had accumulated between
drafting layers (2D-renderer spatial rules vs the Three.js implementation;
pillar guidance vs the pillar ban; camera-rotation level text vs the
part-rotation decision; and no rule against the azimuth-rounding class of DOM
bug). What carries forward from this section is not the rules but the move
underneath them: a constraint written down and wired to a check beats a
constraint remembered.

An optical-illusion puzzle game themed on the Hanging Gardens of Babylon. The
player rotates pieces of the tower and exploits visual coincidence under
orthographic projection to reassemble water routes and walking paths, so the
Euphrates climbs the tower level by level and finally fills the great cistern
at the top.

The water-drawing beast (mušḫuššu, 穆什胡什) is the only character. It does not
fight and does not jump; it walks and it stands.

### 1. The five core rules

These five rules are the entire game. No additions, no exceptions.

1. **If it looks connected on screen, it is connected.** Every connectivity
   judgement --- water routes and walking paths alike --- is based on visual
   connection under the current configuration, regardless of true 3D distance.
   No exceptions.
2. **Water only flows toward what looks lower on screen.**
3. **Water starts flowing when the beast stands on a tap point.** When the
   beast steps off, results that have already happened do not roll back.
4. **A channel counts as filled only when both of its ends are anchored to
   pools; filling is irreversible.** A channel that water reached but whose far
   end is not anchored to a pool stays half-full and cannot be walked on.
5. **A filled channel is walkable surface, but it still obeys rule 1.** A
   filled channel can look disconnected in some configurations, and in those
   configurations it cannot be walked. "Full" is a state of the water;
   "connected" is a state of the view. They do not affect each other.

Design consequences that follow from the rules (must be preserved in the
implementation):

- The water alignment requirement (a channel's two ends anchored to pools) and
  the walking alignment requirement (the channel looks joined to the ground
  under the beast's feet) are **two different judgements on the same piece of
  geometry**. One configuration can satisfy one and not the other. The puzzle's
  depth comes from exactly this; do not try to unify them.
- "Water flows halfway and stops" is a **legal and important visible failure
  state**, and must be shown clearly (water resting in the channel, the far end
  hanging in the air). It is not a bug. Do not add logic to prevent it.

### 2. Architecture (non-negotiable)

Connectivity comes from hand-written tables, not from geometric computation:

- **Current version: the camera is fixed at one azimuth; the player rotates
  parts.** The spec originally said rotate-the-camera; that reading is kept
  below undeleted, because the data structure covers both --- see `when`.
  Switching back means filling in one more field per declaration; no rules and
  no sensors change.
- One "configuration" = camera azimuth + the turn stop of every rotatable
  part. **All finite enumerations**, never continuous values.
- Every connectivity declaration carries a `when` stating the configurations
  in which it holds; an omitted field means "don't care". This avoids the
  combinatorial explosion of writing one full table per configuration, while
  every line stays hand-written.
- The runtime only looks things up in the table.
- **Forbidden:** raycasting (`Raycaster`), screen-space projection checks,
  bounding-box overlap tests, or any geometric computation that derives
  "whether two things look aligned".
- On-screen alignment is guaranteed by model placement, declared by the table,
  and **never inferred by code**.
- Level data is hand-written literals under `src/levels/`, one file per level.
  Not generated, not derived.

This is the most important architectural decision in the project. If you find
yourself writing code like "compute whether two platforms' projections
overlap", the direction is wrong --- stop.

```ts
type PortId = string;   // a name for anything connectable: pools, channel ends, platform edges
type PartId = string;   // a rotatable part
type Turn = 0 | 1 | 2 | 3;

/** The configurations in which a declaration holds. Omitted = don't care. */
type When = { camera?: Azimuth; turns?: Partial<Record<PartId, Turn>> };
type Link = { between: [PortId, PortId]; when: When };

interface Level {
  pools: { id: PortId; isSource?: boolean; isFinal?: boolean }[];
  channels: { id: PortId; ends: [PortId, PortId] }[];   // ends point at two pools
  platforms: { id: PortId }[];
  tapPoints: { id: PortId; on: PortId }[];              // tap point, and the platform it sits on
  parts: PartId[];                                      // rotatable parts

  waterLinks: Link[];   // "the water route looks connected"
  walkLinks: Link[];    // "it looks walkable"
}
```

`waterLinks` and `walkLinks` must stay separate declarations; do not merge
them. They are two independent judgements. `walkLinks` entries may reference a
`channels` id; such a link is only live once that channel is filled. Runtime
state is exactly two things: the current configuration, and the set of filled
channels (grow-only).

### 3. Rendering constraints (Three.js --- Plan A)

An earlier draft of this file carried a 2D isometric renderer's rules
(`worldToScreen` at 64px per tile, painter's-algorithm draw order). Those
conflicted with the Three.js implementation and were retired on 2026-09-01 in
favour of Plan A: the same intent, restated as **modelling discipline**. Depth
belongs to the GPU.

#### 3.1 Spatial law

- The world is a discrete grid. Every object's logical position in level data
  is integer `(x, y, z)`. `TILE = 1` Three.js world unit; there is no second
  conversion ratio anywhere.
- Logical coordinates become world coordinates through exactly one function:

  ```ts
  function gridToWorld(x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(x * TILE, z * TILE, y * TILE);
  }
  ```

- **No decimal offsets, no hand-tuned nudges, no magic numbers in positions**
  (the 0.42 channel inset was this bug). Alignment problems are fixed by
  changing a geometry's origin or dimensions, never by nudging its position.
- Geometry dimensions are `TILE` multiples or the ratios named in §3.5 ---
  nothing else.

#### 3.2 Camera

- One `OrthographicCamera`, parameters as constants, fixed in the current
  version. **`PerspectiveCamera` is forbidden** --- perspective means distant
  edges can never align pixel-exactly, and pixel-exact coincidence of edges is
  the premise of the illusion. **`OrbitControls` and any free orbit camera are
  forbidden.**
- Pitch is a `style.ts` constant: 35.264° (`atan(1/√2)`). The spec allows
  30--35°, and this is the **only** value in that band where integer grid
  points coincide exactly: the compensation ratio `√2 / tan(pitch)` equals 2
  there, versus 2.178 at 33° and 2.449 at 30° --- each of which leaves two
  edges permanently a hair apart, exactly the near-miss the perspective ban
  exists to avoid.
- Azimuth stays an enum, 45/135/225/315 --- kept for the future
  camera-rotation version.
- A turn = playing one fixed transition animation that lands on the next enum
  stop. **During the transition, no input is accepted and no connectivity
  judgement runs.** Intermediate states necessarily break the illusion; the
  break must be hidden inside the animation. This applies to parts verbatim
  now, and to the camera verbatim if it ever rotates.

#### 3.3 DOM overlay positioning

Positioning DOM elements (buttons etc.) over the canvas is done **only** by
projecting a world position through the camera:

```ts
function worldToScreenPx(world: THREE.Vector3): { left: number; top: number } {
  const v = world.clone().project(camera); // NDC
  return {
    left: (v.x * 0.5 + 0.5) * renderer.domElement.clientWidth,
    top: (-v.y * 0.5 + 0.5) * renderer.domElement.clientHeight,
  };
}
```

**All angle arithmetic in overlay positioning is forbidden.** The bug this
retires: azimuths of 45/135/225/315 were being rounded against multiples of
90°, so the derived angle was wrong at every stop and the buttons landed
off-position permanently. Projection has no angles in it, so the whole class
is gone.

#### 3.4 Depth

- Ordering is settled by the depth buffer. **Forbidden:** manual
  `renderOrder`, `depthTest: false`, and any draw-order hack.
- Every material is opaque (`transparent: false`, `opacity: 1`), **water
  included** --- water is solid lapis colour. This sidesteps transparency
  sorting entirely.

#### 3.5 Geometry vocabulary (only these elements exist)

- **Terrace**: at least three primitives --- main body, a thin top plate one
  tone lighter, and a base cornice slightly wider than the body and one tone
  darker. Never a single box. Sides are solid extrusions of the body.
  **Colonnades, free-standing pillars, and per-tile support structures are
  forbidden** (removed in the Plan A cleanup; the eight-pillar porticos under
  each terrace were this bug).
- **Steps**: visible thickness; never a ramp standing in for stairs.
- **Pool**: 1 tile; an inset cylinder, diameter 0.8 `TILE`.
- **Channel**: a groove 1 tile wide, axis-aligned only.
- **Beast**: 1 tile footprint, about 1 `TILE` tall.
- Everything is built from Three.js built-in primitives. **External 3D models
  (.glb/.gltf/.obj etc.) and texture files are forbidden** --- the whole image
  is generated by code.
- **No geometry that is not in the level data.** Visual complexity is capped
  by the level data; the renderer never improvises decoration.
- **No gridlines and no brick seams on top faces** (those were debug
  rendering; production surfaces are solid stone).

#### 3.6 Materials and lighting

- Materials are `MeshLambertMaterial`. **Forbidden:** `MeshStandardMaterial`,
  `MeshPhysicalMaterial`, PBR, normal maps, ambient occlusion, `shadowMap`.
- **Do not use `MeshBasicMaterial`.** It is unlit, so a cube's three visible
  faces come out identical and all sense of volume dies.
- Exactly two lights: one `DirectionalLight` (fixed direction, **not**
  following the camera) + one `AmbientLight` (intensity ≈ 0.6, so dark faces
  never go black).
- Volume comes from per-face brightness differences by orientation, not from
  cast shadows.
- `WebGLRenderer` with `antialias: true`. Enable `ACESFilmicToneMapping`,
  `toneMappingExposure` ≈ 1.1. Background is warm sand, never pure black or
  pure white.
- A light Bloom pass is allowed. **SSAO is forbidden** --- contact shadows
  fight the flat-colour style.

#### 3.7 Palette

Do not pick colours. Each hue has three steps, used in order for the light
face, mid face, and dark face (the terrace's plate/body/cornice tiers draw
from the same steps):

```
sandstone   #E8D5B7  #D4B896  #A8906F
ochre gold  #E0A94F  #C08432  #8A5A1E
lapis       #4A6FA5  #2E4A73  #1B2E4A
date green  #7A9455  #5C7340  #3E4F2B
background  #F2E4CE
```

Visual language: stepped ziggurat terraces, brick water channels, date palms
and vines. Reference the glazed-brick tilework of the Ishtar Gate --- flat
colour fields, no texture, no realistic materials. Avoid: a Monument Valley
reskin, ancient-Egyptian gold opulence, Persian-carpet density of ornament.

### 4. Tunable parameters live in one place

All of the following are named constants in `src/config/style.ts`, never
scattered hardcodes: camera pitch, the azimuth enum values, orthographic
frustum size, transition duration and easing, the `DirectionalLight` direction
vector and intensity, `AmbientLight` intensity, `toneMappingExposure`, the
entire palette, terrace thickness, cornice overhang, step height, and every
other geometric ratio.

These values get re-tuned by eye repeatedly; they must be changeable without
touching logic code.

### 5. Level design

Four levels, low difficulty, toy-feel first. All teaching is carried by level
structure; **no text tutorials**. The levels were designed in the
camera-rotation reading; in the current version every "turn" below is a turn
of the level's rotatable part, and the `when` tables express the same puzzles
either way.

- **Level 1 · Water only** --- source pool → (a broken channel) → final pool.
  One turn joins it up; water flows across and fills. The beast is not
  involved. Teaches rules 1 and 2. This level should be so short it barely
  counts as a puzzle.
- **Level 2 · Beast only** --- the channel is intact, but the beast cannot
  reach the tap point. One turn joins the stairs and the platform on screen;
  the beast walks up, stands, and the water finishes on its own. Teaches
  rule 3.
- **Level 3 · Water opens the road** --- between the beast and the goal is a
  gap that no configuration bridges directly. The beast must first reach a tap
  point and release water so that the channel spanning the gap fills into a
  bridge, then walk across the water. This level must include one engineered
  failure: the configuration a player tries first lets the water leak toward
  an end with no pool, and the water halts mid-channel. Teaches rules 4 and 5.
- **Level 4 · The bridge still needs one more turn** --- two channels, two tap
  points. Fill the first → walk it to the second tap point → fill the second →
  in the current configuration the second, though full, looks broken → one
  more turn and it connects → walk across and fill the final great cistern.

The win condition is **the final cistern being filled**, not "water reached
the end". The great pool's level rises progressively; the instant it tops out,
the whole tower blooms.

### 6. Completion feedback

Every tier the water has passed through grows date palms and vines. At level
start the terraces are bare stone and the view is fully open; at solve,
foliage fills the frame and foreground leaves hang down in front of the
camera. That is the entire completion feedback. **No HUD, no victory modal, no
progress bar.** Occlusion happens only after the puzzle is solved; nothing may
cover a load-bearing seam while the player is still solving.

### 7. Not in this version

Audio (all of it), mobile touch controls (desktop only: drag + mouse click +
arrow keys + Space; mobile merely has to open), combat, timers, score, health,
text tutorials, menus, a title screen, level select, saves, a second beast.

**"Drag interactions" left this list on 2026-09-01, at the author's direction.**
Turning the view is a drag; a click now means one thing only --- send the beast
there. The version before it put both verbs on the same gesture (click a thing =
walk, click empty space = turn), which reads as separable when you write it down
and is not separable in the hand: both are press-and-release, so a first-time
player cannot tell which of the two they just triggered, and therefore cannot
learn that either is theirs to control. Splitting two verbs across two gestures
is not the same move as hiding one of them behind a gesture nobody finds --- the
earlier reversal (arrow-keys-only, reverted because nobody discovers a key) was
that one, and this is not.

Two constraints the drag does **not** relax, both still enforced:

- **It does not track the pointer.** Crossing the pixel threshold plays the same
  fixed transition to the next enum stop that the arrow keys play. §3.2 forbids a
  free orbit camera because intermediate angles necessarily break the illusion,
  and that ban reads the same for a gesture as for a key.
- **Its sign lives in a pure function.** `turnFromDrag(dx, threshold)` in
  `src/gesture.ts`, called from the `pointermove` handler and pinned by
  `spec/gesture.test.ts` --- see "A gesture's direction is untestable where it
  usually lives" above. The threshold itself is `INPUT.dragTurnPx` in
  `style.ts`, because it gets tuned by hand.

### 8. Working practice

- Read `PLAN.md` before starting any session (the spec spells it `plan.md`;
  this repo's filesystem is case-insensitive, so it is the same file), and do
  only that file's scope for the round.
- **When new level data is involved, output the data literal for confirmation
  first, then write rendering and logic code.**
- Everything else (checks, commit rhythm, red states) is covered by the
  general sections above and not repeated here.

## Facts about this stack that have each cost a run

- **`tsconfig.include` is a whitelist, and a directory missing from it is
  silently untypechecked.** The template ships `["*.ts", "spec", "scripts"]`, so
  a module moved to `src/` "somewhere tidier" loses its types without a word ---
  `tsc --noEmit` stays green because it never looked. C5 added `"src"` to the
  list on purpose. Adding a directory is fine; *moving code into one that isn't
  listed* is the trap. Check the array before you reach for a new folder.
- **jsdom: `document.textContent` is `null`** on a Document node, per the DOM
  spec. Use `document.body.textContent`. A test that reads the former does not
  error, it just matches nothing --- so it passes while asserting nothing.
- **jsdom has neither `matchMedia` nor `<dialog>`'s `showModal`/`close`.** Stub
  what you need *before* importing the module under test, since a module that
  reads them at load time has already run by the time your `beforeEach` fires.
- **`[hidden]` loses to any class that sets `display`.** The UA rule is
  `display: none` at specificity (0,1,0), so `.steps { display: flex }` beats it
  and the attribute does nothing at all. Pair every attribute-driven hide with
  its own `.thing[hidden] { display: none }`.
- **Raster, when a week uses it:** `filter: invert()` only works on line art (a
  tonal drawing inverted is a photographic negative --- eye sockets come out
  brightest), and never back a lossy image with a rect in a "matching" colour,
  because the paper survives compression a few levels off and seams against it
  at a hard edge. Bake the margin into the image so there is only one surface.
