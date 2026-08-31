import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Kind, Port, Rotation } from "../src/connectivity.ts";
import { PORTS, ROTATIONS, accepts, exitsFrom, sourceExit } from "../src/connectivity.ts";
import { PALETTE } from "../src/palette.ts";

// Sensors for the architectural constraints agreed in CLAUDE.md. The point is
// that breaking one is a red check rather than a code review someone has to
// remember to do — every banned API is just a string in the source.
//
// Deliberately does NOT scan spec/: this file names every banned symbol, so
// scanning itself would fail on its own patterns.

const SRC = resolve("src");

function sources(dir: string = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return extname(entry.name) === ".ts" ? [path] : [];
  });
}

const files = [...sources(), resolve("main.ts")].map((path) => ({
  path,
  text: readFileSync(path, "utf8"),
}));

// Each rule is [why it is banned, the pattern that finds it].
const BANNED: [string, RegExp][] = [
  // Connectivity is declared, never inferred.
  ["raycasting", /\bRaycaster\b/],
  ["bounding-box overlap", /\bBox3\b|\bintersectsBox\b|\bcontainsPoint\b/],
  ["screen-space projection", /\.project\s*\(|\.unproject\s*\(/],
  // Rendering is flat and orthographic.
  ["a perspective camera", /\bPerspectiveCamera\b/],
  ["orbit controls", /\bOrbitControls\b/],
  ["an imported model", /\b(GLTF|GLB|OBJ|FBX|Collada|STL)Loader\b/],
  ["a texture", /\bTextureLoader\b|\bCubeTextureLoader\b|\bmap\s*:\s*new\b/],
  ["a PBR material", /\bMesh(Standard|Physical|Lambert|Phong|Toon)Material\b/],
  ["a normal or environment map", /\bnormalMap\b|\benvMap\b|\baoMap\b|\broughnessMap\b/],
  ["shadows", /\bcastShadow\b|\breceiveShadow\b|\bshadowMap\b/],
  ["post-processing", /\bEffectComposer\b|\bRenderPass\b|\bUnrealBloom\b/],
  // Scope of this version.
  ["audio", /\bAudioContext\b|\bnew Audio\b|\bTHREE\.Audio\b/],
  ["a drag gesture", /pointermove|["']drag|\bmousemove\b/],
];

describe("architecture: the constraints hold", () => {
  for (const [why, pattern] of BANNED) {
    it(`uses no ${why}`, () => {
      const offenders = files
        .filter(({ text }) => pattern.test(text))
        .map(({ path }) => path.replace(`${resolve(".")}/`, ""));
      expect(offenders, `${offenders.join(", ")} uses ${why}`).toEqual([]);
    });
  }
});

describe("architecture: the palette is the only source of colour", () => {
  it("has no hex colour outside the palette module", () => {
    const stray = files
      .filter(({ path }) => !path.endsWith("palette.ts"))
      .flatMap(({ path, text }) =>
        [...text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => `${path}: ${m[0]}`),
      );
    expect(
      stray,
      "a canvas is opaque to axe, so contrast is only auditable when every " +
        "colour is a named constant measured once",
    ).toEqual([]);
  });

  it("is exactly four colours", () => {
    expect(PALETTE).toHaveLength(4);
    expect(new Set(PALETTE).size).toBe(4);
  });
});

describe("architecture: the connectivity enumeration has no holes", () => {
  const PIPES: Kind[] = ["straight", "elbow", "tee"];

  it("resolves every kind crossed with every rotation and port", () => {
    for (const kind of PIPES) {
      for (const rotation of ROTATIONS) {
        for (const port of PORTS) {
          // The contract is that a lookup always ANSWERS — an empty list is a
          // declared dead end, not a missing table.
          expect(Array.isArray(exitsFrom(kind, rotation, port))).toBe(true);
        }
      }
    }
  });

  it("gives every pipe at least one route in every rotation", () => {
    for (const kind of PIPES) {
      for (const rotation of ROTATIONS) {
        const routes = PORTS.flatMap((port) => exitsFrom(kind, rotation, port));
        expect(routes.length, `${kind} at rotation ${rotation} is a solid block`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it("keeps every declared route reversible", () => {
    // Water that can get in one way can get back out the way it came. A table
    // that breaks this is a one-way valve nobody designed.
    for (const kind of PIPES) {
      for (const rotation of ROTATIONS) {
        for (const from of PORTS) {
          for (const to of exitsFrom(kind, rotation, from)) {
            expect(
              exitsFrom(kind, rotation, to),
              `${kind}@${rotation}: ${from}→${to} has no way back`,
            ).toContain(from);
          }
        }
      }
    }
  });

  it("agrees with itself about which ports accept water", () => {
    for (const kind of PIPES) {
      for (const rotation of ROTATIONS) {
        for (const port of PORTS) {
          const hasRoute = exitsFrom(kind, rotation, port).length > 0;
          expect(accepts(kind, rotation, port)).toBe(hasRoute);
        }
      }
    }
  });

  it("points a source at exactly one port per rotation", () => {
    const exits = ROTATIONS.map((rotation) => sourceExit(rotation));
    expect(new Set<Port>(exits).size, "a rotation must change where a source points").toBe(4);
  });

  it("lets a sink be entered from anywhere, and a source from nowhere", () => {
    for (const rotation of ROTATIONS) {
      for (const port of PORTS) {
        expect(accepts("sink", rotation as Rotation, port)).toBe(true);
        expect(accepts("source", rotation as Rotation, port)).toBe(false);
      }
    }
  });
});
