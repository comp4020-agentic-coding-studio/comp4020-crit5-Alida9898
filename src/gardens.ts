// Level data, hand-written literals.
//
// Every coordinate here is chosen against one property of the isometric map
// (see `project` in illusion.ts): adding 1 to y while adding 1 to x and 1 to z
// leaves the point exactly where it was on screen. So (1,0,1) and (2,1,2) are
// the same pixel and a storey apart, and a run of nodes stepping +1,+1,+1
// climbs the ziggurat while sliding straight DOWN the picture.
//
// That is the whole illusion, and it is why these numbers look repetitive:
// they are on the screen-space diagonal on purpose.

import type { Node, Part, Seam, Turns } from "./illusion.ts";

export type Level = {
  name: string;
  parts: Part[];
  nodes: Node[];
  seams: Seam[];
  /** How the building stands when the level opens. */
  turns: Turns;
  /** Where the figure may be set down. One entry means it cannot be moved. */
  stands: string[];
  /** Where it stands when the level opens — water begins here. */
  stood: string;
  /** The top garden. Water here finishes the level. */
  goal: string;
};

export const LEVELS: Level[] = [
  {
    // Teaches: turning a terrace changes what joins.
    //
    // One terrace turns, and only at rest does its channel mouth land on the
    // quay's. Nothing else on the board can be clicked, so the first move
    // cannot be got wrong — and the payoff is immediate: water crosses a gap
    // it plainly should not cross, and climbs two storeys doing it.
    name: "the first course",
    // The route zig-zags ACROSS the picture as it descends it. Putting every
    // node on x = z would be simpler and was the first thing tried, but it
    // projects every one of them onto screen x = 0 — the ziggurat comes out as
    // a single vertical column. Alternating which of x and z advances is what
    // makes it read as terraces.
    parts: [{ id: "spur", pivot: [5, 1, 5] }],
    nodes: [
      { id: "river", part: null, at: [0, 0, 0], course: 0 },
      { id: "bend", part: null, at: [2, 0, 0], course: 0 },
      { id: "quay", part: null, at: [2, 0, 2], course: 0 },
      { id: "mouth", part: "spur", at: [3, 1, 3], course: 1 },
      { id: "walk", part: "spur", at: [5, 1, 3], course: 1 },
      { id: "garden", part: "spur", at: [5, 1, 5], course: 1 },
    ],
    seams: [
      { from: "river", to: "bend", when: {} },
      { from: "bend", to: "quay", when: {} },
      // The illusion: the quay is on the ground, the mouth is a storey above
      // it, and at rest they land on the same pixel.
      { from: "quay", to: "mouth", when: { spur: 0 }, illusion: true },
      // These two run along the turning terrace itself, and they still carry a
      // `when`: swing the terrace round and its own channel is pointing up the
      // screen, so water stops running along it. That is not a special case —
      // it is the same rule, applied to a piece that moved.
      { from: "mouth", to: "walk", when: { spur: 0 } },
      { from: "walk", to: "garden", when: { spur: 0 } },
    ],
    turns: { spur: 3 },
    stands: ["river"],
    stood: "river",
    goal: "garden",
  },
  {
    // Teaches: water only goes where it LOOKS lower.
    //
    // The landing sits on the turning terrace's pivot, so it is joined to the
    // quay from the very first frame — water arrives there and then simply
    // stops, because the channel beyond it is pointing up the picture. Nothing
    // is broken and nothing is disconnected; the player has to notice that
    // being joined is not the same as being downhill.
    name: "uphill",
    parts: [{ id: "arm", pivot: [3, 1, 3] }],
    nodes: [
      { id: "river", part: null, at: [0, 0, 0], course: 0 },
      // Bends the other way from level 1's, so that no turned-away position
      // of the garden lands on the same pixel as it. Two terraces sharing a
      // point is not an illusion, it is a mess.
      { id: "bend", part: null, at: [0, 0, 2], course: 0 },
      { id: "fork", part: null, at: [2, 0, 2], course: 0 },
      { id: "landing", part: "arm", at: [3, 1, 3], course: 1 },
      { id: "garden", part: "arm", at: [5, 1, 3], course: 1 },
    ],
    seams: [
      { from: "river", to: "bend", when: {} },
      { from: "bend", to: "fork", when: {} },
      // Always joined — the landing is the pivot, so it never moves.
      { from: "fork", to: "landing", when: {}, illusion: true },
      // Only downhill at rest. Everywhere else the garden is ABOVE the
      // landing on screen, and the water will not climb.
      { from: "landing", to: "garden", when: { arm: 0 } },
    ],
    turns: { arm: 3 },
    stands: ["river"],
    stood: "river",
    goal: "garden",
  },
  {
    // Teaches: both rules at once. The lower terrace has to be turned to make
    // a join; the upper one is already joined and has to be turned to make the
    // last channel run downhill.
    name: "two courses",
    parts: [
      { id: "lower", pivot: [5, 1, 5] },
      { id: "upper", pivot: [6, 2, 6] },
    ],
    nodes: [
      { id: "river", part: null, at: [0, 0, 0], course: 0 },
      { id: "bend", part: null, at: [2, 0, 0], course: 0 },
      { id: "quay", part: null, at: [2, 0, 2], course: 0 },
      { id: "bridge", part: "lower", at: [3, 1, 3], course: 1 },
      { id: "span", part: "lower", at: [5, 1, 3], course: 1 },
      { id: "hinge", part: "lower", at: [5, 1, 5], course: 1 },
      { id: "upper", part: "upper", at: [6, 2, 6], course: 2 },
      { id: "garden", part: "upper", at: [8, 2, 6], course: 2 },
    ],
    seams: [
      { from: "river", to: "bend", when: {} },
      { from: "bend", to: "quay", when: {} },
      { from: "quay", to: "bridge", when: { lower: 0 }, illusion: true },
      { from: "bridge", to: "span", when: { lower: 0 } },
      { from: "span", to: "hinge", when: { lower: 0 } },
      { from: "hinge", to: "upper", when: { lower: 0 }, illusion: true },
      { from: "upper", to: "garden", when: { upper: 0 } },
    ],
    turns: { lower: 2, upper: 3 },
    stands: ["river"],
    stood: "river",
    goal: "garden",
  },
];
