// Wires the puzzle to the page.
//
// Picking is a DOM button per turnable terrace, positioned with the SAME
// isometric map the camera uses — not a raycast, which the constraints rule
// out, and which would be the worse answer anyway: a canvas is opaque to axe,
// while buttons are focusable and named.

import type { Level } from "./gardens.ts";
import { LEVELS } from "./gardens.ts";
import type { Turns } from "./illusion.ts";
import { flow, nodeAt, turned } from "./illusion.ts";
import { PALETTE } from "./palette.ts";
import type { Garden } from "./ziggurat.ts";
import { createGarden } from "./ziggurat.ts";

/** Input is refused this long after a turn, while the terrace swings. */
const TURN_MS = 460;
/** How long the finished garden is held before the next level. */
const HOLD_MS = 2600;

type Elements = {
  canvas: HTMLCanvasElement;
  stage: HTMLElement;
  handles: HTMLElement;
  progress: HTMLElement;
};

export function mount(el: Elements): () => void {
  const [sandstone, lapis, ochre, grove] = PALETTE;
  const root = document.documentElement.style;
  root.setProperty("--sandstone", sandstone);
  root.setProperty("--lapis", lapis);
  root.setProperty("--ochre", ochre);
  root.setProperty("--grove", grove);

  let index = 0;
  let level: Level = LEVELS[0];
  let turns: Turns = { ...level.turns };
  let stood = level.stood;
  let garden: Garden | null = null;
  let swinging: ReturnType<typeof setTimeout> | undefined;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let locked = false;
  let done = false;

  function clearTimers(): void {
    if (swinging !== undefined) clearTimeout(swinging);
    if (pending !== undefined) clearTimeout(pending);
    swinging = undefined;
    pending = undefined;
  }

  function water(): void {
    const run = flow(level.nodes, level.seams, turns, stood, level.goal);
    garden?.setWater(run.wet, run.courses);
    if (run.reached && !done) finish();
  }

  function finish(): void {
    locked = true;
    el.stage.classList.add("flowered");
    garden?.look("close");
    pending = setTimeout(() => {
      el.stage.classList.remove("flowered");
      if (index + 1 >= LEVELS.length) {
        done = true;
        el.stage.classList.add("complete");
        return;
      }
      load(index + 1);
    }, HOLD_MS);
  }

  function turnPart(id: string): void {
    if (locked) return;
    locked = true;
    turns = { ...turns, [id]: turned(turns[id] ?? 0) };
    garden?.setTurns(turns);
    placeHandles();
    // Water is re-run once the terrace has arrived, so the join is seen to
    // happen rather than being true before the building looks like it.
    swinging = setTimeout(() => {
      locked = false;
      water();
    }, TURN_MS);
  }

  function placeHandles(): void {
    const buttons = level.parts.map((part) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "handle";
      // The handle rides the part's CURRENT centre, not its resting one — a
      // handle pinned to where the terrace would be if it hadn't moved sits
      // out in the sand pointing at nothing.
      const on = level.nodes.filter((n) => n.part === part.id);
      const seat = on.reduce<[number, number, number]>(
        (acc, n) => {
          const p = nodeAt(n, level.parts, turns);
          return [acc[0] + p[0] / on.length, acc[1] + p[1] / on.length, acc[2] + p[2] / on.length];
        },
        [0, 0, 0],
      );
      const { x, y } = garden?.toScreen(seat) ?? { x: 0.5, y: 0.5 };
      button.style.left = `${x * 100}%`;
      button.style.top = `${y * 100}%`;
      // A position, not an instruction.
      button.setAttribute("aria-label", `terrace ${part.id}`);
      button.addEventListener("click", () => turnPart(part.id));
      return button;
    });
    el.handles.replaceChildren(...buttons);
  }

  function paintProgress(): void {
    el.progress.replaceChildren(
      ...LEVELS.map((_, i) => {
        const dot = document.createElement("li");
        dot.className = i < index || done ? "done" : i === index ? "here" : "";
        return dot;
      }),
    );
  }

  function load(next: number): void {
    clearTimers();
    locked = false;
    index = next;
    level = LEVELS[next];
    turns = { ...level.turns };
    stood = level.stood;
    garden?.dispose();
    garden = createGarden(el.canvas, level);
    resize();
    placeHandles();
    paintProgress();
    garden.look("survey");
    water();
  }

  function resize(): void {
    const rect = el.stage.getBoundingClientRect();
    garden?.resize(rect.width, rect.height);
    placeHandles();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(el.stage);

  let last = performance.now();
  let frame = requestAnimationFrame(function loop(now) {
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    garden?.step(dt);
    garden?.render();
  });

  load(0);

  return () => {
    clearTimers();
    cancelAnimationFrame(frame);
    observer.disconnect();
    garden?.dispose();
  };
}
