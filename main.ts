// Entry point. Lives at the repo root because that is where tsconfig looks
// (see CLAUDE.md on `tsconfig.include`).

import { mount } from "./src/board.ts";

const el = {
  canvas: document.querySelector<HTMLCanvasElement>("#board"),
  cells: document.querySelector<HTMLElement>("#cells"),
  stage: document.querySelector<HTMLElement>("#stage"),
  tank: document.querySelector<HTMLElement>("#tank"),
  grove: document.querySelector<HTMLElement>("#grove"),
  progress: document.querySelector<HTMLElement>("#progress"),
};

if (el.canvas && el.cells && el.stage && el.tank && el.grove && el.progress) {
  mount({
    canvas: el.canvas,
    cells: el.cells,
    stage: el.stage,
    tank: el.tank,
    grove: el.grove,
    progress: el.progress,
  });
}
