// The Three.js layer. Flat, orthographic, built-in primitives only.
//
// This module draws a board so that it MATCHES the connectivity tables. It
// never reads geometry back to decide anything: every question about what
// connects to what is answered in flow.ts by a table lookup. Picking is a DOM
// overlay, not a raycast — see board.ts.
//
// Each module is modelled ONCE, in rotation 0, and turned by rotating its
// group a quarter about Y. That is not a shortcut: every kind's rotation 0
// maps onto rotation 1 under exactly that turn (N–S becomes E–W, N–E becomes
// E–S, a tee closed at S becomes one closed at W), which `spec/scene.test.ts`
// pins against the tables. It also means a turn is an angle to interpolate,
// so the animation is free.

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from "three";
import type { Grid, Kind, Port, Rotation } from "./connectivity.ts";
import type { Trace } from "./flow.ts";
import { GROVE, LAPIS, OCHRE, SANDSTONE } from "./palette.ts";

const CELL = 1;
const PIPE = 0.19;
/** Channels stand this far proud of the sand. Under an oblique camera this is
 *  the difference between a solid object and a painted line. */
const RAISE = 0.16;

/**
 * Two enumerated camera positions, animated between. No free rotation.
 *
 * Both are OBLIQUE. A camera directly overhead renders a 3D scene as a floor
 * plan — flat materials plus a plan view is a 2D picture drawn with a 3D
 * engine, whatever the renderer underneath is doing.
 *
 * The tilt is what makes the DOM pick overlay tricky, and the reason it is
 * still fine: under an ORTHOGRAPHIC camera the ground plane projects by an
 * affine map, so CSS `rotateX` reproduces it exactly. For a camera at
 * (0, h, d) looking at the origin, that angle is atan(d/h) — see TILT below,
 * which `board.ts` applies to the overlay. Keep the two in step: move a camera
 * here and the buttons stop lining up with what they sit on.
 */
export type View = "play" | "result";
const VIEWS: Record<View, [number, number, number]> = {
  play: [0, 8, 8],
  result: [0, 4.6, 9.2],
};

/** The playing camera's tilt, in radians and degrees. The overlay uses it. */
export const TILT = Math.atan(VIEWS.play[2] / VIEWS.play[1]);
export const TILT_DEG = (TILT * 180) / Math.PI;

const flat = (colour: string): MeshBasicMaterial => new MeshBasicMaterial({ color: colour });

/** Which way a port points in world space. Drawing only. */
const HEADING: Record<Port, [number, number]> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
};

/**
 * The ports each kind shows in ROTATION 0. Every other rotation is this shape
 * turned a quarter, so this is the only place the art has to agree with the
 * connectivity tables — and `spec/scene.test.ts` checks that it does.
 */
export const BASE_PORTS: Record<Kind, Port[]> = {
  source: ["N"],
  sink: ["N", "E", "S", "W"],
  straight: ["N", "S"],
  elbow: ["N", "E"],
  tee: ["N", "E", "W"],
};

/** A turn is a quarter about Y. Negative because +X is east and −Z is north. */
export function angleFor(rotation: Rotation): number {
  return (-rotation * Math.PI) / 2;
}

type FlatMesh = Mesh<BoxGeometry, MeshBasicMaterial>;

/**
 * A length of channel, and the water that may run in it.
 *
 * Two objects, not one recoloured object. Water that is merely the channel
 * painted blue floods the whole width and the masonry disappears under it —
 * on screen it stops being water IN something. A narrower, higher bar sitting
 * inside a trough that never moves reads as what it is, and the channel stays
 * legible whether it is running or dry.
 */
function arm(port: Port, colour: string): { channel: FlatMesh; water: FlatMesh } {
  const [dx, dz] = HEADING[port];
  const length = CELL / 2 + PIPE / 2;
  const channel = new Mesh(new BoxGeometry(PIPE, PIPE * 1.4, length), flat(colour));
  channel.position.set((dx * CELL) / 4, RAISE, (dz * CELL) / 4);
  const water = new Mesh(new BoxGeometry(PIPE * 0.5, PIPE * 0.8, length), flat(LAPIS));
  water.position.set((dx * CELL) / 4, RAISE + PIPE * 0.42, (dz * CELL) / 4);
  water.visible = false;
  if (dx !== 0) {
    channel.rotation.y = Math.PI / 2;
    water.rotation.y = Math.PI / 2;
  }
  return { channel, water };
}

/** The pieces that turn blue when water runs through them. Keeping them in a
 *  list is what lets the board SHOW the route rather than only its result. */
type Built = { group: Group; waters: FlatMesh[]; core: Mesh | null };

