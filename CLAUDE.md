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
    each call site cannot be audited at all.

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

## Crit 5: the constraints are the design (retires with this brief)

Agreed before any code was written. These leave with the brief; what carries
forward is the move underneath them --- turning a constraint into a grep rather
than a promise, so that breaking it is a red check and not a code review someone
has to remember to do. The sensors live in `spec/architecture.test.ts`, and the
constraints no sensor can hold are named as such at the end.

**Connectivity is declared, never inferred.**

- A module's rotation is a finite enumeration of states, not a continuous angle.
- Each rotation state carries a hand-written connectivity table declaring which
  ports connect, and which way flow goes.
- At runtime, look the answer up. No raycasting, no screen-space projection, no
  bounding-box overlap --- no deriving connectivity from geometry of any kind.
- Visual alignment is the art's job to place and the table's job to declare. It
  is never the code's job to work out.
- Level data is hand-written literals, not generated.

Worth a rule rather than a preference because geometric connectivity fails
*softly*: a pipe that looks joined and isn't reads as a bug in the puzzle rather
than a bug in the tolerance, and the fix is a magic epsilon nobody can defend. A
table is wrong loudly --- the port is in it or it is not --- and it is the thing
a rule test can actually assert.

**Rendering is flat and orthographic.**

- Three.js. `OrthographicCamera` only; no `PerspectiveCamera`.
- No `OrbitControls`. Camera positions are a finite enumeration, animated
  between.
- Built-in Three.js primitives only. No imported models, no textures.
- Flat solid-colour materials. No PBR, no normal maps, no shadow maps, no
  ambient occlusion, no post-processing.
- Four-colour palette: lapis blue, ochre gold, sandstone off-white, date-palm
  green. One module owns them as named constants --- see the canvas bullet under
  agent-browser for why inline colours cannot be audited at all.

**Scope of this version.**

- No audio.
- Desktop input only: mouse click, arrow keys, Space. Mobile has to open; it
  does not have to be playable.
- No combat, no timer, no score, no health, no written tutorial.
- Rotation is click-triggered, never dragged. Input is refused while a rotation
  animation is running --- which is state with an edge in it, so by the pure
  function rule above it belongs in a function a test can call, not inside the
  click handler.

**What a sensor holds:** every banned API is a string in the source, so one grep
test covers `PerspectiveCamera`, `OrbitControls`, model and texture loaders, PBR
materials, shadows, post-processing, `Raycaster`, `Box3`, projection, audio, and
drag listeners. Beyond grep: every module type crossed with every rotation state
resolves in the connectivity table, and every colour in the scene traces to the
palette module.

**What no sensor holds,** so it is on you and on the crit: whether the level
data is genuinely hand-authored, whether the art actually lines up with what the
table claims, and whether rotating a module *feels* like the right length of
animation. The first two are read; the third is only ever played.

## Facts about this stack that have each cost a run

- **`tsconfig.include` is `["*.ts", "spec", "scripts"]`.** Modules under `src/` are
  never typechecked. Entry modules live at the repo root --- that is why `main.ts`
  is there, and moving one "somewhere tidier" silently turns off its types.
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
