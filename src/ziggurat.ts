// The Three.js layer: glazed brick, flat colour, orthographic isometric.
//
// The camera sits at (D, D, D) looking at the origin, which is EXACTLY the map
// `project` in illusion.ts implements. That is not a coincidence to be kept up
// by hand — it is why picking can use `project` and land on the right terrace,
// and why `spec/illusion.test.ts` can check a seam by projecting its ends.
// Move this camera off the cube diagonal and all three stop agreeing.

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from "three";
import type { Level } from "./gardens.ts";
import type { NodeId, Turns, Vec3 } from "./illusion.ts";
import { nodeAt, project, turnedAround } from "./illusion.ts";
import { GROVE, LAPIS, OCHRE, SANDSTONE } from "./palette.ts";

/** Camera distance along the cube diagonal. Any value gives the same picture
 *  under an orthographic camera; this one just clears the near plane. */
const D = 40;

const TERRACE = 0.92;
const DECK = 0.26;

const flat = (colour: string): MeshBasicMaterial => new MeshBasicMaterial({ color: colour });

/** Fixed camera angles, animated between. Never a free orbit.
 *  All three are on the cube diagonal so the projection never changes — what
 *  changes is how much of the ziggurat is in frame. */
export type Shot = "survey" | "close";

export type Garden = {
  render: () => void;
  step: (dt: number) => void;
  /** Move the terraces to a configuration. */
  setTurns: (turns: Turns) => void;
  /** Which nodes have water, and which courses have been watered. */
  setWater: (wet: Set<NodeId>, courses: Set<number>) => void;
  /** Where the figure stands. */
  setFigure: (node: NodeId) => void;
  look: (shot: Shot) => void;
  resize: (width: number, height: number) => void;
  /** Screen position of a model point, as a fraction of the canvas — the same
   *  isometric map the camera uses, so the DOM buttons land on the terraces. */
  toScreen: (p: Vec3) => { x: number; y: number };
  dispose: () => void;
};