function moduleGroup(kind: Kind): Built {
  const group = new Group();
  // Every bit of water in this module, hidden until it runs.
  const waters: FlatMesh[] = [];
  let core: Mesh | null = null;

  if (kind === "source") {
    // A wellhead: a stone collar standing well clear of the sand, brim full.
    const collar = new Mesh(new CylinderGeometry(0.32, 0.36, 0.5, 16), flat(SANDSTONE));
    collar.position.y = RAISE + 0.1;
    group.add(collar);
    core = new Mesh(new CylinderGeometry(0.23, 0.23, 0.54, 16), flat(LAPIS));
    core.position.y = RAISE + 0.14;
    group.add(core);
  } else if (kind === "sink") {
    const bed = new Mesh(new BoxGeometry(0.9, 0.2, 0.9), flat(GROVE));
    bed.position.y = RAISE - 0.02;
    group.add(bed);
    // A pool at the centre of the grove. It fills as water arrives, which is
    // the only "score" the game has and it is not a number.
    core = new Mesh(new BoxGeometry(0.1, 0.24, 0.1), flat(LAPIS));
    core.position.y = RAISE + 0.06;
    group.add(core);
    // The palm is back: from overhead a date palm is a circle and says
    // nothing, but at a tilt it is the tallest thing on the board and reads as
    // the place the water is FOR. One, set back, so its crown breaks the
    // silhouette against the sand instead of merging with the bed below it.
    const trunk = new Mesh(new CylinderGeometry(0.05, 0.07, 0.72, 8), flat(SANDSTONE));
    trunk.position.set(0.06, RAISE + 0.4, -0.34);
    group.add(trunk);
    const crown = new Mesh(new CylinderGeometry(0.02, 0.3, 0.3, 8), flat(GROVE));
    crown.position.set(0.06, RAISE + 0.88, -0.34);
    group.add(crown);
  } else {
    // The junction block, and the water standing in it.
    const block = new Mesh(new BoxGeometry(0.3, PIPE * 1.4, 0.3), flat(SANDSTONE));
    block.position.y = RAISE;
    group.add(block);
    const pool = new Mesh(new BoxGeometry(0.17, PIPE * 0.8, 0.17), flat(LAPIS));
    pool.position.y = RAISE + PIPE * 0.42;
    pool.visible = false;
    waters.push(pool);
    group.add(pool);
  }

  const colour = kind === "sink" ? GROVE : SANDSTONE;
  for (const port of BASE_PORTS[kind]) {
    const { channel, water } = arm(port, colour);
    group.add(channel);
    group.add(water);
    waters.push(water);
  }
  return { group, waters, core };
}

type Piece = {
  group: Group;
  waters: FlatMesh[];
  core: Mesh | null;
  kind: Kind;
  shown: number;
  target: number;
  rotation: Rotation;
};

export type Board = {
  render: () => void;
  sync: (grid: Grid) => void;
  /** Colour the route the water actually took, and show it leaving wherever
   *  it leaves. This is the game's only explanation of itself. */
  wet: (trace: Trace, filled: number) => void;
  look: (view: View) => void;
  step: (dt: number) => void;
  resize: (width: number, height: number) => void;
  /** Fraction of the canvas the grid occupies, so the DOM pick overlay can be
   *  laid over it without projecting anything. */
  extent: () => { width: number; height: number };
  /** The shape of the frustum, so the page can size the stage to match. */
  aspect: () => number;
  groundHeight: () => number;
  lift: () => number;
  dispose: () => void;
};

