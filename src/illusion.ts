// The impossible geometry, as data.
//
// Water runs to wherever it LOOKS lower, and two channels join when they LOOK
// joined. Both of those are statements about the picture, not about space, so
// both are hand-written declarations — never derived. That is the agreed
// constraint, and it is also the only honest reading of the mechanic: "looks
// joined" is an art judgement, and deriving it from a projection needs a
// tolerance nobody can defend. At runtime the game only ever looks up a table.
//
// The projection below exists for two things and neither of them is deciding
// what connects: drawing, and letting `spec/illusion.test.ts` check that the
// model still agrees with what the tables claim.

export type Vec3 = [number, number, number];
export type NodeId = string;
export type PartId = string;
export type Turn = 0 | 1 | 2 | 3;

/** A place water can be: a terrace, a channel mouth, a basin. */
export type Node = {
  id: NodeId;
  /** The rotatable part it rides on; null pins it to the ziggurat. */
  part: PartId | null;
  /** Model position with every part at turn 0. Drawing and checking only. */
  at: Vec3;
  /** Which terrace course it belongs to, for the planting. */
  course: number;
};

/** A terrace that turns. */
export type Part = { id: PartId; pivot: Vec3 };

/**
 * A hand-written claim: in this configuration these two ends look joined, and
 * water runs from `from` to `to`, because `to` looks lower.
 *
 * Directed, because on screen it is the picture that decides which way is
 * downhill, and the picture is the art's job to arrange and this table's job
 * to state.
 */
export type Seam = {
  from: NodeId;
  to: NodeId;
  when: Partial<Record<PartId, Turn>>;
  /**
   * An ILLUSION seam: two separate structures that only look joined, from
   * this angle, in this configuration. `spec/illusion.test.ts` projects both
   * ends and insists they land on the same point — that is the check keeping
   * the model honest about a claim the table makes.
   *
   * Omit it for a plain channel running between two ends that really do meet.
   */
  illusion?: boolean;
};

/**
 * True isometric projection, matching the camera exactly.
 *
 *   screen x = (x - z) / √2
 *   screen y = (2y - x - z) / √6      (larger = higher up the screen)
 *
 * The whole game lives in one property of this map: raising y by 1 while
 * raising x and z by 1 each leaves BOTH coordinates unchanged. So (1,0,1) and
 * (2,1,2) are the same point on screen and a storey apart in the world — which
 * is how water runs visibly downhill while climbing a ziggurat.
 */
export function project(p: Vec3): [number, number] {
  return [(p[0] - p[2]) / Math.SQRT2, (2 * p[1] - p[0] - p[2]) / Math.sqrt(6)];
}

/** Rotate a point a quarter turn about a part's vertical axis. */
export function turnedAround(p: Vec3, pivot: Vec3, turn: Turn): Vec3 {
  const dx = p[0] - pivot[0];
  const dz = p[2] - pivot[2];
  const angle = (-turn * Math.PI) / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [pivot[0] + dx * cos + dz * sin, p[1], pivot[2] - dx * sin + dz * cos];
}

export type Turns = Record<PartId, Turn>;

/** Where a node actually is, given how its part is turned. Drawing only. */
export function nodeAt(node: Node, parts: Part[], turns: Turns): Vec3 {
  if (!node.part) return node.at;
  const part = parts.find((p) => p.id === node.part);
  if (!part) return node.at;
  return turnedAround(node.at, part.pivot, turns[node.part] ?? 0);
}

/** Is this seam's configuration the one currently on the board? */
export function active(seam: Seam, turns: Turns): boolean {
  return Object.entries(seam.when).every(([part, turn]) => turns[part] === turn);
}

/** One quarter turn on. Rotation is an enumeration, never an angle. */
export function turned(turn: Turn): Turn {
  return ((turn + 1) % 4) as Turn;
}

export type Flow = {
  /** Nodes the water reached. */
  wet: Set<NodeId>;
  /** Terrace courses the water reached — these are the ones that grow. */
  courses: Set<number>;
  /** Did it get to the top garden? */
  reached: boolean;
};

/**
 * Run the water from `from` and see how far it gets.
 *
 * A pure walk over the declared seams and nothing else: no projection, no
 * heights, no geometry. Water follows a seam only in the direction the seam
 * declares, which is what makes "it only goes where it looks lower" a rule the
 * game can state rather than a thing it computes.
 */
export function flow(
  nodes: Node[],
  seams: Seam[],
  turns: Turns,
  from: NodeId,
  goal: NodeId,
): Flow {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const wet = new Set<NodeId>();
  const courses = new Set<number>();
  const queue: NodeId[] = [from];

  while (queue.length > 0) {
    const here = queue.shift();
    if (here === undefined || wet.has(here)) continue;
    wet.add(here);
    const node = byId.get(here);
    if (node) courses.add(node.course);
    for (const seam of seams) {
      if (seam.from !== here || !active(seam, turns)) continue;
      if (!wet.has(seam.to)) queue.push(seam.to);
    }
  }

  return { wet, courses, reached: wet.has(goal) };
}
