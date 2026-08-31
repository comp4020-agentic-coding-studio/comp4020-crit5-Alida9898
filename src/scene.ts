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
const PIPE = 0.24;

/** Two enumerated camera positions, animated between. No free rotation. */
export type View = "plan" | "raised";
const VIEWS: Record<View, [number, number, number]> = {
  plan: [0, 12, 0.001],
  raised: [0, 8, 8],
};

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

function arm(port: Port, colour: string): FlatMesh {
  const [dx, dz] = HEADING[port];
  const mesh = new Mesh(new BoxGeometry(PIPE, PIPE, CELL / 2 + PIPE / 2), flat(colour));
  mesh.position.set((dx * CELL) / 4, 0, (dz * CELL) / 4);
  if (dx !== 0) mesh.rotation.y = Math.PI / 2;
  return mesh;
}

/** The pieces that turn blue when water runs through them. Keeping them in a
 *  list is what lets the board SHOW the route rather than only its result. */
type Built = { group: Group; arms: FlatMesh[]; core: Mesh | null; body: FlatMesh | null };

function moduleGroup(kind: Kind): Built {
  const group = new Group();
  const arms: FlatMesh[] = [];
  let core: Mesh | null = null;
  // The junction block at a module's centre. It has to wet with its arms, or a
  // running channel has a dry square sitting in the middle of it.
  let body: FlatMesh | null = null;

  if (kind === "source") {
    group.add(new Mesh(new CylinderGeometry(0.3, 0.34, 0.42, 16), flat(SANDSTONE)));
    core = new Mesh(new CylinderGeometry(0.21, 0.21, 0.46, 16), flat(LAPIS));
    core.position.y = 0.04;
    group.add(core);
  } else if (kind === "sink") {
    group.add(new Mesh(new BoxGeometry(0.88, 0.14, 0.88), flat(GROVE)));
    // A pool at the centre of the grove. It fills as water arrives, which is
    // the only "score" the game has and it is not a number.
    core = new Mesh(new BoxGeometry(0.1, 0.18, 0.1), flat(LAPIS));
    core.position.y = 0.06;
    group.add(core);
  } else {
    body = new Mesh(new BoxGeometry(0.34, 0.18, 0.34), flat(SANDSTONE));
    group.add(body);
  }

  const colour = kind === "sink" ? GROVE : SANDSTONE;
  for (const port of BASE_PORTS[kind]) {
    const mesh = arm(port, colour);
    arms.push(mesh);
    group.add(mesh);
  }
  return { group, arms, core, body };
}

type Piece = {
  group: Group;
  arms: FlatMesh[];
  core: Mesh | null;
  body: FlatMesh | null;
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
  dispose: () => void;
};

export function createBoard(canvas: HTMLCanvasElement, grid: Grid): Board {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  const scene = new Scene();

  // The frustum follows the board's own proportions, so a wide level fills a
  // wide stage instead of floating in a square one.
  const spanX = (grid.width * CELL) / 2 + 0.3;
  const spanY = (grid.height * CELL) / 2 + 0.3;
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
        const { group, arms, core, body } = moduleGroup(cell.kind);
        const [x, z] = at(index);
        group.position.set(x * CELL, 0, z * CELL);
        group.rotation.y = angleFor(cell.rotation);
        modules.add(group);
        piece = {
          group,
          arms,
          core,
          body,
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

  let view: View = "plan";
  let pulse = 0;
  let progress = 1;
  let from = VIEWS.plan;

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
      const wetted = running && piece.kind !== "sink";
      for (const mesh of piece.arms) {
        mesh.material.color.set(wetted ? LAPIS : piece.kind === "sink" ? GROVE : SANDSTONE);
        // Colour is not the only signal: a running channel is visibly fuller
        // than a dry one, so the route survives a colour-vision difference.
        mesh.scale.set(wetted ? 1.28 : 1, wetted ? 1.15 : 1, 1);
      }
      if (piece.body) {
        piece.body.material.color.set(wetted ? LAPIS : SANDSTONE);
        piece.body.scale.set(wetted ? 1.28 : 1, wetted ? 1.15 : 1, wetted ? 1.28 : 1);
      }
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
        new BoxGeometry(dx !== 0 ? depth : spread, 0.05, dx !== 0 ? spread : depth),
        flat(LAPIS),
      );
      blob.position.set((x + dx * 0.66) * CELL, -0.12, (z + dz * 0.66) * CELL);
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
      height: (grid.height * CELL) / (2 * spanY),
    }),
    aspect: () => spanX / spanY,
    dispose: () => renderer.dispose(),
  };
}