export function createGarden(canvas: HTMLCanvasElement, level: Level): Garden {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  const scene = new Scene();

  // Frame the whole building, in every configuration it can be turned into,
  // so nothing ever swings out of shot mid-puzzle.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of level.nodes) {
    for (const turn of [0, 1, 2, 3] as const) {
      const part = level.parts.find((p) => p.id === node.part);
      const at = part ? turnedAround(node.at, part.pivot, turn) : node.at;
      const [sx, sy] = project(at);
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
    }
  }
  // Square the frame so the isometric grid stays undistorted, then pad it.
  const pad = 1.0;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY) / 2 + pad;

  // The camera sits on the cube diagonal, so camera-space x and y ARE what
  // `project` returns. The frustum is therefore just that range — no view
  // offset, no fudging: put the projected bounds straight in.
  const camera = new OrthographicCamera(
    midX - half,
    midX + half,
    midY + half,
    midY - half,
    0.1,
    400,
  );
  camera.position.set(D, D, D);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  const world = new Group();
  scene.add(world);

  type Piece = {
    group: Group;
    node: NodeId;
    /** Water lying on this terrace. */
    water: Mesh;
    /** Palms and vines, grown when this course is watered. */
    planting: Group;
    grown: number;
    growing: number;
    home: Vec3;
    shown: Vec3;
  };

  const pieces = new Map<NodeId, Piece>();

  function terrace(course: number): Group {
    const group = new Group();
    const deck = new Mesh(new BoxGeometry(TERRACE, DECK, TERRACE), flat(SANDSTONE));
    group.add(deck);
    // A course of ochre brick under the lip. Higher terraces carry more of it,
    // so the ziggurat reads as stepped even where the storeys are far apart.
    const band = new Mesh(
      new BoxGeometry(TERRACE * 0.98, 0.09 + course * 0.11, TERRACE * 0.98),
      flat(OCHRE),
    );
    band.position.y = -DECK / 2 - 0.045 - course * 0.025;
    group.add(band);

    // Piers. The trick costs these terraces their screen height, so the
    // architecture has to say "this is up in the air" some other way.
    if (course > 0) {
      for (const [px, pz] of [
        [0.3, 0.3],
        [-0.3, 0.3],
        [0.3, -0.3],
      ]) {
        // Sandstone, not ochre: an ochre pier on ochre sand is invisible.
        const pier = new Mesh(new BoxGeometry(0.13, 0.5 + course * 0.32, 0.13), flat(SANDSTONE));
        pier.position.set(px, -DECK / 2 - (0.5 + course * 0.3) / 2 - 0.1, pz);
        group.add(pier);
      }
    }
    return group;
  }

  function planting(): Group {
    const group = new Group();
    {
      const [px, pz, h] = [0.24, -0.22, 0.54];
      const trunk = new Mesh(new CylinderGeometry(0.03, 0.045, h, 6), flat(OCHRE));
      trunk.position.set(px, DECK / 2 + h / 2, pz);
      group.add(trunk);
      const crown = new Mesh(new CylinderGeometry(0.02, 0.19, 0.17, 7), flat(GROVE));
      crown.position.set(px, DECK / 2 + h + 0.06, pz);
      group.add(crown);
    }
    // A vine spilling over the edge — the thing that eventually reaches the
    // camera when every course is green.
    const vine = new Mesh(new BoxGeometry(0.09, 0.34, 0.09), flat(GROVE));
    vine.position.set(TERRACE / 2 - 0.05, -0.14, TERRACE / 2 - 0.05);
    group.add(vine);
    group.scale.setScalar(0.001);
    group.visible = false;
    return group;
  }

  for (const node of level.nodes) {
    const group = new Group();
    group.add(terrace(node.course));

    const water = new Mesh(new BoxGeometry(TERRACE * 0.46, 0.14, TERRACE * 0.46), flat(LAPIS));
    water.position.y = DECK / 2 + 0.07;
    water.visible = false;
    group.add(water);

    const green = planting();
    group.add(green);

    world.add(group);
    pieces.set(node.id, {
      group,
      node: node.id,
      water,
      planting: green,
      grown: 0,
      growing: 0,
      home: node.at,
      shown: node.at,
    });
  }

  // Channels between ends that really do meet. An illusion seam gets nothing
  // drawn across it — that gap is the point, and the picture closes it.
  const channels = new Group();
  world.add(channels);

  function drawChannels(turns: Turns): void {
    channels.clear();
    for (const seam of level.seams) {
      if (seam.illusion) continue;
      const a = level.nodes.find((n) => n.id === seam.from);
      const b = level.nodes.find((n) => n.id === seam.to);
      if (!a || !b) continue;
      const pa = nodeAt(a, level.parts, turns);
      const pb = nodeAt(b, level.parts, turns);
      const mid: Vec3 = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2];
      const span = Math.hypot(pb[0] - pa[0], pb[2] - pa[2]);
      const angle = Math.atan2(pb[0] - pa[0], pb[2] - pa[2]);
      const duct = new Mesh(new BoxGeometry(0.34, 0.12, span), flat(SANDSTONE));
      duct.position.set(mid[0], mid[1] + DECK / 2 + 0.06, mid[2]);
      duct.rotation.y = angle;
      channels.add(duct);
      // The water lying in that channel, narrower than the masonry holding it
      // so it always reads as water IN something.
      const run = new Mesh(new BoxGeometry(0.16, 0.12, span), flat(LAPIS));
      run.position.set(mid[0], mid[1] + DECK / 2 + 0.1, mid[2]);
      run.rotation.y = angle;
      run.name = `run:${seam.from}`;
      channels.add(run);
    }
  }

  // The figure: where the water begins.
  const figure = new Group();
  {
    const body = new Mesh(new BoxGeometry(0.15, 0.3, 0.11), flat(OCHRE));
    body.position.y = 0.15;
    figure.add(body);
    const head = new Mesh(new SphereGeometry(0.095, 10, 8), flat(OCHRE));
    head.position.y = 0.38;
    figure.add(head);
  }
  world.add(figure);

  let turnsNow: Turns = { ...level.turns };

  function setTurns(turns: Turns): void {
    turnsNow = { ...turns };
    for (const node of level.nodes) {
      const piece = pieces.get(node.id);
      if (!piece) continue;
      piece.home = nodeAt(node, level.parts, turnsNow);
    }
    drawChannels(turnsNow);
  }

  function setWater(wet: Set<NodeId>, courses: Set<number>): void {
    for (const child of channels.children) {
      if (child.name.startsWith("run:")) child.visible = wet.has(child.name.slice(4));
    }
    for (const node of level.nodes) {
      const piece = pieces.get(node.id);
      if (!piece) continue;
      piece.water.visible = wet.has(node.id);
      // A watered course puts out palms. This is the entire win feedback.
      if (node.course > 0 && courses.has(node.course)) piece.growing = 1;
    }
  }

  function setFigure(at: NodeId): void {
    const piece = pieces.get(at);
    if (!piece) return;
    figure.position.set(piece.shown[0] - 0.24, piece.shown[1] + DECK / 2, piece.shown[2] + 0.24);
  }

  let shot: Shot = "survey";
  let zoom = 1;
  let zoomTo = 1;

  setTurns(level.turns);
  for (const piece of pieces.values()) piece.group.position.set(...piece.home);
  setFigure(level.stood);

  return {
    render: () => renderer.render(scene, camera),
    step: (dt) => {
      for (const piece of pieces.values()) {
        // Terraces glide to their new position rather than snapping, so a turn
        // is legible as a movement of the building.
        const k = Math.min(1, dt * 7);
        piece.shown = [
          piece.shown[0] + (piece.home[0] - piece.shown[0]) * k,
          piece.shown[1] + (piece.home[1] - piece.shown[1]) * k,
          piece.shown[2] + (piece.home[2] - piece.shown[2]) * k,
        ];
        piece.group.position.set(...piece.shown);

        if (piece.growing > 0 && piece.grown < 1) {
          piece.grown = Math.min(1, piece.grown + dt * 1.1);
          piece.planting.visible = true;
          // Overshoot slightly, the way a plant settles.
          const s = piece.grown * (1 + 0.16 * Math.sin(piece.grown * Math.PI));
          piece.planting.scale.setScalar(Math.max(0.001, s));
        }
      }
      if (Math.abs(zoom - zoomTo) > 0.001) {
        zoom += (zoomTo - zoom) * Math.min(1, dt * 3);
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
      }
      setFigure(level.stood);
    },
    setTurns,
    setWater,
    setFigure,
    look: (next) => {
      shot = next;
      zoomTo = next === "close" ? 1.18 : 1;
    },
    resize: (width, height) => {
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(width, height, false);
    },
    toScreen: (p) => {
      const [sx, sy] = project(p);
      return {
        x: (sx - midX + half) / (2 * half),
        y: 1 - (sy - midY + half) / (2 * half),
      };
    },
    dispose: () => {
      void shot;
      renderer.dispose();
    },
  };
}