export function createBoard(canvas: HTMLCanvasElement, grid: Grid): Board {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  const scene = new Scene();

  // The frustum follows the board's own proportions, so a wide level fills a
  // wide stage instead of floating in a square one.
  const spanX = (grid.width * CELL) / 2 + 0.35;
  // The board foreshortens under the tilt, and modules stand up into the space
  // that frees, so the vertical span follows the PROJECTED depth plus headroom.
  const spanY = ((grid.height * CELL) / 2) * Math.cos(TILT) + 0.5;
  const camera = new OrthographicCamera(-spanX, spanX, spanY, -spanY, 0.1, 100);

  // Ochre is the sand, sandstone is the masonry of the channels, lapis is the
  // water. Read that way round, water contrasts 6.43:1 against the channel it
  // runs in — the game's single most important distinction — where the other
  // way round it managed 2.76:1. It also gives the board its own edge against
  // the sandstone page, with no rim needed.
  const ground = new Mesh(
    new BoxGeometry(grid.width * CELL + 0.3, 0.12, grid.height * CELL + 0.3),
    flat(OCHRE),
  );
  ground.position.y = -0.18;
  scene.add(ground);

  const modules = new Group();
  scene.add(modules);

  // Water leaving the board, drawn where it leaves. Rebuilt each pour.
  const leaks = new Group();
  scene.add(leaks);

  const pieces = new Map<number, Piece>();

  const at = (index: number): [number, number] => [
    (index % grid.width) - (grid.width - 1) / 2,
    Math.floor(index / grid.width) - (grid.height - 1) / 2,
  ];

  function sync(next: Grid): void {
    next.cells.forEach((cell, index) => {
      if (!cell) return;
      let piece = pieces.get(index);
      if (!piece) {
        const { group, waters, core } = moduleGroup(cell.kind);
        const [x, z] = at(index);
        group.position.set(x * CELL, 0, z * CELL);
        group.rotation.y = angleFor(cell.rotation);
        modules.add(group);
        piece = {
          group,
          waters,
          core,
          kind: cell.kind,
          shown: angleFor(cell.rotation),
          target: angleFor(cell.rotation),
          rotation: cell.rotation,
        };
        pieces.set(index, piece);
        return;
      }
      if (piece.rotation !== cell.rotation) {
        // Always turn the short way round, in the direction a click means.
        const quarters = (cell.rotation - piece.rotation + 4) % 4;
        piece.target -= (quarters * Math.PI) / 2;
        piece.rotation = cell.rotation;
      }
    });
  }

  let view: View = "play";
  let pulse = 0;
  let progress = 1;
  let from = VIEWS.play;

  function place(): void {
    const to = VIEWS[view];
    const t = progress * progress * (3 - 2 * progress);
    camera.position.set(
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
    );
    camera.lookAt(0, 0, 0);
  }

  sync(grid);
  place();

  function wet(trace: Trace, filled: number): void {
    for (const [index, piece] of pieces) {
      const running = trace.wet.has(index);
      // The grove never turns blue: colouring its arms buries the one green
      // thing on the board under the very water it is supposed to be
      // collecting. Its pool says the water arrived instead.
      // The masonry never changes colour. Water simply appears in it, which is
      // a difference of SHAPE as much as hue, so the live route survives a
      // colour-vision difference.
      for (const mesh of piece.waters) mesh.visible = running;
      if (piece.kind === "sink" && piece.core) {
        // The pool grows with what has been delivered. No number anywhere.
        const size = 0.1 + Math.min(1, filled) * 0.62;
        piece.core.scale.set(size / 0.1, 1, size / 0.1);
      }
    }

    leaks.clear();
    for (const { index, port, amount } of trace.spills) {
      if (amount <= 0.001) continue;
      const [x, z] = at(index);
      const [dx, dz] = HEADING[port];
      // A puddle, not more pipe: it spreads ACROSS the direction the water was
      // travelling and sits low on the sand, so a spill never reads as another
      // length of channel. Bigger share, wider puddle.
      const spread = (0.5 + Math.min(1, amount) * 0.34) * CELL;
      const depth = 0.3 * CELL;
      const blob = new Mesh(
        new BoxGeometry(dx !== 0 ? depth : spread, 0.07, dx !== 0 ? spread : depth),
        flat(LAPIS),
      );
      blob.position.set((x + dx * 0.66) * CELL, 0.035, (z + dz * 0.66) * CELL);
      leaks.add(blob);
    }
  }

  return {
    render: () => renderer.render(scene, camera),
    sync,
    wet,
    look: (next) => {
      if (next === view) return;
      from = [camera.position.x, camera.position.y, camera.position.z];
      view = next;
      progress = 0;
    },
    step: (dt) => {
      if (progress < 1) {
        progress = Math.min(1, progress + dt / 0.5);
        place();
      }
      // A spill that pulses reads as ongoing loss; a static one reads as decor.
      pulse += dt;
      const beat = 1 + Math.sin(pulse * 6) * 0.07;
      leaks.scale.set(beat, 1, beat);

      for (const piece of pieces.values()) {
        if (Math.abs(piece.shown - piece.target) < 0.001) {
          piece.shown = piece.target;
          continue;
        }
        piece.shown += (piece.target - piece.shown) * Math.min(1, dt * 12);
        piece.group.rotation.y = piece.shown;
      }
    },
    resize: (width, height) => {
      // The frustum is fixed to the board; the stage is sized to match it, so
      // resizing only ever changes resolution, never framing.
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(width, height, false);
    },
    extent: () => ({
      width: (grid.width * CELL) / (2 * spanX),
      // Divided by cos(TILT) because the overlay is sized BEFORE it is tilted:
      // rotateX shrinks it back to exactly the board's projected depth.
      height: (grid.height * CELL) / (2 * spanY * Math.cos(TILT)),
    }),
    aspect: () => spanX / spanY,
    /** Modules stand RAISE above the sand, so their tops project higher up the
     *  screen than the ground squares they occupy. The overlay shifts by the
     *  same amount or every button sits low of the thing it selects. */
    lift: () => (RAISE * Math.sin(TILT)) / (2 * spanY),
    /** Fraction of the canvas height the sand covers. The gauges match it, so
     *  the three columns read as one object instead of three. */
    groundHeight: () => ((grid.height * CELL + 0.3) * Math.cos(TILT)) / (2 * spanY),
    dispose: () => renderer.dispose(),
  };
}
