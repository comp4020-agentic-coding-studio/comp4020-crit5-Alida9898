// Wires the game to the page: a DOM overlay for picking, two gauges for the
// water, and the pour loop.
//
// Picking is a grid of real <button>s laid over the canvas, NOT a raycast.
// Raycasting is banned by the agreed constraints, and the overlay is better
// anyway: a canvas is entirely opaque to axe, while buttons are focusable,
// keyboard-reachable and have names. Arrow keys and Space fall out for free.

import { trace } from "./flow.ts";
import type { State } from "./game.ts";
import { canAcceptInput, pour, rotate, settle, start } from "./game.ts";
import { LEVELS } from "./levels.ts";
import { PALETTE } from "./palette.ts";
import type { Board } from "./scene.ts";
import { createBoard } from "./scene.ts";

/** One unit of water leaves the tank this often. The tank is the clock. */
const POUR_MS = 520;
/** Input is refused for this long after a click, while the module turns. */
const ROTATE_MS = 210;
/** How long the raised camera holds on the result before moving on. */
const RESULT_MS = 1900;

type Elements = {
  canvas: HTMLCanvasElement;
  cells: HTMLElement;
  stage: HTMLElement;
  tank: HTMLElement;
  grove: HTMLElement;
  progress: HTMLElement;
};

export function mount(el: Elements): () => void {
  // The palette is owned by one module; the stylesheet reads it from here so
  // there is exactly one place a colour is written down.
  const [sandstone, lapis, ochre, grove] = PALETTE;
  const root = document.documentElement.style;
  root.setProperty("--sandstone", sandstone);
  root.setProperty("--lapis", lapis);
  root.setProperty("--ochre", ochre);
  root.setProperty("--grove", grove);

  let levelIndex = 0;
  let level = LEVELS[0];
  let state: State = start(level.grid, level.tank, level.target);
  let board: Board | null = null;
  let pouring: ReturnType<typeof setInterval> | undefined;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let finished = false;

  function clearTimers(): void {
    if (pouring !== undefined) clearInterval(pouring);
    if (pending !== undefined) clearTimeout(pending);
    pouring = undefined;
    pending = undefined;
  }

  function paintGauges(): void {
    el.tank.style.setProperty("--fill", `${(state.tank / level.tank) * 100}%`);
    const filled = Math.min(1, state.delivered / state.target);
    el.grove.style.setProperty("--fill", `${filled * 100}%`);
  }

  /** Show where the water goes with the routing as it stands. Called on every
   *  pour AND on the still opening board, so the spill is visible from the
   *  first drop rather than only in the falling gauge. */
  function paintWater(): void {
    board?.wet(trace(state.grid, 1), Math.min(1, state.delivered / state.target));
  }

  function paintProgress(): void {
    const dots = LEVELS.map((_, i) => {
      const dot = document.createElement("li");
      dot.className = i < levelIndex ? "done" : i === levelIndex ? "here" : "";
      return dot;
    });
    el.progress.replaceChildren(...dots);
  }

  function buildCells(): void {
    const { width } = state.grid;
    const extent = board?.extent() ?? { width: 1, height: 1 };
    el.cells.style.width = `${extent.width * 100}%`;
    el.cells.style.height = `${extent.height * 100}%`;
    el.cells.style.gridTemplateColumns = `repeat(${width}, 1fr)`;

    const buttons = state.grid.cells.map((cell, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.index = String(index);
      const live = Boolean(cell && !cell.locked);
      button.className = live ? "cell live" : "cell";
      button.disabled = !live;
      // A position, not an instruction: the board still has to teach itself.
      button.setAttribute(
        "aria-label",
        `row ${Math.floor(index / width) + 1}, column ${(index % width) + 1}`,
      );
      if (live) button.addEventListener("click", () => turn(index));
      return button;
    });
    el.cells.replaceChildren(...buttons);
  }

  function turn(index: number): void {
    if (!canAcceptInput(state, index)) return;
    state = rotate(state, index);
    board?.sync(state.grid);
    paintWater();
    // The board is still until the player moves. Nothing is lost by thinking,
    // and the first click is both the lesson and the start.
    startPouring();
    el.stage.classList.add("running");
    pending = setTimeout(() => {
      state = settle(state);
    }, ROTATE_MS);
  }

  function startPouring(): void {
    if (pouring !== undefined || finished) return;
    pouring = setInterval(() => {
      state = pour(state, 1);
      paintGauges();
      paintWater();
      if (state.phase === "won" || state.phase === "lost") resolve();
    }, POUR_MS);
  }

  function resolve(): void {
    clearTimers();
    const won = state.phase === "won";
    el.stage.classList.remove("running");
    el.stage.classList.add(won ? "won" : "lost");
    board?.look("raised");
    pending = setTimeout(() => {
      el.stage.classList.remove("won", "lost");
      if (!won) return load(levelIndex);
      if (levelIndex + 1 >= LEVELS.length) return complete();
      load(levelIndex + 1);
    }, RESULT_MS);
  }

  function complete(): void {
    finished = true;
    levelIndex = LEVELS.length;
    paintProgress();
    el.stage.classList.add("complete");
    board?.look("raised");
  }

  function load(next: number): void {
    clearTimers();
    levelIndex = next;
    level = LEVELS[next];
    // A fresh grid every time: a level reloaded must open exactly as it did.
    state = start(
      { ...level.grid, cells: level.grid.cells.map((cell) => (cell ? { ...cell } : null)) },
      level.tank,
      level.target,
    );
    board?.dispose();
    board = createBoard(el.canvas, state.grid);
    resize();
    buildCells();
    paintGauges();
    paintWater();
    paintProgress();
    board.look("plan");
  }

  function resize(): void {
    if (board) el.stage.style.aspectRatio = String(board.aspect());
    const rect = el.stage.getBoundingClientRect();
    board?.resize(rect.width, rect.height);
  }

  // Arrow keys walk the focus around the grid, so the whole game is reachable
  // without a mouse. Space and Enter are the button's own doing.
  el.cells.addEventListener("keydown", (event) => {
    const width = state.grid.width;
    const step: Record<string, number> = {
      ArrowUp: -width,
      ArrowDown: width,
      ArrowLeft: -1,
      ArrowRight: 1,
    };
    const delta = step[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const active = document.activeElement as HTMLElement | null;
    const from = Number(active?.dataset?.index ?? -1);
    if (from < 0) return;
    const all = [...el.cells.children] as HTMLButtonElement[];
    for (let i = from + delta; i >= 0 && i < all.length; i += delta) {
      // Stay on the row when walking sideways.
      if (Math.abs(delta) === 1 && Math.floor(i / width) !== Math.floor(from / width)) break;
      if (!all[i].disabled) {
        all[i].focus();
        return;
      }
    }
  });

  const observer = new ResizeObserver(() => {
    resize();
    buildCells();
  });
  observer.observe(el.stage);

  let last = performance.now();
  let frame = 0;
  function loop(now: number): void {
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    board?.step(dt);
    board?.render();
  }
  frame = requestAnimationFrame(loop);

  load(0);

  return () => {
    clearTimers();
    cancelAnimationFrame(frame);
    observer.disconnect();
    board?.dispose();
  };
}
