// Connectivity is DECLARED, never inferred. Every table below is hand-written.
//
// Nothing here computes an angle, projects a point, or overlaps a box. A
// module's rotation is one of four enumerated states, and each state carries an
// explicit list of directed links: water entering at `from` leaves at `to`.
// Geometric connectivity fails softly — a pipe that looks joined and isn't
// reads as a bug in the puzzle rather than a bug in the tolerance, and the fix
// is a magic epsilon nobody can defend. A table is wrong loudly.
//
// The renderer's job is to draw a module so it MATCHES its table. The table is
// never derived from what was drawn.

export type Port = "N" | "E" | "S" | "W";
export type Rotation = 0 | 1 | 2 | 3;
export type Kind = "source" | "sink" | "straight" | "elbow" | "tee";

/** Water entering at `from` leaves at `to`. Several entries sharing a `from`
 *  are a split: the flow divides evenly between them. */
export type Link = { from: Port; to: Port };

export const PORTS: readonly Port[] = ["N", "E", "S", "W"];
export const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];

/** One module on the board. `locked` modules are scenery the player can't turn
 *  — the source and the sink — which is what keeps level 1 unambiguous. */
export type Cell = { kind: Kind; rotation: Rotation; locked?: boolean };

/** A board. `cells` is row-major, `null` where the ground is bare. */
export type Grid = { width: number; height: number; cells: (Cell | null)[] };

/** The port facing you across a shared edge. */
export function opposite(port: Port): Port {
  switch (port) {
    case "N":
      return "S";
    case "S":
      return "N";
    case "E":
      return "W";
    case "W":
      return "E";
  }
}

// A straight run. Two states would do, but all four are written out so every
// rotation resolves in the table and the enumeration has no holes.
const STRAIGHT: Record<Rotation, Link[]> = {
  0: [
    { from: "N", to: "S" },
    { from: "S", to: "N" },
  ],
  1: [
    { from: "E", to: "W" },
    { from: "W", to: "E" },
  ],
  2: [
    { from: "N", to: "S" },
    { from: "S", to: "N" },
  ],
  3: [
    { from: "E", to: "W" },
    { from: "W", to: "E" },
  ],
};

// A quarter turn, rotating clockwise from the N–E corner.
const ELBOW: Record<Rotation, Link[]> = {
  0: [
    { from: "N", to: "E" },
    { from: "E", to: "N" },
  ],
  1: [
    { from: "E", to: "S" },
    { from: "S", to: "E" },
  ],
  2: [
    { from: "S", to: "W" },
    { from: "W", to: "S" },
  ],
  3: [
    { from: "W", to: "N" },
    { from: "N", to: "W" },
  ],
};

// Three open ports; the rotation names the port that is CLOSED. Entering at any
// open port splits evenly between the other two — which is how a tee spills:
// leave one arm pointing at nothing and half the water goes there.
const TEE: Record<Rotation, Link[]> = {
  // closed S
  0: [
    { from: "N", to: "E" },
    { from: "N", to: "W" },
    { from: "E", to: "N" },
    { from: "E", to: "W" },
    { from: "W", to: "N" },
    { from: "W", to: "E" },
  ],
  // closed W
  1: [
    { from: "N", to: "E" },
    { from: "N", to: "S" },
    { from: "E", to: "N" },
    { from: "E", to: "S" },
    { from: "S", to: "N" },
    { from: "S", to: "E" },
  ],
  // closed N
  2: [
    { from: "E", to: "S" },
    { from: "E", to: "W" },
    { from: "S", to: "E" },
    { from: "S", to: "W" },
    { from: "W", to: "E" },
    { from: "W", to: "S" },
  ],
  // closed E
  3: [
    { from: "N", to: "S" },
    { from: "N", to: "W" },
    { from: "S", to: "N" },
    { from: "S", to: "W" },
    { from: "W", to: "N" },
    { from: "W", to: "S" },
  ],
};

const PIPES: Record<"straight" | "elbow" | "tee", Record<Rotation, Link[]>> = {
  straight: STRAIGHT,
  elbow: ELBOW,
  tee: TEE,
};

/** The single port a source pushes water out of, per rotation. */
const SOURCE_EXIT: Record<Rotation, Port> = { 0: "N", 1: "E", 2: "S", 3: "W" };

/**
 * Where water entering `kind` at `port` leaves. Empty means it goes nowhere —
 * a dead end, which the flow treats as a spill.
 *
 * A sink swallows water rather than forwarding it, so it never appears here;
 * `accepts` is what says a sink can be entered.
 */
export function exitsFrom(kind: Kind, rotation: Rotation, port: Port): Port[] {
  if (kind === "sink" || kind === "source") return [];
  return PIPES[kind][rotation].filter((link) => link.from === port).map((link) => link.to);
}

/** Can water enter this module at this port at all? Pure table lookup. */
export function accepts(kind: Kind, rotation: Rotation, port: Port): boolean {
  // A sink takes water from any direction; that is what makes it a sink.
  if (kind === "sink") return true;
  // A source only pushes. Water arriving at one has nowhere to go.
  if (kind === "source") return false;
  return PIPES[kind][rotation].some((link) => link.from === port);
}

/** The port a source pushes out of. */
export function sourceExit(rotation: Rotation): Port {
  return SOURCE_EXIT[rotation];
}

/** Clicking a module advances it one enumerated state. Never an angle. */
export function rotated(rotation: Rotation): Rotation {
  return ((rotation + 1) % 4) as Rotation;
}
